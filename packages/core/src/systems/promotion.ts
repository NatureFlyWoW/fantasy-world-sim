/**
 * Promotion — promotes non-notable characters to full notable status
 * when their Notability score crosses the threshold.
 *
 * Adds Personality, Goal, Memory, and Health components based on
 * the character's spark history and profession.
 */

import { EventCategory } from '../events/types.js';
import { createEvent } from '../events/event-factory.js';
import type { World } from '../ecs/world.js';
import type { EventBus } from '../events/event-bus.js';
import type { SeededRNG } from '../utils/seeded-rng.js';
import type { EntityId } from '../ecs/types.js';
import type {
  NotabilityComponent,
  PersonalityComponent,
  StatusComponent,
} from '../ecs/component.js';

export const PROMOTION_THRESHOLD = 100;

/**
 * Spark descriptions mapped to personality trait adjustments.
 * Each spark nudges personality in a thematic direction.
 */
const SPARK_PERSONALITY_MAP: Record<string, Partial<Record<keyof Omit<PersonalityComponent, 'type' | 'serialize'>, number>>> = {
  'had a vivid prophetic dream': { openness: 0.15, neuroticism: 0.05 },
  'displayed unusual talent': { openness: 0.1, conscientiousness: 0.1 },
  'survived a close brush with danger': { neuroticism: 0.1, extraversion: -0.05 },
  'made a shrewd trade': { conscientiousness: 0.1, agreeableness: -0.05 },
  'showed unexpected courage': { extraversion: 0.15, neuroticism: -0.1 },
  'discovered a hidden skill': { openness: 0.15, conscientiousness: 0.05 },
  'earned respect through hard work': { conscientiousness: 0.15, agreeableness: 0.05 },
  'witnessed something extraordinary': { openness: 0.1, neuroticism: 0.05 },
  'rescued a neighbor from peril': { agreeableness: 0.15, extraversion: 0.1 },
  'forged an unlikely friendship': { agreeableness: 0.1, extraversion: 0.1 },
  'spoke truth to power': { extraversion: 0.1, conscientiousness: 0.1 },
  'recovered a lost heirloom': { conscientiousness: 0.1, openness: 0.05 },
};

/**
 * Profession-based default goals.
 */
const PROFESSION_GOALS: Record<string, string[]> = {
  farmer: ['Secure a good harvest', 'Protect the homestead'],
  blacksmith: ['Master the craft', 'Forge a renowned weapon'],
  herbalist: ['Discover new remedies', 'Heal the afflicted'],
  merchant: ['Build a trading empire', 'Secure profitable routes'],
  hunter: ['Track the great beast', 'Provide for the village'],
  weaver: ['Create a masterwork tapestry', 'Preserve traditional patterns'],
  guard: ['Defend the settlement', 'Earn a command'],
  scholar: ['Uncover hidden knowledge', 'Write a great treatise'],
  carpenter: ['Build a lasting monument', 'Master woodworking'],
  miner: ['Strike a rich vein', 'Survive the deep tunnels'],
};

const DEFAULT_GOALS = ['Survive and prosper', 'Make a name'];

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
 * Promote a non-notable character to full notable status.
 * Adds Personality, Goal, Memory, and Health components.
 * Returns true if promotion occurred, false if already promoted.
 */
export function promote(
  world: World,
  entityId: EntityId,
  currentTick: number,
  events: EventBus,
  rng?: SeededRNG,
): boolean {
  const notability = world.getComponent<NotabilityComponent>(entityId, 'Notability');
  if (notability === undefined) return false;
  if (notability.score < PROMOTION_THRESHOLD) return false;

  // Already has Personality = already promoted
  if (world.hasComponent(entityId, 'Personality')) return false;

  const status = world.getComponent<StatusComponent>(entityId, 'Status');
  const name = status !== undefined ? status.titles[0] ?? 'Unknown' : 'Unknown';
  const profession = status !== undefined ? status.socialClass : 'farmer';

  // Build personality from spark history
  const personality = buildPersonality(notability.sparkHistory, rng);
  world.addComponent(entityId, makeSerializable({
    type: 'Personality' as const,
    ...personality,
  }));

  // Build goals from profession
  const profGoals = PROFESSION_GOALS[profession] ?? DEFAULT_GOALS;
  const objectives = profGoals.slice(0, 2);
  const priorities = new Map<string, number>();
  for (let i = 0; i < objectives.length; i++) {
    const obj = objectives[i];
    if (obj !== undefined) {
      priorities.set(obj, i === 0 ? 0.8 : 0.5);
    }
  }
  world.addComponent(entityId, makeSerializable({
    type: 'Goal' as const,
    objectives,
    priorities,
  }));

  // Build memories from spark history
  const memories: Array<{ eventId: number; importance: number; distortion: number }> = [];
  for (const spark of notability.sparkHistory) {
    memories.push({
      eventId: spark.tick,
      importance: 0.7,
      distortion: 0,
    });
  }
  world.addComponent(entityId, makeSerializable({
    type: 'Memory' as const,
    memories,
    capacity: 50,
  }));

  // Add Health component
  if (!world.hasComponent(entityId, 'Health')) {
    world.addComponent(entityId, makeSerializable({
      type: 'Health' as const,
      current: 100,
      maximum: 100,
      injuries: [] as string[],
      diseases: [] as string[],
    }));
  }

  // Emit promotion event
  const backstory = notability.sparkHistory
    .map(s => s.description)
    .join('; ');

  events.emit(createEvent({
    category: EventCategory.Personal,
    subtype: 'population.promotion',
    timestamp: currentTick,
    participants: [entityId],
    significance: 70,
    data: {
      name,
      profession,
      backstory,
      notabilityScore: notability.score,
      sparkCount: notability.sparkHistory.length,
    },
  }));

  return true;
}

/**
 * Build personality values from spark history, clamping to [0, 1].
 */
function buildPersonality(
  sparkHistory: Array<{ tick: number; description: string }>,
  rng?: SeededRNG,
): Omit<PersonalityComponent, 'type' | 'serialize'> {
  // Start with moderate baseline + some randomness
  const base = rng !== undefined ? rng.next() * 0.2 + 0.4 : 0.5;
  const personality = {
    openness: base,
    conscientiousness: base,
    extraversion: base,
    agreeableness: base,
    neuroticism: base,
  };

  // Apply spark-based adjustments
  for (const spark of sparkHistory) {
    const adjustments = SPARK_PERSONALITY_MAP[spark.description];
    if (adjustments !== undefined) {
      for (const [trait, delta] of Object.entries(adjustments)) {
        if (delta !== undefined && trait in personality) {
          (personality as Record<string, number>)[trait] = Math.max(0, Math.min(1,
            (personality as Record<string, number>)[trait]! + delta
          ));
        }
      }
    }
  }

  return personality;
}
