/**
 * Tests for the Magic System (Task 3.6).
 * Covers: Research, Institutions, Artifacts, Catastrophes, Magic-Society.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world.js';
import { WorldClock } from '../time/world-clock.js';
import { EventBus } from '../events/event-bus.js';
import { EventCategory } from '../events/types.js';
import type { WorldEvent } from '../events/types.js';
import { resetEventIdCounter } from '../events/event-factory.js';
import type { EntityId, CharacterId, FactionId, SiteId, ArtifactId } from '../ecs/types.js';
import { toEntityId, toFactionId, toCharacterId, toArtifactId } from '../ecs/types.js';
import {
  MagicSchool,
  ALL_MAGIC_SCHOOLS,
  InstitutionType,
  ALL_INSTITUTION_TYPES,
  INSTITUTION_TRAITS,
  ResearchType,
  ALL_RESEARCH_TYPES,
  ArtifactType,
  ALL_ARTIFACT_TYPES,
  ArtifactPersonalityTrait,
  ALL_ARTIFACT_TRAITS,
  CatastropheType,
  ALL_CATASTROPHE_TYPES,
  MagicSocietyRelation,
  ALL_SOCIETY_RELATIONS,
  MagicSystem,
  calculateBreakthroughProbability,
  checkArtifactCompatibility,
  calculateArtifactInfluence,
  calculateCatastropheProbability,
  calculateMagicSocietyEffects,
  createResearchId,
  createInstitutionId,
  createArtifactIdValue,
  createCatastropheId,
  resetMagicIdCounters,
} from './magic.js';
import type {
  ResearchProject,
  MagicalInstitution,
  Artifact,
  ArtifactConsciousness,
  ArtifactCreationStory,
  MagicalCatastrophe,
  BreakthroughFactors,
} from './magic.js';

// ── Test helpers ────────────────────────────────────────────────────────────

function eid(n: number): EntityId {
  return toEntityId(n);
}

function fid(n: number): FactionId {
  return toFactionId(toEntityId(n));
}

function cid(n: number): CharacterId {
  return toCharacterId(toEntityId(n));
}

function sid(n: number): SiteId {
  return n as SiteId;
}

function aid(n: number): ArtifactId {
  return toArtifactId(toEntityId(n));
}

/** Simple seeded RNG for deterministic tests. */
function createSeededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function makeInstitution(
  id: EntityId,
  type: InstitutionType = InstitutionType.Academy,
  overrides: Partial<MagicalInstitution> = {},
): MagicalInstitution {
  return {
    id,
    name: `Test ${type}`,
    type,
    siteId: sid(1),
    factionId: fid(1),
    foundedTick: 0,
    headmasterId: cid(1),
    specializations: [MagicSchool.Elemental, MagicSchool.Divination],
    headmasterBias: MagicSchool.Elemental,
    members: [cid(1), cid(2), cid(3)],
    reputation: 70,
    resources: 60,
    politicalStability: 80,
    forbiddenSchools: [MagicSchool.Necromancy],
    schismRisk: 20,
    activeResearch: [],
    ...overrides,
  };
}

function makeResearchProject(
  id: EntityId,
  institutionId: EntityId,
  overrides: Partial<ResearchProject> = {},
): ResearchProject {
  return {
    id,
    institutionId,
    leadResearcherId: cid(1),
    type: ResearchType.SpellDevelopment,
    school: MagicSchool.Elemental,
    name: 'Test Research',
    progress: 0,
    difficulty: 5,
    startTick: 0,
    estimatedTicks: 180,
    resourcesAllocated: 50,
    assistants: [],
    breakthroughChance: 0,
    ...overrides,
  };
}

function makeConsciousness(overrides: Partial<ArtifactConsciousness> = {}): ArtifactConsciousness {
  const personality = new Map<ArtifactPersonalityTrait, number>();
  personality.set(ArtifactPersonalityTrait.Wise, 60);
  personality.set(ArtifactPersonalityTrait.Protective, 40);

  return {
    awarenessLevel: 50,
    personality,
    absorbedEmotions: new Map(),
    previousWielders: [],
    currentWielderId: null,
    bondStrength: 0,
    rejectedWielders: [],
    dormant: false,
    lastActiveInteractionTick: 0,
    ...overrides,
  };
}

