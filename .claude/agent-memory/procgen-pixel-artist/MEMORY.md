# Procgen Pixel Artist - Agent Memory

## Design Document
- Full system spec: `docs/plans/procgen-pixel-art-system.md`
- Created: 2026-02-07

## Key Design Decisions

### Tile System
- 32x32 pixels, top-down perspective, 8 variants per biome
- 17 biome types matching existing BiomeType enum in biome-chars.ts
- Transition tiles use noise-driven dithering (Bayer 4x4 matrix at blend boundary)
- Rivers rendered as separate alpha overlay tiles (bezier curve path)

### File Structure
- All procgen code goes in `packages/renderer/src/procgen/`
- Subfolders: terrain/, features/, structures/, heraldry/, ui/, atlas/
- Reuses existing SimplexNoise from `packages/renderer/src/map/simplex-noise.ts`
- SeededRandom class uses xorshift128 algorithm

### Noise Parameters (Tested/Chosen)
- Base terrain color: frequency 0.02, selects from palette base array
- Texture variation: frequency 0.08, blends toward highlights/shadows
- Detail specks: frequency 0.2, threshold >0.7 for detail placement
- Dithering: frequency 0.15, modulates Bayer matrix intensity
- Border warp: frequency 0.08 (domain warp) + 0.1 (blend), warp magnitude 6px

### Color Palettes
- All 17 biome palettes defined in biome-palettes.ts (see design doc Appendix A)
- Earthy/desaturated medieval aesthetic, NOT bright terminal colors
- Top-left lighting with configurable strength per biome (0.0-0.8)
- River palette: water #2860a0, banks #5a7a48, foam #90c0e0

### Tree Sprites
- 3 families: conifer (triangle stacks), deciduous (circle canopy), tropical (fronds)
- 3 sizes: small 8px, medium 11px, large 14px
- Conifer most common in mockups - dark green triangles (#1a4a28 base)
- Placed via Poisson disk sampling, density varies by biome

### Settlement Sprites
- 5 tiers: hamlet 48x40 to capital 112x96
- Modular castle assembly: towers + walls + keep + gatehouse
- Faction color applied via mask system (1=base, 2=highlight, 3=shadow)
- Buildings: 3 wall materials (stone/wood/stucco), 4 roof styles

### Atlas Packing
- Atlas 1: Terrain 512x512 (136 tiles)
- Atlas 2: Transitions 512x512
- Atlas 3: Features 256x256
- Atlas 4: Structures 1024x512
- Atlas 5: UI 256x256
- Total GPU memory: ~5.5 MB for 20 factions

### Performance Targets
- Single tile: <1ms, full pregeneration: <500ms async
- Tree sprite: <0.5ms, settlement: <5ms
- Cache lookup: O(1) via TextureCache Map

### Seasonal Variation
- Applied as PixiJS ColorMatrixFilter, NOT by regenerating tiles
- Spring: sat+10%, Summer: base, Autumn: hue+25 sat-15%, Winter: sat-35% bright+10%

### Seed Derivation
- hashCombine(worldSeed, hash("domain")) for each subsystem
- Per-tile: hashCombine(terrain_seed, hash(biome), variantIdx)
- Per-feature: hashCombine(feature_seed, wx, wy)
- Per-settlement: hashCombine(structure_seed, siteId)

## Existing Codebase References
- BiomeType enum: packages/renderer/src/themes/biome-chars.ts (17 values)
- BiomeRenderConfig: packages/renderer/src/themes/biome-render-config.ts
- SimplexNoise + fbm: packages/renderer/src/map/simplex-noise.ts
- TerrainStyler: packages/renderer/src/map/terrain-styler.ts (to be replaced)
- Heraldry (ASCII): packages/renderer/src/widgets/heraldry.ts (pixel version parallels this)
- Overlay system: packages/renderer/src/map/overlay.ts (adapts to sprite overlays)
- Theme colors: packages/renderer/src/theme.ts

## Implementation Phases
1. Core terrain (seeded-random, palettes, tile gen, cache)
2. Natural features (trees, rocks, vegetation, placement)
3. Settlements (buildings, castles, farms, layout, faction colors)
4. Polish (transitions, rivers, pixel heraldry, UI frames, atlas packing, seasons)

## Pitfalls Discovered
- OffscreenCanvas may not be available in all Electron versions - need fallback to document.createElement('canvas')
- PixiJS Texture.from(canvas) needs scaleMode: NEAREST for pixel art (no bilinear filtering)
- Bayer dithering at blend boundaries prevents smooth gradients - intentional for pixel art aesthetic
- Existing heraldry system uses hashString() for determinism - pixel version must use same hash to match decisions
