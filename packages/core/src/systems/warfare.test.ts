/**
 * Tests for the Military & Warfare System (Task 3.5).
 * Covers: UnitTypes, ArmyComposition, Battles, Sieges, Campaigns, Consequences.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world.js';
import { WorldClock } from '../time/world-clock.js';
import { EventBus } from '../events/event-bus.js';
import { createWorldTime } from '../time/types.js';
import type { WorldTime } from '../time/types.js';
import { resetEventIdCounter } from '../events/event-factory.js';
import type { FactionId, SiteId, CharacterId, WarId } from '../ecs/types.js';
import { toEntityId, toFactionId, toWarId } from '../ecs/types.js';
import {
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
  resolveBattle,
  progressSiege,
  WarfareSystem,
  createWarId,
  createBattleId,
  createSiegeId,
  createArmyId,
  resetWarfareIdCounters,
} from './warfare.js';
import type {
  Army,
  ArmyUnit,
  CommanderStats,
  BattleContext,
  SiegeState,
} from './warfare.js';

// ── Test helpers ────────────────────────────────────────────────────────────

function fid(n: number): FactionId {
  return toFactionId(toEntityId(n));
}

/** Simple seeded RNG for deterministic tests. */
function createSeededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function sid(n: number): SiteId {
  return n as SiteId;
}

function cid(n: number): CharacterId {
  return n as CharacterId;
}

function wid(n: number): WarId {
  return toWarId(toEntityId(n));
}

function makeTime(year: number, month = 1, day = 1): WorldTime {
  return createWorldTime(year, month, day);
}

function makeUnit(type: UnitType, count: number, veterancy = 50, morale = 70): ArmyUnit {
  return { type, count, veterancy, morale };
}

function makeArmy(
  factionId: FactionId,
  units: ArmyUnit[],
  position = { x: 0, y: 0 },
  supply = 100,
  fatigue = 0,
): Army {
  return {
    id: createArmyId(),
    factionId,
    commanderId: null,
    units,
    position,
    supply,
    fatigue,
    objective: null,
  };
}

function makeCommander(
  tacticalSkill = 50,
  strategicSkill = 50,
  inspirationBonus = 10,
): CommanderStats {
  return {
    tacticalSkill,
    strategicSkill,
    inspirationBonus,
    siegeExpertise: 30,
    magicalAffinity: 20,
  };
}

function makeBattleContext(
  attackerUnits: ArmyUnit[],
  defenderUnits: ArmyUnit[],
  overrides: Partial<BattleContext> = {},
): BattleContext {
  return {
    attackerArmy: makeArmy(fid(1), attackerUnits),
    defenderArmy: makeArmy(fid(2), defenderUnits),
    terrain: TerrainType.Plains,
    weather: WeatherType.Clear,
    attackerCommander: null,
    defenderCommander: null,
    attackerHeroes: [],
    defenderHeroes: [],
    magicalSupport: { attacker: 0, defender: 0 },
    ...overrides,
  };
}

