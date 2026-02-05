/**
 * SecretPerceptionFilter — filters ground truth through character knowledge.
 * Used by Character AI's PERCEIVE phase to ensure characters only act on
 * information they actually know.
 */

import type { EntityId, CharacterId, FactionId } from '../ecs/types.js';
import { SecretType } from './secret-types.js';
import type { Secret } from './secret.js';
import type { SecretManager } from './secret-manager.js';

/**
 * Ground truth state about the world (what's actually true).
 */
export interface GroundTruthState {
  /** Character identities: characterId -> true identity (if disguised) */
  characterIdentities: Map<CharacterId, CharacterId>;
  /** Faction military strengths: factionId -> actual strength */
  militaryStrengths: Map<FactionId, number>;
  /** Artifact locations: artifactId -> actual location (siteId) */
  artifactLocations: Map<EntityId, EntityId>;
  /** Entity weaknesses: entityId -> weakness description */
  entityWeaknesses: Map<EntityId, string>;
  /** Active conspiracies: conspiracyId -> target entity */
  activeConspiracies: Map<EntityId, EntityId>;
  /** Secret alliances: [faction1, faction2] pairs */
  secretAlliances: Array<[FactionId, FactionId]>;
  /** Prophecies: deityId -> prophecy content */
  prophecies: Map<EntityId, string>;
  /** Forbidden knowledge: knowledgeId -> content */
  forbiddenKnowledge: Map<EntityId, Record<string, unknown>>;
}

/**
 * Perceived state from a character's perspective (what they believe is true).
 */
export interface PerceivedState {
  /** Who this perception belongs to */
  readonly characterId: CharacterId;
  /** Character identities as this character perceives them */
  characterIdentities: Map<CharacterId, CharacterId>;
  /** Faction military strengths as perceived */
  militaryStrengths: Map<FactionId, number>;
  /** Artifact locations as known */
  artifactLocations: Map<EntityId, EntityId>;
  /** Entity weaknesses as known */
  entityWeaknesses: Map<EntityId, string>;
  /** Conspiracies this character knows about */
  knownConspiracies: Set<EntityId>;
  /** Alliances this character knows about (including secret ones they're aware of) */
  knownAlliances: Array<[FactionId, FactionId]>;
  /** Prophecies this character knows */
  knownProphecies: Map<EntityId, string>;
  /** Forbidden knowledge this character has */
  knownForbiddenKnowledge: Map<EntityId, Record<string, unknown>>;
  /** Things this character suspects but doesn't know for certain */
  suspicions: Map<EntityId, number>; // secretId -> confidence
}

/**
 * Configuration for perception filtering.
 */
export interface PerceptionFilterConfig {
  /** Default perceived military strength when unknown (relative to average) */
  defaultMilitaryPerception: number;
  /** How much suspicion affects perception (0-1) */
  suspicionPerceptionWeight: number;
}

export const DEFAULT_PERCEPTION_CONFIG: PerceptionFilterConfig = {
  defaultMilitaryPerception: 1.0, // Assume average
  suspicionPerceptionWeight: 0.3, // Suspicions provide 30% of the truth
};

/**
 * SecretPerceptionFilter transforms ground truth into character-specific perceptions.
 */
export class SecretPerceptionFilter {
  private readonly _config: PerceptionFilterConfig;
  private readonly secretManager: SecretManager;

  constructor(
    secretManager: SecretManager,
    config: Partial<PerceptionFilterConfig> = {},
  ) {
    this.secretManager = secretManager;
    this._config = { ...DEFAULT_PERCEPTION_CONFIG, ...config };
  }

  /**
   * Get the perceived state of the world from a character's perspective.
   * Characters only see what they know, not ground truth.
   */
  getPerceivedState(
    characterId: CharacterId,
    groundTruth: GroundTruthState,
  ): PerceivedState {
    const perceived: PerceivedState = {
      characterId,
      characterIdentities: new Map(),
      militaryStrengths: new Map(),
      artifactLocations: new Map(),
      entityWeaknesses: new Map(),
      knownConspiracies: new Set(),
      knownAlliances: [],
      knownProphecies: new Map(),
      knownForbiddenKnowledge: new Map(),
      suspicions: new Map(),
    };

    // Get all secrets this character knows
    const knownSecrets = this.secretManager.getSecretsKnownBy(characterId);

    // Process each secret type
    this.applyIdentityPerception(
      characterId,
      groundTruth,
      knownSecrets,
      perceived,
    );
    this.applyMilitaryPerception(
      characterId,
      groundTruth,
      knownSecrets,
      perceived,
    );
    this.applyArtifactPerception(
      characterId,
      groundTruth,
      knownSecrets,
      perceived,
    );
    this.applyWeaknessPerception(
      characterId,
      groundTruth,
      knownSecrets,
      perceived,
    );
    this.applyConspiracyPerception(
      characterId,
      groundTruth,
      knownSecrets,
      perceived,
    );
    this.applyAlliancePerception(
      characterId,
      groundTruth,
      knownSecrets,
      perceived,
    );
    this.applyProphecyPerception(
      characterId,
      groundTruth,
      knownSecrets,
      perceived,
    );
    this.applyForbiddenKnowledgePerception(
      characterId,
      groundTruth,
      knownSecrets,
      perceived,
    );

    // Add suspicions
    const suspectedSecrets = this.secretManager.getSecretsSuspectedBy(characterId);
    for (const secret of suspectedSecrets) {
      const confidence = this.secretManager.getSuspicionLevel(characterId, secret.id);
      perceived.suspicions.set(secret.id, confidence);
    }

    return perceived;
  }

