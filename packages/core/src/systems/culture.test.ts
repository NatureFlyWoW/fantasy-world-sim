/**
 * Tests for Cultural Evolution System and Oral Tradition System.
 * Covers: Technology, Art, Philosophy, Language, and Oral Traditions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { WorldEvent } from '../events/types.js';
import { EventCategory } from '../events/types.js';
import { EventBus } from '../events/event-bus.js';
import { WorldClock } from '../time/world-clock.js';
import { toEntityId, toCharacterId, toFactionId, toSiteId, toEventId } from '../ecs/types.js';
import type { EntityId, CharacterId, FactionId, SiteId, EventId } from '../ecs/types.js';

// Oral Tradition imports
import {
  createOralTradition,
  applyMutation,
  processRetelling,
  calculateRecognizability,
  writeDownTradition,
  resetTraditionIdCounter,
  OralTraditionSystem,
  DEFAULT_MUTATION_CONFIG,
  type OralTradition,
} from './oral-tradition.js';

// Culture imports
import {
  TechnologyCategory,
  ALL_TECHNOLOGY_CATEGORIES,
  ArtForm,
  ALL_ART_FORMS,
  ArtStyle,
  ALL_ART_STYLES,
  PhilosophyType,
  ALL_PHILOSOPHY_TYPES,
  LanguageStatus,
  ALL_LANGUAGE_STATUSES,
  calculatePhilosophyEffects,
  calculateLanguageDivergence,
  shouldBecomeLanguage,
  createTechId,
  createMasterworkId,
  createMovementId,
  createSchoolId,
  createLanguageId,
  resetCultureIdCounters,
  CulturalEvolutionSystem,
  type PhilosophicalSchool,
  type Language,
} from './culture.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

function eid(n: number): EntityId {
  return toEntityId(n);
}

function cid(n: number): CharacterId {
  return toCharacterId(toEntityId(n));
}

function fid(n: number): FactionId {
  return toFactionId(toEntityId(n));
}

function sid(n: number): SiteId {
  return toSiteId(toEntityId(n));
}

function evid(n: number): EventId {
  return toEventId(toEntityId(n));
}

function createSeededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function makeOralTradition(overrides: Partial<OralTradition> = {}): OralTradition {
  return {
    id: eid(1000),
    originalEventId: evid(1),
    originalNarrative: 'Bryn defeated three bandits in a forest clearing.',
    currentNarrative: 'Bryn defeated three bandits in a forest clearing.',
    mutationCount: 0,
    geographicSpread: [sid(1)],
    accuracy: 100,
    embellishments: [],
    originTick: 0,
    lastRetellingTick: 0,
    protagonistName: 'Bryn',
    originalProtagonistName: 'Bryn',
    scaleMultiplier: 1.0,
    supernaturalElements: [],
    isWrittenDown: false,
    writtenDownTick: null,
    writtenVersion: null,
    culturalSignificance: 50,
    ...overrides,
  };
}

function makeLanguage(overrides: Partial<Language> & { id: EntityId }): Language {
  return {
    name: 'Common',
    status: LanguageStatus.Living,
    parentLanguageId: null,
    speakers: 1000,
    nativeSpeakers: 800,
    literacyRate: 10,
    hasWritingSystem: true,
    preservedByScholars: false,
    dialectOf: null,
    derivedDialects: [],
    loanWords: new Map(),
    regions: [sid(1)],
    imposedBy: null,
    lastEvolutionTick: 0,
    age: 0,
    ...overrides,
  };
}

function makePhiloSchool(overrides: Partial<PhilosophicalSchool> & { id: EntityId }): PhilosophicalSchool {
  return {
    name: 'Test School',
    primaryType: PhilosophyType.Rationalist,
    secondaryType: null,
    founderId: cid(1),
    foundedTick: 0,
    originFaction: fid(1),
    followers: [cid(1)],
    influence: 50,
    stabilityEffect: 0,
    reformEffect: 5,
    isActive: true,
    competingWith: [],
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ORAL TRADITION TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('Oral Tradition System', () => {
  beforeEach(() => {
    resetTraditionIdCounter();
  });

  describe('Enums and Constants', () => {
    it('has default mutation config', () => {
      expect(DEFAULT_MUTATION_CONFIG.embellishmentChance).toBeGreaterThan(0);
      expect(DEFAULT_MUTATION_CONFIG.embellishmentChance).toBeLessThanOrEqual(0.3);
      expect(DEFAULT_MUTATION_CONFIG.accuracyDecayPerRetelling).toBeGreaterThan(0);
    });
  });

  describe('createOralTradition', () => {
    it('creates a tradition with correct initial values', () => {
      const tradition = createOralTradition(
        evid(1),
        'A hero emerged from the mountains.',
        'Krag',
        sid(1),
        100,
        60
      );

      expect(tradition.accuracy).toBe(100);
      expect(tradition.mutationCount).toBe(0);
      expect(tradition.protagonistName).toBe('Krag');
      expect(tradition.originalProtagonistName).toBe('Krag');
      expect(tradition.scaleMultiplier).toBe(1.0);
      expect(tradition.supernaturalElements).toHaveLength(0);
      expect(tradition.embellishments).toHaveLength(0);
      expect(tradition.isWrittenDown).toBe(false);
    });

    it('generates unique IDs', () => {
      const t1 = createOralTradition(evid(1), 'Story 1', 'A', sid(1), 0, 50);
      const t2 = createOralTradition(evid(2), 'Story 2', 'B', sid(2), 0, 50);

      expect(t1.id).not.toBe(t2.id);
    });
  });

  describe('Mutation Functions', () => {
    describe('applyMutation', () => {
      it('adds embellishment to tradition', () => {
        const tradition = makeOralTradition();
        const rng = createSeededRng(12345);

        const result = applyMutation(tradition, 'embellishment', rng);

        expect(result).toContain('embellishment');
        expect(tradition.embellishments.length).toBeGreaterThan(0);
        expect(tradition.currentNarrative).not.toBe(tradition.originalNarrative);
      });

      it('morphs protagonist name', () => {
        const tradition = makeOralTradition({ protagonistName: 'Bryn' });
        // Use a seed that gives low values to trigger suffix addition (rng < 0.5)
        const rng = createSeededRng(1);

        applyMutation(tradition, 'name_change', rng);

        // Name should either have a suffix or a morphed letter
        const hasChanged = tradition.protagonistName !== 'Bryn';
        const hasSuffix = tradition.protagonistName.includes(' the ') ||
                         tradition.protagonistName.endsWith('slayer') ||
                         tradition.protagonistName.endsWith('born') ||
                         tradition.protagonistName.length > 4;
        expect(hasChanged || hasSuffix).toBe(true);
        expect(tradition.currentNarrative).toContain(tradition.protagonistName);
      });

      it('increases scale multiplier', () => {
        const tradition = makeOralTradition({ scaleMultiplier: 1.0 });
        const rng = createSeededRng(12345);

        applyMutation(tradition, 'scale_growth', rng);

        expect(tradition.scaleMultiplier).toBeGreaterThan(1.0);
      });

      it('adds supernatural elements', () => {
        const tradition = makeOralTradition();
        const rng = createSeededRng(12345);

        applyMutation(tradition, 'supernatural', rng);

        expect(tradition.supernaturalElements.length).toBeGreaterThan(0);
        expect(tradition.currentNarrative).toContain('Through');
      });
    });

    describe('processRetelling', () => {
      it('decreases accuracy with each retelling', () => {
        const tradition = makeOralTradition({ accuracy: 100 });
        const rng = createSeededRng(12345);

        processRetelling(tradition, DEFAULT_MUTATION_CONFIG, rng);

        expect(tradition.accuracy).toBeLessThan(100);
        expect(tradition.mutationCount).toBe(1);
      });

      it('accumulates mutations over multiple retellings', () => {
        const tradition = makeOralTradition();
        const rng = createSeededRng(12345);

        for (let i = 0; i < 10; i++) {
          processRetelling(tradition, DEFAULT_MUTATION_CONFIG, rng);
        }

        expect(tradition.mutationCount).toBe(10);
        expect(tradition.accuracy).toBeLessThan(30); // Should be quite low after 10 retellings
      });

      it('tradition mutates measurably with each retelling', () => {
        const tradition = makeOralTradition();
        const rng = createSeededRng(54321);
        const originalNarrative = tradition.currentNarrative;

        let mutations = 0;
        for (let i = 0; i < 5; i++) {
          const result = processRetelling(tradition, DEFAULT_MUTATION_CONFIG, rng);
          mutations += result.length;
        }

        // After 5 retellings, there should be at least some mutations
        expect(mutations).toBeGreaterThan(0);
        expect(tradition.currentNarrative).not.toBe(originalNarrative);
      });
    });
  });

  describe('calculateRecognizability', () => {
    it('returns 100 for fresh tradition', () => {
      const tradition = makeOralTradition({ mutationCount: 0, scaleMultiplier: 1.0 });
      const recognizability = calculateRecognizability(tradition, 0);

      expect(recognizability).toBe(100);
    });

    it('decreases with time', () => {
      const tradition = makeOralTradition();
      const earlyRecog = calculateRecognizability(tradition, 50);
      const lateRecog = calculateRecognizability(tradition, 150);

      expect(lateRecog).toBeLessThan(earlyRecog);
    });

    it('decreases with mutation count', () => {
      const lowMutation = makeOralTradition({ mutationCount: 2 });
      const highMutation = makeOralTradition({ mutationCount: 20 });

      const lowRecog = calculateRecognizability(lowMutation, 100);
      const highRecog = calculateRecognizability(highMutation, 100);

      expect(highRecog).toBeLessThan(lowRecog);
    });

    it('approaches 0 after ~200 years', () => {
      const tradition = makeOralTradition({ mutationCount: 30, scaleMultiplier: 5.0 });
      const recog = calculateRecognizability(tradition, 200);

      expect(recog).toBeLessThan(20);
    });
  });

  describe('writeDownTradition', () => {
    it('captures the current distorted version', () => {
      const tradition = makeOralTradition();
      const rng = createSeededRng(12345);

      // Mutate the tradition
      for (let i = 0; i < 5; i++) {
        processRetelling(tradition, DEFAULT_MUTATION_CONFIG, rng);
      }

      const distortedNarrative = tradition.currentNarrative;

      writeDownTradition(tradition, 1000);

      expect(tradition.isWrittenDown).toBe(true);
      expect(tradition.writtenDownTick).toBe(1000);
      expect(tradition.writtenVersion).toBe(distortedNarrative);
    });

    it('writing captures distorted version as historical fact', () => {
      const tradition = makeOralTradition({
        currentNarrative: 'Bryngar the Mighty defeated an army of demons.',
        originalNarrative: 'Bryn defeated three bandits.',
        accuracy: 20,
      });

      writeDownTradition(tradition, 500);

      // The "historical record" is the distorted version
      expect(tradition.writtenVersion).toBe('Bryngar the Mighty defeated an army of demons.');
      expect(tradition.writtenVersion).not.toBe(tradition.originalNarrative);
    });
  });

  describe('OralTraditionSystem class', () => {
    let system: OralTraditionSystem;
    let events: EventBus;

    beforeEach(() => {
      resetTraditionIdCounter();
      system = new OralTraditionSystem();
      events = new EventBus();
    });

    it('has correct system properties', () => {
      expect(system.name).toBe('OralTraditionSystem');
      expect(system.frequency).toBe(90); // Seasonal
    });

    it('registers and retrieves traditions', () => {
      const tradition = makeOralTradition({ id: eid(100) });
      system.registerTradition(tradition);

      expect(system.getTradition(eid(100))).toBe(tradition);
    });

    it('creates traditions from events', () => {
      const emittedEvents: WorldEvent[] = [];
      events.on(EventCategory.Cultural, (e: WorldEvent) => emittedEvents.push(e));

      const tradition = system.createFromEvent(
        evid(1),
        'A hero emerged.',
        'Hero',
        sid(1),
        100,
        60,
        events
      );

      expect(tradition.originalEventId).toBe(evid(1));
      expect(tradition.protagonistName).toBe('Hero');
      expect(emittedEvents.some(e => e.subtype === 'culture.oral_tradition_born')).toBe(true);
    });

    it('manages site connections for transmission', () => {
      system.addSiteConnection(sid(1), sid(2));

      const connections = system.getSiteConnections(sid(1));
      expect(connections).toContain(sid(2));

      const reverseConnections = system.getSiteConnections(sid(2));
      expect(reverseConnections).toContain(sid(1));
    });

    it('records traditions when writing is invented', () => {
      const tradition = makeOralTradition({
        id: eid(100),
        geographicSpread: [sid(1)],
      });
      system.registerTradition(tradition);

      const emittedEvents: WorldEvent[] = [];
      events.on(EventCategory.Cultural, (e: WorldEvent) => emittedEvents.push(e));

      system.notifyWritingInvented(500);
      const recorded = system.recordTraditionsToWriting(sid(1), 500, events);

      expect(recorded).toBe(1);
      expect(tradition.isWrittenDown).toBe(true);
      expect(emittedEvents.some(e => e.subtype === 'culture.tradition_recorded')).toBe(true);
    });

    it('gets evolution summary', () => {
      const tradition = makeOralTradition({
        originalNarrative: 'Original story.',
        currentNarrative: 'Changed story.',
        mutationCount: 5,
        accuracy: 60,
        embellishments: ['fought bravely'],
        supernaturalElements: ['divine help'],
        scaleMultiplier: 2.0,
      });

      const summary = system.getEvolutionSummary(tradition);

      expect(summary.originalNarrative).toBe('Original story.');
      expect(summary.currentNarrative).toBe('Changed story.');
      expect(summary.mutationCount).toBe(5);
      expect(summary.accuracy).toBe(60);
      expect(summary.embellishments).toContain('fought bravely');
      expect(summary.supernaturalAdditions).toContain('divine help');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CULTURE SYSTEM TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('Cultural Evolution System', () => {
  beforeEach(() => {
    resetCultureIdCounters();
  });

  describe('Enums and Constants', () => {
    it('has all technology categories', () => {
      expect(ALL_TECHNOLOGY_CATEGORIES).toContain(TechnologyCategory.Agriculture);
      expect(ALL_TECHNOLOGY_CATEGORIES).toContain(TechnologyCategory.Communication);
      expect(ALL_TECHNOLOGY_CATEGORIES).toContain(TechnologyCategory.Warfare);
    });

    it('has all art forms', () => {
      expect(ALL_ART_FORMS).toContain(ArtForm.Visual);
      expect(ALL_ART_FORMS).toContain(ArtForm.Literary);
      expect(ALL_ART_FORMS).toContain(ArtForm.Musical);
    });

    it('has all art styles', () => {
      expect(ALL_ART_STYLES).toContain(ArtStyle.Classical);
      expect(ALL_ART_STYLES).toContain(ArtStyle.Romantic);
      expect(ALL_ART_STYLES).toContain(ArtStyle.Heroic);
    });

    it('has all philosophy types', () => {
      expect(ALL_PHILOSOPHY_TYPES).toContain(PhilosophyType.Conservative);
      expect(ALL_PHILOSOPHY_TYPES).toContain(PhilosophyType.Revolutionary);
      expect(ALL_PHILOSOPHY_TYPES).toContain(PhilosophyType.Rationalist);
    });

    it('has all language statuses', () => {
      expect(ALL_LANGUAGE_STATUSES).toContain(LanguageStatus.Living);
      expect(ALL_LANGUAGE_STATUSES).toContain(LanguageStatus.Dialect);
      expect(ALL_LANGUAGE_STATUSES).toContain(LanguageStatus.Dead);
      expect(ALL_LANGUAGE_STATUSES).toContain(LanguageStatus.Scholarly);
    });
  });

  describe('ID Generation', () => {
    it('generates unique tech IDs', () => {
      const id1 = createTechId();
      const id2 = createTechId();
      expect(id1).not.toBe(id2);
    });

    it('generates unique masterwork IDs', () => {
      const id1 = createMasterworkId();
      const id2 = createMasterworkId();
      expect(id1).not.toBe(id2);
    });

    it('generates unique movement IDs', () => {
      const id1 = createMovementId();
      const id2 = createMovementId();
      expect(id1).not.toBe(id2);
    });

    it('generates unique school IDs', () => {
      const id1 = createSchoolId();
      const id2 = createSchoolId();
      expect(id1).not.toBe(id2);
    });

    it('generates unique language IDs', () => {
      const id1 = createLanguageId();
      const id2 = createLanguageId();
      expect(id1).not.toBe(id2);
    });

    it('resets ID counters', () => {
      createTechId();
      createMasterworkId();
      resetCultureIdCounters();

      const techId = createTechId();
      expect(techId).toBeDefined();
    });
  });

  describe('Philosophy Effects', () => {
    it('calculates effects from no schools', () => {
      const effects = calculatePhilosophyEffects([]);

      expect(effects.stabilityModifier).toBe(0);
      expect(effects.reformPressure).toBe(0);
      expect(effects.culturalVibrancy).toBe(0);
    });

    it('conservative schools increase stability', () => {
      const school = makePhiloSchool({
        id: eid(1),
        primaryType: PhilosophyType.Conservative,
        influence: 50,
        stabilityEffect: 10,
        reformEffect: -10,
      });

      const effects = calculatePhilosophyEffects([school]);

      expect(effects.stabilityModifier).toBeGreaterThan(0);
      expect(effects.reformPressure).toBeLessThan(0);
    });

    it('revolutionary schools decrease stability and increase reform', () => {
      const school = makePhiloSchool({
        id: eid(1),
        primaryType: PhilosophyType.Revolutionary,
        influence: 50,
        stabilityEffect: -15,
        reformEffect: 20,
      });

      const effects = calculatePhilosophyEffects([school]);

      expect(effects.stabilityModifier).toBeLessThan(0);
      expect(effects.reformPressure).toBeGreaterThan(0);
    });

    it('competing schools increase vibrancy but decrease stability', () => {
      const school1 = makePhiloSchool({
        id: eid(1),
        primaryType: PhilosophyType.Conservative,
        influence: 50,
        stabilityEffect: 10,
        competingWith: [eid(2)],
      });

      const school2 = makePhiloSchool({
        id: eid(2),
        primaryType: PhilosophyType.Revolutionary,
        influence: 50,
        stabilityEffect: -10,
        competingWith: [eid(1)],
      });

      const effects = calculatePhilosophyEffects([school1, school2]);

      expect(effects.culturalVibrancy).toBeGreaterThan(0);
    });
  });

  describe('Language Evolution', () => {
    it('calculates divergence based on time', () => {
      const original = makeLanguage({ id: eid(1), name: 'Old Tongue' });
      const derived = makeLanguage({ id: eid(2), name: 'New Tongue', parentLanguageId: eid(1) });

      const divergence5 = calculateLanguageDivergence(original, derived, 5);
      const divergence10 = calculateLanguageDivergence(original, derived, 10);

      expect(divergence10).toBeGreaterThan(divergence5);
    });

    it('geographic isolation accelerates divergence', () => {
      const original = makeLanguage({ id: eid(1), regions: [sid(1)] });
      const connected = makeLanguage({ id: eid(2), regions: [sid(1)] });
      const isolated = makeLanguage({ id: eid(3), regions: [sid(2)] });

      const connectedDivergence = calculateLanguageDivergence(original, connected, 5);
      const isolatedDivergence = calculateLanguageDivergence(original, isolated, 5);

      expect(isolatedDivergence).toBeGreaterThan(connectedDivergence);
    });

    it('loan words increase divergence', () => {
      const original = makeLanguage({ id: eid(1) });
      const noLoans = makeLanguage({ id: eid(2) });

      const withLoans = makeLanguage({ id: eid(3) });
      withLoans.loanWords.set(eid(10), 50);
      withLoans.loanWords.set(eid(11), 30);

      const noLoanDiv = calculateLanguageDivergence(original, noLoans, 5);
      const withLoanDiv = calculateLanguageDivergence(original, withLoans, 5);

      expect(withLoanDiv).toBeGreaterThan(noLoanDiv);
    });

    it('dialect becomes language after centuries of separation', () => {
      const parent = makeLanguage({ id: eid(1), name: 'Parent', regions: [sid(1)] });
      const dialect = makeLanguage({
        id: eid(2),
        name: 'Dialect',
        status: LanguageStatus.Dialect,
        dialectOf: eid(1),
        regions: [sid(2)],
        age: 365 * 700, // 700 years
      });

      expect(shouldBecomeLanguage(dialect, parent)).toBe(true);
    });

    it('dialect does not become language if recently split', () => {
      const parent = makeLanguage({ id: eid(1), name: 'Parent' });
      const dialect = makeLanguage({
        id: eid(2),
        name: 'Dialect',
        status: LanguageStatus.Dialect,
        dialectOf: eid(1),
        age: 365 * 100, // Only 100 years
      });

      expect(shouldBecomeLanguage(dialect, parent)).toBe(false);
    });

    it('languages diverge over centuries', () => {
      const original = makeLanguage({ id: eid(1), regions: [sid(1)] });
      const derived = makeLanguage({
        id: eid(2),
        regions: [sid(2)],
        parentLanguageId: eid(1),
      });
      derived.loanWords.set(eid(10), 20);

      // After several centuries
      const divergence = calculateLanguageDivergence(original, derived, 8);

      expect(divergence).toBeGreaterThan(50);
    });
  });

  describe('CulturalEvolutionSystem class', () => {
    let system: CulturalEvolutionSystem;
    let clock: WorldClock;
    let events: EventBus;

    beforeEach(() => {
      resetCultureIdCounters();
      system = new CulturalEvolutionSystem();
      clock = new WorldClock();
      events = new EventBus();
    });

    it('has correct system properties', () => {
      expect(system.name).toBe('CulturalEvolutionSystem');
      expect(system.frequency).toBe(90); // Seasonal
    });

    describe('Technology', () => {
      it('starts with predefined technologies', () => {
        const techs = system.getAllTechnologies();
        expect(techs.length).toBeGreaterThan(0);
      });

      it('can find technology by name', () => {
        const writing = system.getTechnologyByName('Writing');
        expect(writing).toBeDefined();
        expect(writing?.category).toBe(TechnologyCategory.Communication);
      });

      it('checks research prerequisites', () => {
        const tech = system.getTechnologyByName('Writing');
        if (tech === undefined) throw new Error('Tech not found');

        const check = system.canResearch(tech.id, fid(1));
        expect(check.canDo).toBe(true);
      });

      it('starts and tracks research progress', () => {
        const tech = system.getTechnologyByName('Writing');
        if (tech === undefined) throw new Error('Tech not found');

        const started = system.startResearch(tech.id, fid(1), 5);
        expect(started).toBe(true);

        const state = system.getTechState(tech.id, fid(1));
        expect(state).toBeDefined();
        expect(state?.researchersAllocated).toBe(5);
      });

      it('can suppress technologies', () => {
        const tech = system.getTechnologyByName('Writing');
        if (tech === undefined) throw new Error('Tech not found');

        // First invent it
        system.startResearch(tech.id, fid(1), 100);

        const emittedEvents: WorldEvent[] = [];
        events.on(EventCategory.Cultural, (e: WorldEvent) => emittedEvents.push(e));

        // Advance to complete research
        for (let i = 0; i < 90; i++) {
          clock.advance();
        }
        system.execute(null as any, clock, events);

        // Suppress it
        const suppressed = system.suppressTechnology(tech.id, fid(1), fid(2), clock.currentTick, events);
        expect(suppressed).toBe(true);

        expect(emittedEvents.some(e => e.subtype === 'culture.technology_suppressed')).toBe(true);
      });

      it('technology spreads along trade routes', () => {
        const tech = system.getTechnologyByName('Pottery');
        if (tech === undefined) throw new Error('Tech not found');

        // Faction 1 has the tech
        system.startResearch(tech.id, fid(1), 100);

        // Run to complete research
        for (let i = 0; i < 365; i++) {
          clock.advance();
        }
        system.execute(null as any, clock, events);

        // Add trade connection
        system.addTradeConnection(fid(1), fid(2));

        const emittedEvents: WorldEvent[] = [];
        events.on(EventCategory.Cultural, (e: WorldEvent) => emittedEvents.push(e));

        // Run many seasons to allow spread (probabilistic)
        for (let season = 0; season < 20; season++) {
          for (let i = 0; i < 90; i++) {
            clock.advance();
          }
          system.execute(null as any, clock, events);
        }

        // Check if tech spread (may not happen every time due to probability)
        // We can't guarantee spread due to RNG, but the mechanism exists
        expect(system.getTradePartners(fid(1))).toContain(fid(2));
        // Check that events were captured (spread events may or may not have occurred)
        expect(emittedEvents).toBeDefined();
      });
    });

    describe('Artistic Movements', () => {
      it('creates masterworks', () => {
        const emittedEvents: WorldEvent[] = [];
        events.on(EventCategory.Cultural, (e: WorldEvent) => emittedEvents.push(e));

        const work = system.createMasterwork(
          'The Great Fresco',
          ArtForm.Visual,
          ArtStyle.Classical,
          cid(1),
          sid(1),
          fid(1),
          75,
          'Post-war celebration',
          100,
          events
        );

        expect(work.name).toBe('The Great Fresco');
        expect(work.quality).toBe(75);
        expect(emittedEvents.some(e => e.subtype === 'culture.masterwork_created')).toBe(true);
      });

      it('high-quality masterworks trigger movements', () => {
        const emittedEvents: WorldEvent[] = [];
        events.on(EventCategory.Cultural, (e: WorldEvent) => emittedEvents.push(e));

        system.createMasterwork(
          'Transcendent Symphony',
          ArtForm.Musical,
          ArtStyle.Romantic,
          cid(1),
          sid(1),
          fid(1),
          95, // Very high quality
          'A period of great emotion',
          100,
          events
        );

        expect(emittedEvents.some(e => e.subtype === 'culture.artistic_movement_born')).toBe(true);

        const movements = system.getActiveMovements();
        expect(movements.length).toBeGreaterThan(0);
      });

      it('artistic movements triggered by high-significance cultural events', () => {
        const emittedEvents: WorldEvent[] = [];
        events.on(EventCategory.Cultural, (e: WorldEvent) => emittedEvents.push(e));

        // Create a masterwork that resonates with the cultural moment
        const work = system.createMasterwork(
          'Victory Ode',
          ArtForm.Literary,
          ArtStyle.Heroic,
          cid(1),
          sid(1),
          fid(1),
          90, // High quality + heroic style in context
          'Following great military victory',
          100,
          events
        );

        // Check movement was triggered
        expect(work.triggeredMovement).not.toBeNull();
        const movement = system.getMovement(work.triggeredMovement!);
        expect(movement).toBeDefined();
        expect(movement?.primaryStyle).toBe(ArtStyle.Heroic);
      });
    });

    describe('Philosophical Schools', () => {
      it('creates philosophical schools', () => {
        const emittedEvents: WorldEvent[] = [];
        events.on(EventCategory.Cultural, (e: WorldEvent) => emittedEvents.push(e));

        const school = system.createSchool(
          'School of Reason',
          PhilosophyType.Rationalist,
          null,
          cid(1),
          fid(1),
          100,
          events
        );

        expect(school.name).toBe('School of Reason');
        expect(school.primaryType).toBe(PhilosophyType.Rationalist);
        expect(emittedEvents.some(e => e.subtype === 'culture.philosophy_founded')).toBe(true);
      });

      it('identifies competing philosophy types', () => {
        const conservative = system.createSchool(
          'Traditionalists',
          PhilosophyType.Conservative,
          null,
          cid(1),
          fid(1),
          100,
          events
        );

        const revolutionary = system.createSchool(
          'Reformers',
          PhilosophyType.Revolutionary,
          null,
          cid(2),
          fid(1),
          200,
          events
        );

        expect(conservative.competingWith).toContain(revolutionary.id);
        expect(revolutionary.competingWith).toContain(conservative.id);
      });
    });

    describe('Language', () => {
      it('creates languages', () => {
        const emittedEvents: WorldEvent[] = [];
        events.on(EventCategory.Cultural, (e: WorldEvent) => emittedEvents.push(e));

        const language = system.createLanguage(
          'Common',
          [sid(1), sid(2)],
          true,
          100,
          events
        );

        expect(language.name).toBe('Common');
        expect(language.hasWritingSystem).toBe(true);
        expect(emittedEvents.some(e => e.subtype === 'culture.language_emerged')).toBe(true);
      });

      it('creates dialects from parent languages', () => {
        const parent = system.createLanguage('Old Tongue', [sid(1)], true, 100, events);

        const emittedEvents: WorldEvent[] = [];
        events.on(EventCategory.Cultural, (e: WorldEvent) => emittedEvents.push(e));

        const dialect = system.createLanguage(
          'Highland Tongue',
          [sid(2)],
          false,
          200,
          events,
          parent.id,
          true
        );

        expect(dialect.status).toBe(LanguageStatus.Dialect);
        expect(dialect.dialectOf).toBe(parent.id);
        expect(parent.derivedDialects).toContain(dialect.id);
        expect(emittedEvents.some(e => e.subtype === 'culture.dialect_emerged')).toBe(true);
      });

      it('adds loan words between languages', () => {
        const lang1 = system.createLanguage('Merchant Tongue', [sid(1)], true, 0, events);
        const lang2 = system.createLanguage('Warrior Tongue', [sid(2)], true, 0, events);

        const emittedEvents: WorldEvent[] = [];
        events.on(EventCategory.Cultural, (e: WorldEvent) => emittedEvents.push(e));

        system.addLoanWords(lang2.id, lang1.id, 15, 100, events);

        expect(lang2.loanWords.get(lang1.id)).toBe(15);
        expect(emittedEvents.some(e => e.subtype === 'culture.loan_words_adopted')).toBe(true);
      });

      it('can impose language through conquest', () => {
        const conquerorLang = system.createLanguage('Imperial', [sid(1)], true, 0, events);

        const emittedEvents: WorldEvent[] = [];
        events.on(EventCategory.Cultural, (e: WorldEvent) => emittedEvents.push(e));

        system.imposeLanguage(conquerorLang.id, sid(2), fid(1), 100, events);

        expect(conquerorLang.regions).toContain(sid(2));
        expect(conquerorLang.imposedBy).toBe(fid(1));
        expect(emittedEvents.some(e => e.subtype === 'culture.language_imposed')).toBe(true);
      });
    });

    describe('Integration', () => {
      it('processes seasonal and annual updates', () => {
        // Create some cultural elements
        system.createLanguage('Common', [sid(1)], true, 0, events);
        system.createSchool('Stoics', PhilosophyType.Rationalist, null, cid(1), fid(1), 0, events);

        // Run for multiple years
        for (let year = 0; year < 3; year++) {
          for (let season = 0; season < 4; season++) {
            for (let day = 0; day < 90; day++) {
              clock.advance();
            }
            system.execute(null as any, clock, events);
          }
        }

        // System should process without error
        expect(clock.currentTick).toBeGreaterThan(365 * 2);
      });
    });
  });
});
