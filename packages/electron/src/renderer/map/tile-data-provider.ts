/**
 * TileDataProvider — merges snapshot + accumulated deltas into queryable tile context.
 *
 * Provides spatial entity index and event buffer for rich tooltip rendering.
 */
import type {
  TileSnapshot, EntitySnapshot, FactionSnapshot, SerializedEvent,
} from '../../shared/types.js';

export interface TileContext {
  readonly tile: TileSnapshot;
  readonly wx: number;
  readonly wy: number;
  readonly settlements: readonly EntitySnapshot[];
  readonly armies: readonly EntitySnapshot[];
  readonly characters: readonly EntitySnapshot[];
  readonly otherEntities: readonly EntitySnapshot[];
  readonly recentEvents: readonly SerializedEvent[];
}

export class TileDataProvider {
  private tiles: readonly (readonly TileSnapshot[])[] = [];
  private entityIndex = new Map<string, EntitySnapshot[]>();
  private eventBuffer = new Map<string, SerializedEvent[]>();
  private factions = new Map<number, FactionSnapshot>();
  private mapWidth = 0;
  private mapHeight = 0;

  init(
    tiles: readonly (readonly TileSnapshot[])[],
    entities: readonly EntitySnapshot[],
    factions: readonly FactionSnapshot[],
    mapWidth: number,
    mapHeight: number,
  ): void {
    this.tiles = tiles;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.factions.clear();
    for (const f of factions) this.factions.set(f.id, f);
    this.rebuildEntityIndex(entities);
  }

  updateEntities(entities: readonly EntitySnapshot[]): void {
    this.rebuildEntityIndex(entities);
  }

  addEvents(events: readonly SerializedEvent[], entities: readonly EntitySnapshot[]): void {
    for (const event of events) {
      for (const pid of event.participants) {
        const entity = entities.find(e => e.id === pid);
        if (entity !== undefined) {
          const key = `${entity.x},${entity.y}`;
          const existing = this.eventBuffer.get(key) ?? [];
          existing.push(event);
          if (existing.length > 5) existing.shift();
          this.eventBuffer.set(key, existing);
        }
      }
    }
  }

  getFaction(id: number): FactionSnapshot | undefined {
    return this.factions.get(id);
  }

  getTileContext(wx: number, wy: number): TileContext | null {
    if (wx < 0 || wy < 0 || wx >= this.mapWidth || wy >= this.mapHeight) return null;
    const row = this.tiles[wy];
    const tile = row !== undefined ? row[wx] : undefined;
    if (tile === undefined) return null;

    const key = `${wx},${wy}`;
    const allEntities = this.entityIndex.get(key) ?? [];

    const settlements: EntitySnapshot[] = [];
    const armies: EntitySnapshot[] = [];
    const characters: EntitySnapshot[] = [];
    const otherEntities: EntitySnapshot[] = [];

    for (const e of allEntities) {
      switch (e.type) {
        case 'village': case 'town': case 'city': case 'capital':
        case 'settlement': case 'ruin': case 'temple': case 'academy':
          settlements.push(e);
          break;
        case 'army':
          armies.push(e);
          break;
        case 'character':
          characters.push(e);
          break;
        default:
          otherEntities.push(e);
      }
    }

    return {
      tile,
      wx,
      wy,
      settlements,
      armies,
      characters,
      otherEntities,
      recentEvents: this.eventBuffer.get(key) ?? [],
    };
  }

  private rebuildEntityIndex(entities: readonly EntitySnapshot[]): void {
    this.entityIndex.clear();
    for (const e of entities) {
      const key = `${e.x},${e.y}`;
      const existing = this.entityIndex.get(key);
      if (existing !== undefined) {
        existing.push(e);
      } else {
        this.entityIndex.set(key, [e]);
      }
    }
  }
}
