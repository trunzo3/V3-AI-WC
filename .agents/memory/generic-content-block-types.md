---
name: Generic content block types — three sources of truth
description: Adding/changing a workshop generic content block type requires editing three hand-maintained definitions in lockstep, or typecheck/validation/render silently break.
---

A workshop "generic section" content block type is defined in THREE independent,
hand-written places that must stay in sync. Orval codegen does NOT unify them —
it only regenerates the API client/zod types from the OpenAPI enum.

1. `lib/db/src/schema/generic-sections.ts` — the `GenericContentBlock` union is
   the `$type<...>` of the `content_blocks` jsonb column. If a new variant is
   missing here, api-server db insert/update typechecks fail.
2. `artifacts/api-server/src/routes/admin.ts` — `contentBlockSchema` is a
   hand-written zod `discriminatedUnion("type", [...])` used to validate blocks
   on section save. A block whose `type` isn't a variant here is REJECTED on
   save (discriminatedUnion errors on unknown discriminant); unknown extra
   fields on a known variant are silently stripped.
3. `lib/api-spec/openapi.yaml` — `GenericContentBlock.type` enum + the flat list
   of properties. This is the ONLY codegen source; after editing it run
   `pnpm --filter @workspace/api-spec codegen`. Orval emits ONE flat interface
   (all props optional), which is why the renderer/editor can read `block.width`,
   `block.fileId`, etc. freely without narrowing.

**Why:** the DB type and server zod are hand-written and predate/parallel the
OpenAPI contract; they are not generated from each other. Missing any one causes
a different, layer-specific failure (compile error / save rejection / missing
field at runtime).

**How to apply:** when adding or changing a block type, edit all three, run
codegen, then restart BOTH the api-server workflow (new zod fields are silently
stripped until restart) and the workshop Vite workflow (codegen mid-run breaks
HMR — see workshop-e2e-routing / earlier notes). Renderer switch lives in
`SectionRenderer.tsx`; admin editor UI + `BLOCK_DEFAULTS` in `SectionsTab.tsx`;
workbook PDF (`workbook.ts`) returns "" by default for any block without a
`content` field, so newer visual blocks need no PDF change.

Section files: bytes are stored base64 directly in `section_files.storage_path`
(NOT object storage) and served via the participant-gated
`GET /api/files/:id/download` with `Content-Type` from `mime_type`. An `<img src>`
to that route works (cookie flows through the proxy; browsers ignore the
`Content-Disposition: attachment` header for images), so image blocks reuse the
exact download-block serving path.
