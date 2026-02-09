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
