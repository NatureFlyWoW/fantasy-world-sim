/**
 * Military & Warfare types — unit types, terrain, weather, armies, battles, sieges, and wars.
 * All type definitions, enums, interfaces, stat tables, and helper functions for the warfare system.
 */

import type { EntityId, FactionId, SiteId, WarId, CharacterId } from '../ecs/types.js';
import { toEntityId, toWarId } from '../ecs/types.js';
import type { WorldTime } from '../time/types.js';

// ── Unit types ───────────────────────────────────────────────────────────────

export enum UnitType {
  Infantry = 'infantry',
  Cavalry = 'cavalry',
  Archers = 'archers',
  Siege = 'siege',
  Mages = 'mages',
  // Racial specials
  ElvenArchers = 'elven_archers',
  DwarvenShieldwall = 'dwarven_shieldwall',
  OrcBerserkers = 'orc_berserkers',
  UndeadLegion = 'undead_legion',
  DragonRiders = 'dragon_riders',
}

export const ALL_UNIT_TYPES: readonly UnitType[] = Object.values(UnitType);

export const STANDARD_UNITS: readonly UnitType[] = [
  UnitType.Infantry,
  UnitType.Cavalry,
  UnitType.Archers,
  UnitType.Siege,
  UnitType.Mages,
];

export const RACIAL_UNITS: readonly UnitType[] = [
  UnitType.ElvenArchers,
  UnitType.DwarvenShieldwall,
  UnitType.OrcBerserkers,
  UnitType.UndeadLegion,
  UnitType.DragonRiders,
];

// ── Unit stats ───────────────────────────────────────────────────────────────

export interface UnitStats {
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
  readonly morale: number;
  readonly upkeep: number;
  readonly siegeValue: number; // Effectiveness in sieges
}

export const UNIT_STATS: Readonly<Record<UnitType, UnitStats>> = {
  [UnitType.Infantry]: { attack: 50, defense: 60, speed: 30, morale: 50, upkeep: 1, siegeValue: 30 },
  [UnitType.Cavalry]: { attack: 70, defense: 40, speed: 80, morale: 60, upkeep: 2, siegeValue: 10 },
  [UnitType.Archers]: { attack: 60, defense: 30, speed: 40, morale: 40, upkeep: 1, siegeValue: 20 },
  [UnitType.Siege]: { attack: 30, defense: 20, speed: 10, morale: 30, upkeep: 3, siegeValue: 100 },
  [UnitType.Mages]: { attack: 80, defense: 25, speed: 30, morale: 50, upkeep: 5, siegeValue: 60 },
  [UnitType.ElvenArchers]: { attack: 75, defense: 35, speed: 50, morale: 55, upkeep: 2, siegeValue: 25 },
  [UnitType.DwarvenShieldwall]: { attack: 45, defense: 85, speed: 20, morale: 70, upkeep: 2, siegeValue: 40 },
  [UnitType.OrcBerserkers]: { attack: 90, defense: 30, speed: 50, morale: 80, upkeep: 2, siegeValue: 35 },
  [UnitType.UndeadLegion]: { attack: 55, defense: 50, speed: 25, morale: 100, upkeep: 0, siegeValue: 30 },
  [UnitType.DragonRiders]: { attack: 95, defense: 60, speed: 90, morale: 75, upkeep: 10, siegeValue: 80 },
};

// ── Terrain types ────────────────────────────────────────────────────────────

export enum TerrainType {
  Plains = 'plains',
  Forest = 'forest',
  Mountain = 'mountain',
  River = 'river',
  Swamp = 'swamp',
  Desert = 'desert',
  Hills = 'hills',
  Urban = 'urban',
}

export interface TerrainModifiers {
  readonly attackMod: number;
  readonly defenseMod: number;
  readonly cavalryPenalty: number;
  readonly siegeBonus: number;
}

