# Context View: Polymorphic Inspector System -- UX Architecture

## Table of Contents
1. [Design Philosophy](#1-design-philosophy)
2. [Shared Components](#2-shared-components)
3. [Character Inspector](#3-character-inspector)
4. [Faction Inspector](#4-faction-inspector)
5. [Event Inspector](#5-event-inspector)
6. [Region Inspector](#6-region-inspector)
7. [Site Inspector](#7-site-inspector)
8. [Navigation System](#8-navigation-system)
9. [Empty State and Transitions](#9-empty-state-and-transitions)
10. [Implementation Integration](#10-implementation-integration)

---

## 1. Design Philosophy

### Problem Statement

The current inspector renders data dumps: `Health: 80/100 (80%)`, `Faction: #42`,
`Grudges: #17: betrayal (severity: 78)`. This is functional but dead -- it reads
like a database printout, not like peeking into a living world.

### Guiding Principles

**Prose-First, Data-Available.** Every section opens with a narrative sentence that
synthesizes the raw data into atmospheric text. The numbers remain accessible beneath
the prose for players who want precision, but the first impression is always a story.

**Every Name is a Door.** Any entity reference in the inspector -- a character name,
a faction, a location, an artifact, an event -- is a clickable link colored in
`#88AAFF` (ENTITY_NAME_COLOR). Clicking it navigates the inspector to that entity.
The player should feel like they are exploring a wiki of their own emergent world.

**Layered Depth.** Section headers show a one-line summary. Expanding reveals full
prose. Within expanded sections, sub-entities can be drilled into further. Three
layers: glimpse (collapsed) -> narrative (expanded) -> deep dive (click-through).

**Consistent Polymorphic Shell.** All entity types share the same chrome: header bar,
breadcrumb trail, section accordion pattern, and footer hints. The content within
the shell varies by entity type, but the interaction model is uniform.

**Respect the Chronicler.** Where possible, use the narrative engine's existing
templates and tones to generate inspector prose. A scholarly-tone player should see
the inspector text adapt accordingly. This connects the inspector to the Unreliable
Chronicler system.

---

## 2. Shared Components

### 2.1 Header Bar

The header is the anchor of every inspector view. It identifies what the player is
looking at and provides orientation.

```
+-- CHARACTER -----------------------------------------------+
|  * Thorin Ironhand, the Unyielding                        |
|  Warlord of the Iron Confederacy  |  Year 247, Age 63     |
|  < Back   Thorin > Ironhold > [Event #841]    Forward >   |
+------------------------------------------------------------+
```

**Structure:**

```
Line 1:  [TypeIcon] [TypeLabel] ---- (horizontal rule fills width)
Line 2:  [EntityName], [Epithet/Title]
Line 3:  [OneLinerSummary]  |  [TemporalContext]
Line 4:  [< Back]  [Breadcrumb > Trail > Current]  [Forward >]
Line 5:  ============================================ (divider)
```

**Type Icons (ASCII-safe):**

| Entity Type | Icon | Color       |
|-------------|------|-------------|
| Character   | `@`  | `#88AAFF`   |
| Faction     | `&`  | `#FF8844`   |
| Event       | `!`  | Category    |
| Region      | `~`  | `#44CC88`   |
| Site        | `#`  | `#FFDD00`   |
| Artifact    | `*`  | `#FF00FF`   |

**One-Liner Summary** is a single prose sentence generated from the entity's most
salient current state. Examples:

- Character: "A battle-hardened warlord who commands the loyalty of thousands"
- Faction: "A sprawling empire built on iron and ambition, straining at its borders"
- Event: "A betrayal that shattered a decades-old alliance"
- Region: "Wind-scoured highlands where three factions contest every ridge"
- Site: "A fortified trading city at the crossroads of two empires"

**Temporal Context** shows where this entity sits in time:

- Character: `Year 247, Age 63` or `Year 247 (Deceased Y241)`
- Faction: `Est. Year 89 (158 years)` or `Est. Year 89 (Dissolved Y230)`
- Event: `Year 183, Spring` with significance dot
- Region: _(no temporal context -- regions are timeless)_
- Site: `Pop. 12,400 (City)` or `Founded Year 34`

### 2.2 Section Accordion

All inspectors use collapsible sections with the following pattern:

```
  v [1] The Story So Far                          12 events
    Born in the mountain-hold of Kazad-dum to a family of miners,
    Thorin showed early promise with blade and bellows both. His
    father's death at the hands of orcish raiders set him on a path
    of vengeance that would reshape the northern frontier...

    (Press Enter for full timeline)

  > [2] Character & Temperament                    5 traits
  > [3] Bonds & Rivalries                          8 relations
  > [4] Worldly Standing                           Warlord
```

**Section Header Format:**
```
[ExpandIcon] [NumberKey] [SectionTitle]              [SummaryHint]
```

Where:
- `ExpandIcon`: `v` (expanded) or `>` (collapsed)
- `NumberKey`: `[1]` through `[9]` for keyboard toggle
- `SectionTitle`: Prose-style section name (not "Attributes" but "Strengths & Flaws")
- `SummaryHint`: A compact summary visible even when collapsed. This is critical --
  it lets players decide what to expand without clicking everything.

**Summary Hints by Section Type:**

| Hint Type    | Example                        |
|--------------|--------------------------------|
| Count        | `8 relations`                  |
| Status word  | `Warlord`                      |
| Key value    | `Treasury: 14,200`             |
| Prose snippet| `"Bitter enemies with..."`     |
| Bar          | `[====------]`                 |

### 2.3 Clickable Entity References

Entity names within prose and data sections are rendered as clickable spans.

**Rendering:**
```
{#88AAFF-fg}Thorin Ironhand{/}
```

**Tracking:**
Each inspector maintains an `entitySpans` map identical to the event-log-panel
pattern:

```typescript
Map<number, Array<{ startCol: number; endCol: number; entityId: EntityId }>>
```

Row number maps to an array of spans on that row. On click, the inspector checks
if the click coordinate falls within any span, and if so, navigates to that entity.

**Visual Cue:** Entity names are rendered in `#88AAFF` (blue) to signal
clickability. On hover (if terminal supports it), an underline could appear, but
this is not required given blessed's limitations.

### 2.4 Footer Hint Bar

A persistent hint bar at the bottom of the inspector shows context-sensitive controls.

```
  [1-9] Toggle sections  [Bksp] Back  [o/r/t/d] Mode  [g] Go to map
```

This bar changes based on entity type:

- Character: `[g] Go to location  [b] Bookmark`
- Faction: `[g] Go to capital  [h] View heraldry`
- Event: `[c] Cascade chain  [v] Vignette`
- Region: `[g] Center map  [f] Filter factions`
- Site: `[g] Center map  [p] View population`

### 2.5 Prose Generation Strategy

For each section, prose is generated using this priority:

1. **Narrative template output** -- if the NarrativeEngine has produced prose for a
   relevant event, use it directly.
2. **Synthesized prose** -- combine ECS component data into a generated sentence
   using lookup tables (similar to BIOME_PROSE and DOMAIN_PROSE patterns).
3. **Structured fallback** -- if no prose generator exists, display formatted data
   with labels.

Example synthesis for character health:

```typescript
const HEALTH_PROSE: Record<string, string> = {
  perfect:  'is in the prime of health',
  healthy:  'bears no significant wounds',
  injured:  'nurses injuries from recent conflict',
  wounded:  'suffers from grievous wounds',
  critical: 'clings to life by a thread',
  dead:     'has passed beyond the veil',
};
```

Sentence: `"Thorin nurses injuries from recent conflict, though his iron will
keeps him standing."` (combining health state + personality trait).

---

## 3. Character Inspector

### 3.1 Section Breakdown

| # | Section Title              | Summary Hint    | Data Sources                       |
|---|----------------------------|-----------------|------------------------------------|
| 1 | The Story So Far           | `N events`      | EventLog.getByEntity, Memory       |
| 2 | Strengths & Flaws          | top trait        | Attribute, Personality, Traits     |
| 3 | Bonds & Rivalries          | `N relations`   | Relationship, Grudges, Membership  |
| 4 | Worldly Standing           | rank/title      | Status, Membership, Wealth         |
| 5 | Heart & Mind               | top goal         | Goal, Personality                  |
| 6 | Remembered Things          | `N memories`    | Memory                             |
| 7 | Possessions & Treasures    | wealth summary  | Possession, Wealth                 |

### 3.2 Information Hierarchy

**Most Important (always visible in header):**
- Name, epithet, titles
- Current faction allegiance (clickable)
- Alive/dead status with age
- One-sentence character summary

**Important (expanded by default):**
- The Story So Far (life narrative)
- Strengths & Flaws (personality snapshot)

**Secondary (collapsed by default):**
- Bonds & Rivalries
- Worldly Standing
- Heart & Mind
- Remembered Things
- Possessions & Treasures

### 3.3 Detailed Section Designs

#### Section 1: The Story So Far

Generates a narrative biography from the character's event history, structured as a
mini-chronicle.

```
  v [1] The Story So Far                              12 events
    Born in the mountain-hold of Kazad-dum in Year 184, Thorin was
    the son of Durin the Steadfast and Helga Stonesinger. His early
    years were shaped by the War of Broken Passes, which claimed
    his father's life when Thorin was only fourteen.

    In Year 206, he rallied the scattered clans of the Iron Hills
    and founded the Iron Confederacy, a feat that earned him the
    title "the Unyielding." His betrayal by Azog the Pale in Year
    231 became a turning point -- from that day forward, Thorin
    trusted no one beyond his inner circle.

    Most recently, he led the siege of Erebor (Year 245), a
    campaign that has reshaped the balance of power in the north.

    Key moments:
      ! Y206 Founded the Iron Confederacy        {clickable}
      ! Y231 Betrayed by Azog the Pale            {clickable}
      ! Y245 Led the Siege of Erebor              {clickable}

    (12 events total -- press 't' for full timeline)
```

**Implementation approach:**
- Pull all events from EventLog.getByEntity()
- Sort by timestamp ascending
- Group by significance: show only sig >= 50 events in the prose summary
- Use NarrativeEngine to generate a "life story" template (new template type)
- Key moments list uses event subtypes resolved through SHORT_NARRATIVE_MAP
- Each key moment is clickable (opens Event Inspector)

#### Section 2: Strengths & Flaws

Replaces the raw attribute bars with prose-first personality portrait.

```
  v [2] Strengths & Flaws                           Cunning
    A mind as sharp as forged steel -- Thorin's intelligence and
    wisdom far exceed his physical gifts. Though no great warrior
    in raw strength, his tactical cunning has won more battles than
    any blade.

    He is deeply conscientious and driven, but his low agreeableness
    makes him a difficult ally. Those who know him speak of a man
    consumed by purpose, leaving little room for warmth.

    Attributes:
      STR [=====-----------] 5    INT [===============----] 16
      AGI [========--------] 8    WIS [=============------] 14
      END [==========------] 10   CHA [========-----------] 9

    Traits:  Cunning  |  Stubborn  |  Ambitious  |  Vengeful
```

**Implementation approach:**
- Generate prose from Personality (Big Five) + Attribute + Traits components
- Personality synthesis: map Big Five values to descriptive phrases
- Attribute bars remain but are secondary to the narrative paragraph
- Traits displayed as a compact tag row

**Prose generation for Big Five:**

```typescript
const PERSONALITY_AXIS: Record<string, [string, string]> = {
  openness:          ['traditional and set in their ways', 'endlessly curious and open to new ideas'],
  conscientiousness: ['free-spirited and spontaneous', 'methodical and disciplined'],
  extraversion:      ['reserved and introspective', 'gregarious and commanding'],
  agreeableness:     ['sharp-tongued and confrontational', 'gentle and accommodating'],
  neuroticism:       ['unnervingly calm under pressure', 'prone to anxiety and dark moods'],
};
```

Values < 30 use the left descriptor, > 70 use the right, 30-70 are moderate.

#### Section 3: Bonds & Rivalries

```
  v [3] Bonds & Rivalries                          8 relations
    Thorin's world is defined by fierce loyalties and bitter enmities.

    ALLIES:
      & Iron Confederacy ......... Warlord (leader)     {clickable}
      @ Balin Broadshield ........ Trusted Advisor [+82] {clickable}
      @ Dwalin the Fierce ........ Shield-Brother  [+91] {clickable}

    RIVALS:
      @ Azog the Pale ............ Blood Enemy    [-95]  {clickable}
      & Goblin Horde ............. At War         [-88]  {clickable}

    FAMILY:
      @ Dis Ironhand ............. Sister          [+74] {clickable}
      @ Fili ..................... Nephew          [+68] {clickable}

    2 grudges burn in his memory:
      Azog slew his father (severity: 95)
      The Elvenking refused aid at Erebor (severity: 72)
```

**Implementation approach:**
- Categorize relationships by type: family, ally, rival, neutral
- Sort within category by affinity (descending for allies, ascending for rivals)
- Dotted leaders connect name to relationship label for visual rhythm
- Affinity values in brackets: `[+82]` or `[-95]`
- Grudges listed separately with prose description
- Every entity name is clickable

#### Section 4: Worldly Standing

```
  > [4] Worldly Standing                           Warlord
    Thorin holds the rank of Warlord within the Iron Confederacy.
    His personal wealth amounts to 3,400 gold, supplemented by
    property valued at 12,000 -- a fortune befitting his station.

    He resides in the fortress-city of Ironhold, capital of the
    Iron Confederacy.

    Social Class: Noble      Rank: Warlord
    Wealth: 3,400 gold       Property: 12,000
    Location: Ironhold (Iron Confederacy)         {clickable}
```

#### Section 5: Heart & Mind

```
  > [5] Heart & Mind                               Reclaim Erebor
    Three ambitions drive Thorin forward:

    !!! Reclaim the ancestral halls of Erebor       (priority: 95)
    !!  Destroy Azog the Pale and avenge his father (priority: 78)
    !   Secure lasting peace for the Iron Confederacy (priority: 55)

    His dreams have grown darker of late -- visions of golden halls
    haunted by flame.
```

**Implementation approach:**
- Goals from Goal component, sorted by priority
- Integrate DreamingSystem output if available
- Priority shown as urgency markers: `!!!` / `!!` / `!`

#### Section 6: Remembered Things

```
  > [6] Remembered Things                          14 memories
    Thorin carries 14 memories, 3 of which have grown distorted
    with time.

    Strongest memories:
      ! The Battle of Broken Passes (imp: 95)       {clickable}
      ! Founding the Iron Confederacy (imp: 90)     {clickable}
      ! Azog's Betrayal (imp: 88, distorted)        {clickable}

    3 memories have faded beyond recognition.
```

**Implementation approach:**
- Memory component provides importance + distortion values
- Distorted memories flagged explicitly (distortion > 50)
- Memory references are clickable and navigate to the Event Inspector
- Faded memories (low importance) summarized as a count

### 3.4 Sample Full Layout

```
+-- @ CHARACTER ---------------------------------------------+
|  Thorin Ironhand, the Unyielding                           |
|  Warlord of the Iron Confederacy  |  Year 247, Age 63     |
|  < Back   [World] > Iron Conf. > Thorin    Forward >       |
|============================================================|
|                                                            |
|  v [1] The Story So Far                       12 events    |
|    Born in Year 184 to Durin the Steadfast, Thorin's       |
|    youth was forged in the fires of the War of Broken      |
|    Passes. His father's death drove him to unite the       |
|    scattered clans...                                      |
|                                                            |
|    Key moments:                                            |
|      ! Y206 Founded the Iron Confederacy                   |
|      ! Y231 Betrayed by Azog the Pale                      |
|                                                            |
|  v [2] Strengths & Flaws                       Cunning     |
|    A mind as sharp as forged steel...                      |
|                                                            |
|    STR [=====-----------]  INT [===============----]       |
|    AGI [========--------]  WIS [=============------]       |
|    END [==========------]  CHA [========-----------]       |
|                                                            |
|  > [3] Bonds & Rivalries                    8 relations    |
|  > [4] Worldly Standing                     Warlord        |
|  > [5] Heart & Mind                         Reclaim Erebor |
|  > [6] Remembered Things                    14 memories    |
|  > [7] Possessions & Treasures              3,400 gold     |
|                                                            |
|------------------------------------------------------------|
|  [1-7] Sections  [Bksp] Back  [t] Timeline  [g] Location  |
+------------------------------------------------------------+
```

### 3.5 Interaction Patterns

| Input     | Action                                        |
|-----------|-----------------------------------------------|
| `1`-`7`   | Toggle section expand/collapse                |
| `Up/Down` | Scroll content                                |
| `Left`    | Navigate back in history                      |
| `Right`   | Navigate forward in history                   |
| `t`       | Switch to full timeline mode                  |
| `r`       | Switch to relationships mode                  |
| `g`       | Center map on character's location             |
| `Enter`   | Inspect entity under cursor (if applicable)   |
| `Click`   | Click on any `#88AAFF` name to navigate       |

---

## 4. Faction Inspector

### 4.1 Section Breakdown

| # | Section Title              | Summary Hint      | Data Sources                    |
|---|----------------------------|--------------------|---------------------------------|
| 1 | Rise & Reign               | `N years old`      | Origin, History, EventLog       |
| 2 | Banner & Creed             | heraldry preview   | Culture, Doctrine, Heraldry     |
| 3 | Lands & Holdings           | `N regions`        | Territory, Position             |
| 4 | Court & Council            | leader name        | Hierarchy, Membership           |
| 5 | Swords & Shields           | strength value     | Military                        |
| 6 | Alliances & Enmities       | `N relations`      | Diplomacy                       |
| 7 | Coffers & Commerce         | treasury value     | Economy, Wealth                 |
| 8 | Chronicles                 | `N events`         | EventLog                        |

### 4.2 Information Hierarchy

**Most Important (always visible in header):**
- Faction name and type (Kingdom, Republic, Tribal Confederacy, etc.)
- Total population
- Founding year and age
- One-sentence faction summary

**Important (expanded by default):**
- Rise & Reign (founding narrative, current situation)
- Banner & Creed (heraldry + cultural identity)
- Court & Council (who leads, key figures)

**Secondary (collapsed by default):**
- Lands & Holdings
- Swords & Shields
- Alliances & Enmities
- Coffers & Commerce
- Chronicles

### 4.3 Detailed Section Designs

#### Section 1: Rise & Reign

```
  v [1] Rise & Reign                            158 years old
    The Iron Confederacy was forged in Year 89 by Durin the
    Steadfast, who united the squabbling mountain clans through
    a combination of military prowess and political cunning.
    Founded at the stronghold of Kazad-dum, the Confederacy has
    grown from a defensive pact into the dominant power of the
    northern mountains.

    Under Thorin Ironhand's current leadership, the Confederacy
    has entered an aggressive phase of expansion, laying claim
    to the recaptured halls of Erebor and challenging the
    Elvenking's territorial claims.

    Government: Meritocratic Oligarchy
    Stability:  [=============------] 72%
    Legitimacy: [===========--------] 61%
```

**Implementation approach:**
- Combine Origin component (foundingTick, founderId, foundingLocation) with
  Government component (type, stability, legitimacy)
- Generate opening paragraph from founding event + current situation
- Reference founder (clickable) and founding location (clickable)
- Government type, stability, legitimacy bars shown after prose

#### Section 2: Banner & Creed

```
  v [2] Banner & Creed                          [Shield Icon]
           /\
          /  \
         / ** \
        / *  * \
       /========\
       |  IRON  |
       | HAMMER |
       |________|

    "Azure, a hammer argent between two stars or"

    The Iron Confederacy values strength, industry, and loyalty
    above all else. Their martial traditions demand that every
    citizen serve at least two years in the shield-wall.

    Guiding Principles:
      * Industrious     * Militaristic     * Isolationist
```

**Implementation approach:**
- Reuse existing heraldry generation (generateCoatOfArms, renderLargeCoatOfArms,
  describeCoatOfArms)
- Add prose paragraph synthesized from Culture.values and Doctrine.beliefs
- Display values/principles as compact tag row

#### Section 3: Lands & Holdings

```
  v [3] Lands & Holdings                          12 regions
    The Confederacy controls 12 regions spanning the northern
    mountain ranges, from the Iron Hills in the east to the
    Misty Peaks in the west.

    Capital: Ironhold (pop. 24,000)               {clickable}

    Major Settlements:
      # Ironhold ........... Capital, City          {clickable}
      # Kazad-dum .......... Fortress, City         {clickable}
      # Stonegate ........... Town (pop. 3,200)     {clickable}
      # Hammerfall .......... Town (pop. 2,100)     {clickable}

    Contested Borders:
      ~ The Dimholt Pass ... disputed with Elvenking {clickable}
```

**Implementation approach:**
- Territory component for region count and capital
- Cross-reference settlements by querying entities with Ownership.ownerId matching
  this faction's EntityId
- Sort settlements by population descending
- Contested borders from Diplomacy component (relations with negative values)
- Each settlement and region name is clickable

#### Section 4: Court & Council

```
  v [4] Court & Council                          Thorin Ironhand
    @ Thorin Ironhand ........ Warlord (Leader)    {clickable}
    @ Balin Broadshield ...... Grand Advisor       {clickable}
    @ Dain Ironfoot .......... War Marshal         {clickable}
    @ Ori the Scribe ......... Lorekeeper          {clickable}
    @ Bombur the Wide ........ Master of Coin      {clickable}

    And 47 other members of note.
```

**Implementation approach:**
- Hierarchy.leaderId provides the leader (clickable)
- Hierarchy.subordinateIds provides the council
- Resolve names through EntityResolver
- Show top 5-10 by rank, summarize remainder

#### Section 5: Swords & Shields

```
  > [5] Swords & Shields                         12,000 strong
    The Confederacy fields a standing army of 12,000, famed for
    their heavy infantry and dwarven shield-wall tactics.

    Total Strength: 12,000
    Morale:   [===============-----] 78%
    Training: [=================---] 85%

    Active Conflicts:
      ! War against the Goblin Horde (Year 244-present)
      ! Siege of Erebor (Year 245-present)
```

#### Section 6: Alliances & Enmities

```
  > [6] Alliances & Enmities                     5 relations
    ALLIES:
      & Kingdom of Dale .......... Allied    [+82]  {clickable}
      & Woodland Traders ......... Friendly  [+54]  {clickable}

    ENEMIES:
      & Goblin Horde ............. At War    [-95]  {clickable}
      & Dark Sorcerer's Domain ... Hostile   [-72]  {clickable}

    NEUTRAL:
      & Elvenking's Realm ........ Wary      [-15]  {clickable}

    Treaties:
      * Trade pact with Kingdom of Dale (est. Year 220)
      * Non-aggression pact with Woodland Traders (est. Year 238)
```

### 4.4 Sample Full Layout

```
+-- & FACTION -----------------------------------------------+
|  The Iron Confederacy                                      |
|  Meritocratic Oligarchy  |  Est. Year 89 (158 years)      |
|  < Back   [World] > Iron Confederacy       Forward >       |
|============================================================|
|                                                            |
|  v [1] Rise & Reign                       158 years old    |
|    Forged in Year 89 by Durin the Steadfast, who united    |
|    the squabbling mountain clans...                        |
|                                                            |
|    Government: Meritocratic Oligarchy                      |
|    Stability:  [=============------] 72%                   |
|    Legitimacy: [===========--------] 61%                   |
|                                                            |
|  v [2] Banner & Creed                      [Shield]        |
|    (heraldry art and description)                          |
|                                                            |
|  v [3] Court & Council                 Thorin Ironhand     |
|    @ Thorin Ironhand ......... Warlord (Leader)            |
|    @ Balin Broadshield ....... Grand Advisor               |
|                                                            |
|  > [4] Lands & Holdings                    12 regions      |
|  > [5] Swords & Shields                   12,000 strong    |
|  > [6] Alliances & Enmities               5 relations     |
|  > [7] Coffers & Commerce                 14,200 gold      |
|  > [8] Chronicles                          34 events       |
|                                                            |
|------------------------------------------------------------|
|  [1-8] Sections  [Bksp] Back  [h] Heraldry  [g] Capital   |
+------------------------------------------------------------+
```

### 4.5 Interaction Patterns

| Input     | Action                                        |
|-----------|-----------------------------------------------|
| `1`-`8`   | Toggle section expand/collapse                |
| `Up/Down` | Scroll content                                |
| `Left`    | Navigate back in history                      |
| `Right`   | Navigate forward in history                   |
| `h`       | Toggle heraldry fullscreen view               |
| `g`       | Center map on faction capital                  |
| `r`       | Switch to diplomacy mode (full relations)     |
| `Click`   | Click any `#88AAFF` name to navigate          |

---

## 5. Event Inspector

### 5.1 Design Rationale

The Event Inspector is new -- it does not exist in the current codebase. Currently
events are shown in the right pane of the EventLogPanel, but without deep inspection
capability. The Event Inspector transforms a single event into a full narrative page.

### 5.2 Section Breakdown

| # | Section Title              | Summary Hint       | Data Sources                   |
|---|----------------------------|--------------------|---------------------------------|
| 1 | What Happened              | prose narrative     | NarrativeEngine, event.data    |
| 2 | Who Was Involved           | `N participants`   | event.participants, Resolver   |
| 3 | Where & When               | location + date     | event.location, event.timestamp|
| 4 | Why It Matters             | significance label  | event.significance             |
| 5 | What Came Before           | `N causes`         | event.causes                   |
| 6 | What Followed              | `N consequences`   | event.consequences             |

### 5.3 Information Hierarchy

**Most Important (always visible in header):**
- Event narrative title (from NarrativeEngine output)
- Category icon and color
- Significance level (word label + colored dot)
- Date (Year X, Season)

**Important (expanded by default):**
- What Happened (full narrative prose)
- Who Was Involved (participant list, all clickable)
- Where & When (location clickable, map link)

**Secondary (collapsed by default):**
- Why It Matters (significance analysis, historical context)
- What Came Before (causal chain -- upstream events)
- What Followed (consequence chain -- downstream events)

### 5.4 Detailed Section Designs

#### Section 1: What Happened

```
  v [1] What Happened
    -- The Betrayal at Dimholt Pass --

    In the spring of Year 231, as the armies of the Iron Confederacy
    marched through the narrow defiles of Dimholt Pass, Azog the
    Pale -- until that moment a trusted war-captain serving under
    Thorin's banner -- turned his forces against his own allies.

    The ambush was devastating. Caught between the canyon walls and
    Azog's rearguard, nearly a thousand Confederate soldiers fell
    before Thorin managed to rally a fighting retreat. The pass
    was lost, and with it, three years of hard-won territorial gains.

    This event was chronicled differently by various sources:
      * The Confederate annals call it "The Great Treachery"
      * Azog's followers speak of "The Reckoning"
      * Neutral scholars record it as "The Dimholt Incident"
```

**Implementation approach:**
- Use NarrativeEngine.generate() with the selected event to produce full prose
- If ChroniclerBiasFilter is active, show multiple perspectives
- Title comes from NarrativeOutput.title
- Body comes from NarrativeOutput.body
- If LostHistoryTracker marks this event as partially lost, show a "fragmentary"
  qualifier

#### Section 2: Who Was Involved

```
  v [2] Who Was Involved                        4 participants
    PRIMARY:
      @ Thorin Ironhand .......... Victim / Commander  {clickable}
      @ Azog the Pale ............ Betrayer            {clickable}

    SECONDARY:
      & Iron Confederacy ......... Faction affected     {clickable}
      # Dimholt Pass ............. Location             {clickable}

    Also referenced:
      @ Dwalin the Fierce ........ Survivor             {clickable}
```

**Implementation approach:**
- event.participants provides EntityIds
- Resolve each through EntityResolver to get names
- Categorize into PRIMARY (first 1-2 participants) and SECONDARY (rest)
- Also scan event.data for additional entity references (factionId, locationId,
  artifactId fields)
- Every name is clickable, navigates to that entity's inspector

#### Section 3: Where & When

```
  v [3] Where & When
    Location: # Dimholt Pass (Mountain region)    {clickable}
    Date: Year 231, Month 4, Day 12 (Spring)

    [g] Center map on this location

    Coordinates: (34, 67)
    Region: ~ The Northern Marches                {clickable}
```

**Implementation approach:**
- event.location provides SiteId, resolve to name
- event.timestamp converted via ticksToWorldTime()
- "Center map" action available via [g] key
- Location is clickable, opens Site Inspector
- Region derived from position cross-reference

#### Section 4: Why It Matters

```
  > [4] Why It Matters                          Critical
    Significance: [================----] Critical (85)

    This event was one of the most consequential in the region's
    recent history. It triggered a cascade of 7 subsequent events,
    reshaping political boundaries and igniting a war that would
    last for fourteen years.

    Historical impact:
      * Ended the Iron Confederacy's eastern expansion
      * Created the Azog-Thorin blood feud (ongoing)
      * Shifted the balance of power toward the Goblin Horde
```

**Implementation approach:**
- Significance bar (existing formatSignificanceBarColored)
- Count consequences to assess cascade depth
- Generate impact summary from consequence event subtypes
- Use SHORT_NARRATIVE_MAP for consequence descriptions

#### Section 5: What Came Before

```
  > [5] What Came Before                         2 causes
    This event grew from earlier seeds:

      ! Y228 Azog pledged loyalty to Thorin          {clickable}
        (3 years before the betrayal)
      ! Y230 Azog's clan was denied mining rights    {clickable}
        (1 year before -- the proximate cause)

    Cascade depth: 2 (this event was itself caused by earlier events)
```

**Implementation approach:**
- event.causes provides EventIds of upstream events
- Resolve each cause event, show its date and short narrative
- Calculate time delta between cause and this event
- Each cause event is clickable (navigate to its Event Inspector)

#### Section 6: What Followed

```
  > [6] What Followed                           7 consequences
    The ripples of this event spread far:

      ! Y231 Thorin declared war on Azog             {clickable}
        (immediate consequence)
      ! Y231 The Iron Confederacy recalled its armies {clickable}
        (within the same year)
      ! Y232 Dwalin led a punitive expedition         {clickable}
        (Year 232)
      ... and 4 more consequences

    Total cascade depth: 4 (consequences spawned further consequences)
```

**Implementation approach:**
- event.consequences provides EventIds of downstream events
- Show top 5 by significance, summarize rest
- Each consequence is clickable
- Track cascade depth by following consequences of consequences

### 5.5 Sample Full Layout

```
+-- ! EVENT -------------------------------------------------+
|  The Betrayal at Dimholt Pass                              |
|  Military  |  Year 231, Spring  |  * Critical (85)        |
|  < Back   [World] > Iron Conf. > Thorin > [Betrayal]      |
|============================================================|
|                                                            |
|  v [1] What Happened                                       |
|    In the spring of Year 231, as the armies of the Iron    |
|    Confederacy marched through Dimholt Pass, Azog the      |
|    Pale turned his forces against his own allies...        |
|                                                            |
|  v [2] Who Was Involved                    4 participants  |
|    @ Thorin Ironhand ........ Victim / Commander           |
|    @ Azog the Pale .......... Betrayer                     |
|    & Iron Confederacy ....... Faction affected             |
|                                                            |
|  v [3] Where & When                                        |
|    # Dimholt Pass (Mountain)  |  Year 231, Spring          |
|                                                            |
|  > [4] Why It Matters                      Critical (85)   |
|  > [5] What Came Before                    2 causes        |
|  > [6] What Followed                       7 consequences  |
|                                                            |
|------------------------------------------------------------|
|  [1-6] Sections  [Bksp] Back  [c] Cascade view  [v] Story |
+------------------------------------------------------------+
```

### 5.6 Interaction Patterns

| Input     | Action                                        |
|-----------|-----------------------------------------------|
| `1`-`6`   | Toggle section expand/collapse                |
| `Up/Down` | Scroll content                                |
| `Left`    | Navigate back in history                      |
| `Right`   | Navigate forward in history                   |
| `c`       | Switch to cascade visualization mode          |
| `v`       | View vignette (if available)                  |
| `g`       | Center map on event location                   |
| `Click`   | Click any entity/event name to navigate       |

---

## 6. Region Inspector

### 6.1 Design Rationale

The Region Inspector replaces the current RegionDetailPanel's static prose with
an inspectable, clickable, historically layered view of geography. While the
RegionDetailPanel describes terrain, this inspector treats a region as a living
entity with a past, present, and contested future.

### 6.2 Section Breakdown

| # | Section Title              | Summary Hint       | Data Sources                    |
|---|----------------------------|--------------------|---------------------------------|
| 1 | The Land Itself            | biome name          | TerrainTile, BIOME_PROSE       |
| 2 | Riches of the Earth        | `N resources`      | resources[], leyLine            |
| 3 | Those Who Dwell Here       | faction name        | RegionOverlay, SpatialIndex    |
| 4 | Marks Upon the Land        | `N settlements`    | Settlement entities, Position  |
| 5 | Echoes of the Past         | `N events`         | EventLog by location           |
| 6 | Arcane Currents            | ley line status     | leyLine, magic events          |

### 6.3 Information Hierarchy

**Most Important (always visible in header):**
- Region coordinates
- Biome type with atmospheric one-liner
- Controlling faction (if any, clickable)

**Important (expanded by default):**
- The Land Itself (full biome prose, climate, elevation)
- Riches of the Earth (resources available)

**Secondary (collapsed by default):**
- Those Who Dwell Here
- Marks Upon the Land
- Echoes of the Past
- Arcane Currents

### 6.4 Detailed Section Designs

#### Section 1: The Land Itself

```
  v [1] The Land Itself                          Mountain
    Rocky slopes rise above the tree line, wind-scoured and stern.
    Stone and sky meet in a jagged embrace, and the air thins with
    every step upward.

    Conditions:
      ^ Lofty heights command a sweeping view
      * The climate is temperate and mild
      ~ Seasonal rains come and go

    A river winds through this region, carving deep gorges in the
    ancient rock.
```

**Implementation approach:**
- Reuse BIOME_PROSE for the opening paragraph
- Reuse describeElevation(), describeTemperature(), describeRainfall()
- Add river/freshwater prose if tile.riverId is defined
- This section is essentially the current RegionDetailPanel content, elevated
  into the inspector framework

#### Section 2: Riches of the Earth

```
  v [2] Riches of the Earth                      4 resources
    The mountains yield their treasures reluctantly:

      * Veins of iron ore run through the rock
      * Precious gold glints in the earth
      * Quarryable stone lies close to the surface
      * Rare gemstones lie hidden in the deep places

    Those who control this land grow wealthy on its bounty.
```

**Implementation approach:**
- Reuse RESOURCE_PROSE for each resource
- Add a synthesized summary sentence based on resource count and type

#### Section 3: Those Who Dwell Here

```
  > [3] Those Who Dwell Here             Iron Confederacy
    This land falls under the dominion of the Iron Confederacy.

    Controlling Faction:
      & Iron Confederacy ................. Dominant    {clickable}

    Other Factions Present:
      & Goblin Raiding Parties ........... Contested   {clickable}

    Notable Inhabitants:
      @ Dwalin the Fierce ................ Patrol      {clickable}
```

**Implementation approach:**
- RegionOverlayData provides controllingFaction
- SpatialIndex can locate characters/armies in this tile
- Cross-reference faction territories for contested claims
- All entity names clickable

#### Section 4: Marks Upon the Land

```
  > [4] Marks Upon the Land                   2 settlements
    Nearby Settlements:
      # Ironhold ......... Capital, adjacent           {clickable}
      # Stonegate ......... Town, near                 {clickable}

    Points of Interest:
      * Ancient dwarven ruins (unexplored)
      * Watchtower of the Northern March
```

**Implementation approach:**
- RegionOverlayData.nearbySettlements for settlement list
- Points of interest derived from special tile features or historical events
  at this location

#### Section 5: Echoes of the Past

```
  > [5] Echoes of the Past                     6 events
    History has left its scars on this land:

      ! Y231 The Betrayal at Dimholt Pass             {clickable}
      ! Y220 Discovery of the Gold Vein               {clickable}
      ! Y195 The Battle of Stone Ridge                 {clickable}

    And 3 more events in this region's history.
```

**Implementation approach:**
- Query EventLog for events whose location maps to this tile region
- Sort by significance descending
- Show top events with clickable links

#### Section 6: Arcane Currents

```
  > [6] Arcane Currents                        Ley Line Active
    A ley line pulses with arcane energy beneath the earth. The
    concentration of magical power here has attracted scholars and
    sorcerers throughout the ages.

    Recent magical events in this region:
      ! Y240 Arcane surge detected                    {clickable}
```

**Implementation approach:**
- tile.leyLine boolean determines if section appears
- Query EventLog for Magical category events at this location

### 6.5 Sample Full Layout

```
+-- ~ REGION ------------------------------------------------+
|  The Northern Marches (34, 67)                             |
|  Mountain  |  Iron Confederacy territory                   |
|  < Back   [World] > Iron Conf. > Northern Marches          |
|============================================================|
|                                                            |
|  v [1] The Land Itself                         Mountain    |
|    Rocky slopes rise above the tree line, wind-scoured     |
|    and stern. Stone and sky meet in a jagged embrace...    |
|                                                            |
|    ^ Lofty heights command a sweeping view                 |
|    * The climate is temperate and mild                     |
|    ~ A river winds through this region                     |
|                                                            |
|  v [2] Riches of the Earth                   4 resources   |
|    * Veins of iron ore run through the rock                |
|    * Precious gold glints in the earth                     |
|                                                            |
|  > [3] Those Who Dwell Here          Iron Confederacy      |
|  > [4] Marks Upon the Land             2 settlements       |
|  > [5] Echoes of the Past              6 events            |
|  > [6] Arcane Currents               Ley Line Active       |
|                                                            |
|------------------------------------------------------------|
|  [1-6] Sections  [Bksp] Back  [g] Center map              |
+------------------------------------------------------------+
```

### 6.6 Interaction Patterns

| Input     | Action                                        |
|-----------|-----------------------------------------------|
| `1`-`6`   | Toggle section expand/collapse                |
| `Up/Down` | Scroll content                                |
| `Left`    | Navigate back in history                      |
| `g`       | Center map on this region                      |
| `Click`   | Click any entity name to navigate             |

---

## 7. Site (Settlement) Inspector

### 7.1 Section Breakdown

| # | Section Title              | Summary Hint       | Data Sources                    |
|---|----------------------------|--------------------|---------------------------------|
| 1 | A Living Portrait          | settlement type    | Status, Population, Position    |
| 2 | People & Peoples           | pop count          | Population, Demographics, Culture|
| 3 | Power & Governance         | ruler/faction      | Government, Ownership           |
| 4 | Trade & Industry           | wealth level       | Economy, Resource               |
| 5 | Walls & Works              | fortification      | Structures, Condition, Military |
| 6 | Notable Souls              | `N characters`     | SpatialIndex, Membership        |
| 7 | The Annals                 | `N events`         | EventLog, History               |

### 7.2 Information Hierarchy

**Most Important (always visible in header):**
- Settlement name and type (Hamlet/Village/Town/City/Metropolis)
- Population count
- Controlling faction (clickable)
- Founded year

**Important (expanded by default):**
- A Living Portrait (atmospheric overview, current situation)
- People & Peoples (demographics, cultural identity)

**Secondary (collapsed by default):**
- Power & Governance
- Trade & Industry
- Walls & Works
- Notable Souls
- The Annals

### 7.3 Detailed Section Designs

#### Section 1: A Living Portrait

```
  v [1] A Living Portrait                          City
    Ironhold rises from the living rock like a crown of stone and
    iron. Founded in Year 34 by the first dwarven settlers, it has
    grown from a modest mining camp into the beating heart of the
    Iron Confederacy. Its forges never sleep, and the ring of
    hammer on anvil echoes through streets carved into the
    mountainside.

    The city thrives under the leadership of Thorin Ironhand, who
    governs from the Hall of Ancestors. With a population of 24,000,
    Ironhold is the largest settlement in the northern mountains.

    Population: 24,000 (City)
    Growth: +1.2% per year
    Founded: Year 34 (213 years ago)
    Ruling Faction: Iron Confederacy                  {clickable}
```

**Implementation approach:**
- Synthesize opening paragraph from:
  - Settlement size category (getSettlementSize)
  - Biome of the tile at the settlement's position (BIOME_PROSE fragments)
  - Dominant industries from Economy component
  - Founding date from History/Origin component
  - Current leader from Hierarchy cross-reference via owning faction
- Population and growth from Population component
- Founding from History.foundingDate or Origin.foundingTick

**Settlement atmosphere prose generation:**

```typescript
const SETTLEMENT_SIZE_PROSE: Record<string, string> = {
  Hamlet:     'A scattering of homes clustered together',
  Village:    'A modest village where everyone knows their neighbor',
  Town:       'A bustling town at the crossroads of trade',
  City:       'A city of consequence, its walls marking ambition in stone',
  'Large City': 'A great city whose name is known across the realm',
  Metropolis: 'A vast metropolis, teeming with life and intrigue',
};
```

#### Section 2: People & Peoples

```
  v [2] People & Peoples                       24,000 souls
    The people of Ironhold are predominantly dwarven, though a
    growing community of human traders has established a quarter
    near the western gate.

    Population by Race:
      Dwarven ............... 82%  [================----]
      Human ................. 14%  [===                 ]
      Halfling .............. 4%   [=                   ]

    The city's culture is deeply traditional, valuing craftsmanship
    and martial honor above all else. The dwarven tongue remains
    the language of court and commerce.

    Traditions:
      * The Feast of Hammers (annual)
      * Trial by Stone (dispute resolution)

    Cultural Values: Industrious | Martial | Traditional
```

**Implementation approach:**
- PopulationDemographics.raceDistribution for racial breakdown
- Culture.traditions, Culture.values for cultural identity
- Culture.languageId for language (resolve to name)
- Prose paragraph synthesized from dominant race + culture values

#### Section 3: Power & Governance

```
  > [3] Power & Governance                     Thorin Ironhand
    Ironhold is governed as part of the Iron Confederacy, with
    Thorin Ironhand ruling from the Hall of Ancestors.

    Government: Meritocratic Oligarchy
    Stability:  [=============------] 72%
    Legitimacy: [===========--------] 61%
    Claim Strength: [================----] 85%

    Ruling Faction: & Iron Confederacy                {clickable}
    Local Governor: @ Balin Broadshield               {clickable}
```

#### Section 4: Trade & Industry

```
  > [4] Trade & Industry                       Prosperous
    Ironhold's forges produce the finest iron and steel in the
    northern mountains. Its wealth is built on mining and
    metalwork, supplemented by a growing trade in gemstones.

    Treasury: 14,200 gold
    Trade Volume: 8,500 per season

    Industries:
      * Iron Mining (primary)
      * Metalworking (primary)
      * Gemstone Trading (secondary)

    Resources:
      Iron: abundant    Gold: moderate    Gemstones: scarce
```

#### Section 5: Walls & Works

```
  > [5] Walls & Works                          Fortified Walls
    The city's defenses are formidable -- thick stone walls
    reinforced with iron bands, guarding every approach.

    Fortifications: Fortified Walls (Level 4)
    Garrison: 2,400 soldiers
    Morale:   [===============-----] 78%
    Training: [=================---] 85%

    Notable Buildings:
      * Hall of Ancestors (seat of government)
      * The Great Forge (legendary smithy)
      * Temple of the Stone Father
      * Western Gate Market
```

#### Section 6: Notable Souls

```
  > [6] Notable Souls                          8 characters
    Several figures of consequence reside in or near Ironhold:

      @ Thorin Ironhand ........ Warlord               {clickable}
      @ Balin Broadshield ...... Grand Advisor          {clickable}
      @ Dwalin the Fierce ...... War Marshal            {clickable}
      @ Ori the Scribe ......... Lorekeeper             {clickable}

    And 4 others of lesser renown.
```

**Implementation approach:**
- Query entities with Position matching this site's coordinates
- Filter for characters (has Attribute component)
- Sort by social class or faction rank
- Show top characters by importance, summarize rest

#### Section 7: The Annals

```
  > [7] The Annals                              28 events
    Founded: Year 34

    Defining moments:
      ! Y34  The First Stone was laid              {clickable}
      ! Y89  Became capital of the Iron Confederacy {clickable}
      ! Y175 The Great Fire razed the western quarter {clickable}
      ! Y231 Refugees arrived from the Dimholt betrayal {clickable}

    And 24 more recorded events.
```

### 7.4 Sample Full Layout

```
+-- # SITE --------------------------------------------------+
|  Ironhold                                                  |
|  Capital City  |  Pop. 24,000  |  Founded Year 34         |
|  < Back   [World] > Iron Conf. > Ironhold     Forward >    |
|============================================================|
|                                                            |
|  v [1] A Living Portrait                          City     |
|    Ironhold rises from the living rock like a crown of     |
|    stone and iron. Founded in Year 34 by the first         |
|    dwarven settlers...                                     |
|                                                            |
|    Population: 24,000 (City)  |  Growth: +1.2%            |
|    Ruling Faction: Iron Confederacy                        |
|                                                            |
|  v [2] People & Peoples                    24,000 souls    |
|    Predominantly dwarven, with a growing human quarter...  |
|                                                            |
|  > [3] Power & Governance              Thorin Ironhand     |
|  > [4] Trade & Industry                Prosperous          |
|  > [5] Walls & Works                   Fortified Walls     |
|  > [6] Notable Souls                   8 characters        |
|  > [7] The Annals                      28 events           |
|                                                            |
|------------------------------------------------------------|
|  [1-7] Sections  [Bksp] Back  [g] Center map  [p] Pop.    |
+------------------------------------------------------------+
```

### 7.5 Interaction Patterns

| Input     | Action                                        |
|-----------|-----------------------------------------------|
| `1`-`7`   | Toggle section expand/collapse                |
| `Up/Down` | Scroll content                                |
| `Left`    | Navigate back in history                      |
| `g`       | Center map on this settlement                  |
| `p`       | Toggle detailed population breakdown           |
| `Click`   | Click any entity name to navigate             |

---

## 8. Navigation System

### 8.1 History Stack

The inspector maintains a navigation history stack, identical to a web browser.

```typescript
interface NavigationEntry {
  readonly entityId: EntityId;
  readonly entityType: InspectableEntityType;  // extended with 'event' | 'region'
  readonly scrollOffset: number;               // remember scroll position
  readonly expandedSections: readonly string[]; // remember which sections were open
  readonly timestamp: number;
}
```

**Behavior:**
- Navigating to a new entity pushes onto the stack
- "Back" pops the stack and restores scroll position + section state
- "Forward" pushes forward through history if available
- Navigating from the middle of the stack truncates forward history
- Maximum stack depth: 50 entries (prevent memory bloat)

### 8.2 Breadcrumb Trail

The breadcrumb trail shows the path the player took to reach the current entity.
It provides spatial orientation in the exploration.

**Format:**
```
[World] > Iron Confederacy > Thorin Ironhand > [Betrayal Event]
```

**Rules:**
- Maximum 4 breadcrumb segments (truncate oldest with "...")
- Each segment is clickable, navigating to that entry
- World Dashboard is always the root (shown as `[World]`)
- Entity names truncated to 15 characters with ellipsis if needed
- Current entity shown in bold (or brackets for events)

**Rendering:**
```
< Back   ... > Iron Conf... > Thorin > [Betrayal]   Forward >
```

**Implementation:**

```typescript
function renderBreadcrumbs(
  history: readonly NavigationEntry[],
  currentIndex: number,
  maxWidth: number
): string {
  // Show last 3 entries + [World] root
  // Truncate names to fit within maxWidth
  // Color each name in ENTITY_NAME_COLOR
  // Track entity spans for clickability
}
```

### 8.3 Cross-Type Navigation Flows

The design creates natural exploration paths between entity types:

```
Character --> Faction (via membership)
Character --> Site (via location)
Character --> Event (via timeline/memories)
Character --> Character (via relationships)
Character --> Artifact (via possessions)

Faction --> Character (via leadership/members)
Faction --> Site (via territory/capital)
Faction --> Faction (via diplomacy)
Faction --> Event (via chronicles)

Event --> Character (via participants)
Event --> Faction (via participants)
Event --> Site (via location)
Event --> Event (via causes/consequences)

Region --> Site (via nearby settlements)
Region --> Faction (via controlling faction)
Region --> Event (via historical events)

Site --> Character (via notable residents)
Site --> Faction (via ownership)
Site --> Event (via annals)
Site --> Region (via geography)
```

Every entity type can reach every other entity type within 1-2 clicks. This
creates the "wiki exploration" feeling.

### 8.4 Keyboard Navigation Summary

| Key       | Action                    | Context                |
|-----------|---------------------------|------------------------|
| `Left`    | Navigate back             | All inspectors         |
| `Right`   | Navigate forward          | All inspectors         |
| `Escape`  | Clear inspector / go back | Return to dashboard    |
| `Enter`   | Inspect highlighted item  | When cursor over entity|
| `1`-`9`   | Toggle section N          | All inspectors         |
| `o`       | Overview mode             | All inspectors         |
| `r`       | Relationships mode        | Char/Faction           |
| `t`       | Timeline mode             | All inspectors         |
| `d`       | Details mode (all expanded)| All inspectors        |
| `g`       | Go to map location        | Char/Site/Region/Event |
| `Click`   | Navigate to clicked entity| All inspectors         |

---

## 9. Empty State and Transitions

### 9.1 No Entity Selected (World Dashboard)

When no entity is selected, the inspector shows the World Dashboard (existing
behavior, refined):

```
+-- WORLD PULSE ---------------------------------------------+
|                                                            |
|  This is an age where skirmishes flare across frontiers,   |
|  and faith moves multitudes to action. Meanwhile, knowledge|
|  gathers dust in neglected halls.                          |
|                                                            |
|  --- GREAT POWERS ---------------------------------------- |
|    & Iron Confederacy -- 45,000 souls          {clickable} |
|    & Elvenking's Realm -- 32,000 souls         {clickable} |
|    & Goblin Horde -- 18,000 souls              {clickable} |
|                                                            |
|  --- WINDS OF CONFLICT ----------------------------------- |
|    * Drums of war sound across borders                     |
|    * Ambition challenges the throne                        |
|                                                            |
|  --- RECENT TIDINGS -------------------------------------- |
|    * Steel clashes upon the field                          |
|    * Trust shatters like glass                             |
|                                                            |
|  Click any entity on the map or in the event log to begin  |
|  exploring the world.                                      |
+------------------------------------------------------------+
```

**Changes from current:**
- Faction names in the dashboard are now clickable (colored `#88AAFF`)
- Clicking a faction in the Great Powers section navigates to its inspector
- The hint text at the bottom is more inviting

### 9.2 Entity Not Found

If an entity has been removed or data is unavailable:

```
+-- ? UNKNOWN -----------------------------------------------+
|                                                            |
|  This entity has passed beyond the reach of chronicles.    |
|                                                            |
|  Entity #247 is no longer present in the world. It may     |
|  have been destroyed, dissolved, or lost to the passage    |
|  of time.                                                  |
|                                                            |
|  [Bksp] Return to previous view                           |
+------------------------------------------------------------+
```

### 9.3 Transition Animations

Given the terminal constraints, transitions between inspector views are instant.
However, to provide visual feedback:

1. **Brief flash:** On navigation, the header line flashes briefly (reverse video
   for one render frame) to indicate the view has changed.
2. **Scroll reset:** Scroll position resets to top on navigation.
3. **Section memory:** When navigating back, previously expanded sections are
   restored (stored in NavigationEntry).

---

## 10. Implementation Integration

### 10.1 Type System Changes

```typescript
// Extended inspectable entity types
type InspectableEntityType =
  | 'character'
  | 'location'   // Site/Settlement
  | 'faction'
  | 'artifact'
  | 'event'      // NEW
  | 'region'     // NEW
  | 'unknown';

// Extended navigation entry
interface NavigationEntry {
  readonly entityId: EntityId;
  readonly entityType: InspectableEntityType;
  readonly scrollOffset: number;
  readonly expandedSections: readonly string[];
  readonly timestamp: number;
  // For events: store the EventId (different from EntityId)
  readonly eventId?: EventId;
  // For regions: store coordinates (regions are not entities)
  readonly regionCoords?: { x: number; y: number };
}
```

### 10.2 New Sub-Inspector Classes

Two new sub-inspector classes are needed:

```typescript
// packages/renderer/src/panels/event-inspector.ts
class EventInspector {
  getSections(): InspectorSection[];
  render(eventId: EventId, context: RenderContext, ...): string[];
  getEntitySpans(): Map<number, EntitySpan[]>;
}

// packages/renderer/src/panels/region-inspector.ts
class RegionInspector {
  getSections(): InspectorSection[];
  render(x: number, y: number, tile: RenderableTile, context: RenderContext, ...): string[];
  getEntitySpans(): Map<number, EntitySpan[]>;
}
```

### 10.3 Modified InspectorPanel

The InspectorPanel class gains:

1. **Entity span tracking** for click detection (same pattern as EventLogPanel)
2. **Event inspection support** (events are not ECS entities, need EventId routing)
3. **Region inspection support** (regions are tile coordinates, not entities)
4. **Breadcrumb rendering** in the header
5. **Prose generation** via synthesizer functions

```typescript
class InspectorPanel extends BasePanel {
  // NEW: entity span tracking for clickable names
  private entitySpans: Map<number, Array<{
    startCol: number;
    endCol: number;
    entityId: EntityId;
  }>> = new Map();

  // NEW: inspect an event (not an entity)
  inspectEvent(eventId: EventId, context: RenderContext): void;

  // NEW: inspect a region tile
  inspectRegion(x: number, y: number, tile: RenderableTile, context: RenderContext): void;

  // MODIFIED: handleClick checks entitySpans
  override handleClick(x: number, y: number): boolean;

  // NEW: breadcrumb rendering
  private renderBreadcrumbs(): string[];

  // NEW: prose generation helpers
  private synthesizeCharacterSummary(entityId: EntityId, context: RenderContext): string;
  private synthesizeFactionSummary(entityId: EntityId, context: RenderContext): string;
  private synthesizeSiteSummary(entityId: EntityId, context: RenderContext): string;
}
```

### 10.4 Data Flow

```
User Click/Key
     |
     v
InspectorPanel.handleClick() or handleInput()
     |
     v
detectEntityType() or inspectEvent() or inspectRegion()
     |
     v
Push to history stack, initialize sections
     |
     v
render() dispatches to sub-inspector
     |
     v
Sub-inspector.render() returns string[] with {#88AAFF-fg} entity names
     |
     v
InspectorPanel tracks entity spans from rendered output
     |
     v
Display with scroll, sections, breadcrumbs, footer hints
```

### 10.5 Integration Points with Existing Systems

| System              | Integration                                         |
|---------------------|-----------------------------------------------------|
| EventLogPanel       | Clicking event opens Event Inspector                 |
| MapPanel            | Clicking tile can open Region Inspector              |
| MenuBar             | Inspector panel navigation reflected in menu         |
| NarrativeEngine     | Used for event prose generation                      |
| EntityResolver      | Used for all name resolution                         |
| ChroniclerBiasFilter| Applied to event narratives in Event Inspector       |
| VignetteGenerator   | Vignettes available from Event Inspector             |
| WorldFingerprintCalc| Domain balance shown in Region Inspector             |
| HeraldrySystem      | Coat of arms rendered in Faction Inspector           |

### 10.6 Performance Considerations

- **Lazy prose generation:** Prose paragraphs are generated only when a section is
  expanded, not when the inspector first opens. This prevents expensive narrative
  engine calls for collapsed sections.
- **Cached renders:** Each sub-inspector caches its rendered string[] until the
  entity changes or the world state advances. Re-renders triggered only by:
  - Entity navigation
  - Section expand/collapse
  - Simulation tick (if inspector is showing a "live" entity)
- **Entity span rebuilding:** Entity spans are rebuilt on every render pass (they
  depend on scroll position and section state). This is cheap (Map insertion).
- **Event query limits:** EventLog queries capped at 200 events per entity to
  prevent performance issues with entities involved in thousands of events.

### 10.7 Testing Strategy

Each sub-inspector should have isolated tests (matching existing pattern):

```
packages/renderer/src/panels/event-inspector.test.ts
packages/renderer/src/panels/region-inspector.test.ts
packages/renderer/src/panels/character-inspector.test.ts  (existing, extend)
packages/renderer/src/panels/faction-inspector.test.ts    (existing, extend)
packages/renderer/src/panels/location-inspector.test.ts   (existing, extend)
```

Test categories:
1. **Section rendering:** Each section produces expected output given mock data
2. **Entity span tracking:** Clickable names produce correct span maps
3. **Navigation:** History stack, breadcrumbs, back/forward work correctly
4. **Prose generation:** Synthesized prose matches expected patterns
5. **Empty states:** Missing data handled gracefully (prose fallbacks)
6. **Edge cases:** Very long names, many participants, deep cascade chains

### 10.8 Prose Lookup Tables (New)

The following new prose lookup tables are needed:

```typescript
// Health state prose
const HEALTH_PROSE = { perfect, healthy, injured, wounded, critical, dead };

// Personality axis prose (Big Five)
const PERSONALITY_AXIS = { openness, conscientiousness, extraversion, agreeableness, neuroticism };

// Settlement size atmosphere
const SETTLEMENT_SIZE_PROSE = { Hamlet, Village, Town, City, 'Large City', Metropolis };

// Relationship category labels
const RELATION_CATEGORY_PROSE = { family, ally, rival, neutral, vassal, overlord };

// Military state prose
const MILITARY_PROSE = { peaceful, mobilizing, at_war, victorious, defeated };

// Economic state prose
const ECONOMIC_PROSE = { destitute, poor, modest, comfortable, wealthy, opulent };
```

These follow the established pattern of BIOME_PROSE, DOMAIN_PROSE, and
RESOURCE_PROSE in the existing codebase.

---

## Appendix A: Entity Type Detection (Extended)

The current `detectEntityType()` handles character, location, faction, artifact.
It needs extension for event and region types, which are not ECS entities:

```typescript
// Event: detected when inspectEvent() is called explicitly (EventId, not EntityId)
// Region: detected when inspectRegion() is called explicitly (coordinates)

// For entities detected via EntityId, detection priority:
// 1. Has Attribute component → character
// 2. Has Position + Population → location (site/settlement)
// 3. Has Territory component → faction
// 4. Has CreationHistory or OwnershipChain → artifact
// 5. Fallback → unknown
```

## Appendix B: Color Palette Reference

| Element              | Color     | Usage                           |
|----------------------|-----------|---------------------------------|
| Clickable names      | `#88AAFF` | Entity names that can be clicked|
| Section headers      | bold white| Section title text              |
| Prose body           | `#cccccc` | Normal paragraph text           |
| Dim/secondary text   | `#888888` | Hints, counts, labels           |
| Significance: trivial| `#666666` | Low-importance events           |
| Significance: minor  | `#888888` | Minor events                    |
| Significance: major  | `#FF8844` | Important events                |
| Significance: crit   | `#FF2222` | Critical events                 |
| Significance: legend | `#FF00FF` | Legendary events                |
| Positive affinity    | `#44FF88` | Allied relationships            |
| Negative affinity    | `#FF4444` | Hostile relationships           |
| Neutral              | `#CCCC44` | Neutral relationships           |

## Appendix C: Migration Path from Current Inspectors

The existing sub-inspectors (CharacterInspector, FactionInspector, LocationInspector,
ArtifactInspector) can be migrated incrementally:

**Phase 1: Shell & Navigation**
- Add entitySpans tracking to InspectorPanel
- Add breadcrumb rendering
- Add footer hint bar
- Add clickable name rendering throughout existing sub-inspectors
- Resolve `#EntityId` to actual names everywhere

**Phase 2: Prose Layer**
- Add prose lookup tables (HEALTH_PROSE, PERSONALITY_AXIS, etc.)
- Wrap each section's raw data output with a leading prose paragraph
- Rename sections to prose-style titles

**Phase 3: New Inspectors**
- Implement EventInspector
- Implement RegionInspector
- Wire up navigation from EventLogPanel and MapPanel

**Phase 4: Polish**
- Summary hints on collapsed section headers
- Section state persistence in navigation history
- Performance caching
- Full test coverage
