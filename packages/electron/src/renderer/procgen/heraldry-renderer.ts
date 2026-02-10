/**
 * Canvas-based heraldry rendering for faction coats of arms.
 *
 * Ports logic from packages/renderer/src/widgets/heraldry.ts to 48×48 canvas.
 */
import { Texture, CanvasSource } from 'pixi.js';
import { getChargeAtlasCanvas, getChargeIndex, type ChargeName } from './charge-atlas.js';
import type { FactionSnapshot, EntitySnapshot, TileSnapshot } from '../../shared/types.js';

// ── Types (ported from heraldry.ts) ──────────────────────────────────────────

export type ShieldShape = 'knightly' | 'round' | 'totem';
export type FieldDivision =
  | 'none' | 'per_pale' | 'per_fess' | 'quarterly' | 'per_bend' | 'per_chevron';
export type ChargeCategory = 'animal' | 'weapon' | 'nature' | 'religious';

export interface Tincture {
  readonly name: string;
  readonly hex: string;
}

export interface FactionProperties {
  readonly name: string;
  readonly culture: string;
  readonly color: string;
  readonly militaryStrength: number;
  readonly economicWealth: number;
  readonly culturalInfluence: number;
  readonly tendencies: readonly string[];
  readonly biome?: string | undefined;
}

export interface CoatOfArms {
  readonly shield: ShieldShape;
  readonly division: FieldDivision;
  readonly primary: Tincture;
  readonly secondary: Tincture;
  readonly chargeName: ChargeName;
  readonly motto: string;
}

// ── Tinctures (mapped to 28-color palette) ────────────────────────────────

const TINCTURES: readonly Tincture[] = [
  { name: 'Gules',   hex: '#c44040' },  // CM - red
  { name: 'Azure',   hex: '#2868a0' },  // TS - blue
  { name: 'Vert',    hex: '#4a7c3e' },  // TG - green
  { name: 'Sable',   hex: '#22222c' },  // BG2 - black
  { name: 'Or',      hex: '#c9a84c' },  // AU2 - gold
  { name: 'Argent',  hex: '#d0d8e8' },  // FS - silver/white
  { name: 'Purpure', hex: '#b87acc' },  // CR - purple
  { name: 'Tenne',   hex: '#c8a060' },  // TD - orange-brown
] as const;

// ── Charge mapping ─────────────────────────────────────────────────────────

const ANIMAL_CHARGES: readonly ChargeName[] = ['Lion', 'Eagle', 'Dragon', 'Serpent'];
const WEAPON_CHARGES: readonly ChargeName[] = ['Sword', 'Axe', 'Shield', 'Tower'];
const NATURE_CHARGES: readonly ChargeName[] = ['Tree', 'Mountain', 'Star', 'Moon'];
const RELIGIOUS_CHARGES: readonly ChargeName[] = ['Cross', 'Chalice', 'Eye', 'Book'];

// ── Culture → shield shape ──────────────────────────────────────────────────

const CULTURE_SHIELD_MAP: Record<string, ShieldShape> = {
  nordic: 'knightly', dwarven: 'knightly',
  elvish: 'round', desert: 'round', eastern: 'round', fey: 'round',
  infernal: 'totem',
};

function getShieldShape(culture: string): ShieldShape {
  return CULTURE_SHIELD_MAP[culture] ?? 'knightly';
}

// ── Tendency → charge category ────────────────────────────────────────────

const TENDENCY_CHARGE_WEIGHTS: Record<string, ChargeCategory> = {
  militaristic: 'weapon', expansionist: 'weapon', industrious: 'weapon',
  scholarly: 'nature', mercantile: 'nature', agrarian: 'nature', artistic: 'nature',
  nomadic: 'animal', isolationist: 'animal', seafaring: 'animal',
  religious: 'religious', mystical: 'religious',
};

function getChargesForCategory(category: ChargeCategory): readonly ChargeName[] {
  switch (category) {
    case 'animal':    return ANIMAL_CHARGES;
    case 'weapon':    return WEAPON_CHARGES;
    case 'nature':    return NATURE_CHARGES;
    case 'religious': return RELIGIOUS_CHARGES;
  }
}

