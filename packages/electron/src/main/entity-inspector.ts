// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * Entity Inspector — main-process data extraction for the Electron inspector panel.
 *
 * Ports the 6 CLI sub-inspectors (Character, Faction, Site, Artifact, Event, Region)
 * into a single function that returns structured InspectorResponse objects.
 *
 * Entity references in content strings use inline markers: [[e:TYPE:ID:NAME]]
 * The renderer parses these into clickable entity links.
 */

import { World, WorldClock, EventLog, EventCategory } from '@fws/core';
import type { EntityId, EventId, WorldEvent } from '@fws/core';
import type {
  InspectorQuery,
  InspectorSection,
  EntityRef,
  InspectorResponse,
} from '../shared/types.js';

// ── Helper Functions ──────────────────────────────────────────────────────────

function tickToYear(tick: number): number {
  return Math.floor(tick / 360) + 1;
}

function tickToSeason(tick: number): string {
  const month = Math.floor((tick % 360) / 30) + 1;
  if (month >= 1 && month <= 3) return 'Winter';
  if (month >= 4 && month <= 6) return 'Spring';
  if (month >= 7 && month <= 9) return 'Summer';
  return 'Autumn';
}

function getHealthState(current: number, maximum: number): string {
  const pct = maximum > 0 ? current / maximum : 0;
  if (pct >= 1.0) return 'perfect';
  if (pct >= 0.75) return 'healthy';
  if (pct >= 0.5) return 'injured';
  if (pct >= 0.25) return 'wounded';
  if (pct > 0) return 'critical';
  return 'dead';
}

const HEALTH_PROSE: Readonly<Record<string, string>> = {
  perfect: 'is in the prime of health',
  healthy: 'bears no significant wounds',
  injured: 'nurses injuries from recent conflict',
  wounded: 'suffers from grievous wounds',
  critical: 'clings to life by a thread',
  dead: 'has passed beyond the veil',
};

const PERSONALITY_AXIS: Readonly<Record<string, readonly [string, string]>> = {
  openness: ['traditional and set in their ways', 'endlessly curious and open to new ideas'],
  conscientiousness: ['free-spirited and spontaneous', 'methodical and disciplined'],
  extraversion: ['reserved and introspective', 'gregarious and commanding'],
  agreeableness: ['sharp-tongued and confrontational', 'gentle and accommodating'],
  neuroticism: ['unnervingly calm under pressure', 'prone to anxiety and dark moods'],
};

function getPersonalityDescriptor(axis: string, value: number): string | null {
  const pair = PERSONALITY_AXIS[axis];
  if (pair === undefined) return null;
  if (value < 30) return pair[0];
  if (value > 70) return pair[1];
  return null;
}

function getSettlementSize(population: number): string {
  if (population < 100) return 'Hamlet';
  if (population < 1000) return 'Village';
  if (population < 5000) return 'Town';
  if (population < 25000) return 'City';
  if (population < 100000) return 'Large City';
  return 'Metropolis';
}

const SETTLEMENT_SIZE_PROSE: Readonly<Record<string, string>> = {
  Hamlet: 'A scattering of homes clustered together',
  Village: 'A modest village where everyone knows their neighbor',
  Town: 'A bustling town at the crossroads of trade',
  City: 'A city of consequence, its walls marking ambition in stone',
  'Large City': 'A great city whose name is known across the realm',
  Metropolis: 'A vast metropolis, teeming with life and intrigue',
};

function getEconomicState(wealth: number): string {
  if (wealth >= 50000) return 'opulent';
  if (wealth >= 20000) return 'wealthy';
  if (wealth >= 5000) return 'comfortable';
  if (wealth >= 1000) return 'modest';
  if (wealth >= 100) return 'poor';
  return 'destitute';
}

const ECONOMIC_PROSE: Readonly<Record<string, string>> = {
  destitute: 'Poverty grips the populace, and coin is scarce as hope',
  poor: 'The people scrape by on meager earnings',
  modest: 'A modest economy sustains the daily needs of the people',
  comfortable: 'Trade flows steadily and the markets hum with activity',
  wealthy: 'Prosperity fills the coffers and lines the merchants\' purses',
  opulent: 'Vast wealth has transformed the land into a place of splendor',
};

function getMilitaryState(strength: number, morale: number): string {
  if (strength === 0) return 'peaceful';
  if (morale < 30) return 'defeated';
  if (morale > 85) return 'victorious';
  if (strength > 5000) return 'at_war';
  return 'mobilizing';
}

const MILITARY_PROSE: Readonly<Record<string, string>> = {
  peaceful: 'The realm enjoys a period of peace, though soldiers keep watch',
  mobilizing: 'War drums echo through the land as forces gather',
  at_war: 'Conflict rages across the frontiers',
  victorious: 'Recent victory has emboldened the armies',
  defeated: 'Defeat has left the forces weakened and demoralized',
};

function getSignificanceLabel(value: number): string {
  if (value >= 96) return 'Legendary';
  if (value >= 81) return 'Critical';
  if (value >= 61) return 'Major';
  if (value >= 41) return 'Moderate';
  if (value >= 21) return 'Minor';
  return 'Trivial';
}

function getDiplomacyLabel(relation: number): string {
  if (relation >= 80) return 'Allied';
  if (relation >= 50) return 'Friendly';
  if (relation >= 20) return 'Cordial';
  if (relation >= -20) return 'Neutral';
  if (relation >= -50) return 'Wary';
  if (relation >= -80) return 'Hostile';
  return 'At War';
}

function renderBar(value: number, maxValue: number): string {
  const BAR_WIDTH = 20;
  const normalized = Math.max(0, Math.min(1, value / maxValue));
  const filledCount = Math.round(normalized * BAR_WIDTH);
  const emptyCount = BAR_WIDTH - filledCount;
  return '\u2588'.repeat(filledCount) + '\u2591'.repeat(emptyCount);
}

function getFortificationName(level: number): string {
  if (level <= 0) return 'None';
  if (level <= 1) return 'Palisade';
  if (level <= 2) return 'Wooden Walls';
  if (level <= 3) return 'Stone Walls';
  if (level <= 4) return 'Fortified Walls';
  return 'Castle';
}

const FORTIFICATION_PROSE: Readonly<Record<string, string>> = {
  None: 'The settlement lies open and undefended',
  Palisade: 'A wooden palisade offers modest protection against raiders',
  'Wooden Walls': 'Sturdy wooden walls encircle the settlement',
  'Stone Walls': 'Solid stone walls stand guard over the approaches',
  'Fortified Walls': 'Thick fortified walls bristle with towers and battlements',
  Castle: 'A mighty castle dominates the skyline, its defenses virtually impregnable',
};

function getPowerTierName(tier: number): string {
  if (tier <= 0) return 'Mundane';
  if (tier === 1) return 'Minor';
  if (tier === 2) return 'Lesser';
  if (tier === 3) return 'Moderate';
  if (tier === 4) return 'Greater';
  if (tier === 5) return 'Major';
  if (tier === 6) return 'Supreme';
  return 'Divine';
}

function getRarityLabel(value: number): string {
  if (value >= 10000) return 'Legendary';
  if (value >= 5000) return 'Epic';
  if (value >= 1000) return 'Rare';
  if (value >= 500) return 'Uncommon';
  return 'Common';
}

// ── Biome and region prose (ported from region-detail-panel.ts) ───────────────

const BIOME_PROSE: Readonly<Record<string, string>> = {
  DeepOcean: 'Fathomless waters stretch to every horizon, dark and unfathomable. Strange currents churn in the depths where no light has ever reached.',
  Ocean: 'Open waters roll endlessly under the sky. The wind carries the salt of distant shores.',
  Coast: 'Where land meets sea, the tide paints the shore in foam and shell. Gulls wheel overhead.',
  Plains: 'Grasslands ripple like a green sea under the wind. The horizon stretches unbroken in every direction.',
  Forest: 'Tall trees crowd together, their canopy filtering the sun into dappled gold. Birdsong fills the air.',
  DenseForest: 'Ancient trees grow so thick that twilight reigns even at noon. Moss clings to every surface.',
  Mountain: 'Rocky slopes rise above the tree line, wind-scoured and stern. Stone and sky meet in a jagged embrace.',
  HighMountain: 'Towering peaks pierce the clouds, their summits crowned with eternal snow.',
  Desert: 'Sand and stone shimmer under a merciless sun. Heat rises in visible waves.',
  Tundra: 'A frozen expanse of scrub and lichen stretches to the pale horizon.',
  Swamp: 'Dark water pools between twisted roots and hummocks of sodden earth.',
  Volcano: 'The earth itself bleeds fire here. Ash drifts on sulfurous winds.',
  Jungle: 'A riot of green engulfs everything. Vines hang like curtains, flowers bloom in impossible colors.',
  Savanna: 'Golden grass sways beneath a wide sky dotted with flat-topped trees.',
  Taiga: 'Endless ranks of dark conifers march across the frozen north. Snow lies deep between the trunks.',
  IceCap: 'A blinding expanse of ice and snow extends without end. Nothing grows here.',
  MagicWasteland: 'Reality frays at the edges in this scarred land. The ground pulses with residual energy.',
};

