/**
 * SaveManager — serializes/deserializes complete world state to/from compressed JSON.
 *
 * Full saves capture the entire ECS world, clock, and event log.
 * Incremental saves capture only entities changed since the last save + event deltas.
 * Auto-save triggers every 10 simulation years, keeping the last 5 rotated.
 *
 * File format: gzip-compressed JSON with Map/Set-aware serialization.
 * Save location: ~/.aeternum/saves/
 */

import { gzipSync, gunzipSync } from 'node:zlib';

import type { EntityId, SiteId } from '../ecs/types.js';
import { toEntityId, toEventId } from '../ecs/types.js';
import type { Component, ComponentType } from '../ecs/component.js';
import type { World } from '../ecs/world.js';
import type { WorldClock } from '../time/world-clock.js';
import type { EventLog } from '../events/event-log.js';
import type { WorldEvent, ConsequenceRule } from '../events/types.js';

// ─── Public types ──────────────────────────────────────────────────────────

export interface SaveMetadata {
  readonly name: string;
  readonly description: string;
  readonly worldAge: number;
  readonly seed: number;
  readonly createdAt: number;
  readonly isIncremental: boolean;
  readonly entityCount: number;
  readonly eventCount: number;
  readonly baseSaveId?: string;
}

export interface SaveFile {
  readonly id: string;
  readonly version: number;
  readonly metadata: SaveMetadata;
  readonly compressed: Uint8Array;
}

/**
 * Abstraction over file-system operations so tests can use an in-memory impl.
 */
export interface SaveStorage {
  writeFile(path: string, data: Uint8Array): void;
  readFile(path: string): Uint8Array;
  listFiles(dir: string): string[];
  deleteFile(path: string): void;
  ensureDir(path: string): void;
  exists(path: string): boolean;
}

// ─── Internal serialization formats ────────────────────────────────────────

const SAVE_VERSION = 1;
const MAX_AUTO_SAVES = 5;
const AUTO_SAVE_INTERVAL_YEARS = 10;
const FULL_SAVE_INTERVAL_YEARS = 100;
/** TickFrequency.Annual — 365 ticks per year */
const TICKS_PER_YEAR = 365;

interface SerializedWorldState {
  readonly version: number;
  readonly metadata: SaveMetadata;
  readonly tick: number;
  readonly registeredTypes: readonly ComponentType[];
  readonly maxEntityId: number;
  readonly aliveEntityIds: readonly number[];
  readonly components: readonly SerializedComponentStore[];
  readonly events: readonly SerializedEvent[];
}

interface SerializedComponentStore {
  readonly type: ComponentType;
  readonly entries: ReadonlyArray<{ entityId: number; data: unknown }>;
}

interface SerializedEvent {
  readonly id: number;
  readonly category: string;
  readonly subtype: string;
  readonly timestamp: number;
  readonly participants: readonly number[];
  readonly location?: number;
  readonly causes: readonly number[];
  readonly consequences: readonly number[];
  readonly data: Readonly<Record<string, unknown>>;
  readonly significance: number;
  readonly consequencePotential: readonly ConsequenceRule[];
  readonly temporalOffset?: number;
}

interface IncrementalSaveState {
  readonly version: number;
  readonly metadata: SaveMetadata;
  readonly baseSaveId: string;
  readonly baseTick: number;
  readonly currentTick: number;
  readonly changedEntities: readonly SerializedEntityDelta[];
  readonly destroyedEntityIds: readonly number[];
  readonly newEntityIds: readonly number[];
  readonly newEvents: readonly SerializedEvent[];
}

interface SerializedEntityDelta {
  readonly entityId: number;
  readonly components: ReadonlyArray<{ type: ComponentType; data: unknown }>;
}

// ─── Serialization helpers ─────────────────────────────────────────────────

/**
 * Convert a value into a JSON-safe representation.
 * Maps → `{ __t: 'M', d: [[k,v], …] }`, Sets → `{ __t: 'S', d: [v, …] }`.
 * Functions are dropped.
 */
