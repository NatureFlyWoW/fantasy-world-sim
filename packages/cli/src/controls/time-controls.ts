/**
 * SimulationTimeControls wraps TimeController from @fws/core with UI integration.
 * Provides auto-slowdown on high-significance event clusters.
 */

import type { EventBus, WorldEvent, Unsubscribe, SimulationEngine } from '@fws/core';
import { TimeController, SimulationSpeed } from '@fws/core';
import type { StepUnit } from '@fws/core';

/**
 * Re-export types for convenience.
 */
export type { StepUnit };
export { SimulationSpeed };

/**
 * Callback for speed change notifications.
 */
export type SpeedChangeCallback = (
  newSpeed: SimulationSpeed,
  reason: 'manual' | 'auto-slowdown' | 'auto-pause-legendary'
) => void;

/**
 * Configuration for auto-slowdown feature.
 */
export interface AutoSlowdownConfig {
  /** Enable auto-slowdown feature. Default: true */
  readonly enabled: boolean;
  /** Significance threshold for counting events. Default: 90 */
  readonly significanceThreshold: number;
  /** Number of high-significance events within window to trigger slowdown. Default: 3 */
  readonly eventCountThreshold: number;
  /** Window size in ticks to count events. Default: 30 */
  readonly windowTicks: number;
  /** Significance threshold for auto-pausing on legendary events. Default: 95 */
  readonly legendaryPauseThreshold: number;
}

/**
 * Default auto-slowdown configuration.
 */
const DEFAULT_AUTO_SLOWDOWN: AutoSlowdownConfig = {
  enabled: true,
  significanceThreshold: 90,
  eventCountThreshold: 3,
  windowTicks: 30,
  legendaryPauseThreshold: 95,
};

/**
 * Speed progression order for cycling.
 */
const SPEED_ORDER: readonly SimulationSpeed[] = [
  SimulationSpeed.Paused,
  SimulationSpeed.SlowMotion,
  SimulationSpeed.Normal,
  SimulationSpeed.Fast7,
  SimulationSpeed.Fast30,
  SimulationSpeed.Fast365,
  SimulationSpeed.UltraFast3650,
];

/**
 * SimulationTimeControls wraps TimeController with UI integration.
 */
export class SimulationTimeControls {
  private readonly controller: TimeController;
  private readonly eventBus: EventBus;
  private readonly autoSlowdownConfig: AutoSlowdownConfig;

  private eventSubscription: Unsubscribe | null = null;
  private speedChangeCallbacks: SpeedChangeCallback[] = [];
  private engine: SimulationEngine | null = null;

  /** Ring buffer of recent high-significance event ticks */
  private recentSignificantEvents: number[] = [];
  private currentTick = 0;
  /** Last legendary event that caused auto-pause */
  private lastLegendaryEvent: WorldEvent | null = null;

  constructor(
    eventBus: EventBus,
    autoSlowdownConfig: Partial<AutoSlowdownConfig> = {}
  ) {
    this.controller = new TimeController();
    this.eventBus = eventBus;
    this.autoSlowdownConfig = { ...DEFAULT_AUTO_SLOWDOWN, ...autoSlowdownConfig };

    this.subscribeToEvents();
  }

  /**
   * Set the simulation engine for step operations.
   */
  setEngine(engine: SimulationEngine): void {
    this.engine = engine;
  }

  /**
   * Get the current simulation speed.
   */
  get currentSpeed(): SimulationSpeed {
    return this.controller.speed;
  }

  /**
   * Set the simulation speed.
   */
  setSpeed(speed: SimulationSpeed): void {
    const previousSpeed = this.controller.speed;
    this.controller.setSpeed(speed);

    if (previousSpeed !== speed) {
      this.notifySpeedChange(speed, 'manual');
    }
  }

  /**
   * Pause the simulation.
   */
  pause(): void {
    if (this.controller.speed !== SimulationSpeed.Paused) {
      this.controller.pause();
      this.notifySpeedChange(SimulationSpeed.Paused, 'manual');
    }
  }

  /**
   * Resume simulation at normal speed.
   */
  play(): void {
    if (this.controller.speed !== SimulationSpeed.Normal) {
      this.controller.play();
      this.notifySpeedChange(SimulationSpeed.Normal, 'manual');
    }
  }

  /**
   * Toggle between paused and normal speed (space bar handler).
   */
  togglePause(): void {
    if (this.controller.isPaused()) {
      this.play();
    } else {
      this.pause();
    }
  }

  /**
   * Step forward by a time unit while paused.
   * Runs the engine for the appropriate number of ticks.
   */
  step(unit: StepUnit): void {
    if (this.engine === null) return;

    const ticks = this.controller.getTicksForStep(unit);
    this.engine.run(ticks);
  }

