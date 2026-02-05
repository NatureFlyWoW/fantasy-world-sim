/**
 * Planar structure generation — planes of existence with boundaries.
 * Plane count scaled by MagicPrevalence setting.
 */

import type { SeededRNG } from '../rng.js';
import type { MagicPrevalence } from '../config/types.js';

/**
 * Types of planes of existence.
 */
export enum PlaneType {
  Material = 'Material',
  Shadow = 'Shadow',
  Celestial = 'Celestial',
  Elemental = 'Elemental',
  Demonic = 'Demonic',
  Fey = 'Fey',
  Astral = 'Astral',
}

/**
 * Optional planes (Material is always present).
 */
const OPTIONAL_PLANES: readonly PlaneType[] = [
  PlaneType.Shadow,
  PlaneType.Celestial,
  PlaneType.Elemental,
  PlaneType.Demonic,
  PlaneType.Fey,
  PlaneType.Astral,
];

/**
 * A single plane of existence.
 */
export interface Plane {
  /** Plane type */
  readonly type: PlaneType;
  /** Name of this plane */
  readonly name: string;
  /** Boundary permeability — how easily mortals can cross (0 = sealed, 1 = open) */
  readonly permeability: number;
  /** How hostile this plane is to material beings (0 = safe, 10 = lethal) */
  readonly hostility: number;
  /** Whether magical energy flows from this plane into the material world */
  readonly emanatesMagic: boolean;
  /** Brief description */
  readonly description: string;
}

/**
 * Connections between two planes.
 */
export interface PlanarConnection {
  /** Source plane type */
  readonly from: PlaneType;
  /** Destination plane type */
  readonly to: PlaneType;
  /** Stability of the connection (0 = unstable rifts, 1 = permanent portal) */
  readonly stability: number;
}

/**
 * Complete planar structure of the world.
 */
export interface PlanarStructure {
  /** All planes (always includes Material) */
  readonly planes: readonly Plane[];
  /** Connections between planes */
  readonly connections: readonly PlanarConnection[];
  /** Magic prevalence used to generate */
  readonly prevalence: MagicPrevalence;
}

/**
 * MagicPrevalence → optional plane count range.
 */
const PREVALENCE_PLANE_COUNT: Record<MagicPrevalence, { min: number; max: number }> = {
  mundane: { min: 0, max: 0 },
  low: { min: 1, max: 2 },
  moderate: { min: 2, max: 4 },
  high: { min: 3, max: 5 },
  ubiquitous: { min: 6, max: 6 },
};

/**
 * Default properties for each plane type.
 */
const PLANE_DEFAULTS: Record<PlaneType, {
  name: string;
  hostility: number;
  emanatesMagic: boolean;
  description: string;
}> = {
  [PlaneType.Material]: {
    name: 'The Material Plane',
    hostility: 0,
    emanatesMagic: false,
    description: 'The primary plane of mortal existence',
  },
  [PlaneType.Shadow]: {
    name: 'The Shadowfell',
    hostility: 5,
    emanatesMagic: true,
    description: 'A dark mirror of the material world, filled with shadow and decay',
  },
  [PlaneType.Celestial]: {
    name: 'The Celestial Realm',
    hostility: 2,
    emanatesMagic: true,
    description: 'The radiant domain of divine beings and departed souls',
  },
  [PlaneType.Elemental]: {
    name: 'The Elemental Chaos',
    hostility: 7,
    emanatesMagic: true,
    description: 'A roiling expanse of raw elemental forces in constant flux',
  },
  [PlaneType.Demonic]: {
    name: 'The Abyss',
    hostility: 9,
    emanatesMagic: true,
    description: 'An infinite pit of malevolence and corruption',
  },
  [PlaneType.Fey]: {
    name: 'The Feywild',
    hostility: 3,
    emanatesMagic: true,
    description: 'A vibrant, enchanted echo of the natural world, ruled by archfey',
  },
  [PlaneType.Astral]: {
    name: 'The Astral Sea',
    hostility: 4,
    emanatesMagic: true,
    description: 'The silvery void between planes, where thought becomes reality',
  },
};

export class PlanarGenerator {
  /**
   * Generate the planar structure of the world.
   */
  generate(prevalence: MagicPrevalence, rng: SeededRNG): PlanarStructure {
    const planarRng = rng.fork('planar');

    // Material plane is always present
    const materialPlane = this.createPlane(PlaneType.Material, planarRng);
    const planes: Plane[] = [materialPlane];

    if (prevalence !== 'mundane') {
      const range = PREVALENCE_PLANE_COUNT[prevalence];
      const optionalCount = planarRng.nextInt(range.min, range.max);

      // Shuffle optional planes and pick
      const pool = [...OPTIONAL_PLANES];
      planarRng.shuffle(pool);
      const selected = pool.slice(0, optionalCount);

      for (const planeType of selected) {
        planes.push(this.createPlane(planeType, planarRng));
      }
    }

    const connections = this.generateConnections(planes, planarRng);

    return {
      planes,
      connections,
      prevalence,
    };
  }

  /**
   * Create a single plane with randomized properties.
   */
  private createPlane(type: PlaneType, rng: SeededRNG): Plane {
    const defaults = PLANE_DEFAULTS[type];

    // Randomize permeability
    let permeability: number;
    if (type === PlaneType.Material) {
      permeability = 1; // Material plane is always accessible
    } else {
      permeability = rng.nextFloat(0.05, 0.6);
    }

    // Randomize hostility around the default
    const hostility = Math.min(10, Math.max(0,
      defaults.hostility + rng.nextFloat(-1.5, 1.5)
    ));

    return {
      type,
      name: defaults.name,
      permeability: Math.round(permeability * 100) / 100,
      hostility: Math.round(hostility * 10) / 10,
      emanatesMagic: defaults.emanatesMagic,
      description: defaults.description,
    };
  }

  /**
   * Generate connections between planes.
   * Material plane connects to all others; some optional planes connect to each other.
   */
  private generateConnections(
    planes: readonly Plane[],
    rng: SeededRNG
  ): PlanarConnection[] {
    const connections: PlanarConnection[] = [];
    const nonMaterial = planes.filter(p => p.type !== PlaneType.Material);

    // Material ↔ every other plane
    for (const plane of nonMaterial) {
      const stability = rng.nextFloat(0.1, 0.8);
      connections.push({
        from: PlaneType.Material,
        to: plane.type,
        stability: Math.round(stability * 100) / 100,
      });
    }

    // Random inter-plane connections
    if (nonMaterial.length >= 2) {
      const extraCount = rng.nextInt(1, Math.max(1, Math.floor(nonMaterial.length / 2)));
      const existing = new Set(connections.map(c => `${c.from}-${c.to}`));

      for (let i = 0; i < extraCount; i++) {
        const a = rng.pick(nonMaterial);
        const b = rng.pick(nonMaterial);
        if (a.type === b.type) continue;

        const key = `${a.type}-${b.type}`;
        const keyRev = `${b.type}-${a.type}`;
        if (existing.has(key) || existing.has(keyRev)) continue;

        existing.add(key);
        connections.push({
          from: a.type,
          to: b.type,
          stability: rng.nextFloat(0.05, 0.5),
        });
      }
    }

    return connections;
  }
}
