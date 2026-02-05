import { describe, it, expect } from 'vitest';
import { BiomeClassifier } from './biomes.js';
import { BiomeType } from './terrain-tile.js';

describe('BiomeClassifier', () => {
  const classifier = new BiomeClassifier();

  describe('water bodies', () => {
    it('should classify deep ocean for very low elevation', () => {
      expect(classifier.classify(15, 0, -800)).toBe(BiomeType.DeepOcean);
    });

    it('should classify ocean for negative elevation', () => {
      expect(classifier.classify(15, 0, -200)).toBe(BiomeType.Ocean);
    });

    it('should classify coast for low positive elevation with low rainfall', () => {
      // Low rainfall avoids triggering forest/plains rules first
      expect(classifier.classify(15, 30, 30)).toBe(BiomeType.Coast);
    });
  });

  describe('mountains', () => {
    it('should classify high mountain for elevation > 8000', () => {
      expect(classifier.classify(-10, 50, 9000)).toBe(BiomeType.HighMountain);
    });

    it('should classify mountain for elevation > 5000', () => {
      expect(classifier.classify(5, 80, 6000)).toBe(BiomeType.Mountain);
    });
  });

  describe('extreme temperatures', () => {
    it('should classify ice cap for very cold temperatures', () => {
      expect(classifier.classify(-25, 50, 100)).toBe(BiomeType.IceCap);
    });

    it('should classify tundra for cold temperatures', () => {
      expect(classifier.classify(-15, 50, 100)).toBe(BiomeType.Tundra);
    });
  });

  describe('hot and dry', () => {
    it('should classify desert for hot and dry conditions', () => {
      expect(classifier.classify(35, 10, 500)).toBe(BiomeType.Desert);
    });
  });

  describe('hot and wet', () => {
    it('should classify jungle for hot and very wet conditions', () => {
      expect(classifier.classify(28, 250, 200)).toBe(BiomeType.Jungle);
    });
  });

  describe('cold forests', () => {
    it('should classify taiga for cold with moderate rain', () => {
      expect(classifier.classify(0, 60, 500)).toBe(BiomeType.Taiga);
    });
  });

  describe('wetlands', () => {
    it('should classify swamp for low elevation with high rainfall', () => {
      expect(classifier.classify(15, 200, 60)).toBe(BiomeType.Swamp);
    });
  });

  describe('savanna and grasslands', () => {
    it('should classify savanna for warm with moderate rain', () => {
      expect(classifier.classify(25, 50, 500)).toBe(BiomeType.Savanna);
    });

    it('should classify plains for moderate rain', () => {
      expect(classifier.classify(15, 60, 500)).toBe(BiomeType.Plains);
    });
  });

  describe('forests', () => {
    it('should classify dense forest for high rainfall', () => {
      expect(classifier.classify(15, 180, 500)).toBe(BiomeType.DenseForest);
    });

    it('should classify forest for moderate rainfall', () => {
      expect(classifier.classify(10, 100, 500)).toBe(BiomeType.Forest);
    });
  });

  describe('special biomes', () => {
    it('should classify volcano for volcanic high elevation', () => {
      expect(classifier.classify(10, 50, 4000, true)).toBe(BiomeType.Volcano);
    });

    it('should classify magic wasteland when flagged', () => {
      expect(classifier.classify(20, 100, 500, false, true)).toBe(BiomeType.MagicWasteland);
    });
  });

  describe('boundary conditions', () => {
    it('should handle the deep ocean / ocean boundary at -500', () => {
      expect(classifier.classify(10, 0, -500)).toBe(BiomeType.Ocean);
      expect(classifier.classify(10, 0, -501)).toBe(BiomeType.DeepOcean);
    });

    it('should handle the ocean / land boundary at 0', () => {
      expect(classifier.classify(10, 100, -1)).toBe(BiomeType.Ocean);
      // elevation 0 is land (barely) — with low rainfall, classifies as coast
      expect(classifier.classify(10, 30, 0)).toBe(BiomeType.Coast);
    });

    it('should handle mountain boundary at 5000', () => {
      expect(classifier.classify(10, 100, 5001)).toBe(BiomeType.Mountain);
    });
  });
});
