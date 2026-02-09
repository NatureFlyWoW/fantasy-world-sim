// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * SimulationRunner — manages world generation and tick loop in the main process.
 *
 * Mirrors the CLI's main() flow but sends delta updates via IPC instead of
 * rendering to a terminal.
 */
import {
  World,
  WorldClock,
  EventBus,
  EventLog,
  CascadeEngine,
  SimulationEngine,
  SystemRegistry,
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
  DreamingSystem,
  CharacterMemoryStore,
} from '@fws/core';
import type { WorldEvent, EntityId, CharacterId, SiteId } from '@fws/core';

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

import type {
  TickDelta,
  WorldSnapshot,
  SerializedEvent,
  EntitySnapshot,
  FactionSnapshot,
  TileSnapshot,
} from '../shared/types.js';

type TickDeltaCallback = (delta: TickDelta) => void;

export class SimulationRunner {
  private readonly seed: number;

  // Simulation state
  private world: World | null = null;
  private clock: WorldClock | null = null;
  private eventBus: EventBus | null = null;
  private eventLog: EventLog | null = null;
  private engine: SimulationEngine | null = null;
  private spatialIndex: SpatialIndex | null = null;
  private lodManager: LevelOfDetailManager | null = null;

  // Generated data
  private worldMap: WorldMap | null = null;
  private generatedFactions: Array<{ name: string; color: string; capitalIndex: number }> = [];
  private populationResult: { settlementIds: Map<number, SiteId>; factionIds: Map<number, unknown>; characterIds: Map<string, CharacterId>; totalEntities: number } | null = null;

  // Tick loop
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private ticksPerSecond = 1;
  private paused = true;
  private tickDeltaCallbacks: TickDeltaCallback[] = [];

  // Track last event count for deltas
  private lastEventCount = 0;

  constructor(seed: number) {
    this.seed = seed;
  }

  initialize(): void {
    resetEntityIdCounter();

    const config = this.makeConfig();
    const rng = new SeededRNG(this.seed);

    // Generation pipeline (mirrors CLI)
    const worldMap = new WorldMap(config, rng);
    worldMap.generate();
    this.worldMap = worldMap;

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
      config,
      rng,
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

    const factionInit = new FactionInitializer();
    const factions = factionInit.initialize(settlements, races, preHistory, nameGen, config, rng);

    const charGen = new CharacterGenerator(nameGen);
    const rulers = charGen.generateRulers(factions, settlements, rng);
    const notables = charGen.generateNotables(factions, settlements, config, rng);

    const tensionSeeder = new TensionSeeder();
    tensionSeeder.seed(factions, settlements, preHistory, rng);

    // ECS setup
    this.world = new World();
    this.populationResult = populateWorldFromGenerated(this.world, {
      worldMap,
      settlements,
      factions,
      rulers,
      notables,
    }) as typeof this.populationResult;

    this.generatedFactions = factions.map(f => ({
      name: f.name,
      color: f.color,
      capitalIndex: f.capitalIndex,
    }));

    // Simulation infrastructure
    this.clock = new WorldClock();
    this.eventBus = new EventBus();
    this.eventLog = new EventLog();

    const cascadeEngine = new CascadeEngine(this.eventBus, this.eventLog, { maxCascadeDepth: 10 });
    const systemRegistry = new SystemRegistry();

    const reputationSystem = new ReputationSystem();
    const grudgeSystem = new GrudgeSystem();
    const dreamingSystem = new DreamingSystem(undefined, this.seed);

    systemRegistry.register(new CharacterAISystem());
    systemRegistry.register(new FactionPoliticalSystem(reputationSystem, grudgeSystem));
    systemRegistry.register(new EconomicSystem());
    systemRegistry.register(new WarfareSystem());
    systemRegistry.register(new MagicSystem());
    systemRegistry.register(new ReligionSystem());
    systemRegistry.register(new CulturalEvolutionSystem());
    systemRegistry.register(new EcologySystem());
    systemRegistry.register(new OralTraditionSystem());
    systemRegistry.register(dreamingSystem);

    this.engine = new SimulationEngine(
      this.world, this.clock, this.eventBus, this.eventLog,
      systemRegistry, cascadeEngine,
    );

    // Initialize DreamingSystem
    if (this.populationResult !== null) {
      const settlementNameToId = new Map<string, SiteId>();
      for (let si = 0; si < settlements.length; si++) {
        const settlement = settlements[si];
        const siteId = this.populationResult.settlementIds.get(si);
        if (settlement !== undefined && siteId !== undefined) {
          settlementNameToId.set(settlement.name, siteId);
        }
      }

      const allChars = [...rulers, ...notables];
      for (const [charName, charId] of this.populationResult.characterIds) {
        const store = new CharacterMemoryStore(charId);
        dreamingSystem.registerMemoryStore(charId, store);

        const charData = allChars.find(c => c.name === charName);
        if (charData !== undefined) {
          dreamingSystem.registerGoalCount(charId, charData.goals.length);

          if (charData.position.settlementName !== undefined) {
            const siteId = settlementNameToId.get(charData.position.settlementName);
            if (siteId !== undefined) {
              dreamingSystem.registerCharacterLocation(charId, siteId);
            }
          }
        }
      }
    }

    this.spatialIndex = new SpatialIndex(worldMap.getWidth(), worldMap.getHeight());
    this.lodManager = new LevelOfDetailManager();
    this.lodManager.setFocus(
      Math.floor(worldMap.getWidth() / 2),
      Math.floor(worldMap.getHeight() / 2),
    );

    console.log(`[main] World initialized: ${worldMap.getWidth()}x${worldMap.getHeight()}, ${this.populationResult?.totalEntities ?? 0} entities`);
  }

