/**
 * Population utilities for non-notable character creation and race lifespan data.
 */

import type { EntityId } from '../ecs/types.js';
import type { World } from '../ecs/world.js';

export interface NonNotableConfig {
  name: string;
  race: string;
  age: number;
  profession: string;
  siteId: number;
  x: number;
  y: number;
  currentTick: number;
  motherId: number | null;
  fatherId: number | null;
}

/**
 * Race lifespan data. Since races are procedurally generated, the PopulationSystem
 * builds this map at init time from settlement demographics. These defaults serve
 * as fallbacks and for testing.
 */
export interface RaceLifespan {
  expected: number;
  maximum: number;
}

export const DEFAULT_RACE_LIFESPANS: Record<string, RaceLifespan> = {
  // Fallback values based on lifespan tiers from race generator
  'short-lived': { expected: 35, maximum: 50 },
  baseline: { expected: 70, maximum: 90 },
  'long-lived': { expected: 350, maximum: 500 },
  ancient: { expected: 700, maximum: 1000 },
};

/** Default lifespan when race is unknown */
export const FALLBACK_LIFESPAN: RaceLifespan = { expected: 70, maximum: 90 };

/**
 * Professions available for non-notable characters.
 */
export const PROFESSIONS = [
  'farmer',
  'smith',
  'merchant',
  'soldier',
  'scholar',
  'priest',
  'carpenter',
  'weaver',
  'hunter',
  'miner',
  'fisher',
  'herder',
  'brewer',
  'mason',
  'healer',
] as const;

function makeSerializable<T extends { type: string }>(data: T): T & { serialize(): Record<string, unknown> } {
  return {
    ...data,
    serialize() {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(this)) {
        if (key !== 'serialize' && typeof value !== 'function') {
          result[key] = value;
        }
      }
      return result;
    },
  };
}

/**
 * Create a lightweight non-notable character entity.
 * Non-notables have minimal components: Position, Status, Notability, Parentage.
 * They can be promoted to full notables when Notability.score >= 100.
 */
export function createNonNotable(world: World, config: NonNotableConfig): EntityId {
  const entityId = world.createEntity();

  // Position at the settlement
  world.addComponent(entityId, makeSerializable({
    type: 'Position' as const,
    x: config.x,
    y: config.y,
  }));

  // Status — name in titles[0], profession as socialClass
  world.addComponent(entityId, makeSerializable({
    type: 'Status' as const,
    conditions: [],
    titles: [config.name],
    socialClass: config.profession,
  }));

  // Notability — starts at 0, birthTick for age calculation
  const birthTick = config.currentTick - config.age * 360;
  world.addComponent(entityId, makeSerializable({
    type: 'Notability' as const,
    score: 0,
    birthTick,
    sparkHistory: [],
  }));

  // Parentage — links to parents (if known)
  world.addComponent(entityId, makeSerializable({
    type: 'Parentage' as const,
    motherId: config.motherId,
    fatherId: config.fatherId,
  }));

  return entityId;
}
