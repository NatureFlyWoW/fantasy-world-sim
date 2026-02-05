/**
 * Terrain tile types — the fundamental data stored at each map cell.
 */

/**
 * Biome classification for a tile.
 */
export enum BiomeType {
  DeepOcean = 'DeepOcean',
  Ocean = 'Ocean',
  Coast = 'Coast',
  Plains = 'Plains',
  Forest = 'Forest',
  DenseForest = 'DenseForest',
  Mountain = 'Mountain',
  HighMountain = 'HighMountain',
  Desert = 'Desert',
  Tundra = 'Tundra',
  Swamp = 'Swamp',
  Volcano = 'Volcano',
  Jungle = 'Jungle',
  Savanna = 'Savanna',
  Taiga = 'Taiga',
  IceCap = 'IceCap',
  MagicWasteland = 'MagicWasteland',
}

/**
 * Natural resources that can be found on a tile.
 */
export enum ResourceType {
  Food = 'Food',
  Timber = 'Timber',
  Stone = 'Stone',
  Iron = 'Iron',
  Gold = 'Gold',
  Gems = 'Gems',
  MagicalComponents = 'MagicalComponents',
  LuxuryGoods = 'LuxuryGoods',
  Fish = 'Fish',
  Copper = 'Copper',
  Tin = 'Tin',
  Coal = 'Coal',
  Herbs = 'Herbs',
}

/**
 * A single terrain tile in the world map.
 */
export interface TerrainTile {
  /** Elevation in arbitrary units: -1000 (deep ocean) to 10000 (mountain peak) */
  elevation: number;
  /** Temperature in degrees Celsius */
  temperature: number;
  /** Annual rainfall in cm */
  rainfall: number;
  /** Classified biome */
  biome: BiomeType;
  /** Natural resources present */
  resources: ResourceType[];
  /** River passing through this tile (index into river array), or undefined */
  riverId: number | undefined;
  /** Tectonic plate this tile belongs to */
  plateId: number;
  /** Whether a ley line passes through this tile */
  leyLine: boolean;
}
