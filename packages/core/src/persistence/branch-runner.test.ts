import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world.js';
import { WorldClock } from '../time/world-clock.js';
import { EventLog } from '../events/event-log.js';
import { EventBus } from '../events/event-bus.js';
import { createEvent, resetEventIdCounter } from '../events/event-factory.js';
import { EventCategory } from '../events/types.js';
import { SimulationEngine } from '../engine/simulation-engine.js';
import { SystemRegistry } from '../engine/system-registry.js';
import type { PositionComponent, HealthComponent } from '../ecs/component.js';
import type { EntityId } from '../ecs/types.js';
import { toEntityId } from '../ecs/types.js';
import { WorldSnapshotManager, resetSnapshotIdCounter } from './world-snapshot.js';
import {
  BranchRunner,
  MAX_BRANCHES,
  resetBranchIdCounter,
} from './branch-runner.js';
import type {
  RemoveCharacter,
  AddEvent,
  DifferentSeed,
  ChangeDecision,
  ReverseOutcome,
  EngineFactory,
} from './branch-runner.js';

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

function makeEvent(tick: number, subtype: string, significance: number) {
  return createEvent({
    category: EventCategory.Personal,
    subtype,
    timestamp: tick,
    participants: [],
    significance,
  });
}

/** Minimal engine factory that creates an engine with no systems. */
const minimalEngineFactory: EngineFactory = (
  world: World,
  clock: WorldClock,
  eventBus: EventBus,
  eventLog: EventLog
): SimulationEngine => {
  const registry = new SystemRegistry();
  return new SimulationEngine(world, clock, eventBus, eventLog, registry);
};

// ─── Tests ──────────────────────────────────────────────────────