// ── Deterministic hash (from heraldry.ts) ─────────────────────────────────

function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function pickFromHash<T>(arr: readonly T[], hash: number, offset: number): T {
  const idx = (((hash >>> offset) ^ (hash >>> (offset + 8))) >>> 0) % arr.length;
  return arr[idx]!;
}

// ── Field division derivation ─────────────────────────────────────────────

const DIVISIONS: readonly FieldDivision[] = [
  'none', 'per_pale', 'per_fess', 'quarterly', 'per_bend', 'per_chevron',
];

function deriveDivision(hash: number): FieldDivision {
  return pickFromHash(DIVISIONS, hash, 8);
}

// ── Tincture derivation ────────────────────────────────────────────────────

function derivePrimaryTincture(props: FactionProperties, hash: number): Tincture {
  const pool: Tincture[] = [];
  const hasTendency = (t: string) => props.tendencies.includes(t);

  if (props.militaryStrength > 60 || hasTendency('militaristic')) {
    pool.push(TINCTURES[0]!); // Gules
  }
  if (hasTendency('scholarly') || hasTendency('mystical')) {
    pool.push(TINCTURES[1]!); // Azure
  }
  if (hasTendency('religious')) {
    pool.push(TINCTURES[6]!); // Purpure
  }
  if (props.economicWealth > 60 || hasTendency('mercantile')) {
    pool.push(TINCTURES[4]!); // Or
  }
  if (props.biome === 'Forest' || props.biome === 'Jungle' || hasTendency('agrarian')) {
    pool.push(TINCTURES[2]!); // Vert
  }
  if (props.biome === 'Mountain' || hasTendency('industrious')) {
    pool.push(TINCTURES[3]!); // Sable
  }
  if (props.biome === 'Desert' || hasTendency('nomadic')) {
    pool.push(TINCTURES[7]!); // Tenne
  }
  if (props.biome === 'Coast' || props.biome === 'Ocean' || hasTendency('seafaring')) {
    pool.push(TINCTURES[1]!); // Azure
  }

  if (pool.length === 0) return pickFromHash(TINCTURES, hash, 0);
  return pickFromHash(pool, hash, 4);
}

function deriveSecondaryTincture(primary: Tincture, hash: number): Tincture {
  const candidates = TINCTURES.filter(t => t.name !== primary.name);
  return pickFromHash(candidates, hash, 12);
}

// ── Charge selection ───────────────────────────────────────────────────────

function pickChargeCategory(tendencies: readonly string[], hash: number): ChargeCategory {
  const counts: Record<ChargeCategory, number> = { animal: 0, weapon: 0, nature: 0, religious: 0 };
  for (const t of tendencies) {
    const cat = TENDENCY_CHARGE_WEIGHTS[t];
    if (cat !== undefined) counts[cat]++;
  }

  let best: ChargeCategory = 'animal';
  let bestCount = -1;
  const categories: ChargeCategory[] = ['animal', 'weapon', 'nature', 'religious'];
  for (const cat of categories) {
    if (counts[cat] > bestCount || (counts[cat] === bestCount && (hash & 1) === 0)) {
      best = cat;
      bestCount = counts[cat];
    }
  }
  return best;
}

// ── Motto generation ────────────────────────────────────────────────────────

const MOTTO_PREFIXES = [
  'Strength', 'Honor', 'Glory', 'Wisdom', 'Valor',
  'Faith', 'Iron', 'Fire', 'Blood', 'Thunder',
  'Shadow', 'Light', 'Stone', 'Storm', 'Fortune',
  'Steel', 'Dawn', 'Night', 'Flame', 'Frost',
];

const MOTTO_SUFFIXES = [
  'Endures', 'Prevails', 'Conquers', 'Illuminates', 'Protects',
  'Guides', 'Reigns', 'Unites', 'Burns Eternal', 'Never Fades',
  'Above All', 'Is Our Shield', 'Through Darkness', 'In All Things', 'Forever',
  'Without Fear', 'Without Mercy', 'Through Trial', 'Before Glory', 'Or Death',
];

