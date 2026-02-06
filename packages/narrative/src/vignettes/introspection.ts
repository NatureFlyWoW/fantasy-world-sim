/**
 * Character Introspection Mode — first-person internal monologue generation.
 *
 * Triggered when player selects a character and presses 'J' (journal).
 * Generates 100-300 word monologue from personality traits, goals,
 * emotional memories, current context, and known secrets.
 */

import type { CharacterId, EntityId } from '@fws/core';
import { PersonalityTrait } from '@fws/core';
import type { Memory } from '@fws/core';
import type { CharacterGoal } from '@fws/core';

// ── Introspection context ───────────────────────────────────────────────────

/**
 * All information needed to generate an introspection monologue.
 */
export interface IntrospectionContext {
  /** Character doing the introspecting */
  readonly characterId: CharacterId;
  /** Character's display name */
  readonly characterName: string;
  /** Personality trait intensities (-100 to +100) */
  readonly traits: ReadonlyMap<string, number>;
  /** Active goals with progress */
  readonly goals: readonly CharacterGoal[];
  /** Top emotional memories (sorted by abs(emotionalWeight) desc) */
  readonly topMemories: readonly Memory[];
  /** Current location name */
  readonly locationName: string;
  /** Key relationships: entityId → { name, affinity } */
  readonly relationships: ReadonlyMap<EntityId, { readonly name: string; readonly affinity: number }>;
  /** Known secret descriptions (what they know) */
  readonly knownSecrets: readonly string[];
  /** Suspected secret descriptions (what they suspect) */
  readonly suspectedSecrets: readonly string[];
  /** Recent event descriptions (last few ticks) */
  readonly recentEvents: readonly string[];
  /** Character's faction name (if any) */
  readonly factionName?: string;
  /** Character's title (if any) */
  readonly title?: string;
  /** Character's gender for pronouns */
  readonly gender: 'male' | 'female' | 'neutral';
}

// ── Introspection output ────────────────────────────────────────────────────

export interface Introspection {
  /** Character who introspected */
  readonly characterId: CharacterId;
  /** The generated monologue */
  readonly monologue: string;
  /** Word count of the monologue */
  readonly wordCount: number;
  /** Dominant personality voice used */
  readonly voiceType: VoiceType;
  /** Primary concern identified */
  readonly primaryConcern: string;
  /** Generation timestamp */
  readonly generatedAt: Date;
}

// ── Voice types ─────────────────────────────────────────────────────────────

export enum VoiceType {
  AmbtiousPatient = 'ambitious_patient',
  ImpulsivePassionate = 'impulsive_passionate',
  Scholarly = 'scholarly',
  ParanoidKnowledgeable = 'paranoid_knowledgeable',
  Empathetic = 'empathetic',
  BraveIdealistic = 'brave_idealistic',
  CunningPragmatic = 'cunning_pragmatic',
  Default = 'default',
}

// ── Voice detection ─────────────────────────────────────────────────────────

/**
 * Determine the voice type from personality traits.
 * Returns the best-matching voice based on dominant trait combinations.
 */
export function determineVoice(
  traits: ReadonlyMap<string, number>,
): VoiceType {
  const ambitious = traits.get(PersonalityTrait.Ambitious) ?? 0;
  const patient = traits.get(PersonalityTrait.Patient) ?? 0;
  const impulsive = traits.get(PersonalityTrait.Impulsive) ?? 0;
  const scholarly = traits.get(PersonalityTrait.Scholarly) ?? 0;
  const paranoid = traits.get(PersonalityTrait.Paranoid) ?? 0;
  const curious = traits.get(PersonalityTrait.Curious) ?? 0;
  const empathetic = traits.get(PersonalityTrait.Empathetic) ?? 0;
  const brave = traits.get(PersonalityTrait.Brave) ?? 0;
  const idealistic = traits.get(PersonalityTrait.Idealistic) ?? 0;
  const pragmatic = traits.get(PersonalityTrait.Pragmatic) ?? 0;
  const cruel = traits.get(PersonalityTrait.Cruel) ?? 0;

  // Score each voice type
  const scores: Array<[VoiceType, number]> = [
    [VoiceType.AmbtiousPatient, ambitious + patient],
    [VoiceType.ImpulsivePassionate, impulsive + brave + (cruel > 0 ? cruel * 0.3 : 0)],
    [VoiceType.Scholarly, scholarly + curious + patient * 0.5],
    [VoiceType.ParanoidKnowledgeable, paranoid + scholarly * 0.5 + curious * 0.3],
    [VoiceType.Empathetic, empathetic + idealistic * 0.5],
    [VoiceType.BraveIdealistic, brave + idealistic],
    [VoiceType.CunningPragmatic, pragmatic + ambitious * 0.5 + paranoid * 0.3],
  ];

  let bestVoice = VoiceType.Default;
  let bestScore = 30; // Minimum threshold to use a specific voice

  for (const [voice, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestVoice = voice;
    }
  }

  return bestVoice;
}

