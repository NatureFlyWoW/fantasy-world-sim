/**
 * Vignette Generator - produces 200-500 word micro-narrative passages.
 * Vignettes bring key moments to life through character-focused prose.
 */

import type { EntityId, CharacterId, FactionId, SiteId } from '@fws/core';
import type { WorldEvent } from '@fws/core';
import { PersonalityTrait } from '@fws/core';
import type {
  VignetteTriggerResult,
  VignetteMood,
} from './vignette-trigger.js';
import {
  EmotionalContent,
  VignetteArchetype,
} from './vignette-trigger.js';

/**
 * A generated vignette.
 */
export interface Vignette {
  /** Unique identifier */
  readonly id: string;
  /** The event this vignette dramatizes */
  readonly eventId: import('@fws/core').EventId;
  /** The archetype used */
  readonly archetype: VignetteArchetype;
  /** Primary emotional content */
  readonly emotion: EmotionalContent;
  /** The mood/tone of the vignette */
  readonly mood: VignetteMood;
  /** Focal character (POV) */
  readonly focalCharacter: CharacterId | undefined;
  /** The generated prose (200-500 words) */
  readonly prose: string;
  /** Word count */
  readonly wordCount: number;
  /** Characters featured */
  readonly featuredCharacters: readonly CharacterId[];
  /** Location if specified */
  readonly location: SiteId | undefined;
  /** Generation timestamp */
  readonly generatedAt: Date;
}

/**
 * Context for vignette generation.
 */
export interface VignetteGeneratorContext {
  /** The event being dramatized */
  readonly event: WorldEvent;
  /** Trigger evaluation result */
  readonly triggerResult: VignetteTriggerResult;
  /** Entity names */
  readonly entityNames: ReadonlyMap<EntityId, string>;
  /** Faction names */
  readonly factionNames: ReadonlyMap<FactionId, string>;
  /** Site names */
  readonly siteNames: ReadonlyMap<SiteId, string>;
  /** Character trait intensities */
  readonly characterTraits: ReadonlyMap<CharacterId, ReadonlyMap<PersonalityTrait, number>>;
  /** Character titles */
  readonly characterTitles: ReadonlyMap<CharacterId, string>;
  /** Character genders */
  readonly characterGenders: ReadonlyMap<CharacterId, 'male' | 'female' | 'neutral'>;
  /** Function to get character's faction */
  readonly getCharacterFaction?: (id: CharacterId) => FactionId | undefined;
}

/**
 * Sentence templates organized by archetype.
 */
interface ArchetypeTemplates {
  readonly openings: readonly string[];
  readonly bodies: readonly string[];
  readonly closings: readonly string[];
  readonly transitions: readonly string[];
}

/**
 * Templates for each archetype.
 */