describe('BranchRunner', () => {
  let world: World;
  let clock: WorldClock;
  let eventLog: EventLog;
  let snapshotManager: WorldSnapshotManager;
  let runner: BranchRunner;

  beforeEach(() => {
    resetEventIdCounter();
    resetSnapshotIdCounter();
    resetBranchIdCounter();
    world = new World();
    clock = new WorldClock();
    eventLog = new EventLog();
    snapshotManager = new WorldSnapshotManager();
    runner = new BranchRunner(World, WorldClock, EventLog, EventBus);
  });

  describe('createBranch', () => {
    it('should create a branch from a snapshot', () => {
      world.registerComponent('Position');
      const entity = world.createEntity();
      world.addComponent(entity, createPosition(10, 20));
      clock.setTick(100);

      const snap = snapshotManager.snapshot(world, clock, eventLog);
      const branch = runner.createBranch(snap, { kind: 'DifferentSeed', seed: 42 });

      expect(branch.id).toBeDefined();
      expect(branch.sourceTick).toBe(100);
      expect(branch.clock.currentTick).toBe(100);
      expect(branch.seed).toBe(42);
    });

    it('should create branch with independent world state', () => {
      world.registerComponent('Position');
      const entity = world.createEntity();
      world.addComponent(entity, createPosition(5, 5));

      const snap = snapshotManager.snapshot(world, clock, eventLog);
      const branch = runner.createBranch(snap, { kind: 'DifferentSeed', seed: 1 });

      // Mutate original
      const origPos = world.getComponent<PositionComponent>(entity, 'Position');
      origPos!.x = 999;

      // Branch unaffected
      const branchPos = branch.world.getComponent<PositionComponent>(entity, 'Position');
      expect(branchPos!.x).toBe(5);
    });

    it('should enforce MAX_BRANCHES limit', () => {
      world.registerComponent('Position');
      const snap = snapshotManager.snapshot(world, clock, eventLog);

      for (let i = 0; i < MAX_BRANCHES; i++) {
        runner.createBranch(snap, { kind: 'DifferentSeed', seed: i });
      }

      expect(() =>
        runner.createBranch(snap, { kind: 'DifferentSeed', seed: 99 })
      ).toThrow(`Cannot create more than ${MAX_BRANCHES} branches`);
    });
  });

  describe('DivergenceAction: RemoveCharacter', () => {
    it('should remove a character from the branch world', () => {
      world.registerComponent('Position');
      world.registerComponent('Health');
      const character = world.createEntity();
      world.addComponent(character, createPosition(1, 1));
      world.addComponent(character, createHealth(100, 100));

      const snap = snapshotManager.snapshot(world, clock, eventLog);
      const action: RemoveCharacter = {
        kind: 'RemoveCharacter',
        characterId: character,
      };
      const branch = runner.createBranch(snap, action);

      expect(branch.world.isAlive(character)).toBe(false);
      // Original world unaffected
      expect(world.isAlive(character)).toBe(true);
    });
  });

  describe('DivergenceAction: AddEvent', () => {
    it('should inject an event into the branch event log', () => {
      const snap = snapshotManager.snapshot(world, clock, eventLog);
      const injectedEvent = makeEvent(50, 'injected.disaster', 95);
      const action: AddEvent = {
        kind: 'AddEvent',
        event: injectedEvent,
      };
      const branch = runner.createBranch(snap, action);

      expect(branch.eventLog.getCount()).toBe(1);
      const events = branch.eventLog.getAll();
      expect(events[0]!.subtype).toBe('injected.disaster');
    });
  });

  describe('DivergenceAction: DifferentSeed', () => {
    it('should set branch seed', () => {
      const snap = snapshotManager.snapshot(world, clock, eventLog);
      const action: DifferentSeed = { kind: 'DifferentSeed', seed: 12345 };
      const branch = runner.createBranch(snap, action);

      expect(branch.seed).toBe(12345);
    });
  });

  describe('DivergenceAction: ChangeDecision', () => {
    it('should patch component data on the character', () => {
      world.registerComponent('Position');
      const entity = world.createEntity();
      world.addComponent(entity, createPosition(10, 20));

      const snap = snapshotManager.snapshot(world, clock, eventLog);
      const action: ChangeDecision = {
        kind: 'ChangeDecision',
        characterId: entity,
        componentType: 'Position',
        patch: { x: 50, y: 60 },
      };
      const branch = runner.createBranch(snap, action);

      const pos = branch.world.getComponent<PositionComponent>(entity, 'Position');
      expect(pos!.x).toBe(50);
      expect(pos!.y).toBe(60);
    });
  });

  describe('DivergenceAction: ReverseOutcome', () => {
    it('should append a reversed event to the branch log', () => {
      const event = makeEvent(10, 'battle.resolved', 80);
      eventLog.append(event);

      const snap = snapshotManager.snapshot(world, clock, eventLog);
      const action: ReverseOutcome = {
        kind: 'ReverseOutcome',
        eventId: event.id,
        patchData: { winner: 'faction_B' },
      };
      const branch = runner.createBranch(snap, action);

      // Original event + reversed event
      expect(branch.eventLog.getCount()).toBe(2);
      const all = branch.eventLog.getAll();
      const reversed = all[1];
      expect(reversed!.subtype).toBe('battle.resolved.reversed');
      expect((reversed!.data as Record<string, unknown>)['winner']).toBe('faction_B');
      expect((reversed!.data as Record<string, unknown>)['reversed']).toBe(true);
    });
  });

  describe('runBranch', () => {
    it('should advance the branch clock by N ticks', () => {
      clock.setTick(50);
      const snap = snapshotManager.snapshot(world, clock, eventLog);
      const branch = runner.createBranch(snap, { kind: 'DifferentSeed', seed: 1 });

      const result = runner.runBranch(branch.id, 10, minimalEngineFactory);

      expect(result.ticksRun).toBe(10);
      expect(result.startTick).toBe(50);
      expect(result.endTick).toBe(60);
      expect(branch.clock.currentTick).toBe(60);
    });

    it('should not affect main world', () => {
      world.registerComponent('Position');
      const entity = world.createEntity();
      world.addComponent(entity, createPosition(1, 1));
      clock.setTick(0);

      const snap = snapshotManager.snapshot(world, clock, eventLog);
      const branch = runner.createBranch(snap, { kind: 'DifferentSeed', seed: 1 });
      runner.runBranch(branch.id, 100, minimalEngineFactory);

      // Main clock unchanged
      expect(clock.currentTick).toBe(0);
    });

    it('should throw for unknown branch ID', () => {
      expect(() =>
        runner.runBranch('nonexistent', 10, minimalEngineFactory)
      ).toThrow("Branch 'nonexistent' not found");
    });
  });

  describe('getActiveBranches', () => {
    it('should return all branches', () => {
      const snap = snapshotManager.snapshot(world, clock, eventLog);
      runner.createBranch(snap, { kind: 'DifferentSeed', seed: 1 });
      runner.createBranch(snap, { kind: 'DifferentSeed', seed: 2 });

      expect(runner.getActiveBranches().length).toBe(2);
    });
  });

  describe('deleteBranch', () => {
    it('should remove a branch', () => {
      const snap = snapshotManager.snapshot(world, clock, eventLog);
      const branch = runner.createBranch(snap, { kind: 'DifferentSeed', seed: 1 });
      expect(runner.getActiveBranches().length).toBe(1);

      runner.deleteBranch(branch.id);
      expect(runner.getActiveBranches().length).toBe(0);
    });

    it('should allow creating new branch after deletion', () => {
      const snap = snapshotManager.snapshot(world, clock, eventLog);

      // Fill to max
      const branches = [];
      for (let i = 0; i < MAX_BRANCHES; i++) {
        branches.push(runner.createBranch(snap, { kind: 'DifferentSeed', seed: i }));
      }

      // Delete one and create another
      runner.deleteBranch(branches[0]!.id);
      const newBranch = runner.createBranch(snap, { kind: 'DifferentSeed', seed: 99 });
      expect(newBranch).toBeDefined();
      expect(runner.getActiveBranches().length).toBe(MAX_BRANCHES);
    });
  });

  describe('getBranch', () => {
    it('should return branch by ID', () => {
      const snap = snapshotManager.snapshot(world, clock, eventLog);
      const branch = runner.createBranch(snap, { kind: 'DifferentSeed', seed: 1 });

      expect(runner.getBranch(branch.id)).toBe(branch);
    });

    it('should return undefined for unknown ID', () => {
      expect(runner.getBranch('nope')).toBeUndefined();
    });
  });
});
