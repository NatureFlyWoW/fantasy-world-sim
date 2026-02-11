/**
 * @fws/core — Simulation Engine Factory
 *
 * Centralized engine creation with all systems properly initialized and registered.
 * Includes:
 * - All 10 main simulation systems with forked RNGs
 * - DreamingSystem with CharacterMemoryStore per character
 * - 30-tick warmup to populate initial events
 *
 * Used by both CLI and Electron to eliminate ~135 lines of duplication.
 */

import { World } from '../ecs/world.js';
import { WorldClock } from '../time/world-clock.js';
import { EventBus } from '../events/event-bus.js';
import { EventLog } from '../events/event-log.js';
import { CascadeEngine } from '../events/cascade-engine.js';
import { SimulationEngine } from './simulation-engine.js';
import { SystemRegistry } from './system-registry.js';
import { CharacterAISystem } from '../systems/character-ai.js';
import { ReputationSystem } from '../systems/reputation-system.js';
import { GrudgeSystem } from '../systems/grudge-system.js';
import { FactionPoliticalSystem } from '../systems/faction-system.js';
import { EconomicSystem } from '../systems/economics.js';
import { WarfareSystem } from '../systems/warfare.js';
import { MagicSystem } from '../systems/magic.js';
import { ReligionSystem } from '../systems/religion.js';
import { CulturalEvolutionSystem } from '../systems/culture.js';
import { EcologySystem } from '../systems/ecology.js';
import { OralTraditionSystem } from '../systems/oral-tradition.js';
import { DreamingSystem } from '../systems/dreaming.js';
import { PopulationSystem } from '../systems/population-system.js';
import { CharacterMemoryStore } from '../systems/memory-store.js';
import { SeededRNG } from '../utils/seeded-rng.js';
import type { CharacterId, SiteId } from '../ecs/types.js';

/**
 * Character data needed for DreamingSystem initialization.
 */
export interface CharacterInitData {
  id: CharacterId;
  goalCount: number;
  locationSiteId?: SiteId;
}

/**
 * Result of engine creation.
 */
export interface EngineCreationResult {
  engine: SimulationEngine;
  dreamingSystem: DreamingSystem;
  reputationSystem: ReputationSystem;
  grudgeSystem: GrudgeSystem;
}

/**
 * Create a fully initialized SimulationEngine with all systems registered.
 *
 * @param world - ECS world (must be populated with entities)
 * @param clock - World clock
 * @param eventBus - Event bus for inter-system communication
 * @param eventLog - Event log for recording events
 * @param seed - Seed for RNG (used to fork system-specific RNGs)
 * @param characters - Optional character data for DreamingSystem initialization
 * @param warmupTicks - Number of warmup ticks to run (default: 30)
 * @returns Engine and system references
 */
export function createSimulationEngine(
  world: World,
  clock: WorldClock,
  eventBus: EventBus,
  eventLog: EventLog,
  seed: number,
  characters?: CharacterInitData[],
  warmupTicks = 30
): EngineCreationResult {
  const rng = new SeededRNG(seed);
  const cascadeRng = rng.fork('cascade');
  const cascadeEngine = new CascadeEngine(eventBus, eventLog, {
    maxCascadeDepth: 10,
    randomFn: () => cascadeRng.next(),
  });
  const systemRegistry = new SystemRegistry();

  // Support classes
  const reputationSystem = new ReputationSystem(undefined, rng.fork('reputation'));
  const grudgeSystem = new GrudgeSystem();

  // DreamingSystem
  const dreamingSystem = new DreamingSystem(undefined, seed);

  // Register the 10 main simulation systems with forked RNGs
  systemRegistry.register(new CharacterAISystem(rng.fork('character')));
  systemRegistry.register(new FactionPoliticalSystem(reputationSystem, grudgeSystem, rng.fork('faction')));
  systemRegistry.register(new EconomicSystem());
  systemRegistry.register(new PopulationSystem(rng.fork('population')));
  systemRegistry.register(new WarfareSystem(rng.fork('warfare')));
  systemRegistry.register(new MagicSystem(rng.fork('magic')));
  systemRegistry.register(new ReligionSystem(rng.fork('religion')));
  systemRegistry.register(new CulturalEvolutionSystem(rng.fork('culture')));
  systemRegistry.register(new EcologySystem(undefined, rng.fork('ecology')));
  systemRegistry.register(new OralTraditionSystem(undefined, rng.fork('oral')));
  systemRegistry.register(dreamingSystem);

  const engine = new SimulationEngine(
    world,
    clock,
    eventBus,
    eventLog,
    systemRegistry,
    cascadeEngine,
    seed
  );

  // Initialize DreamingSystem with character data
  if (characters !== undefined) {
    for (const char of characters) {
      const store = new CharacterMemoryStore();
      dreamingSystem.registerMemoryStore(char.id, store);
      dreamingSystem.registerGoalCount(char.id, char.goalCount);

      if (char.locationSiteId !== undefined) {
        dreamingSystem.registerCharacterLocation(char.id, char.locationSiteId);
      }
    }
  }

  // Run warmup ticks to populate initial events
  if (warmupTicks > 0) {
    engine.run(warmupTicks);
  }

  return { engine, dreamingSystem, reputationSystem, grudgeSystem };
}