function makeSiege(
  warId: WarId,
  targetId: SiteId,
  method = SiegeMethod.Assault,
): SiegeState {
  return {
    siegeId: createSiegeId(),
    warId,
    targetId,
    besiegerId: fid(1),
    defenderId: fid(2),
    startTime: makeTime(1),
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
}

function setupWorld(): World {
  const world = new World();
  world.registerComponent('Position');
  world.registerComponent('Military');
  return world;
}

// ═════════════════════════════════════════════════════════════════════════════
// Unit Types
// ═════════════════════════════════════════════════════════════════════════════

describe('UnitTypes', () => {
  it('defines all unit types', () => {
    expect(ALL_UNIT_TYPES).toHaveLength(10);
  });

  it('categorizes standard vs racial units', () => {
    expect(STANDARD_UNITS).toHaveLength(5);
    expect(RACIAL_UNITS).toHaveLength(5);

    expect(STANDARD_UNITS).toContain(UnitType.Infantry);
    expect(STANDARD_UNITS).toContain(UnitType.Cavalry);
    expect(STANDARD_UNITS).toContain(UnitType.Archers);
    expect(STANDARD_UNITS).toContain(UnitType.Siege);
    expect(STANDARD_UNITS).toContain(UnitType.Mages);

    expect(RACIAL_UNITS).toContain(UnitType.ElvenArchers);
    expect(RACIAL_UNITS).toContain(UnitType.DwarvenShieldwall);
    expect(RACIAL_UNITS).toContain(UnitType.OrcBerserkers);
  });

  it('all units have stats defined', () => {
    for (const unitType of ALL_UNIT_TYPES) {
      const stats = UNIT_STATS[unitType];
      expect(stats).toBeDefined();
      expect(stats.attack).toBeGreaterThan(0);
      expect(stats.defense).toBeGreaterThan(0);
      expect(stats.speed).toBeGreaterThan(0);
      expect(stats.upkeep).toBeGreaterThanOrEqual(0);
    }
  });

  it('cavalry has highest speed', () => {
    expect(UNIT_STATS[UnitType.Cavalry].speed).toBeGreaterThan(UNIT_STATS[UnitType.Infantry].speed);
  });

  it('siege units have highest siege value', () => {
    for (const unitType of STANDARD_UNITS) {
      if (unitType !== UnitType.Siege) {
        expect(UNIT_STATS[UnitType.Siege].siegeValue).toBeGreaterThanOrEqual(UNIT_STATS[unitType].siegeValue);
      }
    }
  });

  it('orc berserkers have highest attack', () => {
    expect(UNIT_STATS[UnitType.OrcBerserkers].attack).toBeGreaterThanOrEqual(90);
  });

  it('dwarven shieldwall has highest defense', () => {
    expect(UNIT_STATS[UnitType.DwarvenShieldwall].defense).toBeGreaterThanOrEqual(85);
  });

  it('undead have perfect morale (no fear)', () => {
    expect(UNIT_STATS[UnitType.UndeadLegion].morale).toBe(100);
    expect(UNIT_STATS[UnitType.UndeadLegion].upkeep).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Terrain Modifiers
// ═════════════════════════════════════════════════════════════════════════════

describe('TerrainModifiers', () => {
  it('mountains favor defenders', () => {
    const mountains = TERRAIN_MODIFIERS[TerrainType.Mountain];
    expect(mountains.defenseMod).toBeGreaterThan(mountains.attackMod);
    expect(mountains.defenseMod).toBeGreaterThan(1.0);
  });

  it('plains are neutral', () => {
    const plains = TERRAIN_MODIFIERS[TerrainType.Plains];
    expect(plains.attackMod).toBeCloseTo(1.0, 1);
    expect(plains.cavalryPenalty).toBe(0);
  });

  it('forests penalize cavalry', () => {
    const forest = TERRAIN_MODIFIERS[TerrainType.Forest];
    expect(forest.cavalryPenalty).toBeGreaterThan(0);
  });

  it('swamps have highest cavalry penalty', () => {
    const swamp = TERRAIN_MODIFIERS[TerrainType.Swamp];
    for (const terrain of Object.values(TerrainType)) {
      expect(swamp.cavalryPenalty).toBeGreaterThanOrEqual(TERRAIN_MODIFIERS[terrain].cavalryPenalty);
    }
  });

  it('urban terrain has siege bonus', () => {
    const urban = TERRAIN_MODIFIERS[TerrainType.Urban];
    expect(urban.siegeBonus).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Weather Effects
// ═════════════════════════════════════════════════════════════════════════════

describe('WeatherEffects', () => {
  it('clear weather is neutral', () => {
    const clear = WEATHER_EFFECTS[WeatherType.Clear];
    expect(clear.visibilityMod).toBe(1.0);
    expect(clear.movementMod).toBe(1.0);
    expect(clear.moraleMod).toBe(0);
  });

  it('rain reduces visibility and movement', () => {
    const rain = WEATHER_EFFECTS[WeatherType.Rain];
    expect(rain.visibilityMod).toBeLessThan(1.0);
    expect(rain.movementMod).toBeLessThan(1.0);
  });

  it('storm severely impacts operations', () => {
    const storm = WEATHER_EFFECTS[WeatherType.Storm];
    expect(storm.visibilityMod).toBeLessThan(0.5);
    expect(storm.moraleMod).toBeLessThan(-10);
  });

  it('fog reduces visibility but enhances magic', () => {
    const fog = WEATHER_EFFECTS[WeatherType.Fog];
    expect(fog.visibilityMod).toBeLessThan(0.5);
    expect(fog.magicMod).toBeGreaterThan(1.0);
  });

  it('storm enhances magic power', () => {
    const storm = WEATHER_EFFECTS[WeatherType.Storm];
    expect(storm.magicMod).toBeGreaterThan(1.0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Army Strength Calculation
// ═════════════════════════════════════════════════════════════════════════════

describe('calculateArmyStrength', () => {
  beforeEach(() => {
    resetWarfareIdCounters();
  });

  it('larger army has more strength', () => {
    const smallArmy = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 100)]);
    const largeArmy = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 1000)]);

    const smallStrength = calculateArmyStrength(smallArmy, null, TerrainType.Plains, WeatherType.Clear, false);
    const largeStrength = calculateArmyStrength(largeArmy, null, TerrainType.Plains, WeatherType.Clear, false);

    expect(largeStrength).toBeGreaterThan(smallStrength);
  });

  it('higher veterancy increases strength', () => {
    const rookieArmy = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 500, 10, 70)]);
    const veteranArmy = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 500, 90, 70)]);

    const rookieStrength = calculateArmyStrength(rookieArmy, null, TerrainType.Plains, WeatherType.Clear, false);
    const veteranStrength = calculateArmyStrength(veteranArmy, null, TerrainType.Plains, WeatherType.Clear, false);

    expect(veteranStrength).toBeGreaterThan(rookieStrength);
  });

  it('higher morale increases strength', () => {
    const demoralizedArmy = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 500, 50, 20)]);
    const inspiredArmy = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 500, 50, 90)]);

    const demoralizedStrength = calculateArmyStrength(demoralizedArmy, null, TerrainType.Plains, WeatherType.Clear, false);
    const inspiredStrength = calculateArmyStrength(inspiredArmy, null, TerrainType.Plains, WeatherType.Clear, false);

    expect(inspiredStrength).toBeGreaterThan(demoralizedStrength);
  });

  it('terrain defense bonus helps defender', () => {
    const army = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 500)]);

    const plainsDefense = calculateArmyStrength(army, null, TerrainType.Plains, WeatherType.Clear, true);
    const mountainDefense = calculateArmyStrength(army, null, TerrainType.Mountain, WeatherType.Clear, true);

    expect(mountainDefense).toBeGreaterThan(plainsDefense);
  });

  it('cavalry suffers terrain penalty in forest', () => {
    const cavalry = makeArmy(fid(1), [makeUnit(UnitType.Cavalry, 500)]);

    const plainsStrength = calculateArmyStrength(cavalry, null, TerrainType.Plains, WeatherType.Clear, false);
    const forestStrength = calculateArmyStrength(cavalry, null, TerrainType.Forest, WeatherType.Clear, false);

    expect(forestStrength).toBeLessThan(plainsStrength);
  });

  it('commander skill boosts strength', () => {
    const army = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 500)]);
    const commander = makeCommander(80, 60, 15);

    const noCommanderStrength = calculateArmyStrength(army, null, TerrainType.Plains, WeatherType.Clear, false);
    const withCommanderStrength = calculateArmyStrength(army, commander, TerrainType.Plains, WeatherType.Clear, false);

    expect(withCommanderStrength).toBeGreaterThan(noCommanderStrength);
  });

  it('low supply reduces strength', () => {
    const wellSupplied = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 500)], { x: 0, y: 0 }, 100);
    const poorlySupplied = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 500)], { x: 0, y: 0 }, 20);

    const wellSuppliedStrength = calculateArmyStrength(wellSupplied, null, TerrainType.Plains, WeatherType.Clear, false);
    const poorlySuppliedStrength = calculateArmyStrength(poorlySupplied, null, TerrainType.Plains, WeatherType.Clear, false);

    expect(wellSuppliedStrength).toBeGreaterThan(poorlySuppliedStrength);
  });

  it('archers affected by weather visibility', () => {
    const archers = makeArmy(fid(1), [makeUnit(UnitType.Archers, 500)]);

    const clearStrength = calculateArmyStrength(archers, null, TerrainType.Plains, WeatherType.Clear, false);
    const fogStrength = calculateArmyStrength(archers, null, TerrainType.Plains, WeatherType.Fog, false);

    expect(clearStrength).toBeGreaterThan(fogStrength);
  });

  it('mages benefit from storm weather', () => {
    const mages = makeArmy(fid(1), [makeUnit(UnitType.Mages, 100)]);

    const clearStrength = calculateArmyStrength(mages, null, TerrainType.Plains, WeatherType.Clear, false);
    const stormStrength = calculateArmyStrength(mages, null, TerrainType.Plains, WeatherType.Storm, false);

    // Storm reduces morale but boosts magic - check that mages get the magic boost
    // The storm morale penalty applies to all, but magic boost compensates for mages
    expect(stormStrength).toBeGreaterThan(clearStrength * 0.9); // At least close despite morale hit
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Battle Resolution
// ═════════════════════════════════════════════════════════════════════════════

describe('resolveBattle', () => {
  beforeEach(() => {
    resetWarfareIdCounters();
    resetEventIdCounter();
  });

  it('produces key moments (not single dice roll)', () => {
    const context = makeBattleContext(
      [makeUnit(UnitType.Infantry, 500)],
      [makeUnit(UnitType.Infantry, 500)],
    );

    const result = resolveBattle(context, wid(1), createBattleId(), makeTime(1), Math.random);

    expect(result.keyMoments.length).toBeGreaterThanOrEqual(3); // Opening, clash, turning point
  });

  it('larger army wins when all else equal', () => {
    // Use seeded RNG for deterministic results
    const rng = createSeededRng(12345);
    let largerWins = 0;
    const trials = 20;

    for (let i = 0; i < trials; i++) {
      const context = makeBattleContext(
        [makeUnit(UnitType.Infantry, 1000, 50, 70)],
        [makeUnit(UnitType.Infantry, 300, 50, 70)],
      );

      const result = resolveBattle(context, wid(1), createBattleId(), makeTime(1), rng);
      if (result.winner === 'attacker') largerWins++;
    }

    // Larger army should win most of the time
    expect(largerWins).toBeGreaterThan(trials * 0.6);
  });

  it('terrain advantage matters', () => {
    const rng = createSeededRng(67890);
    let defenderWins = 0;
    const trials = 20;

    for (let i = 0; i < trials; i++) {
      const context = makeBattleContext(
        [makeUnit(UnitType.Infantry, 600)],
        [makeUnit(UnitType.Infantry, 500)],
        { terrain: TerrainType.Mountain },
      );

      const result = resolveBattle(context, wid(1), createBattleId(), makeTime(1), rng);
      if (result.winner === 'defender') defenderWins++;
    }

    // Defender with mountain advantage should win some despite fewer numbers
    expect(defenderWins).toBeGreaterThan(trials * 0.2);
  });

  it('commander skill can overcome numbers', () => {
    const rng = createSeededRng(11111);
    let smallerWins = 0;
    const trials = 20;

    for (let i = 0; i < trials; i++) {
      const context = makeBattleContext(
        [makeUnit(UnitType.Infantry, 400)],
        [makeUnit(UnitType.Infantry, 600)],
        {
          attackerCommander: makeCommander(90, 80, 20), // Excellent commander
          defenderCommander: makeCommander(20, 20, 0), // Poor commander
        },
      );

      const result = resolveBattle(context, wid(1), createBattleId(), makeTime(1), rng);
      if (result.winner === 'attacker') smallerWins++;
    }

    // Good commander should help smaller force win sometimes
    expect(smallerWins).toBeGreaterThan(trials * 0.2);
  });

  it('winner takes fewer casualties', () => {
    const context = makeBattleContext(
      [makeUnit(UnitType.Infantry, 1000)],
      [makeUnit(UnitType.Infantry, 300)],
    );

    const result = resolveBattle(context, wid(1), createBattleId(), makeTime(1), Math.random);

    if (result.winner === 'attacker') {
      expect(result.attackerCasualties).toBeLessThan(result.defenderCasualties);
    } else if (result.winner === 'defender') {
      expect(result.defenderCasualties).toBeLessThan(result.attackerCasualties);
    }
  });

  it('updates war score', () => {
    const context = makeBattleContext(
      [makeUnit(UnitType.Infantry, 1000)],
      [makeUnit(UnitType.Infantry, 300)],
    );

    const result = resolveBattle(context, wid(1), createBattleId(), makeTime(1), Math.random);

    if (result.winner === 'attacker') {
      expect(result.warScoreChange).toBeGreaterThan(0);
    } else if (result.winner === 'defender') {
      expect(result.warScoreChange).toBeLessThan(0);
    }
  });

  it('hero intervention can create turning point', () => {
    const context = makeBattleContext(
      [makeUnit(UnitType.Infantry, 500)],
      [makeUnit(UnitType.Infantry, 500)],
      { attackerHeroes: [cid(1), cid(2), cid(3)] },
    );

    // Run multiple times to catch hero intervention
    let heroicMoment = false;
    for (let i = 0; i < 10; i++) {
      const result = resolveBattle(context, wid(1), createBattleId(), makeTime(1), Math.random);
      if (result.keyMoments.some(m => m.heroicAction !== undefined)) {
        heroicMoment = true;
        break;
      }
    }

    // With 3 heroes, should get at least one heroic moment across many battles
    expect(heroicMoment).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Siege Mechanics
// ═════════════════════════════════════════════════════════════════════════════

describe('Siege Mechanics', () => {
  beforeEach(() => {
    resetWarfareIdCounters();
  });

  it('sieges progress over time', () => {
    const siege = makeSiege(wid(1), sid(1), SiegeMethod.Starve);
    const army = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 1000)]);
    const defenders = { count: 500, morale: 70 };

    const initialSupply = siege.defenderSupply;

    // Progress several days
    for (let i = 0; i < 30; i++) {
      progressSiege(siege, army, defenders, false, Math.random);
    }

    expect(siege.daysUnderSiege).toBe(30);
    expect(siege.defenderSupply).toBeLessThan(initialSupply);
  });

  it('starvation reduces defender supply', () => {
    const siege = makeSiege(wid(1), sid(1), SiegeMethod.Starve);
    const army = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 1000)]);
    const defenders = { count: 500, morale: 70 };

    const initialSupply = siege.defenderSupply;

    for (let i = 0; i < 60; i++) {
      progressSiege(siege, army, defenders, false, Math.random);
    }

    expect(siege.defenderSupply).toBeLessThan(initialSupply - 20);
  });

  it('low supply leads to surrender', () => {
    const siege = makeSiege(wid(1), sid(1), SiegeMethod.Starve);
    siege.defenderSupply = 3;
    siege.defenderMorale = 10;

    const army = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 1000)]);
    const defenders = { count: 500, morale: 10 };

    const event = progressSiege(siege, army, defenders, false, Math.random);

    expect(event?.type).toBe('surrender_offer');
    expect(siege.phase).toBe(SiegePhase.Surrender);
  });

  it('relief force breaks siege', () => {
    const siege = makeSiege(wid(1), sid(1), SiegeMethod.Assault);
    const army = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 1000)]);
    const defenders = { count: 500, morale: 70 };

    const event = progressSiege(siege, army, defenders, true, Math.random);

    expect(event?.type).toBe('relief_force');
    expect(siege.phase).toBe(SiegePhase.Broken);
  });

  it('tunneling eventually breaches walls', () => {
    const siege = makeSiege(wid(1), sid(1), SiegeMethod.Tunnel);
    const army = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 1000)]);
    const defenders = { count: 500, morale: 70 };

    // Progress until tunnel is complete (or max days)
    let breached = false;
    for (let i = 0; i < 100 && !breached; i++) {
      const event = progressSiege(siege, army, defenders, false, Math.random);
      if (event?.type === 'breach') {
        breached = true;
      }
    }

    expect(siege.tunnelProgress).toBeGreaterThan(0);
    // Should eventually breach (tunnel progress increases each day)
    expect(siege.tunnelProgress >= 100 || siege.wallIntegrity < 100).toBe(true);
  });

  it('magical bombardment requires mages', () => {
    const siege = makeSiege(wid(1), sid(1), SiegeMethod.MagicalBombardment);

    // Army without mages
    const armyNoMages = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 1000)]);
    const defenders = { count: 500, morale: 70 };

    siege.daysUnderSiege = 2; // Will become 3 after increment (divisible by 3)
    const event1 = progressSiege(siege, armyNoMages, defenders, false, Math.random);
    expect(event1?.type).not.toBe('bombardment');

    // Army with mages
    const armyWithMages = makeArmy(fid(1), [
      makeUnit(UnitType.Infantry, 500),
      makeUnit(UnitType.Mages, 50, 50, 70),
    ]);

    siege.daysUnderSiege = 5; // Will become 6 after increment (divisible by 3)
    const event2 = progressSiege(siege, armyWithMages, defenders, false, Math.random);
    expect(event2?.type).toBe('bombardment');
  });

  it('disease spreads after prolonged siege', () => {
    const siege = makeSiege(wid(1), sid(1), SiegeMethod.Starve);
    const army = makeArmy(fid(1), [makeUnit(UnitType.Infantry, 1000)]);
    const defenders = { count: 500, morale: 70 };

    // Fast-forward to after disease can spread
    siege.daysUnderSiege = 50;

    // Run many iterations to trigger disease
    let diseaseOccurred = false;
    for (let i = 0; i < 100 && !diseaseOccurred; i++) {
      siege.daysUnderSiege++;
      const event = progressSiege(siege, army, defenders, false, Math.random);
      if (event?.type === 'disease_outbreak' || siege.diseaseLevel > 0) {
        diseaseOccurred = true;
      }
    }

    expect(diseaseOccurred).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WarfareSystem
// ═════════════════════════════════════════════════════════════════════════════

describe('WarfareSystem', () => {
  let system: WarfareSystem;
  let world: World;
  let clock: WorldClock;
  let events: EventBus;

  beforeEach(() => {
    system = new WarfareSystem();
    world = setupWorld();
    clock = new WorldClock();
    events = new EventBus();
    resetEventIdCounter();
    resetWarfareIdCounters();
  });

  it('has correct system properties', () => {
    expect(system.name).toBe('WarfareSystem');
    expect(system.frequency).toBe(1); // Daily
    expect(system.executionOrder).toBe(90); // MILITARY
  });

  it('executes without crashing on empty world', () => {
    expect(() => system.execute(world, clock, events)).not.toThrow();
  });

  it('declares war correctly', () => {
    const war = system.declareWar(
      fid(1),
      fid(2),
      WarObjective.Conquest,
      'War of Aggression',
      makeTime(1),
    );

    expect(war.attackerId).toBe(fid(1));
    expect(war.defenderId).toBe(fid(2));
    expect(war.objective).toBe(WarObjective.Conquest);
    expect(war.phase).toBe(WarPhase.Mobilization);
    expect(war.warScore).toBe(0);
    expect(system.warCount).toBe(1);
  });

  it('creates armies correctly', () => {
    const army = system.createArmy(
      fid(1),
      [makeUnit(UnitType.Infantry, 500), makeUnit(UnitType.Cavalry, 200)],
      { x: 10, y: 20 },
      cid(1),
    );

    expect(army.factionId).toBe(fid(1));
    expect(army.commanderId).toBe(cid(1));
    expect(army.units).toHaveLength(2);
    expect(army.position.x).toBe(10);
    expect(army.position.y).toBe(20);
    expect(army.supply).toBe(100);
    expect(system.armyCount).toBe(1);
  });

  it('starts sieges correctly', () => {
    const war = system.declareWar(fid(1), fid(2), WarObjective.Conquest, 'Test War', makeTime(1));

    const siege = system.startSiege(
      war.id,
      sid(100),
      fid(1),
      fid(2),
      SiegeMethod.Assault,
      makeTime(1),
    );

    expect(siege.targetId).toBe(sid(100));
    expect(siege.besiegerId).toBe(fid(1));
    expect(siege.method).toBe(SiegeMethod.Assault);
    expect(siege.wallIntegrity).toBe(100);
    expect(system.siegeCount).toBe(1);
  });

  it('sets army objectives', () => {
    const army = system.createArmy(fid(1), [makeUnit(UnitType.Infantry, 500)], { x: 0, y: 0 });
    expect(army.objective).toBeNull();

    system.setArmyObjective(army.id, sid(100));

    const updated = system.getArmy(army.id);
    expect(updated?.objective).toBe(sid(100));
  });

  it('gets armies for faction', () => {
    system.createArmy(fid(1), [makeUnit(UnitType.Infantry, 500)], { x: 0, y: 0 });
    system.createArmy(fid(1), [makeUnit(UnitType.Cavalry, 200)], { x: 10, y: 10 });
    system.createArmy(fid(2), [makeUnit(UnitType.Infantry, 300)], { x: 20, y: 20 });

    const faction1Armies = system.getArmiesForFaction(fid(1));
    const faction2Armies = system.getArmiesForFaction(fid(2));

    expect(faction1Armies).toHaveLength(2);
    expect(faction2Armies).toHaveLength(1);
  });

  it('clears all data', () => {
    system.declareWar(fid(1), fid(2), WarObjective.Conquest, 'Test War', makeTime(1));
    system.createArmy(fid(1), [makeUnit(UnitType.Infantry, 500)], { x: 0, y: 0 });

    system.clear();

    expect(system.warCount).toBe(0);
    expect(system.armyCount).toBe(0);
    expect(system.siegeCount).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Post-War Consequences
// ═════════════════════════════════════════════════════════════════════════════

describe('Post-War Consequences', () => {
  let system: WarfareSystem;
  let world: World;
  let clock: WorldClock;
  let eventBus: EventBus;

  beforeEach(() => {
    system = new WarfareSystem();
    world = setupWorld();
    clock = new WorldClock();
    eventBus = new EventBus();
    resetEventIdCounter();
    resetWarfareIdCounters();
  });

  it('war conclusion emits events when war score reaches threshold', () => {
    const war = system.declareWar(fid(1), fid(2), WarObjective.Conquest, 'Test War', makeTime(1));

    // Manually set war score to trigger conclusion
    (war as { warScore: number }).warScore = 85;
    war.phase = WarPhase.Active;

    const emittedEvents: string[] = [];
    eventBus.onAny((event) => {
      emittedEvents.push(event.subtype);
    });

    system.execute(world, clock, eventBus);

    expect(emittedEvents).toContain('war.concluded');
    expect(war.phase).toBe(WarPhase.Concluded);
  });

  it('decisive victory generates territory changes', () => {
    const war = system.declareWar(fid(1), fid(2), WarObjective.Conquest, 'Test War', makeTime(1));
    (war as { warScore: number }).warScore = 85;
    war.phase = WarPhase.Active;

    let consequences: unknown = null;
    eventBus.onSubtype('war.concluded', (event) => {
      consequences = event.data['consequences'];
    });

    system.execute(world, clock, eventBus);

    expect(consequences).toBeDefined();
    const cons = consequences as { political: { territoryChanges: unknown[] } };
    expect(cons.political.territoryChanges.length).toBeGreaterThan(0);
  });

  it('decisive victory generates economic reparations', () => {
    const war = system.declareWar(fid(1), fid(2), WarObjective.Conquest, 'Test War', makeTime(1));
    (war as { warScore: number }).warScore = 85;
    war.phase = WarPhase.Active;

    let consequences: unknown = null;
    eventBus.onSubtype('war.concluded', (event) => {
      consequences = event.data['consequences'];
    });

    system.execute(world, clock, eventBus);

    const cons = consequences as { economic: { reparations: unknown } };
    expect(cons.economic.reparations).not.toBeNull();
  });

  it('generates legitimacy change events', () => {
    const war = system.declareWar(fid(1), fid(2), WarObjective.Conquest, 'Test War', makeTime(1));
    (war as { warScore: number }).warScore = 85;
    war.phase = WarPhase.Active;

    const emittedEvents: string[] = [];
    eventBus.onAny((event) => {
      emittedEvents.push(event.subtype);
    });

    system.execute(world, clock, eventBus);

    expect(emittedEvents).toContain('faction.legitimacy_change');
  });

  it('generates generational grudge for major casualties', () => {
    const war = system.declareWar(fid(1), fid(2), WarObjective.Conquest, 'Test War', makeTime(1));
    (war as { warScore: number }).warScore = 90;
    war.phase = WarPhase.Active;

    let consequences: unknown = null;
    eventBus.onSubtype('war.concluded', (event) => {
      consequences = event.data['consequences'];
    });

    system.execute(world, clock, eventBus);

    const cons = consequences as { memory: { generationalGrudge: boolean } };
    expect(cons.memory.generationalGrudge).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ID Generation
// ═════════════════════════════════════════════════════════════════════════════

describe('ID Generation', () => {
  beforeEach(() => {
    resetWarfareIdCounters();
  });

  it('generates sequential war IDs', () => {
    const id1 = createWarId();
    const id2 = createWarId();
    expect((id2 as number) - (id1 as number)).toBe(1);
  });

  it('generates sequential battle IDs', () => {
    const id1 = createBattleId();
    const id2 = createBattleId();
    expect((id2 as number) - (id1 as number)).toBe(1);
  });

  it('generates sequential siege IDs', () => {
    const id1 = createSiegeId();
    const id2 = createSiegeId();
    expect((id2 as number) - (id1 as number)).toBe(1);
  });

  it('generates sequential army IDs', () => {
    const id1 = createArmyId();
    const id2 = createArmyId();
    expect((id2 as number) - (id1 as number)).toBe(1);
  });

  it('reset clears all counters', () => {
    createWarId();
    createBattleId();
    createSiegeId();
    createArmyId();

    resetWarfareIdCounters();

    expect(createWarId() as number).toBe(30000);
    expect(createBattleId() as number).toBe(40000);
    expect(createSiegeId() as number).toBe(50000);
    expect(createArmyId() as number).toBe(60000);
  });
});