export const TERRAIN_MODIFIERS: Readonly<Record<TerrainType, TerrainModifiers>> = {
  [TerrainType.Plains]: { attackMod: 1.0, defenseMod: 0.9, cavalryPenalty: 0, siegeBonus: 0 },
  [TerrainType.Forest]: { attackMod: 0.8, defenseMod: 1.2, cavalryPenalty: 0.3, siegeBonus: -20 },
  [TerrainType.Mountain]: { attackMod: 0.7, defenseMod: 1.5, cavalryPenalty: 0.5, siegeBonus: -30 },
  [TerrainType.River]: { attackMod: 0.6, defenseMod: 1.3, cavalryPenalty: 0.4, siegeBonus: 0 },
  [TerrainType.Swamp]: { attackMod: 0.5, defenseMod: 1.1, cavalryPenalty: 0.6, siegeBonus: -40 },
  [TerrainType.Desert]: { attackMod: 0.9, defenseMod: 0.8, cavalryPenalty: 0.1, siegeBonus: 10 },
  [TerrainType.Hills]: { attackMod: 0.8, defenseMod: 1.3, cavalryPenalty: 0.2, siegeBonus: -10 },
  [TerrainType.Urban]: { attackMod: 0.7, defenseMod: 1.4, cavalryPenalty: 0.4, siegeBonus: 50 },
};

// ── Weather types ────────────────────────────────────────────────────────────

export enum WeatherType {
  Clear = 'clear',
  Rain = 'rain',
  Snow = 'snow',
  Fog = 'fog',
  Storm = 'storm',
}

export interface WeatherEffects {
  readonly visibilityMod: number; // Affects archer effectiveness
  readonly movementMod: number;
  readonly moraleMod: number;
  readonly magicMod: number;
}

export const WEATHER_EFFECTS: Readonly<Record<WeatherType, WeatherEffects>> = {
  [WeatherType.Clear]: { visibilityMod: 1.0, movementMod: 1.0, moraleMod: 0, magicMod: 1.0 },
  [WeatherType.Rain]: { visibilityMod: 0.7, movementMod: 0.8, moraleMod: -5, magicMod: 0.9 },
  [WeatherType.Snow]: { visibilityMod: 0.6, movementMod: 0.6, moraleMod: -10, magicMod: 0.85 },
  [WeatherType.Fog]: { visibilityMod: 0.4, movementMod: 0.9, moraleMod: -5, magicMod: 1.1 },
  [WeatherType.Storm]: { visibilityMod: 0.3, movementMod: 0.5, moraleMod: -15, magicMod: 1.3 },
};

// ── Army interface ───────────────────────────────────────────────────────────

export interface ArmyUnit {
  readonly type: UnitType;
  count: number;
  veterancy: number; // 0-100, affects combat effectiveness
  morale: number; // 0-100
}

export interface Army {
  readonly id: EntityId;
  readonly factionId: FactionId;
  commanderId: CharacterId | null;
  units: ArmyUnit[];
  position: { x: number; y: number };
  supply: number; // 0-100, affects combat and attrition
  fatigue: number; // 0-100, increases with forced march
  objective: SiteId | null;
}

// ── Commander interface ──────────────────────────────────────────────────────

export interface CommanderStats {
  readonly tacticalSkill: number; // 0-100
  readonly strategicSkill: number; // 0-100
  readonly inspirationBonus: number; // Morale boost to troops
  readonly siegeExpertise: number; // 0-100
  readonly magicalAffinity: number; // 0-100, boosts mage effectiveness
}

// ── Campaign and War interfaces ──────────────────────────────────────────────

export enum WarObjective {
  Conquest = 'conquest',
  Defense = 'defense',
  Punitive = 'punitive',
  Liberation = 'liberation',
  Religious = 'religious',
  Succession = 'succession',
}

export enum WarPhase {
  Mobilization = 'mobilization',
  Active = 'active',
  Stalemate = 'stalemate',
  Negotiation = 'negotiation',
  Concluded = 'concluded',
}

export interface War {
  readonly id: WarId;
  readonly name: string;
  readonly attackerId: FactionId;
  readonly defenderId: FactionId;
  readonly objective: WarObjective;
  readonly startTime: WorldTime;
  phase: WarPhase;
  battles: BattleResult[];
  sieges: SiegeState[];
  warScore: number; // -100 to 100 (negative = defender winning)
  endTime?: WorldTime;
}

// ── Battle interfaces ────────────────────────────────────────────────────────

