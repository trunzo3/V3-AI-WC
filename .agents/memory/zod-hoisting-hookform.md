---
name: zod v3/v4 hoisting break with @hookform/resolvers
description: Why typecheck can break in login forms after installing tooling that depends on zod v4
---

Rule: if a dev tool (e.g. orval) pulls zod v4 into the store, pnpm's fallback
hoisted `node_modules/.pnpm/node_modules/zod` can become v4, and
`@hookform/resolvers` (which declares no zod peer dep) resolves its `zod`
type imports against v4 while app code uses the catalog's zod v3 —
producing `ZodType<any, any, $ZodTypeInternals>` mismatch errors in files
like `login.tsx` that were never touched.

**Why:** resolvers has no zod peerDependency, so module resolution falls
through to whatever zod got hoisted last.

**How to apply:** fixed via `packageExtensions` in `pnpm-workspace.yaml`
adding `zod: '*'` as a peer of `@hookform/resolvers`, then `pnpm install`.
Keep that block when editing workspace config.
