import { describe, it, expect } from 'vitest';
import {
  SeededRNG, WorldMap, RaceGenerator, InitialPopulationPlacer,
  PantheonGenerator, MagicSystemGenerator, PreHistorySimulator,
  SettlementPlacer, FactionInitializer, CharacterGenerator, TensionSeeder,
  NameGenerator, getAllCultures, BiomeType,
} from '@fws/generator';
import type { WorldConfig } from '@fws/generator';
import type { GeneratedWorldState, RefinementAction } from './refinement-types.js';
import { RefinementMenu } from './refinement-menu.js';
import { RefinementValidator } from './refinement-validator.js';
import { RefinementApplier } from './refinement-applier.js';

/**
 * Helper: create a minimal world config.
 */
function makeConfig(overrides: Partial<WorldConfig> = {}): WorldConfig {
  return {
    seed: 12345,
    worldSize: 'small',
    magicPrevalence: 'moderate',
    civilizationDensity: 'normal',
    dangerLevel: 'moderate',
    historicalDepth: 'shallow',
    geologicalActivity: 'normal',
    raceDiversity: 'standard',
    pantheonComplexity: 'theistic',
    technologyEra: 'iron_age',
    ...overrides,
  };
}

/**
 * Helper: generate a full world state for refinement testing.
 */
function generateWorldState(seed: number): GeneratedWorldState {
  const config = makeConfig({ seed });
  const rng = new SeededRNG(seed);

  const worldMap = new WorldMap(config, rng);
  worldMap.generate();

  const pantheonGen = new PantheonGenerator();
  const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
  const magicGen = new MagicSystemGenerator();
  const magicRules = magicGen.generate(config.magicPrevalence, rng);

  const raceGen = new RaceGenerator();
  const races = raceGen.generate(config, pantheon, rng);
  const popPlacer = new InitialPopulationPlacer();
  const populationSeeds = popPlacer.place(worldMap, races, rng);

  const preSim = new PreHistorySimulator(
    { worldMap, races, populationSeeds, pantheon, magicRules },
    config, rng
  );
  const preHistory = preSim.run();

  const nameGen = new NameGenerator(getAllCultures());

  const raceDominance = new Map<string, string>();
  for (const pop of populationSeeds) {
    const key = `${Math.floor(pop.x / 50)},${Math.floor(pop.y / 50)}`;
    if (!raceDominance.has(key)) {
      raceDominance.set(key, pop.race.name);
    }
  }

  const settlementPlacer = new SettlementPlacer();
  const settlements = settlementPlacer.place(worldMap, preHistory, raceDominance, nameGen, config, rng);

  const facInit = new FactionInitializer();
  const factions = facInit.initialize(settlements, races, preHistory, nameGen, config, rng);

  const charGen = new CharacterGenerator(nameGen);
  const rulers = charGen.generateRulers(factions, settlements, rng);
  const notables = charGen.generateNotables(factions, settlements, config, rng);
  const characters = [...rulers, ...notables];

  const tensionSeeder = new TensionSeeder();
  const tensions = tensionSeeder.seed(factions, settlements, preHistory, rng);

  return { config, worldMap, settlements, factions, characters, tensions: [...tensions], preHistory };
}

// ── RefinementMenu ──────────────────────────────────────────────────────

