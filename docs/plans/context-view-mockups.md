# Context View: ASCII Mockups

All mockups assume a panel width of ~60 characters (standard layout).
The `|` characters on left and right represent the blessed box border.
Content between borders is the actual rendered output.

---

## 1. Character Inspector

### Full Layout (3 sections expanded)

```
+-- @ CHARACTER ------------------------------------------+
|  Thorin Ironhand, the Unyielding                       |
|  Warlord of the Iron Confederacy  |  Year 247, Age 63  |
|  < Back   [World] > Iron Conf. > Thorin   Forward >    |
|==========================================================|
|                                                          |
|  v [1] The Story So Far                     12 events    |
|      Born in Year 184 to Durin the Steadfast, Thorin's   |
|      youth was forged in the fires of the War of Broken  |
|      Passes. His father's death at the hands of orcish   |
|      raiders set him on a path of vengeance that would   |
|      reshape the northern frontier.                      |
|                                                          |
|      In Year 206, he rallied the scattered clans of the  |
|      Iron Hills and founded the Iron Confederacy. His    |
|      betrayal by Azog the Pale in Year 231 became a      |
|      turning point -- from that day forward, Thorin       |
|      trusted no one beyond his inner circle.              |
|                                                          |
|      Key moments:                                        |
|        ! Y206 Founded the Iron Confederacy               |
|        ! Y231 Betrayed by Azog the Pale                  |
|        ! Y245 Led the Siege of Erebor                    |
|                                                          |
|      (12 events -- press 't' for full timeline)          |
|                                                          |
|  v [2] Strengths & Flaws                     Cunning     |
|      A mind as sharp as forged steel -- Thorin's         |
|      intelligence and wisdom far exceed his physical     |
|      gifts. Though no great warrior in raw strength,     |
|      his tactical cunning has won more battles than      |
|      any blade.                                          |
|                                                          |
|      He is deeply conscientious and driven, but his      |
|      low agreeableness makes him a difficult ally.       |
|                                                          |
|      STR [=====-----------] 5   INT [===============-] 16|
|      AGI [========--------] 8   WIS [=============--] 14 |
|      END [==========------] 10  CHA [========-------] 9  |
|                                                          |
|      Traits:  Cunning  |  Stubborn  |  Ambitious         |
|                                                          |
|  v [3] Bonds & Rivalries                  8 relations    |
|      Thorin's world is defined by fierce loyalties       |
|      and bitter enmities.                                |
|                                                          |
|      ALLIES:                                             |
|        & Iron Confederacy ....... Warlord (leader) [+92] |
|        @ Balin Broadshield ...... Trusted Advisor  [+82] |
|        @ Dwalin the Fierce ...... Shield-Brother   [+91] |
|                                                          |
|      RIVALS:                                             |
|        @ Azog the Pale .......... Blood Enemy      [-95] |
|        & Goblin Horde ........... At War           [-88] |
|                                                          |
|      FAMILY:                                             |
|        @ Dis Ironhand ........... Sister            [+74] |
|        @ Fili ................... Nephew            [+68] |
|                                                          |
|      2 grudges burn in his memory:                       |
|        Azog slew his father (severity: 95)               |
|        The Elvenking refused aid (severity: 72)          |
|                                                          |
|  > [4] Worldly Standing                      Warlord     |
|  > [5] Heart & Mind                   Reclaim Erebor     |
|  > [6] Remembered Things                  14 memories    |
|  > [7] Possessions & Treasures            3,400 gold     |
|                                                          |
|----------------------------------------------------------|
|  [1-7] Sections  [Bksp] Back  [t] Timeline  [g] Locate  |
+----------------------------------------------------------+
```

### Annotated Color Zones

```
Line 0:  #88AAFF + bold    "@ CHARACTER"    #666666  "-----..."
Line 1:  bold              "Thorin Ironhand, the Unyielding"
Line 2:  #aaaaaa           one-liner        #888888  temporal
Line 3:  #888888/#cccccc   back/forward     #88AAFF  breadcrumbs
Line 4:  #555555           "====..."

Section headers:
  bold "v"/#888888 "[1]"/bold "title"          #888888 "hint"

Prose body:
  #cccccc for normal text
  #88AAFF for entity names (clickable)

Data rows:
  #88AAFF icon+name / #444444 dots / #cccccc label / #44FF88 affinity

Footer:
  #444444 divider
  #cccccc keys / #888888 actions
```

