/**
 * Bias filter - applies chronicler biases to transform narratives.
 * Implements faction spin, omission, attribution shift, tone adjustment, and knowledge limitation.
 */

import type { EntityId, FactionId, SiteId } from '@fws/core';
import type { WorldEvent } from '@fws/core';
import type { WorldTime } from '@fws/core';
import type {
  Chronicler,
  ChroniclerOutput,
  AppliedBias,
} from './chronicler.js';
import {
  BiasType,
  BiasStrength,
  ChroniclerIdeology,
} from './chronicler.js';

/**
 * Context for bias filter operations.
 */
export interface BiasFilterContext {
  /** The event being narrated */
  readonly event: WorldEvent;
  /** Original unbiased narrative */
  readonly baseNarrative: string;
  /** Entity names for substitution */
  readonly entityNames: ReadonlyMap<EntityId, string>;
  /** Faction names for substitution */
  readonly factionNames: ReadonlyMap<FactionId, string>;
  /** Site names for substitution */
  readonly siteNames: ReadonlyMap<SiteId, string>;
  /** Current world time (for knowledge checks) */
  readonly currentTime: WorldTime;
  /** Function to get faction for an entity */
  readonly getEntityFaction?: (entityId: EntityId) => FactionId | undefined;
}

/**
 * Configuration for bias strength multipliers.
 */
const BIAS_STRENGTH_MULTIPLIERS: Record<BiasStrength, number> = {
  [BiasStrength.Subtle]: 0.25,
  [BiasStrength.Moderate]: 0.5,
  [BiasStrength.Strong]: 0.75,
  [BiasStrength.Extreme]: 1.0,
};

/**
 * Vocabulary substitutions for faction spin.
 */
interface SpinVocabulary {
  readonly positive: ReadonlyMap<string, string>;
  readonly negative: ReadonlyMap<string, string>;
}

const SPIN_VOCABULARY: SpinVocabulary = {
  positive: new Map([
    ['attacked', 'defended against'],
    ['invaded', 'liberated'],
    ['conquered', 'unified'],
    ['killed', 'eliminated threats'],
    ['destroyed', 'removed obstacles'],
    ['seized', 'reclaimed'],
    ['rebellion', 'uprising for justice'],
    ['defeat', 'tactical withdrawal'],
    ['retreat', 'strategic repositioning'],
    ['failure', 'learning opportunity'],
    ['tyrant', 'strong leader'],
    ['aggressive', 'assertive'],
    ['ruthless', 'determined'],
    ['conspiracy', 'alliance'],
    ['scheme', 'plan'],
    ['puppet', 'loyal ally'],
  ]),
  negative: new Map([
    ['defended', 'failed to prevent'],
    ['liberated', 'invaded'],
    ['unified', 'conquered'],
    ['victory', 'temporary advantage'],
    ['success', 'luck'],
    ['hero', 'aggressor'],
    ['alliance', 'conspiracy'],
    ['plan', 'scheme'],
    ['strong leader', 'tyrant'],
    ['assertive', 'aggressive'],
    ['determined', 'ruthless'],
    ['loyal ally', 'puppet'],
    ['negotiated', 'capitulated'],
    ['peace', 'surrender'],
    ['treaty', 'forced agreement'],
  ]),
};

/**
 * Ideological vocabulary additions.
 */
const IDEOLOGICAL_PHRASES: Record<ChroniclerIdeology, readonly string[]> = {
  [ChroniclerIdeology.ProEstablishment]: [
    'as ordained by tradition',
    'upholding the rightful order',
    'in accordance with ancient customs',
    'preserving stability',
  ],
  [ChroniclerIdeology.Populist]: [
    'at great cost to the common folk',
    'while the people suffered',
    'as the masses yearned for change',
    'leaving the poor to bear the burden',
  ],
  [ChroniclerIdeology.Religious]: [
    'by divine providence',
    'as the gods willed',
    'through sacred purpose',
    'fulfilling the prophecy',
  ],
  [ChroniclerIdeology.Materialist]: [
    'driven by economic necessity',
    'following the flow of gold',
    'as trade routes demanded',
    'where resources accumulated',
  ],
  [ChroniclerIdeology.GreatMan]: [
    'through the vision of a singular leader',
    'shaped by extraordinary will',
    'as only a great soul could',
    'marking the age of a titan',
  ],
  [ChroniclerIdeology.Cyclical]: [
    'as history repeated itself',
    'following the eternal pattern',
    'echoing ages past',
    'as the wheel turned once more',
  ],
  [ChroniclerIdeology.Progressive]: [
    'marking a step forward',
    'advancing civilization',
    'building toward a better future',
    'as progress demanded',
  ],
  [ChroniclerIdeology.Cynical]: [
    'with predictable self-interest',
    'as human nature dictated',
    'for power, as always',
    'with familiar treachery',
  ],
};

