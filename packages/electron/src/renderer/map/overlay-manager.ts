/**
 * OverlayManager — manages map overlay state and computes tile color modifications.
 *
 * Phase 1 implements Political and Climate overlays. Military/Trade/Magic
 * overlays will follow in Phase 2-3.
 */

export enum OverlayType {
  None = 'None',
  Political = 'Political',
  Climate = 'Climate',
  Economic = 'Economic',
}

const OVERLAY_CYCLE: OverlayType[] = [
  OverlayType.None,
  OverlayType.Political,
  OverlayType.Climate,
  OverlayType.Economic,
];

export interface OverlayModification {
  /** Override background color (hex) */
  bg?: string;
  /** Override glyph tint (hex) */
  fg?: string;
}

export interface TradeRouteEntry {
  connections: readonly ('N' | 'S' | 'E' | 'W')[];
  isHub: boolean;
}

export class OverlayManager {
  private current: OverlayType = OverlayType.None;
  private territoryCache = new Map<string, { factionId: number; factionColor: string }>();
  private tradeRouteCache = new Map<string, TradeRouteEntry>();

  get activeOverlay(): OverlayType { return this.current; }

  cycle(): OverlayType {
    const idx = OVERLAY_CYCLE.indexOf(this.current);
    this.current = OVERLAY_CYCLE[(idx + 1) % OVERLAY_CYCLE.length]!;
    return this.current;
  }

  /**
   * Build territory cache from entity positions.
   * Each settlement claims a diamond-shaped radius for its faction.
   */
  buildTerritoryCache(
    entities: readonly { x: number; y: number; factionId?: number }[],
    factionColors: Map<number, string>,
  ): void {
    this.territoryCache.clear();
    const TERRITORY_RADIUS = 8;

    for (const entity of entities) {
      if (entity.factionId === undefined) continue;
      const color = factionColors.get(entity.factionId);
      if (color === undefined) continue;

      for (let dy = -TERRITORY_RADIUS; dy <= TERRITORY_RADIUS; dy++) {
        for (let dx = -TERRITORY_RADIUS; dx <= TERRITORY_RADIUS; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > TERRITORY_RADIUS) continue;
          const key = `${entity.x + dx},${entity.y + dy}`;
          // Closest settlement wins (first write wins)
          if (!this.territoryCache.has(key)) {
            this.territoryCache.set(key, { factionId: entity.factionId, factionColor: color });
          }
        }
      }
    }
  }

  /**
   * Build trade route cache from entity wealth data.
   * Connects top 10 wealthy settlements via Bresenham lines.
   */
  buildTradeRouteCache(
    entities: readonly { x: number; y: number; wealth?: number }[],
  ): void {
    this.tradeRouteCache.clear();

    const hubs = entities
      .filter(e => e.wealth !== undefined && e.wealth > 0)
      .map(e => ({ x: e.x, y: e.y, wealth: e.wealth! }))
      .sort((a, b) => b.wealth - a.wealth)
      .slice(0, 10);

    // Mark hub tiles
    for (const hub of hubs) {
      this.tradeRouteCache.set(`${hub.x},${hub.y}`, { connections: [], isHub: true });
    }

    // Connect hubs within range
    const TRADE_RANGE = 50;
    for (let i = 0; i < hubs.length; i++) {
      const a = hubs[i]!;
      for (let j = i + 1; j < hubs.length; j++) {
        const b = hubs[j]!;
        const dist = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
        if (dist > TRADE_RANGE) continue;
        if (a.wealth + b.wealth < 500) continue;
        this.traceRoute(a.x, a.y, b.x, b.y);
      }
    }
  }

  /** Get trade route entry at a tile position */
  getTradeRoute(wx: number, wy: number): TradeRouteEntry | undefined {
    return this.tradeRouteCache.get(`${wx},${wy}`);
  }

  private traceRoute(x0: number, y0: number, x1: number, y1: number): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0;
    let cy = y0;
    let prevX = x0;
    let prevY = y0;

    while (true) {
      const key = `${cx},${cy}`;
      const existing = this.tradeRouteCache.get(key);
      const connections = new Set<'N' | 'S' | 'E' | 'W'>(existing?.connections ?? []);

      if (cx !== x0 || cy !== y0) {
        if (prevX < cx) connections.add('W');
        if (prevX > cx) connections.add('E');
        if (prevY < cy) connections.add('N');
        if (prevY > cy) connections.add('S');
      }
      if (cx !== x1 || cy !== y1) {
        if (x1 > cx) connections.add('E');
        if (x1 < cx) connections.add('W');
        if (y1 > cy) connections.add('S');
        if (y1 < cy) connections.add('N');
      }

      if (existing?.isHub !== true) {
        this.tradeRouteCache.set(key, {
          connections: [...connections],
          isHub: existing?.isHub ?? false,
        });
      }

      if (cx === x1 && cy === y1) break;
      prevX = cx;
      prevY = cy;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
    }
  }

  /**
   * Get overlay modification for a world tile.
   * Returns null if no modification applies.
   */
  getModification(wx: number, wy: number, temperature?: number, _rainfall?: number): OverlayModification | null {
    switch (this.current) {
      case OverlayType.None:
        return null;

      case OverlayType.Political: {
        const territory = this.territoryCache.get(`${wx},${wy}`);
        if (territory === undefined) return null;
        return { bg: blendColors('#16161e', territory.factionColor, 0.3) };
      }

      case OverlayType.Climate: {
        if (temperature === undefined) return null;
        const t = Math.max(-30, Math.min(50, temperature));
        const norm = (t + 30) / 80;
        const color = norm < 0.5
          ? blendColors('#1a3860', '#8a8a90', norm * 2)
          : blendColors('#8a8a90', '#c44040', (norm - 0.5) * 2);
        return { bg: color };
      }

      case OverlayType.Economic: {
        const route = this.tradeRouteCache.get(`${wx},${wy}`);
        if (route === undefined) return null;
        // Gold tint for trade routes/hubs
        return { bg: route.isHub ? '#3a3010' : '#2a2408' };
      }

      default:
        return null;
    }
  }
}

/** Blend two hex colors. t=0 returns c1, t=1 returns c2. */
function blendColors(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
