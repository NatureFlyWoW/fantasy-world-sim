/**
 * Settlement placement — places cities, towns, and villages on the world map
 * after pre-history, using terrain suitability, ruin sites, and civ density.
 */

import type { SeededRNG } from '../rng.js';
import type { WorldConfig } from '../config/types.js';
import { resolveCivCount } from '../config/resolver.js';
import type { WorldMap } from '../terrain/world-map.js';
import type { PreHistoryResult, RuinSite } from '../history/pre-history.js';
import { BiomeType, ResourceType } from '../terrain/terrain-tile.js';
import type { TerrainTile } from '../terrain/terrain-tile.js';
import type { NameGenerator } from '../character/name-generator.js';

/**
 * Settlement type, determines size and function.
 */
export type SettlementType = 'city' | 'town' | 'village';

/**
 * Economic focus of a settlement.
 */
export type EconomicFocus =
  | 'agriculture'
  | 'mining'
  | 'trade'
  | 'fishing'
  | 'forestry'
  | 'military'
  | 'magical'
  | 'religious';

/**
 * Structure present in a settlement.
 */
export interface SettlementStructure {
  readonly name: string;
  readonly type: 'market' | 'temple' | 'fortress' | 'library' | 'tavern' | 'guild' | 'palace' | 'wall' | 'harbor' | 'mine';
}

/**
 * A settlement in the world.
 */
export interface Settlement {
  readonly name: string;
  readonly type: SettlementType;
  readonly x: number;
  readonly y: number;
  readonly population: number;
  readonly economicFocus: EconomicFocus;
  readonly structures: readonly SettlementStructure[];
  /** Index into the faction array (assigned by FactionInitializer) */
  factionIndex: number | undefined;
  /** Race name of the dominant population */
  readonly dominantRace: string;
  /** Whether this settlement is built on/near a ruin */
  readonly nearRuin: RuinSite | undefined;
}

/**
 * Population range per settlement type.
 */
const POPULATION_RANGES: Record<SettlementType, { min: number; max: number }> = {
  city: { min: 5000, max: 25000 },
  town: { min: 800, max: 5000 },
  village: { min: 50, max: 800 },
};

/**
 * Biome → economic focus weights.
 */
const BIOME_ECONOMY: Partial<Record<BiomeType, readonly EconomicFocus[]>> = {
  [BiomeType.Plains]: ['agriculture', 'trade'],
  [BiomeType.Forest]: ['forestry', 'agriculture'],
  [BiomeType.DenseForest]: ['forestry'],
  [BiomeType.Mountain]: ['mining', 'military'],
  [BiomeType.Coast]: ['fishing', 'trade'],
  [BiomeType.Savanna]: ['agriculture', 'trade'],
  [BiomeType.Jungle]: ['forestry', 'magical'],
  [BiomeType.Desert]: ['trade', 'mining'],
  [BiomeType.Taiga]: ['forestry', 'mining'],
  [BiomeType.Tundra]: ['military', 'mining'],
  [BiomeType.Swamp]: ['magical', 'fishing'],
};

/**
 * Structures that match specific economic focuses.
 */
const ECONOMY_STRUCTURES: Record<EconomicFocus, readonly SettlementStructure[]> = {
  agriculture: [
    { name: 'Granary', type: 'market' },
    { name: 'Farmers\' Market', type: 'market' },
  ],
  mining: [
    { name: 'Deep Mine', type: 'mine' },
    { name: 'Smelting Works', type: 'guild' },
  ],
  trade: [
    { name: 'Grand Bazaar', type: 'market' },
    { name: 'Merchant Guild', type: 'guild' },
  ],
  fishing: [
    { name: 'Fish Market', type: 'market' },
    { name: 'Harbor', type: 'harbor' },
  ],
  forestry: [
    { name: 'Lumber Mill', type: 'guild' },
    { name: 'Woodworkers\' Hall', type: 'guild' },
  ],
  military: [
    { name: 'Barracks', type: 'fortress' },
    { name: 'Armory', type: 'fortress' },
  ],
  magical: [
    { name: 'Arcane Tower', type: 'library' },
    { name: 'Enchanting Circle', type: 'guild' },
  ],
  religious: [
    { name: 'Grand Temple', type: 'temple' },
    { name: 'Shrine District', type: 'temple' },
  ],
};

/**
 * Habitable biomes for settlement placement.
 */
