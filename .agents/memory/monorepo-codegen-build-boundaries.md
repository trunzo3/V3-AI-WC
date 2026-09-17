---
name: Restart workshop Vite after orval codegen
description: The workshop dev server serves broken modules mid-HMR after API codegen regenerates api-client-react; restart it before UI testing.
---

# Restart the workshop (Vite) after regenerating api-client-react

Running `pnpm --filter @workspace/api-spec run codegen` (orval) rewrites files under `lib/api-client-react/src/generated/`. The running `artifacts/workshop` Vite dev server gets caught mid-HMR and serves a stale/broken module graph — symptom: `does not provide an export named '...'` runtime errors and blank/partial pages during testing.

**How to apply:** after any codegen run, `restart_workflow("artifacts/workshop: web")` before doing puppeteer/UI verification. Otherwise tests fail against a half-reloaded app, not a real bug.

**Related:** editing `lib/db` types also requires rebuilding its composite declarations before `api-server` typechecks — see `db-schema-change-workflow.md`.
