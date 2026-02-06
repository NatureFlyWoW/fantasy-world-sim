/**
 * Tests for TemplateParser.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateParser, createDefaultResolver } from './template-parser.js';
import type { EvaluationContext } from './template-parser.js';
import type { Gender, ResolvedEntity } from '../templates/types.js';
import { ArcPhase } from '@fws/core';

describe('TemplateParser', () => {
  let parser: TemplateParser;

  beforeEach(() => {
    parser = new TemplateParser();
  });

  describe('tokenize', () => {
    it('should tokenize plain text', () => {
      const tokens = parser.tokenize('Hello world');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({ type: 'text', value: 'Hello world' });
    });

    it('should tokenize simple references', () => {
      const tokens = parser.tokenize('Hello {character.name}!');
      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toEqual({ type: 'text', value: 'Hello ' });
      expect(tokens[1]).toEqual({ type: 'reference', value: 'character.name' });
      expect(tokens[2]).toEqual({ type: 'text', value: '!' });
    });

    it('should tokenize if-else blocks', () => {
      const tokens = parser.tokenize('{#if event.data.victorious}Won{#else}Lost{/if}');
      expect(tokens).toHaveLength(5);
      expect(tokens[0]?.type).toBe('if_start');
      expect(tokens[0]?.condition).toBe('event.data.victorious');
      expect(tokens[1]).toEqual({ type: 'text', value: 'Won' });
      expect(tokens[2]?.type).toBe('else');
      expect(tokens[3]).toEqual({ type: 'text', value: 'Lost' });
      expect(tokens[4]?.type).toBe('if_end');
    });

    it('should tokenize unless blocks', () => {
      const tokens = parser.tokenize('{#unless character.traits.patient > 50}Impatient{/unless}');
      expect(tokens).toHaveLength(3);
      expect(tokens[0]?.type).toBe('unless_start');
      expect(tokens[0]?.condition).toBe('character.traits.patient > 50');
      expect(tokens[1]).toEqual({ type: 'text', value: 'Impatient' });
      expect(tokens[2]?.type).toBe('unless_end');
    });

    it('should handle multiple references', () => {
      const tokens = parser.tokenize('{character.name} fought at {site.name}');
      expect(tokens).toHaveLength(3);
      expect(tokens[0]?.type).toBe('reference');
      expect(tokens[1]?.type).toBe('text');
      expect(tokens[2]?.type).toBe('reference');
    });
  });

  describe('parseReference', () => {
    it('should parse character references', () => {
      const ref = parser.parseReference('character.name');
      expect(ref).toEqual({
        entityType: 'character',
        entityIndex: 0,
        property: 'name',
      });
    });

    it('should parse indexed character references', () => {
      const ref = parser.parseReference('character1.title');
      expect(ref).toEqual({
        entityType: 'character',
        entityIndex: 1,
        property: 'title',
      });
    });

    it('should parse pronoun references', () => {
      const ref = parser.parseReference('pronoun.subject');
      expect(ref).toEqual({
        entityType: 'pronoun',
        property: 'subject',
      });
    });

    it('should parse event references', () => {
      const ref = parser.parseReference('event.significance');
      expect(ref).toEqual({
        entityType: 'event',
        property: 'significance',
      });
    });

    it('should parse event data references', () => {
      const ref = parser.parseReference('event.data.victorious');
      expect(ref).toEqual({
        entityType: 'event',
        property: 'data.victorious',
      });
    });

    it('should parse arc references', () => {
      const ref = parser.parseReference('arc.phase');
      expect(ref).toEqual({
        entityType: 'arc',
        property: 'phase',
      });
    });

    it('should return undefined for invalid references', () => {
      expect(parser.parseReference('invalid')).toBeUndefined();
      expect(parser.parseReference('')).toBeUndefined();
    });
  });

  describe('resolveReference', () => {
    function createContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
      const defaultEntity: ResolvedEntity = {
        name: 'Aldric',
        title: 'King',
        epithet: 'the Bold',
        gender: 'male',
      };

      return {
        entities: new Map([['character0', defaultEntity]]),
        currentGender: 'male' as Gender,
        eventData: { victorious: true, description: 'A great battle' },
        eventSignificance: 75,
        arcPhase: ArcPhase.RisingAction,
        resolver: createDefaultResolver(),
        participants: [1],
        ...overrides,
      };
    }

    it('should resolve character name', () => {
      const context = createContext();
      const result = parser.resolveReference('character.name', context);
      expect(result).toBe('Aldric');
    });

    it('should resolve character title', () => {
      const context = createContext();
      const result = parser.resolveReference('character.title', context);
      expect(result).toBe('King');
    });

    it('should resolve character epithet', () => {
      const context = createContext();
      const result = parser.resolveReference('character.epithet', context);
      expect(result).toBe('the Bold');
    });

    it('should resolve fullTitle', () => {
      const context = createContext();
      const result = parser.resolveReference('character.fullTitle', context);
      expect(result).toBe('King Aldric');
    });

    it('should resolve withEpithet', () => {
      const context = createContext();
      const result = parser.resolveReference('character.withEpithet', context);
      expect(result).toBe('Aldric the Bold');
    });

    it('should resolve male pronouns', () => {
      const context = createContext({ currentGender: 'male' });
      expect(parser.resolveReference('pronoun.subject', context)).toBe('he');
      expect(parser.resolveReference('pronoun.object', context)).toBe('him');
      expect(parser.resolveReference('pronoun.possessive', context)).toBe('his');
      expect(parser.resolveReference('pronoun.reflexive', context)).toBe('himself');
    });

    it('should resolve female pronouns', () => {
      const context = createContext({ currentGender: 'female' });
      expect(parser.resolveReference('pronoun.subject', context)).toBe('she');
      expect(parser.resolveReference('pronoun.object', context)).toBe('her');
      expect(parser.resolveReference('pronoun.possessive', context)).toBe('her');
      expect(parser.resolveReference('pronoun.reflexive', context)).toBe('herself');
    });

    it('should resolve neutral pronouns', () => {
      const context = createContext({ currentGender: 'neutral' });
      expect(parser.resolveReference('pronoun.subject', context)).toBe('they');
      expect(parser.resolveReference('pronoun.object', context)).toBe('them');
      expect(parser.resolveReference('pronoun.possessive', context)).toBe('their');
      expect(parser.resolveReference('pronoun.reflexive', context)).toBe('themselves');
    });

    it('should resolve event significance', () => {
      const context = createContext({ eventSignificance: 85 });
      const result = parser.resolveReference('event.significance', context);
      expect(result).toBe('85');
    });

    it('should resolve event data', () => {
      const context = createContext({ eventData: { status: 'completed' } });
      const result = parser.resolveReference('event.data.status', context);
      expect(result).toBe('completed');
    });

    it('should resolve arc phase', () => {
      const context = createContext({ arcPhase: ArcPhase.Climax });
      const result = parser.resolveReference('arc.phase', context);
      expect(result).toBe('Climax');
    });

    it('should return readable placeholder for missing entities', () => {
      const context = createContext({ entities: new Map() });
      const result = parser.resolveReference('faction.name', context);
      // Returns readable "a faction" instead of raw template "{faction.name}"
      expect(result).toBe('a faction');
    });
  });

  describe('evaluateCondition', () => {
    function createContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
      return {
        entities: new Map(),
        currentGender: 'neutral' as Gender,
        eventData: { victorious: true, count: 10 },
        eventSignificance: 75,
        arcPhase: ArcPhase.RisingAction,
        resolver: createDefaultResolver(),
        participants: [],
        ...overrides,
      };
    }

    it('should evaluate equality', () => {
      const context = createContext({ arcPhase: ArcPhase.Climax });
      expect(parser.evaluateCondition("arc.phase == 'Climax'", context)).toBe(true);
      expect(parser.evaluateCondition("arc.phase == 'Setup'", context)).toBe(false);
    });

    it('should evaluate inequality', () => {
      const context = createContext({ arcPhase: ArcPhase.Climax });
      expect(parser.evaluateCondition("arc.phase != 'Setup'", context)).toBe(true);
      expect(parser.evaluateCondition("arc.phase != 'Climax'", context)).toBe(false);
    });

    it('should evaluate numeric comparisons', () => {
      const context = createContext({ eventSignificance: 75 });
      expect(parser.evaluateCondition('event.significance > 50', context)).toBe(true);
      expect(parser.evaluateCondition('event.significance < 50', context)).toBe(false);
      expect(parser.evaluateCondition('event.significance >= 75', context)).toBe(true);
      expect(parser.evaluateCondition('event.significance <= 75', context)).toBe(true);
    });

    it('should evaluate boolean data', () => {
      const context = createContext({ eventData: { victorious: true } });
      expect(parser.evaluateCondition('event.data.victorious', context)).toBe(true);
    });

    it('should evaluate truthy/falsy values', () => {
      const context = createContext({ eventData: { value: 0 } });
      expect(parser.evaluateCondition('event.data.value', context)).toBe(false);

      const context2 = createContext({ eventData: { value: 1 } });
      expect(parser.evaluateCondition('event.data.value', context2)).toBe(true);
    });
  });

  describe('evaluate', () => {
    function createContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
      return {
        entities: new Map([
          ['character0', { name: 'Aldric', title: 'King', epithet: 'the Bold', gender: 'male' as Gender }],
          ['site0', { name: 'Ironhold', gender: 'neutral' as Gender }],
        ]),
        currentGender: 'male' as Gender,
        eventData: { victorious: true },
        eventSignificance: 75,
        arcPhase: ArcPhase.RisingAction,
        resolver: createDefaultResolver(),
        participants: [1, 2],
        ...overrides,
      };
    }

    it('should evaluate simple template', () => {
      const context = createContext();
      const tokens = parser.tokenize('{character.name} rules {site.name}');
      const result = parser.evaluate(tokens, context);
      expect(result).toBe('Aldric rules Ironhold');
    });

    it('should evaluate if-true condition', () => {
      const context = createContext({ eventData: { victorious: true } });
      const tokens = parser.tokenize('{#if event.data.victorious}Victory!{/if}');
      const result = parser.evaluate(tokens, context);
      expect(result).toBe('Victory!');
    });

    it('should evaluate if-false condition', () => {
      const context = createContext({ eventData: { victorious: false } });
      const tokens = parser.tokenize('{#if event.data.victorious}Victory!{/if}');
      const result = parser.evaluate(tokens, context);
      expect(result).toBe('');
    });

    it('should evaluate if-else with true condition', () => {
      const context = createContext({ eventData: { victorious: true } });
      const tokens = parser.tokenize('{#if event.data.victorious}Won{#else}Lost{/if}');
      const result = parser.evaluate(tokens, context);
      expect(result).toBe('Won');
    });

    it('should evaluate if-else with false condition', () => {
      const context = createContext({ eventData: { victorious: false } });
      const tokens = parser.tokenize('{#if event.data.victorious}Won{#else}Lost{/if}');
      const result = parser.evaluate(tokens, context);
      expect(result).toBe('Lost');
    });

    it('should evaluate unless-true condition', () => {
      const context = createContext({ eventData: { defeated: true } });
      const tokens = parser.tokenize('{#unless event.data.defeated}Not defeated{/unless}');
      const result = parser.evaluate(tokens, context);
      expect(result).toBe('');
    });

    it('should evaluate unless-false condition', () => {
      const context = createContext({ eventData: { defeated: false } });
      const tokens = parser.tokenize('{#unless event.data.defeated}Not defeated{/unless}');
      const result = parser.evaluate(tokens, context);
      expect(result).toBe('Not defeated');
    });

    it('should handle pronouns after character mention', () => {
      const context = createContext();
      const tokens = parser.tokenize('{character.name} raised {pronoun.possessive} sword');
      const result = parser.evaluate(tokens, context);
      expect(result).toBe('Aldric raised his sword');
    });

    it('should evaluate nested conditionals', () => {
      const context = createContext({
        eventData: { victorious: true },
        eventSignificance: 90
      });
      const tokens = parser.tokenize('{#if event.data.victorious}{#if event.significance > 80}Great victory!{/if}{/if}');
      const result = parser.evaluate(tokens, context);
      expect(result).toBe('Great victory!');
    });
  });

  describe('render', () => {
    it('should render complete template', () => {
      const context: EvaluationContext = {
        entities: new Map([
          ['character0', { name: 'Elena', title: 'Queen', gender: 'female' as Gender }],
          ['faction0', { name: 'The Northern Kingdom', gender: 'neutral' as Gender }],
        ]),
        currentGender: 'female' as Gender,
        eventData: { victorious: true },
        eventSignificance: 85,
        arcPhase: ArcPhase.Climax,
        resolver: createDefaultResolver(),
        participants: [1, 2],
      };

      const template = '{character.name} led {faction.name} to {#if event.data.victorious}victory{#else}defeat{/if}. {pronoun.subject} was triumphant.';
      const result = parser.render(template, context);
      expect(result).toBe('Elena led The Northern Kingdom to victory. she was triumphant.');
    });

    it('should handle arc phase conditions', () => {
      const context: EvaluationContext = {
        entities: new Map(),
        currentGender: 'neutral' as Gender,
        eventData: {},
        eventSignificance: 50,
        arcPhase: ArcPhase.RisingAction,
        resolver: createDefaultResolver(),
        participants: [],
      };

      const template = "{#if arc.phase == 'RisingAction'}Tension builds.{/if}";
      const result = parser.render(template, context);
      expect(result).toBe('Tension builds.');
    });
  });
});
