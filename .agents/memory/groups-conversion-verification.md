---
name: Groups conversion & verification workflow
description: How the levels→groups conversion is proven safe on dev and production, and the traps hit while doing it.
---
Rule: any change to how participants' section lists are derived must be verified with
`scripts/groups-verify.mjs` — snapshot BEFORE on the same environment, run the change,
`compare --before <snapshot>` must PASS. Production: take the snapshot (read-only SQL from
`queries`, saved with `--rows`) immediately before Publish, after confirming with the user
that no workshop is in session; compare right after Publish.

**Why:** the user's hard requirement is "existing cohorts must not change for anyone";
headings, order, codes and unlocked state are all derivable only by rendering the full
access rules, so a diff of the rendered view is the only trustworthy check.

**How to apply:**
- Browser tests create participants/cohorts; delete them (participants first, via the
  admin API) before `compare`, otherwise compare flags the new participant as a diff.
- Legacy columns (`level`, `tier_access`, `settings.levelNames`) are frozen but still
  written (`level = group.legacyLevel ?? 1`, tier_access all-false for new cohorts);
  never read them for display or access on converted cohorts.
- Conversion is data-only inside `runSeed`; production schema arrives via Publish diff,
  so prod conversion happens on the first boot after Publish.
- Admin UI: the participant sidebar is at `/workshop`; the admin-created test cohort is
  auto-selected after creation, so the "Use" button is absent for it.
