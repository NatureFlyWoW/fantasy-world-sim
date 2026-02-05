/**
 * Terrain generation module — heightmap, tectonics, hydrology, climate,
 * biomes, resources, and the WorldMap orchestrator.
 */

export { BiomeType, ResourceType } from './terrain-tile.js';
export type { TerrainTile } from './terrain-tile.js';

export { HeightmapGenerator } from './heightmap.js';

export { TectonicSimulator } from './tectonics.js';
export type { PlateMap, CollisionMap } from './tectonics.js';

export { RiverGenerator } from './hydrology.js';
export type { River, RiverPoint } from './hydrology.js';

export { ClimateGenerator } from './climate.js';
export type { ClimateData, ClimateMap } from './climate.js';

export { BiomeClassifier } from './biomes.js';

export { ResourcePlacer } from './resources.js';
export type { LeyLine, ResourceMapData } from './resources.js';

export { WorldMap } from './world-map.js';
export type { SettlementSite } from './world-map.js';

export { AsciiDebugRenderer } from './ascii-debug.js';

export { FloraDistributor } from './flora.js';
export { FloraSpecies } from './flora.js';
export type { FloraEntry, FloraMap } from './flora.js';

export { FaunaDistributor } from './fauna.js';
export { FaunaSpecies } from './fauna.js';
export type { FaunaPopulation, FaunaBehavior } from './fauna.js';

export { MagicalCreaturePlacer, MagicalCreatureType } from './magical-creatures.js';
export type { MagicalCreature, ElementalAffinity } from './magical-creatures.js';

export { DungeonPlacer, DungeonType } from './dungeons.js';
export type { DungeonSite } from './dungeons.js';

export { EcologicalBaseline } from './ecological-baseline.js';
export type { RegionBaseline, EcologyState } from './ecological-baseline.js';
