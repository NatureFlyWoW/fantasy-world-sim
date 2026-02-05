import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../rng.js';
import { PantheonGenerator, Domain } from './pantheon.js';
import { MagicSystemGenerator, MagicSchool, PowerSource } from './magic-system.js';
import { PlanarGenerator, PlaneType } from './planar.js';
import type { MagicPrevalence } from '../config/types.js';

describe('PantheonGenerator', () => {
  const generator = new PantheonGenerator();

  it('atheistic complexity produces empty pantheon', () => {
    const rng = new SeededRNG(42);
    const pantheon = generator.generate('atheistic', rng);
    expect(pantheon.gods).toHaveLength(0);
    expect(pantheon.relationships).toHaveLength(0);
    expect(pantheon.isInterventionist).toBe(false);
  });

  it('deistic complexity produces 3-5 gods', () => {
    const rng = new SeededRNG(123);
    const pantheon = generator.generate('deistic', rng);
    expect(pantheon.gods.length).toBeGreaterThanOrEqual(3);
    expect(pantheon.gods.length).toBeLessThanOrEqual(5);
    expect(pantheon.isInterventionist).toBe(false);
  });

  it('theistic complexity produces 5-10 gods', () => {
    const rng = new SeededRNG(456);
    const pantheon = generator.generate('theistic', rng);
    expect(pantheon.gods.length).toBeGreaterThanOrEqual(5);
    expect(pantheon.gods.length).toBeLessThanOrEqual(10);
  });

  it('interventionist complexity produces 8-15 gods', () => {
    const rng = new SeededRNG(789);
    const pantheon = generator.generate('interventionist', rng);
    expect(pantheon.gods.length).toBeGreaterThanOrEqual(8);
    expect(pantheon.gods.length).toBeLessThanOrEqual(15);
    expect(pantheon.isInterventionist).toBe(true);
  });

  it('all gods in interventionist pantheon are interventionist', () => {
    const rng = new SeededRNG(101);
    const pantheon = generator.generate('interventionist', rng);
    for (const god of pantheon.gods) {
      expect(god.isInterventionist).toBe(true);
    }
  });

  it('gods have valid domains', () => {
    const rng = new SeededRNG(200);
    const pantheon = generator.generate('theistic', rng);
    const allDomains = Object.values(Domain);
    for (const god of pantheon.gods) {
      expect(allDomains).toContain(god.primaryDomain);
      for (const secondary of god.secondaryDomains) {
        expect(allDomains).toContain(secondary);
        expect(secondary).not.toBe(god.primaryDomain);
      }
    }
  });

  it('gods have valid power levels (1-10)', () => {
    const rng = new SeededRNG(300);
    const pantheon = generator.generate('interventionist', rng);
    for (const god of pantheon.gods) {
      expect(god.powerLevel).toBeGreaterThanOrEqual(1);
      expect(god.powerLevel).toBeLessThanOrEqual(10);
    }
  });

  it('gods have unique names', () => {
    const rng = new SeededRNG(400);
    const pantheon = generator.generate('interventionist', rng);
    const names = pantheon.gods.map(g => g.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('relationships include at least 2 rivalries when enough gods', () => {
    const rng = new SeededRNG(500);
    const pantheon = generator.generate('theistic', rng);
    const rivalries = pantheon.relationships.filter(r => r.type === 'rival');
    // With 5+ gods, we expect at least 2 rivalry pairs (4 directed edges)
    expect(rivalries.length).toBeGreaterThanOrEqual(2);
  });

  it('relationships include at least 1 alliance', () => {
    const rng = new SeededRNG(600);
    const pantheon = generator.generate('theistic', rng);
    const alliances = pantheon.relationships.filter(r => r.type === 'ally');
    expect(alliances.length).toBeGreaterThanOrEqual(1);
  });

  it('relationships include parent-child families when enough gods', () => {
    const rng = new SeededRNG(700);
    const pantheon = generator.generate('interventionist', rng);
    const parents = pantheon.relationships.filter(r => r.type === 'parent');
    const children = pantheon.relationships.filter(r => r.type === 'child');
    expect(parents.length).toBeGreaterThanOrEqual(1);
    expect(children.length).toBeGreaterThanOrEqual(1);
  });

  it('relationship indices are valid', () => {
    const rng = new SeededRNG(800);
    const pantheon = generator.generate('interventionist', rng);
    for (const rel of pantheon.relationships) {
      expect(rel.fromIndex).toBeGreaterThanOrEqual(0);
      expect(rel.fromIndex).toBeLessThan(pantheon.gods.length);
      expect(rel.toIndex).toBeGreaterThanOrEqual(0);
      expect(rel.toIndex).toBeLessThan(pantheon.gods.length);
      expect(rel.strength).toBeGreaterThan(0);
      expect(rel.strength).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic with same seed', () => {
    const p1 = generator.generate('theistic', new SeededRNG(999));
    const p2 = generator.generate('theistic', new SeededRNG(999));
    expect(p1.gods.map(g => g.name)).toEqual(p2.gods.map(g => g.name));
    expect(p1.gods.length).toBe(p2.gods.length);
  });

  it('different seeds produce different results', () => {
    const p1 = generator.generate('theistic', new SeededRNG(1));
    const p2 = generator.generate('theistic', new SeededRNG(2));
    // With high probability, names should differ
    const names1 = p1.gods.map(g => g.name).join(',');
    const names2 = p2.gods.map(g => g.name).join(',');
    expect(names1).not.toBe(names2);
  });

  it('gods have valid doctrine derived from personality', () => {
    const rng = new SeededRNG(1100);
    const pantheon = generator.generate('theistic', rng);
    const validDoctrines = ['compassion', 'obedience', 'revelation', 'sacrifice', 'freedom'];
    for (const god of pantheon.gods) {
      expect(validDoctrines).toContain(god.doctrine);
      expect(god.personality.length).toBeGreaterThanOrEqual(1);
      expect(god.personality.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('MagicSystemGenerator', () => {
  const generator = new MagicSystemGenerator();

  it('mundane prevalence produces empty magic system', () => {
    const rng = new SeededRNG(42);
    const rules = generator.generate('mundane', rng);
    expect(rules.schools).toHaveLength(0);
    expect(rules.powerSources).toHaveLength(0);
    expect(rules.strengthMultiplier).toBe(0);
  });

  it('low prevalence produces 1-2 schools', () => {
    const rng = new SeededRNG(123);
    const rules = generator.generate('low', rng);
    expect(rules.schools.length).toBeGreaterThanOrEqual(1);
    expect(rules.schools.length).toBeLessThanOrEqual(2);
  });

  it('moderate prevalence produces 3-5 schools', () => {
    const rng = new SeededRNG(456);
    const rules = generator.generate('moderate', rng);
    expect(rules.schools.length).toBeGreaterThanOrEqual(3);
    expect(rules.schools.length).toBeLessThanOrEqual(5);
  });

  it('high prevalence produces 5-8 schools', () => {
    const rng = new SeededRNG(789);
    const rules = generator.generate('high', rng);
    expect(rules.schools.length).toBeGreaterThanOrEqual(5);
    expect(rules.schools.length).toBeLessThanOrEqual(8);
  });

  it('ubiquitous prevalence produces all 11 schools', () => {
    const rng = new SeededRNG(101);
    const rules = generator.generate('ubiquitous', rng);
    expect(rules.schools.length).toBe(11);
  });

  it('all schools are valid MagicSchool values', () => {
    const rng = new SeededRNG(200);
    const rules = generator.generate('high', rng);
    const allSchools = Object.values(MagicSchool);
    for (const school of rules.schools) {
      expect(allSchools).toContain(school);
    }
  });

  it('power sources scale with prevalence', () => {
    const rng1 = new SeededRNG(300);
    const low = generator.generate('low', rng1);
    const rng2 = new SeededRNG(300);
    const ubiq = generator.generate('ubiquitous', rng2);
    expect(ubiq.powerSources.length).toBeGreaterThan(low.powerSources.length);
  });

  it('ubiquitous produces all 8 power sources', () => {
    const rng = new SeededRNG(400);
    const rules = generator.generate('ubiquitous', rng);
    expect(rules.powerSources.length).toBe(8);
  });

  it('all power sources are valid PowerSource values', () => {
    const rng = new SeededRNG(500);
    const rules = generator.generate('high', rng);
    const allSources = Object.values(PowerSource);
    for (const source of rules.powerSources) {
      expect(allSources).toContain(source);
    }
  });

  it('strength multiplier scales with prevalence', () => {
    const lowRules = generator.generate('low', new SeededRNG(600));
    const highRules = generator.generate('ubiquitous', new SeededRNG(600));
    expect(highRules.strengthMultiplier).toBeGreaterThan(lowRules.strengthMultiplier);
  });

  it('limitations have valid severity (2-8)', () => {
    const rng = new SeededRNG(700);
    const rules = generator.generate('moderate', rng);
    for (const limit of rules.limitations) {
      expect(limit.severity).toBeGreaterThanOrEqual(2);
      expect(limit.severity).toBeLessThanOrEqual(8);
      expect(limit.name.length).toBeGreaterThan(0);
      expect(limit.description.length).toBeGreaterThan(0);
    }
  });

  it('interactions have affinity in valid range', () => {
    const rng = new SeededRNG(800);
    const rules = generator.generate('high', rng);
    for (const interaction of rules.interactions) {
      expect(interaction.affinity).toBeGreaterThanOrEqual(-1);
      expect(interaction.affinity).toBeLessThanOrEqual(1);
      expect(interaction.schoolA).not.toBe(interaction.schoolB);
    }
  });

  it('is deterministic with same seed', () => {
    const r1 = generator.generate('high', new SeededRNG(999));
    const r2 = generator.generate('high', new SeededRNG(999));
    expect(r1.schools).toEqual(r2.schools);
    expect(r1.powerSources).toEqual(r2.powerSources);
    expect(r1.strengthMultiplier).toBe(r2.strengthMultiplier);
  });

  it('has at least 1 limitation for non-mundane', () => {
    const prevalences: MagicPrevalence[] = ['low', 'moderate', 'high', 'ubiquitous'];
    for (const prev of prevalences) {
      const rng = new SeededRNG(1000);
      const rules = generator.generate(prev, rng);
      expect(rules.limitations.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('PlanarGenerator', () => {
  const generator = new PlanarGenerator();

  it('mundane prevalence produces only Material plane', () => {
    const rng = new SeededRNG(42);
    const structure = generator.generate('mundane', rng);
    expect(structure.planes).toHaveLength(1);
    expect(structure.planes[0]!.type).toBe(PlaneType.Material);
    expect(structure.connections).toHaveLength(0);
  });

  it('always includes Material plane', () => {
    const prevalences: MagicPrevalence[] = ['mundane', 'low', 'moderate', 'high', 'ubiquitous'];
    for (const prev of prevalences) {
      const rng = new SeededRNG(100);
      const structure = generator.generate(prev, rng);
      const materialPlanes = structure.planes.filter(p => p.type === PlaneType.Material);
      expect(materialPlanes).toHaveLength(1);
    }
  });

  it('low prevalence produces 2-3 planes total', () => {
    const rng = new SeededRNG(123);
    const structure = generator.generate('low', rng);
    // Material + 1-2 optional
    expect(structure.planes.length).toBeGreaterThanOrEqual(2);
    expect(structure.planes.length).toBeLessThanOrEqual(3);
  });

  it('moderate prevalence produces 3-5 planes total', () => {
    const rng = new SeededRNG(456);
    const structure = generator.generate('moderate', rng);
    expect(structure.planes.length).toBeGreaterThanOrEqual(3);
    expect(structure.planes.length).toBeLessThanOrEqual(5);
  });

  it('high prevalence produces 4-6 planes total', () => {
    const rng = new SeededRNG(789);
    const structure = generator.generate('high', rng);
    expect(structure.planes.length).toBeGreaterThanOrEqual(4);
    expect(structure.planes.length).toBeLessThanOrEqual(6);
  });

  it('ubiquitous prevalence produces all 7 planes', () => {
    const rng = new SeededRNG(101);
    const structure = generator.generate('ubiquitous', rng);
    expect(structure.planes).toHaveLength(7);
  });

  it('plane types are valid', () => {
    const rng = new SeededRNG(200);
    const structure = generator.generate('high', rng);
    const allTypes = Object.values(PlaneType);
    for (const plane of structure.planes) {
      expect(allTypes).toContain(plane.type);
    }
  });

  it('planes have no duplicate types', () => {
    const rng = new SeededRNG(300);
    const structure = generator.generate('ubiquitous', rng);
    const types = structure.planes.map(p => p.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('Material plane has permeability 1', () => {
    const rng = new SeededRNG(400);
    const structure = generator.generate('high', rng);
    const material = structure.planes.find(p => p.type === PlaneType.Material);
    expect(material).toBeDefined();
    expect(material!.permeability).toBe(1);
  });

  it('non-Material planes have permeability < 1', () => {
    const rng = new SeededRNG(500);
    const structure = generator.generate('ubiquitous', rng);
    for (const plane of structure.planes) {
      if (plane.type !== PlaneType.Material) {
        expect(plane.permeability).toBeLessThan(1);
        expect(plane.permeability).toBeGreaterThan(0);
      }
    }
  });

  it('connections include Material to each non-Material plane', () => {
    const rng = new SeededRNG(600);
    const structure = generator.generate('ubiquitous', rng);
    const nonMaterial = structure.planes.filter(p => p.type !== PlaneType.Material);
    for (const plane of nonMaterial) {
      const conn = structure.connections.find(
        c => c.from === PlaneType.Material && c.to === plane.type
      );
      expect(conn).toBeDefined();
    }
  });

  it('connection stability is in valid range (0-1)', () => {
    const rng = new SeededRNG(700);
    const structure = generator.generate('high', rng);
    for (const conn of structure.connections) {
      expect(conn.stability).toBeGreaterThan(0);
      expect(conn.stability).toBeLessThanOrEqual(1);
    }
  });

  it('hostility is in valid range (0-10)', () => {
    const rng = new SeededRNG(800);
    const structure = generator.generate('ubiquitous', rng);
    for (const plane of structure.planes) {
      expect(plane.hostility).toBeGreaterThanOrEqual(0);
      expect(plane.hostility).toBeLessThanOrEqual(10);
    }
  });

  it('is deterministic with same seed', () => {
    const s1 = generator.generate('high', new SeededRNG(999));
    const s2 = generator.generate('high', new SeededRNG(999));
    expect(s1.planes.map(p => p.type)).toEqual(s2.planes.map(p => p.type));
    expect(s1.planes.length).toBe(s2.planes.length);
  });

  it('plane count scales with prevalence', () => {
    const low = generator.generate('low', new SeededRNG(1000));
    const ubiq = generator.generate('ubiquitous', new SeededRNG(1000));
    expect(ubiq.planes.length).toBeGreaterThan(low.planes.length);
  });
});
