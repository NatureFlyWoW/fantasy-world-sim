# Hi-Fi UI Designer Memory

## Active Design Documents

### Graphics & UI Remake (Rev 2.0, 2026-02-09) -- PRIMARY
- File: `all_docs/graphics_ui_remake.md` (2453 lines)
- Visual philosophy: Caves of Qud-inspired, fixed palette, tile grid
- SUPERSEDES isometric approach from earlier mockups and hifi-ui-component-system.md
- Technology-agnostic (visual/interaction design only)

### Previous Spec (Rev 1.0, 2026-02-07) -- DEPRECATED for visual design
- File: `docs/plans/hifi-ui-component-system.md` (technology-specific CSS/HTML)
- Still useful for implementation details if Electron+PixiJS path is followed

## The Aetherum 20 Palette (Fixed)
| Name | Hex | Role |
|------|-----|------|
| Void | #0c0c14 | App background |
| Charcoal | #1a1a24 | Panel backgrounds |
| Smoke | #2e2a28 | Borders, dividers |
| Ash | #4a4640 | Disabled text, faint |
| Stone | #706860 | Secondary text |
| Pale | #a09888 | Body text |
| Parchment | #c8b898 | Headers, UI accent |
| Cream | #e0d8c8 | Primary text |
| Rust | #a04030 | Danger, military |
| Ember | #cc6830 | Warnings, fire |
| Bark | #684828 | Wood, roads, ruins |
| Loam | #886838 | Farmland, earth |
| Forest | #2a6430 | Dense vegetation |
| Leaf | #48a048 | Grassland, growth |
| Deep Water | #183860 | Ocean, deep water |
| Steel | #4878a8 | Characters, social |
| Gold | #b8942c | Ornamental borders |
| Arcane | #7840a8 | Magic, religion |
| Crown | #c8a040 | Political, legendary |
| Ice | #88b8d0 | Tundra, cultural |

## Key Decisions (Remake Doc)
- **Top-down tile grid** (NOT isometric) -- Qud approach
- **16x16px tiles**, 3 zoom levels (8/16/32px)
- **Three colors per tile** (primary/detail/background)
- **No gradients** except title bar accent lines
- **No seasonal map shifts** -- breaks biome ID
- **Dark only** -- no light mode
- **15fps map animations, 60fps UI**
- **Shared category colors** (Steel for Social+Personal, Arcane for Religious+Magical)
- **Corner ornaments: 16x16px** (down from 24x24 in old spec)
- **Top bar: 32px** (down from 36px), **Status bar: 22px** (down from 24px)

## Typography (Unchanged core, updated mono)
- Display: Cinzel (serif)
- Body: Source Sans 3 (sans-serif)
- Data: Source Code Pro (mono) -- was JetBrains Mono, changed for Qud lineage
- Base size: 13px

## Entity Colors (from palette)
- Character: Steel #4878a8
- Faction: Ember #cc6830
- Site: Crown #c8a040
- Artifact: Arcane #7840a8
- Region: Leaf #48a048

## Key Reference Files
- Remake design doc: `all_docs/graphics_ui_remake.md`
- Old component spec: `docs/plans/hifi-ui-component-system.md`
- Graphics remake plan: `all_docs/graphics-remake-plan.md`
- Current theme: `packages/renderer/src/theme.ts`
- Biome chars: `packages/renderer/src/themes/biome-chars.ts`
- Context view mockups: `docs/plans/context-view-mockups.md`
- Target mockups: `remake_samples/new_ui_sample*.png`
