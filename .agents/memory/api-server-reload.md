---
name: API server does not reliably hot-reload
description: Restart the API Server workflow after server-side code changes before testing them
---

Rule: after editing api-server code (routes, zod schemas, workbook rendering),
restart the `artifacts/api-server: API Server` workflow before curl/UI testing.

**Why:** the dev process does not reliably pick up changes. Observed twice in
one session: (1) a newly added zod object property was silently stripped from
saved payloads because the old schema was still running; (2) a rendering
change produced stale output. Both looked like code bugs but were stale
server processes.

**How to apply:** any time a server-side test gives a result that contradicts
the code you just wrote, restart the workflow first before debugging. Cheap
insurance: restart immediately after server edits, then test.