export interface BattleContext {
  readonly attackerArmy: Army;
  readonly defenderArmy: Army;
  readonly terrain: TerrainType;
  readonly weather: WeatherType;
  readonly attackerCommander: CommanderStats | null;
  readonly defenderCommander: CommanderStats | null;
  readonly attackerHeroes: readonly CharacterId[];
  readonly defenderHeroes: readonly CharacterId[];
  readonly magicalSupport: { attacker: number; defender: number };
}

export interface BattleMoment {
  readonly phase: 'opening' | 'clash' | 'turning_point' | 'rout' | 'pursuit';
  readonly description: string;
  readonly advantageSide: 'attacker' | 'defender' | 'neither';
  readonly significance: number;
  readonly heroicAction?: { heroId: CharacterId; action: string };
}

export interface BattleResult {
  readonly battleId: EntityId;
  readonly warId: WarId;
  readonly location: { x: number; y: number };
  readonly terrain: TerrainType;
  readonly weather: WeatherType;
  readonly timestamp: WorldTime;
  readonly winner: 'attacker' | 'defender' | 'draw';
  readonly attackerCasualties: number;
  readonly defenderCasualties: number;
  readonly attackerMoraleChange: number;
  readonly defenderMoraleChange: number;
  readonly keyMoments: readonly BattleMoment[];
  readonly warScoreChange: number;
  readonly capturedCommander?: CharacterId;
}

// ── Siege interfaces ─────────────────────────────────────────────────────────

export enum SiegeMethod {
  Assault = 'assault',
  Starve = 'starve',
  Tunnel = 'tunnel',
  MagicalBombardment = 'magical_bombardment',
  NegotiatedSurrender = 'negotiated_surrender',
}

export enum SiegePhase {
  Encirclement = 'encirclement',
  Bombardment = 'bombardment',
  Assault = 'assault',
  Starvation = 'starvation',
  Breach = 'breach',
  Sally = 'sally',
  Surrender = 'surrender',
  Broken = 'broken', // Siege lifted
}

export interface SiegeState {
  readonly siegeId: EntityId;
  readonly warId: WarId;
  readonly targetId: SiteId;
  readonly besiegerId: FactionId;
  readonly defenderId: FactionId;
  readonly startTime: WorldTime;
  phase: SiegePhase;
  method: SiegeMethod;
  wallIntegrity: number; // 0-100
  defenderSupply: number; // 0-100
  defenderMorale: number; // 0-100
  diseaseLevel: number; // 0-100, affects both sides
  tunnelProgress: number; // 0-100
  reliefForceExpected: boolean;
  daysUnderSiege: number;
}

export interface SiegeEvent {
  readonly type: 'assault' | 'sally' | 'disease_outbreak' | 'tunnel_collapse' |
                 'bombardment' | 'surrender_offer' | 'relief_force' | 'breach';
  readonly timestamp: WorldTime;
  readonly casualties: { attacker: number; defender: number };
  readonly wallDamage: number;
  readonly moraleChange: { attacker: number; defender: number };
  readonly description: string;
}

// ── Post-war consequence types ───────────────────────────────────────────────

export interface WarConsequences {
  readonly warId: WarId;
  readonly political: {
    readonly territoryChanges: { regionId: number; fromId: FactionId; toId: FactionId }[];
    readonly legitimacyChange: { factionId: FactionId; change: number }[];
  };
  readonly economic: {
    readonly reparations: { fromId: FactionId; toId: FactionId; amount: number } | null;
    readonly devastatedRegions: number[];
  };
  readonly character: {
    readonly veteranTrauma: CharacterId[];
    readonly warHeroes: CharacterId[];
    readonly fallenLeaders: CharacterId[];
  };
  readonly cultural: {
    readonly warLiteratureTheme: string;
    readonly nationalTrauma: boolean;
    readonly victoryPride: boolean;
  };
  readonly religious: {
    readonly divineInterpretation: string;
    readonly martyrs: CharacterId[];
  };
  readonly memory: {
    readonly generationalGrudge: boolean;
    readonly grudgeIntensity: number;
  };
}

// ── Battle resolution functions ──────────────────────────────────────────────

/**
 * Calculate effective army strength considering all factors.
 */
