/**
 * WorldSnapshotManager — deep-clones world state for "What If" branching.
 *
 * snapshot() captures all entity components and event log state.
 * restore() reconstructs an independent World + Clock + EventLog from a snapshot.
 *
 * This is expensive — only triggered by explicit player action.
 */

import type { EntityId } from '../ecs/types.js';
import type { Component, ComponentType } from '../ecs/component.js';
import type { World } from '../ecs/world.js';
import type { WorldClock } from '../time/world-clock.js';
import type { EventLog } from '../events/event-log.js';
import type { WorldEvent } from '../events/types.js';

/**
 * Serialized component data: ComponentType → (EntityId → cloned Component).
 */
export type ComponentSnapshot = ReadonlyMap<ComponentType, ReadonlyMap<EntityId, Component>>;

/**
 * Immutable deep-clone of the world at a point in time.
 */
export interface WorldSnapshot {
  readonly id: string;
  readonly label: string;
  readonly tick: number;
  readonly aliveEntities: ReadonlySet<EntityId>;
  readonly maxEntityId: number;
  readonly componentData: ComponentSnapshot;
  readonly events: readonly WorldEvent[];
  readonly createdAt: number;
}

let snapshotCounter = 0;

function generateSnapshotId(): string {
  return `snapshot-${Date.now()}-${snapshotCounter++}`;
}

/**
 * Reset the snapshot ID counter (for testing).
 */
export function resetSnapshotIdCounter(): void {
  snapshotCounter = 0;
}

/**
 * Recursively deep-clone a value.
 * Handles Maps, Sets, arrays, plain objects, and preserves function references.
 * structuredClone can't clone functions (e.g. Component.serialize),
 * so we do it manually.
 */
function deepCloneValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'function') return value; // preserve method refs
  if (typeof value !== 'object') return value; // primitives

  if (value instanceof Map) {
    const clone = new Map();
    for (const [k, v] of value) {
      clone.set(k, deepCloneValue(v));
    }
    return clone;
  }

  if (value instanceof Set) {
    const clone = new Set();
    for (const v of value) {
      clone.add(deepCloneValue(v));
    }
    return clone;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepCloneValue(item));
  }

  // Plain object
  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    clone[key] = deepCloneValue((value as Record<string, unknown>)[key]);
  }
  return clone;
}

/**
 * Deep-clone a single component.
 * Components may contain Maps, arrays, and a serialize() method.
 */
function deepCloneComponent(component: Component): Component {
  return deepCloneValue(component) as Component;
}

/**
 * Deep-clone a WorldEvent.
 */
function deepCloneEvent(event: WorldEvent): WorldEvent {
  return deepCloneValue(event) as WorldEvent;
}

export class WorldSnapshotManager {
  /**
   * Create an immutable snapshot of the entire world state.
   * Deep-clones all entity components and event log contents.
   */
  snapshot(
    world: World,
    clock: WorldClock,
    eventLog: EventLog,
    label?: string
  ): WorldSnapshot {
    const aliveEntities = new Set(world.getAllEntities());

    // Find the highest entity ID to know how many to recreate on restore
    let maxEntityId = -1;
    for (const id of aliveEntities) {
      if (id > maxEntityId) {
        maxEntityId = id;
      }
    }

    // Deep-clone every registered component store
    const componentData = new Map<ComponentType, Map<EntityId, Component>>();
    for (const type of world.getRegisteredComponentTypes()) {
      const store = world.getStore(type);
      const entries = new Map<EntityId, Component>();
      for (const [entityId, component] of store.getAll()) {
        entries.set(entityId, deepCloneComponent(component));
      }
      componentData.set(type, entries);
    }

    // Deep-clone event log (chronological order)
    const events = eventLog.getAll().map(deepCloneEvent);

    return {
      id: generateSnapshotId(),
      label: label ?? `Snapshot at tick ${clock.currentTick}`,
      tick: clock.currentTick,
      aliveEntities,
      maxEntityId,
      componentData,
      events,
      createdAt: Date.now(),
    };
  }

  /**
   * Reconstruct independent World + Clock + EventLog from a snapshot.
   * The returned objects share no references with the original.
   */
  restore(
    snapshot: WorldSnapshot,
    WorldClass: new () => World,
    ClockClass: new () => WorldClock,
    EventLogClass: new () => EventLog
  ): { world: World; clock: WorldClock; eventLog: EventLog } {
    const world = new WorldClass();
    const clock = new ClockClass();
    const eventLog = new EventLogClass();

    // Restore clock position
    clock.setTick(snapshot.tick);

    // Register component types
    for (const [type] of snapshot.componentData) {
      world.registerComponent(type);
    }

    // Create entities 0..maxEntityId so internal IDs match the snapshot.
    // EntityManager assigns monotonic IDs (0, 1, 2, ...).
    for (let i = 0; i <= snapshot.maxEntityId; i++) {
      world.createEntity();
    }

    // Destroy entities that were dead in the snapshot
    for (let i = 0; i <= snapshot.maxEntityId; i++) {
      const id = i as EntityId;
      if (!snapshot.aliveEntities.has(id)) {
        world.destroyEntity(id);
      }
    }

    // Populate component data (deep-clone again to keep snapshot immutable)
    for (const [type, entries] of snapshot.componentData) {
      const store = world.getStore(type);
      for (const [entityId, component] of entries) {
        store.set(entityId, deepCloneComponent(component));
      }
    }

    // Restore events
    for (const event of snapshot.events) {
      eventLog.append(deepCloneEvent(event));
    }

    return { world, clock, eventLog };
  }
}