function generateMotto(hash: number): string {
  const prefix = pickFromHash(MOTTO_PREFIXES, hash, 16);
  const suffix = pickFromHash(MOTTO_SUFFIXES, hash, 20);
  return `${prefix} ${suffix}`;
}

// ── CoatOfArms generation ─────────────────────────────────────────────────

function generateCoatOfArms(props: FactionProperties): CoatOfArms {
  const hash = hashString(props.name + props.culture + props.color);

  const shield = getShieldShape(props.culture);
  const division = deriveDivision(hash);
  const primary = derivePrimaryTincture(props, hash);
  const secondary = deriveSecondaryTincture(primary, hash);

  const chargeCategory = pickChargeCategory(props.tendencies, hash);
  const charges = getChargesForCategory(chargeCategory);
  const chargeName = pickFromHash(charges, hash, 24);

  const motto = generateMotto(hash);

  return { shield, division, primary, secondary, chargeName, motto };
}

// ── Canvas rendering ───────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

/**
 * Render a 48×48 canvas with the faction's coat of arms.
 */
function renderHeraldryCanvas(arms: CoatOfArms): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 48, 48);

  // Draw shield outline (2px border in AU0 #6b4e0a)
  ctx.strokeStyle = '#6b4e0a';
  ctx.lineWidth = 2;
  ctx.fillStyle = arms.primary.hex;

  switch (arms.shield) {
    case 'knightly': {
      // Pointed bottom shield (heater shield)
      ctx.beginPath();
      ctx.moveTo(8, 6);
      ctx.arcTo(40, 6, 40, 38, 4);
      ctx.lineTo(40, 32);
      ctx.lineTo(24, 42);
      ctx.lineTo(8, 32);
      ctx.lineTo(8, 10);
      ctx.arcTo(8, 6, 40, 6, 4);
      ctx.closePath();
      break;
    }
    case 'round': {
      // Circle
      ctx.beginPath();
      ctx.arc(24, 24, 20, 0, Math.PI * 2);
      ctx.closePath();
      break;
    }
    case 'totem': {
      // Tall rectangle with rounded top
      ctx.beginPath();
      ctx.moveTo(12, 42);
      ctx.lineTo(12, 10);
      ctx.arcTo(12, 6, 36, 6, 4);
      ctx.lineTo(36, 6);
      ctx.arcTo(36, 6, 36, 42, 4);
      ctx.lineTo(36, 42);
      ctx.closePath();
      break;
    }
  }

  // Fill field with division pattern
  ctx.save();
  ctx.clip(); // Clip to shield shape

  if (arms.division === 'none') {
    ctx.fillStyle = arms.primary.hex;
    ctx.fill();
  } else {
    // Draw division pattern
    const [pr, pg, pb] = hexToRgb(arms.primary.hex);
    const [sr, sg, sb] = hexToRgb(arms.secondary.hex);

    // Create ImageData for per-pixel field division
    const imageData = ctx.createImageData(48, 48);
    const data = imageData.data;

    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        const idx = (y * 48 + x) * 4;
        let usePrimary = true;

        switch (arms.division) {
          case 'per_pale':
            usePrimary = x < 24;
            break;
          case 'per_fess':
            usePrimary = y < 24;
            break;
          case 'quarterly':
            usePrimary = (x < 24 && y < 24) || (x >= 24 && y >= 24);
            break;
          case 'per_bend':
            usePrimary = y < x;
            break;
          case 'per_chevron': {
            const distFromCenter = Math.abs(x - 24) / 24;
            usePrimary = y < 24 - distFromCenter * 24;
            break;
          }
        }

        if (usePrimary) {
          data[idx] = pr;
          data[idx + 1] = pg;
          data[idx + 2] = pb;
        } else {
          data[idx] = sr;
          data[idx + 1] = sg;
          data[idx + 2] = sb;
        }
        data[idx + 3] = 255; // Alpha
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  ctx.restore();

  // Draw shield stroke
  ctx.stroke();

  // Draw charge from atlas, tinted with secondary color
  const atlasCanvas = getChargeAtlasCanvas();
  const chargeIdx = getChargeIndex(arms.chargeName);
  const chargeCol = chargeIdx % 4;
  const chargeRow = Math.floor(chargeIdx / 4);
  const sx = chargeCol * 16;
  const sy = chargeRow * 16;

  // Draw white charge to temp canvas, then tint via composite
  const chargeCanvas = document.createElement('canvas');
  chargeCanvas.width = 16;
  chargeCanvas.height = 16;
  const cctx = chargeCanvas.getContext('2d')!;
  cctx.drawImage(atlasCanvas, sx, sy, 16, 16, 0, 0, 16, 16);

  // Tint: fill with secondary color using 'source-in' to only color opaque pixels
  cctx.globalCompositeOperation = 'source-in';
  cctx.fillStyle = arms.secondary.hex;
  cctx.fillRect(0, 0, 16, 16);

  // Draw tinted charge centered on shield (scaled up to 20x20 for visibility)
  ctx.drawImage(chargeCanvas, 14, 14, 20, 20);

  return canvas;
}

