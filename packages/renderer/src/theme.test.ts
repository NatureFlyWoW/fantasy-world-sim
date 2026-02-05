import { describe, it, expect } from 'vitest';
import { EventCategory } from '@fws/core';
import {
  getSignificanceColor,
  getSignificanceLevel,
  getCategoryColor,
  getEntityColor,
  getBiomeRendering,
  SIGNIFICANCE_COLORS,
  CATEGORY_COLORS,
  ENTITY_COLORS,
  UI_COLORS,
  SIGNIFICANCE_THRESHOLDS,
  blendColors,
  dimColor,
  brightenColor,
  BiomeType,
} from './theme.js';
import { BIOME_CHARS } from './themes/biome-chars.js';

describe('Theme', () => {
  describe('getSignificanceColor', () => {
    it('returns trivial color for significance 0-19', () => {
      expect(getSignificanceColor(0)).toBe(SIGNIFICANCE_COLORS.trivial);
      expect(getSignificanceColor(10)).toBe(SIGNIFICANCE_COLORS.trivial);
      expect(getSignificanceColor(19)).toBe(SIGNIFICANCE_COLORS.trivial);
    });

    it('returns minor color for significance 20-39', () => {
      expect(getSignificanceColor(20)).toBe(SIGNIFICANCE_COLORS.minor);
      expect(getSignificanceColor(30)).toBe(SIGNIFICANCE_COLORS.minor);
      expect(getSignificanceColor(39)).toBe(SIGNIFICANCE_COLORS.minor);
    });

    it('returns moderate color for significance 40-59', () => {
      expect(getSignificanceColor(40)).toBe(SIGNIFICANCE_COLORS.moderate);
      expect(getSignificanceColor(50)).toBe(SIGNIFICANCE_COLORS.moderate);
      expect(getSignificanceColor(59)).toBe(SIGNIFICANCE_COLORS.moderate);
    });

    it('returns major color for significance 60-79', () => {
      expect(getSignificanceColor(60)).toBe(SIGNIFICANCE_COLORS.major);
      expect(getSignificanceColor(70)).toBe(SIGNIFICANCE_COLORS.major);
      expect(getSignificanceColor(79)).toBe(SIGNIFICANCE_COLORS.major);
    });

    it('returns critical color for significance 80-94', () => {
      expect(getSignificanceColor(80)).toBe(SIGNIFICANCE_COLORS.critical);
      expect(getSignificanceColor(90)).toBe(SIGNIFICANCE_COLORS.critical);
      expect(getSignificanceColor(94)).toBe(SIGNIFICANCE_COLORS.critical);
    });

    it('returns legendary color for significance 95-100', () => {
      expect(getSignificanceColor(95)).toBe(SIGNIFICANCE_COLORS.legendary);
      expect(getSignificanceColor(100)).toBe(SIGNIFICANCE_COLORS.legendary);
    });

    it('handles edge cases at thresholds', () => {
      expect(getSignificanceColor(SIGNIFICANCE_THRESHOLDS.minor - 1)).toBe(SIGNIFICANCE_COLORS.trivial);
      expect(getSignificanceColor(SIGNIFICANCE_THRESHOLDS.minor)).toBe(SIGNIFICANCE_COLORS.minor);
      expect(getSignificanceColor(SIGNIFICANCE_THRESHOLDS.moderate - 1)).toBe(SIGNIFICANCE_COLORS.minor);
      expect(getSignificanceColor(SIGNIFICANCE_THRESHOLDS.moderate)).toBe(SIGNIFICANCE_COLORS.moderate);
    });
  });

  describe('getSignificanceLevel', () => {
    it('returns correct level names', () => {
      expect(getSignificanceLevel(0)).toBe('trivial');
      expect(getSignificanceLevel(25)).toBe('minor');
      expect(getSignificanceLevel(50)).toBe('moderate');
      expect(getSignificanceLevel(70)).toBe('major');
      expect(getSignificanceLevel(85)).toBe('critical');
      expect(getSignificanceLevel(99)).toBe('legendary');
    });
  });

  describe('getCategoryColor', () => {
    it('returns correct color for each event category', () => {
      expect(getCategoryColor(EventCategory.Political)).toBe(CATEGORY_COLORS[EventCategory.Political]);
      expect(getCategoryColor(EventCategory.Military)).toBe(CATEGORY_COLORS[EventCategory.Military]);
      expect(getCategoryColor(EventCategory.Magical)).toBe(CATEGORY_COLORS[EventCategory.Magical]);
      expect(getCategoryColor(EventCategory.Cultural)).toBe(CATEGORY_COLORS[EventCategory.Cultural]);
      expect(getCategoryColor(EventCategory.Religious)).toBe(CATEGORY_COLORS[EventCategory.Religious]);
      expect(getCategoryColor(EventCategory.Economic)).toBe(CATEGORY_COLORS[EventCategory.Economic]);
      expect(getCategoryColor(EventCategory.Personal)).toBe(CATEGORY_COLORS[EventCategory.Personal]);
      expect(getCategoryColor(EventCategory.Disaster)).toBe(CATEGORY_COLORS[EventCategory.Disaster]);
      expect(getCategoryColor(EventCategory.Scientific)).toBe(CATEGORY_COLORS[EventCategory.Scientific]);
      expect(getCategoryColor(EventCategory.Exploratory)).toBe(CATEGORY_COLORS[EventCategory.Exploratory]);
    });

    it('has colors defined for all categories', () => {
      for (const category of Object.values(EventCategory)) {
        expect(CATEGORY_COLORS[category]).toBeDefined();
        expect(typeof CATEGORY_COLORS[category]).toBe('string');
        expect(CATEGORY_COLORS[category]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  });

  describe('getEntityColor', () => {
    it('returns city color for city-related entities', () => {
      expect(getEntityColor('city')).toBe(ENTITY_COLORS.city);
      expect(getEntityColor('City')).toBe(ENTITY_COLORS.city);
      expect(getEntityColor('settlement')).toBe(ENTITY_COLORS.city);
    });

    it('returns ruin color for ruin-related entities', () => {
      expect(getEntityColor('ruin')).toBe(ENTITY_COLORS.ruin);
      expect(getEntityColor('ancient_ruin')).toBe(ENTITY_COLORS.ruin);
    });

    it('returns army color for military entities', () => {
      expect(getEntityColor('army')).toBe(ENTITY_COLORS.army);
      expect(getEntityColor('military_force')).toBe(ENTITY_COLORS.army);
    });

    it('returns temple color for religious buildings', () => {
      expect(getEntityColor('temple')).toBe(ENTITY_COLORS.temple);
      expect(getEntityColor('shrine')).toBe(ENTITY_COLORS.temple);
    });

    it('returns academy color for educational buildings', () => {
      expect(getEntityColor('academy')).toBe(ENTITY_COLORS.academy);
      expect(getEntityColor('school')).toBe(ENTITY_COLORS.academy);
    });

    it('returns capital color for capital entities', () => {
      expect(getEntityColor('capital')).toBe(ENTITY_COLORS.capital);
    });

    it('returns character color for characters', () => {
      expect(getEntityColor('character')).toBe(ENTITY_COLORS.character);
      expect(getEntityColor('person')).toBe(ENTITY_COLORS.character);
    });

    it('returns faction color for factions', () => {
      expect(getEntityColor('faction')).toBe(ENTITY_COLORS.faction);
      expect(getEntityColor('nation')).toBe(ENTITY_COLORS.faction);
    });

    it('returns artifact color for artifacts', () => {
      expect(getEntityColor('artifact')).toBe(ENTITY_COLORS.artifact);
    });

    it('returns default color for unknown types', () => {
      expect(getEntityColor('unknown')).toBe(UI_COLORS.text);
      expect(getEntityColor('something_else')).toBe(UI_COLORS.text);
    });
  });

  describe('getBiomeRendering', () => {
    it('returns correct visual for each biome type', () => {
      for (const biomeType of Object.values(BiomeType)) {
        const visual = getBiomeRendering(biomeType);
        const expected = BIOME_CHARS[biomeType];

        expect(visual).toEqual(expected);
        expect(visual.char).toBeDefined();
        expect(visual.fg).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(visual.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('returns unique characters for different terrain categories', () => {
      // Water biomes use ≈ or ~
      expect(getBiomeRendering(BiomeType.DeepOcean).char).toBe('\u2248');
      expect(getBiomeRendering(BiomeType.Ocean).char).toBe('\u2248');
      expect(getBiomeRendering(BiomeType.Coast).char).toBe('~');

      // Forest biomes use █
      expect(getBiomeRendering(BiomeType.Forest).char).toBe('\u2588');
      expect(getBiomeRendering(BiomeType.DenseForest).char).toBe('\u2588');

      // Mountain biomes use ▓ or ▲
      expect(getBiomeRendering(BiomeType.Mountain).char).toBe('\u2593');
      expect(getBiomeRendering(BiomeType.HighMountain).char).toBe('\u25B2');
    });
  });

  describe('blendColors', () => {
    it('returns first color when ratio is 0', () => {
      expect(blendColors('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    });

    it('returns second color when ratio is 1', () => {
      expect(blendColors('#ff0000', '#0000ff', 1)).toBe('#0000ff');
    });

    it('returns midpoint at ratio 0.5', () => {
      const blended = blendColors('#000000', '#ffffff', 0.5);
      // Should be approximately gray
      expect(blended.toLowerCase()).toBe('#808080');
    });

    it('handles different color combinations', () => {
      const blended = blendColors('#ff0000', '#00ff00', 0.5);
      expect(blended.toLowerCase()).toBe('#808000'); // Should be yellow-ish
    });
  });

  describe('dimColor', () => {
    it('dims colors by default factor', () => {
      const dimmed = dimColor('#ffffff');
      expect(dimmed.toLowerCase()).toBe('#808080');
    });

    it('dims colors by custom factor', () => {
      const dimmed = dimColor('#ffffff', 0.25);
      expect(dimmed.toLowerCase()).toBe('#404040');
    });

    it('handles black correctly', () => {
      expect(dimColor('#000000')).toBe('#000000');
    });
  });

  describe('brightenColor', () => {
    it('brightens colors by default factor', () => {
      const brightened = brightenColor('#808080');
      expect(brightened.toLowerCase()).toBe('#c0c0c0');
    });

    it('caps at maximum white', () => {
      const brightened = brightenColor('#ffffff', 2);
      expect(brightened.toLowerCase()).toBe('#ffffff');
    });

    it('handles dark colors', () => {
      const brightened = brightenColor('#404040', 2);
      expect(brightened.toLowerCase()).toBe('#808080');
    });
  });

  describe('color constants', () => {
    it('has all UI colors defined as valid hex', () => {
      for (const [key, color] of Object.entries(UI_COLORS)) {
        expect(color, `UI_COLORS.${key}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('has all entity colors defined as valid hex', () => {
      for (const [key, color] of Object.entries(ENTITY_COLORS)) {
        expect(color, `ENTITY_COLORS.${key}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('has all significance colors defined as valid hex', () => {
      for (const [key, color] of Object.entries(SIGNIFICANCE_COLORS)) {
        expect(color, `SIGNIFICANCE_COLORS.${key}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('has significance thresholds in ascending order', () => {
      expect(SIGNIFICANCE_THRESHOLDS.trivial).toBeLessThan(SIGNIFICANCE_THRESHOLDS.minor);
      expect(SIGNIFICANCE_THRESHOLDS.minor).toBeLessThan(SIGNIFICANCE_THRESHOLDS.moderate);
      expect(SIGNIFICANCE_THRESHOLDS.moderate).toBeLessThan(SIGNIFICANCE_THRESHOLDS.major);
      expect(SIGNIFICANCE_THRESHOLDS.major).toBeLessThan(SIGNIFICANCE_THRESHOLDS.critical);
      expect(SIGNIFICANCE_THRESHOLDS.critical).toBeLessThan(SIGNIFICANCE_THRESHOLDS.legendary);
    });
  });
});