const HABITABLE = new Set<BiomeType>([
  BiomeType.Plains, BiomeType.Forest, BiomeType.DenseForest,
  BiomeType.Mountain, BiomeType.Coast, BiomeType.Savanna,
  BiomeType.Jungle, BiomeType.Taiga, BiomeType.Tundra,
  BiomeType.Swamp, BiomeType.Desert,
]);

export class SettlementPlacer {
  /**
   * Place settlements based on terrain, pre-history, and configuration.
   */
  place(
    worldMap: WorldMap,
    preHistory: PreHistoryResult,
    raceDominance: ReadonlyMap<string, string>,
    nameGen: NameGenerator,
    config: WorldConfig,
    rng: SeededRNG
  ): Settlement[] {
    const placeRng = rng.fork('settlements');
    const width = worldMap.getWidth();
    const height = worldMap.getHeight();

    // Determine settlement counts
    const civRange = resolveCivCount(config.worldSize, config.civilizationDensity);
    const cityCount = placeRng.nextInt(civRange.min, civRange.max);
    const townCount = cityCount * placeRng.nextInt(2, 3);
    const villageCount = townCount * placeRng.nextInt(2, 4);
    const totalCount = cityCount + townCount + villageCount;

    // Gather candidate tiles
    const step = Math.max(1, Math.floor(Math.min(width, height) / 60));
    const candidates = this.findCandidates(worldMap, step);
    if (candidates.length === 0) return [];

    // Score candidates with ruin proximity bonus
    const scored = this.scoreCandidates(candidates, worldMap, preHistory.ruins);
    scored.sort((a, b) => b.score - a.score);

    const settlements: Settlement[] = [];
    const occupied = new Set<string>();
    const minDist = Math.max(5, Math.floor(Math.min(width, height) / (totalCount + 1)));

    // Place cities first (best sites), then towns, then villages
    const types: Array<{ type: SettlementType; count: number }> = [
      { type: 'city', count: cityCount },
      { type: 'town', count: townCount },
      { type: 'village', count: villageCount },
    ];

    for (const { type, count } of types) {
      let placed = 0;
      for (const candidate of scored) {
        if (placed >= count) break;

        // Check minimum distance from existing settlements
        if (this.isTooClose(candidate.x, candidate.y, settlements, minDist)) continue;

        const key = `${candidate.x},${candidate.y}`;
        if (occupied.has(key)) continue;
        occupied.add(key);

        const tile = worldMap.getTile(candidate.x, candidate.y);
        if (tile === undefined) continue;

        const settlement = this.createSettlement(
          candidate.x, candidate.y, type, tile,
          candidate.nearRuin, raceDominance, nameGen,
          config, placeRng
        );
        settlements.push(settlement);
        placed++;
      }
    }

    return settlements;
  }

  private findCandidates(
    worldMap: WorldMap,
    step: number
  ): Array<{ x: number; y: number }> {
    const width = worldMap.getWidth();
    const height = worldMap.getHeight();
    const sites: Array<{ x: number; y: number }> = [];

    for (let y = step; y < height - step; y += step) {
      for (let x = step; x < width - step; x += step) {
        const tile = worldMap.getTile(x, y);
        if (tile !== undefined && HABITABLE.has(tile.biome) &&
            tile.elevation > 5 && tile.elevation < 5000) {
          sites.push({ x, y });
        }
      }
    }

    return sites;
  }

