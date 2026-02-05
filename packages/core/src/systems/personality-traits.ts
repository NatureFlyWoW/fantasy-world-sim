/**
 * Personality trait definitions and interaction rules for the Character AI system.
 * 18 traits on a -100 to +100 scale, matching the generator's trait model.
 * Positive values = strong affinity, negative = aversion, 0 = neutral.
 */

// ── Trait enum ──────────────────────────────────────────────────────────────

export enum PersonalityTrait {
  Ambitious = 'ambitious',
  Loyal = 'loyal',
  Cruel = 'cruel',
  Scholarly = 'scholarly',
  Curious = 'curious',
  Amoral = 'amoral',
  Paranoid = 'paranoid',
  Patient = 'patient',
  Impulsive = 'impulsive',
  Brave = 'brave',
  Cautious = 'cautious',
  Empathetic = 'empathetic',
  SelfAbsorbed = 'selfAbsorbed',
  Vengeful = 'vengeful',
  Forgiving = 'forgiving',
  Creative = 'creative',
  Pragmatic = 'pragmatic',
  Idealistic = 'idealistic',
}

export const ALL_TRAITS: readonly PersonalityTrait[] = Object.values(PersonalityTrait);

// ── Trait opposition pairs ──────────────────────────────────────────────────

/**
 * Traits that naturally oppose each other.
 * When one is high, the other is typically suppressed in decision-making.
 */
export const TRAIT_OPPOSITIONS: ReadonlyMap<PersonalityTrait, PersonalityTrait> = new Map([
  [PersonalityTrait.Patient, PersonalityTrait.Impulsive],
  [PersonalityTrait.Impulsive, PersonalityTrait.Patient],
  [PersonalityTrait.Brave, PersonalityTrait.Cautious],
  [PersonalityTrait.Cautious, PersonalityTrait.Brave],
  [PersonalityTrait.Empathetic, PersonalityTrait.SelfAbsorbed],
  [PersonalityTrait.SelfAbsorbed, PersonalityTrait.Empathetic],
  [PersonalityTrait.Vengeful, PersonalityTrait.Forgiving],
  [PersonalityTrait.Forgiving, PersonalityTrait.Vengeful],
  [PersonalityTrait.Pragmatic, PersonalityTrait.Idealistic],
  [PersonalityTrait.Idealistic, PersonalityTrait.Pragmatic],
  [PersonalityTrait.Cruel, PersonalityTrait.Empathetic],
  [PersonalityTrait.Amoral, PersonalityTrait.Idealistic],
]);

// ── Trait synergies ─────────────────────────────────────────────────────────

/**
 * Traits that reinforce each other in decision-making.
 * Both high → amplified effect on action scoring.
 */
export const TRAIT_SYNERGIES: ReadonlyMap<PersonalityTrait, readonly PersonalityTrait[]> = new Map([
  [PersonalityTrait.Ambitious, [PersonalityTrait.Brave, PersonalityTrait.Pragmatic]],
  [PersonalityTrait.Loyal, [PersonalityTrait.Brave, PersonalityTrait.Empathetic]],
  [PersonalityTrait.Cruel, [PersonalityTrait.Amoral, PersonalityTrait.Vengeful]],
  [PersonalityTrait.Scholarly, [PersonalityTrait.Patient, PersonalityTrait.Curious]],
  [PersonalityTrait.Curious, [PersonalityTrait.Brave, PersonalityTrait.Creative]],
  [PersonalityTrait.Paranoid, [PersonalityTrait.Cautious, PersonalityTrait.Vengeful]],
  [PersonalityTrait.Empathetic, [PersonalityTrait.Loyal, PersonalityTrait.Forgiving]],
  [PersonalityTrait.Idealistic, [PersonalityTrait.Brave, PersonalityTrait.Empathetic]],
  [PersonalityTrait.Creative, [PersonalityTrait.Curious, PersonalityTrait.Impulsive]],
]);

// ── Trait → action alignment ────────────────────────────────────────────────

/**
 * How strongly each trait pushes toward or against an action category.
 * Values are -1.0 to +1.0 weights used in personality_alignment scoring.
 */
export interface TraitActionWeight {
  readonly trait: PersonalityTrait;
  readonly weight: number; // -1.0 to +1.0
}

/**
 * Get the effective impulsiveness factor for a character.
 * Used as the random_factor multiplier in the scoring formula.
 * Returns 0.0 (perfectly patient) to 0.3 (maximally impulsive).
 */
export function getImpulsivenessFactor(impulsiveValue: number): number {
  // impulsiveValue is -100 to +100
  // Map to 0.0–0.3 range: -100 → 0.0, 0 → 0.15, +100 → 0.3
  return Math.max(0, Math.min(0.3, (impulsiveValue + 100) / 200 * 0.3));
}

/**
 * Compute personality alignment score (0.0–1.0) for a proposed action.
 * Considers relevant trait weights and synergy bonuses.
 */
export function computePersonalityAlignment(
  traitValues: ReadonlyMap<string, number>,
  relevantWeights: readonly TraitActionWeight[],
): number {
  if (relevantWeights.length === 0) return 0.5;

  let totalAlignment = 0;
  let totalWeight = 0;

  for (const { trait, weight } of relevantWeights) {
    const traitValue = traitValues.get(trait) ?? 0;
    // Normalize trait value from -100..+100 to 0..1
    const normalizedTrait = (traitValue + 100) / 200;
    // If weight is positive, high trait → high alignment
    // If weight is negative, high trait → low alignment
    const alignment = weight > 0
      ? normalizedTrait * weight
      : (1 - normalizedTrait) * Math.abs(weight);
    totalAlignment += alignment;
    totalWeight += Math.abs(weight);
  }

  if (totalWeight === 0) return 0.5;

  // Check for synergy bonuses
  let synergyBonus = 0;
  for (const { trait } of relevantWeights) {
    const synergies = TRAIT_SYNERGIES.get(trait);
    if (synergies === undefined) continue;
    const traitVal = traitValues.get(trait) ?? 0;
    if (traitVal <= 30) continue; // Only apply synergy for strong traits
    for (const synTrait of synergies) {
      const synVal = traitValues.get(synTrait) ?? 0;
      if (synVal > 30) {
        synergyBonus += 0.02; // Small bonus for each active synergy pair
      }
    }
  }

  return Math.max(0, Math.min(1, totalAlignment / totalWeight + synergyBonus));
}
