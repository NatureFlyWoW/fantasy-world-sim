import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimulationEngine } from './simulation-engine.js';
import { SystemRegistry } from './system-registry.js';
import { World } from '../ecs/world.js';
import { WorldClock } from '../time/world-clock.js';
import { EventBus } from '../events/event-bus.js';
import { EventLog } from '../events/event-log.js';
import { TickFrequency } from '../time/types.js';
import { ExecutionOrder, type System, type ExecutionOrderValue } from './system.js';
import { EventCategory, type WorldEvent } from '../events/types.js';
import { createSimpleEvent, resetEventIdCounter } from '../events/event-factory.js';
import { toEntityId } from '../ecs/types.js';

// Test helper to create mock systems
function createMockSystem(
  name: string,
  frequency: TickFrequency,
  executionOrder: ExecutionOrderValue,
  onExecute?: (world: World, clock: WorldClock, events: EventBus) => void
): System {
  return {
    name,
    frequency,
    executionOrder,
    initialize: vi.fn(),
    execute: vi.fn(onExecute ?? (() => {})),
    cleanup: vi.fn(),
  };
}

describe('SimulationEngine', () => {
  let world: World;
  let clock: WorldClock;
  let eventBus: EventBus;
  let eventLog: EventLog;
  let registry: SystemRegistry;
  let engine: SimulationEngine;

  beforeEach(() => {
    world = new World();
    clock = new WorldClock();
    eventBus = new EventBus();
    eventLog = new EventLog();
    registry = new SystemRegistry();
    engine = new SimulationEngine(world, clock, eventBus, eventLog, registry);
    resetEventIdCounter();
  });

  describe('initialization', () => {
    it('should not be initialized by default', () => {
      expect(engine.isInitialized()).toBe(false);
    });

    it('should initialize all systems on first tick', () => {
      const system1 = createMockSystem('TestSystem1', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT);
      const system2 = createMockSystem('TestSystem2', TickFrequency.Daily, ExecutionOrder.ECONOMY);
      registry.register(system1);
      registry.register(system2);

      engine.tick();

      expect(system1.initialize).toHaveBeenCalledWith(world);
      expect(system2.initialize).toHaveBeenCalledWith(world);
      expect(engine.isInitialized()).toBe(true);
    });

    it('should only initialize once', () => {
      const system = createMockSystem('TestSystem', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT);
      registry.register(system);

      engine.tick();
      engine.tick();
      engine.tick();

      expect(system.initialize).toHaveBeenCalledTimes(1);
    });

    it('should allow manual initialization', () => {
      const system = createMockSystem('TestSystem', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT);
      registry.register(system);

      engine.initialize();

      expect(system.initialize).toHaveBeenCalledTimes(1);
      expect(engine.isInitialized()).toBe(true);
    });
  });

  describe('tick execution', () => {
    it('should advance the clock on each tick', () => {
      expect(clock.currentTick).toBe(0);

      engine.tick();
      expect(clock.currentTick).toBe(1);

      engine.tick();
      expect(clock.currentTick).toBe(2);
    });

    it('should execute systems in order', () => {
      const executionLog: string[] = [];

      const system1 = createMockSystem(
        'Environment',
        TickFrequency.Daily,
        ExecutionOrder.ENVIRONMENT,
        () => executionLog.push('environment')
      );
      const system2 = createMockSystem(
        'Politics',
        TickFrequency.Daily,
        ExecutionOrder.POLITICS,
        () => executionLog.push('politics')
      );
      const system3 = createMockSystem(
        'Economy',
        TickFrequency.Daily,
        ExecutionOrder.ECONOMY,
        () => executionLog.push('economy')
      );

      registry.register(system1);
      registry.register(system2);
      registry.register(system3);

      engine.tick();

      // Should execute in order: environment (2), economy (3), politics (4)
      expect(executionLog).toEqual(['environment', 'economy', 'politics']);
    });

    it('should increment tick count', () => {
      expect(engine.getTickCount()).toBe(0);

      engine.tick();
      expect(engine.getTickCount()).toBe(1);

      engine.tick();
      engine.tick();
      expect(engine.getTickCount()).toBe(3);
    });
  });

  describe('frequency filtering', () => {
    it('should run daily systems every tick', () => {
      const system = createMockSystem('Daily', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT);
      registry.register(system);

      engine.run(7);

      expect(system.execute).toHaveBeenCalledTimes(7);
    });

    it('should run weekly systems every 7 ticks', () => {
      const system = createMockSystem('Weekly', TickFrequency.Weekly, ExecutionOrder.ENVIRONMENT);
      registry.register(system);

      engine.run(14);

      // Runs on tick 0, 7, 14 (but tick 0 is implicit, clock advances to 1 on first tick)
      // Actually clock starts at 0, first tick advances to 1
      // Weekly runs when tick % 7 === 0, so ticks 7 and 14 = 2 times in 14 ticks
      expect(system.execute).toHaveBeenCalledTimes(2);
    });

    it('should run monthly systems every 30 ticks', () => {
      const system = createMockSystem('Monthly', TickFrequency.Monthly, ExecutionOrder.ENVIRONMENT);
      registry.register(system);

      engine.run(60);

      // Runs on tick 30, 60 = 2 times
      expect(system.execute).toHaveBeenCalledTimes(2);
    });

    it('should filter systems correctly on mixed frequencies', () => {
      const dailySystem = createMockSystem('Daily', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT);
      const weeklySystem = createMockSystem('Weekly', TickFrequency.Weekly, ExecutionOrder.ECONOMY);
      registry.register(dailySystem);
      registry.register(weeklySystem);

      engine.run(7);

      expect(dailySystem.execute).toHaveBeenCalledTimes(7);
      expect(weeklySystem.execute).toHaveBeenCalledTimes(1); // Only on tick 7
    });
  });

  describe('run methods', () => {
    it('should run N ticks', () => {
      const system = createMockSystem('Test', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT);
      registry.register(system);

      engine.run(10);

      expect(engine.getTickCount()).toBe(10);
      expect(clock.currentTick).toBe(10);
    });

    it('should runUntil condition is met', () => {
      registry.register(
        createMockSystem('Test', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT)
      );

      const elapsed = engine.runUntil(() => clock.currentTick >= 5);

      expect(elapsed).toBe(5);
      expect(clock.currentTick).toBe(5);
    });

    it('should runUntil respect maxTicks', () => {
      registry.register(
        createMockSystem('Test', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT)
      );

      const elapsed = engine.runUntil(() => false, 10);

      expect(elapsed).toBe(10);
    });
  });

  describe('event handling', () => {
    it('should capture events generated during tick', () => {
      const system = createMockSystem(
        'EventEmitter',
        TickFrequency.Daily,
        ExecutionOrder.ENVIRONMENT,
        (_world, _clock, events) => {
          const event = createSimpleEvent(
            EventCategory.Political,
            'test.event',
            [toEntityId(1)],
            50
          );
          events.emit(event);
        }
      );
      registry.register(system);

      engine.tick();

      const lastEvents = engine.getLastTickEvents();
      expect(lastEvents).toHaveLength(1);
      expect(lastEvents[0]?.subtype).toBe('test.event');
    });

    it('should log events to event log', () => {
      const system = createMockSystem(
        'EventEmitter',
        TickFrequency.Daily,
        ExecutionOrder.ENVIRONMENT,
        (_world, _clock, events) => {
          events.emit(
            createSimpleEvent(EventCategory.Military, 'battle.started', [toEntityId(1)], 75)
          );
        }
      );
      registry.register(system);

      engine.tick();

      expect(eventLog.getCount()).toBe(1);
      const logged = eventLog.getByCategory(EventCategory.Military);
      expect(logged).toHaveLength(1);
    });

    it('should clear pending events between ticks', () => {
      const system = createMockSystem(
        'EventEmitter',
        TickFrequency.Daily,
        ExecutionOrder.ENVIRONMENT,
        (_world, _clock, events) => {
          events.emit(
            createSimpleEvent(EventCategory.Political, 'test', [toEntityId(1)], 50)
          );
        }
      );
      registry.register(system);

      engine.tick();
      expect(engine.getLastTickEvents()).toHaveLength(1);

      // Second tick - new events only
      engine.tick();
      expect(engine.getLastTickEvents()).toHaveLength(1);
    });
  });

  describe('tick listeners', () => {
    it('should call tick listeners after each tick', () => {
      const listener = vi.fn();
      engine.onTick(listener);

      engine.tick();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(1, expect.any(Array));
    });

    it('should pass events to tick listeners', () => {
      const system = createMockSystem(
        'EventEmitter',
        TickFrequency.Daily,
        ExecutionOrder.ENVIRONMENT,
        (_world, _clock, events) => {
          events.emit(
            createSimpleEvent(EventCategory.Economic, 'trade.completed', [toEntityId(1)], 40)
          );
        }
      );
      registry.register(system);

      let receivedEvents: readonly WorldEvent[] = [];
      engine.onTick((_tick, events) => {
        receivedEvents = events;
      });

      engine.tick();

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]?.subtype).toBe('trade.completed');
    });

    it('should allow unsubscribing tick listeners', () => {
      const listener = vi.fn();
      const unsubscribe = engine.onTick(listener);

      engine.tick();
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      engine.tick();
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('cleanup', () => {
    it('should call cleanup on all systems', () => {
      const system1 = createMockSystem('Test1', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT);
      const system2 = createMockSystem('Test2', TickFrequency.Daily, ExecutionOrder.ECONOMY);
      registry.register(system1);
      registry.register(system2);

      engine.initialize();
      engine.cleanup();

      expect(system1.cleanup).toHaveBeenCalledTimes(1);
      expect(system2.cleanup).toHaveBeenCalledTimes(1);
      expect(engine.isInitialized()).toBe(false);
    });

    it('should reset state', () => {
      const listener = vi.fn();
      engine.onTick(listener);
      engine.tick();

      engine.reset();

      expect(engine.getTickCount()).toBe(0);
      expect(engine.isInitialized()).toBe(false);
      expect(engine.getLastTickEvents()).toHaveLength(0);

      // Listener should be removed
      engine.tick();
      expect(listener).toHaveBeenCalledTimes(1); // Only from before reset
    });
  });
});

describe('SystemRegistry', () => {
  let registry: SystemRegistry;

  beforeEach(() => {
    registry = new SystemRegistry();
  });

  describe('register', () => {
    it('should register a system', () => {
      const system = createMockSystem('Test', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT);
      registry.register(system);

      expect(registry.has('Test')).toBe(true);
      expect(registry.get('Test')).toBe(system);
    });

    it('should throw on duplicate registration', () => {
      const system = createMockSystem('Test', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT);
      registry.register(system);

      expect(() => registry.register(system)).toThrow("System 'Test' is already registered");
    });
  });

  describe('unregister', () => {
    it('should remove a system', () => {
      const system = createMockSystem('Test', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT);
      registry.register(system);
      registry.unregister('Test');

      expect(registry.has('Test')).toBe(false);
    });
  });

  describe('getOrderedSystems', () => {
    it('should return systems sorted by execution order', () => {
      const system1 = createMockSystem('Military', TickFrequency.Daily, ExecutionOrder.MILITARY);
      const system2 = createMockSystem('Environment', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT);
      const system3 = createMockSystem('Economy', TickFrequency.Daily, ExecutionOrder.ECONOMY);

      registry.register(system1);
      registry.register(system2);
      registry.register(system3);

      const ordered = registry.getOrderedSystems();

      expect(ordered[0]?.name).toBe('Environment'); // 2
      expect(ordered[1]?.name).toBe('Economy'); // 3
      expect(ordered[2]?.name).toBe('Military'); // 9
    });
  });

  describe('getSystemsForTick', () => {
    it('should filter by frequency', () => {
      const daily = createMockSystem('Daily', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT);
      const weekly = createMockSystem('Weekly', TickFrequency.Weekly, ExecutionOrder.ECONOMY);
      const monthly = createMockSystem('Monthly', TickFrequency.Monthly, ExecutionOrder.POLITICS);

      registry.register(daily);
      registry.register(weekly);
      registry.register(monthly);

      // Tick 1: only daily
      const tick1Systems = registry.getSystemsForTick(1);
      expect(tick1Systems).toHaveLength(1);
      expect(tick1Systems[0]?.name).toBe('Daily');

      // Tick 7: daily + weekly
      const tick7Systems = registry.getSystemsForTick(7);
      expect(tick7Systems).toHaveLength(2);

      // Tick 30: daily + monthly
      const tick30Systems = registry.getSystemsForTick(30);
      expect(tick30Systems).toHaveLength(2);
      expect(tick30Systems.map((s) => s.name)).toContain('Daily');
      expect(tick30Systems.map((s) => s.name)).toContain('Monthly');
    });

    it('should return systems sorted by execution order', () => {
      const system1 = createMockSystem('Military', TickFrequency.Daily, ExecutionOrder.MILITARY);
      const system2 = createMockSystem('Environment', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT);

      registry.register(system1);
      registry.register(system2);

      const systems = registry.getSystemsForTick(1);

      expect(systems[0]?.name).toBe('Environment');
      expect(systems[1]?.name).toBe('Military');
    });
  });

  describe('utility methods', () => {
    it('should count systems', () => {
      expect(registry.count()).toBe(0);

      registry.register(createMockSystem('A', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT));
      registry.register(createMockSystem('B', TickFrequency.Daily, ExecutionOrder.ECONOMY));

      expect(registry.count()).toBe(2);
    });

    it('should get system names', () => {
      registry.register(createMockSystem('Alpha', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT));
      registry.register(createMockSystem('Beta', TickFrequency.Daily, ExecutionOrder.ECONOMY));

      const names = registry.getNames();
      expect(names).toContain('Alpha');
      expect(names).toContain('Beta');
    });

    it('should get systems by frequency', () => {
      registry.register(createMockSystem('Daily1', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT));
      registry.register(createMockSystem('Daily2', TickFrequency.Daily, ExecutionOrder.ECONOMY));
      registry.register(createMockSystem('Weekly1', TickFrequency.Weekly, ExecutionOrder.POLITICS));

      const daily = registry.getSystemsByFrequency(TickFrequency.Daily);
      expect(daily).toHaveLength(2);

      const weekly = registry.getSystemsByFrequency(TickFrequency.Weekly);
      expect(weekly).toHaveLength(1);
    });

    it('should get systems by order', () => {
      registry.register(createMockSystem('Env1', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT));
      registry.register(createMockSystem('Env2', TickFrequency.Weekly, ExecutionOrder.ENVIRONMENT));
      registry.register(createMockSystem('Econ', TickFrequency.Daily, ExecutionOrder.ECONOMY));

      const envSystems = registry.getSystemsByOrder(ExecutionOrder.ENVIRONMENT);
      expect(envSystems).toHaveLength(2);
    });

    it('should clear all systems', () => {
      registry.register(createMockSystem('A', TickFrequency.Daily, ExecutionOrder.ENVIRONMENT));
      registry.register(createMockSystem('B', TickFrequency.Daily, ExecutionOrder.ECONOMY));

      registry.clear();

      expect(registry.count()).toBe(0);
    });
  });
});
