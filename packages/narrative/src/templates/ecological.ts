/**
 * Ecological event narrative templates.
 * Covers: deforestation, species extinction, resource depletion, dragon territory expansion
 */

import { EventCategory } from '@fws/core';
import type { NarrativeTemplate } from './types.js';
import { NarrativeTone } from './types.js';

// Note: Ecological events map to EventCategory.Disaster for most cases

export const ecologicalTemplates: NarrativeTemplate[] = [
  // ============================================================================
  // DEFORESTATION
  // ============================================================================

  {
    id: 'ecological.deforestation.epic.medium',
    category: EventCategory.Disaster,
    subtype: 'deforestation',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'The ancient forests near {site.name} fell to the axe. What had taken centuries to grow was cleared in a single generation, making way for fields and settlements.',
    requiredContext: [],
  },
  {
    id: 'ecological.deforestation.epic.high',
    category: EventCategory.Disaster,
    subtype: 'deforestation',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The great forest that had defined the region was no more. Where ancient trees had stood for millennia, now only stumps remained. The land itself seemed diminished, its wildness tamed forever.',
    requiredContext: [],
  },
  {
    id: 'ecological.deforestation.myth.high',
    category: EventCategory.Disaster,
    subtype: 'deforestation',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The spirits of the wood fled as their domain was destroyed. The old pact between mortals and the wild was broken, and the fey retreated to places where axe and fire could not follow.',
    requiredContext: [],
  },
  {
    id: 'ecological.deforestation.scholarly.medium',
    category: EventCategory.Disaster,
    subtype: 'deforestation',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 41, max: 70 },
    template: 'Environmental records indicate significant forest loss during this period. The clearing of woodland for agriculture and timber resulted in measurable changes to local hydrology and climate.',
    requiredContext: [],
  },

  // ============================================================================
  // SPECIES EXTINCTION
  // ============================================================================

  {
    id: 'ecological.species_extinction.epic.high',
    category: EventCategory.Disaster,
    subtype: 'species_extinction',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The last of the great beasts passed from the world, and their kind would never be seen again. Hunters who had once pursued them now told tales of their glory to children who would never know them.',
    requiredContext: [],
  },
  {
    id: 'ecological.species_extinction.myth.high',
    category: EventCategory.Disaster,
    subtype: 'species_extinction',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The world grew smaller with the passing of the last of its kind. A thread in the tapestry of creation was cut, and the pattern was forever changed. What had been could never be again.',
    requiredContext: [],
  },
  {
    id: 'ecological.species_extinction.scholarly.high',
    category: EventCategory.Disaster,
    subtype: 'species_extinction',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 71, max: 100 },
    template: 'The extinction of this species represents a significant loss of biodiversity. Analysis of population records suggests overhunting and habitat destruction as primary causes.',
    requiredContext: [],
  },

  // ============================================================================
  // RESOURCE DEPLETION
  // ============================================================================

  {
    id: 'ecological.resource_depletion.epic.medium',
    category: EventCategory.Disaster,
    subtype: 'resource_depletion',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'The resources that had sustained {site.name} for generations were exhausted. The mines grew empty, the fields grew barren, and the people faced a harsh reckoning.',
    requiredContext: [],
  },
  {
    id: 'ecological.resource_depletion.epic.high',
    category: EventCategory.Disaster,
    subtype: 'resource_depletion',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The great wealth of {site.name} was no more. Prosperity built on extraction had reached its end, and a region that had known abundance now faced scarcity. The collapse rippled outward, affecting trade and politics across the realm.',
    requiredContext: [],
  },
  {
    id: 'ecological.resource_depletion.intrigue.high',
    category: EventCategory.Disaster,
    subtype: 'resource_depletion',
    tone: NarrativeTone.PoliticalIntrigue,
    significanceRange: { min: 71, max: 100 },
    template: 'The exhaustion of critical resources triggered fierce competition. Powers that had coexisted while resources were abundant now turned against each other in a struggle for what remained.',
    requiredContext: [],
  },
  {
    id: 'ecological.resource_depletion.personal.medium',
    category: EventCategory.Disaster,
    subtype: 'resource_depletion',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: '{character.name} looked at the empty stores that had once overflowed. {pronoun.possessive} family had prospered here for generations, but now there was nothing left. {pronoun.subject} would have to find a new way, or perish.',
    requiredContext: [],
  },

  // ============================================================================
  // DRAGON TERRITORY EXPANSION
  // ============================================================================

  {
    id: 'ecological.dragon_territory.epic.high',
    category: EventCategory.Disaster,
    subtype: 'dragon_territory',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'A great wyrm claimed new territory, forcing the inhabitants to flee or face its wrath. Where once farmers had tilled the soil, now only the dragon\'s shadow fell. None dared challenge its dominion.',
    requiredContext: [],
  },
  {
    id: 'ecological.dragon_territory.myth.high',
    category: EventCategory.Disaster,
    subtype: 'dragon_territory',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The ancient wyrm descended from its mountain fastness to claim dominion over the lowlands. Fire and fear preceded it, and mortals scattered before its power. A new age of dragon-rule had begun.',
    requiredContext: [],
  },
  {
    id: 'ecological.dragon_territory.personal.high',
    category: EventCategory.Disaster,
    subtype: 'dragon_territory',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} watched the dragon circle overhead and knew that everything {pronoun.subject} had built was lost. There was no fighting such a creature. There was only flight, and even that might not be fast enough.',
    requiredContext: [],
  },

  // ============================================================================
  // ENVIRONMENTAL DEGRADATION
  // ============================================================================

  {
    id: 'ecological.degradation.epic.medium',
    category: EventCategory.Disaster,
    subtype: 'environmental_degradation',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'The land around {site.name} grew sick. Soil eroded, water fouled, and what had been productive territory became a wasteland. The damage would take generations to repair, if it could be repaired at all.',
    requiredContext: [],
  },
  {
    id: 'ecological.degradation.scholarly.high',
    category: EventCategory.Disaster,
    subtype: 'environmental_degradation',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 71, max: 100 },
    template: 'Environmental analysis indicates severe degradation of the regional ecosystem. Soil profiles show depletion of nutrients, while water quality records document increasing contamination from agricultural and mining runoff.',
    requiredContext: [],
  },

  // ============================================================================
  // DEFAULT FALLBACK
  // ============================================================================

  {
    id: 'ecological.default.epic',
    category: EventCategory.Disaster,
    subtype: 'ecological.default',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 100 },
    template: 'The natural world underwent significant change, affecting all who depended upon it.',
    requiredContext: [],
  },
  {
    id: 'ecological.default.myth',
    category: EventCategory.Disaster,
    subtype: 'ecological.default',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 0, max: 100 },
    template: 'The balance of nature shifted, and the world was forever changed.',
    requiredContext: [],
  },
];
