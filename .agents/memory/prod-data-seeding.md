---
name: Getting seed/content DATA into the production database
description: Why the workshop seed cannot fix a mis-seeded prod DB from the agent side, and the only supported path (Publish "overwrite data").
---

**Production DB rows are NOT copied by a normal Publish.** Publish diffs and applies
SCHEMA only (see database-migrations-on-publish reference). The agent's
`executeSql({environment:"production"})` is READ-ONLY (SELECT), and the agent must
not script/hook/DDL around that guard. Therefore the agent has NO tool that writes
rows to production.

The ONLY supported way to push dev DATA into prod is the **Publish UI "Overwrite
data with development data" option** — a user action, wholesale and destructive
(replaces ALL prod rows, incl. participants/notes, with dev's). The agent cannot
trigger it; guide the user to select it and warn that a plain publish won't copy rows.

**Why the seed can't surgically fix prod even conceptually:**
- `ensureSeededGenericSections()` attaches generic modules to every cohort code in
  `SEEDED_MODULE_COHORT_CODES` (currently `WORKSHOP` + `LIVE2026`) and throws if any
  is missing; `ensureSeedCohorts()` in seed.ts creates each of those codes first.
  A prod cohort with a code NOT in that list (e.g. `TEST123`) still gets nothing —
  the seed only ever attaches to its configured codes, so add the code to
  `SEEDED_MODULE_COHORT_CODES` (+ `COHORT_SETUP` for tier access) to target it.
- `cohort_sections.section_id` for generic sections is `generic_${numericRowId}`,
  and those numeric ids are assigned per-DB (upsert is by slug, not id). So dev ids
  (e.g. generic_12..27) will NOT match prod ids if prod already has other
  generic_sections rows — attachments are only self-consistent within one DB.
- Every Level 3 module is a generic (seeded) section; `RAW_SECTIONS`/`ALL_SECTIONS`
  in `sections.ts` contains NO tier-3 entries, so `addMissingSectionsForCohort`
  never creates Level 3 — only the seed does.

**How to apply:** when prod is missing seeded content, confirm whether prod's
current cohort/participants are disposable. If yes, the clean fix is Publish →
overwrite data (prod becomes an exact mirror of dev). If prod has real data to
preserve, there is no agent-side surgical path — the content must be recreated
through the deployed app's own admin UI against production.
