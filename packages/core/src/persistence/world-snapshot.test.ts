import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world.js';
import { WorldClock } from '../time/world-clock.js';
import { EventLog } from '../events/event-log.js';
import { createEvent, resetEventIdCounter } from '../events/event-factory.js';
import { EventCategory } from '../events/types.js';
import type { PositionComponent, HealthComponent, OwnershipComponent } from '../ecs/component.js';
import type { EntityId } from '../ecs/types.js';
import { WorldSnapshotManager, resetSnapshotIdCounter } from './world-snapshot.js';

// ─── Helpers ────────────────────────────────────────────────────

function createPosition(x: number, y: number): PositionComponent {
  return {
    type: 'Position',
    x,
    y,
    serialize: () => ({ type: 'Position', x, y }),
  };
}

function createHealth(current: number, maximum: number): HealthComponent {
  return {
    type: 'Health',
    current,
    maximum,
    injuries: [],
    diseases: [],
    serialize: () => ({ type: 'Health', current, maximum }),
  };
}

function createOwnership(ownerId: number | null, claimStrength: number): OwnershipComponent {
  return {
    type: 'Ownership',
    ownerId,
    claimStrength,
    serialize: () => ({ type: 'Ownership', ownerId, claimStrength }),
  };
}

function makeEvent(tick: number, subtype: string, significance: number) {
  return createEvent({
    category: EventCategory.Personal,
    subtype,
    timestamp: tick,
    participants: [],
    significance,
  });
}

// ─── Tests ──────────────────────────────────────────────────────