const ARCHETYPE_TEMPLATES: Record<VignetteArchetype, ArchetypeTemplates> = {
  [VignetteArchetype.BeforeTheStorm]: {
    openings: [
      'The air hung heavy with anticipation.',
      '{focal} stood at the threshold of destiny.',
      'In the quiet before the storm, {focal} found {pronoun.reflexive} alone with {pronoun.possessive} thoughts.',
      'Dawn broke cold and gray over {location}.',
      'The world held its breath.',
    ],
    bodies: [
      '{focal} could feel it in {pronoun.possessive} bones—something was coming.',
      'Every shadow seemed to hold a promise of what was to come.',
      '{pronoun.subject} looked out over {location}, knowing this view might never look the same again.',
      'The silence was deafening, broken only by the distant sounds of preparation.',
      'Words failed {pronoun.object}. What could be said when everything was about to change?',
    ],
    closings: [
      'And then, the moment arrived.',
      'There would be no going back.',
      '{focal} drew a breath. It was time.',
      'The peace shattered.',
      'What came next would change everything.',
    ],
    transitions: [
      'Time seemed to slow.',
      'The moments stretched into eternity.',
      'Each heartbeat felt like a drum of war.',
    ],
  },

  [VignetteArchetype.TheDiscovery]: {
    openings: [
      "{focal}'s hands trembled as {pronoun.subject} reached out.",
      'It had been hidden for so long, and now...',
      'The light caught something that should not have been there.',
      'At first, {focal} could not believe {pronoun.possessive} eyes.',
      'The discovery came without warning.',
    ],
    bodies: [
      'Everything {focal} thought {pronoun.subject} knew began to unravel.',
      'The implications struck like lightning—if this was true...',
      '{pronoun.subject} turned it over in {pronoun.possessive} hands, scarcely daring to breathe.',
      'Questions flooded {pronoun.possessive} mind, each more pressing than the last.',
      'This changed everything. Every assumption, every certainty.',
    ],
    closings: [
      'The truth, once revealed, could never be hidden again.',
      '{focal} knew {pronoun.possessive} life would never be the same.',
      'And with that knowledge came terrible responsibility.',
      'Some discoveries are better left unmade. This was not one of them.',
      '{focal} finally understood.',
    ],
    transitions: [
      'The pieces fell into place.',
      'And then, understanding dawned.',
      'The fog of confusion began to lift.',
    ],
  },

  [VignetteArchetype.TheConfrontation]: {
    openings: [
      'They stood facing each other at last.',
      '{focal} had waited for this moment.',
      'The tension was thick enough to cut.',
      'Years of enmity crystallized in this single moment.',
      'There was nowhere left to run.',
    ],
    bodies: [
      'Neither would yield. Neither could.',
      'Words flew like weapons, each one finding its mark.',
      '{focal} felt the weight of every grievance, every betrayal.',
      'This was the reckoning they had both known was coming.',
      'The air crackled with unspoken accusations.',
    ],
    closings: [
      'Only one truth would survive this encounter.',
      'The bridge between them burned.',
      'What was broken here could never be mended.',
      '{focal} turned away. There was nothing more to say.',
      'The confrontation left both changed forever.',
    ],
    transitions: [
      'The silence stretched between them.',
      'Then, the dam broke.',
      'Words gave way to action.',
    ],
  },

  [VignetteArchetype.TheFarewell]: {
    openings: [
      'The moment of parting had come.',
      '{focal} knew this might be the last time.',
      'Words stuck in {pronoun.possessive} throat.',
      "How do you say goodbye when goodbye isn't enough?",
      'The weight of farewell pressed down upon them.',
    ],
    bodies: [
      "Every memory they shared seemed to flash before {focal}'s eyes.",
      '{pronoun.subject} wanted to remember every detail—the way they stood, the light on their face.',
      'There was so much left unsaid, and no time left to say it.',
      'The distance between them felt infinite already.',
      '{focal} reached out, as if touch could hold them there.',
    ],
    closings: [
      'And then they were gone.',
      'The silence they left behind was deafening.',
      '{focal} was alone now.',
      'Some goodbyes are forever. This was one of them.',
      '{focal} watched until they were out of sight, and longer still.',
    ],
    transitions: [
      'Time slowed to a crawl.',
      'The moment stretched, precious and fleeting.',
      'Neither wanted to be the first to turn away.',
    ],
  },

  [VignetteArchetype.TheAscension]: {
    openings: [
      'The crown descended.',
      '{focal} rose to face {pronoun.possessive} destiny.',
      'After everything, this moment had finally arrived.',
      'The world seemed to hold its breath.',
      'Power called, and {focal} answered.',
    ],
    bodies: [
      'Every sacrifice, every struggle had led to this.',
      '{focal} could feel the weight of expectation—the weight of history.',
      'Looking out at the faces before {pronoun.object}, {pronoun.subject} saw hope, fear, ambition.',
      'The mantle settled upon {pronoun.possessive} shoulders.',
      'What {focal} had dreamed of was now reality.',
    ],
    closings: [
      '{focal} was changed—elevated beyond what {pronoun.subject} had been.',
      'A new era had begun.',
      'The path ahead was uncertain, but it was {pronoun.possessive} to walk.',
      'From this height, the world looked different.',
      'Power had found its new vessel.',
    ],
    transitions: [
      'The cheers rose like a wave.',
      'The transformation was complete.',
      'Nothing would ever be the same.',
    ],
  },

  [VignetteArchetype.TheFall]: {
    openings: [
      'Everything {focal} had built crumbled.',
      'The end came swiftly and without mercy.',
      '{focal} felt the ground give way beneath {pronoun.object}.',
      'Pride goeth before destruction.',
      'How quickly power turns to ash.',
    ],
    bodies: [
      '{focal} searched for allies and found none.',
      'The faces that had once smiled now turned away.',
      'Every choice {pronoun.subject} had made led here—to this ruin.',
      '{pronoun.subject} wanted to rage, to fight, but there was nothing left to fight for.',
      'The throne that had seemed so solid was nothing but splinters now.',
    ],
    closings: [
      '{focal} walked away from the wreckage of {pronoun.possessive} ambition.',
      'History would not be kind.',
      'The fall was complete.',
      'What remained was less than nothing.',
      '{focal} had lost everything—even {pronoun.reflexive}.',
    ],
    transitions: [
      'The collapse was total.',
      'One by one, the supports gave way.',
      'There was no stopping it now.',
    ],
  },

  [VignetteArchetype.TheSacrifice]: {
    openings: [
      '{focal} knew what had to be done.',
      'There was only one way forward.',
      'The cost was clear, and {focal} was willing to pay it.',
      'Love demands the impossible.',
      'Some things are worth more than life.',
    ],
    bodies: [
      '{focal} thought of all {pronoun.subject} was giving up.',
      "Fear whispered that there might be another way—but there wasn't.",
      '{pronoun.subject} took one last look at everything {pronoun.subject} loved.',
      'The choice was made. {focal} would not waver.',
      'Greater love hath no one than this.',
    ],
    closings: [
      'And so {focal} gave {pronoun.reflexive} over to fate.',
      'The sacrifice was made.',
      'Those {pronoun.subject} saved would never know the true cost.',
      "{focal}'s final act would echo through ages.",
      'In the end, this is how {pronoun.subject} wanted to be remembered.',
    ],
    transitions: [
      'There was peace in the decision.',
      'The fear faded, replaced by resolve.',
      'This was {pronoun.possessive} purpose.',
    ],
  },

  [VignetteArchetype.TheRevelation]: {
    openings: [
      'The truth struck like lightning.',
      '{focal} had been blind, but now...',
      'Everything became clear in a single, terrible moment.',
      'The veil was lifted.',
      'How had {focal} not seen it before?',
    ],
    bodies: [
      'Every lie, every deception—it all made sense now.',
      '{focal} reeled as the implications cascaded through {pronoun.possessive} mind.',
      'The foundation of {pronoun.possessive} world had cracked.',
      '{pronoun.subject} could never unsee what {pronoun.subject} had seen.',
      'The revelation changed the shape of everything.',
    ],
    closings: [
      'Armed with this truth, {focal} would never be the same.',
      'Now {pronoun.subject} understood.',
      'The revelation demanded action.',
      '{focal} stood transformed by knowledge.',
      'What {pronoun.subject} did with this truth would define {pronoun.object}.',
    ],
    transitions: [
      'Understanding crashed over {pronoun.object}.',
      'The revelation deepened.',
      'And with each moment, more became clear.',
    ],
  },

  [VignetteArchetype.TheCrossroads]: {
    openings: [
      '{focal} stood at the crossroads.',
      'Two paths lay before {pronoun.object}.',
      'The choice that would define {pronoun.object} had arrived.',
      'There was no avoiding it anymore.',
      'Both options carried terrible weight.',
    ],
    bodies: [
      '{focal} weighed the costs—which price was {pronoun.subject} willing to pay?',
      'Each path led to a different future, a different {focal}.',
      '{pronoun.subject} thought of all those affected by this choice.',
      'There was no perfect answer, only necessary ones.',
      'The weight of decision pressed down like a physical thing.',
    ],
    closings: [
      '{focal} chose, and the other path closed forever.',
      'The decision was made. Now to live with it.',
      'One road. {pronoun.subject} committed.',
      '{focal} would never know what the other path held.',
      'The crossroads faded behind {pronoun.object}.',
    ],
    transitions: [
      'Time pressed in.',
      'The moment of decision arrived.',
      '{focal} could wait no longer.',
    ],
  },

  [VignetteArchetype.TheReunion]: {
    openings: [
      'After all this time...',
      "{focal}'s heart nearly stopped.",
      'They had thought this day would never come.',
      'The years fell away in an instant.',
      'It was really them.',
    ],
    bodies: [
      "{focal} drank in every change, every trace of time's passage.",
      'So much had happened. So much to say.',
      'The distance between them collapsed.',
      'Words tumbled out, inadequate for the occasion.',
      '{focal} remembered who {pronoun.subject} had been when they last met.',
    ],
    closings: [
      'They were together again. Nothing else mattered.',
      'The reunion was bittersweet—joy tinged with all the lost time.',
      '{focal} would not let go. Not yet.',
      'The circle was closed at last.',
      'Some bonds survive even the longest separation.',
    ],
    transitions: [
      'Recognition dawned.',
      'The past rushed back.',
      'Everything else faded away.',
    ],
  },

  [VignetteArchetype.TheReckoning]: {
    openings: [
      'The past had finally caught up.',
      '{focal} could run no longer.',
      'Every debt comes due.',
      'The reckoning {focal} had dreaded was here.',
      'Judgment stood before {pronoun.object}.',
    ],
    bodies: [
      '{focal} faced the consequences of choices made long ago.',
      'Excuses crumbled. Justifications rang hollow.',
      '{pronoun.subject} had known this moment would come.',
      'The weight of {pronoun.possessive} actions pressed down.',
      'There was no escaping {pronoun.reflexive}.',
    ],
    closings: [
      '{focal} accepted what {pronoun.subject} had become.',
      'The reckoning was complete—for better or worse.',
      'Now {pronoun.subject} would pay the price.',
      '{focal} emerged changed, scarred, but perhaps lighter.',
      'The past was finally laid to rest.',
    ],
    transitions: [
      'The moment of truth arrived.',
      'No more running.',
      'Face to face with {pronoun.possessive} own history.',
    ],
  },

  [VignetteArchetype.TheChange]: {
    openings: [
      '{focal} was becoming something else.',
      'The transformation had begun.',
      'There was no stopping it now.',
      '{focal} could feel {pronoun.reflexive} changing.',
      'The old {focal} was dying.',
    ],
    bodies: [
      'Everything {pronoun.subject} had been was slipping away.',
      '{focal} grieved for who {pronoun.subject} was losing.',
      'The new self emerged, unfamiliar but undeniable.',
      "Power or curse—{pronoun.subject} couldn't tell anymore.",
      '{pronoun.subject} tried to hold on to something, anything, of the before.',
    ],
    closings: [
      'When it was over, {focal} was someone new.',
      'The change was irreversible.',
      '{focal} took {pronoun.possessive} first breath as something other.',
      'The transformation left its mark.',
      '{focal} looked in the mirror and saw a stranger.',
    ],
    transitions: [
      'The metamorphosis continued.',
      'Wave after wave of change.',
      'There was no going back.',
    ],
  },

  [VignetteArchetype.TheAftermath]: {
    openings: [
      'The dust settled.',
      '{focal} surveyed what remained.',
      'Silence followed the chaos.',
      'It was over, but at what cost?',
      'The world was different now.',
    ],
    bodies: [
      '{focal} walked among the consequences.',
      'Every action had led here—to this desolation.',
      '{pronoun.subject} searched for meaning in the wreckage.',
      'The survivors gathered, each carrying their own burden.',
      'Time would heal some wounds. Others would scar.',
    ],
    closings: [
      'Life would go on. It always does.',
      '{focal} turned toward the uncertain future.',
      'The aftermath was just another beginning.',
      'Rebuilding would take time—but it would happen.',
      'From these ashes, something new would grow.',
    ],
    transitions: [
      'The weight of it all settled in.',
      'Processing took time.',
      'Slowly, numbness gave way to feeling.',
    ],
  },

  [VignetteArchetype.TheConfession]: {
    openings: [
      'The words had to be said.',
      '{focal} could keep the secret no longer.',
      'The burden of silence had grown too heavy.',
      'The truth demanded release.',
      '{focal} drew a shaking breath.',
    ],
    bodies: [
      'Once begun, the confession poured out.',
      'Every hidden truth, every buried shame came to light.',
      '{focal} watched the reaction, fearing the worst.',
      'The words felt like both weapon and wound.',
      'There was relief in the telling, and terror.',
    ],
    closings: [
      'It was done. The secret was out.',
      '{focal} waited for judgment.',
      'What happened next would depend on forgiveness.',
      'The confession changed everything between them.',
      'Lighter now, {focal} faced the consequences.',
    ],
    transitions: [
      'The silence stretched.',
      'Each word cost more than the last.',
      'The listener absorbed it all.',
    ],
  },

  [VignetteArchetype.TheOath]: {
    openings: [
      '{focal} knelt.',
      'The words of binding were spoken.',
      'This vow would shape the rest of {pronoun.possessive} life.',
      '{focal} raised {pronoun.possessive} hand.',
      'An oath, once given, cannot be taken back.',
    ],
    bodies: [
      '{focal} felt the weight of the promise settle upon {pronoun.object}.',
      'Every syllable carried the force of destiny.',
      '{pronoun.subject} bound {pronoun.reflexive} willingly, knowing the cost.',
      'The oath resonated in the silence that followed.',
      'This was more than words—it was transformation.',
    ],
    closings: [
      'The oath was made. {focal} was bound.',
      'What had been spoken could never be unspoken.',
      '{focal} rose, different than before.',
      'The vow would hold until death—and perhaps beyond.',
      'A new chapter began with those binding words.',
    ],
    transitions: [
      'The ritual words flowed.',
      'Power gathered around the promise.',
      'The oath took hold.',
    ],
  },
};

