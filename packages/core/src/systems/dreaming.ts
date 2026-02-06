/**
 * Dreaming Layer — subconscious processing for characters.
 *
 * Each tick, characters with high emotional memory load may dream.
 * Dreams affect goal priorities, phobias, research breakthroughs,
 * secret suspicion, and cultural identity.
 *
 * Player integration: PropheticDream influence action inserts content
 * into this layer. Characters process planted dreams as if natural.
 */

import type { EntityId, CharacterId, SiteId } from '../ecs/types.js';
import type { World } from '../ecs/world.js';
import type { WorldClock } from '../time/world-clock.js';
import type { EventBus } from '../events/event-bus.js';
import { TickFrequency } from '../time/types.js';
import { EventCategory } from '../events/types.js';
import type { TickNumber } from '../events/types.js';
import { createEvent } from '../events/event-factory.js';
import { BaseSystem, ExecutionOrder } from '../engine/system.js';
import type { Memory } from './memory-types.js';
import { CharacterMemoryStore } from './memory-store.js';

// ── Dream types ─────────────────────────────────────────────────────────────

export enum DreamType {
  /** Conflicting goals sorted by subconscious — reduces stress, may shift goal priority */
  GoalResolution = 'GoalResolution',
  /** Traumatic memories replay with embellishment — increases anxiety, may add phobia */
  FearReinforcement = 'FearReinforcement',
  /** Random connection between knowledge domains — research breakthrough +20% next day */
  CreativeInspiration = 'CreativeInspiration',
  /** Dreaming about clues from Secret Knowledge — suspicion increases */
  SecretProcessing = 'SecretProcessing',
  /** Cultural stories transmute into personal visions — strengthens cultural identity */
  OralTraditionVision = 'OralTraditionVision',
}

export const ALL_DREAM_TYPES: readonly DreamType[] = [
  DreamType.GoalResolution,
  DreamType.FearReinforcement,
  DreamType.CreativeInspiration,
  DreamType.SecretProcessing,
  DreamType.OralTraditionVision,
] as const;

// ── Dream record ────────────────────────────────────────────────────────────

export interface DreamRecord {
  /** Character who dreamed */
  readonly characterId: CharacterId;
  /** Type of dream experienced */
  readonly dreamType: DreamType;
  /** When the dream occurred */
  readonly tick: TickNumber;
  /** Brief description of dream content */
  readonly description: string;
  /** Memories that contributed to this dream */
  readonly sourceMemoryIds: readonly import('../ecs/types.js').EventId[];
  /** Whether this was a planted prophetic dream */
  readonly isProphetic: boolean;
  /** Vision content if prophetic */
  readonly propheticVision?: string;
}

// ── Dream effects ───────────────────────────────────────────────────────────

export interface DreamEffect {
  readonly type: DreamType;
  /** Goal priority shift: goalId → delta (-0.2 to +0.2) */
  readonly goalShifts: ReadonlyMap<number, number>;
  /** Stress reduction (0-20) */
  readonly stressReduction: number;
  /** Phobia added (trait name to decrease) */
  readonly phobiaAdded?: string;
  /** Research breakthrough bonus (0.0-0.2) */
  readonly researchBonus: number;
  /** Secret suspicion increases: secretId → delta (0-15) */
  readonly suspicionIncreases: ReadonlyMap<EntityId, number>;
  /** Cultural identity boost (0-10) */
  readonly culturalBoost: number;
}

// ── Planted dream (from influence system) ───────────────────────────────────

export interface PlantedDream {
  readonly characterId: CharacterId;
  readonly vision: string;
  readonly plantedAt: TickNumber;
}

// ── Dreaming system configuration ───────────────────────────────────────────

export interface DreamingConfig {
  /** Maximum dream probability per night (default 0.3 = 30%) */
  readonly maxDreamProbability: number;
  /** Number of top emotional memories to consider for load */
  readonly topMemoryCount: number;
  /** Minimum emotional load (0-100) to have any dream chance */
  readonly minEmotionalLoad: number;
  /** Phobia threshold: emotional weight below this on trauma memories triggers phobia */
  readonly phobiaThreshold: number;
  /** Research bonus granted by CreativeInspiration */
  readonly researchBonusAmount: number;
  /** Suspicion boost from SecretProcessing dreams */
  readonly suspicionBoostAmount: number;
  /** Goal shift magnitude for GoalResolution dreams */
  readonly goalShiftMagnitude: number;
  /** Cultural boost from OralTraditionVision */
  readonly culturalBoostAmount: number;
  /** Stress reduction from GoalResolution dreams */
  readonly stressReductionAmount: number;
}

