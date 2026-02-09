## Appendix A: Technical Summary

### Package Structure

```
packages/
  core/         ECS, simulation loop, time, events, LoD, spatial index,
                persistence, 10 simulation systems + influence + fingerprint
  generator/    Terrain, ecology, cosmology, races, names, pre-history
  renderer/     Terminal ASCII UI (blessed): 8 panels, 5 layouts, 30fps
  narrative/    Template engine (281 templates, 5 tones), chronicler, vignettes
  cli/          Entry point, controls, influence UI, save/load
```

### Test Coverage

2955 tests passing across 94 test files, covering:
- ECS operations and component stores
- All 10 simulation systems in isolation
- Event cascade engine and dampening
- Narrative template rendering and tone selection
- Chronicler bias filtering and lost history
- UI panels (rendering, click handling, navigation)
- Inspector prose generation and entity resolution
- Map overlays and compositing
- Timeline branching and snapshot management
- Influence system actions and believability checks

### Key Constants

| Parameter | Value |
|-----------|-------|
| Tick duration | 1 day |
| Days per year | 360 (12 months x 30 days) |
| Frequency tiers | 6 (1/7/30/90/365/3650) |
| Tick execution steps | 13 (immutable order) |
| LoD zones | Full (50 tiles), Reduced (200), Abstract (beyond) |
| Significance override | 85 |
| Max cascade depth | 10 |
| Dampening formula | `baseProbability x (1 - dampening)^depth` |
| Component types | 104 |
| Narrative templates | 281 across 11 files |
| Narrative tones | 5 |
| Influence actions | 17 |
| IP regeneration | 1 per simulation year |
| Inspector types | 6 (Character, Faction, Site, Artifact, Event, Region) |
| Map overlay layers | 6 (Settlements, Territory, Military, Trade, Magic, Markers) |
| Overlay presets | 7 (None, Political, Military, Economic, Arcane, Climate, Full) |
| Render target | 30fps |
| Speed modes | 7 (Paused through Ultra x3650) |
| Event categories | 10 (Political, Magical, Cultural, Religious, Scientific, Personal, Exploratory, Economic, Disaster, Military) |
