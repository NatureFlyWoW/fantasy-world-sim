import { describe, it, expect, beforeEach } from 'vitest';
import { Viewport, ZOOM_LEVELS } from './viewport.js';
import type { ZoomLevel } from './viewport.js';

describe('Viewport', () => {
  let viewport: Viewport;

  beforeEach(() => {
    viewport = new Viewport(80, 24, 100, 100, 1);
  });

  describe('initialization', () => {
    it('initializes with correct dimensions', () => {
      expect(viewport.screenWidth).toBe(80);
      expect(viewport.screenHeight).toBe(24);
    });

    it('initializes at specified position', () => {
      expect(viewport.x).toBe(100);
      expect(viewport.y).toBe(100);
    });

    it('initializes with specified zoom level', () => {
      expect(viewport.zoom).toBe(1);
    });

    it('defaults to position 0,0 and zoom 1', () => {
      const defaultViewport = new Viewport(80, 24);
      expect(defaultViewport.x).toBe(0);
      expect(defaultViewport.y).toBe(0);
      expect(defaultViewport.zoom).toBe(1);
    });
  });

  describe('panning', () => {
    it('pans right by increasing x', () => {
      viewport.pan(10, 0);
      expect(viewport.x).toBe(110);
    });

    it('pans left by decreasing x', () => {
      viewport.pan(-20, 0);
      expect(viewport.x).toBe(80);
    });

    it('pans down by increasing y', () => {
      viewport.pan(0, 15);
      expect(viewport.y).toBe(115);
    });

    it('pans up by decreasing y', () => {
      viewport.pan(0, -30);
      expect(viewport.y).toBe(70);
    });

    it('pans diagonally', () => {
      viewport.pan(5, -10);
      expect(viewport.x).toBe(105);
      expect(viewport.y).toBe(90);
    });
  });

  describe('zooming', () => {
    it('zooms in decreases zoom level', () => {
      viewport.setZoom(4);
      expect(viewport.zoomIn()).toBe(true);
      expect(viewport.zoom).toBe(2);
    });

    it('zooms out increases zoom level', () => {
      viewport.setZoom(4);
      expect(viewport.zoomOut()).toBe(true);
      expect(viewport.zoom).toBe(8);
    });

    it('cannot zoom in past minimum (1)', () => {
      viewport.setZoom(1);
      expect(viewport.zoomIn()).toBe(false);
      expect(viewport.zoom).toBe(1);
    });

    it('cannot zoom out past maximum (16)', () => {
      viewport.setZoom(16);
      expect(viewport.zoomOut()).toBe(false);
      expect(viewport.zoom).toBe(16);
    });

    it('can set zoom level directly', () => {
      viewport.setZoom(8);
      expect(viewport.zoom).toBe(8);
    });

    it('cycles through all zoom levels', () => {
      viewport.setZoom(1);
      const levels: ZoomLevel[] = [1];

      while (viewport.zoomOut()) {
        levels.push(viewport.zoom);
      }

      expect(levels).toEqual(ZOOM_LEVELS);
    });
  });

  describe('setCenter', () => {
    it('sets the center position', () => {
      viewport.setCenter(200, 150);
      expect(viewport.x).toBe(200);
      expect(viewport.y).toBe(150);
    });

    it('allows negative positions', () => {
      viewport.setCenter(-50, -25);
      expect(viewport.x).toBe(-50);
      expect(viewport.y).toBe(-25);
    });
  });

  describe('screenToWorld', () => {
    it('converts center of screen to center of viewport', () => {
      const world = viewport.screenToWorld(40, 12);
      expect(world.x).toBe(100);
      expect(world.y).toBe(100);
    });

    it('converts top-left screen to top-left visible world', () => {
      const world = viewport.screenToWorld(0, 0);
      // At zoom 1, visible width is 80, so left edge is 100 - 40 = 60
      // At zoom 1, visible height is 24, so top edge is 100 - 12 = 88
      expect(world.x).toBe(60);
      expect(world.y).toBe(88);
    });

    it('accounts for zoom level', () => {
      viewport.setZoom(2);
      // At zoom 2, each screen char represents 2 world tiles
      const world = viewport.screenToWorld(0, 0);
      // Left edge: 100 - 40*2 = 20
      // Top edge: 100 - 12*2 = 76
      expect(world.x).toBe(20);
      expect(world.y).toBe(76);
    });
  });

  describe('worldToScreen', () => {
    it('converts center of viewport to center of screen', () => {
      const screen = viewport.worldToScreen(100, 100);
      expect(screen).not.toBeNull();
      expect(screen?.sx).toBe(40);
      expect(screen?.sy).toBe(12);
    });

    it('returns null for off-screen coordinates', () => {
      const screen = viewport.worldToScreen(0, 0);
      expect(screen).toBeNull();
    });

    it('converts visible coordinates correctly', () => {
      const screen = viewport.worldToScreen(80, 100);
      expect(screen).not.toBeNull();
      // x=80 is 20 tiles left of center (100), so screen x = 40 - 20 = 20
      expect(screen?.sx).toBe(20);
    });

    it('handles edge of visible area', () => {
      // Top-left visible: (60, 88) at zoom 1 with screen 80x24 centered at 100,100
      const screen = viewport.worldToScreen(60, 88);
      expect(screen).not.toBeNull();
      expect(screen?.sx).toBe(0);
      expect(screen?.sy).toBe(0);
    });
  });

  describe('getVisibleBounds', () => {
    it('returns correct bounds at zoom 1', () => {
      const bounds = viewport.getVisibleBounds();
      // Center at 100, width 80, height 24
      expect(bounds.minX).toBe(60);  // 100 - 40
      expect(bounds.minY).toBe(88);  // 100 - 12
      expect(bounds.maxX).toBe(140); // 100 + 40
      expect(bounds.maxY).toBe(112); // 100 + 12
    });

    it('returns correct bounds at higher zoom', () => {
      viewport.setZoom(4);
      const bounds = viewport.getVisibleBounds();
      // At zoom 4, each screen char covers 4 tiles
      expect(bounds.minX).toBe(-60);  // 100 - 40*4
      expect(bounds.minY).toBe(52);   // 100 - 12*4
      expect(bounds.maxX).toBe(260);  // 100 + 40*4
      expect(bounds.maxY).toBe(148);  // 100 + 12*4
    });

    it('updates when viewport moves', () => {
      viewport.pan(50, 25);
      const bounds = viewport.getVisibleBounds();
      expect(bounds.minX).toBe(110); // 150 - 40
      expect(bounds.minY).toBe(113); // 125 - 12
    });
  });

  describe('isVisible', () => {
    it('returns true for visible coordinates', () => {
      expect(viewport.isVisible(100, 100)).toBe(true);
      expect(viewport.isVisible(80, 95)).toBe(true);
    });

    it('returns false for off-screen coordinates', () => {
      expect(viewport.isVisible(0, 0)).toBe(false);
      expect(viewport.isVisible(200, 200)).toBe(false);
    });

    it('returns true for edge coordinates', () => {
      expect(viewport.isVisible(60, 88)).toBe(true); // Top-left corner
    });

    it('returns false just outside visible area', () => {
      expect(viewport.isVisible(59, 88)).toBe(false);
      expect(viewport.isVisible(60, 87)).toBe(false);
    });
  });

  describe('clampToWorld', () => {
    it('clamps viewport to stay within world bounds', () => {
      viewport.setCenter(10, 10); // Would show negative coordinates
      viewport.clampToWorld(200, 200);

      const bounds = viewport.getVisibleBounds();
      expect(bounds.minX).toBeGreaterThanOrEqual(0);
      expect(bounds.minY).toBeGreaterThanOrEqual(0);
    });

    it('clamps viewport at world edge', () => {
      viewport.setCenter(190, 195); // Would show past world edge
      viewport.clampToWorld(200, 200);

      const bounds = viewport.getVisibleBounds();
      expect(bounds.maxX).toBeLessThanOrEqual(200);
      expect(bounds.maxY).toBeLessThanOrEqual(200);
    });

    it('centers on small worlds', () => {
      viewport.setCenter(0, 0);
      viewport.clampToWorld(40, 10); // World smaller than viewport

      expect(viewport.x).toBe(20); // Centered horizontally
      expect(viewport.y).toBe(5);  // Centered vertically
    });

    it('works with zoomed viewport on large world', () => {
      viewport.setZoom(4);
      viewport.setCenter(500, 500);
      viewport.clampToWorld(1000, 1000);

      const bounds = viewport.getVisibleBounds();
      // At zoom 4, visible area is 320x96. Viewport should be clamped.
      expect(bounds.maxX).toBeLessThanOrEqual(1000);
      expect(bounds.maxY).toBeLessThanOrEqual(1000);
    });

    it('centers viewport when visible width exceeds world width', () => {
      viewport.setZoom(4);
      viewport.setCenter(500, 500);
      viewport.clampToWorld(200, 200);

      // At zoom 4, visible width (320) exceeds world width (200)
      // Viewport x should be centered on the world
      expect(viewport.x).toBe(100); // Centered horizontally

      // Visible height (96) does NOT exceed world height (200)
      // So y is clamped to valid range [48, 152]
      expect(viewport.y).toBe(152); // Clamped to max valid y
    });
  });

  describe('getVisibleTilesWidth/Height', () => {
    it('returns screen dimensions at zoom 1', () => {
      expect(viewport.getVisibleTilesWidth()).toBe(80);
      expect(viewport.getVisibleTilesHeight()).toBe(24);
    });

    it('returns scaled dimensions at higher zoom', () => {
      viewport.setZoom(4);
      expect(viewport.getVisibleTilesWidth()).toBe(320);  // 80 * 4
      expect(viewport.getVisibleTilesHeight()).toBe(96);  // 24 * 4
    });
  });

  describe('centerOn', () => {
    it('centers viewport on position', () => {
      viewport.centerOn(50, 75);
      expect(viewport.x).toBe(50);
      expect(viewport.y).toBe(75);
    });

    it('is same as setCenter', () => {
      viewport.centerOn(123, 456);
      expect(viewport.getCenter()).toEqual({ x: 123, y: 456 });
    });
  });

  describe('setScreenSize', () => {
    it('updates screen dimensions', () => {
      viewport.setScreenSize(100, 50);
      expect(viewport.screenWidth).toBe(100);
      expect(viewport.screenHeight).toBe(50);
    });

    it('affects visible bounds', () => {
      viewport.setScreenSize(40, 12);
      const bounds = viewport.getVisibleBounds();
      // Now half the visible area
      expect(bounds.maxX - bounds.minX).toBe(40);
      expect(bounds.maxY - bounds.minY).toBe(12);
    });
  });

  describe('ZOOM_LEVELS constant', () => {
    it('contains all valid zoom levels', () => {
      expect(ZOOM_LEVELS).toEqual([1, 2, 4, 8, 16]);
    });

    it('is in ascending order', () => {
      for (let i = 1; i < ZOOM_LEVELS.length; i++) {
        const prev = ZOOM_LEVELS[i - 1];
        const curr = ZOOM_LEVELS[i];
        if (prev !== undefined && curr !== undefined) {
          expect(curr).toBeGreaterThan(prev);
        }
      }
    });
  });
});
