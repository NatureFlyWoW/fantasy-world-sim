/**
 * Religious System — handles divine power, interventions, church politics, and syncretism.
 * Divine power runs ANNUALLY, devotion updates WEEKLY.
 * Implements god death, schisms, and prophet generation.
 */

import type { EntityId, CharacterId, FactionId, SiteId, DeityId } from '../ecs/types.js';
import { toEntityId, toDeityId, toCharacterId } from '../ecs/types.js';
import type { World } from '../ecs/world.js';
import { TickFrequency } from '../time/types.js';
import type { WorldClock } from '../time/world-clock.js';
import { EventCategory } from '../events/types.js';
import type { EventBus } from '../events/event-bus.js';
import { createEvent } from '../events/event-factory.js';
import { BaseSystem, ExecutionOrder } from '../engine/system.js';

// ── Divine domains (mirroring generator) ─────────────────────────────────────

export enum Domain {
  War = 'War',
  Death = 'Death',
  Life = 'Life',
  Nature = 'Nature',
  Magic = 'Magic',
  Knowledge = 'Knowledge',
  Trickery = 'Trickery',
  Love = 'Love',
  Justice = 'Justice',
  Chaos = 'Chaos',
  Sea = 'Sea',
  Sky = 'Sky',
  Earth = 'Earth',
  Fire = 'Fire',
  Forge = 'Forge',
  Harvest = 'Harvest',
  Moon = 'Moon',
  Sun = 'Sun',
}

export const ALL_DOMAINS: readonly Domain[] = Object.values(Domain);

// ── Divine intervention types ────────────────────────────────────────────────

export enum InterventionType {
  EmpowerChampion = 'empower_champion',
  PropheticVision = 'prophetic_vision',
  PhysicalManifestation = 'physical_manifestation',
  BlessSite = 'bless_site',
  BlessArmy = 'bless_army',
  CurseEnemy = 'curse_enemy',
  CreateMiracle = 'create_miracle',
  SendOmen = 'send_omen',
  GrantDivineWeapon = 'grant_divine_weapon',
}

export const ALL_INTERVENTION_TYPES: readonly InterventionType[] = Object.values(InterventionType);

/**
 * Cost and requirements for each intervention type.
 */
export interface InterventionCost {
  readonly powerCost: number; // Divine power spent
  readonly minimumPower: number; // Minimum power to attempt
  readonly cooldownDays: number; // Days before this deity can intervene again
  readonly rarity: number; // 0-1, lower = rarer
}

export const INTERVENTION_COSTS: Readonly<Record<InterventionType, InterventionCost>> = {
  [InterventionType.SendOmen]: {
    powerCost: 5,
    minimumPower: 20,
    cooldownDays: 7,
    rarity: 0.8,
  },
  [InterventionType.PropheticVision]: {
    powerCost: 15,
    minimumPower: 50,
    cooldownDays: 30,
    rarity: 0.5,
  },
  [InterventionType.BlessSite]: {
    powerCost: 20,
    minimumPower: 80,
    cooldownDays: 90,
    rarity: 0.4,
  },
  [InterventionType.BlessArmy]: {
    powerCost: 30,
    minimumPower: 100,
    cooldownDays: 60,
    rarity: 0.3,
  },
  [InterventionType.CurseEnemy]: {
    powerCost: 25,
    minimumPower: 100,
    cooldownDays: 60,
    rarity: 0.35,
  },
  [InterventionType.EmpowerChampion]: {
    powerCost: 40,
    minimumPower: 150,
    cooldownDays: 180,
    rarity: 0.2,
  },
  [InterventionType.CreateMiracle]: {
    powerCost: 50,
    minimumPower: 200,
    cooldownDays: 365,
    rarity: 0.1,
  },
  [InterventionType.GrantDivineWeapon]: {
    powerCost: 60,
    minimumPower: 250,
    cooldownDays: 365,
    rarity: 0.08,
  },
  [InterventionType.PhysicalManifestation]: {
    powerCost: 100,
    minimumPower: 500,
    cooldownDays: 1000,
    rarity: 0.02,
  },
};

