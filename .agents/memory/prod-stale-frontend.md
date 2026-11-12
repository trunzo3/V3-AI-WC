---
name: Stale frontend bundle after publish
description: Why a freshly published UI change can look "not working" in production right after deploy.
---
Production serves `index.html` with `cache-control: private` + `last-modified` and no max-age, so browsers heuristically cache it; a participant tab opened before a publish keeps running the OLD JS bundle (which still polls the NEW API) for a while, even across a normal reload.

**Why:** the one-submission-only lock "didn't work" in prod at first — deployment logs showed the new server returning 409 while the client showed the old UI; the deployed bundle already contained the new code.

**How to apply:** when a user reports a UI change missing in prod right after publish while the API behaves new, ask for a hard refresh / check the served asset hash before debugging code. Also make UI handle new server responses defensively (e.g. 409 → locked view).
