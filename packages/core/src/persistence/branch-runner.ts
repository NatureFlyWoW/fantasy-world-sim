/**
 * BranchRunner — "What If" timeline branching.
 *
 * Creates alternate timeline branches from a WorldSnapshot,
 * applies a DivergenceAction, and runs independent simulation.
 *
 * MAX_BRANCHES = 3 to cap memory.
 */

import type { EntityId, EventId } from '../ecs/types.js';
import type { Component, ComponentType } from '../ecs/component.js';
import type { World } from '../ecs/world.js';
import type { WorldClock } from '../time/world-clock.js';
import type { EventBus } from '../events/event-bus.js';
import type { EventLog } from '../events/event-log.js';
import type { SimulationEngine } from '../engine/simulation-engine.js';
import type { WorldEvent } from '../events/types.js';
import { createEvent } from '../events/event-factory.js';
import type { WorldSnapshot } from './world-snapshot.js';
import { WorldSnapshotManager } from './world-snapshot.js';

// ──────────────────────────────────────────────────────────────────
// Divergence action types
// ──────────────────────────────────────────────────────────────────

/**
 * Reverse the outcome of a specific event.
 * The event's data is replaced with the supplied patch.
 */
export interface ReverseOutcome {
  readonly kind: 'ReverseOutcome';
  readonly eventId: EventId;
  readonly patchData: Readonly<Record<string, unknown>>;
}

/**
 * Remove a character — they never existed from this point forward.
 * All their components are deleted and references cleaned.
 */
export interface RemoveCharacter {
  readonly kind: 'RemoveCharacter';
  readonly characterId: EntityId;
}

/**
 * A character makes a different choice.
 * Replaces specific component data to reflect the new decision.
 */
export interface ChangeDecision {
  readonly kind: 'ChangeDecision';
  readonly characterId: EntityId;
  readonly componentType: ComponentType;
  readonly patch: Readonly<Record<string, unknown>>;
}

/**
 * Inject an event that didn't originally happen.
 */
export interface AddEvent {
  readonly kind: 'AddEvent';
  readonly event: WorldEvent;
}

/**
 * Same world state, different random seed going forward.
 */
export interface DifferentSeed {
  readonly kind: 'DifferentSeed';
  readonly seed: number;
}

export type DivergenceAction =
  | ReverseOutcome
  | RemoveCharacter
  | ChangeDecision
  | AddEvent
  | DifferentSeed;

// ──────────────────────────────────────────────────────────────────
// Branch types
// ──────────────────────────────────────────────────────────────────

/**
 * A timeline branch holds its own independent simulation state.
 */
export interface Branch {
  readonly id: string;
  readonly label: string;
  readonly divergence: DivergenceAction;
  readonly sourceSnapshotId: string;
  readonly sourceTick: number;
  readonly world: World;
  readonly clock: WorldClock;
  readonly eventLog: EventLog;
  readonly seed: number;
  readonly createdAt: number;
}

/**
 * Result returned after running a branch for N ticks.
 */
export interface BranchResult {
  readonly branchId: string;
  readonly ticksRun: number;
  readonly startTick: number;
  readonly endTick: number;
  readonly eventsGenerated: readonly WorldEvent[];
  readonly entityCountAtEnd: number;
}

// ──────────────────────────────────────────────────────────────────
// Engine factory type
// ──────────────────────────────────────────────────────────────────

/**
 * Factory function the caller provides to wire up a SimulationEngine
 * for a restored World/Clock/EventBus/EventLog.
 * Returns the engine and the EventBus so the runner can collect events.
 */
export type EngineFactory = (
  world: World,
  clock: WorldClock,
  eventBus: EventBus,
  eventLog: EventLog
) => SimulationEngine;

// ──────────────────────────────────────────────────────────────────
// BranchRunner
// ──────────────────────────────────────────────────────────────────

export const MAX_BRANCHES = 3;

let branchCounter = 0;

function generateBranchId(): string {
  return `branch-${Date.now()}-${branchCounter++}`;
}

/**
 * Reset the branch ID counter (for testing).
 */
export function resetBranchIdCounter(): void {
  branchCounter = 0;
}

export class BranchRunner {
  private readonly branches: Map<string, Branch> = new Map();
  private readonly snapshotManager = new WorldSnapshotManager();

  constructor(
    private readonly WorldClass: new () => World,
    private readonly ClockClass: new () => WorldClock,
    private readonly EventLogClass: new () => EventLog,
    private readonly EventBusClass: new () => EventBus
  ) {}

