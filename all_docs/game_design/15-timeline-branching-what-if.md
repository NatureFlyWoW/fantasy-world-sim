## 15. Timeline Branching (What-If)

### 15.1 Concept

At any point, the player creates a **timeline branch** -- a snapshot of the world state that forks into alternate history. The player makes one change (or simply re-rolls randomness) and watches how different outcomes cascade through centuries.

### 15.2 Branching Mechanics

**Creating a Branch.** Pause at a moment of interest and specify the divergence:
- Reverse an event outcome ("What if the battle went the other way?")
- Remove a character ("What if the hero died before the war?")
- Change a decision ("What if the king chose peace?")
- Add an event ("What if a volcanic eruption happened here?")
- Re-roll randomness (same state, different seeds)

**Running Branches.** Each branch runs as an independent simulation. The player switches between branches, watching them advance independently or in parallel.

**Comparison View.** Split-screen synchronized to the same date. Differences highlighted -- divergent territories, characters alive in one timeline but dead in the other. A "divergence tracker" quantifies how much the single change affected.

### 15.3 Cascade Visualization

The most compelling use of branching is watching a single change ripple outward. The comparison view includes a cascade map showing where causal chains diverged:

```
TIMELINE DIVERGENCE MAP
---------------------------------------------------------------

        ORIGINAL TIMELINE            BRANCH (Battle reversed)
        ==================           ======================

Year 50:  Battle of Ashenmere        Battle of Ashenmere
          (Confederate victory)      (Republic victory)
               |                          |
Year 52:  Territory gained           Territory lost
          Trade route secured        Refugees flee south
               |                          |
Year 60:  Economic boom              Economic crisis
          Golden age of art          Militaristic culture
               |                          |
Year 80:  Complacency                Revenge campaign
          Religious schism           United under grudge
               |                          |
Year 100: Civil war                  Reconquest war
          (decline begins)           (expansion begins)
               |                          |
Year 200: Confederacy fragmented     Confederacy dominant
          5 successor states         Continental empire

  DIVERGENCE: 89% of entities have different states
  CASCADE DEPTH: The original battle affected 2,847 events

---------------------------------------------------------------
```

The player traces exactly how "the general surviving the battle" led, through a chain of linked events, to an entirely different civilization dominating the continent 200 years later.

### 15.4 Implementation

The WorldSnapshotManager captures complete simulation state. The BranchRunner executes divergent timelines independently. The SaveManager persists branches for later exploration. Maximum 3 active branches (configurable) for performance.

### 15.5 Branch Limits and Management

For performance, the player is limited to a configurable number of active branches (default: 3). Old branches can be:
- **Archived** -- saving state but not actively simulating
- **Deleted** -- freeing memory
- **Compared** -- side-by-side view (only two branches at a time)
- **Exported** -- generating comparison reports