---

## 2. Faction Inspector

### Full Layout (2 sections expanded)

```
+-- & FACTION --------------------------------------------+
|  The Iron Confederacy                                    |
|  Meritocratic Oligarchy  |  Est. Year 89 (158 years)    |
|  < Back   [World] > Iron Confederacy       Forward >     |
|==========================================================|
|                                                          |
|  v [1] Rise & Reign                     158 years old    |
|      Forged in Year 89 by Durin the Steadfast, who       |
|      united the squabbling mountain clans through a      |
|      combination of military prowess and political       |
|      cunning. Founded at the stronghold of Kazad-dum,    |
|      the Confederacy has grown from a defensive pact     |
|      into the dominant power of the northern mountains.  |
|                                                          |
|      Under Thorin Ironhand's current leadership, the     |
|      Confederacy has entered an aggressive phase of      |
|      expansion.                                          |
|                                                          |
|      Government: Meritocratic Oligarchy                  |
|      Stability:  [=============------] 72%               |
|      Legitimacy: [===========--------] 61%               |
|                                                          |
|  v [2] Court & Council               Thorin Ironhand     |
|      @ Thorin Ironhand ........... Warlord (Leader)      |
|      @ Balin Broadshield ......... Grand Advisor         |
|      @ Dain Ironfoot ............. War Marshal            |
|      @ Ori the Scribe ............ Lorekeeper            |
|      @ Bombur the Wide ........... Master of Coin        |
|                                                          |
|      And 47 other members of note.                       |
|                                                          |
|  > [3] Banner & Creed                      [Shield]      |
|  > [4] Lands & Holdings                   12 regions     |
|  > [5] Swords & Shields                 12,000 strong    |
|  > [6] Alliances & Enmities              5 relations     |
|  > [7] Coffers & Commerce               14,200 gold      |
|  > [8] Chronicles                         34 events      |
|                                                          |
|----------------------------------------------------------|
|  [1-8] Sections  [Bksp] Back  [h] Heraldry  [g] Capital |
+----------------------------------------------------------+
```

### Faction with Banner Section Expanded

```
|  v [3] Banner & Creed                      [Shield]      |
|                                                          |
|               /\                                         |
|              /  \                                        |
|             / ** \                                       |
|            / *  * \                                      |
|           /========\                                     |
|           |  IRON  |                                     |
|           | HAMMER |                                     |
|           |________|                                     |
|                                                          |
|      "Azure, a hammer argent between two stars or"       |
|                                                          |
|      The Iron Confederacy values strength, industry,     |
|      and loyalty above all else. Their martial           |
|      traditions demand every citizen serve at least      |
|      two years in the shield-wall.                       |
|                                                          |
|      Guiding Principles:                                 |
|        * Industrious   * Militaristic   * Isolationist   |
```

### Faction with Alliances Expanded

```
|  v [6] Alliances & Enmities              5 relations     |
|      ALLIES:                                             |
|        & Kingdom of Dale .......... Allied    [+82]      |
|        & Woodland Traders ......... Friendly  [+54]      |
|                                                          |
|      ENEMIES:                                            |
|        & Goblin Horde ............. At War    [-95]      |
|        & Dark Sorcerer's Domain ... Hostile   [-72]      |
|                                                          |
|      NEUTRAL:                                            |
|        & Elvenking's Realm ........ Wary      [-15]      |
|                                                          |
|      Treaties:                                           |
|        * Trade pact with Kingdom of Dale (est. Y220)     |
|        * Non-aggression pact with Traders (est. Y238)    |
```

---

## 3. Event Inspector

### Full Layout (narrative view)

