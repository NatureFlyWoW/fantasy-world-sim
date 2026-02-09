## Appendix E: Influence Action Integration Map

Every influence action maps to an existing EventCategory, producing events indistinguishable from natural simulation events:

```
INFLUENCE ACTION -> EVENT CATEGORY MAPPING
---------------------------------------------------------------

DIVINE INTERVENTIONS:
  InspireIdea         -> Personal    (character has an idea)
  PropheticDream      -> Religious   (divine vision)
  ArrangeMeeting      -> Personal    (chance encounter)
  PersonalityNudge    -> Personal    (character growth)
  RevealSecret        -> Personal    (information discovered)
  LuckModifier        -> Personal    (fortunate outcome)
  VisionOfFuture      -> Religious   (prophetic experience)
  EmpowerChampion     -> Religious   (divine blessing)

ENVIRONMENTAL INFLUENCE:
  AdjustWeather       -> Disaster    (weather event)
  MinorGeology        -> Disaster    (geological change)
  AnimalMigration     -> Disaster    (ecological shift)
  ResourceDiscovery   -> Economic    (resource found)
  TriggerNaturalEvent -> Disaster    (natural disaster)

CULTURAL INFLUENCE:
  PromoteArt          -> Cultural    (artistic movement)
  EncourageResearch   -> Scientific  (research direction)
  StrengthenTradition -> Cultural    (cultural shift)
  IntroduceForeignConcept -> Cultural (cross-cultural idea)

---------------------------------------------------------------

KEY PRINCIPLE: There is NO "Influence" event category.
All player actions produce events in existing categories,
preserving the illusion that everything happened naturally.

---------------------------------------------------------------
```
