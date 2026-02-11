// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * Shared helper functions and prose tables for entity inspectors.
 */

import { World, EventCategory } from '@fws/core';
import type { EntityId, WorldEvent } from '@fws/core';
import type { EntityRef } from '../../shared/types.js';

// ── Time Conversion ───────────────────────────────────────────────────────────

export function tickToYear(tick: number): number {
  return Math.floor(tick / 360) + 1;
}

export function tickToSeason(tick: number): string {
  const month = Math.floor((tick % 360) / 30) + 1;
  if (month >= 1 && month <= 3) return 'Winter';
  if (month >= 4 && month <= 6) return 'Spring';
  if (month >= 7 && month <= 9) return 'Summer';
  return 'Autumn';
}

// ── Health State ──────────────────────────────────────────────────────────────

export function getHealthState(current: number, maximum: number): string {
  const pct = maximum > 0 ? current / maximum : 0;
  if (pct >= 1.0) return 'perfect';
  if (pct >= 0.75) return 'healthy';
  if (pct >= 0.5) return 'injured';
  if (pct >= 0.25) return 'wounded';
  if (pct > 0) return 'critical';
  return 'dead';
}

export const HEALTH_PROSE: Readonly<Record<string, string>> = {
  perfect: 'is in the prime of health',
  healthy: 'bears no significant wounds',
  injured: 'nurses injuries from recent conflict',
  wounded: 'suffers from grievous wounds',
  critical: 'clings to life by a thread',
  dead: 'has passed beyond the veil',
};

// ── Personality ───────────────────────────────────────────────────────────────

export const PERSONALITY_AXIS: Readonly<Record<string, readonly [string, string]>> = {
  openness: ['traditional and set in their ways', 'endlessly curious and open to new ideas'],
  conscientiousness: ['free-spirited and spontaneous', 'methodical and disciplined'],
  extraversion: ['reserved and introspective', 'gregarious and commanding'],
  agreeableness: ['sharp-tongued and confrontational', 'gentle and accommodating'],
  neuroticism: ['unnervingly calm under pressure', 'prone to anxiety and dark moods'],
};

export function getPersonalityDescriptor(axis: string, value: number): string | null {
  const pair = PERSONALITY_AXIS[axis];
  if (pair === undefined) return null;
  if (value < 30) return pair[0];
  if (value > 70) return pair[1];
  return null;
}

// ── Settlement Size ───────────────────────────────────────────────────────────

export function getSettlementSize(population: number): string {
  if (population < 100) return 'Hamlet';
  if (population < 1000) return 'Village';
  if (population < 5000) return 'Town';
  if (population < 25000) return 'City';
  if (population < 100000) return 'Large City';
  return 'Metropolis';
}

export const SETTLEMENT_SIZE_PROSE: Readonly<Record<string, string>> = {
  Hamlet: 'A scattering of homes clustered together',
  Village: 'A modest village where everyone knows their neighbor',
  Town: 'A bustling town at the crossroads of trade',
  City: 'A city of consequence, its walls marking ambition in stone',
  'Large City': 'A great city whose name is known across the realm',
  Metropolis: 'A vast metropolis, teeming with life and intrigue',
};

// ── Economic State ────────────────────────────────────────────────────────────

export function getEconomicState(wealth: number): string {
  if (wealth >= 50000) return 'opulent';
  if (wealth >= 20000) return 'wealthy';
  if (wealth >= 5000) return 'comfortable';
  if (wealth >= 1000) return 'modest';
  if (wealth >= 100) return 'poor';
  return 'destitute';
}

export const ECONOMIC_PROSE: Readonly<Record<string, string>> = {
  destitute: 'Poverty grips the populace, and coin is scarce as hope',
  poor: 'The people scrape by on meager earnings',
  modest: 'A modest economy sustains the daily needs of the people',
  comfortable: 'Trade flows steadily and the markets hum with activity',
  wealthy: 'Prosperity fills the coffers and lines the merchants\' purses',
  opulent: 'Vast wealth has transformed the land into a place of splendor',
};

// ── Military State ────────────────────────────────────────────────────────────

export function getMilitaryState(strength: number, morale: number): string {
  if (strength === 0) return 'peaceful';
  if (morale < 30) return 'defeated';
  if (morale > 85) return 'victorious';
  if (strength > 5000) return 'at_war';
  return 'mobilizing';
}

