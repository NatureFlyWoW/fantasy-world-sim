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
  EventLogPanel,
  InspectorPanel,
  RelationshipsPanel,
  TimelinePanel,
  StatisticsPanel,
  FingerprintPanel,
  RegionDetailPanel,
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
 * Build an EntityResolver from generated data with World-based fallback.
 * The static maps capture initial entities. The World fallback resolves
 * entities created at runtime (armies, institutions, artifacts, etc.)
 * by reading their Status/Attribute/Territory components.
 */
function buildEntityResolver(
  generatedData: ReturnType<typeof generateWorld>,
  populationResult: ReturnType<typeof populateWorldFromGenerated>,
  world: World
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
    deityData.set(i, {
      name: deity.name,
      title: deity.title,
    });
  }

  /**
   * World-based fallback: resolve any entity ID by reading ECS components.
   * Tries Status.titles for name, then detects type from Attribute/Territory.
   */
  function resolveFromWorld(id: number): ResolvedEntity | undefined {
    const entityId = id as unknown as EntityId;
    // Try Status component for a name
    if (world.hasStore('Status')) {
      const status = world.getComponent(entityId, 'Status');
      if (status !== undefined) {
        const titles = (status as { titles?: string[] }).titles;
        if (titles !== undefined && titles.length > 0 && titles[0] !== undefined) {
          return { name: titles[0] };
        }
      }
    }
    return undefined;
  }

  return {
    resolveCharacter: (id: number) => characterData.get(id) ?? resolveFromWorld(id),
    resolveFaction: (id: number) => factionData.get(id) ?? resolveFromWorld(id),
    resolveSite: (id: number) => siteData.get(id) ?? resolveFromWorld(id),
    resolveArtifact: (id: number) => resolveFromWorld(id),
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
  entityResolver: EntityResolver,
  welcomeData: { seed: number; factionCount: number; characterCount: number; settlementCount: number; tensions: string[]; worldSize: string }
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
    mouse: true,
  });

  // Force blessed's internal dimensions to match reality.
  // On MINGW64/Windows (especially mintty), blessed detects 1x1 because
  // Program reads `output.columns || 1` and MSYS2 PTY doesn't expose
  // columns/rows to Node's Windows TTY layer. The 1x1 rendering buffer
  // causes black areas and offset content.
  //
  // Dimension detection strategy:
  //   1. process.stdout.columns/rows (works in ConPTY / real TTYs)
  //   2. PowerShell $Host.UI.RawUI.WindowSize (Windows, needs stdin fd)
  //   3. `mode con` for columns (Windows, lines is scroll buffer)
  //   4. `tput` (Unix/MSYS2 — returns defaults with piped stdio)
  //   5. Hardcoded 120x40
  {
    const { execSync } = cliRequire('node:child_process') as typeof import('node:child_process');
    const isValid = (v: number | undefined): v is number =>
      typeof v === 'number' && v > 1;

    let cols: number | undefined = isValid(process.stdout.columns) ? process.stdout.columns : undefined;
    let rows: number | undefined = isValid(process.stdout.rows) ? process.stdout.rows : undefined;

    // PowerShell — most reliable on Windows, gets actual visible window size
    if (cols === undefined || rows === undefined) {
      try {
        const psCmd = 'powershell.exe -NoProfile -NonInteractive -Command "$s=$Host.UI.RawUI.WindowSize;Write-Host $s.Width $s.Height"';
        const result = execSync(psCmd, { encoding: 'utf8', timeout: 2000, stdio: [0, 'pipe', 'pipe'] }).trim();
        const parts = result.split(/\s+/);
        if (parts.length >= 2) {
          const c = parseInt(parts[0] ?? '', 10);
          const r = parseInt(parts[1] ?? '', 10);
          if (!isNaN(c) && c > 1) cols = cols ?? c;
          if (!isNaN(r) && r > 1) rows = rows ?? r;
        }
      } catch {
        // PowerShell not available or timed out
      }
    }

    // mode con for columns (lines is scroll buffer, not useful)
    if (cols === undefined) {
      try {
        const modeResult = execSync('mode con', { encoding: 'utf8', timeout: 500, stdio: ['pipe', 'pipe', 'pipe'] });
        const colMatch = modeResult.match(/(?:Columns|Spalten)[:\s]+?(\d+)/i);
        if (colMatch !== null) {
          const c = parseInt(colMatch[1] ?? '', 10);
          if (!isNaN(c) && c > 1) cols = c;
        }
      } catch {
        // mode con not available
      }
    }

    cols = cols ?? 120;
    rows = rows ?? 40;

    const prog = screen.program as { cols?: number; rows?: number };
    prog.cols = cols;
    prog.rows = rows;

    if (typeof (screen as unknown as { realloc?: () => void }).realloc === 'function') {
      (screen as unknown as { realloc: () => void }).realloc();
    }
  }

  // Box factory for creating blessed elements
  // Note: Do NOT call screen.append here - BasePanel.constructor does it
  const boxFactory = (opts: blessed.Widgets.BoxOptions): blessed.Widgets.BoxElement => {
    return blessedModule.box(opts);
  };

  // Create the application FIRST so we use its single LayoutManager for
  // panel construction.  This eliminates the previous double-LayoutManager
  // race condition: the CLI used to create its own LayoutManager (with a
  // status-bar height subtraction that the LayoutManager already handles
  // internally), resulting in panels created with incorrect dimensions.
  // Now panels are created with the Application's default layout (120x40)
  // and app.start() -> renderInitialFrame() -> applyLayout() will resize
  // them to match the actual screen size.
  const app = createApp(context, { targetFps: 30 });

  // Inject the screen and box factory
  app.setFactories(
    () => screen,
    boxFactory
  );

  // Use the Application's LayoutManager to get initial panel layouts.
  // Set 'narrative' as the default layout (4-quadrant: Map + Region left, Events + Inspector right).
  // These will use the default 120x40 dimensions; app.start() will later
  // resize them to actual screen size via applyLayout().
  const appLayoutManager = app.getLayoutManager();
  appLayoutManager.setLayout('narrative');
  const layout = appLayoutManager.getCurrentLayout();

  // Helper to get layout for a panel
  const getLayout = (id: PanelId): PanelLayout => {
    const panelLayout = layout.panels.get(id);
    if (panelLayout !== undefined) {
      return panelLayout;
    }
    // Fallback layout
    return { id, x: 0, y: 0, width: 40, height: 20, focused: false };
  };

  // Create all panels using the Application's LayoutManager
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

  // Set welcome data for pre-simulation welcome screen
  inspectorPanel.setWelcomeData(welcomeData);

  const relationshipsPanel = new RelationshipsPanel(screen, getLayout(PanelId.RelationshipGraph), boxFactory);

  const timelinePanel = new TimelinePanel(screen, getLayout(PanelId.Timeline), boxFactory);

  const statsPanel = new StatisticsPanel(screen, getLayout(PanelId.Statistics), boxFactory);

  const fingerprintPanel = new FingerprintPanel(screen, getLayout(PanelId.Fingerprint), boxFactory);

  const regionDetailPanel = new RegionDetailPanel(screen, getLayout(PanelId.RegionDetail), boxFactory);

  // Register all panels
  app.registerPanel(mapPanel, PanelId.Map);
  app.registerPanel(eventLogPanel, PanelId.EventLog);
  app.registerPanel(inspectorPanel, PanelId.Inspector);
  app.registerPanel(relationshipsPanel, PanelId.RelationshipGraph);
  app.registerPanel(timelinePanel, PanelId.Timeline);
  app.registerPanel(statsPanel, PanelId.Statistics);
  app.registerPanel(fingerprintPanel, PanelId.Fingerprint);
  app.registerPanel(regionDetailPanel, PanelId.RegionDetail);

  // Wire map cursor movement to region detail panel
  mapPanel.setSelectionHandler((entity, x, y) => {
    // Update region detail with tile data at cursor position
    const tile = context.tileLookup !== undefined ? context.tileLookup(x, y) : null;

    // Build overlay data: controlling faction and nearby settlements
    let overlay = undefined;
    try {
      const nearbySettlements = [];
      let controllingFaction = undefined;

      if (ecsWorld.hasStore('Position') && ecsWorld.hasStore('Population')) {
        for (const [eid] of ecsWorld.getStore('Position').getAll()) {
          const pop = ecsWorld.getComponent(eid, 'Population');
          if (pop === undefined) continue; // Not a settlement

          const pos = ecsWorld.getComponent(eid, 'Position');
          if (pos === undefined) continue;
          const px = (pos as { x: number }).x;
          const py = (pos as { y: number }).y;
          const dist = Math.abs(px - x) + Math.abs(py - y);
          if (dist > 15) continue;

          // Get settlement name
          let sName = `Settlement #${eid}`;
          const resolved = entityResolver.resolveSite(eid as unknown as number);
          if (resolved !== undefined) sName = resolved.name;

          nearbySettlements.push({ name: sName, distance: dist });

          // If settlement is ON this tile, find its faction
          if (dist === 0 && controllingFaction === undefined) {
            // Check if this settlement belongs to a faction via Allegiance component
            if (ecsWorld.hasStore('Allegiance')) {
              const allegiance = ecsWorld.getComponent(eid, 'Allegiance');
              if (allegiance !== undefined) {
                const fId = (allegiance as { factionId?: unknown }).factionId;
                if (fId !== undefined) {
                  const fResolved = entityResolver.resolveFaction(fId as number);
                  if (fResolved !== undefined) controllingFaction = fResolved.name;
                }
              }
            }
          }
        }
      }

      nearbySettlements.sort((a, b) => a.distance - b.distance);
      if (nearbySettlements.length > 0 || controllingFaction !== undefined) {
        overlay = {
          controllingFaction,
          nearbySettlements: nearbySettlements.slice(0, 4),
        };
      }
    } catch {
      // Overlay is optional; silently ignore errors
    }

    regionDetailPanel.updateLocation(x, y, tile, undefined, overlay);

    // Update entity selection for inspector
    if (entity !== null && entity.name !== undefined) {
      app.setSelectedEntity({
        id: 0,
        type: entity.type,
        name: entity.name,
      });
    }

    // Also update the inspector panel with the region data
    if (tile !== null) {
      inspectorPanel.inspectRegion(x, y, tile, context);
    }
  });

  // =========================================================================
  // Wire click-to-inspect handlers between panels
  // =========================================================================

  // EventLogPanel -> InspectorPanel: clicking entity names opens the entity inspector
  eventLogPanel.setInspectEntityHandler((entityId) => {
    inspectorPanel.inspect(entityId, context);
  });

  // EventLogPanel -> InspectorPanel: pressing Enter on selected event opens event inspector
  eventLogPanel.setInspectEventHandler((eventId) => {
    inspectorPanel.inspectEvent(eventId, context);
  });

  // InspectorPanel -> InspectorPanel: clicking entity names within the inspector navigates
  inspectorPanel.setInspectHandler((entityId) => {
    inspectorPanel.inspect(entityId, context);
  });

  // RelationshipsPanel -> InspectorPanel: clicking entity names opens entity inspector
  relationshipsPanel.setInspectHandler((entityId) => {
    inspectorPanel.inspect(entityId, context);
  });

  // TimelinePanel -> InspectorPanel: clicking events opens event inspector
  timelinePanel.setInspectHandler((eventId) => {
    inspectorPanel.inspectEvent(eventId, context);
  });

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
        elevation: tile.elevation,
        temperature: tile.temperature,
        rainfall: tile.rainfall,
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

    // Build entity resolver for narrative generation (with World fallback for runtime entities)
    const entityResolver = buildEntityResolver(generatedData, populationResult, ecsWorld);

    // Auto-run 30 ticks to populate events before displaying the welcome screen.
    // This gives the narrative engine real events to work with.
    const WARMUP_TICKS = 30;
    console.log(`Running ${WARMUP_TICKS}-tick warmup...`);
    engine.run(WARMUP_TICKS);
    console.log(`Warmup complete: ${eventLog.getAll().length} events generated\n`);

    // Build welcome data from the now-populated event log
    const recentEvents = eventLog.getAll();
    const tensionEvents = recentEvents
      .filter(e => (e.category === EventCategory.Political || e.category === EventCategory.Military) && e.significance >= 50)
      .slice(-5);
    const tensionDescriptions = tensionEvents.map(e => {
      const data = e.data as Record<string, unknown>;
      if (typeof data['description'] === 'string') return data['description'];
      return e.subtype.split('.').slice(1).join(' ').replace(/_/g, ' ');
    });

    const welcomeData = {
      seed,
      factionCount: generatedData.factions.length,
      characterCount: generatedData.rulers.length + generatedData.notables.length,
      settlementCount: generatedData.settlements.length,
      tensions: tensionDescriptions.length > 0
        ? tensionDescriptions
        : generatedData.tensions.slice(0, 5).map(t => t.description),
      worldSize: generatedData.config.worldSize,
    };

    // Launch the terminal UI (simulation starts paused, player presses Space to begin)
    launchTerminalUI(
      context,
      generatedData.worldMap.getWidth(),
      generatedData.worldMap.getHeight(),
      entityResolver,
      welcomeData
    );
  }
}
