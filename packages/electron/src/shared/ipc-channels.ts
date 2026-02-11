/**
 * IPC channel name constants shared between main, preload, and renderer.
 */
export const IPC_CHANNELS = {
  /** Renderer requests full world snapshot (invoke/handle) */
  WORLD_SNAPSHOT: 'world:snapshot',

  /** Main sends tick delta to renderer (send/on) */
  TICK_DELTA: 'simulation:tick-delta',

  /** Renderer sends simulation command to main (send/on) */
  SIMULATION_COMMAND: 'simulation:command',

  /** Renderer requests inspector data (invoke/handle) */
  INSPECTOR_QUERY: 'inspector:query',

  /** Renderer requests legends summary (invoke/handle) */
  LEGENDS_SUMMARY: 'legends:summary',
} as const;
