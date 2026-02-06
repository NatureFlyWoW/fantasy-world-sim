/**
 * Tests for Application key delegation in app.ts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Application } from './app.js';
import { MockScreen, createMockBoxFactory } from './panel.js';
import type { MockKeyEvent } from './panel.js';
import type { RenderContext } from './types.js';
import { PanelId } from './types.js';
import { EventLog, EventBus } from '@fws/core';
import type { World, WorldClock, SpatialIndex } from '@fws/core';
import type { BasePanel } from './panel.js';

/**
 * Stub panel that records handleInput calls for testing.
 */
class StubPanel {
  readonly inputLog: string[] = [];
  private layout = { id: PanelId.Map, x: 0, y: 0, width: 60, height: 40, focused: false };

  handleInput(key: string): boolean {
    this.inputLog.push(key);
    return true;
  }

  render(): void {
    // no-op
  }

  focus(): void {
    this.layout.focused = true;
  }

  blur(): void {
    this.layout.focused = false;
  }

  moveTo(_x: number, _y: number): void {
    // no-op
  }

  resize(_w: number, _h: number): void {
    // no-op
  }

  destroy(): void {
    // no-op
  }

  getLayout(): typeof this.layout {
    return { ...this.layout };
  }
}

function createMockContext(): RenderContext {
  const eventLog = new EventLog();
  const eventBus = new EventBus();

  return {
    world: {
      hasStore: () => false,
      getComponent: () => undefined,
    } as unknown as World,
    clock: {
      currentTick: 0,
      currentTime: { year: 1, month: 1, day: 1 },
    } as unknown as WorldClock,
    eventLog,
    eventBus,
    spatialIndex: {} as SpatialIndex,
  };
}

