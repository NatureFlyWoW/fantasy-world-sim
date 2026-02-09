## 3. The Simulation Engine

The simulation loop is the beating heart of the system. Every other feature -- generation, rendering, narrative, player interaction -- exists in service of this loop.

### 3.1 Tick-Based Model

The simulation operates on a **tick-based model where one tick equals one day** of in-world time. The calendar uses 12 months of 30 days each (360 days per year). Not every system runs every tick -- systems are stratified into frequency tiers based on how quickly their domain changes:

```
FREQUENCY TIERS
---------------------------------------------------------------
Tier          Period     Systems
---------------------------------------------------------------
Daily         1 tick     Character AI, Military movement,
                         Event resolution, Urgent cascades

Weekly        7 ticks    Trade/market updates, Relationship
                         maintenance, Reputation propagation,
                         Religious devotion

Monthly       30 ticks   Economic production/consumption,
                         Population growth/migration, Political
                         stability, Faction strategy

Seasonal      90 ticks   Agricultural yields, Military campaign
                         strategy, Cultural propagation,
                         Seasonal festivals

Annual        365 ticks  Technology progress, Artistic movements,
                         Language drift, Generational shifts,
                         Geological micro-changes, Divine power
                         recalculation

Decadal       3650 ticks Long-term climate shifts, Major geology,
                         Civilization-level cultural identity,
                         Historical era transitions
---------------------------------------------------------------
```

This stratification is not merely a performance optimization -- it is a design choice. Economics should not fluctuate daily, and mountains should not erode monthly. The frequency tiers encode the natural tempo of each domain.

### 3.2 The 13-Step Tick Execution Order

Within each tick, systems execute in a fixed order that reflects causal dependency. A character cannot make a decision based on economic conditions that have not yet been calculated.

```
+--------------------------------------------------------------+
|                      TICK N BEGINS                           |
+--------------------------------------------------------------+
|                                                              |
|  Step  1: TIME ADVANCE                                       |
|           Increment world clock, check season/year change    |
|           Trigger scheduled events                           |
|                                                              |
|  Step  2: ENVIRONMENT (if frequency matched)                 |
|           Weather generation, geological events              |
|           Natural disasters, resource regeneration            |
|                                                              |
|  Step  3: ECONOMY (if frequency matched)                     |
|           Resource production, trade routes, market prices   |
|           Tax collection, economic events                    |
|                                                              |
|  Step  4: POLITICS (if frequency matched)                    |
|           Leader decisions, diplomacy, stability             |
|           Succession, law and governance                     |
|                                                              |
|  Step  5: SOCIAL                                             |
|           Relationships, reputation propagation              |
|           Cultural norms, family events                      |
|                                                              |
|  Step  6: CHARACTER AI                                       |
|           For each active character:                         |
|             a. Perceive current context                      |
|             b. Evaluate goals                                |
|             c. Score possible actions                        |
|             d. Execute highest-scoring action                |
|             e. Store significant outcomes in memory          |
|             f. Reflect and update goals                      |
|                                                              |
|  Step  7: MAGIC (if frequency matched)                       |
|           Research progress, mana fluctuations               |
|           Artifact activation, institutional politics        |
|           Wild magic, planar stability                       |
|                                                              |
|  Step  8: RELIGION (if frequency matched)                    |
|           Divine power recalculation, prayer aggregation     |
|           Intervention checks, church politics               |
|           Prophet/saint emergence                            |
|                                                              |
|  Step  9: MILITARY                                           |
|           Army movement, battle resolution                   |
|           Siege progression, recruitment, morale             |
|                                                              |
|  Step 10: EVENT RESOLUTION                                   |
|           Process event queue (significance-ordered)         |
|           Execute consequence chains                         |
|           Generate cascading events                          |
|           Update cause-effect graph                          |
|                                                              |
|  Step 11: NARRATIVE GENERATION                               |
|           For events above significance threshold:           |
|             Generate raw log entry                           |
|             Generate narrative prose (template-based)        |
|           For high-significance events:                      |
|             Generate micro-narrative vignette                |
|             Route to chronicler for bias filtering           |
|                                                              |
|  Step 12: CLEANUP AND INDEXING                               |
|           Update spatial index for moved entities            |
|           Archive old events                                 |
|           Recalculate LoD boundaries                         |
|           Update world fingerprint                           |
|                                                              |
|  Step 13: PLAYER NOTIFICATION                                |
|           Check notification preferences                     |
|           Alert on bookmarked entity events                  |
|           Alert on high-significance global events           |
|           Update UI state for renderer                       |
|                                                              |
+--------------------------------------------------------------+
|                      TICK N COMPLETE                         |
+--------------------------------------------------------------+
|                                                              |
|  [BETWEEN TICKS: Process player influence queue]             |
|  Influence actions execute AFTER tick N completes,           |
|  BEFORE tick N+1 begins. This preserves the clean            |
|  13-step architecture.                                       |
|                                                              |
+--------------------------------------------------------------+
```

