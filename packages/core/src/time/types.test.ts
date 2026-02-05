import { describe, it, expect } from 'vitest';
import {
  worldTimeToTicks,
  ticksToWorldTime,
  addDays,
  compareTimes,
  formatTime,
  getSeason,
  timeDifferenceInDays,
  createWorldTime,
  startOfYear,
  isSameDay,
  Season,
} from './types.js';

describe('Time Types', () => {
  describe('worldTimeToTicks', () => {
    it('should convert year 1, month 1, day 1 to tick 0', () => {
      const time = createWorldTime(1, 1, 1);
      expect(worldTimeToTicks(time)).toBe(0);
    });

    it('should convert year 1, month 1, day 2 to tick 1', () => {
      const time = createWorldTime(1, 1, 2);
      expect(worldTimeToTicks(time)).toBe(1);
    });

    it('should convert year 1, month 2, day 1 to tick 30', () => {
      const time = createWorldTime(1, 2, 1);
      expect(worldTimeToTicks(time)).toBe(30);
    });

    it('should convert year 2, month 1, day 1 to tick 360', () => {
      const time = createWorldTime(2, 1, 1);
      expect(worldTimeToTicks(time)).toBe(360);
    });

    it('should handle arbitrary dates', () => {
      const time = createWorldTime(3, 6, 15);
      // 2 years (720) + 5 months (150) + 14 days = 884
      expect(worldTimeToTicks(time)).toBe(884);
    });
  });

  describe('ticksToWorldTime', () => {
    it('should convert tick 0 to year 1, month 1, day 1', () => {
      const time = ticksToWorldTime(0);
      expect(time).toEqual({ year: 1, month: 1, day: 1 });
    });

    it('should convert tick 1 to year 1, month 1, day 2', () => {
      const time = ticksToWorldTime(1);
      expect(time).toEqual({ year: 1, month: 1, day: 2 });
    });

    it('should convert tick 30 to year 1, month 2, day 1', () => {
      const time = ticksToWorldTime(30);
      expect(time).toEqual({ year: 1, month: 2, day: 1 });
    });

    it('should convert tick 360 to year 2, month 1, day 1', () => {
      const time = ticksToWorldTime(360);
      expect(time).toEqual({ year: 2, month: 1, day: 1 });
    });

    it('should be inverse of worldTimeToTicks', () => {
      for (let tick = 0; tick < 1000; tick += 37) {
        const time = ticksToWorldTime(tick);
        expect(worldTimeToTicks(time)).toBe(tick);
      }
    });
  });

  describe('addDays', () => {
    it('should add days within same month', () => {
      const time = createWorldTime(1, 1, 1);
      const result = addDays(time, 5);
      expect(result).toEqual({ year: 1, month: 1, day: 6 });
    });

    it('should roll over to next month', () => {
      const time = createWorldTime(1, 1, 25);
      const result = addDays(time, 10);
      expect(result).toEqual({ year: 1, month: 2, day: 5 });
    });

    it('should roll over to next year', () => {
      const time = createWorldTime(1, 12, 25);
      const result = addDays(time, 10);
      expect(result).toEqual({ year: 2, month: 1, day: 5 });
    });

    it('should handle adding zero days', () => {
      const time = createWorldTime(5, 6, 15);
      const result = addDays(time, 0);
      expect(result).toEqual(time);
    });

    it('should handle large additions', () => {
      const time = createWorldTime(1, 1, 1);
      const result = addDays(time, 720); // 2 years
      expect(result).toEqual({ year: 3, month: 1, day: 1 });
    });
  });

  describe('compareTimes', () => {
    it('should return 0 for equal times', () => {
      const a = createWorldTime(5, 6, 15);
      const b = createWorldTime(5, 6, 15);
      expect(compareTimes(a, b)).toBe(0);
    });

    it('should return -1 when a is before b', () => {
      const a = createWorldTime(1, 1, 1);
      const b = createWorldTime(1, 1, 2);
      expect(compareTimes(a, b)).toBe(-1);
    });

    it('should return 1 when a is after b', () => {
      const a = createWorldTime(2, 1, 1);
      const b = createWorldTime(1, 12, 30);
      expect(compareTimes(a, b)).toBe(1);
    });

    it('should compare across years', () => {
      const a = createWorldTime(1, 12, 30);
      const b = createWorldTime(2, 1, 1);
      expect(compareTimes(a, b)).toBe(-1);
    });
  });

  describe('formatTime', () => {
    it('should format time correctly', () => {
      const time = createWorldTime(1247, 3, 23);
      expect(formatTime(time)).toBe('Year 1247, Month 3, Day 23');
    });

    it('should format year 1', () => {
      const time = createWorldTime(1, 1, 1);
      expect(formatTime(time)).toBe('Year 1, Month 1, Day 1');
    });
  });

  describe('getSeason', () => {
    it('should return Spring for months 1-3', () => {
      expect(getSeason(createWorldTime(1, 1, 1))).toBe(Season.Spring);
      expect(getSeason(createWorldTime(1, 2, 15))).toBe(Season.Spring);
      expect(getSeason(createWorldTime(1, 3, 30))).toBe(Season.Spring);
    });

    it('should return Summer for months 4-6', () => {
      expect(getSeason(createWorldTime(1, 4, 1))).toBe(Season.Summer);
      expect(getSeason(createWorldTime(1, 5, 15))).toBe(Season.Summer);
      expect(getSeason(createWorldTime(1, 6, 30))).toBe(Season.Summer);
    });

    it('should return Autumn for months 7-9', () => {
      expect(getSeason(createWorldTime(1, 7, 1))).toBe(Season.Autumn);
      expect(getSeason(createWorldTime(1, 8, 15))).toBe(Season.Autumn);
      expect(getSeason(createWorldTime(1, 9, 30))).toBe(Season.Autumn);
    });

    it('should return Winter for months 10-12', () => {
      expect(getSeason(createWorldTime(1, 10, 1))).toBe(Season.Winter);
      expect(getSeason(createWorldTime(1, 11, 15))).toBe(Season.Winter);
      expect(getSeason(createWorldTime(1, 12, 30))).toBe(Season.Winter);
    });
  });

  describe('timeDifferenceInDays', () => {
    it('should return 0 for same time', () => {
      const time = createWorldTime(1, 1, 1);
      expect(timeDifferenceInDays(time, time)).toBe(0);
    });

    it('should return positive when b is after a', () => {
      const a = createWorldTime(1, 1, 1);
      const b = createWorldTime(1, 1, 11);
      expect(timeDifferenceInDays(a, b)).toBe(10);
    });

    it('should return negative when b is before a', () => {
      const a = createWorldTime(1, 1, 11);
      const b = createWorldTime(1, 1, 1);
      expect(timeDifferenceInDays(a, b)).toBe(-10);
    });

    it('should work across years', () => {
      const a = createWorldTime(1, 1, 1);
      const b = createWorldTime(2, 1, 1);
      expect(timeDifferenceInDays(a, b)).toBe(360);
    });
  });

  describe('startOfYear', () => {
    it('should return first day of given year', () => {
      expect(startOfYear(5)).toEqual({ year: 5, month: 1, day: 1 });
    });
  });

  describe('isSameDay', () => {
    it('should return true for same day', () => {
      const a = createWorldTime(1, 5, 15);
      const b = createWorldTime(1, 5, 15);
      expect(isSameDay(a, b)).toBe(true);
    });

    it('should return false for different days', () => {
      const a = createWorldTime(1, 5, 15);
      const b = createWorldTime(1, 5, 16);
      expect(isSameDay(a, b)).toBe(false);
    });

    it('should return false for same day different month', () => {
      const a = createWorldTime(1, 5, 15);
      const b = createWorldTime(1, 6, 15);
      expect(isSameDay(a, b)).toBe(false);
    });

    it('should return false for same day different year', () => {
      const a = createWorldTime(1, 5, 15);
      const b = createWorldTime(2, 5, 15);
      expect(isSameDay(a, b)).toBe(false);
    });
  });
});