export function calculateArmyStrength(
  army: Army,
  commander: CommanderStats | null,
  terrain: TerrainType,
  weather: WeatherType,
  isDefender: boolean,
): number {
  let totalStrength = 0;
  const terrainMod = TERRAIN_MODIFIERS[terrain];
  const weatherEff = WEATHER_EFFECTS[weather];

  for (const unit of army.units) {
    const stats = UNIT_STATS[unit.type];
    let unitStrength = unit.count;

    // Base attack/defense
    const combatStat = isDefender ? stats.defense : stats.attack;
    unitStrength *= combatStat / 50; // Normalize around 50

    // Veterancy bonus (up to 50% boost)
    unitStrength *= 1 + (unit.veterancy / 200);

    // Morale factor
    unitStrength *= 0.5 + (unit.morale / 200);

    // Terrain modifiers
    unitStrength *= isDefender ? terrainMod.defenseMod : terrainMod.attackMod;

    // Cavalry terrain penalty
    if (unit.type === UnitType.Cavalry || unit.type === UnitType.DragonRiders) {
      unitStrength *= 1 - terrainMod.cavalryPenalty;
    }

    // Weather effects
    if (unit.type === UnitType.Archers || unit.type === UnitType.ElvenArchers) {
      unitStrength *= weatherEff.visibilityMod;
    }
    if (unit.type === UnitType.Mages) {
      unitStrength *= weatherEff.magicMod;
    }

    // Weather morale impact
    unitStrength *= 1 + (weatherEff.moraleMod / 100);

    totalStrength += unitStrength;
  }

  // Supply factor
  totalStrength *= 0.5 + (army.supply / 200);

  // Fatigue factor
  totalStrength *= 1 - (army.fatigue / 200);

  // Commander bonus
  if (commander !== null) {
    const commandBonus = commander.tacticalSkill / 100;
    totalStrength *= 1 + (commandBonus * 0.3); // Up to 30% boost
    totalStrength *= 1 + (commander.inspirationBonus / 200); // Morale boost
  }

  return Math.round(totalStrength);
}

/**
 * Calculate total unit count in an army.
 */
export function getArmySize(army: Army): number {
  return army.units.reduce((sum, unit) => sum + unit.count, 0);
}

/**
 * Simulate a battle with key moments producing narrative events.
 * NOT a single dice roll — simulates phases of battle.
 */