export const DEFAULT_DREAMING_CONFIG: DreamingConfig = {
  maxDreamProbability: 0.3,
  topMemoryCount: 5,
  minEmotionalLoad: 10,
  phobiaThreshold: -60,
  researchBonusAmount: 0.2,
  suspicionBoostAmount: 10,
  goalShiftMagnitude: 0.15,
  culturalBoostAmount: 5,
  stressReductionAmount: 10,
};

// ── Helper: compute emotional load ──────────────────────────────────────────

/**
 * Compute the emotional load for a character from their top N emotional memories.
 * Returns 0-100 scale.
 */
export function computeEmotionalLoad(
  memories: readonly Memory[],
  topN: number,
): number {
  if (memories.length === 0) return 0;

  // Sort by absolute emotional weight descending
  const sorted = [...memories].sort(
    (a, b) => Math.abs(b.emotionalWeight) - Math.abs(a.emotionalWeight),
  );

  const top = sorted.slice(0, topN);
  if (top.length === 0) return 0;

  const sum = top.reduce((acc, m) => acc + Math.abs(m.emotionalWeight), 0);
  return Math.min(100, sum / top.length);
}

/**
 * Calculate dream probability from emotional load.
 * Formula: emotionalLoad / 100 × maxProbability
 */
export function calculateDreamProbability(
  emotionalLoad: number,
  maxProbability: number,
): number {
  return Math.min(maxProbability, (emotionalLoad / 100) * maxProbability);
}

// ── Helper: select dream type ───────────────────────────────────────────────

export interface DreamTypeContext {
  /** Whether character has conflicting goals */
  readonly hasConflictingGoals: boolean;
  /** Whether character has traumatic memories (emotionalWeight < -50) */
  readonly hasTraumaticMemories: boolean;
  /** Whether character has scholarly or creative traits */
  readonly isCreativeOrScholarly: boolean;
  /** Whether character suspects any secrets */
  readonly hasSuspectedSecrets: boolean;
  /** Whether character is in a settlement with oral traditions */
  readonly hasOralTraditions: boolean;
}

/**
 * Compute weighted probabilities for each dream type based on context.
 * Returns weights (not normalized) for each dream type.
 */
export function computeDreamTypeWeights(
  context: DreamTypeContext,
): ReadonlyMap<DreamType, number> {
  const weights = new Map<DreamType, number>();

  // GoalResolution: higher when goals conflict
  weights.set(DreamType.GoalResolution, context.hasConflictingGoals ? 3.0 : 1.0);

  // FearReinforcement: higher when traumatic memories exist
  weights.set(DreamType.FearReinforcement, context.hasTraumaticMemories ? 3.0 : 0.5);

  // CreativeInspiration: higher for scholarly/creative characters
  weights.set(DreamType.CreativeInspiration, context.isCreativeOrScholarly ? 2.5 : 0.8);

  // SecretProcessing: only possible if secrets are suspected
  weights.set(DreamType.SecretProcessing, context.hasSuspectedSecrets ? 2.0 : 0.0);

  // OralTraditionVision: only possible if oral traditions exist nearby
  weights.set(DreamType.OralTraditionVision, context.hasOralTraditions ? 2.0 : 0.0);

  return weights;
}

/**
 * Select a dream type from weighted probabilities using a random value [0,1).
 */
export function selectDreamType(
  weights: ReadonlyMap<DreamType, number>,
  randomValue: number,
): DreamType {
  let totalWeight = 0;
  for (const w of weights.values()) {
    totalWeight += w;
  }

  if (totalWeight === 0) return DreamType.GoalResolution;

  let cumulative = 0;
  for (const [dreamType, weight] of weights) {
    cumulative += weight / totalWeight;
    if (randomValue < cumulative) {
      return dreamType;
    }
  }

  return DreamType.GoalResolution;
}

// ── Helper: build dream effect ──────────────────────────────────────────────

/**
 * Build the effect of a dream based on its type and context.
 */
