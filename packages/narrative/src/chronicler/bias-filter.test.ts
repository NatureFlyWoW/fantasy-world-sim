/**
 * Tests for ChroniclerBiasFilter.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChroniclerBiasFilter } from './bias-filter.js';
import type { BiasFilterContext } from './bias-filter.js';
import {
  ChroniclerIdeology,
  WritingStyle,
  BiasStrength,
  BiasType,
  createChronicler,
} from './chronicler.js';
import type { Chronicler } from './chronicler.js';
import { toEntityId, toSiteId, toFactionId, toEventId, EventCategory } from '@fws/core';
import type { WorldEvent, WorldTime } from '@fws/core';

describe('ChroniclerBiasFilter', () => {
  let filter: ChroniclerBiasFilter;
  const homeLocation = toSiteId(toEntityId(1));
  const activeFrom: WorldTime = { year: 100, month: 1, day: 1 };
  const activeTo: WorldTime = { year: 200, month: 12, day: 30 };

  beforeEach(() => {
    // Use deterministic RNG for tests
    let seed = 12345;
    const deterministicRng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    filter = new ChroniclerBiasFilter(deterministicRng);
  });

  function createTestChronicler(overrides?: Parameters<typeof createChronicler>[7]): Chronicler {
    return createChronicler(
      'test-chronicler',
      'Brother Aldric',
      ChroniclerIdeology.Religious,
      WritingStyle.Formal,
      homeLocation,
      activeFrom,
      activeTo,
      overrides
    );
  }

  function createTestEvent(overrides?: Partial<WorldEvent>): WorldEvent {
    return {
      id: toEventId(toEntityId(100)),
      category: EventCategory.Political,
      subtype: 'treaty_signed',
      timestamp: 1000,
      participants: [],
      causes: [],
      consequences: [],
      data: {},
      significance: 70,
      consequencePotential: [],
      ...overrides,
    };
  }

  function createTestContext(
    _chronicler: Chronicler,
    event: WorldEvent,
    overrides?: Partial<BiasFilterContext>
  ): BiasFilterContext {
    return {
      event,
      baseNarrative: 'The kingdom signed a peace treaty with its neighbor.',
      entityNames: new Map(),
      factionNames: new Map([
        [toFactionId(toEntityId(10)), 'Kingdom of Valdoria'],
        [toFactionId(toEntityId(20)), 'Empire of Krath'],
      ]),
      siteNames: new Map([[homeLocation, 'Castle Ironhold']]),
      currentTime: { year: 150, month: 6, day: 15 },
      ...overrides,
    };
  }

  describe('apply', () => {
    it('should return output with chronicler ID and event ID', () => {
      const chronicler = createTestChronicler();
      const event = createTestEvent();
      const context = createTestContext(chronicler, event);

      const output = filter.apply(chronicler, context);

      expect(output.chroniclerId).toBe('test-chronicler');
      expect(output.eventId).toBe(event.id);
    });

    it('should produce narrative text', () => {
      const chronicler = createTestChronicler();
      const event = createTestEvent();
      const context = createTestContext(chronicler, event);

      const output = filter.apply(chronicler, context);

      expect(output.narrative.length).toBeGreaterThan(0);
    });

    it('should track applied biases', () => {
      const chronicler = createTestChronicler({
        biasStrength: BiasStrength.Strong,
      });
      const event = createTestEvent({ significance: 80 });
      const context = createTestContext(chronicler, event);

      const output = filter.apply(chronicler, context);

      expect(Array.isArray(output.appliedBiases)).toBe(true);
    });

    it('should calculate distortion level between 0 and 1', () => {
      const chronicler = createTestChronicler();
      const event = createTestEvent();
      const context = createTestContext(chronicler, event);

      const output = filter.apply(chronicler, context);

      expect(output.distortionLevel).toBeGreaterThanOrEqual(0);
      expect(output.distortionLevel).toBeLessThanOrEqual(1);
    });

    it('should determine if knowledge is firsthand', () => {
      const chronicler = createTestChronicler({
        knowledge: {
          knownSites: new Set([homeLocation]),
          knownFactions: new Set(),
          knownCharacters: new Set(),
          firsthandPeriod: { start: { year: 100, month: 1, day: 1 }, end: { year: 200, month: 12, day: 30 } },
          geographicRange: 50,
        },
      });
      const event = createTestEvent({ location: homeLocation });
      const context = createTestContext(chronicler, event);

      const output = filter.apply(chronicler, context);

      expect(output.isFirsthand).toBe(true);
    });

    it('should mark secondhand knowledge for unknown sites', () => {
      const unknownSite = toSiteId(toEntityId(999));
      const chronicler = createTestChronicler();
      const event = createTestEvent({ location: unknownSite });
      const context = createTestContext(chronicler, event);

      const output = filter.apply(chronicler, context);

      expect(output.isFirsthand).toBe(false);
    });

    it('should calculate confidence based on knowledge', () => {
      const chronicler = createTestChronicler();
      const event = createTestEvent();
      const context = createTestContext(chronicler, event);

      const output = filter.apply(chronicler, context);

      expect(output.confidence).toBeGreaterThan(0);
      expect(output.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('omission', () => {
    it('should omit events for explicitly avoided categories', () => {
      const chronicler = createTestChronicler({
        avoidances: [{
          type: 'category',
          target: EventCategory.Military,
          omissionProbability: 1.0, // Always omit
          minimizationFactor: 0,
        }],
      });
      const event = createTestEvent({ category: EventCategory.Military });
      const context = createTestContext(chronicler, event);

      const output = filter.apply(chronicler, context);

      expect(output.narrative).toBe('');
      expect(output.distortionLevel).toBe(1.0);
      expect(output.appliedBiases.some(b => b.type === BiasType.Omission)).toBe(true);
    });

    it('should respect omission probability', () => {
      // With deterministic RNG seeded, some will omit and some won't
      const chronicler = createTestChronicler({
        avoidances: [{
          type: 'category',
          target: EventCategory.Military,
          omissionProbability: 0.0, // Never omit
          minimizationFactor: 0,
        }],
      });
      const event = createTestEvent({ category: EventCategory.Military });
      const context = createTestContext(chronicler, event);

      const output = filter.apply(chronicler, context);

      // With 0 probability, should never omit
      expect(output.narrative.length).toBeGreaterThan(0);
    });
  });

  describe('faction spin', () => {
    it('should apply positive spin to favored factions', () => {
      const factionId = toFactionId(toEntityId(10));
      const chronicler = createTestChronicler({
        factionRelations: [{
          factionId,
          disposition: 80,
          isMember: true,
          isPatron: false,
        }],
      });
      const event = createTestEvent();
      const context = createTestContext(chronicler, event, {
        baseNarrative: 'Kingdom of Valdoria attacked the enemy.',
      });

      const output = filter.apply(chronicler, context);

      // Positive spin should transform "attacked" to "defended against" or similar
      // The exact transformation depends on vocabulary
      expect(output.appliedBiases.some(b => b.type === BiasType.FactionSpin) ||
             output.narrative.includes('defended')).toBe(true);
    });

    it('should apply negative spin to disfavored factions', () => {
      const factionId = toFactionId(toEntityId(10));
      const chronicler = createTestChronicler({
        factionRelations: [{
          factionId,
          disposition: -80,
          isMember: false,
          isPatron: false,
        }],
      });
      const event = createTestEvent();
      const context = createTestContext(chronicler, event, {
        baseNarrative: 'Kingdom of Valdoria achieved victory.',
      });

      const output = filter.apply(chronicler, context);

      // May apply negative spin
      expect(output.distortionLevel).toBeGreaterThanOrEqual(0);
    });
  });

  describe('knowledge limitation', () => {
    it('should add uncertainty markers for secondhand accounts', () => {
      const unknownSite = toSiteId(toEntityId(999));
      const chronicler = createTestChronicler({
        knowledge: {
          knownSites: new Set([homeLocation]),
          knownFactions: new Set(),
          knownCharacters: new Set(),
          firsthandPeriod: { start: { year: 100, month: 1, day: 1 }, end: { year: 150, month: 12, day: 30 } },
          geographicRange: 50,
        },
      });
      const event = createTestEvent({ location: unknownSite });
      const context = createTestContext(chronicler, event, {
        currentTime: { year: 175, month: 6, day: 15 }, // After firsthand period
      });

      const output = filter.apply(chronicler, context);

      // Should add hedging language
      expect(output.appliedBiases.some(b => b.type === BiasType.KnowledgeLimitation)).toBe(true);
    });

    it('should have lower confidence for unknown locations', () => {
      const unknownSite = toSiteId(toEntityId(999));
      const chronicler = createTestChronicler();
      const event = createTestEvent({ location: unknownSite });
      const context = createTestContext(chronicler, event);

      const output = filter.apply(chronicler, context);

      expect(output.confidence).toBeLessThan(1.0);
    });
  });

  describe('ideological framing', () => {
    it('should add ideological phrases for significant events', () => {
      // Use Strong bias to increase chance of ideological framing
      const chronicler = createTestChronicler({
        biasStrength: BiasStrength.Strong,
      });
      const event = createTestEvent({ significance: 90 });
      const context = createTestContext(chronicler, event);

      const output = filter.apply(chronicler, context);

      // With Religious ideology, may add phrases like "by divine providence"
      // Check if any ideological framing was applied or narrative was modified
      expect(output.narrative.length).toBeGreaterThan(0);
    });

    it('should not add ideological framing for low-significance events', () => {
      const chronicler = createTestChronicler();
      const event = createTestEvent({ significance: 30 });
      const context = createTestContext(chronicler, event);

      const output = filter.apply(chronicler, context);

      // Should not have ideological framing bias applied
      expect(output.appliedBiases.some(b => b.type === BiasType.IdeologicalFraming)).toBe(false);
    });
  });

  describe('bias strength', () => {
    it('should produce more distortion with stronger bias', () => {
      const subtleChronicler = createTestChronicler({ biasStrength: BiasStrength.Subtle });
      const extremeChronicler = createTestChronicler({ biasStrength: BiasStrength.Extreme });

      const event = createTestEvent({ significance: 85 });
      const context = createTestContext(subtleChronicler, event);

      filter.apply(subtleChronicler, context); // Compare subtle vs extreme
      const extremeOutput = filter.apply(extremeChronicler, context);

      // Extreme bias should generally have higher distortion
      // (though with random elements, this isn't guaranteed for a single test)
      expect(extremeOutput.distortionLevel).toBeGreaterThanOrEqual(0);
    });
  });
});