/**
 * Mood modifiers affect word choice and sentence structure.
 */
const MOOD_MODIFIERS: Record<VignetteMood, readonly string[]> = {
  foreboding: ['dark', 'ominous', 'heavy', 'looming', 'shadowed', 'grim'],
  hopeful: ['bright', 'warm', 'light', 'promising', 'clear', 'gentle'],
  melancholy: ['fading', 'quiet', 'gray', 'wistful', 'soft', 'dim'],
  tense: ['sharp', 'tight', 'electric', 'coiled', 'strained', 'rigid'],
  triumphant: ['soaring', 'blazing', 'golden', 'radiant', 'magnificent', 'glorious'],
  serene: ['peaceful', 'still', 'calm', 'gentle', 'tranquil', 'soft'],
  horror: ['cold', 'terrible', 'twisted', 'wrong', 'crawling', 'ancient'],
  intimate: ['close', 'warm', 'hushed', 'tender', 'private', 'delicate'],
  epic: ['vast', 'thundering', 'sweeping', 'immense', 'legendary', 'titanic'],
  bittersweet: ['mixed', 'complex', 'tinged', 'layered', 'nuanced', 'poignant'],
};

/**
 * VignetteGenerator produces prose vignettes from trigger results.
 */
export class VignetteGenerator {
  private readonly rng: () => number;
  private nextId = 1;

