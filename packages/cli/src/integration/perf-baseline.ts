// @ts-nocheck
// Note: This file uses @ts-nocheck because it imports from @fws/core and @fws/narrative
// which require building declaration files for TypeScript project references.
// The script runs correctly through tsx which has its own module resolution.

/**
 * Performance Baseline Script
 *
 * Generates a Small world with seed 42, runs 365 ticks (1 simulation year),
 * and reports timing and memory metrics for Phase 6 baseline comparison.
 */

import { performance } from 'perf_hooks';

// Core imports
import {
  World,
  WorldClock,
  EventBus,
  EventLog,
  CascadeEngine,
  SimulationEngine,
  SystemRegistry,
  resetEntityIdCounter,
  CharacterAISystem,
  ReputationSystem,
  GrudgeSystem,
  FactionPoliticalSystem,
  EconomicSystem,
  WarfareSystem,
  MagicSystem,
  ReligionSystem,
  CulturalEvolutionSystem,
  EcologySystem,
  OralTraditionSystem,
} from '@fws/core';

// Generator imports
import {
  SeededRNG,
  WorldMap,
  PantheonGenerator,
  MagicSystemGenerator,
  RaceGenerator,
  InitialPopulationPlacer,
  SettlementPlacer,
  FactionInitializer,
  CharacterGenerator,
  TensionSeeder,
  NameGenerator,
  getAllCultures,
  PreHistorySimulator,
  populateWorldFromGenerated,
  initializeSystemsFromGenerated,
} from '@fws/generator';
import type {
  WorldConfig,
  ExtendedGeneratedWorldData,
  InitializableSystems,
} from '@fws/generator';

// Test configuration
const SEED = 42;
const TICKS = 365;

/**
 * Create standard_fantasy Small world config.
 */
function makeConfig(): WorldConfig {
  return {
    seed: SEED,
    worldSize: 'small',
    magicPrevalence: 'moderate',
    civilizationDensity: 'normal',
    dangerLevel: 'moderate',
    historicalDepth: 'shallow',
    geologicalActivity: 'normal',
    raceDiversity: 'standard',
    pantheonComplexity: 'theistic',
    technologyEra: 'iron_age',
  };
}

/**
 * Run the full world generation pipeline.
 */
function generateWorld(rng: SeededRNG, config: WorldConfig) {
  // Terrain
  const worldMap = new WorldMap(config, rng);
  worldMap.generate();

  // Cosmology
  const pantheonGen = new PantheonGenerator();
  const pantheon = pantheonGen.generate(config.pantheonComplexity, rng);
  const magicGen = new MagicSystemGenerator();
  const magicRules = magicGen.generate(config.magicPrevalence, rng);

  // Races & population
  const raceGen = new RaceGenerator();
  const races = raceGen.generate(config, pantheon, rng);
  const popPlacer = new InitialPopulationPlacer();
  const populationSeeds = popPlacer.place(worldMap, races, rng);

  // Pre-history
  const preSim = new PreHistorySimulator(
    { worldMap, races, populationSeeds, pantheon, magicRules },
    config,
    rng
  );
  const preHistory = preSim.run();

  // Name generator
  const nameGen = new NameGenerator(getAllCultures());

  // Race dominance map
  const raceDominance = new Map<string, string>();
  for (const pop of populationSeeds) {
    const key = `${Math.floor(pop.x / 50)},${Math.floor(pop.y / 50)}`;
    if (!raceDominance.has(key)) {
      raceDominance.set(key, pop.race.name);
    }
  }

  // Settlements
  const settlementPlacer = new SettlementPlacer();
  const settlements = settlementPlacer.place(
    worldMap,
    preHistory,
    raceDominance,
    nameGen,
    config,
    rng
  );

  // Factions
  const factionInit = new FactionInitializer();
  const factions = factionInit.initialize(
    settlements,
    races,
    preHistory,
    nameGen,
    config,
    rng
  );

  // Characters
  const charGen = new CharacterGenerator(nameGen);
  const rulers = charGen.generateRulers(factions, settlements, rng);
  const notables = charGen.generateNotables(factions, settlements, config, rng);

  // Tensions
  const tensionSeeder = new TensionSeeder();
  const tensions = tensionSeeder.seed(factions, settlements, preHistory, rng);

  return {
    worldMap,
    pantheon,
    magicRules,
    races,
    populationSeeds,
    preHistory,
    nameGen,
    settlements,
    factions,
    rulers,
    notables,
    tensions,
  };
}

