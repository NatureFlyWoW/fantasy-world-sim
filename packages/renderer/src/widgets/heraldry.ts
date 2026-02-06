/**
 * Procedural Heraldry — ASCII art coat-of-arms generation.
 *
 * Generates culture-appropriate shield shapes, field divisions, charges,
 * and tinctures from faction properties. Heraldry evolves with political
 * events (revolution, dynasty change, expansion, union).
 *
 * Display sizes: large (faction inspector), small (map markers), inline (narratives).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shield shape determined by culture type. */
export type ShieldShape = 'knightly' | 'round' | 'totem';

/** Heraldic field division patterns. */
export type FieldDivision =
  | 'none'
  | 'per_pale'    // vertical split
  | 'per_fess'    // horizontal split
  | 'quarterly'   // 4 sections
  | 'per_bend'    // diagonal
  | 'per_chevron'; // V-shape

/** Charge category. */
export type ChargeCategory = 'animal' | 'weapon' | 'nature' | 'religious';

/** A single heraldic charge (symbol). */
export interface Charge {
  readonly category: ChargeCategory;
  readonly name: string;
  /** Large representation (multi-char ok). */
  readonly symbolLarge: string;
  /** Compact single char for small/inline display. */
  readonly symbolSmall: string;
}

/** A heraldic tincture (color). */
export interface Tincture {
  readonly name: string;
  readonly hex: string;
  /** ASCII fill char used in monochrome renders. */
  readonly fill: string;
}

/** Complete coat of arms. */
export interface CoatOfArms {
  readonly shield: ShieldShape;
  readonly division: FieldDivision;
  readonly primary: Tincture;
  readonly secondary: Tincture;
  readonly charge: Charge;
  /** Optional secondary charge for quarterly / union arms. */
  readonly secondaryCharge?: Charge | undefined;
  /** Motto text. */
  readonly motto: string;
  /** Lineage — tracks evolution history. */
  readonly history: readonly HeraldryEvent[];
}

/** Political event that modified heraldry. */
export interface HeraldryEvent {
  readonly year: number;
  readonly type: 'creation' | 'revolution' | 'dynasty_change' | 'expansion' | 'union';
  readonly description: string;
}

/** Properties fed into the generator. No ECS dependency. */
export interface FactionProperties {
  readonly name: string;
  readonly culture: string;        // name-culture id: nordic, elvish, etc.
  readonly color: string;          // faction hex color
  readonly militaryStrength: number;   // 0-100
  readonly economicWealth: number;     // 0-100
  readonly culturalInfluence: number;  // 0-100
  readonly tendencies: readonly string[];  // CulturalTendency values
  readonly biome?: string | undefined;     // dominant biome for terrain tint
}

/** Display size for rendering. */
export type DisplaySize = 'large' | 'small' | 'inline';

// ---------------------------------------------------------------------------
// Tinctures (heraldic colors)
// ---------------------------------------------------------------------------

const TINCTURES: readonly Tincture[] = [
  { name: 'Gules',   hex: '#cc2222', fill: '#' },   // red
  { name: 'Azure',   hex: '#2244aa', fill: '~' },   // blue
  { name: 'Vert',    hex: '#228833', fill: '%' },   // green
  { name: 'Sable',   hex: '#222222', fill: '@' },   // black
  { name: 'Or',      hex: '#ddaa22', fill: '$' },   // gold
  { name: 'Argent',  hex: '#cccccc', fill: '.' },   // silver/white
  { name: 'Purpure', hex: '#882288', fill: '&' },   // purple
  { name: 'Tenne',   hex: '#cc6622', fill: '!' },   // orange-brown
] as const;

// ---------------------------------------------------------------------------
// Charges
// ---------------------------------------------------------------------------

