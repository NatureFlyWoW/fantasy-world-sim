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
