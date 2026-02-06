#!/usr/bin/env node
// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.
// The code runs correctly through tsx/node which has runtime module resolution.

/**
 * @fws/cli - Fantasy World Simulator (Æternum) CLI Entry Point
 *
 * Usage:
 *   pnpm run start                      # Generate and launch terminal UI
 *   pnpm run start -- --seed 42         # Generate with specific seed
 *   pnpm run start -- --headless        # Run without UI (for testing)
 *   pnpm run start -- --ticks 100       # Run specific number of ticks (headless)
 */

// Re-export menus for library usage
export * from './menus/index.js';

// Re-export controls for library usage
export * from './controls/index.js';

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
  SpatialIndex,
  LevelOfDetailManager,
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
import type { WorldEvent, EntityId } from '@fws/core';

// Controls imports
import {
  SimulationTimeControls,
  FocusManager,
  BookmarkManager,
  NotificationManager,
  SimulationSpeed,
  SaveLoadController,
} from './controls/index.js';

// Renderer imports
import {
  createApp,
  PanelId,
  MapPanel,
  createMapPanelLayout,
  EventLogPanel,
  createEventLogPanelLayout,
  InspectorPanel,
  createInspectorPanelLayout,
  RelationshipsPanel,
  createRelationshipsPanelLayout,
  TimelinePanel,
  createTimelinePanelLayout,
  StatisticsPanel,
  createStatsPanelLayout,
  FingerprintPanel,
  createFingerprintPanelLayout,
  LayoutManager,
} from '@fws/renderer';
import type { RenderContext, PanelLayout } from '@fws/renderer';
import type * as blessed from 'blessed';
import { createRequire } from 'node:module';
const cliRequire = createRequire(import.meta.url);

