/**
 * Lost History Tracker - manages the preservation and loss of historical records.
 * Chronicles can be lost through destruction, neglect, or deliberate suppression.
 */

import type { EventId, SiteId, FactionId } from '@fws/core';
import type { WorldTime } from '@fws/core';
import type { Chronicler, ChroniclerOutput } from './chronicler.js';

/**
 * Reasons why a chronicle might be lost.
 */
export enum LossReason {
  /** Physical destruction (fire, war, flood) */
  Destroyed = 'destroyed',
  /** Neglect and decay over time */
  Decay = 'decay',
  /** Deliberate suppression by authorities */
  Suppressed = 'suppressed',
  /** Lost in transit or storage */
  Misplaced = 'misplaced',
  /** Never written down (oral tradition only) */
  NeverRecorded = 'never_recorded',
  /** Deliberately falsified/replaced with different account */
  Falsified = 'falsified',
}

/**
 * Preservation quality affects survival probability.
 */
export enum PreservationQuality {
  /** Excellent preservation (multiple copies, stone tablets, etc.) */
  Excellent = 'excellent',
  /** Good preservation (archive, library) */
  Good = 'good',
  /** Fair preservation (single copy, average storage) */
  Fair = 'fair',
  /** Poor preservation (exposed, damaged) */
  Poor = 'poor',
  /** Endangered (at risk of imminent loss) */
  Endangered = 'endangered',
}

/**
 * A chronicle - a recorded account of events.
 */
export interface Chronicle {
  /** Unique identifier */
  readonly id: string;
  /** The chronicler who wrote this */
  readonly chroniclerId: string;
  /** Events covered by this chronicle */
  readonly eventIds: readonly EventId[];
  /** Time period covered */
  readonly periodStart: WorldTime;
  readonly periodEnd: WorldTime;
  /** Where the chronicle is stored */
  readonly location: SiteId;
  /** Current preservation quality */
  preservationQuality: PreservationQuality;
  /** Whether this chronicle still exists */
  isExtant: boolean;
  /** If lost, when and why */
  lossRecord?: LossRecord;
  /** Number of known copies */
  copyCount: number;
  /** Whether this is the primary/original copy */
  readonly isPrimary: boolean;
  /** Parent chronicle if this is a copy */
  readonly copiedFrom?: string;
  /** Faction that controls access (if any) */
  controllingFaction?: FactionId;
  /** Whether access is restricted */
  isRestricted: boolean;
  /** Notable features (illuminated, contains maps, etc.) */
  readonly features: readonly ChronicleFeature[];
}

/**
 * Record of how a chronicle was lost.
 */
export interface LossRecord {
  readonly reason: LossReason;
  readonly when: WorldTime;
  readonly description: string;
  /** Event that caused the loss (if any) */
  readonly causingEventId?: EventId;
  /** Whether fragments survive */
  readonly fragmentsSurvive: boolean;
  /** If fragments survive, what percentage */
  readonly fragmentPercentage?: number;
}

/**
 * Special features of a chronicle.
 */
export enum ChronicleFeature {
  /** Contains illustrations or illuminations */
  Illuminated = 'illuminated',
  /** Contains maps */
  HasMaps = 'has_maps',
  /** Written in a rare or archaic language */
  RareLanguage = 'rare_language',
  /** Contains encrypted or coded sections */
  Encrypted = 'encrypted',
  /** Includes firsthand accounts */
  Firsthand = 'firsthand',
  /** Has marginal annotations */
  Annotated = 'annotated',
  /** Known to contain errors */
  Erroneous = 'erroneous',
  /** Considered authoritative */
  Authoritative = 'authoritative',
  /** Contains heretical or banned content */
  Forbidden = 'forbidden',
}

/**
 * Preservation probabilities by quality.
 */
