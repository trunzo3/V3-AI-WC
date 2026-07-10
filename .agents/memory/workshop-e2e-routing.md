---
name: Workshop e2e/browser-test routing
description: Correct URLs and ports for browser-testing the workshop app; wrong assumptions cause silent 404s
---

Rule: browser tests (puppeteer) against the workshop app must go through the
shared proxy at `http://localhost:80`, never the Vite dev port (8081) directly.

**Why:** root-relative `/api/*` calls are only routed to the api-server by the
shared proxy; hitting the Vite port directly makes every API call fail
silently. Also, the workshop artifact is mounted at root — `/workshop` is a
wouter *route* inside the app, not a base path. Admin login is at
`/admin/login` (NOT `/workshop/admin/login`, which renders the app's 404 page).

**How to apply:**
- Participant flow: `goto http://localhost:80/workshop`; log in via in-page
  `fetch("/api/auth/login", {name, email})` (name is required, not just email).
- Admin flow: `goto http://localhost:80/admin/login`; fill
  `input-admin-email` AND `input-admin-password` testids.
- Direct API testing with curl: `http://localhost:8080/api/...`.
- Use `puppeteer-core` (installed in api-server) with
  `executablePath: $(which chromium)` and `--no-sandbox`.
