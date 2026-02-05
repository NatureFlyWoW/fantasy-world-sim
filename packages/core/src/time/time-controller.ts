/**
 * TimeController manages simulation speed and playback controls.
 */

import { SimulationSpeed, TickFrequency } from './types.js';

/**
 * Step units for manual time advancement.
 */
export type StepUnit = 'day' | 'week' | 'month' | 'year';

export class TimeController {
  private _speed: SimulationSpeed = SimulationSpeed.Paused;
  private _shouldAutoSlowDown = true;

  /**
   * Get the current simulation speed.
   */
  get speed(): SimulationSpeed {
    return this._speed;
  }

  /**
   * Whether to automatically slow down on significant events.
   */
  get shouldAutoSlowDown(): boolean {
    return this._shouldAutoSlowDown;
  }

  set shouldAutoSlowDown(value: boolean) {
    this._shouldAutoSlowDown = value;
  }

  /**
   * Set the simulation speed.
   */
  setSpeed(speed: SimulationSpeed): void {
    this._speed = speed;
  }

  /**
   * Pause the simulation.
   */
  pause(): void {
    this._speed = SimulationSpeed.Paused;
  }

  /**
   * Resume the simulation at normal speed.
   */
  play(): void {
    this._speed = SimulationSpeed.Normal;
  }

  /**
   * Check if the simulation is paused.
   */
  isPaused(): boolean {
    return this._speed === SimulationSpeed.Paused;
  }

  /**
   * Check if the simulation is in slow motion.
   */
  isSlowMotion(): boolean {
    return this._speed === SimulationSpeed.SlowMotion;
  }

  /**
   * Set fast forward mode with a multiplier.
   * @param multiplier Speed multiplier (7, 30, 365, or 3650)
   */
  fastForward(multiplier: 7 | 30 | 365 | 3650): void {
    switch (multiplier) {
      case 7:
        this._speed = SimulationSpeed.Fast7;
        break;
      case 30:
        this._speed = SimulationSpeed.Fast30;
        break;
      case 365:
        this._speed = SimulationSpeed.Fast365;
        break;
      case 3650:
        this._speed = SimulationSpeed.UltraFast3650;
        break;
    }
  }

  /**
   * Enter slow motion mode.
   */
  slowMotion(): void {
    this._speed = SimulationSpeed.SlowMotion;
  }

  /**
   * Get the number of ticks to advance per render frame based on current speed.
   * Slow motion returns 0 (handled specially by renderer for frame-by-frame).
   * Paused returns 0.
   */
  getTicksPerFrame(): number {
    switch (this._speed) {
      case SimulationSpeed.Paused:
        return 0;
      case SimulationSpeed.SlowMotion:
        return 0; // Special handling: 1 tick per multiple frames
      case SimulationSpeed.Normal:
        return 1;
      case SimulationSpeed.Fast7:
        return 7;
      case SimulationSpeed.Fast30:
        return 30;
      case SimulationSpeed.Fast365:
        return 365;
      case SimulationSpeed.UltraFast3650:
        return 3650;
      default:
        return 0;
    }
  }

  /**
   * Get the number of ticks for a step unit.
   */
  getTicksForStep(unit: StepUnit): number {
    switch (unit) {
      case 'day':
        return TickFrequency.Daily;
      case 'week':
        return TickFrequency.Weekly;
      case 'month':
        return TickFrequency.Monthly;
      case 'year':
        return TickFrequency.Annual;
    }
  }

  /**
   * Manually trigger a slow-down (e.g., when significant events converge).
   * Only affects speed if auto slow-down is enabled.
   */
  triggerSlowDown(): void {
    if (this._shouldAutoSlowDown && this._speed > SimulationSpeed.Normal) {
      this._speed = SimulationSpeed.Normal;
    }
  }

  /**
   * Get a human-readable description of the current speed.
   */
  getSpeedDescription(): string {
    switch (this._speed) {
      case SimulationSpeed.Paused:
        return 'Paused';
      case SimulationSpeed.SlowMotion:
        return 'Slow Motion';
      case SimulationSpeed.Normal:
        return 'Normal (1 day/frame)';
      case SimulationSpeed.Fast7:
        return 'Fast (1 week/frame)';
      case SimulationSpeed.Fast30:
        return 'Faster (1 month/frame)';
      case SimulationSpeed.Fast365:
        return 'Very Fast (1 year/frame)';
      case SimulationSpeed.UltraFast3650:
        return 'Ultra Fast (10 years/frame)';
      default:
        return 'Unknown';
    }
  }
}
