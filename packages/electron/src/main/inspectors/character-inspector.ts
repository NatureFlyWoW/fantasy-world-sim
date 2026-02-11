// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * Character Inspector — extracts structured data for character entities.
 *
 * Identity Card (summary) + 6 sections:
 *   1. Overview — personality, attributes, traits, skills, titles
 *   2. Bonds & Rivalries — allegiance, relationships, grudges, genealogy, beliefs
 *   3. Life Story — key moments from event log
 *   4. Heart & Mind — goals with priorities
 *   5. Memories — strongest memories
 *   6. Possessions — items and equipped gear
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
  getHealthWord,
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

  // ── Read all components upfront ────────────────────────────────────────

  const health = world.hasStore('Health')
    ? world.getComponent(eid, 'Health') as { current?: number; maximum?: number; injuries?: string[]; diseases?: string[] } | undefined
    : undefined;

  const status = world.hasStore('Status')
    ? world.getComponent(eid, 'Status') as { titles?: string[]; socialClass?: string; conditions?: string[] } | undefined
    : undefined;

  const membership = world.hasStore('Membership')
    ? world.getComponent(eid, 'Membership') as { factionId?: number | null; rank?: string; joinDate?: number } | undefined
    : undefined;

  const wealth = world.hasStore('Wealth')
    ? world.getComponent(eid, 'Wealth') as { coins?: number; propertyValue?: number; debts?: number } | undefined
    : undefined;

  const creatureType = world.hasStore('CreatureType')
    ? world.getComponent(eid, 'CreatureType') as { species?: string; size?: string; diet?: string } | undefined
    : undefined;

  const personality = world.hasStore('Personality')
    ? world.getComponent(eid, 'Personality') as {
        openness?: number; conscientiousness?: number; extraversion?: number;
        agreeableness?: number; neuroticism?: number;
      } | undefined
    : undefined;

  const attr = world.hasStore('Attribute')
    ? world.getComponent(eid, 'Attribute') as {
        strength?: number; agility?: number; endurance?: number;
        intelligence?: number; wisdom?: number; charisma?: number;
      } | undefined
    : undefined;

  const traits = world.hasStore('Traits')
    ? world.getComponent(eid, 'Traits') as { traits?: string[]; intensities?: Map<string, number> } | undefined
    : undefined;

  const skills = world.hasStore('Skill')
    ? world.getComponent(eid, 'Skill') as { skills?: Map<string, number>; experience?: Map<string, number> } | undefined
    : undefined;

  const relationships = world.hasStore('Relationship')
    ? world.getComponent(eid, 'Relationship') as {
        relationships?: Map<number, string>; affinity?: Map<number, number>;
      } | undefined
    : undefined;

  const grudges = world.hasStore('Grudges')
    ? world.getComponent(eid, 'Grudges') as {
        grudges?: Map<number, string>; severity?: Map<number, number>;
      } | undefined
    : undefined;

  const genealogy = world.hasStore('Genealogy')
    ? world.getComponent(eid, 'Genealogy') as {
        parentIds?: number[]; childIds?: number[]; spouseIds?: number[];
      } | undefined
    : undefined;

  const belief = world.hasStore('Belief')
    ? world.getComponent(eid, 'Belief') as {
        deityIds?: number[]; devotion?: Map<number, number>; doubts?: string[];
      } | undefined
    : undefined;

  const goals = world.hasStore('Goal')
    ? world.getComponent(eid, 'Goal') as { objectives?: string[]; priorities?: Map<string, number> } | undefined
    : undefined;

  const memory = world.hasStore('Memory')
    ? world.getComponent(eid, 'Memory') as {
        memories?: Array<{ eventId: number; importance: number; distortion: number }>; capacity?: number;
      } | undefined
    : undefined;

  const possessions = world.hasStore('Possession')
    ? world.getComponent(eid, 'Possession') as { itemIds?: number[]; equippedIds?: number[] } | undefined
    : undefined;

  // ── Identity Card (summary) ────────────────────────────────────────────
  // Compact 3-line header with at-a-glance info:
  //   Line 1: Species · Age N · Profession
  //   Line 2: Faction Name · Social Class
  //   Line 3: Health: Healthy | Wealth: 12,400g

  const identityParts: string[] = [];

  // Line 1: species, age proxy, profession/role
  const line1Parts: string[] = [];
  if (creatureType?.species !== undefined) {
    line1Parts.push(creatureType.species);
  }
  // Age: use earliest event as birth proxy, or membership joinDate
  const events = eventLog.getByEntity(eid);
  const allEventsSorted = events.length > 0
    ? [...events].sort((a, b) => a.timestamp - b.timestamp)
    : [];
  let ageStr: string | undefined;
  if (allEventsSorted.length > 0 && allEventsSorted[0] !== undefined) {
    const birthTick = membership?.joinDate !== undefined && membership.joinDate > 0
      ? Math.min(membership.joinDate, allEventsSorted[0].timestamp)
      : allEventsSorted[0].timestamp;
    const ageTicks = clock.currentTick - birthTick;
    if (ageTicks >= 0) {
      const ageYears = Math.floor(ageTicks / 360);
      ageStr = `Age ${ageYears}`;
    }
  }
  if (ageStr !== undefined) {
    line1Parts.push(ageStr);
  }
  // Profession: status title (second entry) or rank
  const profession = (status?.titles !== undefined && status.titles.length > 1 && status.titles[1] !== undefined)
    ? status.titles[1]
    : membership?.rank;
  if (profession !== undefined) {
    line1Parts.push(profession);
  }
  if (line1Parts.length > 0) {
    identityParts.push(line1Parts.join(' \u00B7 '));
  }

  // Line 2: faction name, social class
  const line2Parts: string[] = [];
  if (membership?.factionId !== undefined && membership.factionId !== null) {
    const factionName = resolveName(membership.factionId, world);
    line2Parts.push(factionName);
    refs.add(membership.factionId, 'faction', factionName);
  }
  if (status?.socialClass !== undefined) {
    // Capitalize social class
    const cls = status.socialClass.charAt(0).toUpperCase() + status.socialClass.slice(1);
    line2Parts.push(`${cls} Class`);
  }
  if (line2Parts.length > 0) {
    identityParts.push(line2Parts.join(' \u00B7 '));
  }

  // Line 3: health | wealth
  const line3Parts: string[] = [];
  if (health !== undefined) {
    const current = health.current ?? 100;
    const maximum = health.maximum ?? 100;
    line3Parts.push(`Health: ${getHealthWord(current, maximum)}`);
  }
  if (wealth?.coins !== undefined) {
    line3Parts.push(`Wealth: ${wealth.coins.toLocaleString()}g`);
  }
  if (line3Parts.length > 0) {
    identityParts.push(line3Parts.join(' | '));
  }

  const summary = identityParts.length > 0
    ? identityParts.join('\n')
    : `Year ${tickToYear(clock.currentTick)}`;

  // ── Section 1: Overview ────────────────────────────────────────────────
  // Personality summary, attribute bars, traits, skills, titles
  const overviewLines: string[] = [];

  // Personality Big Five
  if (personality !== undefined) {
    const descriptors: string[] = [];
    for (const [axis, value] of Object.entries(personality) as Array<[string, number | undefined]>) {
      if (value === undefined) continue;
      const desc = getPersonalityDescriptor(axis, value);
      if (desc !== null) descriptors.push(desc);
    }
    if (descriptors.length > 0) {
      overviewLines.push(`This individual is ${descriptors.join(', and ')}.`);
      overviewLines.push('');
    } else {
      overviewLines.push('A moderate temperament with no extreme tendencies.');
      overviewLines.push('');
    }
  }

  // Attribute bars
  if (attr !== undefined) {
    overviewLines.push('ATTRIBUTES:');
    const attributes: Array<[string, number | undefined]> = [
      ['STR', attr.strength], ['AGI', attr.agility], ['END', attr.endurance],
      ['INT', attr.intelligence], ['WIS', attr.wisdom], ['CHA', attr.charisma],
    ];
    for (const [label, value] of attributes) {
      const v = value ?? 10;
      overviewLines.push(`  ${label}: ${renderBar(v, 20)} ${v}`);
    }
    overviewLines.push('');
  }

  // Traits
  if (traits?.traits !== undefined && traits.traits.length > 0) {
    overviewLines.push(`TRAITS: ${traits.traits.join('  |  ')}`);
    overviewLines.push('');
  }

  // Skills (NEW)
  if (skills?.skills !== undefined && skills.skills.size > 0) {
    overviewLines.push('SKILLS:');
    const skillEntries = [...skills.skills.entries()].sort((a, b) => b[1] - a[1]);
    for (const [skillName, level] of skillEntries) {
      const expVal = skills.experience?.get(skillName) ?? 0;
      const expLabel = expVal > 0 ? ` (${expVal} xp)` : '';
      overviewLines.push(`  ${skillName}: ${level}${expLabel}`);
    }
    overviewLines.push('');
  }

  // Titles
  if (status?.titles !== undefined && status.titles.length > 1) {
    overviewLines.push('TITLES:');
    for (const title of status.titles.slice(1)) {
      overviewLines.push(`  * ${title}`);
    }
    overviewLines.push('');
  }

  // Conditions
  if (status?.conditions !== undefined && status.conditions.length > 0) {
    overviewLines.push(`CONDITIONS: ${status.conditions.join(', ')}`);
  }

  if (overviewLines.length === 0) {
    overviewLines.push('No personality data available.');
  }

  // ── Section 2: Bonds & Rivalries ───────────────────────────────────────
  // Allegiance, relationships, grudges, genealogy, beliefs
  const bondsLines: string[] = [];

  // Allegiance
  if (membership?.factionId !== undefined && membership.factionId !== null) {
    const fMarker = entityMarker(membership.factionId, 'faction', world, refs);
    const rankStr = membership.rank !== undefined ? ` (${membership.rank})` : '';
    bondsLines.push('ALLEGIANCE:');
    bondsLines.push(`  ${fMarker}${rankStr}`);
    bondsLines.push('');
  }

  // Relationships
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

  // Grudges
  if (grudges?.grudges !== undefined && grudges.grudges.size > 0) {
    bondsLines.push('GRUDGES:');
    for (const [targetId, reason] of grudges.grudges) {
      const severity = grudges.severity?.get(targetId) ?? 50;
      const marker = entityMarker(targetId, detectEntityType(targetId, world), world, refs);
      bondsLines.push(`  ${marker}: ${reason} (severity: ${severity})`);
    }
    bondsLines.push('');
  }

  // Genealogy (NEW)
  if (genealogy !== undefined) {
    const hasFamily = (genealogy.parentIds !== undefined && genealogy.parentIds.length > 0)
      || (genealogy.childIds !== undefined && genealogy.childIds.length > 0)
      || (genealogy.spouseIds !== undefined && genealogy.spouseIds.length > 0);

    if (hasFamily) {
      bondsLines.push('FAMILY:');
      if (genealogy.spouseIds !== undefined && genealogy.spouseIds.length > 0) {
        for (const spouseId of genealogy.spouseIds) {
          const marker = entityMarker(spouseId, 'character', world, refs);
          bondsLines.push(`  Spouse: ${marker}`);
        }
      }
      if (genealogy.parentIds !== undefined && genealogy.parentIds.length > 0) {
        for (const parentId of genealogy.parentIds) {
          const marker = entityMarker(parentId, 'character', world, refs);
          bondsLines.push(`  Parent: ${marker}`);
        }
      }
      if (genealogy.childIds !== undefined && genealogy.childIds.length > 0) {
        for (const childId of genealogy.childIds) {
          const marker = entityMarker(childId, 'character', world, refs);
          bondsLines.push(`  Child: ${marker}`);
        }
      }
      bondsLines.push('');
    }
  }

  // Beliefs/Worship (NEW)
  if (belief !== undefined && belief.deityIds !== undefined && belief.deityIds.length > 0) {
    bondsLines.push('WORSHIP:');
    for (const deityId of belief.deityIds) {
      const devotionLevel = belief.devotion?.get(deityId) ?? 50;
      const devotionLabel = devotionLevel >= 80 ? 'Devout'
        : devotionLevel >= 50 ? 'Faithful'
        : devotionLevel >= 20 ? 'Casual'
        : 'Doubting';
      const marker = entityMarker(deityId, 'character', world, refs);
      bondsLines.push(`  ${marker} -- ${devotionLabel} (${devotionLevel})`);
    }
    if (belief.doubts !== undefined && belief.doubts.length > 0) {
      bondsLines.push(`  Doubts: ${belief.doubts.join(', ')}`);
    }
    bondsLines.push('');
  }

  if (bondsLines.length === 0) {
    bondsLines.push('No known relationships or rivalries.');
  }

  // ── Section 3: Life Story ──────────────────────────────────────────────
  // Key moments with improved descriptions
  const storyLines: string[] = [];

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

  if (allEventsSorted.length === 0) {
    storyLines.push(`The story of ${name} has yet to be written.`);
  } else {
    // Lower threshold: >= 40 significance (was 50)
    const significant = allEventsSorted.filter(e => e.significance >= 40);
    const keyEvents = significant.length > 0 ? significant : allEventsSorted.slice(0, 3);

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
    // Show up to 8 (was 5)
    const toShow = keyEvents.slice(0, 8);
    for (const event of toShow) {
      const year = tickToYear(event.timestamp);
      storyLines.push(`  Y${year} -- ${eventDescription(event)}`);
    }
    if (allEventsSorted.length > toShow.length) {
      storyLines.push('');
      storyLines.push(`(${allEventsSorted.length} events total)`);
    }
  }

  // ── Section 4: Heart & Mind ────────────────────────────────────────────
  const heartLines: string[] = [];

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

  // ── Section 5: Memories ────────────────────────────────────────────────
  const memoryLines: string[] = [];

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

  // ── Section 6: Possessions ─────────────────────────────────────────────
  const possessionLines: string[] = [];

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

  // ── Build response ─────────────────────────────────────────────────────
  return {
    entityType: 'character',
    entityName: name,
    summary,
    sections: [
      { title: 'Overview', content: overviewLines.join('\n') },
      { title: 'Bonds & Rivalries', content: bondsLines.join('\n') },
      { title: 'Life Story', content: storyLines.join('\n') },
      { title: 'Heart & Mind', content: heartLines.join('\n') },
      { title: 'Memories', content: memoryLines.join('\n') },
      { title: 'Possessions', content: possessionLines.join('\n') },
    ],
    prose: [],
    relatedEntities: refs.toArray(),
  };
}