  /**
   * Apply perception rules for disguised identities.
   */
  private applyIdentityPerception(
    _characterId: CharacterId,
    groundTruth: GroundTruthState,
    knownSecrets: readonly Secret[],
    perceived: PerceivedState,
  ): void {
    // By default, characters see what they're shown (the disguise)
    for (const [disguisedId, trueId] of groundTruth.characterIdentities) {
      // Check if this character knows this specific disguise secret
      const knowsSecret = knownSecrets.some(
        (s) =>
          s.type === SecretType.DisguisedIdentity &&
          s.groundTruth['disguisedCharacterId'] === disguisedId,
      );

      if (knowsSecret) {
        // Sees the true identity
        perceived.characterIdentities.set(disguisedId, trueId);
      } else {
        // Sees the disguise (character appears as themselves)
        perceived.characterIdentities.set(disguisedId, disguisedId);
      }
    }
  }

  /**
   * Apply perception rules for military strength.
   */
  private applyMilitaryPerception(
    _characterId: CharacterId,
    groundTruth: GroundTruthState,
    knownSecrets: readonly Secret[],
    perceived: PerceivedState,
  ): void {
    for (const [factionId, actualStrength] of groundTruth.militaryStrengths) {
      // Check if this character knows military intel about this faction
      const intelSecret = knownSecrets.find(
        (s) =>
          s.type === SecretType.MilitaryStrength &&
          s.groundTruth['factionId'] === factionId,
      );

      if (intelSecret !== undefined) {
        // Knows the actual strength
        perceived.militaryStrengths.set(factionId, actualStrength);
      } else {
        // Use perceived/public strength if available, otherwise estimate
        const publicStrength = this.getPublicStrength(factionId, actualStrength);
        perceived.militaryStrengths.set(factionId, publicStrength);
      }
    }
  }

  /**
   * Get public/perceived military strength (could differ from actual).
   */
  private getPublicStrength(factionId: FactionId, actualStrength: number): number {
    // In a full implementation, this would look up the faction's public image
    // For now, apply some variance based on faction ID for determinism
    const variance = ((factionId as unknown as number) % 3 - 1) * 0.2;
    // Apply config's default perception multiplier
    const basePerception = actualStrength * this._config.defaultMilitaryPerception;
    return Math.round(basePerception * (1 + variance));
  }

  /**
   * Apply perception rules for artifact locations.
   */
  private applyArtifactPerception(
    _characterId: CharacterId,
    groundTruth: GroundTruthState,
    knownSecrets: readonly Secret[],
    perceived: PerceivedState,
  ): void {
    for (const [artifactId, location] of groundTruth.artifactLocations) {
      // Check if this character knows where this artifact is
      const locationSecret = knownSecrets.find(
        (s) =>
          s.type === SecretType.HiddenArtifactLocation &&
          s.groundTruth['artifactId'] === artifactId,
      );

      if (locationSecret !== undefined) {
        perceived.artifactLocations.set(artifactId, location);
      }
      // Otherwise, character doesn't know the location at all
    }
  }

  /**
   * Apply perception rules for entity weaknesses.
   */
  private applyWeaknessPerception(
    _characterId: CharacterId,
    groundTruth: GroundTruthState,
    knownSecrets: readonly Secret[],
    perceived: PerceivedState,
  ): void {
    for (const [entityId, weakness] of groundTruth.entityWeaknesses) {
      const weaknessSecret = knownSecrets.find(
        (s) =>
          s.type === SecretType.EntityWeakness &&
          s.groundTruth['entityId'] === entityId,
      );

      if (weaknessSecret !== undefined) {
        perceived.entityWeaknesses.set(entityId, weakness);
      }
    }
  }