```
+-- ! EVENT ----------------------------------------------+
|  The Betrayal at Dimholt Pass                            |
|  Military  |  Year 231, Spring  |  * Critical (85)      |
|  < Back   [World] > Iron Conf. > Thorin > [Betrayal]    |
|==========================================================|
|                                                          |
|  v [1] What Happened                                     |
|      -- The Betrayal at Dimholt Pass --                  |
|                                                          |
|      In the spring of Year 231, as the armies of the     |
|      Iron Confederacy marched through the narrow defiles |
|      of Dimholt Pass, Azog the Pale -- until that moment |
|      a trusted war-captain serving under Thorin's banner |
|      -- turned his forces against his own allies.        |
|                                                          |
|      The ambush was devastating. Caught between the      |
|      canyon walls and Azog's rearguard, nearly a thousand|
|      Confederate soldiers fell before Thorin managed to  |
|      rally a fighting retreat. The pass was lost, and    |
|      with it, three years of hard-won territorial gains. |
|                                                          |
|      This event was chronicled differently by sources:   |
|        * Confederate annals: "The Great Treachery"       |
|        * Azog's followers: "The Reckoning"               |
|        * Neutral scholars: "The Dimholt Incident"        |
|                                                          |
|  v [2] Who Was Involved                 4 participants   |
|      PRIMARY:                                            |
|        @ Thorin Ironhand ........ Victim / Commander     |
|        @ Azog the Pale .......... Betrayer               |
|                                                          |
|      SECONDARY:                                          |
|        & Iron Confederacy ....... Faction affected       |
|        # Dimholt Pass ........... Location               |
|                                                          |
|  v [3] Where & When                                      |
|      Location: # Dimholt Pass (Mountain region)          |
|      Date: Year 231, Month 4, Day 12 (Spring)           |
|      Coordinates: (34, 67)                               |
|      Region: ~ The Northern Marches                      |
|                                                          |
|      [g] Center map on this location                     |
|                                                          |
|  > [4] Why It Matters                    Critical (85)   |
|  > [5] What Came Before                      2 causes    |
|  > [6] What Followed                   7 consequences    |
|                                                          |
|----------------------------------------------------------|
|  [1-6] Sections  [Bksp] Back  [c] Cascade  [v] Story    |
+----------------------------------------------------------+
```

### Event with Cascade Expanded

```
|  v [5] What Came Before                      2 causes    |
|      This event grew from earlier seeds:                 |
|                                                          |
|        ! Y228 Azog pledged loyalty to Thorin             |
|          (3 years before the betrayal)                   |
|        ! Y230 Azog's clan was denied mining rights       |
|          (1 year before -- the proximate cause)          |
|                                                          |
|      Cascade depth: 2                                    |
|                                                          |
|  v [6] What Followed                   7 consequences    |
|      The ripples of this event spread far:               |
|                                                          |
|        ! Y231 Thorin declared war on Azog                |
|          (immediate consequence)                         |
|        ! Y231 The Iron Confederacy recalled its armies   |
|          (within the same year)                          |
|        ! Y232 Dwalin led a punitive expedition           |
|        ... and 4 more consequences                       |
|                                                          |
|      Total cascade depth: 4                              |
```

### Event: Significance Section Expanded

```
|  v [4] Why It Matters                    Critical (85)   |
|      Significance: [================----] Critical (85)  |
|                                                          |
|      This event was one of the most consequential in     |
|      the region's recent history. It triggered a cascade |
|      of 7 subsequent events, reshaping political         |
|      boundaries and igniting a war that would last for   |
|      fourteen years.                                     |
|                                                          |
|      Historical impact:                                  |
|        * Ended the Iron Confederacy's eastern expansion  |
|        * Created the Azog-Thorin blood feud (ongoing)    |
|        * Shifted power toward the Goblin Horde           |
```

---

## 4. Region Inspector

### Full Layout (geography-focused)

```
+-- ~ REGION ---------------------------------------------+
|  The Northern Marches (34, 67)                           |
|  Mountain  |  Iron Confederacy territory                 |
|  < Back   [World] > Iron Conf. > Northern Marches        |
|==========================================================|
|                                                          |
|  v [1] The Land Itself                       Mountain    |
|      Rocky slopes rise above the tree line, wind-scoured |
|      and stern. Stone and sky meet in a jagged embrace,  |
|      and the air thins with every step upward.           |
|                                                          |
|      Conditions:                                         |
|        ^ Lofty heights command a sweeping view           |
|        * The climate is temperate and mild               |
|        ~ Seasonal rains come and go                      |
|                                                          |
|      A river winds through this region, carving deep     |
|      gorges in the ancient rock.                         |
|                                                          |
|  v [2] Riches of the Earth                 4 resources   |
|      The mountains yield their treasures reluctantly:    |
|                                                          |
|        * Veins of iron ore run through the rock          |
|        * Precious gold glints in the earth               |
|        * Quarryable stone lies close to the surface      |
|        * Rare gemstones lie hidden in the deep places    |
|                                                          |
|      Those who control this land grow wealthy on its     |
|      bounty.                                             |
|                                                          |
|  > [3] Those Who Dwell Here        Iron Confederacy      |
|  > [4] Marks Upon the Land            2 settlements      |
|  > [5] Echoes of the Past                 6 events       |
|  > [6] Arcane Currents              Ley Line Active      |
|                                                          |
|----------------------------------------------------------|
|  [1-6] Sections  [Bksp] Back  [g] Center map             |
+----------------------------------------------------------+
```

