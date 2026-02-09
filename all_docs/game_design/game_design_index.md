# Aetherum Game Design Document -- Index

**Version 3.0** | Split from `game_design_new.md` (3147 lines, 19 sections + 10 appendices)

Each file below is a self-contained section. Load only what you need.

## Foundation

| File | Lines | Summary |
|------|-------|---------|
| [01-vision-and-identity.md](01-vision-and-identity.md) | 29 | What Aetherum is (digital terrarium for civilizations), how it differs from DF/CK3, the experience promise, what it is NOT |
| [02-design-pillars.md](02-design-pillars.md) | 48 | The 5 sacred pillars: Emergent Storytelling, Depth Over Breadth, Observation & Cultivation, Believability, Layered Interpretation |

## Simulation Core

| File | Lines | Summary |
|------|-------|---------|
| [03-the-simulation-engine.md](03-the-simulation-engine.md) | 216 | Tick model (1 day), 6 frequency tiers, 13-step execution order, LoD zones (Full/Reduced/Abstract), 7 speed modes, auto-pause |
| [04-world-generation.md](04-world-generation.md) | 153 | 9 configurable params, 6-phase pipeline (geology->ecology->cosmology->races->prehistory->init), 7 procedural races |
| [05-entity-architecture.md](05-entity-architecture.md) | 78 | ECS design, branded ID types, 104 component discriminants, 7 component categories, entity archetypes |

## Simulation Systems

| File | Lines | Summary |
|------|-------|---------|
| [06-simulation-systems.md](06-simulation-systems.md) | 451 | All 10 systems: Character AI (6-phase pipeline), Faction/Political (6 govt types), Economic, Military, Magic (research formula, catastrophe table), Religion (divine power, interventions), Cultural (tech prerequisites, language), Ecology, Secrets. Plus Dreaming & Influence extensions |
| [07-memory-and-reputation.md](07-memory-and-reputation.md) | 95 | Memory formation/decay/distortion, multi-dimensional reputation, social network propagation, generational grudges, false memories & propaganda |
| [08-the-event-cascade-engine.md](08-the-event-cascade-engine.md) | 84 | Cascade model, dampening formula, cross-domain transitions, significance amplifier, consequence rules |

## Narrative

| File | Lines | Summary |
|------|-------|---------|
| [09-the-narrative-engine.md](09-the-narrative-engine.md) | 97 | 281 templates, 5 tones (Epic/Personal/Mythological/Political/Scholarly), template structure, entity references, conditionals |
| [10-the-unreliable-chronicler.md](10-the-unreliable-chronicler.md) | 39 | In-world narrators with faction bias, 8 ideology types, knowledge limits, lost history mechanic |
| [11-micro-narrative-vignettes.md](11-micro-narrative-vignettes.md) | 93 | 200-500 word prose pieces, significance >85 triggers, 8 archetypes, character introspection monologues |

## Player Interaction

| File | Lines | Summary |
|------|-------|---------|
| [12-player-interaction-and-influence.md](12-player-interaction-and-influence.md) | 139 | 17 actions across 3 categories (Divine/Environmental/Cultural), IP economy, resistance formula, outcome spectrum, Three Laws of Influence |
| [18-the-player-experience.md](18-the-player-experience.md) | 174 | Core gameplay loops, session types (Quick/Extended/Campaign), emergent challenges, emotional design |

## User Interface

| File | Lines | Summary |
|------|-------|---------|
| [13-user-interface-design.md](13-user-interface-design.md) | 377 | 8 panels, 5 layouts, chronicle view (4 modes), 6 polymorphic inspectors, map overlays, keyboard controls |

## Extended Systems

| File | Lines | Summary |
|------|-------|---------|
| [14-world-fingerprint-system.md](14-world-fingerprint-system.md) | 61 | 6-domain identity (Warfare/Magic/Religion/Commerce/Scholarship/Diplomacy), civilization palette, complexity score |
| [15-timeline-branching-what-if.md](15-timeline-branching-what-if.md) | 67 | Snapshot & diverge, 5 divergence types, up to 3 parallel branches, comparison panel |
| [16-procedural-heraldry.md](16-procedural-heraldry.md) | 56 | 3 shield styles, 5 field divisions, 28 charges, tincture from faction values, heraldry evolution |
| [17-performance-architecture.md](17-performance-architecture.md) | 76 | Quadtree spatial index, LoD scaling, cascade budgets, tick budget breakdown, memory targets by world size |

## Future

| File | Lines | Summary |
|------|-------|---------|
| [19-future-vision.md](19-future-vision.md) | 155 | Graphics overhaul (Caves of Qud-inspired), enhanced narrative, expanded simulation depth, export system, social features |

## Appendices

| File | Lines | Summary |
|------|-------|---------|
| [20-appendix-a-technical-summary.md](20-appendix-a-technical-summary.md) | 51 | Package structure, test coverage, key constants table |
| [20-appendix-b-simulation-system-interactions.md](20-appendix-b-simulation-system-interactions.md) | 48 | System interaction map diagram showing event-driven communication |
| [20-appendix-c-the-cascade-chain-anatomy.md](20-appendix-c-the-cascade-chain-anatomy.md) | 53 | Worked example: diplomatic insult cascade through 3+ depths |
| [20-appendix-d-glossary.md](20-appendix-d-glossary.md) | 16 | Key terms: Branded ID, Cascade, Chronicler, Cultivation, ECS, IP, LoD, Significance, Tick, Vignette |
| [20-appendix-e-influence-action-integration-map.md](20-appendix-e-influence-action-integration-map.md) | 39 | All 17 influence actions mapped to event categories and target systems |
| [20-appendix-f-prose-lookup-tables.md](20-appendix-f-prose-lookup-tables.md) | 50 | HEALTH_PROSE, PERSONALITY_AXIS, SETTLEMENT_SIZE_PROSE and other inspector lookup tables |
| [20-appendix-g-development-phase-history.md](20-appendix-g-development-phase-history.md) | 66 | Phases 1-8 development history with test count progression |
| [20-appendix-h-color-palette-reference.md](20-appendix-h-color-palette-reference.md) | 41 | Entity colors, significance tiers, category colors, UI chrome |
| [20-appendix-i-narrative-template-categories.md](20-appendix-i-narrative-template-categories.md) | 64 | All 281 templates across 11 files with subtype counts |
| [20-appendix-j-character-ai-decision-worked-example.md](20-appendix-j-character-ai-decision-worked-example.md) | 121 | Full 6-phase Character AI walkthrough with scoring math and cascade chain |
