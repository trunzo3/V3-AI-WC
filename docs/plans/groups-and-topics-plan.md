# Plan: replace fixed Levels 1–4 with Library Topics + Cohort Groups

Status: PLAN ONLY — awaiting approval. No code or data changed.

## 0. What exists today (findings)

- `cohort_sections.level` (int, 1–4) is the only thing that places a section in a
  sidebar/workbook group. `cohorts.tier_access` (`{"1":bool,…,"4":bool}`) is the
  open/locked switch per level. `cohorts.settings.levelNames` renames the headings.
  `generic_sections.default_level` groups the admin library.
- Unlock rule (`lib/section-access.ts`, used by sections, notes, files, responses):
  `tierAccess[level] || !codeActive || explicitlyUnlocked`.
- Participant sidebar and workbook only show a level heading when that level has
  at least one visible section; the admin Sections tab always shows all four.
- Dev data: 4 cohorts, 4 participants, 201 cohort_sections rows across levels 1–4;
  13 library sections at default level 3, 52 at default level 4.
- `/levels` (levels.tsx) is the participant **self-assessment** ("six levels of
  fluency") — unrelated to cohort levels. No change.
- Board / dashboard admin pages do not use levels.

## 1. Every place that assumes levels 1–4 (and what changes)

### Database / shared
| Place | Today | Change |
|---|---|---|
| `lib/db/src/schema/cohorts.ts` | `cohort_sections.level`, `cohorts.tier_access`, `DEFAULT_TIER_ACCESS` | Add `cohort_groups` table, `cohort_sections.group_id`, `cohorts.groups_converted_at`. Keep old columns (frozen). |
| `lib/db/src/schema/generic-sections.ts` | `default_level` (default 3) | Add `library_topics` table and `generic_sections.topic_id`. Keep `default_level` (frozen). |
| `lib/api-spec/openapi.yaml` (16 level/tier fields) | `level`, `tierAccess`, `levelNames`, `defaultLevel` on Cohort / Section / AdminCohortSection / GenericSection | Add `groupId`, `groups[]`, `topicId`, topics endpoints, group endpoints. Old fields stay (marked deprecated) so generated clients keep compiling. |

### API server
| File | Today | Change |
|---|---|---|
| `lib/section-access.ts` | `tierAccess[String(level)]` | `group.isOpen` for the section's group (same OR rule otherwise). |
| `routes/sections.ts` (participant) | sorts by `(level, sortOrder)`, returns `level` | Return `groupId`; sort by `(group.sortOrder, sortOrder)`; add `groups` array to the response (name, order, isOpen) — or to `/auth/me`. |
| `routes/auth.ts` `/auth/me` | returns `tierAccess`, `levelNames` | Also return `groups[]`. Old fields kept. |
| `routes/admin.ts` | `levelNamesSchema` regex `^[1-4]$`; `sectionRowSchema.level 1..4`; `defaultLevel 1..4` (create + update generic); create cohort uses `DEFAULT_TIER_ACCESS`; duplicate copies `tierAccess` + rows with `level`; make-editable sets `defaultLevel: row.level`; cohort sections GET ordered by level | New CRUD routes: `/admin/cohorts/:id/groups` (list/create/rename/reorder/toggle/delete-if-empty) and `/admin/topics` (same, delete-if-empty). Bulk sections PUT takes `groupId` (must belong to the cohort); ordered by group. Duplicate copies groups then rows with remapped `groupId`. Make-editable sets `topicId` from the built-in's starting topic. Create-generic takes `topicId`. |
| `routes/workbook.ts` | `LEVEL_LABELS`, `levelNames`, `sectionsByLevel`, TOC per level, `defaultWorkbookSubtitle` (open levels' names) | Group by `groupId` using the cohort's groups (name, order); subtitle default = names of **open** groups in order. |
| `lib/cohort-sections.ts` | `STARTING_SET_SECTIONS` = built-ins with `level !== 4`; rows get `level: s.level` | Starting set unchanged in content. New cohort gets starting groups "Core Workshop" (open), "Applied Mastery" (locked), "AI Builder" (locked) — i.e. the same three groups today's new cohort effectively has — and rows get the matching `groupId`. |
| `lib/sections.ts` | `level: 1|2|3|4` literal type on built-ins, `perTierIndex {1..4}` | Built-ins keep a **starting topic** (rename field `level` → keep as `startingLevel`/map to topic name); no 1–4 literal. |
| `lib/seeded-generic-sections.ts` | each module `level: 3`; `ensureSeededGenericSections` + `attachSeededGenericSectionsToCohort` insert rows at `level: m.level` into every cohort | Modules get `topic: "AI Builder"`. Attach into the cohort's group whose `legacy_level` = 3 / or named "AI Builder"; if the cohort has no such group, skip and log (see Risks). New generic rows get `topicId` = AI Builder. |
| `seed.ts` | `COHORT_SETUP` tierAccess per base cohort; `backfillTierAccess()` merges missing keys 1–4 | Base cohorts created with starting groups (LIVE2026: AI Builder open). `backfillTierAccess` becomes a no-op/removed (tier_access frozen). Add `convertLevelsToGroups()` step (section 3). |
| `section-codes-config.ts` | comments only ("Level 1" …) | Comment cleanup only. |
| `lib/builtin-conversions.ts` | comment only | None. |
| `routes/export.ts` | selects all `cohort_sections` rows | Review: include `group` name in the export where `level` is shown today (additive column). |

### Workshop frontend
| File | Today | Change |
|---|---|---|
| `components/workshop/Sidebar.tsx` | `LEVEL_LABELS {1..4}`, groups sections by `s.level`, labels from `levelNames` | Iterate `groups` from the API in order; headings = group name; hide groups with no visible sections (today's behaviour); collapse state keyed by group id. |
| `components/admin/tabs/CohortsTab.tsx` | 4 tier switches, 4 level-name inputs, `DEFAULT_LEVEL_NAMES`, subtitle placeholder from tiers | Replace with a **Groups** editor (section 6). Subtitle placeholder = open groups' names. |
| `components/admin/tabs/SectionsTab.tsx` (85 references) | `[1,2,3,4]` loops, `changeLevel` select 1–4, `addGenericToLevel`, "Insert into level" select, library grouped by `defaultLevel`, "Remove from this level?" copy, usage list "Level N" | Cohort list grouped by the cohort's groups (with "Add group" inline); row "Group" select lists the cohort's groups; library grouped by **topics** with "Add to group…" picker; create-section dialog has "Topic" + "Add to group" selects. |
| `pages/levels.tsx`, `pages/home.tsx` | self-assessment page | None (different concept). |
| `App.tsx` | route `/levels` | None. |

### Scripts
`scripts/t4day5-setup.mjs`, `caltrans-day5-v2.mjs`, `level4-cleanup.mjs`, `check-day5-v2.mjs`, `day5-v2-hide-prompt-boxes.mjs`, `restore-generic-sections.mjs` are one-off historical scripts that key on `level`. They are not run by the app. Leave as-is; add a header comment "pre-groups; do not re-run".

## 2. Data model

New tables / columns (all additive):

```
library_topics       id serial PK, name text NOT NULL, sort_order int NOT NULL,
                     legacy_level int NULL UNIQUE, created_at
generic_sections     + topic_id int NULL REFERENCES library_topics(id)
cohort_groups        id serial PK, cohort_id int NOT NULL REFERENCES cohorts ON DELETE CASCADE,
                     name text NOT NULL, sort_order int NOT NULL, is_open boolean NOT NULL DEFAULT false,
                     legacy_level int NULL, created_at;  UNIQUE (cohort_id, legacy_level) WHERE legacy_level IS NOT NULL
cohort_sections      + group_id int NULL REFERENCES cohort_groups(id)
cohorts              + groups_converted_at timestamp NULL
```

What happens to the old fields:
- `cohort_sections.level` — kept, **frozen** (not read by new code, written as the
  group's `legacy_level` or `1` for new groups to satisfy NOT NULL). Old code during
  the rollout window still reads it correctly.
- `cohorts.tier_access` — kept, frozen. `is_open` on each group replaces it.
- `settings.levelNames` — kept, frozen; names were copied into groups.
- `generic_sections.default_level` — kept, frozen; `topic_id` replaces it.
- A later cleanup task can drop all four once production has been on groups for a while.

## 3. Conversion of existing data (step by step)

Topics (once per database):
1. Insert topics `Core Workshop (1)`, `Applied Mastery (2)`, `AI Builder (3)`,
   `AI Change Leadership (4)` with `legacy_level`, plus `AI Agents` (no legacy level,
   sort 5) — insert-if-missing by `legacy_level` / name.
2. `UPDATE generic_sections SET topic_id = topic(legacy_level = default_level) WHERE topic_id IS NULL`.

Cohorts (one transaction per cohort, skipped when `groups_converted_at IS NOT NULL`):
1. For level 1..4 create `cohort_groups` row: `name` = `settings.levelNames[level]`
   if non-blank else the app default label for that level (exactly the strings the
   sidebar shows today: "Level 1 — Core Workshop", "Level 2 — Applied Mastery",
   "Level 3 — AI Builder", "AI Change Leadership"), `sort_order` = level,
   `is_open` = `tier_access[level] === true`, `legacy_level` = level.
2. `UPDATE cohort_sections SET group_id = group(level) WHERE cohort_id = ? AND group_id IS NULL`.
3. Assert every row in the cohort now has a `group_id`; set `groups_converted_at = now()`.
4. Commit. Any failure rolls back that cohort only; the cohort stays unconverted and
   is retried on the next start.

All four groups are created even when a level has no sections, so the admin view
keeps showing four headings and participants keep seeing only non-empty ones.

## 4. Cutover (code + production data together)

- Schema: the new tables/columns go live through the normal Publish schema diff
  (all additive → no confirmation prompt, no downtime).
- Data: `convertLevelsToGroups()` runs inside the existing startup `runSeed()`
  (before `app.listen`), exactly like the seed. It is idempotent (marker column,
  insert-if-missing, per-cohort transaction) and only **adds** data, so:
  - Old instances still draining during the autoscale rollout read `level`/`tier_access`,
    which are untouched → still correct.
  - New instances read groups, which were populated before they started serving.
- **Read-time safety net:** every place the new code reads a cohort's groups goes
  through one helper, `getCohortGroups(cohort)`. If `groups_converted_at` is null
  (conversion failed or hasn't run), the helper derives the same four virtual
  groups in memory from `tier_access` + `levelNames` and sections fall back to
  `level`. Participants therefore always see the correct sections even if the
  startup conversion fails; group **editing** is refused (409) for an unconverted
  cohort until the conversion succeeds. A failed conversion is logged at error
  level and surfaced in the admin Cohorts tab as a banner.
- Partial failure: per-cohort transactions mean a cohort is either fully converted
  (marker set) or untouched. Re-running is safe at every point.
- Admin edits made in the new UI change groups only; after cutover `level`/`tier_access`
  are no longer authoritative, so the old code must not be redeployed afterwards
  (rollback would show stale group membership for anything edited post-cutover).

Sequence:
1. Dev: apply schema (`tsc -b lib/db` + psql DDL, per memory), run verification
   `snapshot` (before), restart API (conversion runs), run `compare` → must pass.
2. Prod: run verification `snapshot --env production` (read-only) **before** publishing.
3. Publish (schema diff applied, new build starts, conversion runs on boot).
4. Run `compare --env production` (read-only). Done only when it passes.

## 5. Verification script

`scripts/groups-verify.mjs snapshot|compare [--env production] [--file path]`

- Reads the database only (dev via `DATABASE_URL`; production via the read-only
  production query path). Never logs in as participants and never writes.
- For every cohort: the admin section list (sectionId, title, group heading, order,
  visible, code, codeActive, displayName).
- For every participant: the ordered group headings they see and, within each, the
  ordered visible sections with `unlocked` computed by the unlock rule
  (`open || !codeActive || explicitly unlocked`). Before conversion it computes this
  from `level`/`tier_access`/`levelNames`; after, from `cohort_groups`/`group_id`/`is_open`.
  The two code paths are deliberately separate so the comparison is meaningful.
- `snapshot` writes `generated-artifacts/groups-verify-<env>-<timestamp>.json`
  (git-ignored). `compare` recomputes with the "after" path and exits non-zero with
  a per-cohort / per-participant diff if **anything** differs (names, order,
  membership, unlocked state, codes). It also fails if any cohort lacks the marker.
- Runs: dev before/after (step 1), prod before publish and after publish (steps 2/4).

## 6. Admin screens

**Cohorts tab → Edit cohort**
- The "Open levels" switches and "Level names" inputs are replaced by a **Groups**
  list: one row per group with drag/arrow reorder, inline rename, an Open/Locked
  switch, a section count, and Delete (enabled only when count = 0). "Add group"
  appends a new group, **locked**, named "New group".
- Workbook subtitle placeholder = open groups' names joined with " · ".
- Create cohort: shows the three starting groups it will receive (Core Workshop open,
  Applied Mastery and AI Builder locked) — editable after creation.

**Sections tab**
- Left: the cohort's sections grouped under its groups (headings show name, open/
  locked badge, count). Row controls: Move up/down (within group), "Group" select
  (move to another group — appended at the end), code, code-active, visible,
  display name, Remove (unchanged). "Add group" link at the bottom of the list.
- Right: **Section library** grouped by **Topic** (collapsible, counts). A topic
  header has Rename / Reorder / Delete (disabled unless empty). "Add topic" at the
  bottom. Each library section has "Add to group…" → picker of the selected cohort's
  groups (appends to that group, locked by the existing code rules). Create/edit
  section dialog gets a Topic select instead of "Default level", and an optional
  "Also add to group" select.
- Usage list under a library section shows "Cohort — Group name" instead of "Level N".

## 7. Risks, unclear points, conflicts

1. **Starting groups for new cohorts.** You said "new groups start LOCKED" and
   "new cohorts get their starting sections in groups named after the starting
   topics". Today a new cohort opens Level 1 by default (`DEFAULT_TIER_ACCESS`).
   Plan assumes: Core Workshop **open**, Applied Mastery / AI Builder **locked**
   (today's behaviour); the "start locked" rule applies to admin-added groups.
   Confirm.
2. **Group names vs topic names.** Converted groups keep today's exact headings
   ("Level 1 — Core Workshop", …) as required; topics use the short names
   ("Core Workshop"). New cohorts: should starting groups use the short topic names
   ("Core Workshop") or today's headings ("Level 1 — Core Workshop")? Plan assumes
   short names for new cohorts only.
3. **Seeded-module healing.** The startup seed attaches any seeded library module to
   every cohort at level 3. With groups, a cohort may have deleted/renamed its
   "AI Builder" group. Plan: attach to the group with `legacy_level = 3`, else skip
   with a log line. Existing tombstone behaviour unchanged. (In practice no new
   seeded modules are planned, so this path is dormant.)
4. **Built-in Level 4 sections.** `STARTING_SET_SECTIONS` excludes level-4 built-ins
   (library-only rule). They keep that rule; their starting topic is "AI Change
   Leadership". Unchanged.
5. **Rollback after cutover.** Old code can be redeployed safely only until an admin
   edits groups; after that `level`/`tier_access` are stale. Mitigation: the
   verification snapshot doubles as a record; a reverse script could sync groups
   back to levels if ever needed — not planned.
6. **Empty-group visibility.** Participants will not see an empty group (matches
   today). If you want empty groups shown as locked headings, say so — it changes
   the "nothing changes for anyone" check (all four converted groups would appear).
7. **Group deletion with hidden sections.** "Delete only when empty" counts
   hidden (`visible = false`) rows as well — they must be removed first.
8. **`/levels` naming collision.** The self-assessment route and `button-levels`
   test ids keep the word "levels"; harmless but worth knowing when searching.
9. **Scale of the Sections tab change.** SectionsTab.tsx is ~2,600 lines with 85
   level references; this is the largest and riskiest UI change. I'd verify it with
   a browser run before and after against the dev cohorts.
10. **Prod cohorts T4DAY5 / AI-LEADER carry made-editable copies and custom level
    names** (per memory). The verification script covers them because it compares
    names and section identity per cohort, not built-in ids.
11. **Duplicate cohort** copies groups and rows (remapped group ids) inside the
    existing repeatable-read transaction. Participants/notes still not copied.
12. **No schema changes outside Publish.** Dev DDL via psql per project memory;
    production schema only through Publish's diff; the conversion itself is data only.
