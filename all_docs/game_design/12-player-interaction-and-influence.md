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
