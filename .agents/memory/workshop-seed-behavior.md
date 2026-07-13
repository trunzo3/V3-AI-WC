---
name: Workshop generic-sections seed behavior
description: The seed is upsert-by-slug and never deletes — removing a module needs manual DB detach, repeated per environment
---

`artifacts/api-server` seeds generic sections from `src/lib/seeded-generic-sections.ts` via `pnpm run seed`.

- **Seed is upsert-by-slug and NEVER deletes.** Removing a module from the seed array does not remove it from any DB — existing `generic_sections` rows keep their ids and stay attached to cohorts.
- To fully remove a module (e.g. deleting "showcase" = `generic_23`), manually detach in every environment: `DELETE FROM notes / unlocked_sections / cohort_sections / section_files WHERE section_id='generic_N'`, then `DELETE FROM generic_sections WHERE id=N`.
- **This must be repeated on production** after deploy — reseeding prod will not drop the removed module.
- Because ids are stable on upsert, removing an earlier module does NOT renumber existing rows; only the removed id is orphaned.

**Why:** deleting a module from the seed silently left a live orphaned section attached to the cohort until manually detached.
**How to apply:** whenever a module is removed from the seed, run the manual detach SQL in dev AND flag the same cleanup for production.
