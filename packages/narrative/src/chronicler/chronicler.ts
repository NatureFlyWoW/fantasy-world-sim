/**
 * Chronicler system - in-world narrators with biases and limitations.
 * Each chronicler represents a distinct voice that colors how events are recorded.
 */

import type { CharacterId, FactionId, SiteId, EventId } from '@fws/core';
import type { WorldTime } from '@fws/core';

/**
 * Ideological lens through which a chronicler interprets events.
 */
export enum ChroniclerIdeology {
  /** Favors established powers and institutional authority */
  ProEstablishment = 'pro_establishment',
  /** Sympathizes with common people and oppressed groups */
  Populist = 'populist',
  /** Interprets events through religious/divine significance */
  Religious = 'religious',
  /** Focuses on material conditions and economic factors */
  Materialist = 'materialist',
  /** Emphasizes individual heroism and great figures */
  GreatMan = 'great_man',
  /** Sees cycles and patterns in history */
  Cyclical = 'cyclical',
  /** Believes in progress and improvement over time */
  Progressive = 'progressive',
  /** Views events with skepticism about human nature */
  Cynical = 'cynical',
}

/**
 * Writing style affects vocabulary, sentence structure, and literary flourishes.
 */
export enum WritingStyle {
  /** Formal, elevated prose with archaic vocabulary */
  Formal = 'formal',
  /** Direct, clear prose focused on facts */
  Matter_Of_Fact = 'matter_of_fact',
  /** Flowery, metaphor-rich prose */
  Florid = 'florid',
  /** Sparse, terse prose */
  Laconic = 'laconic',
  /** Academic, analytical prose with citations */
  Academic = 'academic',
  /** Story-like prose with narrative tension */
  Dramatic = 'dramatic',
  /** Personal, emotional prose */
  Intimate = 'intimate',
  /** Distant, detached prose */
  Detached = 'detached',
}

/**
 * Strength of bias - how much the chronicler's perspective distorts events.
 */
export enum BiasStrength {
  /** Minimal distortion, mostly factual */
  Subtle = 'subtle',
  /** Noticeable slant but facts remain */
  Moderate = 'moderate',
  /** Strong perspective that shapes interpretation */
  Strong = 'strong',
  /** Extreme bias that may omit or distort facts */
  Extreme = 'extreme',
}

/**
 * A chronicler's relationship to a faction affects how they portray that faction.
 */
export interface FactionRelation {
  readonly factionId: FactionId;
  /** -100 (hostile) to +100 (devoted) */
  readonly disposition: number;
  /** Whether the chronicler is a member of this faction */
  readonly isMember: boolean;
  /** Whether this faction is the chronicler's patron */
  readonly isPatron: boolean;
}

/**
 * Knowledge limitations - what the chronicler can and cannot know.
 */
export interface ChroniclerKnowledge {
  /** Sites the chronicler has visited or has reliable sources about */
  readonly knownSites: ReadonlySet<SiteId>;
  /** Factions the chronicler has inside knowledge of */
  readonly knownFactions: ReadonlySet<FactionId>;
  /** Characters the chronicler personally knows or has met */
  readonly knownCharacters: ReadonlySet<CharacterId>;
  /** Time period the chronicler lived through (events outside may be secondhand) */
  readonly firsthandPeriod: {
    readonly start: WorldTime;
    readonly end: WorldTime;
  };
  /** Maximum distance (in tiles) from chronicler's location for detailed knowledge */
  readonly geographicRange: number;
}

/**
 * A chronicler - an in-world narrator entity with biases and limitations.
 */
export interface Chronicler {
  /** Unique identifier for this chronicler */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** Optional character entity this chronicler represents */
  readonly characterId?: CharacterId;
  /** Primary ideological lens */
  readonly ideology: ChroniclerIdeology;
  /** Secondary ideological influences (if any) */
  readonly secondaryIdeologies: readonly ChroniclerIdeology[];
  /** Writing style */
  readonly style: WritingStyle;
  /** How strong the chronicler's biases are */
  readonly biasStrength: BiasStrength;
  /** Relationships to factions */
  readonly factionRelations: readonly FactionRelation[];
  /** Knowledge limitations */
  readonly knowledge: ChroniclerKnowledge;
  /** When the chronicler was active (for historical records) */
  readonly activeFrom: WorldTime;
  readonly activeTo: WorldTime;
  /** Home location, affects geographic knowledge */
  readonly homeLocation: SiteId;
  /** Special interests that get extra attention */
  readonly interests: readonly ChroniclerInterest[];
  /** Topics the chronicler deliberately avoids or downplays */
  readonly avoidances: readonly ChroniclerAvoidance[];
}

/**
 * A topic the chronicler finds particularly interesting.
 */
export interface ChroniclerInterest {
  readonly type: 'faction' | 'character' | 'site' | 'category' | 'theme';
  readonly target: string; // FactionId, CharacterId, SiteId, EventCategory, or theme name
  /** How much extra detail/attention this topic gets (1.0 = normal, 2.0 = double) */
  readonly multiplier: number;
}

/**
 * A topic the chronicler deliberately downplays or omits.
 */
export interface ChroniclerAvoidance {
  readonly type: 'faction' | 'character' | 'site' | 'category' | 'theme';
  readonly target: string;
  /** Probability of omitting (0.0 = never, 1.0 = always) */
  readonly omissionProbability: number;
  /** If not omitted, how much to minimize (0.0 = full detail, 1.0 = minimal mention) */
  readonly minimizationFactor: number;
}

/**
 * Result of a chronicler's interpretation of an event.
 */
