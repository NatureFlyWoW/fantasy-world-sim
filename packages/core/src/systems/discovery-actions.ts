/**
 * DiscoveryActions — actions characters can take to discover secrets.
 * Includes investigation, interrogation, and deduction mechanics.
 */

import type { EntityId, CharacterId } from '../ecs/types.js';
import type { EventBus } from '../events/event-bus.js';
import { EventCategory } from '../events/types.js';
import { createEvent } from '../events/event-factory.js';
import { SecretType, RevelationMethod } from './secret-types.js';
import type { Secret, Clue } from './secret.js';
import type { SecretManager } from './secret-manager.js';

/**
 * Character skills relevant to secret discovery.
 */
export interface DiscoverySkills {
  /** Ability to uncover hidden information (0-100) */
  investigation: number;
  /** Ability to extract information from others (0-100) */
  interrogation: number;
  /** Ability to connect clues and deduce truths (0-100) */
  deduction: number;
  /** General cunning/cleverness (0-100) */
  cunning: number;
  /** Social manipulation ability (0-100) */
  persuasion: number;
  /** Resistance to interrogation (0-100) */
  willpower: number;
}

/**
 * Result of a discovery action.
 */
export interface DiscoveryResult {
  /** Whether the action succeeded */
  success: boolean;
  /** Secrets discovered (if any) */
  discoveredSecrets: EntityId[];
  /** Suspicion gained on secrets (secretId -> confidence increase) */
  suspicionGained: Map<EntityId, number>;
  /** Clues found (if any) */
  cluesFound: EntityId[];
  /** Description of what happened */
  narrative: string;
  /** Whether the target became aware of the attempt */
  targetAware: boolean;
}

/**
 * Configuration for discovery action mechanics.
 */
export interface DiscoveryActionConfig {
  /** Base success rate for investigation (0-1) */
  baseInvestigationSuccess: number;
  /** Base success rate for interrogation (0-1) */
  baseInterrogationSuccess: number;
  /** Base success rate for deduction (0-1) */
  baseDeductionSuccess: number;
  /** How much skill affects success rate (per point) */
  skillModifier: number;
  /** Chance target detects investigation attempt */
  detectionChance: number;
  /** Minimum clues needed for deduction attempt */
  minCluesForDeduction: number;
  /** Suspicion gained per clue found */
  suspicionPerClue: number;
}

export const DEFAULT_DISCOVERY_CONFIG: DiscoveryActionConfig = {
  baseInvestigationSuccess: 0.3,
  baseInterrogationSuccess: 0.4,
  baseDeductionSuccess: 0.5,
  skillModifier: 0.005, // +0.5% per skill point
  detectionChance: 0.2,
  minCluesForDeduction: 2,
  suspicionPerClue: 15,
};

/**
 * DiscoveryActions handles all secret discovery mechanics.
 */
export class DiscoveryActions {
  private readonly config: DiscoveryActionConfig;
  private readonly secretManager: SecretManager;
  private readonly skillProvider: (characterId: CharacterId) => DiscoverySkills;

  constructor(
    secretManager: SecretManager,
    skillProvider: (characterId: CharacterId) => DiscoverySkills,
    config: Partial<DiscoveryActionConfig> = {},
  ) {
    this.secretManager = secretManager;
    this.skillProvider = skillProvider;
    this.config = { ...DEFAULT_DISCOVERY_CONFIG, ...config };
  }

  // ==========================================================================
  // Investigation
  // ==========================================================================

