---
name: zod v4 partial() keeps defaults
description: Why update/PATCH schemas must be written without .default() instead of createSchema.partial()
---
Rule: for partial-update endpoints, define the update schema explicitly with no `.default()` values. Do not write `createSchema.partial()`.

**Why:** In zod v4, `.partial()` wraps fields in optional but `.default()` still fires on undefined, so `{ defaultLevel: 4 }` parsed as `{ defaultLevel: 4, contentBlocks: [], sectionType: "exercise", showNotesField: true }`. A relevel script wiped 23 production library sections' content this way (2026-09-17); restored from a JSON export via scripts/restore-generic-sections.mjs.

**How to apply:** when adding an update schema or a `.default()` to a create schema, grep for `.partial()` derived from it. When a script PUTs a partial body, dry-run and compare a full row before/after on dev first.
