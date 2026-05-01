# Workspace

## Overview

pnpm workspace monorepo for the **IQmeetEQ Workshop Companion App** (v2.1 backend).

The app uses a **cohort system**: each workshop runs as its own virtual app
instance. Participants join a cohort via a short cohort code and unlock
sections individually as the facilitator shares per-section codes.

Currently this repo contains only the backend (Express API + PostgreSQL). A
front-end will be added later and will consume the generated API client.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Sessions**: `cookie-session` (signed cookie `iqmeq_session`)
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Layout

```
artifacts/
  api-server/          Express 5 API server (the v2.1 backend)
  workshop/            React + Vite participant + admin frontend
  mockup-sandbox/      Vite component preview (used for canvas mockups)
lib/
  api-spec/            OpenAPI 3.1 source-of-truth (openapi.yaml + orval config)
  api-client-react/    Generated React Query hooks (do not edit directly)
  api-zod/             Generated Zod schemas (do not edit directly)
  db/                  Drizzle schema, migrations, db client (composite lib)
```

## Frontend (`artifacts/workshop`)

Two surface areas:

- **Participant app** (`/`): login → cohort code entry → workshop sections.
  - Email-first returning flow: typing a known email auto-fills name and hides
    the workshop-code field, with a "Switch workshop" button to reveal it.
  - Driven by `POST /api/auth/check-email` (unauthenticated, returns
    `{ exists, name }`).
  - The gear icon (bottom-left) is a wouter `<Link to="/admin/login">`, no
    inline admin form on `/`.
- **Admin panel** (`/admin/login`, `/admin`): two-tier layout.
  - **Global tabs**: Cohorts, Tool Safari, Verification test links, Feedback,
    Settings.
  - **Per-cohort tabs**: Sections, Content variants, Participants.
  - Tab headers are grouped under visible **GLOBAL** / **COHORT** labels.
  - The header has a cohort switcher (selection persisted in
    `localStorage["workshop-admin-cohort-id"]`) plus stats cards scoped to the
    selected cohort.
  - Generic-section body and cohort facilitator messages use a Tiptap WYSIWYG
    (`components/admin/RichTextEditor.tsx`). Bodies are stored as HTML;
    `SectionRenderer` falls back to `whitespace-pre-wrap` for legacy plaintext.