const ANIMAL_CHARGES: readonly Charge[] = [
  { category: 'animal', name: 'Lion',    symbolLarge: ' /\\___/\\ ', symbolSmall: '\u264C' },  // ♌
  { category: 'animal', name: 'Dragon',  symbolLarge: '  /\\_/\\  ', symbolSmall: '\u2726' },  // ✦
  { category: 'animal', name: 'Eagle',   symbolLarge: '  \\V/   ', symbolSmall: '\u25BC' },    // ▼
  { category: 'animal', name: 'Wolf',    symbolLarge: '  {\\o/} ', symbolSmall: '\u03C9' },    // ω
  { category: 'animal', name: 'Bear',    symbolLarge: '  (oO)  ', symbolSmall: '\u03A9' },    // Ω
  { category: 'animal', name: 'Stag',    symbolLarge: '  |Y|   ', symbolSmall: '\u2648' },    // ♈
  { category: 'animal', name: 'Serpent', symbolLarge: '  ~S~   ', symbolSmall: '\u223C' },    // ∼
  { category: 'animal', name: 'Raven',   symbolLarge: '  >v<   ', symbolSmall: '\u2666' },    // ♦
];

const WEAPON_CHARGES: readonly Charge[] = [
  { category: 'weapon', name: 'Sword',   symbolLarge: '  --|-- ', symbolSmall: '\u2694' },  // ⚔
  { category: 'weapon', name: 'Mace',    symbolLarge: '  --*   ', symbolSmall: '\u2720' },  // ✠
  { category: 'weapon', name: 'Spear',   symbolLarge: '   |>   ', symbolSmall: '\u2191' },  // ↑
  { category: 'weapon', name: 'Shield',  symbolLarge: '  [=]   ', symbolSmall: '\u2295' },  // ⊕
  { category: 'weapon', name: 'Axe',     symbolLarge: '  P--   ', symbolSmall: '\u2020' },  // †
  { category: 'weapon', name: 'Hammer',  symbolLarge: '  T--   ', symbolSmall: '\u22A4' },  // ⊤
];

const NATURE_CHARGES: readonly Charge[] = [
  { category: 'nature', name: 'Sun',      symbolLarge: '  \\O/  ', symbolSmall: '\u263C' },  // ☼
  { category: 'nature', name: 'Moon',     symbolLarge: '  (C)   ', symbolSmall: '\u263D' },  // ☽
  { category: 'nature', name: 'Star',     symbolLarge: '  -X-   ', symbolSmall: '\u2605' },  // ★
  { category: 'nature', name: 'Gem',      symbolLarge: '  <>    ', symbolSmall: '\u2666' },  // ♦
  { category: 'nature', name: 'Mountain', symbolLarge: '  /\\   ', symbolSmall: '\u25B2' },  // ▲
  { category: 'nature', name: 'River',    symbolLarge: '  ~~~   ', symbolSmall: '\u2248' },  // ≈
  { category: 'nature', name: 'Tree',     symbolLarge: '  {|}   ', symbolSmall: '\u2663' },  // ♣
  { category: 'nature', name: 'Flame',    symbolLarge: '  (\\)  ', symbolSmall: '\u2600' },  // ☀
];

const RELIGIOUS_CHARGES: readonly Charge[] = [
  { category: 'religious', name: 'Cross',    symbolLarge: '  -|-   ', symbolSmall: '\u271D' },  // ✝
  { category: 'religious', name: 'Crescent', symbolLarge: '  (     ', symbolSmall: '\u262A' },  // ☪
  { category: 'religious', name: 'Pentacle', symbolLarge: '  {*}   ', symbolSmall: '\u2721' },  // ✡
  { category: 'religious', name: 'Infinity', symbolLarge: '  ~8~   ', symbolSmall: '\u221E' },  // ∞
  { category: 'religious', name: 'Eye',      symbolLarge: '  (O)   ', symbolSmall: '\u25C9' },  // ◉
  { category: 'religious', name: 'Ankh',     symbolLarge: '  oT    ', symbolSmall: '\u2625' },  // ☥
];