export function buildDreamEffect(
  dreamType: DreamType,
  memories: readonly Memory[],
  config: DreamingConfig,
): DreamEffect {
  const goalShifts = new Map<number, number>();
  const suspicionIncreases = new Map<EntityId, number>();
  let stressReduction = 0;
  let phobiaAdded: string | undefined;
  let researchBonus = 0;
  let culturalBoost = 0;

  switch (dreamType) {
    case DreamType.GoalResolution:
      stressReduction = config.stressReductionAmount;
      break;

    case DreamType.FearReinforcement: {
      // Find most traumatic memory
      const traumatic = memories
        .filter(m => m.emotionalWeight < config.phobiaThreshold)
        .sort((a, b) => a.emotionalWeight - b.emotionalWeight);
      if (traumatic.length > 0) {
        // Phobia derived from the most traumatic memory's category
        const worst = traumatic[0]!;
        phobiaAdded = phobiaFromCategory(worst.category);
      }
      break;
    }

    case DreamType.CreativeInspiration:
      researchBonus = config.researchBonusAmount;
      break;

    case DreamType.SecretProcessing:
      // Boost suspicion for secrets related to memories' participants
      // The actual secret IDs will be filled in by the system
      break;

    case DreamType.OralTraditionVision:
      culturalBoost = config.culturalBoostAmount;
      break;
  }

  return {
    type: dreamType,
    goalShifts,
    stressReduction,
    ...(phobiaAdded !== undefined ? { phobiaAdded } : {}),
    researchBonus,
    suspicionIncreases,
    culturalBoost,
  };
}

/**
 * Map memory categories to phobia trait names.
 */
function phobiaFromCategory(category: string): string {
  switch (category) {
    case 'military': return 'cautious';
    case 'disaster': return 'cautious';
    case 'political': return 'paranoid';
    case 'personal': return 'paranoid';
    case 'magical': return 'cautious';
    default: return 'cautious';
  }
}

// ── Dream description generation ────────────────────────────────────────────

const DREAM_DESCRIPTIONS: Record<DreamType, readonly string[]> = {
  [DreamType.GoalResolution]: [
    'a peaceful vision of paths converging into clarity',
    'a dream of conflicting voices finding harmony',
    'a vision where past choices aligned into purpose',
    'a tranquil dream of standing at a crossroads, choosing with certainty',
  ],
  [DreamType.FearReinforcement]: [
    'a nightmare of shadows closing in, reliving old wounds',
    'a dark dream of familiar faces twisted by fear',
    'a restless vision of past horrors magnified',
    'a dream of being pursued by the ghosts of memory',
  ],
  [DreamType.CreativeInspiration]: [
    'a vivid dream where disparate ideas fused into insight',
    'a vision of patterns hidden in the world, suddenly visible',
    'a dream of solving an impossible puzzle',
    'a luminous dream where knowledge flowed like water',
  ],
  [DreamType.SecretProcessing]: [
    'a dream of half-heard whispers revealing hidden truths',
    'a vision of masks falling away to show unexpected faces',
    'a dream of locked doors slowly opening',
    'a restless vision of tangled threads suddenly making sense',
  ],
  [DreamType.OralTraditionVision]: [
    'a dream of ancient heroes speaking through the mist',
    'a vision of ancestral legends come to life',
    'a dream where old stories echoed with personal meaning',
    'a vivid vision of cultural myths intertwined with destiny',
  ],
};

/**
 * Select a dream description for the given type using a random index.
 */
export function selectDreamDescription(
  dreamType: DreamType,
  randomIndex: number,
): string {
  const descriptions = DREAM_DESCRIPTIONS[dreamType];
  const index = Math.abs(Math.floor(randomIndex * descriptions.length)) % descriptions.length;
  return descriptions[index]!;
}

// ── DreamingSystem ──────────────────────────────────────────────────────────

/**
 * Dreaming system processes character dreams each tick.
 *
 * Runs daily at CHARACTER_AI execution order (just before Character AI).
 * Characters with high emotional memory load may dream, producing events
 * and effects that influence next-day AI decisions.
 */
export class DreamingSystem extends BaseSystem {
  readonly name = 'DreamingSystem';
  readonly frequency: TickFrequency = TickFrequency.Daily;
  readonly executionOrder = ExecutionOrder.CHARACTER_AI;

  private readonly config: DreamingConfig;

  /** Memory stores per character — registered externally */
  private memoryStores: Map<CharacterId, CharacterMemoryStore> = new Map();

  /** Trait values per character — registered externally */
  private traitValues: Map<CharacterId, ReadonlyMap<string, number>> = new Map();

  /** Active goals per character — registered externally */
  private goalCounts: Map<CharacterId, number> = new Map();