### Region with Inhabitants Expanded

```
|  v [3] Those Who Dwell Here        Iron Confederacy      |
|      This land falls under the dominion of the Iron      |
|      Confederacy.                                        |
|                                                          |
|      Controlling Faction:                                |
|        & Iron Confederacy .............. Dominant         |
|                                                          |
|      Other Factions Present:                             |
|        & Goblin Raiding Parties ........ Contested        |
|                                                          |
|      Notable Inhabitants:                                |
|        @ Dwalin the Fierce ............. Patrol           |
```

### Region with History Expanded

```
|  v [5] Echoes of the Past                 6 events       |
|      History has left its scars on this land:            |
|                                                          |
|        ! Y231 The Betrayal at Dimholt Pass               |
|        ! Y220 Discovery of the Gold Vein                 |
|        ! Y195 The Battle of Stone Ridge                  |
|                                                          |
|      And 3 more events in this region's history.         |
```

### Region with Arcane Currents Expanded

```
|  v [6] Arcane Currents              Ley Line Active      |
|      A ley line pulses with arcane energy beneath the    |
|      earth. The concentration of magical power here has  |
|      attracted scholars and sorcerers throughout the     |
|      ages.                                               |
|                                                          |
|      Recent magical events in this region:               |
|        ! Y240 Arcane surge detected                      |
```

---

## 5. Site Inspector

### Full Layout (settlement view)

```
+-- # SITE -----------------------------------------------+
|  Ironhold                                                |
|  Capital City  |  Pop. 24,000  |  Founded Year 34       |
|  < Back   [World] > Iron Conf. > Ironhold   Forward >    |
|==========================================================|
|                                                          |
|  v [1] A Living Portrait                         City    |
|      Ironhold rises from the living rock like a crown    |
|      of stone and iron. Founded in Year 34 by the first  |
|      dwarven settlers, it has grown from a modest mining |
|      camp into the beating heart of the Iron Confederacy.|
|      Its forges never sleep, and the ring of hammer on   |
|      anvil echoes through streets carved into the        |
|      mountainside.                                       |
|                                                          |
|      Population: 24,000 (City)                           |
|      Growth: +1.2% per year                              |
|      Founded: Year 34 (213 years ago)                    |
|      Ruling Faction: Iron Confederacy                    |
|                                                          |
|  v [2] People & Peoples                   24,000 souls   |
|      The people of Ironhold are predominantly dwarven,   |
|      though a growing community of human traders has     |
|      established a quarter near the western gate.        |
|                                                          |
|      Population by Race:                                 |
|        Dwarven ............... 82%  [================--]  |
|        Human ................. 14%  [===                ]  |
|        Halfling .............. 4%   [=                  ]  |
|                                                          |
|      Cultural Values: Industrious | Martial | Traditional|
|                                                          |
|  > [3] Power & Governance            Thorin Ironhand     |
|  > [4] Trade & Industry                   Prosperous     |
|  > [5] Walls & Works                 Fortified Walls     |
|  > [6] Notable Souls                   8 characters      |
|  > [7] The Annals                        28 events       |
|                                                          |
|----------------------------------------------------------|
|  [1-7] Sections  [Bksp] Back  [g] Center map  [p] Pop.  |
+----------------------------------------------------------+
```

### Site with Power Section Expanded

```
|  v [3] Power & Governance            Thorin Ironhand     |
|      Ironhold is governed as part of the Iron            |
|      Confederacy, with Thorin Ironhand ruling from       |
|      the Hall of Ancestors.                              |
|                                                          |
|      Government: Meritocratic Oligarchy                  |
|      Stability:  [=============------] 72%               |
|      Legitimacy: [===========--------] 61%               |
|      Claim Strength: [================--] 85%            |
|                                                          |
|      Ruling Faction: & Iron Confederacy                  |
|      Local Governor: @ Balin Broadshield                 |
```

