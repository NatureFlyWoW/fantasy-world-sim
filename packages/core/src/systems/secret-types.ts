/**
 * Secret type definitions for the Secret Knowledge System.
 * Design doc Section 18.8
 */

/**
 * Types of secrets that can exist in the simulation.
 * Each type represents a category of hidden information.
 */
export enum SecretType {
  /** Character pretending to be someone else */
  DisguisedIdentity = 'DisguisedIdentity',
  /** Powerful item's true location is hidden */
  HiddenArtifactLocation = 'HiddenArtifactLocation',
  /** Faction's real vs perceived army size differs */
  MilitaryStrength = 'MilitaryStrength',
  /** Religious knowledge held by specific order */
  Prophecy = 'Prophecy',
  /** Vulnerability of powerful being or faction */
  EntityWeakness = 'EntityWeakness',
  /** Planned coup, assassination, or sabotage */
  ConspiracyPlot = 'ConspiracyPlot',
  /** Dangerous magical or historical truth */
  ForbiddenKnowledge = 'ForbiddenKnowledge',
  /** Hidden diplomatic relationship */
  SecretAlliance = 'SecretAlliance',
}

export const ALL_SECRET_TYPES: readonly SecretType[] = [
  SecretType.DisguisedIdentity,
  SecretType.HiddenArtifactLocation,
  SecretType.MilitaryStrength,
  SecretType.Prophecy,
  SecretType.EntityWeakness,
  SecretType.ConspiracyPlot,
  SecretType.ForbiddenKnowledge,
  SecretType.SecretAlliance,
] as const;

/**
 * Base significance values for each secret type.
 * Higher values create more impactful revelations.
 */
export const SECRET_BASE_SIGNIFICANCE: Record<SecretType, number> = {
  [SecretType.DisguisedIdentity]: 60,
  [SecretType.HiddenArtifactLocation]: 50,
  [SecretType.MilitaryStrength]: 55,
  [SecretType.Prophecy]: 70,
  [SecretType.EntityWeakness]: 65,
  [SecretType.ConspiracyPlot]: 80,
  [SecretType.ForbiddenKnowledge]: 75,
  [SecretType.SecretAlliance]: 60,
};

/**
 * Base revelation probability per tick for each secret type.
 * Secrets with more knowers are harder to keep.
 */
export const SECRET_BASE_REVELATION_RATE: Record<SecretType, number> = {
  [SecretType.DisguisedIdentity]: 0.001, // Hard to maintain day-to-day
  [SecretType.HiddenArtifactLocation]: 0.0005, // Locations stay hidden longer
  [SecretType.MilitaryStrength]: 0.002, // Military intel leaks quickly
  [SecretType.Prophecy]: 0.0002, // Religious orders keep secrets well
  [SecretType.EntityWeakness]: 0.0008,
  [SecretType.ConspiracyPlot]: 0.003, // Conspiracies are fragile
  [SecretType.ForbiddenKnowledge]: 0.0003, // Dangerous to share
  [SecretType.SecretAlliance]: 0.001,
};

/**
 * Categories of revelation methods.
 */
export enum RevelationMethod {
  /** Secret leaked naturally over time */
  NaturalLeak = 'NaturalLeak',
  /** Discovered through active investigation */
  Investigation = 'Investigation',
  /** Extracted through interrogation */
  Interrogation = 'Interrogation',
  /** Deduced from available clues */
  Deduction = 'Deduction',
  /** Revealed by divine intervention */
  DivineRevelation = 'DivineRevelation',
  /** Betrayed by a co-conspirator */
  Betrayal = 'Betrayal',
  /** Discovered accidentally */
  Accident = 'Accident',
  /** Deliberately revealed by a knower */
  VoluntaryDisclosure = 'VoluntaryDisclosure',
}

export const ALL_REVELATION_METHODS: readonly RevelationMethod[] = [
  RevelationMethod.NaturalLeak,
  RevelationMethod.Investigation,
  RevelationMethod.Interrogation,
  RevelationMethod.Deduction,
  RevelationMethod.DivineRevelation,
  RevelationMethod.Betrayal,
  RevelationMethod.Accident,
  RevelationMethod.VoluntaryDisclosure,
] as const;
