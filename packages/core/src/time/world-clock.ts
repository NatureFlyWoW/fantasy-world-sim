/**
 * WorldClock tracks the current simulation time.
 * Time starts at Year 1, Month 1, Day 1 (tick 0).
 */

import type { WorldTime } from './types.js';
import { ticksToWorldTime, TickFrequency } from './types.js';

export class WorldClock {
  private _currentTick = 0;

  /**
   * Get the current tick (total days since simulation start).
   */
  get currentTick(): number {
    return this._currentTick;
  }

  /**
   * Get the current world time.
   */
  get currentTime(): WorldTime {
    return ticksToWorldTime(this._currentTick);
  }

  /**
   * Advance the clock by one day.
   */
  advance(): void {
    this._currentTick++;
  }

  /**
   * Advance the clock by a specified number of days.
   */
  advanceBy(days: number): void {
    if (days < 0) {
      throw new Error('Cannot advance by negative days');
    }
    this._currentTick += days;
  }

  /**
   * Check if the current tick is the start of a new week.
   */
  isNewWeek(): boolean {
    return this._currentTick % TickFrequency.Weekly === 0;
  }

  /**
   * Check if the current tick is the start of a new month.
   */
  isNewMonth(): boolean {
    return this._currentTick % TickFrequency.Monthly === 0;
  }

  /**
   * Check if the current tick is the start of a new season.
   */
  isNewSeason(): boolean {
    return this._currentTick % TickFrequency.Seasonal === 0;
  }

  /**
   * Check if the current tick is the start of a new year.
   */
  isNewYear(): boolean {
    return this._currentTick % TickFrequency.Annual === 0;
  }

  /**
   * Check if the current tick is the start of a new decade.
   */
  isNewDecade(): boolean {
    return this._currentTick % TickFrequency.Decadal === 0;
  }

  /**
   * Get the number of complete years that have elapsed.
   */
  getElapsedYears(): number {
    return Math.floor(this._currentTick / TickFrequency.Annual);
  }

  /**
   * Get the number of complete months that have elapsed.
   */
  getElapsedMonths(): number {
    return Math.floor(this._currentTick / TickFrequency.Monthly);
  }

  /**
   * Get the number of complete weeks that have elapsed.
   */
  getElapsedWeeks(): number {
    return Math.floor(this._currentTick / TickFrequency.Weekly);
  }

  /**
   * Set the clock to a specific tick (for testing/loading saves).
   */
  setTick(tick: number): void {
    if (tick < 0) {
      throw new Error('Tick cannot be negative');
    }
    this._currentTick = tick;
  }

  /**
   * Reset the clock to tick 0.
   */
  reset(): void {
    this._currentTick = 0;
  }
}