  /**
   * Create a new branch from a snapshot with the given divergence.
   * @throws Error if MAX_BRANCHES is already reached.
   */
  createBranch(
    snapshot: WorldSnapshot,
    divergence: DivergenceAction,
    label?: string
  ): Branch {
    if (this.branches.size >= MAX_BRANCHES) {
      throw new Error(
        `Cannot create more than ${MAX_BRANCHES} branches. Delete one first.`
      );
    }

    // Restore independent world state from snapshot
    const { world, clock, eventLog } = this.snapshotManager.restore(
      snapshot,
      this.WorldClass,
      this.ClockClass,
      this.EventLogClass
    );

    // Apply the divergence action
    const seed = this.applyDivergence(world, clock, eventLog, divergence);

    const branch: Branch = {
      id: generateBranchId(),
      label: label ?? `Branch: ${divergence.kind}`,
      divergence,
      sourceSnapshotId: snapshot.id,
      sourceTick: snapshot.tick,
      world,
      clock,
      eventLog,
      seed,
      createdAt: Date.now(),
    };

    this.branches.set(branch.id, branch);
    return branch;
  }

  /**
   * Run a branch's simulation for N ticks.
   * Requires an EngineFactory to create the simulation engine.
   */
  runBranch(
    branchId: string,
    ticks: number,
    engineFactory: EngineFactory
  ): BranchResult {
    const branch = this.branches.get(branchId);
    if (branch === undefined) {
      throw new Error(`Branch '${branchId}' not found`);
    }

    const eventBus = new this.EventBusClass();
    const startTick = branch.clock.currentTick;

    // Collect events emitted during the branch run
    const eventsGenerated: WorldEvent[] = [];
    eventBus.onAny((event) => {
      eventsGenerated.push(event);
    });

    const engine = engineFactory(
      branch.world,
      branch.clock,
      eventBus,
      branch.eventLog
    );

    engine.initialize();
    engine.run(ticks);

    return {
      branchId: branch.id,
      ticksRun: ticks,
      startTick,
      endTick: branch.clock.currentTick,
      eventsGenerated,
      entityCountAtEnd: branch.world.entityCount(),
    };
  }

  /**
   * Get all active branches.
   */
  getActiveBranches(): Branch[] {
    return Array.from(this.branches.values());
  }

  /**
   * Get a branch by ID.
   */
  getBranch(branchId: string): Branch | undefined {
    return this.branches.get(branchId);
  }

  /**
   * Delete a branch and free its resources.
   */
  deleteBranch(branchId: string): void {
    this.branches.delete(branchId);
  }

  // ─── Private helpers ──────────────────────────────────────────

  /**
   * Apply a DivergenceAction to the restored world state.
   * Returns the seed for the branch (0 unless DifferentSeed).
   */
  private applyDivergence(
    world: World,
    _clock: WorldClock,
    eventLog: EventLog,
    action: DivergenceAction
  ): number {
    switch (action.kind) {
      case 'ReverseOutcome':
        return this.applyReverseOutcome(eventLog, action);
      case 'RemoveCharacter':
        return this.applyRemoveCharacter(world, action);
      case 'ChangeDecision':
        return this.applyChangeDecision(world, action);
      case 'AddEvent':
        return this.applyAddEvent(eventLog, action);
      case 'DifferentSeed':
        return action.seed;
    }
  }

  private applyReverseOutcome(
    eventLog: EventLog,
    action: ReverseOutcome
  ): number {
    // Append a "reversal" event linked to the original via causes.
    // The original event stays in the log for causal chain tracking.
    const original = eventLog.getById(action.eventId);
    if (original !== undefined) {
      const reversalEvent = createEvent({
        category: original.category,
        subtype: `${original.subtype}.reversed`,
        timestamp: original.timestamp,
        participants: [...original.participants],
        significance: original.significance,
        data: { ...original.data, ...action.patchData, reversed: true },
        causes: [original.id],
      });
      eventLog.append(reversalEvent);
    }
    return 0;
  }

  private applyRemoveCharacter(
    world: World,
    action: RemoveCharacter
  ): number {
    if (world.isAlive(action.characterId)) {
      world.destroyEntity(action.characterId);
    }
    return 0;
  }

  private applyChangeDecision(
    world: World,
    action: ChangeDecision
  ): number {
    const existing = world.getComponent(action.characterId, action.componentType);
    if (existing !== undefined) {
      // Merge patch into existing component
      const patched = { ...existing, ...action.patch } as Component;
      world.getStore(action.componentType).set(action.characterId, patched);
    }
    return 0;
  }

  private applyAddEvent(
    eventLog: EventLog,
    action: AddEvent
  ): number {
    eventLog.append(structuredClone(action.event));
    return 0;
  }
}
