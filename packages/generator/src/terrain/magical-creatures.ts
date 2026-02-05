/**
 * Magical creature placement scaled by magicPrevalence.
 * Dragons, fey, elementals, undead — each with placement rules.
 */

import type { SeededRNG } from '../rng.js';
import type { WorldConfig, MagicPrevalence } from '../config/types.js';
import type { WorldMap } from './world-map.js';
import { BiomeType } from './terrain-tile.js';

/**
 * Category of magical creature.
 */
export enum MagicalCreatureType {
  Dragon = 'Dragon',
  Fey = 'Fey',
  Elemental = 'Elemental',
  Undead = 'Undead',
  GiantBeast = 'GiantBeast',
  Demon = 'Demon',
}

/**
 * Elemental affinity for elementals.
 */
export type ElementalAffinity = 'fire' | 'water' | 'earth' | 'air' | 'arcane';

/**
 * A placed magical creature.
 */
export interface MagicalCreature {
  /** Creature type category */
  readonly type: MagicalCreatureType;
  /** Position on the map */
  readonly x: number;
  readonly y: number;
  /** Territorial radius */
  readonly radius: number;
  /** Threat level 1-10 */
  readonly threatLevel: number;
  /** Name hint for narrative generation */
  readonly nameHint: string;
  /** Elemental affinity (for elementals) */
  readonly affinity: ElementalAffinity | undefined;
}

/**
 * MagicPrevalence → multiplier for creature counts.
 */
const MAGIC_MULTIPLIER: Record<MagicPrevalence, number> = {
  mundane: 0,
  low: 0.3,
  moderate: 1.0,
  high: 2.0,
  ubiquitous: 4.0,
};

export class MagicalCreaturePlacer {
  /**
   * Place magical creatures across the world.
   */
  place(worldMap: WorldMap, config: WorldConfig, rng: SeededRNG): MagicalCreature[] {
    const magicRng = rng.fork('magical-creatures');
    const mult = MAGIC_MULTIPLIER[config.magicPrevalence];

    if (mult === 0) return [];

    const width = worldMap.getWidth();
    const height = worldMap.getHeight();
    const mapArea = width * height;

    // Base counts per creature type, scaled by map area and magic level
    const baseScale = mapArea / 40000; // normalize to small map
    const creatures: MagicalCreature[] = [];

    // Dragons: remote high mountains
    const dragonCount = Math.round(Math.max(0, 2 * baseScale * mult));
    this.placeDragons(worldMap, dragonCount, creatures, magicRng);

    // Fey: ancient dense forests
    const feyCount = Math.round(Math.max(0, 5 * baseScale * mult));
    this.placeFey(worldMap, feyCount, creatures, magicRng);

    // Elementals: ley line intersections
    const elementalCount = Math.round(Math.max(0, 4 * baseScale * mult));
    this.placeElementals(worldMap, elementalCount, creatures, magicRng);

    // Undead: ruins-worthy locations (mountains edges, volcanic areas)
    const undeadCount = Math.round(Math.max(0, 3 * baseScale * mult));
    this.placeUndead(worldMap, undeadCount, creatures, magicRng);

    return creatures;
  }

  /**
   * Place dragons in remote mountain ranges (elevation > 7000).
   */
  private placeDragons(
    worldMap: WorldMap,
    count: number,
    creatures: MagicalCreature[],
    rng: SeededRNG
  ): void {
    const candidates = this.findTiles(worldMap, (tile) =>
      tile.elevation > 7000 &&
      (tile.biome === BiomeType.HighMountain || tile.biome === BiomeType.Mountain)
    );

    rng.shuffle(candidates as Array<{ x: number; y: number }>);
    const placed = this.pickSpaced(candidates, count, 30);

    for (const pos of placed) {
      creatures.push({
        type: MagicalCreatureType.Dragon,
        x: pos.x,
        y: pos.y,
        radius: 25,
        threatLevel: 10,
        nameHint: 'dragon',
        affinity: rng.pick(['fire', 'earth', 'arcane'] as const),
      });
    }
  }