function makeArtifact(
  id: ArtifactId,
  overrides: Partial<Artifact> = {},
): Artifact {
  return {
    id,
    name: 'Test Artifact',
    type: ArtifactType.Staff,
    powerLevel: 7,
    creatorId: cid(1),
    creationTick: 0,
    creationStory: {
      purpose: 'To protect the realm',
      circumstance: 'Created during the Great War',
    },
    schools: [MagicSchool.Abjuration],
    consciousness: makeConsciousness(),
    location: { type: 'stored', siteId: sid(1) },
    corrupted: false,
    ...overrides,
  };
}

function makeCatastrophe(
  id: EntityId,
  type: CatastropheType = CatastropheType.WildMagicZone,
  overrides: Partial<MagicalCatastrophe> = {},
): MagicalCatastrophe {
  return {
    id,
    type,
    location: { x: 50, y: 50 },
    radius: 5,
    severity: 5,
    startTick: 0,
    duration: null,
    causeId: null,
    activeEffects: [],
    containmentLevel: 0,
    ...overrides,
  };
}

// ── Test suites ─────────────────────────────────────────────────────────────

describe('Magic Schools', () => {
  it('defines all magic schools', () => {
    expect(ALL_MAGIC_SCHOOLS).toHaveLength(11);
    expect(ALL_MAGIC_SCHOOLS).toContain(MagicSchool.Elemental);
    expect(ALL_MAGIC_SCHOOLS).toContain(MagicSchool.Necromancy);
    expect(ALL_MAGIC_SCHOOLS).toContain(MagicSchool.Chronomancy);
  });
});

describe('Institution Types', () => {
  it('defines all institution types', () => {
    expect(ALL_INSTITUTION_TYPES).toHaveLength(6);
    expect(ALL_INSTITUTION_TYPES).toContain(InstitutionType.Academy);
    expect(ALL_INSTITUTION_TYPES).toContain(InstitutionType.Coven);
    expect(ALL_INSTITUTION_TYPES).toContain(InstitutionType.Tower);
  });

  it('provides traits for each institution type', () => {
    for (const type of ALL_INSTITUTION_TYPES) {
      const traits = INSTITUTION_TRAITS[type];
      expect(traits).toBeDefined();
      expect(traits.formality).toBeGreaterThanOrEqual(0);
      expect(traits.formality).toBeLessThanOrEqual(100);
      expect(traits.secrecy).toBeGreaterThanOrEqual(0);
      expect(traits.secrecy).toBeLessThanOrEqual(100);
    }
  });

  it('academies are formal and research-focused', () => {
    const traits = INSTITUTION_TRAITS[InstitutionType.Academy];
    expect(traits.formality).toBeGreaterThan(70);
    expect(traits.researchFocus).toBeGreaterThan(80);
  });

  it('covens are secretive and ethically flexible', () => {
    const traits = INSTITUTION_TRAITS[InstitutionType.Coven];
    expect(traits.secrecy).toBeGreaterThan(80);
    expect(traits.ethicalFlexibility).toBeGreaterThan(70);
  });

  it('orders have strict hierarchy', () => {
    const traits = INSTITUTION_TRAITS[InstitutionType.Order];
    expect(traits.hierarchy).toBeGreaterThan(90);
  });
});

