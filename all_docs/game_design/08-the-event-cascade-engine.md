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
