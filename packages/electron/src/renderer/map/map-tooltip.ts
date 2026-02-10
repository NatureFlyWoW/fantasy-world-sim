/**
 * MapTooltip — HTML tooltip that appears on 300ms hover over a map tile.
 *
 * Shows rich contextual info: biome, terrain data, settlements, armies,
 * characters, resources, and recent events.
 * Design doc Section 6.8.
 */
import type { Viewport } from './viewport.js';
import type { EntitySnapshot } from '../../shared/types.js';
import type { TileDataProvider, TileContext } from './tile-data-provider.js';

const SHOW_DELAY = 300; // ms

export class MapTooltip {
  private readonly el: HTMLDivElement;
  private viewport: Viewport | null = null;
  private provider: TileDataProvider | null = null;
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

  setProvider(
    viewport: Viewport,
    provider: TileDataProvider,
    mapWidth: number,
    mapHeight: number,
  ): void {
    this.viewport = viewport;
    this.provider = provider;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
  }

  /** Update entity data from tick deltas (delegates to provider) */
  updateEntities(entities: EntitySnapshot[]): void {
    if (this.provider !== null) {
      this.provider.updateEntities(entities);
    }
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
    if (this.provider === null) return;
    const ctx = this.provider.getTileContext(wx, wy);
    if (ctx === null) return;

    this.el.innerHTML = this.buildHTML(ctx);
    this.position(mouseX, mouseY);
    this.el.classList.add('visible');
  }

  private buildHTML(ctx: TileContext): string {
    const { tile, wx, wy } = ctx;
    const parts: string[] = [];

    // Biome + coords
    parts.push(`<div class="map-tooltip__biome">${tile.biome}  <span class="map-tooltip__coords">(${wx}, ${wy})</span></div>`);

    // Terrain details
    const terrainDetails: string[] = [];
    terrainDetails.push(`Elev: ${tile.elevation.toFixed(0)}m`);
    terrainDetails.push(`Temp: ${tile.temperature.toFixed(0)}\u00B0C`);
    terrainDetails.push(`Rain: ${tile.rainfall.toFixed(0)}mm`);
    if (tile.leyLine === true) terrainDetails.push('Ley Line');
    parts.push(`<div class="map-tooltip__terrain">${terrainDetails.join(' | ')}</div>`);

    // Settlements
    for (const s of ctx.settlements) {
      const typeLabel = s.isCapital === true ? 'Capital' : s.type;
      let line = `<div class="map-tooltip__settlement">${s.name} (${typeLabel})`;
      if (s.populationTier !== undefined) {
        line += ` <span class="map-tooltip__pop">[${s.populationTier}${s.populationCount !== undefined ? ` ~${s.populationCount}` : ''}]</span>`;
      }
      line += '</div>';
      parts.push(line);

      if (s.factionId !== undefined) {
        const faction = this.provider!.getFaction(s.factionId);
        if (faction !== undefined) {
          parts.push(`<div class="map-tooltip__faction">Faction: <span style="color:${faction.color}">${faction.name}</span></div>`);
        }
      }

      if (s.structures !== undefined && s.structures.length > 0) {
        parts.push(`<div class="map-tooltip__structures">Structures: ${s.structures.join(', ')}</div>`);
      }
    }

    // Armies
    for (const a of ctx.armies) {
      const dir = a.movementDirection !== undefined && a.movementDirection !== 'stationary'
        ? ` moving ${a.movementDirection}` : '';
      const str = a.militaryStrength !== undefined ? ` [str: ${a.militaryStrength}]` : '';
      parts.push(`<div class="map-tooltip__army">${a.name}${str}${dir}</div>`);
      if (a.factionId !== undefined) {
        const faction = this.provider!.getFaction(a.factionId);
        if (faction !== undefined) {
          parts.push(`<div class="map-tooltip__faction"><span style="color:${faction.color}">${faction.name}</span></div>`);
        }
      }
    }

    // Characters
    if (ctx.characters.length > 0) {
      const names = ctx.characters.map(c => c.name).join(', ');
      parts.push(`<div class="map-tooltip__characters">Characters: ${names}</div>`);
    }

    // Resources
    if (tile.resources !== undefined && tile.resources.length > 0) {
      parts.push(`<div class="map-tooltip__resources">Resources: ${tile.resources.join(', ')}</div>`);
    }

    // Recent events
    if (ctx.recentEvents.length > 0) {
      parts.push('<div class="map-tooltip__events-header">Recent Events</div>');
      const last3 = ctx.recentEvents.slice(-3);
      for (const ev of last3) {
        const sig = ev.significance >= 70 ? 'high' : ev.significance >= 40 ? 'mid' : 'low';
        parts.push(`<div class="map-tooltip__event map-tooltip__event--${sig}">${ev.subtype} (${ev.significance})</div>`);
      }
    }

    return parts.join('');
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