export function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'function') return undefined;
  if (typeof value !== 'object') return value;

  if (value instanceof Map) {
    const entries: unknown[] = [];
    for (const [k, v] of value) {
      entries.push([serializeValue(k), serializeValue(v)]);
    }
    return { __t: 'M', d: entries };
  }

  if (value instanceof Set) {
    const items: unknown[] = [];
    for (const v of value) {
      items.push(serializeValue(v));
    }
    return { __t: 'S', d: items };
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  // Plain object — drop function-valued props
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v !== 'function') {
      result[key] = serializeValue(v);
    }
  }
  return result;
}

/**
 * Reconstruct Maps, Sets, and nested structures from the JSON-safe format.
 */
export function deserializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => deserializeValue(item));
  }

  const obj = value as Record<string, unknown>;
  if (obj['__t'] === 'M') {
    const rawEntries = obj['d'] as Array<[unknown, unknown]>;
    const map = new Map<unknown, unknown>();
    for (const [k, v] of rawEntries) {
      map.set(deserializeValue(k), deserializeValue(v));
    }
    return map;
  }
  if (obj['__t'] === 'S') {
    const rawItems = obj['d'] as unknown[];
    const set = new Set<unknown>();
    for (const v of rawItems) {
      set.add(deserializeValue(v));
    }
    return set;
  }

  // Plain object
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[key] = deserializeValue(obj[key]);
  }
  return result;
}

/**
 * Reconstruct a Component from a ComponentType + serialized data.
 * Adds back the `type` discriminant and a `serialize()` method.
 */
function deserializeComponent(type: ComponentType, serializedData: unknown): Component {
  const data = deserializeValue(serializedData) as Record<string, unknown>;
  data['type'] = type;
  data['serialize'] = function (this: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(this)) {
      if (key !== 'type' && key !== 'serialize') {
        out[key] = this[key];
      }
    }
    return out;
  };
  return data as unknown as Component;
}

function serializeEvent(event: WorldEvent): SerializedEvent {
  return {
    id: event.id as number,
    category: event.category as string,
    subtype: event.subtype,
    timestamp: event.timestamp,
    participants: event.participants.map((p) => p as number),
    ...(event.location !== undefined ? { location: event.location as number } : {}),
    causes: event.causes.map((c) => c as number),
    consequences: event.consequences.map((c) => c as number),
    data: serializeValue(event.data) as Record<string, unknown>,
    significance: event.significance,
    consequencePotential: event.consequencePotential as ConsequenceRule[],
    ...(event.temporalOffset !== undefined ? { temporalOffset: event.temporalOffset } : {}),
  };
}

function deserializeEvent(raw: SerializedEvent): WorldEvent {
  return {
    id: toEventId(toEntityId(raw.id)),
    category: raw.category,
    subtype: raw.subtype,
    timestamp: raw.timestamp,
    participants: raw.participants.map((p) => toEntityId(p)),
    ...(raw.location !== undefined ? { location: toEntityId(raw.location) as SiteId } : {}),
    causes: raw.causes.map((c) => toEventId(toEntityId(c))),
    consequences: [...raw.consequences.map((c) => toEventId(toEntityId(c)))],
    data: deserializeValue(raw.data) as Record<string, unknown>,
    significance: raw.significance,
    consequencePotential: raw.consequencePotential,
    ...(raw.temporalOffset !== undefined ? { temporalOffset: raw.temporalOffset } : {}),
  } as WorldEvent;
}

let saveCounter = 0;

function generateSaveId(): string {
  return `save-${Date.now()}-${saveCounter++}`;
}

/** Reset counter for tests. */
export function resetSaveIdCounter(): void {
  saveCounter = 0;
}

// ─── SaveManager ───────────────────────────────────────────────────────────

export class SaveManager {
  /** ID of the last full save (base for incremental). */
  private lastFullSaveId: string | null = null;
  /** Tick of the last save (full or incremental). */
  private lastSaveTick = 0;
  /** Event count at last save (for delta computation). */
  private lastSaveEventCount = 0;

  /** Entities modified since the last save. */
  private readonly dirtyEntities = new Set<EntityId>();
  /** Entities destroyed since the last save. */
  private readonly destroyedSinceLastSave = new Set<EntityId>();
  /** Entities created since the last save. */
  private readonly createdSinceLastSave = new Set<EntityId>();

  /** Counter for rotating auto-saves. */
  private autoSaveIndex = 0;

  constructor(
    private readonly storage: SaveStorage,
    private readonly savesDir: string,
  ) {}

