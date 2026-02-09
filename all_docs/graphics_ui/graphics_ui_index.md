# Aetherum Graphics & UI Remake -- Index

**Version 2.0** | Split from `graphics_ui_remake.md` (2183 lines, 14 sections + 4 appendices)

Caves of Qud-inspired visual design. Each file is self-contained. Load only what you need.

## Philosophy & Foundations

| File | Lines | Summary |
|------|-------|---------|
| [01-visual-philosophy.md](01-visual-philosophy.md) | 81 | Caves of Qud principle, observation fantasy, constraints-as-design, reference points |
| [02-color-system.md](02-color-system.md) | 115 | 20-color master palette with hex/HSL, palette rules, biome/category/significance color assignments |
| [03-tile-grid-system.md](03-tile-grid-system.md) | 131 | 16x16px tiles, 3 zoom levels (8/16/32px), glyph atlas, three-colors-per-tile rule |
| [04-typography.md](04-typography.md) | 86 | Cinzel display, Source Sans 3 body, Source Code Pro mono, size scale, map bitmap fonts |

## Core Panels

| File | Lines | Summary |
|------|-------|---------|
| [05-panel-system.md](05-panel-system.md) | 173 | CSS Grid layout, ornate corner frames (16x16px), responsive breakpoints, panel chrome specs |
| [06-map-view.md](06-map-view.md) | 128 | Terrain rendering pipeline, settlement markers, overlays, tooltips, fog of war |
| [07-chronicle-event-log.md](07-chronicle-event-log.md) | 245 | 4 modes (Prose/Compact/Story Arcs/Domain), event cards, category badges, significance indicators |
| [08-inspector-system.md](08-inspector-system.md) | 209 | 6 entity types, breadcrumbs, collapsible sections, prose-first design, heraldry rendering |

## Interaction & Motion

| File | Lines | Summary |
|------|-------|---------|
| [09-interaction-design.md](09-interaction-design.md) | 154 | Click/hover/selection states, keyboard navigation, tooltips, drag behavior |
| [10-animation-motion.md](10-animation-motion.md) | 94 | World animations at 15fps, UI at 60fps, loading states, transition timings |

## Visual Systems

| File | Lines | Summary |
|------|-------|---------|
| [11-procedural-art-generation.md](11-procedural-art-generation.md) | 103 | Terrain tiles from seed, heraldry generation, seasonal palette (rejected for map) |
| [12-accessibility.md](12-accessibility.md) | 67 | WCAG AA contrast, colorblind modes, keyboard nav, screen reader considerations |

## Technical

| File | Lines | Summary |
|------|-------|---------|
| [13-technical-approach.md](13-technical-approach.md) | 231 | Electron+PixiJS+HTML/CSS architecture, IPC, performance targets, CSS file organization |
| [14-implementation-roadmap.md](14-implementation-roadmap.md) | 122 | 7-phase plan with milestones, migration strategy from blessed |

## Appendices

| File | Lines | Summary |
|------|-------|---------|
| [15-appendix-a-full-screen-ascii-mockup.md](15-appendix-a-full-screen-ascii-mockup.md) | 50 | Complete terminal-width layout diagram |
| [15-appendix-b-palette-swatch-reference.md](15-appendix-b-palette-swatch-reference.md) | 32 | All 20 colors with hex, HSL, and semantic role |
| [15-appendix-c-mapping-from-current-blessed-system.md](15-appendix-c-mapping-from-current-blessed-system.md) | 22 | blessed.screen/box/tags to Electron/CSS equivalents |
| [15-appendix-d-component-style-guide-quick-reference.md](15-appendix-d-component-style-guide-quick-reference.md) | 57 | Quick-reference specs for Event Card, Panel Title Bar, Tooltip |
