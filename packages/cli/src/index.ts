#!/usr/bin/env node
// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.
// The code runs correctly through tsx/node which has runtime module resolution.

/**
 * @fws/cli - Fantasy World Simulator (Æternum) CLI Entry Point
 *
 * Usage:
 *   pnpm run start           # Generate with random seed
 *   pnpm run start -- --seed 42  # Generate with specific seed
 */

// Re-export menus for library usage
export * from './menus/index.js';

// Core imports
import {
  World,
  WorldClock,
  EventBus,
  EventLog,
  CascadeEngine,
  SimulationEngine,
  SystemRegistry,
  EventCategory,
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
import type { WorldEvent } from '@fws/core';

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
} from '@fws/generator';
import type { WorldConfig } from '@fws/generator';

// ============================================================================
// CLI Entry Point
// ============================================================================

// Only run main() when executed directly (not when imported as a module)
const isMainModule = process.argv[1]?.endsWith('index.ts') ||
                     process.argv[1]?.endsWith('index.js') ||
                     process.argv[1]?.includes('@fws/cli');

if (isMainModule) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

/**
 * Parse command line arguments.
 */
function parseArgs(): { seed: number } {
  const args = process.argv.slice(2);
  let seed: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--seed' && i + 1 < args.length) {
      const nextArg = args[i + 1];
      if (nextArg !== undefined) {
        seed = parseInt(nextArg, 10);
        if (isNaN(seed)) {
          console.error(`Invalid seed value: ${nextArg}`);
          process.exit(1);
        }
      }
      i++;
    }
  }

  // Generate random seed if not provided
  if (seed === undefined) {
    seed = Math.floor(Math.random() * 2147483647);
  }

  return { seed };
}

/**
 * Create world configuration with standard_fantasy preset.
 */
