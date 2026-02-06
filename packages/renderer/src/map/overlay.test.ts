import { describe, it, expect, beforeEach } from 'vitest';
import {
  OverlayType,
  PoliticalOverlay,
  ResourceOverlay,
  MilitaryOverlay,
  TradeOverlay,
  MagicOverlay,
  ClimateOverlay,
  OverlayManager,
} from './overlay.js';
import type { RenderContext } from '../types.js';
import type { World, WorldClock, EventLog, EventBus, SpatialIndex } from '@fws/core';

// Mock render context
const mockContext: RenderContext = {
  world: {} as World,
  clock: {} as WorldClock,
  eventLog: {} as EventLog,
  eventBus: {} as EventBus,
  spatialIndex: {} as SpatialIndex,
};

describe('Overlay System', () => {
  describe('PoliticalOverlay', () => {
    let overlay: PoliticalOverlay;

    beforeEach(() => {
      overlay = new PoliticalOverlay();
    });

    it('starts inactive', () => {
      expect(overlay.isActive()).toBe(false);
    });

    it('can be toggled on and off', () => {
      overlay.toggle();
      expect(overlay.isActive()).toBe(true);

      overlay.toggle();
      expect(overlay.isActive()).toBe(false);
    });

    it('can be set active directly', () => {
      overlay.setActive(true);
      expect(overlay.isActive()).toBe(true);

      overlay.setActive(false);
      expect(overlay.isActive()).toBe(false);
    });

    it('has correct type', () => {
      expect(overlay.type).toBe(OverlayType.Political);
    });

    it('returns null without territory lookup', () => {
      overlay.setActive(true);
      const result = overlay.renderAt(10, 10, mockContext);
      expect(result).toBeNull();
    });

    it('returns faction color for territory', () => {
      overlay.setActive(true);
      overlay.setTerritoryLookup((x, y) => {
        if (x >= 0 && x < 50 && y >= 0 && y < 50) {
          return {
            factionId: 1,
            factionColor: '#ff0000',
            isCapital: false,
            isBorder: false,
          };
        }
        return null;
      });

      const result = overlay.renderAt(25, 25, mockContext);
      expect(result).not.toBeNull();
      expect(result?.bg).toBeDefined();
    });

    it('highlights border tiles', () => {
      overlay.setActive(true);
      overlay.setTerritoryLookup(() => ({
        factionId: 1,
        factionColor: '#ff0000',
        isCapital: false,
        isBorder: true,
      }));

      const borderResult = overlay.renderAt(10, 10, mockContext);

      overlay.setTerritoryLookup(() => ({
        factionId: 1,
        factionColor: '#ff0000',
        isCapital: false,
        isBorder: false,
      }));

      const interiorResult = overlay.renderAt(10, 10, mockContext);

      // Border should be slightly different from interior
      expect(borderResult?.bg).not.toBe(interiorResult?.bg);
    });

    it('returns null for uncontrolled territory', () => {
      overlay.setActive(true);
      overlay.setTerritoryLookup(() => null);

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result).toBeNull();
    });
  });

  describe('ResourceOverlay', () => {
    let overlay: ResourceOverlay;

    beforeEach(() => {
      overlay = new ResourceOverlay();
    });

    it('has correct type', () => {
      expect(overlay.type).toBe(OverlayType.Resources);
    });

    it('returns null without resource lookup', () => {
      overlay.setActive(true);
      const result = overlay.renderAt(10, 10, mockContext);
      expect(result).toBeNull();
    });

    it('shows resource icon when resources present', () => {
      overlay.setActive(true);
      overlay.setResourceLookup(() => ({
        resources: ['Iron', 'Gold'],
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result).not.toBeNull();
      expect(result?.char).toBeDefined();
      expect(result?.fg).toBeDefined();
    });

    it('returns null for tiles without resources', () => {
      overlay.setActive(true);
      overlay.setResourceLookup(() => ({
        resources: [],
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result).toBeNull();
    });

    it('shows first resource when multiple present', () => {
      overlay.setActive(true);
      overlay.setResourceLookup(() => ({
        resources: ['Iron', 'Gold', 'Gems'],
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      // Should show iron icon (first in list)
      expect(result?.char).toBe('\u2692'); // ⚒
    });
  });

  describe('MilitaryOverlay', () => {
    let overlay: MilitaryOverlay;

    beforeEach(() => {
      overlay = new MilitaryOverlay();
    });

    it('has correct type', () => {
      expect(overlay.type).toBe(OverlayType.Military);
    });

    it('shows army marker when army present', () => {
      overlay.setActive(true);
      overlay.setMilitaryLookup(() => ({
        hasArmy: true,
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result).not.toBeNull();
      expect(result?.char).toBe('\u2694'); // ⚔
      expect(result?.fg).toBe('#ff4444');
    });

    it('shows direction arrow for moving army', () => {
      overlay.setActive(true);
      overlay.setMilitaryLookup(() => ({
        hasArmy: true,
        movementDirection: 'N',
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result?.char).toBe('\u2191'); // ↑
    });

    it('shows all direction arrows correctly', () => {
      overlay.setActive(true);

      const directions = [
        { dir: 'N', char: '\u2191' },
        { dir: 'S', char: '\u2193' },
        { dir: 'E', char: '\u2192' },
        { dir: 'W', char: '\u2190' },
        { dir: 'NE', char: '\u2197' },
        { dir: 'NW', char: '\u2196' },
        { dir: 'SE', char: '\u2198' },
        { dir: 'SW', char: '\u2199' },
      ] as const;

      for (const { dir, char } of directions) {
        overlay.setMilitaryLookup(() => ({
          hasArmy: true,
          movementDirection: dir,
        }));

        const result = overlay.renderAt(10, 10, mockContext);
        expect(result?.char, `Direction ${dir}`).toBe(char);
      }
    });

    it('shows siege indicator for besieged settlements', () => {
      overlay.setActive(true);
      overlay.setMilitaryLookup(() => ({
        hasArmy: false,
        isBesieged: true,
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result?.char).toBe('\u2699'); // ⚙
    });

    it('returns null for no military activity', () => {
      overlay.setActive(true);
      overlay.setMilitaryLookup(() => ({
        hasArmy: false,
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result).toBeNull();
    });
  });

  describe('TradeOverlay', () => {
    let overlay: TradeOverlay;

    beforeEach(() => {
      overlay = new TradeOverlay();
    });

    it('has correct type', () => {
      expect(overlay.type).toBe(OverlayType.Trade);
    });

    it('shows trade route characters', () => {
      overlay.setActive(true);
      overlay.setTradeLookup(() => ({
        hasTradeRoute: true,
        connections: ['N', 'S'],
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result).not.toBeNull();
      expect(result?.char).toBe('\u2502'); // │ (vertical)
    });

    it('shows horizontal route correctly', () => {
      overlay.setActive(true);
      overlay.setTradeLookup(() => ({
        hasTradeRoute: true,
        connections: ['E', 'W'],
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result?.char).toBe('\u2500'); // ─
    });

    it('shows corner routes correctly', () => {
      overlay.setActive(true);
      overlay.setTradeLookup(() => ({
        hasTradeRoute: true,
        connections: ['N', 'E'],
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result?.char).toBe('\u2514'); // └
    });

    it('shows trade hub marker', () => {
      overlay.setActive(true);
      overlay.setTradeLookup(() => ({
        hasTradeRoute: true,
        connections: ['N', 'S', 'E', 'W'],
        isTradeHub: true,
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result?.char).toBe('\u2302'); // ⌂
    });

    it('returns null for no trade route', () => {
      overlay.setActive(true);
      overlay.setTradeLookup(() => ({
        hasTradeRoute: false,
        connections: [],
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result).toBeNull();
    });
  });

  describe('MagicOverlay', () => {
    let overlay: MagicOverlay;

    beforeEach(() => {
      overlay = new MagicOverlay();
    });

    it('has correct type', () => {
      expect(overlay.type).toBe(OverlayType.Magic);
    });

    it('shows ley line indicator', () => {
      overlay.setActive(true);
      overlay.setMagicLookup(() => ({
        hasLeyLine: true,
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result).not.toBeNull();
      expect(result?.fg).toBe('#aa66ff');
    });

    it('shows artifact marker with priority', () => {
      overlay.setActive(true);
      overlay.setMagicLookup(() => ({
        hasLeyLine: true,
        hasArtifact: true,
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result?.char).toBe('\u2726'); // ✦
      expect(result?.fg).toBe('#ff00ff');
    });

    it('shows magical anomaly with background tint', () => {
      overlay.setActive(true);
      overlay.setMagicLookup(() => ({
        hasLeyLine: false,
        hasMagicalAnomaly: true,
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result).not.toBeNull();
      expect(result?.bg).toBeDefined();
    });

    it('returns null for no magic', () => {
      overlay.setActive(true);
      overlay.setMagicLookup(() => ({
        hasLeyLine: false,
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result).toBeNull();
    });
  });

  describe('ClimateOverlay', () => {
    let overlay: ClimateOverlay;

    beforeEach(() => {
      overlay = new ClimateOverlay();
    });

    it('has correct type', () => {
      expect(overlay.type).toBe(OverlayType.Climate);
    });

    it('defaults to temperature mode', () => {
      expect(overlay.getMode()).toBe('temperature');
    });

    it('can switch to rainfall mode', () => {
      overlay.setMode('rainfall');
      expect(overlay.getMode()).toBe('rainfall');
    });

    it('can toggle between modes', () => {
      expect(overlay.getMode()).toBe('temperature');
      overlay.toggleMode();
      expect(overlay.getMode()).toBe('rainfall');
      overlay.toggleMode();
      expect(overlay.getMode()).toBe('temperature');
    });

    it('shows temperature gradient', () => {
      overlay.setActive(true);
      overlay.setClimateLookup(() => ({
        temperature: 20,
        rainfall: 100,
      }));

      const result = overlay.renderAt(10, 10, mockContext);
      expect(result).not.toBeNull();
      expect(result?.bg).toBeDefined();
    });

    it('shows cold temperatures as blue', () => {
      overlay.setActive(true);
      overlay.setClimateLookup(() => ({
        temperature: -30,
        rainfall: 100,
      }));

      const coldResult = overlay.renderAt(10, 10, mockContext);

      overlay.setClimateLookup(() => ({
        temperature: 30,
        rainfall: 100,
      }));

      const hotResult = overlay.renderAt(10, 10, mockContext);

      // Cold and hot should have different colors
      expect(coldResult?.bg).not.toBe(hotResult?.bg);
    });

    it('shows rainfall gradient in rainfall mode', () => {
      overlay.setActive(true);
      overlay.setMode('rainfall');
      overlay.setClimateLookup(() => ({
        temperature: 20,
        rainfall: 300,
      }));

      const wetResult = overlay.renderAt(10, 10, mockContext);

      overlay.setClimateLookup(() => ({
        temperature: 20,
        rainfall: 50,
      }));

      const dryResult = overlay.renderAt(10, 10, mockContext);

      // Wet and dry should have different colors
      expect(wetResult?.bg).not.toBe(dryResult?.bg);
    });
  });

  describe('OverlayManager', () => {
    let manager: OverlayManager;

    beforeEach(() => {
      manager = new OverlayManager();
    });

    it('starts with no active overlay', () => {
      expect(manager.getActiveOverlayType()).toBe(OverlayType.None);
    });

    it('can get overlays by type', () => {
      const political = manager.getOverlay<PoliticalOverlay>(OverlayType.Political);
      expect(political).toBeDefined();
      expect(political?.type).toBe(OverlayType.Political);
    });

    it('can set active overlay', () => {
      manager.setActiveOverlay(OverlayType.Political);
      expect(manager.getActiveOverlayType()).toBe(OverlayType.Political);

      const political = manager.getOverlay<PoliticalOverlay>(OverlayType.Political);
      expect(political?.isActive()).toBe(true);
    });

    it('deactivates previous overlay when setting new one', () => {
      manager.setActiveOverlay(OverlayType.Political);
      manager.setActiveOverlay(OverlayType.Military);

      const political = manager.getOverlay<PoliticalOverlay>(OverlayType.Political);
      const military = manager.getOverlay<MilitaryOverlay>(OverlayType.Military);

      expect(political?.isActive()).toBe(false);
      expect(military?.isActive()).toBe(true);
    });

    it('cycles through all overlay types', () => {
      const types: OverlayType[] = [];

      // Cycle through all overlays
      for (let i = 0; i < 7; i++) {
        types.push(manager.cycleOverlay());
      }

      // Should have cycled back to start
      expect(types).toContain(OverlayType.Political);
      expect(types).toContain(OverlayType.Resources);
      expect(types).toContain(OverlayType.Military);
      expect(types).toContain(OverlayType.Trade);
      expect(types).toContain(OverlayType.Magic);
      expect(types).toContain(OverlayType.Climate);
      expect(types).toContain(OverlayType.None);
    });

    it('renderAt returns null when no overlay active', () => {
      const result = manager.renderAt(10, 10, mockContext);
      expect(result).toBeNull();
    });

    it('renderAt delegates to active overlay', () => {
      manager.setActiveOverlay(OverlayType.Military);

      const military = manager.getOverlay<MilitaryOverlay>(OverlayType.Military);
      military?.setMilitaryLookup(() => ({
        hasArmy: true,
      }));

      const result = manager.renderAt(10, 10, mockContext);
      expect(result).not.toBeNull();
      expect(result?.char).toBe('\u2694');
    });
  });
});