  constructor(rng?: () => number) {
    this.rng = rng ?? Math.random;
  }

  /**
   * Generate a vignette from a trigger result and context.
   */
  generate(context: VignetteGeneratorContext): Vignette {
    const { event, triggerResult } = context;
    const templates = ARCHETYPE_TEMPLATES[triggerResult.archetype];

    // Build the prose
    const prose = this.buildProse(context, templates);

    return {
      id: `vignette_${this.nextId++}`,
      eventId: event.id,
      archetype: triggerResult.archetype,
      emotion: triggerResult.primaryEmotion,
      mood: triggerResult.suggestedMood,
      focalCharacter: triggerResult.focalCharacter,
      prose,
      wordCount: this.countWords(prose),
      featuredCharacters: [
        ...(triggerResult.focalCharacter !== undefined ? [triggerResult.focalCharacter] : []),
        ...triggerResult.supportingCharacters,
      ],
      location: event.location,
      generatedAt: new Date(),
    };
  }

  /**
   * Build the prose content.
   */
  private buildProse(
    context: VignetteGeneratorContext,
    templates: ArchetypeTemplates
  ): string {
    const paragraphs: string[] = [];
    const { triggerResult } = context;

    // Get focal character info
    const focalName = triggerResult.focalCharacter !== undefined
      ? context.entityNames.get(triggerResult.focalCharacter as EntityId) ?? 'the figure'
      : 'the figure';
    const gender = triggerResult.focalCharacter !== undefined
      ? context.characterGenders.get(triggerResult.focalCharacter) ?? 'neutral'
      : 'neutral';
    const pronouns = this.getPronouns(gender);

    // Get location name
    const locationName = context.event.location !== undefined
      ? context.siteNames.get(context.event.location) ?? 'that place'
      : 'that place';

    // Opening paragraph
    const opening = this.selectTemplate(templates.openings);
    const openingExpanded = this.expandTemplate(opening, focalName, pronouns, locationName);
    paragraphs.push(this.addMoodSentence(openingExpanded, triggerResult.suggestedMood));

    // Body paragraphs (2-3)
    const bodyCount = 2 + Math.floor(this.rng() * 2);
    for (let i = 0; i < bodyCount; i++) {
      const sentences: string[] = [];

      // Main body sentence
      const body = this.selectTemplate(templates.bodies);
      sentences.push(this.expandTemplate(body, focalName, pronouns, locationName));

      // Optional transition
      if (this.rng() < 0.4 && i < bodyCount - 1) {
        const transition = this.selectTemplate(templates.transitions);
        sentences.push(this.expandTemplate(transition, focalName, pronouns, locationName));
      }

      // Add supporting character mention if available
      if (triggerResult.supportingCharacters.length > 0 && this.rng() < 0.5) {
        const supportingChar = triggerResult.supportingCharacters[
          Math.floor(this.rng() * triggerResult.supportingCharacters.length)
        ]!;
        const supportingName = context.entityNames.get(supportingChar as EntityId) ?? 'another';
        sentences.push(this.addSupportingCharacterMention(supportingName, pronouns));
      }

      paragraphs.push(sentences.join(' '));
    }

    // Closing paragraph
    const closing = this.selectTemplate(templates.closings);
    const closingExpanded = this.expandTemplate(closing, focalName, pronouns, locationName);
    paragraphs.push(closingExpanded);

    // Join paragraphs
    let prose = paragraphs.join('\n\n');

    // Ensure minimum word count by expanding if necessary
    while (this.countWords(prose) < 200) {
      const extraBody = this.selectTemplate(templates.bodies);
      const extraExpanded = this.expandTemplate(extraBody, focalName, pronouns, locationName);
      prose = prose.replace('\n\n' + closingExpanded, '\n\n' + extraExpanded + '\n\n' + closingExpanded);
    }

    // Trim if too long
    if (this.countWords(prose) > 500) {
      const words = prose.split(/\s+/);
      prose = words.slice(0, 500).join(' ');
      // Ensure it ends with punctuation
      if (!prose.match(/[.!?]$/)) {
        prose = prose.replace(/[^.!?]*$/, '...');
      }
    }

    return prose;
  }