function makeConfig(seed: number): WorldConfig {
  return {
    seed,
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
function generateWorld(seed: number) {
  const config = makeConfig(seed);
  const rng = new SeededRNG(seed);

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
    config,
    rng,
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
): SimulationEngine {
  const cascadeEngine = new CascadeEngine(eventBus, eventLog, {
    maxCascadeDepth: 10,
  });
  const systemRegistry = new SystemRegistry();

  // Support classes
  const reputationSystem = new ReputationSystem();
  const grudgeSystem = new GrudgeSystem();

  // Register the 9 main simulation systems
  systemRegistry.register(new CharacterAISystem());
  systemRegistry.register(new FactionPoliticalSystem(reputationSystem, grudgeSystem));
  systemRegistry.register(new EconomicSystem());
  systemRegistry.register(new WarfareSystem());
  systemRegistry.register(new MagicSystem());
  systemRegistry.register(new ReligionSystem());
  systemRegistry.register(new CulturalEvolutionSystem());
  systemRegistry.register(new EcologySystem());
  systemRegistry.register(new OralTraditionSystem());

  return new SimulationEngine(
    world,
    clock,
    eventBus,
    eventLog,
    systemRegistry,
    cascadeEngine
  );
}

/**
 * Print a fancy box with a message.
 */
function printBox(lines: string[]): void {
  const maxLen = Math.max(...lines.map(l => l.length));
  const width = maxLen + 4;
  const top = '╔' + '═'.repeat(width) + '╗';
  const bottom = '╚' + '═'.repeat(width) + '╝';

  console.log(top);
  for (const line of lines) {
    const padding = ' '.repeat(maxLen - line.length);
    console.log(`║  ${line}${padding}  ║`);
  }
  console.log(bottom);
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const { seed } = parseArgs();

  console.log('\n');
  printBox([
    'ÆTERNUM - Fantasy World Simulator',
    `Seed: ${seed}`,
  ]);
  console.log('\n');

  // Reset ID counters for deterministic behavior
  resetEntityIdCounter();

  // Generate the world
  console.log('Generating world...');
  const startGen = Date.now();
  const generatedData = generateWorld(seed);
  const genTime = Date.now() - startGen;
  console.log(`World generated in ${genTime}ms\n`);

  // Print world summary
  console.log('=== GENERATED WORLD ===');
  console.log(`Map: ${generatedData.worldMap.getWidth()}×${generatedData.worldMap.getHeight()}`);
  console.log(`Races: ${generatedData.races.length}`);
  console.log(`Gods: ${generatedData.pantheon.gods.length}`);
  console.log(`Factions: ${generatedData.factions.length}`);
  console.log(`Settlements: ${generatedData.settlements.length}`);
  console.log(`Rulers: ${generatedData.rulers.length}`);
  console.log(`Notables: ${generatedData.notables.length}`);
  console.log(`Tensions: ${generatedData.tensions.length}`);
  console.log(`Historical Figures: ${generatedData.preHistory.legendaryFigures.length}`);
  console.log(`Artifacts: ${generatedData.preHistory.artifacts.length}`);
  console.log(`Ruins: ${generatedData.preHistory.ruins.length}`);
  console.log('========================\n');

  // Create ECS world and populate it
  const ecsWorld = new World();
  const populationResult = populateWorldFromGenerated(ecsWorld, {
    worldMap: generatedData.worldMap,
    settlements: generatedData.settlements,
    factions: generatedData.factions,
    rulers: generatedData.rulers,
    notables: generatedData.notables,
  });

  console.log('=== ECS ENTITIES ===');
  console.log(`Settlements: ${populationResult.settlementIds.size}`);
  console.log(`Factions: ${populationResult.factionIds.size}`);
  console.log(`Characters: ${populationResult.characterIds.size}`);
  console.log(`Total: ${populationResult.totalEntities}`);
  console.log('====================\n');

  // Create simulation infrastructure
  const clock = new WorldClock();
  const eventBus = new EventBus();
  const eventLog = new EventLog();
  const engine = createSimulationEngine(ecsWorld, clock, eventBus, eventLog);

  // Run 10-tick verification
  const VERIFICATION_TICKS = 10;
  console.log(`Running ${VERIFICATION_TICKS}-tick verification...`);
  const startSim = Date.now();
  engine.run(VERIFICATION_TICKS);
  const simTime = Date.now() - startSim;
  console.log(`Simulation completed in ${simTime}ms\n`);

  // Collect and analyze events
  const allEvents: WorldEvent[] = eventLog.getAll();

  // Count events by category
  const categoryCount = new Map<string, number>();
  for (const event of allEvents) {
    const cat = event.category;
    categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
  }

  console.log('=== SIMULATION RESULTS ===');
  console.log(`Ticks executed: ${engine.getTickCount()}`);
  console.log(`Current tick: ${clock.currentTick}`);
  console.log(`World time: Year ${clock.currentTime.year}, Month ${clock.currentTime.month}, Day ${clock.currentTime.day}`);
  console.log(`Total events: ${allEvents.length}`);
  console.log('\nEvents by category:');
  const sortedCategories = [...categoryCount.entries()].sort((a, b) => b[1] - a[1]);
  for (const [category, count] of sortedCategories) {
    console.log(`  ${category}: ${count}`);
  }
  console.log('==========================\n');

  // Verification check
  if (allEvents.length === 0) {
    console.error('ERROR: Simulation produced zero events!');
    process.exit(1);
  }

  // Print Phase 4 placeholder
  console.log('\n');
  printBox([
    'Phase 4: Terminal UI (Pending)',
    '',
    'The interactive terminal interface will include:',
    '  - ASCII map view with zoom/pan',
    '  - Dual event streams (raw logs + prose)',
    '  - Entity inspector',
    '  - Relationship graph',
    '  - Timeline navigator',
    '  - Influence controls',
    '',
    'Coming soon...',
  ]);
  console.log('\n');

  console.log('Simulation ready. Exiting.');
  process.exit(0);
}