// ── Church and religion structures ───────────────────────────────────────────

export enum DoctrineType {
  Compassion = 'compassion',
  Obedience = 'obedience',
  Revelation = 'revelation',
  Sacrifice = 'sacrifice',
  Freedom = 'freedom',
}

export const ALL_DOCTRINE_TYPES: readonly DoctrineType[] = Object.values(DoctrineType);

/**
 * A deity in the simulation with dynamic power tracking.
 */
export interface SimDeity {
  readonly id: DeityId;
  readonly name: string;
  readonly primaryDomain: Domain;
  readonly secondaryDomains: Domain[];
  readonly basePowerLevel: number; // 1-10 from generator
  currentPower: number; // Dynamic power from worshipers
  readonly isInterventionist: boolean;
  readonly doctrine: DoctrineType;
  alive: boolean;
  lastInterventionTick: number;
  worshiperCount: number;
  averageDevotionLevel: number;
}

/**
 * A religious organization (church, cult, etc.).
 */
export interface Religion {
  readonly id: EntityId;
  readonly name: string;
  primaryDeityId: DeityId;
  secondaryDeityIds: DeityId[]; // For syncretic religions
  readonly foundedTick: number;
  founderCharacterId: CharacterId | null;
  doctrine: DoctrineType;
  corruptionLevel: number; // 0-100
  reformPressure: number; // 0-100
  schismRisk: number; // 0-100
  memberCount: number;
  sites: SiteId[]; // Sites where this religion is practiced
  headquarters: SiteId | null;
  readonly isStateReligion: Map<FactionId, boolean>;
  syncreticInfluences: Map<DeityId, number>; // Foreign deity -> influence strength
}

/**
 * A worshiper's devotion to a specific religion.
 */
export interface DevotionRecord {
  readonly characterId: CharacterId;
  readonly religionId: EntityId;
  devotionLevel: number; // 0-100
  readonly joinedTick: number;
  lastPrayerTick: number;
  miraclesWitnessed: number;
}

// ── Church politics events ───────────────────────────────────────────────────

export enum ChurchEventType {
  CorruptionScandal = 'corruption_scandal',
  PowerStruggle = 'power_struggle',
  SchismThreat = 'schism_threat',
  SchismOccurred = 'schism_occurred',
  ReformMovement = 'reform_movement',
  ReformEnacted = 'reform_enacted',
  Inquisition = 'inquisition',
  HolyWar = 'holy_war',
  PilgrimageEstablished = 'pilgrimage_established',
}

export const ALL_CHURCH_EVENT_TYPES: readonly ChurchEventType[] = Object.values(ChurchEventType);

// ── Prophet/Saint types ──────────────────────────────────────────────────────

export enum HolyFigureType {
  Prophet = 'prophet',
  Saint = 'saint',
  Martyr = 'martyr',
  Mystic = 'mystic',
  HolyWarrior = 'holy_warrior',
  Heretic = 'heretic',
}

export const ALL_HOLY_FIGURE_TYPES: readonly HolyFigureType[] = Object.values(HolyFigureType);

/**
 * A significant religious figure.
 */
export interface HolyFigure {
  readonly id: EntityId;
  readonly characterId: CharacterId;
  readonly religionId: EntityId;
  readonly deityId: DeityId;
  readonly type: HolyFigureType;
  readonly emergenceTick: number;
  readonly name: string;
  fame: number; // 0-100
  miracleCount: number;
  prophecies: string[];
  alive: boolean;
  deathTick: number | null;
  canonized: boolean;
}

// ── Divine power calculations ────────────────────────────────────────────────

/**
 * Calculate divine power from worshiper count and devotion.
 * Power = worshiperCount × (averageDevotion / 100) × basePowerLevel
 */
export function calculateDivinePower(
  worshiperCount: number,
  averageDevotionLevel: number,
  basePowerLevel: number,
): number {
  if (worshiperCount === 0) return 0;
  const devotionMultiplier = averageDevotionLevel / 100;
  const scaleFactor = Math.log10(worshiperCount + 1);
  return Math.round(scaleFactor * devotionMultiplier * basePowerLevel * 10);
}

