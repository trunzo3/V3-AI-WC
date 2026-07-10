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
  - Email-first returning flow: a debounced onChange check (400ms) calls
    `POST /api/auth/check-email` while the user types. If the email exists,
    the workshop-code field hides, the name pre-fills, and the button text
    changes to "Continue". On blur the check fires immediately (cancels
    debounce). On successful login the stale `/auth/me` query cache is
    removed before SPA navigation to prevent redirect loops.
  - Driven by `POST /api/auth/check-email` (unauthenticated, returns
    `{ exists, name }`).
  - The gear icon (bottom-left) is a wouter `<Link to="/admin/login">`, no
    inline admin form on `/`.
- **Admin panel** (`/admin/login`, `/admin`): two-tier layout.
  - **Global tabs**: Cohorts, Tool Safari, Links to LLMs, Feedback, Settings.
  - LLM tools have per-tool `showInSidebar` and `showInVerification` flags
    (default `true`). The participant Sidebar and the Day1 verification-test
    section both filter by their respective flag.
  - **Per-cohort tabs**: Sections, Content variants, Participants.
  - Tab headers are grouped under visible **GLOBAL** / **COHORT** labels.
  - The header has a cohort switcher (selection persisted in
    `localStorage["workshop-admin-cohort-id"]`) plus stats cards scoped to the
    selected cohort.
  - Generic-section bodies use a block editor (text/prompt blocks, reorderable);
    cohort facilitator + home-screen messages use a Tiptap WYSIWYG
    (`components/admin/RichTextEditor.tsx`, with bold/italic/underline).
  - The "Generic section library" card on the Sections tab exposes per-row
    **View** (read-only preview dialog) and **Add to level…** (Select L1-L4 →
    appends a new cohort_section row) actions; rows already present in the
    cohort show an "Already added" badge instead of the Select. There is no
    inline edit pencil on the library list (edit happens in the dedicated
    create/edit dialog).
  - Cohorts have a `home_message` HTML field rendered above the action cards
    on the participant home page (`data-testid="home-message"`).
  - The participant home header shows the cohort name (from `/api/auth/me`)
    in place of the legacy "VESTIBULE" / "Cohort: CODE" label.
  - Tool Safari upload uses a styled "Upload PDF Guide" button that triggers
    a hidden native file input.
  - Every section row on the Sections tab has a paperclip button that opens
    `components/admin/SectionFilesDialog.tsx` (generalized from
    SafariFilesDialog; keyed by `sectionId` only) to upload/list/delete files
    for that section. The generic-section block editor's "Download button"
    block picks from files attached to `generic_<id>` and defaults the button
    label to the chosen filename.

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
  variants, safari tab assignments, facilitator message, and a
  `workbook_enabled` boolean (default `true`) that controls whether the
  "Download Workbook" controls (sidebar button + home-screen text link)
  appear for participants.
- The default cohort is seeded with code `WORKSHOP`. Lookups are
  case-insensitive (`lower(cohort_code) = lower(input)`).
- Creating a new cohort auto-seeds `cohort_sections` from
  `artifacts/api-server/src/lib/sections.ts` (`ALL_SECTIONS` +
  `SECTION_CODE_CONFIG`).

### Workbook PDF export

- `GET /api/workbook/download` (`artifacts/api-server/src/routes/workbook.ts`)
  renders a branded multi-page PDF of the participant's unlocked sections
  with their notes, generic content blocks, hardcoded reference content,
  and workflow map. **All unlocked, non-skipped sections are included** —
  empty sections render with a "No notes recorded" muted-italic state in
  the gold "Your Notes" block. Per-section template order: badge → title →
  goal box → reference content (or closing quote block for `closing`) →
  generic blocks → structured fields (RICECO/RYG/6Ways) → workflow map →
  gold "Your Notes" block. Pages: cover, table of contents, section pages
  grouped by level, and a footer with page numbers and the participant's
  name.