export function resolveBattle(
  context: BattleContext,
  warId: WarId,
  battleId: EntityId,
  timestamp: WorldTime,
  rng: () => number,
): BattleResult {
  const moments: BattleMoment[] = [];

  const attackerStrength = calculateArmyStrength(
    context.attackerArmy,
    context.attackerCommander,
    context.terrain,
    context.weather,
    false,
  );

  const defenderStrength = calculateArmyStrength(
    context.defenderArmy,
    context.defenderCommander,
    context.terrain,
    context.weather,
    true,
  );

  const attackerSize = getArmySize(context.attackerArmy);
  const defenderSize = getArmySize(context.defenderArmy);

  // Track running advantage
  let attackerAdvantage = 0;

  // Phase 1: Opening
  const openingPhase = simulateOpeningPhase(
    attackerStrength,
    defenderStrength,
    context,
    rng,
  );
  moments.push(openingPhase);
  attackerAdvantage += openingPhase.advantageSide === 'attacker' ? 1 :
                       openingPhase.advantageSide === 'defender' ? -1 : 0;

  // Phase 2: Main Clash
  const clashPhase = simulateClashPhase(
    attackerStrength,
    defenderStrength,
    context,
    rng,
  );
  moments.push(clashPhase);
  attackerAdvantage += clashPhase.advantageSide === 'attacker' ? 2 :
                       clashPhase.advantageSide === 'defender' ? -2 : 0;

  // Phase 3: Turning Point (hero interventions possible)
  const turningPoint = simulateTurningPoint(
    attackerStrength,
    defenderStrength,
    context,
    rng,
  );
  moments.push(turningPoint);
  attackerAdvantage += turningPoint.advantageSide === 'attacker' ? 3 :
                       turningPoint.advantageSide === 'defender' ? -3 : 0;

  // Determine winner
  let winner: 'attacker' | 'defender' | 'draw';
  if (attackerAdvantage > 2) {
    winner = 'attacker';
  } else if (attackerAdvantage < -2) {
    winner = 'defender';
  } else {
    // Close battle - use strength comparison
    const ratio = attackerStrength / Math.max(1, defenderStrength);
    if (ratio > 1.1) {
      winner = 'attacker';
    } else if (ratio < 0.9) {
      winner = 'defender';
    } else {
      winner = 'draw';
    }
  }

  // Phase 4: Rout (if clear winner)
  if (winner !== 'draw') {
    const routPhase = simulateRoutPhase(winner, context, rng);
    moments.push(routPhase);
  }

  // Calculate casualties
  const baseCasualtyRate = 0.15; // 15% base
  const strengthRatio = attackerStrength / Math.max(1, attackerStrength + defenderStrength);

  let attackerCasualtyRate = baseCasualtyRate * (1 - strengthRatio) * 2;
  let defenderCasualtyRate = baseCasualtyRate * strengthRatio * 2;

  // Winner takes fewer casualties
  if (winner === 'attacker') {
    attackerCasualtyRate *= 0.6;
    defenderCasualtyRate *= 1.4;
  } else if (winner === 'defender') {
    attackerCasualtyRate *= 1.4;
    defenderCasualtyRate *= 0.6;
  }

  const attackerCasualties = Math.round(attackerSize * Math.min(0.5, attackerCasualtyRate));
  const defenderCasualties = Math.round(defenderSize * Math.min(0.5, defenderCasualtyRate));

  // Morale changes
  let attackerMoraleChange = winner === 'attacker' ? 10 : winner === 'defender' ? -15 : -5;
  let defenderMoraleChange = winner === 'defender' ? 10 : winner === 'attacker' ? -15 : -5;

  // Commander inspiration
  if (context.attackerCommander !== null) {
    attackerMoraleChange += context.attackerCommander.inspirationBonus / 10;
  }
  if (context.defenderCommander !== null) {
    defenderMoraleChange += context.defenderCommander.inspirationBonus / 10;
  }

  // War score change
  let warScoreChange = 0;
  if (winner === 'attacker') {
    warScoreChange = 10 + Math.round((defenderCasualties / Math.max(1, defenderSize)) * 20);
  } else if (winner === 'defender') {
    warScoreChange = -(10 + Math.round((attackerCasualties / Math.max(1, attackerSize)) * 20));
  }

  return {
    battleId,
    warId,
    location: { ...context.attackerArmy.position },
    terrain: context.terrain,
    weather: context.weather,
    timestamp,
    winner,
    attackerCasualties,
    defenderCasualties,
    attackerMoraleChange: Math.round(attackerMoraleChange),
    defenderMoraleChange: Math.round(defenderMoraleChange),
    keyMoments: moments,
    warScoreChange,
  };
}

function simulateOpeningPhase(
  attackerStrength: number,
  defenderStrength: number,
  context: BattleContext,
  rng: () => number,
): BattleMoment {
  const hasArcherAdvantage = context.attackerArmy.units.some(
    u => (u.type === UnitType.Archers || u.type === UnitType.ElvenArchers) && u.count > 100
  );

  const roll = rng();
  const strengthAdvantage = (attackerStrength - defenderStrength) / Math.max(1, attackerStrength + defenderStrength);

  let advantageSide: 'attacker' | 'defender' | 'neither';
  let description: string;

  if (roll + strengthAdvantage > 0.6) {
    advantageSide = 'attacker';
    description = hasArcherAdvantage
      ? 'A devastating volley of arrows breaks the enemy formation before the main clash'
      : 'The attackers surge forward with unstoppable momentum';
  } else if (roll + strengthAdvantage < 0.4) {
    advantageSide = 'defender';
    description = 'The defenders hold firm, their disciplined ranks absorbing the initial charge';
  } else {
    advantageSide = 'neither';
    description = 'Both sides trade blows in a fierce opening exchange with no clear advantage';
  }

  return {
    phase: 'opening',
    description,
    advantageSide,
    significance: 50,
  };
}

