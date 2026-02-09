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
