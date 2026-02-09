# Aetherum -- Game Design Document

**Version 3.0** | Comprehensive Design Specification
**Codename:** Aetherum (formerly Aeternum)
**Status:** Phase 8 Complete, 2955 Tests Passing

---

## Table of Contents

1. [Vision and Identity](#1-vision-and-identity)
2. [Design Pillars](#2-design-pillars)
3. [The Simulation Engine](#3-the-simulation-engine)
4. [World Generation](#4-world-generation)
5. [Entity Architecture](#5-entity-architecture)
6. [Simulation Systems](#6-simulation-systems)
7. [Memory and Reputation](#7-memory-and-reputation)
8. [The Event Cascade Engine](#8-the-event-cascade-engine)
9. [The Narrative Engine](#9-the-narrative-engine)
10. [The Unreliable Chronicler](#10-the-unreliable-chronicler)
11. [Micro-Narrative Vignettes](#11-micro-narrative-vignettes)
12. [Player Interaction and Influence](#12-player-interaction-and-influence)
13. [User Interface Design](#13-user-interface-design)
14. [World Fingerprint System](#14-world-fingerprint-system)
15. [Timeline Branching](#15-timeline-branching-what-if)
16. [Procedural Heraldry](#16-procedural-heraldry)
17. [Performance Architecture](#17-performance-architecture)
18. [The Player Experience](#18-the-player-experience)
19. [Future Vision](#19-future-vision)

**Appendices:** A (Technical Summary), B (System Interactions), C (Cascade Anatomy), D (Glossary), E (Influence Mapping), F (Prose Lookup Tables), G (Phase History), H (Color Palette), I (Template Categories), J (Character AI Worked Example)

---

## 1. Vision and Identity

### 1.1 What Aetherum Is

Aetherum is a **digital terrarium for civilizations**. The player seeds a fantasy world with initial conditions, then watches as thousands of interconnected systems produce emergent stories that no human author scripted. History itself is the primary content.

The closest existing reference point is Dwarf Fortress's Legends Mode, but Aetherum diverges in three critical ways:

- **Where Dwarf Fortress treats history generation as a preamble to fortress gameplay, Aetherum treats history as the product.** There is no subsequent gameplay mode. The unfolding centuries are what you came for.

- **Where Dwarf Fortress presents events as database entries, Aetherum transforms them into literary prose.** Five narrative tones, 281 templates, an unreliable chronicler system, and micro-narrative vignettes turn raw simulation data into readable stories.

- **Where Dwarf Fortress gives the player no agency over unfolding history, Aetherum introduces a carefully constrained cultivation mechanic.** The player acts as an invisible gardener -- nudging events through 17 influence actions without ever commanding them.

The result is a system that produces authentic-feeling fantasy narratives -- complete with political intrigue, personal drama, magical catastrophes, religious upheaval, and generational sagas -- that surprise even the person who built the world.

### 1.2 The Experience Promise

You press play. The event log fills with the daily life of a young world. You notice a scholar named Elara discovering an ancient artifact in a remote ruin. You click her name -- the inspector opens, showing her as curious, ambitious, slightly reckless, with a strained relationship to her mentor at the Ivory Academy who expelled her for unauthorized research. You bookmark her.

Fifty simulation-years later, the narrative panel describes a "Magical Renaissance" sweeping the continent. You trace the cause-effect chain backward through the event cascade view and discover it leads to Elara's artifact discovery. Her research paper spread to three kingdoms, inspired a generation of mages, led to the founding of a new academy, and produced court wizards who shifted the political balance of power.

But you also notice a religious order has declared magic heretical in response to the growing mage influence, and a charismatic paladin is gathering followers to wage a holy war against the arcane. The world is heading toward a schism that Elara set in motion without ever intending to -- and you can trace every link in the chain.

That is the experience Aetherum creates.

### 1.3 What Aetherum Is Not

Aetherum is not a strategy game. You do not command armies or manage economies. It is not an RPG -- you do not control a character. It is not a city builder, a 4X game, or a roguelike. It is a simulation that you observe, explore, and gently tend. The closest analogy from outside gaming is watching a nature documentary about civilizations -- except you can rewind time, branch history, and occasionally drop a seed to see what grows.

---

## 2. Design Pillars

These five pillars govern every design decision in the project. When a proposed feature conflicts with a pillar, the pillar wins.

### 2.1 Emergent Storytelling Over Scripted Content

No event in the simulation is hand-authored. Every coronation, betrayal, magical discovery, and holy war arises from the interaction of underlying systems. The design document does not contain a story -- it contains the rules from which stories emerge.

This means the simulator can produce narrative structures that the designer never anticipated, which is the entire point. A war might start because an ambassador was rude at a banquet (personality-driven behavior), because the king's economic advisors reported declining revenue (economic system), because a neighboring faction's territory blocked a critical trade route (spatial system), and because a prophetic dream (player influence) convinced the king that the gods favored his cause.

**Enforcement:** No template, system, or feature may inject pre-authored narrative content. All prose must be generated from simulation state. The 281 narrative templates are parameterized structures, not scripted stories.

### 2.2 Depth Over Breadth

A single character carries personality traits (Big Five model), memories with decay and distortion, goals in a priority hierarchy, relationships with affinity scores, beliefs, possessions, skills, reputation across multiple dimensions, and a complete life history. A single city carries demographics, economy, architecture, political structure, religious composition, cultural traditions, and a timeline of every significant event within its walls.

The simulator prefers to simulate fewer entities with rich interconnection over many entities with shallow data.

**Enforcement:** 104 component types in the ECS. Characters have 12+ component categories. Factions have 10+. Sites have 11+. When adding new features, deepen existing entity models rather than adding new entity types.

### 2.3 Observation and Cultivation

The player's role is that of an invisible gardener tending a vast, living garden. They can water certain plants and prune others, but they cannot force a flower to bloom. The influence system is designed so that the player's actions feel like nudges in a plausible direction rather than divine edicts.

The most satisfying moments come from watching a tiny intervention cascade into unforeseen consequences three centuries later. The player who sends a prophetic dream to a young priest and watches that priest grow into a reformer who splits the dominant religion and triggers a century of holy wars has experienced the core loop.

**Enforcement:** All 17 influence actions have believability checks. Interventions can fail. The player earns only 1 IP per simulation year. Maximum influence pool is capped. The influence system maps to existing event categories -- there is no separate "Influence" category that would break immersion.

### 2.4 Believability Through Complexity

A king does not declare war because a random number generator said so. He declares war because his personality traits include ambition and pride, because his economic advisors report declining trade revenue, because a neighboring kingdom insulted his wife's lineage at a diplomatic banquet, because his military commander (who is secretly loyal to a rival faction) assures him victory is certain, and because a prophetic dream (sent by the player using influence points) convinced him that the gods favor his cause.

Every event should have a traceable chain of causation that, when inspected, makes the player say "of course that happened."

**Enforcement:** The event cascade engine links every event to its causes and consequences. The inspector UI exposes these chains. The dampening formula prevents implausible chain reactions. Cross-domain transitions have probability weights based on current world state, not static values.

### 2.5 Layered Interpretation

The same events exist simultaneously as:

- **Raw data** (the event record with participants, significance, causes, consequences)
- **Structured logs** (the chronicle with temporal headers, category badges, and significance indicators)
- **Literary prose** (narrative templates rendered in one of five tones, filtered through the active chronicler's biases)
- **Intimate fiction** (micro-narrative vignettes for the most significant moments)

The player can freely move between these layers, zooming from a statistical overview of a century-long population decline into the personal tragedy of a specific family caught in the famine that caused it.

**Enforcement:** Four chronicle modes (Prose, Compact, Story Arcs, Domain Focus). Six polymorphic inspector types. The Unreliable Chronicler system. Event aggregation for low-significance events. All layers are always available -- the UI never forces a single perspective.

---

## 3. The Simulation Engine

The simulation loop is the beating heart of the system. Every other feature -- generation, rendering, narrative, player interaction -- exists in service of this loop.

### 3.1 Tick-Based Model

The simulation operates on a **tick-based model where one tick equals one day** of in-world time. The calendar uses 12 months of 30 days each (360 days per year). Not every system runs every tick -- systems are stratified into frequency tiers based on how quickly their domain changes:

```
FREQUENCY TIERS
---------------------------------------------------------------
Tier          Period     Systems
---------------------------------------------------------------
Daily         1 tick     Character AI, Military movement,
                         Event resolution, Urgent cascades

Weekly        7 ticks    Trade/market updates, Relationship
                         maintenance, Reputation propagation,
                         Religious devotion

Monthly       30 ticks   Economic production/consumption,
                         Population growth/migration, Political
                         stability, Faction strategy

Seasonal      90 ticks   Agricultural yields, Military campaign
                         strategy, Cultural propagation,
                         Seasonal festivals

Annual        365 ticks  Technology progress, Artistic movements,
                         Language drift, Generational shifts,
                         Geological micro-changes, Divine power
                         recalculation

Decadal       3650 ticks Long-term climate shifts, Major geology,
                         Civilization-level cultural identity,
                         Historical era transitions
---------------------------------------------------------------
```

This stratification is not merely a performance optimization -- it is a design choice. Economics should not fluctuate daily, and mountains should not erode monthly. The frequency tiers encode the natural tempo of each domain.

### 3.2 The 13-Step Tick Execution Order

Within each tick, systems execute in a fixed order that reflects causal dependency. A character cannot make a decision based on economic conditions that have not yet been calculated.

```
+--------------------------------------------------------------+
|                      TICK N BEGINS                           |
+--------------------------------------------------------------+
|                                                              |
|  Step  1: TIME ADVANCE                                       |
|           Increment world clock, check season/year change    |
|           Trigger scheduled events                           |
|                                                              |
|  Step  2: ENVIRONMENT (if frequency matched)                 |
|           Weather generation, geological events              |
|           Natural disasters, resource regeneration            |
|                                                              |
|  Step  3: ECONOMY (if frequency matched)                     |
|           Resource production, trade routes, market prices   |
|           Tax collection, economic events                    |
|                                                              |
|  Step  4: POLITICS (if frequency matched)                    |
|           Leader decisions, diplomacy, stability             |
|           Succession, law and governance                     |
|                                                              |
|  Step  5: SOCIAL                                             |
|           Relationships, reputation propagation              |
|           Cultural norms, family events                      |
|                                                              |
|  Step  6: CHARACTER AI                                       |
|           For each active character:                         |
|             a. Perceive current context                      |
|             b. Evaluate goals                                |
|             c. Score possible actions                        |
|             d. Execute highest-scoring action                |
|             e. Store significant outcomes in memory          |
|             f. Reflect and update goals                      |
|                                                              |
|  Step  7: MAGIC (if frequency matched)                       |
|           Research progress, mana fluctuations               |
|           Artifact activation, institutional politics        |
|           Wild magic, planar stability                       |
|                                                              |
|  Step  8: RELIGION (if frequency matched)                    |
|           Divine power recalculation, prayer aggregation     |
|           Intervention checks, church politics               |
|           Prophet/saint emergence                            |
|                                                              |
|  Step  9: MILITARY                                           |
|           Army movement, battle resolution                   |
|           Siege progression, recruitment, morale             |
|                                                              |
|  Step 10: EVENT RESOLUTION                                   |
|           Process event queue (significance-ordered)         |
|           Execute consequence chains                         |
|           Generate cascading events                          |
|           Update cause-effect graph                          |
|                                                              |
|  Step 11: NARRATIVE GENERATION                               |
|           For events above significance threshold:           |
|             Generate raw log entry                           |
|             Generate narrative prose (template-based)        |
|           For high-significance events:                      |
|             Generate micro-narrative vignette                |
|             Route to chronicler for bias filtering           |
|                                                              |
|  Step 12: CLEANUP AND INDEXING                               |
|           Update spatial index for moved entities            |
|           Archive old events                                 |
|           Recalculate LoD boundaries                         |
|           Update world fingerprint                           |
|                                                              |
|  Step 13: PLAYER NOTIFICATION                                |
|           Check notification preferences                     |
|           Alert on bookmarked entity events                  |
|           Alert on high-significance global events           |
|           Update UI state for renderer                       |
|                                                              |
+--------------------------------------------------------------+
|                      TICK N COMPLETE                         |
+--------------------------------------------------------------+
|                                                              |
|  [BETWEEN TICKS: Process player influence queue]             |
|  Influence actions execute AFTER tick N completes,           |
|  BEFORE tick N+1 begins. This preserves the clean            |
|  13-step architecture.                                       |
|                                                              |
+--------------------------------------------------------------+
```

The tick order is immutable. Systems communicate exclusively through the event queue and shared component state -- never by direct reference to other systems.

### 3.3 Level-of-Detail Simulation

Not every entity can be simulated at full fidelity every tick. The Level-of-Detail system manages computational budget by simulating entities at different fidelity levels based on proximity to the player's focus.

```
LEVEL-OF-DETAIL ZONES
---------------------------------------------------------------

                     +-----+
                     |     |  Full Detail
                     |  F  |  ~50 tile radius
                     |     |  Every character makes daily decisions
                     +-----+  Individual relationships tracked
                   /         \ Economic transactions itemized
                  /           \
           +-----+             +-----+
           |                         |  Reduced Detail
           |     R E D U C E D      |  ~200 tile radius
           |                         |  Characters in aggregate groups
           +-----+             +-----+  Armies tracked, not soldiers
                  \           /         Events only above moderate sig.
                   \         /
        +-----------+---------+-----------+
        |                                 |  Abstract
        |       A B S T R A C T          |  Beyond 200 tiles
        |                                 |  Civilizations as aggregates
        +---------------------------------+  Only high-significance events
```

**Dynamic Focus Shifting:** When the player moves their focus to a new area, LoD boundaries shift. Entities transitioning from Abstract to Full Detail undergo "detail inflation" -- their statistical aggregate state is decomposed into individual entities with plausible histories interpolated from aggregate trends.

**Significance Override:** Any event above significance 85 (configurable) always receives Full Detail simulation regardless of LoD zone. If a dragon attacks a distant city, the system temporarily promotes that area to Full Detail for the duration of the crisis.

### 3.4 Simulation Speed

The player controls simulation speed through seven modes:

| Mode | Speed | Use Case |
|------|-------|----------|
| Paused | 0 | Inspect, plan influence actions |
| Slow Motion | 10s per day | Momentous events, auto-triggered at sig 95+ |
| Normal | 1 day/second | Watch specific events unfold |
| Fast x7 | 1 week/second | Track character's month-to-month life |
| Fast x30 | 1 month/second | Watch a year unfold |
| Fast x365 | 1 year/second | Watch decades pass |
| Ultra x3650 | 1 decade/second | Centuries compress |

**Auto-Pause:** The simulation automatically pauses when a legendary event (significance 95+) occurs, giving the player time to absorb what happened. This is configurable.

**Automatic Slow-Down:** The simulation optionally slows itself when it detects a convergence of significant events. If three major plotlines are reaching climax simultaneously -- a war about to be decided, a succession crisis erupting, and a magical catastrophe unfolding -- the simulation drops to Slow Motion so the player can absorb the narrative density. This produces moments of intense engagement where the player watches events unfold in near-real-time, reading vignettes and exploring inspector panels during the most dramatic moments.

**The Speed Experience:**

```
SPEED AND NARRATIVE DENSITY
---------------------------------------------------------------

Ultra x3650:  Centuries compress. Watch civilizations rise and
              fall. Empires appear as colored blooms on the map
              that expand and fade. Only legendary events pause.
              Good for: "What happens if I let this run 1000 years?"

Fast x365:    Decades pass. Generational change visible. Cultural
              drift and territorial shifts become apparent. Major
              events flash by; critical events trigger slowdown.
              Good for: "How does this region change over time?"

Fast x30:     Months pass. Individual conflicts and political
              crises play out. Trade seasons visible. Characters
              age noticeably between inspections.
              Good for: "How does this war resolve?"

Normal x1:    Days pass. Watch specific scenes unfold. A battle
              takes 3-5 real seconds. A negotiation takes 10-15.
              Good for: "I want to see what happens to Elara today"

Slow Motion:  Ten seconds per day. Every event is narrated in
              extended prose. Vignettes appear for momentous events.
              Auto-triggered at significance 95+.
              Good for: "The coronation is happening right now"

---------------------------------------------------------------
```

---

## 4. World Generation

World generation follows a deterministic pipeline where each phase builds on the output of the previous one. The same seed and parameters always produce the same world.

### 4.1 Generation Parameters

The player configures the world through a parameter screen before generation:

**World Size** -- Map grid dimensions, max civilizations, geographic scale.
- Small (200x200): 2-4 civilizations, character-focused stories
- Medium (400x400): 4-8 civilizations, balanced scope (recommended)
- Large (800x800): 8-16 civilizations, continental scope
- Epic (1600x1600): 16-32 civilizations, multiple continents

**Magic Prevalence** -- How common magical phenomena are.
- Mundane: Magic is myth. Politics and human drama dominate.
- Low: Rare and feared. A handful of practitioners per civilization.
- Moderate: Established part of society. Academies, court wizards. (Default)
- High: Permeates daily life. Enchanted tools, magical transportation.
- Ubiquitous: As fundamental as physics. Reality is fluid.

**Civilization Density** -- Number and distribution of initial settlements.
- Sparse: Isolated civilizations, vast wilderness
- Normal: Balanced contact and wilderness (Default)
- Dense: Constant contact, frequent diplomacy and conflict
- Crowded: Overlapping claims, conflict is inevitable

**Danger Level** -- Frequency and severity of threats.
- Peaceful, Moderate (Default), Dangerous, Apocalyptic

**Historical Depth** -- Years of pre-history before the player begins.
- Shallow (100 years), Moderate (500, Default), Deep (2000), Ancient (10000)

**Geological Activity** -- Dynamism of the physical world.
- Dormant, Normal (Default), Active, Volatile

**Race Diversity** -- Number of sentient species.
- Homogeneous (1-2), Standard (3-5, Default), Diverse (6-10), Myriad (11+)

**Pantheon Complexity** -- Depth of the divine layer.
- Atheistic, Deistic, Theistic (Default), Interventionist

**Technology Era** -- Starting technological level.
- Stone Age, Bronze Age, Iron Age (Default), Renaissance

### 4.2 The Six-Phase Pipeline

```
GENERATION PIPELINE
---------------------------------------------------------------

  SEED ──> Phase 1: GEOLOGICAL FORMATION
           Tectonic plates, heightmap (Perlin noise),
           water flow, rivers/lakes, climate zones,
           biome assignment, mineral/resource placement
                    |
                    v
           Phase 2: ECOLOGICAL SEEDING
           Flora by biome, fauna follows flora,
           magical creatures by magic prevalence,
           dungeon/ruin site placement
                    |
                    v
           Phase 3: COSMOLOGICAL FRAMEWORK
           Pantheon generation (domains, personalities,
           relationships), magic system rules,
           planar structure, ley line networks
                    |
                    v
           Phase 4: RACIAL GENESIS
           Sentient species with physical traits,
           lifespans, cultural tendencies, innate abilities,
           creation myths, naming conventions (Markov chains),
           starting populations by biome affinity
                    |
                    v
           Phase 5: PRE-HISTORY SIMULATION
           Fast-forward simulation at reduced fidelity
           for Historical Depth years. Ancient empires
           rise and fall. Legendary heroes emerge.
           Artifacts are forged. Wars leave ruins.
           Religions splinter. Languages diverge.
                    |
                    v
           Phase 6: CURRENT STATE INITIALIZATION
           Crystallize into playable state.
           Active civilizations with governments,
           economies, militaries, cultures.
           Named characters in positions of power.
           Initial tensions seeded from unresolved
           pre-history threads.

---------------------------------------------------------------
```

The pre-history simulation (Phase 5) is the same simulation engine from Section 3, running in fast-forward. The world's backstory is not hand-authored -- it is simulated. This means every ancient feud, legendary artifact, and cultural tradition has actual causation behind it, even if the player never inspects the details.

### 4.3 Terrain and Biome System

The world map assigns one of 17 biome types to each tile based on elevation, temperature, and rainfall:

```
BIOME ASSIGNMENT MATRIX
---------------------------------------------------------------

                    Low Rainfall    Moderate       High Rainfall
                    ----------     ----------     -----------
Hot Temperature     Desert          Savanna        Jungle
                    Volcano*        Plains         Swamp

Temperate           Desert          Plains         Forest
                                    Forest         Dense Forest

Cold Temperature    Tundra          Taiga          Taiga
                    Ice Cap*        Tundra         Ice Cap

High Elevation      Mountain        Mountain       High Mountain

Water               Deep Ocean      Ocean          Coast

* = special conditions (volcanic activity, extreme elevation)

---------------------------------------------------------------
```

Additional special biomes: MagicWasteland (near ley line nexuses with high magical activity).

Each biome has associated prose descriptions used throughout the UI:

```
Plains:     "Rolling grasslands stretch to the horizon, swaying
             gently under open skies."

Dense Forest: "Ancient trees crowd close, their canopy blotting
               out the sun. The air is thick with moss and mystery."

Volcano:    "The earth here remembers its birth in fire. Smoke
             rises from fissures, and the ground trembles with
             buried fury."
```

Resources are placed based on geological logic: gold in quartz veins near volcanic activity, iron in sedimentary layers, magical crystals at ley line intersections, timber in forests, grain in temperate plains.

### 4.4 Seven Procedural Races

The generator creates 7+ sentient species by default (configurable via Race Diversity). Each race receives:

- Physical characteristics (size, lifespan, sensory abilities)
- Biome affinity (mountain-dwelling, forest-dwelling, plains, aquatic)
- Cultural tendencies (martial, scholarly, spiritual, mercantile)
- Innate abilities (darkvision, magical aptitude, physical resilience)
- Naming conventions generated via Markov chains trained on culturally-inspired phoneme distributions -- elven names feel different from dwarven names, which feel different from orcish names, and all names within a culture feel linguistically consistent
- A procedurally generated creation myth that fits the established cosmological framework

---

## 5. Entity Architecture

### 5.1 ECS Design

Every object in the simulation -- from a mountain range to a single peasant -- is an entity. An entity is nothing but a unique identifier (a branded TypeScript type for compile-time safety). All data lives in components, and all logic lives in systems.

```typescript
// Branded ID types prevent mixing entity categories at compile time
type EntityId    = number & { readonly __brand: 'EntityId' };
type CharacterId = EntityId & { readonly __character: true };
type FactionId   = EntityId & { readonly __faction: true };
type SiteId      = EntityId & { readonly __site: true };
type ArtifactId  = EntityId & { readonly __artifact: true };
type EventId     = EntityId & { readonly __event: true };
type DeityId     = EntityId & { readonly __deity: true };
type BookId      = EntityId & { readonly __book: true };
type RegionId    = EntityId & { readonly __region: true };
type WarId       = EntityId & { readonly __war: true };
```

Component stores are Map-backed with monotonic entity IDs (no recycling). The ECS currently defines **104 component type discriminants**. World.query() starts with the smallest store for efficiency.

### 5.2 Entity Categories and Their Components

The 104 component types span 7 categories in the source code: Geographic (16 types), Social (15 types), Individual (14 types), Cultural (14 types), Knowledge (12 types), Object (6 types), and Event (11 types). Below is how they compose into entity archetypes.

**Characters** (the most richly modeled entities, up to 12 component types):
- Attribute (STR/AGI/END/INT/WIS/CHA), Personality (Big Five), Traits
- Goal (priority hierarchy), Relationship (affinity scores), Grudges
- Memory (with decay and distortion), Possession, Wealth
- Status (titles, rank), Health, Membership (faction affiliations)
- Skill (domain expertise), Belief (religious convictions), Knowledge (learned secrets)

**Factions** (civilizations, kingdoms, guilds, orders, up to 11 components):
- Territory, Government (type, stability, legitimacy)
- Doctrine, Military (strength, morale, training)
- Diplomacy (relations, treaties), Economy (treasury, trade)
- Hierarchy (leader, council), History, Origin, Culture
- Reputation (as perceived by other factions)

**Sites** (cities, towns, villages, ruins, up to 12 components):
- Position, Population, PopulationDemographics (racial breakdown)
- Biome, Climate, Economy, Resource
- Government, Ownership, Structures, Condition
- Military (garrison), Culture
- StructureType (fortification, temple, academy, market)

**Artifacts** (forged during significant events, not random loot, up to 14 components):
- Status, Value, Location, CreationHistory, Origin
- MagicalProperty, Power, PowerLevel
- Personality (artifact consciousness), Traits, Goal
- OwnershipChain, Guardian, Curse, Significance

**Deities** (real entities with agency when Pantheon Complexity is Theistic+):
- Domain (war, knowledge, nature, death, etc.)
- Personality, Relationship (to other gods)
- Power (derived from worshiper count and devotion)
- InterventionHistory, Worshiper (tracking follower demographics)

**Armies** (military units tracked during warfare):
- Composition, Commander, Position, Route
- Morale, Supply, Strength
- BattleList, Outcome (populated during and after campaigns)

**Cultural Entities** (religions, languages, art traditions):
- Origin, Practice, Spread, EvolutionHistory
- Worshiper, HolySite, SchismHistory, Ritual (religious)
- Phoneme, Vocabulary, ParentLanguage, SpeakerDistribution (linguistic)
- Style, MasterworkList, Patronage (artistic)

**Knowledge Artifacts** (books, spells, discoveries):
- Author, Content, Location, PreservationState
- Discoverer, Impact, Creator
- School, PowerLevel, Requirement, UserList (spells)

### 5.3 The Flexibility of ECS

The ECS pattern enables maximum flexibility: a character who becomes a lich gains an Undead component without requiring a new entity type. A city that falls to ruin loses its Population and Government components but retains its Position and History. A sword that gains sentience acquires Personality, Traits, and Goal components. The system handles these transitions naturally.

---

## 6. Simulation Systems

Ten simulation systems operate as independent modules. Each reads relevant components, processes logic, and writes back updated state plus generated events. Systems communicate exclusively through the event queue and shared component state.

### 6.1 Character AI System

The most complex system and the primary driver of emergent narrative. Every named character is an autonomous agent with a six-phase decision-making pipeline:

**1. Perception Phase.** The character perceives their context: current location and events, personal relationships, faction politics, recent events affecting them, health/wealth/power status, and information from their social network (which may be incomplete or distorted per the Memory and Reputation system).

**2. Goal Evaluation Phase.** Goals exist in a priority hierarchy:
- *Survival goals* (highest): Avoid death, escape danger
- *Primary life goal* (personality-driven): Gain power, seek knowledge, protect family, accumulate wealth, achieve glory, pursue art, serve faith, find love
- *Secondary goals* (contextual): Fulfill faction duty, advance in organization, complete project
- *Opportunistic goals* (lowest): Exploit unexpected situations, explore curiosity

Goals shift over a lifetime. A glory-seeking youth who loses a child to war might shift to protecting family. A scholar who discovers forbidden knowledge might pivot from seeking knowledge to gaining power.

**3. Action Generation Phase.** Context-dependent action pools: a character in a royal court has different available actions than one in a dungeon. Actions span diplomacy, military command, research, crafting, social interaction, travel, trade, religious acts, and magical acts.

**4. Scoring Phase.** Each candidate action is scored:

```
score = personality_alignment     x 0.30
      + goal_advancement          x 0.30
      + relationship_impact       x 0.15
      + risk_assessment           x 0.10
      + opportunity_value         x 0.10
      + cultural_conformity       x 0.05
      + random_factor             x impulsiveness_trait
```

The random factor scales with impulsiveness. A deliberate character adds almost no randomness. An impulsive character occasionally does something suboptimal because it "felt right in the moment" -- producing much more interesting stories.

**5. Execution Phase.** The highest-scoring action generates events placed in the event queue. Outcomes involve probability rolls modified by relevant skills.

**6. Reflection Phase.** The character checks whether outcomes suggest goals or strategies should change. A general who loses a battle might reconsider the war. A scholar who makes a breakthrough might set more ambitious targets. This creates character arcs over time.

### 6.2 Faction and Political System

Factions are the largest-scale agents. Unlike characters, faction behavior emerges from the interactions of the characters who lead them.

**Government Structures** define how decisions are made:

| Government Type | Decision Process | Stability Tendency | Primary Tension |
|----------------|-----------------|-------------------|-----------------|
| Monarchy | Single ruler decides | Stable until succession | Heir legitimacy |
| Republic | Council votes | Moderate, slow to act | Faction gridlock |
| Theocracy | Religious leaders | High (divine legitimacy) | Orthodoxy vs. reform |
| Tribal Confederation | Chieftain consensus | Slow but robust | Charismatic domination |
| Oligarchy | Wealthy elite steer | High if economy strong | Class resentment |
| Magocracy | Magical ability = rank | Volatile, power shifts | Mundane underclass |

Government types can change through revolution, reform, or gradual evolution. A monarchy suffering repeated succession crises might evolve toward republic. A republic where one family accumulates too much wealth might slide toward oligarchy. These transitions produce some of the simulation's most dramatic political events.

**Diplomacy Engine.** Factions interact through eight diplomatic action types:
1. **Form Alliance** -- requires mutual benefit assessment from both leaders
2. **Declare War** -- requires casus belli or a reckless leader
3. **Propose Trade Agreement** -- requires compatible economies
4. **Arrange Royal Marriage** -- requires eligible individuals and political motivation
5. **Offer Tribute** -- weaker faction to stronger, buys temporary safety
6. **Issue Ultimatum** -- demands backed by credible threat
7. **Sign Peace Treaty** -- requires both sides willing, terms negotiated
8. **Form Coalition** -- against a common existential threat

Diplomatic actions are proposed by faction leaders (Character AI), evaluated by advisors (also characters with their own biases), and resolved based on faction interests modified by negotiator personalities. A skilled diplomat can achieve outcomes pure power calculation would not predict -- or a hotheaded ambassador can ruin a promising alliance, as the Elara scenario demonstrates.

**Diplomacy Scoring Formula:**

```
acceptProbability = baseBenefit          x 0.30
                  + leaderPersonality    x 0.25
                  + existingRelation     x 0.20
                  + powerBalance         x 0.15
                  + diplomatSkill        x 0.10
```

**Internal Politics.** Within each faction, named characters compete for power, influence, and resources:
- Noble houses accumulate wealth and form alliances
- Ambitious generals plot coups
- Reform movements challenge established order
- Corruption erodes institutional effectiveness
- Succession crises erupt when rulers die without clear heirs
- Faction splits produce new factions with inherited grudges

Internal politics is simply what happens when you simulate dozens of ambitious characters within the same power structure. A faction's external behavior is an emergent property of its internal character dynamics -- not a top-down AI decision.

### 6.3 Economic System

The economy provides the material foundation all other systems rest on. Armies need food and weapons, scholars need books and laboratories, kings need treasuries to fund ambitions. Economic decline cascades into military weakness, political instability, and cultural stagnation.

**Resource Production.** Each settlement produces resources based on:
- **Terrain** -- farmland produces food, mines produce ore, forests produce timber
- **Technology level** -- better tools increase output per worker
- **Workforce size** -- more workers increase production with diminishing returns
- **Specialization** -- a city famous for smithing produces more weapons per worker

**Trade Networks.** Trade routes connect settlements through an emergent process. The system does not predefine routes -- it models merchant entities making profit-seeking decisions. Over time, consistently profitable routes become "established" with better infrastructure and lower risk.

```
TRADE NETWORK EMERGENCE
---------------------------------------------------------------

Year 10:  Merchants experiment. Some routes are profitable,
          others lose money. Failed routes are abandoned.

Year 30:  Profitable routes see more traffic. Infrastructure
          develops. Safety improves. Costs decrease.

Year 100: Established routes form a trade network. Cities
          at intersections become wealthy hubs. Disrupting
          a key route becomes a military strategy.

Year 300: Route topology shapes faction borders. Cities that
          control chokepoints accumulate political power.
          Trade route disruption can trigger wars.

---------------------------------------------------------------
```

**Market Simulation.** Each settlement has a local market with prices determined by supply and demand. A city that produces abundant iron but little food has cheap iron and expensive food, creating trade incentives. Prices respond dynamically to events -- a war disrupting grain shipments spikes food prices in import-dependent cities. A magical discovery making enchanted tools commonplace reduces tool prices but increases demand for magical components.

**Economic Events** feed into the narrative:
- **Booms** -- resource discovery, trade route opening, technological innovation
- **Busts** -- market crashes, resource depletion, infrastructure destruction
- **Monopolies** -- a faction controlling a critical resource gains leverage
- **Innovation** -- new production methods (usually tied to discoveries)
- **Crises** -- inflation, currency collapse, debt defaults, famine

### 6.4 Military and Warfare System

Warfare is the most dramatic expression of faction rivalry and produces some of the simulation's most significant events. It also has the deepest cross-domain cascade potential -- a single war touches every other system.

**Army Composition.** Armies are composed of units drawn from a faction's population and resources:

| Unit Type | Requirements | Strengths |
|-----------|-------------|-----------|
| Infantry | Population + basic weapons | Versatile, cheap |
| Cavalry | Horses + training + wealth | Mobile, flanking |
| Archers | Bows + training | Range, siege defense |
| Siege Engineers | Technology + materials | Wall-breaking |
| Battle Mages | Magic practitioners | Area damage, morale |
| Special Units | Race-specific traditions | Unique advantages |

Army size is limited by faction population, economic capacity to supply and equip, and morale/loyalty of the populace. Overextending military commitments produces economic decline.

**Campaign System.** Wars are not single battles -- they are multi-step campaigns with strategic objectives. A faction might campaign to capture a specific city, to secure a resource-rich territory, or to eliminate a rival's military capacity. Campaign planning is done by commander characters using the Character AI system, so a brilliant strategist commands differently than a cautious bureaucrat:

```
CAMPAIGN FLOW
---------------------------------------------------------------

  War Declared
       |
       v
  Commander assigns objectives (Character AI)
       |
       +---> March toward objective
       |          |
       |          v
       |     Encounter enemy? ----No----> Continue march
       |          |
       |         Yes
       |          |
       |          v
       |     Battle Resolution
       |          |
       |     +----+----+
       |     |         |
       |   Victory   Defeat
       |     |         |
       |     v         v
       |   Advance   Retreat / Regroup
       |     |         |
       |     v         v
       |   Siege?    Morale check
       |     |         |
       +-----+---------+
       |
       v
  War Resolution (peace / conquest / stalemate)
       |
       v
  Post-War Consequences (6+ domain cascades)

---------------------------------------------------------------
```

**Battle Resolution.** When opposing armies meet, a battle is resolved through multi-factor calculation:

```
battleOutcome = armySize           x 0.25
              + composition        x 0.15
              + commanderSkill     x 0.20
              + terrain            x 0.10
              + supplyState        x 0.10
              + morale             x 0.10
              + magicalSupport     x 0.05
              + heroIntervention   x 0.03
              + weather            x 0.02
```

Resolution is not a single dice roll -- it simulates key moments, producing a narrative of charges, flanking maneuvers, heroic stands, routs, and surrenders.

**Siege Mechanics.** Cities with walls can be besieged rather than assaulted directly. Sieges are attritional -- the attacker tries to starve the city while the defender holds out for reinforcements. Siege events include:
- Assault attempts with wall-scaling
- Sally attacks by defenders
- Disease outbreaks in cramped conditions
- Tunneling operations
- Magical bombardment
- Negotiated surrenders
- Relief forces arriving (often the most dramatic cascade trigger)

**Post-War Consequences.** A war's resolution cascades into every other system:

```
WAR RESOLUTION CASCADE
---------------------------------------------------------------
  Territory changes ---------> Political system
  Reparation payments -------> Economic system
  Veterans with trauma ------> Character system (memories, goals)
  Victory literature --------> Cultural system (art movements)
  "God favored us" ----------> Religious system (interpretation)
  Captured spellbooks -------> Magic system (knowledge transfer)
  Generational grudges ------> Memory system (inherited 5+ gen)
  Destroyed infrastructure --> Ecology system (deforestation)
  Refugee movements ---------> Social system (demographic shifts)
---------------------------------------------------------------
```

This is where cross-domain cascading produces the richest emergent narrative. A single war can produce ripple effects lasting centuries.

### 6.5 Magic System

Magic is not merely a combat power -- it reshapes society, economy, politics, and culture. The Magic Prevalence parameter (Section 4.1) sets the initial density, but the simulation's own dynamics determine how magic evolves in practice.

**Magic Schools and Domains.** The cosmological framework (Generation Phase 3) establishes magic's fundamental structure. Schools of magic are not pre-defined categories -- they emerge from research patterns. When multiple mages study similar phenomena (fire, healing, divination), a school coalesces. Schools compete for resources, students, and prestige.

**Magical Research.** Long-term projects with periodic progress checks. Each research project has prerequisites, difficulty, and breakthrough probability:

```
RESEARCH BREAKTHROUGH FORMULA
---------------------------------------------------------------

breakthroughChance = baseChance
                   + researcherSkill      x 0.25
                   + resourceQuality      x 0.20
                   + institutionFunding    x 0.15
                   + leyLineProximity     x 0.10
                   + collaborators        x 0.10
                   + serendipityRoll      x 0.10
                   + artifactBonuses      x 0.10

Typical baseChance: 2% per season for fundamental research,
                    5% for incremental advances,
                    15% for application of known principles.

Failed checks accumulate a +0.5% "accumulated insight" bonus
per attempt, representing slow progress.

---------------------------------------------------------------
```

Research can fail catastrophically. A critical failure on dangerous research (necromancy, planar magic, transmutation) produces magical catastrophe events.

**Magical Institutions.** Academies, orders, and covens with internal politics. Each institution tracks:
- Prestige (attracts students and funding)
- Library quality (accumulated knowledge)
- Specialization (school affinities)
- Internal faction alignment (conservative vs. experimental)
- Patron faction (political protection and funding source)

The headmaster of a magic academy might favor certain schools, creating disgruntled faculty who found rival institutions. A wealthy patron might redirect research toward military applications, alienating pacifist mages.

**Artifact Creation.** Artifacts are not random loot -- they are forged during significant magical events by specific characters for specific purposes. Each has a creation story connecting to world history. The Sundering Blade was created by the god Vulkaron during the Celestial War. Artifacts influence events they are involved in.

**Artifact Power Levels:**

| Level | Creation Requirement | Effect Scope | Consciousness |
|-------|---------------------|-------------|---------------|
| Minor | Skilled enchanter + materials | Single user, modest bonus | None |
| Notable | Master mage + rare materials | User + nearby area | Faint echoes |
| Major | Legendary mage + significant event | Regional influence | Rudimentary will |
| Epic | Multiple masters + world-shaking event | Cross-regional | Active personality |
| Legendary | Divine involvement or epochal magic | World-altering | Full agency |

**Artifact Consciousness.** Sufficiently powerful artifacts develop rudimentary agency. A sword forged in vengeance whispers toward violence. A crown created during a golden age inclines its wearer toward wisdom. The influence operates through the Character AI -- a character possessing a strongly-willed artifact has personality scores slightly modified. This modification is subtle at first but intensifies the longer the artifact is wielded. A willful character might resist; a weak-willed one might become the artifact's puppet.

**Magical Catastrophes.** Wild magic zones, planar rifts, failed transformations, magical plagues. These produce the most dramatic events and often catalyze historical turning points.

| Catastrophe Type | Trigger | Immediate Effect | Long-term Consequence |
|-----------------|---------|-----------------|----------------------|
| Wild Magic Surge | Failed high-energy research | Random magical effects in area | Permanent wild magic zone |
| Planar Rift | Intentional or accidental breach | Extraplanar creatures emerge | New threats, new knowledge |
| Magical Plague | Weaponized or escaped experiment | Mass illness, mutation | Magical resistance in survivors |
| Ley Line Rupture | Overdrawn ley line nexus | Magic fails in area | Realignment of power geography |
| Arcane Storm | Magical warfare or catastrophic failure | Destructive energy release | Blighted wasteland |

Catastrophe events have significance 70-95 and generate cascades into Military (defense response), Political (blame and policy), Religious (divine punishment narrative), and Cultural (anti-magic or pro-magic movements) domains.

**Magic and Society.** The integration or rejection of magic is a dynamic social process, producing a spectrum of societal responses:

```
MAGIC-SOCIETY INTEGRATION SCALE
---------------------------------------------------------------

Persecution  <-->  Tolerance  <-->  Integration  <-->  Dependence
    |                  |                 |                  |
Mages hunted,    Mages allowed     Court wizards,     Society cannot
feared, driven   but monitored.    magical trade,     function without
underground.     Separate social   magical law,       magic. Enchanted
Inquisitions.    class.            academies.         infrastructure.

Movement along this scale is driven by:
- Catastrophe events push toward Persecution
- Beneficial magic pushes toward Integration
- Economic benefit pushes toward Dependence
- Religious doctrine can push either direction

---------------------------------------------------------------
```

This balance is a political fault line producing schisms, wars, and cultural movements. A kingdom that depends on magical agriculture suffers existential crisis when ley lines shift.

### 6.6 Religious Simulation

When Pantheon Complexity is Theistic or higher, gods are real entities with agency. Each deity has a personality (generated during cosmological framework, Phase 3), domain portfolio, relationships with other deities, and a power level that rises and falls with worship.

**Divine Power Economy.** Power derives from worshiper count, devotion intensity, and holy site consecration:

```
DIVINE POWER FORMULA
---------------------------------------------------------------

divinePower = (worshiperCount x avgDevotion x 0.60)
            + (holySiteCount x siteConsecrateLevel x 0.25)
            + (sacrificeValue x 0.10)
            + (activeClergy x clergyDevoutness x 0.05)

Power Thresholds:
  < 100:    Fading (cannot intervene, at risk of death)
  100-500:  Weak (minor blessings only)
  500-2000: Moderate (prophetic visions, champion empowerment)
  2000-10000: Strong (miracles, curses, manifestation)
  > 10000:  Dominant (reshape reality in domain)

A god's death triggers EventCategory.Religious with significance
85-95, producing theological crisis cascades.

---------------------------------------------------------------
```

This creates evolutionary dynamics: gods whose doctrines attract followers grow stronger. A war god thrives during conflict but weakens during prolonged peace. A harvest god's power waxes and wanes with agricultural success. A god can die if they lose all worshipers -- a significant event producing theological crisis, schisms among former believers, and potentially the rise of a successor deity.

**Divine Intervention Types.** When power exceeds a threshold, deities can act:

| Intervention | Power Cost | Effect | Frequency |
|-------------|-----------|--------|-----------|
| Minor Blessing | 10 | Small bonus to follower's next action | Common |
| Prophetic Vision | 50 | Information revealed to chosen follower | Monthly |
| Empower Champion | 200 | Temporary stat boost for chosen warrior | Seasonal |
| Miracle | 500 | Healing, weather change, crop blessing | Annual |
| Curse | 300 | Affliction on enemy of the faith | Annual |
| Physical Manifestation | 2000 | God appears briefly in the world | Rare (decades) |
| Divine Wrath | 1000 | Disaster targeting unfaithful region | Rare |

Divine intervention events are categorized as Religious and are indistinguishable from natural religious events in the chronicle.

**Church Politics.** Religious institutions are populated by character agents with their own ambitions. This produces:
- **Corruption:** Clergy members who prioritize personal wealth over doctrine
- **Power Struggles:** Rival factions within a church competing for the high priest position
- **Doctrinal Debates:** Conservative vs. reformist interpretations of divine will
- **Inquisitions:** Orthodoxy enforcement that can spiral into persecution
- **Schisms:** Irreconcilable doctrinal differences that split a religion into competing faiths, each claiming legitimacy

Schisms are particularly significant events (significance 60-80) because they produce new factions with inherited grudges, competing claims to holy sites, and potential religious wars.

**Syncretism.** Religions influence each other through trade and conquest. A conquered people might adopt conqueror gods while retaining traditions (creating hybrid practices). A trade partner's prosperity god might gain worshipers in merchant cities. Over centuries, this produces realistic religious evolution: a monotheistic faith encountering a polytheistic culture might absorb the lesser gods as "saints" or "angels," while the polytheistic culture might elevate one god to supreme status. These transformations emerge from the simulation rather than being scripted.

### 6.7 Cultural Evolution System

Culture operates at lower frequency (seasonal/annual) but produces the deepest long-term changes. While other systems create events, cultural evolution shapes the *context* in which all events are interpreted.

**Technological Progress.** Inventions emerge from researcher characters. Each has prerequisites forming an implicit technology web:

```
TECHNOLOGY PREREQUISITE EXAMPLES
---------------------------------------------------------------

Writing        <- Language complexity + settled civilization
Mathematics    <- Writing + trade (counting)
Metallurgy     <- Mining + fire mastery
Iron Working   <- Metallurgy + specific ore availability
Navigation     <- Mathematics + shipbuilding + astronomy
Printing Press <- Woodworking + Writing + Metallurgy (for type)
Gunpowder      <- Alchemy + Mining (sulfur, saltpeter)
Universities   <- Writing + Mathematics + surplus wealth

---------------------------------------------------------------
```

Technology spreads through trade routes, conquest, and cultural exchange. Spread rate depends on trade network density and cultural openness. Some technologies are suppressed -- a theocracy might ban the printing press, a warrior culture might resist agricultural innovations that reduce martial pressure, a magocracy might suppress mundane technology that threatens magical monopoly.

**Artistic Movements.** Art reflects and shapes culture. When a character with high artistic skill creates a work, its resonance with the current cultural mood determines impact:

- **Low resonance (< 30):** The work is forgotten. An optimistic painting during famine finds no audience.
- **Moderate resonance (30-70):** The work gains local appreciation and may inspire imitators.
- **High resonance (> 70):** A masterwork triggers an artistic movement. The movement spreads between civilizations along trade routes, influencing architecture, fashion, and social attitudes.

Movements have lifecycles: emergence, flourishing, stagnation, and either transformation into tradition or replacement by a new movement. A civilization's accumulated artistic heritage (tracked via the Culture component) shapes its identity and influences diplomatic relations -- cultures with similar artistic traditions have slightly warmer diplomatic baselines.

**Philosophical Schools.** Ideas compete in the marketplace of thought:
- **Conservative schools** defend existing power structures, religious orthodoxy, and traditional values. They gain strength during periods of prosperity and stability.
- **Revolutionary schools** challenge authority, propose new social orders, and question established truths. They gain strength during periods of inequality, defeat, or rapid change.
- **Scholarly schools** pursue knowledge for its own sake. They thrive in peaceful, wealthy societies with patron institutions.

The balance between philosophical schools affects faction stability, likelihood of reform or revolution, and the trajectory of technological progress. A civilization dominated by conservative philosophy resists change but maintains stability. One dominated by revolutionary philosophy innovates rapidly but risks internal upheaval.

**Language Evolution.** Languages are entities with Phoneme, Vocabulary, ParentLanguage, and SpeakerDistribution components. They evolve through:
- **Drift:** Isolated speaker populations develop distinct pronunciation and vocabulary. Over centuries, dialects become mutually unintelligible.
- **Contact:** Trade introduces loan words. Conquest can impose new languages or create creoles. Bilingual characters serve as bridges.
- **Prestige:** The language of a dominant culture spreads through aspiration. A conquering empire's language becomes the lingua franca of trade and diplomacy.
- **Death:** When a language's speaker count drops below a threshold, it enters endangerment. Without active preservation (a cultural action), it goes extinct -- a quiet loss tracked in cultural memory.

### 6.8 Ecology System

The natural world is an active participant, not merely a backdrop. Ecological dynamics create constraints and opportunities that drive civilization in directions that pure politics and economics would not predict.

**Ecological Pressures:**
- **Overhunting** depletes animal populations, reducing food supply and driving migration patterns that reshape settlement viability
- **Deforestation** for building material reduces rainfall (simplified climate model), potentially turning productive farmland into scrubland over decades
- **Mining operations** can trigger geological instability, causing cave-ins and landslides that destroy settlements
- **Magical pollution** from intense magical activity creates "blighted zones" where flora and fauna mutate into dangerous forms
- **Invasive species** introduced through trade routes or exploration can collapse local ecosystems, destroying food sources
- **Dragon territories** create dead zones that civilization cannot expand into without military action, shaping faction borders around natural barriers

**Ecological Events** cascade into other systems: a deforested region leads to drought (Environment), which causes famine (Economic), which triggers migration (Social), which creates refugee crises (Political), which may lead to war (Military) over remaining fertile land.

### 6.9 Secret Knowledge System

Certain knowledge is hidden, forbidden, and dangerous. The Secret Knowledge system operates beneath the surface of public events.

**Secret Societies** guard forbidden magic, maintaining hidden hierarchies and pursuing goals that may conflict with the public factions their members belong to. A merchant guild leader might secretly be the head of a shadow cult pursuing necromantic research.

**Conspiracy Plots** unfold through Character AI actions tagged as "covert." When a character decides to plot against their faction leader, the plot develops over months through secret meetings, recruitment of allies, and gathering of resources -- all invisible to the event log unless a spy discovers the plot or the conspiracy succeeds.

**Information as Currency.** Characters can discover secrets (hidden parentage, hidden alliances, forbidden magic) and choose to weaponize, trade, or conceal them. A character who discovers that the king's heir is actually the child of a rival house holds information that could topple a dynasty.

### 6.10 Memory and Reputation System

The cognitive and social simulation system. Covered in depth in Section 7.

---

## 7. Memory and Reputation

This system transforms characters from reactive decision-makers into beings with persistent inner lives. It is the foundation for grudges, gratitude, learning from experience, and the rich personal histories that make characters feel real.

### 7.1 Memory Architecture

Every named character maintains a Memory Store -- an ordered collection of memory records, each representing a significant experience.

```
MEMORY RECORD
---------------------------------------------------------------
eventId:        EventId        // The original event
timestamp:      WorldTime      // When it happened
emotionalWeight: number        // -100 (traumatic) to +100 (joyful)
significance:   number         // 0-100, how important
participants:   EntityId[]     // Who was involved
myRole:         MemoryRole     // Actor, target, or witness
category:       MemoryCategory // Betrayal, kindness, loss, triumph...
accuracy:       number         // 0-100, how accurately remembered
timesRecalled:  number         // How often accessed
lastRecalled:   WorldTime      // When last accessed
narrative:      string         // Character's subjective version
---------------------------------------------------------------
```

**Memory Formation Rules:** Not every event becomes a memory. Formation requires direct involvement (actor, target, or witness) and exceeding a significance threshold modified by personality. Empathetic characters form memories from witnessing suffering. Self-absorbed characters only remember events affecting them directly. Ambitious characters remember power dynamics.

### 7.2 Memory Decay and Distortion

Memories decay over time -- significance slowly decreases, and low-significance memories are eventually pruned. However, highly emotional memories resist decay. A traumatic betrayal (emotional weight -90) stays vivid for a lifetime. A pleasant dinner party (+20) fades within years.

More critically, **memories distort**. Each time a memory is recalled (when the character encounters a related situation or person), accuracy can decrease. Details shift, emotions intensify, blame is redistributed. A character partly responsible for a failed battle might, after years, remember the failure as entirely their rival's fault.

This distortion is the engine powering grudges, heroic self-narratives, and the divergence between what "actually happened" (the event log) and what a character "remembers" (their memory store).

### 7.3 Reputation System

Reputation is the social mirror of memory -- what others believe about a character.

**Propagation chain:**
1. Character performs action (event generated)
2. Witnesses form memories (with their own bias)
3. Witnesses share with contacts (distortion chance per hop)
4. Recipients share further (further distortion)
5. After N hops, the story may differ significantly from reality

**Propagation speed depends on:** social network density (court gossip spreads fast, rural news slow), story significance, existing reputation, and trade/communication infrastructure.

**Six Reputation Dimensions** (each valued separately per observing faction):
- Martial (combat prowess, military victories)
- Diplomatic (trustworthiness, negotiation skill)
- Scholarly (knowledge, discoveries, teaching)
- Moral (virtue/villainy, colored by observer's moral framework)
- Magical (power, feats, artifacts created)
- Leadership (faction performance, crisis management)

A character might have high Scholarly and Magical reputation everywhere, but Moral reputation of "terrifying villain" in most kingdoms and "misunderstood genius" among apprentices.

### 7.4 Generational Grudges

When a character dies, their most emotionally significant memories are partially inherited by close family:

```
GRUDGE INHERITANCE
---------------------------------------------------------------
Generation 1 (direct experience):   100% emotional weight
Generation 2 (parent's story):       60% emotional weight
Generation 3 (grandparent):          30% emotional weight
Generation 4 (great-grandparent):    10% emotional weight
Generation 5+: Fades to cultural memory
---------------------------------------------------------------
```

**Grudge Refreshing:** If the target family/faction performs a new hostile action, the grudge resets to the higher of the new event's intensity or the inherited intensity.

**Grudge Resolution:** Apology/reparation, intermarriage, shared threats, passage of time, or the "forgiving" personality trait.

**Cultural Memory:** When a grudge fades below individual significance but was historically important, it transitions to cultural memory -- a background bias with lower intensity but much longer duration.

### 7.5 False Memories and Propaganda

**Organic Distortion.** Natural memory degradation over time.

**Deliberate Propaganda.** Faction leaders can create false narratives. A usurper's historians rewrite the previous king as a tyrant. A religious order rewrites a saint's history.

**In-World Historians.** When a historian character writes a book, the account is filtered through their biases. A historian employed by Kingdom A portrays Kingdom A favorably. This produces contradictory historical accounts within the simulation, which the Unreliable Chronicler system surfaces to the player.

### 7.6 The Dreaming Layer

Beyond conscious decisions, characters have a subconscious Dreaming Layer that processes experiences during "sleep." Dreams can:
- Resolve conflicting goals (reducing internal stress)
- Reinforce fears (increasing anxiety-related behavior)
- Generate creative inspiration (research breakthroughs)

The player's "prophetic dream" influence action works by inserting content into this layer, processed as if it were natural.

---

## 8. The Event Cascade Engine

The cascade system separates Aetherum from a random event generator. Every event can cause other events, creating chains spanning centuries and connecting seemingly unrelated domains.

### 8.1 Event Structure

Each event carries:
- **Significance score** (0-100) determining narrative treatment depth
- **Category** (Political, Magical, Cultural, Religious, Scientific, Personal, Exploratory, Economic, Disaster, Military)
- **Participant list** of entity IDs
- **Cause chain** linking to the events that produced this one
- **Consequence potential** -- possible follow-on events with probability weights
- **Temporal offset** -- some consequences are immediate, others delayed by days, months, or years

### 8.2 The Cascade Model

When an event resolves, the engine evaluates its consequence potential. Probabilities are not static -- they are dynamically calculated from current world state.

**Example: A Mage Completes a Groundbreaking Grimoire**

The event "Wizard Thessalon writes The Emerald Codex" triggers:

1. **Knowledge spreads** (80%, modified by trade connectivity). If kingdoms have trade routes and literate populations, the book spreads. If isolated or illiterate, it does not.

2. **Institutions react** (90%). Academies celebrate, religious orders condemn, rivals try to discredit or steal.

3. **New practitioners emerge** (proportional to Magic Prevalence).

4. **Political implications** (depends on dynamics). A kingdom seeking military advantage might recruit enchantment specialists.

Each triggered consequence has its own consequence potential, creating the chain: book -> knowledge spreads -> academy founded -> graduates gain influence -> political shift -> war -> resistance -> counter-movement.

### 8.3 Cascade Depth and Dampening

Not every cascade runs forever. The dampening formula reduces probability at each step:

```
effectiveProbability = baseProbability x (1 - dampening)^depth
```

**Maximum cascade depth: 10.** This prevents infinite loops while allowing deep chains. Dampening is reduced for high-significance events -- a world-shaking catastrophe cascades further than a minor trade dispute.

### 8.4 Cross-Domain Cascading

The most interesting cascades cross domain boundaries. The engine explicitly models cross-domain transitions:

```
CROSS-DOMAIN CASCADE EXAMPLES
---------------------------------------------------------------

Military victory -->
  Political:  Territory changes, war reparations
  Economic:   Trade route shifts, resource acquisition
  Cultural:   Victory literature, heroic narratives
  Religious:  "God favored us" interpretation
  Personal:   Veterans with trauma and glory
  Magical:    Captured spellbooks, war-magic innovation

Religious schism -->
  Political:  Factions align with different sects
  Economic:   Trade disruption along sectarian lines
  Military:   Holy war potential
  Cultural:   Art reflecting spiritual crisis
  Personal:   Families split by faith
  Scientific: Theological debates produce new philosophy

Magical catastrophe -->
  Military:   Emergency mobilization
  Political:  Blame and accountability crisis
  Economic:   Destruction of infrastructure
  Religious:  Divine punishment interpretation
  Personal:   Trauma, heroism, displacement
  Cultural:   New artistic movement born from horror

---------------------------------------------------------------
```

### 8.5 The Narrative Significance Amplifier

Some cascades develop a self-reinforcing quality where each link is slightly more significant than the last. The engine detects these "rising action" patterns and marks them as narrative arcs -- tracked chains that receive special narrative attention. When the arc reaches its climax (highest-significance event), the narrative engine produces its most dramatic prose.

### 8.6 The Event Queue

The event queue is a **priority queue (binary heap) ordered by significance**. Higher-significance events process first within each tick. Each resolved event may enqueue new events, creating the cascading chains.

---

## 9. The Narrative Engine

The Narrative Engine transforms raw simulation events into readable, atmospheric prose. It operates on a template-based system augmented with contextual variation, literary device insertion, and tone control.

### 9.1 Template Architecture

The engine contains **281 templates across 11 category files**:

| Category File | Template Count | Covers |
|---------------|---------------|--------|
| political.ts | ~40 | Succession, diplomacy, governance, rebellion |
| military.ts | ~35 | Battles, sieges, wars, armies, conquest |
| economic.ts | ~25 | Trade, markets, resource, treasury |
| cultural.ts | ~30 | Technology, art, philosophy, traditions |
| religious.ts | ~30 | Faith, schisms, miracles, temples |
| magical.ts | ~25 | Research, artifacts, catastrophes, anomalies |
| personal.ts | ~25 | Birth, death, marriage, rivalry |
| character-actions.ts | ~30 | Individual character decisions, achievements |
| disaster.ts | ~15 | Natural disasters, plagues, famine |
| scientific.ts | ~15 | Discoveries, inventions, knowledge |
| exploratory.ts | ~11 | Exploration, discovery (no system yet) |

Each template is parameterized with:
- **Entity references:** `{character.name}`, `{faction.name}`, `{site.name}` -- automatically resolved from entity state
- **Pronoun handling:** `{pronoun.subject}`, `{pronoun.object}`, `{pronoun.possessive}` -- correctly gendered
- **Conditional sections:** `{#if condition}...{/if}` -- include/exclude based on world state
- **Tone variants:** Templates exist in multiple tone variants
- **Significance scaling:** Low-significance events get brief templates. High-significance events get dramatic, literary templates with metaphor and foreshadowing

### 9.2 The Five Narrative Tones

The player selects a narrative tone governing template selection and prose style:

**Epic Historical.** Grand, sweeping language. "The realm mourned," "destiny would decree," "an age of darkness descended." Characters described by roles and epithets. The "narrator reading from a history book" voice.

**Personal Character Focus.** Intimate, character-driven. "She felt the weight of the crown," "he could not forgive what had been done." Events filtered through the perspectives of people who lived them.

**Mythological.** Ancient, reverent. "In the Time Before Time," "forged in celestial fire," "prophecy speaks of a reckoning." Events as legend, amplifying grandeur and stripping mundane detail.

**Political Intrigue.** Analytical, suspicious. "Observers noted the conspicuous absence," "intelligence suggests deeper currents," "the real negotiations happened behind closed doors." Every event as a chess move.

**Scholarly.** Dry, academic. "Evidence suggests," "the primary factor was," "contrary to popular belief." Events as subjects of study rather than drama.

### 9.3 Literary Device Integration

The engine inserts literary devices creating the texture of real storytelling:

**Foreshadowing.** When the engine detects a "rising action" arc, it adds hints in earlier events. Describing a magic academy's founding, it might add "none could foresee the horrors this pursuit of knowledge would eventually unleash" if it knows the cascade leads to catastrophe.

**Dramatic Irony.** When the player knows something a character does not, the engine highlights the gap: "placing his trust in the very man who would betray him three years hence."

**Metaphor Selection.** Templates include metaphor slots filled from context-appropriate pools. Death in winter draws cold/sleep metaphors. Political rise draws climbing/height metaphors.

**Callback and Echo.** When current events mirror historical ones: "Like the first Valmont who defied a king, so too did his great-granddaughter stand before the throne and refuse to kneel."

### 9.4 Template Example: The Same Event in Five Tones

Consider the event: "King Aldric III of Valoria died of old age, succeeded by his daughter Queen Mira."

**Epic Historical:**
> "And so passed Aldric the Steadfast, third of his name, whose reign of forty years had seen the kingdom of Valoria rise from provincial obscurity to continental power. The crown passed to his daughter Mira, who would inherit both her father's throne and the web of alliances he had so carefully woven."

**Personal Character Focus:**
> "Mira knelt beside the bed where her father lay still. His hand was cold in hers. She had known this day would come -- had prepared for it, as he had taught her to prepare for everything. But preparation could not quiet the hollowness in her chest as the chamberlain gently placed the crown upon her head."

**Mythological:**
> "The Silver King returned to the earth from which all mortals spring. His spirit passed through the Veil as the sun set over Valoria, and in the same hour, the stars shifted to mark the ascension of the Moon Queen, whose destiny had been written in the heavens since her birth."

**Political Intrigue:**
> "Aldric's death, though long anticipated by the court, set in motion a delicate succession. Queen Mira's position, while legitimate by law, was not uncontested -- her uncle's faction had been quietly building support for months, and the transfer of power would prove far less smooth than the official proclamations suggested."

**Scholarly:**
> "The death of Aldric III (Year 247, aged 73) concluded a 40-year reign characterized by diplomatic expansion and economic modernization. His successor, Queen Mira (aged 31), represented the first female monarch in Valorian history, a development that contemporary chronicles attribute to Aldric's progressive reforms of Year 230."

### 9.5 Entity Reference Resolution

Entity names within narrative prose are resolved through an EntityResolver chain:
1. Character resolution (by CharacterId)
2. Faction resolution (by FactionId)
3. Site resolution (by SiteId)
4. Artifact resolution (by ArtifactId)
5. World-based fallback via Status component (for armies, institutions)

The resolver produces both plain-text names for prose and clickable names (colored `#88AAFF`) for the interactive UI.

### 9.5 Significance-Based Elaboration

Events receive different narrative treatment based on significance:

| Significance | Treatment |
|-------------|-----------|
| 0-19 (Trivial) | Aggregated into summary batches by category |
| 20-39 (Minor) | One-line log entry |
| 40-59 (Moderate) | Short narrative paragraph |
| 60-79 (Major) | Full narrative with context |
| 80-94 (Critical) | Extended prose with literary devices |
| 95-100 (Legendary) | Maximum prose, auto-pause, vignette trigger |

---

## 10. The Unreliable Chronicler

### 10.1 Concept

The simulation does not have a single objective narrator. The raw event log provides ground truth, but narrative prose is always filtered through an in-world chronicler whose biases, allegiances, and personality color their reporting. The player can switch chroniclers to see events from different perspectives, discovering that history is contested narrative, not fixed truth.

### 10.2 Chronicler Properties

Chroniclers are special character entities with:
- **Faction Allegiance.** Events involving their faction are presented favorably.
- **Ideological Bias.** A militarist emphasizes warfare and heroism. A religious chronicler interprets through theology. A humanist focuses on individual stories.
- **Knowledge Limitation.** A chronicler in Kingdom A may lack accurate information about distant Kingdom B.
- **Personal Grudges and Admiration.** Personal experiences color portrayals.
- **Writing Style.** Each has distinct prose style -- flowery and metaphor-heavy, terse and factual, sardonic and critical.

### 10.3 The Bias Filter

The ChroniclerBiasFilter modifies base narrative in several ways:

**Faction Spin.** Battle loss becomes "strategic withdrawal." War of aggression becomes "just campaign to protect our borders." Rival achievements are downplayed.

**Omission.** Embarrassing events may simply not appear. Gaps in one chronicler's account are present in another's.

**Attribution Shift.** Credit shifts toward favored individuals. Blame shifts toward outsiders and scapegoats.

**Tone Adjustment.** The same siege: "the valiant defense of our sacred capital" vs. "the desperate stand of a tyrant clinging to stolen power."

### 10.4 Player Interaction with Chroniclers

- **Switch Chroniclers.** UI dropdown selects from available chroniclers. Narrative updates to reflect the selected perspective.
- **Compare Accounts.** Split view shows the same event from two chroniclers, highlighting divergences.
- **View Raw Record.** The objective event log is always available as ground truth.
- **Commission New Chroniclers.** Using influence points, the player can inspire a character to become a chronicler.

### 10.5 Lost History

If all chroniclers who recorded an event die without passing their works to a library or successor, the detailed narrative is "lost." The raw event log retains the data, but the narrative panel shows only a bare summary: "Detailed accounts of this event have been lost to time."

If a later historian rediscovers lost texts, narratives are restored -- potentially with new biases from the rediscoverer's interpretation. The player watches history being literally rewritten.

---

## 11. Micro-Narrative Vignettes

Beyond the chronicle-style log, the simulator occasionally produces small, intimate scene fragments -- moments of fiction that bring characters to life in a way summary prose cannot.

### 11.1 Design Philosophy

Vignettes are rare by design. Target frequency: approximately one per 50-100 simulation years (tunable). Their rarity makes each feel like a discovered treasure -- a moment where the curtain between simulation and story lifts.

### 11.2 Trigger Conditions

A vignette generates when ALL of these are met:
- Significance score above 85
- At least one participant has rich memory history (10+ significant memories)
- The event involves strong emotional content (betrayal, triumph, sacrifice, reunion, discovery)
- No vignette generated in the last 50 simulation years (cooldown)

### 11.3 Vignette Structure

Each vignette is a short prose fragment (200-500 words) written in present tense, close third-person perspective. It does not explain context -- it drops the reader into a moment and trusts the simulation has provided enough context through the event log and inspector.

**Example -- The General Before Battle:**

```
+------------------------------------------------------+
|  A MOMENT IN TIME -- Year 1247, Day of the Red Dawn  |
+------------------------------------------------------+

The tent flap does not move. The wind has died, as if
the world itself holds its breath before what is to come.

General Kaelin Stormhold stands over the map table, but
her eyes are not reading the terrain lines or the painted
markers representing ten thousand soldiers. She is looking
at the small iron ring on her left hand -- the one her
mother wore, the one her mother's mother wore before the
Valmont treachery took their ancestral seat three
generations past.

Tomorrow she will face the Valmont host across the
Ashenmere. They will have the high ground. They will have
the sun at their backs. They will have numbers.

She has something else.

She touches the ring, and somewhere in the archives of
memory -- her mother's voice, her grandmother's fury, a
hundred years of waiting -- she finds the thing she needs.

Not courage. Not strategy. Not divine favor.

Certainty.

She calls for her captains.

+------------------------------------------------------+
```

This vignette connects to the Memory system (inherited grudge), the Military system (upcoming battle), and the Character AI (personality-driven certainty). It draws power from context the simulation has been building for generations.

### 11.4 Vignette Categories

- **Before the Storm.** A leader contemplating a world-changing decision. Tone: tense, reflective.
- **The Discovery.** A scholar encountering something beyond understanding. Tone: awe, wonder.
- **The Confrontation.** Two characters with deep history facing each other. Tone: loaded silence.
- **The Legacy.** A child hearing about events the player witnessed. Tone: nostalgia.
- **The Farewell.** A character at the end of their life. Tone: peaceful or bitter.
- **The Betrayal.** The moment trust breaks. Tone: sharp, visceral.
- **The Coronation.** Taking on a defining role. Tone: weight, expectation.
- **The Aftermath.** Surveying consequences of a major event. Tone: shell-shock.

### 11.5 Character Introspection

A related system provides first-person reflections. When the player inspects a character, the introspection system generates a brief internal monologue reflecting the character's current emotional state, active goals, and recent memories. Unlike vignettes (which are rare, narrative moments), introspection is available on demand but is less literary -- it reads more like overheard thoughts than crafted prose.

**Example -- Introspection of a conflicted advisor:**

```
"The king trusts me. I have earned that trust over
twenty years. But his latest decree -- taxing the
border provinces to fund his obsession with the Eastern
Campaign -- I cannot support this. The provinces are
already restless. Lord Aldren's letters grow more
pointed each month. I know what he is building toward,
even if the king does not see it.

I should warn him. I should...

But if I speak against the campaign, I lose my seat
at the table. And without me at the table, who will
temper his worst impulses?"
```

This introspection is generated from: Goal (serve faction vs. moral duty), Relationship (king loyalty 60, Aldren relationship 45), Memory (twenty years of service), Personality (high conscientiousness, moderate neuroticism). The text is assembled from fragments, not hand-written -- but the fragments are rich enough to feel personal.

---

## 12. Player Interaction and Influence

### 12.1 The Cultivation Model

The player is an invisible cosmic gardener. They cannot command armies, write laws, or force characters to act. Instead, they expend **Influence Points (IP)** to nudge the world in subtle directions, always feeling plausible -- as if they might have happened naturally anyway.

### 12.2 Influence Point Economy

- **Base regeneration:** 1 IP per simulation year
- **Modified by world age:** Older worlds have more "narrative momentum" resisting change
- **Total pool capped:** Cannot stockpile unlimited influence
- **Failed interventions:** Partially refund IP
- **Processing timing:** Influence actions execute between ticks, preserving the clean 13-step architecture

### 12.3 The 17 Influence Actions

**Divine Intervention (5-50 IP):**

| Action | Cost | Description |
|--------|------|-------------|
| Inspire Idea | 5 IP | Plant a thought seed. May or may not take root based on personality. |
| Prophetic Dream | 10 IP | Send vision to religious figure. May be interpreted literally, metaphorically, or ignored. |
| Arrange Meeting | 15 IP | "Coincidental" encounter between two characters. They decide what to do with it. |
| Personality Nudge | 20 IP | Shift one trait slightly. Resisted by strong-willed characters. |
| Reveal Secret | 25 IP | Character learns hidden information. Must decide how to act. |
| Luck Modifier | 10 IP | Increase one action's success probability. No guarantee. |
| Vision of Future | 30 IP | Character glimpses potential outcome. May motivate or terrify. |
| Empower Champion | 50 IP | Temporarily boost abilities for a single event. Most direct and expensive. |

**Environmental Influence (5-30 IP):**

| Action | Cost | Description |
|--------|------|-------------|
| Adjust Weather | 5 IP | Timely storm or drought affecting agriculture, campaigns, moods. |
| Minor Geology | 15 IP | New spring, river shift, fertile patch. Must be plausible. |
| Animal Migration | 5 IP | Herds move toward/away from settlement, affecting food. |
| Resource Discovery | 20 IP | Increases chance an explorer finds something. Does not place resources. |
| Trigger Natural Event | 30 IP | Earthquake, eruption, flood. Must be geologically plausible. |

**Cultural Influence (5-20 IP):**

| Action | Cost | Description |
|--------|------|-------------|
| Promote Art | 10 IP | Slightly increase resonance of a cultural movement. |
| Encourage Research | 15 IP | Researcher slightly more likely to pursue a specific line. |
| Strengthen Tradition | 10 IP | Cultural practice becomes slightly more/less popular. |
| Introduce Foreign Concept | 20 IP | Character has an idea from outside their cultural context. |

### 12.4 Resistance and Believability

Every intervention passes two sequential checks before taking effect:

**Resistance Check.** The target entity's innate resistance is calculated:

```
RESISTANCE FORMULA
---------------------------------------------------------------

resistanceScore = baseWillpower           x 0.30
                + magicalProtection        x 0.25
                + divineFavor              x 0.20
                + convictionStrength       x 0.15
                + suspicionLevel           x 0.10

Outcome:
  resistanceScore < 40:  Influence succeeds fully
  resistanceScore 40-70: Influence succeeds partially
                         (reduced effect magnitude)
  resistanceScore > 70:  Influence fails
                         (50% IP refunded)

Modifiers:
  - Characters who have been influenced before gain
    +5 suspicion per previous influence attempt
  - Characters in crisis (low health, recent trauma)
    have -15 resistance
  - Characters with the "skeptical" trait gain +20

---------------------------------------------------------------
```

**Believability Check.** Even if resistance is overcome, the intervention must be plausible:
- **Context alignment:** Inspiring a pacifist monk to declare war fails. Inspiring a frustrated general to consider ambition succeeds.
- **Personality compatibility:** Nudging a personality trait in its existing direction is easy. Reversing a strong trait is nearly impossible.
- **Situational plausibility:** A "coincidental meeting" between characters on opposite sides of a continent fails. Between characters in the same city, it succeeds.
- **Environmental appropriateness:** Triggering a volcanic eruption in a geologically dormant region fails. Near a known fault line, it succeeds.

Failed believability checks refund 75% of IP (higher than resistance failures) because the system recognizes the player's intention was reasonable but the world state did not support it.

### 12.5 Influence Outcome Spectrum

Successful interventions do not produce guaranteed outcomes. They shift probabilities and create opportunities that the simulation's own agents then process:

```
INFLUENCE OUTCOME SPECTRUM
---------------------------------------------------------------

Player Action:    "Inspire Idea" -- plant the concept of
                  naval expansion in the mind of a coastal
                  king with a landlocked rival.

Possible Outcomes (determined by Character AI):

  Best Case:      King embraces the idea, commissions a fleet,
                  establishes trade routes, grows wealthy.
                  (Probability: ~30%)

  Neutral:        King considers it but priorities shift.
                  The idea sits dormant until a future
                  catalyst activates it.
                  (Probability: ~40%)

  Unexpected:     King's admiral, inspired by the idea,
                  launches unauthorized raids. Neighboring
                  maritime power retaliates. War erupts
                  from a different direction than intended.
                  (Probability: ~20%)

  Backfire:       King interprets the idea as a divine
                  mandate, overcommits resources to naval
                  buildup, neglects land defenses. Landlocked
                  rival invades through unprotected border.
                  (Probability: ~10%)

---------------------------------------------------------------
```

The player receives feedback through the chronicle about what happened, but the connection to their influence is never explicitly stated. They must infer whether their nudge contributed to the outcome.

### 12.6 Design Philosophy of Influence

Influence actions map to existing event categories (Religious, Personal, Cultural, Economic, Disaster). There is no separate "Influence" category. When a character receives a prophetic dream via player influence, the resulting event is categorized as Religious -- indistinguishable from a natural divine intervention. This preserves immersion.

Unexpected consequences are **features, not bugs**. The player who nudges a general's personality toward ambition and watches that ambition spiral into a destructive civil war has experienced the system working as intended. The most satisfying influence moments are when a tiny nudge cascades into something the player never predicted.

**The Three Laws of Influence:**
1. **Nudge, Never Command.** No influence action produces a deterministic outcome. The player shifts probabilities; the simulation resolves consequences.
2. **Plausibility Above All.** Every influence action must look like it could have happened naturally. If removed from the simulation, observers would not notice anything anomalous.
3. **Consequences are Honest.** The cascade engine treats player-influenced events identically to natural events. There is no "plot armor" for the player's preferred characters or outcomes.

---

## 13. User Interface Design

The current interface is a terminal ASCII application built with the blessed library, rendering at 30fps. The visual philosophy prioritizes information density over graphical fidelity.

### 13.1 Panel Architecture

Eight panels provide different views of the simulation:

```
PANEL LAYOUT (Chronicle-First, Default)
+----------------------------------------------------------+
|  Menu Bar: Map | Chronicle | Inspector | Relations | ...  |
+----------------------------------------------------------+
|                           |                               |
|                           |         World Map             |
|                           |     (terrain, overlays,       |
|                           |      settlements, armies)     |
|     Event Chronicle       |                               |
|                           |-------------------------------|
|   (60% width, full height)|                               |
|                           |        Inspector              |
|   4 modes:                |   (polymorphic, prose-first,  |
|   - Prose (aggregated)    |    6 entity types,            |
|   - Compact (timeline)    |    clickable navigation)      |
|   - Story Arcs (cascade)  |                               |
|   - Domain Focus          |                               |
|                           |                               |
+----------------------------------------------------------+
|  Status Bar: Year 3, Month 7 | Speed: Normal | Overlay   |
+----------------------------------------------------------+
```

Five layout presets cycle with a key press: Narrative (chronicle-first), Default, Map Focus, Log Focus, Split.

### 13.2 The Chronicle (Event Log Panel)

The chronicle is the primary narrative interface, operating in four modes:

**Prose Mode (Default).** Events below significance 60 are aggregated into summary batches by category and participant. High-significance events display full narrative prose. 30 category-specific prose templates generate aggregated summaries.

**Compact Mode.** Timeline-style chronological listing with one-line entries, category badges, and significance indicators.

**Story Arcs Mode.** Cascade tree visualization showing how events chain together. Follows rising action patterns detected by the narrative significance amplifier.

**Domain Focus Mode.** Filters to a single event category (Military, Political, etc.) for deep domain analysis.

**Chronicle Mode Examples:**

```
PROSE MODE (aggregated low-significance events)
---------------------------------------------------------------

  ---- Year 3, Summer ----

  * A season of diplomatic maneuvering saw 4 political
    events reshape the northern frontier. The Iron
    Confederacy's ambassador met with three foreign courts.

  * Beneath the mountains, 3 economic developments unfolded
    as the dwarven mines yielded their treasures to eager
    merchants.

  ** The Betrayal at Dimholt Pass                    [!85]
     In the spring of Year 3, as the armies of the Iron
     Confederacy marched through the narrow defiles of
     Dimholt Pass, Azog the Pale turned his forces against
     his own allies...

  ---- Year 3, Autumn ----

  . Commerce continued its quiet rhythm as merchants plied
    the northern trade routes.

---------------------------------------------------------------

COMPACT MODE (timeline)
---------------------------------------------------------------

  Y3.S1  * Diplomatic envoy sent to Ashenveil       [Pol 35]
  Y3.S1  . Trade agreement renewed with Dale         [Eco 22]
  Y3.S1  . Birth of Thorin's nephew Fili            [Per 18]
  Y3.S2 ** BETRAYAL AT DIMHOLT PASS                 [Mil 85]
  Y3.S2  * War declared against Azog                [Mil 55]
  Y3.S2  * Armies recalled to Confederacy           [Mil 48]

---------------------------------------------------------------

STORY ARCS MODE (cascade tree)
---------------------------------------------------------------

  Azog pledges loyalty (Y1) ─┐
                              ├─> Azog denied mining rights (Y2)
  Mining rights dispute (Y2) ─┘         |
                                        v
                              THE BETRAYAL AT DIMHOLT (Y3) ★
                                   /        |        \
                                  v         v         v
                           War declared  Armies   Diplomatic
                           against Azog  recalled  crisis
                              |                      |
                              v                      v
                        Punitive        Alliance with
                        expedition      Kingdom of Dale

---------------------------------------------------------------
```

**Common Features Across Modes:**
- Temporal headers (year/season/month separators)
- Significance indicators using visual markers: Legendary (two stars), Critical (star), Major (diamond), Moderate (bullet), Minor (dot)
- Region-contextual filtering (toggle with 'r' key, spatial distance-based using Manhattan distance)
- Split pane: left shows event list, right shows selected event detail with causal chains and multiple chronicler perspectives
- Clickable entity names (colored `#88AAFF`) navigate to the inspector
- Event aggregation: events below significance 60 are batched by category and participant using 30 category-specific prose templates

### 13.3 The Context View (Polymorphic Inspector)

The inspector is a deep-dive panel supporting six entity types through a polymorphic shell with consistent interaction patterns.

**Design Principles:**
- **Prose-First, Data-Available.** Every section opens with narrative prose synthesized from data. Numbers remain accessible beneath, but first impression is always a story.
- **Every Name is a Door.** Any entity reference is clickable (`#88AAFF` color). Clicking navigates the inspector to that entity. The player explores a wiki of their emergent world.
- **Layered Depth.** Collapsed headers show one-line summaries. Expanding reveals prose. Within sections, sub-entities can be drilled into. Three layers: glimpse -> narrative -> deep dive.

**Shared Shell Components:**
- Header bar with entity type icon, name, one-liner summary, temporal context
- Breadcrumb navigation trail (max 4 segments, clickable)
- Section accordion (numbered 1-9, expand/collapse with keyboard)
- Footer hint bar (context-sensitive controls)
- History stack (50 entries max, back/forward navigation)

**Character Inspector (7 Sections):**

```
+-- @ CHARACTER -------------------------------------------+
|  Thorin Ironhand, the Unyielding                        |
|  Warlord of the Iron Confederacy  |  Year 247, Age 63  |
|  < Back   [World] > Iron Conf. > Thorin    Forward >    |
|==========================================================|
|                                                          |
|  v [1] The Story So Far                     12 events   |
|    Born in Year 184, Thorin's youth was forged in       |
|    the fires of the War of Broken Passes...             |
|                                                          |
|  v [2] Strengths & Flaws                    Cunning     |
|    A mind as sharp as forged steel...                   |
|    STR [=====-----------]  INT [===============----]    |
|                                                          |
|  > [3] Bonds & Rivalries                  8 relations   |
|  > [4] Worldly Standing                   Warlord       |
|  > [5] Heart & Mind                    Reclaim Erebor   |
|  > [6] Remembered Things               14 memories     |
|  > [7] Possessions & Treasures          3,400 gold     |
|                                                          |
|----------------------------------------------------------|
|  [1-7] Sections  [Bksp] Back  [t] Timeline  [g] Loc.   |
+----------------------------------------------------------+
```

**Faction Inspector (8 Sections):** Rise & Reign, Banner & Creed, Court & Council, Lands & Holdings, Swords & Shields, Alliances & Enmities, Coffers & Commerce, Chronicles.

**Site Inspector (7 Sections):** A Living Portrait, People & Peoples, Power & Governance, Trade & Industry, Walls & Works, Notable Souls, The Annals.

**Event Inspector (6 Sections):** What Happened (full narrative with multiple perspectives), Who Was Involved (all participants clickable), Where & When (location clickable), Why It Matters (significance analysis), What Came Before (causal chain upstream), What Followed (consequence chain downstream).

**Region Inspector (6 Sections):** The Land Itself (biome prose, climate, elevation), Riches of the Earth (resources), Those Who Dwell Here (controlling faction, inhabitants), Marks Upon the Land (nearby settlements), Echoes of the Past (historical events), Arcane Currents (ley lines, magic events).

**Artifact Inspector:** The artifact inspector tells the story of an object as a living participant in history:

```
+-- * ARTIFACT --------------------------------------------+
|  The Sundering Blade                                     |
|  Legendary Weapon  |  Created Year 47 by Vulkaron       |
|==========================================================|
|                                                          |
|  v [1] The Forging                                       |
|    Created during the Celestial War when the god         |
|    Vulkaron struck his hammer upon the World-Anvil,      |
|    this blade was meant to sever the bonds between       |
|    planes...                                             |
|                                                          |
|  v [2] Powers & Properties                               |
|    The blade severs magical bonds and disrupts           |
|    enchantments. Its edge never dulls, and it glows     |
|    faintly when planar boundaries are thin nearby.      |
|    Power Level: Legendary (95)                          |
|                                                          |
|  > [3] The Chain of Hands              7 owners         |
|    Vulkaron -> Hero Kaelin -> House Stormhold ->        |
|    Stolen by Azog -> Lost -> Recovered by Elara ->      |
|    Currently held by Queen Mira                         |
|                                                          |
|  > [4] The Blade's Will               Ambitious         |
|    This artifact has developed rudimentary will.        |
|    It inclines its wielder toward decisive action       |
|    and resistance to magical domination.                |
|                                                          |
|  > [5] Curse & Cost                                     |
|    Those who wield the Sundering Blade too long         |
|    become unable to form magical bonds of any kind.     |
|                                                          |
+----------------------------------------------------------+
```

**Cross-Type Navigation Flows:**

```
Character --> Faction (membership) --> Site (territory) --> Region (geography)
    |              |                       |                     |
    v              v                       v                     v
  Event <-----> Character              Event <---> Region     Event
    |              |                       |
    v              v                       v
Artifact      Character              Faction
```

Every entity type can reach every other type within 1-2 clicks. This creates the "wiki exploration" feeling.

### 13.4 The World Map (with Dynamic Overlays)

The map renders terrain with biome-specific ASCII characters and colors. Six overlay layers are composited onto the terrain, driven by live simulation data through the MapOverlayBridge:

**Six Cached Layers:**
- **Settlements:** Size-based markers (hamlet `.`, village `o`, town `O`, city `@`, capital `#`)
- **Territory:** Faction-colored background tinting with border detection
- **Military:** Army markers, war zone tinting, siege indicators
- **Trade:** Route lines between economic hubs (Bresenham tracing)
- **Magic:** Ley line highlighting, anomaly markers, artifact locations
- **Entity Markers:** Temples, academies, ruins, points of interest

**Seven Overlay Presets** (cycled with 'o' key):

| Preset | Active Layers |
|--------|---------------|
| None | Terrain only |
| Political | Territory + Settlements |
| Military | Territory + Settlements + Military |
| Economic | Settlements + Trade |
| Arcane | Magic + Points of Interest |
| Climate | Temperature/rainfall gradients |
| Full | All layers (visually busy) |

**Multi-Layer Compositing:** Layers share three visual channels (char, fg, bg) through priority rules. Settlements override army markers which override trade routes which override territory tinting. Siege scenarios composite settlement marker with military red tint.

**Performance:** Event-driven dirty flags with per-layer refresh intervals (Military: 1 tick, Settlements/Territory: 30 ticks, Trade/Magic: 90 ticks). O(1) tile lookups via cached Maps. Viewport-scoped queries using the SpatialIndex QuadTree. 30fps maintained with all overlays active.

### 13.5 Supporting Panels

**Relationships Panel.** Node-and-edge ASCII graph with color-coded relationship types:

| Color | Relationship Type |
|-------|------------------|
| Blue | Family |
| Green | Friendship |
| Red | Rivalry |
| Yellow | Political alliance |
| Purple | Religious affiliation |
| Cyan | Teacher-student |

Edge intensity indicates relationship strength. The graph supports filtering by type, temporal scrubbing to see how relationships evolved, cluster detection for factions and social groups, and centering on a selected entity with configurable depth (1-3 hops).

**Timeline Panel.** Horizontal timeline with key events marked by significance:

```
TIMELINE VIEW
---------------------------------------------------------------
                    Era of Founding
         |====================|
Year  0   10   20   30   40   50   60   70   80   90  100
      |    |    |    |    |    |    |    |    |    |    |
      .    .    .    *    .    .    **   .    .    .    .
Iron Confederacy ████████████████████████████████████████
Ashenveil Republic      ████████████████████████████████
Goblin Horde                    ████████████████████████
                    *=significant events  .=minor events
---------------------------------------------------------------
```

Parallel tracks for different civilizations (color-coded rows). Zoom from millennia overview to daily granularity. Event filtering, search, and branching visualization for What-If timelines.

**Statistics Panel.** Aggregate data visualization using ASCII bar charts, line charts, and area charts:
- Population by race and civilization over time
- Territory control stacked area chart
- Technology progress per civilization
- Magic prevalence charts
- Warfare intensity heatmaps
- Economic production trends
- Religion follower distributions

**World Fingerprint Panel.** Compact identity visualization showing balance glyph, civilization palette, volatility graph, magic curve, and complexity score (see Section 14).

**Region Detail Panel.** Atmospheric biome prose, resources, climate data for the map cursor's location. Uses the BIOME_PROSE and RESOURCE_PROSE lookup tables to generate immersive descriptions.

### 13.6 Keyboard and Mouse Controls

**Global Keys (always available):**

| Key | Action |
|-----|--------|
| Tab | Cycle focus between panels |
| Space | Pause/resume simulation |
| 1-8 | Focus panel by number |
| +/- | Increase/decrease simulation speed |
| L | Cycle layout preset |
| ? | Show help overlay |
| F5 | Quick save |
| F9 | Quick load |

**Map Panel Keys (when focused):**

| Key | Action |
|-----|--------|
| W/A/S/D or arrows | Pan map |
| Z/X | Zoom in/out |
| O | Cycle overlay preset |
| Enter | Inspect entity/region at cursor |
| M | Toggle minimap |

**Chronicle Panel Keys (when focused):**

| Key | Action |
|-----|--------|
| Up/Down | Scroll events |
| Enter | Inspect selected event |
| I | Inspect event participant |
| N | Cycle chronicle mode |
| R | Toggle region filtering |
| F | Filter by category |

**Inspector Panel Keys (when focused):**

| Key | Action |
|-----|--------|
| 1-9 | Toggle section expand/collapse |
| Up/Down | Scroll content |
| Left/Backspace | Navigate back |
| Right | Navigate forward |
| G | Go to entity's map location |
| Click (mouse) | Navigate to clicked entity name |

### 13.7 The Welcome Experience

When the player first starts the simulation, a welcome screen appears during a 30-tick warmup period. This warmup allows the simulation to establish initial state before the player begins observing. The welcome screen shows:

- World seed and generation parameters
- Key factions and their leaders
- Geographic overview (continent count, biome distribution)
- Initial tensions and conflicts
- Instructions for getting started

After the warmup, the welcome dismisses and the chronicle begins filling with events. The world dashboard (inspector panel with no entity selected) shows a narrative synthesis of the current era:

```
+-- WORLD PULSE -------------------------------------------+
|                                                          |
|  This is an age where skirmishes flare across frontiers, |
|  and faith moves multitudes to action. Meanwhile,        |
|  knowledge gathers dust in neglected halls.              |
|                                                          |
|  --- GREAT POWERS -------------------------------------- |
|    & Iron Confederacy -- 45,000 souls                   |
|    & Ashenveil Republic -- 32,000 souls                 |
|    & Goblin Horde -- 18,000 souls                       |
|                                                          |
|  --- WINDS OF CONFLICT --------------------------------- |
|    * Drums of war sound across borders                  |
|    * Ambition challenges the throne                     |
|                                                          |
|  --- RECENT TIDINGS ------------------------------------ |
|    * Steel clashes upon the field                       |
|    * Trust shatters like glass                          |
|                                                          |
|  Click any entity name to begin exploring the world.     |
+----------------------------------------------------------+
```

Faction names in the dashboard are clickable, opening the faction inspector.

---

## 14. World Fingerprint System

### 14.1 Concept

Each generated world develops a unique identity over time. The World Fingerprint captures this identity in a compact visualization letting the player quickly understand a world's character.

### 14.2 Fingerprint Components

**Balance Glyph.** A radial diagram showing relative weight of six historical domains: Warfare, Magic, Religion, Commerce, Scholarship, and Diplomacy. Shape immediately communicates the world's flavor -- war-dominated worlds weight toward Warfare, magic-driven worlds toward Magic.

**Civilization Palette.** Horizontal color bar showing dominant civilizations ordered by historical significance. One-empire worlds are mostly one color. Contested worlds are rainbows.

**Volatility Graph.** Sparkline of conflict intensity over history. Peaks = war eras, valleys = peace. Shape communicates turbulence vs. stability patterns.

**Magic Curve.** Sparkline of magical prevalence over time. Some worlds see magic increase through research; others decline through suppression.

**Population Trend.** Sparkline of total sentient population. Growth = stability, decline = crisis. Sudden drops mark existential events.

**Complexity Score.** Single number (0-100) representing total significant cascades, cross-domain interactions, and narrative arcs. High = rich interconnection, low = linear histories.

### 14.3 Fingerprint Visualization Example

```
WORLD FINGERPRINT: "The Age of Broken Crowns" (Seed: 42)
+----------------------------------------------------------+
|                                                          |
|  BALANCE GLYPH            CIVILIZATION PALETTE           |
|                                                          |
|       Warfare             |███████|████|██|█|            |
|         /\                Iron    Ash- Go- Wd            |
|        /  \               Conf.   veil blin .            |
|  Dipl./    \ Magic                                       |
|      |      |             VOLATILITY (conflict/century)  |
|  Comm.\    / Relig.       ._-^-._--^^--_.--^--_._        |
|        \  /                                              |
|         \/                MAGIC CURVE (prevalence)       |
|      Scholar              .___..---''''''---...___       |
|                                                          |
|  Complexity: 78/100       POPULATION TREND               |
|                           .__--''----..._--''--          |
|                                                          |
+----------------------------------------------------------+
```

### 14.4 Domain Balance Calculations

The WorldFingerprintCalculator scores six domains based on event significance:
- **Warfare:** Sum of Military event significance
- **Magic:** Sum of Magical event significance
- **Religion:** Sum of Religious event significance
- **Commerce:** Sum of Economic event significance
- **Scholarship:** Sum of Scientific + Cultural (research) significance
- **Diplomacy:** Sum of Political event significance

Domain names must match exactly: Warfare, Magic, Religion, Commerce, Scholarship, Diplomacy.

### 14.5 Use Cases

- **World Selection.** Fingerprint gallery for finding interesting worlds. "Show me worlds where magic declined" or "find worlds with high conflict" becomes a visual scan.
- **World Comparison.** Place two fingerprints side by side to see how different parameters produced different histories from the same seed.
- **Personal Collection.** Named, tagged, organized gallery of pocket universes. Players build collections of their favorite emergent histories.

---

## 15. Timeline Branching (What-If)

### 15.1 Concept

At any point, the player creates a **timeline branch** -- a snapshot of the world state that forks into alternate history. The player makes one change (or simply re-rolls randomness) and watches how different outcomes cascade through centuries.

### 15.2 Branching Mechanics

**Creating a Branch.** Pause at a moment of interest and specify the divergence:
- Reverse an event outcome ("What if the battle went the other way?")
- Remove a character ("What if the hero died before the war?")
- Change a decision ("What if the king chose peace?")
- Add an event ("What if a volcanic eruption happened here?")
- Re-roll randomness (same state, different seeds)

**Running Branches.** Each branch runs as an independent simulation. The player switches between branches, watching them advance independently or in parallel.

**Comparison View.** Split-screen synchronized to the same date. Differences highlighted -- divergent territories, characters alive in one timeline but dead in the other. A "divergence tracker" quantifies how much the single change affected.

### 15.3 Cascade Visualization

The most compelling use of branching is watching a single change ripple outward. The comparison view includes a cascade map showing where causal chains diverged:

```
TIMELINE DIVERGENCE MAP
---------------------------------------------------------------

        ORIGINAL TIMELINE            BRANCH (Battle reversed)
        ==================           ======================

Year 50:  Battle of Ashenmere        Battle of Ashenmere
          (Confederate victory)      (Republic victory)
               |                          |
Year 52:  Territory gained           Territory lost
          Trade route secured        Refugees flee south
               |                          |
Year 60:  Economic boom              Economic crisis
          Golden age of art          Militaristic culture
               |                          |
Year 80:  Complacency                Revenge campaign
          Religious schism           United under grudge
               |                          |
Year 100: Civil war                  Reconquest war
          (decline begins)           (expansion begins)
               |                          |
Year 200: Confederacy fragmented     Confederacy dominant
          5 successor states         Continental empire

  DIVERGENCE: 89% of entities have different states
  CASCADE DEPTH: The original battle affected 2,847 events

---------------------------------------------------------------
```

The player traces exactly how "the general surviving the battle" led, through a chain of linked events, to an entirely different civilization dominating the continent 200 years later.

### 15.4 Implementation

The WorldSnapshotManager captures complete simulation state. The BranchRunner executes divergent timelines independently. The SaveManager persists branches for later exploration. Maximum 3 active branches (configurable) for performance.

### 15.5 Branch Limits and Management

For performance, the player is limited to a configurable number of active branches (default: 3). Old branches can be:
- **Archived** -- saving state but not actively simulating
- **Deleted** -- freeing memory
- **Compared** -- side-by-side view (only two branches at a time)
- **Exported** -- generating comparison reports

---

## 16. Procedural Heraldry

### 16.1 Concept

Every faction receives a procedurally generated coat of arms rendered in ASCII art. Heraldry is not decorative -- it derives from the faction's culture, values, and history.

### 16.2 Heraldry Generation

Each coat of arms is composed of:

**Shield Shape.** Selected from templates appropriate to faction culture: classic shield (knightly kingdoms), round seal (maritime republics), totem-style (tribal confederations).

**Field Division.** Standard heraldic patterns (per pale, per fess, quarterly, per bend, per chevron) rendered in box-drawing characters. Number of divisions reflects faction complexity.

**Charges (Symbols).** ASCII art symbols from cultural identity: animal totems, weapons (militaristic), stars (religious/magical), tools (trade-focused), natural features (geographically defined).

**Colors.** Derived from primary terrain (mountain = gray/silver, forest = green, desert = gold/tan) modified by values (aggressive + red, scholarly + blue, religious + purple).

### 16.3 Heraldic Evolution

Coats of arms are not static:
- Revolution replaces arms with new ideology
- Dynasty change modifies for new ruling house
- Territory expansion adds elements from conquered peoples
- Religious conversion replaces secular symbols
- Political union combines arms (quartering)

Each version is archived, creating a visual history of political evolution viewable in the Timeline.

### 16.4 Example Heraldry

```
IRON CONFEDERACY                ASHENVEIL REPUBLIC
(Militaristic Mountain Clan)    (Maritime Trade Republic)

       /\                             ___
      /  \                           /   \
     / ** \                         | ~~~ |
    / *  * \                        | ~~~ |
   /========\                       | ~~~ |
   |  IRON  |                        \ * /
   | HAMMER |                         \_/
   |________|

"Azure, a hammer argent          "Vert, three wavy bars
 between two stars or"            argent, a star or in chief"

Colors: Gray + Silver              Colors: Green + Blue
Charge: Hammer (industry)         Charge: Waves (maritime)
Stars: Ambition                   Star: Prosperity
Shield: Classic (militaristic)    Shield: Round (republic)
```

### 16.5 Display and Use

Arms appear in faction inspector panels (large rendering), on the world map as territory markers (abbreviated), in battle event narratives ("under the banner of the crimson eagle"), and in diplomatic event descriptions. A gallery shows all factions' current and historical arms, creating a visual chronicle of political evolution.

---

## 17. Performance Architecture

### 17.1 Core Optimizations

**Spatial Partitioning.** A QuadTree data structure indexes all geographically-located entities. Enables efficient nearest-neighbor queries, range queries, and "what is near this location" lookups. Rebuilt incrementally each tick for moved entities.

**Event Queue Prioritization.** Binary heap ordered by significance ensures the most important events process first and computation is spent on events that matter.

**Historical Data Compression.** Recent events keep full detail, decades-old events keep moderate detail, centuries-old events keep only significance, category, and participant summaries.

**Lazy Evaluation.** Entity state not currently queried is stored in compact form. Characters in the Background LoD zone have full decision trees evaluated only when involved in significant events or inspected by the player.

**Map Overlay Caching.** Six overlay layers cached as `Map<string, Data>` keyed by tile coordinates. O(1) lookup per tile during rendering. Event-driven dirty flags prevent unnecessary recomputation. Viewport-scoped queries (SpatialIndex.getEntitiesInRect) avoid full-world iteration.

### 17.2 Memory Budgets

| World Size | RAM Target | Simulation Speed Target |
|-----------|-----------|------------------------|
| Small (200x200) | < 500MB | 10,000x real-time |
| Medium (400x400) | < 1.5GB | 5,000x real-time |
| Large (800x800) | < 4GB | 1,000x real-time |
| Epic (1600x1600) | < 8GB | 200x real-time |

Normal play speed (1 day/second) is effortless on all sizes.

### 17.3 Tick Budget Breakdown

At Normal speed (1 tick/second), the simulation budget per tick is approximately 16ms for a Medium world:

```
TICK EXECUTION BUDGET (Medium World, ~500 entities)
---------------------------------------------------------------

Step 1: Time Advancement           < 0.1ms
Step 2: Environment                  0.5ms (weather, geology)
Step 3: Economy                      1.5ms (trade routes, production)
Step 4: Politics                     1.0ms (stability, internal politics)
Step 5: Social                       0.8ms (reputation propagation)
Step 6: Character AI                 4.0ms (most expensive -- decision pipeline)
Step 7: Magic                        0.5ms (research, ley line updates)
Step 8: Religion                     0.3ms (devotion, divine power)
Step 9: Military                     2.0ms (army movement, battle resolution)
Step 10: Event Resolution            1.5ms (cascade engine, consequence eval)
Step 11: Narrative Generation        0.8ms (template selection, rendering)
Step 12: Cleanup/Indexing            0.3ms (spatial index, component GC)
Step 13: Player Notification         0.2ms (significance filtering)
                                   ------
Total:                             ~13.5ms (headroom for spikes)

---------------------------------------------------------------
```

Character AI (Step 6) dominates because every named character runs the 6-phase decision pipeline. LoD aggressively reduces this cost: characters in the Abstract zone skip perception and scoring phases entirely, executing only if involved in a significant event.

At Ultra speed (3650x), the simulation runs up to 10 ticks per frame. This is achieved by skipping narrative generation (Step 11) and player notification (Step 13) for non-significant events, reducing the per-tick cost to approximately 8ms.

### 17.4 Rendering Performance

- Render loop throttled to 30fps
- Overlay data refresh: once per frame maximum, not per tile
- Map tile render cache invalidated only on viewport change, overlay toggle, or data refresh
- Entity span tracking rebuilt per render pass (cheap Map insertion)
- Event query limits: 200 events per entity maximum in inspector

### 17.4 Overlay Data Refresh Budget

| Layer | Refresh Interval | Refresh Cost |
|-------|-----------------|-------------|
| Settlements | 30 ticks | O(n), low |
| Territory | 30 ticks | O(n * radius), medium |
| Military | 1 tick | O(n), low |
| Trade | 90 ticks | O(n^2) paths, medium |
| Magic | 90 ticks | O(ley tiles), medium |
| Climate | Never | Static tile data |

Total overlay cache memory: approximately 380KB for a 100x100 world.

---

## 18. The Player Experience

### 18.1 Moment-to-Moment Gameplay

A typical session begins with the player pressing play and watching the chronicle fill with prose. The world is in its early centuries -- factions are establishing borders, characters are discovering the land, and the first conflicts are brewing.

The player notices a diplomatic incident: an ambassador from the Ashenveil Republic insults the queen of the Iron Confederacy at a banquet. The ambassador's personality traits include arrogance and low agreeableness. The queen's traits include pride and vengefulness. The player clicks the queen's name -- the inspector opens, showing her history, her grudge list, her military strength.

The player bookmarks both characters and lets the simulation advance at 30x speed. Over the next two simulation-years, the grudge festers. The queen's military commander reports readiness. An economic advisor notes that a contested mineral deposit could justify aggression. A prophetic dream (naturally occurring, not player-influenced) convinces the queen that the gods favor her cause.

War erupts. The player slows to normal speed and watches the campaign unfold. The chronicle fills with battle reports, each rendered in the Epic Historical tone. The event cascade engine produces consequences: a border town is sacked (Military -> Economic), refugees flee to a neutral kingdom (Military -> Political), the neutral kingdom debates whether to intervene (Political -> Military), a young scholar fleeing the war carries a magical text to safety (Military -> Magical), and fifty years later, that text catalyzes a renaissance in the neutral kingdom that the war's survivors could never have predicted.

The player traces this chain in the Story Arcs chronicle mode, seeing the full cascade tree. They switch to the event inspector for the initial banquet insult and read "What Came Before" and "What Followed." Every link is traceable. Every consequence has causation.

### 18.2 The Elara Scenario (Revisited)

This is the canonical example of Aetherum's emergent narrative in action.

**Year 0.** Player begins observing a freshly generated world. Among hundreds of entities, a young scholar named Elara appears in the event log: "Elara Brightmind, expelled from the Ivory Academy for unauthorized research, discovers an ancient artifact in the ruins of Khar-Tul."

**The Click.** The player clicks her name. The Character Inspector opens:

```
+-- @ CHARACTER -------------------------------------------+
|  Elara Brightmind                                        |
|  Wandering Scholar  |  Year 0, Age 24                   |
|==========================================================|
|                                                          |
|  v [1] The Story So Far                      3 events   |
|    Born in the university district of Aethermoor,       |
|    Elara showed early brilliance and reckless curiosity. |
|    Her unauthorized research into pre-history artifacts  |
|    led to expulsion from the Ivory Academy...            |
|                                                          |
|  v [2] Strengths & Flaws                    Curious     |
|    Brilliant but impulsive. INT [================----]   |
|    Her curiosity outpaces her caution.                  |
|    Traits: Curious | Ambitious | Reckless | Idealistic  |
|                                                          |
|  > [3] Bonds & Rivalries                  3 relations   |
|    Mentor Aldric (strained, -42)                        |
|    Ivory Academy (expelled)                              |
|                                                          |
+----------------------------------------------------------+
```

The player bookmarks Elara.

**Year 5.** Elara publishes a research paper on the artifact. The paper spreads along trade routes (Economic system) to three neighboring kingdoms.

**Year 12.** A young mage in a distant kingdom, inspired by Elara's paper, founds a new academy (Cultural system). The event is categorized Cultural with significance 65 -- major enough to appear in the Prose chronicle mode.

**Year 30.** The academy's graduates gain court positions across the continent (Political system). Magic prevalence increases. The narrative panel describes a "Magical Renaissance."

**Year 35.** A conservative religious order declares the new magic heretical (Religious system). A charismatic paladin begins gathering followers (Character AI).

**Year 50.** The player, watching the world fingerprint's magic curve climb, notices the religious volatility rising too. They open the Story Arcs view and trace the cascade backward: holy war potential -> anti-magic movement -> religious condemnation -> court wizards -> academy graduates -> academy founded -> Elara's paper -> Elara's artifact discovery.

Every link is inspectable. Every node in the chain is a clickable entity. The player has not scripted this story -- the systems produced it.

### 18.3 Influence in Action

The player has been watching the Iron Confederacy expand for three centuries. Their expansion is about to collide with the Ashenveil Republic, and the player senses a major war brewing. The player wants to see what happens if peace prevails instead of war.

**Option A: Direct Prevention (impossible by design).** The player cannot order armies to stand down. There is no "prevent war" button. This is the cultivation model working.

**Option B: Subtle Nudge.** The player inspects King Theron of the Iron Confederacy and notices his personality: ambitious, proud, moderately cautious. The player spends 20 IP on a Personality Nudge, slightly increasing Theron's caution. This shifts his risk assessment when evaluating the war declaration -- not enough to prevent it alone, but enough to make him hesitate.

**Option C: Arrange a Meeting (15 IP).** The player arranges a "coincidental" meeting between Theron and the Ashenveil ambassador -- a diplomat with high charisma and diplomatic reputation. The meeting might produce a compromise. Or it might fail -- the ambassador has a grudge against Theron's father.

**Option D: Prophetic Dream (10 IP).** The player sends Theron a dream showing the devastation the war would cause. Theron might interpret the dream as divine warning and pursue peace. Or, if his ambition is strong enough, he might interpret it as a challenge to overcome.

The player chooses Option D. The dream is processed through the Religious system -- it appears in the event log as "King Theron reports a troubling vision." The Character AI evaluates Theron's reaction based on his personality, his religious beliefs, and his current emotional state.

Result: Theron interprets the dream as divine displeasure and proposes a peace summit. But his military commander -- who has his own ambitions -- sees the hesitation as weakness and begins plotting a coup. The player's intervention prevented one war but may have catalyzed a civil war instead.

This is the influence system working as intended. **Unexpected consequences are features, not bugs.**

### 18.4 The Emotional Arc of a Session

A typical Aetherum session follows an emotional arc that mirrors the experience of reading a good novel:

```
SESSION EMOTIONAL ARC
---------------------------------------------------------------

Curiosity       "Who are these people? What's happening?"
    |           (First 30 minutes: exploring the world,
    |            clicking names, reading inspectors)
    |
    v
Investment      "I care about what happens to Elara."
    |           (Hours 1-2: bookmarking characters,
    |            watching relationships develop)
    |
    v
Tension         "The religious order is growing hostile..."
    |           (Hours 2-3: noticing conflict building,
    |            watching cascade chains develop)
    |
    v
Climax          "The holy war has begun. Everything changes."
    |           (Auto-pause at legendary event, reading
    |            vignette, tracing full cascade chain)
    |
    v
Reflection      "I can see exactly how this happened."
    |           (Exploring Story Arcs mode, comparing
    |            chronicler accounts, What-If branching)
    |
    v
New Curiosity   "What happens next? What if I nudge..."
    |           (Cycle restarts)

---------------------------------------------------------------
```

This arc emerges naturally from the simulation's dynamics. It is not scripted -- it is the inevitable result of interconnected systems producing rising action, climax, and consequence.

### 18.5 Playstyle Support

**The Observer.** Never uses influence. Watches history unfold and explores the inspector. Their joy is in discovery -- finding narrative patterns, tracing cascades, comparing chronicler accounts. They use the chronicle's Story Arcs mode and the event inspector's causal chain features extensively.

Tools for the Observer:
- Chronicle modes (especially Story Arcs and Domain Focus)
- Inspector deep-dive with causal chains
- Timeline view for macro-history patterns
- Chronicler switching for multiple perspectives
- World fingerprint for overall world character assessment

**The Interventionist.** Carefully spends influence points to shape history. They bookmark key characters, monitor faction tensions, and nudge at critical moments. Their joy is in cultivation -- planting seeds and watching them grow (or wither, or mutate into something unexpected).

Tools for the Interventionist:
- Influence action menu with cost/benefit visibility
- Bookmark system for tracking influenced entities
- Notification system for bookmarked entity events
- Cascade view to trace consequences of interventions
- IP economy display in status bar

**The Historian.** Focuses on the world's past rather than its present. They use the timeline view, compare chronicler accounts, inspect lost history events, and trace generational grudges. They export character chronicles and world encyclopedias.

Tools for the Historian:
- Timeline panel with era navigation
- Chronicler comparison (side-by-side accounts)
- Lost history indicators
- Generational grudge tracing through family trees
- Export system for character biographies and timelines

**The Experimenter.** Uses timeline branching extensively. Creates branches at pivotal moments, re-runs with different parameters, and compares how single changes ripple outward. Their joy is in understanding the simulation's dynamics.

Tools for the Experimenter:
- What-If branching at any moment
- Divergence tracker for comparing timelines
- Cascade visualization showing branching consequences
- World fingerprint comparison across branches
- Parameter variation for controlled experiments

All four playstyles are supported simultaneously. No mode is privileged over another. The UI provides tools for each without forcing any.

### 18.6 Discovery Moments

The design intentionally creates "aha!" moments -- discoveries that reward attentive observation:

**Pattern Recognition.** "Wait -- every time a new magic academy is founded, a religious counter-movement starts within 20 years." The player has discovered a systemic relationship between the Magic and Religious systems.

**Cascade Tracing.** "This entire continental war started because a baker's son was rude to a merchant's daughter 200 years ago." The player traces a cascade chain through the event inspector, finding increasingly mundane origins.

**Chronicler Divergence.** "The Iron Confederacy's chronicler says they won the Battle of Ashenmere, but the Republic's chronicler says it was a draw. The raw event log shows... it was a Pyrrhic victory." The player discovers the Unreliable Chronicler system producing conflicting accounts.

**Memory Distortion.** "General Stormhold remembers the Battle of Dimholt differently from what actually happened. Her memory has distorted -- she now believes Azog's betrayal was entirely unprovoked, but the event log shows she had previously insulted his clan." The player discovers memory distortion changing a character's motivation.

**Generational Echo.** "The Stormhold-Valmont feud that drove the war in Year 1247 originated from a trade dispute in Year 950. Three hundred years of inherited grudges, refreshed by each generation's new slights." The player discovers the generational grudge system in action.

These discoveries are not scripted -- they are emergent properties of the simulation's complexity. The UI is designed to make them findable.

---

## 19. Future Vision

### 19.1 Graphical Overhaul (Electron + PixiJS)

The terminal UI preserves the full simulation, but the visual experience is constrained by ASCII rendering. The planned graphical overhaul creates a parallel `@fws/electron` package (the blessed terminal version is preserved as fallback).

**Architecture:**

```
GRAPHICAL OVERHAUL ARCHITECTURE
---------------------------------------------------------------

@fws/core (unchanged)     @fws/generator (unchanged)
       \                         /
        \                       /
         @fws/electron (NEW) --+-- @fws/narrative (unchanged)
         |
         +-- main/           Electron main process
         |   |               (simulation runner, full ECS access)
         |   +-- ipc-handlers.ts
         |   +-- simulation-runner.ts
         |
         +-- renderer/        Electron renderer process
         |   +-- pixi/        Map canvas (terrain, overlays)
         |   +-- ui/          HTML panels (log, inspector, topbar)
         |   +-- procgen/     Procedural sprite generation
         |   +-- data/        Data adapters (from blessed panels)
         |   +-- styles/      14 CSS files
         |
         +-- shared/          IPC types between processes

@fws/renderer (blessed - PRESERVED, launched via `pnpm run start`)

---------------------------------------------------------------
```

**Platform:** Electron 33 desktop app with Vite bundling
**Map Rendering:** PixiJS 8 for 2D sprite rendering, top-down pixel art first, isometric later
**UI Panels:** HTML/CSS with ornate medieval styling (CSS Grid layout, parchment textures)
**Art Pipeline:** Procedural generation (runtime, seed-based), no hand-drawn assets

**Procedural Pixel Art Pipeline (5-Layer Tile Generation):**

```
TILE GENERATION LAYERS (32x32 pixels)
---------------------------------------------------------------

Layer 1: BASE COLOR
  SimplexNoise at freq 0.02, maps to biome palette base array

Layer 2: TEXTURE VARIATION
  Noise at 0.08 freq. Above +0.3: blend 40% toward highlight.
  Below -0.3: blend 30% toward shadow.

Layer 3: DETAIL SPECKS
  Noise at 0.2 freq. Top 15%: blend 60% detail color.
  (wildflowers, stone flecks, lava specks)

Layer 4: ORDERED DITHERING
  4x4 Bayer matrix for pixel art cross-hatch texture.
  Modulated by noise at 0.15 freq.

Layer 5: DIRECTIONAL LIGHTING
  Top-left light source for consistent illumination.
  Strength varies by biome (0.2 ocean to 0.8 desert).

---------------------------------------------------------------
```

**Sprite Atlas Budget:**

| Atlas | Size | Contents | GPU Memory |
|-------|------|----------|------------|
| Terrain | 512x512 | 136 tiles (17 biomes x 8 variants) | 1 MB |
| Transitions | 512x512 | ~80 domain-warped boundary tiles | 1 MB |
| Features | 256x256 | 36 trees + 12 rocks + vegetation | 256 KB |
| Structures | 1024x512 | 40 buildings + 5 castles + farms | 2 MB |
| UI | 256x256 | corners + badges + icons | 256 KB |
| **Total** | | | **~5.5 MB** |

**Settlement Tiers (Castle Sprites):**

| Tier | Size | Visual Components |
|------|------|------------------|
| Hamlet | 24x20 | Single tower, low walls |
| Village | 32x24 | Keep + 2 towers + walls |
| Town | 48x36 | Keep + 4 towers + gatehouse |
| City | 64x48 | Tall keep + 4 outer + 2 inner towers |
| Capital | 80x56 | Grand palace + 6 towers + triple wall |

**UI Chrome (75 CSS Custom Properties):**
- Backgrounds: near-black with blue undertone (`#0a0a0e`), dark blue-charcoal panels (`#16161c`)
- Borders: warm dark brown (`#2a2825`), bronze metalwork (`#8b6914`), gold highlights (`#c9a84c`)
- Text: warm parchment primary (`#e0d8c4`), secondary (`#b0a890`), tertiary (`#7a7060`)
- Category colors: 10 desaturated tones (Political `#d4a832`, Military `#c44040`, etc.)
- Significance: 6 tiers from Trivial `#444440` to Legendary `#d040c0` (with pulse animation)
- Typography: Cinzel (serif headers), Source Sans 3 (body), JetBrains Mono (data)

**Seasonal Color Shifts (via PixiJS ColorMatrixFilter, no tile regeneration):**

| Season | Saturation | Hue Shift | Brightness |
|--------|-----------|-----------|------------|
| Spring | +10% | -5 degrees | +5% |
| Summer | baseline | 0 | baseline |
| Autumn | -15% | +25 degrees | -5% |
| Winter | -35% | -10 degrees | +10% |

**Data Reuse:** 70% of current renderer code (5,685 of 8,094 LOC) is reusable -- territory flood-fill, trade route tracing, prose generation, entity resolution, aggregation logic. Only the blessed-specific 30% (tag formatting, box rendering, key handlers) is replaced.

**IPC Pattern:** Simulation runs in Electron main process. Renderer receives delta updates per tick (~10KB). Inspector queries use invoke/handle for on-demand data. Initial map load sends full tile data once (~800KB for 128x128). Performance targets: 60 FPS rendering, <3 second startup, <200MB memory.

### 19.2 Enhanced Narrative Systems

- **First-person introspection mode.** Stream-of-consciousness text reflecting a character's personality, goals, and emotional state.
- **Oral tradition system.** Knowledge transmitted through social networks with high mutation rates. A heroic deed becomes legend, distorting beyond recognition over centuries.
- **Procedural ambient soundscapes.** Tone.js generating music reflecting world state: harmony from dominant culture's mood, tempo from event density, dissonance proportional to conflict.
- **Expanded vignette system.** More trigger archetypes, longer vignettes for truly legendary events, multi-character vignettes for confrontation scenes.

### 19.3 Expanded Simulation Depth

- **Treaty system.** Complex multi-clause treaties with violation mechanics and diplomatic reputation consequences.
- **Espionage system.** Spy networks, intelligence gathering, covert operations, counter-intelligence.
- **Economic specialization.** Guild systems, craft mastery, luxury goods, black markets.
- **Advanced ecology.** More detailed food webs, climate feedback loops, magical ecosystem effects.
- **Expanded artifact consciousness.** Artifacts that actively pursue goals, influence wielders more dramatically, and resist incompatible users.

### 19.4 Export and Documentation System

The simulation produces a world so rich in detail that players want to preserve and share it. The export system generates multiple document types:

**World Encyclopedia.** A comprehensive compendium of all entities, events, and lore, organized by category. Entries for every named character, settlement, faction, artifact, book, spell, religion, and event. Each entry cross-references related entries, creating a hyperlinked wiki of the emergent world.

**Character Chronicles.** Individual biographies for selected characters, written in the active narrative tone and filtered through the active chronicler. These read as self-contained short stories -- the complete life from birth to death.

**Historical Timelines.** Chronological narratives with configurable scope: a single civilization, a single century, a single war, or the entire history.

**Genealogies.** Family trees with connecting lines showing trait inheritance, marriage alliances, and hereditary grudges.

**Map Atlases.** Rendered world maps at multiple time points showing territorial changes. A "time-lapse atlas" shows empires rising and falling as a sequence of snapshots.

**Religious Texts.** In-world holy books with doctrines, creation myths, prophecies, and moral codes -- generated from actual simulation events, filtered through the religion's theological biases.

**Cultural Guides.** Descriptions of art styles, traditions, fashion, cuisine, and social customs for each civilization.

**Export Formats:**
- Plain text (preserving ASCII art formatting)
- HTML with CSS styling matching the terminal aesthetic
- JSON/XML data for external analysis and tool integration

### 19.5 Social and Sharing Features

- **World fingerprint gallery.** Browse and compare generated worlds across sessions.
- **Shareable timeline snapshots.** Export specific historical moments for sharing.
- **Seed sharing.** Share world seeds and parameters so others can generate identical worlds.
- **Community challenges.** "Achieve lasting peace for 500 years" or "Prevent empire collapse using only cultural influence" -- player-defined goals within the cultivation model.

---

## Appendix A: Technical Summary

### Package Structure

```
packages/
  core/         ECS, simulation loop, time, events, LoD, spatial index,
                persistence, 10 simulation systems + influence + fingerprint
  generator/    Terrain, ecology, cosmology, races, names, pre-history
  renderer/     Terminal ASCII UI (blessed): 8 panels, 5 layouts, 30fps
  narrative/    Template engine (281 templates, 5 tones), chronicler, vignettes
  cli/          Entry point, controls, influence UI, save/load
```

### Test Coverage

2955 tests passing across 94 test files, covering:
- ECS operations and component stores
- All 10 simulation systems in isolation
- Event cascade engine and dampening
- Narrative template rendering and tone selection
- Chronicler bias filtering and lost history
- UI panels (rendering, click handling, navigation)
- Inspector prose generation and entity resolution
- Map overlays and compositing
- Timeline branching and snapshot management
- Influence system actions and believability checks

### Key Constants

| Parameter | Value |
|-----------|-------|
| Tick duration | 1 day |
| Days per year | 360 (12 months x 30 days) |
| Frequency tiers | 6 (1/7/30/90/365/3650) |
| Tick execution steps | 13 (immutable order) |
| LoD zones | Full (50 tiles), Reduced (200), Abstract (beyond) |
| Significance override | 85 |
| Max cascade depth | 10 |
| Dampening formula | `baseProbability x (1 - dampening)^depth` |
| Component types | 104 |
| Narrative templates | 281 across 11 files |
| Narrative tones | 5 |
| Influence actions | 17 |
| IP regeneration | 1 per simulation year |
| Inspector types | 6 (Character, Faction, Site, Artifact, Event, Region) |
| Map overlay layers | 6 (Settlements, Territory, Military, Trade, Magic, Markers) |
| Overlay presets | 7 (None, Political, Military, Economic, Arcane, Climate, Full) |
| Render target | 30fps |
| Speed modes | 7 (Paused through Ultra x3650) |
| Event categories | 10 (Political, Magical, Cultural, Religious, Scientific, Personal, Exploratory, Economic, Disaster, Military) |

---

## Appendix B: Simulation System Interactions

```
SYSTEM INTERACTION MAP
---------------------------------------------------------------

     Environment
         |
    [weather, resources]
         |
    Economy ---------> Military
    [supply, trade]    [armies, war]
         |                  |
         v                  v
    Politics <-----------> Military
    [stability, law]   [territory, reparations]
         |                  |
         v                  v
    Social             Character AI
    [reputation,       [decisions, goals,
     relationships]     personality]
         |                  |
         v                  v
    Cultural           Magic
    [technology,       [research, artifacts,
     art, philosophy]   catastrophes]
         |                  |
         v                  v
    Religion           Ecology
    [faith, schisms,   [fauna, flora,
     divine power]      resource cycles]
         |                  |
         +-------->---------+
                   |
              Event Resolution
              [cascade engine,
               significance scoring]
                   |
              Narrative Generation
              [templates, tones,
               chronicler filtering]

---------------------------------------------------------------

All arrows represent communication through the EVENT QUEUE
and SHARED COMPONENT STATE. Systems never reference each
other directly.
```

---

## Appendix C: The Cascade Chain Anatomy

A single event's lifecycle through the cascade engine:

```
CAUSE EVENT
  "Queen Ashara's ambassador insults King Theron at the banquet"
  Category: Political | Significance: 45
  Participants: [Ambassador, King Theron, Queen Ashara]
       |
       | [Consequence evaluation]
       |
  +----+----+----+
  |    |    |    |
  v    v    v    v

CONSEQUENCE 1                 CONSEQUENCE 2
"King Theron's grudge         "Diplomatic relations
 against Ashara deepens"       between kingdoms worsen"
 Category: Personal            Category: Political
 Sig: 35                       Sig: 50
 Depth: 1                      Depth: 1
 Prob: 95% (high pride)        Prob: 85%
       |                             |
       v                             v

CONSEQUENCE 1.1               CONSEQUENCE 2.1
"Theron recalls his            "Trade agreements
 ambassador from               suspended between
 Ashara's court"                the two kingdoms"
 Category: Political            Category: Economic
 Sig: 40                        Sig: 55
 Depth: 2                       Depth: 2
 Prob: 70% x (1-0.15)^1        Prob: 60% x (1-0.15)^1
     = 59.5%                       = 51%
       |                             |
       v                             v
      ...                    CONSEQUENCE 2.1.1
                              "Merchant city dependent on
                               this trade suffers economic
                               downturn"
                               Category: Economic -> Disaster
                               Sig: 48
                               Depth: 3
                               Prob: 45% x (1-0.15)^2
                                   = 32.5%
                                     |
                                     v
                                    ...
                              [Max depth 10, dampening
                               reduces probability at
                               each level]
```

---

## Appendix D: Glossary

| Term | Definition |
|------|------------|
| Branded ID | TypeScript type that combines a number with a phantom type brand, preventing accidental misuse at compile time |
| Cascade | A chain of events where each event's consequences trigger further events across potentially different domains |
| Chronicler | An in-world narrator character whose biases filter how events are presented to the player |
| Cultivation | The player interaction model: influencing the world through subtle nudges rather than direct commands |
| Dampening | The mathematical reduction of consequence probability at each depth level in a cascade chain |
| ECS | Entity-Component-System architecture: entities are IDs, data is in components, logic is in systems |
| Influence Point (IP) | The currency spent by the player to nudge world events |
| Level-of-Detail (LoD) | Simulation fidelity zones based on distance from the player's focus point |
| Significance | A 0-100 score assigned to each event, determining its narrative treatment depth and cascade potential |
| Tick | One simulation step, representing one day of in-world time |
| Vignette | A rare, intimate prose fragment (200-500 words) generated for the most significant simulation moments |
| World Fingerprint | A compact visual summary capturing a world's unique identity and historical character |

---

## Appendix E: Influence Action Integration Map

Every influence action maps to an existing EventCategory, producing events indistinguishable from natural simulation events:

```
INFLUENCE ACTION -> EVENT CATEGORY MAPPING
---------------------------------------------------------------

DIVINE INTERVENTIONS:
  InspireIdea         -> Personal    (character has an idea)
  PropheticDream      -> Religious   (divine vision)
  ArrangeMeeting      -> Personal    (chance encounter)
  PersonalityNudge    -> Personal    (character growth)
  RevealSecret        -> Personal    (information discovered)
  LuckModifier        -> Personal    (fortunate outcome)
  VisionOfFuture      -> Religious   (prophetic experience)
  EmpowerChampion     -> Religious   (divine blessing)

ENVIRONMENTAL INFLUENCE:
  AdjustWeather       -> Disaster    (weather event)
  MinorGeology        -> Disaster    (geological change)
  AnimalMigration     -> Disaster    (ecological shift)
  ResourceDiscovery   -> Economic    (resource found)
  TriggerNaturalEvent -> Disaster    (natural disaster)

CULTURAL INFLUENCE:
  PromoteArt          -> Cultural    (artistic movement)
  EncourageResearch   -> Scientific  (research direction)
  StrengthenTradition -> Cultural    (cultural shift)
  IntroduceForeignConcept -> Cultural (cross-cultural idea)

---------------------------------------------------------------

KEY PRINCIPLE: There is NO "Influence" event category.
All player actions produce events in existing categories,
preserving the illusion that everything happened naturally.

---------------------------------------------------------------
```

## Appendix F: Prose Lookup Tables

The inspector system uses several lookup tables to generate prose from raw data:

```
HEALTH_PROSE:
  perfect:   "is in the prime of health"
  healthy:   "bears no significant wounds"
  injured:   "nurses injuries from recent conflict"
  wounded:   "suffers from grievous wounds"
  critical:  "clings to life by a thread"
  dead:      "has passed beyond the veil"

PERSONALITY_AXIS (Big Five):
  openness:         ["traditional and set in their ways",
                     "endlessly curious and open to new ideas"]
  conscientiousness: ["free-spirited and spontaneous",
                      "methodical and disciplined"]
  extraversion:     ["reserved and introspective",
                     "gregarious and commanding"]
  agreeableness:    ["sharp-tongued and confrontational",
                     "gentle and accommodating"]
  neuroticism:      ["unnervingly calm under pressure",
                     "prone to anxiety and dark moods"]

  Values < 30 use left descriptor, > 70 use right, 30-70 moderate.

SETTLEMENT_SIZE_PROSE:
  Hamlet:      "A scattering of homes clustered together"
  Village:     "A modest village where everyone knows their neighbor"
  Town:        "A bustling town at the crossroads of trade"
  City:        "A city of consequence, its walls marking ambition"
  Large City:  "A great city whose name is known across the realm"
  Metropolis:  "A vast metropolis, teeming with life and intrigue"

MILITARY_STATE_PROSE:
  peaceful:    "The realm rests in quiet readiness"
  mobilizing:  "Drums beat and forges glow as armies gather"
  at_war:      "War consumes the nation's strength and spirit"
  victorious:  "The taste of victory lingers on every tongue"
  defeated:    "The sting of defeat weighs heavy on every heart"

ECONOMIC_STATE_PROSE:
  destitute:   "Poverty gnaws at the foundations of society"
  poor:        "The coffers run thin and the people feel it"
  modest:      "A comfortable but unremarkable prosperity"
  comfortable: "Trade flows freely and bellies are full"
  wealthy:     "Gold gleams in the treasury and on the streets"
  opulent:     "Wealth beyond measure, the envy of all nations"
```

## Appendix G: Development Phase History

```
COMPLETED PHASES
---------------------------------------------------------------

Phase 1-2: ECS Foundation + World Generation
  - ECS architecture (104 components, branded IDs)
  - World generation pipeline (6 phases)
  - Terrain, ecology, cosmology, races, names

Phase 3: Simulation Systems
  - 10 systems (Character AI, Memory/Reputation, Faction,
    Economic, Military, Magic, Religion, Cultural, Ecology,
    Secret Knowledge)
  - Event cascade engine
  - Cross-domain transitions

Phase 4: Terminal UI
  - blessed-based renderer (8 panels)
  - Map with terrain rendering
  - Event log with filtering
  - Entity inspector (data-dump style)

Phase 5: Narrative Engine
  - 281 templates across 11 category files
  - 5 narrative tones
  - Chronicler system with bias filtering
  - Vignette generator

Phase 6: Simulation Controls
  - 17 influence actions across 3 categories
  - IP economy (1 IP/year, capped pool)
  - Believability and resistance checks
  - Save/load UI

Phase 7: Extended Systems
  - World fingerprint / DNA system
  - Timeline branching (What-If snapshots)
  - Procedural heraldry (CoA generation + evolution)
  - Dreaming system
  - Character introspection

Phase 8: UX Overhaul (CURRENT - COMPLETE)
  - 8.1-8.2: Entity name resolution, world dashboard
  - 8.3-8.4: Click handling, context-sensitive status hints
  - 8.5-8.6: Auto-pause (sig 95+), welcome screen + warmup
  - 8.7: Narrative-first UI (prose events, region detail)
  - 8.8: UI redesign (blessed tag fixes, chronicle-first layout,
         clickable entity names)
  - Context View: 6 polymorphic inspectors, navigation system,
         universal click-to-inspect
  - Chronicle: 4 modes, event aggregation, region filtering,
         temporal headers, significance indicators
  - Map Overlays: 6 layers, 7 presets, territory flood-fill,
         trade route tracing, event-driven dirty tracking

TEST COVERAGE: 2955 tests across 94 files
  Phase 3:   531 tests
  Phase 4:   ~700 tests
  Phase 5:   ~900 tests
  Phase 6-7: ~1200 tests
  Phase 8:   2955 tests (457% increase from Phase 3)

---------------------------------------------------------------
```

## Appendix H: Color Palette Reference

```
TERMINAL UI COLOR PALETTE
---------------------------------------------------------------

Entity Names (clickable):     #88AAFF (blue)

Event Categories:
  Political:    #d4a832 (gold)
  Military:     #c44040 (red)
  Economic:     #3aad6a (green)
  Social:       #6888c8 (slate blue)
  Cultural:     #40b0c8 (teal)
  Religious:    #b87acc (purple)
  Magical:      #9040cc (deep purple)
  Personal:     #6088cc (blue)
  Disaster:     #cc6020 (orange)
  Exploratory:  #70c040 (lime)

Significance Levels:
  Trivial:      #666666 (dim gray)
  Minor:        #888888 (gray)
  Moderate:     #cccc44 (yellow)
  Major:        #FF8844 (orange)
  Critical:     #FF2222 (red)
  Legendary:    #FF00FF (magenta)

Relationships:
  Positive:     #44FF88 (green)
  Negative:     #FF4444 (red)
  Neutral:      #CCCC44 (yellow)

UI Elements:
  Section headers:   bold white
  Prose body:        #cccccc
  Dim/secondary:     #888888
  Background:        terminal default (black)

---------------------------------------------------------------
```

## Appendix I: Narrative Template Categories

The 281 narrative templates are organized across 11 category files, each covering a simulation domain. Every template exists in multiple tone variants (typically 3-5) to support the five narrative voices.

```
TEMPLATE CATEGORY INVENTORY
---------------------------------------------------------------

CHARACTER ACTIONS (66 templates, 22 subtypes x 3 tones)
  befriend, trade, craft_item, study_lore, pray, journey,
  experiment, steal, proselytize, research_spell, enchant_item,
  forage, flee, seek_healing, dream, betray, intimidate,
  show_mercy, negotiate_treaty, forge_alliance, rally_troops,
  plan_campaign

POLITICAL (21 templates, 7 subtypes x 3 tones)
  coronation, coup, diplomatic_crisis, reform,
  succession, treaty, war_declaration

MILITARY (27 templates, 9 subtypes x 3 tones)
  army_movement, battle, campaign, heroic_stand,
  recruitment, retreat, siege, surrender, default

PERSONAL (27 templates, 9 subtypes x 3 tones)
  achievement, betrayal, birth, death, feud,
  friendship, marriage, romance, default

RELIGIOUS (21 templates, 7 subtypes x 3 tones)
  conversion, divine_intervention, holy_war,
  miracle, prophet_emergence, schism, default

ECONOMIC (24 templates, 8 subtypes x 3 tones)
  boom, bust, famine, innovation, monopoly,
  resource_discovery, trade_route, default

DISASTER (21 templates, 7 subtypes x 3 tones)
  earthquake, ecological_collapse, flood,
  magical_blight, plague, volcanic_eruption, default

MAGICAL (24 templates, 8 subtypes x 3 tones)
  artifact_creation, ascension, catastrophe, discovery,
  duel, planar_rift, wild_magic, default

CULTURAL (18 templates, 6 subtypes x 3 tones)
  artistic_movement, language_change, oral_tradition,
  philosophy_school, technology_invention, default

ECOLOGICAL (18 templates, 6 subtypes x 3 tones)
  deforestation, dragon_territory, environmental_degradation,
  resource_depletion, species_extinction, default

SECRET (15 templates, 5 subtypes x 3 tones)
  conspiracy, identity, prophecy, revelation, default

---------------------------------------------------------------

Template Selection: NarrativeEngine selects based on
(eventCategory, eventSubtype, narrativeTone, significance).
Higher significance events use more elaborate templates.
Fallback chain: exact match -> subtype default -> category
default -> generic template.

---------------------------------------------------------------
```

---

## Appendix J: Character AI Decision Worked Example

A step-by-step walkthrough of the 6-phase Character AI pipeline for a concrete scenario.

```
SCENARIO: General Valdrik considers his next action.
---------------------------------------------------------------

CONTEXT:
  General Valdrik, age 52, Commander of the Iron Host
  Personality: Ambitious (0.85), Low Agreeableness (0.25),
               High Conscientiousness (0.80), Low Neuroticism (0.20)
  Traits: [Strategic Thinker, Veteran, Pride]
  Current Goal: Gain Power (primary), Serve Faction (secondary)
  Location: Capital of the Iron Confederacy
  Recent Event: The aging king has fallen ill (significance 60)
  Relationship: King Maegor (loyalty 45, declining)
               Queen Regent (hostility 30)
               General Kariss (rivalry 65)

---------------------------------------------------------------

PHASE 1: PERCEPTION
  Valdrik perceives:
  - King is gravely ill (from event queue)
  - Queen Regent is consolidating power (from faction state)
  - His rival Kariss has been promoted to Royal Guard (relationship)
  - Treasury is low from recent war (economy component)
  - His troops are loyal to HIM, not the crown (memory of
    campaign victories)
  - Rumors of a border incursion (may be distorted per memory)

PHASE 2: GOAL EVALUATION
  Goal priority reassessment:
  - Gain Power: ELEVATED (king's illness = opportunity)
  - Serve Faction: MAINTAINED but conflicting with power goal
  - Survive: NORMAL (no immediate danger)
  - Opportunistic: ELEVATED (political vacuum forming)

PHASE 3: ACTION GENERATION
  Available actions in royal court context:
  a) Rally troops for border defense (Military)
  b) Petition Queen Regent for expanded authority (Diplomacy)
  c) Secretly recruit allies among disloyal nobles (Social)
  d) Challenge rival Kariss publicly (Social/Military)
  e) Write to provincial governors for support (Political)
  f) Wait and observe (Passive)

PHASE 4: SCORING

  Action (a) Rally troops:
    personality_alignment  = 0.50 x 0.30 = 0.150  (duty, not ambition)
    goal_advancement       = 0.30 x 0.30 = 0.090  (indirect power gain)
    relationship_impact    = 0.40 x 0.15 = 0.060  (shows loyalty)
    risk_assessment        = 0.90 x 0.10 = 0.090  (very safe)
    opportunity_value      = 0.20 x 0.10 = 0.020  (low)
    cultural_conformity    = 0.70 x 0.05 = 0.035  (expected behavior)
    random_factor          = 0.12 x 0.15 = 0.018  (low impulsiveness)
    TOTAL:                                  0.463

  Action (c) Secretly recruit allies:
    personality_alignment  = 0.85 x 0.30 = 0.255  (ambitious)
    goal_advancement       = 0.80 x 0.30 = 0.240  (directly advances power)
    relationship_impact    = 0.30 x 0.15 = 0.045  (risky to friendships)
    risk_assessment        = 0.40 x 0.10 = 0.040  (dangerous if caught)
    opportunity_value      = 0.85 x 0.10 = 0.085  (king ill = ideal timing)
    cultural_conformity    = 0.20 x 0.05 = 0.010  (treasonous)
    random_factor          = 0.45 x 0.15 = 0.068  (low impulsiveness)
    TOTAL:                                  0.743  ** HIGHEST **

  Action (e) Write to governors:
    personality_alignment  = 0.75 x 0.30 = 0.225
    goal_advancement       = 0.60 x 0.30 = 0.180
    relationship_impact    = 0.50 x 0.15 = 0.075
    risk_assessment        = 0.60 x 0.10 = 0.060
    opportunity_value      = 0.65 x 0.10 = 0.065
    cultural_conformity    = 0.50 x 0.05 = 0.025
    random_factor          = 0.30 x 0.15 = 0.045
    TOTAL:                                  0.675

PHASE 5: EXECUTION
  Valdrik chooses (c): secretly recruit allies.
  Event generated: "General Valdrik quietly meets with
  disaffected nobles to discuss the kingdom's future"
  Category: Personal (covert political action)
  Significance: 40 (secret -- low visibility)
  Tagged as: covert (invisible to chronicle until discovered)

  Skill check: Strategy (high) + Diplomacy (moderate)
  Result: Partial success -- two of three nobles agree.
  The third is undecided (and might inform the queen).

PHASE 6: REFLECTION
  Valdrik evaluates:
  - Goal "Gain Power" reinforced (partial success)
  - New risk: the undecided noble could expose him
  - Strategy adjustment: next action should neutralize risk
    (befriend, bribe, or intimidate the undecided noble)
  - Memory formed: "I began to build my circle of support"
    (emotional weight: +40, significance: 50)

---------------------------------------------------------------

CONSEQUENCE CASCADE (from this single action):
  -> Noble 3 is suspicious (Personal, sig 25, depth 1)
     -> Noble 3 whispers to Queen Regent (Political, sig 35, depth 2)
        -> Queen Regent orders surveillance (Political, sig 40, depth 3)
           -> Spy discovers meeting (Personal, sig 55, depth 4)
              -> Queen confronts Valdrik (Political, sig 65, depth 5)
                 -> Valdrik denies, plans accelerate (Personal, sig 50, depth 6)

...and a coup attempt might follow, or Valdrik might be arrested,
or the king might recover and render all of this moot. The
simulation does not know which path unfolds until it happens.

---------------------------------------------------------------
```

---

*This document reflects the state of Aetherum at the completion of Phase 8 (UX Overhaul). All systems described in Sections 3-12 are implemented and tested. The UI described in Section 13 is fully functional. Section 19 describes planned future work. The document supersedes the original `game_draft.md` and incorporates all architectural decisions made during development.*