/**
 * Tone adjustment phrases.
 */
const TONE_MODIFIERS = {
  triumphant: ['gloriously', 'magnificently', 'in triumph', 'to great acclaim'],
  tragic: ['tragically', 'sorrowfully', 'in bitter loss', 'with heavy hearts'],
  neutral: ['accordingly', 'subsequently', 'as recorded', 'in due course'],
  dismissive: ['insignificantly', 'barely worth noting', 'of little consequence', 'as a footnote'],
};

/**
 * ChroniclerBiasFilter applies a chronicler's biases to transform narratives.
 */
export class ChroniclerBiasFilter {
  private readonly rng: () => number;

  constructor(rng?: () => number) {
    this.rng = rng ?? Math.random;
  }

  /**
   * Apply all applicable biases to transform a narrative.
   */
  apply(chronicler: Chronicler, context: BiasFilterContext): ChroniclerOutput {
    const appliedBiases: AppliedBias[] = [];
    let narrative = context.baseNarrative;
    let distortionLevel = 0;

    const strengthMultiplier = BIAS_STRENGTH_MULTIPLIERS[chronicler.biasStrength];

    // Check if chronicler should omit this event entirely
    const omissionResult = this.checkOmission(chronicler, context);
    if (omissionResult.shouldOmit) {
      return {
        chroniclerId: chronicler.id,
        eventId: context.event.id,
        narrative: '',
        distortionLevel: 1.0,
        appliedBiases: [{
          type: BiasType.Omission,
          description: omissionResult.reason,
          magnitude: 1.0,
        }],
        isFirsthand: this.isFirsthandKnowledge(chronicler, context),
        confidence: 0,
      };
    }

    // Apply knowledge limitations
    const knowledgeResult = this.applyKnowledgeLimitation(chronicler, context, narrative);
    if (knowledgeResult.modified) {
      narrative = knowledgeResult.narrative;
      distortionLevel += knowledgeResult.distortion * strengthMultiplier;
      appliedBiases.push({
        type: BiasType.KnowledgeLimitation,
        description: knowledgeResult.description,
        magnitude: knowledgeResult.distortion,
      });
    }

    // Apply faction spin
    const spinResult = this.applyFactionSpin(chronicler, context, narrative);
    if (spinResult.modified) {
      narrative = spinResult.narrative;
      distortionLevel += spinResult.distortion * strengthMultiplier;
      appliedBiases.push({
        type: BiasType.FactionSpin,
        description: spinResult.description,
        magnitude: spinResult.distortion,
      });
    }

    // Apply attribution shift
    const attributionResult = this.applyAttributionShift(chronicler, context, narrative);
    if (attributionResult.modified) {
      narrative = attributionResult.narrative;
      distortionLevel += attributionResult.distortion * strengthMultiplier;
      appliedBiases.push({
        type: BiasType.AttributionShift,
        description: attributionResult.description,
        magnitude: attributionResult.distortion,
      });
    }

    // Apply tone adjustment
    const toneResult = this.applyToneAdjustment(chronicler, context, narrative);
    if (toneResult.modified) {
      narrative = toneResult.narrative;
      distortionLevel += toneResult.distortion * strengthMultiplier;
      appliedBiases.push({
        type: BiasType.ToneAdjustment,
        description: toneResult.description,
        magnitude: toneResult.distortion,
      });
    }

    // Apply ideological framing
    const ideologyResult = this.applyIdeologicalFraming(chronicler, context, narrative);
    if (ideologyResult.modified) {
      narrative = ideologyResult.narrative;
      distortionLevel += ideologyResult.distortion * strengthMultiplier;
      appliedBiases.push({
        type: BiasType.IdeologicalFraming,
        description: ideologyResult.description,
        magnitude: ideologyResult.distortion,
      });
    }

    // Apply significance shift
    const significanceResult = this.applySignificanceShift(chronicler, context, narrative);
    if (significanceResult.modified) {
      narrative = significanceResult.narrative;
      distortionLevel += significanceResult.distortion * strengthMultiplier;
      appliedBiases.push({
        type: BiasType.SignificanceShift,
        description: significanceResult.description,
        magnitude: significanceResult.distortion,
      });
    }

    // Cap distortion at 1.0
    distortionLevel = Math.min(1.0, distortionLevel);

    const isFirsthand = this.isFirsthandKnowledge(chronicler, context);
    const confidence = this.calculateConfidence(chronicler, context);

    return {
      chroniclerId: chronicler.id,
      eventId: context.event.id,
      narrative,
      distortionLevel,
      appliedBiases,
      isFirsthand,
      confidence,
    };
  }

