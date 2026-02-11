# Phase 13: Living Population — Population Simulation, Settlement Lifecycle & Exploration

## Motivation

Three reinforcing goals:

1. **Make the world feel alive** — Settlements should visibly grow, decline, and sometimes die. The map should change over centuries as civilizations expand and contract.
2. **Close the causation loops** — War, plague, famine, and prosperity currently produce events with zero demographic consequences. These should cascade into refugee crises, labor shortages, expansion pressure, and cultural shifts.
3. **Fill the event void** — Whole categories of events the player never sees (exploration, settlement lifecycle, migration). `EventCategory.Exploratory` is defined but has zero producers. The chronicle feels repetitive after extended play.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Population granularity | Character-driven with lightweight non-notables | Named individuals create emotional texture; promotion mechanic enables emergent storytelling |
| Non-notable scale | Soft cap ~30 per settlement, natural lifecycle | Bounded entity count (~400-1000 total), no artificial slot-filling, devastated towns visibly emptier |
| Promotion triggers | Event-driven + trait threshold + random spark | Organic rise through accumulated experience, dramatic fast-track from trauma, unpredictable sparks |
| Death handling | Remove from simulation, preserve in archive | Legends Viewer shows everyone who ever lived; creates longevity-seeking gameplay for mages |
| Causation loops | Full feedback web — all systems participate | Every system emits demographic signals; PopulationSystem is single writer interpreting them all |
| Settlement lifecycle | Organic (population pressure) + faction-driven (strategic) | Refugee villages and chartered fortress towns coexist; creates natural political tension |
| Exploratory category | Discovery + frontier + world-revealed secrets | Three sources ensure steady event flow; hidden content map seeded at generation |
| Migration model | Push-pull + cultural affinity | Emergent diasporas, religious exile communities, cultural enclaves over centuries |

## Architecture Overview

### Three New Systems

**PopulationSystem** — Central demographic engine. Processes birth, aging, death, and migration for all non-notable characters. Reads events from every other system to determine demographic pressures. Single writer to Population and PopulationDemographics components. Monthly frequency for lifecycle ticks, Daily for processing incoming casualty/migration events.

**SettlementLifecycleSystem** — Manages settlement founding, growth classification, and abandonment. Two pathways: organic (population pressure) and planned (faction colonization). Monitors viability thresholds.

**ExplorationSystem** — Fills the empty `EventCategory.Exploratory`. Three event sources: character-driven discovery, frontier encounters, and world-revealed secrets.

### ExecutionOrder Integration

Current 13-step order gains three insertions:

- PopulationSystem after Economy (step 3.5)
- SettlementLifecycleSystem after Population (step 4.5)
- ExplorationSystem after Character AI (step 6.5)

Existing systems keep their slots. New systems read events from earlier systems in the tick and write events for later ones.

### ECS Changes

**New components:**

- `Significance` — score (number), sparkHistory (array of {tick, description})
- `Parentage` — motherId (EntityId | null), fatherId (EntityId | null)
- `Deceased` — cause (string), tick (number), locationId (EntityId)
- `HiddenLocation` — type (ruins | resource | magical | lore), revealConditions, coordinates

**Modified components:**

- `Population` — gains `nonNotableIds: EntityId[]` linking to lightweight character entities
- `PopulationDemographics` — becomes live reflection of actual non-notable composition

## PopulationSystem — Lifecycle Mechanics

### Birth

Monthly tick evaluates each settlement's birth rate, influenced by: prosperity (economic output), safety (no active war/disaster), population size, and race-specific fertility. Births create new non-notable entities with:

- Name from existing NameGenerator
- Race sampled from settlement demographics
- Age 0
- Parents assigned from existing non-notables when possible
- `Parentage` component linking mother/father

### Aging

Monthly tick increments age for all non-notables. Race lifespan tables (already exist in generator data) determine natural death probability — increases sharply past expected lifespan. Remarkable age milestones produce minor chronicle events.

### Death

Multiple causes, all event-driven:

- **Natural death** — age-based probability
- **War casualties** — WarfareSystem events
- **Plague/famine** — DisasterSystem events
- **Magical catastrophe** — MagicSystem events

Each death removes the entity from active simulation but preserves it via a `Deceased` component. The entity stays in ECS with a death record (cause, tick, location) so Legends Viewer can always find them. When a non-notable dies with relationships (children, spouse), grief/consequence events propagate to connected characters.

### The Spark

Each monthly tick, a small random chance (~1-3%) per non-notable that something interesting happens: an unusual dream, a strange encounter, a hidden talent surfaces, a brush with danger. These micro-events:

- Increment the `Significance` score (+5-15)
- Add an entry to sparkHistory
- Are small enough to not flood the chronicle but accumulate over a lifetime

## Promotion & the Significance System

### Significance Accumulation

