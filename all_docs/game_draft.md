\# Fantasy World Simulator — Refined Game De-



\# sign Document



```

Version 2.0 — Comprehensive Design Specification Project Code-

name: Æternum

```

\## Table of Contents



```

1.Vision \& Core Philosophy

2.The Simulation Loop

3.World Generation Pipeline

4.Entity Architecture

5.Simulation Systems — Deep Design

6.Character Memory \& Reputation System

7.Event Interconnection Engine

8.The Narrative Engine

9.Micro-Narrative Vignettes

10.The Unreliable Chronicler

11.User Interface Design

12.Player Interaction \& Influence

13.World DNA / Fingerprint System

14.“What If” Timeline Branching

15.Procedural Heraldry \& Symbolism

16.Export \& Documentation System

17.Performance Architecture

18.Extended Design Concepts

```

\## 1. Vision \& Core Philosophy



```

1.1 What This Is

```

The Fantasy World Simulator is a procedural narrative engine that generates

living fantasy worlds and simulates their evolution across centuries. Think of

it as a \*\*digital terrarium for civilizations\*\* — the player seeds a world with

initial conditions, then observes as thousands of interconnected systems produce

emergent stories that no human author scripted.



The closest existing reference point is Dwarf Fortress’s Legends Mode, but this

project diverges in several critical ways. Where Dwarf Fortress treats history

generation as a preamble to fortress gameplay, this simulator treats the history

itself as the primary content. Where Dwarf Fortress presents events as database

entries, this simulator transforms them into literary prose. And where Dwarf

Fortress gives the player no agency over unfolding history, this simulator intro-





```

duces a carefully constrained “cultivation” mechanic that lets the player nudge

events without controlling them.

```

The result is a system that produces authentic-feeling fantasy narratives —

complete with political intrigue, personal drama, magical catastrophes, religious

upheaval, and generational sagas — that surprise even the person who built the

world.



```

1.2 Design Pillars

```

\*\*Emergent Storytelling Over Scripted Content.\*\* No event in the simulation

is hand-authored. Every coronation, betrayal, magical discovery, and holy war

arises from the interaction of underlying systems. The design document does

not contain a story — it contains the rules from which stories emerge. This

means the simulator can produce narrative structures that the designer never

anticipated, which is the entire point.

\*\*Depth Over Breadth.\*\* A single character in this simulator carries personal-

ity traits, memories, goals, relationships, beliefs, possessions, skills, reputation,

and a complete life history. A single city carries demographics, economy, ar-

chitecture, political structure, religious composition, cultural traditions, and a

timeline of every significant event that occurred within its walls. The simulator

prefers to simulate fewer entities with rich interconnection over many entities

with shallow data.



\*\*Observation and Cultivation.\*\* The player’s role is that of an invisible gar-

dener tending a vast, living garden. They can water certain plants and prune

others, but they cannot force a flower to bloom. The influence system is de-

signed so that the player’s actions feel like nudges in a plausible direction rather

than divine edicts. The most satisfying moments should come from watching a

tiny intervention cascade into unforeseen consequences three centuries later.

\*\*Believability Through Complexity.\*\* A king does not declare war because

a random number generator said so. He declares war because his personality

traits include ambition and pride, because his economic advisors report declining

trade revenue, because a neighboring kingdom insulted his wife’s lineage at a

diplomatic banquet, because his military commander (who is secretly loyal to

a rival faction) assures him victory is certain, and because a prophetic dream

(sent by the player using influence points) convinced him that the gods favor

his cause. Every event should have a traceable chain of causation that, when

inspected, makes the player say “of course that happened.”

\*\*Layered Interpretation.\*\* The same events exist simultaneously as raw data

entries (useful for analysis), structured event logs (useful for tracking), and

literary prose (useful for immersion). The player can freely move between these

layers, zooming from a statistical overview of a century-long population decline

into the personal tragedy of a specific family caught in the famine that caused

it.





```

1.3 The Experience in Practice

Imagine pressing “play” and watching the simulation advance year by year. In

the event log, you notice a young scholar named Elara discovering an ancient

artifact in a remote ruin. You click her name to inspect her — she is curious,

ambitious, slightly reckless, and has a strained relationship with her mentor at

the Ivory Academy who expelled her for unauthorized research. You bookmark

her.

Fifty simulation-years later, the narrative panel describes a “Magical Renais-

sance” sweeping the continent. You trace the cause-effect chain backward and

discover it leads to Elara’s artifact discovery. Her research paper spread to three

kingdoms, inspired a generation of mages, led to the founding of a new academy,

and produced court wizards who shifted the political balance of power. But you

also notice that a religious order has declared magic heretical in response to

the growing mage influence, and a charismatic paladin is gathering followers to

wage a holy war against the arcane. The world is heading toward a schism that

Elara set in motion without ever intending to — and you can trace every link

in the chain.

That is the experience this simulator creates.

```

\## 2. The Simulation Loop



```

The simulation loop is the beating heart of the entire system. Every other

feature — generation, rendering, narrative, player interaction — exists in ser-

vice of this loop. Getting it right determines whether the world feels alive or

mechanical.

```

```

2.1 Loop Architecture

```

```

The simulation operates on a tick-based model where one tick equals one day of

in-world time. Not every system runs every tick. Instead, systems are stratified

into frequency tiers based on how quickly their domain changes in the real world:

Every tick (daily): - Character AI decision-making (for active/nearby char-

acters) - Military movement and tactical decisions - Event resolution queue

processing - Urgent event cascading (battles, assassinations, natural disasters)

Every 7 ticks (weekly): - Trade caravan movement and market updates -

Relationship maintenance calculations - Reputation propagation across social

networks - Religious devotion updates

Every 30 ticks (monthly): - Economic production and consumption cycles

```

\- Population growth, birth, death, migration - Political stability assessments -

&nbsp;   Faction goal evaluation and strategy adjustment - Weather pattern generation





```

Every 90 ticks (seasonal): - Agricultural yield calculations - Military cam-

paign strategic reassessments - Cultural trend propagation between connected

civilizations - Seasonal festivals and traditions triggering

Every 365 ticks (annually): - Technological progress evaluation - Artistic

and philosophical movement advancement - Language drift calculations - Gen-

erational shifts (new adults entering society, elders dying) - Geological micro-

changes (erosion, river course shifts) - Divine power recalculation based on wor-

shiper counts

Every 3650 ticks (decadal): - Long-term climate pattern shifts - Major

geological events (volcanic eruptions, earthquakes) - Civilization-level cultural

identity recalculation - Historical era transition checks

```

This stratification is not merely a performance optimization — it is a design

choice. Economics should not fluctuate daily, and mountains should not erode

monthly. The frequency tiers encode the natural tempo of each domain.



```

2.2 The Tick Execution Order

```

Within each tick, systems execute in a specific order that reflects causal depen-

dency. A character cannot make a decision based on economic conditions that

have not yet been calculated for that tick. The ordering is:

&nbsp;                                                          

&nbsp; TICK N BEGINS  

&nbsp;                                                          

&nbsp; 1. TIME ADVANCE  

&nbsp; Increment world clock, check for season/year change  

&nbsp; Trigger any time-dependent scheduled events  

&nbsp;  

&nbsp; 2. ENVIRONMENT (if frequency matched)  

&nbsp; Weather generation for current day  

&nbsp; Geological events (volcanic, seismic)  

&nbsp; Natural disaster checks  

&nbsp; Resource regeneration (forests regrow, mines deplete)  

&nbsp;  

&nbsp; 3. ECONOMY (if frequency matched)  

&nbsp; Resource production at each site  

&nbsp; Trade route processing and caravan movement  

&nbsp; Market price recalculation (supply/demand)  

&nbsp; Tax collection and treasury updates  

&nbsp; Economic event generation (booms, busts)  

&nbsp;  

&nbsp; 4. POLITICS (if frequency matched)  

&nbsp; Faction leader decision-making  

&nbsp; Diplomatic action processing  

&nbsp; Internal stability calculation  





&nbsp; Law and governance updates  

&nbsp; Succession and legitimacy checks  

&nbsp;  

&nbsp; 5. SOCIAL  

&nbsp; Relationship updates between characters  

&nbsp; Reputation propagation through social networks  

&nbsp; Cultural norm enforcement and drift  

&nbsp; Family events (births, marriages, deaths)  

&nbsp;  

&nbsp; 6. CHARACTER AI  

&nbsp; For each active character:  

&nbsp; a. Perceive: gather current context  

&nbsp; b. Evaluate: score possible actions  

&nbsp; c. Decide: select action based on personality  

&nbsp; d. Execute: perform action, generate events  

&nbsp; e. Remember: store significant outcomes in memory  

&nbsp; f. Reflect: update goals if context has changed  

&nbsp;  

&nbsp; 7. MAGIC (if frequency matched)  

&nbsp; Magical research progress  

&nbsp; Mana/power level fluctuations  

&nbsp; Artifact activation and influence  

&nbsp; Magical institution internal politics  

&nbsp; Wild magic and planar stability checks  

&nbsp;  

&nbsp; 8. RELIGION (if frequency matched)  

&nbsp; Divine power recalculation  

&nbsp; Prayer and devotion aggregation  

&nbsp; Divine intervention probability checks  

&nbsp; Church politics and schism progression  

&nbsp; Prophet and saint emergence checks  

&nbsp;  

&nbsp; 9. MILITARY  

&nbsp; Army movement along planned routes  

&nbsp; Battle resolution for armies in contact  

&nbsp; Siege progression for ongoing sieges  

&nbsp; Recruitment and supply chain updates  

&nbsp; Morale calculations  

&nbsp;  

&nbsp; 10. EVENT RESOLUTION  

&nbsp; Process event queue (ordered by priority)  

&nbsp; Execute consequence chains  

&nbsp; Generate cascading events from resolved events  

&nbsp; Update cause-effect graph  

&nbsp;  

&nbsp; 11. NARRATIVE GENERATION  





&nbsp; For events above significance threshold:  

&nbsp; Generate raw log entry  

&nbsp; Generate narrative prose (template-based)  

&nbsp; For events above high-significance threshold:  

&nbsp; Generate micro-narrative vignette  

&nbsp; Route to active chronicler for bias filtering  

&nbsp;  

&nbsp; 12. CLEANUP \& INDEXING  

&nbsp; Update spatial index for moved entities  

&nbsp; Archive old events to compressed storage  

&nbsp; Recalculate Level-of-Detail boundaries  

&nbsp; Update world fingerprint/DNA visualization  

&nbsp; Process player influence queue  

&nbsp;  

&nbsp; 13. PLAYER NOTIFICATION  

&nbsp; Check notification preferences  

&nbsp; Alert on bookmarked entity events  

&nbsp; Alert on high-significance global events  

&nbsp; Update UI state for renderer  

&nbsp;  

&nbsp;                                                          

&nbsp; TICK N COMPLETE  

&nbsp;                                                          



\*\*2.3 Level-of-Detail Simulation\*\*



Not every entity in the world can be simulated at full fidelity every tick — a

Large (800×800) world might contain tens of thousands of characters. The Level-

of-Detail (LoD) system manages computational budget by simulating entities

at different fidelity levels based on proximity to the player’s focus.



\*\*Full Detail (Focus Zone — ~50 tile radius):\*\* Every character makes daily

decisions. Individual relationship changes are tracked. Economic transactions

are itemized. Military movements are tracked per-unit. Events are generated

at maximum granularity. This is where the player is looking, so this is where

the simulation is most alive.



