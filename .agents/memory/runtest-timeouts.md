---
name: runTest sandbox timeouts
description: Browser e2e runTest calls can exceed the 600s code_execution notebook cap
---
The Playwright testing subagent (`runTest`) repeatedly hit the code_execution notebook's 600s hard timeout in this project (3 consecutive attempts, even with a compact plan), with the notebook also resetting between calls.

**Why:** the notebook script cap is 10 minutes and runTest has no async mode here; long admin flows through the shared proxy don't finish in time.

**How to apply:** keep test plans very short (a handful of steps), and have a fallback ready — verify backend lifecycles via curl/psql and rely on typecheck + architect review when browser tests can't complete.
