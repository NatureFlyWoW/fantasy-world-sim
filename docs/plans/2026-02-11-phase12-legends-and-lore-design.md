# Phase 12: Legends & Lore

## Overview
Transform the Electron UI from a passive event stream into an active world encyclopedia. Enrich simulation events with context data, overhaul the character inspector for at-a-glance understanding, replace the chronicle tab with an entity-centric Legends Viewer, and add entity favoriting.

## Design Pillars
- Every event should answer WHO, WHAT, WHERE, WHY
- Every entity should be understandable at a glance
- Navigation between entities should be effortless
- Favorites let players follow the stories they care about

---

## P1: Event Enrichment (Source Layer)

### Problem
CharacterAI creates events with minimal metadata: `actionName`, `outcome`, `skillUsed`, `skillLevel`, `roll`, `successProbability`. Missing: target entity, location, motivation, relationship context.

### Solution
Add fields to `event.data` during CharacterAI's execute phase:

```typescript
// New fields in character action event.data
targetId?: number          // EntityId of action target
locationId?: number        // SiteId resolved from character Position
motivation?: string        // Goal or personality driver
relationshipToTarget?: string  // e.g., "rival (-45)" or "friend (+72)"
personalityDriver?: string // Dominant Big Five trait
contextDetail?: string     // Combined sentence: "Driven by compassion toward a longtime rival"
```

### Where
- `packages/core/src/systems/character-ai.ts` — execute phase, event creation
- The scoring phase already has target, personality weights, and goal — extract instead of discarding

### Impact
All downstream consumers (narrative, inspector, chronicle, legends) get richer data automatically.

---

## P2: Event Enrichment (Display Layer)

### Problem
Narrative templates use generic placeholders. Low-significance templates produce bland prose. Inspector "Key moments" falls back to `event.subtype.replace(/[._]/g, ' ')` → "was involved in an event."

### Solution

**Template rewrites:** Use new event.data fields:
- Before: `"{character.name} chose clemency over punishment."`
- After: `"In a moment of compassion, {character.name} showed mercy to {target.name} at {site.name}."`

Medium/high templates gain motivation and relationship context.

**EntityResolver expansion:** Add `resolveTarget()` path using `targetId` from event.data.

**Fallback improvement:** Inspector key moments fallback becomes `"{actionName} targeting {targetName} at {siteName}"` — always meaningful.

### Where
- `packages/narrative/src/templates/character-actions.ts` — all 281+ templates
- `packages/narrative/src/engine/narrative-engine.ts` — resolver integration
- `packages/narrative/src/engine/entity-resolver.ts` — target resolution
- `packages/electron/src/main/inspectors/character-inspector.ts` — key moments fallback
- `packages/electron/src/renderer/chronicle/event-formatter.ts` — chronicle fallback

---

## P3: Character Inspector Overhaul

### Problem
Inspector shows name + year + faction but missing: race, gender, age, profession, skills, beliefs, genealogy. "Key moments" are empty/generic. Sections are ordered suboptimally.

### Identity Card (new, top of inspector)
Compact 4-line header:
```
Daiyue Zhao                          [★ Favorite]
Female Dragonkin · Age 34 · Advisor
Guild of the Hammer · Noble Class
Health: Healthy | Wealth: 12,400g
```

Components read: `CreatureType`, `Status` (gender, socialClass, titles[0]), `Membership` (faction, rank), `Health`, `Wealth`. Age computed from birth tick.

### Restructured Sections (7 → 6)

1. **Overview** — Personality summary, attributes (compact bars), traits, skills (NEW), titles
2. **Bonds & Rivalries** — Allegiance, relationships with context, grudges, genealogy (NEW), beliefs/worship (NEW)
3. **Life Story** — Key moments using enriched event data. Filter significance >= 40 (was 50). Show up to 8 moments (was 5). Format: "Y1 — Showed mercy to Kara Brightblade at Iron Gate, driven by compassion"
4. **Heart & Mind** — Goals with priorities
5. **Memories** — Strongest memories with narrative descriptions
6. **Possessions** — Items and equipped gear

