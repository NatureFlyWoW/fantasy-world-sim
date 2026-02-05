import { describe, it, expect, beforeEach } from 'vitest';
import { WorldClock } from './world-clock.js';
import { TickFrequency } from './types.js';

describe('WorldClock', () => {
  let clock: WorldClock;

  beforeEach(() => {
    clock = new WorldClock();
  });

  describe('initial state', () => {
    it('should start at tick 0', () => {
      expect(clock.currentTick).toBe(0);
    });

    it('should start at year 1, month 1, day 1', () => {
      const time = clock.currentTime;
      expect(time.year).toBe(1);
      expect(time.month).toBe(1);
      expect(time.day).toBe(1);
    });
  });

  describe('advance', () => {
    it('should increment tick by 1', () => {
      clock.advance();
      expect(clock.currentTick).toBe(1);
    });

    it('should update time correctly', () => {
      clock.advance();
      const time = clock.currentTime;
      expect(time.day).toBe(2);
    });

    it('should roll over months', () => {
      for (let i = 0; i < 30; i++) {
        clock.advance();
      }
      const time = clock.currentTime;
      expect(time.month).toBe(2);
      expect(time.day).toBe(1);
    });

    it('should roll over years', () => {
      for (let i = 0; i < 360; i++) {
        clock.advance();
      }
      const time = clock.currentTime;
      expect(time.year).toBe(2);
      expect(time.month).toBe(1);
      expect(time.day).toBe(1);
    });
  });

  describe('advanceBy', () => {
    it('should advance by specified days', () => {
      clock.advanceBy(10);
      expect(clock.currentTick).toBe(10);
    });

    it('should throw for negative days', () => {
      expect(() => clock.advanceBy(-1)).toThrow('Cannot advance by negative days');
    });

    it('should handle zero days', () => {
      clock.advanceBy(0);
      expect(clock.currentTick).toBe(0);
    });
  });

  describe('frequency checks', () => {
    describe('isNewWeek', () => {
      it('should return true at tick 0', () => {
        expect(clock.isNewWeek()).toBe(true);
      });

      it('should return false at tick 1', () => {
        clock.advance();
        expect(clock.isNewWeek()).toBe(false);
      });

      it('should return true at tick 7', () => {
        clock.advanceBy(7);
        expect(clock.isNewWeek()).toBe(true);
      });

      it('should return true every 7 ticks', () => {
        for (let i = 0; i < 100; i++) {
          if (i % TickFrequency.Weekly === 0) {
            expect(clock.isNewWeek()).toBe(true);
          } else {
            expect(clock.isNewWeek()).toBe(false);
          }
          clock.advance();
        }
      });
    });

    describe('isNewMonth', () => {
      it('should return true at tick 0', () => {
        expect(clock.isNewMonth()).toBe(true);
      });

      it('should return false at tick 1', () => {
        clock.advance();
        expect(clock.isNewMonth()).toBe(false);
      });

      it('should return true at tick 30', () => {
        clock.advanceBy(30);
        expect(clock.isNewMonth()).toBe(true);
      });
    });

    describe('isNewSeason', () => {
      it('should return true at tick 0', () => {
        expect(clock.isNewSeason()).toBe(true);
      });

      it('should return true at tick 90', () => {
        clock.advanceBy(90);
        expect(clock.isNewSeason()).toBe(true);
      });

      it('should return false at tick 45', () => {
        clock.advanceBy(45);
        expect(clock.isNewSeason()).toBe(false);
      });
    });

    describe('isNewYear', () => {
      it('should return true at tick 0', () => {
        expect(clock.isNewYear()).toBe(true);
      });

      it('should return true at tick 365', () => {
        clock.advanceBy(365);
        expect(clock.isNewYear()).toBe(true);
      });

      it('should return false at tick 100', () => {
        clock.advanceBy(100);
        expect(clock.isNewYear()).toBe(false);
      });
    });

    describe('isNewDecade', () => {
      it('should return true at tick 0', () => {
        expect(clock.isNewDecade()).toBe(true);
      });

      it('should return true at tick 3650', () => {
        clock.advanceBy(3650);
        expect(clock.isNewDecade()).toBe(true);
      });

      it('should return false at tick 365', () => {
        clock.advanceBy(365);
        expect(clock.isNewDecade()).toBe(false);
      });
    });
  });

  describe('getElapsedYears', () => {
    it('should return 0 at start', () => {
      expect(clock.getElapsedYears()).toBe(0);
    });

    it('should return 1 after 365 days', () => {
      clock.advanceBy(365);
      expect(clock.getElapsedYears()).toBe(1);
    });

    it('should return 10 after 3650 days', () => {
      clock.advanceBy(3650);
      expect(clock.getElapsedYears()).toBe(10);
    });

    it('should not round up', () => {
      clock.advanceBy(364);
      expect(clock.getElapsedYears()).toBe(0);
    });
  });

  describe('getElapsedMonths', () => {
    it('should return 0 at start', () => {
      expect(clock.getElapsedMonths()).toBe(0);
    });

    it('should return 1 after 30 days', () => {
      clock.advanceBy(30);
      expect(clock.getElapsedMonths()).toBe(1);
    });

    it('should return 12 after 360 days', () => {
      clock.advanceBy(360);
      expect(clock.getElapsedMonths()).toBe(12);
    });
  });

  describe('getElapsedWeeks', () => {
    it('should return 0 at start', () => {
      expect(clock.getElapsedWeeks()).toBe(0);
    });

    it('should return 1 after 7 days', () => {
      clock.advanceBy(7);
      expect(clock.getElapsedWeeks()).toBe(1);
    });
  });

  describe('setTick', () => {
    it('should set tick to specified value', () => {
      clock.setTick(100);
      expect(clock.currentTick).toBe(100);
    });

    it('should throw for negative tick', () => {
      expect(() => clock.setTick(-1)).toThrow('Tick cannot be negative');
    });

    it('should update currentTime accordingly', () => {
      clock.setTick(360); // Year 2, Month 1, Day 1
      const time = clock.currentTime;
      expect(time.year).toBe(2);
      expect(time.month).toBe(1);
      expect(time.day).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset to tick 0', () => {
      clock.advanceBy(1000);
      clock.reset();
      expect(clock.currentTick).toBe(0);
    });

    it('should reset time to year 1, month 1, day 1', () => {
      clock.advanceBy(1000);
      clock.reset();
      const time = clock.currentTime;
      expect(time.year).toBe(1);
      expect(time.month).toBe(1);
      expect(time.day).toBe(1);
    });
  });
});