// ── Monologue templates ─────────────────────────────────────────────────────

interface VoiceTemplates {
  readonly openings: readonly string[];
  readonly goalReflections: readonly string[];
  readonly memoryReflections: readonly string[];
  readonly secretReflections: readonly string[];
  readonly closings: readonly string[];
}

const VOICE_TEMPLATES: Record<VoiceType, VoiceTemplates> = {
  [VoiceType.AmbtiousPatient]: {
    openings: [
      'I have waited long for this moment.',
      'Patience is the sharpest blade, and I have honed mine well.',
      'The time draws near. I can feel it.',
    ],
    goalReflections: [
      'Every step brings me closer to what I desire.',
      'I must not rush. The prize rewards those who wait.',
      'My path is clear, though the journey is long.',
    ],
    memoryReflections: [
      'I remember well, and I carry each lesson forward.',
      'The past has taught me the virtue of steady resolve.',
      'These memories are the stones upon which I build.',
    ],
    secretReflections: [
      'Knowledge is power, and I guard mine carefully.',
      'What I know, others must not learn. Not yet.',
      'The truth is a weapon best wielded at the right moment.',
    ],
    closings: [
      'The wait will be worth it. It always is.',
      'I shall endure, as I always have.',
      'My time will come.',
    ],
  },
  [VoiceType.ImpulsivePassionate]: {
    openings: [
      'The fire in my chest will not be quenched!',
      'I cannot sit idle while the world moves around me.',
      'Every nerve sings with urgency.',
    ],
    goalReflections: [
      'I must act now, before the moment passes!',
      'Caution is the refuge of cowards. I will seize what is mine.',
      'Nothing worth having was ever won by hesitation.',
    ],
    memoryReflections: [
      'The memory burns like a brand upon my soul.',
      'I carry the fire of what was — it drives me forward.',
      'These feelings are too strong to be contained.',
    ],
    secretReflections: [
      'I burn to speak of what I know, but I must hold my tongue.',
      'The truth writhes within me like a caged beast.',
      'Secrets are chains, and I despise chains.',
    ],
    closings: [
      'I will not be still. Not now. Not ever.',
      'Let them try to stop me.',
      'The fire demands release.',
    ],
  },
  [VoiceType.Scholarly]: {
    openings: [
      'The evidence suggests a pattern I had not considered.',
      'Upon reflection, the matter warrants careful analysis.',
      'I must organize my thoughts on this subject.',
    ],
    goalReflections: [
      'My research demands rigorous attention to methodology.',
      'The pursuit of knowledge requires systematic effort.',
      'Each discovery reveals how much remains unknown.',
    ],
    memoryReflections: [
      'The data of experience offers instructive parallels.',
      'Historical precedent suggests a recurring theme here.',
      'Memory, imperfect as it is, provides useful reference.',
    ],
    secretReflections: [
      'The implications of what I have learned are significant.',
      'This knowledge requires careful consideration before sharing.',
      'The evidence is incomplete, but the hypothesis is compelling.',
    ],
    closings: [
      'Further study is required.',
      'The truth, as always, lies in the details.',
      'I shall continue my investigations.',
    ],
  },
  [VoiceType.ParanoidKnowledgeable]: {
    openings: [
      'They think I don\'t know. But I see the threads.',
      'I must be careful. Eyes are everywhere.',
      'Trust no one. That is the first lesson.',
    ],
    goalReflections: [
      'I must proceed carefully, or they will find me out.',
      'Every path forward is riddled with traps.',
      'I see what others miss — and that is both gift and curse.',
    ],
    memoryReflections: [
      'I remember how they looked at me. I know what it meant.',
      'The past holds warnings for those wise enough to listen.',
      'I have not forgotten. I never forget.',
    ],
    secretReflections: [
      'I know more than they realize. Far more.',
      'What I have uncovered would shake them to their foundations.',
      'They are blind to the truth that I have seen.',
    ],
    closings: [
      'I must remain vigilant. Always.',
      'Let them underestimate me. It will be their undoing.',
      'The web grows ever more complex.',
    ],
  },
  [VoiceType.Empathetic]: {
    openings: [
      'The suffering in her eyes haunts me still.',
      'I feel the weight of the world upon my shoulders.',
      'How can anyone remain unmoved by what I have witnessed?',
    ],
    goalReflections: [
      'If I can ease even one burden, it will have been worth it.',
      'I must find a way to help, no matter the cost to myself.',
      'The world needs compassion now more than ever.',
    ],
    memoryReflections: [
      'The pain of others echoes through my dreams.',
      'I carry their sorrows alongside my own.',
      'Some moments mark you forever with their tenderness.',
    ],
    secretReflections: [
      'What I know would cause such pain if revealed.',
      'I must protect them from this truth, if I can.',
      'The burden of knowing weighs heavy on my heart.',
    ],
    closings: [
      'I will find a way. For their sake.',
      'May my actions bring more comfort than harm.',
      'There is still kindness in the world. I must believe that.',
    ],
  },
  [VoiceType.BraveIdealistic]: {
    openings: [
      'The cause demands courage, and I shall not falter.',
      'There is a right thing to do, and I know what it is.',
      'Justice calls, and I answer.',
    ],
    goalReflections: [
      'I will see this through, no matter the danger.',
      'A life without conviction is no life at all.',
      'Honor demands action, not merely words.',
    ],
    memoryReflections: [
      'I have seen what happens when good people do nothing.',
      'The past has forged my resolve like steel in flame.',
      'I draw strength from those who stood before me.',
    ],
    secretReflections: [
      'This truth must be revealed, whatever the consequences.',
      'To hide what I know would be a betrayal of everything I stand for.',
      'The people deserve to know.',
    ],
    closings: [
      'I will not waver. The path is clear.',
      'Let history judge whether I was right.',
      'Onward, then. Always onward.',
    ],
  },
  [VoiceType.CunningPragmatic]: {
    openings: [
      'Let me assess the situation with clear eyes.',
      'Sentiment is a luxury I cannot afford.',
      'Every advantage must be calculated and exploited.',
    ],
    goalReflections: [
      'The optimal path forward requires careful maneuvering.',
      'Efficiency, not emotion, will achieve my aims.',
      'I must weigh the costs against the benefits precisely.',
    ],
    memoryReflections: [
      'Past mistakes inform present strategy.',
      'I have learned which investments yield returns.',
      'Experience has made me a realist, not a cynic.',
    ],
    secretReflections: [
      'This information has value. I must use it wisely.',
      'Knowledge is currency, and I know when to spend it.',
      'I hold my cards close. That is how one wins.',
    ],
    closings: [
      'The next move must be precise.',
      'I do what works. Nothing more, nothing less.',
      'Pragmatism has never failed me yet.',
    ],
  },
  [VoiceType.Default]: {
    openings: [
      'I find myself lost in thought.',
      'So much has happened, and I hardly know where to begin.',
      'My mind wanders to familiar concerns.',
    ],
    goalReflections: [
      'I must focus on what matters most.',
      'My path stretches ahead, uncertain yet full of possibility.',
      'There is much left to accomplish.',
    ],
    memoryReflections: [
      'I think of what has come before.',
      'Memories drift through my mind like fallen leaves.',
      'The past lingers, shaping who I am today.',
    ],
    secretReflections: [
      'There are things I know that I dare not speak aloud.',
      'The weight of knowledge is a quiet burden.',
      'Some truths are better left unspoken.',
    ],
    closings: [
      'What tomorrow brings, only time will tell.',
      'I carry on, as I always have.',
      'Such is the life I have chosen.',
    ],
  },
};

