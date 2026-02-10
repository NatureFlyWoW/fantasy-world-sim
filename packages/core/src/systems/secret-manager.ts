/**
 * SecretManager — manages creation, tracking, and revelation of secrets.
 * Central hub for the Secret Knowledge System.
 */

import type { EntityId, CharacterId, FactionId, EventId } from '../ecs/types.js';
import type { EventBus } from '../events/event-bus.js';
import { EventCategory } from '../events/types.js';
import { createEvent } from '../events/event-factory.js';
import {
  SecretType,
  RevelationMethod,
  SECRET_BASE_SIGNIFICANCE,
  SECRET_BASE_REVELATION_RATE,
} from './secret-types.js';
import type {
  Secret,
  CreateSecretOptions,
  RevelationCheckResult,
  Clue,
  SecretRevelationEvent,
} from './secret.js';
import { createSecretId, createClueId } from './secret.js';
import { SeededRNG } from '../utils/seeded-rng.js';

/**
 * Configuration for secret revelation mechanics.
 */
export interface SecretManagerConfig {
  /** How much age increases revelation probability (per tick) */
  ageRevelationFactor: number;
  /** How much each additional knower increases revelation probability */
  knowerLeakFactor: number;
  /** Minimum confidence to convert suspicion to knowledge */
  suspicionConfirmationThreshold: number;
  /** Maximum cascade depth for revelation consequences */
  maxRevealCascadeDepth: number;
  /** Base betrayal probability when knower is captured */
  captureBetrayal: number;
}

export const DEFAULT_SECRET_CONFIG: SecretManagerConfig = {
  ageRevelationFactor: 0.00001, // Small increase per tick
  knowerLeakFactor: 0.1, // 10% increase per additional knower
  suspicionConfirmationThreshold: 80, // 80% confidence confirms suspicion
  maxRevealCascadeDepth: 3,
  captureBetrayal: 0.3, // 30% chance to reveal when captured
};

/**
 * World state information used for revelation checks.
 */
export interface SecretWorldState {
  /** Current tick */
  currentTick: number;
  /** Characters currently captured/imprisoned */
  capturedCharacters: Set<CharacterId>;
  /** Active investigations (investigator -> target secrets) */
  activeInvestigations: Map<CharacterId, Set<EntityId>>;
  /** Trait lookups for revelation probability */
  getCharacterCunning?: (id: CharacterId) => number;
  /** Recent events that might trigger revelations */
  recentEventIds: EventId[];
}

/**
 * SecretManager handles creation, tracking, and revelation of secrets.
 */
export class SecretManager {
  private readonly config: SecretManagerConfig;
  private readonly secrets: Map<EntityId, Secret> = new Map();
  private readonly clues: Map<EntityId, Clue> = new Map();
  private readonly secretsByType: Map<SecretType, Set<EntityId>> = new Map();
  private readonly secretsByEntity: Map<EntityId, Set<EntityId>> = new Map();
  private readonly secretsByFaction: Map<FactionId, Set<EntityId>> = new Map();
  private readonly secretsByKnower: Map<CharacterId, Set<EntityId>> = new Map();
  private readonly rng: SeededRNG;

  constructor(config?: Partial<SecretManagerConfig>, rng?: SeededRNG) {
    this.config = { ...DEFAULT_SECRET_CONFIG, ...(config ?? {}) };
    this.rng = rng ?? new SeededRNG(0);

    // Initialize type index
    for (const type of Object.values(SecretType)) {
      this.secretsByType.set(type, new Set());
    }
  }

  // ==========================================================================
  // Secret Creation
  // ==========================================================================

  /**
   * Create a new secret.
   */
  createSecret(options: CreateSecretOptions): Secret {
    const id = createSecretId();

    const significance =
      options.significance ?? SECRET_BASE_SIGNIFICANCE[options.type];

    const revelationProbability =
      options.revelationProbability ?? SECRET_BASE_REVELATION_RATE[options.type];

    const secret: Secret = {
      id,
      type: options.type,
      groundTruth: { ...options.groundTruth },
      knownBy: new Set(options.initialKnowers),
      suspectedBy: new Map(),
      revelationProbability,
      age: 0,
      significance,
      createdAt: options.createdAt,
      relatedEntities: options.relatedEntities ?? [],
      relatedFactions: options.relatedFactions ?? [],
      isRevealed: false,
    };

    this.registerSecret(secret);
    return secret;
  }