  // ── Dirty tracking API ─────────────────────────────────────────────────

  markDirty(entityId: EntityId): void {
    this.dirtyEntities.add(entityId);
  }

  markDestroyed(entityId: EntityId): void {
    this.destroyedSinceLastSave.add(entityId);
    this.dirtyEntities.delete(entityId);
    this.createdSinceLastSave.delete(entityId);
  }

  markCreated(entityId: EntityId): void {
    this.createdSinceLastSave.add(entityId);
  }

  private clearDirtyState(): void {
    this.dirtyEntities.clear();
    this.destroyedSinceLastSave.clear();
    this.createdSinceLastSave.clear();
  }

  // ── Full save ──────────────────────────────────────────────────────────

  save(
    world: World,
    clock: WorldClock,
    eventLog: EventLog,
    metadata: Omit<SaveMetadata, 'isIncremental' | 'entityCount' | 'eventCount'>,
  ): SaveFile {
    const fullMeta: SaveMetadata = {
      ...metadata,
      isIncremental: false,
      entityCount: world.entityCount(),
      eventCount: eventLog.getCount(),
    };

    const state = this.serializeWorldState(world, clock, eventLog, fullMeta);
    const json = JSON.stringify(state);
    const compressed = gzipSync(Buffer.from(json, 'utf8'));

    const id = generateSaveId();
    const saveFile: SaveFile = {
      id,
      version: SAVE_VERSION,
      metadata: fullMeta,
      compressed: new Uint8Array(compressed),
    };

    this.lastFullSaveId = id;
    this.lastSaveTick = clock.currentTick;
    this.lastSaveEventCount = eventLog.getCount();
    this.clearDirtyState();

    return saveFile;
  }

  // ── Incremental save ───────────────────────────────────────────────────

  saveIncremental(
    world: World,
    clock: WorldClock,
    eventLog: EventLog,
    metadata: Omit<SaveMetadata, 'isIncremental' | 'entityCount' | 'eventCount' | 'baseSaveId'>,
  ): SaveFile {
    if (this.lastFullSaveId === null) {
      // No prior full save — fall back to full
      return this.save(world, clock, eventLog, metadata);
    }

    const changedEntityIds = new Set<EntityId>([
      ...this.dirtyEntities,
      ...this.createdSinceLastSave,
    ]);

    const changedEntities: SerializedEntityDelta[] = [];
    for (const entityId of changedEntityIds) {
      if (!world.isAlive(entityId)) continue;
      const components: Array<{ type: ComponentType; data: unknown }> = [];
      for (const compType of world.getRegisteredComponentTypes()) {
        const comp = world.getComponent(entityId, compType);
        if (comp !== undefined) {
          components.push({
            type: compType,
            data: serializeValue(comp),
          });
        }
      }
      changedEntities.push({ entityId: entityId as number, components });
    }

    // Event delta: events appended since last save
    const allEvents = eventLog.getAll();
    const newEvents = allEvents.slice(this.lastSaveEventCount).map(serializeEvent);

    const fullMeta: SaveMetadata = {
      ...metadata,
      isIncremental: true,
      entityCount: changedEntityIds.size,
      eventCount: newEvents.length,
      baseSaveId: this.lastFullSaveId,
    };

    const state: IncrementalSaveState = {
      version: SAVE_VERSION,
      metadata: fullMeta,
      baseSaveId: this.lastFullSaveId,
      baseTick: this.lastSaveTick,
      currentTick: clock.currentTick,
      changedEntities,
      destroyedEntityIds: [...this.destroyedSinceLastSave].map((id) => id as number),
      newEntityIds: [...this.createdSinceLastSave].map((id) => id as number),
      newEvents,
    };

    const json = JSON.stringify(state);
    const compressed = gzipSync(Buffer.from(json, 'utf8'));

    const id = generateSaveId();
    const saveFile: SaveFile = {
      id,
      version: SAVE_VERSION,
      metadata: fullMeta,
      compressed: new Uint8Array(compressed),
    };

    this.lastSaveTick = clock.currentTick;
    this.lastSaveEventCount = eventLog.getCount();
    this.clearDirtyState();

    return saveFile;
  }

  // ── Load ───────────────────────────────────────────────────────────────

