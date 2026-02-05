/**
 * Cross-domain transition rules from design doc Section 7.3.
 * Maps source event categories to possible consequence categories
 * with probability modifiers and typical delays.
 */

import { EventCategory } from './types.js';

/**
 * A single cross-domain transition rule.
 */
export interface CrossDomainTransition {
  /** Target event category */
  readonly targetCategory: EventCategory;
  /** Multiplier applied to base probability (0-2) */
  readonly probabilityModifier: number;
  /** Typical delay in ticks before consequence fires */
  readonly typicalDelay: number;
}

/**
 * Cross-domain transition map.
 * Defines which categories can cascade into which other categories.
 */
const transitionMap: ReadonlyMap<EventCategory, readonly CrossDomainTransition[]> = new Map([
  // Military victory → Political + Economic + Cultural + Religious + Personal + Magical
  [EventCategory.Military, [
    { targetCategory: EventCategory.Political, probabilityModifier: 1.2, typicalDelay: 7 },
    { targetCategory: EventCategory.Economic, probabilityModifier: 1.0, typicalDelay: 30 },
    { targetCategory: EventCategory.Cultural, probabilityModifier: 0.6, typicalDelay: 90 },
    { targetCategory: EventCategory.Religious, probabilityModifier: 0.5, typicalDelay: 30 },
    { targetCategory: EventCategory.Personal, probabilityModifier: 0.8, typicalDelay: 1 },
    { targetCategory: EventCategory.Magical, probabilityModifier: 0.3, typicalDelay: 7 },
  ]],

  // Political → Economic + Military + Cultural + Personal + Religious
  [EventCategory.Political, [
    { targetCategory: EventCategory.Economic, probabilityModifier: 1.0, typicalDelay: 30 },
    { targetCategory: EventCategory.Military, probabilityModifier: 0.8, typicalDelay: 7 },
    { targetCategory: EventCategory.Cultural, probabilityModifier: 0.4, typicalDelay: 90 },
    { targetCategory: EventCategory.Personal, probabilityModifier: 0.6, typicalDelay: 7 },
    { targetCategory: EventCategory.Religious, probabilityModifier: 0.3, typicalDelay: 30 },
  ]],

  // Religious schism → Political + Economic + Military + Cultural + Personal + Scientific
  [EventCategory.Religious, [
    { targetCategory: EventCategory.Political, probabilityModifier: 1.0, typicalDelay: 7 },
    { targetCategory: EventCategory.Economic, probabilityModifier: 0.6, typicalDelay: 30 },
    { targetCategory: EventCategory.Military, probabilityModifier: 0.7, typicalDelay: 30 },
    { targetCategory: EventCategory.Cultural, probabilityModifier: 0.8, typicalDelay: 90 },
    { targetCategory: EventCategory.Personal, probabilityModifier: 0.9, typicalDelay: 1 },
    { targetCategory: EventCategory.Scientific, probabilityModifier: 0.3, typicalDelay: 365 },
  ]],

  // Character death → Political + Personal + Magical + Religious
  [EventCategory.Personal, [
    { targetCategory: EventCategory.Political, probabilityModifier: 0.7, typicalDelay: 7 },
    { targetCategory: EventCategory.Personal, probabilityModifier: 1.0, typicalDelay: 1 },
    { targetCategory: EventCategory.Magical, probabilityModifier: 0.3, typicalDelay: 7 },
    { targetCategory: EventCategory.Religious, probabilityModifier: 0.4, typicalDelay: 7 },
  ]],

  // Trade route established → Economic + Cultural + Religious + Political
  [EventCategory.Economic, [
    { targetCategory: EventCategory.Economic, probabilityModifier: 1.0, typicalDelay: 30 },
    { targetCategory: EventCategory.Cultural, probabilityModifier: 0.7, typicalDelay: 90 },
    { targetCategory: EventCategory.Religious, probabilityModifier: 0.4, typicalDelay: 90 },
    { targetCategory: EventCategory.Political, probabilityModifier: 0.5, typicalDelay: 30 },
  ]],

  // Natural disaster → Economic + Military + Religious + Personal
  [EventCategory.Disaster, [
    { targetCategory: EventCategory.Economic, probabilityModifier: 1.2, typicalDelay: 1 },
    { targetCategory: EventCategory.Military, probabilityModifier: 0.5, typicalDelay: 7 },
    { targetCategory: EventCategory.Religious, probabilityModifier: 0.8, typicalDelay: 1 },
    { targetCategory: EventCategory.Personal, probabilityModifier: 1.0, typicalDelay: 1 },
    { targetCategory: EventCategory.Political, probabilityModifier: 0.6, typicalDelay: 7 },
  ]],

  // Magical → Religious + Personal + Political + Scientific + Disaster
  [EventCategory.Magical, [
    { targetCategory: EventCategory.Religious, probabilityModifier: 0.8, typicalDelay: 7 },
    { targetCategory: EventCategory.Personal, probabilityModifier: 0.6, typicalDelay: 1 },
    { targetCategory: EventCategory.Political, probabilityModifier: 0.4, typicalDelay: 30 },
    { targetCategory: EventCategory.Scientific, probabilityModifier: 0.5, typicalDelay: 90 },
    { targetCategory: EventCategory.Disaster, probabilityModifier: 0.3, typicalDelay: 1 },
  ]],

  // Cultural → Political + Religious + Economic + Personal
  [EventCategory.Cultural, [
    { targetCategory: EventCategory.Political, probabilityModifier: 0.5, typicalDelay: 90 },
    { targetCategory: EventCategory.Religious, probabilityModifier: 0.6, typicalDelay: 90 },
    { targetCategory: EventCategory.Economic, probabilityModifier: 0.4, typicalDelay: 30 },
    { targetCategory: EventCategory.Personal, probabilityModifier: 0.5, typicalDelay: 7 },
  ]],

  // Scientific → Economic + Military + Cultural + Magical
  [EventCategory.Scientific, [
    { targetCategory: EventCategory.Economic, probabilityModifier: 0.8, typicalDelay: 90 },
    { targetCategory: EventCategory.Military, probabilityModifier: 0.5, typicalDelay: 90 },
    { targetCategory: EventCategory.Cultural, probabilityModifier: 0.4, typicalDelay: 365 },
    { targetCategory: EventCategory.Magical, probabilityModifier: 0.3, typicalDelay: 30 },
  ]],

  // Exploratory → Economic + Political + Cultural + Personal + Disaster
  [EventCategory.Exploratory, [
    { targetCategory: EventCategory.Economic, probabilityModifier: 0.8, typicalDelay: 30 },
    { targetCategory: EventCategory.Political, probabilityModifier: 0.5, typicalDelay: 30 },
    { targetCategory: EventCategory.Cultural, probabilityModifier: 0.6, typicalDelay: 90 },
    { targetCategory: EventCategory.Personal, probabilityModifier: 0.7, typicalDelay: 1 },
    { targetCategory: EventCategory.Disaster, probabilityModifier: 0.3, typicalDelay: 7 },
  ]],
]);

/**
 * Get cross-domain transitions for a source category.
 */
export function getTransitions(source: EventCategory): readonly CrossDomainTransition[] {
  return transitionMap.get(source) ?? [];
}

/**
 * Get the probability modifier for a specific source→target transition.
 * Returns undefined if no transition exists.
 */
export function getTransitionModifier(
  source: EventCategory,
  target: EventCategory
): number | undefined {
  const transitions = transitionMap.get(source);
  if (transitions === undefined) return undefined;
  const transition = transitions.find((t) => t.targetCategory === target);
  return transition?.probabilityModifier;
}

/**
 * Check if a cross-domain transition is defined.
 */
export function hasTransition(source: EventCategory, target: EventCategory): boolean {
  return getTransitionModifier(source, target) !== undefined;
}

/**
 * Get all categories that a source can transition to.
 */
export function getTargetCategories(source: EventCategory): EventCategory[] {
  const transitions = transitionMap.get(source);
  if (transitions === undefined) return [];
  return transitions.map((t) => t.targetCategory);
}
