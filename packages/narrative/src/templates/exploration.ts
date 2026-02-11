/**
 * Exploration narrative templates.
 * Covers: expedition start, discovery, frontier events, world-revealed secrets.
 * All use EventCategory.Exploratory — filling the previously empty category.
 */

import { EventCategory } from '@fws/core';
import type { NarrativeTemplate } from './types.js';
import { NarrativeTone } from './types.js';

export const explorationTemplates: NarrativeTemplate[] = [
  // ============================================================================
  // EXPEDITION START
  // ============================================================================

  {
    id: 'exploration.expedition_start.epic.low',
    category: EventCategory.Exploratory,
    subtype: 'expedition_start',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 40 },
    template: '{character.name} set forth from {site.name}, driven by restless curiosity to explore the unknown reaches beyond the settlement.',
    requiredContext: [],
  },
  {
    id: 'exploration.expedition_start.personal.medium',
    category: EventCategory.Exploratory,
    subtype: 'expedition_start',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: 'There was something out there — {character.name} was sure of it. With provisions packed and resolve steeled, the expedition began. The familiar trails of {site.name} fell away behind.',
    requiredContext: [],
  },
  {
    id: 'exploration.expedition_start.myth.medium',
    category: EventCategory.Exploratory,
    subtype: 'expedition_start',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 41, max: 70 },
    template: 'Called by visions and portents, {character.name} embarked upon a journey into the wild places of the world. The old tales spoke of wonders hidden in the untamed lands, and the explorer meant to find them.',
    requiredContext: [],
  },

  // ============================================================================
  // DISCOVERY (Character-Driven)
  // ============================================================================

  {
    id: 'exploration.discovery.epic.medium',
    category: EventCategory.Exploratory,
    subtype: 'discovery',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'After months of searching, {character.name} stumbled upon {data.locationType} hidden deep in the wilderness. The discovery would reshape understanding of the region.',
    requiredContext: [],
  },
  {
    id: 'exploration.discovery.epic.high',
    category: EventCategory.Exploratory,
    subtype: 'discovery',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The chronicles record the moment {character.name} parted the undergrowth and beheld the {data.locationType} that time itself had forgotten. It was a discovery that would echo through generations — proof that the world still held secrets worth the finding.',
    requiredContext: [],
  },
  {
    id: 'exploration.discovery.personal.medium',
    category: EventCategory.Exploratory,
    subtype: 'discovery',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: '{character.name} knelt before the {data.locationType}, heart pounding. All those weeks of rough travel, cold camps, and uncertain paths — they had led here. This moment made every hardship worthwhile.',
    requiredContext: [],
  },
  {
    id: 'exploration.discovery.myth.high',
    category: EventCategory.Exploratory,
    subtype: 'discovery',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The earth itself seemed to exhale as {character.name} uncovered the {data.locationType}. Ancient wards shimmered and faded, for the time of concealment was over. What the old powers had hidden, mortal determination had revealed.',
    requiredContext: [],
  },
  {
    id: 'exploration.discovery.scholarly.medium',
    category: EventCategory.Exploratory,
    subtype: 'discovery',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 41, max: 70 },
    template: 'Explorer {character.name} documented the discovery of a previously unknown {data.locationType} at coordinates ({data.x}, {data.y}). Initial assessment suggests significant historical and strategic value.',
    requiredContext: [],
  },

  // ============================================================================
  // FRONTIER DANGER
  // ============================================================================

  {
    id: 'exploration.frontier_danger.epic.medium',
    category: EventCategory.Exploratory,
    subtype: 'frontier_danger',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 30, max: 60 },
    template: 'The settlers of {data.settlementName} discovered they were not alone. {data.description} — a sobering reminder that the frontier exacted its own price from those who dared to tame it.',
    requiredContext: [],
  },
  {
    id: 'exploration.frontier_danger.personal.medium',
    category: EventCategory.Exploratory,
    subtype: 'frontier_danger',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 30, max: 60 },
    template: 'The night watch raised the alarm, and the camp at {data.settlementName} scrambled to respond. {data.description}. Sleep came uneasily after that, with one eye open and one hand on the nearest weapon.',
    requiredContext: [],
  },

  // ============================================================================
  // FRONTIER OPPORTUNITY
  // ============================================================================

  {
    id: 'exploration.frontier_opportunity.epic.low',
    category: EventCategory.Exploratory,
    subtype: 'frontier_opportunity',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 40 },
    template: 'The pioneers of {data.settlementName} found cause for optimism when they discovered {data.description}. The land was generous to those willing to work it.',
    requiredContext: [],
  },
  {
    id: 'exploration.frontier_opportunity.personal.low',
    category: EventCategory.Exploratory,
    subtype: 'frontier_opportunity',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 0, max: 40 },
    template: 'A smile spread across weathered faces in {data.settlementName}. {data.description}. Perhaps this frontier life would prove worthwhile after all.',
    requiredContext: [],
  },

  // ============================================================================
  // FRONTIER WONDER
  // ============================================================================

  {
    id: 'exploration.frontier_wonder.epic.medium',
    category: EventCategory.Exploratory,
    subtype: 'frontier_wonder',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 40, max: 70 },
    template: 'In the wilds beyond {data.settlementName}, a wonder was found — {data.description}. The discovery lent an air of the miraculous to their frontier existence.',
    requiredContext: [],
  },
  {
    id: 'exploration.frontier_wonder.myth.medium',
    category: EventCategory.Exploratory,
    subtype: 'frontier_wonder',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 40, max: 70 },
    template: 'The ancient powers had left their mark upon the land near {data.settlementName}. {data.description}. The settlers whispered of old magic and older purposes, and some began to wonder if they had been guided here.',
    requiredContext: [],
  },

  // ============================================================================
  // FRONTIER HARDSHIP
  // ============================================================================

  {
    id: 'exploration.frontier_hardship.epic.medium',
    category: EventCategory.Exploratory,
    subtype: 'frontier_hardship',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 25, max: 50 },
    template: 'Life in {data.settlementName} was hard, and growing harder. {data.description}. Those who endured did so through sheer stubbornness.',
    requiredContext: [],
  },
  {
    id: 'exploration.frontier_hardship.personal.medium',
    category: EventCategory.Exploratory,
    subtype: 'frontier_hardship',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 25, max: 50 },
    template: 'Another day, another trial at {data.settlementName}. {data.description}. The settlers looked at each other with weary eyes, but none spoke of turning back.',
    requiredContext: [],
  },

  // ============================================================================
  // FRONTIER DISCOVERY
  // ============================================================================

  {
    id: 'exploration.frontier_discovery.epic.medium',
    category: EventCategory.Exploratory,
    subtype: 'frontier_discovery',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 35, max: 60 },
    template: 'Exploration around {data.settlementName} yielded a welcome surprise — {data.description}. The camp buzzed with excitement at the find.',
    requiredContext: [],
  },
  {
    id: 'exploration.frontier_discovery.scholarly.medium',
    category: EventCategory.Exploratory,
    subtype: 'frontier_discovery',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 35, max: 60 },
    template: 'Survey teams from {data.settlementName} reported {data.description}. This finding may significantly improve the settlement\'s long-term viability.',
    requiredContext: [],
  },

  // ============================================================================
  // WORLD-REVEALED SECRETS
  // ============================================================================

  {
    id: 'exploration.world_revealed.epic.medium',
    category: EventCategory.Exploratory,
    subtype: 'world_revealed',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 35, max: 60 },
    template: 'The earth shook and the landscape shifted, revealing {data.locationType} long hidden beneath the surface. What nature concealed, nature had now laid bare.',
    requiredContext: [],
  },
  {
    id: 'exploration.world_revealed.myth.high',
    category: EventCategory.Exploratory,
    subtype: 'world_revealed',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 50, max: 100 },
    template: 'The cataclysm tore the veil from ancient secrets. Where the disaster had scarred the land, {data.locationType} emerged from millennia of concealment — as if the world itself had decided it was time for hidden truths to be known.',
    requiredContext: [],
  },
  {
    id: 'exploration.world_revealed.scholarly.medium',
    category: EventCategory.Exploratory,
    subtype: 'world_revealed',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 35, max: 60 },
    template: 'Environmental disturbance at ({data.x}, {data.y}) exposed a previously concealed {data.locationType}. The site warrants immediate survey and documentation before further geological activity obscures the evidence.',
    requiredContext: [],
  },
  {
    id: 'exploration.world_revealed.personal.medium',
    category: EventCategory.Exploratory,
    subtype: 'world_revealed',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 35, max: 60 },
    template: 'When the dust settled after the tremors, travelers along the road noticed something new in the landscape — {data.locationType} where none had been before. Word spread quickly, and the curious came to see what the earth had uncovered.',
    requiredContext: [],
  },
];