  /**
   * Check if the chronicler would omit this event.
   */
  private checkOmission(
    chronicler: Chronicler,
    context: BiasFilterContext
  ): { shouldOmit: boolean; reason: string } {
    // Check explicit avoidances
    for (const avoidance of chronicler.avoidances) {
      if (avoidance.type === 'category' && avoidance.target === context.event.category) {
        if (this.rng() < avoidance.omissionProbability) {
          return {
            shouldOmit: true,
            reason: `Chronicler avoids ${context.event.category} events`,
          };
        }
      }
      if (avoidance.type === 'faction') {
        const factionId = avoidance.target as unknown as FactionId;
        const eventMentionsFaction = this.eventInvolvesFaction(context, factionId);
        if (eventMentionsFaction && this.rng() < avoidance.omissionProbability) {
          return {
            shouldOmit: true,
            reason: `Chronicler omits events involving avoided faction`,
          };
        }
      }
    }

    // Check if event is outside knowledge range
    if (context.event.location !== undefined) {
      if (!chronicler.knowledge.knownSites.has(context.event.location)) {
        // Unknown location - higher chance of omission
        if (this.rng() < 0.3 * BIAS_STRENGTH_MULTIPLIERS[chronicler.biasStrength]) {
          return {
            shouldOmit: true,
            reason: 'Event occurred in unknown territory',
          };
        }
      }
    }

    return { shouldOmit: false, reason: '' };
  }

  /**
   * Apply knowledge limitations - add uncertainty for events outside chronicler's knowledge.
   */
  private applyKnowledgeLimitation(
    chronicler: Chronicler,
    context: BiasFilterContext,
    narrative: string
  ): BiasResult {
    const isFirsthand = this.isFirsthandKnowledge(chronicler, context);

    if (isFirsthand) {
      return { modified: false, narrative, distortion: 0, description: '' };
    }

    // Add hedging language for secondhand accounts
    const hedges = [
      'It is said that',
      'According to reports,',
      'Tales tell that',
      'As the stories relate,',
      'By accounts passed down,',
    ];

    const hedge = hedges[Math.floor(this.rng() * hedges.length)] ?? hedges[0]!;
    const modifiedNarrative = `${hedge} ${narrative.charAt(0).toLowerCase()}${narrative.slice(1)}`;

    return {
      modified: true,
      narrative: modifiedNarrative,
      distortion: 0.1,
      description: 'Added uncertainty markers for secondhand account',
    };
  }

  /**
   * Apply faction spin - adjust language to favor or disfavor factions.
   */
  private applyFactionSpin(
    chronicler: Chronicler,
    context: BiasFilterContext,
    narrative: string
  ): BiasResult {
    let modified = false;
    let modifiedNarrative = narrative;
    let totalDistortion = 0;
    const descriptions: string[] = [];

    for (const relation of chronicler.factionRelations) {
      const factionName = context.factionNames.get(relation.factionId);
      if (factionName === undefined) continue;
      if (!narrative.includes(factionName)) continue;

      // Determine spin direction based on disposition
      const isPositive = relation.disposition > 20;
      const isNegative = relation.disposition < -20;

      if (!isPositive && !isNegative) continue;

      const vocabulary = isPositive ? SPIN_VOCABULARY.positive : SPIN_VOCABULARY.negative;
      const spinIntensity = Math.abs(relation.disposition) / 100;

      // Apply vocabulary substitutions
      for (const [original, replacement] of vocabulary) {
        if (modifiedNarrative.toLowerCase().includes(original)) {
          const regex = new RegExp(`\\b${original}\\b`, 'gi');
          modifiedNarrative = modifiedNarrative.replace(regex, replacement);
          modified = true;
          totalDistortion += 0.1 * spinIntensity;
        }
      }

      if (modified) {
        const direction = isPositive ? 'positive' : 'negative';
        descriptions.push(`Applied ${direction} spin for ${factionName}`);
      }
    }

    return {
      modified,
      narrative: modifiedNarrative,
      distortion: Math.min(0.5, totalDistortion),
      description: descriptions.join('; '),
    };
  }

