/**
 * Time management types for the simulation.
 * 1 tick = 1 day. Systems run at different frequency tiers.
 */

/**
 * Represents a point in world time.
 */
export interface WorldTime {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number; // 1-30 (simplified 30-day months)
}

/**
 * Seasons of the year.
 */
export enum Season {
  Spring = 'Spring',
  Summer = 'Summer',
  Autumn = 'Autumn',
  Winter = 'Winter',
}

/**
 * System execution frequencies in ticks.
 */
export enum TickFrequency {
  Daily = 1,
  Weekly = 7,
  Monthly = 30,
  Seasonal = 90,
  Annual = 365,
  Decadal = 3650,
}

/**
 * Simulation speed multipliers.
 * Negative values indicate special modes.
 */
export enum SimulationSpeed {
  Paused = 0,
  Normal = 1,
  Fast7 = 7,
  Fast30 = 30,
  Fast365 = 365,
  UltraFast3650 = 3650,
  SlowMotion = -1,
}

// Constants
const DAYS_PER_MONTH = 30;
const MONTHS_PER_YEAR = 12;
const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR; // 360

/**
 * Convert a WorldTime to total ticks since year 0.
 */
export function worldTimeToTicks(time: WorldTime): number {
  const yearsInDays = (time.year - 1) * DAYS_PER_YEAR;
  const monthsInDays = (time.month - 1) * DAYS_PER_MONTH;
  const days = time.day - 1;
  return yearsInDays + monthsInDays + days;
}

/**
 * Convert total ticks to a WorldTime.
 */
export function ticksToWorldTime(ticks: number): WorldTime {
  const year = Math.floor(ticks / DAYS_PER_YEAR) + 1;
  const remainingAfterYears = ticks % DAYS_PER_YEAR;
  const month = Math.floor(remainingAfterYears / DAYS_PER_MONTH) + 1;
  const day = (remainingAfterYears % DAYS_PER_MONTH) + 1;

  return { year, month, day };
}

/**
 * Add days to a WorldTime.
 */
export function addDays(time: WorldTime, days: number): WorldTime {
  const totalTicks = worldTimeToTicks(time) + days;
  return ticksToWorldTime(totalTicks);
}

/**
 * Compare two WorldTimes.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
export function compareTimes(a: WorldTime, b: WorldTime): -1 | 0 | 1 {
  const ticksA = worldTimeToTicks(a);
  const ticksB = worldTimeToTicks(b);

  if (ticksA < ticksB) return -1;
  if (ticksA > ticksB) return 1;
  return 0;
}

/**
 * Format a WorldTime as a human-readable string.
 */
export function formatTime(time: WorldTime): string {
  return `Year ${time.year}, Month ${time.month}, Day ${time.day}`;
}

/**
 * Get the season for a given WorldTime based on month.
 * Months 1-3: Spring, 4-6: Summer, 7-9: Autumn, 10-12: Winter
 */
export function getSeason(time: WorldTime): Season {
  if (time.month >= 1 && time.month <= 3) return Season.Spring;
  if (time.month >= 4 && time.month <= 6) return Season.Summer;
  if (time.month >= 7 && time.month <= 9) return Season.Autumn;
  return Season.Winter;
}

/**
 * Calculate the difference in days between two WorldTimes.
 * Returns a positive number if b is after a.
 */
export function timeDifferenceInDays(a: WorldTime, b: WorldTime): number {
  return worldTimeToTicks(b) - worldTimeToTicks(a);
}

/**
 * Create a WorldTime from components.
 */
export function createWorldTime(year: number, month: number, day: number): WorldTime {
  return { year, month, day };
}

/**
 * Get the start of a year.
 */
export function startOfYear(year: number): WorldTime {
  return { year, month: 1, day: 1 };
}

/**
 * Check if two WorldTimes are the same day.
 */
export function isSameDay(a: WorldTime, b: WorldTime): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}
