---
name: Package firewall blocks
description: npm packages/versions blocked by the Replit package firewall and the working alternatives
---
Rule: if `pnpm install` fails with `ERR_PNPM_FETCH_403` from `package-firewall.replit.local`, the specific version is security-blocked — do not retry the same version; pin a nearby unblocked version instead.

**Why:** On 2026-07-09, `sanitize-html@2.17.3` returned 403 and broke the whole workspace install. Pinning `sanitize-html@2.17.0` in `artifacts/api-server` installed cleanly.

**How to apply:** On a 403, try adjacent patch/minor versions of the blocked package before anything else. Keep the pin unless the newer version becomes unblocked.