  /**
   * Apply attribution shift - credit/blame different actors.
   */
  private applyAttributionShift(
    chronicler: Chronicler,
    context: BiasFilterContext,
    narrative: string
  ): BiasResult {
    // Find participants the chronicler would want to credit or blame
    const preferredActors: EntityId[] = [];
    const dislikedActors: EntityId[] = [];

    for (const participant of context.event.participants) {
      const factionId = context.getEntityFaction?.(participant);
      if (factionId === undefined) continue;

      const relation = chronicler.factionRelations.find(r => r.factionId === factionId);
      if (relation !== undefined) {
        if (relation.disposition > 30) {
          preferredActors.push(participant);
        } else if (relation.disposition < -30) {
          dislikedActors.push(participant);
        }
      }
    }

    // If chronicler follows Great Man ideology, emphasize individual actors
    if (chronicler.ideology === ChroniclerIdeology.GreatMan && preferredActors.length > 0) {
      const heroId = preferredActors[0]!;
      const heroName = context.entityNames.get(heroId);
      if (heroName !== undefined && !narrative.includes(heroName)) {
        const insertion = `, through the decisive action of ${heroName},`;
        const insertPoint = Math.floor(narrative.length / 2);
        const modifiedNarrative =
          narrative.slice(0, insertPoint) + insertion + narrative.slice(insertPoint);

        return {
          modified: true,
          narrative: modifiedNarrative,
          distortion: 0.2,
          description: `Emphasized role of favored individual ${heroName}`,
        };
      }
    }

    return { modified: false, narrative, distortion: 0, description: '' };
  }

  /**
   * Apply tone adjustment based on chronicler's relationship to involved parties.
   */
  private applyToneAdjustment(
    chronicler: Chronicler,
    context: BiasFilterContext,
    narrative: string
  ): BiasResult {
    // Determine overall tone based on faction relations
    let netDisposition = 0;
    let involvedFactions = 0;

    for (const participant of context.event.participants) {
      const factionId = context.getEntityFaction?.(participant);
      if (factionId === undefined) continue;

      const relation = chronicler.factionRelations.find(r => r.factionId === factionId);
      if (relation !== undefined) {
        netDisposition += relation.disposition;
        involvedFactions++;
      }
    }

    if (involvedFactions === 0) {
      return { modified: false, narrative, distortion: 0, description: '' };
    }

    const avgDisposition = netDisposition / involvedFactions;
    let toneKey: keyof typeof TONE_MODIFIERS;
    let toneDescription: string;

    if (avgDisposition > 40) {
      toneKey = 'triumphant';
      toneDescription = 'triumphant';
    } else if (avgDisposition < -40) {
      toneKey = 'tragic';
      toneDescription = 'tragic';
    } else if (avgDisposition < -10) {
      toneKey = 'dismissive';
      toneDescription = 'dismissive';
    } else {
      return { modified: false, narrative, distortion: 0, description: '' };
    }

    const modifiers = TONE_MODIFIERS[toneKey];
    const modifier = modifiers[Math.floor(this.rng() * modifiers.length)] ?? modifiers[0]!;

    // Insert tone modifier near the end
    const sentences = narrative.split('. ');
    if (sentences.length > 0) {
      const lastSentence = sentences[sentences.length - 1] ?? '';
      sentences[sentences.length - 1] = `${lastSentence}, ${modifier}`;
    }
    const modifiedNarrative = sentences.join('. ');

    return {
      modified: true,
      narrative: modifiedNarrative,
      distortion: 0.15,
      description: `Applied ${toneDescription} tone`,
    };
  }

  /**
   * Apply ideological framing based on chronicler's worldview.
   */
  private applyIdeologicalFraming(
    chronicler: Chronicler,
    context: BiasFilterContext,
    narrative: string
  ): BiasResult {
    // Only apply to significant events
    if (context.event.significance < 50) {
      return { modified: false, narrative, distortion: 0, description: '' };
    }

    // Check probability based on bias strength
    const applyChance = BIAS_STRENGTH_MULTIPLIERS[chronicler.biasStrength];
    if (this.rng() > applyChance) {
      return { modified: false, narrative, distortion: 0, description: '' };
    }

    const phrases = IDEOLOGICAL_PHRASES[chronicler.ideology];
    const phrase = phrases[Math.floor(this.rng() * phrases.length)] ?? phrases[0]!;

    // Insert ideological phrase
    const insertPoint = narrative.indexOf('. ');
    if (insertPoint === -1) {
      const modifiedNarrative = `${narrative}, ${phrase}.`;
      return {
        modified: true,
        narrative: modifiedNarrative,
        distortion: 0.2,
        description: `Added ${chronicler.ideology} ideological framing`,
      };
    }

    const modifiedNarrative =
      narrative.slice(0, insertPoint) + `, ${phrase}` + narrative.slice(insertPoint);

    return {
      modified: true,
      narrative: modifiedNarrative,
      distortion: 0.2,
      description: `Added ${chronicler.ideology} ideological framing`,
    };
  }