| Source | Points | Example |
|--------|--------|---------|
| Spark events | +5-15 | Strange dream, unusual talent, brush with danger |
| Surviving trauma | +20-40 | Survived plague, lost family in war, witnessed battle |
| Achievement | +10-25 | Successful trade, crafted notable item, made a discovery |
| Proximity to notables | +5 | Meaningful interaction with existing notable character |
| Age milestones | +10 | Remarkable age thresholds (varies by race) |

### Promotion Threshold

When Significance crosses **100**, the non-notable is promoted to full notable status. The system generates missing components:

- **Personality** — seeded from life history (plague survivor skews cautious/resilient)
- **Goals** — informed by profession and experiences
- **Memory** — backfilled with key life events from sparkHistory

Promotion produces a narrative event marking the transition. The player can trace in the Legends Viewer how an ordinary person became someone.

### Rules

- **Demotion doesn't happen.** Once notable, always notable.
- **Death is the only exit** from notable status.
- **Magic and longevity:** Notables (especially mages) can accumulate Goal components targeting life extension. MagicSystem events can extend lifespan — dark rituals, divine boons, alchemical breakthroughs. Emerges naturally from aging pressure.

## Migration

### Push-Pull Factors

Every system contributes push or pull factors, evaluated monthly:

| System | Push | Pull |
|--------|------|------|
| Warfare | Siege, conquest → 10-30% emigration; casualties | Veterans return home |
| Disaster | Plague, famine, earthquake — severity scales emigration | Safe havens attract refugees |
| Economics | Unemployment, poverty | Prosperity, trade opportunities, specialist demand |
| Religion | Persecution drives exile | Holy sites attract pilgrims who settle |
| Magic | Catastrophic events make areas uninhabitable | Magical academies pull ambitious youth |
| Ecology | Deforestation, resource depletion, desertification | Fertile land, abundant resources |
| Culture | — | Cultural capitals attract artisans; renowned festivals draw visitors who stay |

### Destination Selection

Weighted score combining:

- **Distance** — closer preferred
- **Safety** — no active threats
- **Prosperity** — economic health
- **Cultural affinity** — matching race, religion, faction

A displaced elven family seeks other elven settlements first. A persecuted religious sect crosses the map to reach coreligionists. This creates emergent diasporas and cultural enclaves over centuries.

### Migration Events

Migration is visible and trackable: "A caravan of 12 families from Ashwick arrived in Stonehaven, fleeing the Blight." The Legends Viewer records migration history per settlement — who came, who left, why.

## Settlement Lifecycle

### Organic Founding

When a settlement exceeds its comfort threshold (available resources vs. population), pressure builds. At a tipping point, a group of non-notables — sometimes led by a notable with Expansion or Independence goals — splits off. Destination tile selected by: proximity to parent, terrain habitability, unclaimed resources, distance from existing settlements. New settlement starts as "Camp."

### Faction-Driven Founding

Factions with territorial ambitions, resource needs, or strategic goals charter settlements. A new colonization decision type in FactionSystem triggers SettlementLifecycleSystem. Planned settlements start larger (faction sends settlers and resources) and receive a Structures component immediately.

### Growth Classification

| Tier | Population | Characteristics |
|------|-----------|-----------------|
| Camp | <15 | Barely a settlement, high failure risk |
| Village | 15-75 | Basic structures, limited professions |
| Town | 75-300 | Diverse economy, defensive walls possible |
| City | 300-1000 | Specialized districts, cultural institutions |
| Capital | 1000+ | Seat of power, attracts migration |

Tier transitions produce chronicle events. Each tier unlocks new structure types and profession slots.

### Abandonment

When population drops below 5 for 2+ consecutive years, the settlement enters decline. Remaining non-notables migrate to nearest viable settlement. The site entity persists as **Ruins** — retaining full history in Legends Viewer. Ruins become exploration targets. Abandoned sites can be resettled later if migrants or a faction reclaims them.

**Ruins are content, not cleanup.** Every dead settlement enriches the world.

## ExplorationSystem

### Three Event Sources

**Character-driven discovery.** Notables and high-Significance non-notables with adventurous traits undertake expeditions. Targets: unexplored map regions, known ruins (abandoned settlements), rumored artifact locations. Expeditions span multiple ticks with risk of failure/injury/death. Discoveries: ancient ruins with lore, resource deposits, magical anomalies, lost artifacts.

**Frontier encounters.** New settlements (Camps, Villages under 2 years old) auto-generate frontier events. The wilderness pushes back: dangerous creatures, harsh weather, resource scarcity. But also opportunity: fertile land, natural defenses, hidden springs. Shapes whether frontier settlements thrive or wither.

