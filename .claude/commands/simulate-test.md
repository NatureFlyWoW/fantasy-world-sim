---
allowed-tools: Read, Write, Edit, Bash(pnpm --filter @fws/core test *)
description: Write and run a simulation integration test
---
Create an integration test that:
1. Sets up a minimal world with a few entities
2. Runs the simulation for $ARGUMENTS ticks
3. Asserts that the event log contains expected event types
4. Verifies cause-effect chains are properly linked
5. Reports the most interesting events generated
Run the test and show results.