  warmup(ticks: number): void {
    if (this.engine === null) return;
    this.engine.run(ticks);
    this.lastEventCount = this.eventLog?.getAll().length ?? 0;
    console.log(`[main] Warmup complete: ${this.lastEventCount} events from ${ticks} ticks`);
  }

  // ── Snapshot ───────────────────────────────────────────────────────────────

  getSnapshot(): WorldSnapshot {
    if (this.worldMap === null || this.eventLog === null || this.populationResult === null) {
      throw new Error('Simulation not initialized');
    }

    const width = this.worldMap.getWidth();
    const height = this.worldMap.getHeight();

    // Serialize terrain tiles
    const tiles: TileSnapshot[][] = [];
    for (let y = 0; y < height; y++) {
      const row: TileSnapshot[] = [];
      for (let x = 0; x < width; x++) {
        const tile = this.worldMap.getTile(x, y);
        if (tile !== undefined) {
          row.push({
            biome: tile.biome,
            elevation: tile.elevation,
            temperature: tile.temperature,
            rainfall: tile.rainfall,
            ...(tile.riverId !== undefined ? { riverId: tile.riverId } : {}),
            ...(tile.leyLine === true ? { leyLine: true } : {}),
            ...(tile.resources !== undefined && tile.resources.length > 0
              ? { resources: tile.resources }
              : {}),
          });
        } else {
          row.push({ biome: 'ocean', elevation: 0, temperature: 0, rainfall: 0 });
        }
      }
      tiles.push(row);
    }

    // Serialize entities (settlements and characters with positions)
    const entities: EntitySnapshot[] = [];
    if (this.world !== null && this.world.hasStore('Position')) {
      for (const [eid] of this.world.getStore('Position').getAll()) {
        const pos = this.world.getComponent(eid, 'Position') as { x: number; y: number } | undefined;
        if (pos === undefined) continue;

        let name = `Entity #${eid}`;
        let type = 'unknown';
        let factionId: number | undefined;

        if (this.world.hasStore('Population')) {
          const pop = this.world.getComponent(eid, 'Population');
          if (pop !== undefined) type = 'settlement';
        }

        if (this.world.hasStore('Status')) {
          const status = this.world.getComponent(eid, 'Status') as { titles?: string[] } | undefined;
          if (status?.titles !== undefined && status.titles.length > 0 && status.titles[0] !== undefined) {
            name = status.titles[0];
          }
        }

        if (this.world.hasStore('Allegiance')) {
          const allegiance = this.world.getComponent(eid, 'Allegiance') as { factionId?: unknown } | undefined;
          if (allegiance?.factionId !== undefined) {
            factionId = allegiance.factionId as number;
          }
        }

        entities.push({
          id: eid as unknown as number,
          type,
          name,
          x: pos.x,
          y: pos.y,
          ...(factionId !== undefined ? { factionId } : {}),
        });
      }
    }

    // Serialize factions
    const factions: FactionSnapshot[] = [];
    for (let fi = 0; fi < this.generatedFactions.length; fi++) {
      const faction = this.generatedFactions[fi];
      const factionId = this.populationResult.factionIds.get(fi);
      if (faction === undefined || factionId === undefined) continue;

      const capitalSiteId = this.populationResult.settlementIds.get(faction.capitalIndex);

      factions.push({
        id: factionId as unknown as number,
        name: faction.name,
        color: faction.color,
        ...(capitalSiteId !== undefined ? { capitalId: capitalSiteId as unknown as number } : {}),
      });
    }

    return {
      mapWidth: width,
      mapHeight: height,
      tiles,
      entities,
      events: this.serializeEvents(this.eventLog.getAll()),
      factions,
    };
  }

