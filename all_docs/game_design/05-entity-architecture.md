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
