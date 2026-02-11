// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * IPC bridge — registers handlers for renderer ↔ main communication.
 */
import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels.js';
import type { SimulationRunner } from './simulation-runner.js';
import type { SimulationCommand, InspectorQuery, InspectorResponse, LegendsSummary } from '../shared/types.js';
import { inspectEntity } from './entity-inspector.js';
import { buildLegendsSummary } from './legends-provider.js';

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
    const world = runner.getWorld();
    const eventLog = runner.getEventLog();
    const clock = runner.getClock();
    if (world === null || eventLog === null || clock === null) {
      return { entityType: query.type, entityName: 'Unknown', summary: '', sections: [], prose: [], relatedEntities: [] };
    }
    return inspectEntity(query, world, eventLog, clock);
  });

  // Legends summary (invoke/handle)
  ipcMain.handle(IPC_CHANNELS.LEGENDS_SUMMARY, (): LegendsSummary => {
    const world = runner.getWorld();
    if (world === null) {
      return { characters: [], factions: [], sites: [], artifacts: [], deities: [] };
    }
    return buildLegendsSummary(world);
  });
}
