import { describe, it, expect } from 'vitest';
import {
  renderTile,
  renderAveragedRegion,
  renderEntityMarker,
  getEntityMarkerType,
  renderResourceMarker,
  compositeEntityOnTile,
  compositeResourceOnTile,
  RESOURCE_CHARS,
  RESOURCE_COLORS,
} from './tile-renderer.js';
import type { RenderableTile } from './tile-renderer.js';
import { BiomeType, BIOME_CHARS, ENTITY_MARKERS } from '../themes/biome-chars.js';

describe('TileRenderer', () => {
  describe('renderTile', () => {
    it('renders plains biome correctly', () => {
      const tile: RenderableTile = { biome: BiomeType.Plains };
      const rendered = renderTile(tile);

      expect(rendered.char).toBe(BIOME_CHARS[BiomeType.Plains].char);
      expect(rendered.fg).toBe(BIOME_CHARS[BiomeType.Plains].fg);
      expect(rendered.bg).toBe(BIOME_CHARS[BiomeType.Plains].bg);
    });

    it('renders forest biome correctly', () => {
      const tile: RenderableTile = { biome: BiomeType.Forest };
      const rendered = renderTile(tile);

      expect(rendered.char).toBe(BIOME_CHARS[BiomeType.Forest].char);
    });

    it('renders ocean biome correctly', () => {
      const tile: RenderableTile = { biome: BiomeType.Ocean };
      const rendered = renderTile(tile);

      expect(rendered.char).toBe(BIOME_CHARS[BiomeType.Ocean].char);
    });

    it('renders all biome types', () => {
      for (const biome of Object.values(BiomeType)) {
        const tile: RenderableTile = { biome };
        const rendered = renderTile(tile);

        expect(rendered.char).toBeDefined();
        expect(rendered.fg).toMatch(/^#[0-9a-f]{6}$/i);
        expect(rendered.bg).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    it('renders river overlay on tiles', () => {
      const tile: RenderableTile = { biome: BiomeType.Plains, riverId: 1 };
      const rendered = renderTile(tile);

      expect(rendered.char).toBe('~');
      expect(rendered.fg).toBe('#4488cc');
      // Background should still be from plains
      expect(rendered.bg).toBe(BIOME_CHARS[BiomeType.Plains].bg);
    });

    it('renders ley line overlay on tiles', () => {
      const tile: RenderableTile = { biome: BiomeType.Plains, leyLine: true };
      const rendered = renderTile(tile);

      // Character stays the same, colors modified
      expect(rendered.char).toBe(BIOME_CHARS[BiomeType.Plains].char);
      expect(rendered.fg).toBe('#cc88ff');
      // Background should be blended with purple
      expect(rendered.bg).not.toBe(BIOME_CHARS[BiomeType.Plains].bg);
    });

    it('returns fallback for unknown biome', () => {
      const tile: RenderableTile = { biome: 'UnknownBiome' };
      const rendered = renderTile(tile);

      expect(rendered.char).toBe('?');
      expect(rendered.fg).toBe('#ff00ff');
    });
  });

  describe('renderAveragedRegion', () => {
    it('returns empty for no tiles', () => {
      const rendered = renderAveragedRegion([]);
      expect(rendered.char).toBe(' ');
    });

    it('returns single tile rendering for one tile', () => {
      const tiles: RenderableTile[] = [{ biome: BiomeType.Forest }];
      const rendered = renderAveragedRegion(tiles);

      expect(rendered.char).toBe(BIOME_CHARS[BiomeType.Forest].char);
    });

    it('uses dominant biome character for multiple tiles', () => {
      const tiles: RenderableTile[] = [
        { biome: BiomeType.Forest },
        { biome: BiomeType.Forest },
        { biome: BiomeType.Plains },
      ];
      const rendered = renderAveragedRegion(tiles);

      // Forest is dominant (2 vs 1)
      expect(rendered.char).toBe(BIOME_CHARS[BiomeType.Forest].char);
    });

    it('blends colors from multiple tiles', () => {
      const tiles: RenderableTile[] = [
        { biome: BiomeType.Forest },
        { biome: BiomeType.Plains },
      ];
      const rendered = renderAveragedRegion(tiles);

      // Colors should be blended (not exactly matching either)
      expect(rendered.fg).not.toBe(BIOME_CHARS[BiomeType.Forest].fg);
      expect(rendered.fg).not.toBe(BIOME_CHARS[BiomeType.Plains].fg);
    });

    it('indicates rivers in averaged region', () => {
      const tiles: RenderableTile[] = [
        { biome: BiomeType.Plains },
        { biome: BiomeType.Plains, riverId: 1 },
        { biome: BiomeType.Plains },
        { biome: BiomeType.Plains },
      ];
      const rendered = renderAveragedRegion(tiles);

      // Color should be tinted toward river blue
      expect(rendered.fg).not.toBe(BIOME_CHARS[BiomeType.Plains].fg);
    });

    it('indicates ley lines in averaged region', () => {
      const tiles: RenderableTile[] = [
        { biome: BiomeType.Plains },
        { biome: BiomeType.Plains, leyLine: true },
        { biome: BiomeType.Plains },
        { biome: BiomeType.Plains },
      ];
      const rendered = renderAveragedRegion(tiles);

      // Background should be tinted purple
      expect(rendered.bg).not.toBe(BIOME_CHARS[BiomeType.Plains].bg);
    });
  });

  describe('renderEntityMarker', () => {
    it('renders city marker correctly', () => {
      const marker = renderEntityMarker('city');

      expect(marker.char).toBe(ENTITY_MARKERS.city.char);
      expect(marker.fg).toBe(ENTITY_MARKERS.city.fg);
    });

    it('renders ruin marker correctly', () => {
      const marker = renderEntityMarker('ruin');

      expect(marker.char).toBe(ENTITY_MARKERS.ruin.char);
      expect(marker.fg).toBe(ENTITY_MARKERS.ruin.fg);
    });

    it('renders army marker correctly', () => {
      const marker = renderEntityMarker('army');

      expect(marker.char).toBe(ENTITY_MARKERS.army.char);
      expect(marker.fg).toBe(ENTITY_MARKERS.army.fg);
    });

    it('renders temple marker correctly', () => {
      const marker = renderEntityMarker('temple');

      expect(marker.char).toBe(ENTITY_MARKERS.temple.char);
    });

    it('renders academy marker correctly', () => {
      const marker = renderEntityMarker('academy');

      expect(marker.char).toBe(ENTITY_MARKERS.academy.char);
    });

    it('renders capital marker correctly', () => {
      const marker = renderEntityMarker('factionCapital');

      expect(marker.char).toBe(ENTITY_MARKERS.factionCapital.char);
    });

    it('uses faction color when provided', () => {
      const factionColor = '#ff0000';
      const marker = renderEntityMarker('city', factionColor);

      expect(marker.fg).toBe(factionColor);
    });

    it('returns default marker for unknown entity types', () => {
      const marker = renderEntityMarker('unknownType');

      expect(marker.char).toBe('*');
      expect(marker.fg).toBe('#ffffff');
    });

    it('all known markers have transparent background', () => {
      for (const markerType of Object.keys(ENTITY_MARKERS)) {
        const marker = renderEntityMarker(markerType);
        expect(marker.bg).toBe('#000000');
      }
    });
  });

  describe('getEntityMarkerType', () => {
    it('returns city for city-related strings', () => {
      expect(getEntityMarkerType('city')).toBe('city');
      expect(getEntityMarkerType('City')).toBe('city');
      expect(getEntityMarkerType('settlement')).toBe('city');
      expect(getEntityMarkerType('town')).toBe('city');
      expect(getEntityMarkerType('village')).toBe('city');
    });

    it('returns capital for capital strings', () => {
      expect(getEntityMarkerType('capital')).toBe('factionCapital');
      expect(getEntityMarkerType('Capital City')).toBe('factionCapital');
    });

    it('returns ruin for ruin strings', () => {
      expect(getEntityMarkerType('ruin')).toBe('ruin');
      expect(getEntityMarkerType('ancient_ruin')).toBe('ruin');
    });

    it('returns army for military strings', () => {
      expect(getEntityMarkerType('army')).toBe('army');
      expect(getEntityMarkerType('military')).toBe('army');
    });

    it('returns temple for religious strings', () => {
      expect(getEntityMarkerType('temple')).toBe('temple');
      expect(getEntityMarkerType('shrine')).toBe('temple');
      expect(getEntityMarkerType('church')).toBe('temple');
    });

    it('returns academy for educational strings', () => {
      expect(getEntityMarkerType('academy')).toBe('academy');
      expect(getEntityMarkerType('school')).toBe('academy');
      expect(getEntityMarkerType('university')).toBe('academy');
    });

    it('returns null for unknown types', () => {
      expect(getEntityMarkerType('unknown')).toBeNull();
      expect(getEntityMarkerType('forest')).toBeNull();
    });
  });

  describe('renderResourceMarker', () => {
    it('renders food resource', () => {
      const marker = renderResourceMarker('Food');

      expect(marker.char).toBe(RESOURCE_CHARS['Food']);
      expect(marker.fg).toBe(RESOURCE_COLORS['Food']);
    });

    it('renders iron resource', () => {
      const marker = renderResourceMarker('Iron');

      expect(marker.char).toBe(RESOURCE_CHARS['Iron']);
      expect(marker.fg).toBe(RESOURCE_COLORS['Iron']);
    });

    it('renders gold resource', () => {
      const marker = renderResourceMarker('Gold');

      expect(marker.char).toBe(RESOURCE_CHARS['Gold']);
      expect(marker.fg).toBe(RESOURCE_COLORS['Gold']);
    });

    it('renders all known resources', () => {
      for (const resource of Object.keys(RESOURCE_CHARS)) {
        const marker = renderResourceMarker(resource);
        expect(marker.char).toBe(RESOURCE_CHARS[resource]);
        expect(marker.fg).toBe(RESOURCE_COLORS[resource]);
      }
    });

    it('returns fallback for unknown resource', () => {
      const marker = renderResourceMarker('UnknownResource');

      expect(marker.char).toBe('\u00B7'); // ·
      expect(marker.fg).toBe('#888888');
    });
  });

  describe('compositeEntityOnTile', () => {
    it('overlays entity character on terrain', () => {
      const terrain = renderTile({ biome: BiomeType.Plains });
      const entity = renderEntityMarker('city');

      const result = compositeEntityOnTile(terrain, entity);

      expect(result.char).toBe(entity.char);
      expect(result.fg).toBe(entity.fg);
      expect(result.bg).toBe(terrain.bg);
    });

    it('preserves terrain background', () => {
      const terrain = renderTile({ biome: BiomeType.Forest });
      const entity = renderEntityMarker('army');

      const result = compositeEntityOnTile(terrain, entity);

      expect(result.bg).toBe(terrain.bg);
    });
  });

  describe('compositeResourceOnTile', () => {
    it('overlays resource on land terrain', () => {
      const terrain = renderTile({ biome: BiomeType.Plains });
      const resource = renderResourceMarker('Iron');

      const result = compositeResourceOnTile(terrain, resource, BiomeType.Plains);

      expect(result.char).toBe(resource.char);
      expect(result.fg).toBe(resource.fg);
      expect(result.bg).toBe(terrain.bg);
    });

    it('does not overlay on deep ocean', () => {
      const terrain = renderTile({ biome: BiomeType.DeepOcean });
      const resource = renderResourceMarker('Gold');

      const result = compositeResourceOnTile(terrain, resource, BiomeType.DeepOcean);

      expect(result.char).toBe(terrain.char);
      expect(result).toEqual(terrain);
    });

    it('does not overlay on regular ocean', () => {
      const terrain = renderTile({ biome: BiomeType.Ocean });
      const resource = renderResourceMarker('Food');

      const result = compositeResourceOnTile(terrain, resource, BiomeType.Ocean);

      expect(result).toEqual(terrain);
    });
  });

  describe('RESOURCE_CHARS constant', () => {
    it('has characters for all resource types', () => {
      const expectedResources = [
        'Food', 'Timber', 'Stone', 'Iron', 'Gold', 'Gems',
        'MagicalComponents', 'LuxuryGoods', 'Fish', 'Copper',
        'Tin', 'Coal', 'Herbs',
      ];

      for (const resource of expectedResources) {
        expect(RESOURCE_CHARS[resource]).toBeDefined();
      }
    });
  });

  describe('RESOURCE_COLORS constant', () => {
    it('has colors for all resource types', () => {
      for (const resource of Object.keys(RESOURCE_CHARS)) {
        expect(RESOURCE_COLORS[resource]).toBeDefined();
        expect(RESOURCE_COLORS[resource]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });
  });
});
