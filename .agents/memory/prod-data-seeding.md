---
name: Getting seed/content DATA into the production database
description: How prod self-heals seeded content via startup seeding, plus the wholesale Publish "overwrite data" path and why the agent can't write prod directly.
---

**Prod now self-heals seeded content on every boot.** `src/index.ts` awaits
`runSeed()` (exported from `seed.ts`) inside a try/catch BEFORE `app.listen`, so each
deploy/restart reconciles cohorts + all seeded generic sections (incl. every Level 3
module) additively. `runSeed()` is idempotent (insert-if-missing / onConflictDoNothing
/ additive tier_access merge) and never deletes admin/participant data; a seed failure
is logged but does not stop the server. CLI seeding lives in `seed-cli.ts`
(`pnpm run seed`), which is the only place that calls `pool.end()`. `ensureSeedCohorts`
uses bare `onConflictDoNothing()` + re-select so concurrent autoscale cold-starts don't
throw on the `cohorts_cohort_code_unique` (lower(cohort_code)) index.
**Why:** the deploy runs `node dist/index.mjs` (never the seed script) and a plain
Publish copies code+schema, not rows — so before startup seeding, prod never received
the 13 Level 3 module rows and new prod cohorts got 0 Level 3.

**Production DB rows are still NOT copied by a normal Publish** (schema only; see
database-migrations-on-publish reference). The agent's
`executeSql({environment:"production"})` is READ-ONLY (SELECT). The startup seed is the
agent-shipped path to get *seeded content* into prod. To mirror ALL dev data (or reset
extra cohorts/participants), the user uses the **Publish UI "Overwrite data with
development data" option** — wholesale and destructive (replaces ALL prod rows incl.
participants/notes). The agent cannot trigger it.

**Why the seed can't surgically fix prod even conceptually:**
- `ensureSeededGenericSections()` attaches every seeded generic module to EVERY
  cohort in the DB (selects all cohorts), so any cohort code gets the full Level 3
  set on the next seed run. `BASE_COHORT_CODES` (`WORKSHOP` + `LIVE2026`) is only
  the set of baseline cohorts `ensureSeedCohorts()` guarantees to exist, NOT the
  attach targets. Future cohorts created via `POST /admin/cohorts` also get the set
  immediately via `attachSeededGenericSectionsToCohort(cohortId)` (skips silently
  if seeded content rows don't exist yet — a full seed then reconciles).
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
