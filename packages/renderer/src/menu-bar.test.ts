/**
 * Tests for the MenuBar class.
 */

import { describe, it, expect, vi } from 'vitest';
import { MenuBar } from './menu-bar.js';
import type { MenuBarItem, MenuBarItemProvider } from './menu-bar.js';
import { MockScreen, createMockBoxFactory } from './panel.js';
import { PanelId } from './types.js';

function createTestMenuBar(
  itemProvider?: MenuBarItemProvider
): { menuBar: MenuBar; screen: MockScreen } {
  const screen = new MockScreen();
  const boxFactory = createMockBoxFactory(screen);

  const defaultProvider: MenuBarItemProvider = (_panelId: PanelId) => [
    { label: 'Map', key: '1', action: vi.fn() },
    { label: 'Events', key: '2', action: vi.fn() },
    { label: 'Inspector', key: '3', action: vi.fn() },
  ];

  const provider = itemProvider ?? defaultProvider;

  const menuBar = new MenuBar(
    screen as unknown as Parameters<typeof MenuBar.prototype.updateForPanel extends (...args: infer _A) => infer _R ? never : never>[0],
    boxFactory as unknown as Parameters<ConstructorParameters<typeof MenuBar>[1] extends infer T ? T : never>[0],
    provider
  );

  return { menuBar, screen };
}