\*\*Reduced Detail (Active Zone — ~200 tile radius):\*\* Characters are sim-

ulated in aggregate groups. Economic changes are calculated per-settlement,

not per-merchant. Military forces are tracked as armies, not individual soldiers.

Only events above a moderate significance threshold are generated. The simu-

lation is still running, but at lower resolution.



\*\*Abstract (Background Zone — beyond 200 tiles):\*\* Entire civilizations

are simulated as statistical aggregates. Population growth/decline is a formula,

not individual births and deaths. Wars are resolved as probability calculations,

not battle simulations. Only events above a high significance threshold are gen-





erated. This zone provides the “rest of the world is still happening” backdrop.

\*\*Dynamic Focus Shifting:\*\* When the player moves their focus to a new area,

the LoD boundaries shift with them. Entities transitioning from Abstract to Full

Detail undergo a “detail inflation” process where their statistical aggregate state

is decomposed into individual entities with plausible histories interpolated from

the aggregate trends. This creates the illusion that the full-detail simulation

was always running.



```

Significance Override: Regardless of LoD zone, any event above a config-

urable significance threshold (default: 85/100) always receives full-detail simula-

tion. If a dragon attacks a city in the Background Zone, the system temporarily

promotes that area to Full Detail for the duration of the crisis.

```

```

2.4 The Event Queue

```

Events are the primary output of the simulation loop and the primary input to

the narrative engine. The event queue is a priority queue ordered by significance,

with higher-significance events processed first within each tick.



```

Each event carries: - A significance score (0–100) that determines narrative

treatment depth - A category (Political, Magical, Cultural, Religious, Scientific,

Personal, Exploratory, Economic, Disaster, Military) - A participant list of

entity IDs involved - A cause chain linking back to the events that produced

this one - A consequence potential — a set of possible follow-on events with

probability weights - A temporal offset — some consequences are immediate,

others are delayed by days, months, or years

```

The queue processes events in significance order, and each resolved event may

enqueue new events. This creates the cascading chains that produce emergent

narrative depth.



```

2.5 Simulation Speed and Player Experience

```

The player controls simulation speed through time manipulation:



```

Pause — simulation frozen, player can inspect anything, plan influence actions.

Normal Speed (1 day/second) — useful for watching specific events unfold

in real-time. A battle might take 3-5 real seconds. A political negotiation might

take 10-15 seconds. This is “watching a scene play out” speed.

Fast Forward ×7 (1 week/second) — useful for watching a season unfold.

Crop cycles, military campaigns, trade missions become visible at this speed.

Good for tracking a specific character’s month-to-month life.

Fast Forward ×30 (1 month/second) — useful for watching a year unfold.

Economic cycles, political terms, seasonal patterns become visible. Good for

tracking a single conflict or political crisis.

```



```

Fast Forward ×365 (1 year/second) — useful for watching decades pass.

Generational change, cultural drift, territorial expansion/contraction visible.

Good for watching civilizations rise and fall.

Ultra Fast ×3650 (1 decade/second) — useful for watching centuries com-

press. Geological changes, language evolution, the full arc of empires. Reserved

for “what happens if I let this run for a thousand years” curiosity.

Slow Motion (10 seconds/day) — triggered automatically or manually for

momentous events. The coronation of a new monarch, the critical moment of a

decisive battle, the discovery of a world-changing artifact. Events are narrated

in extended prose with more literary detail.

Automatic Slow-Down: The simulation can optionally slow itself when it

detects a convergence of significant events. If three major plotlines are reaching

climax simultaneously — a war is about to be decided, a succession crisis is

erupting, and a magical catastrophe is unfolding — the simulation drops to

Slow Motion so the player can absorb the narrative density.

```

\## 3. World Generation Pipeline



World generation follows a six-phase pipeline where each phase builds on the

output of the previous one. The pipeline is deterministic given a seed value,

meaning the same seed and parameters always produce the same world.



```

3.1 Generation Parameters

```

The player configures the world through a parameter screen before generation

begins. Each parameter has discrete named settings to avoid overwhelming the

player with sliders:

\*\*World Size\*\* — determines the map grid dimensions and, consequently, the max-

imum number of civilizations and the scale of geography. - Small (200×200):

Intimate setting, 2-4 civilizations, faster simulation. Good for character-focused

stories. - Medium (400×400): Standard setting, 4-8 civilizations, balanced scope.

The recommended starting size. - Large (800×800): Grand setting, 8-16 civi-

lizations, continental scope. For those who want epic-scale history. - Epic

(1600×1600): Massive setting, 16-32 civilizations, multiple continents. For ded-

icated sessions and powerful hardware.

\*\*Magic Prevalence\*\* — controls how common magical phenomena, practitioners,

and artifacts are. - Mundane: Magic is essentially myth. No active practitioners,

maybe a few dormant artifacts. Stories focus on politics, warfare, and human

drama. - Low: Magic exists but is rare and feared. A handful of practitioners per

civilization. Magical events are momentous. - Moderate: Magic is an established

part of society. Academies exist, court wizards are common, magical creatures

roam wild places. The default “fantasy” setting. - High: Magic permeates daily





```

life. Enchanted tools are commonplace, magical transportation exists, wars are

fought with spells as much as swords. - Ubiquitous: Magic is as fundamental as

physics. Non-magical solutions to problems are the exception. Reality itself is

fluid in places. This setting produces the most alien and unpredictable worlds.

Civilization Density — affects the number and distribution of initial sen-

tient settlements. - Sparse: Few settlements, vast wilderness. Civilizations are

isolated and develop independently. - Normal: Balanced distribution. Some

contact between civilizations, some untamed wilderness. - Dense: Many set-

tlements, little wilderness. Civilizations are in constant contact, leading to

more frequent diplomacy, trade, and conflict. - Crowded: Settlements every-

where, overlapping territorial claims. Conflict is nearly inevitable. The “pres-

sure cooker” setting.

Danger Level — controls the frequency and severity of threats. - Peaceful:

Rare monsters, mild disasters, low conflict frequency. Stories focus on cultural

development and personal drama. - Moderate: Occasional monster incursions,

periodic natural disasters, wars happen but are not constant. - Dangerous:

Frequent monster attacks, regular natural disasters, wars are common. Heroes

and villains are forged in constant crisis. - Apocalyptic: The world is actively

hostile. Existential threats emerge regularly. Civilizations struggle to survive.

This setting produces the most dramatic but shortest histories.

Historical Depth — how many years of pre-history the simulator runs before

the player begins observing. - Shallow (100 years): Living memory. Current

events are well-documented, the past is recent. Suitable for “founding era” sto-

ries. - Moderate (500 years): Several generations. Some history is recorded,

some is legend. The default setting. - Deep (2000 years): Multiple eras. An-

cient empires have risen and fallen. Rich backstory with mythological layers. -

Ancient (10000 years): Deep time. Multiple cycles of civilization, layers of ruins,

forgotten technologies. Produces the richest lore but takes longer to generate.

Geological Activity — controls the dynamism of the physical world during

simulation. - Dormant: Terrain changes very slowly. Rivers stay where they are,

mountains don’t grow or erode meaningfully. - Normal: Occasional earthquakes,

rare volcanic eruptions, gradual erosion. The physical world is a stable backdrop.

```

\- Active: Regular seismic events, active volcanoes, rivers that flood and shift.

&nbsp;   Geography is a active participant in history. - Volatile: Frequent catastrophic

&nbsp;   geological events. The map itself is a character. Civilizations must constantly

&nbsp;   adapt or die.

&nbsp;   \*\*Race Diversity\*\* — number and variety of sentient species. - Homogeneous

(1-2): Humans and perhaps one other race. Conflict is between cultures, not

species. - Standard (3-5): Classic fantasy spread — humans, elves, dwarves,

and a couple of unique races. Good default. - Diverse (6-10): Many races with

distinct cultures. Inter-species diplomacy is a major theme. - Myriad (11+):

The world teems with sentient species. Ecology is complex, politics are multi-

dimensional, and alliances shift constantly.





\*\*Pantheon Complexity\*\* — depth of the divine layer. - Atheistic: No gods.

Religion is cultural tradition without divine power. Suitable for “grounded”

fantasy. - Deistic: Gods exist but do not intervene. Religion is important

culturally but gods are distant. - Theistic: Gods are real and occasionally act.

Miracles happen. Prophets receive genuine visions. - Interventionist: Gods are

active participants. Divine wars spill into the mortal world. Religion is politics

with supernatural backing.



\*\*Technology Era\*\* — the starting technological level of civilizations. - Stone

Age: Pre-metalworking. Tribal societies, oral traditions, stone tools. - Bronze

Age: Early metalworking, first cities, early writing. Civilization is young. -

Iron Age: Widespread metalworking, established kingdoms, written law. The

classic medieval fantasy starting point. - Renaissance: Early modern technology,

printing, gunpowder. Magic and technology compete.



```

3.2 Generation Phases

```

\*\*Phase 1 — Geological Formation.\*\* The generator creates the physical world.

Tectonic plates are simulated — their collision produces mountain ranges, their

separation creates ocean rifts and volcanic island chains. A heightmap is gen-

erated using Perlin noise modulated by plate tectonics. Water flows downhill

from mountain peaks, carving rivers that pool into lakes and empty into oceans.

Climate zones are calculated from latitude, elevation, and ocean proximity. Tem-

perature and rainfall combine to determine biome type for each tile. Finally,

mineral and resource nodes are placed based on geological logic — gold in quartz

veins near volcanic activity, iron in sedimentary layers, magical crystals at ley

line intersections.

\*\*Phase 2 — Ecological Seeding.\*\* The bare geological map receives life. Flora

is distributed by biome — deciduous forests in temperate zones, conifers in cold

highlands, grasses on plains, cacti in deserts. Fauna follows flora — herbivores

where food grows, predators where herbivores congregate. Magical creatures

receive territories based on magic prevalence — dragons in remote mountain

ranges, fey in ancient forests, elementals near ley line nodes. Dungeon and

ruin sites are placed in geologically interesting locations (cave systems, ancient

volcanic calderas, cliff faces) to be populated with history during Phase 5.

\*\*Phase 3 — Cosmological Framework.\*\* The metaphysical rules of the world

are established. A pantheon of gods is generated, each with domains (war,

knowledge, nature, death, love, craft, storms, etc.), personality traits, and rela-

tionships to other gods (allies, rivals, lovers, parent-child). The magic system’s

rules are defined — which schools of magic exist, what power sources fuel them,

what the limitations and costs are. The planar structure is established — how

many planes exist beyond the material world, what lives there, and how per-

meable the boundaries are. These cosmological constants constrain everything

that follows.

\*\*Phase 4 — Racial Genesis.\*\* Sentient species are created with unique phys-





ical characteristics, lifespans, cultural tendencies, and innate abilities. Each

race receives a procedurally generated creation myth that fits within the es-

tablished cosmological framework. Racial naming conventions are established

using Markov chain generators trained on culturally-inspired phoneme distribu-

tions — so elven names feel different from dwarven names, which feel different

from orcish names, and all names within a culture feel linguistically consistent.

Starting populations are distributed based on biome aﬀinity (mountain-dwelling

races in mountains, forest-dwelling races in forests).

\*\*Phase 5 — Pre-History Simulation.\*\* This is where the generator tran-

sitions from static placement to dynamic simulation. The simulation engine

from Section 2 is run in fast-forward mode at reduced fidelity for the configured

Historical Depth. During this phase, ancient empires rise and fall, legendary

