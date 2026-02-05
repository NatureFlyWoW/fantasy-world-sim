/**
 * Biome classification based on temperature, rainfall, and elevation.
 */

import { BiomeType } from './terrain-tile.js';

export class BiomeClassifier {
  /**
   * Classify a tile's biome based on its environmental conditions.
   */
  classify(
    temperature: number,
    rainfall: number,
    elevation: number,
    isVolcanic: boolean = false,
    isMagicWasteland: boolean = false
  ): BiomeType {
    // Special cases first
    if (isMagicWasteland) return BiomeType.MagicWasteland;
    if (isVolcanic && elevation > 3000) return BiomeType.Volcano;

    // Water bodies
    if (elevation < -500) return BiomeType.DeepOcean;
    if (elevation < 0) return BiomeType.Ocean;

    // Very high elevation
    if (elevation > 8000) return BiomeType.HighMountain;
    if (elevation > 5000) return BiomeType.Mountain;

    // Frozen
    if (temperature < -20) return BiomeType.IceCap;
    if (temperature < -10) return BiomeType.Tundra;

    // Hot and dry
    if (temperature > 30 && rainfall < 20) return BiomeType.Desert;

    // Hot and wet
    if (temperature > 25 && rainfall > 200) return BiomeType.Jungle;

    // Cold forest
    if (temperature < 5 && temperature >= -10 && rainfall > 40) return BiomeType.Taiga;

    // Wetlands
    if (elevation < 100 && rainfall > 150 && temperature > 5) return BiomeType.Swamp;

    // Warm savanna
    if (temperature > 20 && rainfall >= 20 && rainfall <= 80) return BiomeType.Savanna;

    // Dense forest
    if (rainfall > 150 && temperature > 10) return BiomeType.DenseForest;

    // Forest
    if (rainfall > 80 && temperature > 5) return BiomeType.Forest;

    // Coast (low elevation near sea level)
    if (elevation < 50) return BiomeType.Coast;

    // Dry regions
    if (rainfall < 20 && temperature > 10) return BiomeType.Desert;

    // Default
    if (rainfall > 40) return BiomeType.Plains;

    // Very dry but cold
    if (temperature < 5) return BiomeType.Tundra;

    return BiomeType.Plains;
  }
}
