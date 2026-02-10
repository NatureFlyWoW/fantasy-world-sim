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
  SimulationEngine,
  SpatialIndex,
  LevelOfDetailManager,
  resetEntityIdCounter,
  createSimulationEngine,
} from '@fws/core';
import type { WorldEvent, EntityId, CharacterId, SiteId, CharacterInitData } from '@fws/core';

import {
  generateWorld,
  populateWorldFromGenerated,
} from '@fws/generator';
import type { GeneratedWorld } from '@fws/generator';

import type {
  TickDelta,
  WorldSnapshot,
  SerializedEvent,
  EntitySnapshot,
  EntityType,
  PopulationTier,
  FactionSnapshot,
  TileSnapshot,
} from '../shared/types.js';

type TickDeltaCallback = (delta: TickDelta) => void;

function classifyPopulation(count: number): PopulationTier {
  if (count >= 2000) return 'city';
  if (count >= 500) return 'town';
  if (count >= 100) return 'village';
  return 'hamlet';
}

function computeDirection(dx: number, dy: number): EntitySnapshot['movementDirection'] {
  if (dx === 0 && dy === 0) return 'stationary';
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle >= -22.5 && angle < 22.5) return 'E';
  if (angle >= 22.5 && angle < 67.5) return 'SE';
  if (angle >= 67.5 && angle < 112.5) return 'S';
  if (angle >= 112.5 && angle < 157.5) return 'SW';
  if (angle >= 157.5 || angle < -157.5) return 'W';
  if (angle >= -157.5 && angle < -112.5) return 'NW';
  if (angle >= -112.5 && angle < -67.5) return 'N';
  return 'NE';
}

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
  private generatedData: GeneratedWorld | null = null;
  private populationResult: { settlementIds: Map<number, SiteId>; factionIds: Map<number, unknown>; characterIds: Map<string, CharacterId>; totalEntities: number } | null = null;

  // Tick loop
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private ticksPerSecond = 1;
  private paused = true;
  private tickDeltaCallbacks: TickDeltaCallback[] = [];

  // Track last event count for deltas
  private lastEventCount = 0;

  // Entity change tracking
  private previousEntityState = new Map<number, EntitySnapshot>();
  private capitalIds = new Set<number>();

  constructor(seed: number) {
    this.seed = seed;
  }

  initialize(): void {
    resetEntityIdCounter();

    // Generate world using factory
    this.generatedData = generateWorld(this.seed);

    // ECS setup
    this.world = new World();
    this.populationResult = populateWorldFromGenerated(this.world, {
      worldMap: this.generatedData.worldMap,
      settlements: this.generatedData.settlements,
      factions: this.generatedData.factions,
      rulers: this.generatedData.rulers,
      notables: this.generatedData.notables,
    }) as typeof this.populationResult;

    // Simulation infrastructure
    this.clock = new WorldClock();
    this.eventBus = new EventBus();
    this.eventLog = new EventLog();

    // Build character initialization data for DreamingSystem
    const settlementNameToId = new Map<string, SiteId>();
    for (let si = 0; si < this.generatedData.settlements.length; si++) {
      const settlement = this.generatedData.settlements[si];
      const siteId = this.populationResult.settlementIds.get(si);
      if (settlement !== undefined && siteId !== undefined) {
        settlementNameToId.set(settlement.name, siteId);
      }
    }

    const allChars = [...this.generatedData.rulers, ...this.generatedData.notables];
    const characterInitData: CharacterInitData[] = [];
    for (const [charName, charId] of this.populationResult.characterIds) {
      const charData = allChars.find(c => c.name === charName);
      if (charData !== undefined) {
        const locationSiteId = charData.position.settlementName !== undefined
          ? settlementNameToId.get(charData.position.settlementName)
          : undefined;

        characterInitData.push({
          id: charId,
          goalCount: charData.goals.length,
          ...(locationSiteId !== undefined ? { locationSiteId } : {}),
        });
      }
    }

    // Create simulation engine with all systems registered (warmup handled by warmup() method)
    const { engine } = createSimulationEngine(
      this.world,
      this.clock,
      this.eventBus,
      this.eventLog,
      this.seed,
      characterInitData,
      0 // No warmup here - called explicitly via warmup() method
    );
    this.engine = engine;

    this.spatialIndex = new SpatialIndex(
      this.generatedData.worldMap.getWidth(),
      this.generatedData.worldMap.getHeight()
    );
    this.lodManager = new LevelOfDetailManager();
    this.lodManager.setFocus(
      Math.floor(this.generatedData.worldMap.getWidth() / 2),
      Math.floor(this.generatedData.worldMap.getHeight() / 2),
    );

    console.log(`[main] World initialized: ${this.generatedData.worldMap.getWidth()}x${this.generatedData.worldMap.getHeight()}, ${this.populationResult?.totalEntities ?? 0} entities`);
  }

  warmup(ticks: number): void {
    if (this.engine === null) return;
    this.engine.run(ticks);
    this.lastEventCount = this.eventLog?.getAll().length ?? 0;
    console.log(`[main] Warmup complete: ${this.lastEventCount} events from ${ticks} ticks`);
  }

  // ── Snapshot ───────────────────────────────────────────────────────────────

  getSnapshot(): WorldSnapshot {
    if (this.generatedData === null || this.eventLog === null || this.populationResult === null) {
      throw new Error('Simulation not initialized');
    }

    const width = this.generatedData.worldMap.getWidth();
    const height = this.generatedData.worldMap.getHeight();

    // Serialize terrain tiles
    const tiles: TileSnapshot[][] = [];
    for (let y = 0; y < height; y++) {
      const row: TileSnapshot[] = [];
      for (let x = 0; x < width; x++) {
        const tile = this.generatedData.worldMap.getTile(x, y);
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

    // Serialize factions (before entities so capitalIds is populated)
    const factions: FactionSnapshot[] = [];
    this.capitalIds.clear();
    for (let fi = 0; fi < this.generatedData.factions.length; fi++) {
      const faction = this.generatedData.factions[fi];
      const factionId = this.populationResult.factionIds.get(fi);
      if (faction === undefined || factionId === undefined) continue;

      const capitalSiteId = this.populationResult.settlementIds.get(faction.capitalIndex);
      if (capitalSiteId !== undefined) {
        this.capitalIds.add(capitalSiteId as unknown as number);
      }

      factions.push({
        id: factionId as unknown as number,
        name: faction.name,
        color: faction.color,
        ...(capitalSiteId !== undefined ? { capitalId: capitalSiteId as unknown as number } : {}),
      });
    }

    const entities = this.buildEntitySnapshots();

    return {
      mapWidth: width,
      mapHeight: height,
      seed: this.seed,
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

  getWorld(): World | null { return this.world; }
  getEventLog(): EventLog | null { return this.eventLog; }
  getClock(): WorldClock | null { return this.clock; }

  getTickCount(): number {
    return this.engine?.getTickCount() ?? 0;
  }

  getEntityCount(): number {
    return this.populationResult?.totalEntities ?? 0;
  }

  getEventCount(): number {
    return this.eventLog?.getAll().length ?? 0;
  }

  // ── Entity snapshot building ─────────────────────────────────────────────

  private buildEntitySnapshots(): EntitySnapshot[] {
    const entities: EntitySnapshot[] = [];
    if (this.world === null || !this.world.hasStore('Position')) return entities;

    for (const [eid] of this.world.getStore('Position').getAll()) {
      const pos = this.world.getComponent(eid, 'Position') as { x: number; y: number } | undefined;
      if (pos === undefined) continue;

      const numId = eid as unknown as number;
      let name = `Entity #${numId}`;
      let type: EntityType = 'unknown';
      let factionId: number | undefined;
      let populationCount: number | undefined;
      let populationTier: PopulationTier | undefined;
      let militaryStrength: number | undefined;
      let wealth: number | undefined;
      let structures: string[] | undefined;
      let isCapital: boolean | undefined;

      // Name from Status
      if (this.world.hasStore('Status')) {
        const status = this.world.getComponent(eid, 'Status') as { titles?: string[] } | undefined;
        if (status?.titles !== undefined && status.titles.length > 0 && status.titles[0] !== undefined) {
          name = status.titles[0];
        }
      }

      // Faction allegiance
      if (this.world.hasStore('Allegiance')) {
        const allegiance = this.world.getComponent(eid, 'Allegiance') as { factionId?: unknown } | undefined;
        if (allegiance?.factionId !== undefined) {
          factionId = allegiance.factionId as number;
        }
      }

      // Population → settlement type classification
      if (this.world.hasStore('Population')) {
        const pop = this.world.getComponent(eid, 'Population') as { total?: number; size?: number } | undefined;
        if (pop !== undefined) {
          populationCount = pop.total ?? pop.size ?? 0;
          populationTier = classifyPopulation(populationCount);

          if (this.capitalIds.has(numId)) {
            type = 'capital';
            isCapital = true;
          } else {
            type = populationTier === 'city' ? 'city' : populationTier === 'town' ? 'town' : 'village';
          }
        }
      }

      // Military → army type or military strength
      if (this.world.hasStore('Military')) {
        const mil = this.world.getComponent(eid, 'Military') as { strength?: number; troops?: number } | undefined;
        if (mil !== undefined) {
          militaryStrength = mil.strength ?? mil.troops ?? 0;
          if (type === 'unknown') type = 'army';
        }
      }

      // Economy → wealth
      if (this.world.hasStore('Economy')) {
        const econ = this.world.getComponent(eid, 'Economy') as { wealth?: number } | undefined;
        if (econ?.wealth !== undefined) {
          wealth = econ.wealth;
        }
      }

      // Structure detection
      if (this.world.hasStore('Structures')) {
        const structs = this.world.getComponent(eid, 'Structures') as { buildings?: string[] } | undefined;
        if (structs?.buildings !== undefined && structs.buildings.length > 0) {
          structures = structs.buildings;
          if (type === 'unknown') {
            if (structs.buildings.some(b => b.toLowerCase().includes('temple'))) type = 'temple';
            else if (structs.buildings.some(b => b.toLowerCase().includes('academy'))) type = 'academy';
          }
        }
      }

      // Character detection
      if (type === 'unknown' && this.world.hasStore('Personality')) {
        const personality = this.world.getComponent(eid, 'Personality');
        if (personality !== undefined) type = 'character';
      }

      // Ruin detection
      if (type !== 'unknown' && this.world.hasStore('Abandoned')) {
        const abandoned = this.world.getComponent(eid, 'Abandoned');
        if (abandoned !== undefined) type = 'ruin';
      }

      entities.push({
        id: numId,
        type,
        name,
        x: pos.x,
        y: pos.y,
        ...(factionId !== undefined ? { factionId } : {}),
        ...(populationCount !== undefined ? { populationCount } : {}),
        ...(populationTier !== undefined ? { populationTier } : {}),
        ...(militaryStrength !== undefined ? { militaryStrength } : {}),
        ...(wealth !== undefined ? { wealth } : {}),
        ...(structures !== undefined ? { structures } : {}),
        ...(isCapital === true ? { isCapital } : {}),
      });
    }

    return entities;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

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

    // Build current entity state and diff against previous
    const currentEntities = this.buildEntitySnapshots();
    const entityUpdates: EntitySnapshot[] = [];
    const currentEntityMap = new Map<number, EntitySnapshot>();

    for (const entity of currentEntities) {
      currentEntityMap.set(entity.id, entity);
      const prev = this.previousEntityState.get(entity.id);
      if (prev === undefined || this.entityChanged(prev, entity)) {
        // Compute movement direction for armies
        if (prev !== undefined && (prev.x !== entity.x || prev.y !== entity.y)) {
          const dx = entity.x - prev.x;
          const dy = entity.y - prev.y;
          const dir = computeDirection(dx, dy);
          entityUpdates.push({ ...entity, movementDirection: dir });
        } else {
          entityUpdates.push(entity);
        }
      }
    }

    // Detect removed entities
    const removedEntities: number[] = [];
    for (const prevId of this.previousEntityState.keys()) {
      if (!currentEntityMap.has(prevId)) {
        removedEntities.push(prevId);
      }
    }

    this.previousEntityState = currentEntityMap;

    const delta: TickDelta = {
      tick: this.clock.currentTick,
      time: {
        year: this.clock.currentTime.year,
        month: this.clock.currentTime.month,
        day: this.clock.currentTime.day,
      },
      events: this.serializeEvents(newEvents),
      changedEntities: [],
      removedEntities,
      entityUpdates,
    };

    for (const cb of this.tickDeltaCallbacks) {
      cb(delta);
    }
  }

  private entityChanged(prev: EntitySnapshot, curr: EntitySnapshot): boolean {
    return prev.x !== curr.x || prev.y !== curr.y
      || prev.type !== curr.type
      || prev.populationCount !== curr.populationCount
      || prev.militaryStrength !== curr.militaryStrength
      || prev.wealth !== curr.wealth
      || prev.name !== curr.name;
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