- Hardcoded reference content per section lives in `SECTION_REFERENCE_CONTENT`
  (verification-test, tool-safari, riceco-framework, draft-with-riceco,
  llm-peer-review, distill, prepare, synthesize, power-follow-ups,
  what-ai-is, persistent-context, red-yellow-green, capstone,
  overnight-assignment, overnight-harvest, workflow-configurator,
  status-quo-bias, county-change-framework, county-change-message). The
  `closing` section pulls quote/subtext from `content_variants` rows
  (sectionId='closing', blockKey IN ('closing_quote','closing_subtext'))
  with `FALLBACK_CLOSING_QUOTE` / `FALLBACK_CLOSING_SUBTEXT` constants
  used when the cohort has no overrides.
- Brand: navy `#1A2744`, gold `#C8963E`, cream `#FDFBF7`; DM Serif Display
  for headings + DM Sans for body, loaded from Google Fonts.
- Renderer: `puppeteer-core` driving the system Chromium. The executable
  path is resolved once via `PUPPETEER_EXECUTABLE_PATH` or `which chromium`
  and cached. `puppeteer-core` is externalized in `build.mjs`.
- Returns `403` when the cohort has `workbook_enabled = false`. Filename
  is `iqmeeteq-workbook-<name-slug>-YYYY-MM-DD.pdf`.
- Triggered from the sidebar "Download Workbook" button
  (`artifacts/workshop/src/components/workshop/Sidebar.tsx`) and the muted
  "Download your workbook" link on the home screen
  (`artifacts/workshop/src/pages/home.tsx`); both gated on
  `cohort.workbookEnabled`.

### Sections

Sections come from two sources:

1. **Hardcoded sections** — defined in `artifacts/api-server/src/lib/sections.ts`
   (`ALL_SECTIONS`). Add a new entry here to ship a new section to all cohorts.
   Default per-cohort unlock codes live in
   `artifacts/api-server/src/section-codes-config.ts` as
   `SECTION_CODE_CONFIG: SectionCodeEntry[]`, where one code can map to many
   section ids (entering the code unlocks all listed sections at once).
2. **Generic sections** — created by admins, stored in `generic_sections`,
   referenced by id `generic_<id>` from `cohort_sections`. Bodies are stored
   as a `content_blocks` jsonb array; block `type` is one of
   `text | prompt | callout | cards | steps | link | field | form | download`
   (union in `lib/db/src/schema/generic-sections.ts`, zod validation in
   `admin.ts`). Text blocks render as HTML (Tiptap WYSIWYG); prompt blocks
   render as a navy box with a gold "Prompt N" pill and a CopyButton.
   `download` blocks reference a file attached to the same section
   (`{type:"download", fileId, label?}`) and render one download button.
   The legacy `content` and `prompt_block` columns have been dropped.

Running the seed (`pnpm --filter @workspace/api-server run seed`) performs an
**additive-only** sync: it inserts any sections from `ALL_SECTIONS` that are
missing from each cohort's `cohort_sections`, but never deletes, reorders, or
modifies existing rows. This preserves admin-configured display names, codes,
ordering, and visibility. If a cohort has zero sections (empty), the seed falls
back to `seedCohortSections` which inserts the full canonical set with default
sort orders. The destructive `resetCohortSectionsToDefaults` function still
exists for the admin "reset sections" action but is no longer called by the
seed script.

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
  Gated by the shared section-unlock rule
  (`artifacts/api-server/src/lib/section-access.ts`): the section must be
  assigned to the participant's cohort, visible, and unlocked for them.
  Missing and forbidden both return the same 404 (no existence leak).
- `GET /api/files/:id/download` — streams the file with the stored mime type
  and a `Content-Disposition: attachment` header. Gated by the same unlock
  rule via the file's `sectionId`.
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

## Security

- All admin-authored rich-text inputs (cohort `homeMessage`,
  `facilitatorMessage`, generic-section text-block `content`) pass through
  `artifacts/api-server/src/lib/sanitize.ts` (`sanitizeRichHtml`) on write.
  Allowlist matches what Tiptap (StarterKit + Link + Underline) emits:
  `<p>`, `<br>`, `<strong>`, `<em>`, `<u>`, `<s>`, `<code>`, `<pre>`,
  `<blockquote>`, `<h1>`–`<h4>`, `<ul>`, `<ol>`, `<li>`, `<a>`. `<a>` is
  forced to `target="_blank" rel="noopener noreferrer"` and only `http`,
  `https`, `mailto` schemes are allowed. Prompt-block content is left raw
  (rendered inside a `<pre>` mono block, not as HTML).