const ALL_CHARGES: readonly Charge[] = [
  ...ANIMAL_CHARGES,
  ...WEAPON_CHARGES,
  ...NATURE_CHARGES,
  ...RELIGIOUS_CHARGES,
];

// ---------------------------------------------------------------------------
// Shield templates (ASCII art)
// ---------------------------------------------------------------------------

/**
 * Large shield templates. Each line is exactly the stated width.
 * Placeholders:
 *   {f1}/{f2}  — field fill characters (primary/secondary)
 *   {ch}       — central charge symbol
 *   {mt}       — motto
 */

/** Knightly (European) shield — 11 wide × 7 tall. */
const KNIGHTLY_SHIELD = [
  '\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557',       // ╔═════════╗
  '\u2551{f1}{f1}{f1}{f1}{ch}{f2}{f2}{f2}{f2}\u2551',                          // ║ field+charge ║
  '\u2551{f1}{f1}{f1}{f1}{ch}{f2}{f2}{f2}{f2}\u2551',                          // ║ field+charge ║
  '\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563',       // ╠═════════╣
  '\u2551{f2}{f2}{f2}{f2}{ch}{f1}{f1}{f1}{f1}\u2551',                          // ║ field+charge ║
  ' \u2559\u2550\u2550\u2550\u2550\u2568\u2550\u2550\u2550\u255C ',           // ╙════╨════╜
];

/** Round (Mediterranean) shield — 11 wide × 6 tall. */
const ROUND_SHIELD = [
  ' \u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E ',     // ╭─────────╮
  '\u2502{f1}{f1}{f1}{f1}{ch}{f2}{f2}{f2}{f2}\u2502',                          // │ field+charge │
  '\u2502{f1}{f1}{f1}{f1}{ch}{f2}{f2}{f2}{f2}\u2502',                          // │ field+charge │
  '\u2502{f2}{f2}{f2}{f2}{ch}{f1}{f1}{f1}{f1}\u2502',                          // │ field+charge │
  ' \u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F ',     // ╰─────────╯
];

/** Totem (Tribal) shield — 7 wide × 7 tall. */
const TOTEM_SHIELD = [
  '\u2554\u2550\u2550\u2550\u2550\u2550\u2557',           // ╔═════╗
  '\u2551{f1}{ch}{f1}{ch}{f1}\u2551',                      // ║ field+charge ║
  '\u2551{f1}{ch}{f1}{ch}{f1}\u2551',                      // ║ field+charge ║
  '\u2551{f2}{ch}{f2}{ch}{f2}\u2551',                      // ║ field+charge ║
  '\u2551{f2}{ch}{f2}{ch}{f2}\u2551',                      // ║ field+charge ║
  '\u255A\u2550\u2550\u2568\u2550\u2550\u255D',           // ╚══╨══╝
];

/** Small shield templates — 5 wide × 3 tall. */
const SMALL_KNIGHTLY = [
  '\u250C\u2500\u2500\u2500\u2510',   // ┌───┐
  '\u2502{ch}{f1}{ch}\u2502',          // │ charge+field │
  '\u2514\u2500\u2534\u2500\u2518',   // └─┴─┘
];

const SMALL_ROUND = [
  '\u256D\u2500\u2500\u2500\u256E',   // ╭───╮
  '\u2502{ch}{f1}{ch}\u2502',          // │ charge+field │
  '\u2570\u2500\u2500\u2500\u256F',   // ╰───╯
];

const SMALL_TOTEM = [
  '\u250C\u2500\u2500\u2500\u2510',   // ┌───┐
  '\u2502{ch}{f1}{ch}\u2502',          // │ charge+field │
  '\u2514\u2500\u2534\u2500\u2518',   // └─┴─┘
];

// ---------------------------------------------------------------------------
// Simple deterministic hash (no crypto dependency)
// ---------------------------------------------------------------------------

function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return hash >>> 0; // unsigned
}