Admin UI consumes the generated client from `@workspace/api-client-react`. Only
the bulk endpoints `PUT /admin/cohorts/:id/sections` and
`PUT /admin/cohorts/:id/safari-tabs` accept **raw arrays** (no wrapper
object). All others use the documented OpenAPI shapes.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and
  Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run seed` — idempotent seed
  (default cohort, LLM tools, safari library, feedback categories, settings)
- Run via the configured workflow `artifacts/api-server: API Server`
  (do **not** run `pnpm dev` at the workspace root)

## Environment

Required env vars (managed via Replit Secrets):

- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — secret for signing the `iqmeq_session` cookie
- `ADMIN_PASSWORD` — shared admin password (used by `POST /api/admin/login`)

## Backend architecture

### Cohort model

- A **cohort** owns its participants, section visibility/codes, content
  variants, safari tab assignments, and facilitator message.
- The default cohort is seeded with code `WORKSHOP`. Lookups are
  case-insensitive (`lower(cohort_code) = lower(input)`).
- Creating a new cohort auto-seeds `cohort_sections` from
  `artifacts/api-server/src/lib/sections.ts` (`ALL_SECTIONS` +
  `SECTION_CODE_CONFIG`).

### Sections

Sections come from two sources:

1. **Hardcoded sections** — defined in `artifacts/api-server/src/lib/sections.ts`
   (`ALL_SECTIONS`). Add a new entry here to ship a new section to all cohorts.
   Default per-cohort unlock codes live in
   `artifacts/api-server/src/section-codes-config.ts` as
   `SECTION_CODE_CONFIG: SectionCodeEntry[]`, where one code can map to many
   section ids (entering the code unlocks all listed sections at once).
2. **Generic sections** — created by admins, stored in `generic_sections`,
   referenced by id `generic_<id>` from `cohort_sections`.

Running the seed (`pnpm --filter @workspace/api-server run seed`) resets
**every** cohort's `cohort_sections` to match `ALL_SECTIONS` exactly, so edits
to the canonical list propagate to all existing cohorts.

A participant sees a section when ANY of these are true:
- The cohort's tier (level) is unlocked by default in `cohorts.tier_access`, or
- The section has `code_active = false` (admin marked it as not requiring a
  code), or
- The participant has unlocked it via a code (`unlocked_sections` row).

`POST /api/sections/unlock` looks up the code across all cohort sections (case
insensitive) and unlocks every matching section in one call.

### Sessions / auth

- **Participants**: `iqmeq_session` cookie carries `participantId` and
  `cohortId`. `requireParticipant` middleware enforces this.
- **Admins**: same cookie carries `isAdmin: true`. `requireAdmin` middleware
  enforces this. Admin login validates the request password against
  `ADMIN_PASSWORD`.
- All authenticated GET responses set `Cache-Control: no-store`.

### API surface (high level)

Participant endpoints (require session unless noted):

- `POST /api/auth/check-email` — unauthenticated; returns
  `{ exists, name }` for the email-first returning flow.
- `POST /api/auth/login` — `cohortCode` is **optional**. With a code, resolves
  by `(email, cohortId)`. Without a code, resolves by email alone (most recent
  cohort by `lastLoginAt DESC`); returns 404 if the email is unknown.
- `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/files/by-section/:sectionId` — list files for a section. Returns
  `{ files: [{ id, safariLibraryId, filename, mimeType, sizeBytes }] }`.
- `GET /api/files/:id/download` — streams the file with the stored mime type
  and a `Content-Disposition: attachment` header.
- `GET /api/sections`, `POST /api/sections/unlock`
- `GET|PUT /api/notes/:sectionId`
- `GET|PUT /api/workflow-map`
- `GET|PUT /api/feedback`, `GET /api/feedback/categories`
- `GET /api/content-variants/:sectionId`
- `GET /api/llm-tools`, `GET /api/safari-tabs`, `GET /api/app-settings`

Admin endpoints (require admin session, prefix `/api/admin`):

- `POST /admin/login`, `POST /admin/logout`
- `GET|POST|PUT|DELETE /admin/cohorts[/:id]`
- `GET|PUT /admin/cohorts/:cohortId/sections` (bulk upsert)
- `GET|POST|PUT|DELETE /admin/cohorts/:cohortId/content-variants[/:id]`
- `GET|POST|PUT|DELETE /admin/generic-sections[/:id]`
- `GET|POST|PUT|DELETE /admin/safari-library[/:id]`
- `GET|PUT /admin/cohorts/:cohortId/safari-tabs` (bulk upsert)
- `GET|POST|PUT|DELETE /admin/llm-tools[/:id]`
- `GET|POST|PUT|DELETE /admin/feedback-categories[/:id]`
- `GET|PUT /admin/settings`
- `GET /admin/cohorts/:cohortId/participants`
- `GET /admin/feedback`
- `GET /admin/files/by-section/:sectionId?safariLibraryId=N` — list files
- `POST /admin/files` — body `{ sectionId, safariLibraryId?, filename, mimeType, dataBase64 }`. Max 20 MB raw bytes. Files are stored as base64 in the existing `section_files.storage_path` column (no object storage required).
- `DELETE /admin/files/:id`

The OpenAPI spec at `lib/api-spec/openapi.yaml` documents all participant
endpoints in full and is used to generate React Query hooks + Zod schemas for
the future frontend. Admin endpoints are not currently included in the
generated client (they're typically called from custom admin UIs).

## Conventions

- **Never use `console.log`** in server code. Use `req.log` in route handlers
  and the singleton `logger` for non-request code.
- All routes use Zod (`zod/v4`) `.safeParse()` for input validation; failures
  return `400` with `{ error: string }`.
- Drizzle schemas live in `lib/db/src/schema/`; re-exported via
  `lib/db/src/schema/index.ts`. After schema changes:
  1. `pnpm --filter @workspace/db run push` to migrate dev DB
  2. `pnpm run typecheck:libs` to rebuild the composite lib
- See the `pnpm-workspace` skill for workspace structure, TypeScript project
  references, and package management rules.
