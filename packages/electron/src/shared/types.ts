/**
 * Shared IPC types for main ↔ renderer communication.
 *
 * Branded types (EntityId, EventId) are serialized as `number` across IPC.
 * The renderer casts them back to branded types when needed.
 */

// ── Tick delta (sent every simulation tick) ──────────────────────────────────

export interface SerializedEvent {
  readonly id: number;
  readonly tick: number;
  readonly category: string;
  readonly subtype: string;
  readonly significance: number;
  readonly participants: readonly number[];
  readonly data: Record<string, unknown>;
  readonly narrativeTitle: string;
  readonly narrativeBody: string;
}

export interface EntityDelta {
  readonly entityId: number;
  readonly componentType: string;
  readonly data: Record<string, unknown>;
}

export interface TickDelta {
  readonly tick: number;
  readonly time: { readonly year: number; readonly month: number; readonly day: number };
  readonly events: readonly SerializedEvent[];
  readonly changedEntities: readonly EntityDelta[];
  readonly removedEntities: readonly number[];
  readonly entityUpdates: readonly EntitySnapshot[];
}

// ── World snapshot (sent once on load) ───────────────────────────────────────

export interface TileSnapshot {
  readonly biome: string;
  readonly elevation: number;
  readonly temperature: number;
  readonly rainfall: number;
  readonly riverId?: number;
  readonly leyLine?: boolean;
  readonly resources?: readonly string[];
}

export type PopulationTier = 'hamlet' | 'village' | 'town' | 'city';
export type EntityType =
  | 'village' | 'town' | 'city' | 'capital' | 'ruin'
  | 'temple' | 'academy' | 'army' | 'character' | 'settlement' | 'unknown';
export type MovementDirection =
  | 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'stationary';

export interface EntitySnapshot {
  readonly id: number;
  readonly type: EntityType;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly factionId?: number;
  readonly populationCount?: number;
  readonly populationTier?: PopulationTier;
  readonly militaryStrength?: number;
  readonly wealth?: number;
  readonly structures?: readonly string[];
  readonly isCapital?: boolean;
  readonly movementDirection?: MovementDirection;
}

export interface FactionSnapshot {
  readonly id: number;
  readonly name: string;
  readonly color: string;
  readonly capitalId?: number;
}

export interface WorldSnapshot {
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly seed: number;
  readonly tiles: readonly (readonly TileSnapshot[])[];
  readonly entities: readonly EntitySnapshot[];
  readonly events: readonly SerializedEvent[];
  readonly factions: readonly FactionSnapshot[];
}

// ── Inspector (on demand) ────────────────────────────────────────────────────

export interface InspectorQuery {
  readonly type: 'character' | 'faction' | 'site' | 'artifact' | 'event' | 'region';
  readonly id: number;
}

export interface InspectorSection {
  readonly title: string;
  readonly content: string;
}

export interface EntityRef {
  readonly id: number;
  readonly type: string;
  readonly name: string;
}

export interface InspectorResponse {
  readonly entityType: 'character' | 'faction' | 'site' | 'artifact' | 'event' | 'region';
  readonly entityName: string;
  readonly summary: string;
  readonly sections: readonly InspectorSection[];
  readonly prose: readonly string[];
  readonly relatedEntities: readonly EntityRef[];
}

// ── Simulation commands (renderer → main) ────────────────────────────────────

export type SimulationCommand =
  | { readonly type: 'set-speed'; readonly ticksPerSecond: number }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' }
  | { readonly type: 'step'; readonly ticks: number };

// ── Legends Viewer (entity browser) ──────────────────────────────────────────

export interface CharacterSummary {
  readonly id: number;
  readonly name: string;
  readonly race: string;
  readonly profession: string;
  readonly faction: string;
  readonly factionId: number;
  readonly alive: boolean;
  readonly isNotable: boolean;
  readonly deceased: boolean;
  readonly deathCause?: string;
}

export interface FactionSummary {
  readonly id: number;
  readonly name: string;
  readonly governmentType: string;
  readonly memberCount: number;
  readonly territoryCount: number;
}

export interface SiteSummary {
  readonly id: number;
  readonly name: string;
  readonly siteType: string;
  readonly ownerFaction: string;
  readonly ownerFactionId: number;
  readonly population: number;
}

export interface ArtifactSummary {
  readonly id: number;
  readonly name: string;
  readonly artifactType: string;
  readonly currentOwner: string;
  readonly currentOwnerId: number;
}

export interface DeitySummary {
  readonly id: number;
  readonly name: string;
  readonly domain: string;
  readonly followerCount: number;
}

export interface LegendsSummary {
  readonly characters: readonly CharacterSummary[];
  readonly factions: readonly FactionSummary[];
  readonly sites: readonly SiteSummary[];
  readonly artifacts: readonly ArtifactSummary[];
  readonly deities: readonly DeitySummary[];
}

// ── Preload API exposed to renderer ──────────────────────────────────────────

export interface AeternumAPI {
  requestSnapshot(): Promise<WorldSnapshot>;
  sendCommand(command: SimulationCommand): void;
  onTickDelta(callback: (delta: TickDelta) => void): void;
  queryInspector(query: InspectorQuery): Promise<InspectorResponse>;
  queryLegends(): Promise<LegendsSummary>;
}