  // ── Tick control ───────────────────────────────────────────────────────────

  setSpeed(ticksPerSecond: number): void {
    this.ticksPerSecond = ticksPerSecond;
    this.restartTickLoop();
  }

  pause(): void {
    this.paused = true;
    this.clearTickLoop();
  }

  resume(): void {
    this.paused = false;
    this.restartTickLoop();
  }

  step(ticks: number): void {
    if (this.engine === null || this.eventLog === null || this.clock === null) return;
    this.engine.run(ticks);
    this.emitTickDelta();
  }

  stop(): void {
    this.clearTickLoop();
  }

  onTickDelta(callback: TickDeltaCallback): void {
    this.tickDeltaCallbacks.push(callback);
  }

  getTickCount(): number {
    return this.engine?.getTickCount() ?? 0;
  }

  getEntityCount(): number {
    return this.populationResult?.totalEntities ?? 0;
  }

  getEventCount(): number {
    return this.eventLog?.getAll().length ?? 0;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private makeConfig(): WorldConfig {
    return {
      seed: this.seed,
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

  private restartTickLoop(): void {
    this.clearTickLoop();
    if (this.paused || this.ticksPerSecond <= 0) return;

    const interval = Math.max(16, Math.floor(1000 / this.ticksPerSecond));
    this.tickInterval = setInterval(() => {
      if (this.engine !== null) {
        this.engine.run(1);
        this.emitTickDelta();
      }
    }, interval);
  }

  private clearTickLoop(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private emitTickDelta(): void {
    if (this.eventLog === null || this.clock === null) return;

    const allEvents = this.eventLog.getAll();
    const newEvents = allEvents.slice(this.lastEventCount);
    this.lastEventCount = allEvents.length;

    const delta: TickDelta = {
      tick: this.clock.currentTick,
      time: {
        year: this.clock.currentTime.year,
        month: this.clock.currentTime.month,
        day: this.clock.currentTime.day,
      },
      events: this.serializeEvents(newEvents),
      changedEntities: [],
      removedEntities: [],
    };

    for (const cb of this.tickDeltaCallbacks) {
      cb(delta);
    }
  }

  private serializeEvents(events: readonly WorldEvent[]): SerializedEvent[] {
    return events.map(e => ({
      id: e.id as unknown as number,
      tick: e.timestamp as unknown as number,
      category: e.category,
      subtype: e.subtype,
      significance: e.significance,
      participants: e.participants.map(p => p as unknown as number),
      data: e.data as Record<string, unknown>,
    }));
  }
}