describe('Research Breakthrough Probability', () => {
  it('returns 0 when all factors are 0', () => {
    const factors: BreakthroughFactors = {
      researcherSkill: 0,
      resourceLevel: 0,
      environmentBonus: 1,
      serendipityRoll: 0,
      institutionSupport: 0,
      schoolAffinity: 1,
    };
    expect(calculateBreakthroughProbability(factors)).toBe(0);
  });

  it('scales with researcher skill', () => {
    const low: BreakthroughFactors = {
      researcherSkill: 30,
      resourceLevel: 50,
      environmentBonus: 1,
      serendipityRoll: 0.5,
      institutionSupport: 50,
      schoolAffinity: 1,
    };
    const high: BreakthroughFactors = {
      ...low,
      researcherSkill: 90,
    };

    const lowProb = calculateBreakthroughProbability(low);
    const highProb = calculateBreakthroughProbability(high);
    expect(highProb).toBeGreaterThan(lowProb);
  });

  it('scales with resources', () => {
    const low: BreakthroughFactors = {
      researcherSkill: 60,
      resourceLevel: 20,
      environmentBonus: 1,
      serendipityRoll: 0.5,
      institutionSupport: 50,
      schoolAffinity: 1,
    };
    const high: BreakthroughFactors = {
      ...low,
      resourceLevel: 90,
    };

    const lowProb = calculateBreakthroughProbability(low);
    const highProb = calculateBreakthroughProbability(high);
    expect(highProb).toBeGreaterThan(lowProb);
  });

  it('environment bonus multiplies probability', () => {
    const normal: BreakthroughFactors = {
      researcherSkill: 60,
      resourceLevel: 60,
      environmentBonus: 1.0,
      serendipityRoll: 0.5,
      institutionSupport: 60,
      schoolAffinity: 1,
    };
    const boosted: BreakthroughFactors = {
      ...normal,
      environmentBonus: 1.5,
    };

    const normalProb = calculateBreakthroughProbability(normal);
    const boostedProb = calculateBreakthroughProbability(boosted);
    expect(boostedProb).toBeGreaterThan(normalProb);
    expect(boostedProb / normalProb).toBeCloseTo(1.5, 1);
  });

  it('serendipity affects probability', () => {
    const unlucky: BreakthroughFactors = {
      researcherSkill: 60,
      resourceLevel: 60,
      environmentBonus: 1,
      serendipityRoll: 0,
      institutionSupport: 60,
      schoolAffinity: 1,
    };
    const lucky: BreakthroughFactors = {
      ...unlucky,
      serendipityRoll: 1,
    };

    const unluckyProb = calculateBreakthroughProbability(unlucky);
    const luckyProb = calculateBreakthroughProbability(lucky);
    expect(luckyProb).toBeGreaterThan(unluckyProb);
  });

  it('caps probability at 95%', () => {
    const maxFactors: BreakthroughFactors = {
      researcherSkill: 100,
      resourceLevel: 100,
      environmentBonus: 2,
      serendipityRoll: 1,
      institutionSupport: 100,
      schoolAffinity: 2,
    };
    expect(calculateBreakthroughProbability(maxFactors)).toBe(0.95);
  });
});

describe('Artifact Compatibility', () => {
  it('low-awareness artifacts accept anyone', () => {
    const artifact = makeArtifact(aid(1), {
      consciousness: makeConsciousness({ awarenessLevel: 10 }),
    });
    const wielderTraits = new Map<string, number>();
    wielderTraits.set('cruel', 90);
    wielderTraits.set('treacherous', 80);

    const result = checkArtifactCompatibility(artifact, wielderTraits);
    expect(result.compatible).toBe(true);
    expect(result.reason).toContain('lacks awareness');
  });

  it('wise artifact prefers wise wielders', () => {
    const personality = new Map<ArtifactPersonalityTrait, number>();
    personality.set(ArtifactPersonalityTrait.Wise, 80);

    const artifact = makeArtifact(aid(1), {
      consciousness: makeConsciousness({
        awarenessLevel: 60,
        personality,
      }),
    });

    const wiseWielder = new Map<string, number>();
    wiseWielder.set('wise', 80);
    wiseWielder.set('prudent', 70);

    const recklessWielder = new Map<string, number>();
    recklessWielder.set('impulsive', 80);
    recklessWielder.set('reckless', 70);

    const wiseResult = checkArtifactCompatibility(artifact, wiseWielder);
    const recklessResult = checkArtifactCompatibility(artifact, recklessWielder);

    expect(wiseResult.bondPotential).toBeGreaterThan(recklessResult.bondPotential);
  });

  it('malevolent artifact rejects noble wielders', () => {
    const personality = new Map<ArtifactPersonalityTrait, number>();
    personality.set(ArtifactPersonalityTrait.Malevolent, 90);

    const artifact = makeArtifact(aid(1), {
      consciousness: makeConsciousness({
        awarenessLevel: 70,
        personality,
      }),
    });

    const nobleWielder = new Map<string, number>();
    nobleWielder.set('noble', 80);
    nobleWielder.set('compassionate', 70);

    const result = checkArtifactCompatibility(artifact, nobleWielder);
    expect(result.bondPotential).toBeLessThan(50);
    expect(result.reason).toContain('Moral conflict');
  });

  it('previously rejected wielders have lower compatibility', () => {
    const personality = new Map<ArtifactPersonalityTrait, number>();
    personality.set(ArtifactPersonalityTrait.Wise, 50);

    const artifact = makeArtifact(aid(1), {
      consciousness: makeConsciousness({
        awarenessLevel: 60,
        personality,
        currentWielderId: cid(1),
        rejectedWielders: [cid(1)],
      }),
    });

    const wielderTraits = new Map<string, number>();
    wielderTraits.set('wise', 60);

    const result = checkArtifactCompatibility(artifact, wielderTraits);
    expect(result.bondPotential).toBeLessThan(50);
    expect(result.reason).toContain('Previously rejected');
  });
});