describe('RefinementMenu', () => {
  it('produces a world summary with all sections', () => {
    const world = generateWorldState(42);
    const menu = new RefinementMenu();
    const summary = menu.summarize(world);

    expect(summary.sections.length).toBeGreaterThanOrEqual(5);
    expect(summary.totalSettlements).toBe(world.settlements.length);
    expect(summary.totalFactions).toBe(world.factions.length);
    expect(summary.totalCharacters).toBe(world.characters.length);
    expect(summary.totalTensions).toBe(world.tensions.length);
  });

  it('summary sections have headings and lines', () => {
    const world = generateWorldState(100);
    const menu = new RefinementMenu();
    const summary = menu.summarize(world);

    for (const section of summary.sections) {
      expect(section.heading.length).toBeGreaterThan(0);
      expect(section.lines.length).toBeGreaterThan(0);
    }
  });

  it('tracks queued actions', () => {
    const menu = new RefinementMenu();
    expect(menu.getActions().length).toBe(0);

    const action: RefinementAction = {
      kind: 'adjust_population',
      settlementIndex: 0,
      newPopulation: 5000,
    };
    menu.addAction(action);
    expect(menu.getActions().length).toBe(1);
    expect(menu.getActions()[0]).toBe(action);
  });

  it('supports undo', () => {
    const menu = new RefinementMenu();
    const action: RefinementAction = {
      kind: 'adjust_population',
      settlementIndex: 0,
      newPopulation: 5000,
    };
    menu.addAction(action);
    expect(menu.getActions().length).toBe(1);

    const removed = menu.undoLast();
    expect(removed).toBe(action);
    expect(menu.getActions().length).toBe(0);
  });

  it('logs actions including undos', () => {
    const menu = new RefinementMenu();
    const action: RefinementAction = {
      kind: 'adjust_population',
      settlementIndex: 0,
      newPopulation: 5000,
    };
    menu.addAction(action);
    menu.undoLast();

    const log = menu.getLog();
    expect(log.length).toBe(2);
    expect(log[1]!.description).toContain('UNDO');
  });

  it('describes all action kinds', () => {
    const menu = new RefinementMenu();

    const actions: RefinementAction[] = [
      { kind: 'move_settlement', settlementIndex: 0, newX: 10, newY: 20 },
      { kind: 'resize_territory', settlementIndex: 0, newFactionIndex: 1 },
      { kind: 'adjust_population', settlementIndex: 0, newPopulation: 5000 },
      { kind: 'create_character', name: 'Test Hero', raceName: 'Human', factionIndex: 0, statusType: 'noble', personalityOverrides: new Map() },
      { kind: 'remove_character', characterIndex: 0 },
      { kind: 'establish_alliance', factionAIndex: 0, factionBIndex: 1 },
      { kind: 'establish_conflict', factionAIndex: 0, factionBIndex: 1, severity: 'major' },
      { kind: 'place_landmark', x: 50, y: 50, name: 'Test Tower', description: 'A tall tower' },
      { kind: 'place_artifact', settlementIndex: 0, artifactName: 'Test Sword', artifactType: 'weapon', powerLevel: 5 },
      { kind: 'modify_biome', x: 10, y: 10, newBiome: BiomeType.Desert },
      { kind: 'seed_event', eventType: 'war', targetFactionIndex: 0, triggerDay: 30, description: 'A great war begins' },
    ];

    for (const action of actions) {
      const desc = menu.describeAction(action);
      expect(desc.length).toBeGreaterThan(0);
    }
  });
});

// ── RefinementValidator ─────────────────────────────────────────────────

