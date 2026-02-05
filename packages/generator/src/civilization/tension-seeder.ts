/**
 * Tension seeding — creates initial geopolitical tensions between factions
 * based on geography, history, religion, trade, and old grudges.
 */

import type { SeededRNG } from '../rng.js';
import type { PreHistoryResult } from '../history/pre-history.js';
import type { Faction } from './faction-initializer.js';
import type { Settlement } from './settlement-placer.js';

/**
 * Types of geopolitical tensions.
 */
export type TensionType =
  | 'border_dispute'
  | 'succession_crisis'
  | 'religious_tension'
  | 'trade_rivalry'
  | 'historical_grudge';

/**
 * Severity levels for tensions.
 */
export type TensionSeverity = 'minor' | 'moderate' | 'major' | 'critical';

/**
 * An initial tension between factions.
 */
export interface InitialTension {
  /** Type of tension */
  readonly type: TensionType;
  /** Severity level */
  readonly severity: TensionSeverity;
  /** Index of the first faction involved */
  readonly factionAIndex: number;
  /** Index of the second faction involved (undefined for internal tensions) */
  readonly factionBIndex: number | undefined;
  /** Description of the tension */
  readonly description: string;
  /** How likely this tension is to escalate (0-100) */
  readonly escalationRisk: number;
}

/**
 * Templates for tension descriptions.
 */
const BORDER_DESCRIPTIONS: readonly string[] = [
  'Both {a} and {b} claim sovereignty over the borderlands between them',
  'A resource-rich valley along the border of {a} and {b} is hotly contested',
  'Settlers from {a} have encroached on lands traditionally held by {b}',
  'The border between {a} and {b} was never formally agreed upon and remains disputed',
  'A strategic mountain pass between {a} and {b} is claimed by both factions',
];

const SUCCESSION_DESCRIPTIONS: readonly string[] = [
  'The line of succession in {a} is unclear, with multiple claimants vying for power',
  'A disputed heir has divided the court of {a} into bitter factions',
  'The aging ruler of {a} has not named a successor, and rival nobles scheme',
  'A bastard child of the previous ruler of {a} has emerged to stake a claim',
  'Two branches of the ruling family of {a} each claim the right to rule',
];

const RELIGIOUS_DESCRIPTIONS: readonly string[] = [
  'The faithful of {a} and {b} follow opposing interpretations of the divine will',
  'A heretical sect in {a} has spread to {b}, causing religious friction',
  'The temples of {a} demand conversion of the people of {b}',
  'A holy site on the border is claimed by the priesthoods of both {a} and {b}',
  'The gods worshipped by {a} and {b} are said to be ancient enemies',
];

const TRADE_DESCRIPTIONS: readonly string[] = [
  '{a} and {b} compete for control of the most lucrative trade routes',
  'Merchants of {b} accuse {a} of unfair tariffs and trade practices',
  'A rare resource vital to both {a} and {b} has become scarce, driving competition',
  '{a} has imposed an embargo on {b}, threatening economic collapse',
  'Both {a} and {b} seek monopoly over the same exotic goods',
];

const GRUDGE_DESCRIPTIONS: readonly string[] = [
  'The people of {a} have never forgiven {b} for atrocities committed in a past war',
  'An ancient betrayal by the ancestors of {b} still poisons relations with {a}',
  'The fall of a great civilization left both {a} and {b} blaming each other',
  'A legendary hero of {a} was slain by agents of {b} in ages past',
  'The ruins between {a} and {b} serve as a reminder of their bitter shared history',
];

const DESCRIPTIONS: Record<TensionType, readonly string[]> = {
  border_dispute: BORDER_DESCRIPTIONS,
  succession_crisis: SUCCESSION_DESCRIPTIONS,
  religious_tension: RELIGIOUS_DESCRIPTIONS,
  trade_rivalry: TRADE_DESCRIPTIONS,
  historical_grudge: GRUDGE_DESCRIPTIONS,
};

export class TensionSeeder {
  /**
   * Seed initial tensions between factions.
   */
  seed(
    factions: readonly Faction[],
    settlements: readonly Settlement[],
    preHistory: PreHistoryResult,
    rng: SeededRNG
  ): InitialTension[] {
    const tensionRng = rng.fork('tensions');
    const tensions: InitialTension[] = [];

    if (factions.length < 2) return tensions;

    // 1. Border disputes — between geographically close factions
    this.seedBorderDisputes(factions, settlements, tensions, tensionRng);

    // 2. Succession crises — internal faction tensions
    this.seedSuccessionCrises(factions, tensions, tensionRng);

    // 3. Religious tensions — between factions with different religions
    this.seedReligiousTensions(factions, tensions, tensionRng);

    // 4. Trade rivalries — between economically strong factions
    this.seedTradeRivalries(factions, tensions, tensionRng);

    // 5. Historical grudges — based on pre-history wars
    this.seedHistoricalGrudges(factions, preHistory, tensions, tensionRng);

    return tensions;
  }