  /**
   * Select a random template from an array.
   */
  private selectTemplate(templates: readonly string[]): string {
    return templates[Math.floor(this.rng() * templates.length)] ?? templates[0] ?? '';
  }

  /**
   * Expand template placeholders.
   */
  private expandTemplate(
    template: string,
    focalName: string,
    pronouns: PronounSet,
    locationName: string
  ): string {
    return template
      .replace(/{focal}/g, focalName)
      .replace(/{pronoun\.subject}/g, pronouns.subject)
      .replace(/{pronoun\.object}/g, pronouns.object)
      .replace(/{pronoun\.possessive}/g, pronouns.possessive)
      .replace(/{pronoun\.reflexive}/g, pronouns.reflexive)
      .replace(/{location}/g, locationName);
  }

  /**
   * Get pronoun set for a gender.
   */
  private getPronouns(gender: 'male' | 'female' | 'neutral'): PronounSet {
    switch (gender) {
      case 'male':
        return { subject: 'he', object: 'him', possessive: 'his', reflexive: 'himself' };
      case 'female':
        return { subject: 'she', object: 'her', possessive: 'her', reflexive: 'herself' };
      case 'neutral':
        return { subject: 'they', object: 'them', possessive: 'their', reflexive: 'themselves' };
    }
  }

