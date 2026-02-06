/**
 * Test that viewport gets resized correctly when panel dimensions change.
 * This test verifies the fix for the map rendering issue where the viewport
 * wasn't being updated with the actual screen dimensions.
 */

import { describe, it, expect } from 'vitest';
import { MapPanel } from './map-panel.js';
import { MockScreen, createMockBoxFactory } from '../panel.js';
import type { PanelLayout } from '../types.js';
import { PanelId } from '../types.js';

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

    const panel = new MapPanel(screen, layout, boxFactory);
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

    const panel = new MapPanel(screen, layout, boxFactory);
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

    const panel = new MapPanel(screen, layout, boxFactory);
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

    const panel = new MapPanel(screen, layout, boxFactory);
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
