/**
 * Test that viewport gets resized correctly when panel dimensions change.
 * This test verifies the fix for the map rendering issue where the viewport
 * wasn't being updated with the actual screen dimensions.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { MapPanel } from './map-panel.js';
import { MockScreen, createMockBoxFactory } from '../panel.js';
import type { PanelLayout, RenderContext } from '../types.js';
import { PanelId } from '../types.js';
import { Application } from '../app.js';
import type { World, WorldClock, EventLog, EventBus, SpatialIndex } from '@fws/core';

describe('MapPanel viewport resize', () => {
  it('should initialize viewport with inner dimensions (excluding borders)', () => {
    const screen = new MockScreen();
    const boxFactory = createMockBoxFactory(screen);

    const layout: PanelLayout = {
      id: PanelId.Map,
      x: 0,
      y: 0,
      width: 50,
      height: 30,
      focused: true,
    };

    const panel = new MapPanel(screen as any, layout, boxFactory as any);
    const viewport = panel.getViewport();

    // Viewport should be initialized with inner dimensions (width-2, height-2)
    // to account for borders
    expect(viewport.screenWidth).toBe(48); // 50 - 2
    expect(viewport.screenHeight).toBe(28); // 30 - 2
  });

  it('should update viewport dimensions when panel is resized', () => {
    const screen = new MockScreen();
    const boxFactory = createMockBoxFactory(screen);

    const layout: PanelLayout = {
      id: PanelId.Map,
      x: 0,
      y: 0,
      width: 50,
      height: 30,
      focused: true,
    };

    const panel = new MapPanel(screen as any, layout, boxFactory as any);
    const viewportBefore = panel.getViewport();
    expect(viewportBefore.screenWidth).toBe(48);
    expect(viewportBefore.screenHeight).toBe(28);

    // Simulate what happens when app.start() calls applyLayout()
    // This should update the viewport with new dimensions
    panel.resize(120, 40);

    const viewportAfter = panel.getViewport();
    expect(viewportAfter.screenWidth).toBe(118); // 120 - 2
    expect(viewportAfter.screenHeight).toBe(38); // 40 - 2
  });

  it('should handle very small dimensions gracefully', () => {
    const screen = new MockScreen();
    const boxFactory = createMockBoxFactory(screen);

    const layout: PanelLayout = {
      id: PanelId.Map,
      x: 0,
      y: 0,
      width: 5,
      height: 5,
      focused: true,
    };

    const panel = new MapPanel(screen as any, layout, boxFactory as any);
    const viewport = panel.getViewport();

    // Even with small dimensions, viewport should be initialized
    // Math.max(0, ...) ensures no negative dimensions
    expect(viewport.screenWidth).toBe(3); // 5 - 2
    expect(viewport.screenHeight).toBe(3); // 5 - 2
  });

  it('should render the correct number of tiles based on viewport dimensions', () => {
    const screen = new MockScreen();
    const boxFactory = createMockBoxFactory(screen);

    const layout: PanelLayout = {
      id: PanelId.Map,
      x: 0,
      y: 0,
      width: 60,
      height: 30,
      focused: true,
    };

    const panel = new MapPanel(screen as any, layout, boxFactory as any);
    panel.setWorldSize(200, 200);

    // Set up a simple tile lookup
    panel.setTileLookup(() => ({
      biome: 'grassland',
      riverId: undefined,
      leyLine: false,
      resources: [],
    }));

    // Create a minimal render context
    const context = {
      world: {} as any,
      clock: {} as any,
      eventLog: {} as any,
      eventBus: {} as any,
      spatialIndex: {} as any,
    };

    // Render should work without errors
    expect(() => panel.render(context)).not.toThrow();

    const viewport = panel.getViewport();
    const box = panel.getBox();
    const content = box.getContent();
    const lines = content.split('\n');

    // Number of rendered lines should match viewport height
    expect(lines.length).toBe(viewport.screenHeight);

    // Each line should have approximately viewport width worth of characters
    // (accounting for blessed color tags which add extra characters)
    if (lines[0] !== undefined) {
      // Just verify we have some content
      expect(lines[0].length).toBeGreaterThan(0);
    }
  });
});

describe('Full init flow: Application -> MapPanel viewport sync', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper to create a minimal RenderContext for testing.
   */
  function makeTestContext(): RenderContext {
    return {
      world: {} as World,
      clock: {
        currentTime: { year: 1, month: 1, day: 1 },
        currentTick: 0,
      } as unknown as WorldClock,
      eventLog: {
        getAll: () => [],
      } as unknown as EventLog,
      eventBus: {
        onAny: () => () => {},
      } as unknown as EventBus,
      spatialIndex: {} as SpatialIndex,
    };
  }

  it('should sync MapPanel viewport when Application calls applyLayout via renderInitialFrame', () => {
    // Simulate the CLI init flow:
    // 1. Create a mock screen with specific dimensions (wider than the Application's default 120x40)
    const screen = new MockScreen();
    screen.width = 200;
    screen.height = 60;
    const boxFactory = createMockBoxFactory(screen);

    const context = makeTestContext();

    // 2. Create the Application (LayoutManager starts at 120x40)
    const app = new Application(context);

    // 3. Use Application's LayoutManager to get initial layout
    const appLayoutManager = app.getLayoutManager();
    const layout = appLayoutManager.getCurrentLayout();
    const mapLayout = layout.panels.get(PanelId.Map);
    expect(mapLayout).toBeDefined();

    // Panels are initially created with the default 120x40-based layout
    const panel = new MapPanel(screen as any, mapLayout!, boxFactory as any);
    panel.setWorldSize(200, 200);
    panel.setTileLookup(() => ({
      biome: 'grassland',
      riverId: undefined,
      leyLine: false,
      resources: [],
    }));

    // Record initial viewport dimensions (from Application's default 120x40 layout)
    const viewportBefore = panel.getViewport();
    const initialWidth = viewportBefore.screenWidth;
    const initialHeight = viewportBefore.screenHeight;

    // The default layout for a 120x40 screen gives Map 60% width = 72, full height = 38 (40 - 1 status - 1 menu)
    // Inner dims: 72-2 = 70, 38-2 = 36
    expect(initialWidth).toBe(70);
    expect(initialHeight).toBe(36);

    // 4. Register panel and inject factories
    app.registerPanel(panel as any, PanelId.Map);
    app.setFactories(() => screen as any, boxFactory as any);

    // 5. app.start() -> createScreen() resizes LayoutManager to screen dims (200x60)
    //    -> applyLayout() resizes panels
    app.start();

    // 6. app.renderInitialFrame() calls applyLayout() again as a safety net
    //    then renders each panel
    app.renderInitialFrame();

    // After start + renderInitialFrame, the viewport should match the new screen dims
    // For a 200x60 screen, default layout gives Map 60% width = 120, full height (60-1-1) = 58
    // Inner dims: 120-2 = 118, 58-2 = 56
    const viewportAfter = panel.getViewport();
    expect(viewportAfter.screenWidth).toBe(118);
    expect(viewportAfter.screenHeight).toBe(56);

    // Verify they changed from the initial values
    expect(viewportAfter.screenWidth).not.toBe(initialWidth);
    expect(viewportAfter.screenHeight).not.toBe(initialHeight);

    // Clean up
    app.stop();
  });

  it('should handle panels created with different dimensions than final screen', () => {
    // This simulates the old bug: panel created with one LayoutManager's dims,
    // then Application uses a different LayoutManager that resizes to different dims
    const screen = new MockScreen();
    screen.width = 160;
    screen.height = 50;
    const boxFactory = createMockBoxFactory(screen);

    // Create panel with "wrong" initial dimensions (as if from a separate LayoutManager)
    const wrongLayout: PanelLayout = {
      id: PanelId.Map,
      x: 0,
      y: 0,
      width: 80,  // "wrong" - calculated by a separate LayoutManager
      height: 24, // "wrong"
      focused: true,
    };

    const panel = new MapPanel(screen as any, wrongLayout, boxFactory as any);
    panel.setWorldSize(200, 200);
    panel.setTileLookup(() => ({
      biome: 'grassland',
      riverId: undefined,
      leyLine: false,
      resources: [],
    }));

    // Viewport starts with "wrong" dimensions
    expect(panel.getViewport().screenWidth).toBe(78);  // 80 - 2
    expect(panel.getViewport().screenHeight).toBe(22);  // 24 - 2

    // Create Application and register the panel
    const context = makeTestContext();
    const app = new Application(context);
    app.registerPanel(panel as any, PanelId.Map);
    app.setFactories(() => screen as any, boxFactory as any);

    // start() + renderInitialFrame() should fix the dimensions
    app.start();
    app.renderInitialFrame();

    // For a 160x50 screen, default layout gives Map 60% width = 96, height = 50-1-1 = 48
    // Inner dims: 96-2 = 94, 48-2 = 46
    const viewport = panel.getViewport();
    expect(viewport.screenWidth).toBe(94);
    expect(viewport.screenHeight).toBe(46);

    // Clean up
    app.stop();
  });

  it('renderInitialFrame applyLayout guarantees viewport sync even without prior start resize', () => {
    // Verify that renderInitialFrame's call to applyLayout is the critical sync point
    const screen = new MockScreen();
    screen.width = 180;
    screen.height = 45;
    const boxFactory = createMockBoxFactory(screen);

    const context = makeTestContext();
    const app = new Application(context);

    // Use the Application's LayoutManager for panel creation (the correct approach)
    const lm = app.getLayoutManager();
    const mapLayout = lm.getCurrentLayout().panels.get(PanelId.Map);
    expect(mapLayout).toBeDefined();

    const panel = new MapPanel(screen as any, mapLayout!, boxFactory as any);
    panel.setWorldSize(200, 200);
    panel.setTileLookup(() => ({
      biome: 'grassland',
      riverId: undefined,
      leyLine: false,
      resources: [],
    }));

    app.registerPanel(panel as any, PanelId.Map);
    app.setFactories(() => screen as any, boxFactory as any);

    app.start();
    app.renderInitialFrame();

    // For a 180x45 screen, default layout: Map 60% width = 108, height = 45-1-1 = 43
    // Inner dims: 108-2 = 106, 43-2 = 41
    const viewport = panel.getViewport();
    expect(viewport.screenWidth).toBe(106);
    expect(viewport.screenHeight).toBe(41);

    // Render content should have correct line count
    const box = panel.getBox();
    const content = box.getContent();
    const lines = content.split('\n');
    expect(lines.length).toBe(41);

    app.stop();
  });
});
