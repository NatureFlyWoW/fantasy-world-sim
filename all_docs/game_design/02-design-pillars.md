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