  /**
   * Add a mood-appropriate sentence.
   */
  private addMoodSentence(text: string, mood: VignetteMood): string {
    const modifiers = MOOD_MODIFIERS[mood];
    const modifier = modifiers[Math.floor(this.rng() * modifiers.length)] ?? modifiers[0];

    const moodSentences = [
      `The ${modifier} atmosphere pressed in.`,
      `Everything felt ${modifier}.`,
      `A ${modifier} quality suffused the moment.`,
    ];

    const moodSentence = moodSentences[Math.floor(this.rng() * moodSentences.length)];

    return `${text} ${moodSentence}`;
  }

  /**
   * Add a mention of a supporting character.
   */
  private addSupportingCharacterMention(name: string, focalPronouns: PronounSet): string {
    const mentions = [
      `${name} watched in silence.`,
      `${name} stood nearby, a presence ${focalPronouns.subject} could not ignore.`,
      `The shadow of ${name} fell across the moment.`,
      `${name}'s eyes met ${focalPronouns.possessive}.`,
    ];

    return mentions[Math.floor(this.rng() * mentions.length)] ?? mentions[0]!;
  }

  /**
   * Count words in a string.
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }
}

/**
 * Pronoun set interface.
 */
interface PronounSet {
  readonly subject: string;
  readonly object: string;
  readonly possessive: string;
  readonly reflexive: string;
}