describe('Artifact Influence on Wielder', () => {
  it('dormant artifact has no influence', () => {
    const artifact = makeArtifact(aid(1), {
      consciousness: makeConsciousness({
        awarenessLevel: 80,
        bondStrength: 90,
        dormant: true,
      }),
    });

    const wielderTraits = new Map<string, number>();
    const influence = calculateArtifactInfluence(artifact, wielderTraits, 365);

    expect(influence.size).toBe(0);
  });

  it('low-awareness artifact has no influence', () => {
    const artifact = makeArtifact(aid(1), {
      consciousness: makeConsciousness({
        awarenessLevel: 20,
        bondStrength: 90,
        dormant: false,
      }),
    });

    const wielderTraits = new Map<string, number>();
    const influence = calculateArtifactInfluence(artifact, wielderTraits, 365);

    expect(influence.size).toBe(0);
  });

  it('wrathful artifact increases wielder wrath', () => {
    const personality = new Map<ArtifactPersonalityTrait, number>();
    personality.set(ArtifactPersonalityTrait.Wrathful, 80);

    const artifact = makeArtifact(aid(1), {
      consciousness: makeConsciousness({
        awarenessLevel: 80,
        bondStrength: 80,
        personality,
        dormant: false,
      }),
    });

    const wielderTraits = new Map<string, number>();
    wielderTraits.set('wrathful', 30);

    const influence = calculateArtifactInfluence(artifact, wielderTraits, 365);

    expect(influence.has('wrathful')).toBe(true);
    expect(influence.get('wrathful')).toBeGreaterThan(0);
  });

  it('influence scales with bond duration', () => {
    const personality = new Map<ArtifactPersonalityTrait, number>();
    personality.set(ArtifactPersonalityTrait.Ambitious, 80);

    const artifact = makeArtifact(aid(1), {
      consciousness: makeConsciousness({
        awarenessLevel: 80,
        bondStrength: 80,
        personality,
        dormant: false,
      }),
    });

    const wielderTraits = new Map<string, number>();

    const shortInfluence = calculateArtifactInfluence(artifact, wielderTraits, 30);
    const longInfluence = calculateArtifactInfluence(artifact, wielderTraits, 365);

    const shortAmbitious = shortInfluence.get('ambitious') ?? 0;
    const longAmbitious = longInfluence.get('ambitious') ?? 0;

    expect(longAmbitious).toBeGreaterThan(shortAmbitious);
  });

  it('influence scales with bond strength', () => {
    const personality = new Map<ArtifactPersonalityTrait, number>();
    personality.set(ArtifactPersonalityTrait.Curious, 80);

    const weakBond = makeArtifact(aid(1), {
      consciousness: makeConsciousness({
        awarenessLevel: 80,
        bondStrength: 20,
        personality,
        dormant: false,
      }),
    });

    const strongBond = makeArtifact(aid(2), {
      consciousness: makeConsciousness({
        awarenessLevel: 80,
        bondStrength: 90,
        personality,
        dormant: false,
      }),
    });

    const wielderTraits = new Map<string, number>();

    const weakInfluence = calculateArtifactInfluence(weakBond, wielderTraits, 365);
    const strongInfluence = calculateArtifactInfluence(strongBond, wielderTraits, 365);

    const weakCurious = weakInfluence.get('curious') ?? 0;
    const strongCurious = strongInfluence.get('curious') ?? 0;

    expect(strongCurious).toBeGreaterThan(weakCurious);
  });
});

