/**
 * Tests for NarrativeEngine.
 */

import { describe, it, expect } from 'vitest';
import { NarrativeEngine } from './narrative-engine.js';
import type { NarrativeTemplate, EntityResolver, ResolvedEntity, TemplateContext } from '../templates/types.js';
import { NarrativeTone } from '../templates/types.js';
import { EventCategory, toEntityId, toEventId, toSiteId, ArcPhase } from '@fws/core';
import type { WorldEvent, World } from '@fws/core';
import { WorldClock } from '@fws/core';

describe('NarrativeEngine', () => {
  // Helper to create mock world event
  function createEvent(overrides: Partial<WorldEvent> = {}): WorldEvent {
    return {
      id: toEventId(toEntityId(1)),
      category: EventCategory.Political,
      subtype: 'coronation',
      timestamp: 100,
      participants: [toEntityId(1)],
      location: toSiteId(toEntityId(10)),
      causes: [],
      consequences: [],
      data: {},
      significance: 50,
      consequencePotential: [],
      ...overrides,
    };
  }

  // Helper to create mock resolver
  function createResolver(entities: Record<string, ResolvedEntity> = {}): EntityResolver {
    return {
      resolveCharacter: (id: number) => entities[`character${id}`],
      resolveFaction: (id: number) => entities[`faction${id}`],
      resolveSite: (id: number) => entities[`site${id}`],
      resolveArtifact: (id: number) => entities[`artifact${id}`],
      resolveDeity: (id: number) => entities[`deity${id}`],
    };
  }

  // Helper to create template context
  function createContext(event: WorldEvent, _resolver?: EntityResolver): TemplateContext {
    return {
      event,
      world: {} as World,
      clock: new WorldClock(),
    };
  }

  describe('template selection', () => {
    it('should select template matching category and subtype', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.coronation',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'A coronation occurred.',
          requiredContext: [],
        },
        {
          id: 'test.battle',
          category: EventCategory.Military,
          subtype: 'battle',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'A battle occurred.',
          requiredContext: [],
        },
      ];

      const engine = new NarrativeEngine(templates);
      const event = createEvent({ category: EventCategory.Political, subtype: 'coronation' });
      const result = engine.generateNarrative(createContext(event));

      expect(result.templateId).toBe('test.coronation');
      expect(result.body).toContain('coronation');
    });

    it('should select template matching significance range', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.low',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 40 },
          template: 'A minor coronation.',
          requiredContext: [],
        },
        {
          id: 'test.high',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 70, max: 100 },
          template: 'A grand coronation!',
          requiredContext: [],
        },
      ];

      const engine = new NarrativeEngine(templates);

      const lowEvent = createEvent({ significance: 20 });
      const lowResult = engine.generateNarrative(createContext(lowEvent));
      expect(lowResult.body).toContain('minor');

      const highEvent = createEvent({ significance: 85 });
      const highResult = engine.generateNarrative(createContext(highEvent));
      expect(highResult.body).toContain('grand');
    });

    it('should fall back to category default when subtype not found', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.default',
          category: EventCategory.Political,
          subtype: 'default',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'A political event occurred.',
          requiredContext: [],
        },
      ];

      const engine = new NarrativeEngine(templates);
      const event = createEvent({ subtype: 'unknown_subtype' });
      const result = engine.generateNarrative(createContext(event));

      expect(result.templateId).toBe('test.default');
    });

    it('should fall back to global fallback when no template matches', () => {
      const engine = new NarrativeEngine([]);
      const event = createEvent();
      const result = engine.generateNarrative(createContext(event));

      expect(result.templateId).toBe('__global_fallback__');
    });

    it('should match templates with prefixed event subtypes', () => {
      // Templates use simple subtypes like "technology_invention"
      // but simulation events use prefixed subtypes like "culture.technology_invented"
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.technology',
          category: EventCategory.Cultural,
          subtype: 'technology_invented',  // suffix matches after stripping prefix
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'A new technology was invented.',
          requiredContext: [],
        },
      ];

      const engine = new NarrativeEngine(templates);
      // Event uses prefixed subtype "culture.technology_invented"
      const event = createEvent({
        category: EventCategory.Cultural,
        subtype: 'culture.technology_invented',
      });
      const result = engine.generateNarrative(createContext(event));

      // Should match the template by stripping the prefix
      expect(result.templateId).toBe('test.technology');
      expect(result.body).toContain('technology');
    });
  });

  describe('tone selection', () => {
    it('should select template matching requested tone', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.epic',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'The realm witnessed the coronation.',
          requiredContext: [],
        },
        {
          id: 'test.personal',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.PersonalCharacterFocus,
          significanceRange: { min: 0, max: 100 },
          template: 'They felt the crown\'s weight.',
          requiredContext: [],
        },
      ];

      const engine = new NarrativeEngine(templates);
      const event = createEvent();

      const epicResult = engine.generateNarrative(createContext(event), NarrativeTone.EpicHistorical);
      expect(epicResult.tone).toBe(NarrativeTone.EpicHistorical);
      expect(epicResult.body).toContain('realm');

      const personalResult = engine.generateNarrative(createContext(event), NarrativeTone.PersonalCharacterFocus);
      expect(personalResult.tone).toBe(NarrativeTone.PersonalCharacterFocus);
      expect(personalResult.body).toContain('felt');
    });

    it('should use default tone when none specified', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.epic',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'The coronation.',
          requiredContext: [],
        },
      ];

      const engine = new NarrativeEngine(templates, { defaultTone: NarrativeTone.EpicHistorical });
      const event = createEvent();
      const result = engine.generateNarrative(createContext(event));

      expect(result.tone).toBe(NarrativeTone.EpicHistorical);
    });
  });

  describe('entity resolution', () => {
    it('should resolve entity references from context', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.coronation',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: '{character.name} was crowned at {site.name}.',
          requiredContext: [],
        },
      ];

      const resolver = createResolver({
        character1: { name: 'Aldric', title: 'King', gender: 'male' },
        site10: { name: 'Ironhold', gender: 'neutral' },
      });

      const engine = new NarrativeEngine(templates, {}, resolver);
      const event = createEvent({
        participants: [toEntityId(1)],
        location: toSiteId(toEntityId(10)),
      });
      const result = engine.generateNarrative(createContext(event));

      expect(result.body).toContain('Aldric');
      expect(result.body).toContain('Ironhold');
    });

    it('should resolve pronouns correctly', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.coronation',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: '{character.name} raised {pronoun.possessive} scepter.',
          requiredContext: [],
        },
      ];

      const resolver = createResolver({
        character1: { name: 'Elena', title: 'Queen', gender: 'female' },
      });

      const engine = new NarrativeEngine(templates, {}, resolver);
      const event = createEvent({
        participants: [toEntityId(1)],
      });
      const result = engine.generateNarrative(createContext(event));

      expect(result.body).toBe('Elena raised her scepter.');
    });
  });

  describe('tone substitutions', () => {
    it('should apply tone-specific word substitutions', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.battle',
          category: EventCategory.Military,
          subtype: 'battle',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'The kingdom was attacked by soldiers.',
          requiredContext: [],
        },
      ];

      const engine = new NarrativeEngine(templates);
      const event = createEvent({
        category: EventCategory.Military,
        subtype: 'battle',
      });
      const result = engine.generateNarrative(createContext(event));

      // Epic Historical should substitute "kingdom" -> "realm", "soldiers" -> "warriors"
      expect(result.body).toContain('realm');
      expect(result.body).toContain('warriors');
      expect(result.body).not.toContain('kingdom');
      expect(result.body).not.toContain('soldiers');
    });
  });

  describe('literary devices', () => {
    it('should add epithet on first character mention', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.coronation',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'Aldric took the throne.',
          requiredContext: [],
        },
      ];

      const resolver = createResolver({
        character1: { name: 'Aldric', epithet: 'the Bold', gender: 'male' },
      });

      const engine = new NarrativeEngine(templates, { applyLiteraryDevices: true }, resolver);
      const event = createEvent({
        participants: [toEntityId(1)],
      });
      const result = engine.generateNarrative(createContext(event));

      expect(result.body).toContain('Aldric the Bold');
    });

    it('should add foreshadowing for rising action arc', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.event',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'The event occurred.',
          requiredContext: [],
        },
      ];

      const engine = new NarrativeEngine(templates, { applyLiteraryDevices: true });
      const event = createEvent();
      const context: TemplateContext = {
        event,
        world: {} as World,
        clock: new WorldClock(),
        narrativeArc: {
          phase: ArcPhase.RisingAction,
          peakSignificance: 90,
          domainTransitions: 2,
        },
      };
      const result = engine.generateNarrative(context);

      // Should have some foreshadowing phrase
      expect(result.body.length).toBeGreaterThan('The event occurred.'.length);
    });

    it('should add retrospective for long cascade chains', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.event',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'The conclusion was reached.',
          requiredContext: [],
        },
      ];

      const engine = new NarrativeEngine(templates, {
        applyLiteraryDevices: true,
        includeRetrospectives: true,
      });

      // Event with long cause chain
      const event = createEvent({
        causes: [toEventId(toEntityId(1)), toEventId(toEntityId(2)), toEventId(toEntityId(3))],
      });
      const result = engine.generateNarrative(createContext(event));

      // Should have retrospective phrase prepended
      expect(result.body.length).toBeGreaterThan('The conclusion was reached.'.length);
    });

    it('should add dramatic irony for secret events', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.secret',
          category: EventCategory.Personal,
          subtype: 'secret.revelation',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'The secret was revealed.',
          requiredContext: [],
        },
      ];

      const engine = new NarrativeEngine(templates, {
        applyLiteraryDevices: true,
        includeDramaticIrony: true,
      });

      const event = createEvent({
        category: EventCategory.Personal,
        subtype: 'secret.revelation',
        data: { secretInvolved: true },
      });
      const result = engine.generateNarrative(createContext(event));

      // Should have dramatic irony aside
      expect(result.body).toContain('(');
      expect(result.body).toContain(')');
    });
  });

  describe('title generation', () => {
    it('should generate title from event description', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.event',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'The event.',
          requiredContext: [],
        },
      ];

      const engine = new NarrativeEngine(templates);
      const event = createEvent({
        data: { description: 'The Great Coronation of King Aldric' },
      });
      const result = engine.generateNarrative(createContext(event));

      expect(result.title).toBe('The Great Coronation of King Aldric');
    });

    it('should truncate long titles', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.event',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'The event.',
          requiredContext: [],
        },
      ];

      const engine = new NarrativeEngine(templates);
      const event = createEvent({
        data: { description: 'This is a very long title that should be truncated because it exceeds the maximum allowed length' },
      });
      const result = engine.generateNarrative(createContext(event));

      expect(result.title.length).toBeLessThanOrEqual(50);
      expect(result.title).toContain('...');
    });

    it('should generate title from subtype when no description', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.event',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'The event.',
          requiredContext: [],
        },
      ];

      const engine = new NarrativeEngine(templates);
      const event = createEvent({ subtype: 'coronation' });
      const result = engine.generateNarrative(createContext(event));

      expect(result.title).toBe('Coronation');
    });

    it('should add "The Great" prefix for high significance', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.event',
          category: EventCategory.Political,
          subtype: 'battle',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'The event.',
          requiredContext: [],
        },
      ];

      const engine = new NarrativeEngine(templates);
      const event = createEvent({
        category: EventCategory.Military,
        subtype: 'battle',
        significance: 85
      });
      const result = engine.generateNarrative(createContext(event));

      expect(result.title).toBe('The Great Battle');
    });
  });

  describe('getStats', () => {
    it('should return template statistics', () => {
      const templates: NarrativeTemplate[] = [
        {
          id: 'test.coronation.epic',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'Test.',
          requiredContext: [],
        },
        {
          id: 'test.coronation.personal',
          category: EventCategory.Political,
          subtype: 'coronation',
          tone: NarrativeTone.PersonalCharacterFocus,
          significanceRange: { min: 0, max: 100 },
          template: 'Test.',
          requiredContext: [],
        },
        {
          id: 'test.battle.epic',
          category: EventCategory.Military,
          subtype: 'battle',
          tone: NarrativeTone.EpicHistorical,
          significanceRange: { min: 0, max: 100 },
          template: 'Test.',
          requiredContext: [],
        },
      ];

      const engine = new NarrativeEngine(templates);
      const stats = engine.getStats();

      expect(stats.totalTemplates).toBe(3);
      expect(stats.byCategory['Political']).toBe(2);
      expect(stats.byCategory['Military']).toBe(1);
      expect(stats.byTone['EpicHistorical']).toBe(2);
      expect(stats.byTone['PersonalCharacterFocus']).toBe(1);
    });
  });
});