heroes perform great deeds, artifacts are forged during significant events, wars

are fought that leave ruins and grudges, religions splinter and merge, and lan-

guages diverge from common ancestors. The output of this phase is the world’s

backstory — not hand-authored, but simulated.

\*\*Phase 6 — Current State Initialization.\*\* The fast-forwarded simulation

halts, and the current state is “crystallized” into the world the player will ob-

serve. Active civilizations are established with governments, economies, mili-

taries, and cultures derived from their simulated history. Named characters are

generated in positions of power and significance, each with a personal history

that connects to the world’s history. Political structures reflect centuries of evo-

lution. Cultural traditions, holidays, taboos, and art styles are codified. Initial

tensions — border disputes, succession crises, religious conflicts, trade rivalries

— are seeded from the pre-history’s unresolved threads.



```

3.3 Post-Generation Refinement

After generation completes, the player enters a refinement interface where they

can adjust the world before simulation begins. This is the one moment of di-

rect control the player receives — once simulation starts, they are limited to

the influence system. Refinement options include moving or resizing civilization

territories, adjusting starting populations, creating or removing key characters

with custom traits, establishing initial alliances or conflicts, placing special land-

marks or artifacts, modifying climate zones, and seeding specific events to trigger

early in the simulation. This lets the player set up interesting initial conditions

without scripting outcomes.

```

\## 4. Entity Architecture



```

4.1 Entity-Component-System (ECS) Design

Every object in the simulation — from a mountain range to a single

peasant — is an entity. An entity is nothing but a unique identifier

```



```

(a branded TypeScript type for compile-time safety). All data lives in

components, and all logic lives in systems. This architectural pattern

enables maximum flexibility: a character who becomes a lich gains an

UndeadComponentwithout requiring a new entity type. A city that falls to

ruin loses itsPopulationComponentandGovernmentComponentbut retains its

PositionComponentandHistoryComponent.

```

```

4.2 Entity Categories and Their Components

```

```

Geographic Entities: - Regions: PositionComponent, BiomeComponent,

ClimateComponent, OwnershipComponent, ResourceComponent - Sites

(cities, towns, villages, ruins): PositionComponent, PopulationCom-

ponent, EconomyComponent, GovernmentComponent, MilitaryComponent,

StructuresComponent, HistoryComponent, CultureComponent - Structures

(buildings, monuments): PositionComponent, StructureTypeComponent,

ConditionComponent, HistoryComponent - Natural Features (rivers,

mountains, caves): PositionComponent, FeatureTypeComponent, Resource-

Component, MagicalPropertyComponent (if applicable)

Social Entities: - Civilizations: TerritoryComponent, Government-

Component, EconomyComponent, MilitaryComponent, CultureComponent,

DiplomacyComponent, HistoryComponent, PopulationDemographicsCom-

ponent - Factions (guilds, secret societies, orders): Membership-

Component, GoalComponent, ResourceComponent, InfluenceComponent,

HistoryComponent, ReputationComponent - Families: GenealogyComponent,

WealthComponent, ReputationComponent, TraitsComponent (hereditary

tendencies), GrudgesComponent - Organizations (academies, churches):

MembershipComponent, KnowledgeComponent, ResourceComponent, Hierar-

chyComponent, DoctrineComponent

Individual Entities: - Characters: PositionComponent, AttributeCom-

ponent, SkillComponent, PersonalityComponent, RelationshipComponent,

GoalComponent, MemoryComponent, BeliefComponent, PossessionCompo-

nent, ReputationComponent, StatusComponent, HealthComponent - Crea-

tures: PositionComponent, CreatureTypeComponent, TerritoryComponent,

BehaviorComponent, ThreatLevelComponent - Deities: DomainComponent,

PersonalityComponent, RelationshipComponent (to other gods), PowerCompo-

nent (derived from worshipers), InterventionHistoryComponent

Cultural Entities: - Religions: DoctrineComponent, WorshiperCom-

ponent, HolySiteComponent, SchismHistoryComponent, RitualComponent

```

\- \*\*Traditions:\*\* OriginComponent, PracticeComponent, SpreadComponent,

&nbsp;   EvolutionHistoryComponent - \*\*Languages:\*\* PhonemeComponent, Vocabu-

&nbsp;   laryComponent, ParentLanguageComponent, SpeakerDistributionComponent

\- \*\*Arts:\*\* StyleComponent, InfluenceComponent, MasterworkListComponent,

&nbsp;   PatronageComponent

&nbsp;   \*\*Knowledge Entities:\*\* - \*\*Books:\*\* AuthorComponent, ContentComponent,





```

InfluenceComponent, LocationComponent (where copies exist), Preservation-

StateComponent - Discoveries: DiscovererComponent, DomainComponent,

ImpactComponent, SpreadComponent - Spells: CreatorComponent, School-

Component, PowerLevelComponent, RequirementComponent, UserListCompo-

nent

Object Entities: - Artifacts: CreationHistoryComponent, PowerComponent,

OwnershipChainComponent, CurseComponent (if applicable), LocationCompo-

nent, SignificanceComponent - Treasures: ValueComponent, LocationCompo-

nent, GuardianComponent, OwnershipComponent

Event Entities: - Wars: ParticipantComponent, CauseComponent,

BattleListComponent, OutcomeComponent, TerritoryChangeComponent -

Disasters: TypeComponent, SeverityComponent, AffectedAreaComponent,

CasualtyComponent, RecoveryComponent - Celebrations: TypeComponent,

ParticipantComponent, LocationComponent, CulturalImpactComponent

```

```

4.3 Branded ID Types

```

To prevent accidentally passing a CharacterId where a FactionId is expected,

all entity IDs use TypeScript’s branded type pattern:

\*\*type\*\* EntityId=number \& { \*\*readonly\*\* \_\_brand:'EntityId' };

\*\*type\*\* CharacterId=EntityId\& { \*\*readonly\*\* \_\_character: \*\*true\*\* };

\*\*type\*\* FactionId= EntityId\&{ \*\*readonly\*\* \_\_faction: \*\*true\*\* };

\*\*type\*\* SiteId =EntityId\& { \*\*readonly\*\* \_\_site: \*\*true\*\* };

\*\*type\*\* ArtifactId= EntityId\&{ \*\*readonly\*\* \_\_artifact: \*\*true\*\* };

\*\*type\*\* EventId=EntityId\& { \*\*readonly\*\* \_\_event: \*\*true\*\* };

\*\*type\*\* DeityId=EntityId\& { \*\*readonly\*\* \_\_deity: \*\*true\*\* };

\*\*type\*\* BookId =EntityId\& { \*\*readonly\*\* \_\_book: \*\*true\*\* };



This catches entire categories of bugs at compile time.



\## 5. Simulation Systems — Deep Design



```

Each simulation system operates as an independent module that reads rele-

vant components, processes logic, and writes back updated state plus generated

events. Systems should never directly reference other systems — they commu-

nicate exclusively through the event queue and shared component state.

```

```

5.1 Character AI System

```

The Character AI is the most complex system and the primary driver of emer-

gent narrative. Every named character in the simulation is an autonomous

agent with the following decision-making pipeline:





```

Perception Phase. The character “perceives” their current context. This is

not literal sensory simulation — it is a contextual awareness check. A character

knows: their current location and what is happening there, the state of their

personal relationships, the political situation of their faction, recent events that

affected them or their community, their own health/wealth/power status, and

any information they have learned through their social network (which may be

incomplete or wrong, per the Memory \& Reputation system).

Goal Evaluation Phase. The character reviews their active goals and assesses

progress. Goals exist in a priority hierarchy:

```

\- \_Survival goals\_ (highest priority): avoid death, escape danger, find

&nbsp;   food/shelter. These override everything.

\- \_Primary life goal\_ (chosen based on personality): gain power, seek knowl-

&nbsp;   edge, protect family, accumulate wealth, achieve glory, pursue art, serve

&nbsp;   faith, find love.

\- \_Secondary goals\_ (contextual): fulfill duty to faction, advance in organiza-

&nbsp;   tion, complete a specific project, resolve a personal conflict.

\- \_Opportunistic goals\_ (lowest priority): take advantage of unexpected situa-

&nbsp;   tions, explore curiosity, socialize.

Goals can change over a character’s lifetime. A young character driven by glory-

seeking might, after losing a child to war, shift their primary goal to protecting

family. A scholar who discovers forbidden knowledge might shift from seeking

knowledge to gaining power. These shifts are driven by significant life events

interacting with personality traits.

\*\*Action Generation Phase.\*\* Based on the current context and active goals, the

system generates a list of possible actions. Actions are drawn from a context-

dependent pool. A character in a royal court has different available actions

than a character in a dungeon. Actions include: diplomatic overtures, military

commands, scholarly research, crafting/building, social interaction (befriend,

betray, romance, intimidate), travel, economic activity (trade, invest, steal),

religious acts (pray, proselytize, perform ritual), magical acts (research spell,

enchant item, summon creature), and many more.

\*\*Scoring Phase.\*\* Each candidate action is scored by a weighted formula:

score = (personality\_alignment × 0.3)

\+ (goal\_advancement × 0.3)

\+ (relationship\_impact × 0.15)

\+ (risk\_assessment × 0.10)

\+ (opportunity\_value × 0.10)

\+ (cultural\_conformity × 0.05)

\+ (random\_factor × impulsiveness\_trait)



The personality\_alignment score measures how well the action fits the char-

acter’s trait profile. A cruel character scores “show mercy” low; a scholarly

character scores “research ancient text” high. The goal\_advancement score





```

measures how much the action moves the character toward their primary and

secondary goals. The relationship\_impact considers how the action affects re-

lationships with people the character cares about. The risk\_assessment weighs

potential negative outcomes against the character’s bravery/caution traits. The

cultural\_conformity score reflects whether the action aligns with the character’s

cultural norms (a character from a culture that values honor scores “flee from

battle” low even if survival logic says it’s wise).

```

The random\_factor is scaled by the character’s impulsiveness trait. A deliber-

ate, patient character adds almost no randomness. An impulsive, passionate

character might occasionally do something suboptimal because it “felt right in

the moment” — which produces much more interesting stories.

\*\*Execution Phase.\*\* The highest-scoring action is executed. Execution gener-

ates one or more events that are placed in the event queue. The event includes

the character as a participant, the action as the event subtype, and the outcome

(which may involve a probability roll modified by relevant skills).



```

Memory Phase. The character’s memory system records the action and its

outcome. Significant outcomes — especially failures, betrayals, great successes,

or emotional moments — receive higher memory weight and persist longer. See

Section 6 for the full Memory \& Reputation system.

Reflection Phase. After execution, the character briefly “reflects” — check-

ing whether the outcome suggests their goals or strategies should change. A

general who loses a battle might reconsider the war. A scholar who makes a

breakthrough might set more ambitious research targets. A lover who is rejected

might shift attention to career advancement. This creates character arcs over

time.

```

```

5.2 Faction \& Political System

Factions are the largest-scale agents in the simulation, representing civilizations,

kingdoms, guilds, religious orders, and any organized group with shared goals.

Unlike characters, factions do not have a single decision-making process — in-

stead, faction behavior emerges from the interactions of the characters who lead

them.

Government Structures define how decisions are made within a faction:

```

\- \_Monarchy:\_ A single ruler makes all major decisions. Their personality

&nbsp;   drives faction behavior. Succession follows rules (primogeniture, elective,

&nbsp;   etc.) that can themselves change.

\- \_Republic:\_ A council or senate votes on major decisions. Individual coun-