### Entity Cross-Links
Every entity reference is clickable:
- Faction name → faction inspector (shows roster, territories, diplomacy)
- Rank → shown with hierarchy context ("Lord — 2nd of 5 leaders")
- Relationship names → character inspector
- Genealogy → parent/child/spouse inspectors
- Site references → site inspector
- Deity references → deity inspector

---

## P4: Legends Viewer

### Problem
The chronicle tab (full-screen view) is a linear event stream. Users want an entity-centric browser for deeper world exploration.

### Solution
Replace chronicle tab entirely with categorized entity browser.

### Layout
```
┌─────────────────────────────────────────────┬──────────────┐
│  [★ Favorites] [Characters] [Factions]      │  Inspector   │
│  [Sites] [Artifacts] [Deities]              │  Panel       │
│  ┌─────────────────────────────────────┐    │  (sidebar)   │
│  │ 🔍 Search / Filter bar              │    │              │
│  ├─────────────────────────────────────┤    │              │
│  │ ★ Mao Ishi · Warrior · Iron Legion  │    │              │
│  │ ★ Kara Brightblade · Mage · Free... │    │              │
│  │ ─── All Characters (47) ────────── │    │              │
│  │   Daiyue Zhao · Advisor · Guild..  │    │              │
│  │   Thorgrim · Lord · Kingdom of..   │    │              │
│  │   ...                               │    │              │
│  └─────────────────────────────────────┘    │              │
└─────────────────────────────────────────────┴──────────────┘
```

### Category Tabs
- **★ Favorites** — Starred entities grouped by type
- **Characters** — `Name · Race · Profession · Faction · [★]`
- **Factions** — `Name · Government Type · Members · Territories · [★]`
- **Sites** — `Name · Type · Owner · Population · [★]`
- **Artifacts** — `Name · Type · Owner · [★]`
- **Deities** — `Name · Domain · Followers · [★]`

### Interactions
- Click row → opens inspector in sidebar
- Star icon → toggles favorite
- Search bar → filters current category by name
- Virtual scroll for performance (reuse chronicle virtual scroll infrastructure)

### IPC
New query: `legends:list` returns entity summaries per category. Main process reads ECS components to build compact summary objects. Cached and updated incrementally on tick deltas.

### Where
- `packages/electron/src/renderer/legends/` — new module (panel, renderer, store, tabs)
- `packages/electron/src/main/legends-provider.ts` — entity summary extraction
- `packages/electron/src/renderer/index.ts` — view switching (chronicle → legends)
- `packages/electron/src/styles/legends.css` — new stylesheet

---

## P5: Entity Favorites

### Storage
`Set<number>` (entity IDs) in renderer, persisted to `localStorage` keyed by world seed.

### UI Integration
- Star button on every Legends Viewer row
- Star button on inspector identity card
- Favorites tab in Legends Viewer (first tab)
- Chronicle sidebar: events involving favorites get gold left-border + ★ icon

### No simulation-side changes — purely UI/presentation.

---

## P6: Cross-Linking

### Entity Marker Enhancement
Existing `[[e:TYPE:ID:NAME]]` system extended:
- Click → inspect in sidebar (current behavior, unchanged)
- Double-click or modifier → open in Legends Viewer tab, scroll to entity

### Inspector → Legends Flow
Inspector identity card gets "View in Legends" link. All entity references in inspector sections are clickable links to those entities' inspectors.

### Legends → Inspector Flow
Clicking any row in Legends Viewer opens full inspector in sidebar.

---

## Priority Order

| Priority | Feature | Depends On | Effort |
|----------|---------|------------|--------|
| P1 | Event enrichment (source) | — | Medium |
| P2 | Event enrichment (display) | P1 | Medium |
| P3 | Character inspector overhaul | P1 | Medium |
| P4 | Legends Viewer | P3 | Large |
| P5 | Entity favorites | P4 | Small |
| P6 | Cross-linking | P3 + P4 | Small |

## Out of Scope
- Advanced search/filter syntax
- Entity comparison view
- Relationship graph visualization
- Event replay/rewind