  /** Suspected secrets per character — registered externally */
  private suspectedSecrets: Map<CharacterId, Set<EntityId>> = new Map();

  /** Oral tradition availability per site */
  private sitesWithTraditions: Set<SiteId> = new Set();

  /** Character locations */
  private characterLocations: Map<CharacterId, SiteId> = new Map();

  /** Planted prophetic dreams queue */
  private plantedDreams: PlantedDream[] = [];

  /** Recent dream records (kept for one tick cycle for other systems to query) */
  private recentDreams: DreamRecord[] = [];

  /** Recent dream effects (kept for one tick cycle) */
  private recentEffects: Map<CharacterId, DreamEffect> = new Map();

  /** Simple RNG state for determinism */
  private rngState: number;

  constructor(config?: Partial<DreamingConfig>, seed?: number) {
    super();
    this.config = { ...DEFAULT_DREAMING_CONFIG, ...config };
    this.rngState = seed ?? 12345;
  }

  // ── Registration methods ────────────────────────────────────────────────

  registerMemoryStore(characterId: CharacterId, store: CharacterMemoryStore): void {
    this.memoryStores.set(characterId, store);
  }

  registerTraits(characterId: CharacterId, traits: ReadonlyMap<string, number>): void {
    this.traitValues.set(characterId, traits);
  }

  registerGoalCount(characterId: CharacterId, count: number): void {
    this.goalCounts.set(characterId, count);
  }

  registerSuspectedSecrets(characterId: CharacterId, secrets: Set<EntityId>): void {
    this.suspectedSecrets.set(characterId, secrets);
  }

  registerSiteWithTraditions(siteId: SiteId): void {
    this.sitesWithTraditions.add(siteId);
  }

  registerCharacterLocation(characterId: CharacterId, siteId: SiteId): void {
    this.characterLocations.set(characterId, siteId);
  }

  /**
   * Plant a prophetic dream (from the Influence system).
   * Will be processed on the next tick.
   */
  plantPropheticDream(dream: PlantedDream): void {
    this.plantedDreams.push(dream);
  }

  // ── Query methods ───────────────────────────────────────────────────────

  getRecentDreams(): readonly DreamRecord[] {
    return this.recentDreams;
  }

  getRecentEffect(characterId: CharacterId): DreamEffect | undefined {
    return this.recentEffects.get(characterId);
  }

  getDreamRecordsFor(characterId: CharacterId): readonly DreamRecord[] {
    return this.recentDreams.filter(d => d.characterId === characterId);
  }

  // ── Execute ─────────────────────────────────────────────────────────────

  execute(_world: World, clock: WorldClock, events: EventBus): void {
    // Clear previous tick's dreams
    this.recentDreams = [];
    this.recentEffects.clear();

    const currentTick = clock.currentTick as TickNumber;

    // Process planted prophetic dreams first
    this.processPlantedDreams(currentTick, events);

    // Process natural dreams for all registered characters
    for (const [characterId, store] of this.memoryStores) {
      // Skip if character already got a prophetic dream this tick
      if (this.recentEffects.has(characterId)) continue;

      this.processNaturalDream(characterId, store, currentTick, events);
    }
  }

  private processPlantedDreams(currentTick: TickNumber, events: EventBus): void {
    const dreamsToProcess = [...this.plantedDreams];
    this.plantedDreams = [];

    for (const planted of dreamsToProcess) {
      const store = this.memoryStores.get(planted.characterId);
      const memories = store !== undefined ? store.getAllMemories() : [];

      const dreamRecord: DreamRecord = {
        characterId: planted.characterId,
        dreamType: DreamType.GoalResolution, // Prophetic dreams present as goal-related
        tick: currentTick,
        description: `a prophetic vision: "${planted.vision}"`,
        sourceMemoryIds: memories.slice(0, 3).map(m => m.eventId),
        isProphetic: true,
        propheticVision: planted.vision,
      };

      const effect: DreamEffect = {
        type: DreamType.GoalResolution,
        goalShifts: new Map(),
        stressReduction: 5,
        researchBonus: 0,
        suspicionIncreases: new Map(),
        culturalBoost: 0,
      };

      this.recentDreams.push(dreamRecord);
      this.recentEffects.set(planted.characterId, effect);

      // Emit dream event
      const dreamEvent = createEvent({
        category: EventCategory.Personal,
        subtype: 'character.dream',
        timestamp: currentTick,
        participants: [planted.characterId as EntityId],
        significance: 35,
        data: {
          dreamType: 'prophetic',
          description: dreamRecord.description,
          isProphetic: true,
          vision: planted.vision,
        },
      });
      events.emit(dreamEvent);
    }
  }