  /**
   * Perform an investigation action to uncover secrets about a target.
   * Spymasters and agents use this to gather intelligence.
   */
  investigate(
    investigator: CharacterId,
    targetEntityId: EntityId,
    targetSecretTypes: SecretType[],
    currentTick: number,
    eventBus: EventBus,
  ): DiscoveryResult {
    const skills = this.skillProvider(investigator);
    const successRate = this.calculateInvestigationSuccess(skills);

    const result: DiscoveryResult = {
      success: false,
      discoveredSecrets: [],
      suspicionGained: new Map(),
      cluesFound: [],
      narrative: '',
      targetAware: false,
    };

    // Get relevant secrets about the target
    const targetSecrets = this.secretManager
      .getSecretsAboutEntity(targetEntityId)
      .filter(
        (s) =>
          !s.isRevealed &&
          targetSecretTypes.includes(s.type) &&
          !s.knownBy.has(investigator),
      );

    if (targetSecrets.length === 0) {
      result.narrative = 'Investigation found no relevant secrets to uncover.';
      return result;
    }

    // Roll for each secret
    for (const secret of targetSecrets) {
      const roll = Math.random();
      const secretDifficulty = this.getSecretDifficulty(secret);
      const adjustedRate = successRate / secretDifficulty;

      if (roll < adjustedRate) {
        // Full discovery
        result.discoveredSecrets.push(secret.id);
        this.secretManager.addKnower(secret.id, investigator);
        result.success = true;
      } else if (roll < adjustedRate * 2) {
        // Partial discovery - gain suspicion
        const suspicionGain =
          Math.round(this.config.suspicionPerClue * (1 + skills.cunning / 100));
        this.secretManager.increaseSuspicion(secret.id, investigator, suspicionGain);
        result.suspicionGained.set(secret.id, suspicionGain);

        // Might find a clue
        if (roll < adjustedRate * 1.5) {
          const clue = this.secretManager.createClue(
            secret.id,
            `Suspicious activity related to ${secret.type}`,
            0.3,
            investigator,
            currentTick,
          );
          if (clue !== undefined) {
            result.cluesFound.push(clue.id);
          }
        }
      }
    }

    // Check if investigation was detected
    const detectionRoll = Math.random();
    const detectionChance =
      this.config.detectionChance * (1 - skills.cunning / 200);
    result.targetAware = detectionRoll < detectionChance;

    // Build narrative
    result.narrative = this.buildInvestigationNarrative(result, targetEntityId);

    // Emit event
    this.emitDiscoveryEvent(
      'investigation',
      investigator,
      targetEntityId,
      result,
      currentTick,
      eventBus,
    );

    return result;
  }

  /**
   * Calculate investigation success rate based on skills.
   */
  private calculateInvestigationSuccess(skills: DiscoverySkills): number {
    return (
      this.config.baseInvestigationSuccess +
      skills.investigation * this.config.skillModifier +
      skills.cunning * this.config.skillModifier * 0.5
    );
  }

  // ==========================================================================
  // Interrogation
  // ==========================================================================

  /**
   * Interrogate a captured character to extract secrets.
   * The target must be a knower of secrets for this to work.
   */
  interrogate(
    interrogator: CharacterId,
    prisoner: CharacterId,
    currentTick: number,
    eventBus: EventBus,
  ): DiscoveryResult {
    const interrogatorSkills = this.skillProvider(interrogator);
    const prisonerSkills = this.skillProvider(prisoner);

    const result: DiscoveryResult = {
      success: false,
      discoveredSecrets: [],
      suspicionGained: new Map(),
      cluesFound: [],
      narrative: '',
      targetAware: true, // Prisoner always knows they're being interrogated
    };

    // Get secrets the prisoner knows
    const prisonerSecrets = this.secretManager
      .getSecretsKnownBy(prisoner)
      .filter((s) => !s.isRevealed && !s.knownBy.has(interrogator));

    if (prisonerSecrets.length === 0) {
      result.narrative = 'The prisoner has no secrets unknown to the interrogator.';
      return result;
    }

    // Calculate success rate based on interrogator vs prisoner skills
    const successRate = this.calculateInterrogationSuccess(
      interrogatorSkills,
      prisonerSkills,
    );

    // Roll for each secret
    for (const secret of prisonerSecrets) {
      const roll = Math.random();
      const secretImportance = secret.significance / 100;
      const adjustedRate = successRate * (1 - secretImportance * 0.5);

      if (roll < adjustedRate) {
        // Prisoner reveals the secret
        result.discoveredSecrets.push(secret.id);
        this.secretManager.addKnower(secret.id, interrogator);
        result.success = true;

        // This is technically a revelation through betrayal
        this.secretManager.revealSecret(
          secret.id,
          RevelationMethod.Interrogation,
          prisoner,
          [interrogator],
          currentTick,
          eventBus,
        );
      } else if (roll < adjustedRate * 1.5) {
        // Prisoner gives partial information
        const suspicionGain = Math.round(
          this.config.suspicionPerClue *
            2 *
            (1 + interrogatorSkills.interrogation / 100),
        );
        this.secretManager.increaseSuspicion(secret.id, interrogator, suspicionGain);
        result.suspicionGained.set(secret.id, suspicionGain);
      }
    }

    // Build narrative
    result.narrative = this.buildInterrogationNarrative(result, prisoner);

    // Emit event
    this.emitDiscoveryEvent(
      'interrogation',
      interrogator,
      prisoner as unknown as EntityId,
      result,
      currentTick,
      eventBus,
    );

    return result;
  }

