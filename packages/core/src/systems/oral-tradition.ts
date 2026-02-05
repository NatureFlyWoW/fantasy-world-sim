/**
 * Oral Tradition System — models knowledge transmission before writing.
 * Memes propagate through social networks with HIGH mutation rates.
 * After ~200 years, original events become barely recognizable legends.
 */

import type { EntityId, SiteId, EventId } from '../ecs/types.js';
import { toEntityId } from '../ecs/types.js';
import type { World } from '../ecs/world.js';
import { TickFrequency } from '../time/types.js';
import type { WorldClock } from '../time/world-clock.js';
import { EventCategory } from '../events/types.js';
import type { EventBus } from '../events/event-bus.js';
import { createEvent } from '../events/event-factory.js';
import { BaseSystem, ExecutionOrder } from '../engine/system.js';

// ── Oral Tradition Interface ──────────────────────────────────────────────────

/**
 * An oral tradition — a story passed down through generations.
 * The narrative mutates with each retelling.
 */
export interface OralTradition {
  readonly id: EntityId;
  readonly originalEventId: EventId;
  readonly originalNarrative: string;
  currentNarrative: string;
  mutationCount: number;
  geographicSpread: SiteId[];
  accuracy: number; // 0-100, degrades with each retelling
  embellishments: string[];
  readonly originTick: number;
  lastRetellingTick: number;
  protagonistName: string;
  originalProtagonistName: string;
  scaleMultiplier: number; // How much heroic deeds have been exaggerated
  supernaturalElements: string[];
  isWrittenDown: boolean;
  writtenDownTick: number | null;
  writtenVersion: string | null;
  culturalSignificance: number; // 0-100
}

/**
 * A retelling event — when a tradition is passed to a new location.
 */
export interface Retelling {
  readonly traditionId: EntityId;
  readonly fromSiteId: SiteId;
  readonly toSiteId: SiteId;
  readonly tick: number;
  readonly mutationsApplied: string[];
  readonly newAccuracy: number;
}

/**
 * Configuration for oral tradition mutation.
 */
export interface MutationConfig {
  readonly embellishmentChance: number; // 0.1-0.3
  readonly nameChangeChance: number;
  readonly scaleGrowthRate: number;
  readonly supernaturalChance: number;
  readonly accuracyDecayPerRetelling: number;
}

export const DEFAULT_MUTATION_CONFIG: MutationConfig = {
  embellishmentChance: 0.2, // 20% chance per retelling
  nameChangeChance: 0.1, // 10% chance name morphs
  scaleGrowthRate: 1.3, // 30% increase in scale per retelling
  supernaturalChance: 0.15, // 15% chance to add supernatural element
  accuracyDecayPerRetelling: 8, // Lose 8% accuracy per retelling
};

// ── Embellishment templates ───────────────────────────────────────────────────

const EMBELLISHMENT_TEMPLATES: readonly string[] = [
  'defeated an entire army single-handedly',
  'received a vision from the gods',
  'wielded a weapon of divine origin',
  'commanded the elements themselves',
  'spoke with the voice of thunder',
  'turned the tide of battle with sheer will',
  'faced death itself and emerged victorious',
  'was blessed by an ancient spirit',
  'discovered a hidden truth that changed everything',
  'made a pact that bound their bloodline forever',
  'fought for three days without rest',
  'was guided by a prophetic dream',
  'drank from a sacred spring',
  'called upon ancestors for strength',
  'wielded magic thought lost to time',
];

const SUPERNATURAL_ELEMENTS: readonly string[] = [
  'divine intervention',
  'ghostly ancestors',
  'magical beast companion',
  'enchanted weapon',
  'prophetic visions',
  'spirit possession',
  'miraculous healing',
  'elemental mastery',
  'curse breaking',
  'immortal blessing',
  'dragon blood',
  'fey bargain',
  'demonic pact',
  'celestial guidance',
];

const NAME_SUFFIXES: readonly string[] = [
  ' the Mighty',
  ' the Bold',
  ' the Invincible',
  ' the Wise',
  ' the Terrible',
  ' Dragonslayer',
  ' Godtouched',
  ' the Eternal',
  ' Worldbreaker',
  ' the Undefeated',
  ' Stormborn',
  ' the Great',
  ' Ironhand',
  ' Brightblade',
];

