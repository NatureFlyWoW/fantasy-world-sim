/**
 * Goal system types for the Character AI.
 * Goals drive character decision-making in a priority hierarchy:
 *   Survival > Primary Life Goal > Secondary > Opportunistic
 */

// ── Goal priority tiers ─────────────────────────────────────────────────────

export enum GoalPriority {
  /** Avoid death, escape danger, find food/shelter */
  Survival = 4,
  /** Personality-driven primary life goal */
  PrimaryLife = 3,
  /** Contextual: faction duty, project completion, conflict resolution */
  Secondary = 2,
  /** Unexpected situations, curiosity, socializing */
  Opportunistic = 1,
}

// ── Life goal types ─────────────────────────────────────────────────────────

/**
 * Primary life goals — personality-driven long-term motivations.
 * Each character has exactly one at a time, but it can change
 * after significant life events.
 */
export enum LifeGoal {
  GainPower = 'gain_power',
  SeekKnowledge = 'seek_knowledge',
  ProtectFamily = 'protect_family',
  AccumulateWealth = 'accumulate_wealth',
  AchieveGlory = 'achieve_glory',
  PursueArt = 'pursue_art',
  ServeFaith = 'serve_faith',
  FindLove = 'find_love',
}

export const ALL_LIFE_GOALS: readonly LifeGoal[] = Object.values(LifeGoal);

// ── Character goal interface ────────────────────────────────────────────────

export interface CharacterGoal {
  readonly id: number;
  readonly priority: GoalPriority;
  readonly type: GoalType;
  readonly description: string;
  /** 0.0–1.0: how close to completion */
  progress: number;
  /** Whether the goal is still active */
  active: boolean;
}

// ── Goal type discriminated union ───────────────────────────────────────────

export type GoalType =
  | SurvivalGoalType
  | PrimaryLifeGoalType
  | SecondaryGoalType
  | OpportunisticGoalType;

// Survival goals
export interface SurvivalGoalType {
  readonly kind: 'survival';
  readonly subtype: 'flee_danger' | 'find_shelter' | 'find_food' | 'heal_wounds' | 'escape_imprisonment';
}

// Primary life goals
export interface PrimaryLifeGoalType {
  readonly kind: 'primary_life';
  readonly lifeGoal: LifeGoal;
}

// Secondary goals
export interface SecondaryGoalType {
  readonly kind: 'secondary';
  readonly subtype:
    | 'faction_duty'
    | 'organization_advancement'
    | 'project_completion'
    | 'personal_conflict_resolution'
    | 'protect_settlement'
    | 'fulfill_oath'
    | 'avenge_wrong';
  readonly targetId?: number;
}

// Opportunistic goals
export interface OpportunisticGoalType {
  readonly kind: 'opportunistic';
  readonly subtype:
    | 'unexpected_opportunity'
    | 'satisfy_curiosity'
    | 'socialize'
    | 'trade_encounter'
    | 'explore_area';
}

// ── Life goal ← personality mapping ─────────────────────────────────────────

/**
 * Personality trait weights that determine which life goal a character favors.
 * Higher weighted sum → more likely to adopt that goal.
 */
export const LIFE_GOAL_TRAIT_AFFINITY: ReadonlyMap<LifeGoal, ReadonlyMap<string, number>> = new Map([
  [LifeGoal.GainPower, new Map([
    ['ambitious', 1.0], ['brave', 0.5], ['pragmatic', 0.3], ['cruel', 0.2],
  ])],
  [LifeGoal.SeekKnowledge, new Map([
    ['scholarly', 1.0], ['curious', 0.8], ['patient', 0.3], ['creative', 0.2],
  ])],
  [LifeGoal.ProtectFamily, new Map([
    ['loyal', 1.0], ['empathetic', 0.7], ['brave', 0.3], ['cautious', 0.2],
  ])],
  [LifeGoal.AccumulateWealth, new Map([
    ['pragmatic', 0.8], ['ambitious', 0.6], ['patient', 0.3], ['cautious', 0.3],
  ])],
  [LifeGoal.AchieveGlory, new Map([
    ['brave', 1.0], ['ambitious', 0.7], ['impulsive', 0.3], ['idealistic', 0.2],
  ])],
  [LifeGoal.PursueArt, new Map([
    ['creative', 1.0], ['curious', 0.5], ['idealistic', 0.4], ['patient', 0.2],
  ])],
  [LifeGoal.ServeFaith, new Map([
    ['idealistic', 0.8], ['loyal', 0.6], ['patient', 0.3], ['empathetic', 0.3],
  ])],
  [LifeGoal.FindLove, new Map([
    ['empathetic', 0.8], ['brave', 0.3], ['idealistic', 0.4], ['loyal', 0.5],
  ])],
]);

/**
 * Compute the best-fitting life goal for a character based on personality traits.
 */
export function computeBestLifeGoal(
  traitValues: ReadonlyMap<string, number>,
): LifeGoal {
  let bestGoal = LifeGoal.GainPower;
  let bestScore = -Infinity;

  for (const [goal, affinities] of LIFE_GOAL_TRAIT_AFFINITY) {
    let score = 0;
    for (const [trait, weight] of affinities) {
      const traitVal = traitValues.get(trait) ?? 0;
      score += (traitVal / 100) * weight;
    }
    if (score > bestScore) {
      bestScore = score;
      bestGoal = goal;
    }
  }

  return bestGoal;
}

// ── Goal change triggers ────────────────────────────────────────────────────

/**
 * Event types that can trigger a goal reassessment.
 */
export type GoalChangeTrigger =
  | 'family_death'
  | 'battle_defeat'
  | 'great_success'
  | 'betrayal'
  | 'religious_experience'
  | 'near_death'
  | 'romantic_loss'
  | 'discovery';

/**
 * Mapping of triggers to likely goal shifts.
 * A general who loses a battle might shift from AchieveGlory to something else.
 */
export const GOAL_SHIFT_TENDENCIES: ReadonlyMap<GoalChangeTrigger, readonly LifeGoal[]> = new Map([
  ['family_death', [LifeGoal.ProtectFamily, LifeGoal.ServeFaith]],
  ['battle_defeat', [LifeGoal.SeekKnowledge, LifeGoal.AccumulateWealth]],
  ['great_success', [LifeGoal.AchieveGlory, LifeGoal.GainPower]],
  ['betrayal', [LifeGoal.GainPower, LifeGoal.AccumulateWealth]],
  ['religious_experience', [LifeGoal.ServeFaith, LifeGoal.PursueArt]],
  ['near_death', [LifeGoal.ProtectFamily, LifeGoal.FindLove]],
  ['romantic_loss', [LifeGoal.AchieveGlory, LifeGoal.SeekKnowledge]],
  ['discovery', [LifeGoal.SeekKnowledge, LifeGoal.PursueArt]],
]);

let nextGoalId = 0;

export function createGoalId(): number {
  return nextGoalId++;
}

export function resetGoalIdCounter(): void {
  nextGoalId = 0;
}
