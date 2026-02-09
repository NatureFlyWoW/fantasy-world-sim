## 17. Performance Architecture

### 17.1 Core Optimizations

**Spatial Partitioning.** A QuadTree data structure indexes all geographically-located entities. Enables efficient nearest-neighbor queries, range queries, and "what is near this location" lookups. Rebuilt incrementally each tick for moved entities.

**Event Queue Prioritization.** Binary heap ordered by significance ensures the most important events process first and computation is spent on events that matter.

**Historical Data Compression.** Recent events keep full detail, decades-old events keep moderate detail, centuries-old events keep only significance, category, and participant summaries.

**Lazy Evaluation.** Entity state not currently queried is stored in compact form. Characters in the Background LoD zone have full decision trees evaluated only when involved in significant events or inspected by the player.

**Map Overlay Caching.** Six overlay layers cached as `Map<string, Data>` keyed by tile coordinates. O(1) lookup per tile during rendering. Event-driven dirty flags prevent unnecessary recomputation. Viewport-scoped queries (SpatialIndex.getEntitiesInRect) avoid full-world iteration.

### 17.2 Memory Budgets

| World Size | RAM Target | Simulation Speed Target |
|-----------|-----------|------------------------|
| Small (200x200) | < 500MB | 10,000x real-time |
| Medium (400x400) | < 1.5GB | 5,000x real-time |
| Large (800x800) | < 4GB | 1,000x real-time |
| Epic (1600x1600) | < 8GB | 200x real-time |

Normal play speed (1 day/second) is effortless on all sizes.

### 17.3 Tick Budget Breakdown

At Normal speed (1 tick/second), the simulation budget per tick is approximately 16ms for a Medium world:

```
TICK EXECUTION BUDGET (Medium World, ~500 entities)
---------------------------------------------------------------

Step 1: Time Advancement           < 0.1ms
Step 2: Environment                  0.5ms (weather, geology)
Step 3: Economy                      1.5ms (trade routes, production)
Step 4: Politics                     1.0ms (stability, internal politics)
Step 5: Social                       0.8ms (reputation propagation)
Step 6: Character AI                 4.0ms (most expensive -- decision pipeline)
Step 7: Magic                        0.5ms (research, ley line updates)
Step 8: Religion                     0.3ms (devotion, divine power)
Step 9: Military                     2.0ms (army movement, battle resolution)
Step 10: Event Resolution            1.5ms (cascade engine, consequence eval)
Step 11: Narrative Generation        0.8ms (template selection, rendering)
Step 12: Cleanup/Indexing            0.3ms (spatial index, component GC)
Step 13: Player Notification         0.2ms (significance filtering)
                                   ------
Total:                             ~13.5ms (headroom for spikes)

---------------------------------------------------------------
```

Character AI (Step 6) dominates because every named character runs the 6-phase decision pipeline. LoD aggressively reduces this cost: characters in the Abstract zone skip perception and scoring phases entirely, executing only if involved in a significant event.

At Ultra speed (3650x), the simulation runs up to 10 ticks per frame. This is achieved by skipping narrative generation (Step 11) and player notification (Step 13) for non-significant events, reducing the per-tick cost to approximately 8ms.

### 17.4 Rendering Performance

- Render loop throttled to 30fps
- Overlay data refresh: once per frame maximum, not per tile
- Map tile render cache invalidated only on viewport change, overlay toggle, or data refresh
- Entity span tracking rebuilt per render pass (cheap Map insertion)
- Event query limits: 200 events per entity maximum in inspector

### 17.4 Overlay Data Refresh Budget

| Layer | Refresh Interval | Refresh Cost |
|-------|-----------------|-------------|
| Settlements | 30 ticks | O(n), low |
| Territory | 30 ticks | O(n * radius), medium |
| Military | 1 tick | O(n), low |
| Trade | 90 ticks | O(n^2) paths, medium |
| Magic | 90 ticks | O(ley tiles), medium |
| Climate | Never | Static tile data |

Total overlay cache memory: approximately 380KB for a 100x100 world.
