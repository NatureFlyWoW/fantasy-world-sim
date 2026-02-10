/**
 * Religious System — handles divine power, interventions, church politics, and syncretism.
 * Divine power runs ANNUALLY, devotion updates WEEKLY.
 * Implements god death, schisms, and prophet generation.
 */

import type { EntityId, CharacterId, DeityId } from '../ecs/types.js';
import { toEntityId, toCharacterId } from '../ecs/types.js';
import type { World } from '../ecs/world.js';
import { TickFrequency } from '../time/types.js';
import type { WorldClock } from '../time/world-clock.js';
import { EventCategory } from '../events/types.js';
import type { EventBus } from '../events/event-bus.js';
import { createEvent } from '../events/event-factory.js';
import { BaseSystem, ExecutionOrder } from '../engine/system.js';
import { SeededRNG } from '../utils/seeded-rng.js';
import {
  InterventionType,
  ALL_INTERVENTION_TYPES,
  INTERVENTION_COSTS,
  DoctrineType,
  HolyFigureType,
  calculateDivinePower,
  canIntervene,
  calculateSchismProbability,
  createReligionId,
  createHolyFigureId,
} from './religion-types.js';
import type {
  SimDeity,
  Religion,
  DevotionRecord,
  HolyFigure,
} from './religion-types.js';

// Re-export all types for external consumers
export {
  Domain,
  ALL_DOMAINS,
  InterventionType,
  ALL_INTERVENTION_TYPES,
  INTERVENTION_COSTS,
  DoctrineType,
  ALL_DOCTRINE_TYPES,
  ChurchEventType,
  ALL_CHURCH_EVENT_TYPES,
  HolyFigureType,
  ALL_HOLY_FIGURE_TYPES,
  calculateDivinePower,
  canIntervene,
  calculateSchismProbability,
  calculateSyncretismInfluence,
  createDeitySimId,
  createReligionId,
  createHolyFigureId,
  resetReligionIdCounters,
} from './religion-types.js';
export type {
  InterventionCost,
  SimDeity,
  Religion,
  DevotionRecord,
  HolyFigure,
} from './religion-types.js';

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
  private readonly rng: SeededRNG;

  constructor(rng?: SeededRNG) {
    super();
    this.rng = rng ?? new SeededRNG(0);
  }

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
      if (this.rng.next() > interventionChance) continue;

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
      let roll = this.rng.next() * totalWeight;

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

      const targetReligion = religions[this.rng.nextInt(0, religions.length - 1)]!;
      const targetId = targetReligion.id;

      this.attemptIntervention(deity.id, selectedType, targetId, clock, events, () => this.rng.next());
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
      if (religion.schismRisk > 50 && this.rng.next() < (religion.schismRisk - 50) / 500) {
        this.triggerSchism(religion.id, clock, events, () => this.rng.next());
      }

      // Check for corruption scandal
      if (religion.corruptionLevel > 70 && this.rng.next() < 0.05) {
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
      if (religion.reformPressure > 60 && this.rng.next() < 0.03) {
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
        if (influence > 0.7 && this.rng.next() < 0.01) {
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

      if (this.rng.next() < prophetChance * 0.01) {
        // Create a new prophet
        const prophet: HolyFigure = {
          id: createHolyFigureId(),
          characterId: toCharacterId(toEntityId(this.rng.nextInt(0, 9999))), // Placeholder
          religionId: religion.id,
          deityId: religion.primaryDeityId,
          type: HolyFigureType.Prophet,
          emergenceTick: clock.currentTick,
          name: `Prophet of ${deity.name}`,
          fame: this.rng.nextInt(20, 49),
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