const NAME_MORPHS: ReadonlyMap<string, string[]> = new Map([
  ['a', ['ar', 'an', 'al']],
  ['e', ['en', 'el', 'eth']],
  ['i', ['in', 'ir', 'ith']],
  ['o', ['or', 'on', 'ol']],
  ['u', ['ur', 'un', 'ul']],
  ['n', ['nn', 'nd', 'ng']],
  ['r', ['rr', 'rd', 'rn']],
  ['s', ['ss', 'st', 'sh']],
]);

// ── ID generation ─────────────────────────────────────────────────────────────

let nextTraditionId = 90000;

export function createTraditionId(): EntityId {
  return toEntityId(nextTraditionId++);
}

export function resetTraditionIdCounter(): void {
  nextTraditionId = 90000;
}

// ── Mutation functions ────────────────────────────────────────────────────────

/**
 * Apply a single mutation to a tradition during retelling.
 */
export function applyMutation(
  tradition: OralTradition,
  mutationType: 'embellishment' | 'name_change' | 'scale_growth' | 'supernatural',
  rng: () => number,
): string {
  switch (mutationType) {
    case 'embellishment': {
      const embellishment = EMBELLISHMENT_TEMPLATES[
        Math.floor(rng() * EMBELLISHMENT_TEMPLATES.length)
      ]!;
      tradition.embellishments.push(embellishment);
      tradition.currentNarrative = insertEmbellishment(
        tradition.currentNarrative,
        embellishment,
        rng
      );
      return `Added embellishment: "${embellishment}"`;
    }

    case 'name_change': {
      const oldName = tradition.protagonistName;
      tradition.protagonistName = morphName(tradition.protagonistName, rng);
      tradition.currentNarrative = tradition.currentNarrative.replace(
        new RegExp(escapeRegExp(oldName), 'g'),
        tradition.protagonistName
      );
      return `Name changed: "${oldName}" → "${tradition.protagonistName}"`;
    }

    case 'scale_growth': {
      tradition.scaleMultiplier *= DEFAULT_MUTATION_CONFIG.scaleGrowthRate;
      const scaleDescription = describeScale(tradition.scaleMultiplier);
      tradition.currentNarrative = amplifyScale(tradition.currentNarrative, scaleDescription);
      return `Scale amplified: ${scaleDescription}`;
    }

    case 'supernatural': {
      const element = SUPERNATURAL_ELEMENTS[
        Math.floor(rng() * SUPERNATURAL_ELEMENTS.length)
      ]!;
      if (!tradition.supernaturalElements.includes(element)) {
        tradition.supernaturalElements.push(element);
        tradition.currentNarrative = addSupernaturalElement(
          tradition.currentNarrative,
          element
        );
        return `Added supernatural element: "${element}"`;
      }
      return 'Supernatural element already present';
    }
  }
}

/**
 * Process a full retelling with multiple potential mutations.
 */
export function processRetelling(
  tradition: OralTradition,
  config: MutationConfig,
  rng: () => number,
): string[] {
  const mutations: string[] = [];

  // Embellishment
  if (rng() < config.embellishmentChance) {
    mutations.push(applyMutation(tradition, 'embellishment', rng));
  }

  // Name change
  if (rng() < config.nameChangeChance) {
    mutations.push(applyMutation(tradition, 'name_change', rng));
  }

  // Scale growth (more likely after many retellings)
  const scaleChance = Math.min(0.5, tradition.mutationCount * 0.03);
  if (rng() < scaleChance) {
    mutations.push(applyMutation(tradition, 'scale_growth', rng));
  }

  // Supernatural element
  if (rng() < config.supernaturalChance) {
    mutations.push(applyMutation(tradition, 'supernatural', rng));
  }

  // Always apply accuracy decay
  tradition.accuracy = Math.max(0, tradition.accuracy - config.accuracyDecayPerRetelling);
  tradition.mutationCount++;

  return mutations;
}