  /**
   * Register a secret in all indexes.
   */
  private registerSecret(secret: Secret): void {
    this.secrets.set(secret.id, secret);

    // Type index
    const typeSet = this.secretsByType.get(secret.type);
    if (typeSet !== undefined) {
      typeSet.add(secret.id);
    }

    // Entity index
    for (const entityId of secret.relatedEntities) {
      let entitySet = this.secretsByEntity.get(entityId);
      if (entitySet === undefined) {
        entitySet = new Set();
        this.secretsByEntity.set(entityId, entitySet);
      }
      entitySet.add(secret.id);
    }

    // Faction index
    for (const factionId of secret.relatedFactions) {
      let factionSet = this.secretsByFaction.get(factionId);
      if (factionSet === undefined) {
        factionSet = new Set();
        this.secretsByFaction.set(factionId, factionSet);
      }
      factionSet.add(secret.id);
    }

    // Knower index
    for (const knowerId of secret.knownBy) {
      let knowerSet = this.secretsByKnower.get(knowerId);
      if (knowerSet === undefined) {
        knowerSet = new Set();
        this.secretsByKnower.set(knowerId, knowerSet);
      }
      knowerSet.add(secret.id);
    }
  }

  // ==========================================================================
  // Knowledge Management
  // ==========================================================================

  /**
   * Add a character as a knower of a secret.
   */
  addKnower(secretId: EntityId, characterId: CharacterId): boolean {
    const secret = this.secrets.get(secretId);
    if (secret === undefined) return false;

    if (secret.knownBy.has(characterId)) return false;

    secret.knownBy.add(characterId);

    // Update knower index
    let knowerSet = this.secretsByKnower.get(characterId);
    if (knowerSet === undefined) {
      knowerSet = new Set();
      this.secretsByKnower.set(characterId, knowerSet);
    }
    knowerSet.add(secretId);

    // Remove from suspected if they now know
    secret.suspectedBy.delete(characterId);

    return true;
  }

  /**
   * Remove a character's knowledge of a secret (e.g., death, memory wipe).
   */
  removeKnower(secretId: EntityId, characterId: CharacterId): boolean {
    const secret = this.secrets.get(secretId);
    if (secret === undefined) return false;

    if (!secret.knownBy.has(characterId)) return false;

    secret.knownBy.delete(characterId);

    // Update knower index
    const knowerSet = this.secretsByKnower.get(characterId);
    if (knowerSet !== undefined) {
      knowerSet.delete(secretId);
    }

    return true;
  }

  /**
   * Add or update a character's suspicion of a secret.
   */
  addSuspicion(
    secretId: EntityId,
    characterId: CharacterId,
    confidence: number,
  ): boolean {
    const secret = this.secrets.get(secretId);
    if (secret === undefined) return false;

    // Can't suspect what you already know
    if (secret.knownBy.has(characterId)) return false;

    const clampedConfidence = Math.max(0, Math.min(100, confidence));
    const existing = secret.suspectedBy.get(characterId) ?? 0;
    const newConfidence = Math.max(existing, clampedConfidence);

    secret.suspectedBy.set(characterId, newConfidence);

    // If confidence exceeds threshold, convert to knowledge
    if (newConfidence >= this.config.suspicionConfirmationThreshold) {
      this.addKnower(secretId, characterId);
    }

    return true;
  }

  /**
   * Increase a character's suspicion by a delta amount.
   */
  increaseSuspicion(
    secretId: EntityId,
    characterId: CharacterId,
    delta: number,
  ): boolean {
    const secret = this.secrets.get(secretId);
    if (secret === undefined) return false;

    if (secret.knownBy.has(characterId)) return false;

    const current = secret.suspectedBy.get(characterId) ?? 0;
    return this.addSuspicion(secretId, characterId, current + delta);
  }

  // ==========================================================================
  // Clue Management
  // ==========================================================================

