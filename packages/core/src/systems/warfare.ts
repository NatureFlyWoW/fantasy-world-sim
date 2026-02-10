/**
 * Military & Warfare System — handles army composition, campaigns, battles, and sieges.
 * Movement runs DAILY, campaigns/battles run SEASONAL.
 * Battle resolution simulates key moments with multiple factors.
 */

import type { EntityId, FactionId, SiteId, WarId, CharacterId } from '../ecs/types.js';
import type { World } from '../ecs/world.js';
import type { WorldTime } from '../time/types.js';
import { TickFrequency, worldTimeToTicks } from '../time/types.js';
import type { WorldClock } from '../time/world-clock.js';
import { EventCategory } from '../events/types.js';
import type { EventBus } from '../events/event-bus.js';
import { createEvent } from '../events/event-factory.js';
import { BaseSystem, ExecutionOrder } from '../engine/system.js';
import type { PositionComponent } from '../ecs/component.js';
import { SeededRNG } from '../utils/seeded-rng.js';
import {
  UnitType,
  UNIT_STATS,
  TerrainType,
  WeatherType,
  WarObjective,
  WarPhase,
  SiegeMethod,
  SiegePhase,
  getArmySize,
  progressSiege,
  resolveBattle,
  createWarId,
  createBattleId,
  createSiegeId,
  createArmyId,
} from './warfare-types.js';
import type {
  ArmyUnit,
  Army,
  War,
  BattleContext,
  SiegeState,
  WarConsequences,
} from './warfare-types.js';

// Re-export all types for external consumers
export {
  UnitType,
  ALL_UNIT_TYPES,
  STANDARD_UNITS,
  RACIAL_UNITS,
  UNIT_STATS,
  TerrainType,
  TERRAIN_MODIFIERS,
  WeatherType,
  WEATHER_EFFECTS,
  WarObjective,
  WarPhase,
  SiegeMethod,
  SiegePhase,
  calculateArmyStrength,
  getArmySize,
  resolveBattle,
  progressSiege,
  createWarId,
  createBattleId,
  createSiegeId,
  createArmyId,
  resetWarfareIdCounters,
} from './warfare-types.js';
export type {
  UnitStats,
  TerrainModifiers,
  WeatherEffects,
  ArmyUnit,
  Army,
  CommanderStats,
  War,
  BattleContext,
  BattleMoment,
  BattleResult,
  SiegeState,
  SiegeEvent,
  WarConsequences,
} from './warfare-types.js';

// ── WarfareSystem class ──────────────────────────────────────────────────────

export class WarfareSystem extends BaseSystem {
  readonly name = 'WarfareSystem';
  readonly frequency = TickFrequency.Daily; // Movement is daily
  readonly executionOrder = ExecutionOrder.MILITARY;

  private wars: Map<number, War> = new Map();
  private armies: Map<number, Army> = new Map();
  private sieges: Map<number, SiegeState> = new Map();
  private readonly rng: SeededRNG;
  private lastSeasonalTick = 0;

  constructor(rng?: SeededRNG) {
    super();
    this.rng = rng ?? new SeededRNG(0);
  }

  /**
   * Main execution — daily for movement, seasonal for campaigns.
   */
  execute(world: World, clock: WorldClock, events: EventBus): void {
    // Daily: Process army movement and attrition
    this.processArmyMovement(world, clock);
    this.processAttrition(world, clock);

    // Daily: Progress sieges
    this.processSieges(world, clock, events);

    // Seasonal (every 90 ticks): Process campaigns and battles
    if (clock.currentTick - this.lastSeasonalTick >= 90) {
      this.lastSeasonalTick = clock.currentTick;
      this.processCampaigns(world, clock, events);
    }

    // Check for war conclusions
    this.checkWarConclusions(world, clock, events);
  }