  private scoreCandidates(
    candidates: ReadonlyArray<{ x: number; y: number }>,
    worldMap: WorldMap,
    ruins: readonly RuinSite[]
  ): Array<{ x: number; y: number; score: number; nearRuin: RuinSite | undefined }> {
    return candidates.map(c => {
      const tile = worldMap.getTile(c.x, c.y);
      if (tile === undefined) return { ...c, score: 0, nearRuin: undefined };

      let score = this.scoreTile(c.x, c.y, tile, worldMap);

      // Ruin proximity bonus — civilizations rebuild on proven sites
      let nearRuin: RuinSite | undefined;
      for (const ruin of ruins) {
        const dx = c.x - ruin.x;
        const dy = c.y - ruin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 15) {
          score += Math.round(20 * (1 - dist / 15));
          if (nearRuin === undefined || dist < Math.sqrt(
            (c.x - nearRuin.x) ** 2 + (c.y - nearRuin.y) ** 2
          )) {
            nearRuin = ruin;
          }
        }
      }

      return { ...c, score, nearRuin };
    });
  }

  private scoreTile(
    x: number, y: number, tile: TerrainTile, worldMap: WorldMap
  ): number {
    let score = 0;

    // River access
    if (tile.riverId !== undefined) score += 25;

    // Fertile neighbors
    let fertile = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const n = worldMap.getTile(x + dx, y + dy);
        if (n !== undefined && (
          n.biome === BiomeType.Plains ||
          n.biome === BiomeType.Forest ||
          n.biome === BiomeType.Savanna
        )) fertile++;
      }
    }
    score += Math.min(20, fertile * 2);

    // Resources nearby
    const resourceTypes = new Set<ResourceType>();
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const n = worldMap.getTile(x + dx, y + dy);
        if (n !== undefined) {
          for (const r of n.resources) resourceTypes.add(r);
        }
      }
    }
    score += Math.min(15, resourceTypes.size * 3);

    // Moderate temperature
    if (tile.temperature > 5 && tile.temperature < 30) score += 10;

    // Moderate elevation
    if (tile.elevation > 100 && tile.elevation < 2000) score += 5;

    // Ley line bonus for magical settlements
    if (tile.leyLine) score += 8;

    return score;
  }

  private isTooClose(
    x: number, y: number,
    existing: readonly Settlement[],
    minDist: number
  ): boolean {
    const minDistSq = minDist * minDist;
    for (const s of existing) {
      const dx = x - s.x;
      const dy = y - s.y;
      if (dx * dx + dy * dy < minDistSq) return true;
    }
    return false;
  }

  private createSettlement(
    x: number, y: number,
    type: SettlementType,
    tile: TerrainTile,
    nearRuin: RuinSite | undefined,
    raceDominance: ReadonlyMap<string, string>,
    nameGen: NameGenerator,
    config: WorldConfig,
    rng: SeededRNG
  ): Settlement {
    const popRange = POPULATION_RANGES[type];
    const population = rng.nextInt(popRange.min, popRange.max);

    // Economic focus based on biome
    const biomeEconomy = BIOME_ECONOMY[tile.biome];
    const economicFocus: EconomicFocus = biomeEconomy !== undefined && biomeEconomy.length > 0
      ? rng.pick(biomeEconomy)
      : 'agriculture';

    // Structures: base + economy-specific
    const structures: SettlementStructure[] = [];

    // Every settlement has a tavern
    structures.push({ name: 'The Wayfarer\'s Rest', type: 'tavern' });

    // Economy structures
    const ecoStructures = ECONOMY_STRUCTURES[economicFocus];
    structures.push(rng.pick(ecoStructures));

    // Cities get extra structures
    if (type === 'city') {
      structures.push({ name: 'City Walls', type: 'wall' });
      structures.push({ name: 'Royal Palace', type: 'palace' });
      if (config.pantheonComplexity !== 'atheistic') {
        structures.push({ name: 'Grand Cathedral', type: 'temple' });
      }
      if (config.magicPrevalence !== 'mundane') {
        structures.push({ name: 'Academy of Arcana', type: 'library' });
      }
    }

    // Towns get a wall and a temple
    if (type === 'town') {
      structures.push({ name: 'Town Walls', type: 'wall' });
      if (config.pantheonComplexity !== 'atheistic' && rng.next() < 0.7) {
        structures.push({ name: 'Temple', type: 'temple' });
      }
    }

    // Find dominant race for this area
    const key = `${Math.floor(x / 50)},${Math.floor(y / 50)}`;
    const dominantRace = raceDominance.get(key) ?? raceDominance.values().next().value ?? 'Unknown';

    // Find naming convention for this race (we use the key to look up but fallback to first culture)
    const namingConvention = this.resolveNamingConvention(dominantRace, raceDominance, nameGen);
    const name = nameGen.generatePlaceName(namingConvention, type, rng);

    return {
      name,
      type,
      x,
      y,
      population,
      economicFocus,
      structures,
      factionIndex: undefined,
      dominantRace,
      nearRuin,
    };
  }

  private resolveNamingConvention(
    _raceName: string,
    _raceDominance: ReadonlyMap<string, string>,
    nameGen: NameGenerator
  ): string {
    // Try common culture ids
    const cultures = ['nordic', 'elvish', 'dwarven', 'desert', 'eastern', 'fey', 'infernal'];
    for (const c of cultures) {
      if (nameGen.hasCulture(c)) return c;
    }
    return 'nordic';
  }
}
