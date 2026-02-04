---
allowed-tools: Read, Grep, Glob, Bash(pnpm run typecheck)
argument-hint: [file-or-directory]
description: Review TypeScript code against Æternum conventions
---
Review $ARGUMENTS for:
1. Strict type safety — no `any`, branded IDs used correctly
2. Systems communicate only through events and components (no direct references)
3. Proper error handling
4. Immutable event records
5. Test coverage for new functionality
6. Performance — no allocations in hot loops, lazy evaluation where appropriate
7. ECS pattern followed — data in components, logic in systems
Run typecheck after review.