  /**
   * Apply significance shift based on chronicler's interests.
   */
  private applySignificanceShift(
    chronicler: Chronicler,
    context: BiasFilterContext,
    narrative: string
  ): BiasResult {
    // Check interests
    for (const interest of chronicler.interests) {
      if (interest.type === 'category' && interest.target === context.event.category) {
        if (interest.multiplier > 1.5) {
          const emphasis = [
            'This momentous event',
            'Of great significance,',
            'In what would prove to be a pivotal moment,',
          ];
          const emphasisPhrase = emphasis[Math.floor(this.rng() * emphasis.length)] ?? emphasis[0]!;
          const modifiedNarrative = `${emphasisPhrase} ${narrative.charAt(0).toLowerCase()}${narrative.slice(1)}`;

          return {
            modified: true,
            narrative: modifiedNarrative,
            distortion: 0.1,
            description: `Emphasized event in category of interest (${context.event.category})`,
          };
        }
      }
    }

    // Check avoidances for minimization (not full omission)
    for (const avoidance of chronicler.avoidances) {
      if (avoidance.minimizationFactor > 0.5 && this.rng() < avoidance.minimizationFactor) {
        if (avoidance.type === 'category' && avoidance.target === context.event.category) {
          const minimizers = [
            'In a minor incident,',
            'Of little note,',
            'In passing,',
          ];
          const minimizer = minimizers[Math.floor(this.rng() * minimizers.length)] ?? minimizers[0]!;
          const modifiedNarrative = `${minimizer} ${narrative.charAt(0).toLowerCase()}${narrative.slice(1)}`;

          return {
            modified: true,
            narrative: modifiedNarrative,
            distortion: 0.15,
            description: `Minimized event in avoided category (${context.event.category})`,
          };
        }
      }
    }

    return { modified: false, narrative, distortion: 0, description: '' };
  }

  /**
   * Check if the chronicler has firsthand knowledge of this event.
   */
  private isFirsthandKnowledge(chronicler: Chronicler, context: BiasFilterContext): boolean {
    // Check temporal coverage
    const eventTime = context.currentTime;
    const firsthand = chronicler.knowledge.firsthandPeriod;

    if (compareWorldTime(eventTime, firsthand.start) < 0 ||
        compareWorldTime(eventTime, firsthand.end) > 0) {
      return false;
    }

    // Check spatial coverage
    if (context.event.location !== undefined) {
      if (!chronicler.knowledge.knownSites.has(context.event.location)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate confidence level based on knowledge limitations.
   */
  private calculateConfidence(chronicler: Chronicler, context: BiasFilterContext): number {
    let confidence = 1.0;

    // Reduce confidence for secondhand accounts
    if (!this.isFirsthandKnowledge(chronicler, context)) {
      confidence *= 0.6;
    }

    // Reduce confidence for unknown locations
    if (context.event.location !== undefined) {
      if (!chronicler.knowledge.knownSites.has(context.event.location)) {
        confidence *= 0.7;
      }
    }

    // Reduce confidence for unknown participants
    const knownParticipants = context.event.participants.filter(p =>
      chronicler.knowledge.knownCharacters.has(p as unknown as import('@fws/core').CharacterId)
    );
    const knownRatio = knownParticipants.length / Math.max(1, context.event.participants.length);
    confidence *= 0.5 + 0.5 * knownRatio;

    return Math.max(0.1, confidence);
  }

  /**
   * Check if an event involves a specific faction.
   */
  private eventInvolvesFaction(context: BiasFilterContext, factionId: FactionId): boolean {
    // Check if any participant belongs to this faction
    for (const participant of context.event.participants) {
      const participantFaction = context.getEntityFaction?.(participant);
      if (participantFaction === factionId) {
        return true;
      }
    }

    // Check faction names in the narrative
    const factionName = context.factionNames.get(factionId);
    if (factionName !== undefined && context.baseNarrative.includes(factionName)) {
      return true;
    }

    return false;
  }
}

/**
 * Result of a bias transformation.
 */
interface BiasResult {
  readonly modified: boolean;
  readonly narrative: string;
  readonly distortion: number;
  readonly description: string;
}

/**
 * Compare two WorldTime values.
 */
function compareWorldTime(a: WorldTime, b: WorldTime): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}
