// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * Character Inspector — extracts structured data for character entities.
 */

import { World, WorldClock, EventLog } from '@fws/core';
import type { EntityId, EventId } from '@fws/core';
import type { InspectorResponse } from '../../shared/types.js';
import {
  EntityRefCollector,
  resolveName,
  entityMarker,
  detectEntityType,
  tickToYear,
  getHealthState,
  getPersonalityDescriptor,
  renderBar,
  eventDescription,
  HEALTH_PROSE,
} from './shared.js';

export function inspectCharacter(
  id: number,
  world: World,
  eventLog: EventLog,
  clock: WorldClock,
): InspectorResponse {
  const eid = id as unknown as EntityId;
  const refs = new EntityRefCollector();

  // Resolve name
  const name = resolveName(id, world);

  // ── Section 1: The Story So Far ─────────────────────────────────────
  const storyLines: string[] = [];
  const health = world.hasStore('Health')
    ? world.getComponent(eid, 'Health') as { current?: number; maximum?: number } | undefined
    : undefined;
  if (health !== undefined) {
    const current = health.current ?? 100;
    const maximum = health.maximum ?? 100;
    const state = getHealthState(current, maximum);
    const prose = HEALTH_PROSE[state];
    if (prose !== undefined) {
      storyLines.push(`${name} ${prose}.`);
      storyLines.push('');
    }
  }

  const events = eventLog.getByEntity(eid);
  if (events.length === 0) {
    storyLines.push(`The story of ${name} has yet to be written.`);
  } else {
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    const significant = sorted.filter(e => e.significance >= 50);
    const keyEvents = significant.length > 0 ? significant : sorted.slice(0, 3);

    if (keyEvents.length > 0) {
      const firstEvent = keyEvents[0];
      const lastEvent = keyEvents[keyEvents.length - 1];
      if (firstEvent !== undefined && lastEvent !== undefined) {
        const firstYear = tickToYear(firstEvent.timestamp);
        const lastYear = tickToYear(lastEvent.timestamp);
        if (firstYear === lastYear) {
          storyLines.push(`In Year ${firstYear}, events shaped the course of ${name}'s life.`);
        } else {
          storyLines.push(`From Year ${firstYear} to Year ${lastYear}, a chain of events shaped ${name}'s fate.`);
        }
        storyLines.push('');
      }
    }

    storyLines.push('Key moments:');
    const toShow = keyEvents.slice(0, 5);
    for (const event of toShow) {
      const year = tickToYear(event.timestamp);
      storyLines.push(`  Y${year} -- ${eventDescription(event)}`);
    }
    if (events.length > toShow.length) {
      storyLines.push('');
      storyLines.push(`(${events.length} events total)`);
    }
  }

  // ── Section 2: Strengths & Flaws ────────────────────────────────────
  const strengthLines: string[] = [];

  const personality = world.hasStore('Personality')
    ? world.getComponent(eid, 'Personality') as {
        openness?: number; conscientiousness?: number; extraversion?: number;
        agreeableness?: number; neuroticism?: number;
      } | undefined
    : undefined;

  if (personality !== undefined) {
    const descriptors: string[] = [];
    for (const [axis, value] of Object.entries(personality) as Array<[string, number | undefined]>) {
      if (value === undefined) continue;
      const desc = getPersonalityDescriptor(axis, value);
      if (desc !== null) descriptors.push(desc);
    }
    if (descriptors.length > 0) {
      strengthLines.push(`This individual is ${descriptors.join(', and ')}.`);
      strengthLines.push('');
    } else {
      strengthLines.push('A moderate temperament with no extreme tendencies.');
      strengthLines.push('');
    }
  }

  const attr = world.hasStore('Attribute')
    ? world.getComponent(eid, 'Attribute') as {
        strength?: number; agility?: number; endurance?: number;
        intelligence?: number; wisdom?: number; charisma?: number;
      } | undefined
    : undefined;

  if (attr !== undefined) {
    strengthLines.push('Attributes:');
    const attributes: Array<[string, number | undefined]> = [
      ['STR', attr.strength], ['AGI', attr.agility], ['END', attr.endurance],
      ['INT', attr.intelligence], ['WIS', attr.wisdom], ['CHA', attr.charisma],
    ];
    for (const [label, value] of attributes) {
      const v = value ?? 10;
      strengthLines.push(`  ${label}: ${renderBar(v, 20)} ${v}`);
    }
    strengthLines.push('');
  }

  const traits = world.hasStore('Traits')
    ? world.getComponent(eid, 'Traits') as { traits?: string[]; intensities?: Map<string, number> } | undefined
    : undefined;
  if (traits?.traits !== undefined && traits.traits.length > 0) {
    strengthLines.push(`Traits: ${traits.traits.join('  |  ')}`);
  }

  if (strengthLines.length === 0) {
    strengthLines.push('No personality data available.');
  }

  // ── Section 3: Bonds & Rivalries ────────────────────────────────────
  const bondsLines: string[] = [];

  const membership = world.hasStore('Membership')
    ? world.getComponent(eid, 'Membership') as { factionId?: number | null; rank?: string } | undefined
    : undefined;

  if (membership?.factionId !== undefined && membership.factionId !== null) {
    const fMarker = entityMarker(membership.factionId, 'faction', world, refs);
    const rankStr = membership.rank !== undefined ? ` (${membership.rank})` : '';
    bondsLines.push('ALLEGIANCE:');
    bondsLines.push(`  ${fMarker}${rankStr}`);
    bondsLines.push('');
  }

  const relationships = world.hasStore('Relationship')
    ? world.getComponent(eid, 'Relationship') as {
        relationships?: Map<number, string>; affinity?: Map<number, number>;
      } | undefined
    : undefined;

  if (relationships?.relationships !== undefined && relationships.relationships.size > 0) {
    const affMap = relationships.affinity ?? new Map<number, number>();
    const allies: Array<[number, string, number]> = [];
    const rivals: Array<[number, string, number]> = [];

    for (const [targetId, relType] of relationships.relationships) {
      const affinity = affMap.get(targetId) ?? 0;
      if (affinity >= 0) {
        allies.push([targetId, relType, affinity]);
      } else {
        rivals.push([targetId, relType, affinity]);
      }
    }
    allies.sort((a, b) => b[2] - a[2]);
    rivals.sort((a, b) => a[2] - b[2]);

    if (allies.length > 0) {
      bondsLines.push('ALLIES:');
      for (const [targetId, relType, affinity] of allies.slice(0, 5)) {
        const marker = entityMarker(targetId, detectEntityType(targetId, world), world, refs);
        bondsLines.push(`  ${marker} -- ${relType} [+${affinity}]`);
      }
      if (allies.length > 5) bondsLines.push(`  ... and ${allies.length - 5} more allies`);
      bondsLines.push('');
    }

    if (rivals.length > 0) {
      bondsLines.push('RIVALS:');
      for (const [targetId, relType, affinity] of rivals.slice(0, 5)) {
        const marker = entityMarker(targetId, detectEntityType(targetId, world), world, refs);
        bondsLines.push(`  ${marker} -- ${relType} [${affinity}]`);
      }
      if (rivals.length > 5) bondsLines.push(`  ... and ${rivals.length - 5} more rivals`);
      bondsLines.push('');
    }
  }

  const grudges = world.hasStore('Grudges')
    ? world.getComponent(eid, 'Grudges') as {
        grudges?: Map<number, string>; severity?: Map<number, number>;
      } | undefined
    : undefined;

  if (grudges?.grudges !== undefined && grudges.grudges.size > 0) {
    bondsLines.push(`${grudges.grudges.size} grudge${grudges.grudges.size > 1 ? 's' : ''} burn in memory:`);
    for (const [targetId, reason] of grudges.grudges) {
      const severity = grudges.severity?.get(targetId) ?? 50;
      const marker = entityMarker(targetId, detectEntityType(targetId, world), world, refs);
      bondsLines.push(`  ${marker}: ${reason} (severity: ${severity})`);
    }
  }

  if (bondsLines.length === 0) {
    bondsLines.push('No known relationships or rivalries.');
  }

  // ── Section 4: Worldly Standing ─────────────────────────────────────
  const standingLines: string[] = [];

  const status = world.hasStore('Status')
    ? world.getComponent(eid, 'Status') as { titles?: string[]; socialClass?: string; conditions?: string[] } | undefined
    : undefined;

  const parts: string[] = [];
  if (membership?.rank !== undefined && membership.factionId !== undefined && membership.factionId !== null) {
    const fMarker = entityMarker(membership.factionId, 'faction', world, refs);
    parts.push(`holds the rank of ${membership.rank} within the ${fMarker}`);
  }
  if (status?.socialClass !== undefined) {
    parts.push(`of the ${status.socialClass} class`);
  }
  if (parts.length > 0) {
    standingLines.push(`${name} ${parts.join(', ')}.`);
    standingLines.push('');
  }

  const wealth = world.hasStore('Wealth')
    ? world.getComponent(eid, 'Wealth') as { coins?: number; propertyValue?: number; debts?: number } | undefined
    : undefined;
  if (wealth !== undefined) {
    if (wealth.coins !== undefined) standingLines.push(`Wealth: ${wealth.coins.toLocaleString()} gold`);
    if (wealth.propertyValue !== undefined) standingLines.push(`Property: ${wealth.propertyValue.toLocaleString()}`);
    if (wealth.debts !== undefined && wealth.debts > 0) standingLines.push(`Debts: ${wealth.debts.toLocaleString()}`);
  }

  if (status?.titles !== undefined && status.titles.length > 1) {
    standingLines.push('');
    standingLines.push('Titles:');
    for (const title of status.titles.slice(1)) {
      standingLines.push(`  * ${title}`);
    }
  }

  if (status?.conditions !== undefined && status.conditions.length > 0) {
    standingLines.push('');
    standingLines.push(`Conditions: ${status.conditions.join(', ')}`);
  }

  if (standingLines.length === 0) {
    standingLines.push('No worldly standing recorded.');
  }

  // ── Section 5: Heart & Mind ─────────────────────────────────────────
  const heartLines: string[] = [];

  const goals = world.hasStore('Goal')
    ? world.getComponent(eid, 'Goal') as { objectives?: string[]; priorities?: Map<string, number> } | undefined
    : undefined;

  if (goals?.objectives !== undefined && goals.objectives.length > 0) {
    const sorted = [...goals.objectives].sort((a, b) => {
      const pa = goals.priorities?.get(a) ?? 50;
      const pb = goals.priorities?.get(b) ?? 50;
      return pb - pa;
    });
    const count = sorted.length;
    heartLines.push(`${count} ambition${count > 1 ? 's' : ''} drive${count === 1 ? 's' : ''} this soul forward:`);
    heartLines.push('');
    for (const objective of sorted) {
      const priority = goals.priorities?.get(objective) ?? 50;
      const urgency = priority >= 80 ? '!!!' : priority >= 50 ? '!!' : '!';
      heartLines.push(`${urgency} ${objective}  (priority: ${priority})`);
    }
  } else {
    heartLines.push('No active goals or ambitions recorded.');
  }

  // ── Section 6: Remembered Things ────────────────────────────────────
  const memoryLines: string[] = [];

  const memory = world.hasStore('Memory')
    ? world.getComponent(eid, 'Memory') as {
        memories?: Array<{ eventId: number; importance: number; distortion: number }>; capacity?: number;
      } | undefined
    : undefined;

  if (memory?.memories !== undefined && memory.memories.length > 0) {
    const total = memory.memories.length;
    const distortedCount = memory.memories.filter(m => m.distortion > 50).length;
    const fadedCount = memory.memories.filter(m => m.importance < 20).length;

    memoryLines.push(`Carries ${total} memories${distortedCount > 0 ? `, ${distortedCount} distorted with time` : ''}.`);
    memoryLines.push('');

    const sorted = [...memory.memories].sort((a, b) => b.importance - a.importance);
    const toShow = sorted.slice(0, 5);

    memoryLines.push('Strongest memories:');
    for (const mem of toShow) {
      const distortionLabel = mem.distortion > 50 ? ' (distorted)' : '';
      const event = eventLog.getById(mem.eventId as unknown as EventId);
      if (event !== undefined) {
        memoryLines.push(`  ${eventDescription(event)} [imp: ${mem.importance}]${distortionLabel}`);
      } else {
        memoryLines.push(`  Event #${mem.eventId} [imp: ${mem.importance}]${distortionLabel}`);
      }
    }

    if (fadedCount > 0) {
      memoryLines.push('');
      memoryLines.push(`${fadedCount} memories have faded beyond recognition.`);
    }
    if (sorted.length > 5) {
      memoryLines.push(`... and ${sorted.length - 5} more memories`);
    }
  } else {
    memoryLines.push('No memories recorded.');
  }

  // ── Section 7: Possessions & Treasures ──────────────────────────────
  const possessionLines: string[] = [];

  const possessions = world.hasStore('Possession')
    ? world.getComponent(eid, 'Possession') as { itemIds?: number[]; equippedIds?: number[] } | undefined
    : undefined;

  if (wealth !== undefined) {
    const wParts: string[] = [];
    if (wealth.coins !== undefined) wParts.push(`${wealth.coins.toLocaleString()} gold in coin`);
    if (wealth.propertyValue !== undefined) wParts.push(`property valued at ${wealth.propertyValue.toLocaleString()}`);
    if (wParts.length > 0) possessionLines.push(`Wealth: ${wParts.join(', ')}.`);
    if (wealth.debts !== undefined && wealth.debts > 0) {
      possessionLines.push(`Outstanding debts of ${wealth.debts.toLocaleString()}.`);
    }
    possessionLines.push('');
  }

  if (possessions?.itemIds !== undefined && possessions.itemIds.length > 0) {
    const equipped = new Set(possessions.equippedIds ?? []);
    const totalItems = possessions.itemIds.length;
    possessionLines.push(`Carries ${totalItems} item${totalItems > 1 ? 's' : ''}:`);
    for (const itemId of possessions.itemIds.slice(0, 10)) {
      const equippedLabel = equipped.has(itemId) ? ' [E]' : '';
      const marker = entityMarker(itemId, 'artifact', world, refs);
      possessionLines.push(`  * ${marker}${equippedLabel}`);
    }
    if (possessions.itemIds.length > 10) {
      possessionLines.push(`  ... and ${possessions.itemIds.length - 10} more items`);
    }
  } else if (wealth === undefined) {
    possessionLines.push('No possessions of note.');
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const summaryParts: string[] = [];
  if (membership?.rank !== undefined) summaryParts.push(membership.rank);
  summaryParts.push(`Year ${tickToYear(clock.currentTick)}`);
  if (membership?.factionId !== undefined && membership.factionId !== null) {
    summaryParts.push(resolveName(membership.factionId, world));
  }

  // ── Prose lines ─────────────────────────────────────────────────────
  const proseLines: string[] = [];
  if (health !== undefined) {
    const state = getHealthState(health.current ?? 100, health.maximum ?? 100);
    const prose = HEALTH_PROSE[state];
    if (prose !== undefined) proseLines.push(`${name} ${prose}.`);
  }
  if (personality !== undefined) {
    const descriptors: string[] = [];
    for (const [axis, value] of Object.entries(personality) as Array<[string, number | undefined]>) {
      if (value === undefined) continue;
      const desc = getPersonalityDescriptor(axis, value);
      if (desc !== null) descriptors.push(desc);
    }
    if (descriptors.length > 0) proseLines.push(`This individual is ${descriptors.join(', and ')}.`);
  }

  return {
    entityType: 'character',
    entityName: name,
    summary: summaryParts.join(' | '),
    sections: [
      { title: 'The Story So Far', content: storyLines.join('\n') },
      { title: 'Strengths & Flaws', content: strengthLines.join('\n') },
      { title: 'Bonds & Rivalries', content: bondsLines.join('\n') },
      { title: 'Worldly Standing', content: standingLines.join('\n') },
      { title: 'Heart & Mind', content: heartLines.join('\n') },
      { title: 'Remembered Things', content: memoryLines.join('\n') },
      { title: 'Possessions & Treasures', content: possessionLines.join('\n') },
    ],
    prose: proseLines,
    relatedEntities: refs.toArray(),
  };
}
