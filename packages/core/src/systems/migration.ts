/**
 * Migration scoring and execution module for Phase 13 Living Population.
 *
 * Scores potential migration targets for displaced or dissatisfied populations,
 * then executes the actual entity transfer between settlements.
 */

import { EventCategory } from '../events/types.js';
import { createEvent } from '../events/event-factory.js';
import type { World } from '../ecs/world.js';
import type { WorldClock } from '../time/world-clock.js';
import type { EventBus } from '../events/event-bus.js';
import type { EntityId, SiteId } from '../ecs/types.js';
import type {
  PositionComponent,
  PopulationComponent,
  PopulationDemographicsComponent,
  EconomyComponent,
  StatusComponent,
  OwnershipComponent,
} from '../ecs/component.js';

export interface MigrationScore {
  targetSiteId: number;
  score: number;
  reason: string;
}

/**
 * Score all candidate migration targets for a group of migrants from a source settlement.
 *
 * Scoring factors:
 * - Distance penalty: closer settlements score higher
 * - Safety bonus: settlements not at war or under siege
 * - Prosperity bonus: wealthier settlements attract migrants
 * - Cultural affinity: same race or faction boosts desirability
 *
 * Returns scores sorted descending (best target first).
 */
export function scoreMigrationTargets(
  sourceSiteId: number,
  world: World,
  pushFactor: number,
  migrantRace: string,
  migrantFaction: number,
): MigrationScore[] {
  const settlements = world.query('Population');
  const sourcePos = world.getComponent<PositionComponent>(sourceSiteId as EntityId, 'Position');
  if (sourcePos === undefined) {
    return [];
  }

  const scores: MigrationScore[] = [];

  for (const siteId of settlements) {
    if ((siteId as number) === sourceSiteId) {
      continue;
    }

    const targetPos = world.getComponent<PositionComponent>(siteId, 'Position');
    if (targetPos === undefined) {
      continue;
    }

    const reasons: string[] = [];
    let score = 0;

    // Distance penalty: closer is better
    const distance = Math.abs(targetPos.x - sourcePos.x) + Math.abs(targetPos.y - sourcePos.y);
    const distanceScore = 100 / (1 + distance);
    score += distanceScore;
    reasons.push(`distance=${distance}`);

    // Safety bonus: no war or siege conditions
    const status = world.getComponent<StatusComponent>(siteId, 'Status');
    if (status !== undefined) {
      const hasConflict = status.conditions.some(
        (c) => c.toLowerCase().includes('war') || c.toLowerCase().includes('siege'),
      );
      if (!hasConflict) {
        score += 20;
        reasons.push('safe');
      } else {
        reasons.push('conflict');
      }
    } else {
      // No status component means no known conflict
      score += 20;
      reasons.push('safe');
    }

    // Prosperity bonus: based on wealth
    const economy = world.getComponent<EconomyComponent>(siteId, 'Economy');
    if (economy !== undefined) {
      const prosperityBonus = Math.min(30, economy.wealth * 0.3);
      score += prosperityBonus;
      reasons.push(`wealth=${economy.wealth}`);
    }

    // Cultural affinity: same race or faction
    const demographics = world.getComponent<PopulationDemographicsComponent>(
      siteId,
      'PopulationDemographics',
    );
    if (demographics !== undefined) {
      // Find dominant race (highest count in raceDistribution)
      let dominantRace = '';
      let maxCount = 0;
      for (const [race, count] of demographics.raceDistribution) {
        if (count > maxCount) {
          maxCount = count;
          dominantRace = race;
        }
      }
      if (dominantRace === migrantRace) {
        score += 20;
        reasons.push('same-race');
      }
    }

    const ownership = world.getComponent<OwnershipComponent>(siteId, 'Ownership');
    if (ownership !== undefined && ownership.ownerId === migrantFaction) {
      score += 10;
      reasons.push('same-faction');
    }

    // Apply push factor multiplier
    score *= pushFactor;

    scores.push({
      targetSiteId: siteId as number,
      score,
      reason: reasons.join(', '),
    });
  }

  // Sort descending by score
  scores.sort((a, b) => b.score - a.score);

  return scores;
}

/**
 * Execute migration of entities from one settlement to another.
 *
 * Transfers entity IDs between Population.nonNotableIds arrays,
 * updates Position components to the target site's coordinates,
 * adjusts population counts, and emits a migration event.
 */
export function executeMigration(
  world: World,
  entityIds: number[],
  sourceSiteId: number,
  targetSiteId: number,
  clock: WorldClock,
  events: EventBus,
): void {
  if (entityIds.length === 0) {
    return;
  }

  const sourcePop = world.getComponent<PopulationComponent>(
    sourceSiteId as EntityId,
    'Population',
  );
  const targetPop = world.getComponent<PopulationComponent>(
    targetSiteId as EntityId,
    'Population',
  );
  const targetPos = world.getComponent<PositionComponent>(
    targetSiteId as EntityId,
    'Position',
  );

  if (sourcePop === undefined || targetPop === undefined || targetPos === undefined) {
    return;
  }

  const migratingSet = new Set(entityIds);

  // Remove migrating entities from source
  sourcePop.nonNotableIds = sourcePop.nonNotableIds.filter((id) => !migratingSet.has(id));
  sourcePop.count -= entityIds.length;
  if (sourcePop.count < 0) {
    sourcePop.count = 0;
  }

  // Add migrating entities to target
  for (const eid of entityIds) {
    targetPop.nonNotableIds.push(eid);
  }
  targetPop.count += entityIds.length;

  // Update Position components for each migrating entity
  for (const eid of entityIds) {
    const pos = world.getComponent<PositionComponent>(eid as EntityId, 'Position');
    if (pos !== undefined) {
      pos.x = targetPos.x;
      pos.y = targetPos.y;
    }
  }

  // Emit migration event
  const migrationEvent = createEvent({
    category: EventCategory.Personal,
    subtype: 'population.migration',
    timestamp: clock.currentTick,
    participants: [sourceSiteId as EntityId, targetSiteId as EntityId],
    significance: Math.min(60, 20 + entityIds.length * 2),
    location: targetSiteId as unknown as SiteId,
    data: {
      sourceSiteId,
      targetSiteId,
      migrantCount: entityIds.length,
      migrantIds: [...entityIds],
    },
  });

  events.emit(migrationEvent);
}