// ── Caching ────────────────────────────────────────────────────────────────

const heraldryCache = new Map<string, Texture>();

/**
 * Extract FactionProperties from snapshot data.
 */
export function extractFactionProperties(
  faction: FactionSnapshot,
  entities: readonly EntitySnapshot[],
  tiles: readonly (readonly TileSnapshot[])[]
): FactionProperties {
  const factionEntities = entities.filter(e => e.factionId === faction.id);

  const settlements = factionEntities.filter(e =>
    e.type === 'village' || e.type === 'town' || e.type === 'city' || e.type === 'capital'
  );
  const armies = factionEntities.filter(e => e.type === 'army');
  const temples = factionEntities.filter(e => e.type === 'temple');
  const academies = factionEntities.filter(e => e.type === 'academy');

  const militaryStrength = armies.length * 10 + Math.min(settlements.length * 5, 50);
  const economicWealth = settlements.reduce((sum, s) => sum + (s.wealth ?? 10), 0);
  const culturalInfluence = settlements.length * 10 + temples.length * 5;

  const tendencies: string[] = [];
  if (armies.length > 3) tendencies.push('militaristic');
  if (economicWealth > 100) tendencies.push('mercantile');
  if (temples.length > 2) tendencies.push('religious');
  if (academies.length > 1) tendencies.push('scholarly');
  if (settlements.length > 5) tendencies.push('expansionist');
  if (tendencies.length === 0) tendencies.push('agrarian');

  const capital = entities.find(e => e.id === faction.capitalId);
  let biome: string | undefined = undefined;
  if (capital !== undefined) {
    const row = tiles[capital.y];
    if (row !== undefined) {
      const tile = row[capital.x];
      if (tile !== undefined) {
        biome = tile.biome;
      }
    }
  }

  const culture = 'nordic';

  return {
    name: faction.name,
    culture,
    color: faction.color,
    militaryStrength: Math.min(militaryStrength, 100),
    economicWealth: Math.min(economicWealth, 100),
    culturalInfluence: Math.min(culturalInfluence, 100),
    tendencies,
    biome,
  };
}

/**
 * Generate (or retrieve from cache) a PixiJS texture for faction heraldry.
 */
export function generateHeraldryTexture(props: FactionProperties): Texture {
  const cacheKey = hashString(props.name + props.culture + props.color).toString();
  const cached = heraldryCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const arms = generateCoatOfArms(props);
  const canvas = renderHeraldryCanvas(arms);
  const source = new CanvasSource({ resource: canvas, scaleMode: 'nearest' });
  const texture = new Texture({ source });

  heraldryCache.set(cacheKey, texture);
  return texture;
}

/**
 * Get heraldry texture for a faction by snapshot.
 */
export function getHeraldryTexture(
  faction: FactionSnapshot,
  entities: readonly EntitySnapshot[],
  tiles: readonly (readonly TileSnapshot[])[]
): Texture {
  const props = extractFactionProperties(faction, entities, tiles);
  return generateHeraldryTexture(props);
}