### Site with Trade Section Expanded

```
|  v [4] Trade & Industry                   Prosperous     |
|      Ironhold's forges produce the finest iron and       |
|      steel in the northern mountains. Its wealth is      |
|      built on mining and metalwork.                      |
|                                                          |
|      Treasury: 14,200 gold                               |
|      Trade Volume: 8,500 per season                      |
|                                                          |
|      Industries:                                         |
|        * Iron Mining (primary)                           |
|        * Metalworking (primary)                          |
|        * Gemstone Trading (secondary)                    |
|                                                          |
|      Resources:                                          |
|        Iron: abundant   Gold: moderate   Gems: scarce    |
```

### Site with Notable Souls Expanded

```
|  v [6] Notable Souls                   8 characters      |
|      Several figures of consequence reside in or near    |
|      Ironhold:                                           |
|                                                          |
|        @ Thorin Ironhand ........... Warlord             |
|        @ Balin Broadshield ......... Grand Advisor       |
|        @ Dwalin the Fierce ......... War Marshal         |
|        @ Ori the Scribe ............ Lorekeeper          |
|                                                          |
|      And 4 others of lesser renown.                      |
```

### Site with Annals Expanded

```
|  v [7] The Annals                        28 events       |
|      Founded: Year 34                                    |
|                                                          |
|      Defining moments:                                   |
|        ! Y34  The First Stone was laid                   |
|        ! Y89  Became capital of the Confederacy          |
|        ! Y175 The Great Fire razed the western quarter   |
|        ! Y231 Refugees arrived from the betrayal         |
|                                                          |
|      And 24 more recorded events.                        |
```

---

## 6. Empty State (World Dashboard)

When no entity is selected, the inspector shows the World Dashboard.

```
+-- WORLD PULSE -----------------------------------------+
|                                                        |
|  This is an age where skirmishes flare across          |
|  frontiers, and faith moves multitudes to action.      |
|  Meanwhile, knowledge gathers dust in neglected halls. |
|                                                        |
|  --- GREAT POWERS ------------------------------------ |
|    & Iron Confederacy -- 45,000 souls                  |
|    & Elvenking's Realm -- 32,000 souls                 |
|    & Goblin Horde -- 18,000 souls                      |
|    & Kingdom of Dale -- 12,000 souls                   |
|                                                        |
|  --- WINDS OF CONFLICT ------------------------------- |
|    * Drums of war sound across borders                 |
|    * Ambition challenges the throne                    |
|    * Trust shatters like glass                         |
|                                                        |
|  --- RECENT TIDINGS ---------------------------------- |
|    * Steel clashes upon the field                      |
|    * A new technology was invented                     |
|    * New bonds of friendship are forged                |
|                                                        |
|  Click any entity on the map or in the event log       |
|  to begin exploring the world.                         |
+--------------------------------------------------------+
```

### Annotated Colors

```
Title:  bold + #cccccc    "WORLD PULSE"
Prose:  #aaaaaa           synthesized paragraph
Dividers: bold + #cccccc  "--- GREAT POWERS ---..."
Faction names: #88AAFF    clickable
Soul counts: #888888      dim
Tension items: #cccccc    prose
Event items: significance-colored prefix + #cccccc prose
Hint text: #888888        dim
```

---

## 7. Entity Not Found

```
+-- ? UNKNOWN -------------------------------------------+
|                                                        |
|  This entity has passed beyond the reach of            |
|  chronicles.                                           |
|                                                        |
|  Entity #247 is no longer present in the world.        |
|  It may have been destroyed, dissolved, or lost to     |
|  the passage of time.                                  |
|                                                        |
|  [Bksp] Return to previous view                       |
+--------------------------------------------------------+
```

---

## 8. Responsive Width Demonstrations

### Minimum Width (40 chars)

```
+-- @ CHARACTER ----------------------+
|  Thorin Ironhand, the Un...        |
|  Warlord...  |  Y247, Age 63      |
|  < Back  [World] > Thorin          |
|======================================|
|                                      |
|  v [1] The Story So Far  12 events   |
|      Born in Year 184 to            |
|      Durin the Steadfast...         |
|                                      |
|      Key moments:                    |
|        ! Y206 Founded the Ir...     |
|        ! Y231 Betrayed by Az...     |
|                                      |
|  > [2] Strengths       Cunning      |
|  > [3] Bonds           8 rels       |
|  > [4] Standing        Warlord      |
|                                      |
|--------------------------------------|
|  [1-4] Sects  [Bksp] Back           |
+--------------------------------------+
```

