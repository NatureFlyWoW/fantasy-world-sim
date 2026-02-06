import { describe, it, expect, beforeEach } from 'vitest';
import {
  LayoutManager,
  calculateDefaultLayout,
  calculateMapFocusLayout,
  calculateLogFocusLayout,
  calculateSplitLayout,
  calculateMaximizedLayout,
  getLayoutForPreset,
} from './layout-manager.js';
import type { ScreenDimensions } from './layout-manager.js';
import { PanelId } from './types.js';

describe('LayoutManager', () => {
  const testScreen: ScreenDimensions = { width: 120, height: 40 };

  describe('calculateDefaultLayout', () => {
    it('creates layout with status bar and menu bar', () => {
      const layout = calculateDefaultLayout(testScreen);
      expect(layout.statusBarHeight).toBe(1);
      expect(layout.menuBarHeight).toBe(1);
    });

    it('creates map panel at 60% width', () => {
      const layout = calculateDefaultLayout(testScreen);
      const mapPanel = layout.panels.get(PanelId.Map);

      expect(mapPanel).toBeDefined();
      expect(mapPanel?.x).toBe(0);
      expect(mapPanel?.y).toBe(1); // Below menu bar
      expect(mapPanel?.width).toBe(72); // 60% of 120
      expect(mapPanel?.height).toBe(38); // 40 - 1 status bar - 1 menu bar
    });

    it('creates event log panel on right top', () => {
      const layout = calculateDefaultLayout(testScreen);
      const logPanel = layout.panels.get(PanelId.EventLog);

      expect(logPanel).toBeDefined();
      expect(logPanel?.x).toBe(72); // After map
      expect(logPanel?.y).toBe(1); // Below menu bar
      expect(logPanel?.width).toBe(48); // 40% of 120
    });

    it('creates inspector panel on right bottom', () => {
      const layout = calculateDefaultLayout(testScreen);
      const inspectorPanel = layout.panels.get(PanelId.Inspector);

      expect(inspectorPanel).toBeDefined();
      expect(inspectorPanel?.x).toBe(72); // After map
      expect(inspectorPanel?.y).toBe(20); // 1 (menu bar) + 19 (rightTopHeight)
      expect(inspectorPanel?.width).toBe(48);
    });

    it('sets map panel as focused', () => {
      const layout = calculateDefaultLayout(testScreen);
      const mapPanel = layout.panels.get(PanelId.Map);

      expect(mapPanel?.focused).toBe(true);
    });

    it('hides optional panels', () => {
      const layout = calculateDefaultLayout(testScreen);

      const timeline = layout.panels.get(PanelId.Timeline);
      const stats = layout.panels.get(PanelId.Statistics);
      const relationships = layout.panels.get(PanelId.RelationshipGraph);

      expect(timeline?.width).toBe(0);
      expect(timeline?.height).toBe(0);
      expect(stats?.width).toBe(0);
      expect(relationships?.width).toBe(0);
    });
  });

  describe('calculateMapFocusLayout', () => {
    it('creates map panel at 85% height', () => {
      const layout = calculateMapFocusLayout(testScreen);
      const mapPanel = layout.panels.get(PanelId.Map);

      expect(mapPanel?.x).toBe(0);
      expect(mapPanel?.y).toBe(1); // Below menu bar
      expect(mapPanel?.width).toBe(120); // Full width
      expect(mapPanel?.height).toBe(32); // floor(38 * 0.85) = 32
    });

    it('creates event log strip at bottom', () => {
      const layout = calculateMapFocusLayout(testScreen);
      const logPanel = layout.panels.get(PanelId.EventLog);

      expect(logPanel?.x).toBe(0);
      expect(logPanel?.width).toBe(120); // Full width
      expect(logPanel?.y).toBe(33); // 1 (menu bar) + 32 (map height)
    });

    it('has menuBarHeight in layout', () => {
      const layout = calculateMapFocusLayout(testScreen);
      expect(layout.menuBarHeight).toBe(1);
    });

    it('hides inspector panel', () => {
      const layout = calculateMapFocusLayout(testScreen);
      const inspector = layout.panels.get(PanelId.Inspector);

      expect(inspector?.width).toBe(0);
      expect(inspector?.height).toBe(0);
    });
  });

  describe('calculateLogFocusLayout', () => {
    it('creates event log panel at 60% width on left', () => {
      const layout = calculateLogFocusLayout(testScreen);
      const logPanel = layout.panels.get(PanelId.EventLog);

      expect(logPanel?.x).toBe(0);
      expect(logPanel?.y).toBe(1); // Below menu bar
      expect(logPanel?.width).toBe(72); // 60% of 120
      expect(logPanel?.focused).toBe(true);
    });

    it('creates map panel at 40% width on right', () => {
      const layout = calculateLogFocusLayout(testScreen);
      const mapPanel = layout.panels.get(PanelId.Map);

      expect(mapPanel?.x).toBe(72);
      expect(mapPanel?.y).toBe(1); // Below menu bar
      expect(mapPanel?.width).toBe(48); // 40% of 120
    });

    it('has menuBarHeight in layout', () => {
      const layout = calculateLogFocusLayout(testScreen);
      expect(layout.menuBarHeight).toBe(1);
    });
  });

  describe('calculateSplitLayout', () => {
    it('creates map panel at top 50%', () => {
      const layout = calculateSplitLayout(testScreen);
      const mapPanel = layout.panels.get(PanelId.Map);

      expect(mapPanel?.x).toBe(0);
      expect(mapPanel?.y).toBe(1); // Below menu bar
      expect(mapPanel?.width).toBe(120); // Full width
      expect(mapPanel?.height).toBe(19); // floor(38 * 0.5) = 19
    });

    it('creates event log panel at bottom 50%', () => {
      const layout = calculateSplitLayout(testScreen);
      const logPanel = layout.panels.get(PanelId.EventLog);

      expect(logPanel?.x).toBe(0);
      expect(logPanel?.y).toBe(20); // 1 (menu bar) + 19 (top height)
      expect(logPanel?.width).toBe(120); // Full width
    });

    it('has menuBarHeight in layout', () => {
      const layout = calculateSplitLayout(testScreen);
      expect(layout.menuBarHeight).toBe(1);
    });
  });

  describe('calculateMaximizedLayout', () => {
    it('maximizes the specified panel to full screen', () => {
      const layout = calculateMaximizedLayout(testScreen, PanelId.Map);
      const mapPanel = layout.panels.get(PanelId.Map);

      expect(mapPanel?.x).toBe(0);
      expect(mapPanel?.y).toBe(1); // Below menu bar
      expect(mapPanel?.width).toBe(120);
      expect(mapPanel?.height).toBe(38); // Full usable height (40 - 1 - 1)
      expect(mapPanel?.focused).toBe(true);
    });

    it('hides all other panels', () => {
      const layout = calculateMaximizedLayout(testScreen, PanelId.Map);

      for (const [id, panel] of layout.panels) {
        if (id !== PanelId.Map) {
          expect(panel.width, `Panel ${id} should be hidden`).toBe(0);
          expect(panel.height, `Panel ${id} should be hidden`).toBe(0);
        }
      }
    });

    it('can maximize any panel', () => {
      const layout = calculateMaximizedLayout(testScreen, PanelId.EventLog);
      const logPanel = layout.panels.get(PanelId.EventLog);

      expect(logPanel?.width).toBe(120);
      expect(logPanel?.height).toBe(38); // 40 - 1 - 1
    });

    it('has menuBarHeight in layout', () => {
      const layout = calculateMaximizedLayout(testScreen, PanelId.Map);
      expect(layout.menuBarHeight).toBe(1);
    });
  });

  describe('getLayoutForPreset', () => {
    it('returns default layout for "default" preset', () => {
      const layout = getLayoutForPreset('default', testScreen);
      const expected = calculateDefaultLayout(testScreen);

      expect(layout.panels.get(PanelId.Map)?.width).toBe(expected.panels.get(PanelId.Map)?.width);
    });

    it('returns map-focus layout for "map-focus" preset', () => {
      const layout = getLayoutForPreset('map-focus', testScreen);
      const mapPanel = layout.panels.get(PanelId.Map);

      expect(mapPanel?.width).toBe(120); // Full width
    });

    it('returns log-focus layout for "log-focus" preset', () => {
      const layout = getLayoutForPreset('log-focus', testScreen);
      const logPanel = layout.panels.get(PanelId.EventLog);

      expect(logPanel?.x).toBe(0); // On left
      expect(logPanel?.focused).toBe(true);
    });

    it('returns split layout for "split" preset', () => {
      const layout = getLayoutForPreset('split', testScreen);
      const mapPanel = layout.panels.get(PanelId.Map);
      const logPanel = layout.panels.get(PanelId.EventLog);

      expect(mapPanel?.width).toBe(logPanel?.width); // Same width
    });
  });

  describe('LayoutManager class', () => {
    let manager: LayoutManager;

    beforeEach(() => {
      manager = new LayoutManager(testScreen);
    });

    it('initializes with default layout', () => {
      expect(manager.getCurrentPreset()).toBe('default');

      const visible = manager.getVisiblePanels();
      expect(visible).toContain(PanelId.Map);
      expect(visible).toContain(PanelId.EventLog);
      expect(visible).toContain(PanelId.Inspector);
    });

    it('can switch layouts', () => {
      manager.setLayout('map-focus');
      expect(manager.getCurrentPreset()).toBe('map-focus');

      const mapPanel = manager.getPanelLayout(PanelId.Map);
      expect(mapPanel?.width).toBe(120);
    });

    it('can maximize a panel', () => {
      manager.maximizePanel(PanelId.Map);

      expect(manager.isMaximized()).toBe(true);
      expect(manager.getMaximizedPanel()).toBe(PanelId.Map);

      const mapPanel = manager.getPanelLayout(PanelId.Map);
      expect(mapPanel?.width).toBe(120);
      expect(mapPanel?.height).toBe(38); // 40 - 1 - 1
    });

    it('can restore layout after maximizing', () => {
      const originalMapWidth = manager.getPanelLayout(PanelId.Map)?.width;

      manager.maximizePanel(PanelId.Map);
      manager.restoreLayout();

      expect(manager.isMaximized()).toBe(false);
      expect(manager.getPanelLayout(PanelId.Map)?.width).toBe(originalMapWidth);
    });

    it('can toggle panel visibility', () => {
      manager.togglePanel(PanelId.Inspector);

      const inspector = manager.getPanelLayout(PanelId.Inspector);
      expect(inspector?.width).toBe(0);
      expect(inspector?.height).toBe(0);

      // Toggle back
      manager.togglePanel(PanelId.Inspector);
      const inspectorRestored = manager.getPanelLayout(PanelId.Inspector);
      expect(inspectorRestored?.width).toBeGreaterThan(0);
    });

    it('can resize to new screen dimensions', () => {
      const newScreen: ScreenDimensions = { width: 200, height: 60 };
      manager.resize(newScreen);

      const mapPanel = manager.getPanelLayout(PanelId.Map);
      expect(mapPanel?.width).toBe(120); // 60% of 200
      expect(mapPanel?.height).toBe(58); // 60 - 1 status bar - 1 menu bar
    });

    it('preserves maximized state on resize', () => {
      manager.maximizePanel(PanelId.Map);

      const newScreen: ScreenDimensions = { width: 200, height: 60 };
      manager.resize(newScreen);

      expect(manager.isMaximized()).toBe(true);
      const mapPanel = manager.getPanelLayout(PanelId.Map);
      expect(mapPanel?.width).toBe(200);
      expect(mapPanel?.height).toBe(58); // 60 - 1 - 1
    });

    it('detects overlapping panels', () => {
      // Default layout should not have overlaps
      expect(manager.hasOverlappingPanels()).toBe(false);
    });

    it('returns visible panels correctly', () => {
      const visible = manager.getVisiblePanels();

      // Default layout shows Map, EventLog, Inspector
      expect(visible.length).toBe(3);
      expect(visible).toContain(PanelId.Map);
      expect(visible).toContain(PanelId.EventLog);
      expect(visible).toContain(PanelId.Inspector);

      // Should not include hidden panels
      expect(visible).not.toContain(PanelId.Timeline);
      expect(visible).not.toContain(PanelId.Statistics);
    });
  });

  describe('layout calculations', () => {
    it('ensures panels fill available space horizontally in default layout', () => {
      const layout = calculateDefaultLayout(testScreen);
      const mapPanel = layout.panels.get(PanelId.Map)!;
      const logPanel = layout.panels.get(PanelId.EventLog)!;

      expect(mapPanel.width + logPanel.width).toBe(testScreen.width);
    });

    it('ensures panels fill available space vertically in split layout', () => {
      const layout = calculateSplitLayout(testScreen);
      const mapPanel = layout.panels.get(PanelId.Map)!;
      const logPanel = layout.panels.get(PanelId.EventLog)!;
      const usableHeight = testScreen.height - layout.statusBarHeight - layout.menuBarHeight;

      expect(mapPanel.height + logPanel.height).toBe(usableHeight);
    });

    it('handles small screen sizes gracefully', () => {
      const smallScreen: ScreenDimensions = { width: 40, height: 15 };
      const layout = calculateDefaultLayout(smallScreen);

      const mapPanel = layout.panels.get(PanelId.Map)!;
      expect(mapPanel.width).toBeGreaterThan(0);
      expect(mapPanel.height).toBeGreaterThan(0);
    });

    it('handles very wide screens', () => {
      const wideScreen: ScreenDimensions = { width: 400, height: 40 };
      const layout = calculateDefaultLayout(wideScreen);

      const mapPanel = layout.panels.get(PanelId.Map)!;
      const logPanel = layout.panels.get(PanelId.EventLog)!;

      expect(mapPanel.width).toBe(240); // 60% of 400
      expect(logPanel.width).toBe(160); // 40% of 400
    });
  });
});
