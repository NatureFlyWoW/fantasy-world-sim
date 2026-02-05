import { describe, it, expect, beforeEach } from 'vitest';
import { TickScheduler } from './tick-scheduler.js';
import { TickFrequency } from './types.js';

describe('TickScheduler', () => {
  let scheduler: TickScheduler;

  beforeEach(() => {
    scheduler = new TickScheduler();
  });

  describe('default registrations', () => {
    it('should register daily systems', () => {
      const dailySystems = scheduler.getSystemsByFrequency(TickFrequency.Daily);
      expect(dailySystems).toContain('CharacterAI');
      expect(dailySystems).toContain('Military');
      expect(dailySystems).toContain('EventResolution');
      expect(dailySystems).toContain('UrgentCascade');
      expect(dailySystems).toHaveLength(4);
    });

    it('should register weekly systems', () => {
      const weeklySystems = scheduler.getSystemsByFrequency(TickFrequency.Weekly);
      expect(weeklySystems).toContain('Trade');
      expect(weeklySystems).toContain('Relationships');
      expect(weeklySystems).toContain('Reputation');
      expect(weeklySystems).toContain('ReligiousDevotion');
      expect(weeklySystems).toHaveLength(4);
    });

    it('should register monthly systems', () => {
      const monthlySystems = scheduler.getSystemsByFrequency(TickFrequency.Monthly);
      expect(monthlySystems).toContain('Economy');
      expect(monthlySystems).toContain('Population');
      expect(monthlySystems).toContain('PoliticalStability');
      expect(monthlySystems).toContain('FactionGoals');
      expect(monthlySystems).toContain('Weather');
      expect(monthlySystems).toHaveLength(5);
    });

    it('should register seasonal systems', () => {
      const seasonalSystems = scheduler.getSystemsByFrequency(TickFrequency.Seasonal);
      expect(seasonalSystems).toContain('Agriculture');
      expect(seasonalSystems).toContain('MilitaryCampaigns');
      expect(seasonalSystems).toContain('CulturalTrends');
      expect(seasonalSystems).toContain('Festivals');
      expect(seasonalSystems).toHaveLength(4);
    });

    it('should register annual systems', () => {
      const annualSystems = scheduler.getSystemsByFrequency(TickFrequency.Annual);
      expect(annualSystems).toContain('Technology');
      expect(annualSystems).toContain('Art');
      expect(annualSystems).toContain('Philosophy');
      expect(annualSystems).toContain('Language');
      expect(annualSystems).toContain('Geology');
      expect(annualSystems).toContain('DivinePower');
      expect(annualSystems).toHaveLength(6);
    });

    it('should register decadal systems', () => {
      const decadalSystems = scheduler.getSystemsByFrequency(TickFrequency.Decadal);
      expect(decadalSystems).toContain('Climate');
      expect(decadalSystems).toContain('MajorGeology');
      expect(decadalSystems).toContain('CulturalIdentity');
      expect(decadalSystems).toContain('EraTransition');
      expect(decadalSystems).toHaveLength(4);
    });

    it('should have 27 total default systems', () => {
      const allSystems = scheduler.getRegisteredSystems();
      expect(allSystems).toHaveLength(27);
    });
  });

  describe('shouldRun', () => {
    it('should return true for daily systems every tick', () => {
      expect(scheduler.shouldRun('CharacterAI', 0)).toBe(true);
      expect(scheduler.shouldRun('CharacterAI', 1)).toBe(true);
      expect(scheduler.shouldRun('CharacterAI', 100)).toBe(true);
    });

    it('should return true for weekly systems every 7 ticks', () => {
      expect(scheduler.shouldRun('Trade', 0)).toBe(true);
      expect(scheduler.shouldRun('Trade', 7)).toBe(true);
      expect(scheduler.shouldRun('Trade', 14)).toBe(true);
      expect(scheduler.shouldRun('Trade', 1)).toBe(false);
      expect(scheduler.shouldRun('Trade', 6)).toBe(false);
    });

    it('should return true for monthly systems every 30 ticks', () => {
      expect(scheduler.shouldRun('Economy', 0)).toBe(true);
      expect(scheduler.shouldRun('Economy', 30)).toBe(true);
      expect(scheduler.shouldRun('Economy', 60)).toBe(true);
      expect(scheduler.shouldRun('Economy', 15)).toBe(false);
      expect(scheduler.shouldRun('Economy', 29)).toBe(false);
    });

    it('should return true for seasonal systems every 90 ticks', () => {
      expect(scheduler.shouldRun('Agriculture', 0)).toBe(true);
      expect(scheduler.shouldRun('Agriculture', 90)).toBe(true);
      expect(scheduler.shouldRun('Agriculture', 180)).toBe(true);
      expect(scheduler.shouldRun('Agriculture', 45)).toBe(false);
    });

    it('should return true for annual systems every 365 ticks', () => {
      expect(scheduler.shouldRun('Technology', 0)).toBe(true);
      expect(scheduler.shouldRun('Technology', 365)).toBe(true);
      expect(scheduler.shouldRun('Technology', 730)).toBe(true);
      expect(scheduler.shouldRun('Technology', 100)).toBe(false);
    });

    it('should return true for decadal systems every 3650 ticks', () => {
      expect(scheduler.shouldRun('Climate', 0)).toBe(true);
      expect(scheduler.shouldRun('Climate', 3650)).toBe(true);
      expect(scheduler.shouldRun('Climate', 7300)).toBe(true);
      expect(scheduler.shouldRun('Climate', 1000)).toBe(false);
    });

    it('should return false for unregistered systems', () => {
      expect(scheduler.shouldRun('NonExistent', 0)).toBe(false);
      expect(scheduler.shouldRun('NonExistent', 100)).toBe(false);
    });
  });

  describe('getSystemsForTick', () => {
    it('should return all systems on tick 0', () => {
      const systems = scheduler.getSystemsForTick(0);
      expect(systems).toHaveLength(27); // All systems run on tick 0
    });

    it('should return only daily systems on tick 1', () => {
      const systems = scheduler.getSystemsForTick(1);
      expect(systems).toHaveLength(4);
      expect(systems).toContain('CharacterAI');
      expect(systems).toContain('Military');
      expect(systems).toContain('EventResolution');
      expect(systems).toContain('UrgentCascade');
    });

    it('should return daily and weekly systems on tick 7', () => {
      const systems = scheduler.getSystemsForTick(7);
      expect(systems).toContain('CharacterAI'); // Daily
      expect(systems).toContain('Trade'); // Weekly
      expect(systems).toContain('Relationships'); // Weekly
      expect(systems).toHaveLength(8); // 4 daily + 4 weekly
    });

    it('should return daily, weekly, and monthly systems on tick 210', () => {
      // 210 is divisible by 1, 7, and 30
      const systems = scheduler.getSystemsForTick(210);
      expect(systems).toContain('CharacterAI'); // Daily
      expect(systems).toContain('Trade'); // Weekly
      expect(systems).toContain('Economy'); // Monthly
      expect(systems).toHaveLength(13); // 4 daily + 4 weekly + 5 monthly
    });

    it('should return many systems on tick 3650 (decade)', () => {
      // 3650 is divisible by all frequencies
      const systems = scheduler.getSystemsForTick(3650);
      // 3650 % 1 = 0 (daily)
      // 3650 % 7 = 0 (weekly - 3650/7 = 521.43... wait, let me check)
      // Actually 3650 / 7 = 521.428... so 3650 % 7 = 3
      // Let me verify: 7 * 521 = 3647, so 3650 - 3647 = 3
      // So weekly won't trigger on 3650

      // 3650 % 30 = 20, so monthly won't trigger either
      // 3650 % 90 = 50, so seasonal won't trigger
      // 3650 % 365 = 0, so annual WILL trigger
      // 3650 % 3650 = 0, so decadal will trigger

      expect(systems).toContain('CharacterAI'); // Daily
      expect(systems).toContain('Technology'); // Annual
      expect(systems).toContain('Climate'); // Decadal
      expect(systems).not.toContain('Trade'); // Weekly - 3650 % 7 = 3
    });
  });

  describe('register', () => {
    it('should register a custom system', () => {
      scheduler.register('CustomSystem', TickFrequency.Weekly);
      expect(scheduler.getFrequency('CustomSystem')).toBe(TickFrequency.Weekly);
      expect(scheduler.shouldRun('CustomSystem', 7)).toBe(true);
    });

    it('should overwrite existing registration', () => {
      scheduler.register('CharacterAI', TickFrequency.Monthly);
      expect(scheduler.getFrequency('CharacterAI')).toBe(TickFrequency.Monthly);
      expect(scheduler.shouldRun('CharacterAI', 1)).toBe(false);
      expect(scheduler.shouldRun('CharacterAI', 30)).toBe(true);
    });

    it('should support offset for staggering', () => {
      scheduler.register('StaggeredSystem', TickFrequency.Weekly, 3);
      expect(scheduler.shouldRun('StaggeredSystem', 0)).toBe(false);
      expect(scheduler.shouldRun('StaggeredSystem', 3)).toBe(true);
      expect(scheduler.shouldRun('StaggeredSystem', 10)).toBe(true); // 10 - 3 = 7, 7 % 7 = 0
      expect(scheduler.shouldRun('StaggeredSystem', 7)).toBe(false); // 7 - 3 = 4, 4 % 7 != 0
    });
  });

  describe('unregister', () => {
    it('should remove a system', () => {
      scheduler.unregister('CharacterAI');
      expect(scheduler.getFrequency('CharacterAI')).toBeUndefined();
      expect(scheduler.shouldRun('CharacterAI', 0)).toBe(false);
    });

    it('should not throw for non-existent system', () => {
      expect(() => scheduler.unregister('NonExistent')).not.toThrow();
    });
  });

  describe('getFrequency', () => {
    it('should return frequency for registered system', () => {
      expect(scheduler.getFrequency('CharacterAI')).toBe(TickFrequency.Daily);
      expect(scheduler.getFrequency('Trade')).toBe(TickFrequency.Weekly);
      expect(scheduler.getFrequency('Economy')).toBe(TickFrequency.Monthly);
      expect(scheduler.getFrequency('Agriculture')).toBe(TickFrequency.Seasonal);
      expect(scheduler.getFrequency('Technology')).toBe(TickFrequency.Annual);
      expect(scheduler.getFrequency('Climate')).toBe(TickFrequency.Decadal);
    });

    it('should return undefined for unregistered system', () => {
      expect(scheduler.getFrequency('NonExistent')).toBeUndefined();
    });
  });

  describe('getRegisteredSystems', () => {
    it('should return all system names', () => {
      const systems = scheduler.getRegisteredSystems();
      expect(systems).toContain('CharacterAI');
      expect(systems).toContain('Trade');
      expect(systems).toContain('Climate');
    });

    it('should include custom systems after registration', () => {
      scheduler.register('Custom', TickFrequency.Daily);
      const systems = scheduler.getRegisteredSystems();
      expect(systems).toContain('Custom');
      expect(systems).toHaveLength(28);
    });
  });

  describe('getSystemsByFrequency', () => {
    it('should return empty array for frequency with no systems', () => {
      scheduler.clear();
      const systems = scheduler.getSystemsByFrequency(TickFrequency.Daily);
      expect(systems).toEqual([]);
    });

    it('should only return systems at the specified frequency', () => {
      const weekly = scheduler.getSystemsByFrequency(TickFrequency.Weekly);
      for (const system of weekly) {
        expect(scheduler.getFrequency(system)).toBe(TickFrequency.Weekly);
      }
    });
  });

  describe('clear', () => {
    it('should remove all registrations', () => {
      scheduler.clear();
      expect(scheduler.getRegisteredSystems()).toHaveLength(0);
      expect(scheduler.shouldRun('CharacterAI', 0)).toBe(false);
    });
  });

  describe('reset', () => {
    it('should restore default registrations after clear', () => {
      scheduler.clear();
      scheduler.reset();
      expect(scheduler.getRegisteredSystems()).toHaveLength(27);
      expect(scheduler.shouldRun('CharacterAI', 0)).toBe(true);
    });

    it('should remove custom registrations', () => {
      scheduler.register('Custom', TickFrequency.Daily);
      scheduler.reset();
      expect(scheduler.getFrequency('Custom')).toBeUndefined();
      expect(scheduler.getRegisteredSystems()).toHaveLength(27);
    });
  });
});