&nbsp;   cilors have their own agendas. Majority personality profiles shape faction

&nbsp;   direction.

\- \_Theocracy:\_ Religious leaders make decisions based on divine doctrine. Or-

&nbsp;   thodoxy vs. reform tensions drive internal politics.





\- \_Tribal Confederation:\_ Multiple chieftains must agree. Consensus-building

&nbsp;   is slow but stable. Charismatic leaders can dominate.

\- \_Oligarchy:\_ A small group of wealthy/powerful individuals steer faction

&nbsp;   policy. Economic interests dominate.

\- \_Magocracy:\_ Magical ability determines political power. Research and ar-

&nbsp;   cane achievement replace military strength as currency.

\*\*Diplomacy Engine.\*\* Factions interact through a diplomacy system that pro-

cesses the following action types: form alliance (requires mutual benefit assess-

ment), declare war (requires casus belli or reckless leader), propose trade agree-

ment (requires compatible economies), arrange royal marriage (requires eligible

individuals and political motivation), offer tribute (weaker faction to stronger),

issue ultimatum (demands backed by threat), sign peace treaty (requires both

sides willing), form coalition (against a common threat).

Diplomatic actions are proposed by faction leaders (using the Character AI sys-

tem), evaluated by advisors (also characters with their own biases), and resolved

based on faction interests modified by the personalities of the negotiators. A

skilled diplomat character can achieve outcomes that pure power calculation

would not predict — or a hotheaded ambassador can ruin a promising alliance.



\*\*Internal Politics.\*\* Within each faction, named characters compete for power,

influence, and resources. Noble houses accumulate wealth and form alliances.

Ambitious generals plot coups. Reform movements challenge established order.

Corruption erodes institutional effectiveness. Succession crises erupt when rulers

die without clear heirs. All of this is driven by the Character AI system —

internal politics is simply what happens when you simulate dozens of ambitious

characters within the same power structure.



```

5.3 Economic System

```

The economy provides the material foundation that all other systems rest on.

Armies need food and weapons, scholars need books and laboratories, kings

need treasuries to fund ambitions.

\*\*Resource Production.\*\* Each settlement produces resources based on its ter-

rain (farmland produces food, mines produce ore, forests produce timber), tech-

nology level (better tools = more output), workforce size (more people = more

production, with diminishing returns), and specialization (a city famous for its

smiths produces more weapons per worker than a generic city).

\*\*Trade Networks.\*\* Trade routes connect settlements. Caravans and merchant

ships move goods along these routes, buying where prices are low and selling

where prices are high. Route safety affects trade volume — a road through

bandit-infested territory sees less traﬀic. Trade routes are emergent: the system

does not predefine them but rather models merchant entities making profit-

seeking decisions about where to buy and sell. Over time, consistently profitable

routes become “established trade routes” with better infrastructure and lower





risk.

\*\*Market Simulation.\*\* Each settlement has a local market with prices deter-

mined by supply and demand. A city that produces abundant iron but little

food has cheap iron and expensive food, creating trade incentives. Prices re-

spond to events — a war that disrupts grain shipments causes food prices to

spike in import-dependent cities. A magical discovery that makes enchanted

tools commonplace reduces tool prices but increases demand for magical com-

ponents.

\*\*Economic Events.\*\* The system generates economic events that feed into

the narrative: booms (resource discovery, trade route opening), busts (market

crashes, resource depletion), monopolies (faction controlling critical resource),

innovation (new production methods, usually tied to discoveries), and crises

(inflation, currency collapse, debt defaults).



```

5.4 Military \& Warfare System

```

Warfare is the most dramatic expression of faction rivalry and produces some

of the simulation’s most significant events.

\*\*Army Composition.\*\* Armies are composed of units drawn from a faction’s

population and resources. Unit types include infantry, cavalry, archers, siege

engineers, mages (if magic prevalence allows), and special units unique to certain

races or cultures. Army size is limited by faction population, economic capacity

to supply and equip, and morale/loyalty of the populace.

\*\*Campaign System.\*\* Wars are not single battles — they are multi-step cam-

paigns with strategic objectives. A faction might campaign to capture a specific

city, to secure a resource-rich territory, or to eliminate a rival’s military capac-

ity. Campaign planning is done by commander characters (using the Character

AI system), so a brilliant strategist commands differently than a cautious bu-

reaucrat.

\*\*Battle Resolution.\*\* When opposing armies meet, a battle is resolved through

a multi-factor calculation: - Army size and composition (numbers matter, but

are not everything) - Commander skill and tactics (a great general can overcome

numerical disadvantage) - Terrain (defending a mountain pass against a larger

force is viable) - Supply state (hungry armies fight poorly) - Morale (demoralized

armies rout; fresh troops hold) - Magical support (battle mages, enchanted

weapons, divine blessings) - Individual hero interventions (a legendary warrior

can turn a battle’s tide) - Weather (rain favors defenders, fog favors the attacker)



The resolution is not a single dice roll — it is a simulation of the battle’s key

moments, producing a narrative of charges, flanking maneuvers, heroic stands,

routs, and surrenders that feeds into the event log.

\*\*Siege Mechanics.\*\* Cities with walls can be besieged rather than assaulted

directly. Sieges are attritional — the attacker tries to starve the city while





the defender tries to hold out for reinforcements. Siege events include: assault

attempts, sally attacks by defenders, disease outbreaks in cramped conditions,

tunneling, magical bombardment, negotiated surrenders, and relief forces arriv-

ing.

\*\*Post-War Consequences.\*\* A war’s resolution cascades into all other systems.

Territory changes (political system), reparation payments (economic system),

veteran characters with new skills and trauma (character system), war-inspired

art and literature (cultural system), religious interpretations of the outcome

(religious system), and generational grudges (memory system).



```

5.5 Magic System Simulation

```

Magic, when enabled, is not merely a “combat power” — it is a force that

reshapes society, economy, politics, and culture.

\*\*Magical Research.\*\* Wizard characters (and other practitioners) pursue re-

search that can produce new spells, magical theories, and artifacts. Research is

modeled as a long-term project with periodic progress checks. The probability

of a breakthrough depends on the researcher’s skill, their available resources (li-

brary access, rare materials), their research environment (a well-funded academy

vs. a lonely tower), and serendipity (lucky characters sometimes make unex-

pected connections).

\*\*Magical Institutions.\*\* Academies, orders, and covens are organizational enti-

ties with internal politics. The headmaster of a magic academy might favor cer-

tain schools of magic over others, creating disgruntled faculty who leave to found

rival institutions. A witch coven might schism over the ethics of necromancy.

These internal dynamics produce events and shape which magical knowledge is

developed and taught.

\*\*Artifact Creation.\*\* Artifacts are not randomly generated loot — they are

forged during significant magical events by specific characters for specific pur-

poses. The Sundering Blade was created by the god Vulkaron during the Ce-

lestial War. The Staff of the Void was crafted by Mordain the Shadowweaver

after he defeated a being from the shadow realm. Each artifact has a creation

story that connects to the world’s history, and artifacts influence events they

are involved in (a general wielding a legendary sword gets a morale bonus for

their army and a personal combat bonus).

\*\*Magical Catastrophes.\*\* When magical research goes wrong, or when too

much magical energy concentrates in one place, catastrophes occur. Wild magic

zones distort reality in unpredictable ways. Planar rifts allow creatures from

other planes to invade. Failed lich transformations produce undead horrors.

Magical plagues spread through populations with unusual symptoms. These

catastrophes produce some of the most dramatic events in the simulation and

often catalyze major historical turning points.

\*\*Magic and Society.\*\* The integration (or rejection) of magic into society is a





```

dynamic process that the simulation models. In a High Magic world, enchanted

items might be mass-produced, creating an economic revolution. In a Low Magic

world, practitioners might be feared and persecuted. The balance between mag-

ical and mundane power is a political fault line that produces schisms, wars,

and cultural movements.

```

```

5.6 Religious Simulation

```

Religion in the simulation is more than cultural flavor — when Pantheon Com-

plexity is Theistic or Interventionist, gods are real entities with agency.

\*\*Divine Power.\*\* Each deity has a Power score derived from the number and

devotion of their worshipers. More worshipers = more power. This creates

an evolutionary dynamic: gods whose doctrines attract followers grow stronger,

while gods whose doctrines lose relevance fade. A god can die if they lose all

worshipers — and this is a significant event that produces theological crisis.

\*\*Divine Intervention.\*\* When a god’s power exceeds a threshold, they can

intervene in the mortal world. Interventions include: empowering a chosen

champion, sending prophetic visions, manifesting physically (rare, expensive in

divine power), blessing a site or army, cursing an enemy, creating a miracle that

validates their faith. The frequency and intensity of interventions depends on

the Pantheon Complexity setting.

\*\*Church Politics.\*\* Religious institutions are organizational entities with human

leaders, and human leaders have human failings. Corruption, power struggles,

schisms over doctrine, and reform movements are all modeled. A schism occurs

when a significant portion of a religion’s leadership disagrees on a doctrinal point

— both sides claim to be the true faith, and followers must choose. Schisms can

produce religious wars.

\*\*Syncretism.\*\* When civilizations with different religions interact through trade

or conquest, their religions influence each other. A conquered people might

adopt their conqueror’s gods while retaining their own traditions, creating a

syncretic blend. A trade partner’s god of prosperity might gain worshipers in

a merchant city even though the city’s dominant religion doesn’t include that

god. This produces realistic religious evolution over centuries.



```

5.7 Cultural Evolution System

Culture is the slow-moving backdrop against which the faster drama of politics

and warfare plays out. Cultural systems operate at lower frequency (seasonal

and annual ticks) but produce the deepest long-term changes.

Technological Progress. Inventions emerge from researcher characters (or

are discovered by explorers finding ancient knowledge). Each invention has

prerequisites — the printing press requires both woodworking and literacy. Once

invented, technology spreads through trade contacts and cultural exchange at

a rate dependent on the recipient civilization’s openness and the technology’s

```



utility. Some technologies are suppressed — a theocracy might ban the printing

press to maintain doctrinal control.

\*\*Artistic Movements.\*\* Art in the simulation is not merely decorative — it

reflects and shapes the culture that produces it. An artistic movement arises

when a masterwork (produced by an artist character) resonates with the current

cultural moment. If a civilization has just won a great war, an epic poem

glorifying the victory can spark a “heroic movement” in literature and visual

art. If a civilization is undergoing religious upheaval, abstract spiritual art might

emerge. Movements spread between connected civilizations, creating shared

aesthetic vocabulary.

\*\*Philosophical Schools.\*\* Philosophers are characters who generate ideas. Their

ideas compete in the marketplace of thought, gaining followers who spread them.

Some ideas are conservative (defending existing power structures) and others

are revolutionary (challenging them). The balance between conservative and

revolutionary philosophy in a civilization affects its stability, openness to change,

and likelihood of reform or revolution.

\*\*Language Evolution.\*\* Languages in the simulation are not static labels — they

are entities that evolve over time. A common language splits into dialects when

its speakers are separated by geography or politics. Over centuries, dialects

become mutually unintelligible languages. Trade contact introduces loan words.

Conquest can impose a new language on a population, creating a linguistic

underclass. Scholarly traditions preserve ancient languages that have otherwise

died, creating an “academic” language used in writing but not in speech (like

Latin in medieval Europe).



\## 6. Character Memory \& Reputation System



This system transforms characters from reactive decision-makers into beings

with persistent inner lives. It is the foundation for grudges, gratitude, learning

