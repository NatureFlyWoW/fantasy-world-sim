/**
 * TickScheduler determines which systems should run on which ticks.
 * Systems are registered with a frequency and checked each tick.
 */

import { TickFrequency } from './types.js';

/**
 * System names as defined in the design doc.
 */
export type SystemName =
  // Daily systems
  | 'CharacterAI'
  | 'Military'
  | 'EventResolution'
  | 'UrgentCascade'
  // Weekly systems
  | 'Trade'
  | 'Relationships'
  | 'Reputation'
  | 'ReligiousDevotion'
  // Monthly systems
  | 'Economy'
  | 'Population'
  | 'PoliticalStability'
  | 'FactionGoals'
  | 'Weather'
  // Seasonal systems
  | 'Agriculture'
  | 'MilitaryCampaigns'
  | 'CulturalTrends'
  | 'Festivals'
  // Annual systems
  | 'Technology'
  | 'Art'
  | 'Philosophy'
  | 'Language'
  | 'Geology'
  | 'DivinePower'
  // Decadal systems
  | 'Climate'
  | 'MajorGeology'
  | 'CulturalIdentity'
  | 'EraTransition'
  // Custom systems
  | string;

interface SystemRegistration {
  frequency: TickFrequency;
  offset?: number; // Optional offset for staggering systems
}

export class TickScheduler {
  private systems: Map<string, SystemRegistration> = new Map();

  constructor() {
    this.registerDefaults();
  }

  /**
   * Register default systems from the design doc.
   */
  private registerDefaults(): void {
    // Daily systems (frequency: 1)
    this.register('CharacterAI', TickFrequency.Daily);
    this.register('Military', TickFrequency.Daily);
    this.register('EventResolution', TickFrequency.Daily);
    this.register('UrgentCascade', TickFrequency.Daily);

    // Weekly systems (frequency: 7)
    this.register('Trade', TickFrequency.Weekly);
    this.register('Relationships', TickFrequency.Weekly);
    this.register('Reputation', TickFrequency.Weekly);
    this.register('ReligiousDevotion', TickFrequency.Weekly);

    // Monthly systems (frequency: 30)
    this.register('Economy', TickFrequency.Monthly);
    this.register('Population', TickFrequency.Monthly);
    this.register('PoliticalStability', TickFrequency.Monthly);
    this.register('FactionGoals', TickFrequency.Monthly);
    this.register('Weather', TickFrequency.Monthly);

    // Seasonal systems (frequency: 90)
    this.register('Agriculture', TickFrequency.Seasonal);
    this.register('MilitaryCampaigns', TickFrequency.Seasonal);
    this.register('CulturalTrends', TickFrequency.Seasonal);
    this.register('Festivals', TickFrequency.Seasonal);

    // Annual systems (frequency: 365)
    this.register('Technology', TickFrequency.Annual);
    this.register('Art', TickFrequency.Annual);
    this.register('Philosophy', TickFrequency.Annual);
    this.register('Language', TickFrequency.Annual);
    this.register('Geology', TickFrequency.Annual);
    this.register('DivinePower', TickFrequency.Annual);

    // Decadal systems (frequency: 3650)
    this.register('Climate', TickFrequency.Decadal);
    this.register('MajorGeology', TickFrequency.Decadal);
    this.register('CulturalIdentity', TickFrequency.Decadal);
    this.register('EraTransition', TickFrequency.Decadal);
  }

  /**
   * Register a system with a tick frequency.
   * @param systemName Name of the system
   * @param frequency How often the system should run
   * @param offset Optional tick offset for staggering (default: 0)
   */
  register(systemName: string, frequency: TickFrequency, offset = 0): void {
    this.systems.set(systemName, { frequency, offset });
  }

  /**
   * Unregister a system.
   */
  unregister(systemName: string): void {
    this.systems.delete(systemName);
  }

  /**
   * Check if a system should run on the current tick.
   */
  shouldRun(systemName: string, currentTick: number): boolean {
    const registration = this.systems.get(systemName);
    if (registration === undefined) {
      return false;
    }

    const { frequency, offset = 0 } = registration;
    return (currentTick - offset) % frequency === 0;
  }

  /**
   * Get all systems that should run on the current tick.
   */
  getSystemsForTick(currentTick: number): string[] {
    const result: string[] = [];

    for (const [systemName, registration] of this.systems) {
      const { frequency, offset = 0 } = registration;
      if ((currentTick - offset) % frequency === 0) {
        result.push(systemName);
      }
    }

    return result;
  }

  /**
   * Get the frequency of a registered system.
   */
  getFrequency(systemName: string): TickFrequency | undefined {
    return this.systems.get(systemName)?.frequency;
  }

  /**
   * Get all registered system names.
   */
  getRegisteredSystems(): string[] {
    return Array.from(this.systems.keys());
  }

  /**
   * Get all systems registered at a specific frequency.
   */
  getSystemsByFrequency(frequency: TickFrequency): string[] {
    const result: string[] = [];
    for (const [name, reg] of this.systems) {
      if (reg.frequency === frequency) {
        result.push(name);
      }
    }
    return result;
  }

  /**
   * Clear all registrations (for testing).
   */
  clear(): void {
    this.systems.clear();
  }

  /**
   * Reset to default registrations.
   */
  reset(): void {
    this.systems.clear();
    this.registerDefaults();
  }
}