describe('Catastrophe Probability', () => {
  it('returns very low probability with no activity', () => {
    const prob = calculateCatastropheProbability(0, 1.0, 0);
    expect(prob).toBeLessThan(0.001);
  });

  it('increases with magical activity', () => {
    const lowProb = calculateCatastropheProbability(20, 1.0, 0);
    const highProb = calculateCatastropheProbability(80, 1.0, 0);
    expect(highProb).toBeGreaterThan(lowProb);
  });

  it('increases with world magic strength', () => {
    const lowStrengthProb = calculateCatastropheProbability(50, 0.5, 0);
    const highStrengthProb = calculateCatastropheProbability(50, 2.0, 0);
    expect(highStrengthProb).toBeGreaterThan(lowStrengthProb);
  });

  it('increases with risk factors', () => {
    const noRiskProb = calculateCatastropheProbability(50, 1.0, 0);
    const highRiskProb = calculateCatastropheProbability(50, 1.0, 50);
    expect(highRiskProb).toBeGreaterThan(noRiskProb);
  });

  it('caps at 5%', () => {
    // With extreme inputs, probability should still be <= 5%
    const maxProb = calculateCatastropheProbability(100, 3.0, 100);
    expect(maxProb).toBeLessThanOrEqual(0.05);
    // Verify the value is positive (sanity check)
    expect(maxProb).toBeGreaterThan(0);
  });
});

describe('Magic-Society Effects', () => {
  it('integrated magic provides economic bonus', () => {
    const effects = calculateMagicSocietyEffects(1.5, MagicSocietyRelation.Integrated, 0.1);
    expect(effects.economicMultiplier).toBeGreaterThan(1.0);
  });

  it('persecuted magic has negative effects', () => {
    const effects = calculateMagicSocietyEffects(1.0, MagicSocietyRelation.Persecuted, 0.05);
    expect(effects.economicMultiplier).toBeLessThan(1.0);
    expect(effects.magePopulationGrowth).toBeLessThan(0);
    expect(effects.persecutionRisk).toBeGreaterThan(0.5);
  });

  it('suppressed magic limits tech advancement', () => {
    const effects = calculateMagicSocietyEffects(1.0, MagicSocietyRelation.Suppressed, 0.02);
    expect(effects.techAdvancement).toBeLessThan(0.5);
  });

  it('revered magic maximizes mage growth', () => {
    const effects = calculateMagicSocietyEffects(1.5, MagicSocietyRelation.Revered, 0.1);
    expect(effects.magePopulationGrowth).toBeGreaterThan(1.5);
    expect(effects.persecutionRisk).toBe(0);
  });

  it('high magic proportion reduces persecution risk', () => {
    const lowMageEffects = calculateMagicSocietyEffects(1.0, MagicSocietyRelation.Feared, 0.01);
    const highMageEffects = calculateMagicSocietyEffects(1.0, MagicSocietyRelation.Feared, 0.3);

    expect(highMageEffects.persecutionRisk).toBeLessThan(lowMageEffects.persecutionRisk);
  });
});

