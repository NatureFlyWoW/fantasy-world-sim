// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * Inspector Dispatcher — main entry point for entity inspection.
 * Routes queries to the appropriate sub-inspector based on entity type.
 */

import { World, WorldClock, EventLog } from '@fws/core';
import type { InspectorQuery, InspectorResponse } from '../../shared/types.js';
import { inspectCharacter } from './character-inspector.js';
import { inspectFaction } from './faction-inspector.js';
import { inspectSite } from './site-inspector.js';
import { inspectArtifact } from './artifact-inspector.js';
import { inspectEvent } from './event-inspector.js';
import { inspectRegion } from './region-inspector.js';

/**
 * Inspect an entity and return structured data for the renderer inspector panel.
 */
export function inspectEntity(
  query: InspectorQuery,
  world: World,
  eventLog: EventLog,
  clock: WorldClock,
): InspectorResponse {
  // Type-safe dispatcher map
  const inspectors: Record<
    string,
    (id: number, world: World, eventLog: EventLog, clock: WorldClock) => InspectorResponse
  > = {
    character: inspectCharacter,
    faction: inspectFaction,
    site: inspectSite,
    artifact: inspectArtifact,
    event: inspectEvent,
    region: inspectRegion,
  };

  const inspector = inspectors[query.type];
  if (inspector !== undefined) {
    return inspector(query.id, world, eventLog, clock);
  }

  // Fallback for unknown types
  return {
    entityType: query.type,
    entityName: `Unknown #${query.id}`,
    summary: '',
    sections: [],
    prose: [],
    relatedEntities: [],
  };
}
