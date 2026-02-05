/**
 * Branded ID types for type-safe entity identification.
 * Using intersection types with branded symbols prevents accidental cross-assignment.
 */

// Base entity ID - all specific IDs extend this
export type EntityId = number & { readonly __brand: 'EntityId' };

// Specific entity type IDs - extend EntityId with additional brand
export type CharacterId = EntityId & { readonly __character: true };
export type FactionId = EntityId & { readonly __faction: true };
export type SiteId = EntityId & { readonly __site: true };
export type ArtifactId = EntityId & { readonly __artifact: true };
export type EventId = EntityId & { readonly __event: true };
export type DeityId = EntityId & { readonly __deity: true };
export type BookId = EntityId & { readonly __book: true };
export type RegionId = EntityId & { readonly __region: true };
export type WarId = EntityId & { readonly __war: true };

// Helper functions to create branded IDs
// These cast raw numbers to branded types at runtime boundaries

let nextEntityId = 0;

export function createEntityId(): EntityId {
  return nextEntityId++ as EntityId;
}

export function toEntityId(id: number): EntityId {
  return id as EntityId;
}

export function toCharacterId(id: EntityId): CharacterId {
  return id as CharacterId;
}

export function toFactionId(id: EntityId): FactionId {
  return id as FactionId;
}

export function toSiteId(id: EntityId): SiteId {
  return id as SiteId;
}

export function toArtifactId(id: EntityId): ArtifactId {
  return id as ArtifactId;
}

export function toEventId(id: EntityId): EventId {
  return id as EventId;
}

export function toDeityId(id: EntityId): DeityId {
  return id as DeityId;
}

export function toBookId(id: EntityId): BookId {
  return id as BookId;
}

export function toRegionId(id: EntityId): RegionId {
  return id as RegionId;
}

export function toWarId(id: EntityId): WarId {
  return id as WarId;
}

// Reset function for testing purposes
export function resetEntityIdCounter(): void {
  nextEntityId = 0;
}