/**
 * Check if a deity can perform an intervention.
 */
export function canIntervene(
  deity: SimDeity,
  interventionType: InterventionType,
  currentTick: number,
): { canDo: boolean; reason: string } {
  if (!deity.alive) {
    return { canDo: false, reason: 'Deity is dead' };
  }

  if (!deity.isInterventionist) {
    return { canDo: false, reason: 'Deity is not interventionist' };
  }

  const cost = INTERVENTION_COSTS[interventionType];

  if (deity.currentPower < cost.minimumPower) {
    return { canDo: false, reason: `Insufficient power (need ${cost.minimumPower}, have ${deity.currentPower})` };
  }

  const daysSinceLastIntervention = currentTick - deity.lastInterventionTick;
  if (daysSinceLastIntervention < cost.cooldownDays) {
    return { canDo: false, reason: `On cooldown (${cost.cooldownDays - daysSinceLastIntervention} days remaining)` };
  }

  return { canDo: true, reason: 'Can perform intervention' };
}

/**
 * Calculate the probability of a schism based on religion state.
 */
export function calculateSchismProbability(religion: Religion): number {
  // Base factors
  const corruptionFactor = religion.corruptionLevel / 200; // 50% at max corruption
  const reformFactor = religion.reformPressure / 300; // 33% at max reform pressure
  const sizeFactor = Math.min(0.2, religion.memberCount / 50000); // Larger religions more likely to split

  // Syncretic religions are more stable (blended beliefs)
  const syncreticStability = religion.syncreticInfluences.size * 0.02;

  const probability = corruptionFactor + reformFactor + sizeFactor - syncreticStability;
  return Math.max(0, Math.min(0.5, probability)); // Cap at 50%
}

/**
 * Calculate syncretism influence strength based on interaction type.
 */
export function calculateSyncretismInfluence(
  interactionType: 'trade' | 'conquest' | 'marriage' | 'migration',
  duration: number, // ticks of interaction
  intensity: number, // 0-1
): number {
  const baseInfluence: Record<string, number> = {
    trade: 0.1,
    conquest: 0.4,
    marriage: 0.25,
    migration: 0.3,
  };

  const base = baseInfluence[interactionType] ?? 0.1;
  const durationFactor = Math.min(1, duration / 3650); // Max after 10 years
  return base * durationFactor * intensity;
}

// ── ID generation ────────────────────────────────────────────────────────────

let nextDeitySimId = 80000;
let nextReligionId = 81000;
let nextHolyFigureId = 82000;

export function createDeitySimId(): DeityId {
  return toDeityId(toEntityId(nextDeitySimId++));
}

export function createReligionId(): EntityId {
  return toEntityId(nextReligionId++);
}

export function createHolyFigureId(): EntityId {
  return toEntityId(nextHolyFigureId++);
}

export function resetReligionIdCounters(): void {
  nextDeitySimId = 80000;
  nextReligionId = 81000;
  nextHolyFigureId = 82000;
}

// ── Religion System class ────────────────────────────────────────────────────

/**
 * The Religion System manages divine power, interventions, and church politics.
 * Runs at two frequencies:
 * - ANNUAL for divine power calculations and god death checks
 * - WEEKLY for devotion updates and minor events
 */
export class ReligionSystem extends BaseSystem {
  readonly name = 'ReligionSystem';
  readonly frequency = TickFrequency.Weekly; // Primary frequency
  readonly executionOrder = ExecutionOrder.RELIGION;

  private readonly deities = new Map<DeityId, SimDeity>();
  private readonly religions = new Map<EntityId, Religion>();
  private readonly devotions = new Map<CharacterId, DevotionRecord[]>();
  private readonly holyFigures = new Map<EntityId, HolyFigure>();

  private lastAnnualTick = 0;
  private pantheonComplexity: 'atheistic' | 'deistic' | 'theistic' | 'interventionist' = 'theistic';

  override initialize(world: World): void {
    super.initialize(world);
  }

  setPantheonComplexity(complexity: 'atheistic' | 'deistic' | 'theistic' | 'interventionist'): void {
    this.pantheonComplexity = complexity;
  }