const PRESERVATION_SURVIVAL_RATES: Record<PreservationQuality, number> = {
  [PreservationQuality.Excellent]: 0.99,
  [PreservationQuality.Good]: 0.95,
  [PreservationQuality.Fair]: 0.85,
  [PreservationQuality.Poor]: 0.65,
  [PreservationQuality.Endangered]: 0.40,
};

/**
 * Decay rate per century by quality.
 */
const DECAY_RATES: Record<PreservationQuality, number> = {
  [PreservationQuality.Excellent]: 0.01,
  [PreservationQuality.Good]: 0.05,
  [PreservationQuality.Fair]: 0.15,
  [PreservationQuality.Poor]: 0.30,
  [PreservationQuality.Endangered]: 0.50,
};

/**
 * LostHistoryTracker manages the survival and loss of historical records.
 */
export class LostHistoryTracker {
  private readonly chronicles = new Map<string, Chronicle>();
  private readonly chroniclesByEvent = new Map<EventId, Set<string>>();
  private readonly chroniclesByLocation = new Map<SiteId, Set<string>>();
  private readonly lostChronicles = new Map<string, LossRecord>();
  private readonly rng: () => number;
  private nextId = 1;

  constructor(rng?: () => number) {
    this.rng = rng ?? Math.random;
  }

  /**
   * Create a new chronicle from a chronicler's output.
   */
  createChronicle(
    chronicler: Chronicler,
    outputs: readonly ChroniclerOutput[],
    location: SiteId,
    periodStart: WorldTime,
    periodEnd: WorldTime,
    options?: Partial<{
      preservationQuality: PreservationQuality;
      copyCount: number;
      controllingFaction: FactionId;
      isRestricted: boolean;
      features: ChronicleFeature[];
    }>
  ): Chronicle {
    const id = `chronicle_${this.nextId++}`;
    const eventIds = outputs.map(o => o.eventId);

    const chronicle: Chronicle = {
      id,
      chroniclerId: chronicler.id,
      eventIds,
      periodStart,
      periodEnd,
      location,
      preservationQuality: options?.preservationQuality ?? PreservationQuality.Fair,
      isExtant: true,
      copyCount: options?.copyCount ?? 1,
      isPrimary: true,
      isRestricted: options?.isRestricted ?? false,
      features: options?.features ?? [],
      ...(options?.controllingFaction !== undefined
        ? { controllingFaction: options.controllingFaction }
        : {}),
    };

    this.chronicles.set(id, chronicle);
    this.indexChronicle(chronicle);

    return chronicle;
  }

  /**
   * Create a copy of an existing chronicle.
   */
  copyChronicle(
    sourceId: string,
    newLocation: SiteId,
    options?: Partial<{
      preservationQuality: PreservationQuality;
      controllingFaction: FactionId;
      isRestricted: boolean;
    }>
  ): Chronicle | undefined {
    const source = this.chronicles.get(sourceId);
    if (source === undefined || !source.isExtant) {
      return undefined;
    }

    const id = `chronicle_${this.nextId++}`;
    const copy: Chronicle = {
      ...source,
      id,
      location: newLocation,
      isPrimary: false,
      copiedFrom: sourceId,
      preservationQuality: options?.preservationQuality ?? source.preservationQuality,
      isRestricted: options?.isRestricted ?? source.isRestricted,
      copyCount: 1,
      ...(options?.controllingFaction !== undefined
        ? { controllingFaction: options.controllingFaction }
        : {}),
    };

    // Increment copy count on source
    source.copyCount++;

    this.chronicles.set(id, copy);
    this.indexChronicle(copy);

    return copy;
  }