/**
 * Create simulation engine with all systems registered.
 */
function createSimulationEngine(
  world: World,
  clock: WorldClock,
  eventBus: EventBus,
  eventLog: EventLog
): { engine: SimulationEngine; systems: InitializableSystems } {
  const cascadeEngine = new CascadeEngine(eventBus, eventLog, {
    maxCascadeDepth: 10,
  });
  const systemRegistry = new SystemRegistry();

  // Support classes
  const reputationSystem = new ReputationSystem();
  const grudgeSystem = new GrudgeSystem();

  // Create systems for initialization
  const magicSystem = new MagicSystem();
  const warfareSystem = new WarfareSystem();
  const culturalSystem = new CulturalEvolutionSystem();
  const ecologySystem = new EcologySystem();

  // Register the 9 main simulation systems
  systemRegistry.register(new CharacterAISystem());
  systemRegistry.register(new FactionPoliticalSystem(reputationSystem, grudgeSystem));
  systemRegistry.register(new EconomicSystem());
  systemRegistry.register(warfareSystem);
  systemRegistry.register(magicSystem);
  systemRegistry.register(new ReligionSystem());
  systemRegistry.register(culturalSystem);
  systemRegistry.register(ecologySystem);
  systemRegistry.register(new OralTraditionSystem());

  const engine = new SimulationEngine(
    world,
    clock,
    eventBus,
    eventLog,
    systemRegistry,
    cascadeEngine
  );

  return {
    engine,
    systems: {
      magicSystem,
      warfareSystem,
      culturalSystem,
      ecologySystem,
    },
  };
}

/**
 * Main performance baseline measurement.
 */