  execute(world: World, clock: WorldClock, events: EventBus): void {
    const currentTick = clock.currentTick;

    // Weekly processing
    this.updateDevotionLevels(world, clock, events);
    this.processChurchPolitics(world, clock, events);
    this.checkForProphetEmergence(world, clock, events);

    // Annual processing (every 365 ticks)
    if (currentTick - this.lastAnnualTick >= TickFrequency.Annual) {
      this.updateDivinePower(world, clock, events);
      this.checkForGodDeath(world, clock, events);
      this.processInterventions(world, clock, events);
      this.processSyncretism(world, clock, events);
      this.lastAnnualTick = currentTick;
    }
  }

  // ── Deity management ─────────────────────────────────────────────────────

  registerDeity(deity: SimDeity): void {
    this.deities.set(deity.id, deity);
  }

  getDeity(id: DeityId): SimDeity | undefined {
    return this.deities.get(id);
  }

  getAllDeities(): SimDeity[] {
    return Array.from(this.deities.values());
  }

  getLivingDeities(): SimDeity[] {
    return Array.from(this.deities.values()).filter(d => d.alive);
  }

  // ── Religion management ──────────────────────────────────────────────────

  registerReligion(religion: Religion): void {
    this.religions.set(religion.id, religion);
  }

  getReligion(id: EntityId): Religion | undefined {
    return this.religions.get(id);
  }

  getReligionsByDeity(deityId: DeityId): Religion[] {
    return Array.from(this.religions.values()).filter(
      r => r.primaryDeityId === deityId || r.secondaryDeityIds.includes(deityId)
    );
  }

  // ── Devotion management ──────────────────────────────────────────────────

  addDevotion(devotion: DevotionRecord): void {
    const existing = this.devotions.get(devotion.characterId) ?? [];
    existing.push(devotion);
    this.devotions.set(devotion.characterId, existing);
  }

  getDevotions(characterId: CharacterId): DevotionRecord[] {
    return this.devotions.get(characterId) ?? [];
  }

  getDevotionsByReligion(religionId: EntityId): DevotionRecord[] {
    const result: DevotionRecord[] = [];
    for (const devotions of this.devotions.values()) {
      for (const d of devotions) {
        if (d.religionId === religionId) {
          result.push(d);
        }
      }
    }
    return result;
  }

  // ── Holy figure management ───────────────────────────────────────────────

  registerHolyFigure(figure: HolyFigure): void {
    this.holyFigures.set(figure.id, figure);
  }

  getHolyFigure(id: EntityId): HolyFigure | undefined {
    return this.holyFigures.get(id);
  }

  getHolyFiguresByReligion(religionId: EntityId): HolyFigure[] {
    return Array.from(this.holyFigures.values()).filter(f => f.religionId === religionId);
  }

  // ── Divine intervention ──────────────────────────────────────────────────

  attemptIntervention(
    deityId: DeityId,
    interventionType: InterventionType,
    targetId: EntityId,
    clock: WorldClock,
    events: EventBus,
    rng: () => number,
  ): { success: boolean; reason: string } {
    const deity = this.deities.get(deityId);
    if (deity === undefined) {
      return { success: false, reason: 'Deity not found' };
    }

    const canDo = canIntervene(deity, interventionType, clock.currentTick);
    if (!canDo.canDo) {
      return { success: false, reason: canDo.reason };
    }

    const cost = INTERVENTION_COSTS[interventionType];

    // Success chance based on rarity and deity power
    const powerBonus = Math.min(0.3, (deity.currentPower - cost.minimumPower) / 1000);
    const successChance = cost.rarity + powerBonus;

    if (rng() > successChance) {
      // Failed but still costs some power
      deity.currentPower = Math.max(0, deity.currentPower - Math.floor(cost.powerCost / 2));
      deity.lastInterventionTick = clock.currentTick;
      return { success: false, reason: 'Intervention failed (divine will unclear)' };
    }

    // Success - apply cost
    deity.currentPower = Math.max(0, deity.currentPower - cost.powerCost);
    deity.lastInterventionTick = clock.currentTick;

    // Emit event
    events.emit(createEvent({
      category: EventCategory.Religious,
      subtype: `religion.intervention.${interventionType}`,
      timestamp: clock.currentTick,
      participants: [deityId, targetId],
      significance: 60 + Math.floor(cost.powerCost / 2),
      data: {
        deityId,
        deityName: deity.name,
        interventionType,
        targetId,
        powerSpent: cost.powerCost,
      },
    }));

    return { success: true, reason: `${deity.name} intervenes!` };
  }

