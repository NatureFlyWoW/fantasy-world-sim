/**
 * Tests for SimulationTimeControls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimulationTimeControls, SimulationSpeed } from './time-controls.js';
import { EventBus, EventCategory, toEntityId, toEventId } from '@fws/core';
import type { WorldEvent } from '@fws/core';

/**
 * Create a test event with given significance.
 */
function createEvent(significance: number, timestamp: number = 0): WorldEvent {
  return {
    id: toEventId(toEntityId(1)),
    category: EventCategory.Personal,
    subtype: 'test.event',
    timestamp,
    participants: [toEntityId(1)],
    causes: [],
    consequences: [],
    data: {},
    significance,
    consequencePotential: [],
  };
}

describe('SimulationTimeControls', () => {
  let eventBus: EventBus;
  let controls: SimulationTimeControls;

  beforeEach(() => {
    eventBus = new EventBus();
    controls = new SimulationTimeControls(eventBus);
  });

  describe('speed management', () => {
    it('starts paused', () => {
      expect(controls.currentSpeed).toBe(SimulationSpeed.Paused);
      expect(controls.isPaused()).toBe(true);
    });

    it('can set speed directly', () => {
      controls.setSpeed(SimulationSpeed.Fast7);
      expect(controls.currentSpeed).toBe(SimulationSpeed.Fast7);
    });

    it('can pause', () => {
      controls.setSpeed(SimulationSpeed.Normal);
      controls.pause();
      expect(controls.isPaused()).toBe(true);
    });

    it('can play', () => {
      controls.play();
      expect(controls.currentSpeed).toBe(SimulationSpeed.Normal);
      expect(controls.isPaused()).toBe(false);
    });

    it('can toggle pause', () => {
      expect(controls.isPaused()).toBe(true);

      controls.togglePause();
      expect(controls.isPaused()).toBe(false);
      expect(controls.currentSpeed).toBe(SimulationSpeed.Normal);

      controls.togglePause();
      expect(controls.isPaused()).toBe(true);
    });
  });

  describe('speed cycling', () => {
    it('can increase speed with faster()', () => {
      controls.setSpeed(SimulationSpeed.Paused);

      controls.faster();
      expect(controls.currentSpeed).toBe(SimulationSpeed.SlowMotion);

      controls.faster();
      expect(controls.currentSpeed).toBe(SimulationSpeed.Normal);

      controls.faster();
      expect(controls.currentSpeed).toBe(SimulationSpeed.Fast7);
    });

    it('can decrease speed with slower()', () => {
      controls.setSpeed(SimulationSpeed.Fast30);

      controls.slower();
      expect(controls.currentSpeed).toBe(SimulationSpeed.Fast7);

      controls.slower();
      expect(controls.currentSpeed).toBe(SimulationSpeed.Normal);

      controls.slower();
      expect(controls.currentSpeed).toBe(SimulationSpeed.SlowMotion);
    });

    it('does not go above maximum speed', () => {
      controls.setSpeed(SimulationSpeed.UltraFast3650);
      controls.faster();
      expect(controls.currentSpeed).toBe(SimulationSpeed.UltraFast3650);
    });

    it('does not go below minimum speed', () => {
      controls.setSpeed(SimulationSpeed.Paused);
      controls.slower();
      expect(controls.currentSpeed).toBe(SimulationSpeed.Paused);
    });
  });

  describe('speed change callbacks', () => {
    it('notifies on speed change', () => {
      const callback = vi.fn();
      controls.onSpeedChange(callback);

      controls.play();

      expect(callback).toHaveBeenCalledWith(SimulationSpeed.Normal, 'manual');
    });

    it('does not notify when speed is unchanged', () => {
      const callback = vi.fn();
      controls.onSpeedChange(callback);

      controls.pause(); // Already paused
      expect(callback).not.toHaveBeenCalled();
    });

    it('can unsubscribe from callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = controls.onSpeedChange(callback);

      unsubscribe();
      controls.play();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('auto-slowdown', () => {
    it('triggers when 3+ high-significance events occur within 30 ticks', () => {
      const callback = vi.fn();
      controls.onSpeedChange(callback);
      controls.setSpeed(SimulationSpeed.Fast30);
      callback.mockClear(); // Clear the manual set call

      controls.setCurrentTick(0);

      // Emit 3 high-significance events (90-94 range: above slowdown threshold, below legendary 95)
      eventBus.emit(createEvent(94, 0));
      eventBus.emit(createEvent(92, 5));
      eventBus.emit(createEvent(91, 10));

      expect(callback).toHaveBeenCalledWith(SimulationSpeed.Normal, 'auto-slowdown');
      expect(controls.currentSpeed).toBe(SimulationSpeed.Normal);
    });

    it('does not trigger if events are below threshold', () => {
      const callback = vi.fn();
      controls.onSpeedChange(callback);
      controls.setSpeed(SimulationSpeed.Fast30);
      callback.mockClear();

      controls.setCurrentTick(0);

      // Emit events below threshold (90)
      eventBus.emit(createEvent(85, 0));
      eventBus.emit(createEvent(80, 5));
      eventBus.emit(createEvent(75, 10));

      expect(callback).not.toHaveBeenCalled();
      expect(controls.currentSpeed).toBe(SimulationSpeed.Fast30);
    });

    it('does not trigger if events are outside window', () => {
      controls.setSpeed(SimulationSpeed.Fast30);

      // First two events at tick 0 (90-94 range: above slowdown, below legendary)
      controls.setCurrentTick(0);
      eventBus.emit(createEvent(94, 0));
      eventBus.emit(createEvent(92, 0));

      // Move forward beyond window (30 ticks), third event
      controls.setCurrentTick(50);
      eventBus.emit(createEvent(91, 50));

      // Should still be at Fast30 because old events were pruned
      expect(controls.currentSpeed).toBe(SimulationSpeed.Fast30);
    });

    it('does not slow down if already at or below Normal', () => {
      const callback = vi.fn();
      controls.onSpeedChange(callback);
      controls.setSpeed(SimulationSpeed.SlowMotion);
      callback.mockClear();

      controls.setCurrentTick(0);

      // Use 90-94 range to test slowdown (not legendary pause)
      eventBus.emit(createEvent(94, 0));
      eventBus.emit(createEvent(92, 0));
      eventBus.emit(createEvent(91, 0));

      // Should not have changed from SlowMotion
      expect(callback).not.toHaveBeenCalled();
      expect(controls.currentSpeed).toBe(SimulationSpeed.SlowMotion);
    });

    it('can be configured with custom thresholds', () => {
      const customControls = new SimulationTimeControls(eventBus, {
        significanceThreshold: 80,
        eventCountThreshold: 2,
        windowTicks: 10,
      });
      const callback = vi.fn();
      customControls.onSpeedChange(callback);
      customControls.setSpeed(SimulationSpeed.Fast30);
      callback.mockClear();

      customControls.setCurrentTick(0);

      // With threshold 80 and count 2, this should trigger
      eventBus.emit(createEvent(85, 0));
      eventBus.emit(createEvent(82, 5));

      expect(callback).toHaveBeenCalledWith(SimulationSpeed.Normal, 'auto-slowdown');
      customControls.destroy();
    });

    it('can be disabled', () => {
      const disabledControls = new SimulationTimeControls(eventBus, {
        enabled: false,
      });
      disabledControls.setSpeed(SimulationSpeed.Fast30);

      disabledControls.setCurrentTick(0);
      eventBus.emit(createEvent(95, 0));
      eventBus.emit(createEvent(92, 0));
      eventBus.emit(createEvent(91, 0));

      expect(disabledControls.currentSpeed).toBe(SimulationSpeed.Fast30);
      disabledControls.destroy();
    });
  });

  describe('auto-pause on legendary events', () => {
    it('auto-pauses on sig 95+ event when running at Fast speed', () => {
      controls.setSpeed(SimulationSpeed.Fast30);

      controls.setCurrentTick(0);
      eventBus.emit(createEvent(96, 0));

      expect(controls.isPaused()).toBe(true);
    });

    it('notifies with auto-pause-legendary reason', () => {
      const callback = vi.fn();
      controls.onSpeedChange(callback);
      controls.setSpeed(SimulationSpeed.Fast30);
      callback.mockClear();

      controls.setCurrentTick(0);
      eventBus.emit(createEvent(96, 0));

      expect(callback).toHaveBeenCalledWith(SimulationSpeed.Paused, 'auto-pause-legendary');
    });

    it('stores the legendary event', () => {
      controls.setSpeed(SimulationSpeed.Normal);

      const legendaryEvent = createEvent(97, 10);
      controls.setCurrentTick(10);
      eventBus.emit(legendaryEvent);

      expect(controls.getLastLegendaryEvent()).toBe(legendaryEvent);
    });

    it('does not auto-pause if already paused', () => {
      const callback = vi.fn();
      controls.onSpeedChange(callback);
      // Already paused by default

      controls.setCurrentTick(0);
      eventBus.emit(createEvent(96, 0));

      // Should not have notified (was already paused)
      expect(callback).not.toHaveBeenCalled();
    });

    it('does not trigger legendary pause on sig 94', () => {
      const callback = vi.fn();
      controls.onSpeedChange(callback);
      controls.setSpeed(SimulationSpeed.Fast30);
      callback.mockClear();

      controls.setCurrentTick(0);
      eventBus.emit(createEvent(94, 0));

      // Sig 94 is below legendary threshold (95) but above auto-slowdown threshold (90)
      // With only 1 event, auto-slowdown won't trigger either (needs 3)
      expect(controls.currentSpeed).toBe(SimulationSpeed.Fast30);
      expect(callback).not.toHaveBeenCalled();
    });

    it('triggers legendary pause at exactly sig 95', () => {
      controls.setSpeed(SimulationSpeed.Normal);

      controls.setCurrentTick(0);
      eventBus.emit(createEvent(95, 0));

      expect(controls.isPaused()).toBe(true);
    });

    it('supports custom legendaryPauseThreshold', () => {
      const customControls = new SimulationTimeControls(eventBus, {
        legendaryPauseThreshold: 98,
      });
      customControls.setSpeed(SimulationSpeed.Fast30);

      customControls.setCurrentTick(0);
      eventBus.emit(createEvent(97, 0)); // Below custom threshold

      expect(customControls.currentSpeed).toBe(SimulationSpeed.Fast30);

      eventBus.emit(createEvent(98, 0)); // At custom threshold

      expect(customControls.isPaused()).toBe(true);
      customControls.destroy();
    });

    it('does not auto-pause when disabled', () => {
      const disabledControls = new SimulationTimeControls(eventBus, {
        enabled: false,
      });
      disabledControls.setSpeed(SimulationSpeed.Fast30);

      disabledControls.setCurrentTick(0);
      eventBus.emit(createEvent(99, 0));

      expect(disabledControls.currentSpeed).toBe(SimulationSpeed.Fast30);
      disabledControls.destroy();
    });

    it('returns null for getLastLegendaryEvent before any legendary event', () => {
      expect(controls.getLastLegendaryEvent()).toBeNull();
    });
  });

  describe('ticks per frame', () => {
    it('returns correct ticks for each speed', () => {
      controls.setSpeed(SimulationSpeed.Paused);
      expect(controls.getTicksPerFrame()).toBe(0);

      controls.setSpeed(SimulationSpeed.SlowMotion);
      expect(controls.getTicksPerFrame()).toBe(0); // Special handling

      controls.setSpeed(SimulationSpeed.Normal);
      expect(controls.getTicksPerFrame()).toBe(1);

      controls.setSpeed(SimulationSpeed.Fast7);
      expect(controls.getTicksPerFrame()).toBe(7);

      controls.setSpeed(SimulationSpeed.Fast365);
      expect(controls.getTicksPerFrame()).toBe(365);
    });
  });

  describe('speed description', () => {
    it('returns human-readable description', () => {
      controls.setSpeed(SimulationSpeed.Paused);
      expect(controls.getSpeedDescription()).toBe('Paused');

      controls.setSpeed(SimulationSpeed.Normal);
      expect(controls.getSpeedDescription()).toBe('Normal (1 day/frame)');

      controls.setSpeed(SimulationSpeed.Fast365);
      expect(controls.getSpeedDescription()).toBe('Very Fast (1 year/frame)');
    });
  });

  describe('slow motion', () => {
    it('can detect slow motion mode', () => {
      expect(controls.isSlowMotion()).toBe(false);

      controls.setSpeed(SimulationSpeed.SlowMotion);
      expect(controls.isSlowMotion()).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('unsubscribes from EventBus on destroy', () => {
      const initialCount = eventBus.anyHandlerCount();
      expect(initialCount).toBe(1); // From constructor

      controls.destroy();

      expect(eventBus.anyHandlerCount()).toBe(0);
    });
  });
});
