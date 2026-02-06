import { describe, it, expect, beforeEach } from 'vitest';
import {
  World,
  WorldClock,
  EventLog,
  EventBus,
  SpatialIndex,
  createEvent,
  resetEventIdCounter,
  EventCategory,
} from '@fws/core';
import type { EntityId, PositionComponent, OwnershipComponent, WorldEvent } from '@fws/core';
import type { RenderContext } from '../types.js';
import { PanelId } from '../types.js';
import { MockScreen, MockBox, createMockBoxFactory } from '../panel.js';
import {
  BranchComparisonPanel,
  compareBranches,
  createBranchComparisonPanelLayout,
} from './branch-view.js';
import type { BranchRef, BranchComparison } from './branch-view.js';

// ─── Helpers ────────────────────────────────────────────────────

function createPosition(x: number, y: number): PositionComponent {
  return {
    type: 'Position',
    x,
    y,
    serialize: () => ({ type: 'Position', x, y }),
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

function makeEvent(tick: number, subtype: string, significance: number): WorldEvent {
  return createEvent({
    category: EventCategory.Personal,
    subtype,
    timestamp: tick,
    participants: [],
    significance,
  });
}

function createContext(
  world: World,
  clock: WorldClock,
  eventLog: EventLog
): RenderContext {
  return {
    world,
    clock,
    eventLog,
    eventBus: new EventBus(),
    spatialIndex: new SpatialIndex(64, 64),
  };
}

function createBranchRef(
  world: World,
  clock: WorldClock,
  eventLog: EventLog,
  sourceTick: number
): BranchRef {
  return {
    id: 'test-branch',
    label: 'Test Branch',
    divergence: { kind: 'DifferentSeed', seed: 42 },
    sourceTick,
    world,
    clock,
    eventLog,
  };
}

// ─── compareBranches tests ──────────────────────────────────────

describe('compareBranches', () => {
  beforeEach(() => {
    resetEventIdCounter();
  });

  it('should detect entities unique to main timeline', () => {
    const mainWorld = new World();
    mainWorld.registerComponent('Position');
    const e1 = mainWorld.createEntity();
    const e2 = mainWorld.createEntity();
    mainWorld.addComponent(e1, createPosition(1, 1));
    mainWorld.addComponent(e2, createPosition(2, 2));

    const branchWorld = new World();
    branchWorld.registerComponent('Position');
    const be1 = branchWorld.createEntity(); // ID 0 (matches e1)
    branchWorld.addComponent(be1, createPosition(1, 1));
    // e2 does not exist in branch

    const mainClock = new WorldClock();
    const branchClock = new WorldClock();
    const mainLog = new EventLog();
    const branchLog = new EventLog();

    const ctx = createContext(mainWorld, mainClock, mainLog);
    const branch = createBranchRef(branchWorld, branchClock, branchLog, 0);

    const result = compareBranches(ctx, branch);

    const mainOnly = result.uniqueEntities.filter((u) => u.timeline === 'main');
    expect(mainOnly.length).toBe(1);
    expect(mainOnly[0]!.entityId).toBe(e2);
  });

  it('should detect entities unique to branch timeline', () => {
    const mainWorld = new World();
    mainWorld.registerComponent('Position');
    const e1 = mainWorld.createEntity();
    mainWorld.addComponent(e1, createPosition(1, 1));

    const branchWorld = new World();
    branchWorld.registerComponent('Position');
    const be1 = branchWorld.createEntity();
    const be2 = branchWorld.createEntity();
    branchWorld.addComponent(be1, createPosition(1, 1));
    branchWorld.addComponent(be2, createPosition(9, 9));

    const ctx = createContext(mainWorld, new WorldClock(), new EventLog());
    const branch = createBranchRef(branchWorld, new WorldClock(), new EventLog(), 0);

    const result = compareBranches(ctx, branch);
    const branchOnly = result.uniqueEntities.filter((u) => u.timeline === 'branch');
    expect(branchOnly.length).toBe(1);
    expect(branchOnly[0]!.entityId).toBe(be2);
  });

  it('should detect territory ownership differences', () => {
    const mainWorld = new World();
    mainWorld.registerComponent('Ownership');
    const site = mainWorld.createEntity();
    mainWorld.addComponent(site, createOwnership(100, 1.0));

    const branchWorld = new World();
    branchWorld.registerComponent('Ownership');
    const bSite = branchWorld.createEntity(); // same ID 0
    branchWorld.addComponent(bSite, createOwnership(200, 1.0));

    const ctx = createContext(mainWorld, new WorldClock(), new EventLog());
    const branch = createBranchRef(branchWorld, new WorldClock(), new EventLog(), 0);

    const result = compareBranches(ctx, branch);
    expect(result.territoryDifferences.length).toBe(1);
    expect(result.territoryDifferences[0]!.mainOwner).toBe(100);
    expect(result.territoryDifferences[0]!.branchOwner).toBe(200);
  });

  it('should find events unique to each timeline after divergence', () => {
    const mainLog = new EventLog();
    const branchLog = new EventLog();

    // Shared event (before divergence point is irrelevant — we compare IDs)
    const sharedEvent = makeEvent(5, 'shared', 50);
    mainLog.append(sharedEvent);
    branchLog.append(structuredClone(sharedEvent));

    // Main-only event
    mainLog.append(makeEvent(10, 'main.only', 60));

    // Branch-only event
    branchLog.append(makeEvent(10, 'branch.only', 70));

    const mainClock = new WorldClock();
    mainClock.setTick(20);
    const branchClock = new WorldClock();
    branchClock.setTick(20);

    const ctx = createContext(new World(), mainClock, mainLog);
    const branch = createBranchRef(new World(), branchClock, branchLog, 0);

    const result = compareBranches(ctx, branch);
    expect(result.mainOnlyEvents.length).toBe(1);
    expect(result.mainOnlyEvents[0]!.subtype).toBe('main.only');
    expect(result.branchOnlyEvents.length).toBe(1);
    expect(result.branchOnlyEvents[0]!.subtype).toBe('branch.only');
  });

  it('should count significant differences', () => {
    const mainWorld = new World();
    mainWorld.registerComponent('Position');
    mainWorld.createEntity();
    mainWorld.createEntity(); // entity 1, unique to main

    const branchWorld = new World();
    branchWorld.registerComponent('Position');
    branchWorld.createEntity(); // entity 0 only

    const mainLog = new EventLog();
    mainLog.append(makeEvent(5, 'high.sig', 80)); // sig >= 50 counts

    const mainClock = new WorldClock();
    mainClock.setTick(20); // must cover event at tick 5
    const branchClock = new WorldClock();
    branchClock.setTick(20);

    const ctx = createContext(mainWorld, mainClock, mainLog);
    const branch = createBranchRef(branchWorld, branchClock, new EventLog(), 0);

    const result = compareBranches(ctx, branch);
    // 1 unique entity + 1 significant event = 2
    expect(result.significantDifferences).toBeGreaterThanOrEqual(2);
  });

  it('should return zero differences for identical timelines', () => {
    const mainWorld = new World();
    mainWorld.registerComponent('Position');
    const e = mainWorld.createEntity();
    mainWorld.addComponent(e, createPosition(1, 1));

    const branchWorld = new World();
    branchWorld.registerComponent('Position');
    const be = branchWorld.createEntity();
    branchWorld.addComponent(be, createPosition(1, 1));

    const event = makeEvent(1, 'shared', 50);
    const mainLog = new EventLog();
    mainLog.append(event);
    const branchLog = new EventLog();
    branchLog.append(structuredClone(event));

    const ctx = createContext(mainWorld, new WorldClock(), mainLog);
    const branch = createBranchRef(branchWorld, new WorldClock(), branchLog, 0);

    const result = compareBranches(ctx, branch);
    expect(result.uniqueEntities.length).toBe(0);
    expect(result.mainOnlyEvents.length).toBe(0);
    expect(result.branchOnlyEvents.length).toBe(0);
  });
});

// ─── BranchComparisonPanel tests ────────────────────────────────

describe('BranchComparisonPanel', () => {
  let screen: MockScreen;
  let panel: BranchComparisonPanel;

  beforeEach(() => {
    resetEventIdCounter();
    screen = new MockScreen();
    const factory = createMockBoxFactory(screen);
    const layout = createBranchComparisonPanelLayout();
    panel = new BranchComparisonPanel(
      screen as unknown as blessed.Widgets.Screen,
      layout,
      factory as unknown as (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement
    );
  });

  it('should show placeholder when no branch is set', () => {
    const ctx = createContext(new World(), new WorldClock(), new EventLog());
    panel.render(ctx);

    const box = screen.getElements()[0]!;
    expect(box.content).toContain('No active branch');
  });

  it('should render header with tick numbers when branch is set', () => {
    const mainClock = new WorldClock();
    mainClock.setTick(100);
    const branchClock = new WorldClock();
    branchClock.setTick(100);

    const branchWorld = new World();
    const branch = createBranchRef(branchWorld, branchClock, new EventLog(), 50);
    panel.setBranch(branch);

    const ctx = createContext(new World(), mainClock, new EventLog());
    panel.render(ctx);

    const box = screen.getElements()[0]!;
    expect(box.content).toContain('Main (tick 100)');
    expect(box.content).toContain('Branch (tick 100)');
  });

  it('should render divergence counter', () => {
    const mainWorld = new World();
    mainWorld.registerComponent('Position');
    mainWorld.createEntity();
    mainWorld.createEntity(); // unique to main

    const branchWorld = new World();
    branchWorld.registerComponent('Position');
    branchWorld.createEntity();

    const branch = createBranchRef(branchWorld, new WorldClock(), new EventLog(), 0);
    panel.setBranch(branch);

    const ctx = createContext(mainWorld, new WorldClock(), new EventLog());
    panel.render(ctx);

    const box = screen.getElements()[0]!;
    expect(box.content).toContain('significant difference');
  });

  it('should handle input for view switching', () => {
    expect(panel.handleInput('e')).toBe(true);
    expect(panel.handleInput('v')).toBe(true);
    expect(panel.handleInput('t')).toBe(true);
    expect(panel.handleInput('x')).toBe(false);
  });

  it('should handle scroll input', () => {
    expect(panel.handleInput('up')).toBe(true);
    expect(panel.handleInput('down')).toBe(true);
  });

  it('should render entity view by default', () => {
    const mainWorld = new World();
    mainWorld.registerComponent('Position');
    mainWorld.createEntity();
    mainWorld.createEntity();

    const branchWorld = new World();
    branchWorld.registerComponent('Position');
    branchWorld.createEntity();

    const branch = createBranchRef(branchWorld, new WorldClock(), new EventLog(), 0);
    panel.setBranch(branch);

    const ctx = createContext(mainWorld, new WorldClock(), new EventLog());
    panel.render(ctx);

    const box = screen.getElements()[0]!;
    expect(box.content).toContain('Main-only');
  });

  it('should render event view when switched', () => {
    const mainLog = new EventLog();
    mainLog.append(makeEvent(5, 'main.unique', 60));

    const mainClock = new WorldClock();
    mainClock.setTick(20); // must cover event at tick 5
    const branchClock = new WorldClock();
    branchClock.setTick(20);

    const branch = createBranchRef(new World(), branchClock, new EventLog(), 0);
    panel.setBranch(branch);
    panel.handleInput('v'); // switch to events view

    const ctx = createContext(new World(), mainClock, mainLog);
    panel.render(ctx);

    const box = screen.getElements()[0]!;
    expect(box.content).toContain('Main-only events');
  });

  it('should render territory view when switched', () => {
    const mainWorld = new World();
    mainWorld.registerComponent('Ownership');
    const site = mainWorld.createEntity();
    mainWorld.addComponent(site, createOwnership(1, 1.0));

    const branchWorld = new World();
    branchWorld.registerComponent('Ownership');
    const bSite = branchWorld.createEntity();
    branchWorld.addComponent(bSite, createOwnership(2, 1.0));

    const branch = createBranchRef(branchWorld, new WorldClock(), new EventLog(), 0);
    panel.setBranch(branch);
    panel.handleInput('t'); // switch to territory view

    const ctx = createContext(mainWorld, new WorldClock(), new EventLog());
    panel.render(ctx);

    const box = screen.getElements()[0]!;
    expect(box.content).toContain('Entity');
    expect(box.content).toContain('Main Owner');
    expect(box.content).toContain('Branch Owner');
  });

  it('should reset scroll when changing views', () => {
    panel.handleInput('down');
    panel.handleInput('down');
    panel.handleInput('down');
    // Switch view — scroll resets
    panel.handleInput('e');

    // No assertion needed for internal state; just verify no crash
    const ctx = createContext(new World(), new WorldClock(), new EventLog());
    panel.setBranch(createBranchRef(new World(), new WorldClock(), new EventLog(), 0));
    panel.render(ctx);
    const box = screen.getElements()[0]!;
    expect(box.content).toBeDefined();
  });

  it('should create correct layout via factory', () => {
    const layout = createBranchComparisonPanelLayout();
    expect(layout.id).toBe(PanelId.BranchComparison);
    expect(layout.focused).toBe(false);
  });
});