const RESOURCE_PROSE: Readonly<Record<string, string>> = {
  iron: 'Veins of iron ore run through the rock',
  gold: 'Precious gold glints in the earth',
  silver: 'Silver deposits gleam in the stone',
  copper: 'Copper ore colours the exposed rock green',
  gemstones: 'Rare gemstones lie hidden in the deep places',
  timber: 'Tall stands of timber await the axe',
  stone: 'Quarryable stone lies close to the surface',
  clay: 'Rich clay deposits line the riverbanks',
  herbs: 'Medicinal herbs grow wild in the undergrowth',
  game: 'Game animals roam through the wilds',
  fish: 'The waters teem with fish',
  fertile_soil: 'Rich, dark soil promises bountiful harvests',
  crystal: 'Crystalline formations pulse with faint energy',
};

function describeElevation(elevation: number): string {
  if (elevation >= 0.9) return 'The highest peaks scrape the heavens';
  if (elevation >= 0.75) return 'Lofty heights command a sweeping view';
  if (elevation >= 0.6) return 'Highland terrain rolls with rocky ridges';
  if (elevation >= 0.45) return 'Gentle hills give way to broad valleys';
  if (elevation >= 0.3) return 'Low-lying ground stretches flat and open';
  if (elevation >= 0.15) return 'Coastal lowlands hug the water\'s edge';
  if (elevation >= 0.05) return 'The land barely rises above the waterline';
  return 'Deep waters conceal the ocean floor';
}

function describeTemperature(temperature: number): string {
  if (temperature >= 0.9) return 'Scorching heat makes the air shimmer';
  if (temperature >= 0.75) return 'Tropical warmth pervades the atmosphere';
  if (temperature >= 0.6) return 'Warm breezes carry the scent of growing things';
  if (temperature >= 0.45) return 'The climate is temperate and mild';
  if (temperature >= 0.3) return 'A cool wind speaks of approaching winter';
  if (temperature >= 0.15) return 'Bitter cold seeps into the bones';
  if (temperature >= 0.05) return 'Frigid air stings exposed skin';
  return 'Lethal cold grips the frozen waste';
}

function describeRainfall(rainfall: number): string {
  if (rainfall >= 0.85) return 'Rain falls in near-constant sheets';
  if (rainfall >= 0.7) return 'Heavy rains nourish the lush growth';
  if (rainfall >= 0.5) return 'Regular rains sustain the land';
  if (rainfall >= 0.35) return 'Seasonal rains come and go';
  if (rainfall >= 0.2) return 'Scarce rainfall leaves the earth thirsty';
  if (rainfall >= 0.1) return 'Only the hardiest plants survive the drought';
  return 'Rain is a distant memory here';
}

// ── Entity reference tracking ─────────────────────────────────────────────────

/**
 * Collector for entity references encountered during inspection.
 * Deduplicates by (type, id) pair.
 */
class EntityRefCollector {
  private readonly refs = new Map<string, EntityRef>();

  add(id: number, type: string, name: string): void {
    const key = `${type}:${id}`;
    if (!this.refs.has(key)) {
      this.refs.set(key, { id, type, name });
    }
  }

  toArray(): EntityRef[] {
    return [...this.refs.values()];
  }
}

// ── Name resolution ───────────────────────────────────────────────────────────

function resolveName(entityId: number, world: World): string {
  const eid = entityId as unknown as EntityId;
  if (world.hasStore('Status')) {
    const status = world.getComponent(eid, 'Status') as { titles?: string[] } | undefined;
    if (status?.titles !== undefined && status.titles.length > 0 && status.titles[0] !== undefined) {
      return status.titles[0];
    }
  }
  return `#${entityId}`;
}

/**
 * Create an entity marker string and register the reference.
 */
function entityMarker(
  id: number,
  type: string,
  world: World,
  refs: EntityRefCollector,
): string {
  const name = resolveName(id, world);
  refs.add(id, type, name);
  return `[[e:${type}:${id}:${name}]]`;
}

/**
 * Determine the inspector entity type of an ECS entity by checking components.
 */
function detectEntityType(entityId: number, world: World): string {
  const eid = entityId as unknown as EntityId;
  if (world.hasStore('Attribute') && world.getComponent(eid, 'Attribute') !== undefined) return 'character';
  if (world.hasStore('Territory') && world.getComponent(eid, 'Territory') !== undefined) return 'faction';
  if (world.hasStore('Population') && world.getComponent(eid, 'Population') !== undefined) return 'site';
  if (world.hasStore('MagicalProperty') && world.getComponent(eid, 'MagicalProperty') !== undefined) return 'artifact';
  if (world.hasStore('PowerLevel') && world.getComponent(eid, 'PowerLevel') !== undefined) return 'artifact';
  return 'character'; // fallback
}

/**
 * Get event description from data or subtype.
 */
