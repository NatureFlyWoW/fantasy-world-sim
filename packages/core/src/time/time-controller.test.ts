import { describe, it, expect, beforeEach } from 'vitest';
import { TimeController } from './time-controller.js';
import { SimulationSpeed, TickFrequency } from './types.js';

describe('TimeController', () => {
  let controller: TimeController;

  beforeEach(() => {
    controller = new TimeController();
  });

  describe('initial state', () => {
    it('should start paused', () => {
      expect(controller.speed).toBe(SimulationSpeed.Paused);
    });

    it('should have auto slow-down enabled', () => {
      expect(controller.shouldAutoSlowDown).toBe(true);
    });
  });

  describe('setSpeed', () => {
    it('should set speed to Normal', () => {
      controller.setSpeed(SimulationSpeed.Normal);
      expect(controller.speed).toBe(SimulationSpeed.Normal);
    });

    it('should set speed to Fast7', () => {
      controller.setSpeed(SimulationSpeed.Fast7);
      expect(controller.speed).toBe(SimulationSpeed.Fast7);
    });

    it('should set speed to UltraFast3650', () => {
      controller.setSpeed(SimulationSpeed.UltraFast3650);
      expect(controller.speed).toBe(SimulationSpeed.UltraFast3650);
    });
  });

  describe('pause', () => {
    it('should set speed to Paused', () => {
      controller.play();
      controller.pause();
      expect(controller.speed).toBe(SimulationSpeed.Paused);
    });
  });

  describe('play', () => {
    it('should set speed to Normal', () => {
      controller.play();
      expect(controller.speed).toBe(SimulationSpeed.Normal);
    });
  });

  describe('isPaused', () => {
    it('should return true when paused', () => {
      expect(controller.isPaused()).toBe(true);
    });

    it('should return false when playing', () => {
      controller.play();
      expect(controller.isPaused()).toBe(false);
    });
  });

  describe('isSlowMotion', () => {
    it('should return false by default', () => {
      expect(controller.isSlowMotion()).toBe(false);
    });

    it('should return true when in slow motion', () => {
      controller.slowMotion();
      expect(controller.isSlowMotion()).toBe(true);
    });
  });

  describe('fastForward', () => {
    it('should set speed to Fast7 for multiplier 7', () => {
      controller.fastForward(7);
      expect(controller.speed).toBe(SimulationSpeed.Fast7);
    });

    it('should set speed to Fast30 for multiplier 30', () => {
      controller.fastForward(30);
      expect(controller.speed).toBe(SimulationSpeed.Fast30);
    });

    it('should set speed to Fast365 for multiplier 365', () => {
      controller.fastForward(365);
      expect(controller.speed).toBe(SimulationSpeed.Fast365);
    });

    it('should set speed to UltraFast3650 for multiplier 3650', () => {
      controller.fastForward(3650);
      expect(controller.speed).toBe(SimulationSpeed.UltraFast3650);
    });
  });

  describe('slowMotion', () => {
    it('should set speed to SlowMotion', () => {
      controller.slowMotion();
      expect(controller.speed).toBe(SimulationSpeed.SlowMotion);
    });
  });

  describe('getTicksPerFrame', () => {
    it('should return 0 when paused', () => {
      expect(controller.getTicksPerFrame()).toBe(0);
    });

    it('should return 0 when in slow motion', () => {
      controller.slowMotion();
      expect(controller.getTicksPerFrame()).toBe(0);
    });

    it('should return 1 at normal speed', () => {
      controller.play();
      expect(controller.getTicksPerFrame()).toBe(1);
    });

    it('should return 7 at Fast7', () => {
      controller.fastForward(7);
      expect(controller.getTicksPerFrame()).toBe(7);
    });

    it('should return 30 at Fast30', () => {
      controller.fastForward(30);
      expect(controller.getTicksPerFrame()).toBe(30);
    });

    it('should return 365 at Fast365', () => {
      controller.fastForward(365);
      expect(controller.getTicksPerFrame()).toBe(365);
    });

    it('should return 3650 at UltraFast3650', () => {
      controller.fastForward(3650);
      expect(controller.getTicksPerFrame()).toBe(3650);
    });
  });

  describe('getTicksForStep', () => {
    it('should return 1 for day', () => {
      expect(controller.getTicksForStep('day')).toBe(TickFrequency.Daily);
    });

    it('should return 7 for week', () => {
      expect(controller.getTicksForStep('week')).toBe(TickFrequency.Weekly);
    });

    it('should return 30 for month', () => {
      expect(controller.getTicksForStep('month')).toBe(TickFrequency.Monthly);
    });

    it('should return 365 for year', () => {
      expect(controller.getTicksForStep('year')).toBe(TickFrequency.Annual);
    });
  });

  describe('shouldAutoSlowDown', () => {
    it('should be toggleable', () => {
      controller.shouldAutoSlowDown = false;
      expect(controller.shouldAutoSlowDown).toBe(false);

      controller.shouldAutoSlowDown = true;
      expect(controller.shouldAutoSlowDown).toBe(true);
    });
  });

  describe('triggerSlowDown', () => {
    it('should slow down from fast forward to normal when enabled', () => {
      controller.fastForward(365);
      controller.triggerSlowDown();
      expect(controller.speed).toBe(SimulationSpeed.Normal);
    });

    it('should not affect normal speed', () => {
      controller.play();
      controller.triggerSlowDown();
      expect(controller.speed).toBe(SimulationSpeed.Normal);
    });

    it('should not affect speed when disabled', () => {
      controller.shouldAutoSlowDown = false;
      controller.fastForward(365);
      controller.triggerSlowDown();
      expect(controller.speed).toBe(SimulationSpeed.Fast365);
    });

    it('should not affect paused state', () => {
      controller.triggerSlowDown();
      expect(controller.speed).toBe(SimulationSpeed.Paused);
    });
  });

  describe('getSpeedDescription', () => {
    it('should describe Paused', () => {
      expect(controller.getSpeedDescription()).toBe('Paused');
    });

    it('should describe Normal', () => {
      controller.play();
      expect(controller.getSpeedDescription()).toBe('Normal (1 day/frame)');
    });

    it('should describe SlowMotion', () => {
      controller.slowMotion();
      expect(controller.getSpeedDescription()).toBe('Slow Motion');
    });

    it('should describe Fast7', () => {
      controller.fastForward(7);
      expect(controller.getSpeedDescription()).toBe('Fast (1 week/frame)');
    });

    it('should describe Fast30', () => {
      controller.fastForward(30);
      expect(controller.getSpeedDescription()).toBe('Faster (1 month/frame)');
    });

    it('should describe Fast365', () => {
      controller.fastForward(365);
      expect(controller.getSpeedDescription()).toBe('Very Fast (1 year/frame)');
    });

    it('should describe UltraFast3650', () => {
      controller.fastForward(3650);
      expect(controller.getSpeedDescription()).toBe('Ultra Fast (10 years/frame)');
    });
  });
});