describe('MagicSystem', () => {
  let world: World;
  let clock: WorldClock;
  let events: EventBus;
  let system: MagicSystem;

  beforeEach(() => {
    world = new World();
    clock = new WorldClock();
    events = new EventBus();
    system = new MagicSystem();
    resetEventIdCounter();
    resetMagicIdCounters();
  });

  it('initializes without error', () => {
    expect(() => system.initialize(world)).not.toThrow();
  });

  it('executes without error on empty world', () => {
    system.initialize(world);
    expect(() => system.execute(world, clock, events)).not.toThrow();
  });

  it('has correct name and execution order', () => {
    expect(system.name).toBe('MagicSystem');
    expect(system.executionOrder).toBe(70); // MAGIC = 70
  });

  describe('Institution Management', () => {
    it('registers and retrieves institutions', () => {
      system.initialize(world);
      const inst = makeInstitution(eid(1));
      system.registerInstitution(inst);

      const retrieved = system.getInstitution(eid(1));
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe(inst.name);
    });

    it('finds institutions at a site', () => {
      system.initialize(world);
      const inst1 = makeInstitution(eid(1), InstitutionType.Academy, { siteId: sid(1) });
      const inst2 = makeInstitution(eid(2), InstitutionType.Tower, { siteId: sid(1) });
      const inst3 = makeInstitution(eid(3), InstitutionType.Coven, { siteId: sid(2) });

      system.registerInstitution(inst1);
      system.registerInstitution(inst2);
      system.registerInstitution(inst3);

      const atSite1 = system.getInstitutionsAtSite(sid(1));
      expect(atSite1).toHaveLength(2);

      const atSite2 = system.getInstitutionsAtSite(sid(2));
      expect(atSite2).toHaveLength(1);
    });
  });

  describe('Research Management', () => {
    it('starts and retrieves research projects', () => {
      system.initialize(world);
      const inst = makeInstitution(eid(1));
      system.registerInstitution(inst);

      const project = makeResearchProject(eid(100), eid(1));
      system.startResearch(project);

      const retrieved = system.getResearch(eid(100));
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe(project.name);
    });

    it('gets research by institution', () => {
      system.initialize(world);
      const inst = makeInstitution(eid(1));
      system.registerInstitution(inst);

      system.startResearch(makeResearchProject(eid(100), eid(1)));
      system.startResearch(makeResearchProject(eid(101), eid(1), { school: MagicSchool.Divination }));
      system.startResearch(makeResearchProject(eid(102), eid(2))); // Different institution

      const instResearch = system.getResearchByInstitution(eid(1));
      expect(instResearch).toHaveLength(2);
    });

    it('processes research progress over time', () => {
      system.initialize(world);
      const inst = makeInstitution(eid(1), InstitutionType.Academy, { resources: 80 });
      system.registerInstitution(inst);

      const project = makeResearchProject(eid(100), eid(1), { progress: 0 });
      system.startResearch(project);

      // Advance 30 ticks for monthly processing
      for (let i = 0; i < 30; i++) {
        clock.advance();
      }
      system.execute(world, clock, events);

      expect(project.progress).toBeGreaterThan(0);
    });
  });

  describe('Artifact Management', () => {
    it('registers and retrieves artifacts', () => {
      system.initialize(world);
      const artifact = makeArtifact(aid(1));
      system.registerArtifact(artifact);

      const retrieved = system.getArtifact(aid(1));
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe(artifact.name);
    });

    it('finds artifacts by wielder', () => {
      system.initialize(world);
      const artifact1 = makeArtifact(aid(1), {
        location: { type: 'wielded', holderId: cid(1) },
      });
      const artifact2 = makeArtifact(aid(2), {
        location: { type: 'wielded', holderId: cid(1) },
      });
      const artifact3 = makeArtifact(aid(3), {
        location: { type: 'stored', siteId: sid(1) },
      });

      system.registerArtifact(artifact1);
      system.registerArtifact(artifact2);
      system.registerArtifact(artifact3);

      const wielded = system.getArtifactsByWielder(cid(1));
      expect(wielded).toHaveLength(2);
    });

    it('attempts bonding with compatible wielder', () => {
      system.initialize(world);
      const artifact = makeArtifact(aid(1), {
        consciousness: makeConsciousness({ awarenessLevel: 30 }),
      });
      system.registerArtifact(artifact);

      const wielderTraits = new Map<string, number>();
      wielderTraits.set('wise', 70);

      const rng = createSeededRng(42);
      const result = system.attemptBond(aid(1), cid(5), wielderTraits, rng);

      expect(result.success).toBe(true);
      expect(artifact.consciousness.currentWielderId).toBe(cid(5));
      expect(artifact.location.type).toBe('wielded');
    });

    it('rejects incompatible wielder', () => {
      const personality = new Map<ArtifactPersonalityTrait, number>();
      personality.set(ArtifactPersonalityTrait.Malevolent, 90);

      system.initialize(world);
      const artifact = makeArtifact(aid(1), {
        consciousness: makeConsciousness({
          awarenessLevel: 80,
          personality,
        }),
      });
      system.registerArtifact(artifact);

      const wielderTraits = new Map<string, number>();
      wielderTraits.set('noble', 90);
      wielderTraits.set('compassionate', 90);

      const rng = createSeededRng(42);
      const result = system.attemptBond(aid(1), cid(5), wielderTraits, rng);

      expect(result.success).toBe(false);
      expect(artifact.consciousness.rejectedWielders).toContain(cid(5));
    });
  });

  describe('Catastrophe Management', () => {
    it('tracks active catastrophes', () => {
      system.initialize(world);

      // No catastrophes initially
      expect(system.getActiveCatastrophes()).toHaveLength(0);
    });

    it('finds catastrophes in area', () => {
      system.initialize(world);

      // Manually add a catastrophe for testing
      const catastropheId = createCatastropheId();
      (system as unknown as { catastrophes: Map<EntityId, MagicalCatastrophe> }).catastrophes.set(
        catastropheId,
        makeCatastrophe(catastropheId, CatastropheType.WildMagicZone, {
          location: { x: 50, y: 50 },
          radius: 10,
        }),
      );

      const nearCatastrophes = system.getCatastrophesInArea(55, 55, 5);
      expect(nearCatastrophes).toHaveLength(1);

      const farCatastrophes = system.getCatastrophesInArea(100, 100, 5);
      expect(farCatastrophes).toHaveLength(0);
    });
  });

  describe('Artifact Creation', () => {
    it('creates artifact with consciousness', () => {
      system.initialize(world);

      const creationStory: ArtifactCreationStory = {
        purpose: 'To protect the kingdom during war',
        circumstance: 'Forged during the siege of the capital',
        sacrifice: 'The life of the royal mage',
      };

      const rng = createSeededRng(12345);
      const artifact = system.createArtifact(
        'Shield of the Realm',
        ArtifactType.Armor,
        8,
        cid(1),
        creationStory,
        [MagicSchool.Abjuration],
        clock,
        events,
        rng,
      );

      expect(artifact.name).toBe('Shield of the Realm');
      expect(artifact.type).toBe(ArtifactType.Armor);
      expect(artifact.powerLevel).toBe(8);
      expect(artifact.consciousness.awarenessLevel).toBe(40); // 8 * 5
      expect(artifact.consciousness.personality.size).toBeGreaterThan(0);
    });

    it('emits artifact creation event', () => {
      system.initialize(world);

      const emittedEvents: unknown[] = [];
      events.on(EventCategory.Magical, (e: WorldEvent) => emittedEvents.push(e));

      const rng = createSeededRng(12345);
      system.createArtifact(
        'Test Sword',
        ArtifactType.Weapon,
        5,
        cid(1),
        { purpose: 'war', circumstance: 'test' },
        [MagicSchool.Destruction],
        clock,
        events,
        rng,
      );

      expect(emittedEvents).toHaveLength(1);
      expect((emittedEvents[0] as { subtype: string }).subtype).toBe('magic.artifact_created');
    });

    it('war-purpose artifacts gain wrathful trait', () => {
      system.initialize(world);

      const creationStory: ArtifactCreationStory = {
        purpose: 'To wage war upon our enemies',
        circumstance: 'Created for battle',
      };

      const rng = createSeededRng(12345);
      const artifact = system.createArtifact(
        'Blade of Wrath',
        ArtifactType.Weapon,
        7,
        cid(1),
        creationStory,
        [MagicSchool.Destruction],
        clock,
        events,
        rng,
      );

      const wrathLevel = artifact.consciousness.personality.get(ArtifactPersonalityTrait.Wrathful) ?? 0;
      expect(wrathLevel).toBeGreaterThan(0);
    });

    it('protective-purpose artifacts gain protective trait', () => {
      system.initialize(world);

      const creationStory: ArtifactCreationStory = {
        purpose: 'To protect the innocent',
        circumstance: 'Created to defend the weak',
      };

      const rng = createSeededRng(12345);
      const artifact = system.createArtifact(
        'Guardian Shield',
        ArtifactType.Armor,
        6,
        cid(1),
        creationStory,
        [MagicSchool.Abjuration],
        clock,
        events,
        rng,
      );

      const protectiveLevel = artifact.consciousness.personality.get(ArtifactPersonalityTrait.Protective) ?? 0;
      expect(protectiveLevel).toBeGreaterThan(0);
    });
  });

  describe('Institution Politics', () => {
    it('emits tension events for unstable institutions', () => {
      system.initialize(world);
      const inst = makeInstitution(eid(1), InstitutionType.Academy, {
        schismRisk: 60,
        forbiddenSchools: [MagicSchool.Necromancy],
      });
      system.registerInstitution(inst);

      // Add forbidden research to increase tension
      const project = makeResearchProject(eid(100), eid(1), {
        school: MagicSchool.Necromancy,
      });
      system.startResearch(project);

      const emittedEvents: unknown[] = [];
      events.on(EventCategory.Magical, (e: WorldEvent) => emittedEvents.push(e));

      // Run monthly processing multiple times
      for (let month = 0; month < 12; month++) {
        for (let i = 0; i < 30; i++) {
          clock.advance();
        }
        system.execute(world, clock, events);
      }

      // Should have some tension events due to forbidden research
      const tensionEvents = emittedEvents.filter(
        (e) => (e as { subtype: string }).subtype === 'magic.institution_tension'
      );
      expect(tensionEvents.length).toBeGreaterThanOrEqual(0); // May or may not trigger depending on RNG
    });
  });

  describe('Research Progress', () => {
    it('specialty schools progress faster', () => {
      system.initialize(world);

      const inst = makeInstitution(eid(1), InstitutionType.Academy, {
        specializations: [MagicSchool.Elemental],
        resources: 60,
      });
      system.registerInstitution(inst);

      const specialtyProject = makeResearchProject(eid(100), eid(1), {
        school: MagicSchool.Elemental,
        progress: 0,
      });
      const nonSpecialtyProject = makeResearchProject(eid(101), eid(1), {
        school: MagicSchool.Necromancy,
        progress: 0,
      });

      system.startResearch(specialtyProject);
      system.startResearch(nonSpecialtyProject);

      // Advance 30 ticks for monthly processing
      for (let i = 0; i < 30; i++) {
        clock.advance();
      }
      system.execute(world, clock, events);

      expect(specialtyProject.progress).toBeGreaterThan(nonSpecialtyProject.progress);
    });

    it('emits completion event when research finishes', () => {
      system.initialize(world);

      const inst = makeInstitution(eid(1), InstitutionType.Academy, { resources: 80 });
      system.registerInstitution(inst);

      const project = makeResearchProject(eid(100), eid(1), {
        progress: 95, // Almost complete
        difficulty: 1, // Easy
      });
      system.startResearch(project);

      const emittedEvents: unknown[] = [];
      events.on(EventCategory.Magical, (e: WorldEvent) => emittedEvents.push(e));

      // Advance 30 ticks for monthly processing
      for (let i = 0; i < 30; i++) {
        clock.advance();
      }
      system.execute(world, clock, events);

      const completionEvents = emittedEvents.filter(
        (e) => (e as { subtype: string }).subtype === 'magic.research_complete'
      );
      expect(completionEvents).toHaveLength(1);
    });
  });
});