  // ── Schism handling ──────────────────────────────────────────────────────

  triggerSchism(
    religionId: EntityId,
    clock: WorldClock,
    events: EventBus,
    rng: () => number,
  ): Religion | null {
    const religion = this.religions.get(religionId);
    if (religion === undefined) return null;

    // Split worshipers
    const devotions = this.getDevotionsByReligion(religionId);
    const splitRatio = 0.3 + rng() * 0.3; // 30-60% join new religion
    const departingCount = Math.floor(devotions.length * splitRatio);

    // Create new religion
    const newReligion: Religion = {
      id: createReligionId(),
      name: `Reformed ${religion.name}`,
      primaryDeityId: religion.primaryDeityId,
      secondaryDeityIds: [...religion.secondaryDeityIds],
      foundedTick: clock.currentTick,
      founderCharacterId: null, // Could be set to a prophet
      doctrine: religion.doctrine,
      corruptionLevel: 10, // Fresh start
      reformPressure: 0,
      schismRisk: 0,
      memberCount: departingCount,
      sites: [],
      headquarters: null,
      isStateReligion: new Map(),
      syncreticInfluences: new Map(religion.syncreticInfluences),
    };

    this.religions.set(newReligion.id, newReligion);

    // Update original religion
    religion.memberCount -= departingCount;
    religion.schismRisk = 10; // Reset after schism
    religion.reformPressure = Math.max(0, religion.reformPressure - 30);

    // Move some devotions to new religion
    const shuffled = [...devotions].sort(() => rng() - 0.5);
    for (let i = 0; i < departingCount && i < shuffled.length; i++) {
      const devotion = shuffled[i]!;
      devotion.devotionLevel = Math.max(50, devotion.devotionLevel); // Enthusiastic new converts
      // Update the devotion record's religion
      const charDevotions = this.devotions.get(devotion.characterId);
      if (charDevotions !== undefined) {
        const idx = charDevotions.findIndex(d => d.religionId === religionId);
        if (idx !== -1) {
          // Create new devotion for the new religion
          const newDevotion: DevotionRecord = {
            characterId: devotion.characterId,
            religionId: newReligion.id,
            devotionLevel: devotion.devotionLevel,
            joinedTick: clock.currentTick,
            lastPrayerTick: clock.currentTick,
            miraclesWitnessed: 0,
          };
          charDevotions[idx] = newDevotion;
        }
      }
    }

    // Emit schism event
    events.emit(createEvent({
      category: EventCategory.Religious,
      subtype: 'religion.schism',
      timestamp: clock.currentTick,
      participants: [religionId, newReligion.id],
      significance: 80,
      data: {
        originalReligionId: religionId,
        originalReligionName: religion.name,
        newReligionId: newReligion.id,
        newReligionName: newReligion.name,
        departingCount,
        cause: religion.corruptionLevel > 60 ? 'corruption' : 'doctrinal_disagreement',
      },
    }));

    return newReligion;
  }

  // ── Private processing methods ───────────────────────────────────────────

