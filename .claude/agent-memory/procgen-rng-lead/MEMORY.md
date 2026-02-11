# Procgen RNG Lead — Agent Memory

## Key Files
- SeededRNG: `packages/core/src/utils/seeded-rng.ts` (xoshiro128**, fork(), getSeed())
- SimplexNoise: `packages/core/src/utils/simplex-noise.ts`
- Generator RNG: `packages/generator/src/rng.ts` (re-exports from @fws/core)
- Name gen: `packages/generator/src/character/name-generator.ts`, `markov.ts`
- Terrain: `packages/generator/src/terrain/heightmap.ts`, `biomes.ts`, `hydrology.ts`
- Tile variants: `packages/electron/src/renderer/map/tile-variants.ts`
- Heraldry: `packages/electron/src/renderer/procgen/heraldry-renderer.ts`
- Charge atlas: `packages/electron/src/renderer/procgen/charge-atlas.ts`
- Icon atlas: `packages/electron/src/renderer/procgen/icon-atlas.ts`
- Full map: `docs/CODEBASE_MAP.md`

## Patterns
- All randomness from SeededRNG — never Math.random()
- Fork labels: unique descriptive strings, collisions destroy independence
- JS bitwise XOR returns signed 32-bit — use `>>> 0` after XOR
- Per-tile hash: combine terrain seed + biome + variant index
- Generator re-exports SeededRNG from @fws/core
- `structuredClone` cannot clone functions — use custom `deepCloneValue`
