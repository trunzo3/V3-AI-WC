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

Client-side state (needed beyond the auth cookie):
- The client session lives in `localStorage["workshop-session"]` (see
  `src/lib/auth.ts` `getSession`), a JSON `Session {email, participantId,
  cohortId, cohortCode, name}`. A fetch to `/api/auth/login` sets the server
  cookie but NOT this key, so `/workshop` redirects to `/` until you set it.
- There is no `/section/:id` route. Sections render inside `/workshop` via the
  active-section selector — set
  `localStorage["workshop-active-section-<participantId>"] = "generic_N"` then
  navigate to `/workshop` to open a specific section.
- Field/notes testids are `notes-<sectionId>-<fieldKey>` (plain notes field uses
  fieldKey `notes`); the recap block testid is `generic-recap-block`.
- Labels/titles use CSS `text-transform: uppercase`, so `innerText` returns
  UPPERCASE — assert case-insensitively.