describe('WorldSnapshotManager', () => {
  let world: World;
  let clock: WorldClock;
  let eventLog: EventLog;
  let manager: WorldSnapshotManager;

  beforeEach(() => {
    resetEventIdCounter();
    resetSnapshotIdCounter();
    world = new World();
    clock = new WorldClock();
    eventLog = new EventLog();
    manager = new WorldSnapshotManager();
  });

  describe('snapshot', () => {
    it('should capture tick and label', () => {
      clock.setTick(42);
      const snap = manager.snapshot(world, clock, eventLog, 'test label');
      expect(snap.tick).toBe(42);
      expect(snap.label).toBe('test label');
    });

    it('should auto-generate label from tick when none provided', () => {
      clock.setTick(100);
      const snap = manager.snapshot(world, clock, eventLog);
      expect(snap.label).toBe('Snapshot at tick 100');
    });

    it('should have unique IDs', () => {
      const s1 = manager.snapshot(world, clock, eventLog);
      const s2 = manager.snapshot(world, clock, eventLog);
      expect(s1.id).not.toBe(s2.id);
    });

    it('should capture alive entities', () => {
      world.registerComponent('Position');
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      world.createEntity(); // e3
      world.destroyEntity(e2);

      const snap = manager.snapshot(world, clock, eventLog);
      expect(snap.aliveEntities.has(e1)).toBe(true);
      expect(snap.aliveEntities.has(e2)).toBe(false);
      expect(snap.aliveEntities.size).toBe(2);
    });

    it('should deep-clone component data', () => {
      world.registerComponent('Position');
      const entity = world.createEntity();
      const pos = createPosition(10, 20);
      world.addComponent(entity, pos);

      const snap = manager.snapshot(world, clock, eventLog);

      // Mutate original
      pos.x = 999;

      // Snapshot should be unaffected
      const snappedEntries = snap.componentData.get('Position');
      expect(snappedEntries).toBeDefined();
      const snappedPos = snappedEntries!.get(entity) as PositionComponent;
      expect(snappedPos.x).toBe(10);
    });

    it('should capture multiple component types', () => {
      world.registerComponent('Position');
      world.registerComponent('Health');
      const entity = world.createEntity();
      world.addComponent(entity, createPosition(5, 5));
      world.addComponent(entity, createHealth(80, 100));

      const snap = manager.snapshot(world, clock, eventLog);
      expect(snap.componentData.size).toBe(2);
      expect(snap.componentData.has('Position')).toBe(true);
      expect(snap.componentData.has('Health')).toBe(true);
    });

    it('should capture event log', () => {
      eventLog.append(makeEvent(1, 'test.birth', 50));
      eventLog.append(makeEvent(2, 'test.death', 90));

      const snap = manager.snapshot(world, clock, eventLog);
      expect(snap.events.length).toBe(2);
      expect(snap.events[0]!.subtype).toBe('test.birth');
      expect(snap.events[1]!.subtype).toBe('test.death');
    });

    it('should deep-clone events (mutations to original don\'t affect snapshot)', () => {
      const event = makeEvent(1, 'test.event', 50);
      eventLog.append(event);

      const snap = manager.snapshot(world, clock, eventLog);

      // Mutate original event's mutable array
      event.consequences.push(999 as EntityId as never);

      // Snapshot event unaffected
      expect(snap.events[0]!.consequences.length).toBe(0);
    });

    it('should capture createdAt timestamp', () => {
      const before = Date.now();
      const snap = manager.snapshot(world, clock, eventLog);
      const after = Date.now();
      expect(snap.createdAt).toBeGreaterThanOrEqual(before);
      expect(snap.createdAt).toBeLessThanOrEqual(after);
    });
  });

  describe('restore', () => {
    it('should recreate clock at same tick', () => {
      clock.setTick(500);
      const snap = manager.snapshot(world, clock, eventLog);
      const restored = manager.restore(snap, World, WorldClock, EventLog);
      expect(restored.clock.currentTick).toBe(500);
    });

    it('should recreate world with same alive entities', () => {
      world.registerComponent('Position');
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      const e3 = world.createEntity();
      world.destroyEntity(e2);

      const snap = manager.snapshot(world, clock, eventLog);
      const restored = manager.restore(snap, World, WorldClock, EventLog);

      expect(restored.world.isAlive(e1)).toBe(true);
      expect(restored.world.isAlive(e2)).toBe(false);
      expect(restored.world.isAlive(e3)).toBe(true);
    });

    it('should recreate components with correct data', () => {
      world.registerComponent('Position');
      world.registerComponent('Health');
      const entity = world.createEntity();
      world.addComponent(entity, createPosition(42, 84));
      world.addComponent(entity, createHealth(75, 100));

      const snap = manager.snapshot(world, clock, eventLog);
      const restored = manager.restore(snap, World, WorldClock, EventLog);

      const pos = restored.world.getComponent<PositionComponent>(entity, 'Position');
      expect(pos).toBeDefined();
      expect(pos!.x).toBe(42);
      expect(pos!.y).toBe(84);

      const hp = restored.world.getComponent<HealthComponent>(entity, 'Health');
      expect(hp).toBeDefined();
      expect(hp!.current).toBe(75);
    });

    it('should create independent copy — modifying original doesn\'t affect restored', () => {
      world.registerComponent('Position');
      const entity = world.createEntity();
      world.addComponent(entity, createPosition(1, 2));

      const snap = manager.snapshot(world, clock, eventLog);
      const restored = manager.restore(snap, World, WorldClock, EventLog);

      // Mutate restored world
      const restoredPos = restored.world.getComponent<PositionComponent>(entity, 'Position');
      restoredPos!.x = 999;

      // Snapshot data unaffected (snapshot is deep-cloned again on restore)
      const snapPos = snap.componentData.get('Position')!.get(entity) as PositionComponent;
      expect(snapPos.x).toBe(1);
    });

    it('should restore event log with all events', () => {
      eventLog.append(makeEvent(1, 'a', 10));
      eventLog.append(makeEvent(5, 'b', 50));
      eventLog.append(makeEvent(10, 'c', 90));

      const snap = manager.snapshot(world, clock, eventLog);
      const restored = manager.restore(snap, World, WorldClock, EventLog);

      expect(restored.eventLog.getCount()).toBe(3);
      const all = restored.eventLog.getAll();
      expect(all[0]!.subtype).toBe('a');
      expect(all[1]!.subtype).toBe('b');
      expect(all[2]!.subtype).toBe('c');
    });

    it('should restore event log independently from original', () => {
      eventLog.append(makeEvent(1, 'before', 50));
      const snap = manager.snapshot(world, clock, eventLog);

      // Append to original after snapshot
      eventLog.append(makeEvent(2, 'after', 60));

      const restored = manager.restore(snap, World, WorldClock, EventLog);
      expect(restored.eventLog.getCount()).toBe(1);
      expect(eventLog.getCount()).toBe(2);
    });

    it('should handle empty world', () => {
      const snap = manager.snapshot(world, clock, eventLog);
      const restored = manager.restore(snap, World, WorldClock, EventLog);
      expect(restored.world.entityCount()).toBe(0);
      expect(restored.eventLog.getCount()).toBe(0);
      expect(restored.clock.currentTick).toBe(0);
    });

    it('should preserve component type registrations', () => {
      world.registerComponent('Position');
      world.registerComponent('Health');
      world.registerComponent('Ownership');

      const snap = manager.snapshot(world, clock, eventLog);
      const restored = manager.restore(snap, World, WorldClock, EventLog);

      expect(restored.world.hasStore('Position')).toBe(true);
      expect(restored.world.hasStore('Health')).toBe(true);
      expect(restored.world.hasStore('Ownership')).toBe(true);
    });
  });

  describe('round-trip', () => {
    it('should survive snapshot → restore → snapshot → restore', () => {
      world.registerComponent('Position');
      const entity = world.createEntity();
      world.addComponent(entity, createPosition(7, 14));
      clock.setTick(200);
      eventLog.append(makeEvent(100, 'history', 70));

      const snap1 = manager.snapshot(world, clock, eventLog);
      const r1 = manager.restore(snap1, World, WorldClock, EventLog);
      const snap2 = manager.snapshot(r1.world, r1.clock, r1.eventLog);
      const r2 = manager.restore(snap2, World, WorldClock, EventLog);

      expect(r2.clock.currentTick).toBe(200);
      expect(r2.eventLog.getCount()).toBe(1);
      const pos = r2.world.getComponent<PositionComponent>(entity, 'Position');
      expect(pos!.x).toBe(7);
    });
  });
});