from experience, and the rich personal histories that make characters feel real.



```

6.1 Memory Architecture

Every named character maintains a Memory Store — an ordered collection of

memory records, each representing a significant experience. Memories are not a

complete recording of everything that happens — they are selective, weighted,

and subject to decay.

Memory Record Structure:

Memory {

eventId: EventId // The original event

timestamp: WorldTime // When it happened

emotionalWeight: number // -100 (traumatic) to +100 (joyful)

```



significance: number // 0-100, how important was this

participants: EntityId\[] // Who was involved

myRole: MemoryRole // Was I the actor, target, or witness?

category: MemoryCategory // Betrayal, kindness, loss, triumph, etc.

accuracy: number // 0-100, how accurately this is remembered

timesRecalled: number // How often has this been remembered

lastRecalled: WorldTime // When was this last accessed

narrative: string // The character's subjective version of events

}

\*\*Memory Formation Rules:\*\*

Not every event becomes a memory. An event creates a memory when it directly

involves the character (as actor, target, or witness) and exceeds a significance

threshold modified by the character’s personality. A highly empathetic character

forms memories from witnessing others’ suffering. A self-absorbed character

only remembers events that directly affected them. An ambitious character

particularly remembers power dynamics — who helped them, who blocked them,

who failed to support them when it mattered.



```

Memory Decay and Distortion.

Memories decay over time — their significance score slowly decreases, and even-

tually low-significance memories are pruned. However, highly emotional memo-

ries resist decay. A traumatic betrayal (emotional weight: -90) stays vivid for

a lifetime. A pleasant dinner party (emotional weight: +20) fades within a few

years.

More importantly, memories distort. Each time a memory is recalled (which

happens when the character encounters a related situation or person), its accu-

racy score has a chance to decrease. Details shift, emotions intensify, blame is

redistributed. A character who was partly responsible for a failed battle might,

after years of replaying the memory, remember the failure as entirely their ri-

val’s fault. This memory distortion is the engine that powers grudges, heroic

self-narratives, and the divergence between what “actually happened” (the event

log) and what a character “remembers” (their memory store).

```

```

6.2 Reputation System

```

```

Reputation is the social mirror of memory — it is what other people believe

about a character, as opposed to what the character believes about themselves.

Reputation Propagation Model:

```

When a character performs a witnessed action, the witnesses form memories of

that action. These witnesses then share their perception through their social

networks — gossip, letters, oﬀicial reports, bardic songs. Each retelling has a

chance to distort the story (like a game of telephone), and each receiver applies

their own biases to what they hear.





```

Propagation chain:

```

1\. Character performs action (Event generated)

2\. Witnesses form memories (with their own bias)

3\. Witnesses share with contacts (distortion chance per hop)

4\. Recipients share with their contacts (further distortion)

5\. After N hops, the story may be significantly different from reality



```

Propagation speed depends on:

```

\- Social network density (court gossip spreads fast, rural news slow)

\- Story significance (dramatic events spread further)

\- Existing reputation (stories about famous people spread faster)

\- Trade routes and communication infrastructure

\*\*Reputation Components:\*\*



A character’s reputation is not a single number — it is a multi-dimensional

profile that varies by audience:



\- \_Martial Reputation:\_ How formidable are they in combat? (based on wit-

&nbsp;   nessed battles, reported duels, military victories)

\- \_Diplomatic Reputation:\_ How trustworthy and skilled in negotiation?

&nbsp;   (based on kept/broken agreements, successful treaties)

\- \_Scholarly Reputation:\_ How knowledgeable and wise? (based on published

&nbsp;   works, known discoveries, teaching)

\- \_Moral Reputation:\_ How virtuous or villainous? (based on perceived ac-

&nbsp;   tions, heavily colored by the observer’s moral framework)

\- \_Magical Reputation:\_ How powerful a practitioner? (based on known spells,

&nbsp;   magical feats, artifacts created)

\- \_Leadership Reputation:\_ How effective a leader? (based on faction perfor-

&nbsp;   mance, follower loyalty, crisis management)

Each dimension exists as a separate value for every faction and social group that

has heard of the character. Mordain the Shadowweaver might have high Schol-

arly and Magical reputation everywhere, but his Moral reputation is “terrifying

villain” in most kingdoms and “misunderstood genius” among his apprentices.



```

6.3 Generational Grudges and Inheritance

```

When a character dies, their memories do not simply vanish. The character’s

family members — children, spouses, close allies — inherit a filtered version

of the deceased’s most emotionally significant memories. A father who was

betrayed by House Valmont tells his children about the betrayal. The children

inherit the grudge, though at reduced intensity (perhaps 60% of the parent’s

emotional weight). The grandchildren inherit it at further reduced intensity

(30%), but it can be refreshed if House Valmont performs any new hostile action.



```

Grudge Mechanics:

Inherited grudge intensity:

```



```

Generation 1 (direct experience): 100% emotional weight

Generation 2 (parent's story): 60% emotional weight

Generation 3 (grandparent): 30% emotional weight

Generation 4 (great-grandparent): 10% emotional weight

Generation 5+: Fades to cultural memory (not personal grudge)

```

```

Grudge refreshing:

If the target family/faction performs a hostile action against any

member of the grudge-holding family, the grudge resets to the

intensity appropriate to the new event, or the inherited intensity,

whichever is higher.

```

```

Grudge resolution:

```

\- Apology/reparation from the target can reduce grudge intensity

\- Intermarriage between families can reduce grudge intensity

\- A major shared threat can suppress (but not eliminate) grudges

\- Enough time without contact eventually lets grudges fade

\- A character with the "forgiving" personality trait decays grudges faster

\- A character with the "vengeful" trait decays grudges slower and

&nbsp;   actively seeks opportunities to act on them

\*\*Cultural Memory.\*\* When a grudge fades below individual significance but

was historically important, it transitions to cultural memory. The Valmont-

Stormhold feud might no longer be a personal grudge for any living individual,

but it persists as a cultural narrative — “House Valmont and House Stormhold

have been enemies for generations.” This cultural memory has lower intensity

but much longer duration, and it creates a background bias in how members of

each house perceive the other.



```

6.4 False Memories and Propaganda

```

```

Not all information in the simulation is true. The system explicitly models

information distortion:

Organic Distortion. Memories naturally degrade and shift over time (as

described above). A character who remembers a battle they fought 40 years ago

may recall themselves as more heroic than they actually were, or may blame an

ally for a failure that was actually shared.

Deliberate Propaganda. Faction leaders, religious authorities, and powerful

individuals can deliberately create false narratives. A king who seized power

through a coup has his historians write accounts showing the previous king was

a tyrant. A religious order might rewrite the history of a saint to align with

their current doctrine. An ambitious noble might spread false rumors about a

rival.

In-World Historians. When the simulation generates a book-writing event

for a historian character, the historian’s account is filtered through their biases.

```



A historian employed by Kingdom A portrays Kingdom A favorably. A historian

with a scholarly bent focuses on intellectual achievements and minimizes military

history. This produces contradictory historical accounts within the simulation,

which the Unreliable Chronicler system (Section 10) surfaces to the player.



\## 7. Event Interconnection Engine



The event cascade system is what separates this simulator from a random event

generator. Every event can cause other events, and those events can cause fur-

ther events, creating chains that span centuries and connect seemingly unrelated

domains.



```

7.1 The Cascade Model

```

When an event is resolved, the Event Interconnection Engine evaluates its \*\*con-

sequence potential\*\* — a set of possible follow-on events, each with a probabil-

ity weight. The probability is not a static value — it is dynamically calculated

based on the current world state.

\*\*Example: A Mage Completes a Groundbreaking Grimoire\*\*



The event “Wizard Thessalon writes The Emerald Codex, a revolutionary en-

chantment treatise” triggers a consequence evaluation:



1\. \*\*Knowledge spreads to neighboring kingdoms\*\* (probability: 80%,

&nbsp;   modified by trade route connectivity). If the kingdoms have trade routes

&nbsp;   and literate populations, the book spreads. If they are isolated or illiterate,

&nbsp;   it does not.

2\. \*\*Existing magical institutions react\*\* (probability: 90%). Academies

&nbsp;   might celebrate the advance, religious orders might condemn it, rival wiz-

&nbsp;   ards might try to discredit or steal the work.

3\. \*\*New practitioners emerge\*\* (probability: proportional to Magic Preva-

&nbsp;   lence). If magic is already common, more people take up the new enchant-

&nbsp;   ment school. If magic is rare, fewer respond.

4\. \*\*Political implications\*\* (probability: depends on current political dynam-

&nbsp;   ics). If a kingdom is looking for military advantage, they might recruit

&nbsp;   the new enchantment specialists as weapons of war.

Each triggered consequence is itself an event with its own consequence potential,

creating the chain the design document describes: book → knowledge spreads

→ academy founded → graduates gain influence → political shift → war →

resistance → counter-movement.



\*\*7.2 Cascade Depth and Dampening\*\*

Not every cascade runs forever. The system uses a \*\*dampening function\*\*

where each subsequent consequence in a chain has slightly reduced probability





of triggering further consequences. This prevents infinite cascade loops while

still allowing deep chains. The dampening is reduced for high-significance events

(a world-shaking catastrophe cascades further than a minor trade dispute).



```

7.3 Cross-Domain Cascading

```

The most interesting cascades cross domain boundaries. A military event trig-

gers political consequences triggers economic effects triggers cultural responses.

The cascade engine explicitly models these cross-domain transitions:



```

Military victory → Political: Territory changes, war reparations

→ Economic: Trade route shifts, resource acquisition

→ Cultural: Victory literature, heroic narratives

→ Religious: "God favored us" interpretation

→ Personal: Veterans with trauma and glory

→ Magical: Captured enemy spellbooks, war-magic innovation

```

```

Religious schism → Political: Factions align with different sects

→ Economic: Trade disruption along sectarian lines

→ Military: Holy war potential

→ Cultural: Artistic movements reflecting spiritual crisis

→ Personal: Families split by faith

→ Scholarly: Theological debates produce new philosophy

```

```

7.4 The Narrative Significance Amplifier

```

```

Some cascades develop a self-reinforcing quality where each link in the chain is

slightly more significant than the last. The engine detects these “rising action”

patterns and marks them as narrative arcs — tracked chains that the narrative

engine treats with special attention. When a chain reaches its climax (the

highest-significance event in the sequence), the narrative engine produces its

most dramatic prose.

```

\## 8. The Narrative Engine



The Narrative Engine transforms raw simulation events into readable, atmo-

spheric prose. It operates on a template-based system augmented with contex-

tual variation, literary device insertion, and tone control.



```

8.1 Template Architecture

```

```

Each event type has multiple associated templates organized by significance

level and tone. Templates are parameterized text blocks with entity references,

conditional sections, and tone modifiers.

Template Components:

```



\- \*\*Entity References:\*\* {character.name}, {character.title},

&nbsp;   {character.epithet}, {faction.name}, {site.name} — automati-

&nbsp;   cally resolved from entity state at event time.

\- \*\*Pronoun Handling:\*\* {pronoun.subject}, {pronoun.object},

&nbsp;   {pronoun.possessive} — correctly gendered based on character

&nbsp;   data.