describe('MenuBar', () => {
  describe('constructor', () => {
    it('creates a box element appended to the screen', () => {
      const screen = new MockScreen();
      const boxFactory = createMockBoxFactory(screen);

      const provider: MenuBarItemProvider = () => [
        { label: 'Test', action: vi.fn() },
      ];

      // The constructor appends the box to the screen via boxFactory
      // (which also calls screen.append internally) and then updateForPanel
      // appends it again via screen.append in the MenuBar constructor.
      // Let's just check boxes were created.
      const _menuBar = new MenuBar(
        screen as unknown as Parameters<ConstructorParameters<typeof MenuBar>[0] extends infer T ? T : never>[0],
        boxFactory as unknown as ConstructorParameters<typeof MenuBar>[1],
        provider
      );

      const elements = screen.getElements();
      // boxFactory appends one element, then MenuBar constructor calls screen.append
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('initializes with PanelId.Map as current panel', () => {
      const { menuBar } = createTestMenuBar();
      expect(menuBar.getCurrentPanelId()).toBe(PanelId.Map);
    });

    it('initializes with items from provider', () => {
      const { menuBar } = createTestMenuBar();
      expect(menuBar.getItems().length).toBe(3);
    });

    it('initializes selected index to 0', () => {
      const { menuBar } = createTestMenuBar();
      expect(menuBar.getSelectedIndex()).toBe(0);
    });
  });

  describe('updateForPanel', () => {
    it('updates the current panel id', () => {
      const { menuBar } = createTestMenuBar();

      menuBar.updateForPanel(PanelId.EventLog);
      expect(menuBar.getCurrentPanelId()).toBe(PanelId.EventLog);
    });

    it('refreshes items from provider with new panel id', () => {
      const provider: MenuBarItemProvider = (panelId: PanelId) => {
        if (panelId === PanelId.EventLog) {
          return [
            { label: 'Filter', action: vi.fn() },
            { label: 'Search', action: vi.fn() },
          ];
        }
        return [{ label: 'Default', action: vi.fn() }];
      };

      const { menuBar } = createTestMenuBar(provider);

      expect(menuBar.getItems().length).toBe(1); // Map panel -> 1 item

      menuBar.updateForPanel(PanelId.EventLog);
      expect(menuBar.getItems().length).toBe(2);
      expect(menuBar.getItems()[0]?.label).toBe('Filter');
    });

    it('resets selected index to 0', () => {
      const { menuBar } = createTestMenuBar();

      menuBar.selectNext();
      menuBar.selectNext();
      expect(menuBar.getSelectedIndex()).toBe(2);

      menuBar.updateForPanel(PanelId.Inspector);
      expect(menuBar.getSelectedIndex()).toBe(0);
    });
  });

  describe('selectNext', () => {
    it('advances selected index by 1', () => {
      const { menuBar } = createTestMenuBar();

      menuBar.selectNext();
      expect(menuBar.getSelectedIndex()).toBe(1);
    });

    it('wraps around from last to first', () => {
      const { menuBar } = createTestMenuBar();

      menuBar.selectNext(); // 1
      menuBar.selectNext(); // 2
      menuBar.selectNext(); // 0 (wrap)
      expect(menuBar.getSelectedIndex()).toBe(0);
    });

    it('does nothing when there are no items', () => {
      const provider: MenuBarItemProvider = () => [];
      const { menuBar } = createTestMenuBar(provider);

      menuBar.selectNext();
      expect(menuBar.getSelectedIndex()).toBe(0);
    });
  });

  describe('selectPrevious', () => {
    it('decrements selected index by 1', () => {
      const { menuBar } = createTestMenuBar();

      menuBar.selectNext(); // Move to 1
      menuBar.selectPrevious(); // Back to 0
      expect(menuBar.getSelectedIndex()).toBe(0);
    });

    it('wraps around from first to last', () => {
      const { menuBar } = createTestMenuBar();

      menuBar.selectPrevious(); // Wrap to 2 (last)
      expect(menuBar.getSelectedIndex()).toBe(2);
    });

    it('does nothing when there are no items', () => {
      const provider: MenuBarItemProvider = () => [];
      const { menuBar } = createTestMenuBar(provider);

      menuBar.selectPrevious();
      expect(menuBar.getSelectedIndex()).toBe(0);
    });
  });

  describe('activateSelected', () => {
    it('calls the action of the selected item', () => {
      const action1 = vi.fn();
      const action2 = vi.fn();
      const action3 = vi.fn();

      const provider: MenuBarItemProvider = () => [
        { label: 'A', action: action1 },
        { label: 'B', action: action2 },
        { label: 'C', action: action3 },
      ];

      const { menuBar } = createTestMenuBar(provider);

      menuBar.activateSelected();
      expect(action1).toHaveBeenCalledTimes(1);
      expect(action2).not.toHaveBeenCalled();

      menuBar.selectNext();
      menuBar.activateSelected();
      expect(action2).toHaveBeenCalledTimes(1);
    });

    it('does nothing when there are no items', () => {
      const provider: MenuBarItemProvider = () => [];
      const { menuBar } = createTestMenuBar(provider);

      // Should not throw
      menuBar.activateSelected();
    });
  });

  describe('getItems', () => {
    it('returns the current items from provider', () => {
      const provider: MenuBarItemProvider = () => [
        { label: 'X', action: vi.fn() },
        { label: 'Y', action: vi.fn() },
      ];

      const { menuBar } = createTestMenuBar(provider);

      const items = menuBar.getItems();
      expect(items.length).toBe(2);
      expect(items[0]?.label).toBe('X');
      expect(items[1]?.label).toBe('Y');
    });

    it('returns readonly array', () => {
      const { menuBar } = createTestMenuBar();
      const items: readonly MenuBarItem[] = menuBar.getItems();
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe('getCurrentPanelId', () => {
    it('returns the panel the menu is showing for', () => {
      const { menuBar } = createTestMenuBar();

      expect(menuBar.getCurrentPanelId()).toBe(PanelId.Map);

      menuBar.updateForPanel(PanelId.Statistics);
      expect(menuBar.getCurrentPanelId()).toBe(PanelId.Statistics);
    });
  });

  describe('destroy', () => {
    it('destroys the underlying box element', () => {
      const screen = new MockScreen();
      const boxFactory = createMockBoxFactory(screen);
      const provider: MenuBarItemProvider = () => [
        { label: 'Test', action: vi.fn() },
      ];

      const menuBar = new MenuBar(
        screen as unknown as ConstructorParameters<typeof MenuBar>[0],
        boxFactory as unknown as ConstructorParameters<typeof MenuBar>[1],
        provider
      );

      menuBar.destroy();

      // The MockBox should be destroyed
      const elements = screen.getElements();
      const lastElement = elements[elements.length - 1];
      expect(lastElement?.isDestroyed()).toBe(true);
    });
  });

  describe('handleClick', () => {
    it('activates first item when clicked within its bounds', () => {
      const action1 = vi.fn();
      const action2 = vi.fn();
      const provider: MenuBarItemProvider = () => [
        { label: 'Map', action: action1 },
        { label: 'Events', action: action2 },
      ];

      const { menuBar } = createTestMenuBar(provider);

      // ' Map ' = 5 chars (0-4), '|' = 1 char (5), ' Events ' = 8 chars (6-13)
      const result = menuBar.handleClick(2); // Inside ' Map '

      expect(result).toBe(true);
      expect(action1).toHaveBeenCalledTimes(1);
      expect(action2).not.toHaveBeenCalled();
      expect(menuBar.getSelectedIndex()).toBe(0);
    });

    it('activates second item when clicked within its bounds', () => {
      const action1 = vi.fn();
      const action2 = vi.fn();
      const provider: MenuBarItemProvider = () => [
        { label: 'Map', action: action1 },
        { label: 'Events', action: action2 },
      ];

      const { menuBar } = createTestMenuBar(provider);

      // ' Map ' = 5 chars (0-4), '|' = 1 char (5), ' Events ' starts at 6
      const result = menuBar.handleClick(8); // Inside ' Events '

      expect(result).toBe(true);
      expect(action1).not.toHaveBeenCalled();
      expect(action2).toHaveBeenCalledTimes(1);
      expect(menuBar.getSelectedIndex()).toBe(1);
    });

    it('returns false when clicking on separator', () => {
      const action1 = vi.fn();
      const action2 = vi.fn();
      const provider: MenuBarItemProvider = () => [
        { label: 'Map', action: action1 },
        { label: 'Events', action: action2 },
      ];

      const { menuBar } = createTestMenuBar(provider);

      // Separator '|' at x=5
      const result = menuBar.handleClick(5);

      expect(result).toBe(false);
      expect(action1).not.toHaveBeenCalled();
      expect(action2).not.toHaveBeenCalled();
    });

    it('returns false when clicking beyond last item', () => {
      const action1 = vi.fn();
      const provider: MenuBarItemProvider = () => [
        { label: 'Map', action: action1 },
      ];

      const { menuBar } = createTestMenuBar(provider);

      // ' Map ' = 5 chars (0-4), clicking at 10 is beyond
      const result = menuBar.handleClick(10);

      expect(result).toBe(false);
      expect(action1).not.toHaveBeenCalled();
    });

    it('returns false with empty items', () => {
      const provider: MenuBarItemProvider = () => [];
      const { menuBar } = createTestMenuBar(provider);

      const result = menuBar.handleClick(0);

      expect(result).toBe(false);
    });

    it('updates selectedIndex on click', () => {
      const provider: MenuBarItemProvider = () => [
        { label: 'Map', action: vi.fn() },
        { label: 'Events', action: vi.fn() },
        { label: 'Inspector', action: vi.fn() },
      ];

      const { menuBar } = createTestMenuBar(provider);

      // Click third item: ' Map '(5) + '|'(1) + ' Events '(8) + '|'(1) = offset 15
      menuBar.handleClick(16); // Inside ' Inspector '

      expect(menuBar.getSelectedIndex()).toBe(2);
    });
  });

  describe('navigation cycling', () => {
    it('cycles forward through all items', () => {
      const { menuBar } = createTestMenuBar();

      expect(menuBar.getSelectedIndex()).toBe(0);
      menuBar.selectNext();
      expect(menuBar.getSelectedIndex()).toBe(1);
      menuBar.selectNext();
      expect(menuBar.getSelectedIndex()).toBe(2);
      menuBar.selectNext();
      expect(menuBar.getSelectedIndex()).toBe(0); // Wrapped
    });

    it('cycles backward through all items', () => {
      const { menuBar } = createTestMenuBar();

      expect(menuBar.getSelectedIndex()).toBe(0);
      menuBar.selectPrevious();
      expect(menuBar.getSelectedIndex()).toBe(2); // Wrapped to last
      menuBar.selectPrevious();
      expect(menuBar.getSelectedIndex()).toBe(1);
      menuBar.selectPrevious();
      expect(menuBar.getSelectedIndex()).toBe(0);
    });

    it('handles single-item menu', () => {
      const provider: MenuBarItemProvider = () => [
        { label: 'Only', action: vi.fn() },
      ];

      const { menuBar } = createTestMenuBar(provider);

      menuBar.selectNext();
      expect(menuBar.getSelectedIndex()).toBe(0); // Wraps back to 0

      menuBar.selectPrevious();
      expect(menuBar.getSelectedIndex()).toBe(0); // Wraps back to 0
    });
  });
});