  /**
   * Process daily army movement.
   */
  private processArmyMovement(world: World, _clock: WorldClock): void {
    for (const army of this.armies.values()) {
      if (army.objective === null) continue;

      // Get objective position
      const targetPos = world.getComponent<PositionComponent>(army.objective, 'Position');
      if (targetPos === undefined) continue;

      // Calculate movement based on slowest unit
      let minSpeed = 100;
      for (const unit of army.units) {
        const speed = UNIT_STATS[unit.type].speed;
        if (speed < minSpeed) minSpeed = speed;
      }

      // Movement per day (base 1 tile per 10 speed)
      const moveSpeed = minSpeed / 10;

      // Move toward objective
      const dx = targetPos.x - army.position.x;
      const dy = targetPos.y - army.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0.1) {
        const moveX = (dx / distance) * Math.min(moveSpeed, distance);
        const moveY = (dy / distance) * Math.min(moveSpeed, distance);
        army.position.x += moveX;
        army.position.y += moveY;

        // Fatigue from movement
        army.fatigue = Math.min(100, army.fatigue + 2);
      }
    }
  }

  /**
   * Process daily attrition from supply, fatigue, disease.
   */
  private processAttrition(_world: World, _clock: WorldClock): void {
    for (const army of this.armies.values()) {
      // Supply consumption
      const armySize = getArmySize(army);
      army.supply = Math.max(0, army.supply - armySize / 1000);

      // Attrition from low supply
      if (army.supply < 20) {
        const attritionRate = (20 - army.supply) / 1000;
        for (const unit of army.units) {
          unit.count = Math.max(0, Math.round(unit.count * (1 - attritionRate)));
          unit.morale = Math.max(0, unit.morale - 1);
        }
      }

      // Fatigue recovery when stationary
      if (army.objective === null) {
        army.fatigue = Math.max(0, army.fatigue - 5);
      }
    }
  }

  /**
   * Process daily siege progress.
   */
  private processSieges(_world: World, clock: WorldClock, events: EventBus): void {
    for (const siege of this.sieges.values()) {
      if (siege.phase === SiegePhase.Surrender || siege.phase === SiegePhase.Broken) {
        continue;
      }

      // Find besieging army
      const besiegers = Array.from(this.armies.values()).find(
        a => a.factionId === siege.besiegerId && a.objective === siege.targetId
      );
      if (besiegers === undefined) {
        siege.phase = SiegePhase.Broken;
        continue;
      }

      // Get defender info (simplified)
      const defenders = { count: 500, morale: siege.defenderMorale };

      // Check for relief force
      const reliefForce = Array.from(this.armies.values()).find(
        a => a.factionId === siege.defenderId &&
             a.objective === siege.targetId &&
             Math.sqrt(
               Math.pow(a.position.x - besiegers.position.x, 2) +
               Math.pow(a.position.y - besiegers.position.y, 2)
             ) < 5
      );

      const siegeEvent = progressSiege(siege, besiegers, defenders, reliefForce !== undefined, () => this.rng.next());

      if (siegeEvent !== null) {
        // Fix timestamp
        (siegeEvent as { timestamp: WorldTime }).timestamp = clock.currentTime;

        // Emit event
        events.emit(createEvent({
          category: EventCategory.Military,
          subtype: `siege.${siegeEvent.type}`,
          timestamp: clock.currentTick,
          participants: [siege.besiegerId, siege.defenderId],
          significance: 60 + siegeEvent.moraleChange.defender,
          data: {
            siegeId: siege.siegeId,
            targetId: siege.targetId,
            casualties: siegeEvent.casualties,
            wallDamage: siegeEvent.wallDamage,
          },
        }));
      }
    }
  }

  /**
   * Process seasonal campaigns — evaluate strategic situation and initiate battles.
   */
  private processCampaigns(world: World, clock: WorldClock, events: EventBus): void {
    for (const war of this.wars.values()) {
      if (war.phase === WarPhase.Concluded || war.phase === WarPhase.Negotiation) {
        continue;
      }

      // Find opposing armies in proximity
      const attackerArmies = Array.from(this.armies.values()).filter(a => a.factionId === war.attackerId);
      const defenderArmies = Array.from(this.armies.values()).filter(a => a.factionId === war.defenderId);

      for (const attackerArmy of attackerArmies) {
        for (const defenderArmy of defenderArmies) {
          const distance = Math.sqrt(
            Math.pow(attackerArmy.position.x - defenderArmy.position.x, 2) +
            Math.pow(attackerArmy.position.y - defenderArmy.position.y, 2)
          );

          // Battle if armies are close
          if (distance < 3) {
            this.initiateBattle(war, attackerArmy, defenderArmy, world, clock, events);
          }
        }
      }
    }
  }

  /**
   * Initiate and resolve a battle.
   */
  private initiateBattle(
    war: War,
    attackerArmy: Army,
    defenderArmy: Army,
    _world: World,
    clock: WorldClock,
    events: EventBus,
  ): void {
    const battleId = createBattleId();

    // Determine terrain (simplified)
    const terrain = TerrainType.Plains;
    const weather = WeatherType.Clear;

    // Create battle context
    const context: BattleContext = {
      attackerArmy,
      defenderArmy,
      terrain,
      weather,
      attackerCommander: attackerArmy.commanderId !== null
        ? { tacticalSkill: 50, strategicSkill: 50, inspirationBonus: 10, siegeExpertise: 30, magicalAffinity: 20 }
        : null,
      defenderCommander: defenderArmy.commanderId !== null
        ? { tacticalSkill: 50, strategicSkill: 50, inspirationBonus: 10, siegeExpertise: 30, magicalAffinity: 20 }
        : null,
      attackerHeroes: [],
      defenderHeroes: [],
      magicalSupport: {
        attacker: attackerArmy.units.find(u => u.type === UnitType.Mages)?.count ?? 0,
        defender: defenderArmy.units.find(u => u.type === UnitType.Mages)?.count ?? 0,
      },
    };

    // Resolve battle
    const result = resolveBattle(context, war.id, battleId, clock.currentTime, () => this.rng.next());

    // Apply casualties
    this.applyCasualties(attackerArmy, result.attackerCasualties);
    this.applyCasualties(defenderArmy, result.defenderCasualties);

    // Update morale
    for (const unit of attackerArmy.units) {
      unit.morale = Math.max(0, Math.min(100, unit.morale + result.attackerMoraleChange));
    }
    for (const unit of defenderArmy.units) {
      unit.morale = Math.max(0, Math.min(100, unit.morale + result.defenderMoraleChange));
    }

    // Update war score
    war.warScore += result.warScoreChange;
    war.warScore = Math.max(-100, Math.min(100, war.warScore));
    war.battles.push(result);

    // Emit battle events
    events.emit(createEvent({
      category: EventCategory.Military,
      subtype: 'battle.resolved',
      timestamp: clock.currentTick,
      participants: [war.attackerId, war.defenderId],
      significance: 70 + Math.abs(result.warScoreChange),
      data: {
        battleId,
        warId: war.id,
        winner: result.winner,
        attackerCasualties: result.attackerCasualties,
        defenderCasualties: result.defenderCasualties,
        keyMoments: result.keyMoments,
      },
    }));

    // Emit narrative events for key moments
    for (const moment of result.keyMoments) {
      if (moment.significance >= 70 || moment.heroicAction !== undefined) {
        events.emit(createEvent({
          category: EventCategory.Military,
          subtype: 'battle.moment',
          timestamp: clock.currentTick,
          participants: moment.heroicAction !== undefined ? [moment.heroicAction.heroId] : [],
          significance: moment.significance,
          data: {
            battleId,
            phase: moment.phase,
            description: moment.description,
            heroicAction: moment.heroicAction,
          },
        }));
      }
    }
  }

  /**
   * Apply casualties to an army, distributing across units.
   */
  private applyCasualties(army: Army, totalCasualties: number): void {
    const armySize = getArmySize(army);
    if (armySize === 0) return;

    const casualtyRate = totalCasualties / armySize;

    for (const unit of army.units) {
      const unitCasualties = Math.round(unit.count * casualtyRate);
      unit.count = Math.max(0, unit.count - unitCasualties);

      // Surviving units gain veterancy
      if (unit.count > 0) {
        unit.veterancy = Math.min(100, unit.veterancy + 5);
      }
    }

    // Remove empty units
    army.units = army.units.filter(u => u.count > 0);
  }

  /**
   * Check if any wars should conclude.
   */
  private checkWarConclusions(_world: World, clock: WorldClock, events: EventBus): void {
    for (const war of this.wars.values()) {
      if (war.phase === WarPhase.Concluded) continue;

      // War ends if one side has decisive advantage
      if (war.warScore >= 80 || war.warScore <= -80) {
        war.phase = WarPhase.Concluded;
        war.endTime = clock.currentTime;

        const winner = war.warScore > 0 ? war.attackerId : war.defenderId;
        const loser = war.warScore > 0 ? war.defenderId : war.attackerId;

        // Generate consequences
        const consequences = this.generateWarConsequences(war, winner, loser);

        // Emit conclusion event
        events.emit(createEvent({
          category: EventCategory.Military,
          subtype: 'war.concluded',
          timestamp: clock.currentTick,
          participants: [war.attackerId, war.defenderId],
          significance: 90,
          data: {
            warId: war.id,
            winner,
            loser,
            warScore: war.warScore,
            consequences,
          },
        }));

        // Emit consequence cascade events
        this.emitConsequenceEvents(consequences, clock, events);
      }

      // Check for stalemate
      const warDuration = worldTimeToTicks(clock.currentTime) - worldTimeToTicks(war.startTime);
      if (warDuration > 1800 && Math.abs(war.warScore) < 20) { // 5 years
        war.phase = WarPhase.Stalemate;
      }
    }
  }

  /**
   * Generate post-war consequences.
   */
  private generateWarConsequences(
    war: War,
    winner: FactionId,
    loser: FactionId,
  ): WarConsequences {
    const totalCasualties = war.battles.reduce(
      (sum, b) => sum + b.attackerCasualties + b.defenderCasualties,
      0
    );

    const isDecisive = Math.abs(war.warScore) >= 60;
    const wasLong = war.battles.length >= 5;

    return {
      warId: war.id,
      political: {
        territoryChanges: isDecisive ? [{ regionId: 1, fromId: loser, toId: winner }] : [],
        legitimacyChange: [
          { factionId: winner, change: isDecisive ? 15 : 5 },
          { factionId: loser, change: isDecisive ? -20 : -10 },
        ],
      },
      economic: {
        reparations: isDecisive
          ? { fromId: loser, toId: winner, amount: 1000 + war.warScore * 20 }
          : null,
        devastatedRegions: war.sieges.filter(s => s.phase === SiegePhase.Surrender).map(s => s.targetId as number),
      },
      character: {
        veteranTrauma: war.battles.flatMap(b => b.keyMoments)
          .filter(m => m.heroicAction !== undefined)
          .map(m => m.heroicAction!.heroId),
        warHeroes: war.battles.flatMap(b => b.keyMoments)
          .filter(m => m.heroicAction !== undefined && m.advantageSide !== 'neither')
          .map(m => m.heroicAction!.heroId),
        fallenLeaders: war.battles
          .filter(b => b.capturedCommander !== undefined)
          .map(b => b.capturedCommander!),
      },
      cultural: {
        warLiteratureTheme: wasLong ? 'epic struggle' : isDecisive ? 'glorious victory' : 'bitter conflict',
        nationalTrauma: loser === war.defenderId && totalCasualties > 5000,
        victoryPride: winner === war.attackerId && isDecisive,
      },
      religious: {
        divineInterpretation: isDecisive
          ? 'The gods favored the righteous'
          : 'A test of faith for both peoples',
        martyrs: [],
      },
      memory: {
        generationalGrudge: totalCasualties > 3000 || isDecisive,
        grudgeIntensity: Math.min(100, totalCasualties / 100 + Math.abs(war.warScore)),
      },
    };
  }

  /**
   * Emit events for war consequences.
   */
  private emitConsequenceEvents(
    consequences: WarConsequences,
    clock: WorldClock,
    events: EventBus,
  ): void {
    // Political consequences
    for (const change of consequences.political.legitimacyChange) {
      events.emit(createEvent({
        category: EventCategory.Political,
        subtype: 'faction.legitimacy_change',
        timestamp: clock.currentTick,
        participants: [change.factionId],
        significance: Math.abs(change.change) + 30,
        data: { change: change.change, cause: 'war_outcome' },
      }));
    }

    // Economic consequences
    if (consequences.economic.reparations !== null) {
      events.emit(createEvent({
        category: EventCategory.Economic,
        subtype: 'economy.reparations',
        timestamp: clock.currentTick,
        participants: [consequences.economic.reparations.fromId, consequences.economic.reparations.toId],
        significance: 60,
        data: { amount: consequences.economic.reparations.amount },
      }));
    }

    // Cultural consequences
    if (consequences.cultural.nationalTrauma) {
      events.emit(createEvent({
        category: EventCategory.Cultural,
        subtype: 'culture.national_trauma',
        timestamp: clock.currentTick,
        participants: [],
        significance: 80,
        data: { theme: consequences.cultural.warLiteratureTheme },
      }));
    }

    // Memory consequences (grudges)
    if (consequences.memory.generationalGrudge) {
      events.emit(createEvent({
        category: EventCategory.Personal,
        subtype: 'memory.generational_grudge',
        timestamp: clock.currentTick,
        participants: [],
        significance: consequences.memory.grudgeIntensity,
        data: { intensity: consequences.memory.grudgeIntensity },
      }));
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Declare a new war.
   */
  declareWar(
    attackerId: FactionId,
    defenderId: FactionId,
    objective: WarObjective,
    name: string,
    startTime: WorldTime,
  ): War {
    const war: War = {
      id: createWarId(),
      name,
      attackerId,
      defenderId,
      objective,
      startTime,
      phase: WarPhase.Mobilization,
      battles: [],
      sieges: [],
      warScore: 0,
    };

    this.wars.set(war.id as number, war);
    return war;
  }

  /**
   * Create a new army.
   */
  createArmy(
    factionId: FactionId,
    units: ArmyUnit[],
    position: { x: number; y: number },
    commanderId: CharacterId | null = null,
  ): Army {
    const army: Army = {
      id: createArmyId(),
      factionId,
      commanderId,
      units,
      position: { ...position },
      supply: 100,
      fatigue: 0,
      objective: null,
    };

    this.armies.set(army.id as number, army);
    return army;
  }

  /**
   * Start a siege.
   */
  startSiege(
    warId: WarId,
    targetId: SiteId,
    besiegerId: FactionId,
    defenderId: FactionId,
    method: SiegeMethod,
    startTime: WorldTime,
  ): SiegeState {
    const siege: SiegeState = {
      siegeId: createSiegeId(),
      warId,
      targetId,
      besiegerId,
      defenderId,
      startTime,
      phase: SiegePhase.Encirclement,
      method,
      wallIntegrity: 100,
      defenderSupply: 100,
      defenderMorale: 70,
      diseaseLevel: 0,
      tunnelProgress: 0,
      reliefForceExpected: false,
      daysUnderSiege: 0,
    };

    this.sieges.set(siege.siegeId as number, siege);

    // Add to war
    const war = this.wars.get(warId as number);
    if (war !== undefined) {
      war.sieges.push(siege);
    }

    return siege;
  }

  /**
   * Get a war by ID.
   */
  getWar(warId: WarId): War | undefined {
    return this.wars.get(warId as number);
  }

  /**
   * Get all active wars.
   */
  getActiveWars(): readonly War[] {
    return Array.from(this.wars.values()).filter(w => w.phase !== WarPhase.Concluded);
  }

  /**
   * Get an army by ID.
   */
  getArmy(armyId: EntityId): Army | undefined {
    return this.armies.get(armyId as number);
  }

  /**
   * Get armies for a faction.
   */
  getArmiesForFaction(factionId: FactionId): readonly Army[] {
    return Array.from(this.armies.values()).filter(a => a.factionId === factionId);
  }

  /**
   * Get a siege by ID.
   */
  getSiege(siegeId: EntityId): SiegeState | undefined {
    return this.sieges.get(siegeId as number);
  }

  /**
   * Get active sieges.
   */
  getActiveSieges(): readonly SiegeState[] {
    return Array.from(this.sieges.values()).filter(
      s => s.phase !== SiegePhase.Surrender && s.phase !== SiegePhase.Broken
    );
  }

  /**
   * Set army objective.
   */
  setArmyObjective(armyId: EntityId, objective: SiteId | null): void {
    const army = this.armies.get(armyId as number);
    if (army !== undefined) {
      army.objective = objective;
    }
  }

  /**
   * Get war count.
   */
  get warCount(): number {
    return this.wars.size;
  }

  /**
   * Get army count.
   */
  get armyCount(): number {
    return this.armies.size;
  }

  /**
   * Get siege count.
   */
  get siegeCount(): number {
    return this.sieges.size;
  }

  /**
   * Clear all data (for testing).
   */
  clear(): void {
    this.wars.clear();
    this.armies.clear();
    this.sieges.clear();
    this.lastSeasonalTick = 0;
  }
}