  private updateDevotionLevels(_world: World, clock: WorldClock, _events: EventBus): void {
    for (const [_characterId, devotions] of this.devotions) {
      for (const devotion of devotions) {
        // Devotion decays slightly if no prayer
        const daysSincePrayer = clock.currentTick - devotion.lastPrayerTick;
        if (daysSincePrayer > 30) {
          devotion.devotionLevel = Math.max(0, devotion.devotionLevel - 1);
        }

        // Miracles boost devotion
        if (devotion.miraclesWitnessed > 0) {
          devotion.devotionLevel = Math.min(100, devotion.devotionLevel + devotion.miraclesWitnessed * 5);
        }
      }
    }

    // Update religion member counts and average devotion
    for (const religion of this.religions.values()) {
      const devotions = this.getDevotionsByReligion(religion.id);
      religion.memberCount = devotions.length;

      if (devotions.length > 0) {
        const totalDevotion = devotions.reduce((sum, d) => sum + d.devotionLevel, 0);
        const avgDevotion = totalDevotion / devotions.length;

        // Update deity stats
        const deity = this.deities.get(religion.primaryDeityId);
        if (deity !== undefined) {
          deity.worshiperCount = devotions.length;
          deity.averageDevotionLevel = avgDevotion;
        }
      }
    }
  }

  private updateDivinePower(_world: World, clock: WorldClock, events: EventBus): void {
    for (const deity of this.deities.values()) {
      if (!deity.alive) continue;

      const newPower = calculateDivinePower(
        deity.worshiperCount,
        deity.averageDevotionLevel,
        deity.basePowerLevel
      );

      const powerChange = newPower - deity.currentPower;
      deity.currentPower = newPower;

      // Emit significant power changes
      if (Math.abs(powerChange) > 20) {
        events.emit(createEvent({
          category: EventCategory.Religious,
          subtype: powerChange > 0 ? 'religion.deity_power_rise' : 'religion.deity_power_fall',
          timestamp: clock.currentTick,
          participants: [deity.id],
          significance: 40 + Math.min(40, Math.abs(powerChange)),
          data: {
            deityId: deity.id,
            deityName: deity.name,
            oldPower: deity.currentPower - powerChange,
            newPower: deity.currentPower,
            change: powerChange,
          },
        }));
      }
    }
  }

  private checkForGodDeath(_world: World, clock: WorldClock, events: EventBus): void {
    for (const deity of this.deities.values()) {
      if (!deity.alive) continue;

      // God dies if no worshipers for extended period
      if (deity.worshiperCount === 0 && deity.currentPower < 10) {
        deity.alive = false;

        events.emit(createEvent({
          category: EventCategory.Religious,
          subtype: 'religion.deity_death',
          timestamp: clock.currentTick,
          participants: [deity.id],
          significance: 95,
          data: {
            deityId: deity.id,
            deityName: deity.name,
            cause: 'loss_of_faith',
            finalPower: deity.currentPower,
          },
        }));

        // Trigger theological crisis for related religions
        const religions = this.getReligionsByDeity(deity.id);
        for (const religion of religions) {
          if (religion.primaryDeityId === deity.id) {
            events.emit(createEvent({
              category: EventCategory.Religious,
              subtype: 'religion.theological_crisis',
              timestamp: clock.currentTick,
              participants: [religion.id, deity.id],
              significance: 90,
              data: {
                religionId: religion.id,
                religionName: religion.name,
                deadDeityId: deity.id,
                deadDeityName: deity.name,
                crisis: 'primary_deity_death',
              },
            }));

            // Increase schism risk dramatically
            religion.schismRisk = Math.min(100, religion.schismRisk + 50);
          }
        }
      }
    }
  }

  private processInterventions(_world: World, clock: WorldClock, events: EventBus): void {
    if (this.pantheonComplexity === 'atheistic' || this.pantheonComplexity === 'deistic') {
      return; // No interventions in these settings
    }

    for (const deity of this.deities.values()) {
      if (!deity.alive || !deity.isInterventionist) continue;

      // Deities occasionally intervene based on their power
      const interventionChance = Math.min(0.3, deity.currentPower / 1000);
      if (Math.random() > interventionChance) continue;

      // Pick a random intervention type they can afford
      const affordableTypes = ALL_INTERVENTION_TYPES.filter(type => {
        const cost = INTERVENTION_COSTS[type];
        return deity.currentPower >= cost.minimumPower &&
               (clock.currentTick - deity.lastInterventionTick) >= cost.cooldownDays;
      });

      if (affordableTypes.length === 0) continue;

      // Weight by rarity (rarer = less likely to be chosen)
      const weights = affordableTypes.map(t => INTERVENTION_COSTS[t].rarity);
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let roll = Math.random() * totalWeight;

      let selectedType = affordableTypes[0]!;
      for (let i = 0; i < affordableTypes.length; i++) {
        roll -= weights[i]!;
        if (roll <= 0) {
          selectedType = affordableTypes[i]!;
          break;
        }
      }

      // Get a random target (simplified - would normally be contextual)
      const religions = this.getReligionsByDeity(deity.id);
      if (religions.length === 0) continue;

      const targetReligion = religions[Math.floor(Math.random() * religions.length)]!;
      const targetId = targetReligion.id;

      this.attemptIntervention(deity.id, selectedType, targetId, clock, events, Math.random);
    }
  }

