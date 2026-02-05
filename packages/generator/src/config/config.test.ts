import { describe, it, expect } from 'vitest';
import type { WorldConfig } from './types.js';
import {
  getPresetNames,
  getPreset,
  configFromPreset,
} from './presets.js';
import {
  resolveGridSize,
  resolveCivCount,
  resolveHistoricalYears,
  resolveRaceCount,
  validateConfig,
} from './resolver.js';

describe('config/presets', () => {
  it('should list all preset names', () => {
    const names = getPresetNames();
    expect(names).toContain('standard_fantasy');
    expect(names).toContain('low_magic');
    expect(names).toContain('high_chaos');
    expect(names).toContain('classical_era');
    expect(names).toContain('kitchen_sink');
    expect(names).toHaveLength(5);
  });

  it('should return a preset by name', () => {
    const preset = getPreset('standard_fantasy');
    expect(preset.worldSize).toBe('medium');
    expect(preset.magicPrevalence).toBe('moderate');
    expect(preset.technologyEra).toBe('iron_age');
  });

  it('should create a full config from preset and seed', () => {
    const config = configFromPreset('standard_fantasy', 42);
    expect(config.seed).toBe(42);
    expect(config.worldSize).toBe('medium');
    expect(config.magicPrevalence).toBe('moderate');
  });

  it('low_magic preset should have low magic and deep history', () => {
    const preset = getPreset('low_magic');
    expect(preset.magicPrevalence).toBe('low');
    expect(preset.historicalDepth).toBe('deep');
    expect(preset.raceDiversity).toBe('homogeneous');
  });

  it('high_chaos preset should have high magic and dangerous world', () => {
    const preset = getPreset('high_chaos');
    expect(preset.magicPrevalence).toBe('high');
    expect(preset.dangerLevel).toBe('dangerous');
    expect(preset.raceDiversity).toBe('diverse');
  });

  it('kitchen_sink preset should max out everything', () => {
    const preset = getPreset('kitchen_sink');
    expect(preset.magicPrevalence).toBe('ubiquitous');
    expect(preset.dangerLevel).toBe('apocalyptic');
    expect(preset.raceDiversity).toBe('myriad');
    expect(preset.historicalDepth).toBe('ancient');
    expect(preset.technologyEra).toBe('renaissance');
  });

  it('each preset should produce valid configs', () => {
    for (const name of getPresetNames()) {
      const config = configFromPreset(name, 1);
      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });
});

describe('config/resolver', () => {
  describe('resolveGridSize', () => {
    it('should resolve small to 200×200', () => {
      expect(resolveGridSize('small')).toEqual({ width: 200, height: 200 });
    });

    it('should resolve medium to 400×400', () => {
      expect(resolveGridSize('medium')).toEqual({ width: 400, height: 400 });
    });

    it('should resolve large to 800×800', () => {
      expect(resolveGridSize('large')).toEqual({ width: 800, height: 800 });
    });

    it('should resolve epic to 1600×1600', () => {
      expect(resolveGridSize('epic')).toEqual({ width: 1600, height: 1600 });
    });
  });

  describe('resolveCivCount', () => {
    it('should resolve small/normal to 2-4', () => {
      expect(resolveCivCount('small', 'normal')).toEqual({ min: 2, max: 4 });
    });

    it('should resolve medium/normal to 4-8', () => {
      expect(resolveCivCount('medium', 'normal')).toEqual({ min: 4, max: 8 });
    });

    it('should resolve large/normal to 8-16', () => {
      expect(resolveCivCount('large', 'normal')).toEqual({ min: 8, max: 16 });
    });

    it('should resolve epic/normal to 16-32', () => {
      expect(resolveCivCount('epic', 'normal')).toEqual({ min: 16, max: 32 });
    });

    it('should apply sparse density multiplier (0.5×)', () => {
      const result = resolveCivCount('medium', 'sparse');
      expect(result.min).toBe(2);
      expect(result.max).toBe(4);
    });

    it('should apply dense density multiplier (1.5×)', () => {
      const result = resolveCivCount('medium', 'dense');
      expect(result.min).toBe(6);
      expect(result.max).toBe(12);
    });

    it('should apply crowded density multiplier (2×)', () => {
      const result = resolveCivCount('medium', 'crowded');
      expect(result.min).toBe(8);
      expect(result.max).toBe(16);
    });

    it('should never go below 1', () => {
      const result = resolveCivCount('small', 'sparse');
      expect(result.min).toBeGreaterThanOrEqual(1);
      expect(result.max).toBeGreaterThanOrEqual(1);
    });
  });

  describe('resolveHistoricalYears', () => {
    it('should resolve shallow to 100', () => {
      expect(resolveHistoricalYears('shallow')).toBe(100);
    });

    it('should resolve moderate to 500', () => {
      expect(resolveHistoricalYears('moderate')).toBe(500);
    });

    it('should resolve deep to 2000', () => {
      expect(resolveHistoricalYears('deep')).toBe(2000);
    });

    it('should resolve ancient to 10000', () => {
      expect(resolveHistoricalYears('ancient')).toBe(10000);
    });
  });

  describe('resolveRaceCount', () => {
    it('should resolve homogeneous to 1-2', () => {
      expect(resolveRaceCount('homogeneous')).toEqual({ min: 1, max: 2 });
    });

    it('should resolve standard to 3-5', () => {
      expect(resolveRaceCount('standard')).toEqual({ min: 3, max: 5 });
    });

    it('should resolve diverse to 6-10', () => {
      expect(resolveRaceCount('diverse')).toEqual({ min: 6, max: 10 });
    });

    it('should resolve myriad to 11-20', () => {
      expect(resolveRaceCount('myriad')).toEqual({ min: 11, max: 20 });
    });
  });

  describe('validateConfig', () => {
    const validConfig: WorldConfig = {
      seed: 42,
      worldSize: 'medium',
      magicPrevalence: 'moderate',
      civilizationDensity: 'normal',
      dangerLevel: 'moderate',
      historicalDepth: 'moderate',
      geologicalActivity: 'normal',
      raceDiversity: 'standard',
      pantheonComplexity: 'theistic',
      technologyEra: 'iron_age',
    };

    it('should accept a valid config', () => {
      const result = validateConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-finite seed', () => {
      const result = validateConfig({ ...validConfig, seed: Infinity });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('seed must be a finite number');
    });

    it('should reject NaN seed', () => {
      const result = validateConfig({ ...validConfig, seed: NaN });
      expect(result.valid).toBe(false);
    });

    it('should reject invalid worldSize', () => {
      const result = validateConfig({ ...validConfig, worldSize: 'huge' as WorldConfig['worldSize'] });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('worldSize');
    });

    it('should reject invalid magicPrevalence', () => {
      const result = validateConfig({ ...validConfig, magicPrevalence: 'mega' as WorldConfig['magicPrevalence'] });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('magicPrevalence');
    });

    it('should reject invalid technologyEra', () => {
      const result = validateConfig({ ...validConfig, technologyEra: 'space_age' as WorldConfig['technologyEra'] });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('technologyEra');
    });

    it('should collect multiple errors', () => {
      const badConfig = {
        ...validConfig,
        seed: NaN,
        worldSize: 'bad' as WorldConfig['worldSize'],
        magicPrevalence: 'bad' as WorldConfig['magicPrevalence'],
      };
      const result = validateConfig(badConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('should accept zero as a valid seed', () => {
      const result = validateConfig({ ...validConfig, seed: 0 });
      expect(result.valid).toBe(true);
    });

    it('should accept negative seeds', () => {
      const result = validateConfig({ ...validConfig, seed: -12345 });
      expect(result.valid).toBe(true);
    });
  });
});