// ── Monologue generation ────────────────────────────────────────────────────

/**
 * Generate a first-person internal monologue for a character.
 * Produces 100-300 words of introspective prose.
 */
export function generateIntrospection(
  context: IntrospectionContext,
  seed?: number,
): Introspection {
  let rngState = seed ?? hashString(context.characterName);

  function nextRandom(): number {
    rngState = ((rngState * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    return rngState / 0x80000000;
  }

  function pick<T>(arr: readonly T[]): T {
    const idx = Math.floor(nextRandom() * arr.length) % arr.length;
    return arr[idx]!;
  }

  const voice = determineVoice(context.traits);
  const templates = VOICE_TEMPLATES[voice];

  const paragraphs: string[] = [];

  // 1. Opening
  paragraphs.push(pick(templates.openings));

  // 2. Location and context
  const locationContext = buildLocationContext(context, nextRandom);
  if (locationContext !== '') {
    paragraphs.push(locationContext);
  }

  // 3. Goal reflections — focus on primary active goal
  const activeGoals = context.goals.filter(g => g.active);
  if (activeGoals.length > 0) {
    const primaryGoal = activeGoals[0]!;
    const goalLine = pick(templates.goalReflections);
    const progressNote = primaryGoal.progress < 0.3
      ? 'I have barely begun.'
      : primaryGoal.progress < 0.7
        ? 'Progress is steady, though much remains.'
        : 'I am close now. So close.';
    paragraphs.push(`${goalLine} ${progressNote}`);

    if (activeGoals.length > 1) {
      paragraphs.push(
        `Yet other matters compete for my attention — ${activeGoals[1]!.description.toLowerCase()}.`,
      );
    }
  }

  // 4. Memory reflections — draw from top emotional memories
  if (context.topMemories.length > 0) {
    const memory = context.topMemories[0]!;
    const memoryLine = pick(templates.memoryReflections);
    const emotionalColor = memory.emotionalWeight > 30
      ? 'The warmth of that moment sustains me.'
      : memory.emotionalWeight < -30
        ? 'The sting of it has not faded.'
        : '';
    paragraphs.push(`${memoryLine} ${emotionalColor}`.trim());
  }

  // 5. Relationship reflections
  const relationshipLine = buildRelationshipReflection(context, pick, nextRandom);
  if (relationshipLine !== '') {
    paragraphs.push(relationshipLine);
  }

  // 6. Secret reflections
  if (context.knownSecrets.length > 0 || context.suspectedSecrets.length > 0) {
    paragraphs.push(pick(templates.secretReflections));
  }

  // 7. Recent events
  if (context.recentEvents.length > 0) {
    const eventRef = context.recentEvents[0]!;
    paragraphs.push(`Recent events weigh on my mind — ${eventRef.toLowerCase()}.`);
  }

  // 8. Closing
  paragraphs.push(pick(templates.closings));

  // Join and trim to 100-300 words
  let monologue = paragraphs.join(' ');
  monologue = trimToWordRange(monologue, 100, 300);

  const wordCount = countWords(monologue);
  const primaryConcern = determinePrimaryConcern(context);

  return {
    characterId: context.characterId,
    monologue,
    wordCount,
    voiceType: voice,
    primaryConcern,
    generatedAt: new Date(),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildLocationContext(
  context: IntrospectionContext,
  _nextRandom: () => number,
): string {
  const parts: string[] = [];

  if (context.locationName !== '') {
    parts.push(`Here in ${context.locationName}`);
  }

  if (context.factionName !== undefined) {
    parts.push(`as a member of ${context.factionName}`);
  }

  if (context.title !== undefined) {
    parts.push(`bearing the title of ${context.title}`);
  }

  if (parts.length === 0) return '';

  return `${parts.join(', ')}, I consider my position.`;
}

function buildRelationshipReflection(
  context: IntrospectionContext,
  pick: <T>(arr: readonly T[]) => T,
  _nextRandom: () => number,
): string {
  if (context.relationships.size === 0) return '';

  // Find strongest positive and negative relationship
  let strongestAlly: { name: string; affinity: number } | undefined;
  let strongestRival: { name: string; affinity: number } | undefined;

  for (const [, rel] of context.relationships) {
    if (strongestAlly === undefined || rel.affinity > strongestAlly.affinity) {
      if (rel.affinity > 20) strongestAlly = rel;
    }
    if (strongestRival === undefined || rel.affinity < strongestRival.affinity) {
      if (rel.affinity < -20) strongestRival = rel;
    }
  }

  const lines: string[] = [];
  if (strongestAlly !== undefined) {
    lines.push(`I think of ${strongestAlly.name} — ${pick(ALLY_REFLECTIONS)}`);
  }
  if (strongestRival !== undefined) {
    lines.push(`And then there is ${strongestRival.name}. ${pick(RIVAL_REFLECTIONS)}`);
  }

  return lines.join(' ');
}

const ALLY_REFLECTIONS: readonly string[] = [
  'a steadfast presence in uncertain times.',
  'their loyalty has been a rare treasure.',
  'I am fortunate to call them an ally.',
  'they give me reason to hope.',
];

const RIVAL_REFLECTIONS: readonly string[] = [
  'Our reckoning is not yet complete.',
  'They stand between me and what I seek.',
  'I will not forget their opposition.',
  'One day, our paths must converge.',
];

function determinePrimaryConcern(context: IntrospectionContext): string {
  const activeGoals = context.goals.filter(g => g.active);
  if (activeGoals.length > 0) {
    return activeGoals[0]!.description;
  }
  if (context.suspectedSecrets.length > 0) {
    return 'Unraveling hidden truths';
  }
  if (context.topMemories.length > 0 && context.topMemories[0]!.emotionalWeight < -30) {
    return 'Processing painful memories';
  }
  return 'Contemplating the future';
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function trimToWordRange(text: string, min: number, max: number): string {
  const words = text.split(/\s+/).filter(w => w.length > 0);

  if (words.length > max) {
    // Trim to max, ending at the nearest sentence boundary
    const trimmed = words.slice(0, max);
    let lastSentenceEnd = max;
    for (let i = max - 1; i >= max - 20 && i >= 0; i--) {
      const w = trimmed[i];
      if (w !== undefined && (w.endsWith('.') || w.endsWith('!') || w.endsWith('?'))) {
        lastSentenceEnd = i + 1;
        break;
      }
    }
    return trimmed.slice(0, lastSentenceEnd).join(' ');
  }

  if (words.length < min) {
    // Pad with additional reflective filler
    const fillers = [
      'The days ahead will test my resolve.',
      'I wonder what fate has in store.',
      'There is much I cannot control, but I can choose how I face it.',
      'Time moves ever forward, indifferent to our struggles.',
      'And yet, life persists in its stubborn way.',
      'The world turns, regardless of my thoughts.',
      'I have seen much, and there is much yet to see.',
      'The silence of this moment is a gift I rarely receive.',
      'Perhaps tomorrow will bring the clarity I seek today.',
      'I must gather my strength for what lies ahead.',
      'In the stillness, I find both comfort and unease.',
      'Every choice I have made has led me to this place.',
      'I am not the person I was a year ago, nor will I be the same a year hence.',
      'The threads of fate are woven in ways I cannot fully comprehend.',
      'Still, I press on, for what else is there to do?',
    ];
    let idx = 0;
    const padded = [...words];
    while (countWordsInArray(padded) < min && idx < fillers.length) {
      padded.push(fillers[idx]!);
      idx++;
    }
    return padded.join(' ');
  }

  return text;
}

function countWordsInArray(arr: readonly string[]): number {
  return arr.reduce((count, s) => count + s.split(/\s+/).filter(w => w.length > 0).length, 0);
}

function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  }
  return hash;
}
