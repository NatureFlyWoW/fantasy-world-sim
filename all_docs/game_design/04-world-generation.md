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
