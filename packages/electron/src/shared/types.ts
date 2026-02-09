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

export interface EntitySnapshot {
  readonly id: number;
  readonly type: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly factionId?: number;
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

// ── Preload API exposed to renderer ──────────────────────────────────────────

export interface AeternumAPI {
  requestSnapshot(): Promise<WorldSnapshot>;
  sendCommand(command: SimulationCommand): void;
  onTickDelta(callback: (delta: TickDelta) => void): void;
  queryInspector(query: InspectorQuery): Promise<InspectorResponse>;
}