function simulateClashPhase(
  attackerStrength: number,
  defenderStrength: number,
  context: BattleContext,
  rng: () => number,
): BattleMoment {
  const roll = rng();
  const strengthAdvantage = (attackerStrength - defenderStrength) / Math.max(1, attackerStrength + defenderStrength);

  // Commander skill matters in the main clash
  let commandMod = 0;
  if (context.attackerCommander !== null) {
    commandMod += context.attackerCommander.tacticalSkill / 200;
  }
  if (context.defenderCommander !== null) {
    commandMod -= context.defenderCommander.tacticalSkill / 200;
  }

  let advantageSide: 'attacker' | 'defender' | 'neither';
  let description: string;

  if (roll + strengthAdvantage + commandMod > 0.55) {
    advantageSide = 'attacker';
    description = context.attackerCommander !== null
      ? 'The attacking commander executes a brilliant flanking maneuver'
      : 'The attackers overwhelm the defenders through sheer numbers';
  } else if (roll + strengthAdvantage + commandMod < 0.45) {
    advantageSide = 'defender';
    description = context.defenderCommander !== null
      ? 'The defending commander rallies their troops at a critical moment'
      : 'The defenders fight with desperate determination';
  } else {
    advantageSide = 'neither';
    description = 'The battle devolves into a brutal struggle of attrition';
  }

  return {
    phase: 'clash',
    description,
    advantageSide,
    significance: 70,
  };
}

function simulateTurningPoint(
  attackerStrength: number,
  defenderStrength: number,
  context: BattleContext,
  rng: () => number,
): BattleMoment {
  const roll = rng();
  const strengthAdvantage = (attackerStrength - defenderStrength) / Math.max(1, attackerStrength + defenderStrength);

  // Heroes can create turning points
  const attackerHeroChance = context.attackerHeroes.length * 0.15;
  const defenderHeroChance = context.defenderHeroes.length * 0.15;

  // Magical support matters
  const magicMod = (context.magicalSupport.attacker - context.magicalSupport.defender) / 200;

  let advantageSide: 'attacker' | 'defender' | 'neither';
  let description: string;
  let heroicAction: { heroId: CharacterId; action: string } | undefined;

  const heroRoll = rng();
  if (heroRoll < attackerHeroChance && context.attackerHeroes.length > 0) {
    advantageSide = 'attacker';
    const heroId = context.attackerHeroes[Math.floor(rng() * context.attackerHeroes.length)]!;
    heroicAction = { heroId, action: 'charged into the enemy ranks, slaying their champions' };
    description = 'A legendary warrior turns the tide with a heroic charge';
  } else if (heroRoll > 1 - defenderHeroChance && context.defenderHeroes.length > 0) {
    advantageSide = 'defender';
    const heroId = context.defenderHeroes[Math.floor(rng() * context.defenderHeroes.length)]!;
    heroicAction = { heroId, action: 'held the line against impossible odds, inspiring their comrades' };
    description = 'A hero of the defenders inspires a miraculous stand';
  } else if (roll + strengthAdvantage + magicMod > 0.6) {
    advantageSide = 'attacker';
    description = context.magicalSupport.attacker > 30
      ? 'Devastating magical artillery shatters the enemy formation'
      : 'The attackers break through at a critical point';
  } else if (roll + strengthAdvantage + magicMod < 0.4) {
    advantageSide = 'defender';
    description = context.magicalSupport.defender > 30
      ? 'A powerful ward spell turns the enemys magic against them'
      : 'The defenders mount a fierce counterattack';
  } else {
    advantageSide = 'neither';
    description = 'Neither side can gain a decisive advantage as the battle hangs in the balance';
  }

  return {
    phase: 'turning_point',
    description,
    advantageSide,
    significance: 85,
    ...(heroicAction !== undefined ? { heroicAction } : {}),
  };
}

function simulateRoutPhase(
  winner: 'attacker' | 'defender',
  context: BattleContext,
  _rng: () => number,
): BattleMoment {
  const hasCavalry = (winner === 'attacker' ? context.attackerArmy : context.defenderArmy)
    .units.some(u => u.type === UnitType.Cavalry && u.count > 50);

  const description = hasCavalry
    ? 'Cavalry sweeps across the field, cutting down the fleeing enemy'
    : 'The defeated army breaks and flees in disarray';

  return {
    phase: 'rout',
    description,
    advantageSide: winner,
    significance: 60,
  };
}

// ── Siege resolution functions ───────────────────────────────────────────────

/**
 * Calculate siege progress for one day.
 */