  /**
   * Mark a chronicle as lost.
   */
  loseChronicle(
    id: string,
    reason: LossReason,
    when: WorldTime,
    description: string,
    options?: Partial<{
      causingEventId: EventId;
      fragmentsSurvive: boolean;
      fragmentPercentage: number;
    }>
  ): boolean {
    const chronicle = this.chronicles.get(id);
    if (chronicle === undefined || !chronicle.isExtant) {
      return false;
    }

    const lossRecord: LossRecord = {
      reason,
      when,
      description,
      fragmentsSurvive: options?.fragmentsSurvive ?? false,
      ...(options?.causingEventId !== undefined
        ? { causingEventId: options.causingEventId }
        : {}),
      ...(options?.fragmentPercentage !== undefined
        ? { fragmentPercentage: options.fragmentPercentage }
        : {}),
    };

    chronicle.isExtant = false;
    chronicle.lossRecord = lossRecord;

    this.lostChronicles.set(id, lossRecord);

    // Decrement copy count on source if this was a copy
    if (chronicle.copiedFrom !== undefined) {
      const source = this.chronicles.get(chronicle.copiedFrom);
      if (source !== undefined) {
        source.copyCount = Math.max(0, source.copyCount - 1);
      }
    }

    return true;
  }

  /**
   * Simulate passage of time and potential chronicle loss.
   */
  simulateTimePassage(
    years: number,
    disasterLocations?: ReadonlySet<SiteId>,
    suppressedFactions?: ReadonlySet<FactionId>
  ): readonly LossEvent[] {
    const losses: LossEvent[] = [];
    const centuries = years / 100;

    for (const [id, chronicle] of this.chronicles) {
      if (!chronicle.isExtant) continue;

      // Check for disaster-related destruction
      if (disasterLocations !== undefined && disasterLocations.has(chronicle.location)) {
        const destructionChance = 0.5 * (1 - PRESERVATION_SURVIVAL_RATES[chronicle.preservationQuality]);
        if (this.rng() < destructionChance) {
          this.loseChronicle(
            id,
            LossReason.Destroyed,
            { year: 0, month: 1, day: 1 }, // Placeholder time
            'Destroyed in disaster',
            { fragmentsSurvive: this.rng() < 0.2, fragmentPercentage: Math.floor(this.rng() * 30) }
          );
          losses.push({ chronicleId: id, reason: LossReason.Destroyed });
          continue;
        }
      }

      // Check for suppression
      if (suppressedFactions !== undefined && chronicle.controllingFaction !== undefined) {
        if (suppressedFactions.has(chronicle.controllingFaction)) {
          const suppressionChance = 0.3;
          if (this.rng() < suppressionChance) {
            this.loseChronicle(
              id,
              LossReason.Suppressed,
              { year: 0, month: 1, day: 1 },
              'Suppressed by new authorities'
            );
            losses.push({ chronicleId: id, reason: LossReason.Suppressed });
            continue;
          }
        }
      }

      // Natural decay over time
      const decayRate = DECAY_RATES[chronicle.preservationQuality];
      const decayChance = 1 - Math.pow(1 - decayRate, centuries);

      if (this.rng() < decayChance) {
        // Quality degrades
        chronicle.preservationQuality = this.degradeQuality(chronicle.preservationQuality);

        // Potential total loss if already endangered
        if (chronicle.preservationQuality === PreservationQuality.Endangered) {
          if (this.rng() < 0.3) {
            this.loseChronicle(
              id,
              LossReason.Decay,
              { year: 0, month: 1, day: 1 },
              'Degraded beyond recovery',
              { fragmentsSurvive: true, fragmentPercentage: Math.floor(this.rng() * 50 + 10) }
            );
            losses.push({ chronicleId: id, reason: LossReason.Decay });
          }
        }
      }
    }

    return losses;
  }