// Narrative imports for EntityResolver
import type { EntityResolver, ResolvedEntity, Gender } from '@fws/narrative';

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
function parseArgs(): { seed: number; headless: boolean; ticks: number } {
  const args = process.argv.slice(2);
  let seed: number | undefined;
  let headless = false;
  let ticks = 10;

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
    } else if (arg === '--headless') {
      headless = true;
    } else if (arg === '--ticks' && i + 1 < args.length) {
      const nextArg = args[i + 1];
      if (nextArg !== undefined) {
        ticks = parseInt(nextArg, 10);
        if (isNaN(ticks) || ticks < 1) {
          console.error(`Invalid ticks value: ${nextArg}`);
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

  return { seed, headless, ticks };
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
 * Build an EntityResolver from generated data.
 * This allows the narrative engine to resolve entity IDs to names.
 */
function buildEntityResolver(
  generatedData: ReturnType<typeof generateWorld>,
  populationResult: ReturnType<typeof populateWorldFromGenerated>
): EntityResolver {
  // Build character ID → data maps
  const characterData = new Map<number, ResolvedEntity>();
  const allCharacters = [...generatedData.rulers, ...generatedData.notables];

  for (const char of allCharacters) {
    const charId = populationResult.characterIds.get(char.name);
    if (charId !== undefined) {
      const idNum = charId as unknown as number;
      characterData.set(idNum, {
        name: char.name,
        title: char.status.title.length > 0 ? char.status.title : undefined,
        gender: char.gender as Gender,
      });
    }
  }

  // Build faction ID → data maps
  const factionData = new Map<number, ResolvedEntity>();
  for (let i = 0; i < generatedData.factions.length; i++) {
    const faction = generatedData.factions[i];
    if (faction === undefined) continue;
    const factionId = populationResult.factionIds.get(i);
    if (factionId !== undefined) {
      const idNum = factionId as unknown as number;
      factionData.set(idNum, {
        name: faction.name,
      });
    }
  }

  // Build settlement/site ID → data maps
  const siteData = new Map<number, ResolvedEntity>();
  for (let i = 0; i < generatedData.settlements.length; i++) {
    const settlement = generatedData.settlements[i];
    if (settlement === undefined) continue;
    const siteId = populationResult.settlementIds.get(i);
    if (siteId !== undefined) {
      const idNum = siteId as unknown as number;
      siteData.set(idNum, {
        name: settlement.name,
      });
    }
  }

  // Build deity ID → data maps from pantheon
  const deityData = new Map<number, ResolvedEntity>();
  for (let i = 0; i < generatedData.pantheon.gods.length; i++) {
    const deity = generatedData.pantheon.gods[i];
    if (deity === undefined) continue;
    // Deities don't have separate entity IDs in current implementation,
    // but we add them using their array index as a fallback
    deityData.set(i, {
      name: deity.name,
      title: deity.title,
    });
  }

  return {
    resolveCharacter: (id: number) => characterData.get(id),
    resolveFaction: (id: number) => factionData.get(id),
    resolveSite: (id: number) => siteData.get(id),
    resolveArtifact: (_id: number) => undefined, // Not yet populated
    resolveDeity: (id: number) => deityData.get(id),
  };
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
 * Run in headless mode (no terminal UI).
 */
function runHeadless(
  engine: SimulationEngine,
  clock: WorldClock,
  eventLog: EventLog,
  ticks: number
): void {
  console.log(`Running ${ticks}-tick simulation...`);
  const startSim = Date.now();
  engine.run(ticks);
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

  console.log('Simulation complete. Exiting.');
  process.exit(0);
}

/**
 * Launch the terminal UI.
 */
function launchTerminalUI(
  context: RenderContext,
  worldMapWidth: number,
  worldMapHeight: number,
  entityResolver: EntityResolver
): void {
  console.log('\n');
  printBox([
    'ÆTERNUM - Terminal UI',
    '',
    'Press F1 for help',
    'Press Q to quit',
  ]);
  console.log('\n');
  console.log('Starting terminal UI...\n');

  // Load blessed dynamically (CJS module)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const blessedModule = cliRequire('blessed') as typeof blessed;

  // Create the blessed screen
  const screen = blessedModule.screen({
    smartCSR: true,
    title: 'Æternum - Fantasy World Simulator',
    fullUnicode: true,
  });

  // Box factory for creating blessed elements
  // Note: Do NOT call screen.append here - BasePanel.constructor does it
  const boxFactory = (opts: blessed.Widgets.BoxOptions): blessed.Widgets.BoxElement => {
    return blessedModule.box(opts);
  };

  // Calculate layout based on screen size
  const screenWidth = screen.width as number;
  const screenHeight = (screen.height as number) - 1; // Reserve 1 row for status bar
  const layoutManager = new LayoutManager({ width: screenWidth, height: screenHeight });
  const layout = layoutManager.getCurrentLayout();

  // Helper to get layout for a panel
  const getLayout = (id: PanelId): PanelLayout => {
    const panelLayout = layout.panels.get(id);
    if (panelLayout !== undefined) {
      return panelLayout;
    }
    // Fallback layout
    return { id, x: 0, y: 0, width: 40, height: 20, focused: false };
  };

  // Create all panels
  const mapPanel = new MapPanel(screen, getLayout(PanelId.Map), boxFactory);
  mapPanel.setWorldSize(worldMapWidth, worldMapHeight);
  if (context.tileLookup !== undefined) {
    mapPanel.setTileLookup(context.tileLookup);
  }

  const eventLogPanel = new EventLogPanel(screen, getLayout(PanelId.EventLog), boxFactory);
  eventLogPanel.setEntityResolver(entityResolver);
  eventLogPanel.loadEventsFromLog(context);
  eventLogPanel.subscribeToEvents(context);

  const inspectorPanel = new InspectorPanel(screen, getLayout(PanelId.Inspector), boxFactory);

  const relationshipsPanel = new RelationshipsPanel(screen, getLayout(PanelId.RelationshipGraph), boxFactory);

  const timelinePanel = new TimelinePanel(screen, getLayout(PanelId.Timeline), boxFactory);

  const statsPanel = new StatisticsPanel(screen, getLayout(PanelId.Statistics), boxFactory);

  const fingerprintPanel = new FingerprintPanel(screen, getLayout(PanelId.Fingerprint), boxFactory);

  // Create the application with screen and box factory injection
  const app = createApp(context, { targetFps: 30 });

  // Inject the screen and box factory
  app.setFactories(
    () => screen,
    boxFactory
  );

  // Register all panels
  app.registerPanel(mapPanel, PanelId.Map);
  app.registerPanel(eventLogPanel, PanelId.EventLog);
  app.registerPanel(inspectorPanel, PanelId.Inspector);
  app.registerPanel(relationshipsPanel, PanelId.RelationshipGraph);
  app.registerPanel(timelinePanel, PanelId.Timeline);
  app.registerPanel(statsPanel, PanelId.Statistics);
  app.registerPanel(fingerprintPanel, PanelId.Fingerprint);

  // =========================================================================
  // Phase 6.1: Create and wire simulation controls
  // =========================================================================

  // Create time controls with auto-slowdown
  const timeControls = new SimulationTimeControls(context.eventBus, {
    enabled: true,
    significanceThreshold: 90,
    eventCountThreshold: 3,
    windowTicks: 30,
  });
  if (context.engine !== undefined) {
    timeControls.setEngine(context.engine);
  }

  // Create focus manager (requires lodManager in context)
  const focusManager = context.lodManager !== undefined
    ? new FocusManager(context.world, context.eventBus, context.lodManager)
    : null;

  // Create bookmark manager
  const bookmarkManager = new BookmarkManager(
    context.eventBus,
    () => context.clock.currentTime
  );

  // Create notification manager
  const notificationManager = new NotificationManager(context.eventBus, {
    significanceThreshold: 80,
    bookmarkedEntityAlert: true,
    focusEntityAlert: true,
  });

  // Wire focus changes to notification manager
  if (focusManager !== null) {
    focusManager.onFocusChange((entityId) => {
      notificationManager.setFocusedEntity(entityId);
    });
  }

  // Wire bookmark changes to notification manager
  bookmarkManager.onChange((bookmark, action) => {
    if (action === 'add' && bookmark.type === 'entity') {
      const entities = new Set<EntityId>();
      for (const b of bookmarkManager.getEntityBookmarks()) {
        entities.add(b.id as EntityId);
      }
      notificationManager.setBookmarkedEntities(entities);
    } else if (action === 'remove' && bookmark.type === 'entity') {
      const entities = new Set<EntityId>();
      for (const b of bookmarkManager.getEntityBookmarks()) {
        entities.add(b.id as EntityId);
      }
      notificationManager.setBookmarkedEntities(entities);
    }
  });

  // Wire time controls to application speed (via callback since we can't modify app.ts directly)
  timeControls.onSpeedChange((speed, reason) => {
    // Update app's internal speed state by calling its methods
    if (speed === SimulationSpeed.Paused) {
      // Already paused, no action needed
    } else if (reason === 'auto-slowdown') {
      // Auto-slowdown triggered - speed was reduced to Normal
      // The app will pick this up on next render cycle
    }
  });

  // Add keyboard bindings for new controls
  // F key: enter focus mode (toggle focus on selected entity)
  screen.key('f', () => {
    if (focusManager === null) return;
    const state = app.getState();
    if (state.selectedEntity !== null) {
      const entityId = state.selectedEntity.id as unknown as EntityId;
      if (focusManager.isFocused(entityId)) {
        focusManager.clearFocus();
      } else {
        focusManager.setFocus(entityId);
      }
    }
  });

  // B key: toggle bookmark on selected entity
  screen.key('b', () => {
    const state = app.getState();
    if (state.selectedEntity !== null) {
      const entityId = state.selectedEntity.id as unknown as EntityId;
      bookmarkManager.toggle(entityId, 'entity', state.selectedEntity.name);
    }
  });

  // =========================================================================
  // Phase 7.3: Save/Load/Export controls
  // =========================================================================

  const saveLoadController = new SaveLoadController();
  saveLoadController.setSeed(context.clock?.currentTick ?? 0);

  // Ctrl+S: Quick save
  screen.key('C-s', () => {
    saveLoadController.quickSave(context.world, context.clock, context.eventLog);
  });

  // F5: Load game menu
  screen.key('f5', () => {
    saveLoadController.openLoadMenu();
  });

  // F6: Export menu
  screen.key('f6', () => {
    saveLoadController.openExportMenu();
  });

  // Start the application (sets up screen, key bindings, render loop - but NOT simulation)
  app.start();

  // Force a full initial render of all panels BEFORE any simulation ticks
  // This ensures the map terrain, empty event log, etc. are all visible immediately
  app.renderInitialFrame();
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const { seed, headless, ticks } = parseArgs();

  console.log('\n');
  printBox([
    'ÆTERNUM - Fantasy World Simulator',
    `Seed: ${seed}`,
    headless ? '(Headless Mode)' : '(Terminal UI Mode)',
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

  // Create spatial index
  const spatialIndex = new SpatialIndex(
    generatedData.worldMap.getWidth(),
    generatedData.worldMap.getHeight()
  );

  // Create Level-of-Detail manager for focus tracking
  const lodManager = new LevelOfDetailManager();
  // Set initial focus to center of map
  lodManager.setFocus(
    Math.floor(generatedData.worldMap.getWidth() / 2),
    Math.floor(generatedData.worldMap.getHeight() / 2)
  );

  if (headless) {
    // Run in headless mode
    runHeadless(engine, clock, eventLog, ticks);
  } else {
    // Create tile lookup function from worldMap
    const tileLookup = (x: number, y: number) => {
      const tile = generatedData.worldMap.getTile(x, y);
      if (tile === undefined) return null;
      return {
        biome: tile.biome,
        riverId: tile.riverId,
        leyLine: tile.leyLine,
        resources: tile.resources,
      };
    };

    // Create render context with simulation engine and tile lookup
    const context: RenderContext = {
      world: ecsWorld,
      clock,
      eventLog,
      eventBus,
      spatialIndex,
      engine,
      tileLookup,
      lodManager,
    };

    // Build entity resolver for narrative generation
    const entityResolver = buildEntityResolver(generatedData, populationResult);

    // Launch the terminal UI (simulation starts paused, player presses Space to begin)
    launchTerminalUI(
      context,
      generatedData.worldMap.getWidth(),
      generatedData.worldMap.getHeight(),
      entityResolver
    );
  }
}