function pickFromHash<T>(arr: readonly T[], hash: number, offset: number): T {
  // >>> 0 ensures the XOR result is an unsigned 32-bit integer (XOR returns signed)
  const idx = (((hash >>> offset) ^ (hash >>> (offset + 8))) >>> 0) % arr.length;
  return arr[idx]!;
}

// ---------------------------------------------------------------------------
// Culture → shield shape mapping
// ---------------------------------------------------------------------------

const CULTURE_SHIELD_MAP: Readonly<Record<string, ShieldShape>> = {
  nordic:   'knightly',
  dwarven:  'knightly',
  elvish:   'round',
  desert:   'round',
  eastern:  'round',
  fey:      'round',
  infernal: 'totem',
};

/** Resolve shield shape for a culture. Defaults to knightly. */
export function getShieldShape(culture: string): ShieldShape {
  return CULTURE_SHIELD_MAP[culture] ?? 'knightly';
}

// ---------------------------------------------------------------------------
// Tendency → charge category weighting
// ---------------------------------------------------------------------------

const TENDENCY_CHARGE_WEIGHTS: Readonly<Record<string, ChargeCategory>> = {
  militaristic: 'weapon',
  expansionist: 'weapon',
  scholarly:    'nature',
  mercantile:   'nature',
  agrarian:     'nature',
  nomadic:      'animal',
  artistic:     'nature',
  religious:    'religious',
  isolationist: 'animal',
  seafaring:    'animal',
  industrious:  'weapon',
  mystical:     'religious',
};