  /**
   * Create a clue that can help discover a secret.
   */
  createClue(
    secretId: EntityId,
    description: string,
    weight: number,
    discoveredBy: CharacterId,
    discoveredAt: number,
    sourceEventId?: EventId,
  ): Clue | undefined {
    const secret = this.secrets.get(secretId);
    if (secret === undefined) return undefined;

    const clue: Clue = {
      id: createClueId(),
      secretId,
      description,
      weight: Math.max(0, Math.min(1, weight)),
      discoveredAt,
      discoveredBy,
      ...(sourceEventId !== undefined ? { sourceEventId } : {}),
    };

    this.clues.set(clue.id, clue);
    return clue;
  }

  /**
   * Get all clues for a specific secret.
   */
  getCluesForSecret(secretId: EntityId): readonly Clue[] {
    const result: Clue[] = [];
    for (const clue of this.clues.values()) {
      if (clue.secretId === secretId) {
        result.push(clue);
      }
    }
    return result;
  }

  // ==========================================================================
  // Revelation Mechanics
  // ==========================================================================

  /**
   * Calculate revelation probability for a secret.
   */
  calculateRevelationProbability(
    secret: Secret,
    worldState: SecretWorldState,
  ): number {
    if (secret.isRevealed) return 0;

    let probability = secret.revelationProbability;

    // Age factor: older secrets are harder to keep
    probability += secret.age * this.config.ageRevelationFactor;

    // Knower count factor: more knowers = more leaks
    const knowerCount = secret.knownBy.size;
    if (knowerCount > 1) {
      probability *= 1 + (knowerCount - 1) * this.config.knowerLeakFactor;
    }

    // Captured knower factor: captured conspirators may talk
    let hasCapturedKnower = false;
    for (const knowerId of secret.knownBy) {
      if (worldState.capturedCharacters.has(knowerId)) {
        hasCapturedKnower = true;
        break;
      }
    }
    if (hasCapturedKnower) {
      probability += this.config.captureBetrayal;
    }

    // Active investigation factor
    let isBeingInvestigated = false;
    for (const targetSecrets of worldState.activeInvestigations.values()) {
      if (targetSecrets.has(secret.id)) {
        isBeingInvestigated = true;
        break;
      }
    }
    if (isBeingInvestigated) {
      probability *= 2; // Double chance when actively investigated
    }

    // Low cunning factor: careless conspirators leak more
    if (worldState.getCharacterCunning !== undefined) {
      let minCunning = 100;
      for (const knowerId of secret.knownBy) {
        const cunning = worldState.getCharacterCunning(knowerId);
        minCunning = Math.min(minCunning, cunning);
      }
      // Low cunning increases leak probability
      const cunningFactor = 1 + (100 - minCunning) / 200;
      probability *= cunningFactor;
    }

    return Math.min(1, probability);
  }

  /**
   * Check if a secret should be revealed this tick.
   */
  checkRevelation(
    secret: Secret,
    worldState: SecretWorldState,
  ): RevelationCheckResult {
    if (secret.isRevealed) {
      return {
        shouldReveal: false,
        probability: 0,
        method: RevelationMethod.NaturalLeak,
      };
    }

    const probability = this.calculateRevelationProbability(secret, worldState);

    // Determine revelation method based on circumstances
    let method = RevelationMethod.NaturalLeak;
    let trigger: string | undefined;

    // Check for captured knower (betrayal)
    for (const knowerId of secret.knownBy) {
      if (worldState.capturedCharacters.has(knowerId)) {
        method = RevelationMethod.Betrayal;
        trigger = `Captured character ${knowerId} revealed the secret`;
        break;
      }
    }

    // Check for active investigation
    if (method === RevelationMethod.NaturalLeak) {
      for (const [investigatorId, targetSecrets] of worldState.activeInvestigations) {
        if (targetSecrets.has(secret.id)) {
          method = RevelationMethod.Investigation;
          trigger = `Investigation by ${investigatorId} uncovered the secret`;
          break;
        }
      }
    }

    // Roll for revelation
    const roll = this.rng.next();
    const shouldReveal = roll < probability;

    return {
      shouldReveal,
      probability,
      method,
      ...(trigger !== undefined ? { trigger } : {}),
    };
  }