  /**
   * Calculate interrogation success rate.
   */
  private calculateInterrogationSuccess(
    interrogator: DiscoverySkills,
    prisoner: DiscoverySkills,
  ): number {
    const attackerScore =
      interrogator.interrogation + interrogator.persuasion * 0.5;
    const defenderScore = prisoner.willpower + prisoner.cunning * 0.5;

    const advantage = (attackerScore - defenderScore) / 100;
    return Math.max(
      0.1,
      Math.min(0.9, this.config.baseInterrogationSuccess + advantage),
    );
  }

  // ==========================================================================
  // Deduction
  // ==========================================================================

  /**
   * Attempt to deduce a secret from collected clues.
   * Scholars and wise characters use this to piece together truth.
   */
  deduceFromClues(
    scholar: CharacterId,
    clueIds: EntityId[],
    currentTick: number,
    eventBus: EventBus,
  ): DiscoveryResult {
    const skills = this.skillProvider(scholar);

    const result: DiscoveryResult = {
      success: false,
      discoveredSecrets: [],
      suspicionGained: new Map(),
      cluesFound: [],
      narrative: '',
      targetAware: false,
    };

    if (clueIds.length < this.config.minCluesForDeduction) {
      result.narrative = `Not enough clues for deduction (need ${this.config.minCluesForDeduction}, have ${clueIds.length}).`;
      return result;
    }

    // Group clues by secret they relate to
    const cluesBySecret = new Map<EntityId, Clue[]>();
    for (const clueId of clueIds) {
      const clues = Array.from(
        this.secretManager.getAllSecrets().flatMap((s) => {
          const secretClues = this.secretManager.getCluesForSecret(s.id);
          return secretClues.filter((c) => c.id === clueId);
        }),
      );
      for (const clue of clues) {
        const existing = cluesBySecret.get(clue.secretId);
        if (existing !== undefined) {
          existing.push(clue);
        } else {
          cluesBySecret.set(clue.secretId, [clue]);
        }
      }
    }

    // Calculate deduction success
    const baseRate = this.config.baseDeductionSuccess;
    const skillBonus =
      skills.deduction * this.config.skillModifier +
      skills.cunning * this.config.skillModifier * 0.3;

    for (const [secretId, clues] of cluesBySecret) {
      const secret = this.secretManager.getSecret(secretId);
      if (secret === undefined || secret.isRevealed) continue;
      if (secret.knownBy.has(scholar)) continue;

      // Calculate total clue weight
      const totalWeight = clues.reduce((sum, c) => sum + c.weight, 0);
      const clueBonus = totalWeight * 0.3;

      const successRate = Math.min(0.9, baseRate + skillBonus + clueBonus);
      const roll = Math.random();

      if (roll < successRate) {
        // Scholar deduces the truth
        result.discoveredSecrets.push(secretId);
        this.secretManager.addKnower(secretId, scholar);
        result.success = true;

        // Emit deduction revelation
        this.secretManager.revealSecret(
          secretId,
          RevelationMethod.Deduction,
          scholar,
          [scholar],
          currentTick,
          eventBus,
        );
      } else if (roll < successRate * 1.5) {
        // Gains strong suspicion
        const suspicionGain = Math.round(totalWeight * 50 + skills.deduction / 2);
        this.secretManager.increaseSuspicion(secretId, scholar, suspicionGain);
        result.suspicionGained.set(secretId, suspicionGain);
      }
    }

    // Build narrative
    result.narrative = this.buildDeductionNarrative(result, clueIds.length);

    // Emit event
    this.emitDiscoveryEvent(
      'deduction',
      scholar,
      scholar as unknown as EntityId,
      result,
      currentTick,
      eventBus,
    );

    return result;
  }