  load(
    saveFile: SaveFile,
    WorldClass: new () => World,
    ClockClass: new () => WorldClock,
    EventLogClass: new () => EventLog,
  ): { world: World; clock: WorldClock; eventLog: EventLog } {
    const json = gunzipSync(Buffer.from(saveFile.compressed)).toString('utf8');
    const raw = JSON.parse(json) as SerializedWorldState;
    return this.deserializeWorldState(raw, WorldClass, ClockClass, EventLogClass);
  }

  /**
   * Apply an incremental save on top of an already-loaded base world.
   */
  loadIncremental(
    incrementalSave: SaveFile,
    world: World,
    clock: WorldClock,
    eventLog: EventLog,
  ): void {
    const json = gunzipSync(Buffer.from(incrementalSave.compressed)).toString('utf8');
    const raw = JSON.parse(json) as IncrementalSaveState;

    // Advance clock
    clock.setTick(raw.currentTick);

    // Create new entities
    for (const id of raw.newEntityIds) {
      // Entities may already exist depending on order — skip if alive
      if (!world.isAlive(id as EntityId)) {
        // Create entities up to the ID (monotonic)
        while (world.entityCount() <= id) {
          world.createEntity();
        }
      }
    }

    // Destroy removed entities
    for (const id of raw.destroyedEntityIds) {
      if (world.isAlive(id as EntityId)) {
        world.destroyEntity(id as EntityId);
      }
    }

    // Apply changed entity components
    for (const delta of raw.changedEntities) {
      const entityId = delta.entityId as EntityId;
      for (const entry of delta.components) {
        if (!world.hasStore(entry.type)) {
          world.registerComponent(entry.type);
        }
        const comp = deserializeComponent(entry.type, entry.data);
        world.addComponent(entityId, comp);
      }
    }

    // Append new events
    for (const rawEvent of raw.newEvents) {
      eventLog.append(deserializeEvent(rawEvent));
    }
  }

  // ── File-system operations ─────────────────────────────────────────────

  writeSave(saveFile: SaveFile): void {
    this.storage.ensureDir(this.savesDir);
    const filename = `${this.savesDir}/${saveFile.metadata.name}.aet`;
    // Write metadata alongside for fast listing
    const metaFilename = `${this.savesDir}/${saveFile.metadata.name}.meta.json`;
    this.storage.writeFile(filename, saveFile.compressed);
    this.storage.writeFile(
      metaFilename,
      new TextEncoder().encode(JSON.stringify({
        id: saveFile.id,
        version: saveFile.version,
        metadata: saveFile.metadata,
      })),
    );
  }

  readSave(name: string): SaveFile {
    const filename = `${this.savesDir}/${name}.aet`;
    const metaFilename = `${this.savesDir}/${name}.meta.json`;
    const compressed = this.storage.readFile(filename);
    const metaJson = new TextDecoder().decode(this.storage.readFile(metaFilename));
    const meta = JSON.parse(metaJson) as { id: string; version: number; metadata: SaveMetadata };
    return {
      id: meta.id,
      version: meta.version,
      metadata: meta.metadata,
      compressed,
    };
  }

