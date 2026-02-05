import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEntityId,
  toEntityId,
  toCharacterId,
  toFactionId,
  toSiteId,
  toArtifactId,
  toEventId,
  toDeityId,
  toBookId,
  toRegionId,
  toWarId,
  resetEntityIdCounter,
} from './types.js';
import type {
  EntityId,
  CharacterId,
  FactionId,
  SiteId,
  ArtifactId,
  EventId,
  DeityId,
  BookId,
  RegionId,
  WarId,
} from './types.js';

describe('Branded ID Types', () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  describe('createEntityId', () => {
    it('should create monotonically increasing IDs', () => {
      const id1 = createEntityId();
      const id2 = createEntityId();
      const id3 = createEntityId();

      expect(id1).toBe(0);
      expect(id2).toBe(1);
      expect(id3).toBe(2);
    });

    it('should reset correctly', () => {
      createEntityId();
      createEntityId();
      resetEntityIdCounter();
      const id = createEntityId();
      expect(id).toBe(0);
    });
  });

  describe('toEntityId', () => {
    it('should convert number to EntityId', () => {
      const id: EntityId = toEntityId(42);
      expect(id).toBe(42);
    });
  });

  describe('specific ID converters', () => {
    it('should convert EntityId to CharacterId', () => {
      const entityId = toEntityId(1);
      const characterId: CharacterId = toCharacterId(entityId);
      expect(characterId).toBe(1);
    });

    it('should convert EntityId to FactionId', () => {
      const entityId = toEntityId(2);
      const factionId: FactionId = toFactionId(entityId);
      expect(factionId).toBe(2);
    });

    it('should convert EntityId to SiteId', () => {
      const entityId = toEntityId(3);
      const siteId: SiteId = toSiteId(entityId);
      expect(siteId).toBe(3);
    });

    it('should convert EntityId to ArtifactId', () => {
      const entityId = toEntityId(4);
      const artifactId: ArtifactId = toArtifactId(entityId);
      expect(artifactId).toBe(4);
    });

    it('should convert EntityId to EventId', () => {
      const entityId = toEntityId(5);
      const eventId: EventId = toEventId(entityId);
      expect(eventId).toBe(5);
    });

    it('should convert EntityId to DeityId', () => {
      const entityId = toEntityId(6);
      const deityId: DeityId = toDeityId(entityId);
      expect(deityId).toBe(6);
    });

    it('should convert EntityId to BookId', () => {
      const entityId = toEntityId(7);
      const bookId: BookId = toBookId(entityId);
      expect(bookId).toBe(7);
    });

    it('should convert EntityId to RegionId', () => {
      const entityId = toEntityId(8);
      const regionId: RegionId = toRegionId(entityId);
      expect(regionId).toBe(8);
    });

    it('should convert EntityId to WarId', () => {
      const entityId = toEntityId(9);
      const warId: WarId = toWarId(entityId);
      expect(warId).toBe(9);
    });
  });

  describe('type safety (compile-time checks)', () => {
    it('should allow assigning specific IDs to EntityId', () => {
      const characterId = toCharacterId(toEntityId(1));
      const factionId = toFactionId(toEntityId(2));

      // Specific IDs can be assigned to EntityId (they extend it)
      const _e1: EntityId = characterId;
      const _e2: EntityId = factionId;

      expect(_e1).toBe(1);
      expect(_e2).toBe(2);
    });

    // The following tests verify compile-time type safety.
    // They use @ts-expect-error to ensure the TypeScript compiler
    // correctly rejects invalid assignments.

    it('should prevent assigning raw number to EntityId', () => {
      // @ts-expect-error - raw number cannot be assigned to EntityId
      const _id: EntityId = 42;
      void _id;
    });

    it('should prevent assigning EntityId to CharacterId', () => {
      const entityId = toEntityId(1);
      // @ts-expect-error - EntityId cannot be assigned to CharacterId (needs conversion)
      const _characterId: CharacterId = entityId;
      void _characterId;
    });

    it('should prevent assigning CharacterId to FactionId', () => {
      const characterId = toCharacterId(toEntityId(1));
      // @ts-expect-error - CharacterId cannot be assigned to FactionId
      const _factionId: FactionId = characterId;
      void _factionId;
    });

    it('should prevent assigning FactionId to SiteId', () => {
      const factionId = toFactionId(toEntityId(1));
      // @ts-expect-error - FactionId cannot be assigned to SiteId
      const _siteId: SiteId = factionId;
      void _siteId;
    });

    it('should prevent assigning DeityId to BookId', () => {
      const deityId = toDeityId(toEntityId(1));
      // @ts-expect-error - DeityId cannot be assigned to BookId
      const _bookId: BookId = deityId;
      void _bookId;
    });

    it('should prevent assigning RegionId to WarId', () => {
      const regionId = toRegionId(toEntityId(1));
      // @ts-expect-error - RegionId cannot be assigned to WarId
      const _warId: WarId = regionId;
      void _warId;
    });
  });
});
