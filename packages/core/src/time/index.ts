/**
 * Time module - Time management for the simulation.
 */

// Types and helpers
export {
  type WorldTime,
  Season,
  TickFrequency,
  SimulationSpeed,
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
} from './types.js';

// World clock
export { WorldClock } from './world-clock.js';

// Time controller
export { TimeController, type StepUnit } from './time-controller.js';

// Tick scheduler
export { TickScheduler, type SystemName } from './tick-scheduler.js';