/** Pick the dominant charge category for a set of tendencies. */
function pickChargeCategory(tendencies: readonly string[], hash: number): ChargeCategory {
  const counts: Record<ChargeCategory, number> = { animal: 0, weapon: 0, nature: 0, religious: 0 };
  for (const t of tendencies) {
    const cat = TENDENCY_CHARGE_WEIGHTS[t];
    if (cat !== undefined) {
      counts[cat]++;
    }
  }
  // Highest count wins; ties broken by hash
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

function getChargesForCategory(category: ChargeCategory): readonly Charge[] {
  switch (category) {
    case 'animal':   return ANIMAL_CHARGES;
    case 'weapon':   return WEAPON_CHARGES;
    case 'nature':   return NATURE_CHARGES;
    case 'religious': return RELIGIOUS_CHARGES;
  }
}

// ---------------------------------------------------------------------------
// Tincture derivation from faction properties
// ---------------------------------------------------------------------------

/** Bias tincture selection by faction values / biome. */
function derivePrimaryTincture(props: FactionProperties, hash: number): Tincture {
  // Weighted pool approach
  const pool: Tincture[] = [];

  const hasTendency = (t: string): boolean =>
    props.tendencies.includes(t);

  // Aggressive / military → Gules (red)
  if (props.militaryStrength > 60 || hasTendency('militaristic')) {
    pool.push(TINCTURES[0]!); // Gules
  }
  // Scholarly → Azure (blue)
  if (hasTendency('scholarly') || hasTendency('mystical')) {
    pool.push(TINCTURES[1]!); // Azure
  }
  // Religious → Purpure (purple)
  if (hasTendency('religious')) {
    pool.push(TINCTURES[6]!); // Purpure
  }
  // Mercantile → Or (gold)
  if (props.economicWealth > 60 || hasTendency('mercantile')) {
    pool.push(TINCTURES[4]!); // Or
  }
  // Nature biomes → Vert (green)
  if (props.biome === 'Forest' || props.biome === 'Jungle' || hasTendency('agrarian')) {
    pool.push(TINCTURES[2]!); // Vert
  }
  // Mountain/underground → Sable (black)
  if (props.biome === 'Mountain' || hasTendency('industrious')) {
    pool.push(TINCTURES[3]!); // Sable
  }
  // Desert → Tenne (orange-brown)
  if (props.biome === 'Desert' || hasTendency('nomadic')) {
    pool.push(TINCTURES[7]!); // Tenne
  }
  // Coastal → Azure (blue)
  if (props.biome === 'Coastal' || hasTendency('seafaring')) {
    pool.push(TINCTURES[1]!); // Azure
  }

  if (pool.length === 0) {
    return pickFromHash(TINCTURES, hash, 0);
  }

  return pickFromHash(pool, hash, 4);
}

function deriveSecondaryTincture(primary: Tincture, hash: number): Tincture {
  // Pick a contrasting tincture (different from primary)
  const candidates = TINCTURES.filter(t => t.name !== primary.name);
  return pickFromHash(candidates, hash, 12);
}

// ---------------------------------------------------------------------------
// Field division derivation
// ---------------------------------------------------------------------------

const DIVISIONS: readonly FieldDivision[] = [
  'none', 'per_pale', 'per_fess', 'quarterly', 'per_bend', 'per_chevron',
];

function deriveDivision(hash: number): FieldDivision {
  return pickFromHash(DIVISIONS, hash, 8);
}

// ---------------------------------------------------------------------------
// Motto generation
// ---------------------------------------------------------------------------

const MOTTO_PREFIXES: readonly string[] = [
  'Strength', 'Honor', 'Glory', 'Wisdom', 'Valor',
  'Faith', 'Iron', 'Fire', 'Blood', 'Thunder',
  'Shadow', 'Light', 'Stone', 'Storm', 'Fortune',
  'Steel', 'Dawn', 'Night', 'Flame', 'Frost',
];

const MOTTO_SUFFIXES: readonly string[] = [
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

// ---------------------------------------------------------------------------
// CoatOfArms generation
// ---------------------------------------------------------------------------

/**
 * Generate a coat of arms from faction properties.
 * Deterministic: same properties + name → same arms.
 */
export function generateCoatOfArms(props: FactionProperties): CoatOfArms {
  const hash = hashString(props.name + props.culture + props.color);

  const shield = getShieldShape(props.culture);
  const division = deriveDivision(hash);
  const primary = derivePrimaryTincture(props, hash);
  const secondary = deriveSecondaryTincture(primary, hash);

  const chargeCategory = pickChargeCategory(props.tendencies, hash);
  const charges = getChargesForCategory(chargeCategory);
  const charge = pickFromHash(charges, hash, 24);

  const motto = generateMotto(hash);

  return {
    shield,
    division,
    primary,
    secondary,
    charge,
    motto,
    history: [{ year: 0, type: 'creation', description: `Arms created for ${props.name}` }],
  };
}

// ---------------------------------------------------------------------------
// Evolution
// ---------------------------------------------------------------------------

/**
 * Evolve a coat of arms in response to a political event.
 * Returns a new CoatOfArms (immutable).
 */
export function evolveCoatOfArms(
  current: CoatOfArms,
  event: HeraldryEvent,
  seed: string,
): CoatOfArms {
  const hash = hashString(seed + event.type + event.year.toString());

  switch (event.type) {
    case 'revolution': {
      // Complete redesign — new division, new charge, swap tinctures
      const newDivision = pickFromHash(DIVISIONS, hash, 0);
      const newCharge = pickFromHash(ALL_CHARGES, hash, 8);
      return {
        ...current,
        division: newDivision,
        charge: newCharge,
        primary: current.secondary,
        secondary: current.primary,
        motto: generateMotto(hash),
        history: [...current.history, event],
      };
    }
    case 'dynasty_change': {
      // Modify existing — add secondary charge, keep core identity
      const addedCharge = pickFromHash(ALL_CHARGES, hash, 8);
      return {
        ...current,
        secondaryCharge: addedCharge,
        motto: generateMotto(hash),
        history: [...current.history, event],
      };
    }
    case 'expansion': {
      // Add quarter for new territory
      return {
        ...current,
        division: 'quarterly',
        secondaryCharge: current.secondaryCharge ?? pickFromHash(NATURE_CHARGES, hash, 8),
        history: [...current.history, event],
      };
    }
    case 'union': {
      // Quarter two factions' arms — division becomes quarterly,
      // secondary charge set
      const unionCharge = pickFromHash(ALL_CHARGES, hash, 12);
      return {
        ...current,
        division: 'quarterly',
        secondaryCharge: unionCharge,
        history: [...current.history, event],
      };
    }
    default:
      return {
        ...current,
        history: [...current.history, event],
      };
  }
}

// ---------------------------------------------------------------------------
// Rendering — large
// ---------------------------------------------------------------------------

/**
 * Build the fill grid for a given field division.
 * Returns a 2D array of fill-char indices (0 = primary, 1 = secondary).
 */
function buildFieldGrid(
  division: FieldDivision,
  rows: number,
  cols: number,
): number[][] {
  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      let field = 0;
      switch (division) {
        case 'none':
          field = 0;
          break;
        case 'per_pale':
          field = c < cols / 2 ? 0 : 1;
          break;
        case 'per_fess':
          field = r < rows / 2 ? 0 : 1;
          break;
        case 'quarterly':
          field = ((r < rows / 2 ? 0 : 1) + (c < cols / 2 ? 0 : 1)) % 2;
          break;
        case 'per_bend':
          field = (r / rows) > (c / cols) ? 1 : 0;
          break;
        case 'per_chevron': {
          const mid = cols / 2;
          const vLine = rows * 0.5;
          const dist = Math.abs(c - mid) / mid;
          field = r > vLine - dist * vLine ? 1 : 0;
          break;
        }
      }
      row.push(field);
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Render a large coat of arms (for faction inspector).
 * Returns array of string lines.
 */
export function renderLargeCoatOfArms(arms: CoatOfArms): string[] {
  const template = getShieldTemplate(arms.shield);
  const fieldRows = getFieldRowCount(arms.shield);
  const fieldCols = getFieldColCount(arms.shield);

  const fieldGrid = buildFieldGrid(arms.division, fieldRows, fieldCols);
  const fills = [arms.primary.fill, arms.secondary.fill];

  const lines: string[] = [];

  let fieldRow = 0;
  for (const templateLine of template) {
    let line = '';
    let fieldCol = 0;
    let i = 0;
    while (i < templateLine.length) {
      const remaining = templateLine.slice(i);
      if (remaining.startsWith('{f1}')) {
        const gridRow = fieldGrid[fieldRow];
        const idx = gridRow !== undefined ? (gridRow[fieldCol] ?? 0) : 0;
        line += fills[idx] ?? fills[0]!;
        fieldCol++;
        i += 4;
      } else if (remaining.startsWith('{f2}')) {
        const gridRow = fieldGrid[fieldRow];
        const idx = gridRow !== undefined ? (gridRow[fieldCol] ?? 1) : 1;
        line += fills[idx] ?? fills[1]!;
        fieldCol++;
        i += 4;
      } else if (remaining.startsWith('{ch}')) {
        line += arms.charge.symbolSmall;
        i += 4;
      } else {
        line += templateLine[i];
        i++;
      }
    }
    if (templateLine.includes('{f1}') || templateLine.includes('{f2}')) {
      fieldRow++;
    }
    lines.push(line);
  }

  // Motto line — allowed to extend beyond shield width
  const shieldWidth = Math.max(...lines.map(l => l.length));
  const totalWidth = Math.max(shieldWidth, arms.motto.length);
  const mottoLine = arms.motto.padStart(
    Math.floor((totalWidth + arms.motto.length) / 2)
  ).padEnd(totalWidth);
  lines.push(mottoLine);

  return lines;
}

function getShieldTemplate(shape: ShieldShape): readonly string[] {
  switch (shape) {
    case 'knightly': return KNIGHTLY_SHIELD;
    case 'round':    return ROUND_SHIELD;
    case 'totem':    return TOTEM_SHIELD;
  }
}

/** Number of rows with field characters in the template. */
function getFieldRowCount(shape: ShieldShape): number {
  switch (shape) {
    case 'knightly': return 3;
    case 'round':    return 3;
    case 'totem':    return 4;
  }
}

/** Number of field columns per row in the template (f1+f2 per row). */
function getFieldColCount(shape: ShieldShape): number {
  switch (shape) {
    case 'knightly': return 8;
    case 'round':    return 8;
    case 'totem':    return 4;
  }
}

// ---------------------------------------------------------------------------
// Rendering — small
// ---------------------------------------------------------------------------

/**
 * Render a small coat of arms (for map markers).
 * Returns array of string lines (5 wide × 3 tall).
 */
export function renderSmallCoatOfArms(arms: CoatOfArms): string[] {
  const template = getSmallTemplate(arms.shield);

  return template.map(templateLine => {
    let line = '';
    let i = 0;
    while (i < templateLine.length) {
      const remaining = templateLine.slice(i);
      if (remaining.startsWith('{ch}')) {
        line += arms.charge.symbolSmall;
        i += 4;
      } else if (remaining.startsWith('{f1}')) {
        line += arms.primary.fill;
        i += 4;
      } else {
        line += templateLine[i];
        i++;
      }
    }
    return line;
  });
}

function getSmallTemplate(shape: ShieldShape): readonly string[] {
  switch (shape) {
    case 'knightly': return SMALL_KNIGHTLY;
    case 'round':    return SMALL_ROUND;
    case 'totem':    return SMALL_TOTEM;
  }
}

// ---------------------------------------------------------------------------
// Rendering — inline
// ---------------------------------------------------------------------------

/**
 * Render an inline representation for use in text/narratives.
 * Format: [charge fill charge] e.g. "⚔#⚔" or "[★·★]".
 */
export function renderInlineCoatOfArms(arms: CoatOfArms): string {
  const ch = arms.charge.symbolSmall;
  const f = arms.primary.fill;
  return `[${ch}${f}${ch}]`;
}

// ---------------------------------------------------------------------------
// Unified render function
// ---------------------------------------------------------------------------

/**
 * Render a coat of arms at the requested display size.
 */
export function renderCoatOfArms(arms: CoatOfArms, size: DisplaySize): string[] {
  switch (size) {
    case 'large':
      return renderLargeCoatOfArms(arms);
    case 'small':
      return renderSmallCoatOfArms(arms);
    case 'inline':
      return [renderInlineCoatOfArms(arms)];
  }
}

// ---------------------------------------------------------------------------
// Description helper
// ---------------------------------------------------------------------------

/**
 * Produce a blazon (heraldic text description) of the coat of arms.
 * E.g. "Per pale Gules and Azure, a Lion Or."
 */
export function describeCoatOfArms(arms: CoatOfArms): string {
  const divisionText = describeDivision(arms.division);
  const chargeText = `a ${arms.charge.name}`;
  const secondaryText = arms.secondaryCharge !== undefined
    ? ` and a ${arms.secondaryCharge.name}`
    : '';

  if (arms.division === 'none') {
    return `${arms.primary.name}, ${chargeText}${secondaryText}. "${arms.motto}"`;
  }
  return `${divisionText} ${arms.primary.name} and ${arms.secondary.name}, ${chargeText}${secondaryText}. "${arms.motto}"`;
}

function describeDivision(div: FieldDivision): string {
  switch (div) {
    case 'none':         return '';
    case 'per_pale':     return 'Per pale';
    case 'per_fess':     return 'Per fess';
    case 'quarterly':    return 'Quarterly';
    case 'per_bend':     return 'Per bend';
    case 'per_chevron':  return 'Per chevron';
  }
}

// ---------------------------------------------------------------------------
// Exports for sub-collections (useful for tests)
// ---------------------------------------------------------------------------

export {
  TINCTURES,
  ALL_CHARGES,
  ANIMAL_CHARGES,
  WEAPON_CHARGES,
  NATURE_CHARGES,
  RELIGIOUS_CHARGES,
};
