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
}

const OVERLAY_CYCLE: OverlayType[] = [
  OverlayType.None,
  OverlayType.Political,
  OverlayType.Climate,
];

export interface OverlayModification {
  /** Override background color (hex) */
  bg?: string;
  /** Override glyph tint (hex) */
  fg?: string;
}

export class OverlayManager {
  private current: OverlayType = OverlayType.None;
  private territoryCache = new Map<string, { factionId: number; factionColor: string }>();

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
        // Temperature gradient: cold (blue) -> neutral (gray) -> hot (red)
        const t = Math.max(-30, Math.min(50, temperature));
        const norm = (t + 30) / 80; // 0 = -30°C, 1 = 50°C
        const color = norm < 0.5
          ? blendColors('#1a3860', '#8a8a90', norm * 2)
          : blendColors('#8a8a90', '#c44040', (norm - 0.5) * 2);
        return { bg: color };
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