export function progressSiege(
  siege: SiegeState,
  besiegers: Army,
  defenders: { count: number; morale: number },
  hasReliefForce: boolean,
  rng: () => number,
): SiegeEvent | null {
  siege.daysUnderSiege++;

  // Supply attrition
  siege.defenderSupply = Math.max(0, siege.defenderSupply - 0.5);

  // Disease spreads over time
  if (siege.daysUnderSiege > 30) {
    const diseaseChance = siege.daysUnderSiege / 500;
    if (rng() < diseaseChance) {
      siege.diseaseLevel = Math.min(100, siege.diseaseLevel + 10);
    }
  }

  // Morale affected by supply and disease
  if (siege.defenderSupply < 30) {
    siege.defenderMorale = Math.max(0, siege.defenderMorale - 1);
  }
  if (siege.diseaseLevel > 20) {
    siege.defenderMorale = Math.max(0, siege.defenderMorale - 0.5);
  }

  // Relief force breaks siege
  if (hasReliefForce) {
    siege.phase = SiegePhase.Broken;
    return {
      type: 'relief_force',
      timestamp: { year: 1, month: 1, day: 1 }, // Will be set by caller
      casualties: { attacker: 0, defender: 0 },
      wallDamage: 0,
      moraleChange: { attacker: -20, defender: 30 },
      description: 'A relief force arrives, breaking the siege',
    };
  }

  // Check for surrender
  if (siege.defenderMorale < 10 || siege.defenderSupply < 5) {
    siege.phase = SiegePhase.Surrender;
    return {
      type: 'surrender_offer',
      timestamp: { year: 1, month: 1, day: 1 },
      casualties: { attacker: 0, defender: 0 },
      wallDamage: 0,
      moraleChange: { attacker: 10, defender: -10 },
      description: 'The defenders, starving and demoralized, offer surrender',
    };
  }

  // Process based on siege method
  switch (siege.method) {
    case SiegeMethod.Assault:
      return processAssault(siege, besiegers, defenders, rng);
    case SiegeMethod.Starve:
      return processStarvation(siege, rng);
    case SiegeMethod.Tunnel:
      return processTunneling(siege, rng);
    case SiegeMethod.MagicalBombardment:
      return processMagicalBombardment(siege, besiegers, rng);
    default:
      return null;
  }
}

function processAssault(
  siege: SiegeState,
  besiegers: Army,
  defenders: { count: number; morale: number },
  rng: () => number,
): SiegeEvent | null {
  // Assaults happen periodically
  if (siege.daysUnderSiege % 7 !== 0) return null;

  const siegeUnits = besiegers.units.filter(u => UNIT_STATS[u.type].siegeValue > 30);
  const siegePower = siegeUnits.reduce((sum, u) => sum + u.count * UNIT_STATS[u.type].siegeValue, 0);

  const wallStrength = siege.wallIntegrity * 10;
  const defenseStrength = defenders.count * (defenders.morale / 100);

  const attackRoll = rng() * siegePower;
  const defenseRoll = rng() * (wallStrength + defenseStrength);

  const attackerLosses = Math.round(50 + rng() * 100);
  const defenderLosses = Math.round(20 + rng() * 50);

  if (attackRoll > defenseRoll * 1.5) {
    // Breach!
    siege.wallIntegrity = Math.max(0, siege.wallIntegrity - 30);
    siege.phase = SiegePhase.Breach;
    return {
      type: 'breach',
      timestamp: { year: 1, month: 1, day: 1 },
      casualties: { attacker: attackerLosses, defender: defenderLosses * 2 },
      wallDamage: 30,
      moraleChange: { attacker: 15, defender: -25 },
      description: 'The walls are breached! Attackers pour through the gap',
    };
  } else {
    siege.wallIntegrity = Math.max(0, siege.wallIntegrity - 5);
    return {
      type: 'assault',
      timestamp: { year: 1, month: 1, day: 1 },
      casualties: { attacker: attackerLosses * 2, defender: defenderLosses },
      wallDamage: 5,
      moraleChange: { attacker: -5, defender: 5 },
      description: 'The assault is repulsed with heavy losses',
    };
  }
}

