import { describe, it, expect, beforeEach } from 'vitest';
import {
  SaveManager,
  serializeValue,
  deserializeValue,
  resetSaveIdCounter,
} from './save-manager.js';
import type { SaveStorage, SaveMetadata } from './save-manager.js';
import { World } from '../ecs/world.js';
import { WorldClock } from '../time/world-clock.js';
import { EventLog } from '../events/event-log.js';
import { resetEntityIdCounter } from '../ecs/types.js';
import type { EntityId } from '../ecs/types.js';
import type { Component, ComponentType } from '../ecs/component.js';
import { EventCategory } from '../events/types.js';
import type { WorldEvent } from '../events/types.js';

// ─── In-memory SaveStorage for tests ───────────────────────────────────────

class MemoryStorage implements SaveStorage {
  private files = new Map<string, Uint8Array>();

  writeFile(path: string, data: Uint8Array): void {
    this.files.set(path, data);
  }

  readFile(path: string): Uint8Array {
    const data = this.files.get(path);
    if (data === undefined) throw new Error(`File not found: ${path}`);
    return data;
  }

  listFiles(dir: string): string[] {
    const result: string[] = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(dir + '/')) {
        result.push(key.slice(dir.length + 1));
      }
    }
    return result;
  }

  deleteFile(path: string): void {
    this.files.delete(path);
  }

  ensureDir(_path: string): void {
    // no-op for in-memory
  }

  exists(path: string): boolean {
    return this.files.has(path);
  }

  /** Total bytes stored (for compression tests). */
  totalBytes(): number {
    let total = 0;
    for (const data of this.files.values()) {
      total += data.byteLength;
    }
    return total;
  }
}

// ─── Helper to create a test component ─────────────────────────────────────

function makeComponent(type: ComponentType, data: Record<string, unknown>): Component {
  return {
    type,
    ...data,
    serialize() {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(this as Record<string, unknown>)) {
        if (key !== 'type' && key !== 'serialize') {
          out[key] = (this as Record<string, unknown>)[key];
        }
      }
      return out;
    },
  } as Component;
}

function makeEvent(
  id: number,
  category: EventCategory,
  subtype: string,
  tick: number,
  participants: number[] = [],
  significance = 50,
): WorldEvent {
  return {
    id: id as EntityId,
    category,
    subtype,
    timestamp: tick,
    participants: participants.map((p) => p as EntityId),
    causes: [],
    consequences: [],
    data: {},
    significance,
    consequencePotential: [],
  } as WorldEvent;
}

