import { describe, it, expect } from 'vitest';
import {
  generateCoatOfArms,
  evolveCoatOfArms,
  renderLargeCoatOfArms,
  renderSmallCoatOfArms,
  renderInlineCoatOfArms,
  renderCoatOfArms,
  describeCoatOfArms,
  getShieldShape,
  TINCTURES,
  ALL_CHARGES,
  ANIMAL_CHARGES,
  WEAPON_CHARGES,
  NATURE_CHARGES,
  RELIGIOUS_CHARGES,
} from './heraldry.js';
import type {
  FactionProperties,
  CoatOfArms,
  ShieldShape,
  DisplaySize,
  HeraldryEvent,
} from './heraldry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProps(overrides?: Partial<FactionProperties>): FactionProperties {
  return {
    name: 'Iron Legion',
    culture: 'nordic',
    color: '#e63946',
    militaryStrength: 70,
    economicWealth: 40,
    culturalInfluence: 30,
    tendencies: ['militaristic', 'expansionist'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Data integrity
// ---------------------------------------------------------------------------

describe('Heraldry data', () => {
  it('all tinctures have name, hex, and fill', () => {
    for (const t of TINCTURES) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(t.fill.length).toBe(1);
    }
  });

  it('all charges have name and symbols', () => {
    for (const c of ALL_CHARGES) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.symbolSmall.length).toBeGreaterThan(0);
      expect(c.symbolLarge.length).toBeGreaterThan(0);
      expect(c.category).toMatch(/^(animal|weapon|nature|religious)$/);
    }
  });

  it('charge pools are non-empty', () => {
    expect(ANIMAL_CHARGES.length).toBeGreaterThan(0);
    expect(WEAPON_CHARGES.length).toBeGreaterThan(0);
    expect(NATURE_CHARGES.length).toBeGreaterThan(0);
    expect(RELIGIOUS_CHARGES.length).toBeGreaterThan(0);
  });

  it('ALL_CHARGES is the union of sub-pools', () => {
    const expected = ANIMAL_CHARGES.length + WEAPON_CHARGES.length
      + NATURE_CHARGES.length + RELIGIOUS_CHARGES.length;
    expect(ALL_CHARGES.length).toBe(expected);
  });

  it('tincture fills are unique', () => {
    const fills = TINCTURES.map(t => t.fill);
    expect(new Set(fills).size).toBe(fills.length);
  });
});

// ---------------------------------------------------------------------------
// Shield shape mapping
// ---------------------------------------------------------------------------

describe('getShieldShape', () => {
  it('maps nordic to knightly', () => {
    expect(getShieldShape('nordic')).toBe('knightly');
  });

  it('maps dwarven to knightly', () => {
    expect(getShieldShape('dwarven')).toBe('knightly');
  });

  it('maps elvish to round', () => {
    expect(getShieldShape('elvish')).toBe('round');
  });

  it('maps desert to round', () => {
    expect(getShieldShape('desert')).toBe('round');
  });

  it('maps eastern to round', () => {
    expect(getShieldShape('eastern')).toBe('round');
  });

  it('maps fey to round', () => {
    expect(getShieldShape('fey')).toBe('round');
  });

  it('maps infernal to totem', () => {
    expect(getShieldShape('infernal')).toBe('totem');
  });

  it('defaults unknown culture to knightly', () => {
    expect(getShieldShape('unknown_culture')).toBe('knightly');
  });
});

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