  private seedBorderDisputes(
    factions: readonly Faction[],
    settlements: readonly Settlement[],
    tensions: InitialTension[],
    rng: SeededRNG
  ): void {
    for (let i = 0; i < factions.length; i++) {
      for (let j = i + 1; j < factions.length; j++) {
        const a = factions[i]!;
        const b = factions[j]!;

        // Check if factions share a border (settlements are close)
        if (!this.factionsAreNear(a, b, settlements)) continue;

        if (rng.next() < 0.4) {
          tensions.push(this.createTension(
            'border_dispute', i, j,
            a.name, b.name, rng
          ));
        }
      }
    }
  }

  private seedSuccessionCrises(
    factions: readonly Faction[],
    tensions: InitialTension[],
    rng: SeededRNG
  ): void {
    for (let i = 0; i < factions.length; i++) {
      const faction = factions[i]!;

      // Monarchies and tribal confederations are more prone
      let crisisChance = 0.1;
      if (faction.governmentType === 'monarchy') crisisChance = 0.25;
      if (faction.governmentType === 'tribal_confederation') crisisChance = 0.2;

      if (rng.next() < crisisChance) {
        tensions.push(this.createTension(
          'succession_crisis', i, undefined,
          faction.name, undefined, rng
        ));
      }
    }
  }

  private seedReligiousTensions(
    factions: readonly Faction[],
    tensions: InitialTension[],
    rng: SeededRNG
  ): void {
    for (let i = 0; i < factions.length; i++) {
      for (let j = i + 1; j < factions.length; j++) {
        const a = factions[i]!;
        const b = factions[j]!;

        if (a.religion === b.religion) continue;

        // Higher chance if either is a theocracy
        let chance = 0.15;
        if (a.governmentType === 'theocracy' || b.governmentType === 'theocracy') {
          chance = 0.4;
        }

        if (rng.next() < chance) {
          tensions.push(this.createTension(
            'religious_tension', i, j,
            a.name, b.name, rng
          ));
        }
      }
    }
  }

  private seedTradeRivalries(
    factions: readonly Faction[],
    tensions: InitialTension[],
    rng: SeededRNG
  ): void {
    // Find the richest factions
    const wealthy = factions
      .map((f, i) => ({ faction: f, index: i }))
      .filter(e => e.faction.economicWealth > 50)
      .sort((a, b) => b.faction.economicWealth - a.faction.economicWealth);

    // Top pairs compete
    for (let i = 0; i < wealthy.length; i++) {
      for (let j = i + 1; j < wealthy.length; j++) {
        if (rng.next() < 0.3) {
          tensions.push(this.createTension(
            'trade_rivalry',
            wealthy[i]!.index,
            wealthy[j]!.index,
            wealthy[i]!.faction.name,
            wealthy[j]!.faction.name,
            rng
          ));
        }
      }
    }
  }

  private seedHistoricalGrudges(
    factions: readonly Faction[],
    preHistory: PreHistoryResult,
    tensions: InitialTension[],
    rng: SeededRNG
  ): void {
    // Use historical wars to seed grudges between factions of the same race
    if (preHistory.historicalWars.length === 0) return;

    for (let i = 0; i < factions.length; i++) {
      for (let j = i + 1; j < factions.length; j++) {
        const a = factions[i]!;
        const b = factions[j]!;

        // Check if their races were involved in historical wars
        const hadWar = preHistory.historicalWars.some(w =>
          (w.belligerents[0] !== w.belligerents[1]) &&
          rng.next() < 0.1 // Random chance since civ names don't map directly to faction names
        );

        if (hadWar && rng.next() < 0.3) {
          tensions.push(this.createTension(
            'historical_grudge', i, j,
            a.name, b.name, rng
          ));
        }
      }
    }
  }

  private createTension(
    type: TensionType,
    factionAIndex: number,
    factionBIndex: number | undefined,
    nameA: string,
    nameB: string | undefined,
    rng: SeededRNG
  ): InitialTension {
    const templates = DESCRIPTIONS[type];
    const template = rng.pick(templates);
    const description = template
      .replace(/\{a\}/g, nameA)
      .replace(/\{b\}/g, nameB ?? nameA);

    const severityRoll = rng.next();
    let severity: TensionSeverity;
    if (severityRoll < 0.3) severity = 'minor';
    else if (severityRoll < 0.65) severity = 'moderate';
    else if (severityRoll < 0.9) severity = 'major';
    else severity = 'critical';

    const severityMultiplier: Record<TensionSeverity, number> = {
      minor: 0.5,
      moderate: 1.0,
      major: 1.5,
      critical: 2.0,
    };

    const escalationRisk = Math.min(100, Math.max(5,
      Math.round(30 * severityMultiplier[severity] + rng.nextGaussian(0, 10))
    ));

    return {
      type,
      severity,
      factionAIndex,
      factionBIndex,
      description,
      escalationRisk,
    };
  }

  private factionsAreNear(
    a: Faction,
    b: Faction,
    settlements: readonly Settlement[]
  ): boolean {
    // Check if any settlement of faction A is near any settlement of faction B
    const threshold = 50 * 50; // distance squared threshold
    for (const ai of a.settlementIndices) {
      const sa = settlements[ai];
      if (sa === undefined) continue;
      for (const bi of b.settlementIndices) {
        const sb = settlements[bi];
        if (sb === undefined) continue;
        const dx = sa.x - sb.x;
        const dy = sa.y - sb.y;
        if (dx * dx + dy * dy < threshold) return true;
      }
    }
    return false;
  }
}