  /**
   * Reveal a secret and emit the revelation event.
   */
  revealSecret(
    secretId: EntityId,
    method: RevelationMethod,
    revealerId: CharacterId | undefined,
    learnedBy: CharacterId[],
    currentTick: number,
    eventBus: EventBus,
  ): SecretRevelationEvent | undefined {
    const secret = this.secrets.get(secretId);
    if (secret === undefined) return undefined;
    if (secret.isRevealed) return undefined;

    // Mark as revealed
    secret.isRevealed = true;
    secret.revealedAt = currentTick;
    secret.revealedBy = method;
    if (revealerId !== undefined) {
      secret.revealerId = revealerId;
    }

    // Add new knowers
    for (const learnerId of learnedBy) {
      this.addKnower(secretId, learnerId);
    }

    // Create revelation event data
    const revelationEvent: SecretRevelationEvent = {
      secretId,
      secretType: secret.type,
      method,
      ...(revealerId !== undefined ? { revealerId } : {}),
      learnedBy,
      significance: secret.significance,
      truthRevealed: { ...secret.groundTruth },
    };

    // Emit high-significance event
    eventBus.emit(
      createEvent({
        category: EventCategory.Political, // Most secrets are political
        subtype: 'secret.revealed',
        timestamp: currentTick,
        participants: [secretId, ...secret.relatedEntities],
        significance: secret.significance,
        data: {
          secretType: secret.type,
          method,
          revealerId,
          learnedByCount: learnedBy.length,
          truthRevealed: secret.groundTruth,
        },
      }),
    );

    // Emit type-specific events for cascade
    this.emitTypeSpecificEvent(secret, method, currentTick, eventBus);

    return revelationEvent;
  }

  /**
   * Emit type-specific events based on what kind of secret was revealed.
   */
  private emitTypeSpecificEvent(
    secret: Secret,
    method: RevelationMethod,
    currentTick: number,
    eventBus: EventBus,
  ): void {
    switch (secret.type) {
      case SecretType.ConspiracyPlot:
        eventBus.emit(
          createEvent({
            category: EventCategory.Political,
            subtype: 'secret.conspiracy_exposed',
            timestamp: currentTick,
            participants: [...secret.relatedEntities],
            significance: secret.significance + 10,
            data: {
              plotDetails: secret.groundTruth,
              method,
            },
          }),
        );
        break;

      case SecretType.SecretAlliance:
        eventBus.emit(
          createEvent({
            category: EventCategory.Political,
            subtype: 'secret.alliance_exposed',
            timestamp: currentTick,
            participants: [...secret.relatedEntities],
            significance: secret.significance,
            data: {
              allianceDetails: secret.groundTruth,
            },
          }),
        );
        break;

      case SecretType.DisguisedIdentity:
        eventBus.emit(
          createEvent({
            category: EventCategory.Personal,
            subtype: 'secret.identity_revealed',
            timestamp: currentTick,
            participants: [...secret.relatedEntities],
            significance: secret.significance,
            data: {
              trueIdentity: secret.groundTruth['trueIdentity'],
              falseIdentity: secret.groundTruth['falseIdentity'],
            },
          }),
        );
        break;

      case SecretType.MilitaryStrength:
        eventBus.emit(
          createEvent({
            category: EventCategory.Military,
            subtype: 'secret.military_intel_leaked',
            timestamp: currentTick,
            participants: [...secret.relatedEntities],
            significance: secret.significance,
            data: {
              actualStrength: secret.groundTruth['actualStrength'],
              perceivedStrength: secret.groundTruth['perceivedStrength'],
            },
          }),
        );
        break;

      case SecretType.EntityWeakness:
        eventBus.emit(
          createEvent({
            category: EventCategory.Military,
            subtype: 'secret.weakness_discovered',
            timestamp: currentTick,
            participants: [...secret.relatedEntities],
            significance: secret.significance + 5,
            data: {
              weakness: secret.groundTruth['weakness'],
              entity: secret.groundTruth['entity'],
            },
          }),
        );
        break;

      case SecretType.Prophecy:
        eventBus.emit(
          createEvent({
            category: EventCategory.Religious,
            subtype: 'secret.prophecy_revealed',
            timestamp: currentTick,
            participants: [...secret.relatedEntities],
            significance: secret.significance + 15,
            data: {
              prophecyContent: secret.groundTruth['prophecy'],
            },
          }),
        );
        break;

      case SecretType.ForbiddenKnowledge:
        eventBus.emit(
          createEvent({
            category: EventCategory.Magical,
            subtype: 'secret.forbidden_knowledge_spread',
            timestamp: currentTick,
            participants: [...secret.relatedEntities],
            significance: secret.significance + 10,
            data: {
              knowledge: secret.groundTruth,
            },
          }),
        );
        break;

      case SecretType.HiddenArtifactLocation:
        eventBus.emit(
          createEvent({
            category: EventCategory.Exploratory,
            subtype: 'secret.artifact_location_revealed',
            timestamp: currentTick,
            participants: [...secret.relatedEntities],
            significance: secret.significance,
            data: {
              artifactId: secret.groundTruth['artifactId'],
              location: secret.groundTruth['location'],
            },
          }),
        );
        break;
    }
  }