  private processNaturalDream(
    characterId: CharacterId,
    store: CharacterMemoryStore,
    currentTick: TickNumber,
    events: EventBus,
  ): void {
    const memories = store.getAllMemories();
    const emotionalLoad = computeEmotionalLoad(memories, this.config.topMemoryCount);

    if (emotionalLoad < this.config.minEmotionalLoad) return;

    const dreamProb = calculateDreamProbability(emotionalLoad, this.config.maxDreamProbability);
    const roll = this.nextRandom();

    if (roll >= dreamProb) return;

    // Determine dream type context
    const traits = this.traitValues.get(characterId);
    const goalCount = this.goalCounts.get(characterId) ?? 0;
    const suspected = this.suspectedSecrets.get(characterId);
    const location = this.characterLocations.get(characterId);
    const hasOralTraditions = location !== undefined && this.sitesWithTraditions.has(location);

    const scholarly = traits?.get('scholarly') ?? 0;
    const creative = traits?.get('creative') ?? 0;

    const context: DreamTypeContext = {
      hasConflictingGoals: goalCount >= 2,
      hasTraumaticMemories: memories.some(m => m.emotionalWeight < -50),
      isCreativeOrScholarly: scholarly > 30 || creative > 30,
      hasSuspectedSecrets: suspected !== undefined && suspected.size > 0,
      hasOralTraditions,
    };

    const weights = computeDreamTypeWeights(context);
    const dreamType = selectDreamType(weights, this.nextRandom());

    // Build effect
    const effect = buildDreamEffect(dreamType, memories, this.config);

    // For SecretProcessing, fill in actual suspicion boosts
    if (dreamType === DreamType.SecretProcessing && suspected !== undefined) {
      const mutableSuspicion = new Map(effect.suspicionIncreases);
      for (const secretId of suspected) {
        mutableSuspicion.set(secretId, this.config.suspicionBoostAmount);
      }
      // Rebuild effect with suspicion data
      const effectWithSuspicion: DreamEffect = {
        ...effect,
        suspicionIncreases: mutableSuspicion,
      };
      this.recentEffects.set(characterId, effectWithSuspicion);
    } else {
      this.recentEffects.set(characterId, effect);
    }

    // Build dream record
    const sourceMemories = [...memories]
      .sort((a, b) => Math.abs(b.emotionalWeight) - Math.abs(a.emotionalWeight))
      .slice(0, 3);

    const description = selectDreamDescription(dreamType, this.nextRandom());

    const dreamRecord: DreamRecord = {
      characterId,
      dreamType,
      tick: currentTick,
      description,
      sourceMemoryIds: sourceMemories.map(m => m.eventId),
      isProphetic: false,
    };

    this.recentDreams.push(dreamRecord);

    // Emit dream event
    const significance = dreamType === DreamType.FearReinforcement ? 30 :
      dreamType === DreamType.CreativeInspiration ? 25 : 20;

    const dreamEvent = createEvent({
      category: EventCategory.Personal,
      subtype: 'character.dream',
      timestamp: currentTick,
      participants: [characterId as EntityId],
      significance,
      data: {
        dreamType,
        description,
        isProphetic: false,
        emotionalLoad,
        ...(effect.phobiaAdded !== undefined ? { phobiaAdded: effect.phobiaAdded } : {}),
        ...(effect.researchBonus > 0 ? { researchBonus: effect.researchBonus } : {}),
        ...(effect.culturalBoost > 0 ? { culturalBoost: effect.culturalBoost } : {}),
      },
    });
    events.emit(dreamEvent);
  }

  // ── RNG ─────────────────────────────────────────────────────────────────

  private nextRandom(): number {
    // Simple LCG for deterministic dreams
    this.rngState = ((this.rngState * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    return this.rngState / 0x80000000;
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────

  cleanup(): void {
    super.cleanup();
    this.memoryStores.clear();
    this.traitValues.clear();
    this.goalCounts.clear();
    this.suspectedSecrets.clear();
    this.sitesWithTraditions.clear();
    this.characterLocations.clear();
    this.plantedDreams = [];
    this.recentDreams = [];
    this.recentEffects.clear();
  }
}