/**
 * Calculate how recognizable the original event is.
 * After ~200 years of retellings, accuracy approaches 0.
 */
export function calculateRecognizability(tradition: OralTradition, yearsElapsed: number): number {
  // Base decay from retellings
  const retellingDecay = Math.pow(0.92, tradition.mutationCount);

  // Additional time-based decay (200 years = ~50 "generations" of stories)
  const timeDecay = Math.max(0, 1 - (yearsElapsed / 200));

  // Scale factor makes things less recognizable
  const scaleDistortion = Math.max(0, 1 - (tradition.scaleMultiplier - 1) / 20);

  return Math.round(retellingDecay * timeDecay * scaleDistortion * 100);
}

/**
 * Write down an oral tradition, capturing the current (distorted) version.
 */
export function writeDownTradition(
  tradition: OralTradition,
  tick: number,
): void {
  tradition.isWrittenDown = true;
  tradition.writtenDownTick = tick;
  tradition.writtenVersion = tradition.currentNarrative;
}

/**
 * Create a new oral tradition from an event.
 */
export function createOralTradition(
  eventId: EventId,
  originalNarrative: string,
  protagonistName: string,
  originSite: SiteId,
  originTick: number,
  significance: number,
): OralTradition {
  return {
    id: createTraditionId(),
    originalEventId: eventId,
    originalNarrative,
    currentNarrative: originalNarrative,
    mutationCount: 0,
    geographicSpread: [originSite],
    accuracy: 100,
    embellishments: [],
    originTick,
    lastRetellingTick: originTick,
    protagonistName,
    originalProtagonistName: protagonistName,
    scaleMultiplier: 1.0,
    supernaturalElements: [],
    isWrittenDown: false,
    writtenDownTick: null,
    writtenVersion: null,
    culturalSignificance: significance,
  };
}

// ── Helper functions ──────────────────────────────────────────────────────────

function insertEmbellishment(narrative: string, embellishment: string, rng: () => number): string {
  const sentences = narrative.split('. ');
  if (sentences.length < 2) {
    return `${narrative} It is said they ${embellishment}.`;
  }
  const insertIdx = Math.floor(rng() * (sentences.length - 1)) + 1;
  sentences.splice(insertIdx, 0, `Legend tells they ${embellishment}`);
  return sentences.join('. ');
}

function morphName(name: string, rng: () => number): string {
  // 50% chance to add a suffix
  if (rng() < 0.5 && !name.includes(' the ')) {
    const suffix = NAME_SUFFIXES[Math.floor(rng() * NAME_SUFFIXES.length)]!;
    return name + suffix;
  }

  // Otherwise morph a letter
  const chars = name.split('');
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]!.toLowerCase();
    const morphs = NAME_MORPHS.get(char);
    if (morphs !== undefined && rng() < 0.3) {
      chars[i] = morphs[Math.floor(rng() * morphs.length)]!;
      break;
    }
  }
  return chars.join('');
}

function describeScale(multiplier: number): string {
  if (multiplier < 2) return 'impressive';
  if (multiplier < 5) return 'legendary';
  if (multiplier < 10) return 'mythical';
  if (multiplier < 50) return 'godlike';
  return 'world-shaking';
}

function amplifyScale(narrative: string, scaleDescription: string): string {
  // Replace modest descriptors with grander ones
  const replacements: ReadonlyMap<string, string> = new Map([
    ['defeated', `delivered a ${scaleDescription} defeat to`],
    ['fought', `waged a ${scaleDescription} battle against`],
    ['killed', `slew in ${scaleDescription} fashion`],
    ['won', `achieved a ${scaleDescription} victory in`],
  ]);

  let result = narrative;
  for (const [original, replacement] of replacements) {
    if (result.includes(original) && !result.includes(scaleDescription)) {
      result = result.replace(original, replacement);
      break;
    }
  }
  return result;
}