describe('RefinementValidator', () => {
  const validator = new RefinementValidator();

  it('rejects settlement move to out-of-bounds coordinates', () => {
    const world = generateWorldState(42);
    const result = validator.validate({
      kind: 'move_settlement',
      settlementIndex: 0,
      newX: -1,
      newY: -1,
    }, world);
    expect(result.valid).toBe(false);
  });

  it('rejects settlement move to ocean', () => {
    const world = generateWorldState(42);
    // Find an ocean tile
    let oceanX = 0;
    let oceanY = 0;
    for (let y = 0; y < world.worldMap.getHeight(); y++) {
      for (let x = 0; x < world.worldMap.getWidth(); x++) {
        const tile = world.worldMap.getTile(x, y);
        if (tile !== undefined && tile.biome === BiomeType.Ocean) {
          oceanX = x;
          oceanY = y;
          break;
        }
      }
      if (oceanX !== 0 || oceanY !== 0) break;
    }

    if (oceanX !== 0 || oceanY !== 0) {
      const result = validator.validate({
        kind: 'move_settlement',
        settlementIndex: 0,
        newX: oceanX,
        newY: oceanY,
      }, world);
      expect(result.valid).toBe(false);
    }
  });

  it('accepts valid settlement move', () => {
    const world = generateWorldState(42);
    if (world.settlements.length === 0) return;

    // Use a known land tile (the settlement's own position)
    const s = world.settlements[0]!;
    const result = validator.validate({
      kind: 'move_settlement',
      settlementIndex: 0,
      newX: s.x,
      newY: s.y,
    }, world);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid settlement index', () => {
    const world = generateWorldState(42);
    const result = validator.validate({
      kind: 'adjust_population',
      settlementIndex: 9999,
      newPopulation: 1000,
    }, world);
    expect(result.valid).toBe(false);
  });

  it('rejects zero population', () => {
    const world = generateWorldState(42);
    if (world.settlements.length === 0) return;
    const result = validator.validate({
      kind: 'adjust_population',
      settlementIndex: 0,
      newPopulation: 0,
    }, world);
    expect(result.valid).toBe(false);
  });

  it('accepts valid population adjustment with warnings', () => {
    const world = generateWorldState(42);
    if (world.settlements.length === 0) return;
    const result = validator.validate({
      kind: 'adjust_population',
      settlementIndex: 0,
      newPopulation: 500000,
    }, world);
    expect(result.valid).toBe(true);
    // Should warn about exceeding typical bounds
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('rejects empty character name', () => {
    const world = generateWorldState(42);
    if (world.factions.length === 0) return;
    const result = validator.validate({
      kind: 'create_character',
      name: '',
      raceName: 'Human',
      factionIndex: 0,
      statusType: 'noble',
      personalityOverrides: new Map(),
    }, world);
    expect(result.valid).toBe(false);
  });

  it('rejects invalid faction index for character', () => {
    const world = generateWorldState(42);
    const result = validator.validate({
      kind: 'create_character',
      name: 'Test Hero',
      raceName: 'Human',
      factionIndex: 9999,
      statusType: 'noble',
      personalityOverrides: new Map(),
    }, world);
    expect(result.valid).toBe(false);
  });

  it('rejects self-alliance', () => {
    const world = generateWorldState(42);
    const result = validator.validate({
      kind: 'establish_alliance',
      factionAIndex: 0,
      factionBIndex: 0,
    }, world);
    expect(result.valid).toBe(false);
  });

  it('rejects self-conflict', () => {
    const world = generateWorldState(42);
    const result = validator.validate({
      kind: 'establish_conflict',
      factionAIndex: 0,
      factionBIndex: 0,
      severity: 'major',
    }, world);
    expect(result.valid).toBe(false);
  });

  it('accepts valid alliance', () => {
    const world = generateWorldState(42);
    if (world.factions.length < 2) return;
    const result = validator.validate({
      kind: 'establish_alliance',
      factionAIndex: 0,
      factionBIndex: 1,
    }, world);
    expect(result.valid).toBe(true);
  });

  it('rejects out-of-range artifact power', () => {
    const world = generateWorldState(42);
    if (world.settlements.length === 0) return;
    const result = validator.validate({
      kind: 'place_artifact',
      settlementIndex: 0,
      artifactName: 'Test',
      artifactType: 'weapon',
      powerLevel: 15,
    }, world);
    expect(result.valid).toBe(false);
  });

  it('rejects biome change on settlement tile to uninhabitable', () => {
    const world = generateWorldState(42);
    if (world.settlements.length === 0) return;
    const s = world.settlements[0]!;
    const result = validator.validate({
      kind: 'modify_biome',
      x: s.x,
      y: s.y,
      newBiome: BiomeType.DeepOcean,
    }, world);
    expect(result.valid).toBe(false);
  });

  it('accepts valid biome change', () => {
    const world = generateWorldState(42);
    // Find a tile with no settlement
    let freeX = 5;
    let freeY = 5;
    const occupiedSet = new Set(world.settlements.map(s => `${s.x},${s.y}`));
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        if (!occupiedSet.has(`${x},${y}`)) {
          const tile = world.worldMap.getTile(x, y);
          if (tile !== undefined) {
            freeX = x;
            freeY = y;
            break;
          }
        }
      }
    }

    const result = validator.validate({
      kind: 'modify_biome',
      x: freeX,
      y: freeY,
      newBiome: BiomeType.Forest,
    }, world);
    expect(result.valid).toBe(true);
  });

  it('rejects event with trigger day too far in future', () => {
    const world = generateWorldState(42);
    if (world.factions.length === 0) return;
    const result = validator.validate({
      kind: 'seed_event',
      eventType: 'war',
      targetFactionIndex: 0,
      triggerDay: 99999,
      description: 'A distant war',
    }, world);
    expect(result.valid).toBe(false);
  });

  it('rejects event with empty description', () => {
    const world = generateWorldState(42);
    if (world.factions.length === 0) return;
    const result = validator.validate({
      kind: 'seed_event',
      eventType: 'war',
      targetFactionIndex: 0,
      triggerDay: 30,
      description: '',
    }, world);
    expect(result.valid).toBe(false);
  });

  it('warns about removing a ruler', () => {
    const world = generateWorldState(42);
    const rulerIdx = world.characters.findIndex(c => c.status.type === 'ruler');
    if (rulerIdx < 0) return;
    const result = validator.validate({
      kind: 'remove_character',
      characterIndex: rulerIdx,
    }, world);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('ruler');
  });
});