  /**
   * Check if any record of an event survives.
   */
  hasRecordOf(eventId: EventId): boolean {
    const chronicleIds = this.chroniclesByEvent.get(eventId);
    if (chronicleIds === undefined) return false;

    for (const id of chronicleIds) {
      const chronicle = this.chronicles.get(id);
      if (chronicle !== undefined && chronicle.isExtant) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all surviving chronicles that mention an event.
   */
  getChroniclesFor(eventId: EventId): readonly Chronicle[] {
    const chronicleIds = this.chroniclesByEvent.get(eventId);
    if (chronicleIds === undefined) return [];

    return [...chronicleIds]
      .map(id => this.chronicles.get(id))
      .filter((c): c is Chronicle => c !== undefined && c.isExtant);
  }

  /**
   * Get chronicles at a specific location.
   */
  getChroniclesAt(location: SiteId): readonly Chronicle[] {
    const chronicleIds = this.chroniclesByLocation.get(location);
    if (chronicleIds === undefined) return [];

    return [...chronicleIds]
      .map(id => this.chronicles.get(id))
      .filter((c): c is Chronicle => c !== undefined && c.isExtant);
  }

  /**
   * Get all extant chronicles.
   */
  getExtantChronicles(): readonly Chronicle[] {
    return [...this.chronicles.values()].filter(c => c.isExtant);
  }

  /**
   * Get all lost chronicles.
   */
  getLostChronicles(): ReadonlyMap<string, LossRecord> {
    return this.lostChronicles;
  }

  /**
   * Get chronicle by ID.
   */
  getChronicle(id: string): Chronicle | undefined {
    return this.chronicles.get(id);
  }

  /**
   * Count extant chronicles.
   */
  getExtantCount(): number {
    let count = 0;
    for (const chronicle of this.chronicles.values()) {
      if (chronicle.isExtant) count++;
    }
    return count;
  }

  /**
   * Count lost chronicles.
   */
  getLostCount(): number {
    return this.lostChronicles.size;
  }

  /**
   * Get events that have no surviving record.
   */
  getLostEvents(): readonly EventId[] {
    const lostEvents: EventId[] = [];

    for (const [eventId, chronicleIds] of this.chroniclesByEvent) {
      let hasExtant = false;
      for (const id of chronicleIds) {
        const chronicle = this.chronicles.get(id);
        if (chronicle !== undefined && chronicle.isExtant) {
          hasExtant = true;
          break;
        }
      }
      if (!hasExtant) {
        lostEvents.push(eventId);
      }
    }

    return lostEvents;
  }

  /**
   * Calculate historical coverage - what percentage of recorded events have surviving records.
   */
  calculateCoverage(): number {
    const totalEvents = this.chroniclesByEvent.size;
    if (totalEvents === 0) return 1.0;

    let coveredEvents = 0;
    for (const [, chronicleIds] of this.chroniclesByEvent) {
      for (const id of chronicleIds) {
        const chronicle = this.chronicles.get(id);
        if (chronicle !== undefined && chronicle.isExtant) {
          coveredEvents++;
          break;
        }
      }
    }

    return coveredEvents / totalEvents;
  }

  /**
   * Index a chronicle for fast lookup.
   */
  private indexChronicle(chronicle: Chronicle): void {
    for (const eventId of chronicle.eventIds) {
      let set = this.chroniclesByEvent.get(eventId);
      if (set === undefined) {
        set = new Set();
        this.chroniclesByEvent.set(eventId, set);
      }
      set.add(chronicle.id);
    }

    let locationSet = this.chroniclesByLocation.get(chronicle.location);
    if (locationSet === undefined) {
      locationSet = new Set();
      this.chroniclesByLocation.set(chronicle.location, locationSet);
    }
    locationSet.add(chronicle.id);
  }

  /**
   * Degrade preservation quality by one level.
   */
  private degradeQuality(quality: PreservationQuality): PreservationQuality {
    switch (quality) {
      case PreservationQuality.Excellent:
        return PreservationQuality.Good;
      case PreservationQuality.Good:
        return PreservationQuality.Fair;
      case PreservationQuality.Fair:
        return PreservationQuality.Poor;
      case PreservationQuality.Poor:
        return PreservationQuality.Endangered;
      case PreservationQuality.Endangered:
        return PreservationQuality.Endangered;
    }
  }
}

/**
 * Record of a chronicle loss event during simulation.
 */
export interface LossEvent {
  readonly chronicleId: string;
  readonly reason: LossReason;
}
