---
allowed-tools: Read, Grep, Glob
argument-hint: <EntityTypeName>
description: Show all components, systems, and events related to an entity type
---
Find all code related to entity type $ARGUMENTS:
1. Component definitions that this entity type uses
2. Systems that read/write these components
3. Event types generated for this entity
4. Tests covering this entity
5. Any TODO or FIXME comments
