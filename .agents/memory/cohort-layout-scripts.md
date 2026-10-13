---
name: Cohort layout scripts
description: Lessons from scripting cohort section layouts through the admin API (dev vs prod divergence).
---
Resolve every layout row from the target cohort's own section rows at the intended level; do not hardcode a built-in section id just because dev has it there.

**Why:** on production, "What AI Is / Is Not" at Level 4 was a made-editable library copy while the built-in `what-ai-is` sat in Level 1. A script that hardcoded the built-in pulled the Level 1 row into Level 4 too, producing a duplicate sectionId in the PUT (caught only because the user noticed the row count). Dev had the built-in at Level 4, so testing passed.

**How to apply:** match by title within Level-N rows only (titles repeat across levels, e.g. "Closing"), assert exactly one match, assert no duplicate sectionIds and that final row count = existing + newly created, and always compare dev vs prod dry-run row counts before applying.
