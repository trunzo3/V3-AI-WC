---
name: Orval Params name collision in lib/api-zod
description: Why codegen can fail with TS2308 "already exported a member named <OperationId>Params" and how to resolve it.
---
Rule: an OpenAPI operation with BOTH path params and query params makes orval emit `<OperationId>Params` twice — a zod schema (generated/api) and a TS type (generated/types). lib/api-zod/src/index.ts re-exports both barrels with `export *`, so `pnpm --filter @workspace/api-spec run codegen` fails at typecheck:libs.

**Why:** hit when adding the cohort responses admin endpoint (path cohortId + query filters). Renaming the operationId does NOT help; the fix is an explicit `export { <OperationId>Params } from "./generated/api";` line in lib/api-zod/src/index.ts.

**How to apply:** any new endpoint mixing path + query params needs that one-line explicit re-export added alongside the existing one.