export interface ChroniclerOutput {
  /** The chronicler who produced this interpretation */
  readonly chroniclerId: string;
  /** Original event being interpreted */
  readonly eventId: EventId;
  /** The biased narrative text */
  readonly narrative: string;
  /** How much the narrative deviates from factual (0.0 = accurate, 1.0 = heavily distorted) */
  readonly distortionLevel: number;
  /** What biases were applied */
  readonly appliedBiases: readonly AppliedBias[];
  /** Whether the chronicler had firsthand knowledge */
  readonly isFirsthand: boolean;
  /** Confidence level (0.0-1.0) based on knowledge limitations */
  readonly confidence: number;
}

/**
 * Record of a specific bias transformation applied to a narrative.
 */
export interface AppliedBias {
  readonly type: BiasType;
  readonly description: string;
  /** How much this bias affected the output (0.0-1.0) */
  readonly magnitude: number;
}

/**
 * Types of bias that can be applied to narratives.
 */
export enum BiasType {
  /** Portraying a faction more positively or negatively */
  FactionSpin = 'faction_spin',
  /** Leaving out inconvenient information */
  Omission = 'omission',
  /** Crediting/blaming different actors */
  AttributionShift = 'attribution_shift',
  /** Changing the emotional tone */
  ToneAdjustment = 'tone_adjustment',
  /** Gaps due to limited knowledge */
  KnowledgeLimitation = 'knowledge_limitation',
  /** Exaggerating or minimizing significance */
  SignificanceShift = 'significance_shift',
  /** Adding moralizing commentary */
  MoralJudgment = 'moral_judgment',
  /** Inserting ideological interpretation */
  IdeologicalFraming = 'ideological_framing',
}

/**
 * Registry of available chroniclers.
 */
export class ChroniclerRegistry {
  private readonly chroniclers = new Map<string, Chronicler>();
  private activeChronicler: string | undefined;

  /**
   * Register a new chronicler.
   */
  register(chronicler: Chronicler): void {
    this.chroniclers.set(chronicler.id, chronicler);
  }

  /**
   * Get a chronicler by ID.
   */
  get(id: string): Chronicler | undefined {
    return this.chroniclers.get(id);
  }

  /**
   * Get all registered chroniclers.
   */
  getAll(): readonly Chronicler[] {
    return [...this.chroniclers.values()];
  }

  /**
   * Set the active chronicler (used as default for narrative generation).
   */
  setActive(id: string): void {
    if (!this.chroniclers.has(id)) {
      throw new Error(`Chronicler not found: ${id}`);
    }
    this.activeChronicler = id;
  }

  /**
   * Get the currently active chronicler.
   */
  getActive(): Chronicler | undefined {
    if (this.activeChronicler === undefined) {
      return undefined;
    }
    return this.chroniclers.get(this.activeChronicler);
  }

  /**
   * Get chroniclers active during a specific time period.
   */
  getActiveAt(time: WorldTime): readonly Chronicler[] {
    return [...this.chroniclers.values()].filter(c =>
      compareWorldTime(c.activeFrom, time) <= 0 &&
      compareWorldTime(c.activeTo, time) >= 0
    );
  }

  /**
   * Get chroniclers with knowledge of a specific site.
   */
  getWithKnowledgeOf(siteId: SiteId): readonly Chronicler[] {
    return [...this.chroniclers.values()].filter(c =>
      c.knowledge.knownSites.has(siteId)
    );
  }

  /**
   * Get chroniclers affiliated with a faction.
   */
  getAffiliatedWith(factionId: FactionId): readonly Chronicler[] {
    return [...this.chroniclers.values()].filter(c =>
      c.factionRelations.some(r => r.factionId === factionId && (r.isMember || r.isPatron))
    );
  }
}

/**
 * Compare two WorldTime values.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
function compareWorldTime(a: WorldTime, b: WorldTime): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/**
 * Create a basic chronicler with minimal configuration.
 */
export function createChronicler(
  id: string,
  name: string,
  ideology: ChroniclerIdeology,
  style: WritingStyle,
  homeLocation: SiteId,
  activeFrom: WorldTime,
  activeTo: WorldTime,
  options?: Partial<{
    characterId: CharacterId;
    secondaryIdeologies: ChroniclerIdeology[];
    biasStrength: BiasStrength;
    factionRelations: FactionRelation[];
    knowledge: Partial<ChroniclerKnowledge>;
    interests: ChroniclerInterest[];
    avoidances: ChroniclerAvoidance[];
  }>
): Chronicler {
  const defaultKnowledge: ChroniclerKnowledge = {
    knownSites: new Set([homeLocation]),
    knownFactions: new Set(),
    knownCharacters: new Set(),
    firsthandPeriod: { start: activeFrom, end: activeTo },
    geographicRange: 50,
  };

  return {
    id,
    name,
    ideology,
    style,
    homeLocation,
    activeFrom,
    activeTo,
    biasStrength: options?.biasStrength ?? BiasStrength.Moderate,
    secondaryIdeologies: options?.secondaryIdeologies ?? [],
    factionRelations: options?.factionRelations ?? [],
    knowledge: {
      ...defaultKnowledge,
      ...options?.knowledge,
      knownSites: options?.knowledge?.knownSites ?? defaultKnowledge.knownSites,
      knownFactions: options?.knowledge?.knownFactions ?? defaultKnowledge.knownFactions,
      knownCharacters: options?.knowledge?.knownCharacters ?? defaultKnowledge.knownCharacters,
    },
    interests: options?.interests ?? [],
    avoidances: options?.avoidances ?? [],
    ...(options?.characterId !== undefined ? { characterId: options.characterId } : {}),
  };
}
