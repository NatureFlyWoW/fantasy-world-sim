import type { InspectorQuery } from '../shared/types.js';

export type UIEventMap = {
  'inspect-entity': { type: InspectorQuery['type']; id: number };
  'center-map': { x: number; y: number };
  'panel-focus': { panelId: 'map' | 'chronicle' | 'inspector' };
};

class UIEventBus {
  private readonly listeners = new Map<string, Set<Function>>();

  on<K extends keyof UIEventMap>(event: K, handler: (data: UIEventMap[K]) => void): void {
    let set = this.listeners.get(event);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
  }

  off<K extends keyof UIEventMap>(event: K, handler: (data: UIEventMap[K]) => void): void {
    const set = this.listeners.get(event);
    if (set !== undefined) set.delete(handler);
  }

  emit<K extends keyof UIEventMap>(event: K, data: UIEventMap[K]): void {
    const set = this.listeners.get(event);
    if (set !== undefined) {
      for (const handler of set) {
        (handler as (data: UIEventMap[K]) => void)(data);
      }
    }
  }
}

export const uiEvents = new UIEventBus();