  private processChurchPolitics(_world: World, clock: WorldClock, events: EventBus): void {
    for (const religion of this.religions.values()) {
      // Corruption grows over time
      if (religion.memberCount > 100) {
        religion.corruptionLevel = Math.min(100, religion.corruptionLevel + 0.5);
      }

      // Reform pressure grows with corruption
      if (religion.corruptionLevel > 40) {
        religion.reformPressure = Math.min(100, religion.reformPressure + 0.3);
      }

      // Schism risk calculation
      religion.schismRisk = calculateSchismProbability(religion) * 100;

      // Check for schism
      if (religion.schismRisk > 50 && Math.random() < (religion.schismRisk - 50) / 500) {
        this.triggerSchism(religion.id, clock, events, Math.random);
      }

      // Check for corruption scandal
      if (religion.corruptionLevel > 70 && Math.random() < 0.05) {
        events.emit(createEvent({
          category: EventCategory.Religious,
          subtype: 'religion.corruption_scandal',
          timestamp: clock.currentTick,
          participants: [religion.id],
          significance: 50 + Math.floor(religion.corruptionLevel / 3),
          data: {
            religionId: religion.id,
            religionName: religion.name,
            corruptionLevel: religion.corruptionLevel,
          },
        }));

        // Scandal increases reform pressure
        religion.reformPressure = Math.min(100, religion.reformPressure + 15);
      }

      // Check for reform movement
      if (religion.reformPressure > 60 && Math.random() < 0.03) {
        events.emit(createEvent({
          category: EventCategory.Religious,
          subtype: 'religion.reform_movement',
          timestamp: clock.currentTick,
          participants: [religion.id],
          significance: 55,
          data: {
            religionId: religion.id,
            religionName: religion.name,
            reformPressure: religion.reformPressure,
            targetedCorruption: religion.corruptionLevel,
          },
        }));
      }
    }
  }

  private processSyncretism(_world: World, clock: WorldClock, events: EventBus): void {
    // Syncretism happens when religions are in proximity
    for (const religion of this.religions.values()) {
      // For each syncretic influence, it can grow or fade
      for (const [foreignDeityId, influence] of religion.syncreticInfluences) {
        const foreignDeity = this.deities.get(foreignDeityId);
        if (foreignDeity === undefined || !foreignDeity.alive) {
          // Foreign deity is dead, influence fades
          const newInfluence = influence * 0.9;
          if (newInfluence < 0.05) {
            religion.syncreticInfluences.delete(foreignDeityId);
          } else {
            religion.syncreticInfluences.set(foreignDeityId, newInfluence);
          }
          continue;
        }

        // Strong influences can lead to full absorption
        if (influence > 0.7 && Math.random() < 0.01) {
          // Add foreign deity to secondary deities
          if (!religion.secondaryDeityIds.includes(foreignDeityId)) {
            religion.secondaryDeityIds.push(foreignDeityId);

            events.emit(createEvent({
              category: EventCategory.Religious,
              subtype: 'religion.syncretism_absorption',
              timestamp: clock.currentTick,
              participants: [religion.id, foreignDeityId],
              significance: 65,
              data: {
                religionId: religion.id,
                religionName: religion.name,
                absorbedDeityId: foreignDeityId,
                absorbedDeityName: foreignDeity.name,
              },
            }));
          }
        }
      }
    }
  }