// ── RefinementApplier ───────────────────────────────────────────────────

describe('RefinementApplier', () => {
  const applier = new RefinementApplier();

  it('applies valid population adjustment', () => {
    const world = generateWorldState(42);
    if (world.settlements.length === 0) return;

    const result = applier.apply(world, [{
      kind: 'adjust_population',
      settlementIndex: 0,
      newPopulation: 9999,
    }]);

    expect(result.appliedCount).toBe(1);
    expect(result.rejectedCount).toBe(0);
    expect(world.settlements[0]!.population).toBe(9999);
  });

  it('rejects invalid actions and counts them', () => {
    const world = generateWorldState(42);

    const result = applier.apply(world, [{
      kind: 'adjust_population',
      settlementIndex: 9999,
      newPopulation: 1000,
    }]);

    expect(result.appliedCount).toBe(0);
    expect(result.rejectedCount).toBe(1);
    expect(result.log[0]!.description).toContain('REJECTED');
  });

  it('applies territory resize', () => {
    const world = generateWorldState(42);
    if (world.factions.length < 2 || world.settlements.length < 2) return;

    // Find a non-capital settlement in faction 0
    const faction0 = world.factions[0]!;
    const nonCapitalIdx = faction0.settlementIndices.find(
      (i: number) => i !== faction0.capitalIndex
    );
    if (nonCapitalIdx === undefined) return;

    const result = applier.apply(world, [{
      kind: 'resize_territory',
      settlementIndex: nonCapitalIdx,
      newFactionIndex: 1,
    }]);

    expect(result.appliedCount).toBe(1);
    expect(world.settlements[nonCapitalIdx]!.factionIndex).toBe(1);
  });

  it('creates a character', () => {
    const world = generateWorldState(42);
    if (world.factions.length === 0) return;

    const charCount = world.characters.length;
    const faction = world.factions[0]!;

    const result = applier.apply(world, [{
      kind: 'create_character',
      name: 'Hero McHeroface',
      raceName: faction.primaryRace.name,
      factionIndex: 0,
      statusType: 'noble',
      personalityOverrides: new Map([['brave', 80], ['ambitious', 60]] as Array<[never, number]>),
    }]);

    expect(result.appliedCount).toBe(1);
    expect(world.characters.length).toBe(charCount + 1);
    const created = world.characters[world.characters.length - 1]!;
    expect(created.name).toBe('Hero McHeroface');
    expect(created.factionName).toBe(faction.name);
  });

  it('removes a character', () => {
    const world = generateWorldState(42);
    if (world.characters.length === 0) return;

    const charCount = world.characters.length;
    const result = applier.apply(world, [{
      kind: 'remove_character',
      characterIndex: charCount - 1,
    }]);

    expect(result.appliedCount).toBe(1);
    expect(world.characters.length).toBe(charCount - 1);
  });

  it('establishes conflict as tension', () => {
    const world = generateWorldState(42);
    if (world.factions.length < 2) return;

    const tensionCount = world.tensions.length;
    const result = applier.apply(world, [{
      kind: 'establish_conflict',
      factionAIndex: 0,
      factionBIndex: 1,
      severity: 'critical',
    }]);

    expect(result.appliedCount).toBe(1);
    expect(world.tensions.length).toBe(tensionCount + 1);
    const added = world.tensions[world.tensions.length - 1]!;
    expect(added.severity).toBe('critical');
    expect(added.escalationRisk).toBe(90);
  });

  it('places a landmark', () => {
    const world = generateWorldState(42);
    const result = applier.apply(world, [{
      kind: 'place_landmark',
      x: 50,
      y: 50,
      name: 'The Dark Tower',
      description: 'A sinister tower that appeared overnight',
    }]);

    expect(result.appliedCount).toBe(1);
    expect(result.landmarks.length).toBe(1);
    expect(result.landmarks[0]!.name).toBe('The Dark Tower');
  });

  it('places an artifact', () => {
    const world = generateWorldState(42);
    if (world.settlements.length === 0) return;

    const result = applier.apply(world, [{
      kind: 'place_artifact',
      settlementIndex: 0,
      artifactName: 'Excalibur',
      artifactType: 'weapon',
      powerLevel: 9,
    }]);

    expect(result.appliedCount).toBe(1);
    expect(result.addedArtifacts.length).toBe(1);
    expect(result.addedArtifacts[0]!.name).toBe('Excalibur');
    expect(result.addedArtifacts[0]!.powerLevel).toBe(9);
  });

  it('modifies biome of a tile', () => {
    const world = generateWorldState(42);

    // Find a land tile
    let tileX = 50;
    let tileY = 50;
    const tile = world.worldMap.getTile(tileX, tileY);
    if (tile === undefined) return;
    const oldBiome = tile.biome;

    const newBiome = oldBiome === BiomeType.Forest ? BiomeType.Plains : BiomeType.Forest;
    const result = applier.apply(world, [{
      kind: 'modify_biome',
      x: tileX,
      y: tileY,
      newBiome,
    }]);

    expect(result.appliedCount).toBe(1);
    const modified = world.worldMap.getTile(tileX, tileY);
    expect(modified?.biome).toBe(newBiome);
  });

  it('seeds an event', () => {
    const world = generateWorldState(42);
    if (world.factions.length === 0) return;

    const result = applier.apply(world, [{
      kind: 'seed_event',
      eventType: 'plague',
      targetFactionIndex: 0,
      triggerDay: 100,
      description: 'A terrible plague sweeps the land',
    }]);

    expect(result.appliedCount).toBe(1);
    expect(result.seededEvents.length).toBe(1);
    expect(result.seededEvents[0]!.eventType).toBe('plague');
    expect(result.seededEvents[0]!.triggerDay).toBe(100);
  });

  it('handles mixed valid and invalid actions', () => {
    const world = generateWorldState(42);
    if (world.settlements.length === 0) return;

    const result = applier.apply(world, [
      // Valid
      { kind: 'adjust_population', settlementIndex: 0, newPopulation: 5000 },
      // Invalid (out of bounds)
      { kind: 'adjust_population', settlementIndex: 9999, newPopulation: 5000 },
      // Valid
      { kind: 'place_landmark', x: 10, y: 10, name: 'Test', description: 'A test' },
    ]);

    expect(result.appliedCount).toBe(2);
    expect(result.rejectedCount).toBe(1);
    expect(result.log.length).toBe(3);
  });

  it('logs all actions with descriptions', () => {
    const world = generateWorldState(42);
    if (world.settlements.length === 0) return;

    const result = applier.apply(world, [{
      kind: 'adjust_population',
      settlementIndex: 0,
      newPopulation: 5000,
    }]);

    expect(result.log.length).toBe(1);
    expect(result.log[0]!.description).toContain('APPLIED');
  });
});
