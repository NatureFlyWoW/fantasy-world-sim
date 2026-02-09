// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * Preload script — exposes a typed AeternumAPI to the renderer via contextBridge.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels.js';
import type { AeternumAPI, SimulationCommand, InspectorQuery } from '../shared/types.js';

const api: AeternumAPI = {
  requestSnapshot() {
    return ipcRenderer.invoke(IPC_CHANNELS.WORLD_SNAPSHOT);
  },

  sendCommand(command: SimulationCommand) {
    ipcRenderer.send(IPC_CHANNELS.SIMULATION_COMMAND, command);
  },

  onTickDelta(callback) {
    ipcRenderer.on(IPC_CHANNELS.TICK_DELTA, (_event, delta) => {
      callback(delta);
    });
  },

  queryInspector(query: InspectorQuery) {
    return ipcRenderer.invoke(IPC_CHANNELS.INSPECTOR_QUERY, query);
  },
};

contextBridge.exposeInMainWorld('aeternum', api);