function addSupernaturalElement(narrative: string, element: string): string {
  return `${narrative} Through ${element}, the impossible became possible.`;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Oral Tradition System ─────────────────────────────────────────────────────

/**
 * The Oral Tradition System manages the mutation and transmission of stories.
 * Runs SEASONAL (every 90 ticks).
 */
export class OralTraditionSystem extends BaseSystem {
  readonly name = 'OralTraditionSystem';
  readonly frequency = TickFrequency.Seasonal;
  readonly executionOrder = ExecutionOrder.SOCIAL; // Part of social processing

  private readonly traditions = new Map<EntityId, OralTradition>();
  private readonly siteConnections = new Map<SiteId, SiteId[]>();
  private readonly mutationConfig: MutationConfig;
  private writingInventedTick: number | null = null;

  constructor(config: Partial<MutationConfig> = {}) {
    super();
    this.mutationConfig = { ...DEFAULT_MUTATION_CONFIG, ...config };
  }

  override initialize(world: World): void {
    super.initialize(world);
  }

  execute(_world: World, clock: WorldClock, events: EventBus): void {
    const currentTick = clock.currentTick;

    // Process each tradition
    for (const tradition of this.traditions.values()) {
      this.processTraditionSeason(tradition, currentTick, events);
    }

    // Spread traditions along connections
    this.spreadTraditions(currentTick, events);
  }

  // ── Tradition management ────────────────────────────────────────────────────

  registerTradition(tradition: OralTradition): void {
    this.traditions.set(tradition.id, tradition);
  }

  getTradition(id: EntityId): OralTradition | undefined {
    return this.traditions.get(id);
  }

  getAllTraditions(): OralTradition[] {
    return Array.from(this.traditions.values());
  }

  getTraditionsBySite(siteId: SiteId): OralTradition[] {
    return Array.from(this.traditions.values()).filter(
      t => t.geographicSpread.includes(siteId)
    );
  }

  getTraditionsByEvent(eventId: EventId): OralTradition[] {
    return Array.from(this.traditions.values()).filter(
      t => t.originalEventId === eventId
    );
  }

  // ── Connection management (for transmission) ────────────────────────────────

  addSiteConnection(siteA: SiteId, siteB: SiteId): void {
    const connectionsA = this.siteConnections.get(siteA) ?? [];
    const connectionsB = this.siteConnections.get(siteB) ?? [];

    if (!connectionsA.includes(siteB)) {
      connectionsA.push(siteB);
      this.siteConnections.set(siteA, connectionsA);
    }

    if (!connectionsB.includes(siteA)) {
      connectionsB.push(siteA);
      this.siteConnections.set(siteB, connectionsB);
    }
  }

  getSiteConnections(siteId: SiteId): SiteId[] {
    return this.siteConnections.get(siteId) ?? [];
  }

  // ── Writing invention ───────────────────────────────────────────────────────

  notifyWritingInvented(tick: number): void {
    this.writingInventedTick = tick;
  }

  isWritingInvented(): boolean {
    return this.writingInventedTick !== null;
  }

  /**
   * When writing is invented, scholars record oral traditions.
   * They capture the DISTORTED version as "historical fact".
   */
  recordTraditionsToWriting(siteId: SiteId, tick: number, events: EventBus): number {
    let recorded = 0;
    const traditions = this.getTraditionsBySite(siteId);

    for (const tradition of traditions) {
      if (!tradition.isWrittenDown) {
        writeDownTradition(tradition, tick);
        recorded++;

        events.emit(createEvent({
          category: EventCategory.Cultural,
          subtype: 'culture.tradition_recorded',
          timestamp: tick,
          participants: [tradition.id],
          significance: Math.min(80, 40 + tradition.culturalSignificance / 2),
          data: {
            traditionId: tradition.id,
            siteId,
            originalAccuracy: tradition.accuracy,
            mutationCount: tradition.mutationCount,
            writtenVersion: tradition.writtenVersion,
            isDistorted: tradition.accuracy < 70,
          },
        }));
      }
    }

    return recorded;
  }

  // ── Tradition creation from events ──────────────────────────────────────────

  createFromEvent(
    eventId: EventId,
    narrative: string,
    protagonistName: string,
    originSite: SiteId,
    tick: number,
    significance: number,
    events: EventBus,
  ): OralTradition {
    const tradition = createOralTradition(
      eventId,
      narrative,
      protagonistName,
      originSite,
      tick,
      significance
    );

    this.traditions.set(tradition.id, tradition);

    events.emit(createEvent({
      category: EventCategory.Cultural,
      subtype: 'culture.oral_tradition_born',
      timestamp: tick,
      participants: [tradition.id, eventId],
      significance: Math.min(70, 30 + significance / 2),
      data: {
        traditionId: tradition.id,
        eventId,
        protagonistName,
        originSite,
        originalNarrative: narrative,
      },
    }));

    return tradition;
  }

  // ── Private processing methods ──────────────────────────────────────────────

  private processTraditionSeason(
    tradition: OralTradition,
    currentTick: number,
    events: EventBus,
  ): void {
    // Don't mutate traditions that have been written down
    if (tradition.isWrittenDown) return;

    // Traditions are retold roughly once per season in each location
    for (const _siteId of tradition.geographicSpread) {
      // Skip if recently retold
      if (currentTick - tradition.lastRetellingTick < 30) continue;

      // Process retelling with mutations
      const rng = () => Math.random();
      const mutations = processRetelling(tradition, this.mutationConfig, rng);

      tradition.lastRetellingTick = currentTick;

      // Emit event for significant mutations
      if (mutations.length > 0) {
        events.emit(createEvent({
          category: EventCategory.Cultural,
          subtype: 'culture.tradition_mutated',
          timestamp: currentTick,
          participants: [tradition.id],
          significance: 20 + mutations.length * 5,
          data: {
            traditionId: tradition.id,
            mutations,
            newAccuracy: tradition.accuracy,
            mutationCount: tradition.mutationCount,
            currentNarrative: tradition.currentNarrative.substring(0, 200),
          },
        }));
      }
    }
  }

  private spreadTraditions(currentTick: number, events: EventBus): void {
    const rng = () => Math.random();

    for (const tradition of this.traditions.values()) {
      // Higher cultural significance = faster spread
      const spreadChance = 0.05 + (tradition.culturalSignificance / 1000);

      for (const siteId of [...tradition.geographicSpread]) {
        const connections = this.siteConnections.get(siteId) ?? [];

        for (const connectedSite of connections) {
          if (tradition.geographicSpread.includes(connectedSite)) continue;

          if (rng() < spreadChance) {
            // Spread to connected site
            tradition.geographicSpread.push(connectedSite);

            // Apply mutations during transmission
            const mutations = processRetelling(tradition, this.mutationConfig, rng);

            events.emit(createEvent({
              category: EventCategory.Cultural,
              subtype: 'culture.tradition_spread',
              timestamp: currentTick,
              participants: [tradition.id],
              significance: 25,
              data: {
                traditionId: tradition.id,
                fromSite: siteId,
                toSite: connectedSite,
                mutations,
                accuracy: tradition.accuracy,
              },
            }));
          }
        }
      }
    }
  }

  /**
   * Get the evolution history of a tradition.
   */
  getEvolutionSummary(tradition: OralTradition): {
    originalEvent: EventId;
    originalNarrative: string;
    currentNarrative: string;
    nameEvolution: { original: string; current: string };
    mutationCount: number;
    accuracy: number;
    supernaturalAdditions: string[];
    embellishments: string[];
    scaleMultiplier: number;
    geographicReach: number;
    isRecorded: boolean;
    recordedVersion: string | null;
  } {
    return {
      originalEvent: tradition.originalEventId,
      originalNarrative: tradition.originalNarrative,
      currentNarrative: tradition.currentNarrative,
      nameEvolution: {
        original: tradition.originalProtagonistName,
        current: tradition.protagonistName,
      },
      mutationCount: tradition.mutationCount,
      accuracy: tradition.accuracy,
      supernaturalAdditions: [...tradition.supernaturalElements],
      embellishments: [...tradition.embellishments],
      scaleMultiplier: tradition.scaleMultiplier,
      geographicReach: tradition.geographicSpread.length,
      isRecorded: tradition.isWrittenDown,
      recordedVersion: tradition.writtenVersion,
    };
  }
}
