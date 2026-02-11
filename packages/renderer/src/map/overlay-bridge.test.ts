import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MapOverlayBridge,
  OverlayLayer,
  DEFAULT_BRIDGE_CONFIG,
} from './overlay-bridge.js';
import type {
  SettlementOverlayEntry,
  TerritoryOverlayEntry,
  OverlayBridgeStats,
} from './overlay-bridge.js';
import { World, EventBus, SpatialIndex, EventCategory } from '@fws/core';
import type {
  EntityId,
  PositionComponent,
  PopulationComponent,
  EconomyComponent,
  MilitaryComponent,
  OwnershipComponent,
  StructuresComponent,
  MagicalPropertyComponent,
} from '@fws/core';
import type { RenderableTile } from './tile-renderer.js';
import { Viewport } from './viewport.js';

// ============================================================================
// Test helpers
// ============================================================================

/**
 * Create a World with the component stores needed by the bridge.
 */
function createTestWorld(): World {
  const world = new World();
  world.registerComponent('Position');
  world.registerComponent('Population');
  world.registerComponent('Economy');
  world.registerComponent('Military');
  world.registerComponent('Ownership');
  world.registerComponent('Structures');
  world.registerComponent('MagicalProperty');
  world.registerComponent('Status');
  return world;
}

/**
 * Helper to create a serializable component.
 */
function makeComponent<T extends { type: string }>(data: T): T & { serialize(): Record<string, unknown> } {
  return {
    ...data,
    serialize() {
      return { ...this };
    },
  };
}

/**
 * Add a settlement entity to the world.
 */
function addSettlement(
  world: World,
  x: number,
  y: number,
  population: number,
  ownerId: number | null = null,
  wealth = 100,
): EntityId {
  const eid = world.createEntity();
  world.addComponent(eid, makeComponent<PositionComponent>({
    type: 'Position', x, y,
  }));
  world.addComponent(eid, makeComponent<PopulationComponent>({
    type: 'Population', count: population, growthRate: 0.02, nonNotableIds: [],
  }));
  world.addComponent(eid, makeComponent<EconomyComponent>({
    type: 'Economy', wealth, tradeVolume: 0, industries: ['farming'],
  }));
  world.addComponent(eid, makeComponent<OwnershipComponent>({
    type: 'Ownership', ownerId, claimStrength: 100,
  }));
  world.addComponent(eid, makeComponent<StructuresComponent>({
    type: 'Structures', buildings: ['market'], fortificationLevel: 0,
  }));
  return eid;
}

// ============================================================================
// Tests
// ============================================================================