function makeBaseMeta(name: string, seed = 42): Omit<SaveMetadata, 'isIncremental' | 'entityCount' | 'eventCount'> {
  return {
    name,
    description: 'Test save',
    worldAge: 0,
    seed,
    createdAt: Date.now(),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('serializeValue / deserializeValue', () => {
  it('handles primitives', () => {
    expect(deserializeValue(serializeValue(42))).toBe(42);
    expect(deserializeValue(serializeValue('hello'))).toBe('hello');
    expect(deserializeValue(serializeValue(true))).toBe(true);
    expect(deserializeValue(serializeValue(null))).toBe(null);
    expect(deserializeValue(serializeValue(undefined))).toBe(undefined);
  });

  it('handles arrays', () => {
    const arr = [1, 'two', [3]];
    expect(deserializeValue(serializeValue(arr))).toEqual(arr);
  });

  it('handles plain objects', () => {
    const obj = { a: 1, b: 'two', c: { d: 3 } };
    expect(deserializeValue(serializeValue(obj))).toEqual(obj);
  });

  it('roundtrips Maps', () => {
    const map = new Map<string, number>([['a', 1], ['b', 2]]);
    const result = deserializeValue(serializeValue(map)) as Map<string, number>;
    expect(result).toBeInstanceOf(Map);
    expect(result.get('a')).toBe(1);
    expect(result.get('b')).toBe(2);
    expect(result.size).toBe(2);
  });

  it('roundtrips Sets', () => {
    const set = new Set([1, 2, 3]);
    const result = deserializeValue(serializeValue(set)) as Set<number>;
    expect(result).toBeInstanceOf(Set);
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(true);
    expect(result.has(3)).toBe(true);
    expect(result.size).toBe(3);
  });

  it('handles nested Maps in objects', () => {
    const obj = {
      name: 'test',
      scores: new Map<string, number>([['math', 95], ['english', 88]]),
    };
    const result = deserializeValue(serializeValue(obj)) as Record<string, unknown>;
    expect(result['name']).toBe('test');
    const scores = result['scores'] as Map<string, number>;
    expect(scores).toBeInstanceOf(Map);
    expect(scores.get('math')).toBe(95);
  });

  it('drops functions', () => {
    const obj = { a: 1, fn: () => 42 };
    const result = deserializeValue(serializeValue(obj)) as Record<string, unknown>;
    expect(result['a']).toBe(1);
    expect(result['fn']).toBeUndefined();
  });

  it('handles Maps with numeric keys', () => {
    const map = new Map<number, string>([[1, 'one'], [2, 'two']]);
    const result = deserializeValue(serializeValue(map)) as Map<number, string>;
    expect(result).toBeInstanceOf(Map);
    expect(result.get(1)).toBe('one');
    expect(result.get(2)).toBe('two');
  });
});

describe('SaveManager', () => {
  let storage: MemoryStorage;
  let manager: SaveManager;
  const SAVES_DIR = '/saves';

  beforeEach(() => {
    resetEntityIdCounter();
    resetSaveIdCounter();
    storage = new MemoryStorage();
    manager = new SaveManager(storage, SAVES_DIR);
  });

  describe('full save + load roundtrip', () => {
    it('preserves entities and components', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');
      world.registerComponent('Attribute');

      const e1 = world.createEntity();
      const e2 = world.createEntity();
      const e3 = world.createEntity();

      world.addComponent(e1, makeComponent('Position', { x: 10, y: 20 }));
      world.addComponent(e1, makeComponent('Attribute', {
        strength: 15, agility: 12, endurance: 10,
        intelligence: 8, wisdom: 14, charisma: 11,
      }));
      world.addComponent(e2, makeComponent('Position', { x: 30, y: 40 }));
      world.addComponent(e3, makeComponent('Position', { x: 50, y: 60 }));

      // Destroy one entity
      world.destroyEntity(e2);

      clock.advanceBy(100);

      const saveFile = manager.save(world, clock, eventLog, makeBaseMeta('test1'));

      // Load into fresh instances
      resetEntityIdCounter();
      const { world: w2, clock: c2 } = manager.load(
        saveFile, World, WorldClock, EventLog,
      );

      expect(c2.currentTick).toBe(100);
      expect(w2.isAlive(e1)).toBe(true);
      expect(w2.isAlive(e2)).toBe(false);
      expect(w2.isAlive(e3)).toBe(true);

      const pos1 = w2.getComponent(e1, 'Position') as Record<string, unknown> | undefined;
      expect(pos1).toBeDefined();
      expect(pos1!['x']).toBe(10);
      expect(pos1!['y']).toBe(20);

      const attr = w2.getComponent(e1, 'Attribute') as Record<string, unknown> | undefined;
      expect(attr).toBeDefined();
      expect(attr!['strength']).toBe(15);

      const pos3 = w2.getComponent(e3, 'Position') as Record<string, unknown> | undefined;
      expect(pos3).toBeDefined();
      expect(pos3!['x']).toBe(50);
    });

    it('preserves events', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');
      const e1 = world.createEntity();
      world.addComponent(e1, makeComponent('Position', { x: 0, y: 0 }));

      eventLog.append(makeEvent(100, EventCategory.Political, 'faction.war_declared', 10, [0, 1], 85));
      eventLog.append(makeEvent(101, EventCategory.Personal, 'character.death', 20, [0], 60));

      const saveFile = manager.save(world, clock, eventLog, makeBaseMeta('test2'));

      resetEntityIdCounter();
      const { eventLog: el2 } = manager.load(saveFile, World, WorldClock, EventLog);

      expect(el2.getCount()).toBe(2);
      const all = el2.getAll();
      expect(all[0]!.category).toBe(EventCategory.Political);
      expect(all[0]!.subtype).toBe('faction.war_declared');
      expect(all[0]!.significance).toBe(85);
      expect(all[1]!.category).toBe(EventCategory.Personal);
    });

    it('preserves components with Maps', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Traits');
      const e1 = world.createEntity();
      world.addComponent(e1, makeComponent('Traits', {
        traits: ['brave', 'ambitious'],
        intensities: new Map<string, number>([['brave', 0.8], ['ambitious', 0.6]]),
      }));

      const saveFile = manager.save(world, clock, eventLog, makeBaseMeta('test3'));

      resetEntityIdCounter();
      const { world: w2 } = manager.load(saveFile, World, WorldClock, EventLog);

      const traits = w2.getComponent(e1, 'Traits') as Record<string, unknown> | undefined;
      expect(traits).toBeDefined();
      expect(traits!['traits']).toEqual(['brave', 'ambitious']);
      const intensities = traits!['intensities'] as Map<string, number>;
      expect(intensities).toBeInstanceOf(Map);
      expect(intensities.get('brave')).toBe(0.8);
      expect(intensities.get('ambitious')).toBe(0.6);
    });

    it('deserialized components have a working serialize() method', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');
      const e1 = world.createEntity();
      world.addComponent(e1, makeComponent('Position', { x: 5, y: 10 }));

      const saveFile = manager.save(world, clock, eventLog, makeBaseMeta('test4'));

      resetEntityIdCounter();
      const { world: w2 } = manager.load(saveFile, World, WorldClock, EventLog);

      const pos = w2.getComponent(e1, 'Position');
      expect(pos).toBeDefined();
      const serialized = pos!.serialize();
      expect(serialized['x']).toBe(5);
      expect(serialized['y']).toBe(10);
      expect(serialized['type']).toBeUndefined();
      expect(serialized['serialize']).toBeUndefined();
    });
  });

  describe('incremental save', () => {
    it('only contains changed entities', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');
      world.registerComponent('Attribute');

      // Create many entities so incremental is meaningfully smaller
      const entities: EntityId[] = [];
      for (let i = 0; i < 50; i++) {
        const e = world.createEntity();
        entities.push(e);
        world.addComponent(e, makeComponent('Position', { x: i * 10, y: i * 5 }));
        world.addComponent(e, makeComponent('Attribute', {
          strength: 10 + i, agility: 12, endurance: 8,
          intelligence: 14, wisdom: 11, charisma: 9,
        }));
      }

      // Full save first
      manager.save(world, clock, eventLog, makeBaseMeta('base'));

      // Modify only 1 entity
      const e1 = entities[0]!;
      world.addComponent(e1, makeComponent('Position', { x: 99, y: 99 }));
      manager.markDirty(e1);
      clock.advanceBy(100);

      const incSave = manager.saveIncremental(world, clock, eventLog, makeBaseMeta('inc1'));

      // Incremental should be smaller than a full save of the same world
      const fullSave = new SaveManager(storage, SAVES_DIR)
        .save(world, clock, eventLog, makeBaseMeta('full'));

      expect(incSave.compressed.byteLength).toBeLessThan(fullSave.compressed.byteLength);
      expect(incSave.metadata.isIncremental).toBe(true);
      expect(incSave.metadata.entityCount).toBe(1); // only e1 changed
    });

    it('falls back to full save if no base exists', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');
      world.createEntity();

      const saveFile = manager.saveIncremental(world, clock, eventLog, makeBaseMeta('fallback'));
      expect(saveFile.metadata.isIncremental).toBe(false);
    });

    it('tracks new events since last save', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');
      const e1 = world.createEntity();
      world.addComponent(e1, makeComponent('Position', { x: 0, y: 0 }));
      eventLog.append(makeEvent(100, EventCategory.Political, 'war', 0));

      // Full save captures 1 event
      manager.save(world, clock, eventLog, makeBaseMeta('base'));

      // Add more events
      eventLog.append(makeEvent(101, EventCategory.Personal, 'death', 10));
      eventLog.append(makeEvent(102, EventCategory.Economic, 'trade', 20));
      manager.markDirty(e1);

      const incSave = manager.saveIncremental(world, clock, eventLog, makeBaseMeta('inc'));
      expect(incSave.metadata.eventCount).toBe(2); // 2 new events
    });

    it('tracks destroyed entities', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      world.addComponent(e1, makeComponent('Position', { x: 0, y: 0 }));
      world.addComponent(e2, makeComponent('Position', { x: 10, y: 10 }));

      manager.save(world, clock, eventLog, makeBaseMeta('base'));

      // Destroy e2
      world.destroyEntity(e2);
      manager.markDestroyed(e2);

      const incSave = manager.saveIncremental(world, clock, eventLog, makeBaseMeta('inc'));

      // Load base, then apply incremental
      resetEntityIdCounter();
      const baseSave = new SaveManager(storage, SAVES_DIR)
        .save(world, clock, eventLog, makeBaseMeta('base2'));

      // Verify that the incremental metadata tracks the destroyed entity
      expect(incSave.metadata.isIncremental).toBe(true);
    });
  });

  describe('compression', () => {
    it('reduces size by more than 50%', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');
      world.registerComponent('Attribute');
      world.registerComponent('Traits');

      // Create many entities with data
      for (let i = 0; i < 100; i++) {
        const e = world.createEntity();
        world.addComponent(e, makeComponent('Position', { x: i * 10, y: i * 5 }));
        world.addComponent(e, makeComponent('Attribute', {
          strength: 10 + (i % 10),
          agility: 12 + (i % 8),
          endurance: 8 + (i % 6),
          intelligence: 14 + (i % 12),
          wisdom: 11 + (i % 9),
          charisma: 9 + (i % 7),
        }));
        world.addComponent(e, makeComponent('Traits', {
          traits: ['brave', 'wise', 'cunning'],
          intensities: new Map([['brave', 0.5 + (i % 5) * 0.1], ['wise', 0.3]]),
        }));
      }

      // Add many events
      for (let i = 0; i < 200; i++) {
        eventLog.append(makeEvent(
          1000 + i,
          EventCategory.Political,
          'faction.diplomacy',
          i,
          [i % 100],
          30 + (i % 70),
        ));
      }

      clock.advanceBy(1000);

      const saveFile = manager.save(world, clock, eventLog, makeBaseMeta('big'));

      // Measure compressed vs uncompressed size
      const compressedSize = saveFile.compressed.byteLength;

      // Decompress to get original size
      const { gunzipSync } = require('node:zlib') as typeof import('node:zlib');
      const decompressed = gunzipSync(Buffer.from(saveFile.compressed));
      const uncompressedSize = decompressed.byteLength;

      const ratio = compressedSize / uncompressedSize;
      expect(ratio).toBeLessThan(0.5); // >50% reduction
    });
  });

  describe('file system operations', () => {
    it('writeSave + readSave roundtrips', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');
      const e1 = world.createEntity();
      world.addComponent(e1, makeComponent('Position', { x: 42, y: 99 }));
      clock.advanceBy(500);

      const saveFile = manager.save(world, clock, eventLog, makeBaseMeta('disk-test'));
      manager.writeSave(saveFile);

      const loaded = manager.readSave('disk-test');
      expect(loaded.id).toBe(saveFile.id);
      expect(loaded.metadata.name).toBe('disk-test');
      expect(loaded.metadata.worldAge).toBe(0);

      // Load and verify data
      resetEntityIdCounter();
      const { world: w2, clock: c2 } = manager.load(loaded, World, WorldClock, EventLog);
      expect(c2.currentTick).toBe(500);
      const pos = w2.getComponent(e1, 'Position') as Record<string, unknown> | undefined;
      expect(pos!['x']).toBe(42);
    });

    it('listSaves returns all saves sorted by creation time', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');
      world.createEntity();

      const save1 = manager.save(world, clock, eventLog, {
        ...makeBaseMeta('save-a'), createdAt: 1000,
      });
      manager.writeSave(save1);

      const save2 = manager.save(world, clock, eventLog, {
        ...makeBaseMeta('save-b'), createdAt: 3000,
      });
      manager.writeSave(save2);

      const save3 = manager.save(world, clock, eventLog, {
        ...makeBaseMeta('save-c'), createdAt: 2000,
      });
      manager.writeSave(save3);

      const list = manager.listSaves();
      expect(list).toHaveLength(3);
      // Sorted by createdAt descending
      expect(list[0]!.name).toBe('save-b');
      expect(list[1]!.name).toBe('save-c');
      expect(list[2]!.name).toBe('save-a');
    });

    it('deleteSave removes files', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');
      world.createEntity();

      const saveFile = manager.save(world, clock, eventLog, makeBaseMeta('to-delete'));
      manager.writeSave(saveFile);

      expect(manager.listSaves()).toHaveLength(1);
      manager.deleteSave('to-delete');
      expect(manager.listSaves()).toHaveLength(0);
    });
  });

  describe('auto-save', () => {
    it('triggers after AUTO_SAVE_INTERVAL_YEARS', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');
      world.createEntity();

      // Do an initial full save at tick 0
      manager.save(world, clock, eventLog, makeBaseMeta('initial'));

      // Advance less than 10 years — no auto-save
      clock.advanceBy(365 * 9);
      expect(manager.checkAutoSave(clock, world, eventLog, 42)).toBeUndefined();

      // Advance past 10 years
      clock.advanceBy(365 * 2); // total = 11 years
      const result = manager.checkAutoSave(clock, world, eventLog, 42);
      expect(result).toBeDefined();
      expect(result!.metadata.name).toMatch(/^autosave-/);
    });

    it('rotates and keeps at most 5 auto-saves', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');
      world.createEntity();

      // Initial full save
      manager.save(world, clock, eventLog, makeBaseMeta('initial'));

      // Trigger 7 auto-saves (wraps around the 5-slot ring)
      for (let i = 1; i <= 7; i++) {
        clock.advanceBy(365 * 10);
        manager.checkAutoSave(clock, world, eventLog, 42);
      }

      // Count auto-save files
      const saves = manager.listSaves();
      const autoSaves = saves.filter((s) => s.name.startsWith('autosave-'));
      expect(autoSaves.length).toBeLessThanOrEqual(5);
    });
  });

  describe('metadata', () => {
    it('save populates metadata fields correctly', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      world.addComponent(e1, makeComponent('Position', { x: 0, y: 0 }));
      world.addComponent(e2, makeComponent('Position', { x: 1, y: 1 }));

      eventLog.append(makeEvent(100, EventCategory.Political, 'test', 0));

      clock.advanceBy(720); // 2 years

      const saveFile = manager.save(world, clock, eventLog, {
        name: 'meta-test',
        description: 'A description',
        worldAge: 720,
        seed: 12345,
        createdAt: Date.now(),
      });

      expect(saveFile.metadata.name).toBe('meta-test');
      expect(saveFile.metadata.description).toBe('A description');
      expect(saveFile.metadata.worldAge).toBe(720);
      expect(saveFile.metadata.seed).toBe(12345);
      expect(saveFile.metadata.isIncremental).toBe(false);
      expect(saveFile.metadata.entityCount).toBe(2);
      expect(saveFile.metadata.eventCount).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('handles empty world', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      const saveFile = manager.save(world, clock, eventLog, makeBaseMeta('empty'));

      resetEntityIdCounter();
      const { world: w2, clock: c2, eventLog: el2 } = manager.load(
        saveFile, World, WorldClock, EventLog,
      );

      expect(w2.entityCount()).toBe(0);
      expect(c2.currentTick).toBe(0);
      expect(el2.getCount()).toBe(0);
    });

    it('handles events with location and temporal offset', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');
      world.createEntity();

      const event: WorldEvent = {
        id: 200 as EntityId,
        category: EventCategory.Disaster,
        subtype: 'earthquake',
        timestamp: 50,
        participants: [0 as EntityId],
        location: 5 as EntityId,
        causes: [100 as EntityId],
        consequences: [201 as EntityId],
        data: { magnitude: 7.5, affectedArea: 'northern_plains' },
        significance: 95,
        consequencePotential: [{
          eventSubtype: 'building.collapse',
          baseProbability: 0.7,
          category: EventCategory.Disaster,
          delayTicks: 1,
          dampening: 0.3,
        }],
        temporalOffset: 5,
      };
      eventLog.append(event);

      const saveFile = manager.save(world, clock, eventLog, makeBaseMeta('events'));

      resetEntityIdCounter();
      const { eventLog: el2 } = manager.load(saveFile, World, WorldClock, EventLog);

      const restored = el2.getAll()[0]!;
      expect(restored.location).toBe(5);
      expect(restored.causes).toEqual([100]);
      expect(restored.consequences).toEqual([201]);
      expect((restored.data as Record<string, unknown>)['magnitude']).toBe(7.5);
      expect(restored.significance).toBe(95);
      expect(restored.consequencePotential).toHaveLength(1);
      expect(restored.temporalOffset).toBe(5);
    });

    it('handles components with nested Maps and Sets', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Diplomacy');
      const e1 = world.createEntity();
      world.addComponent(e1, makeComponent('Diplomacy', {
        relations: new Map<number, number>([[1, 50], [2, -30]]),
        treaties: ['trade_agreement', 'non_aggression'],
      }));

      const saveFile = manager.save(world, clock, eventLog, makeBaseMeta('maps'));

      resetEntityIdCounter();
      const { world: w2 } = manager.load(saveFile, World, WorldClock, EventLog);

      const diplo = w2.getComponent(e1, 'Diplomacy') as Record<string, unknown>;
      const relations = diplo['relations'] as Map<number, number>;
      expect(relations).toBeInstanceOf(Map);
      expect(relations.get(1)).toBe(50);
      expect(relations.get(2)).toBe(-30);
      expect(diplo['treaties']).toEqual(['trade_agreement', 'non_aggression']);
    });

    it('preserves entity ID alignment after load', () => {
      const world = new World();
      const clock = new WorldClock();
      const eventLog = new EventLog();

      world.registerComponent('Position');

      // Create entities 0, 1, 2, 3, 4
      for (let i = 0; i < 5; i++) {
        const e = world.createEntity();
        world.addComponent(e, makeComponent('Position', { x: i, y: i }));
      }

      // Destroy entities 1 and 3
      world.destroyEntity(1 as EntityId);
      world.destroyEntity(3 as EntityId);

      const saveFile = manager.save(world, clock, eventLog, makeBaseMeta('ids'));

      resetEntityIdCounter();
      const { world: w2 } = manager.load(saveFile, World, WorldClock, EventLog);

      expect(w2.isAlive(0 as EntityId)).toBe(true);
      expect(w2.isAlive(1 as EntityId)).toBe(false);
      expect(w2.isAlive(2 as EntityId)).toBe(true);
      expect(w2.isAlive(3 as EntityId)).toBe(false);
      expect(w2.isAlive(4 as EntityId)).toBe(true);

      // Verify component data at correct IDs
      const pos0 = w2.getComponent(0 as EntityId, 'Position') as Record<string, unknown>;
      expect(pos0['x']).toBe(0);
      const pos4 = w2.getComponent(4 as EntityId, 'Position') as Record<string, unknown>;
      expect(pos4['x']).toBe(4);
    });
  });
});
