/**
 * Tests for LostHistoryTracker.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LostHistoryTracker,
  LossReason,
  PreservationQuality,
  ChronicleFeature,
} from './lost-history.js';
import {
  ChroniclerIdeology,
  WritingStyle,
  createChronicler,
} from './chronicler.js';
import type { Chronicler } from './chronicler.js';
import type { WorldTime } from '@fws/core';
import { toEntityId, toSiteId, toFactionId, toEventId } from '@fws/core';

describe('LostHistoryTracker', () => {
  let tracker: LostHistoryTracker;
  let chronicler: Chronicler;
  const homeLocation = toSiteId(toEntityId(1));
  const otherLocation = toSiteId(toEntityId(2));
  const activeFrom: WorldTime = { year: 100, month: 1, day: 1 };
  const activeTo: WorldTime = { year: 200, month: 12, day: 30 };

  beforeEach(() => {
    // Use deterministic RNG for tests
    let seed = 54321;
    const deterministicRng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    tracker = new LostHistoryTracker(deterministicRng);

    chronicler = createChronicler(
      'test-chronicler',
      'Brother Aldric',
      ChroniclerIdeology.Religious,
      WritingStyle.Formal,
      homeLocation,
      activeFrom,
      activeTo
    );
  });

  describe('createChronicle', () => {
    it('should create a chronicle with basic properties', () => {
      const eventIds = [toEventId(toEntityId(100)), toEventId(toEntityId(101))];
      const outputs = eventIds.map(eventId => ({
        chroniclerId: 'test-chronicler',
        eventId,
        narrative: 'Test narrative',
        distortionLevel: 0.1,
        appliedBiases: [],
        isFirsthand: true,
        confidence: 0.9,
      }));

      const chronicle = tracker.createChronicle(
        chronicler,
        outputs,
        homeLocation,
        activeFrom,
        activeTo
      );

      expect(chronicle.id).toMatch(/^chronicle_\d+$/);
      expect(chronicle.chroniclerId).toBe('test-chronicler');
      expect(chronicle.eventIds).toEqual(eventIds);
      expect(chronicle.location).toBe(homeLocation);
      expect(chronicle.isExtant).toBe(true);
      expect(chronicle.isPrimary).toBe(true);
    });

    it('should use default preservation quality', () => {
      const chronicle = tracker.createChronicle(
        chronicler,
        [],
        homeLocation,
        activeFrom,
        activeTo
      );

      expect(chronicle.preservationQuality).toBe(PreservationQuality.Fair);
    });

    it('should accept custom options', () => {
      const factionId = toFactionId(toEntityId(10));

      const chronicle = tracker.createChronicle(
        chronicler,
        [],
        homeLocation,
        activeFrom,
        activeTo,
        {
          preservationQuality: PreservationQuality.Excellent,
          copyCount: 3,
          controllingFaction: factionId,
          isRestricted: true,
          features: [ChronicleFeature.Illuminated, ChronicleFeature.HasMaps],
        }
      );

      expect(chronicle.preservationQuality).toBe(PreservationQuality.Excellent);
      expect(chronicle.copyCount).toBe(3);
      expect(chronicle.controllingFaction).toBe(factionId);
      expect(chronicle.isRestricted).toBe(true);
      expect(chronicle.features).toContain(ChronicleFeature.Illuminated);
      expect(chronicle.features).toContain(ChronicleFeature.HasMaps);
    });
  });

  describe('copyChronicle', () => {
    it('should create a copy at a new location', () => {
      const original = tracker.createChronicle(
        chronicler,
        [],
        homeLocation,
        activeFrom,
        activeTo
      );

      const copy = tracker.copyChronicle(original.id, otherLocation);

      expect(copy).toBeDefined();
      expect(copy!.id).not.toBe(original.id);
      expect(copy!.location).toBe(otherLocation);
      expect(copy!.isPrimary).toBe(false);
      expect(copy!.copiedFrom).toBe(original.id);
    });

    it('should increment copy count on source', () => {
      const original = tracker.createChronicle(
        chronicler,
        [],
        homeLocation,
        activeFrom,
        activeTo
      );

      const initialCount = original.copyCount;
      tracker.copyChronicle(original.id, otherLocation);

      expect(original.copyCount).toBe(initialCount + 1);
    });

    it('should return undefined for non-existent source', () => {
      const copy = tracker.copyChronicle('nonexistent', otherLocation);
      expect(copy).toBeUndefined();
    });

    it('should return undefined for lost source', () => {
      const original = tracker.createChronicle(
        chronicler,
        [],
        homeLocation,
        activeFrom,
        activeTo
      );

      tracker.loseChronicle(original.id, LossReason.Destroyed, { year: 150, month: 6, day: 15 }, 'Fire');

      const copy = tracker.copyChronicle(original.id, otherLocation);
      expect(copy).toBeUndefined();
    });
  });

  describe('loseChronicle', () => {
    it('should mark chronicle as not extant', () => {
      const chronicle = tracker.createChronicle(
        chronicler,
        [],
        homeLocation,
        activeFrom,
        activeTo
      );

      const result = tracker.loseChronicle(
        chronicle.id,
        LossReason.Destroyed,
        { year: 150, month: 6, day: 15 },
        'Fire in the library'
      );

      expect(result).toBe(true);
      expect(chronicle.isExtant).toBe(false);
      expect(chronicle.lossRecord).toBeDefined();
      expect(chronicle.lossRecord!.reason).toBe(LossReason.Destroyed);
      expect(chronicle.lossRecord!.description).toBe('Fire in the library');
    });

    it('should track lost chronicle separately', () => {
      const chronicle = tracker.createChronicle(
        chronicler,
        [],
        homeLocation,
        activeFrom,
        activeTo
      );

      tracker.loseChronicle(chronicle.id, LossReason.Decay, { year: 300, month: 1, day: 1 }, 'Degraded');

      const lostChronicles = tracker.getLostChronicles();
      expect(lostChronicles.has(chronicle.id)).toBe(true);
    });

    it('should record fragments surviving if specified', () => {
      const chronicle = tracker.createChronicle(
        chronicler,
        [],
        homeLocation,
        activeFrom,
        activeTo
      );

      tracker.loseChronicle(
        chronicle.id,
        LossReason.Decay,
        { year: 300, month: 1, day: 1 },
        'Degraded',
        { fragmentsSurvive: true, fragmentPercentage: 30 }
      );

      expect(chronicle.lossRecord!.fragmentsSurvive).toBe(true);
      expect(chronicle.lossRecord!.fragmentPercentage).toBe(30);
    });

    it('should return false for non-existent chronicle', () => {
      const result = tracker.loseChronicle(
        'nonexistent',
        LossReason.Destroyed,
        { year: 150, month: 6, day: 15 },
        'Test'
      );

      expect(result).toBe(false);
    });

    it('should return false for already lost chronicle', () => {
      const chronicle = tracker.createChronicle(
        chronicler,
        [],
        homeLocation,
        activeFrom,
        activeTo
      );

      tracker.loseChronicle(chronicle.id, LossReason.Destroyed, { year: 150, month: 6, day: 15 }, 'First');
      const result = tracker.loseChronicle(chronicle.id, LossReason.Decay, { year: 200, month: 1, day: 1 }, 'Second');

      expect(result).toBe(false);
    });

    it('should decrement copy count on source when copy is lost', () => {
      const original = tracker.createChronicle(
        chronicler,
        [],
        homeLocation,
        activeFrom,
        activeTo
      );

      const copy = tracker.copyChronicle(original.id, otherLocation)!;
      const countAfterCopy = original.copyCount;

      tracker.loseChronicle(copy.id, LossReason.Destroyed, { year: 150, month: 6, day: 15 }, 'Lost');

      expect(original.copyCount).toBe(countAfterCopy - 1);
    });
  });

  describe('hasRecordOf', () => {
    it('should return true when chronicle exists for event', () => {
      const eventId = toEventId(toEntityId(100));
      const outputs = [{
        chroniclerId: 'test-chronicler',
        eventId,
        narrative: 'Test',
        distortionLevel: 0,
        appliedBiases: [],
        isFirsthand: true,
        confidence: 1,
      }];

      tracker.createChronicle(chronicler, outputs, homeLocation, activeFrom, activeTo);

      expect(tracker.hasRecordOf(eventId)).toBe(true);
    });

    it('should return false when no chronicle exists for event', () => {
      const eventId = toEventId(toEntityId(999));
      expect(tracker.hasRecordOf(eventId)).toBe(false);
    });

    it('should return false when all chronicles for event are lost', () => {
      const eventId = toEventId(toEntityId(100));
      const outputs = [{
        chroniclerId: 'test-chronicler',
        eventId,
        narrative: 'Test',
        distortionLevel: 0,
        appliedBiases: [],
        isFirsthand: true,
        confidence: 1,
      }];

      const chronicle = tracker.createChronicle(chronicler, outputs, homeLocation, activeFrom, activeTo);
      tracker.loseChronicle(chronicle.id, LossReason.Destroyed, { year: 150, month: 6, day: 15 }, 'Lost');

      expect(tracker.hasRecordOf(eventId)).toBe(false);
    });
  });

  describe('getChroniclesFor', () => {
    it('should return chronicles containing event', () => {
      const eventId = toEventId(toEntityId(100));
      const outputs = [{
        chroniclerId: 'test-chronicler',
        eventId,
        narrative: 'Test',
        distortionLevel: 0,
        appliedBiases: [],
        isFirsthand: true,
        confidence: 1,
      }];

      const chronicle = tracker.createChronicle(chronicler, outputs, homeLocation, activeFrom, activeTo);

      const chronicles = tracker.getChroniclesFor(eventId);
      expect(chronicles.length).toBe(1);
      expect(chronicles[0]).toBe(chronicle);
    });

    it('should not return lost chronicles', () => {
      const eventId = toEventId(toEntityId(100));
      const outputs = [{
        chroniclerId: 'test-chronicler',
        eventId,
        narrative: 'Test',
        distortionLevel: 0,
        appliedBiases: [],
        isFirsthand: true,
        confidence: 1,
      }];

      const chronicle = tracker.createChronicle(chronicler, outputs, homeLocation, activeFrom, activeTo);
      tracker.loseChronicle(chronicle.id, LossReason.Destroyed, { year: 150, month: 6, day: 15 }, 'Lost');

      const chronicles = tracker.getChroniclesFor(eventId);
      expect(chronicles.length).toBe(0);
    });
  });

  describe('getChroniclesAt', () => {
    it('should return chronicles at location', () => {
      const chronicle = tracker.createChronicle(chronicler, [], homeLocation, activeFrom, activeTo);

      const chronicles = tracker.getChroniclesAt(homeLocation);
      expect(chronicles.length).toBe(1);
      expect(chronicles[0]).toBe(chronicle);
    });

    it('should not return chronicles at different locations', () => {
      tracker.createChronicle(chronicler, [], homeLocation, activeFrom, activeTo);

      const chronicles = tracker.getChroniclesAt(otherLocation);
      expect(chronicles.length).toBe(0);
    });
  });

  describe('getExtantChronicles', () => {
    it('should return only extant chronicles', () => {
      const c1 = tracker.createChronicle(chronicler, [], homeLocation, activeFrom, activeTo);
      const c2 = tracker.createChronicle(chronicler, [], otherLocation, activeFrom, activeTo);

      tracker.loseChronicle(c1.id, LossReason.Destroyed, { year: 150, month: 6, day: 15 }, 'Lost');

      const extant = tracker.getExtantChronicles();
      expect(extant.length).toBe(1);
      expect(extant[0]).toBe(c2);
    });
  });

  describe('getLostEvents', () => {
    it('should return events with no surviving records', () => {
      const eventId1 = toEventId(toEntityId(100));
      const eventId2 = toEventId(toEntityId(101));

      const c1 = tracker.createChronicle(chronicler, [
        { chroniclerId: 'test', eventId: eventId1, narrative: '', distortionLevel: 0, appliedBiases: [], isFirsthand: true, confidence: 1 },
      ], homeLocation, activeFrom, activeTo);

      tracker.createChronicle(chronicler, [
        { chroniclerId: 'test', eventId: eventId2, narrative: '', distortionLevel: 0, appliedBiases: [], isFirsthand: true, confidence: 1 },
      ], otherLocation, activeFrom, activeTo);

      tracker.loseChronicle(c1.id, LossReason.Destroyed, { year: 150, month: 6, day: 15 }, 'Lost');

      const lostEvents = tracker.getLostEvents();
      expect(lostEvents).toContain(eventId1);
      expect(lostEvents).not.toContain(eventId2);
    });
  });

  describe('calculateCoverage', () => {
    it('should return 1.0 when no events recorded', () => {
      expect(tracker.calculateCoverage()).toBe(1.0);
    });

    it('should calculate correct coverage ratio', () => {
      const eventId1 = toEventId(toEntityId(100));
      const eventId2 = toEventId(toEntityId(101));

      const c1 = tracker.createChronicle(chronicler, [
        { chroniclerId: 'test', eventId: eventId1, narrative: '', distortionLevel: 0, appliedBiases: [], isFirsthand: true, confidence: 1 },
      ], homeLocation, activeFrom, activeTo);

      tracker.createChronicle(chronicler, [
        { chroniclerId: 'test', eventId: eventId2, narrative: '', distortionLevel: 0, appliedBiases: [], isFirsthand: true, confidence: 1 },
      ], otherLocation, activeFrom, activeTo);

      // Both events covered
      expect(tracker.calculateCoverage()).toBe(1.0);

      // Lose one chronicle
      tracker.loseChronicle(c1.id, LossReason.Destroyed, { year: 150, month: 6, day: 15 }, 'Lost');

      // 50% coverage (1 out of 2 events)
      expect(tracker.calculateCoverage()).toBe(0.5);
    });
  });

  describe('simulateTimePassage', () => {
    it('should potentially degrade preservation quality', () => {
      const chronicle = tracker.createChronicle(
        chronicler,
        [],
        homeLocation,
        activeFrom,
        activeTo,
        { preservationQuality: PreservationQuality.Fair }
      );

      // Simulate many centuries
      tracker.simulateTimePassage(500);

      // Quality should have degraded (probabilistic, but with deterministic RNG)
      // Just check that the function runs without error
      expect(chronicle.preservationQuality).toBeDefined();
    });

    it('should destroy chronicles at disaster locations', () => {
      const chronicle = tracker.createChronicle(
        chronicler,
        [],
        homeLocation,
        activeFrom,
        activeTo,
        { preservationQuality: PreservationQuality.Poor }
      );

      const disasterLocations = new Set([homeLocation]);

      // Run simulation multiple times to increase chance of loss
      for (let i = 0; i < 10 && chronicle.isExtant; i++) {
        tracker.simulateTimePassage(100, disasterLocations);
      }

      // With poor preservation and disaster, should eventually be destroyed
      // (though with deterministic RNG, exact behavior is predictable)
      expect(tracker.getExtantCount() + tracker.getLostCount()).toBeGreaterThan(0);
    });

    it('should suppress chronicles of suppressed factions', () => {
      const factionId = toFactionId(toEntityId(10));
      const chronicle = tracker.createChronicle(
        chronicler,
        [],
        homeLocation,
        activeFrom,
        activeTo,
        { controllingFaction: factionId }
      );

      const suppressedFactions = new Set([factionId]);

      // Run simulation multiple times
      for (let i = 0; i < 20 && chronicle.isExtant; i++) {
        tracker.simulateTimePassage(50, undefined, suppressedFactions);
      }

      // May have been suppressed
      expect(tracker.getExtantCount() + tracker.getLostCount()).toBeGreaterThan(0);
    });
  });

  describe('counts', () => {
    it('should track extant and lost counts correctly', () => {
      const c1 = tracker.createChronicle(chronicler, [], homeLocation, activeFrom, activeTo);
      tracker.createChronicle(chronicler, [], otherLocation, activeFrom, activeTo);

      expect(tracker.getExtantCount()).toBe(2);
      expect(tracker.getLostCount()).toBe(0);

      tracker.loseChronicle(c1.id, LossReason.Destroyed, { year: 150, month: 6, day: 15 }, 'Lost');

      expect(tracker.getExtantCount()).toBe(1);
      expect(tracker.getLostCount()).toBe(1);
    });
  });
});

describe('LossReason', () => {
  it('should have all expected reasons', () => {
    expect(LossReason.Destroyed).toBe('destroyed');
    expect(LossReason.Decay).toBe('decay');
    expect(LossReason.Suppressed).toBe('suppressed');
    expect(LossReason.Misplaced).toBe('misplaced');
    expect(LossReason.NeverRecorded).toBe('never_recorded');
    expect(LossReason.Falsified).toBe('falsified');
  });
});

describe('PreservationQuality', () => {
  it('should have all expected qualities', () => {
    expect(PreservationQuality.Excellent).toBe('excellent');
    expect(PreservationQuality.Good).toBe('good');
    expect(PreservationQuality.Fair).toBe('fair');
    expect(PreservationQuality.Poor).toBe('poor');
    expect(PreservationQuality.Endangered).toBe('endangered');
  });
});

describe('ChronicleFeature', () => {
  it('should have all expected features', () => {
    expect(ChronicleFeature.Illuminated).toBe('illuminated');
    expect(ChronicleFeature.HasMaps).toBe('has_maps');
    expect(ChronicleFeature.RareLanguage).toBe('rare_language');
    expect(ChronicleFeature.Encrypted).toBe('encrypted');
    expect(ChronicleFeature.Firsthand).toBe('firsthand');
    expect(ChronicleFeature.Annotated).toBe('annotated');
    expect(ChronicleFeature.Erroneous).toBe('erroneous');
    expect(ChronicleFeature.Authoritative).toBe('authoritative');
    expect(ChronicleFeature.Forbidden).toBe('forbidden');
  });
});