async function measureBaseline() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ÆTERNUM Performance Baseline');
  console.log('  Small world, seed 42, 365 ticks (1 simulation year)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Reset ID counters for deterministic behavior
  resetEntityIdCounter();

  const config = makeConfig();
  const rng = new SeededRNG(SEED);

  // === WORLD GENERATION ===
  console.log('Phase 1: World Generation...');
  const genStart = performance.now();
  const generatedData = generateWorld(rng, config);
  const genTime = performance.now() - genStart;
  console.log(`  ✓ World generated in ${genTime.toFixed(0)}ms`);
  console.log(`    - Map: ${generatedData.worldMap.getWidth()}×${generatedData.worldMap.getHeight()}`);
  console.log(`    - Factions: ${generatedData.factions.length}`);
  console.log(`    - Settlements: ${generatedData.settlements.length}`);
  console.log(`    - Characters: ${generatedData.rulers.length + generatedData.notables.length}`);

  // === ECS POPULATION ===
  console.log('\nPhase 2: ECS Population...');
  const ecsStart = performance.now();
  const ecsWorld = new World();
  const populationResult = populateWorldFromGenerated(ecsWorld, {
    worldMap: generatedData.worldMap,
    settlements: generatedData.settlements,
    factions: generatedData.factions,
    rulers: generatedData.rulers,
    notables: generatedData.notables,
  });
  const ecsTime = performance.now() - ecsStart;
  console.log(`  ✓ ECS populated in ${ecsTime.toFixed(0)}ms`);
  console.log(`    - Total entities: ${populationResult.totalEntities}`);

  // === SIMULATION SETUP ===
  console.log('\nPhase 3: Simulation Setup...');
  const setupStart = performance.now();
  const clock = new WorldClock();
  const eventBus = new EventBus();
  const eventLog = new EventLog();
  const { engine, systems } = createSimulationEngine(ecsWorld, clock, eventBus, eventLog);

  // Initialize systems from generated data
  const extendedData: ExtendedGeneratedWorldData = {
    worldMap: generatedData.worldMap,
    settlements: generatedData.settlements,
    factions: generatedData.factions,
    rulers: generatedData.rulers,
    notables: generatedData.notables,
    preHistory: generatedData.preHistory,
    tensions: generatedData.tensions,
  };

  const initResult = initializeSystemsFromGenerated(
    systems,
    extendedData,
    populationResult,
    eventBus,
    clock
  );
  const setupTime = performance.now() - setupStart;
  console.log(`  ✓ Systems initialized in ${setupTime.toFixed(0)}ms`);
  console.log(`    - Regions: ${initResult.regionsRegistered}`);
  console.log(`    - Languages: ${initResult.languagesCreated}`);
  console.log(`    - Wars: ${initResult.warsStarted}`);

  // === SIMULATION RUN ===
  console.log(`\nPhase 4: Running ${TICKS} ticks...`);
  const simStart = performance.now();

  // Run in batches and report progress
  const batchSize = 73; // ~5 batches for 365 ticks
  for (let i = 0; i < TICKS; i += batchSize) {
    const ticksToRun = Math.min(batchSize, TICKS - i);
    engine.run(ticksToRun);
    const progress = Math.min(100, Math.round(((i + ticksToRun) / TICKS) * 100));
    process.stdout.write(`\r  Progress: ${progress}% (tick ${i + ticksToRun}/${TICKS})`);
  }

  const simTime = performance.now() - simStart;
  const perTickAvg = simTime / TICKS;
  console.log(`\n  ✓ Simulation complete`);

  // === COLLECT METRICS ===
  const allEvents = eventLog.getAll();
  const categoryCount = new Map<string, number>();
  for (const event of allEvents) {
    const count = categoryCount.get(event.category) ?? 0;
    categoryCount.set(event.category, count + 1);
  }

  // Memory usage
  if (global.gc) {
    global.gc(); // Force GC if available
  }
  const mem = process.memoryUsage();
  const heapMB = mem.heapUsed / 1024 / 1024;
  const rssMB = mem.rss / 1024 / 1024;

  // === REPORT ===
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  BASELINE RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Generation Time:    ${genTime.toFixed(0)}ms`);
  console.log(`  ECS Population:     ${ecsTime.toFixed(0)}ms`);
  console.log(`  System Setup:       ${setupTime.toFixed(0)}ms`);
  console.log(`  Simulation Time:    ${simTime.toFixed(0)}ms`);
  console.log(`  Per-tick Average:   ${perTickAvg.toFixed(2)}ms`);
  console.log(`  Simulated Speed:    ${(365 / (simTime / 1000)).toFixed(0)}x real-time`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  Heap Used:          ${heapMB.toFixed(1)}MB`);
  console.log(`  RSS:                ${rssMB.toFixed(1)}MB`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  Total Events:       ${allEvents.length}`);
  console.log(`  Event Categories:   ${categoryCount.size}`);
  for (const [category, count] of Array.from(categoryCount.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${category}: ${count}`);
  }
  console.log('═══════════════════════════════════════════════════════════════');

  // Single-line summary for CLAUDE.md
  console.log('\n📋 CLAUDE.md entry:');
  console.log(`Pre-Phase 6 performance baseline (Small world, 365 ticks, seed 42):`);
  console.log(`Generation: ${genTime.toFixed(0)}ms, Simulation: ${simTime.toFixed(0)}ms, Per-tick: ${perTickAvg.toFixed(2)}ms, Memory: ${heapMB.toFixed(0)}MB heap / ${rssMB.toFixed(0)}MB RSS, Events: ${allEvents.length}`);
}

measureBaseline().catch((err) => {
  console.error('Performance baseline failed:', err);
  process.exit(1);
});