describe('Application key delegation', () => {
  let screen: MockScreen;
  let app: Application;
  let mapPanel: StubPanel;
  let inspectorPanel: StubPanel;
  let eventLogPanel: StubPanel;

  // Suppress process.exit during tests
  const originalExit = process.exit;

  beforeEach(() => {
    process.exit = vi.fn() as unknown as typeof process.exit;

    screen = new MockScreen();
    const boxFactory = createMockBoxFactory(screen);
    const context = createMockContext();

    app = new Application(context);
    app.setFactories(
      () => screen as unknown as Parameters<typeof app.setFactories>[0] extends () => infer R ? R : never,
      boxFactory as unknown as Parameters<typeof app.setFactories>[1],
    );

    mapPanel = new StubPanel();
    inspectorPanel = new StubPanel();
    eventLogPanel = new StubPanel();

    app.registerPanel(mapPanel as unknown as BasePanel, PanelId.Map);
    app.registerPanel(inspectorPanel as unknown as BasePanel, PanelId.Inspector);
    app.registerPanel(eventLogPanel as unknown as BasePanel, PanelId.EventLog);

    app.start();
  });

  afterEach(() => {
    process.exit = originalExit;
    app.stop();
  });

  describe('catch-all keypress delegation', () => {
    it('delegates arrow keys to focused panel', () => {
      // Map is focused by default
      screen.simulateKeypress(undefined, { name: 'up' });
      screen.simulateKeypress(undefined, { name: 'down' });
      screen.simulateKeypress(undefined, { name: 'left' });
      screen.simulateKeypress(undefined, { name: 'right' });

      expect(mapPanel.inputLog).toEqual(['up', 'down', 'left', 'right']);
    });

    it('delegates enter key to focused panel', () => {
      screen.simulateKeypress(undefined, { name: 'enter' });

      expect(mapPanel.inputLog).toEqual(['enter']);
    });

    it('delegates Inspector mode keys o/r/t/d when Inspector is focused', () => {
      app.focusPanel(PanelId.Inspector);

      screen.simulateKeypress('o', { name: 'o' });
      screen.simulateKeypress('r', { name: 'r' });
      screen.simulateKeypress('t', { name: 't' });
      screen.simulateKeypress('d', { name: 'd' });

      expect(inspectorPanel.inputLog).toEqual(['o', 'r', 't', 'd']);
    });

    it('delegates EventLog keys b/g/v/h to focused EventLog panel', () => {
      app.focusPanel(PanelId.EventLog);

      screen.simulateKeypress('b', { name: 'b' });
      screen.simulateKeypress('g', { name: 'g' });
      screen.simulateKeypress('v', { name: 'v' });
      screen.simulateKeypress('h', { name: 'h' });

      expect(eventLogPanel.inputLog).toEqual(['b', 'g', 'v', 'h']);
    });

    it('delegates slash (/) to focused panel for search', () => {
      app.focusPanel(PanelId.EventLog);

      screen.simulateKeypress('/', { name: '/' });

      expect(eventLogPanel.inputLog).toEqual(['/']);
    });

    it('delegates vim navigation keys j/k/h to focused panel', () => {
      screen.simulateKeypress('j', { name: 'j' });
      screen.simulateKeypress('k', { name: 'k' });
      screen.simulateKeypress('h', { name: 'h' });

      expect(mapPanel.inputLog).toEqual(['j', 'k', 'h']);
    });

    it('delegates WASD keys to focused panel', () => {
      screen.simulateKeypress('w', { name: 'w' });
      screen.simulateKeypress('a', { name: 'a' });
      screen.simulateKeypress('s', { name: 's' });
      screen.simulateKeypress('d', { name: 'd' });

      expect(mapPanel.inputLog).toEqual(['w', 'a', 's', 'd']);
    });

    it('delegates bracket keys to focused panel', () => {
      screen.simulateKeypress('[', { name: '[' });
      screen.simulateKeypress(']', { name: ']' });

      expect(mapPanel.inputLog).toEqual(['[', ']']);
    });

    it('delegates home/end keys to focused panel', () => {
      screen.simulateKeypress(undefined, { name: 'home' });
      screen.simulateKeypress(undefined, { name: 'end' });

      expect(mapPanel.inputLog).toEqual(['home', 'end']);
    });

    it('delegates f and z keys to focused panel', () => {
      screen.simulateKeypress('f', { name: 'f' });
      screen.simulateKeypress('z', { name: 'z' });

      expect(mapPanel.inputLog).toEqual(['f', 'z']);
    });

    it('delegates c key to focused panel', () => {
      app.focusPanel(PanelId.EventLog);

      screen.simulateKeypress('c', { name: 'c' });

      expect(eventLogPanel.inputLog).toEqual(['c']);
    });
  });

  describe('global keys are NOT delegated', () => {
    it('does not delegate q to focused panel', () => {
      screen.simulateKeypress('q', { name: 'q' });

      expect(mapPanel.inputLog).toEqual([]);
    });

    it('does not delegate tab to focused panel', () => {
      screen.simulateKeypress(undefined, { name: 'tab' });

      expect(mapPanel.inputLog).toEqual([]);
    });

    it('does not delegate space to focused panel', () => {
      screen.simulateKeypress(' ', { name: 'space' });

      expect(mapPanel.inputLog).toEqual([]);
    });

    it('does not delegate escape to focused panel', () => {
      screen.simulateKeypress(undefined, { name: 'escape' });

      expect(mapPanel.inputLog).toEqual([]);
    });

    it('does not delegate f1 to focused panel', () => {
      screen.simulateKeypress(undefined, { name: 'f1' });

      expect(mapPanel.inputLog).toEqual([]);
    });

    it('does not delegate m to focused panel', () => {
      screen.simulateKeypress('m', { name: 'm' });

      expect(mapPanel.inputLog).toEqual([]);
    });

    it('does not delegate l to focused panel', () => {
      screen.simulateKeypress('l', { name: 'l' });

      expect(mapPanel.inputLog).toEqual([]);
    });

    it('does not delegate ctrl key combos to focused panel', () => {
      screen.simulateKeypress('s', { name: 's', ctrl: true });

      expect(mapPanel.inputLog).toEqual([]);
    });

    it('does not delegate number keys (1-7) to non-Inspector panels', () => {
      // Map is focused by default
      screen.simulateKeypress('1', { name: '1' });
      screen.simulateKeypress('2', { name: '2' });

      expect(mapPanel.inputLog).toEqual([]);
    });

    it('ignores empty keypresses', () => {
      screen.simulateKeypress(undefined, undefined);
      screen.simulateKeypress(undefined, { name: '' });
      screen.simulateKeypress('', { name: '' });

      expect(mapPanel.inputLog).toEqual([]);
    });
  });

  describe('number key context awareness for Inspector', () => {
    it('delegates number keys 1-7 to Inspector when Inspector is focused', () => {
      app.focusPanel(PanelId.Inspector);

      screen.simulateKey('1');
      screen.simulateKey('2');
      screen.simulateKey('3');
      screen.simulateKey('4');
      screen.simulateKey('5');
      screen.simulateKey('6');
      screen.simulateKey('7');

      expect(inspectorPanel.inputLog).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    });

    it('switches panel when number keys are pressed and Inspector is NOT focused', () => {
      // Map is focused by default
      screen.simulateKey('3');

      // Should switch to Inspector (panel index 3)
      const state = app.getState();
      expect(state.focusedPanel).toBe(PanelId.Inspector);

      // Should NOT have sent '3' to mapPanel
      expect(mapPanel.inputLog).toEqual([]);
    });

    it('does not switch panel when number key is pressed while Inspector is focused', () => {
      app.focusPanel(PanelId.Inspector);

      screen.simulateKey('1');

      // Should still be on Inspector, not switched to Map
      const state = app.getState();
      expect(state.focusedPanel).toBe(PanelId.Inspector);

      // Should have sent '1' to Inspector for section toggle
      expect(inspectorPanel.inputLog).toEqual(['1']);
    });
  });

  describe('key delegation follows focused panel', () => {
    it('delegates to EventLog when EventLog is focused', () => {
      app.focusPanel(PanelId.EventLog);

      screen.simulateKeypress('b', { name: 'b' });

      expect(eventLogPanel.inputLog).toEqual(['b']);
      expect(mapPanel.inputLog).toEqual([]);
    });

    it('delegates to Map when Map is focused', () => {
      // Map is default focused
      screen.simulateKeypress(undefined, { name: 'up' });

      expect(mapPanel.inputLog).toEqual(['up']);
      expect(eventLogPanel.inputLog).toEqual([]);
    });

    it('switches delegation target when focus changes', () => {
      screen.simulateKeypress('o', { name: 'o' });
      expect(mapPanel.inputLog).toEqual(['o']);

      app.focusPanel(PanelId.Inspector);

      screen.simulateKeypress('o', { name: 'o' });
      expect(inspectorPanel.inputLog).toEqual(['o']);
    });
  });

  describe('keypress with ch fallback', () => {
    it('uses ch when key.name is empty', () => {
      screen.simulateKeypress('x', { name: '' });

      expect(mapPanel.inputLog).toEqual(['x']);
    });

    it('uses key.name when both ch and name are present', () => {
      screen.simulateKeypress('u', { name: 'up' });

      expect(mapPanel.inputLog).toEqual(['up']);
    });

    it('uses ch when key is undefined', () => {
      screen.simulateKeypress('p', undefined);

      expect(mapPanel.inputLog).toEqual(['p']);
    });
  });
});