  private checkForProphetEmergence(_world: World, clock: WorldClock, events: EventBus): void {
    // Prophets emerge in times of crisis or divine power surge
    for (const religion of this.religions.values()) {
      const deity = this.deities.get(religion.primaryDeityId);
      if (deity === undefined || !deity.alive) continue;

      // Factors that increase prophet emergence
      const crisisFactor = religion.schismRisk / 200;
      const divinePowerFactor = deity.currentPower > 300 ? 0.1 : 0;
      const faithFactor = deity.averageDevotionLevel > 80 ? 0.05 : 0;

      const prophetChance = crisisFactor + divinePowerFactor + faithFactor;

      if (Math.random() < prophetChance * 0.01) {
        // Create a new prophet
        const prophet: HolyFigure = {
          id: createHolyFigureId(),
          characterId: toCharacterId(toEntityId(Math.floor(Math.random() * 10000))), // Placeholder
          religionId: religion.id,
          deityId: religion.primaryDeityId,
          type: HolyFigureType.Prophet,
          emergenceTick: clock.currentTick,
          name: `Prophet of ${deity.name}`,
          fame: 20 + Math.floor(Math.random() * 30),
          miracleCount: 0,
          prophecies: [],
          alive: true,
          deathTick: null,
          canonized: false,
        };

        this.holyFigures.set(prophet.id, prophet);

        events.emit(createEvent({
          category: EventCategory.Religious,
          subtype: 'religion.prophet_emerges',
          timestamp: clock.currentTick,
          participants: [prophet.id, religion.id, deity.id],
          significance: 70,
          data: {
            prophetId: prophet.id,
            prophetName: prophet.name,
            religionId: religion.id,
            religionName: religion.name,
            deityId: deity.id,
            deityName: deity.name,
          },
        }));
      }
    }
  }

  /**
   * Add syncretic influence from a foreign deity to a religion.
   */
  addSyncreticInfluence(
    religionId: EntityId,
    foreignDeityId: DeityId,
    influenceAmount: number,
    clock: WorldClock,
    events: EventBus,
  ): void {
    const religion = this.religions.get(religionId);
    if (religion === undefined) return;

    const currentInfluence = religion.syncreticInfluences.get(foreignDeityId) ?? 0;
    const newInfluence = Math.min(1, currentInfluence + influenceAmount);
    religion.syncreticInfluences.set(foreignDeityId, newInfluence);

    // Emit event for significant influence
    if (newInfluence > 0.3 && currentInfluence <= 0.3) {
      const foreignDeity = this.deities.get(foreignDeityId);
      events.emit(createEvent({
        category: EventCategory.Religious,
        subtype: 'religion.syncretism_growing',
        timestamp: clock.currentTick,
        participants: [religionId, foreignDeityId],
        significance: 45,
        data: {
          religionId,
          religionName: religion.name,
          foreignDeityId,
          foreignDeityName: foreignDeity?.name ?? 'Unknown',
          influenceLevel: newInfluence,
        },
      }));
    }
  }

  /**
   * Create a new religion (e.g., from conquest or schism).
   */
  createReligion(
    name: string,
    primaryDeityId: DeityId,
    doctrine: DoctrineType,
    founderId: CharacterId | null,
    clock: WorldClock,
    events: EventBus,
  ): Religion {
    const religion: Religion = {
      id: createReligionId(),
      name,
      primaryDeityId,
      secondaryDeityIds: [],
      foundedTick: clock.currentTick,
      founderCharacterId: founderId,
      doctrine,
      corruptionLevel: 0,
      reformPressure: 0,
      schismRisk: 0,
      memberCount: 0,
      sites: [],
      headquarters: null,
      isStateReligion: new Map(),
      syncreticInfluences: new Map(),
    };

    this.religions.set(religion.id, religion);

    events.emit(createEvent({
      category: EventCategory.Religious,
      subtype: 'religion.founded',
      timestamp: clock.currentTick,
      participants: founderId !== null ? [religion.id, primaryDeityId, founderId] : [religion.id, primaryDeityId],
      significance: 65,
      data: {
        religionId: religion.id,
        religionName: name,
        primaryDeityId,
        founderId,
        doctrine,
      },
    }));

    return religion;
  }
}