**World-revealed secrets.** Environmental simulation exposes hidden content. Volcanic eruption reveals buried ruins. Mining breaks into caverns. Deforestation uncovers standing stones. Ecological collapse drains a lake revealing a sunken temple. Triggers come from EcologySystem, DisasterSystem, and EconomicSystem (mining/logging). Checked against a hidden content map.

### Hidden Content Map

During world generation, the WorldMap seeds ~20-40 `HiddenLocation` entities with types (ruins, resources, magical sites, lore caches) and reveal conditions. These are invisible until revealed by one of the three exploration pathways. Once revealed, they become normal map features that systems can interact with.

## Narrative Templates

~80-100 new templates across these groups:

### Population Events (~20 templates)
- Settlement-scale birth/death ("A harsh winter claimed 40 souls in Ashwick")
- Remarkable individual births/deaths ("The last of the Thornwood line has passed")
- Population milestones ("Stonehaven has grown to a bustling town of 300")
- Aging landmarks ("Elder Voss, oldest living dwarf, turns 400")

### Migration Events (~15 templates)
- Refugee caravans ("Twelve families fled the burning fields of Redmoor")
- Economic migration ("Artisans flock to Ironhold, drawn by its famous forges")
- Religious exile ("The followers of the Moon Creed were driven from Highwall")
- Diaspora formation ("A small elven quarter has taken root in the human city of Krag")

### Settlement Lifecycle (~15 templates)
- Organic founding ("Desperate survivors of the Blight have established a camp in the foothills")
- Faction colonization ("The Iron Throne has chartered a fortress at the mountain pass")
- Tier progression ("What was once a muddy camp is now the thriving village of Newhollow")
- Abandonment ("The last residents of Duskfield departed. Only crows remain.")
- Resettlement ("Settlers have reclaimed the ruins of old Duskfield")

### Exploration Events (~20 templates)
- Ruin discovery, resource found, magical anomaly, lost artifact recovered
- Frontier encounters — danger, opportunity, wonder
- World-revealed secrets — eruption exposes, mining uncovers, flood reveals

### Promotion Events (~10 templates)
- Varied by backstory archetype: survivor, artisan, scholar, warrior, visionary

## Electron UI Integration

Electron is the primary interface — every feature ships with its UI.

### Inspector
- **Non-notables:** Simplified inspector view — name, age, race, profession, significance score, parentage, location. No personality/goals/memory sections until promoted.
- **Promoted characters:** Existing full character inspector, with backfilled history visible.
- **Settlements:** Population section showing demographics, recent migration, growth trend, tier history.

### Legends Viewer
- Non-notables appear in Characters tab with a subtle "commoner" indicator.
- Deceased characters shown with death cause and date.
- Settlement history timeline: founding, tier changes, notable arrivals/departures, abandonment.
- Ruins appear in Sites tab with discovery history.
- Migration history per settlement — who came, who left, why.

### Chronicle
- New event types slot into existing virtual scroll and aggregation.
- Migration and population events aggregate naturally ("Season of Migration: 3 caravans arrived in Stonehaven").
- Promotion events highlighted as notable moments.

### Map
- Settlement tile reflects current tier (camp → village → town → city → capital).
- Ruins get a distinct tile variant.
- Hidden locations invisible until revealed, then rendered with discovery marker.

## Implementation Priorities

### P1: Non-Notable Character Infrastructure
New components (Significance, Parentage, Deceased, HiddenLocation). Lightweight entity creation pipeline — NameGenerator + demographic seeding. Soft cap spawning during world generation so settlements start populated. Entity bridge additions for Electron serialization. Simplified inspector view.

### P2: PopulationSystem
Birth, aging, natural death. Monthly lifecycle tick. Race lifespan tables. Writes Population component. Death preserves entity with Deceased component. Spark micro-events incrementing Significance. Core engine — everything else builds on this.

### P3: Promotion System
Significance threshold crossing triggers full component generation. Personality seeded from life history. Backfilled Memory. Promotion events with narrative templates. Wired into CharacterAI so promoted characters immediately participate.

### P4: Causation Web
Wire all existing systems to emit demographic signals: WarfareSystem (casualties), DisasterSystem (plague/famine mortality), EconomicSystem (prosperity/decline), ReligionSystem (persecution/pilgrimage), MagicSystem (catastrophe/longevity), EcologySystem (environmental pressure), CulturalEvolutionSystem (cultural pull). PopulationSystem reads all of these.

### P5: Migration & Settlement Lifecycle
Push-pull migration with cultural affinity scoring. SettlementLifecycleSystem: organic founding from population pressure, faction-driven colonization, growth tier progression, abandonment to ruins. Resettlement mechanics. All narrative templates and Electron UI.

### P6: ExplorationSystem & Hidden Content
Hidden content map seeded during world generation. Three discovery pathways (character, frontier, world-revealed). ExplorationSystem fills EventCategory.Exploratory. Frontier encounters for new settlements. All narrative templates and Electron UI.