export const MILITARY_PROSE: Readonly<Record<string, string>> = {
  peaceful: 'The realm enjoys a period of peace, though soldiers keep watch',
  mobilizing: 'War drums echo through the land as forces gather',
  at_war: 'Conflict rages across the frontiers',
  victorious: 'Recent victory has emboldened the armies',
  defeated: 'Defeat has left the forces weakened and demoralized',
};

// ── Significance & Diplomacy ──────────────────────────────────────────────────

export function getSignificanceLabel(value: number): string {
  if (value >= 96) return 'Legendary';
  if (value >= 81) return 'Critical';
  if (value >= 61) return 'Major';
  if (value >= 41) return 'Moderate';
  if (value >= 21) return 'Minor';
  return 'Trivial';
}

export function getDiplomacyLabel(relation: number): string {
  if (relation >= 80) return 'Allied';
  if (relation >= 50) return 'Friendly';
  if (relation >= 20) return 'Cordial';
  if (relation >= -20) return 'Neutral';
  if (relation >= -50) return 'Wary';
  if (relation >= -80) return 'Hostile';
  return 'At War';
}

// ── Visual Bars ───────────────────────────────────────────────────────────────

export function renderBar(value: number, maxValue: number): string {
  const BAR_WIDTH = 20;
  const normalized = Math.max(0, Math.min(1, value / maxValue));
  const filledCount = Math.round(normalized * BAR_WIDTH);
  const emptyCount = BAR_WIDTH - filledCount;
  return '\u2588'.repeat(filledCount) + '\u2591'.repeat(emptyCount);
}

// ── Fortifications ────────────────────────────────────────────────────────────

export function getFortificationName(level: number): string {
  if (level <= 0) return 'None';
  if (level <= 1) return 'Palisade';
  if (level <= 2) return 'Wooden Walls';
  if (level <= 3) return 'Stone Walls';
  if (level <= 4) return 'Fortified Walls';
  return 'Castle';
}

export const FORTIFICATION_PROSE: Readonly<Record<string, string>> = {
  None: 'The settlement lies open and undefended',
  Palisade: 'A wooden palisade offers modest protection against raiders',
  'Wooden Walls': 'Sturdy wooden walls encircle the settlement',
  'Stone Walls': 'Solid stone walls stand guard over the approaches',
  'Fortified Walls': 'Thick fortified walls bristle with towers and battlements',
  Castle: 'A mighty castle dominates the skyline, its defenses virtually impregnable',
};

// ── Power & Rarity ────────────────────────────────────────────────────────────

export function getPowerTierName(tier: number): string {
  if (tier <= 0) return 'Mundane';
  if (tier === 1) return 'Minor';
  if (tier === 2) return 'Lesser';
  if (tier === 3) return 'Moderate';
  if (tier === 4) return 'Greater';
  if (tier === 5) return 'Major';
  if (tier === 6) return 'Supreme';
  return 'Divine';
}

export function getRarityLabel(value: number): string {
  if (value >= 10000) return 'Legendary';
  if (value >= 5000) return 'Epic';
  if (value >= 1000) return 'Rare';
  if (value >= 500) return 'Uncommon';
  return 'Common';
}

// ── Biomes & Regions ──────────────────────────────────────────────────────────