  // ==========================================================================
  // Tick Processing
  // ==========================================================================

  /**
   * Process all secrets for a tick (daily revelation checks).
   */
  processTick(worldState: SecretWorldState, eventBus: EventBus): EntityId[] {
    const revealedSecrets: EntityId[] = [];

    for (const secret of this.secrets.values()) {
      if (secret.isRevealed) continue;

      // Age the secret
      secret.age++;

      // Check for revelation
      const result = this.checkRevelation(secret, worldState);
      if (result.shouldReveal) {
        // Determine who learns about it
        const learnedBy: CharacterId[] = [];
        // All characters with high suspicion learn
        for (const [charId, confidence] of secret.suspectedBy) {
          if (confidence >= 50) {
            learnedBy.push(charId);
          }
        }

        this.revealSecret(
          secret.id,
          result.method,
          undefined,
          learnedBy,
          worldState.currentTick,
          eventBus,
        );
        revealedSecrets.push(secret.id);
      }
    }

    return revealedSecrets;
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  getSecret(id: EntityId): Secret | undefined {
    return this.secrets.get(id);
  }

  getAllSecrets(): readonly Secret[] {
    return Array.from(this.secrets.values());
  }

  getActiveSecrets(): readonly Secret[] {
    return Array.from(this.secrets.values()).filter((s) => !s.isRevealed);
  }

  getRevealedSecrets(): readonly Secret[] {
    return Array.from(this.secrets.values()).filter((s) => s.isRevealed);
  }

  getSecretsByType(type: SecretType): readonly Secret[] {
    const ids = this.secretsByType.get(type);
    if (ids === undefined) return [];
    return Array.from(ids)
      .map((id) => this.secrets.get(id))
      .filter((s): s is Secret => s !== undefined);
  }

  getSecretsKnownBy(characterId: CharacterId): readonly Secret[] {
    const ids = this.secretsByKnower.get(characterId);
    if (ids === undefined) return [];
    return Array.from(ids)
      .map((id) => this.secrets.get(id))
      .filter((s): s is Secret => s !== undefined);
  }

  getSecretsSuspectedBy(characterId: CharacterId): readonly Secret[] {
    const result: Secret[] = [];
    for (const secret of this.secrets.values()) {
      if (secret.suspectedBy.has(characterId)) {
        result.push(secret);
      }
    }
    return result;
  }

  getSecretsAboutEntity(entityId: EntityId): readonly Secret[] {
    const ids = this.secretsByEntity.get(entityId);
    if (ids === undefined) return [];
    return Array.from(ids)
      .map((id) => this.secrets.get(id))
      .filter((s): s is Secret => s !== undefined);
  }

  getSecretsAboutFaction(factionId: FactionId): readonly Secret[] {
    const ids = this.secretsByFaction.get(factionId);
    if (ids === undefined) return [];
    return Array.from(ids)
      .map((id) => this.secrets.get(id))
      .filter((s): s is Secret => s !== undefined);
  }

  /**
   * Check if a character knows a specific secret.
   */
  doesCharacterKnow(characterId: CharacterId, secretId: EntityId): boolean {
    const secret = this.secrets.get(secretId);
    return secret !== undefined && secret.knownBy.has(characterId);
  }

  /**
   * Get a character's suspicion level for a secret.
   */
  getSuspicionLevel(characterId: CharacterId, secretId: EntityId): number {
    const secret = this.secrets.get(secretId);
    if (secret === undefined) return 0;
    if (secret.knownBy.has(characterId)) return 100; // Knows it fully
    return secret.suspectedBy.get(characterId) ?? 0;
  }
}