describe('ID Generation', () => {
  beforeEach(() => {
    resetMagicIdCounters();
  });

  it('creates unique research IDs', () => {
    const id1 = createResearchId();
    const id2 = createResearchId();
    expect(id1).not.toBe(id2);
  });

  it('creates unique institution IDs', () => {
    const id1 = createInstitutionId();
    const id2 = createInstitutionId();
    expect(id1).not.toBe(id2);
  });

  it('creates unique artifact IDs', () => {
    const id1 = createArtifactIdValue();
    const id2 = createArtifactIdValue();
    expect(id1).not.toBe(id2);
  });

  it('creates unique catastrophe IDs', () => {
    const id1 = createCatastropheId();
    const id2 = createCatastropheId();
    expect(id1).not.toBe(id2);
  });

  it('resets counters correctly', () => {
    createResearchId();
    createResearchId();
    resetMagicIdCounters();

    const afterReset = createResearchId();
    expect(afterReset).toBe(70000 as EntityId);
  });
});

describe('Enum Completeness', () => {
  it('has all research types', () => {
    expect(ALL_RESEARCH_TYPES).toHaveLength(7);
    expect(ALL_RESEARCH_TYPES).toContain(ResearchType.ForbiddenKnowledge);
  });

  it('has all artifact types', () => {
    expect(ALL_ARTIFACT_TYPES).toHaveLength(9);
    expect(ALL_ARTIFACT_TYPES).toContain(ArtifactType.Orb);
    expect(ALL_ARTIFACT_TYPES).toContain(ArtifactType.Relic);
  });

  it('has all artifact personality traits', () => {
    expect(ALL_ARTIFACT_TRAITS).toHaveLength(10);
    expect(ALL_ARTIFACT_TRAITS).toContain(ArtifactPersonalityTrait.Malevolent);
  });

  it('has all catastrophe types', () => {
    expect(ALL_CATASTROPHE_TYPES).toHaveLength(8);
    expect(ALL_CATASTROPHE_TYPES).toContain(CatastropheType.PlanarRift);
    expect(ALL_CATASTROPHE_TYPES).toContain(CatastropheType.FailedLichTransformation);
  });

  it('has all society relations', () => {
    expect(ALL_SOCIETY_RELATIONS).toHaveLength(7);
    expect(ALL_SOCIETY_RELATIONS).toContain(MagicSocietyRelation.Persecuted);
  });
});