export const BIOME_PROSE: Readonly<Record<string, string>> = {
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

export const RESOURCE_PROSE: Readonly<Record<string, string>> = {
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

export function describeElevation(elevation: number): string {
  if (elevation >= 0.9) return 'The highest peaks scrape the heavens';
  if (elevation >= 0.75) return 'Lofty heights command a sweeping view';
  if (elevation >= 0.6) return 'Highland terrain rolls with rocky ridges';
  if (elevation >= 0.45) return 'Gentle hills give way to broad valleys';
  if (elevation >= 0.3) return 'Low-lying ground stretches flat and open';
  if (elevation >= 0.15) return 'Coastal lowlands hug the water\'s edge';
  if (elevation >= 0.05) return 'The land barely rises above the waterline';
  return 'Deep waters conceal the ocean floor';
}

export function describeTemperature(temperature: number): string {
  if (temperature >= 0.9) return 'Scorching heat makes the air shimmer';
  if (temperature >= 0.75) return 'Tropical warmth pervades the atmosphere';
  if (temperature >= 0.6) return 'Warm breezes carry the scent of growing things';
  if (temperature >= 0.45) return 'The climate is temperate and mild';
  if (temperature >= 0.3) return 'A cool wind speaks of approaching winter';
  if (temperature >= 0.15) return 'Bitter cold seeps into the bones';
  if (temperature >= 0.05) return 'Frigid air stings exposed skin';
  return 'Lethal cold grips the frozen waste';
}

export function describeRainfall(rainfall: number): string {
  if (rainfall >= 0.85) return 'Rain falls in near-constant sheets';
  if (rainfall >= 0.7) return 'Heavy rains nourish the lush growth';
  if (rainfall >= 0.5) return 'Regular rains sustain the land';
  if (rainfall >= 0.35) return 'Seasonal rains come and go';
  if (rainfall >= 0.2) return 'Scarce rainfall leaves the earth thirsty';
  if (rainfall >= 0.1) return 'Only the hardiest plants survive the drought';
  return 'Rain is a distant memory here';
}

// ── Entity Reference Tracking ─────────────────────────────────────────────────

/**
 * Collector for entity references encountered during inspection.
 * Deduplicates by (type, id) pair.
 */
export class EntityRefCollector {
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

// ── Name Resolution ───────────────────────────────────────────────────────────

export function resolveName(entityId: number, world: World): string {
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
export function entityMarker(
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
export function detectEntityType(entityId: number, world: World): string {
  const eid = entityId as unknown as EntityId;
  if (world.hasStore('Attribute') && world.getComponent(eid, 'Attribute') !== undefined) return 'character';
  if (world.hasStore('Territory') && world.getComponent(eid, 'Territory') !== undefined) return 'faction';
  if (world.hasStore('Population') && world.getComponent(eid, 'Population') !== undefined) return 'site';
  if (world.hasStore('MagicalProperty') && world.getComponent(eid, 'MagicalProperty') !== undefined) return 'artifact';
  if (world.hasStore('PowerLevel') && world.getComponent(eid, 'PowerLevel') !== undefined) return 'artifact';
  return 'character'; // fallback
}

/**
 * Get event description from narrative prose, data, or subtype.
 * Uses a 4-tier fallback chain:
 *   1. event.data.narrativeBody (truncated to 120 chars)
 *   2. event.data.description
 *   3. Built from event.data fields: "{actionName} at {siteName}" or "{actionName} involving {targetName}"
 *   4. Humanized subtype (last resort)
 */
export function eventDescription(event: WorldEvent): string {
  const data = event.data as Record<string, unknown>;

  // Tier 1: narrative body
  const narrativeBody = data['narrativeBody'];
  if (typeof narrativeBody === 'string' && narrativeBody.length > 0) {
    if (narrativeBody.length <= 120) return narrativeBody;
    return narrativeBody.slice(0, 117) + '...';
  }

  // Tier 2: explicit description
  const desc = data['description'];
  if (typeof desc === 'string' && desc.length > 0) return desc;

  // Tier 3: build from event.data fields
  const actionName = data['actionName'];
  if (typeof actionName === 'string' && actionName.length > 0) {
    const humanAction = actionName.replace(/[._]/g, ' ');
    const siteName = data['siteName'];
    if (typeof siteName === 'string' && siteName.length > 0) {
      return `${humanAction} at ${siteName}`;
    }
    // actionName alone is still more meaningful than raw subtype
    return humanAction;
  }

  // Tier 4: humanized subtype
  return humanizeSubtype(event.subtype);
}

/**
 * Humanize an event subtype string: strip prefix, replace separators, capitalize.
 * "character.show_mercy" → "Show mercy"
 */
export function humanizeSubtype(subtype: string): string {
  // Strip category prefix (e.g., "character.", "political.")
  const dotIndex = subtype.indexOf('.');
  const raw = dotIndex >= 0 ? subtype.slice(dotIndex + 1) : subtype;
  const words = raw.replace(/[._]/g, ' ').trim();
  if (words.length === 0) return subtype;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Get a compact health status word from current/maximum health values.
 */
export function getHealthWord(current: number, maximum: number): string {
  const state = getHealthState(current, maximum);
  const HEALTH_WORDS: Record<string, string> = {
    perfect: 'Healthy',
    healthy: 'Healthy',
    injured: 'Injured',
    wounded: 'Wounded',
    critical: 'Critical',
    dead: 'Dead',
  };
  return HEALTH_WORDS[state] ?? 'Unknown';
}

/**
 * Get a compact wealth descriptor from coin count.
 */
export function getWealthWord(coins: number): string {
  if (coins >= 50000) return 'Opulent';
  if (coins >= 20000) return 'Wealthy';
  if (coins >= 5000) return 'Comfortable';
  if (coins >= 1000) return 'Modest';
  if (coins >= 100) return 'Poor';
  return 'Destitute';
}
