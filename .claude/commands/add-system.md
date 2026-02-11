---
allowed-tools: Read, Write, Edit, Bash(pnpm *)
argument-hint: <SystemName>
description: Add a new ECS simulation system to @fws/core
---
Create a new simulation system named $ARGUMENTS in packages/core/src/systems/.

Reference implementations:
- Simple system: `packages/core/src/systems/ecology.ts` + `ecology-types.ts`
- Complex system: `packages/core/src/systems/character-ai.ts`
- System interface: `packages/core/src/engine/system.ts` (System, BaseSystem, ExecutionOrder)
- Barrel export: `packages/core/src/systems/index.ts`

Steps:
1. Create `packages/core/src/systems/$ARGUMENTS.ts` implementing System interface
2. Create `packages/core/src/systems/$ARGUMENTS-types.ts` for types
3. Add ComponentType entries in `packages/core/src/ecs/component.ts` if new components needed
4. Define tick frequency (daily/weekly/monthly/seasonal/annual/decadal)
5. Define position in ExecutionOrder (`packages/core/src/engine/system.ts`)
6. Export from `packages/core/src/systems/index.ts`
7. Write tests in `packages/core/src/systems/$ARGUMENTS.test.ts`
8. Register in CLI: `packages/cli/src/index.ts`
9. Register in Electron: `packages/electron/src/main/simulation-runner.ts`
10. Bridge init if needed: `packages/generator/src/integration/populate-world.ts`
11. Update `docs/CODEBASE_MAP.md` — add new files under `systems/` section
12. Run: `pnpm --filter @fws/core run test` then `pnpm run typecheck`
