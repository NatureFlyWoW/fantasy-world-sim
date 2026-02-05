/**
 * ASCII character and color mappings for biome rendering and entity markers.
 *
 * BiomeType is redeclared here (mirroring @fws/generator) to avoid a
 * cross-package dependency — the renderer should not import from the generator.
 */

/** Biome classification mirroring @fws/generator BiomeType. */
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

export interface BiomeVisual {
  readonly char: string;
  readonly fg: string;
  readonly bg: string;
}

/**
 * Visual mapping for every biome type.
 *
 * Characters follow the design doc specification:
 *   ≈ oceans, ░ plains, █ forests, ▓ mountains, ▲ peaks/volcanoes,
 *   · desert/tundra, ~ coast/swamp
 */
export const BIOME_CHARS: Readonly<Record<BiomeType, BiomeVisual>> = {
  [BiomeType.DeepOcean]:    { char: '\u2248', fg: '#1a3a6e', bg: '#0a1428' }, // ≈
  [BiomeType.Ocean]:        { char: '\u2248', fg: '#2e6cba', bg: '#0f2040' }, // ≈
  [BiomeType.Coast]:        { char: '~',      fg: '#5ea8d4', bg: '#1a3050' }, // ~
  [BiomeType.Plains]:       { char: '\u2591', fg: '#7ec850', bg: '#1a2e10' }, // ░
  [BiomeType.Forest]:       { char: '\u2588', fg: '#2d8c2d', bg: '#0e1e0e' }, // █
  [BiomeType.DenseForest]:  { char: '\u2588', fg: '#1a5c1a', bg: '#0a140a' }, // █
  [BiomeType.Mountain]:     { char: '\u2593', fg: '#9e9e9e', bg: '#2a2a2a' }, // ▓
  [BiomeType.HighMountain]: { char: '\u25B2', fg: '#d0d0d0', bg: '#3a3a3a' }, // ▲
  [BiomeType.Desert]:       { char: '\u00B7', fg: '#e0c860', bg: '#3a3018' }, // ·
  [BiomeType.Tundra]:       { char: '\u00B7', fg: '#a0b8c8', bg: '#1e2830' }, // ·
  [BiomeType.Swamp]:        { char: '~',      fg: '#5a7a3a', bg: '#1a2210' }, // ~
  [BiomeType.Volcano]:      { char: '\u25B2', fg: '#e04020', bg: '#3a1008' }, // ▲
  [BiomeType.Jungle]:       { char: '\u2588', fg: '#10802a', bg: '#061408' }, // █
  [BiomeType.Savanna]:      { char: '\u2591', fg: '#c8a830', bg: '#2e2810' }, // ░
  [BiomeType.Taiga]:        { char: '\u2588', fg: '#3a6848', bg: '#0e1e14' }, // █
  [BiomeType.IceCap]:       { char: '\u2591', fg: '#e8f0ff', bg: '#3a4050' }, // ░
  [BiomeType.MagicWasteland]: { char: '\u2593', fg: '#b040e0', bg: '#1e0830' }, // ▓
};

export interface EntityMarker {
  readonly char: string;
  readonly fg: string;
  readonly label: string;
}

/** Map-overlay markers for world entities. */
export const ENTITY_MARKERS = {
  city:           { char: '\u263C', fg: '#f0d060', label: 'City' },        // ☼
  ruin:           { char: '\u2020', fg: '#808080', label: 'Ruins' },       // †
  army:           { char: '\u2694', fg: '#e04040', label: 'Army' },        // ⚔
  temple:         { char: '\u271D', fg: '#e0e0a0', label: 'Temple' },      // ✝
  academy:        { char: '\u2727', fg: '#60a0e0', label: 'Academy' },     // ✧
  factionCapital: { char: '\u2691', fg: '#ffd700', label: 'Capital' },     // ⚑
} as const satisfies Record<string, EntityMarker>;

export type EntityMarkerKey = keyof typeof ENTITY_MARKERS;
