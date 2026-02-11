/**
 * Typed IPC client wrapper for the renderer process.
 *
 * Wraps the `window.aeternum` API exposed by the preload script.
 */
import type { AeternumAPI, SimulationCommand, InspectorQuery, WorldSnapshot, TickDelta, InspectorResponse, LegendsSummary } from '../shared/types.js';

declare global {
  interface Window {
    aeternum: AeternumAPI;
  }
}

export interface IpcClient {
  requestSnapshot(): Promise<WorldSnapshot>;
  sendCommand(command: SimulationCommand): void;
  onTickDelta(callback: (delta: TickDelta) => void): void;
  queryInspector(query: InspectorQuery): Promise<InspectorResponse>;
  queryLegends(): Promise<LegendsSummary>;
}

export function createIpcClient(): IpcClient {
  const api = window.aeternum;

  return {
    requestSnapshot: () => api.requestSnapshot(),
    sendCommand: (command) => api.sendCommand(command),
    onTickDelta: (callback) => api.onTickDelta(callback),
    queryInspector: (query) => api.queryInspector(query),
    queryLegends: () => api.queryLegends(),
  };
}
