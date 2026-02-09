/**
 * Tests for Chronicler types and registry.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ChroniclerIdeology,
  WritingStyle,
  BiasStrength,
  ChroniclerRegistry,
  createChronicler,
} from './chronicler.js';
import type { WorldTime } from '@fws/core';
import { toEntityId, toSiteId, toFactionId, toCharacterId } from '@fws/core';

describe('createChronicler', () => {
  const homeLocation = toSiteId(toEntityId(1));
  const activeFrom: WorldTime = { year: 100, month: 1, day: 1 };
  const activeTo: WorldTime = { year: 150, month: 12, day: 30 };

  it('should create a chronicler with required fields', () => {
    const chronicler = createChronicler(
      'test-chronicler',
      'Brother Aldric',
      ChroniclerIdeology.Religious,
      WritingStyle.Formal,
      homeLocation,
      activeFrom,
      activeTo
    );

    expect(chronicler.id).toBe('test-chronicler');
    expect(chronicler.name).toBe('Brother Aldric');
    expect(chronicler.ideology).toBe(ChroniclerIdeology.Religious);
    expect(chronicler.style).toBe(WritingStyle.Formal);
    expect(chronicler.homeLocation).toBe(homeLocation);
    expect(chronicler.activeFrom).toEqual(activeFrom);
    expect(chronicler.activeTo).toEqual(activeTo);
  });

  it('should use default values for optional fields', () => {
    const chronicler = createChronicler(
      'test',
      'Test',
      ChroniclerIdeology.Populist,
      WritingStyle.Dramatic,
      homeLocation,
      activeFrom,
      activeTo
    );

    expect(chronicler.biasStrength).toBe(BiasStrength.Moderate);
    expect(chronicler.secondaryIdeologies).toEqual([]);
    expect(chronicler.factionRelations).toEqual([]);
    expect(chronicler.interests).toEqual([]);
    expect(chronicler.avoidances).toEqual([]);
    expect(chronicler.knowledge.knownSites.has(homeLocation)).toBe(true);
    expect(chronicler.knowledge.geographicRange).toBe(50);
  });

  it('should accept optional configuration', () => {
    const factionId = toFactionId(toEntityId(10));
    const characterId = toCharacterId(toEntityId(20));

    const chronicler = createChronicler(
      'custom',
      'Custom Chronicler',
      ChroniclerIdeology.GreatMan,
      WritingStyle.Florid,
      homeLocation,
      activeFrom,
      activeTo,
      {
        characterId,
        biasStrength: BiasStrength.Strong,
        secondaryIdeologies: [ChroniclerIdeology.Cyclical],
        factionRelations: [{
          factionId,
          disposition: 80,
          isMember: true,
          isPatron: false,
        }],
        interests: [{
          type: 'category',
          target: 'Military',
          multiplier: 2.0,
        }],
        avoidances: [{
          type: 'faction',
          target: 'enemy_faction',
          omissionProbability: 0.5,
          minimizationFactor: 0.3,
        }],
      }
    );

    expect(chronicler.characterId).toBe(characterId);
    expect(chronicler.biasStrength).toBe(BiasStrength.Strong);
    expect(chronicler.secondaryIdeologies).toEqual([ChroniclerIdeology.Cyclical]);
    expect(chronicler.factionRelations.length).toBe(1);
    expect(chronicler.interests.length).toBe(1);
    expect(chronicler.avoidances.length).toBe(1);
  });
});

describe('ChroniclerRegistry', () => {
  let registry: ChroniclerRegistry;
  const homeLocation = toSiteId(toEntityId(1));

  beforeEach(() => {
    registry = new ChroniclerRegistry();
  });

  it('should register and retrieve chroniclers', () => {
    const chronicler = createChronicler(
      'test-1',
      'First Chronicler',
      ChroniclerIdeology.Materialist,
      WritingStyle.Academic,
      homeLocation,
      { year: 100, month: 1, day: 1 },
      { year: 200, month: 12, day: 30 }
    );

    registry.register(chronicler);

    expect(registry.get('test-1')).toBe(chronicler);
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('should get all chroniclers', () => {
    const c1 = createChronicler('c1', 'C1', ChroniclerIdeology.Religious, WritingStyle.Formal, homeLocation,
      { year: 100, month: 1, day: 1 }, { year: 200, month: 12, day: 30 });
    const c2 = createChronicler('c2', 'C2', ChroniclerIdeology.Populist, WritingStyle.Dramatic, homeLocation,
      { year: 150, month: 1, day: 1 }, { year: 250, month: 12, day: 30 });

    registry.register(c1);
    registry.register(c2);

    const all = registry.getAll();
    expect(all.length).toBe(2);
  });

  it('should set and get active chronicler', () => {
    const chronicler = createChronicler('active-test', 'Active', ChroniclerIdeology.Cynical, WritingStyle.Laconic, homeLocation,
      { year: 100, month: 1, day: 1 }, { year: 200, month: 12, day: 30 });

    registry.register(chronicler);
    registry.setActive('active-test');

    expect(registry.getActive()).toBe(chronicler);
  });

  it('should throw when setting non-existent chronicler as active', () => {
    expect(() => registry.setActive('nonexistent')).toThrow('Chronicler not found');
  });

  it('should get chroniclers active at a specific time', () => {
    const c1 = createChronicler('c1', 'C1', ChroniclerIdeology.Religious, WritingStyle.Formal, homeLocation,
      { year: 100, month: 1, day: 1 }, { year: 200, month: 12, day: 30 });
    const c2 = createChronicler('c2', 'C2', ChroniclerIdeology.Populist, WritingStyle.Dramatic, homeLocation,
      { year: 150, month: 1, day: 1 }, { year: 250, month: 12, day: 30 });
    const c3 = createChronicler('c3', 'C3', ChroniclerIdeology.Materialist, WritingStyle.Matter_Of_Fact, homeLocation,
      { year: 300, month: 1, day: 1 }, { year: 400, month: 12, day: 30 });

    registry.register(c1);
    registry.register(c2);
    registry.register(c3);

    // At year 175: c1 and c2 active
    const activeAt175 = registry.getActiveAt({ year: 175, month: 6, day: 15 });
    expect(activeAt175.length).toBe(2);
    expect(activeAt175).toContain(c1);
    expect(activeAt175).toContain(c2);

    // At year 125: only c1 active
    const activeAt125 = registry.getActiveAt({ year: 125, month: 6, day: 15 });
    expect(activeAt125.length).toBe(1);
    expect(activeAt125).toContain(c1);

    // At year 350: only c3 active
    const activeAt350 = registry.getActiveAt({ year: 350, month: 6, day: 15 });
    expect(activeAt350.length).toBe(1);
    expect(activeAt350).toContain(c3);
  });

  it('should get chroniclers with knowledge of a site', () => {
    const site1 = toSiteId(toEntityId(10));
    const site2 = toSiteId(toEntityId(20));

    const c1 = createChronicler('c1', 'C1', ChroniclerIdeology.Religious, WritingStyle.Formal, site1,
      { year: 100, month: 1, day: 1 }, { year: 200, month: 12, day: 30 },
      { knowledge: { knownSites: new Set([site1, site2]), knownFactions: new Set(), knownCharacters: new Set(), firsthandPeriod: { start: { year: 100, month: 1, day: 1 }, end: { year: 200, month: 12, day: 30 } }, geographicRange: 50 } });
    const c2 = createChronicler('c2', 'C2', ChroniclerIdeology.Populist, WritingStyle.Dramatic, site2,
      { year: 100, month: 1, day: 1 }, { year: 200, month: 12, day: 30 },
      { knowledge: { knownSites: new Set([site2]), knownFactions: new Set(), knownCharacters: new Set(), firsthandPeriod: { start: { year: 100, month: 1, day: 1 }, end: { year: 200, month: 12, day: 30 } }, geographicRange: 50 } });

    registry.register(c1);
    registry.register(c2);

    const knowledgeSite1 = registry.getWithKnowledgeOf(site1);
    expect(knowledgeSite1.length).toBe(1);
    expect(knowledgeSite1).toContain(c1);

    const knowledgeSite2 = registry.getWithKnowledgeOf(site2);
    expect(knowledgeSite2.length).toBe(2);
  });

  it('should get chroniclers affiliated with a faction', () => {
    const faction1 = toFactionId(toEntityId(100));
    const faction2 = toFactionId(toEntityId(200));

    const c1 = createChronicler('c1', 'C1', ChroniclerIdeology.ProEstablishment, WritingStyle.Formal, homeLocation,
      { year: 100, month: 1, day: 1 }, { year: 200, month: 12, day: 30 },
      { factionRelations: [{ factionId: faction1, disposition: 80, isMember: true, isPatron: false }] });
    const c2 = createChronicler('c2', 'C2', ChroniclerIdeology.Populist, WritingStyle.Dramatic, homeLocation,
      { year: 100, month: 1, day: 1 }, { year: 200, month: 12, day: 30 },
      { factionRelations: [{ factionId: faction2, disposition: 90, isMember: false, isPatron: true }] });

    registry.register(c1);
    registry.register(c2);

    const affiliatedFaction1 = registry.getAffiliatedWith(faction1);
    expect(affiliatedFaction1.length).toBe(1);
    expect(affiliatedFaction1).toContain(c1);

    const affiliatedFaction2 = registry.getAffiliatedWith(faction2);
    expect(affiliatedFaction2.length).toBe(1);
    expect(affiliatedFaction2).toContain(c2);
  });
});