function eventDescription(event: WorldEvent): string {
  const desc = (event.data as Record<string, unknown>)['description'];
  return typeof desc === 'string' && desc.length > 0 ? desc : event.subtype.replace(/[._]/g, ' ');
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * Inspect an entity and return structured data for the renderer inspector panel.
 */
export function inspectEntity(
  query: InspectorQuery,
  world: World,
  eventLog: EventLog,
  clock: WorldClock,
): InspectorResponse {
  switch (query.type) {
    case 'character':
      return inspectCharacter(query.id, world, eventLog, clock);
    case 'faction':
      return inspectFaction(query.id, world, eventLog, clock);
    case 'site':
      return inspectSite(query.id, world, eventLog, clock);
    case 'artifact':
      return inspectArtifact(query.id, world, eventLog, clock);
    case 'event':
      return inspectEvent(query.id, world, eventLog, clock);
    case 'region':
      return inspectRegion(query.id, world, eventLog, clock);
    default:
      return {
        entityType: query.type,
        entityName: `Unknown #${query.id}`,
        summary: '',
        sections: [],
        prose: [],
        relatedEntities: [],
      };
  }
}

// ── Character Inspector (7 sections) ──────────────────────────────────────────

function inspectCharacter(
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

// ── Faction Inspector (8 sections) ────────────────────────────────────────────

function inspectFaction(
  id: number,
  world: World,
  eventLog: EventLog,
  clock: WorldClock,
): InspectorResponse {
  const eid = id as unknown as EntityId;
  const refs = new EntityRefCollector();

  const status = world.hasStore('Status')
    ? world.getComponent(eid, 'Status') as { titles?: string[] } | undefined
    : undefined;
  const factionName = (status?.titles !== undefined && status.titles.length > 0 && status.titles[0] !== undefined)
    ? status.titles[0]
    : `Faction #${id}`;

  // ── Section 1: Rise & Reign ─────────────────────────────────────────
  const riseLines: string[] = [];

  const origin = world.hasStore('Origin')
    ? world.getComponent(eid, 'Origin') as { founderId?: number | null; foundingTick?: number; foundingLocation?: number | null } | undefined
    : undefined;
  const history = world.hasStore('History')
    ? world.getComponent(eid, 'History') as { foundingDate?: number } | undefined
    : undefined;
  const government = world.hasStore('Government')
    ? world.getComponent(eid, 'Government') as { governmentType?: string; stability?: number; legitimacy?: number } | undefined
    : undefined;
  const population = world.hasStore('Population')
    ? world.getComponent(eid, 'Population') as { count?: number } | undefined
    : undefined;

  const foundingTick = origin?.foundingTick ?? history?.foundingDate;
  if (foundingTick !== undefined) {
    const foundingYear = tickToYear(foundingTick);
    const currentYear = tickToYear(clock.currentTick);
    const age = currentYear - foundingYear;

    if (origin?.founderId !== undefined && origin.founderId !== null) {
      const founderMarker = entityMarker(origin.founderId, 'character', world, refs);
      riseLines.push(`${factionName} was founded in Year ${foundingYear} by ${founderMarker}.`);
    } else {
      riseLines.push(`${factionName} was established in Year ${foundingYear}.`);
    }
    if (age > 0) riseLines.push(`For ${age} years it has endured, shaping the history of this land.`);
    riseLines.push('');
  }

  if (government !== undefined) {
    if (government.governmentType !== undefined) riseLines.push(`Government: ${government.governmentType}`);
    if (government.stability !== undefined) riseLines.push(`Stability: ${renderBar(government.stability, 100)} ${government.stability}%`);
    if (government.legitimacy !== undefined) riseLines.push(`Legitimacy: ${renderBar(government.legitimacy, 100)} ${government.legitimacy}%`);
  }

  if (population?.count !== undefined) {
    riseLines.push(`Total Population: ${population.count.toLocaleString()}`);
  }

  if (riseLines.length === 0) riseLines.push('No historical data available for this faction.');

  // ── Section 2: Banner & Creed ───────────────────────────────────────
  const bannerLines: string[] = [];

  const culture = world.hasStore('Culture')
    ? world.getComponent(eid, 'Culture') as { traditions?: string[]; values?: string[] } | undefined
    : undefined;
  const doctrine = world.hasStore('Doctrine')
    ? world.getComponent(eid, 'Doctrine') as { beliefs?: string[]; prohibitions?: string[] } | undefined
    : undefined;

  if (culture?.values !== undefined && culture.values.length > 0) {
    bannerLines.push('Guiding Principles:');
    for (const value of culture.values) {
      bannerLines.push(`  * ${value}`);
    }
    bannerLines.push('');
  }

  if (doctrine?.beliefs !== undefined && doctrine.beliefs.length > 0) {
    bannerLines.push('Sacred Tenets:');
    for (const belief of doctrine.beliefs.slice(0, 5)) {
      bannerLines.push(`  * ${belief}`);
    }
    bannerLines.push('');
  }

  if (doctrine?.prohibitions !== undefined && doctrine.prohibitions.length > 0) {
    bannerLines.push('Forbidden Acts:');
    for (const prohibition of doctrine.prohibitions.slice(0, 3)) {
      bannerLines.push(`  * ${prohibition}`);
    }
  }

  if (bannerLines.length === 0) bannerLines.push('No cultural data available.');

  // ── Section 3: Court & Council ──────────────────────────────────────
  const courtLines: string[] = [];

  const hierarchy = world.hasStore('Hierarchy')
    ? world.getComponent(eid, 'Hierarchy') as { leaderId?: number | null; subordinateIds?: number[] } | undefined
    : undefined;

  if (hierarchy !== undefined) {
    if (hierarchy.leaderId !== undefined && hierarchy.leaderId !== null) {
      const leaderMarker = entityMarker(hierarchy.leaderId, 'character', world, refs);
      courtLines.push(`${leaderMarker} ......... (Leader)`);
    }
    if (hierarchy.subordinateIds !== undefined && hierarchy.subordinateIds.length > 0) {
      courtLines.push('');
      for (const subId of hierarchy.subordinateIds.slice(0, 10)) {
        const marker = entityMarker(subId, 'character', world, refs);
        courtLines.push(`  ${marker}`);
      }
      if (hierarchy.subordinateIds.length > 10) {
        courtLines.push(`  And ${hierarchy.subordinateIds.length - 10} other members of note.`);
      }
    }
  }

  if (courtLines.length === 0) courtLines.push('No leadership data available.');

  // ── Section 4: Lands & Holdings ─────────────────────────────────────
  const landsLines: string[] = [];

  const territory = world.hasStore('Territory')
    ? world.getComponent(eid, 'Territory') as { controlledRegions?: number[]; capitalId?: number | null } | undefined
    : undefined;

  if (territory !== undefined) {
    if (territory.controlledRegions !== undefined && territory.controlledRegions.length > 0) {
      landsLines.push(`The faction controls ${territory.controlledRegions.length} regions.`);
      landsLines.push('');
    }
    if (territory.capitalId !== undefined && territory.capitalId !== null) {
      const capitalMarker = entityMarker(territory.capitalId, 'site', world, refs);
      landsLines.push(`Capital: ${capitalMarker}`);
      landsLines.push('');
    }
    if (territory.controlledRegions !== undefined && territory.controlledRegions.length > 0) {
      landsLines.push('Controlled Regions:');
      for (const regionId of territory.controlledRegions.slice(0, 10)) {
        const marker = entityMarker(regionId, 'site', world, refs);
        landsLines.push(`  ~ ${marker}`);
      }
      if (territory.controlledRegions.length > 10) {
        landsLines.push(`  ... and ${territory.controlledRegions.length - 10} more`);
      }
    }
  }

  if (landsLines.length === 0) landsLines.push('No territory data available.');

  // ── Section 5: Swords & Shields ─────────────────────────────────────
  const swordsLines: string[] = [];

  const military = world.hasStore('Military')
    ? world.getComponent(eid, 'Military') as { strength?: number; morale?: number; training?: number } | undefined
    : undefined;

  if (military?.strength !== undefined && military.morale !== undefined) {
    const state = getMilitaryState(military.strength, military.morale);
    const prose = MILITARY_PROSE[state];
    if (prose !== undefined) {
      swordsLines.push(`${prose}.`);
      swordsLines.push('');
    }
  }

  if (military !== undefined) {
    if (military.strength !== undefined) swordsLines.push(`Total Strength: ${military.strength.toLocaleString()}`);
    if (military.morale !== undefined) swordsLines.push(`Morale: ${renderBar(military.morale, 100)} ${military.morale}%`);
    if (military.training !== undefined) swordsLines.push(`Training: ${renderBar(military.training, 100)} ${military.training}%`);
  }

  const factionEvents = eventLog.getByEntity(eid);
  const recentMilitary = factionEvents.filter(e => e.category === 'Military' && e.significance >= 50);
  if (recentMilitary.length > 0) {
    swordsLines.push('');
    swordsLines.push('Active Conflicts:');
    for (const event of recentMilitary.slice(0, 5)) {
      swordsLines.push(`  Y${tickToYear(event.timestamp)} -- ${eventDescription(event)}`);
    }
  }

  if (swordsLines.length === 0) swordsLines.push('No military data available.');

  // ── Section 6: Alliances & Enmities ─────────────────────────────────
  const allianceLines: string[] = [];

  const diplomacy = world.hasStore('Diplomacy')
    ? world.getComponent(eid, 'Diplomacy') as { relations?: Map<number, number>; treaties?: string[] } | undefined
    : undefined;

  if (diplomacy?.relations !== undefined && diplomacy.relations.size > 0) {
    const allies: Array<[number, number]> = [];
    const enemies: Array<[number, number]> = [];
    const neutral: Array<[number, number]> = [];

    for (const [factionId, relation] of diplomacy.relations) {
      if (relation >= 50) allies.push([factionId, relation]);
      else if (relation <= -50) enemies.push([factionId, relation]);
      else neutral.push([factionId, relation]);
    }
    allies.sort((a, b) => b[1] - a[1]);
    enemies.sort((a, b) => a[1] - b[1]);

    if (allies.length > 0) {
      allianceLines.push('ALLIES:');
      for (const [factionId, relation] of allies) {
        const marker = entityMarker(factionId, 'faction', world, refs);
        const label = getDiplomacyLabel(relation);
        allianceLines.push(`  ${marker} ......... ${label} [+${relation}]`);
      }
      allianceLines.push('');
    }

    if (enemies.length > 0) {
      allianceLines.push('ENEMIES:');
      for (const [factionId, relation] of enemies) {
        const marker = entityMarker(factionId, 'faction', world, refs);
        const label = getDiplomacyLabel(relation);
        allianceLines.push(`  ${marker} ......... ${label} [${relation}]`);
      }
      allianceLines.push('');
    }

    if (neutral.length > 0) {
      allianceLines.push('NEUTRAL:');
      for (const [factionId, relation] of neutral) {
        const marker = entityMarker(factionId, 'faction', world, refs);
        const label = getDiplomacyLabel(relation);
        const sign = relation >= 0 ? '+' : '';
        allianceLines.push(`  ${marker} ......... ${label} [${sign}${relation}]`);
      }
      allianceLines.push('');
    }
  }

  if (diplomacy?.treaties !== undefined && diplomacy.treaties.length > 0) {
    allianceLines.push('Treaties:');
    for (const treaty of diplomacy.treaties) {
      allianceLines.push(`  * ${treaty}`);
    }
  }

  if (allianceLines.length === 0) allianceLines.push('No diplomatic data available.');

  // ── Section 7: Coffers & Commerce ───────────────────────────────────
  const cofferLines: string[] = [];

  const economy = world.hasStore('Economy')
    ? world.getComponent(eid, 'Economy') as { wealth?: number; tradeVolume?: number; industries?: string[] } | undefined
    : undefined;
  const fWealth = world.hasStore('Wealth')
    ? world.getComponent(eid, 'Wealth') as { coins?: number; propertyValue?: number; debts?: number } | undefined
    : undefined;

  if (economy?.wealth !== undefined) {
    const state = getEconomicState(economy.wealth);
    const prose = ECONOMIC_PROSE[state];
    if (prose !== undefined) {
      cofferLines.push(`${prose}.`);
      cofferLines.push('');
    }
  }

  if (economy !== undefined) {
    if (economy.wealth !== undefined) cofferLines.push(`Treasury: ${economy.wealth.toLocaleString()}`);
    if (economy.tradeVolume !== undefined) cofferLines.push(`Trade Volume: ${economy.tradeVolume.toLocaleString()}`);
    if (economy.industries !== undefined && economy.industries.length > 0) {
      cofferLines.push('');
      cofferLines.push('Major Industries:');
      for (const industry of economy.industries) {
        cofferLines.push(`  * ${industry}`);
      }
    }
  }

  if (fWealth !== undefined) {
    cofferLines.push('');
    if (fWealth.propertyValue !== undefined) cofferLines.push(`Total Assets: ${fWealth.propertyValue.toLocaleString()}`);
    if (fWealth.debts !== undefined && fWealth.debts > 0) cofferLines.push(`National Debt: ${fWealth.debts.toLocaleString()}`);
  }

  if (cofferLines.length === 0) cofferLines.push('No economic data available.');

  // ── Section 8: Chronicles ───────────────────────────────────────────
  const chronicleLines: string[] = [];

  if (foundingTick !== undefined) {
    chronicleLines.push(`Founded: Year ${tickToYear(foundingTick)}`);
    if (origin?.founderId !== undefined && origin.founderId !== null) {
      const founderMarker = entityMarker(origin.founderId, 'character', world, refs);
      chronicleLines.push(`Founder: ${founderMarker}`);
    }
    if (origin?.foundingLocation !== undefined && origin.foundingLocation !== null) {
      const locMarker = entityMarker(origin.foundingLocation, 'site', world, refs);
      chronicleLines.push(`Origin: ${locMarker}`);
    }
    chronicleLines.push('');
  }

  if (factionEvents.length > 0) {
    chronicleLines.push('Defining moments:');
    const sorted = [...factionEvents].sort((a, b) => b.significance - a.significance);
    for (const event of sorted.slice(0, 10)) {
      const sigLabel = getSignificanceLabel(event.significance);
      chronicleLines.push(`  Y${tickToYear(event.timestamp)} -- ${eventDescription(event)}`);
      chronicleLines.push(`    ${event.category} | ${sigLabel} (${event.significance})`);
    }
    if (factionEvents.length > 10) {
      chronicleLines.push(`  And ${factionEvents.length - 10} more recorded events.`);
    }
  } else {
    chronicleLines.push('No historical events recorded.');
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const summaryParts: string[] = [];
  if (government?.governmentType !== undefined) summaryParts.push(government.governmentType);
  if (population?.count !== undefined) summaryParts.push(`Pop: ${population.count.toLocaleString()}`);
  if (territory?.controlledRegions !== undefined) summaryParts.push(`${territory.controlledRegions.length} regions`);

  const proseLines: string[] = [];
  if (foundingTick !== undefined) {
    const age = tickToYear(clock.currentTick) - tickToYear(foundingTick);
    if (age > 0) proseLines.push(`For ${age} years, ${factionName} has endured.`);
  }

  return {
    entityType: 'faction',
    entityName: factionName,
    summary: summaryParts.join(' | '),
    sections: [
      { title: 'Rise & Reign', content: riseLines.join('\n') },
      { title: 'Banner & Creed', content: bannerLines.join('\n') },
      { title: 'Court & Council', content: courtLines.join('\n') },
      { title: 'Lands & Holdings', content: landsLines.join('\n') },
      { title: 'Swords & Shields', content: swordsLines.join('\n') },
      { title: 'Alliances & Enmities', content: allianceLines.join('\n') },
      { title: 'Coffers & Commerce', content: cofferLines.join('\n') },
      { title: 'Chronicles', content: chronicleLines.join('\n') },
    ],
    prose: proseLines,
    relatedEntities: refs.toArray(),
  };
}

// ── Site Inspector (7 sections) ───────────────────────────────────────────────

function inspectSite(
  id: number,
  world: World,
  eventLog: EventLog,
  clock: WorldClock,
): InspectorResponse {
  const eid = id as unknown as EntityId;
  const refs = new EntityRefCollector();

  const name = resolveName(id, world);

  // ── Section 1: A Living Portrait ────────────────────────────────────
  const portraitLines: string[] = [];

  const sitePopulation = world.hasStore('Population')
    ? world.getComponent(eid, 'Population') as { count?: number; growthRate?: number } | undefined
    : undefined;
  const ownership = world.hasStore('Ownership')
    ? world.getComponent(eid, 'Ownership') as { ownerId?: number | null; claimStrength?: number } | undefined
    : undefined;
  const position = world.hasStore('Position')
    ? world.getComponent(eid, 'Position') as { x?: number; y?: number } | undefined
    : undefined;
  const siteHistory = world.hasStore('History')
    ? world.getComponent(eid, 'History') as { foundingDate?: number } | undefined
    : undefined;
  const biome = world.hasStore('Biome')
    ? world.getComponent(eid, 'Biome') as { biomeType?: string; fertility?: number; moisture?: number } | undefined
    : undefined;

  if (sitePopulation?.count !== undefined) {
    const sizeCategory = getSettlementSize(sitePopulation.count);
    const sizeProse = SETTLEMENT_SIZE_PROSE[sizeCategory];
    if (sizeProse !== undefined) {
      portraitLines.push(`${sizeProse}.`);
      portraitLines.push('');
    }
  }

  if (biome?.biomeType !== undefined) {
    portraitLines.push(`The settlement sits amid ${biome.biomeType.toLowerCase()} terrain.`);
  }

  if (siteHistory?.foundingDate !== undefined) {
    const foundingYear = tickToYear(siteHistory.foundingDate);
    const currentYear = tickToYear(clock.currentTick);
    const age = currentYear - foundingYear;
    portraitLines.push(`Founded in Year ${foundingYear}${age > 0 ? ` (${age} years ago)` : ''}.`);
  }

  portraitLines.push('');

  if (sitePopulation?.count !== undefined) {
    const sizeCategory = getSettlementSize(sitePopulation.count);
    portraitLines.push(`Population: ${sitePopulation.count.toLocaleString()} (${sizeCategory})`);
    if (sitePopulation.growthRate !== undefined) {
      const growthPct = (sitePopulation.growthRate * 100).toFixed(1);
      const growthSign = sitePopulation.growthRate >= 0 ? '+' : '';
      portraitLines.push(`Growth: ${growthSign}${growthPct}%`);
    }
  }

  if (ownership?.ownerId !== undefined && ownership.ownerId !== null) {
    const factionMarker = entityMarker(ownership.ownerId, 'faction', world, refs);
    portraitLines.push(`Ruling Faction: ${factionMarker}`);
  }

  if (position !== undefined && position.x !== undefined && position.y !== undefined) {
    portraitLines.push(`Coordinates: (${position.x}, ${position.y})`);
  }

  if (portraitLines.length === 0) portraitLines.push('No information available about this location.');

  // ── Section 2: People & Peoples ─────────────────────────────────────
  const peopleLines: string[] = [];

  const demographics = world.hasStore('PopulationDemographics')
    ? world.getComponent(eid, 'PopulationDemographics') as {
        ageDistribution?: Map<string, number>; raceDistribution?: Map<string, number>;
      } | undefined
    : undefined;

  const siteCulture = world.hasStore('Culture')
    ? world.getComponent(eid, 'Culture') as { traditions?: string[]; values?: string[]; languageId?: number | null } | undefined
    : undefined;

  if (demographics?.raceDistribution !== undefined && demographics.raceDistribution.size > 0) {
    const total = [...demographics.raceDistribution.values()].reduce((a, b) => a + b, 0);
    let dominantRace = '';
    let dominantPct = 0;
    for (const [race, count] of demographics.raceDistribution) {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      if (pct > dominantPct) { dominantPct = pct; dominantRace = race; }
    }
    if (dominantRace.length > 0) {
      peopleLines.push(`The population is predominantly ${dominantRace.toLowerCase()}.`);
      peopleLines.push('');
    }
    peopleLines.push('Population by Race:');
    for (const [race, count] of demographics.raceDistribution) {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      peopleLines.push(`  ${race}: ${renderBar(pct, 100)} ${pct}%`);
    }
    peopleLines.push('');
  }

  if (siteCulture !== undefined) {
    if (siteCulture.traditions !== undefined && siteCulture.traditions.length > 0) {
      peopleLines.push('Traditions:');
      for (const tradition of siteCulture.traditions) {
        peopleLines.push(`  * ${tradition}`);
      }
      peopleLines.push('');
    }
    if (siteCulture.values !== undefined && siteCulture.values.length > 0) {
      peopleLines.push(`Cultural Values: ${siteCulture.values.join(' | ')}`);
    }
    if (siteCulture.languageId !== undefined && siteCulture.languageId !== null) {
      const langMarker = entityMarker(siteCulture.languageId, 'site', world, refs);
      peopleLines.push(`Language: ${langMarker}`);
    }
  }

  if (peopleLines.length === 0) peopleLines.push('No demographic data available.');

  // ── Section 3: Power & Governance ───────────────────────────────────
  const powerLines: string[] = [];

  const siteGov = world.hasStore('Government')
    ? world.getComponent(eid, 'Government') as { governmentType?: string; stability?: number; legitimacy?: number } | undefined
    : undefined;

  if (siteGov?.governmentType !== undefined && ownership?.ownerId !== undefined && ownership.ownerId !== null) {
    const factionMarker = entityMarker(ownership.ownerId, 'faction', world, refs);
    powerLines.push(`Governed as part of ${factionMarker} under a ${siteGov.governmentType} system.`);
    powerLines.push('');
  }

  if (siteGov !== undefined) {
    if (siteGov.governmentType !== undefined) powerLines.push(`Government: ${siteGov.governmentType}`);
    if (siteGov.stability !== undefined) powerLines.push(`Stability: ${renderBar(siteGov.stability, 100)} ${siteGov.stability}%`);
    if (siteGov.legitimacy !== undefined) powerLines.push(`Legitimacy: ${renderBar(siteGov.legitimacy, 100)} ${siteGov.legitimacy}%`);
  }

  if (ownership !== undefined) {
    if (ownership.ownerId !== undefined && ownership.ownerId !== null) {
      const factionMarker = entityMarker(ownership.ownerId, 'faction', world, refs);
      powerLines.push(`Ruling Faction: ${factionMarker}`);
    }
    if (ownership.claimStrength !== undefined) {
      powerLines.push(`Claim Strength: ${renderBar(ownership.claimStrength, 100)} ${ownership.claimStrength}%`);
    }
  }

  if (powerLines.length === 0) powerLines.push('No governance data available.');

  // ── Section 4: Trade & Industry ─────────────────────────────────────
  const tradeLines: string[] = [];

  const siteEconomy = world.hasStore('Economy')
    ? world.getComponent(eid, 'Economy') as { wealth?: number; tradeVolume?: number; industries?: string[] } | undefined
    : undefined;
  const resources = world.hasStore('Resource')
    ? world.getComponent(eid, 'Resource') as { resources?: Map<string, number> } | undefined
    : undefined;

  if (siteEconomy?.wealth !== undefined) {
    const state = getEconomicState(siteEconomy.wealth);
    const prose = ECONOMIC_PROSE[state];
    if (prose !== undefined) {
      tradeLines.push(`${prose}.`);
      tradeLines.push('');
    }
  }

  if (siteEconomy !== undefined) {
    if (siteEconomy.wealth !== undefined) tradeLines.push(`Treasury: ${siteEconomy.wealth.toLocaleString()}`);
    if (siteEconomy.tradeVolume !== undefined) tradeLines.push(`Trade Volume: ${siteEconomy.tradeVolume.toLocaleString()}`);
    if (siteEconomy.industries !== undefined && siteEconomy.industries.length > 0) {
      tradeLines.push('');
      tradeLines.push('Industries:');
      for (const industry of siteEconomy.industries) {
        tradeLines.push(`  * ${industry}`);
      }
    }
  }

  if (resources?.resources !== undefined && resources.resources.size > 0) {
    tradeLines.push('');
    tradeLines.push('Resources:');
    for (const [resource, amount] of resources.resources) {
      tradeLines.push(`  ${resource}: ${amount}`);
    }
  }

  if (tradeLines.length === 0) tradeLines.push('No economic data available.');

  // ── Section 5: Walls & Works ────────────────────────────────────────
  const wallsLines: string[] = [];

  const siteMilitary = world.hasStore('Military')
    ? world.getComponent(eid, 'Military') as { strength?: number; morale?: number; training?: number } | undefined
    : undefined;
  const structures = world.hasStore('Structures')
    ? world.getComponent(eid, 'Structures') as { fortificationLevel?: number; buildings?: string[] } | undefined
    : undefined;
  const condition = world.hasStore('Condition')
    ? world.getComponent(eid, 'Condition') as { durability?: number; maintenanceLevel?: number } | undefined
    : undefined;

  if (structures?.fortificationLevel !== undefined) {
    const fortName = getFortificationName(structures.fortificationLevel);
    const fortProse = FORTIFICATION_PROSE[fortName];
    if (fortProse !== undefined) {
      wallsLines.push(`${fortProse}.`);
      wallsLines.push('');
    }
    wallsLines.push(`Fortifications: ${fortName} (Level ${structures.fortificationLevel})`);
  }

  if (siteMilitary !== undefined) {
    if (siteMilitary.strength !== undefined) wallsLines.push(`Garrison: ${siteMilitary.strength.toLocaleString()} soldiers`);
    if (siteMilitary.morale !== undefined) wallsLines.push(`Morale: ${renderBar(siteMilitary.morale, 100)} ${siteMilitary.morale}%`);
    if (siteMilitary.training !== undefined) wallsLines.push(`Training: ${renderBar(siteMilitary.training, 100)} ${siteMilitary.training}%`);
  }

  if (structures?.buildings !== undefined && structures.buildings.length > 0) {
    wallsLines.push('');
    wallsLines.push('Notable Buildings:');
    for (const building of structures.buildings) {
      wallsLines.push(`  * ${building}`);
    }
  }

  if (condition !== undefined) {
    wallsLines.push('');
    if (condition.durability !== undefined) wallsLines.push(`Durability: ${renderBar(condition.durability, 100)} ${condition.durability}%`);
    if (condition.maintenanceLevel !== undefined) wallsLines.push(`Maintenance: ${renderBar(condition.maintenanceLevel, 100)} ${condition.maintenanceLevel}%`);
  }

  if (wallsLines.length === 0) wallsLines.push('No structural or military data available.');

  // ── Section 6: Notable Souls ────────────────────────────────────────
  const soulsLines: string[] = [];

  if (position?.x !== undefined && position.y !== undefined && world.hasStore('Position')) {
    const posStore = world.getStore('Position') as unknown as { getAll: () => Map<EntityId, { x?: number; y?: number }> };
    const characters: Array<[number, string]> = [];

    for (const [checkEid, ePos] of posStore.getAll()) {
      if (checkEid !== eid && ePos.x === position.x && ePos.y === position.y) {
        if (world.hasStore('Attribute') && world.getComponent(checkEid, 'Attribute') !== undefined) {
          const charId = checkEid as unknown as number;
          const charName = resolveName(charId, world);
          characters.push([charId, charName]);
        }
      }
    }

    if (characters.length > 0) {
      soulsLines.push(`${characters.length} figure${characters.length > 1 ? 's' : ''} of note reside${characters.length === 1 ? 's' : ''} here:`);
      soulsLines.push('');
      for (const [charId, _charName] of characters.slice(0, 10)) {
        const marker = entityMarker(charId, 'character', world, refs);
        soulsLines.push(`  @ ${marker}`);
      }
      if (characters.length > 10) {
        soulsLines.push(`  And ${characters.length - 10} others of lesser renown.`);
      }
    }
  }

  if (soulsLines.length === 0) soulsLines.push('No notable inhabitants recorded.');

  // ── Section 7: The Annals ───────────────────────────────────────────
  const annalsLines: string[] = [];

  if (siteHistory?.foundingDate !== undefined) {
    annalsLines.push(`Founded: Year ${tickToYear(siteHistory.foundingDate)}`);
    annalsLines.push('');
  }

  const siteEvents = eventLog.getByEntity(eid);
  if (siteEvents.length > 0) {
    annalsLines.push('Defining moments:');
    const sorted = [...siteEvents].sort((a, b) => b.significance - a.significance);
    for (const event of sorted.slice(0, 5)) {
      annalsLines.push(`  Y${tickToYear(event.timestamp)} -- ${eventDescription(event)}`);
    }
    if (siteEvents.length > 5) {
      annalsLines.push(`  And ${siteEvents.length - 5} more recorded events.`);
    }
  } else {
    annalsLines.push('No recorded events for this location.');
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const summaryParts: string[] = [];
  if (sitePopulation?.count !== undefined) {
    summaryParts.push(getSettlementSize(sitePopulation.count));
    summaryParts.push(`Pop: ${sitePopulation.count.toLocaleString()}`);
  }
  if (ownership?.ownerId !== undefined && ownership.ownerId !== null) {
    summaryParts.push(resolveName(ownership.ownerId, world));
  }

  const proseLines: string[] = [];
  if (sitePopulation?.count !== undefined) {
    const sizeProse = SETTLEMENT_SIZE_PROSE[getSettlementSize(sitePopulation.count)];
    if (sizeProse !== undefined) proseLines.push(`${sizeProse}.`);
  }

  return {
    entityType: 'site',
    entityName: name,
    summary: summaryParts.join(' | '),
    sections: [
      { title: 'A Living Portrait', content: portraitLines.join('\n') },
      { title: 'People & Peoples', content: peopleLines.join('\n') },
      { title: 'Power & Governance', content: powerLines.join('\n') },
      { title: 'Trade & Industry', content: tradeLines.join('\n') },
      { title: 'Walls & Works', content: wallsLines.join('\n') },
      { title: 'Notable Souls', content: soulsLines.join('\n') },
      { title: 'The Annals', content: annalsLines.join('\n') },
    ],
    prose: proseLines,
    relatedEntities: refs.toArray(),
  };
}

// ── Artifact Inspector (5 sections) ───────────────────────────────────────────

function inspectArtifact(
  id: number,
  world: World,
  eventLog: EventLog,
  _clock: WorldClock,
): InspectorResponse {
  const eid = id as unknown as EntityId;
  const refs = new EntityRefCollector();

  const name = resolveName(id, world);

  // ── Section 1: Overview ─────────────────────────────────────────────
  const overviewLines: string[] = [];

  const status = world.hasStore('Status')
    ? world.getComponent(eid, 'Status') as { titles?: string[] } | undefined
    : undefined;
  const value = world.hasStore('Value')
    ? world.getComponent(eid, 'Value') as { monetaryValue?: number; sentimentalValue?: number; magicalValue?: number } | undefined
    : undefined;
  const location = world.hasStore('Location')
    ? world.getComponent(eid, 'Location') as { currentLocationId?: number | null } | undefined
    : undefined;

  if (status?.titles !== undefined && status.titles.length > 0) {
    overviewLines.push(`Name: ${status.titles[0] ?? 'Unknown Artifact'}`);
    if (status.titles.length > 1) {
      overviewLines.push(`Also known as: ${status.titles.slice(1).join(', ')}`);
    }
  } else {
    overviewLines.push(`Artifact #${id}`);
  }

  if (location?.currentLocationId !== undefined && location.currentLocationId !== null) {
    const locMarker = entityMarker(location.currentLocationId, 'site', world, refs);
    overviewLines.push(`Location: ${locMarker}`);
  } else {
    overviewLines.push('Location: Unknown');
  }

  if (value !== undefined) {
    const totalValue = (value.monetaryValue ?? 0) + (value.magicalValue ?? 0);
    if (totalValue > 0) {
      overviewLines.push(`Rarity: ${getRarityLabel(totalValue)}`);
    }
  }

  // ── Section 2: Creation ─────────────────────────────────────────────
  const creationLines: string[] = [];

  const creation = world.hasStore('CreationHistory')
    ? world.getComponent(eid, 'CreationHistory') as { creatorId?: number; creationTick?: number; method?: string } | undefined
    : undefined;
  const artOrigin = world.hasStore('Origin')
    ? world.getComponent(eid, 'Origin') as { founderId?: number | null; foundingTick?: number; foundingLocation?: number | null } | undefined
    : undefined;

  if (creation !== undefined) {
    if (creation.creatorId !== undefined) {
      const creatorMarker = entityMarker(creation.creatorId, 'character', world, refs);
      creationLines.push(`Creator: ${creatorMarker}`);
    }
    if (creation.creationTick !== undefined) {
      creationLines.push(`Created: Year ${tickToYear(creation.creationTick)}`);
    }
    if (creation.method !== undefined) {
      creationLines.push(`Method: ${creation.method}`);
    }
  } else if (artOrigin !== undefined) {
    if (artOrigin.founderId !== undefined && artOrigin.founderId !== null) {
      const creatorMarker = entityMarker(artOrigin.founderId, 'character', world, refs);
      creationLines.push(`Creator: ${creatorMarker}`);
    }
    if (artOrigin.foundingTick !== undefined) {
      creationLines.push(`Created: Year ${tickToYear(artOrigin.foundingTick)}`);
    }
    if (artOrigin.foundingLocation !== undefined && artOrigin.foundingLocation !== null) {
      const locMarker = entityMarker(artOrigin.foundingLocation, 'site', world, refs);
      creationLines.push(`Place of Creation: ${locMarker}`);
    }
  } else {
    creationLines.push('Origin unknown');
  }

  // ── Section 3: Powers ───────────────────────────────────────────────
  const powerLines: string[] = [];

  const magical = world.hasStore('MagicalProperty')
    ? world.getComponent(eid, 'MagicalProperty') as { enchantments?: string[]; powerLevel?: number } | undefined
    : undefined;
  const power = world.hasStore('Power')
    ? world.getComponent(eid, 'Power') as { abilities?: string[]; manaPool?: number; rechargeRate?: number } | undefined
    : undefined;
  const powerLevel = world.hasStore('PowerLevel')
    ? world.getComponent(eid, 'PowerLevel') as { tier?: number; potency?: number } | undefined
    : undefined;

  if (powerLevel !== undefined) {
    if (powerLevel.tier !== undefined) {
      powerLines.push(`Power Tier: ${getPowerTierName(powerLevel.tier)} (${powerLevel.tier})`);
    }
    if (powerLevel.potency !== undefined) {
      powerLines.push(`Potency: ${renderBar(powerLevel.potency, 100)} ${powerLevel.potency}%`);
    }
  }

  if (magical !== undefined) {
    if (magical.powerLevel !== undefined && powerLevel === undefined) {
      powerLines.push(`Power Level: ${renderBar(magical.powerLevel, 100)} ${magical.powerLevel}%`);
    }
    if (magical.enchantments !== undefined && magical.enchantments.length > 0) {
      powerLines.push('');
      powerLines.push('Enchantments:');
      for (const enchant of magical.enchantments) {
        powerLines.push(`  * ${enchant}`);
      }
    }
  }

  if (power !== undefined) {
    if (power.abilities !== undefined && power.abilities.length > 0) {
      powerLines.push('');
      powerLines.push('Abilities:');
      for (const ability of power.abilities) {
        powerLines.push(`  * ${ability}`);
      }
    }
    if (power.manaPool !== undefined) {
      powerLines.push('');
      powerLines.push(`Mana Pool: ${power.manaPool}`);
      if (power.rechargeRate !== undefined) {
        powerLines.push(`Recharge Rate: ${power.rechargeRate}/day`);
      }
    }
  }

  if (powerLines.length === 0) powerLines.push('No magical properties detected.');

  // ── Section 4: Ownership Chain ──────────────────────────────────────
  const ownershipLines: string[] = [];

  const guardian = world.hasStore('Guardian')
    ? world.getComponent(eid, 'Guardian') as { guardianId?: number | null; protectionLevel?: number } | undefined
    : undefined;
  const ownershipChain = world.hasStore('OwnershipChain')
    ? world.getComponent(eid, 'OwnershipChain') as {
        owners?: Array<{ ownerId: number; fromTick: number; toTick: number | null }>;
      } | undefined
    : undefined;

  if (guardian?.guardianId !== undefined && guardian.guardianId !== null) {
    const guardianMarker = entityMarker(guardian.guardianId, 'character', world, refs);
    ownershipLines.push(`Current Guardian: ${guardianMarker}`);
    if (guardian.protectionLevel !== undefined) {
      ownershipLines.push(`Protection Level: ${renderBar(guardian.protectionLevel, 100)} ${guardian.protectionLevel}%`);
    }
    ownershipLines.push('');
  }

  if (ownershipChain?.owners !== undefined && ownershipChain.owners.length > 0) {
    ownershipLines.push('Ownership History:');
    const sorted = [...ownershipChain.owners].sort((a, b) => b.fromTick - a.fromTick);
    for (const owner of sorted) {
      const fromYear = tickToYear(owner.fromTick);
      const toYear = owner.toTick !== null ? String(tickToYear(owner.toTick)) : 'present';
      const ownerMarker = entityMarker(owner.ownerId, 'character', world, refs);
      ownershipLines.push(`  Y${fromYear}-${toYear}: ${ownerMarker}`);
    }
  } else if (ownershipLines.length === 0) {
    ownershipLines.push('No ownership records.');
  }

  // ── Section 5: History ──────────────────────────────────────────────
  const historyLines: string[] = [];

  const artEvents = eventLog.getByEntity(eid);
  if (artEvents.length > 0) {
    historyLines.push('Event History:');
    const sorted = [...artEvents].sort((a, b) => b.timestamp - a.timestamp);
    for (const event of sorted.slice(0, 15)) {
      historyLines.push(`  Y${tickToYear(event.timestamp)}: ${eventDescription(event)}`);
    }
    if (sorted.length > 15) {
      historyLines.push(`  ... and ${sorted.length - 15} more events`);
    }
  } else {
    historyLines.push('No recorded events.');
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const summaryParts: string[] = [];
  if (value !== undefined) {
    const totalValue = (value.monetaryValue ?? 0) + (value.magicalValue ?? 0);
    if (totalValue > 0) summaryParts.push(getRarityLabel(totalValue));
  }
  if (powerLevel?.tier !== undefined) {
    summaryParts.push(`${getPowerTierName(powerLevel.tier)} Power`);
  }

  return {
    entityType: 'artifact',
    entityName: name,
    summary: summaryParts.join(' | '),
    sections: [
      { title: 'Overview', content: overviewLines.join('\n') },
      { title: 'Creation', content: creationLines.join('\n') },
      { title: 'Powers', content: powerLines.join('\n') },
      { title: 'Ownership Chain', content: ownershipLines.join('\n') },
      { title: 'History', content: historyLines.join('\n') },
    ],
    prose: [],
    relatedEntities: refs.toArray(),
  };
}

// ── Event Inspector (6 sections) ──────────────────────────────────────────────

function inspectEvent(
  id: number,
  world: World,
  eventLog: EventLog,
  _clock: WorldClock,
): InspectorResponse {
  const refs = new EntityRefCollector();

  // Cast from number to EventId
  const eventId = id as unknown as EventId;
  const event = eventLog.getById(eventId);

  if (event === undefined) {
    return {
      entityType: 'event',
      entityName: `Event #${id}`,
      summary: 'Not found',
      sections: [
        { title: 'What Happened', content: 'This event has passed beyond the reach of chronicles.\nEvent is no longer present in the record.' },
      ],
      prose: [],
      relatedEntities: [],
    };
  }

  const description = eventDescription(event);

  // ── Section 1: What Happened ────────────────────────────────────────
  const whatLines: string[] = [];
  whatLines.push(description);
  whatLines.push('');

  const year = tickToYear(event.timestamp);
  const season = tickToSeason(event.timestamp);
  const humanSubtype = event.subtype.replace(/[._]/g, ' ');
  whatLines.push(`In the ${season.toLowerCase()} of Year ${year}, ${humanSubtype}.`);

  const narrative = (event.data as Record<string, unknown>)['narrative'];
  if (typeof narrative === 'string' && narrative.length > 0) {
    whatLines.push('');
    whatLines.push(narrative);
  }

  // ── Section 2: Who Was Involved ─────────────────────────────────────
  const whoLines: string[] = [];

  if (event.participants.length === 0) {
    whoLines.push('No specific participants recorded.');
  } else {
    const primary = event.participants.slice(0, 2);
    const secondary = event.participants.slice(2);

    if (primary.length > 0) {
      whoLines.push('PRIMARY:');
      for (const participantId of primary) {
        const numId = participantId as unknown as number;
        const type = detectEntityType(numId, world);
        const marker = entityMarker(numId, type, world, refs);
        whoLines.push(`  ${marker}`);
      }
    }

    if (secondary.length > 0) {
      whoLines.push('');
      whoLines.push('SECONDARY:');
      for (const participantId of secondary) {
        const numId = participantId as unknown as number;
        const type = detectEntityType(numId, world);
        const marker = entityMarker(numId, type, world, refs);
        whoLines.push(`  ${marker}`);
      }
    }

    // Scan event data for additional entity references
    const data = event.data as Record<string, unknown>;
    const additionalIds: number[] = [];
    for (const [key, val] of Object.entries(data)) {
      if ((key.endsWith('Id') || key.endsWith('_id')) && typeof val === 'number') {
        const participantNums = event.participants.map(p => p as unknown as number);
        if (!participantNums.includes(val)) {
          additionalIds.push(val);
        }
      }
    }

    if (additionalIds.length > 0) {
      whoLines.push('');
      whoLines.push('Also referenced:');
      for (const refId of additionalIds.slice(0, 5)) {
        const type = detectEntityType(refId, world);
        const marker = entityMarker(refId, type, world, refs);
        whoLines.push(`  ${marker}`);
      }
    }
  }

  // ── Section 3: Where & When ─────────────────────────────────────────
  const whereLines: string[] = [];

  const month = Math.floor((event.timestamp % 360) / 30) + 1;
  const dayOfMonth = ((event.timestamp % 360) % 30) + 1;
  whereLines.push(`Date: Year ${year}, Month ${month}, Day ${dayOfMonth} (${season})`);

  const data = event.data as Record<string, unknown>;
  const locationId = data['locationId'] ?? data['location_id'] ?? data['siteId'];
  if (typeof locationId === 'number') {
    const locMarker = entityMarker(locationId, 'site', world, refs);
    whereLines.push(`Location: ${locMarker}`);
  }

  const ex = data['x'];
  const ey = data['y'];
  if (typeof ex === 'number' && typeof ey === 'number') {
    whereLines.push(`Coordinates: (${ex}, ${ey})`);
  }

  if (whereLines.length === 1) {
    whereLines.push('Location not recorded.');
  }

  // ── Section 4: Why It Matters ───────────────────────────────────────
  const whyLines: string[] = [];

  const sigLabel = getSignificanceLabel(event.significance);
  whyLines.push(`Significance: ${renderBar(event.significance, 100)} ${sigLabel} (${event.significance})`);
  whyLines.push('');

  const consequenceCount = event.consequences.length;
  if (consequenceCount > 0) {
    whyLines.push(`This event triggered a cascade of ${consequenceCount} subsequent event${consequenceCount > 1 ? 's' : ''}.`);
  } else {
    whyLines.push('This event did not trigger further cascading events.');
  }

  // ── Section 5: What Came Before ─────────────────────────────────────
  const beforeLines: string[] = [];

  if (event.causes.length === 0) {
    beforeLines.push('This event arose from no recorded prior cause.');
  } else {
    beforeLines.push('This event grew from earlier seeds:');
    beforeLines.push('');
    for (const causeId of event.causes.slice(0, 5)) {
      const causeEvent = eventLog.getById(causeId);
      if (causeEvent !== undefined) {
        const causeYear = tickToYear(causeEvent.timestamp);
        const timeDelta = year - causeYear;
        const timeStr = timeDelta > 0 ? `(${timeDelta} year${timeDelta > 1 ? 's' : ''} before)` : '(same year)';
        beforeLines.push(`  Y${causeYear} -- ${eventDescription(causeEvent)}`);
        beforeLines.push(`    ${timeStr}`);
      } else {
        beforeLines.push(`  Event ${String(causeId)} (record lost)`);
      }
    }
    if (event.causes.length > 5) {
      beforeLines.push(`  ... and ${event.causes.length - 5} more causes`);
    }
  }

  // ── Section 6: What Followed ────────────────────────────────────────
  const afterLines: string[] = [];

  if (event.consequences.length === 0) {
    afterLines.push('No consequences have been recorded.');
  } else {
    afterLines.push('The ripples of this event spread far:');
    afterLines.push('');
    for (const consequenceId of event.consequences.slice(0, 5)) {
      const consequenceEvent = eventLog.getById(consequenceId);
      if (consequenceEvent !== undefined) {
        afterLines.push(`  Y${tickToYear(consequenceEvent.timestamp)} -- ${eventDescription(consequenceEvent)}`);
      } else {
        afterLines.push(`  Event ${String(consequenceId)} (record lost)`);
      }
    }
    if (event.consequences.length > 5) {
      afterLines.push(`  ... and ${event.consequences.length - 5} more consequences`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const summaryParts = [
    event.category,
    `Year ${year}, ${season}`,
    sigLabel,
  ];

  const proseLines: string[] = [];
  proseLines.push(`In the ${season.toLowerCase()} of Year ${year}, ${humanSubtype}.`);

  return {
    entityType: 'event',
    entityName: description,
    summary: summaryParts.join(' | '),
    sections: [
      { title: 'What Happened', content: whatLines.join('\n') },
      { title: 'Who Was Involved', content: whoLines.join('\n') },
      { title: 'Where & When', content: whereLines.join('\n') },
      { title: 'Why It Matters', content: whyLines.join('\n') },
      { title: 'What Came Before', content: beforeLines.join('\n') },
      { title: 'What Followed', content: afterLines.join('\n') },
    ],
    prose: proseLines,
    relatedEntities: refs.toArray(),
  };
}

// ── Region Inspector (6 sections) ─────────────────────────────────────────────

function inspectRegion(
  id: number,
  world: World,
  eventLog: EventLog,
  _clock: WorldClock,
): InspectorResponse {
  const refs = new EntityRefCollector();

  // Decode coordinates: x = floor(id / 10000), y = id % 10000
  const x = Math.floor(id / 10000);
  const y = id % 10000;

  // Attempt to find tile data from ECS Biome component on nearby entities,
  // or fall back to basic coordinate-based inspection.
  // Since the main process doesn't have a direct worldMap reference in this function,
  // we reconstruct what we can from entity components.

  // Try to find a settlement or entity at these coordinates for biome info
  let tileBiome: string | undefined;
  let tileElevation: number | undefined;
  let tileTemperature: number | undefined;
  let tileRainfall: number | undefined;
  let tileRiverId: number | undefined;
  let tileLeyLine: boolean | undefined;
  let tileResources: string[] | undefined;

  // Scan entities at this position for biome data
  if (world.hasStore('Position')) {
    const posStore = world.getStore('Position') as unknown as { getAll: () => Map<EntityId, { x?: number; y?: number }> };
    for (const [checkEid, pos] of posStore.getAll()) {
      if (pos.x === x && pos.y === y) {
        if (world.hasStore('Biome')) {
          const biomeComp = world.getComponent(checkEid, 'Biome') as {
            biomeType?: string; fertility?: number; moisture?: number;
          } | undefined;
          if (biomeComp?.biomeType !== undefined) tileBiome = biomeComp.biomeType;
        }
        if (world.hasStore('Resource')) {
          const resComp = world.getComponent(checkEid, 'Resource') as { resources?: Map<string, number> } | undefined;
          if (resComp?.resources !== undefined) {
            tileResources = [...resComp.resources.keys()];
          }
        }
        break;
      }
    }
  }

  // ── Section 1: The Land Itself ──────────────────────────────────────
  const landLines: string[] = [];

  if (tileBiome !== undefined) {
    const biomeProse = BIOME_PROSE[tileBiome];
    if (biomeProse !== undefined) {
      landLines.push(biomeProse);
    } else {
      landLines.push(`${tileBiome} terrain`);
    }
  } else {
    landLines.push(`Region at coordinates (${x}, ${y}).`);
  }

  landLines.push('');
  landLines.push('Conditions:');
  if (tileElevation !== undefined) landLines.push(`  ^ ${describeElevation(tileElevation)}`);
  if (tileTemperature !== undefined) landLines.push(`  * ${describeTemperature(tileTemperature)}`);
  if (tileRainfall !== undefined) landLines.push(`  ~ ${describeRainfall(tileRainfall)}`);

  if (tileElevation === undefined && tileTemperature === undefined && tileRainfall === undefined) {
    landLines.push('  (Detailed environmental data unavailable from this view)');
  }

  if (tileRiverId !== undefined) {
    landLines.push('');
    landLines.push('A river winds through this region, carving deep gorges in the ancient rock.');
  }

  // ── Section 2: Riches of the Earth ──────────────────────────────────
  const richesLines: string[] = [];
  const resources = tileResources ?? [];

  if (resources.length === 0) {
    richesLines.push('This land yields few riches of note.');
  } else {
    const introWord = resources.length >= 4 ? 'generously' : resources.length >= 2 ? 'reluctantly' : 'sparingly';
    richesLines.push(`The land yields its treasures ${introWord}:`);
    richesLines.push('');
    for (const resource of resources) {
      const prose = RESOURCE_PROSE[resource];
      if (prose !== undefined) {
        richesLines.push(`  * ${prose}`);
      } else {
        const formatted = resource.charAt(0).toUpperCase() + resource.slice(1).replace(/_/g, ' ');
        richesLines.push(`  * ${formatted} can be found here`);
      }
    }
    if (resources.length >= 3) {
      richesLines.push('');
      richesLines.push('Those who control this land grow wealthy on its bounty.');
    }
  }

  // ── Section 3: Those Who Dwell Here ─────────────────────────────────
  const dwellerLines: string[] = [];
  const radius = 3;

  if (world.hasStore('Position')) {
    const posStore = world.getStore('Position') as unknown as { getAll: () => Map<EntityId, { x?: number; y?: number }> };
    const factionEntities: number[] = [];
    const characterEntities: number[] = [];

    for (const [checkEid, pos] of posStore.getAll()) {
      if (pos.x === undefined || pos.y === undefined) continue;
      const dx = Math.abs(pos.x - x);
      const dy = Math.abs(pos.y - y);
      if (dx > radius || dy > radius) continue;

      const numId = checkEid as unknown as number;
      if (world.hasStore('Attribute') && world.getComponent(checkEid, 'Attribute') !== undefined) {
        characterEntities.push(numId);
      } else if (world.hasStore('Territory') && world.getComponent(checkEid, 'Territory') !== undefined) {
        factionEntities.push(numId);
      }
    }

    if (factionEntities.length > 0) {
      dwellerLines.push('Controlling Factions:');
      for (const fId of factionEntities) {
        const marker = entityMarker(fId, 'faction', world, refs);
        dwellerLines.push(`  & ${marker}`);
      }
      dwellerLines.push('');
    }

    if (characterEntities.length > 0) {
      dwellerLines.push('Notable Inhabitants:');
      for (const cId of characterEntities.slice(0, 5)) {
        const marker = entityMarker(cId, 'character', world, refs);
        dwellerLines.push(`  @ ${marker}`);
      }
      if (characterEntities.length > 5) {
        dwellerLines.push(`  ... and ${characterEntities.length - 5} others`);
      }
    }
  }

  if (dwellerLines.length === 0) dwellerLines.push('No inhabitants of note dwell in this region.');

  // ── Section 4: Marks Upon the Land ──────────────────────────────────
  const marksLines: string[] = [];
  const settlementRadius = 5;

  if (world.hasStore('Position') && world.hasStore('Population')) {
    const posStore = world.getStore('Position') as unknown as { getAll: () => Map<EntityId, { x?: number; y?: number }> };
    const settlements: Array<{ id: number; distance: number }> = [];

    for (const [checkEid, pos] of posStore.getAll()) {
      if (pos.x === undefined || pos.y === undefined) continue;
      const pop = world.getComponent(checkEid, 'Population');
      if (pop === undefined) continue;

      const dx = Math.abs(pos.x - x);
      const dy = Math.abs(pos.y - y);
      const distance = Math.max(dx, dy);
      if (distance > settlementRadius) continue;

      settlements.push({ id: checkEid as unknown as number, distance });
    }
    settlements.sort((a, b) => a.distance - b.distance);

    if (settlements.length > 0) {
      marksLines.push('Nearby Settlements:');
      for (const settlement of settlements.slice(0, 8)) {
        const marker = entityMarker(settlement.id, 'site', world, refs);
        const distLabel = settlement.distance <= 1 ? 'adjacent' : settlement.distance <= 3 ? 'near' : 'distant';
        marksLines.push(`  # ${marker} ......... ${distLabel}`);
      }
    }
  }

  if (marksLines.length === 0) marksLines.push('No settlements mark this region.');

  // ── Section 5: Echoes of the Past ───────────────────────────────────
  const echoLines: string[] = [];

  const allEvents = eventLog.getAll();
  const recentEvents = allEvents.slice(Math.max(0, allEvents.length - 500));
  const matchedEvents: WorldEvent[] = [];

  for (const evt of recentEvents) {
    const evtData = evt.data as Record<string, unknown>;
    const evtX = evtData['x'];
    const evtY = evtData['y'];
    if (typeof evtX === 'number' && typeof evtY === 'number') {
      if (Math.abs(evtX - x) <= 2 && Math.abs(evtY - y) <= 2) {
        matchedEvents.push(evt);
        continue;
      }
    }
    // Check participant locations
    for (const participantId of evt.participants) {
      if (world.hasStore('Position')) {
        const pos = world.getComponent(participantId, 'Position') as { x?: number; y?: number } | undefined;
        if (pos?.x !== undefined && pos.y !== undefined) {
          if (Math.abs(pos.x - x) <= 1 && Math.abs(pos.y - y) <= 1) {
            matchedEvents.push(evt);
            break;
          }
        }
      }
    }
  }
  matchedEvents.sort((a, b) => b.significance - a.significance);

  if (matchedEvents.length === 0) {
    echoLines.push('History has left no recorded mark upon this land.');
  } else {
    echoLines.push('History has left its scars on this land:');
    echoLines.push('');
    for (const evt of matchedEvents.slice(0, 5)) {
      echoLines.push(`  Y${tickToYear(evt.timestamp)} -- ${eventDescription(evt)}`);
    }
    if (matchedEvents.length > 5) {
      echoLines.push(`  And ${matchedEvents.length - 5} more events in this region's history.`);
    }
  }

  // ── Section 6: Arcane Currents (only if ley line) ───────────────────
  const arcaneLines: string[] = [];
  const hasLeyLine = tileLeyLine === true;

  if (hasLeyLine) {
    arcaneLines.push('A ley line pulses with arcane energy beneath the earth.');
    arcaneLines.push('The concentration of magical power here has attracted');
    arcaneLines.push('scholars and sorcerers throughout the ages.');

    const magicEvents = matchedEvents.filter(e => e.category === EventCategory.Magical);
    if (magicEvents.length > 0) {
      arcaneLines.push('');
      arcaneLines.push('Recent magical events in this region:');
      for (const evt of magicEvents.slice(0, 3)) {
        arcaneLines.push(`  Y${tickToYear(evt.timestamp)} -- ${eventDescription(evt)}`);
      }
    }
  } else {
    // Check if any magical events exist nearby regardless of ley line
    const magicEvents = matchedEvents.filter(e => e.category === EventCategory.Magical);
    if (magicEvents.length > 0) {
      arcaneLines.push('Though no ley line runs beneath this land, magical events have been recorded:');
      arcaneLines.push('');
      for (const evt of magicEvents.slice(0, 3)) {
        arcaneLines.push(`  Y${tickToYear(evt.timestamp)} -- ${eventDescription(evt)}`);
      }
    } else {
      arcaneLines.push('No significant magical currents flow through this region.');
    }
  }

  // ── Build sections ──────────────────────────────────────────────────
  const sections: InspectorSection[] = [
    { title: 'The Land Itself', content: landLines.join('\n') },
    { title: 'Riches of the Earth', content: richesLines.join('\n') },
    { title: 'Those Who Dwell Here', content: dwellerLines.join('\n') },
    { title: 'Marks Upon the Land', content: marksLines.join('\n') },
    { title: 'Echoes of the Past', content: echoLines.join('\n') },
    { title: 'Arcane Currents', content: arcaneLines.join('\n') },
  ];

  // ── Summary ─────────────────────────────────────────────────────────
  const summaryParts: string[] = [];
  if (tileBiome !== undefined) summaryParts.push(tileBiome);
  summaryParts.push(`(${x}, ${y})`);

  const proseLines: string[] = [];
  if (tileBiome !== undefined) {
    const biomeProse = BIOME_PROSE[tileBiome];
    if (biomeProse !== undefined) proseLines.push(biomeProse);
  }

  return {
    entityType: 'region',
    entityName: tileBiome !== undefined ? `${tileBiome} (${x}, ${y})` : `Region (${x}, ${y})`,
    summary: summaryParts.join(' | '),
    sections,
    prose: proseLines,
    relatedEntities: refs.toArray(),
  };
}