  /**
   * Attempt to deduce secrets about a specific target.
   */
  deduceAboutTarget(
    scholar: CharacterId,
    targetEntityId: EntityId,
    currentTick: number,
    eventBus: EventBus,
  ): DiscoveryResult {
    // Get all clues the scholar has discovered about this target
    const targetSecrets = this.secretManager.getSecretsAboutEntity(targetEntityId);
    const relevantClueIds: EntityId[] = [];

    for (const secret of targetSecrets) {
      const clues = this.secretManager.getCluesForSecret(secret.id);
      for (const clue of clues) {
        if (clue.discoveredBy === scholar) {
          relevantClueIds.push(clue.id);
        }
      }
    }

    return this.deduceFromClues(scholar, relevantClueIds, currentTick, eventBus);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get difficulty multiplier for a secret (higher = harder to discover).
   */
  private getSecretDifficulty(secret: Secret): number {
    // Fewer knowers = harder to discover
    const knowerFactor = Math.max(1, 3 - secret.knownBy.size * 0.5);

    // Younger secrets = harder to discover
    const ageFactor = Math.max(0.5, 1 - secret.age / 10000);

    // Higher significance = better protected
    const significanceFactor = 1 + secret.significance / 100;

    return knowerFactor * ageFactor * significanceFactor;
  }

  /**
   * Build narrative for investigation result.
   */
  private buildInvestigationNarrative(
    result: DiscoveryResult,
    targetId: EntityId,
  ): string {
    if (result.discoveredSecrets.length > 0) {
      return `Investigation uncovered ${result.discoveredSecrets.length} secret(s) about target ${targetId}.`;
    }
    if (result.suspicionGained.size > 0) {
      return `Investigation found suspicious activity but no definitive proof.`;
    }
    return `Investigation yielded no useful information.`;
  }

  /**
   * Build narrative for interrogation result.
   */
  private buildInterrogationNarrative(
    result: DiscoveryResult,
    prisoner: CharacterId,
  ): string {
    if (result.discoveredSecrets.length > 0) {
      return `Interrogation of ${prisoner} revealed ${result.discoveredSecrets.length} secret(s).`;
    }
    if (result.suspicionGained.size > 0) {
      return `Prisoner ${prisoner} revealed partial information but held back full truth.`;
    }
    return `Prisoner ${prisoner} resisted interrogation.`;
  }

  /**
   * Build narrative for deduction result.
   */
  private buildDeductionNarrative(result: DiscoveryResult, clueCount: number): string {
    if (result.discoveredSecrets.length > 0) {
      return `Careful analysis of ${clueCount} clues revealed ${result.discoveredSecrets.length} truth(s).`;
    }
    if (result.suspicionGained.size > 0) {
      return `Analysis suggests hidden truths but lacks conclusive proof.`;
    }
    return `Analysis of clues yielded no breakthrough.`;
  }

  /**
   * Emit discovery action event.
   */
  private emitDiscoveryEvent(
    actionType: 'investigation' | 'interrogation' | 'deduction',
    actor: CharacterId,
    target: EntityId,
    result: DiscoveryResult,
    currentTick: number,
    eventBus: EventBus,
  ): void {
    const significance = result.success ? 40 : 20;

    eventBus.emit(
      createEvent({
        category: EventCategory.Personal,
        subtype: `secret.${actionType}_attempt`,
        timestamp: currentTick,
        participants: [actor as unknown as EntityId, target],
        significance,
        data: {
          actionType,
          success: result.success,
          secretsDiscovered: result.discoveredSecrets.length,
          suspicionGained: result.suspicionGained.size,
          targetAware: result.targetAware,
        },
      }),
    );
  }

  // ==========================================================================
  // Helper for creating default skill provider
  // ==========================================================================

  /**
   * Create a default skill provider that returns average skills.
   */
  static createDefaultSkillProvider(): (characterId: CharacterId) => DiscoverySkills {
    return (_characterId: CharacterId) => ({
      investigation: 50,
      interrogation: 50,
      deduction: 50,
      cunning: 50,
      persuasion: 50,
      willpower: 50,
    });
  }
}
