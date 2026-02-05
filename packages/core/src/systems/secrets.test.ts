/**
 * Tests for the Secret Knowledge System.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { toEntityId, toCharacterId, toFactionId } from '../ecs/types.js';
import type { EntityId, CharacterId, FactionId } from '../ecs/types.js';
import { EventBus } from '../events/event-bus.js';
import { EventCategory, type WorldEvent } from '../events/types.js';
import {
  SecretType,
  ALL_SECRET_TYPES,
  RevelationMethod,
  ALL_REVELATION_METHODS,
  SECRET_BASE_SIGNIFICANCE,
  SECRET_BASE_REVELATION_RATE,
} from './secret-types.js';
import {
  createSecretId,
  createClueId,
  resetSecretIdCounters,
} from './secret.js';
import {
  SecretManager,
  type SecretWorldState,
} from './secret-manager.js';
import {
  SecretPerceptionFilter,
  type GroundTruthState,
} from './perception-filter.js';
import {
  DiscoveryActions,
  type DiscoverySkills,
} from './discovery-actions.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

function eid(n: number): EntityId {
  return toEntityId(n);
}

function cid(n: number): CharacterId {
  return toCharacterId(toEntityId(n));
}

function fid(n: number): FactionId {
  return toFactionId(toEntityId(n));
}

function makeWorldState(overrides: Partial<SecretWorldState> = {}): SecretWorldState {
  return {
    currentTick: 100,
    capturedCharacters: new Set(),
    activeInvestigations: new Map(),
    recentEventIds: [],
    ...overrides,
  };
}

function makeSkills(overrides: Partial<DiscoverySkills> = {}): DiscoverySkills {
  return {
    investigation: 50,
    interrogation: 50,
    deduction: 50,
    cunning: 50,
    persuasion: 50,
    willpower: 50,
    ...overrides,
  };
}

function setupSecretSystem(): {
  manager: SecretManager;
  events: EventBus;
  emittedEvents: WorldEvent[];
} {
  resetSecretIdCounters();
  const manager = new SecretManager();
  const events = new EventBus();
  const emittedEvents: WorldEvent[] = [];

  // Capture all event types
  for (const category of Object.values(EventCategory)) {
    events.on(category, (event) => emittedEvents.push(event));
  }

  return { manager, events, emittedEvents };
}

// =============================================================================
// ENUM TESTS
// =============================================================================

describe('SecretType', () => {
  it('should have all expected secret types', () => {
    expect(ALL_SECRET_TYPES).toContain(SecretType.DisguisedIdentity);
    expect(ALL_SECRET_TYPES).toContain(SecretType.HiddenArtifactLocation);
    expect(ALL_SECRET_TYPES).toContain(SecretType.MilitaryStrength);
    expect(ALL_SECRET_TYPES).toContain(SecretType.Prophecy);
    expect(ALL_SECRET_TYPES).toContain(SecretType.EntityWeakness);
    expect(ALL_SECRET_TYPES).toContain(SecretType.ConspiracyPlot);
    expect(ALL_SECRET_TYPES).toContain(SecretType.ForbiddenKnowledge);
    expect(ALL_SECRET_TYPES).toContain(SecretType.SecretAlliance);
    expect(ALL_SECRET_TYPES).toHaveLength(8);
  });

  it('should have base significance for all types', () => {
    for (const type of ALL_SECRET_TYPES) {
      expect(SECRET_BASE_SIGNIFICANCE[type]).toBeGreaterThan(0);
      expect(SECRET_BASE_SIGNIFICANCE[type]).toBeLessThanOrEqual(100);
    }
  });

  it('should have revelation rates for all types', () => {
    for (const type of ALL_SECRET_TYPES) {
      expect(SECRET_BASE_REVELATION_RATE[type]).toBeGreaterThan(0);
      expect(SECRET_BASE_REVELATION_RATE[type]).toBeLessThanOrEqual(1);
    }
  });
});

describe('RevelationMethod', () => {
  it('should have all expected revelation methods', () => {
    expect(ALL_REVELATION_METHODS).toContain(RevelationMethod.NaturalLeak);
    expect(ALL_REVELATION_METHODS).toContain(RevelationMethod.Investigation);
    expect(ALL_REVELATION_METHODS).toContain(RevelationMethod.Interrogation);
    expect(ALL_REVELATION_METHODS).toContain(RevelationMethod.Deduction);
    expect(ALL_REVELATION_METHODS).toContain(RevelationMethod.DivineRevelation);
    expect(ALL_REVELATION_METHODS).toContain(RevelationMethod.Betrayal);
    expect(ALL_REVELATION_METHODS).toContain(RevelationMethod.Accident);
    expect(ALL_REVELATION_METHODS).toContain(RevelationMethod.VoluntaryDisclosure);
    expect(ALL_REVELATION_METHODS).toHaveLength(8);
  });
});

// =============================================================================
// ID GENERATION TESTS
// =============================================================================

describe('ID Generation', () => {
  beforeEach(() => {
    resetSecretIdCounters();
  });

  it('should generate sequential secret IDs', () => {
    const id1 = createSecretId();
    const id2 = createSecretId();
    expect(id2).toBe(id1 + 1);
  });

  it('should generate sequential clue IDs', () => {
    const id1 = createClueId();
    const id2 = createClueId();
    expect(id2).toBe(id1 + 1);
  });

  it('should reset counters', () => {
    createSecretId();
    createClueId();
    resetSecretIdCounters();

    // IDs have different bases
    expect(createSecretId()).toBe(400000 as EntityId);
    expect(createClueId()).toBe(410000 as EntityId);
  });
});

// =============================================================================
// SECRET MANAGER TESTS
// =============================================================================

describe('SecretManager', () => {
  beforeEach(() => {
    resetSecretIdCounters();
  });

  describe('Secret Creation', () => {
    it('should create a secret with initial knowers', () => {
      const { manager } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: { target: 'king', method: 'poison' },
        initialKnowers: [cid(1), cid(2)],
        createdAt: 0,
      });

      expect(secret.id).toBeDefined();
      expect(secret.type).toBe(SecretType.ConspiracyPlot);
      expect(secret.knownBy.has(cid(1))).toBe(true);
      expect(secret.knownBy.has(cid(2))).toBe(true);
      expect(secret.isRevealed).toBe(false);
    });

    it('should use default significance from type', () => {
      const { manager } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.Prophecy,
        groundTruth: { content: 'doom' },
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      expect(secret.significance).toBe(SECRET_BASE_SIGNIFICANCE[SecretType.Prophecy]);
    });

    it('should allow custom significance', () => {
      const { manager } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.Prophecy,
        groundTruth: { content: 'doom' },
        initialKnowers: [cid(1)],
        significance: 95,
        createdAt: 0,
      });

      expect(secret.significance).toBe(95);
    });

    it('should index secrets by type', () => {
      const { manager } = setupSecretSystem();

      manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });
      manager.createSecret({
        type: SecretType.SecretAlliance,
        groundTruth: {},
        initialKnowers: [cid(2)],
        createdAt: 0,
      });

      const conspiracies = manager.getSecretsByType(SecretType.ConspiracyPlot);
      const alliances = manager.getSecretsByType(SecretType.SecretAlliance);

      expect(conspiracies).toHaveLength(1);
      expect(alliances).toHaveLength(1);
    });
  });

  describe('Knowledge Management', () => {
    it('should add knowers to a secret', () => {
      const { manager } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      const added = manager.addKnower(secret.id, cid(2));
      expect(added).toBe(true);
      expect(secret.knownBy.has(cid(2))).toBe(true);
    });

    it('should not add duplicate knowers', () => {
      const { manager } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      const added = manager.addKnower(secret.id, cid(1));
      expect(added).toBe(false);
    });

    it('should remove knowers', () => {
      const { manager } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1), cid(2)],
        createdAt: 0,
      });

      const removed = manager.removeKnower(secret.id, cid(1));
      expect(removed).toBe(true);
      expect(secret.knownBy.has(cid(1))).toBe(false);
      expect(secret.knownBy.has(cid(2))).toBe(true);
    });

    it('should track suspicions', () => {
      const { manager } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      manager.addSuspicion(secret.id, cid(2), 50);
      expect(secret.suspectedBy.get(cid(2))).toBe(50);
    });

    it('should not suspect what you already know', () => {
      const { manager } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      const added = manager.addSuspicion(secret.id, cid(1), 50);
      expect(added).toBe(false);
    });

    it('should convert high suspicion to knowledge', () => {
      const { manager } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      manager.addSuspicion(secret.id, cid(2), 85); // Above threshold
      expect(secret.knownBy.has(cid(2))).toBe(true);
      expect(secret.suspectedBy.has(cid(2))).toBe(false);
    });
  });

  describe('Revelation Probability', () => {
    it('should increase with age', () => {
      const { manager } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      const worldState = makeWorldState();
      const prob1 = manager.calculateRevelationProbability(secret, worldState);

      secret.age = 1000;
      const prob2 = manager.calculateRevelationProbability(secret, worldState);

      expect(prob2).toBeGreaterThan(prob1);
    });

    it('should increase with more knowers', () => {
      const { manager } = setupSecretSystem();

      const secret1 = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      const secret2 = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1), cid(2), cid(3), cid(4)],
        createdAt: 0,
      });

      const worldState = makeWorldState();
      const prob1 = manager.calculateRevelationProbability(secret1, worldState);
      const prob2 = manager.calculateRevelationProbability(secret2, worldState);

      expect(prob2).toBeGreaterThan(prob1);
    });

    it('should increase when knower is captured', () => {
      const { manager } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      const freeState = makeWorldState();
      const capturedState = makeWorldState({
        capturedCharacters: new Set([cid(1)]),
      });

      const probFree = manager.calculateRevelationProbability(secret, freeState);
      const probCaptured = manager.calculateRevelationProbability(secret, capturedState);

      expect(probCaptured).toBeGreaterThan(probFree);
    });

    it('should increase when actively investigated', () => {
      const { manager } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      const normalState = makeWorldState();
      const investigatedState = makeWorldState({
        activeInvestigations: new Map([
          [cid(2), new Set([secret.id])],
        ]),
      });

      const probNormal = manager.calculateRevelationProbability(secret, normalState);
      const probInvestigated = manager.calculateRevelationProbability(
        secret,
        investigatedState,
      );

      expect(probInvestigated).toBeGreaterThan(probNormal);
    });

    it('should be 0 for already revealed secrets', () => {
      const { manager, events } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      manager.revealSecret(
        secret.id,
        RevelationMethod.NaturalLeak,
        undefined,
        [],
        100,
        events,
      );

      const worldState = makeWorldState();
      expect(manager.calculateRevelationProbability(secret, worldState)).toBe(0);
    });
  });

  describe('Revelation', () => {
    it('should mark secret as revealed', () => {
      const { manager, events } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: { target: 'king' },
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      manager.revealSecret(
        secret.id,
        RevelationMethod.NaturalLeak,
        undefined,
        [cid(2)],
        100,
        events,
      );

      expect(secret.isRevealed).toBe(true);
      expect(secret.revealedAt).toBe(100);
      expect(secret.revealedBy).toBe(RevelationMethod.NaturalLeak);
    });

    it('should add new knowers on revelation', () => {
      const { manager, events } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      manager.revealSecret(
        secret.id,
        RevelationMethod.NaturalLeak,
        undefined,
        [cid(2), cid(3)],
        100,
        events,
      );

      expect(secret.knownBy.has(cid(2))).toBe(true);
      expect(secret.knownBy.has(cid(3))).toBe(true);
    });

    it('should emit revelation event', () => {
      const { manager, events, emittedEvents } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: { target: 'king' },
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      manager.revealSecret(
        secret.id,
        RevelationMethod.Betrayal,
        cid(1),
        [cid(2)],
        100,
        events,
      );

      const revelationEvent = emittedEvents.find(
        (e) => e.subtype === 'secret.revealed',
      );
      expect(revelationEvent).toBeDefined();
      expect(revelationEvent?.significance).toBe(secret.significance);
    });

    it('should emit type-specific events', () => {
      const { manager, events, emittedEvents } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: { plotDetails: 'assassination' },
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      manager.revealSecret(
        secret.id,
        RevelationMethod.Investigation,
        undefined,
        [cid(2)],
        100,
        events,
      );

      const conspiracyEvent = emittedEvents.find(
        (e) => e.subtype === 'secret.conspiracy_exposed',
      );
      expect(conspiracyEvent).toBeDefined();
    });

    it('should not reveal already revealed secrets', () => {
      const { manager, events } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      const result1 = manager.revealSecret(
        secret.id,
        RevelationMethod.NaturalLeak,
        undefined,
        [],
        100,
        events,
      );
      const result2 = manager.revealSecret(
        secret.id,
        RevelationMethod.NaturalLeak,
        undefined,
        [],
        200,
        events,
      );

      expect(result1).toBeDefined();
      expect(result2).toBeUndefined();
    });
  });

  describe('Tick Processing', () => {
    it('should age secrets each tick', () => {
      const { manager, events } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        revelationProbability: 0, // Disable revelation for this test
        createdAt: 0,
      });

      const worldState = makeWorldState({ currentTick: 1 });
      manager.processTick(worldState, events);

      expect(secret.age).toBe(1);
    });
  });

  describe('Queries', () => {
    it('should get secrets known by a character', () => {
      const { manager } = setupSecretSystem();

      manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });
      manager.createSecret({
        type: SecretType.SecretAlliance,
        groundTruth: {},
        initialKnowers: [cid(1), cid(2)],
        createdAt: 0,
      });
      manager.createSecret({
        type: SecretType.Prophecy,
        groundTruth: {},
        initialKnowers: [cid(2)],
        createdAt: 0,
      });

      const knownByChar1 = manager.getSecretsKnownBy(cid(1));
      const knownByChar2 = manager.getSecretsKnownBy(cid(2));

      expect(knownByChar1).toHaveLength(2);
      expect(knownByChar2).toHaveLength(2);
    });

    it('should check if character knows a secret', () => {
      const { manager } = setupSecretSystem();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      expect(manager.doesCharacterKnow(cid(1), secret.id)).toBe(true);
      expect(manager.doesCharacterKnow(cid(2), secret.id)).toBe(false);
    });

    it('should return active vs revealed secrets', () => {
      const { manager, events } = setupSecretSystem();

      const s1 = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });
      manager.createSecret({
        type: SecretType.SecretAlliance,
        groundTruth: {},
        initialKnowers: [cid(2)],
        createdAt: 0,
      });

      manager.revealSecret(s1.id, RevelationMethod.NaturalLeak, undefined, [], 100, events);

      expect(manager.getActiveSecrets()).toHaveLength(1);
      expect(manager.getRevealedSecrets()).toHaveLength(1);
    });
  });
});

// =============================================================================
// PERCEPTION FILTER TESTS
// =============================================================================

describe('SecretPerceptionFilter', () => {
  beforeEach(() => {
    resetSecretIdCounters();
  });

  function setupPerception(): {
    manager: SecretManager;
    filter: SecretPerceptionFilter;
  } {
    const manager = new SecretManager();
    const filter = new SecretPerceptionFilter(manager);
    return { manager, filter };
  }

  describe('Identity Perception', () => {
    it('should see disguise when secret unknown', () => {
      const { manager, filter } = setupPerception();

      // Create disguise secret - only cid(1) knows
      manager.createSecret({
        type: SecretType.DisguisedIdentity,
        groundTruth: {
          disguisedCharacterId: cid(10),
          trueIdentity: cid(99),
          falseIdentity: cid(10),
        },
        initialKnowers: [cid(1)],
        relatedEntities: [eid(10)],
        createdAt: 0,
      });

      const groundTruth: GroundTruthState = {
        characterIdentities: new Map([[cid(10), cid(99)]]),
        militaryStrengths: new Map(),
        artifactLocations: new Map(),
        entityWeaknesses: new Map(),
        activeConspiracies: new Map(),
        secretAlliances: [],
        prophecies: new Map(),
        forbiddenKnowledge: new Map(),
      };

      // Character who doesn't know sees the disguise
      const perceived2 = filter.getPerceivedState(cid(2), groundTruth);
      expect(perceived2.characterIdentities.get(cid(10))).toBe(cid(10)); // Sees disguise

      // Character who knows sees the truth
      const perceived1 = filter.getPerceivedState(cid(1), groundTruth);
      expect(perceived1.characterIdentities.get(cid(10))).toBe(cid(99)); // Sees truth
    });
  });

  describe('Military Perception', () => {
    it('should see actual strength when secret known', () => {
      const { manager, filter } = setupPerception();

      manager.createSecret({
        type: SecretType.MilitaryStrength,
        groundTruth: {
          factionId: fid(1),
          actualStrength: 5000,
          perceivedStrength: 3000,
        },
        initialKnowers: [cid(1)],
        relatedFactions: [fid(1)],
        createdAt: 0,
      });

      const groundTruth: GroundTruthState = {
        characterIdentities: new Map(),
        militaryStrengths: new Map([[fid(1), 5000]]),
        artifactLocations: new Map(),
        entityWeaknesses: new Map(),
        activeConspiracies: new Map(),
        secretAlliances: [],
        prophecies: new Map(),
        forbiddenKnowledge: new Map(),
      };

      // Knower sees actual strength
      const perceived = filter.getPerceivedState(cid(1), groundTruth);
      expect(perceived.militaryStrengths.get(fid(1))).toBe(5000);
    });
  });

  describe('Conspiracy Perception', () => {
    it('should only know conspiracies you are aware of', () => {
      const { manager, filter } = setupPerception();

      manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {
          conspiracyId: eid(100),
          target: cid(50),
        },
        initialKnowers: [cid(1)],
        relatedEntities: [eid(100)],
        createdAt: 0,
      });

      const groundTruth: GroundTruthState = {
        characterIdentities: new Map(),
        militaryStrengths: new Map(),
        artifactLocations: new Map(),
        entityWeaknesses: new Map(),
        activeConspiracies: new Map([[eid(100), eid(50)]]),
        secretAlliances: [],
        prophecies: new Map(),
        forbiddenKnowledge: new Map(),
      };

      // Knower is aware
      const perceived1 = filter.getPerceivedState(cid(1), groundTruth);
      expect(perceived1.knownConspiracies.has(eid(100))).toBe(true);

      // Non-knower is unaware
      const perceived2 = filter.getPerceivedState(cid(2), groundTruth);
      expect(perceived2.knownConspiracies.has(eid(100))).toBe(false);
    });
  });

  describe('Suspicion Tracking', () => {
    it('should include suspicions in perceived state', () => {
      const { manager, filter } = setupPerception();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(1)],
        createdAt: 0,
      });

      manager.addSuspicion(secret.id, cid(2), 50);

      const groundTruth = SecretPerceptionFilter.createEmptyGroundTruth();
      const perceived = filter.getPerceivedState(cid(2), groundTruth);

      expect(perceived.suspicions.get(secret.id)).toBe(50);
    });
  });

  describe('Empty Ground Truth', () => {
    it('should create valid empty ground truth', () => {
      const groundTruth = SecretPerceptionFilter.createEmptyGroundTruth();

      expect(groundTruth.characterIdentities).toBeInstanceOf(Map);
      expect(groundTruth.militaryStrengths).toBeInstanceOf(Map);
      expect(groundTruth.artifactLocations).toBeInstanceOf(Map);
      expect(groundTruth.entityWeaknesses).toBeInstanceOf(Map);
      expect(groundTruth.activeConspiracies).toBeInstanceOf(Map);
      expect(groundTruth.secretAlliances).toEqual([]);
      expect(groundTruth.prophecies).toBeInstanceOf(Map);
      expect(groundTruth.forbiddenKnowledge).toBeInstanceOf(Map);
    });
  });
});

// =============================================================================
// DISCOVERY ACTIONS TESTS
// =============================================================================

describe('DiscoveryActions', () => {
  beforeEach(() => {
    resetSecretIdCounters();
  });

  function setupDiscovery(): {
    manager: SecretManager;
    actions: DiscoveryActions;
    events: EventBus;
    emittedEvents: WorldEvent[];
    skillMap: Map<CharacterId, DiscoverySkills>;
  } {
    const manager = new SecretManager();
    const events = new EventBus();
    const emittedEvents: WorldEvent[] = [];
    const skillMap = new Map<CharacterId, DiscoverySkills>();

    // Default skills for all characters
    skillMap.set(cid(1), makeSkills({ investigation: 80, cunning: 70 }));
    skillMap.set(cid(2), makeSkills({ willpower: 30 })); // Weak prisoner
    skillMap.set(cid(3), makeSkills({ deduction: 90 })); // Scholar

    const skillProvider = (id: CharacterId) =>
      skillMap.get(id) ?? makeSkills();

    const actions = new DiscoveryActions(manager, skillProvider);

    for (const category of Object.values(EventCategory)) {
      events.on(category, (event) => emittedEvents.push(event));
    }

    return { manager, actions, events, emittedEvents, skillMap };
  }

  describe('Investigation', () => {
    it('should find secrets about target with high skill', () => {
      const { manager, actions, events, skillMap } = setupDiscovery();

      // Create secret about target
      manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: { target: 'king' },
        initialKnowers: [cid(10)], // Not the investigator
        relatedEntities: [eid(50)],
        createdAt: 0,
      });

      // Set very high investigation skill for determinism
      skillMap.set(cid(1), makeSkills({ investigation: 100, cunning: 100 }));

      // Run multiple attempts to get at least one success
      let foundSecret = false;
      for (let i = 0; i < 50; i++) {
        const result = actions.investigate(
          cid(1),
          eid(50),
          [SecretType.ConspiracyPlot],
          100,
          events,
        );
        if (result.discoveredSecrets.length > 0 || result.suspicionGained.size > 0) {
          foundSecret = true;
          break;
        }
      }

      expect(foundSecret).toBe(true);
    });

    it('should return no results for non-existent secrets', () => {
      const { actions, events } = setupDiscovery();

      const result = actions.investigate(
        cid(1),
        eid(999), // No secrets about this entity
        [SecretType.ConspiracyPlot],
        100,
        events,
      );

      expect(result.discoveredSecrets).toHaveLength(0);
      expect(result.narrative).toContain('no relevant secrets');
    });

    it('should emit investigation event', () => {
      const { manager, actions, events, emittedEvents } = setupDiscovery();

      manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(10)],
        relatedEntities: [eid(50)],
        createdAt: 0,
      });

      actions.investigate(cid(1), eid(50), [SecretType.ConspiracyPlot], 100, events);

      const investigationEvent = emittedEvents.find(
        (e) => e.subtype === 'secret.investigation_attempt',
      );
      expect(investigationEvent).toBeDefined();
    });
  });

  describe('Interrogation', () => {
    it('should extract secrets from weak-willed prisoner', () => {
      const { manager, actions, events, skillMap } = setupDiscovery();

      // Create secret known by prisoner
      manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: { target: 'king' },
        initialKnowers: [cid(2)], // The prisoner
        createdAt: 0,
      });

      // Strong interrogator vs weak prisoner
      skillMap.set(cid(1), makeSkills({ interrogation: 90, persuasion: 80 }));
      skillMap.set(cid(2), makeSkills({ willpower: 10, cunning: 10 }));

      // Multiple attempts for determinism
      let extracted = false;
      for (let i = 0; i < 30; i++) {
        const result = actions.interrogate(cid(1), cid(2), 100, events);
        if (result.discoveredSecrets.length > 0 || result.suspicionGained.size > 0) {
          extracted = true;
          break;
        }
      }

      expect(extracted).toBe(true);
    });

    it('should fail against strong-willed prisoner', () => {
      const { manager, actions, events, skillMap } = setupDiscovery();

      manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: {},
        initialKnowers: [cid(2)],
        createdAt: 0,
      });

      // Weak interrogator vs strong prisoner
      skillMap.set(cid(1), makeSkills({ interrogation: 20, persuasion: 20 }));
      skillMap.set(cid(2), makeSkills({ willpower: 95, cunning: 90 }));

      // Even after multiple attempts, mostly fails
      let failures = 0;
      for (let i = 0; i < 10; i++) {
        const result = actions.interrogate(cid(1), cid(2), 100, events);
        if (result.discoveredSecrets.length === 0) {
          failures++;
        }
      }

      expect(failures).toBeGreaterThan(7); // Mostly failures
    });

    it('should return no results when prisoner has no secrets', () => {
      const { actions, events } = setupDiscovery();

      const result = actions.interrogate(cid(1), cid(2), 100, events);

      expect(result.discoveredSecrets).toHaveLength(0);
      expect(result.narrative).toContain('no secrets');
    });
  });

  describe('Deduction', () => {
    it('should require minimum clues', () => {
      const { actions, events } = setupDiscovery();

      const result = actions.deduceFromClues(cid(3), [eid(1)], 100, events);

      expect(result.success).toBe(false);
      expect(result.narrative).toContain('Not enough clues');
    });

    it('should deduce from sufficient clues', () => {
      const { manager, actions, events } = setupDiscovery();

      const secret = manager.createSecret({
        type: SecretType.ConspiracyPlot,
        groundTruth: { target: 'king' },
        initialKnowers: [cid(10)],
        createdAt: 0,
      });

      // Create multiple clues about the secret
      const clue1 = manager.createClue(
        secret.id,
        'Strange meetings at midnight',
        0.4,
        cid(3),
        50,
      );
      const clue2 = manager.createClue(
        secret.id,
        'Hidden correspondence',
        0.5,
        cid(3),
        60,
      );

      expect(clue1).toBeDefined();
      expect(clue2).toBeDefined();

      // Multiple attempts with high deduction skill
      let deduced = false;
      for (let i = 0; i < 20; i++) {
        const result = actions.deduceFromClues(
          cid(3),
          [clue1!.id, clue2!.id],
          100,
          events,
        );
        if (result.discoveredSecrets.length > 0 || result.suspicionGained.size > 0) {
          deduced = true;
          break;
        }
      }

      expect(deduced).toBe(true);
    });
  });

  describe('Default Skill Provider', () => {
    it('should create provider returning average skills', () => {
      const provider = DiscoveryActions.createDefaultSkillProvider();
      const skills = provider(cid(1));

      expect(skills.investigation).toBe(50);
      expect(skills.interrogation).toBe(50);
      expect(skills.deduction).toBe(50);
      expect(skills.cunning).toBe(50);
      expect(skills.persuasion).toBe(50);
      expect(skills.willpower).toBe(50);
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Secret System Integration', () => {
  beforeEach(() => {
    resetSecretIdCounters();
  });

  it('should handle full lifecycle: create, suspect, discover, reveal', () => {
    const manager = new SecretManager();
    const events = new EventBus();
    const filter = new SecretPerceptionFilter(manager);
    const emittedEvents: WorldEvent[] = [];

    for (const category of Object.values(EventCategory)) {
      events.on(category, (event) => emittedEvents.push(event));
    }

    // Step 1: Create a conspiracy secret
    const secret = manager.createSecret({
      type: SecretType.ConspiracyPlot,
      groundTruth: { target: cid(50), method: 'assassination' },
      initialKnowers: [cid(1), cid(2)], // Conspirators
      relatedEntities: [eid(100)],
      createdAt: 0,
    });

    // Step 2: Someone suspects
    manager.addSuspicion(secret.id, cid(3), 40);
    expect(manager.getSuspicionLevel(cid(3), secret.id)).toBe(40);

    // Step 3: Check perception - non-knower doesn't know about conspiracy
    const groundTruth: GroundTruthState = {
      characterIdentities: new Map(),
      militaryStrengths: new Map(),
      artifactLocations: new Map(),
      entityWeaknesses: new Map(),
      activeConspiracies: new Map([[eid(100), cid(50) as unknown as EntityId]]),
      secretAlliances: [],
      prophecies: new Map(),
      forbiddenKnowledge: new Map(),
    };

    const perceivedByOutsider = filter.getPerceivedState(cid(3), groundTruth);
    expect(perceivedByOutsider.knownConspiracies.size).toBe(0);

    // Step 4: Increase suspicion to confirmation
    manager.addSuspicion(secret.id, cid(3), 85);
    expect(secret.knownBy.has(cid(3))).toBe(true);

    // Step 5: Now they know about it
    // Since they now know, they should have the secret in their known list
    expect(manager.doesCharacterKnow(cid(3), secret.id)).toBe(true);
    // Their suspicions should be empty now that they know the truth
    const perceivedAfterKnowing = filter.getPerceivedState(cid(3), groundTruth);
    expect(perceivedAfterKnowing.suspicions.size).toBe(0);

    // Step 6: Reveal the secret publicly
    manager.revealSecret(
      secret.id,
      RevelationMethod.Investigation,
      cid(3),
      [cid(4), cid(5)],
      200,
      events,
    );

    expect(secret.isRevealed).toBe(true);
    expect(secret.knownBy.has(cid(4))).toBe(true);
    expect(secret.knownBy.has(cid(5))).toBe(true);

    // Step 7: Check that revelation event was emitted
    const revelationEvents = emittedEvents.filter(
      (e) => e.subtype.includes('secret'),
    );
    expect(revelationEvents.length).toBeGreaterThan(0);
  });

  it('should generate high-significance cascade on major revelation', () => {
    const manager = new SecretManager();
    const events = new EventBus();
    const emittedEvents: WorldEvent[] = [];

    for (const category of Object.values(EventCategory)) {
      events.on(category, (event) => emittedEvents.push(event));
    }

    // Create high-significance conspiracy
    const secret = manager.createSecret({
      type: SecretType.ConspiracyPlot,
      groundTruth: { target: 'emperor', method: 'coup' },
      initialKnowers: [cid(1)],
      significance: 95, // Very significant
      createdAt: 0,
    });

    manager.revealSecret(
      secret.id,
      RevelationMethod.Betrayal,
      cid(1),
      [cid(2), cid(3), cid(4)],
      100,
      events,
    );

    // Should have emitted both general and type-specific events
    const generalEvent = emittedEvents.find((e) => e.subtype === 'secret.revealed');
    const typeEvent = emittedEvents.find(
      (e) => e.subtype === 'secret.conspiracy_exposed',
    );

    expect(generalEvent).toBeDefined();
    expect(generalEvent?.significance).toBe(95);
    expect(typeEvent).toBeDefined();
    expect(typeEvent?.significance).toBe(105); // +10 for conspiracy
  });

  it('should handle investigation discovering secrets', () => {
    const manager = new SecretManager();
    const events = new EventBus();

    const skillProvider = (_id: CharacterId) => ({
      investigation: 100, // Max skill for determinism
      interrogation: 50,
      deduction: 50,
      cunning: 100,
      persuasion: 50,
      willpower: 50,
    });

    const actions = new DiscoveryActions(manager, skillProvider);

    // Create secret about a target
    manager.createSecret({
      type: SecretType.MilitaryStrength,
      groundTruth: {
        factionId: fid(1),
        actualStrength: 10000,
        perceivedStrength: 5000,
      },
      initialKnowers: [cid(10)],
      relatedEntities: [eid(1)],
      relatedFactions: [fid(1)],
      createdAt: 0,
    });

    // Investigate multiple times
    let discovered = false;
    for (let i = 0; i < 100; i++) {
      const result = actions.investigate(
        cid(1),
        eid(1),
        [SecretType.MilitaryStrength],
        i,
        events,
      );
      if (result.discoveredSecrets.length > 0) {
        discovered = true;
        break;
      }
    }

    expect(discovered).toBe(true);
  });
});
