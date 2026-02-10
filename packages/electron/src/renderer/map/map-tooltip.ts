/**
 * MapTooltip — HTML tooltip that appears on 300ms hover over a map tile.
 *
 * Shows biome name, coordinates, settlement/faction info, and resources.
 * Design doc Section 6.8.
 */
import type { Viewport } from './viewport.js';
import type { TileSnapshot, EntitySnapshot, FactionSnapshot } from '../../shared/types.js';

const SHOW_DELAY = 300; // ms

export class MapTooltip {
  private readonly el: HTMLDivElement;
  private viewport: Viewport | null = null;
  private tiles: readonly (readonly TileSnapshot[])[] = [];
  private entities: EntitySnapshot[] = [];
  private factions = new Map<number, FactionSnapshot>();
  private mapWidth = 0;
  private mapHeight = 0;

  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private currentWx = -1;
  private currentWy = -1;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'map-tooltip';
    document.body.appendChild(this.el);
  }

  setData(
    viewport: Viewport,
    tiles: readonly (readonly TileSnapshot[])[],
    entities: EntitySnapshot[],
    factions: FactionSnapshot[],
    mapWidth: number,
    mapHeight: number,
  ): void {
    this.viewport = viewport;
    this.tiles = tiles;
    this.entities = entities;
    this.factions.clear();
    for (const f of factions) this.factions.set(f.id, f);
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
  }

  /** Update entity data from tick deltas */
  updateEntities(entities: EntitySnapshot[]): void {
    this.entities = entities;
  }

  /** Bind to the canvas for mouse tracking. Returns cleanup function. */
  bind(canvas: HTMLCanvasElement): () => void {
    const onMove = (e: MouseEvent): void => {
      if (this.viewport === null) return;

      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const { wx, wy } = this.viewport.screenToWorld(px, py);

      if (wx !== this.currentWx || wy !== this.currentWy) {
        this.currentWx = wx;
        this.currentWy = wy;
        this.hide();

        if (wx >= 0 && wy >= 0 && wx < this.mapWidth && wy < this.mapHeight) {
          this.hoverTimer = setTimeout(() => {
            this.show(wx, wy, e.clientX, e.clientY);
          }, SHOW_DELAY);
        }
      }

      // Update position if already visible
      if (this.el.classList.contains('visible')) {
        this.position(e.clientX, e.clientY);
      }
    };

    const onLeave = (): void => {
      this.hide();
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }

  private show(wx: number, wy: number, mouseX: number, mouseY: number): void {
    const row = this.tiles[wy];
    const tile = row !== undefined ? row[wx] : undefined;
    if (tile === undefined) return;

    let html = `<div class="map-tooltip__biome">${tile.biome}  <span class="map-tooltip__coords">(${wx}, ${wy})</span></div>`;

    // Find entity at this tile
    const entity = this.entities.find(e => e.x === wx && e.y === wy);
    if (entity !== undefined) {
      html += `<div class="map-tooltip__settlement">${entity.name} (${entity.type})</div>`;
      if (entity.factionId !== undefined) {
        const faction = this.factions.get(entity.factionId);
        if (faction !== undefined) {
          html += `<div class="map-tooltip__faction">Faction: <span style="color:${faction.color}">${faction.name}</span></div>`;
        }
      }
    }

    if (tile.resources !== undefined && tile.resources.length > 0) {
      html += `<div class="map-tooltip__resources">Resources: ${tile.resources.join(', ')}</div>`;
    }

    this.el.innerHTML = html;
    this.position(mouseX, mouseY);
    this.el.classList.add('visible');
  }

  private hide(): void {
    if (this.hoverTimer !== null) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
    this.el.classList.remove('visible');
  }

  private position(mouseX: number, mouseY: number): void {
    this.el.style.left = `${mouseX + 12}px`;
    this.el.style.top = `${mouseY + 12}px`;
  }
}