  listSaves(): SaveMetadata[] {
    this.storage.ensureDir(this.savesDir);
    const files = this.storage.listFiles(this.savesDir);
    const result: SaveMetadata[] = [];
    for (const file of files) {
      if (file.endsWith('.meta.json')) {
        const metaJson = new TextDecoder().decode(
          this.storage.readFile(`${this.savesDir}/${file}`),
        );
        const meta = JSON.parse(metaJson) as { metadata: SaveMetadata };
        result.push(meta.metadata);
      }
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  deleteSave(name: string): void {
    const filename = `${this.savesDir}/${name}.aet`;
    const metaFilename = `${this.savesDir}/${name}.meta.json`;
    if (this.storage.exists(filename)) {
      this.storage.deleteFile(filename);
    }
    if (this.storage.exists(metaFilename)) {
      this.storage.deleteFile(metaFilename);
    }
  }

  // ── Auto-save ──────────────────────────────────────────────────────────

  /**
   * Should be called each tick. Triggers auto-saves at the right intervals.
   * Returns the SaveFile if an auto-save was triggered, undefined otherwise.
   */
  checkAutoSave(
    clock: WorldClock,
    world: World,
    eventLog: EventLog,
    seed: number,
  ): SaveFile | undefined {
    const ticksSinceSave = clock.currentTick - this.lastSaveTick;
    const yearsSinceSave = ticksSinceSave / TICKS_PER_YEAR;

    if (yearsSinceSave < AUTO_SAVE_INTERVAL_YEARS) return undefined;

    const isFullSave = yearsSinceSave >= FULL_SAVE_INTERVAL_YEARS
      || this.lastFullSaveId === null;

    const autoName = `autosave-${this.autoSaveIndex}`;
    const baseMeta = {
      name: autoName,
      description: `Auto-save at Year ${clock.getElapsedYears()}`,
      worldAge: clock.currentTick,
      seed,
      createdAt: Date.now(),
    };

    let saveFile: SaveFile;
    if (isFullSave) {
      saveFile = this.save(world, clock, eventLog, baseMeta);
    } else {
      saveFile = this.saveIncremental(world, clock, eventLog, baseMeta);
    }

    this.writeSave(saveFile);

    // Rotate: advance index, wrapping at MAX_AUTO_SAVES
    this.autoSaveIndex = (this.autoSaveIndex + 1) % MAX_AUTO_SAVES;

    // Delete the oldest auto-save if it exists
    const oldestName = `autosave-${this.autoSaveIndex}`;
    if (this.storage.exists(`${this.savesDir}/${oldestName}.aet`)) {
      this.deleteSave(oldestName);
    }

    return saveFile;
  }

  // ── Internal serialization ─────────────────────────────────────────────

  private serializeWorldState(
    world: World,
    clock: WorldClock,
    eventLog: EventLog,
    metadata: SaveMetadata,
  ): SerializedWorldState {
    const aliveEntities = world.getAllEntities();

    // Find max entity ID
    let maxEntityId = -1;
    for (const id of aliveEntities) {
      if ((id as number) > maxEntityId) {
        maxEntityId = id as number;
      }
    }

    const registeredTypes = world.getRegisteredComponentTypes();

    // Serialize component stores
    const components: SerializedComponentStore[] = [];
    for (const type of registeredTypes) {
      const store = world.getStore(type);
      const entries: Array<{ entityId: number; data: unknown }> = [];
      for (const [entityId, component] of store.getAll()) {
        entries.push({
          entityId: entityId as number,
          data: serializeValue(component),
        });
      }
      components.push({ type, entries });
    }

    // Serialize events
    const events = eventLog.getAll().map(serializeEvent);

    return {
      version: SAVE_VERSION,
      metadata,
      tick: clock.currentTick,
      registeredTypes,
      maxEntityId,
      aliveEntityIds: aliveEntities.map((id) => id as number),
      components,
      events,
    };
  }

  private deserializeWorldState(
    raw: SerializedWorldState,
    WorldClass: new () => World,
    ClockClass: new () => WorldClock,
    EventLogClass: new () => EventLog,
  ): { world: World; clock: WorldClock; eventLog: EventLog } {
    const world = new WorldClass();
    const clock = new ClockClass();
    const eventLog = new EventLogClass();

    clock.setTick(raw.tick);

    // Register component types
    for (const type of raw.registeredTypes) {
      world.registerComponent(type);
    }

    // Create entities 0..maxEntityId
    const aliveSet = new Set(raw.aliveEntityIds);
    for (let i = 0; i <= raw.maxEntityId; i++) {
      world.createEntity();
    }
    // Destroy dead ones
    for (let i = 0; i <= raw.maxEntityId; i++) {
      if (!aliveSet.has(i)) {
        world.destroyEntity(i as EntityId);
      }
    }

    // Populate component stores
    for (const store of raw.components) {
      for (const entry of store.entries) {
        const comp = deserializeComponent(store.type, entry.data);
        world.addComponent(entry.entityId as EntityId, comp);
      }
    }

    // Restore events
    for (const rawEvent of raw.events) {
      eventLog.append(deserializeEvent(rawEvent));
    }

    // Reset internal tracking
    this.lastFullSaveId = null;
    this.lastSaveTick = clock.currentTick;
    this.lastSaveEventCount = eventLog.getCount();
    this.clearDirtyState();

    return { world, clock, eventLog };
  }
}