describe('generateCoatOfArms', () => {
  it('returns a complete CoatOfArms', () => {
    const arms = generateCoatOfArms(makeProps());
    expect(arms.shield).toBeDefined();
    expect(arms.division).toBeDefined();
    expect(arms.primary).toBeDefined();
    expect(arms.secondary).toBeDefined();
    expect(arms.charge).toBeDefined();
    expect(arms.motto.length).toBeGreaterThan(0);
    expect(arms.history.length).toBe(1);
    expect(arms.history[0]!.type).toBe('creation');
  });

  it('is deterministic for the same inputs', () => {
    const props = makeProps();
    const a = generateCoatOfArms(props);
    const b = generateCoatOfArms(props);
    expect(a.shield).toBe(b.shield);
    expect(a.division).toBe(b.division);
    expect(a.primary.name).toBe(b.primary.name);
    expect(a.secondary.name).toBe(b.secondary.name);
    expect(a.charge.name).toBe(b.charge.name);
    expect(a.motto).toBe(b.motto);
  });

  it('varies by faction name', () => {
    const a = generateCoatOfArms(makeProps({ name: 'Iron Legion' }));
    const b = generateCoatOfArms(makeProps({ name: 'Silver Dawn' }));
    // At least one property should differ
    const same = a.division === b.division
      && a.primary.name === b.primary.name
      && a.charge.name === b.charge.name
      && a.motto === b.motto;
    expect(same).toBe(false);
  });

  it('varies by culture', () => {
    const a = generateCoatOfArms(makeProps({ culture: 'nordic' }));
    const b = generateCoatOfArms(makeProps({ culture: 'elvish' }));
    // Shield shape must differ
    expect(a.shield).not.toBe(b.shield);
  });

  it('militaristic tendencies favor weapon/red charges', () => {
    const arms = generateCoatOfArms(makeProps({
      tendencies: ['militaristic', 'expansionist'],
      militaryStrength: 90,
    }));
    // Charge should be weapon category for strongly military factions
    expect(arms.charge.category).toBe('weapon');
  });

  it('religious tendencies favor religious charges', () => {
    const arms = generateCoatOfArms(makeProps({
      name: 'Holy Order',
      tendencies: ['religious', 'religious'],
      militaryStrength: 20,
    }));
    expect(arms.charge.category).toBe('religious');
  });

  it('primary and secondary tinctures are different', () => {
    const arms = generateCoatOfArms(makeProps());
    expect(arms.primary.name).not.toBe(arms.secondary.name);
  });

  it('shield shape follows culture for each culture type', () => {
    const cultures: Array<[string, ShieldShape]> = [
      ['nordic', 'knightly'],
      ['dwarven', 'knightly'],
      ['elvish', 'round'],
      ['desert', 'round'],
      ['eastern', 'round'],
      ['fey', 'round'],
      ['infernal', 'totem'],
    ];
    for (const [culture, expected] of cultures) {
      const arms = generateCoatOfArms(makeProps({ culture }));
      expect(arms.shield).toBe(expected);
    }
  });

  it('does not produce undefined properties', () => {
    // Test with multiple different inputs to catch edge cases
    const cultures = ['nordic', 'elvish', 'dwarven', 'desert', 'eastern', 'fey', 'infernal'];
    for (const culture of cultures) {
      const arms = generateCoatOfArms(makeProps({ culture, name: `Faction_${culture}` }));
      expect(arms.primary.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(arms.secondary.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(arms.charge.symbolSmall.length).toBeGreaterThan(0);
      expect(arms.motto.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Evolution
// ---------------------------------------------------------------------------

describe('evolveCoatOfArms', () => {
  const baseArms = generateCoatOfArms(makeProps());

  it('revolution produces completely different arms', () => {
    const event: HeraldryEvent = {
      year: 100,
      type: 'revolution',
      description: 'The old order falls',
    };
    const evolved = evolveCoatOfArms(baseArms, event, 'rev-seed');
    // Tinctures swap
    expect(evolved.primary.name).toBe(baseArms.secondary.name);
    expect(evolved.secondary.name).toBe(baseArms.primary.name);
    // History grows
    expect(evolved.history.length).toBe(baseArms.history.length + 1);
    expect(evolved.history[evolved.history.length - 1]!.type).toBe('revolution');
    // Motto changes
    expect(evolved.motto).not.toBe(baseArms.motto);
  });

  it('dynasty change adds secondary charge', () => {
    const event: HeraldryEvent = {
      year: 200,
      type: 'dynasty_change',
      description: 'New dynasty rises',
    };
    const evolved = evolveCoatOfArms(baseArms, event, 'dyn-seed');
    expect(evolved.secondaryCharge).toBeDefined();
    expect(evolved.history.length).toBe(baseArms.history.length + 1);
  });

  it('expansion sets quarterly division', () => {
    const event: HeraldryEvent = {
      year: 300,
      type: 'expansion',
      description: 'New territory annexed',
    };
    const evolved = evolveCoatOfArms(baseArms, event, 'exp-seed');
    expect(evolved.division).toBe('quarterly');
    expect(evolved.secondaryCharge).toBeDefined();
  });

  it('union sets quarterly division with secondary charge', () => {
    const event: HeraldryEvent = {
      year: 400,
      type: 'union',
      description: 'Two nations merge',
    };
    const evolved = evolveCoatOfArms(baseArms, event, 'union-seed');
    expect(evolved.division).toBe('quarterly');
    expect(evolved.secondaryCharge).toBeDefined();
  });

  it('creation event just appends to history', () => {
    const event: HeraldryEvent = {
      year: 0,
      type: 'creation',
      description: 'Founded',
    };
    const evolved = evolveCoatOfArms(baseArms, event, 'create-seed');
    expect(evolved.charge.name).toBe(baseArms.charge.name);
    expect(evolved.division).toBe(baseArms.division);
    expect(evolved.history.length).toBe(baseArms.history.length + 1);
  });

  it('multiple evolutions accumulate history', () => {
    let arms = baseArms;
    const events: HeraldryEvent[] = [
      { year: 100, type: 'dynasty_change', description: 'Dynasty 1' },
      { year: 200, type: 'expansion', description: 'Expansion 1' },
      { year: 300, type: 'revolution', description: 'Revolution 1' },
    ];
    for (let i = 0; i < events.length; i++) {
      arms = evolveCoatOfArms(arms, events[i]!, `seed-${i}`);
    }
    expect(arms.history.length).toBe(baseArms.history.length + 3);
  });

  it('evolution is deterministic with same seed', () => {
    const event: HeraldryEvent = {
      year: 150,
      type: 'revolution',
      description: 'Revolt',
    };
    const a = evolveCoatOfArms(baseArms, event, 'same-seed');
    const b = evolveCoatOfArms(baseArms, event, 'same-seed');
    expect(a.charge.name).toBe(b.charge.name);
    expect(a.division).toBe(b.division);
    expect(a.motto).toBe(b.motto);
  });

  it('evolution varies with different seeds', () => {
    const event: HeraldryEvent = {
      year: 150,
      type: 'revolution',
      description: 'Revolt',
    };
    const a = evolveCoatOfArms(baseArms, event, 'seed-alpha');
    const b = evolveCoatOfArms(baseArms, event, 'seed-beta');
    // At least one property should differ (charge or motto)
    const same = a.charge.name === b.charge.name && a.motto === b.motto;
    expect(same).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rendering — large
// ---------------------------------------------------------------------------

describe('renderLargeCoatOfArms', () => {
  it('renders knightly shield', () => {
    const arms = generateCoatOfArms(makeProps({ culture: 'nordic' }));
    const lines = renderLargeCoatOfArms(arms);
    // Knightly: 6 shield lines + 1 motto
    expect(lines.length).toBe(7);
    // First line contains box-drawing
    expect(lines[0]).toContain('\u2554'); // ╔
  });

  it('renders round shield', () => {
    const arms = generateCoatOfArms(makeProps({ culture: 'elvish' }));
    const lines = renderLargeCoatOfArms(arms);
    // Round: 5 shield lines + 1 motto
    expect(lines.length).toBe(6);
    expect(lines[0]).toContain('\u256D'); // ╭
  });

  it('renders totem shield', () => {
    const arms = generateCoatOfArms(makeProps({ culture: 'infernal' }));
    const lines = renderLargeCoatOfArms(arms);
    // Totem: 6 shield lines + 1 motto
    expect(lines.length).toBe(7);
    expect(lines[0]).toContain('\u2554'); // ╔
  });

  it('includes charge symbol in body lines', () => {
    const arms = generateCoatOfArms(makeProps());
    const lines = renderLargeCoatOfArms(arms);
    const bodyLines = lines.slice(1, -1);
    const hasCharge = bodyLines.some(l => l.includes(arms.charge.symbolSmall));
    expect(hasCharge).toBe(true);
  });

  it('includes fill characters in body lines', () => {
    const arms = generateCoatOfArms(makeProps());
    const lines = renderLargeCoatOfArms(arms);
    const bodyLines = lines.slice(1, -1);
    const hasFill = bodyLines.some(
      l => l.includes(arms.primary.fill) || l.includes(arms.secondary.fill)
    );
    expect(hasFill).toBe(true);
  });

  it('last line is the motto', () => {
    const arms = generateCoatOfArms(makeProps());
    const lines = renderLargeCoatOfArms(arms);
    const mottoLine = lines[lines.length - 1]!.trim();
    expect(mottoLine).toBe(arms.motto);
  });

  it('shield lines have consistent width (motto may extend)', () => {
    const arms = generateCoatOfArms(makeProps({ culture: 'nordic' }));
    const lines = renderLargeCoatOfArms(arms);
    // Shield lines (all except last motto line) should be consistent
    const shieldLines = lines.slice(0, -1);
    const maxShieldLen = Math.max(...shieldLines.map(l => l.length));
    for (const line of shieldLines) {
      expect(line.length).toBeGreaterThanOrEqual(maxShieldLen - 2);
    }
    // Motto line exists
    expect(lines[lines.length - 1]!.trim().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Rendering — small
// ---------------------------------------------------------------------------

describe('renderSmallCoatOfArms', () => {
  it('renders 3 lines for knightly', () => {
    const arms = generateCoatOfArms(makeProps({ culture: 'nordic' }));
    const lines = renderSmallCoatOfArms(arms);
    expect(lines.length).toBe(3);
  });

  it('renders 3 lines for round', () => {
    const arms = generateCoatOfArms(makeProps({ culture: 'elvish' }));
    const lines = renderSmallCoatOfArms(arms);
    expect(lines.length).toBe(3);
  });

  it('renders 3 lines for totem', () => {
    const arms = generateCoatOfArms(makeProps({ culture: 'infernal' }));
    const lines = renderSmallCoatOfArms(arms);
    expect(lines.length).toBe(3);
  });

  it('includes charge in small render', () => {
    const arms = generateCoatOfArms(makeProps());
    const lines = renderSmallCoatOfArms(arms);
    const joined = lines.join('');
    expect(joined).toContain(arms.charge.symbolSmall);
  });

  it('includes primary fill in small render', () => {
    const arms = generateCoatOfArms(makeProps());
    const lines = renderSmallCoatOfArms(arms);
    const joined = lines.join('');
    expect(joined).toContain(arms.primary.fill);
  });
});

// ---------------------------------------------------------------------------
// Rendering — inline
// ---------------------------------------------------------------------------

describe('renderInlineCoatOfArms', () => {
  it('returns bracketed string', () => {
    const arms = generateCoatOfArms(makeProps());
    const result = renderInlineCoatOfArms(arms);
    expect(result.startsWith('[')).toBe(true);
    expect(result.endsWith(']')).toBe(true);
  });

  it('contains charge and fill', () => {
    const arms = generateCoatOfArms(makeProps());
    const result = renderInlineCoatOfArms(arms);
    expect(result).toContain(arms.charge.symbolSmall);
    expect(result).toContain(arms.primary.fill);
  });

  it('is short enough for inline use', () => {
    const arms = generateCoatOfArms(makeProps());
    const result = renderInlineCoatOfArms(arms);
    expect(result.length).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// Unified render function
// ---------------------------------------------------------------------------

describe('renderCoatOfArms', () => {
  it('dispatches to large renderer', () => {
    const arms = generateCoatOfArms(makeProps());
    const lines = renderCoatOfArms(arms, 'large');
    expect(lines.length).toBeGreaterThan(3);
  });

  it('dispatches to small renderer', () => {
    const arms = generateCoatOfArms(makeProps());
    const lines = renderCoatOfArms(arms, 'small');
    expect(lines.length).toBe(3);
  });

  it('dispatches to inline renderer', () => {
    const arms = generateCoatOfArms(makeProps());
    const lines = renderCoatOfArms(arms, 'inline');
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('[');
  });

  it('all three sizes work for every culture', () => {
    const cultures = ['nordic', 'elvish', 'dwarven', 'desert', 'eastern', 'fey', 'infernal'];
    const sizes: DisplaySize[] = ['large', 'small', 'inline'];
    for (const culture of cultures) {
      const arms = generateCoatOfArms(makeProps({ culture, name: `Faction_${culture}` }));
      for (const size of sizes) {
        const lines = renderCoatOfArms(arms, size);
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) {
          expect(typeof line).toBe('string');
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Blazon description
// ---------------------------------------------------------------------------

describe('describeCoatOfArms', () => {
  it('includes primary tincture name', () => {
    const arms = generateCoatOfArms(makeProps());
    const desc = describeCoatOfArms(arms);
    expect(desc).toContain(arms.primary.name);
  });

  it('includes charge name', () => {
    const arms = generateCoatOfArms(makeProps());
    const desc = describeCoatOfArms(arms);
    expect(desc.toLowerCase()).toContain(arms.charge.name.toLowerCase());
  });

  it('includes motto in quotes', () => {
    const arms = generateCoatOfArms(makeProps());
    const desc = describeCoatOfArms(arms);
    expect(desc).toContain(`"${arms.motto}"`);
  });

  it('for no division, omits division text', () => {
    const arms: CoatOfArms = {
      ...generateCoatOfArms(makeProps()),
      division: 'none',
    };
    const desc = describeCoatOfArms(arms);
    expect(desc).not.toContain('Per');
    expect(desc).not.toContain('Quarterly');
  });

  it('for per_pale, includes division text', () => {
    const arms: CoatOfArms = {
      ...generateCoatOfArms(makeProps()),
      division: 'per_pale',
    };
    const desc = describeCoatOfArms(arms);
    expect(desc).toContain('Per pale');
  });

  it('includes secondary charge when present', () => {
    const arms = evolveCoatOfArms(
      generateCoatOfArms(makeProps()),
      { year: 100, type: 'dynasty_change', description: 'New dynasty' },
      'test-seed',
    );
    const desc = describeCoatOfArms(arms);
    if (arms.secondaryCharge !== undefined) {
      expect(desc.toLowerCase()).toContain(arms.secondaryCharge.name.toLowerCase());
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases / regression
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles empty tendencies', () => {
    const arms = generateCoatOfArms(makeProps({ tendencies: [] }));
    expect(arms.charge).toBeDefined();
    expect(arms.primary).toBeDefined();
  });

  it('handles unknown biome', () => {
    const arms = generateCoatOfArms(makeProps({ biome: 'UnknownBiome' }));
    expect(arms.primary).toBeDefined();
  });

  it('handles very long faction name', () => {
    const longName = 'A'.repeat(200);
    const arms = generateCoatOfArms(makeProps({ name: longName }));
    expect(arms.motto.length).toBeGreaterThan(0);
    // Motto in large render should be truncated to shield width
    const lines = renderLargeCoatOfArms(arms);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('handles biome=undefined', () => {
    const arms = generateCoatOfArms(makeProps({ biome: undefined }));
    expect(arms.primary).toBeDefined();
  });

  it('field grid produces valid indices for all divisions', () => {
    // This indirectly tests buildFieldGrid through rendering
    const divisions = ['none', 'per_pale', 'per_fess', 'quarterly', 'per_bend', 'per_chevron'] as const;
    for (const div of divisions) {
      const arms: CoatOfArms = {
        ...generateCoatOfArms(makeProps()),
        division: div,
      };
      const lines = renderLargeCoatOfArms(arms);
      expect(lines.length).toBeGreaterThan(0);
      // No undefined or NaN in output
      for (const line of lines) {
        expect(line).not.toContain('undefined');
        expect(line).not.toContain('NaN');
      }
    }
  });
});
