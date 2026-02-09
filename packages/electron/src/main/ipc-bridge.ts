// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * IPC bridge — registers handlers for renderer ↔ main communication.
 */
import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels.js';
import type { SimulationRunner } from './simulation-runner.js';
import type { SimulationCommand, InspectorQuery, InspectorResponse } from '../shared/types.js';

export function registerIpcHandlers(
  runner: SimulationRunner,
  _window: BrowserWindow,
): void {
  // World snapshot (invoke/handle)
  ipcMain.handle(IPC_CHANNELS.WORLD_SNAPSHOT, () => {
    return runner.getSnapshot();
  });

  // Simulation commands (send/on)
  ipcMain.on(IPC_CHANNELS.SIMULATION_COMMAND, (_event, command: SimulationCommand) => {
    switch (command.type) {
      case 'set-speed':
        runner.setSpeed(command.ticksPerSecond);
        break;
      case 'pause':
        runner.pause();
        break;
      case 'resume':
        runner.resume();
        break;
      case 'step':
        runner.step(command.ticks);
        break;
    }
  });

  // Inspector queries (invoke/handle)
  ipcMain.handle(IPC_CHANNELS.INSPECTOR_QUERY, (_event, query: InspectorQuery): InspectorResponse => {
    // Phase 0: stub response — full inspector wiring in Phase 4
    return {
      sections: [{ title: 'Overview', content: `Inspecting ${query.type} #${query.id}` }],
      prose: [`No detailed information available yet for ${query.type} #${query.id}.`],
      relatedEntities: [],
    };
  });
}