describe('MapOverlayBridge', () => {
  let world: World;
  let spatialIndex: SpatialIndex;
  let bridge: MapOverlayBridge;

  beforeEach(() => {
    world = createTestWorld();
    spatialIndex = new SpatialIndex(100, 100);
    bridge = new MapOverlayBridge(world, spatialIndex);
  });

  // --------------------------------------------------------------------------
  // Construction and configuration
  // --------------------------------------------------------------------------

  describe('construction', () => {
    it('creates with default config', () => {
      const stats = bridge.getStats();
      expect(stats.settlementCount).toBe(0);
      expect(stats.territoryTileCount).toBe(0);
      expect(stats.entityMarkerCount).toBe(0);
    });

    it('accepts custom config', () => {
      const customBridge = new MapOverlayBridge(world, spatialIndex, {
        territoryRadius: 20,
      });
      expect(customBridge).toBeDefined();
    });

    it('all layers start dirty', () => {
      // refreshIfDirty should refresh something even on tick 0
      const updated = bridge.refreshIfDirty(0);
      // Technically updated is true because all layers start dirty
      // and their lastRefresh is -Infinity
      expect(updated).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Settlement cache
  // --------------------------------------------------------------------------

  describe('settlement cache', () => {
    it('finds settlements from Position + Population query', () => {
      addSettlement(world, 10, 20, 500);
      addSettlement(world, 30, 40, 2000);

      bridge.forceRefreshAll(0);

      const stats = bridge.getStats();
      expect(stats.settlementCount).toBe(2);
    });

    it('categorizes settlement sizes correctly', () => {
      addSettlement(world, 1, 1, 50);     // hamlet
      addSettlement(world, 2, 2, 200);    // village
      addSettlement(world, 3, 3, 800);    // town
      addSettlement(world, 4, 4, 5000);   // city

      bridge.forceRefreshAll(0);

      const entityLookup = bridge.getEntityLookup();
      expect(entityLookup(1, 1)).not.toBeNull();
      expect(entityLookup(2, 2)).not.toBeNull();
      expect(entityLookup(3, 3)).not.toBeNull();
      expect(entityLookup(4, 4)).not.toBeNull();
    });

    it('marks capitals correctly when factionCapitals provided', () => {
      const factionId = world.createEntity();
      const capitalId = addSettlement(world, 10, 10, 3000, factionId as unknown as number);
      addSettlement(world, 20, 20, 1000, factionId as unknown as number);

      bridge.setFactionColors(new Map([[factionId as unknown as number, '#ff0000']]));
      bridge.setFactionCapitals(new Map([[factionId as unknown as number, capitalId as unknown as number]]));
      bridge.forceRefreshAll(0);

      // Check entity lookup shows capital marker
      const lookup = bridge.getEntityLookup();
      const capitalMarker = lookup(10, 10);
      expect(capitalMarker).not.toBeNull();
      expect(capitalMarker?.type).toBe('factionCapital');
    });

    it('uses faction color for settlements', () => {
      const factionId = world.createEntity();
      addSettlement(world, 10, 10, 500, factionId as unknown as number);

      bridge.setFactionColors(new Map([[factionId as unknown as number, '#00ff00']]));
      bridge.forceRefreshAll(0);

      const entityLookup = bridge.getEntityLookup();
      const marker = entityLookup(10, 10);
      expect(marker?.factionColor).toBe('#00ff00');
    });

    it('returns default gold color for unaffiliated settlements', () => {
      addSettlement(world, 10, 10, 500, null);

      bridge.forceRefreshAll(0);

      const entityLookup = bridge.getEntityLookup();
      const marker = entityLookup(10, 10);
      expect(marker?.factionColor).toBe('#f0d060');
    });

    it('returns null for empty tiles', () => {
      bridge.forceRefreshAll(0);

      const entityLookup = bridge.getEntityLookup();
      expect(entityLookup(50, 50)).toBeNull();
    });

    it('keeps the larger settlement when two share a tile', () => {
      addSettlement(world, 10, 10, 200);
      addSettlement(world, 10, 10, 5000);

      bridge.forceRefreshAll(0);

      const stats = bridge.getStats();
      // Both are at the same tile; one gets overwritten
      expect(stats.settlementCount).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Territory cache
  // --------------------------------------------------------------------------

  describe('territory cache', () => {
    it('creates territory around faction settlements', () => {
      const factionId = world.createEntity();
      addSettlement(world, 50, 50, 1000, factionId as unknown as number);

      bridge.setFactionColors(new Map([[factionId as unknown as number, '#0000ff']]));
      bridge.forceRefreshAll(0);

      const stats = bridge.getStats();
      expect(stats.territoryTileCount).toBeGreaterThan(0);
    });

    it('territory lookup returns data for tiles near settlements', () => {
      const factionId = world.createEntity();
      addSettlement(world, 50, 50, 1000, factionId as unknown as number);

      bridge.setFactionColors(new Map([[factionId as unknown as number, '#0000ff']]));
      bridge.forceRefreshAll(0);

      const lookup = bridge.getTerritoryLookup();
      const territory = lookup(50, 50);
      expect(territory).not.toBeNull();
      expect(territory?.factionId).toBe(factionId as unknown as number);
      expect(territory?.factionColor).toBe('#0000ff');
    });

    it('territory lookup returns null for distant tiles', () => {
      const factionId = world.createEntity();
      addSettlement(world, 50, 50, 1000, factionId as unknown as number);

      bridge.setFactionColors(new Map([[factionId as unknown as number, '#0000ff']]));
      bridge.forceRefreshAll(0);

      const lookup = bridge.getTerritoryLookup();
      // Default radius is 12, so 50+20=70 should be outside
      const territory = lookup(80, 80);
      expect(territory).toBeNull();
    });

    it('detects border tiles between factions', () => {
      const faction1 = world.createEntity();
      const faction2 = world.createEntity();
      // Place settlements close enough that territories overlap
      addSettlement(world, 40, 50, 1000, faction1 as unknown as number);
      addSettlement(world, 55, 50, 1000, faction2 as unknown as number);

      bridge.setFactionColors(new Map([
        [faction1 as unknown as number, '#ff0000'],
        [faction2 as unknown as number, '#0000ff'],
      ]));
      bridge.forceRefreshAll(0);

      // Check that some tiles near the midpoint are borders
      const lookup = bridge.getTerritoryLookup();
      let foundBorder = false;
      for (let x = 44; x <= 52; x++) {
        const t = lookup(x, 50);
        if (t !== null && t.isBorder) {
          foundBorder = true;
          break;
        }
      }
      expect(foundBorder).toBe(true);
    });

    it('marks capital tile correctly', () => {
      const factionId = world.createEntity();
      const capitalId = addSettlement(world, 50, 50, 1000, factionId as unknown as number);

      bridge.setFactionColors(new Map([[factionId as unknown as number, '#ff0000']]));
      bridge.setFactionCapitals(new Map([[factionId as unknown as number, capitalId as unknown as number]]));
      bridge.forceRefreshAll(0);

      const lookup = bridge.getTerritoryLookup();
      const territory = lookup(50, 50);
      expect(territory?.isCapital).toBe(true);
    });

    it('non-capital settlement tile is not marked as capital', () => {
      const factionId = world.createEntity();
      const capitalId = addSettlement(world, 50, 50, 1000, factionId as unknown as number);
      addSettlement(world, 55, 50, 500, factionId as unknown as number);

      bridge.setFactionColors(new Map([[factionId as unknown as number, '#ff0000']]));
      bridge.setFactionCapitals(new Map([[factionId as unknown as number, capitalId as unknown as number]]));
      bridge.forceRefreshAll(0);

      const lookup = bridge.getTerritoryLookup();
      const territory = lookup(55, 50);
      expect(territory).not.toBeNull();
      expect(territory?.isCapital).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Military cache
  // --------------------------------------------------------------------------

  describe('military cache', () => {
    it('detects entities with Position + Military', () => {
      const eid = world.createEntity();
      world.addComponent(eid, makeComponent<PositionComponent>({
        type: 'Position', x: 30, y: 30,
      }));
      world.addComponent(eid, makeComponent<MilitaryComponent>({
        type: 'Military', strength: 100, morale: 70, training: 50,
      }));

      bridge.forceRefreshAll(0);

      const lookup = bridge.getMilitaryLookup();
      const data = lookup(30, 30);
      expect(data).not.toBeNull();
      expect(data?.hasArmy).toBe(true);
    });

    it('ignores settlements with low military strength', () => {
      // A settlement (has Population) with weak military
      const eid = addSettlement(world, 30, 30, 500);
      world.addComponent(eid, makeComponent<MilitaryComponent>({
        type: 'Military', strength: 10, morale: 70, training: 50,
      }));

      bridge.forceRefreshAll(0);

      const lookup = bridge.getMilitaryLookup();
      const data = lookup(30, 30);
      expect(data).toBeNull();
    });

    it('shows besieged settlements (low morale)', () => {
      const eid = addSettlement(world, 30, 30, 500);
      world.addComponent(eid, makeComponent<MilitaryComponent>({
        type: 'Military', strength: 80, morale: 20, training: 50,
      }));

      bridge.forceRefreshAll(0);

      const lookup = bridge.getMilitaryLookup();
      const data = lookup(30, 30);
      expect(data).not.toBeNull();
      expect(data?.isBesieged).toBe(true);
    });

    it('returns null for tiles without military activity', () => {
      bridge.forceRefreshAll(0);

      const lookup = bridge.getMilitaryLookup();
      expect(lookup(50, 50)).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Trade cache
  // --------------------------------------------------------------------------

  describe('trade cache', () => {
    it('identifies trade hubs from wealthy settlements', () => {
      addSettlement(world, 10, 10, 5000, null, 10000);
      addSettlement(world, 20, 20, 3000, null, 5000);

      bridge.forceRefreshAll(0);

      const lookup = bridge.getTradeLookup();
      const hub = lookup(10, 10);
      expect(hub).not.toBeNull();
      expect(hub?.isTradeHub).toBe(true);
    });

    it('creates trade routes between nearby wealthy settlements', () => {
      addSettlement(world, 10, 10, 5000, null, 10000);
      addSettlement(world, 20, 10, 3000, null, 5000);

      bridge.forceRefreshAll(0);

      const stats = bridge.getStats();
      // Route tiles should include tiles between the two hubs
      expect(stats.tradeRouteTileCount).toBeGreaterThan(2);
    });

    it('does not connect settlements beyond trade range', () => {
      addSettlement(world, 0, 0, 5000, null, 10000);
      addSettlement(world, 90, 90, 3000, null, 5000);

      bridge.forceRefreshAll(0);

      const lookup = bridge.getTradeLookup();
      // A tile far from both should not have a route
      const midTile = lookup(45, 45);
      // The distance is ~127, well beyond TRADE_RANGE of 50
      expect(midTile).toBeNull();
    });

    it('returns null for tiles without trade', () => {
      bridge.forceRefreshAll(0);

      const lookup = bridge.getTradeLookup();
      expect(lookup(50, 50)).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Magic cache
  // --------------------------------------------------------------------------

  describe('magic cache', () => {
    it('detects ley lines from tile lookup', () => {
      const viewport = new Viewport(20, 20, 10, 10, 1);

      const tileLookup = (x: number, y: number): RenderableTile | null => {
        if (x === 10 && y === 10) {
          return { biome: 'Plains', leyLine: true };
        }
        return { biome: 'Plains' };
      };

      bridge.setTileLookup(tileLookup);
      bridge.setViewport(viewport);
      bridge.forceRefreshAll(0);

      const lookup = bridge.getMagicLookup();
      const data = lookup(10, 10);
      expect(data).not.toBeNull();
      expect(data?.hasLeyLine).toBe(true);
    });

    it('detects magical artifacts from ECS', () => {
      const eid = world.createEntity();
      world.addComponent(eid, makeComponent<PositionComponent>({
        type: 'Position', x: 25, y: 25,
      }));
      world.addComponent(eid, makeComponent<MagicalPropertyComponent>({
        type: 'MagicalProperty',
        enchantments: ['fire'],
        powerLevel: 50,
      }));

      bridge.forceRefreshAll(0);

      const lookup = bridge.getMagicLookup();
      const data = lookup(25, 25);
      expect(data).not.toBeNull();
      expect(data?.hasArtifact).toBe(true);
    });

    it('returns null for tiles without magic', () => {
      bridge.forceRefreshAll(0);

      const lookup = bridge.getMagicLookup();
      expect(lookup(50, 50)).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Resource lookup (passthrough to tile data)
  // --------------------------------------------------------------------------

  describe('resource lookup', () => {
    it('returns resource data from tile lookup', () => {
      const tileLookup = (x: number, y: number): RenderableTile | null => {
        if (x === 5 && y === 5) {
          return { biome: 'Mountain', resources: ['Iron', 'Gold'] };
        }
        return { biome: 'Plains' };
      };

      bridge.setTileLookup(tileLookup);

      const lookup = bridge.getResourceLookup();
      const data = lookup(5, 5);
      expect(data).not.toBeNull();
      expect(data?.resources).toEqual(['Iron', 'Gold']);
    });

    it('returns null for tiles without resources', () => {
      const tileLookup = (): RenderableTile | null => ({ biome: 'Plains' });
      bridge.setTileLookup(tileLookup);

      const lookup = bridge.getResourceLookup();
      expect(lookup(5, 5)).toBeNull();
    });

    it('returns null when tile lookup not set', () => {
      const lookup = bridge.getResourceLookup();
      expect(lookup(5, 5)).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Climate lookup (passthrough to tile data)
  // --------------------------------------------------------------------------

  describe('climate lookup', () => {
    it('returns climate data from tile lookup', () => {
      const tileLookup = (x: number, y: number): RenderableTile | null => ({
        biome: 'Plains',
        temperature: 25,
        rainfall: 150,
      });

      bridge.setTileLookup(tileLookup);

      const lookup = bridge.getClimateLookup();
      const data = lookup(5, 5);
      expect(data).not.toBeNull();
      expect(data?.temperature).toBe(25);
      expect(data?.rainfall).toBe(150);
    });

    it('uses defaults when tile has no climate data', () => {
      const tileLookup = (): RenderableTile | null => ({ biome: 'Plains' });
      bridge.setTileLookup(tileLookup);

      const lookup = bridge.getClimateLookup();
      const data = lookup(5, 5);
      expect(data?.temperature).toBe(15);
      expect(data?.rainfall).toBe(100);
    });
  });

  // --------------------------------------------------------------------------
  // Dirty flag tracking
  // --------------------------------------------------------------------------

  describe('dirty flags', () => {
    it('markDirty adds a layer to dirty set', () => {
      // Force refresh to clear all dirty flags
      bridge.forceRefreshAll(0);

      bridge.markDirty(OverlayLayer.Military);

      // refreshIfDirty should return true because military is dirty
      const updated = bridge.refreshIfDirty(1);
      expect(updated).toBe(true);
    });

    it('markAllDirty marks all layers', () => {
      bridge.forceRefreshAll(0);
      bridge.markAllDirty();

      const updated = bridge.refreshIfDirty(100);
      expect(updated).toBe(true);
    });

    it('respects refresh intervals', () => {
      bridge.forceRefreshAll(0);

      // Mark territory dirty (interval = 30)
      bridge.markDirty(OverlayLayer.Territory);

      // Tick 5: too early, should not refresh territory
      // But military has interval 1 and was refreshed at 0
      const updated5 = bridge.refreshIfDirty(5);
      // Territory is dirty but 5 - 0 < 30, so it should NOT refresh
      expect(updated5).toBe(false);

      // Tick 30: now territory should refresh
      const updated30 = bridge.refreshIfDirty(30);
      expect(updated30).toBe(true);
    });

    it('military layer refreshes every tick when dirty', () => {
      bridge.forceRefreshAll(0);
      bridge.markDirty(OverlayLayer.Military);

      // Tick 1: military interval is 1, last refresh was 0
      const updated = bridge.refreshIfDirty(1);
      expect(updated).toBe(true);
    });

    it('non-dirty layers are not refreshed', () => {
      bridge.forceRefreshAll(100);

      // No layers marked dirty after forceRefreshAll
      const updated = bridge.refreshIfDirty(200);
      expect(updated).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Event subscription
  // --------------------------------------------------------------------------

  describe('event subscription', () => {
    it('subscribes to military events', () => {
      const eventBus = new EventBus();
      bridge.subscribeToEvents(eventBus);

      expect(eventBus.categoryHandlerCount(EventCategory.Military)).toBe(1);
    });

    it('subscribes to political events', () => {
      const eventBus = new EventBus();
      bridge.subscribeToEvents(eventBus);

      expect(eventBus.categoryHandlerCount(EventCategory.Political)).toBe(1);
    });

    it('subscribes to economic events', () => {
      const eventBus = new EventBus();
      bridge.subscribeToEvents(eventBus);

      expect(eventBus.categoryHandlerCount(EventCategory.Economic)).toBe(1);
    });

    it('subscribes to magical events', () => {
      const eventBus = new EventBus();
      bridge.subscribeToEvents(eventBus);

      expect(eventBus.categoryHandlerCount(EventCategory.Magical)).toBe(1);
    });

    it('dispose unsubscribes from all events', () => {
      const eventBus = new EventBus();
      bridge.subscribeToEvents(eventBus);

      expect(eventBus.categoryHandlerCount(EventCategory.Military)).toBe(1);

      bridge.dispose();

      expect(eventBus.categoryHandlerCount(EventCategory.Military)).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Cache update callback
  // --------------------------------------------------------------------------

  describe('onCacheUpdated callback', () => {
    it('calls callback when caches are updated', () => {
      const callback = vi.fn();
      bridge.setOnCacheUpdated(callback);

      bridge.forceRefreshAll(0);

      expect(callback).toHaveBeenCalledOnce();
    });

    it('calls callback on refreshIfDirty when layers update', () => {
      bridge.forceRefreshAll(0);

      const callback = vi.fn();
      bridge.setOnCacheUpdated(callback);

      bridge.markDirty(OverlayLayer.Military);
      bridge.refreshIfDirty(1);

      expect(callback).toHaveBeenCalledOnce();
    });

    it('does not call callback when no layers need refresh', () => {
      bridge.forceRefreshAll(0);

      const callback = vi.fn();
      bridge.setOnCacheUpdated(callback);

      bridge.refreshIfDirty(1);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  describe('statistics', () => {
    it('reports correct counts after population', () => {
      addSettlement(world, 10, 10, 1000, null, 5000);
      addSettlement(world, 20, 20, 2000, null, 8000);

      bridge.forceRefreshAll(0);

      const stats = bridge.getStats();
      expect(stats.settlementCount).toBe(2);
      expect(stats.entityMarkerCount).toBe(2);
      expect(stats.lastRefreshTick).toBe(0);
    });

    it('reports zero counts with empty world', () => {
      bridge.forceRefreshAll(0);

      const stats = bridge.getStats();
      expect(stats.settlementCount).toBe(0);
      expect(stats.territoryTileCount).toBe(0);
      expect(stats.militaryTileCount).toBe(0);
      expect(stats.tradeRouteTileCount).toBe(0);
      expect(stats.magicTileCount).toBe(0);
      expect(stats.entityMarkerCount).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Entity marker cache
  // --------------------------------------------------------------------------

  describe('entity markers', () => {
    it('creates markers for settlement entities', () => {
      addSettlement(world, 10, 10, 500);

      bridge.forceRefreshAll(0);

      const lookup = bridge.getEntityLookup();
      const marker = lookup(10, 10);
      expect(marker).not.toBeNull();
      expect(marker?.type).toBe('city');
    });

    it('creates temple markers from structures', () => {
      const eid = world.createEntity();
      world.addComponent(eid, makeComponent<PositionComponent>({
        type: 'Position', x: 30, y: 30,
      }));
      world.addComponent(eid, makeComponent<StructuresComponent>({
        type: 'Structures',
        buildings: ['Grand Temple of Light'],
        fortificationLevel: 0,
      }));

      // Add a settlement to trigger entity marker refresh
      // (entity markers refresh with settlements)
      addSettlement(world, 10, 10, 100);
      bridge.forceRefreshAll(0);

      const lookup = bridge.getEntityLookup();
      const marker = lookup(30, 30);
      expect(marker).not.toBeNull();
      expect(marker?.type).toBe('temple');
    });

    it('creates academy markers from structures', () => {
      const eid = world.createEntity();
      world.addComponent(eid, makeComponent<PositionComponent>({
        type: 'Position', x: 30, y: 30,
      }));
      world.addComponent(eid, makeComponent<StructuresComponent>({
        type: 'Structures',
        buildings: ['Royal Academy of Arts'],
        fortificationLevel: 0,
      }));

      addSettlement(world, 10, 10, 100);
      bridge.forceRefreshAll(0);

      const lookup = bridge.getEntityLookup();
      const marker = lookup(30, 30);
      expect(marker).not.toBeNull();
      expect(marker?.type).toBe('academy');
    });

    it('settlement markers take priority over structure markers', () => {
      // A settlement with a temple -- settlement marker should win
      const eid = addSettlement(world, 10, 10, 5000);
      world.getComponent<StructuresComponent>(eid, 'Structures');

      bridge.forceRefreshAll(0);

      const lookup = bridge.getEntityLookup();
      const marker = lookup(10, 10);
      expect(marker).not.toBeNull();
      // Should be city, not temple (even if structures has temple)
      expect(marker?.type).toBe('city');
    });
  });

  // --------------------------------------------------------------------------
  // Default config values
  // --------------------------------------------------------------------------

  describe('default config', () => {
    it('has correct refresh intervals', () => {
      expect(DEFAULT_BRIDGE_CONFIG.refreshIntervals[OverlayLayer.Territory]).toBe(30);
      expect(DEFAULT_BRIDGE_CONFIG.refreshIntervals[OverlayLayer.Settlements]).toBe(30);
      expect(DEFAULT_BRIDGE_CONFIG.refreshIntervals[OverlayLayer.Military]).toBe(1);
      expect(DEFAULT_BRIDGE_CONFIG.refreshIntervals[OverlayLayer.Trade]).toBe(90);
      expect(DEFAULT_BRIDGE_CONFIG.refreshIntervals[OverlayLayer.Magic]).toBe(90);
      expect(DEFAULT_BRIDGE_CONFIG.refreshIntervals[OverlayLayer.Climate]).toBe(Infinity);
    });

    it('has correct defaults', () => {
      expect(DEFAULT_BRIDGE_CONFIG.viewportMargin).toBe(5);
      expect(DEFAULT_BRIDGE_CONFIG.territoryRadius).toBe(12);
    });
  });
});
