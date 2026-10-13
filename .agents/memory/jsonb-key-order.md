---
name: jsonb key order
description: Pitfalls from Postgres jsonb reordering object keys (content blocks, form identifiers).
---
Postgres `jsonb` stores object keys sorted by length then alphabetically, so what the API returns never has the client's key order.

**Why:** two incidents on 2026-10-13 — the Responses identifier line rendered values out of field order (fixed by using a plain `json` column for `form_responses.identifiers`), and an admin-API content script compared blocks with `JSON.stringify` and concluded its PUT "did not persist", then re-applied inserts on re-run (fixed with a key-sorted canonical comparison).

**How to apply:** when checking whether content blocks (`generic_sections.content_blocks`, jsonb) already match a desired shape, compare with a canonicalizing deep-equal; when order of an object's keys matters to the UI, store an array or a `json` (not `jsonb`) column.
