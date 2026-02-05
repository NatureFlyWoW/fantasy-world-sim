/**
 * Dampening functions for the event cascade system.
 * Controls how probability decreases at each chain depth.
 *
 * High-significance events have reduced dampening (cascade further).
 * Minor events have high dampening (cascade dies quickly).
 */

/**
 * Calculate effective probability after dampening.
 *
 * Formula: effectiveProbability = baseProbability × (1 - dampening)^chainDepth
 *
 * @param baseProbability Base probability (0-1)
 * @param dampening Per-depth dampening factor (0-1)
 * @param chainDepth Current depth in the cascade chain
 * @returns Effective probability after dampening
 */
export function calculateDampenedProbability(
  baseProbability: number,
  dampening: number,
  chainDepth: number
): number {
  if (chainDepth <= 0) return baseProbability;
  const factor = Math.pow(1 - dampening, chainDepth);
  return baseProbability * factor;
}

/**
 * Get a significance-adjusted dampening factor.
 *
 * High-significance events (80+) have their dampening reduced,
 * allowing them to cascade further through the chain.
 * Low-significance events (< 30) have increased dampening.
 *
 * @param baseDampening The rule's base dampening (0-1)
 * @param significance Event significance (0-100)
 * @returns Adjusted dampening factor
 */
export function adjustDampeningForSignificance(
  baseDampening: number,
  significance: number
): number {
  // High significance (80+): reduce dampening by up to 40%
  // Normal significance (30-80): no adjustment
  // Low significance (<30): increase dampening by up to 50%
  if (significance >= 80) {
    const reduction = ((significance - 80) / 20) * 0.4; // 0-0.4 range
    return Math.max(0, baseDampening * (1 - reduction));
  }
  if (significance < 30) {
    const increase = ((30 - significance) / 30) * 0.5; // 0-0.5 range
    return Math.min(1, baseDampening * (1 + increase));
  }
  return baseDampening;
}

/**
 * Check if a cascade should continue at a given depth and probability.
 * Returns false if the effective probability is too low to matter.
 *
 * @param effectiveProbability The dampened probability
 * @param minThreshold Minimum probability to continue (default: 0.01)
 */
export function shouldContinueCascade(
  effectiveProbability: number,
  minThreshold = 0.01
): boolean {
  return effectiveProbability >= minThreshold;
}