  /**
   * Apply perception rules for conspiracies.
   */
  private applyConspiracyPerception(
    _characterId: CharacterId,
    groundTruth: GroundTruthState,
    knownSecrets: readonly Secret[],
    perceived: PerceivedState,
  ): void {
    for (const conspiracyId of groundTruth.activeConspiracies.keys()) {
      const conspiracySecret = knownSecrets.find(
        (s) =>
          s.type === SecretType.ConspiracyPlot &&
          s.groundTruth['conspiracyId'] === conspiracyId,
      );

      if (conspiracySecret !== undefined) {
        perceived.knownConspiracies.add(conspiracyId);
      }
    }
  }

  /**
   * Apply perception rules for alliances.
   */
  private applyAlliancePerception(
    _characterId: CharacterId,
    groundTruth: GroundTruthState,
    knownSecrets: readonly Secret[],
    perceived: PerceivedState,
  ): void {
    for (const [faction1, faction2] of groundTruth.secretAlliances) {
      const allianceSecret = knownSecrets.find(
        (s) =>
          s.type === SecretType.SecretAlliance &&
          ((s.groundTruth['faction1'] === faction1 &&
            s.groundTruth['faction2'] === faction2) ||
            (s.groundTruth['faction1'] === faction2 &&
              s.groundTruth['faction2'] === faction1)),
      );

      if (allianceSecret !== undefined) {
        perceived.knownAlliances.push([faction1, faction2]);
      }
    }
  }

  /**
   * Apply perception rules for prophecies.
   */
  private applyProphecyPerception(
    _characterId: CharacterId,
    groundTruth: GroundTruthState,
    knownSecrets: readonly Secret[],
    perceived: PerceivedState,
  ): void {
    for (const [deityId, prophecy] of groundTruth.prophecies) {
      const prophecySecret = knownSecrets.find(
        (s) =>
          s.type === SecretType.Prophecy &&
          s.groundTruth['deityId'] === deityId,
      );

      if (prophecySecret !== undefined) {
        perceived.knownProphecies.set(deityId, prophecy);
      }
    }
  }

  /**
   * Apply perception rules for forbidden knowledge.
   */
  private applyForbiddenKnowledgePerception(
    _characterId: CharacterId,
    groundTruth: GroundTruthState,
    knownSecrets: readonly Secret[],
    perceived: PerceivedState,
  ): void {
    for (const [knowledgeId, content] of groundTruth.forbiddenKnowledge) {
      const knowledgeSecret = knownSecrets.find(
        (s) =>
          s.type === SecretType.ForbiddenKnowledge &&
          s.groundTruth['knowledgeId'] === knowledgeId,
      );

      if (knowledgeSecret !== undefined) {
        perceived.knownForbiddenKnowledge.set(knowledgeId, content);
      }
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Check if a character perceives a specific piece of information correctly.
   */
  doesCharacterKnowTruth(
    characterId: CharacterId,
    secretType: SecretType,
    truthKey: string,
    truthValue: unknown,
  ): boolean {
    const secrets = this.secretManager.getSecretsKnownBy(characterId);
    return secrets.some(
      (s) =>
        s.type === secretType &&
        s.groundTruth[truthKey] === truthValue,
    );
  }

  /**
   * Get the perceived value for a specific piece of information.
   * Returns undefined if the character has no perception of it.
   */
  getPerceivedValue(
    characterId: CharacterId,
    secretType: SecretType,
    truthKey: string,
    _groundTruthValue: unknown,
  ): unknown {
    const secrets = this.secretManager.getSecretsKnownBy(characterId);
    const relevantSecret = secrets.find(
      (s) =>
        s.type === secretType &&
        s.groundTruth[truthKey] !== undefined,
    );

    if (relevantSecret !== undefined) {
      // Character knows the truth
      return relevantSecret.groundTruth[truthKey];
    }

    // Check suspicions for partial information
    const suspectedSecrets = this.secretManager.getSecretsSuspectedBy(characterId);
    const suspectedSecret = suspectedSecrets.find(
      (s) =>
        s.type === secretType &&
        s.groundTruth[truthKey] !== undefined,
    );

    if (suspectedSecret !== undefined) {
      const confidence = this.secretManager.getSuspicionLevel(
        characterId,
        suspectedSecret.id,
      );
      // High suspicion = closer to truth (threshold affected by suspicionPerceptionWeight)
      const threshold = 100 - this._config.suspicionPerceptionWeight * 100;
      if (confidence >= threshold) {
        return suspectedSecret.groundTruth[truthKey];
      }
    }

    // Character has no information
    return undefined;
  }

  /**
   * Create a "blank" ground truth state (for initialization).
   */
  static createEmptyGroundTruth(): GroundTruthState {
    return {
      characterIdentities: new Map(),
      militaryStrengths: new Map(),
      artifactLocations: new Map(),
      entityWeaknesses: new Map(),
      activeConspiracies: new Map(),
      secretAlliances: [],
      prophecies: new Map(),
      forbiddenKnowledge: new Map(),
    };
  }
}
