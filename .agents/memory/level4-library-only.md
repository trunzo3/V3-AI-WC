---
name: Level 4 library-only rule
description: Cohort section rules decided 2026-10-14 — no automatic additions to existing cohorts; Level 4 holds library sections only.
---
The startup seed must never add built-in sections to an existing cohort; only a cohort being created gets the starting set, and that starting set excludes every Level 4 built-in.

**Why:** the admin list in Level 4 must match exactly what participants see, and the old additive sync kept re-inserting Level 4 built-ins (hidden rows) after admins removed them.

**How to apply:** don't reintroduce an "add missing sections" step to runSeed; new built-ins at Level 4 are catalog/library only. One-time cleanup lives in scripts/level4-cleanup.mjs (RICECO make-editable keeps the row in place; make-editable updates the cohort_sections row's sectionId in place, so position/code/visibility survive). Production dry run must be re-run after Part 1 is live or the old build's seed would add rows back.