  /**
   * Place fey in dense forest clusters.
   */
  private placeFey(
    worldMap: WorldMap,
    count: number,
    creatures: MagicalCreature[],
    rng: SeededRNG
  ): void {
    const candidates = this.findTiles(worldMap, (tile) =>
      tile.biome === BiomeType.DenseForest || tile.biome === BiomeType.Jungle
    );

    rng.shuffle(candidates as Array<{ x: number; y: number }>);
    const placed = this.pickSpaced(candidates, count, 15);

    for (const pos of placed) {
      creatures.push({
        type: MagicalCreatureType.Fey,
        x: pos.x,
        y: pos.y,
        radius: 10,
        threatLevel: rng.nextInt(2, 5),
        nameHint: 'fey',
        affinity: undefined,
      });
    }
  }

  /**
   * Place elementals at ley line nodes.
   */
  private placeElementals(
    worldMap: WorldMap,
    count: number,
    creatures: MagicalCreature[],
    rng: SeededRNG
  ): void {
    const candidates = this.findTiles(worldMap, (tile) =>
      tile.leyLine && tile.elevation > 0
    );

    rng.shuffle(candidates as Array<{ x: number; y: number }>);
    const placed = this.pickSpaced(candidates, count, 20);

    const affinities: ElementalAffinity[] = ['fire', 'water', 'earth', 'air', 'arcane'];
    for (const pos of placed) {
      const tile = worldMap.getTile(pos.x, pos.y);
      // Affinity based on biome
      let affinity: ElementalAffinity;
      if (tile?.biome === BiomeType.Volcano || tile?.biome === BiomeType.Desert) {
        affinity = 'fire';
      } else if (tile?.biome === BiomeType.Coast || tile?.biome === BiomeType.Swamp) {
        affinity = 'water';
      } else if (tile?.biome === BiomeType.Mountain || tile?.biome === BiomeType.HighMountain) {
        affinity = 'earth';
      } else if (tile !== undefined && tile.elevation > 3000) {
        affinity = 'air';
      } else {
        affinity = rng.pick(affinities);
      }

      creatures.push({
        type: MagicalCreatureType.Elemental,
        x: pos.x,
        y: pos.y,
        radius: 12,
        threatLevel: rng.nextInt(4, 8),
        nameHint: `${affinity}_elemental`,
        affinity,
      });
    }
  }

  /**
   * Place undead in ruins-worthy locations.
   */
  private placeUndead(
    worldMap: WorldMap,
    count: number,
    creatures: MagicalCreature[],
    rng: SeededRNG
  ): void {
    // Undead favor edges of mountains, volcanic areas, swamps
    const candidates = this.findTiles(worldMap, (tile) =>
      tile.elevation > 0 && (
        tile.biome === BiomeType.Swamp ||
        tile.biome === BiomeType.MagicWasteland ||
        (tile.biome === BiomeType.Mountain && tile.elevation < 6000) ||
        tile.biome === BiomeType.Tundra
      )
    );

    rng.shuffle(candidates as Array<{ x: number; y: number }>);
    const placed = this.pickSpaced(candidates, count, 25);

    for (const pos of placed) {
      creatures.push({
        type: MagicalCreatureType.Undead,
        x: pos.x,
        y: pos.y,
        radius: 8,
        threatLevel: rng.nextInt(5, 9),
        nameHint: 'undead',
        affinity: undefined,
      });
    }
  }

  /**
   * Find all tiles matching a predicate, sampled at intervals for performance.
   */
  private findTiles(
    worldMap: WorldMap,
    predicate: (tile: { elevation: number; biome: BiomeType; leyLine: boolean }) => boolean
  ): Array<{ x: number; y: number }> {
    const width = worldMap.getWidth();
    const height = worldMap.getHeight();
    const step = Math.max(1, Math.floor(Math.min(width, height) / 100));
    const results: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const tile = worldMap.getTile(x, y);
        if (tile !== undefined && predicate(tile)) {
          results.push({ x, y });
        }
      }
    }

    return results;
  }

  /**
   * Pick well-spaced positions from candidates.
   */
  private pickSpaced(
    candidates: readonly { x: number; y: number }[],
    count: number,
    minDist: number
  ): Array<{ x: number; y: number }> {
    const minDistSq = minDist * minDist;
    const picked: Array<{ x: number; y: number }> = [];

    for (const candidate of candidates) {
      if (picked.length >= count) break;

      let tooClose = false;
      for (const existing of picked) {
        const dx = candidate.x - existing.x;
        const dy = candidate.y - existing.y;
        if (dx * dx + dy * dy < minDistSq) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        picked.push(candidate);
      }
    }

    return picked;
  }
}