function processStarvation(
  siege: SiegeState,
  rng: () => number,
): SiegeEvent | null {
  // Sally attempts when supplies get low
  if (siege.defenderSupply < 40 && siege.defenderMorale > 30 && rng() < 0.1) {
    siege.phase = SiegePhase.Sally;
    const success = rng() > 0.6;
    return {
      type: 'sally',
      timestamp: { year: 1, month: 1, day: 1 },
      casualties: {
        attacker: success ? Math.round(30 + rng() * 50) : Math.round(10 + rng() * 20),
        defender: success ? Math.round(10 + rng() * 30) : Math.round(40 + rng() * 60),
      },
      wallDamage: 0,
      moraleChange: {
        attacker: success ? -10 : 5,
        defender: success ? 15 : -15,
      },
      description: success
        ? 'A daring sally raids the besiegers supply lines'
        : 'A sally attempt is beaten back with heavy losses',
    };
  }

  // Disease outbreak
  if (siege.diseaseLevel > 30 && rng() < 0.15) {
    const severity = Math.round(siege.diseaseLevel / 10);
    return {
      type: 'disease_outbreak',
      timestamp: { year: 1, month: 1, day: 1 },
      casualties: {
        attacker: Math.round(severity * 5),
        defender: Math.round(severity * 10),
      },
      wallDamage: 0,
      moraleChange: { attacker: -5, defender: -10 },
      description: 'Disease ravages both the city and the besieging camp',
    };
  }

  return null;
}

function processTunneling(
  siege: SiegeState,
  rng: () => number,
): SiegeEvent | null {
  // Progress tunnel
  siege.tunnelProgress += 2 + rng() * 3;

  if (siege.tunnelProgress >= 100) {
    siege.wallIntegrity = Math.max(0, siege.wallIntegrity - 50);
    siege.phase = SiegePhase.Breach;
    return {
      type: 'breach',
      timestamp: { year: 1, month: 1, day: 1 },
      casualties: { attacker: 0, defender: Math.round(20 + rng() * 30) },
      wallDamage: 50,
      moraleChange: { attacker: 20, defender: -30 },
      description: 'The tunnel is complete! A section of wall collapses',
    };
  }

  // Tunnel collapse risk
  if (rng() < 0.02) {
    siege.tunnelProgress = Math.max(0, siege.tunnelProgress - 30);
    return {
      type: 'tunnel_collapse',
      timestamp: { year: 1, month: 1, day: 1 },
      casualties: { attacker: Math.round(20 + rng() * 40), defender: 0 },
      wallDamage: 0,
      moraleChange: { attacker: -10, defender: 5 },
      description: 'The tunnel collapses, killing the sappers within',
    };
  }

  return null;
}

function processMagicalBombardment(
  siege: SiegeState,
  besiegers: Army,
  rng: () => number,
): SiegeEvent | null {
  const mages = besiegers.units.find(u => u.type === UnitType.Mages);
  if (mages === undefined || mages.count < 10) return null;

  // Bombardment every 3 days
  if (siege.daysUnderSiege % 3 !== 0) return null;

  const magePower = mages.count * mages.veterancy / 50;
  const damage = Math.round(5 + rng() * magePower / 10);

  siege.wallIntegrity = Math.max(0, siege.wallIntegrity - damage);
  siege.defenderMorale = Math.max(0, siege.defenderMorale - 3);

  if (siege.wallIntegrity <= 0) {
    siege.phase = SiegePhase.Breach;
  }

  return {
    type: 'bombardment',
    timestamp: { year: 1, month: 1, day: 1 },
    casualties: { attacker: 0, defender: Math.round(5 + rng() * 15) },
    wallDamage: damage,
    moraleChange: { attacker: 2, defender: -5 },
    description: 'Magical fire rains down upon the walls',
  };
}

// ── War ID generation ────────────────────────────────────────────────────────

let nextWarId = 30000;
let nextBattleId = 40000;
let nextSiegeId = 50000;
let nextArmyId = 60000;

export function createWarId(): WarId {
  return toWarId(toEntityId(nextWarId++));
}

export function createBattleId(): EntityId {
  return toEntityId(nextBattleId++);
}

export function createSiegeId(): EntityId {
  return toEntityId(nextSiegeId++);
}

export function createArmyId(): EntityId {
  return toEntityId(nextArmyId++);
}

export function resetWarfareIdCounters(): void {
  nextWarId = 30000;
  nextBattleId = 40000;
  nextSiegeId = 50000;
  nextArmyId = 60000;
}
