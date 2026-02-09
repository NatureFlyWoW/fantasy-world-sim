---
allowed-tools: Read, Write, Edit, Bash(pnpm *)
argument-hint: <SystemName>
description: Add a new ECS simulation system to @fws/core
---
Create a new simulation system named $ARGUMENTS in packages/core/src/systems/.
Follow these steps:
1. Create the system file implementing the System interface
2. Define which components it reads/writes
3. Define its tick frequency (daily/weekly/monthly/seasonal/annual/decadal)
4. Define its position in the 13-step tick execution order
5. Register it in the system registry
6. Write Vitest tests alongside source (packages/core/src/systems/*.test.ts)
7. Update CLAUDE.md with the new system's details