\- \*\*Conditional Sections:\*\* {#if condition}...{/if} — include or ex-

&nbsp;   clude text based on world state. “The succession was contested” only

&nbsp;   appears if there is actually a rival claimant.

\- \*\*Tone Modifiers:\*\* Templates exist in multiple tone variants (epic, per-

&nbsp;   sonal, mythological, political, scholarly).

\- \*\*Significance Scaling:\*\* Low-significance events get brief, dry templates.

&nbsp;   High-significance events get dramatic, literary templates with metaphor

&nbsp;   and foreshadowing.



```

8.2 Tone System

```

The player selects a narrative tone that governs which template variants are

used and how prose is styled:

\*\*Epic Historical.\*\* Grand, sweeping language. Focuses on civilizations and eras.

Uses phrases like “the realm mourned,” “destiny would decree,” “an age of

darkness descended.” Characters are described by their roles and epithets more

than their personal feelings. This is the “narrator reading from a history book”

voice.

\*\*Personal Character Focus.\*\* Intimate, character-driven language. Focuses on

individual experiences and emotions. Uses phrases like “she felt the weight of

the crown,” “he could not forgive what had been done,” “the letter trembled in

his hands.” Events are filtered through the perspectives of the people who lived

them.

\*\*Mythological.\*\* Ancient, reverent language. Focuses on cosmic significance

and symbolic meaning. Uses phrases like “in the Time Before Time,” “forged

in celestial fire,” “prophecy speaks of a reckoning.” This tone treats events as

legend, amplifying their grandeur and stripping away mundane detail.

\*\*Political Intrigue.\*\* Analytical, suspicious language. Focuses on power dynam-

ics and hidden motivations. Uses phrases like “observers noted the conspicuous

absence,” “intelligence suggests deeper currents,” “the real negotiations hap-

pened behind closed doors.” This tone treats every event as a chess move.

\*\*Scholarly.\*\* Dry, academic language. Focuses on causes, effects, and analysis.

Uses phrases like “evidence suggests,” “the primary factor was,” “contrary to

popular belief.” This tone treats events as subjects of study rather than drama.





```

8.3 Literary Device Integration

The narrative engine is not limited to filling in template blanks — it also inserts

literary devices that create the texture of real storytelling:

Foreshadowing. When the engine detects a “rising action” narrative arc (see

Section 7.4), it inserts subtle hints in earlier events’ narratives. When describing

the founding of a magic academy, the engine might add “none could foresee the

horrors this pursuit of knowledge would eventually unleash” if it knows the

cascade leads to a magical catastrophe.

Dramatic Irony. When the player knows something a character does not

(because the player can see the full event log), the narrative engine can highlight

the gap. A king confident in his general’s loyalty might be described as “placing

his trust in the very man who would betray him three years hence.”

Metaphor Selection. Templates include metaphor slots that are filled from a

context-appropriate pool. A death in winter draws from cold/sleep metaphors.

A political rise draws from climbing/height metaphors. A naval battle draws

from storm/tide metaphors.

Callback and Echo. When a current event mirrors a historical one, the nar-

rative engine references the parallel. “Like the first Valmont who defied a king,

so too did his great-granddaughter stand before the throne and refuse to kneel.”

```

\## 9. Micro-Narrative Vignettes



```

Beyond the chronicle-style narrative log, the simulator occasionally produces

small, intimate scene fragments — moments of fiction that bring the simulation’s

characters to life in a way that summary prose cannot.

```

```

9.1 Design Philosophy

```

Vignettes are rare by design. If they appeared constantly, they would lose their

emotional impact and slow the simulation to a crawl. The target frequency

is approximately one vignette per 50-100 simulation years, with the exact rate

tunable by the player. Their rarity makes each one feel like a discovered treasure

— a moment where the curtain between simulation and story lifts.



```

9.2 Trigger Conditions

```

```

A vignette is generated when an event meets all of the following criteria: - Sig-

nificance score above 85 - At least one participant character has a rich memory

history (10+ significant memories) - The event involves strong emotional con-

tent (betrayal, triumph, sacrifice, reunion, discovery) - No vignette has been

generated in the last 50 simulation years (cooldown)

```



```

Additionally, certain event archetypes have elevated vignette probability: - A

general’s reflection before a battle that will determine the fate of a civilization

```

\- The moment of discovery for a scholar finding something world-changing - A

&nbsp;   reunion or confrontation between characters with deep shared history - A child

&nbsp;   hearing a story about a character the player watched grow up in the simulation

\- A character’s death when they have been a major figure for generations - A

&nbsp;   betrayal of deep trust between characters with high relationship scores



```

9.3 Vignette Structure

```

```

Each vignette is a short prose fragment (200-500 words) written in present

tense, close third-person perspective. It does not explain context — it drops

the reader into a moment and trusts that the simulation has provided enough

context through the event log and inspector.

Example Vignette — The General Before Battle:

&nbsp;                                                      

A MOMENT IN TIME — Year 1247, Day of the Red Dawn

&nbsp;                                                      

```

```

The tent flap does not move. The wind has died, as if

the world itself holds its breath before what is to

come.

```

```

General Kaelin Stormhold stands over the map table,

but her eyes are not reading the terrain lines or the

painted markers representing ten thousand soldiers.

She is looking at the small iron ring on her left hand

— the one her mother wore, the one her mother's

mother wore before the Valmont treachery took their

ancestral seat three generations past.

```

```

Tomorrow she will face the Valmont host across the

Ashenmere. They will have the high ground. They will

have the sun at their backs. They will have numbers.

```

```

She has something else.

```

```

She touches the ring, and somewhere in the archives

of memory — her mother's voice, her grandmother's

fury, a hundred years of waiting — she finds the

thing she needs.

```

```

Not courage. Not strategy. Not divine favor.

```

```

Certainty.

```



```

She calls for her captains.

```

```

&nbsp;                                                      

```

This vignette connects to the Memory \& Reputation system (inherited grudge),

the Military system (upcoming battle), and the Character AI (personality-

driven certainty). It draws its power from context the simulation has been

building for generations.



```

9.4 Vignette Categories

```

The system has templates for the following vignette types:



\- \*\*Before the Storm:\*\* A leader contemplating a decision that will change

&nbsp;   everything. Tone: tense, reflective.

\- \*\*The Discovery:\*\* A scholar/explorer encountering something beyond un-

&nbsp;   derstanding. Tone: awe, wonder.

\- \*\*The Confrontation:\*\* Two characters with deep history facing each other.

&nbsp;   Tone: loaded silence, old wounds.

\- \*\*The Legacy:\*\* A child or student hearing about events the player wit-

&nbsp;   nessed. Tone: nostalgia, mythologizing.

\- \*\*The Farewell:\*\* A character at the end of their life. Tone: peaceful or

&nbsp;   bitter, depending on life events.

\- \*\*The Betrayal:\*\* The moment trust breaks. Tone: sharp, visceral.

\- \*\*The Coronation/Ascension:\*\* A character taking on a role that will

&nbsp;   define them. Tone: weight, expectation.

\- \*\*The Aftermath:\*\* A character surveying the consequences of a major

&nbsp;   event. Tone: shell-shock, revelation.



\## 10. The Unreliable Chronicler



```

10.1 Concept

```

The simulation does not have an objective narrator — or rather, the objective

view (the raw event log) exists alongside subjective interpretations. The Unre-

liable Chronicler system introduces in-world narrator characters whose biases,

allegiances, and personalities color how they report events. The player can

switch between chroniclers to see events from different perspectives, discovering

that history is not fixed truth but contested narrative.



```

10.2 Chronicler Generation

```

```

Chroniclers are special character entities with the following additional compo-

nents:

```



\- \*\*Faction Allegiance:\*\* The chronicler is employed by, born into, or sympa-

&nbsp;   thetic toward a specific faction. Events involving this faction are presented

&nbsp;   more favorably.

\- \*\*Ideological Bias:\*\* The chronicler has intellectual preferences. A mili-

&nbsp;   tarist chronicler emphasizes warfare and heroism. A religious chronicler

&nbsp;   interprets events through theological frames. A humanist chronicler fo-

&nbsp;   cuses on individual stories and moral lessons.

\- \*\*Knowledge Limitation:\*\* A chronicler in Kingdom A may not have ac-

&nbsp;   curate information about events in distant Kingdom B. Their account of

&nbsp;   foreign events is based on whatever information reached them — which

&nbsp;   may be incomplete, delayed, or distorted.

\- \*\*Personal Grudges and Admiration:\*\* A chronicler who was personally

&nbsp;   wronged by a character portrays that character unfavorably. A chronicler

&nbsp;   who admires a particular leader writes hagiography.

\- \*\*Writing Style:\*\* Each chronicler has a distinct prose style. One might be

&nbsp;   flowery and metaphor-heavy, another might be terse and factual, a third

&nbsp;   might be sardonic and critical.



```

10.3 How It Works

```

When the narrative engine generates prose for an event, it generates a “base nar-

rative” from the template system and then passes it through the active chroni-

cler’s bias filter. The filter modifies the narrative in the following ways:

\*\*Faction Spin.\*\* Events are reframed to favor the chronicler’s faction. A battle

loss becomes “a strategic withdrawal.” A war of aggression becomes “a just

campaign to protect our borders.” A rival faction’s cultural achievement is

downplayed or attributed to earlier work by the chronicler’s faction.

\*\*Omission.\*\* A chronicler might simply not report events that embarrass their

faction or that they have no knowledge of. The player notices gaps in one

chronicler’s account that are present in another’s.

\*\*Attribution Shift.\*\* Credit for achievements shifts toward the chronicler’s fa-

vored individuals. Blame for failures shifts toward outsiders, rivals, or scape-

goats.

\*\*Tone Adjustment.\*\* The same event described by two chroniclers might differ

dramatically in tone. One describes a siege as “the valiant defense of our sacred

capital.” The other describes it as “the desperate stand of a tyrant clinging to

stolen power.”



```

10.4 Player Interaction

```

The player can: - \*\*Switch Chroniclers.\*\* A UI dropdown lets the player select

from available chroniclers. The narrative panel updates to reflect the selected

chronicler’s perspective. - \*\*Compare Accounts.\*\* A split view shows the same

event as told by two different chroniclers side by side, highlighting where their





```

accounts diverge. - View the Raw Record. The “objective” view (the raw

event log) is always available as a ground truth against which biased accounts

can be compared. - Commission New Chroniclers. Using influence points,

the player can inspire a character to become a chronicler, effectively creating a

new narrative perspective.

```

```

10.5 The “Lost History” Mechanic

```

If all chroniclers who recorded a particular event die without passing their works

to a library or successor, the detailed narrative of that event is “lost.” It still

exists in the raw event log, but the narrative panel shows only a bare summary

with a notation: “Detailed accounts of this event have been lost to time.” This

creates a sense that history is fragile — knowledge can be destroyed by war, fire,

or simple neglect.

If a later archaeologist or historian character rediscovers lost texts, the narra-

tives are restored, potentially with new biases from the rediscoverer’s interpre-

tation. The player might watch a civilization’s history being literally rewritten

as scholars debate the meaning of rediscovered texts.



\## 11. User Interface Design



```

11.1 Visual Philosophy

```

The interface uses a \*\*high-fidelity ASCII aesthetic\*\* — richly colored extended

ASCII and Unicode characters creating a dense, information-rich visual field.

This is not “retro” styling for nostalgia — it is a deliberate design choice that

emphasizes information density over graphical fidelity. A 200-character-wide

terminal can display more simultaneous data points than a graphical interface

of equal size, and the abstract nature of ASCII characters encourages the player

to use imagination to fill in visual detail (which the narrative engine supports

with prose).



The color palette is vibrant and saturated, using terminal colors to differenti-

ate terrain types, faction territories, entity types, and significance levels. Ani-

mations are subtle — color cycling for active events, character alternation for

moving entities, pulsing for the player’s current focus.



```

11.2 Main Interface Screens

```

\*\*World Map View.\*\* The primary navigation screen showing terrain rendered

with biome-specific characters and colors. Mountains (  in gray/brown), forests

(  in dark green), plains (  in light green), oceans (  in blue), deserts (· in

tan), tundra (· in white), swamps (~ in olive), volcanoes (  in red). Cities are

marked with   in the faction’s color, ruins with †, armies with  , temples with  ,

academies with  . The map supports multiple zoom levels (from world overview





to individual-structure detail) and toggleable overlays (political borders, trade

routes, resource distribution, military movements, climate patterns, magical

phenomena).

\*\*Event Log View.\*\* Split panel showing raw event log on the left and narrative

interpretation on the right. The raw log is chronological and factual: “Year 1247,

Day 23: King Aldric III of Valoria died of old age.” The narrative panel presents

the same event in prose, styled according to the active tone and filtered through

the active chronicler. Features include auto-scrolling with pause, filtering by

category/location/entity, keyword search, event bookmarking, cause-effect chain

visualization, and historical scrubbing.

\*\*Entity Inspector.\*\* Deep-dive panel for any selected entity, rendered in box-

drawing characters. Character inspectors show full biography with ASCII bar

charts for attributes (           80/100), personality trait listings, relationship net-

works with sentiment indicators (  for love,   for rivalry,   for conflict), possession

inventories, spell lists, event timelines, goal displays, and narrative biographies.

Location inspectors show geography, demographics, economy, governance, his-

tory. Faction inspectors show territory, leadership, military, diplomacy, culture.

\*\*Relationship Graph View.\*\* Node-and-edge ASCII graph with color-coded

relationship types. Family (blue), friendship (green), rivalry (red), political

alliance (yellow), religious aﬀiliation (purple), teacher-student (cyan). Edge in-

tensity indicates relationship strength. The graph supports filtering by type,

temporal scrubbing to see how relationships evolved, cluster detection for fac-

tions and social groups, and centering on a selected entity with configurable

depth (1-3 hops).

\*\*Timeline View.\*\* Horizontal timeline with key events marked by significance.

Era divisions with cultural characteristics labeled. Parallel tracks for different

civilizations (color-coded rows). Zoom from millennia overview to daily granu-

larity. Event filtering and search. Branching visualization for timeline branches

(see Section 14).



```

Statistics Dashboard. Aggregate data visualization using ASCII bar charts,

line charts, and area charts. Population by race and civilization over time. Terri-

tory control stacked area chart. Technology progress indicators per civilization.

Magic prevalence charts. Warfare intensity heatmaps. Economic production

trends. Religion follower distributions.

```

\## 12. Player Interaction \& Influence



```

12.1 The Cultivation Model

```

The player’s role is that of an invisible cosmic gardener. They cannot command

armies, write laws, or force characters to act. Instead, they expend \*\*Influence

Points\*\* (IP) to nudge the world in subtle directions. The system is designed





```

so that the player’s interventions always feel plausible — as if they might have

happened naturally anyway.

```

```

12.2 Influence Point Economy

Influence Points regenerate slowly over time (base rate: 1 IP per simulation

year, modified by world age — older worlds have accumulated more “narrative

momentum” that resists change). Major interventions cost more IP than subtle

ones, and the total pool is capped so the player cannot stockpile unlimited

influence.

```

\*\*12.3 Influence Categories

Divine Intervention (5-50 IP):\*\* - Inspire a character with an idea (5 IP).

Plants a thought seed that may or may not take root based on the character’s

personality and circumstances. - Send a prophetic dream to a religious figure

(10 IP). The character may interpret the dream literally, metaphorically, or

ignore it. - Arrange a “coincidental” meeting between two important characters

(15 IP). They still have to decide what to do with the encounter. - Subtle

personality nudge in a key individual (20 IP). Shifts one personality trait slightly

in one direction. Can be resisted by strong-willed characters. - Reveal hidden

information to someone (25 IP). The character learns a secret but must decide

how to act on it. - Small luck modifier to a specific action (10 IP). Increases

success probability of one attempt. Does not guarantee success. - Grant a vision

of a possible future (30 IP). A character glimpses a potential outcome, which

may motivate or terrify them. - Empower a champion (50 IP). Temporarily

boosts a character’s abilities for a single event. The most expensive and direct

intervention.

\*\*Environmental Influence (5-30 IP):\*\* - Adjust weather patterns (5 IP). A

timely storm or drought can shift agricultural output, military campaigns, or

moods. - Minor geological changes (15 IP). A new spring appears, a river

shifts course, a fertile patch emerges. Must be plausible. - Animal migration

pattern shift (5 IP). Herd animals move toward or away from a settlement,

affecting food supply. - Resource discovery likelihood increase (20 IP). Does not

place resources — just increases the chance that an exploring character finds

something. - Trigger a natural event (30 IP). An earthquake, eruption, or flood.

Must be geologically plausible for the region.

\*\*Cultural Influence (5-20 IP):\*\* - Promote a specific art form or philosophy

(10 IP). Slightly increases the resonance of a particular cultural movement. -

Encourage a technological research direction (15 IP). A researcher is slightly

more likely to pursue a specific line of inquiry. - Strengthen or weaken a tradition

(10 IP). A cultural practice becomes slightly more or less popular. - Introduce

a foreign concept (20 IP). A character has an idea from outside their cultural

context, as if by “inspiration.”





```

12.4 Resistance and Believability

Not all influence succeeds. The system applies two checks:

Resistance Check. Some entities resist influence based on willpower (person-

ality trait), magical protection, or divine favor. A character protected by a god

is harder to influence. A character with strong convictions resists personality

nudges.

Believability Check. Every intervention is evaluated for plausibility. If the

influence would produce an outcome that is wildly inconsistent with the current

context — inspiring a pacifist monk to declare war, for example — the inter-

vention fails and the IP is partially refunded. The system enforces that player

influence always looks like a natural extension of existing dynamics, not a deus

ex machina.

```

\## 13. World DNA / Fingerprint System



```

13.1 Concept

Each generated world develops a unique identity over time. The World DNA

system captures this identity in a compact, visual “fingerprint” that lets the

player quickly understand the character of a world and compare different worlds.

```

```

13.2 Fingerprint Components

```

The fingerprint is a composite visualization containing several sub-glyphs:



\*\*Balance Glyph.\*\* A small radial diagram showing the relative weight of six do-

mains in the world’s history: Warfare, Magic, Religion, Commerce, Scholarship,

and Diplomacy. A war-dominated world produces a glyph heavily weighted to-

ward the Warfare axis. A world where magic drove most of the important events

weights toward Magic. The shape of this glyph immediately communicates the

world’s “flavor.”



```

Civilization Palette. A horizontal color bar showing the dominant civiliza-

tions, ordered by historical significance. Each civilization’s assigned color fills a

proportional segment of the bar. A world dominated by one empire has a bar

mostly one color. A world with many competing powers is a rainbow.

Volatility Graph. A small sparkline showing conflict intensity over the world’s

history. Peaks represent eras of war; valleys represent peace. The shape com-

municates whether the world was consistently turbulent, consistently peaceful,

or oscillated between eras.

Magic Curve. A small sparkline showing how magical prevalence changed

over time. Some worlds see magic increase as research accumulates. Others see

```



```

magic decline as religions suppress it. The shape tells the story of the world’s

relationship with the arcane.

Population Trend. A small sparkline showing total sentient population over

time. Growth indicates stability and prosperity; decline indicates war, plague,

or catastrophe. Sudden drops mark existential crises.

Complexity Score. A single number (0-100) representing the total number

of significant event cascades, cross-domain interactions, and narrative arcs that

the world produced. High complexity means rich, interconnected stories. Low

complexity means simpler, more linear histories.

```

```

13.3 Use Cases

```

\- \*\*World Selection.\*\* When the player has generated multiple worlds, the

&nbsp;   fingerprint gallery lets them quickly find worlds with interesting charac-

&nbsp;   teristics. “Show me worlds where magic declined” or “find worlds with

&nbsp;   high conflict” becomes a visual scan.

\- \*\*World Comparison.\*\* Place two fingerprints side by side to see how dif-

&nbsp;   ferent parameter choices produced different histories from the same seed.

\- \*\*Personal Collection.\*\* Players can name, tag, and organize their favorite

&nbsp;   world fingerprints as a collection — a gallery of pocket universes.



\## 14. “What If” Timeline Branching



\*\*14.1 Concept\*\*

At any point during the simulation, the player can create a \*\*timeline branch\*\*

— a snapshot of the world state that forks into an alternate history. The player

makes one change to the branching point (or simply lets it run without change)

and watches how the different outcome cascades through subsequent centuries.

This transforms the simulator from a single-history viewer into a tool for explor-

ing counterfactual narrative.



```

14.2 Branching Mechanics

Creating a Branch. The player pauses the simulation at a moment of interest,

selects “Create Branch” from the menu, and specifies the divergence point. The

divergence can be: - Reversing an event outcome (“What if the battle went

the other way?”) - Removing a character (“What if the hero died before the

war?”) - Changing a character’s decision (“What if the king chose peace instead

of war?”) - Adding an event (“What if a volcanic eruption happened here?”) -

Doing nothing (just running the same world state forward with different random

seeds to see natural variance)

Running Branches. Each branch runs as an independent simulation from the

divergence point forward. The player can switch between branches, watching

```



```

each one advance independently or in parallel.

Comparison View. A special split-screen view shows both timelines side by

side, synchronized to the same simulation date. Differences are highlighted —

territories that diverged, characters who lived in one timeline but died in the

other, events that occurred in one but not the other. A “divergence tracker”

shows how many entities have significantly different states between the two

timelines, giving a quantitative measure of how much the single change affected.

```

```

14.3 Cascade Visualization

```

The most compelling use of branching is watching a single change ripple outward.

The comparison view includes a “cascade map” showing which events in each

timeline share common causes and where the causal chains diverged. This allows

the player to trace exactly how “the general surviving the battle” led, through

a chain of 47 linked events, to “an entirely different civilization dominating the

continent 200 years later.”



```

14.4 Branch Limits

```

```

For performance reasons, the player is limited to a configurable number of active

branches (default: 3). Old branches can be archived (saving their state but

not actively simulating) or deleted. The comparison view only compares two

branches at a time.

```

\## 15. Procedural Heraldry \& Symbolism



```

15.1 Concept

Every faction in the simulation receives a procedurally generated coat of arms

rendered in ASCII art using box-drawing characters. The heraldry is not purely

decorative — it is derived from the faction’s culture, values, and history, creating

a visual language that communicates identity at a glance.

```

```

15.2 Heraldry Generation

```

```

Each coat of arms is composed of:

Shield Shape. Selected from a library of ASCII shield templates appropriate

to the faction’s culture. A knightly kingdom gets a classic shield. A maritime

republic gets a round seal. A tribal confederation gets a totem-style vertical

arrangement.

Field Division. The shield is divided into sections using standard heraldic

patterns (per pale, per fess, quarterly, per bend, per chevron) rendered in ASCII

box-drawing characters. The number of divisions reflects faction complexity —

```



```

simple tribal groups have undivided fields, sophisticated kingdoms have multiple

divisions.

Charges (Symbols). ASCII art symbols placed on the field, drawn from

the faction’s cultural identity: - Animal symbols derived from the faction’s

dominant fauna or cultural totems - Weapon symbols for militaristic factions

```

\- Star/celestial symbols for religions and magic-focused cultures - Tool/craft

&nbsp;   symbols for trade-focused factions - Natural feature symbols (mountains, waves,

&nbsp;   trees) for geographically defined cultures

&nbsp;   \*\*Colors.\*\* Derived from the faction’s primary terrain (mountain factions favor

&nbsp;   gray/silver, forest factions favor green, desert factions favor gold/tan) modi-

&nbsp;   fied by cultural values (aggressive factions add red, scholarly factions add blue,

&nbsp;   religious factions add purple).



```

15.3 Heraldic Evolution

```

```

Coats of arms are not static — they evolve with the faction: - A revolution

replaces the old coat of arms with new symbolism reflecting the new ideology

```

\- A dynasty change modifies the arms to reflect the new ruling house - A ter-

&nbsp;   ritory expansion might add new elements from conquered peoples - A religious

&nbsp;   conversion might replace secular symbols with sacred ones - A political union

&nbsp;   of two factions might combine their arms (quartering)

&nbsp;   Each version of a faction’s coat of arms is archived, creating a visual history of

&nbsp;   the faction’s political evolution viewable in the Timeline.



```

15.4 Display and Use

```

```

Coats of arms appear in faction inspector panels (large, detailed rendering), on

the world map as territory markers (small, abbreviated rendering), in battle

event narratives (“under the banner of the crimson eagle”), and in diplomatic

event descriptions. The player can view a gallery of all factions’ current and

historical arms.

```

\## 16. Export \& Documentation System



```

16.1 Exportable Content Types

World Encyclopedia. A comprehensive compendium of all entities, events,

and lore, organized by category. Includes entries for every named character, set-

tlement, faction, artifact, book, spell, religion, and event in the world’s history.

Each entry cross-references related entries.

Character Chronicles. Individual biographies for selected characters, written

in the active narrative tone and filtered through the active chronicler. These

```



```

read as self-contained short stories — the complete life of a character from birth

to death.

Historical Timelines. Chronological narratives of the world’s development,

with configurable scope (a single civilization, a single century, a single war, or

the entire history).

Genealogies. Family trees rendered in ASCII art with connecting lines, show-

ing trait inheritance, marriage alliances, and hereditary grudges.

Map Atlases. Rendered world maps at multiple time points showing territorial

changes. A “time-lapse atlas” shows the rise and fall of empires as a sequence

of snapshots.

Religious Texts. In-world holy books with doctrines, creation myths, prophe-

cies, and moral codes — generated from the actual events of the simulation and

filtered through the biases of the religion’s theologians.

Grimoires. Collections of spells organized by school, creator, and era — a

magical textbook from within the simulation world.

Cultural Guides. Descriptions of art styles, musical traditions, literary move-

ments, fashion, cuisine, and social customs for each civilization.

```

```

16.2 Export Formats

```

\- Plain text files (preserving ASCII art formatting)

\- HTML documents with CSS styling matching the terminal aesthetic

\- JSON/XML data for external analysis and tool integration



\## 17. Performance Architecture



```

17.1 Core Optimizations

```

\*\*Spatial Partitioning.\*\* A quadtree data structure indexes all geographically-

located entities, enabling eﬀicient nearest-neighbor queries, range queries, and

“what is near this location” lookups. The quadtree is rebuilt incrementally each

tick for moved entities.

\*\*Event Queue Prioritization.\*\* The event queue is a priority queue (binary

heap) ordered by significance, ensuring that the most important events are pro-

cessed first and that processing time is spent on events that matter.

\*\*Historical Data Compression.\*\* Older events are progressively compressed

— recent events keep full detail, events from decades ago keep moderate de-

tail, events from centuries ago keep only significance, category, and participant

summaries. This prevents the event log from growing unboundedly.





```

Object Pooling. Frequently created and destroyed objects (events, tem-

porary calculations, query results) are drawn from pools rather than

allocated/deallocated, reducing garbage collection pressure.

Lazy Evaluation. Entity state that is not currently being queried or simulated

is stored in compact form and only expanded when needed. A character in the

Background LoD zone does not have their full decision tree evaluated — they

only have it evaluated when they are involved in a significant event or when the

player inspects them.

```

```

17.2 Memory Budget Targets

```

\- Small (200×200) world: < 500MB RAM, simulation speed target: 10,000×

&nbsp;   real-time

\- Medium (400×400) world: < 1.5GB RAM, simulation speed target:

&nbsp;   5,000× real-time

\- Large (800×800) world: < 4GB RAM, simulation speed target: 1,000×

&nbsp;   real-time

\- Epic (1600×1600) world: < 8GB RAM, simulation speed target: 200×

&nbsp;   real-time

These are targets for fast-forward simulation speed. Normal play speed (1

day/second) should be effortless on all world sizes.



\## 18. Extended Design Concepts



\*\*18.1 The Dreaming Layer\*\*

Beyond conscious decisions, characters have a subconscious \*\*Dreaming Layer\*\*

that processes their experiences during “sleep.” Each night (each tick), charac-

ters with high emotional memory loads have a chance to “dream.” Dreams are

not displayed in the event log by default, but they influence the character’s next

day’s decision-making.

Dreams can resolve conflicting goals (a character torn between loyalty and am-

bition might dream a scenario where both are satisfied, reducing internal stress),

reinforce fears (a character with traumatic memories might dream of the trauma,

increasing anxiety-related behavior), or generate creative inspiration (a scholarly

character might dream of a novel connection between ideas, which translates to

a research breakthrough).

The player can spend influence points to send a specific dream to a character

— this is the “prophetic dream” intervention, but mechanically it works by

inserting content into the Dreaming Layer that the character processes as if it

were natural.





```

18.2 The Acoustic/Musical Layer (Web Frontend)

For a future web-based frontend, the simulation can generate procedural ambi-

ent soundscapes reflecting the current world state. Peaceful eras produce gentle,

consonant tones with slow tempos. Wartime shifts to dissonant, percussive pat-

terns with faster tempos. Magical events trigger ethereal, otherworldly sounds.

Major events can have musical “stingers” — short melodic phrases that mark

their occurrence.

The system would use Tone.js to generate these soundscapes in real-time, with

the following mapping: - Base harmony: determined by the dominant faction’s

cultural “mood” - Tempo: determined by simulation speed and event density

```

\- Instrumentation: determined by technology level (primitive drums for Stone

&nbsp;   Age, full orchestration for Renaissance) - Dissonance: proportional to conflict

&nbsp;      intensity - Magic motif: a recurring melodic fragment that appears whenever

&nbsp;      magical events occur, growing more prominent as magic prevalence increases



```

18.3 Character Introspection Mode

When the player selects a character and enters Introspection Mode, the narra-

tive engine generates first-person internal monologue reflecting the character’s

current mental state. The player reads the character’s thoughts, worries, ambi-

tions, and memories as an inner stream-of-consciousness.

This mode uses the character’s personality traits, active goals, emotional mem-

ory weight, and current context to generate text that “sounds like” the character

would think. An ambitious but patient character thinks in long-term strategic

terms. An impulsive and passionate character thinks in vivid emotional images.

A scholarly character thinks in analytical frameworks.

Introspection Mode is the deepest level of inspection available and is most effec-

tive with characters who have rich histories and complex inner lives.

```

```

18.4 The Oral Tradition System

```

```

Before writing is invented (or in illiterate cultures), knowledge and history are

transmitted through oral tradition. Oral traditions are modeled as memes that

propagate through social networks with high mutation rates. A heroic deed per-

formed by a character named Bryn might, after 200 years of oral retelling, have

transformed into the legend of “Bryngar the Invincible” who single-handedly

defeated a dragon army — bearing only a distant resemblance to the actual

event recorded in the event log.

When writing is later invented and scholars attempt to record oral traditions,

they capture the distorted version. This means that the “historical record”

within the simulation might contain fantastical accounts of mundane events,

which the Unreliable Chronicler system faithfully reproduces.

```



The player can trace the evolution of an oral tradition from the original event

to its final legendary form, watching each retelling add embellishments.



```

18.5 The Artifact Consciousness System

Suﬀiciently powerful artifacts are not passive objects — they develop a rudi-

mentary form of agency. An artifact forged during an event of extreme magical

significance absorbs some of the emotional and magical energy of that moment,

creating an “artifact personality” that subtly influences its wielder.

```

A sword forged in vengeance whispers (metaphorically) toward violence. A

crown created during a golden age of prosperity inclines its wearer toward wis-

dom and generosity. A grimoire written by a paranoid wizard makes its reader

slightly more suspicious.



The influence is subtle and operates through the Character AI system — a

character possessing a strongly-willed artifact has their personality trait scores

slightly modified in the direction of the artifact’s personality. The character

might not even realize they are being influenced.



Artifacts can also “reject” wielders whose personality is fundamentally incom-

patible with the artifact’s nature. A holy sword might become unusable (or

actively harmful) in the hands of a cruel tyrant.



```

18.6 The Ecological Pressure System

```

The natural world is not merely a backdrop — it is an active participant in the

simulation. Ecological pressure creates historical events:



\- Overhunting depletes animal populations, reducing food supply and driv-

&nbsp;   ing migration.

\- Deforestation for building material reduces rainfall (simplified climate

&nbsp;   model), potentially turning farmland to scrubland.

\- Mining operations can trigger geological instability.

\- Magical pollution from intense magical activity creates “blighted zones”

&nbsp;   where flora and fauna mutate.

\- Introduction of invasive species (through trade or exploration) can collapse

&nbsp;   local ecosystems.

\- Dragon territories create dead zones that civilization cannot expand into

&nbsp;   without military action.



These ecological dynamics create constraints and opportunities that drive civi-

lization in directions that pure politics and economics would not.



\*\*18.7 The Treaty System\*\*

Beyond simple “alliance” or “war” states, factions can negotiate complex treaties

with specific terms: - Mutual defense pacts (attack one, fight both) - Trade





```

exclusivity agreements (we trade only with each other for this resource) - Non-

aggression pacts (we agree not to attack, but are not allies) - Tributary relation-

ships (weaker faction pays stronger for protection) - Demilitarized zones (both

sides withdraw troops from border region) - Cultural exchange programs (shared

technology/knowledge development) - Marriage contracts (specific terms about

succession and inheritance)

Treaties have terms that can be violated, and violations produce diplomatic

crises. A faction that frequently violates treaties develops a “treacherous” diplo-

matic reputation that makes future negotiations harder.

```

```

18.8 The Secret Knowledge System

```

```

Some information in the simulation is hidden — not just from the player, but

from most characters. Secret knowledge includes: the true identity of a disguised

character, the location of a hidden artifact, a faction’s real military strength

(as opposed to their perceived strength), a prophecy known only to a specific

religious order, a discovered weakness of a powerful entity, and conspiracy plots

not yet enacted.

Secret knowledge has a revelation probability that increases over time and

with proximity to related events. A conspiracy is more likely to be discovered

if the conspirators are careless, if a skilled spymaster is investigating, or if one

conspirator is captured and interrogated.

When secret knowledge is revealed, it creates a high-significance event that

cascades through multiple domains — political alliances shift, personal relation-

ships rupture, military strategies change, and the narrative engine produces

dramatic “the truth comes out” prose.

```

```

End of Game Design Document — Version 2.0

```

\_This document defines the design intent and system architecture for the Fantasy

World Simulator. The companion Implementation Guide breaks these designs

into concrete development tasks for Claude Code in VS Code.\_







