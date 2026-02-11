---
allowed-tools: Read, Grep, Glob
argument-hint: <EntityTypeName>
description: Show all components, systems, and events related to an entity type
---
Find all code related to entity type $ARGUMENTS:
1. Component definitions: `packages/core/src/ecs/component.ts` (search for ComponentType.$ARGUMENTS)
2. Systems that read/write: `packages/core/src/systems/` (grep for the ComponentType)
3. Event types: `packages/core/src/events/types.ts` (EventCategory associations)
4. Inspectors (terminal): `packages/renderer/src/panels/{type}-inspector.ts`
5. Inspectors (electron): `packages/electron/src/main/inspectors/{type}-inspector.ts`
6. Bridge setup: `packages/generator/src/integration/populate-world.ts`
7. Tests: `packages/core/src/systems/*.test.ts` (grep for entity type)
8. Any TODO or FIXME comments
