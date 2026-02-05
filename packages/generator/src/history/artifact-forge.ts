/**
 * Artifact generation during significant historical events.
 * Probability scales with magic prevalence.
 */

import type { SeededRNG } from '../rng.js';
import type { MagicPrevalence } from '../config/types.js';
import type { NameGenerator } from '../character/name-generator.js';

/**
 * Type of legendary artifact.
 */
export type ArtifactType =
  | 'weapon'
  | 'armor'
  | 'ring'
  | 'staff'
  | 'tome'
  | 'crown'
  | 'amulet';

const ALL_ARTIFACT_TYPES: readonly ArtifactType[] = [
  'weapon', 'armor', 'ring', 'staff', 'tome', 'crown', 'amulet',
];

/**
 * Context-weighted artifact type probabilities.
 */
const WAR_WEIGHTS: readonly number[] = [40, 25, 5, 5, 5, 15, 5];
const MAGIC_WEIGHTS: readonly number[] = [10, 5, 15, 25, 20, 5, 20];
const RULER_WEIGHTS: readonly number[] = [15, 10, 15, 10, 5, 30, 15];

/**
 * A legendary artifact forged during pre-history.
 */
export interface LegendaryArtifact {
  /** Artifact name */
  readonly name: string;
  /** Artifact type */
  readonly type: ArtifactType;
  /** Power level (1-10) */
  readonly powerLevel: number;
  /** Name of the creator (if known) */
  readonly creatorName: string | undefined;
  /** Year forged */
  readonly forgeYear: number;
  /** Civilization of origin */
  readonly originCiv: string;
  /** Brief description */
  readonly description: string;
}

/**
 * MagicPrevalence → artifact chance multiplier.
 */
const PREVALENCE_MULTIPLIER: Record<MagicPrevalence, number> = {
  mundane: 0,
  low: 0.3,
  moderate: 0.7,
  high: 1.0,
  ubiquitous: 1.5,
};

/**
 * Description templates per artifact type.
 */
const DESCRIPTIONS: Record<ArtifactType, readonly string[]> = {
  weapon: [
    'A blade that burns with inner fire, forged during the great war',
    'A legendary weapon said to cut through any defense',
    'An ancient weapon imbued with the power of fallen heroes',
    'A terrible weapon that thirsts for blood and grows stronger with each foe slain',
  ],
  armor: [
    'A suit of armor woven from enchanted mithril that turns aside all blows',
    'A shield that has never been broken, blessed by divine power',
    'Armor that renders its wearer invisible in shadow',
    'A breastplate forged in dragonfire, impervious to flame',
  ],
  ring: [
    'A ring of power that grants dominion over others',
    'A band of twisted gold that whispers secrets to its wearer',
    'A ring that grants its bearer passage between worlds',
    'A cursed ring that grants immense power at a terrible cost',
  ],
  staff: [
    'A staff carved from a lightning-struck tree, channeling storms',
    'An ancient staff that amplifies magical power tenfold',
    'A crystalline staff that can open portals across vast distances',
    'A staff of command that compels obedience from those who hear it strike the ground',
  ],
  tome: [
    'A book of forbidden knowledge that drives readers to madness and power',
    'An ancient codex containing the true names of elemental forces',
    'A living tome that writes its own pages with prophecies',
    'A grimoire bound in dragon hide, containing lost magic',
  ],
  crown: [
    'A crown that grants its wearer wisdom beyond mortal ken',
    'A diadem of starlight that inspires absolute loyalty',
    'A black iron crown that grants power over death itself',
    'A crown forged from the horn of a great beast, granting ferocity in battle',
  ],
  amulet: [
    'An amulet that protects against all magical harm',
    'A pendant that grants the ability to see through deception',
    'An ancient talisman that heals all wounds when clasped',
    'A gem-encrusted amulet that stores the soul of a powerful mage',
  ],
};

export class ArtifactForge {
  private readonly artifacts: LegendaryArtifact[] = [];
  private readonly nameGen: NameGenerator;
  private readonly magicMult: number;

  constructor(nameGen: NameGenerator, prevalence: MagicPrevalence) {
    this.nameGen = nameGen;
    this.magicMult = PREVALENCE_MULTIPLIER[prevalence];
  }

  /**
   * Attempt to forge an artifact during a significant event.
   * Returns the artifact if one was created, undefined otherwise.
   */
  maybeForge(
    context: ForgeContext,
    rng: SeededRNG
  ): LegendaryArtifact | undefined {
    if (this.magicMult === 0) return undefined;

    const chance = this.baseChance(context.trigger) * this.magicMult;
    if (rng.next() > chance) return undefined;

    const weights = this.typeWeights(context.trigger);
    const type = rng.weightedPick([...ALL_ARTIFACT_TYPES], [...weights]);

    const name = this.nameGen.generateArtifactName(context.namingConvention, rng);
    const powerLevel = Math.min(10, Math.max(1,
      Math.round(rng.nextGaussian(6, 2))
    ));

    const descPool = DESCRIPTIONS[type];
    const description = rng.pick(descPool);

    const artifact: LegendaryArtifact = {
      name,
      type,
      powerLevel,
      creatorName: context.creatorName,
      forgeYear: context.year,
      originCiv: context.civName,
      description,
    };

    this.artifacts.push(artifact);
    return artifact;
  }

  /**
   * Get all forged artifacts.
   */
  getAll(): readonly LegendaryArtifact[] {
    return this.artifacts;
  }

  private baseChance(trigger: ForgeContext['trigger']): number {
    switch (trigger) {
      case 'war_victory': return 0.3;
      case 'great_civ_peak': return 0.4;
      case 'magical_discovery': return 0.6;
      case 'legendary_hero': return 0.35;
      case 'religious_miracle': return 0.2;
    }
  }

  private typeWeights(trigger: ForgeContext['trigger']): readonly number[] {
    switch (trigger) {
      case 'war_victory': return WAR_WEIGHTS;
      case 'legendary_hero': return WAR_WEIGHTS;
      case 'magical_discovery': return MAGIC_WEIGHTS;
      case 'great_civ_peak': return RULER_WEIGHTS;
      case 'religious_miracle': return MAGIC_WEIGHTS;
    }
  }
}

/**
 * Context for artifact forging.
 */
export interface ForgeContext {
  readonly trigger: 'war_victory' | 'great_civ_peak' | 'magical_discovery' | 'legendary_hero' | 'religious_miracle';
  readonly year: number;
  readonly civName: string;
  readonly namingConvention: string;
  readonly creatorName: string | undefined;
}