The tick order is immutable. Systems communicate exclusively through the event queue and shared component state -- never by direct reference to other systems.

### 3.3 Level-of-Detail Simulation

Not every entity can be simulated at full fidelity every tick. The Level-of-Detail system manages computational budget by simulating entities at different fidelity levels based on proximity to the player's focus.

```
LEVEL-OF-DETAIL ZONES
---------------------------------------------------------------

                     +-----+
                     |     |  Full Detail
                     |  F  |  ~50 tile radius
                     |     |  Every character makes daily decisions
                     +-----+  Individual relationships tracked
                   /         \ Economic transactions itemized
                  /           \
           +-----+             +-----+
           |                         |  Reduced Detail
           |     R E D U C E D      |  ~200 tile radius
           |                         |  Characters in aggregate groups
           +-----+             +-----+  Armies tracked, not soldiers
                  \           /         Events only above moderate sig.
                   \         /
        +-----------+---------+-----------+
        |                                 |  Abstract
        |       A B S T R A C T          |  Beyond 200 tiles
        |                                 |  Civilizations as aggregates
        +---------------------------------+  Only high-significance events
```

**Dynamic Focus Shifting:** When the player moves their focus to a new area, LoD boundaries shift. Entities transitioning from Abstract to Full Detail undergo "detail inflation" -- their statistical aggregate state is decomposed into individual entities with plausible histories interpolated from aggregate trends.

**Significance Override:** Any event above significance 85 (configurable) always receives Full Detail simulation regardless of LoD zone. If a dragon attacks a distant city, the system temporarily promotes that area to Full Detail for the duration of the crisis.

### 3.4 Simulation Speed

The player controls simulation speed through seven modes:

| Mode | Speed | Use Case |
|------|-------|----------|
| Paused | 0 | Inspect, plan influence actions |
| Slow Motion | 10s per day | Momentous events, auto-triggered at sig 95+ |
| Normal | 1 day/second | Watch specific events unfold |
| Fast x7 | 1 week/second | Track character's month-to-month life |
| Fast x30 | 1 month/second | Watch a year unfold |
| Fast x365 | 1 year/second | Watch decades pass |
| Ultra x3650 | 1 decade/second | Centuries compress |

**Auto-Pause:** The simulation automatically pauses when a legendary event (significance 95+) occurs, giving the player time to absorb what happened. This is configurable.

**Automatic Slow-Down:** The simulation optionally slows itself when it detects a convergence of significant events. If three major plotlines are reaching climax simultaneously -- a war about to be decided, a succession crisis erupting, and a magical catastrophe unfolding -- the simulation drops to Slow Motion so the player can absorb the narrative density. This produces moments of intense engagement where the player watches events unfold in near-real-time, reading vignettes and exploring inspector panels during the most dramatic moments.

**The Speed Experience:**

```
SPEED AND NARRATIVE DENSITY
---------------------------------------------------------------

Ultra x3650:  Centuries compress. Watch civilizations rise and
              fall. Empires appear as colored blooms on the map
              that expand and fade. Only legendary events pause.
              Good for: "What happens if I let this run 1000 years?"

Fast x365:    Decades pass. Generational change visible. Cultural
              drift and territorial shifts become apparent. Major
              events flash by; critical events trigger slowdown.
              Good for: "How does this region change over time?"

Fast x30:     Months pass. Individual conflicts and political
              crises play out. Trade seasons visible. Characters
              age noticeably between inspections.
              Good for: "How does this war resolve?"

Normal x1:    Days pass. Watch specific scenes unfold. A battle
              takes 3-5 real seconds. A negotiation takes 10-15.
              Good for: "I want to see what happens to Elara today"

Slow Motion:  Ten seconds per day. Every event is narrated in
              extended prose. Vignettes appear for momentous events.
              Auto-triggered at significance 95+.
              Good for: "The coronation is happening right now"

---------------------------------------------------------------
```
