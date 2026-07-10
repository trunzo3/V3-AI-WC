---
name: DB schema change workflow
description: Steps needed after editing lib/db schema so types and the database actually update
---

Rule: after editing a table in `lib/db/src/schema/`, do BOTH before typechecking
consumers: (1) rebuild the composite package with `pnpm exec tsc -b lib/db`,
(2) apply the DDL to Postgres.

**Why:** api-server resolves @workspace/db types through TypeScript project
references — without `tsc -b lib/db`, `tsc --noEmit` in api-server sees the
stale compiled types and reports "property does not exist" on brand-new
columns. Separately, `drizzle-kit push` can stop on an interactive prompt
(e.g. adding a unique constraint to a non-empty table asks about truncation)
and the non-TTY run just exits — the change silently never applies.

**How to apply:** for safe additive changes, run the ALTER TABLE via psql
directly, then run `pnpm --filter @workspace/db run push` and confirm it
reports no remaining diff. Never use push-force blindly (it auto-accepts
data-loss statements).