### Wide Width (80+ chars)

```
+-- @ CHARACTER ----------------------------------------------------------------+
|  Thorin Ironhand, the Unyielding                                             |
|  Warlord of the Iron Confederacy                         |  Year 247, Age 63 |
|  < Back   [World] > Iron Confederacy > Thorin Ironhand          Forward >     |
|================================================================================|
|                                                                                |
|  v [1] The Story So Far                                             12 events  |
|      Born in the mountain-hold of Kazad-dum in Year 184, Thorin was the son    |
|      of Durin the Steadfast and Helga Stonesinger. His early years were shaped |
|      by the War of Broken Passes, which claimed his father's life when Thorin  |
|      was only fourteen.                                                        |
|                                                                                |
|      In Year 206, he rallied the scattered clans of the Iron Hills and founded |
|      the Iron Confederacy, a feat that earned him the title "the Unyielding."  |
|                                                                                |
|      Key moments:                                                              |
|        ! Y206 Founded the Iron Confederacy                                     |
|        ! Y231 Betrayed by Azog the Pale                                        |
|        ! Y245 Led the Siege of Erebor                                          |
|                                                                                |
|      (12 events total -- press 't' for full timeline)                          |
|                                                                                |
|  v [2] Strengths & Flaws                                              Cunning  |
|      A mind as sharp as forged steel -- Thorin's intelligence and wisdom far   |
|      exceed his physical gifts. Though no great warrior in raw strength, his   |
|      tactical cunning has won more battles than any blade.                     |
|                                                                                |
|      STR [=====-----------] 5      INT [===============----] 16                |
|      AGI [========--------] 8      WIS [=============------] 14                |
|      END [==========------] 10     CHA [========-----------] 9                 |
|                                                                                |
|      Traits:  Cunning  |  Stubborn  |  Ambitious  |  Vengeful                  |
|                                                                                |
|  > [3] Bonds & Rivalries                                          8 relations  |
|  > [4] Worldly Standing                                           Warlord      |
|  > [5] Heart & Mind                                        Reclaim Erebor      |
|  > [6] Remembered Things                                       14 memories     |
|  > [7] Possessions & Treasures                                 3,400 gold      |
|                                                                                |
|--------------------------------------------------------------------------------|
|  [1-7] Sections  [Bksp] Back  [t] Timeline  [g] Location  [b] Bookmark        |
+--------------------------------------------------------------------------------+
```

---

## 9. Navigation Breadcrumb Variations

### Root Level (World Dashboard -> Faction)
```
  < Back   [World] > Iron Confederacy            Forward >
```

### Two Levels Deep
```
  < Back   [World] > Iron Conf. > Thorin         Forward >
```

### Three Levels Deep
```
  < Back   [World] > Iron Conf. > Thorin > [Betrayal]
```

### Four Levels Deep (max)
```
  < Back   ... > Iron Conf... > Thorin > [Betrayal]
```

### Forward Available
```
  < Back   [World] > Iron Conf. > Thorin         Forward >
```

### At End of History (no forward)
```
  < Back   [World] > Iron Conf. > Thorin
```

### At Start of History (no back)
```
           [World] > Iron Conf. > Thorin         Forward >
```

---

## 10. Section State Transitions

### Expanding Section 3 (Bonds & Rivalries)

**Before (collapsed):**
```
|  > [3] Bonds & Rivalries                  8 relations    |
|  > [4] Worldly Standing                      Warlord     |
```

**After (expanded):**
```
|  v [3] Bonds & Rivalries                  8 relations    |
|      Thorin's world is defined by fierce loyalties       |
|      and bitter enmities.                                |
|                                                          |
|      ALLIES:                                             |
|        & Iron Confederacy ....... Warlord (leader) [+92] |
|        @ Balin Broadshield ...... Trusted Advisor  [+82] |
|                                                          |
|      RIVALS:                                             |
|        @ Azog the Pale .......... Blood Enemy      [-95] |
|                                                          |
|  > [4] Worldly Standing                      Warlord     |
```

### Collapsing Section 1 (The Story So Far)