  /**
   * Increase simulation speed (+ key handler).
   */
  faster(): void {
    const currentIndex = SPEED_ORDER.indexOf(this.controller.speed);
    if (currentIndex < SPEED_ORDER.length - 1) {
      const nextSpeed = SPEED_ORDER[currentIndex + 1];
      if (nextSpeed !== undefined) {
        this.setSpeed(nextSpeed);
      }
    }
  }

  /**
   * Decrease simulation speed (- key handler).
   */
  slower(): void {
    const currentIndex = SPEED_ORDER.indexOf(this.controller.speed);
    if (currentIndex > 0) {
      const previousSpeed = SPEED_ORDER[currentIndex - 1];
      if (previousSpeed !== undefined) {
        this.setSpeed(previousSpeed);
      }
    }
  }

  /**
   * Get the number of ticks to run per frame based on current speed.
   */
  getTicksPerFrame(): number {
    return this.controller.getTicksPerFrame();
  }

  /**
   * Get human-readable speed description.
   */
  getSpeedDescription(): string {
    return this.controller.getSpeedDescription();
  }

  /**
   * Check if simulation is paused.
   */
  isPaused(): boolean {
    return this.controller.isPaused();
  }

  /**
   * Check if simulation is in slow motion.
   */
  isSlowMotion(): boolean {
    return this.controller.isSlowMotion();
  }

  /**
   * Get/set auto-slowdown enabled state.
   */
  get autoSlowdown(): boolean {
    return this.autoSlowdownConfig.enabled;
  }

  /**
   * Get the last legendary event that triggered auto-pause (if any).
   */
  getLastLegendaryEvent(): WorldEvent | null {
    return this.lastLegendaryEvent;
  }

  /**
   * Update the current tick (call from simulation loop).
   */
  setCurrentTick(tick: number): void {
    this.currentTick = tick;
    this.pruneOldEvents();
  }

  /**
   * Register a callback for speed changes.
   */
  onSpeedChange(callback: SpeedChangeCallback): Unsubscribe {
    this.speedChangeCallbacks.push(callback);
    return () => {
      const index = this.speedChangeCallbacks.indexOf(callback);
      if (index >= 0) {
        this.speedChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    if (this.eventSubscription !== null) {
      this.eventSubscription();
      this.eventSubscription = null;
    }
    this.speedChangeCallbacks = [];
  }

  /**
   * Subscribe to EventBus for auto-slowdown feature.
   */
  private subscribeToEvents(): void {
    this.eventSubscription = this.eventBus.onAny((event: WorldEvent) => {
      this.handleEvent(event);
    });
  }

  /**
   * Handle incoming event for auto-slowdown and auto-pause checks.
   */
  private handleEvent(event: WorldEvent): void {
    if (!this.autoSlowdownConfig.enabled) return;

    // Legendary event auto-pause: immediate pause for sig 95+
    if (event.significance >= this.autoSlowdownConfig.legendaryPauseThreshold) {
      if (this.controller.speed !== SimulationSpeed.Paused) {
        this.controller.pause();
        this.notifySpeedChange(SimulationSpeed.Paused, 'auto-pause-legendary');
        this.lastLegendaryEvent = event;
      }
      return;
    }

    if (event.significance < this.autoSlowdownConfig.significanceThreshold) return;

    // Record this high-significance event
    this.recentSignificantEvents.push(event.timestamp);
    this.pruneOldEvents();

    // Check if we should trigger auto-slowdown
    if (this.recentSignificantEvents.length >= this.autoSlowdownConfig.eventCountThreshold) {
      this.triggerAutoSlowdown();
    }
  }

  /**
   * Remove events outside the window.
   */
  private pruneOldEvents(): void {
    const windowStart = this.currentTick - this.autoSlowdownConfig.windowTicks;
    this.recentSignificantEvents = this.recentSignificantEvents.filter(
      (tick) => tick >= windowStart
    );
  }

  /**
   * Trigger auto-slowdown when conditions are met.
   */
  private triggerAutoSlowdown(): void {
    // Only slow down if we're going faster than Normal
    if (this.controller.speed > SimulationSpeed.Normal) {
      this.controller.setSpeed(SimulationSpeed.Normal);
      this.notifySpeedChange(SimulationSpeed.Normal, 'auto-slowdown');
    }

    // Clear the recent events to avoid re-triggering immediately
    this.recentSignificantEvents = [];
  }

  /**
   * Notify all registered callbacks of a speed change.
   */
  private notifySpeedChange(speed: SimulationSpeed, reason: 'manual' | 'auto-slowdown' | 'auto-pause-legendary'): void {
    for (const callback of this.speedChangeCallbacks) {
      callback(speed, reason);
    }
  }
}