**Before (expanded, taking many lines):**
```
|  v [1] The Story So Far                     12 events    |
|      Born in Year 184 to Durin the Steadfast...          |
|      ... (many lines of prose) ...                       |
|      (12 events -- press 't' for full timeline)          |
|                                                          |
|  v [2] Strengths & Flaws                     Cunning     |
```

**After (collapsed to single line):**
```
|  > [1] The Story So Far                     12 events    |
|  v [2] Strengths & Flaws                     Cunning     |
|      A mind as sharp as forged steel...                  |
```

---

## 11. Clickable Entity Highlighting

### Entity Names in Prose

In the rendered output, entity names appear in a distinct color
(#88AAFF) against the normal prose text (#cccccc). Here the
underscores represent the clickable region:

```
|      Born in Year 184 to Durin the Steadfast, Thorin's   |
|                         ^^^^^^^^^^^^^^^^^^^              |
|                         clickable (#88AAFF)              |
```

### Entity Names in Data Rows

```
|        @ Balin Broadshield ...... Trusted Advisor  [+82] |
|        ^ ^^^^^^^^^^^^^^^^                                |
|        |  clickable (#88AAFF)                            |
|        icon (#88AAFF)                                    |
```

### Entity Names in Breadcrumbs

```
|  < Back   [World] > Iron Conf. > Thorin   Forward >      |
|            ^^^^^^   ^^^^^^^^^^   ^^^^^^                  |
|            click     click        current (bold)         |
```

### Multiple Clickable Names on One Line

```
|      The war between Thorin and Azog the Pale reshaped   |
|                      ^^^^^^     ^^^^^^^^^^^^^            |
|                      click1     click2                   |
```

---

## 12. Visual Comparison: Before vs After

### BEFORE (Current Inspector)

```
+----- Inspector -----+
| * Entity #17        |
| Mode: [O]  R   T  D |
| ----------           |
| > [1] Overview       |
|   Name: Thorin       |
|   ID: #17            |
|   Class: Noble       |
|   Health: 80/100     |
|     (80%)            |
|   Faction: #42       |
|     (Warlord)        |
| > [2] Attributes     |
|   STR: ████░░░ 5    |
|   AGI: ██████░ 8    |
|   ...                |
| > [3] Personality    |
|   Big Five:          |
|   Open: ████░░ 50   |
|   ...                |
| > [4] Goals          |
| > [5] Relationships  |
|   Relations:         |
|   #12: ally [+82]   |
|   #45: enemy [-95]  |
|   Grudges:           |
|   #45: betrayal (78)|
+----------------------+
```

### AFTER (Context View Inspector)

```
+-- @ CHARACTER --------------------------------+
|  Thorin Ironhand, the Unyielding             |
|  Warlord of the Iron Confederacy  |  Y247    |
|  < Back  [World] > Thorin       Forward >     |
|================================================|
|                                                |
|  v [1] The Story So Far          12 events     |
|      Born in Year 184 to Durin the Steadfast,  |
|      Thorin's youth was forged in the fires    |
|      of the War of Broken Passes...            |
|                                                |
|      Key moments:                              |
|        ! Y206 Founded Iron Confederacy         |
|        ! Y231 Betrayed by Azog the Pale        |
|                                                |
|  v [2] Strengths & Flaws          Cunning      |
|      A mind as sharp as forged steel...        |
|                                                |
|      STR [=====---------]  INT [===========-]  |
|      Traits: Cunning | Stubborn | Ambitious    |
|                                                |
|  > [3] Bonds & Rivalries        8 relations    |
|  > [4] Worldly Standing           Warlord      |
|  > [5] Heart & Mind        Reclaim Erebor      |
|  > [6] Remembered Things      14 memories      |
|  > [7] Possessions            3,400 gold       |
|                                                |
|------------------------------------------------|
|  [1-7] Sections [Bksp] Back [g] Locate         |
+------------------------------------------------+
```

**Key improvements visible in the comparison:**
- Entity names resolved (Thorin, not #17)
- Prose-first presentation (narrative paragraph, not data dump)
- Clickable entity names in blue (#88AAFF)
- Breadcrumb navigation (wiki-style exploration)
- Summary hints on collapsed sections
- Consistent chrome (header, divider, footer)
- Atmospheric section titles (not "Attributes" but "Strengths & Flaws")
- Timeline events as clickable narrative entries
- Relationship categories with dotted leaders
- Footer with context-sensitive keyboard hints
