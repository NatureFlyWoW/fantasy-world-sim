/**
 * Disaster event narrative templates.
 * Covers: earthquake, plague, flood, volcanic eruption, magical blight, ecological collapse
 */

import { EventCategory } from '@fws/core';
import type { NarrativeTemplate } from './types.js';
import { NarrativeTone } from './types.js';

export const disasterTemplates: NarrativeTemplate[] = [
  // ============================================================================
  // EARTHQUAKE
  // ============================================================================

  {
    id: 'disaster.earthquake.epic.medium',
    category: EventCategory.Disaster,
    subtype: 'earthquake',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 41, max: 70 },
    template: 'The earth shook at {site.name}. Buildings crumbled, cracks opened in the streets, and the people fled in terror from the shifting ground beneath their feet.',
    requiredContext: [],
  },
  {
    id: 'disaster.earthquake.epic.high',
    category: EventCategory.Disaster,
    subtype: 'earthquake',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The great earthquake struck without warning, and {site.name} was forever changed. Towers that had stood for centuries collapsed in moments. The death toll was beyond counting, and the survivors would rebuild a very different city on the ruins.',
    requiredContext: [],
  },
  {
    id: 'disaster.earthquake.myth.high',
    category: EventCategory.Disaster,
    subtype: 'earthquake',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The very bones of the earth groaned as titanic forces clashed beneath the surface. What mortals built, the earth reclaimed in a single terrible moment. Some said the gods were angry; others, that ancient powers beneath the world had awakened.',
    requiredContext: [],
  },
  {
    id: 'disaster.earthquake.personal.high',
    category: EventCategory.Disaster,
    subtype: 'earthquake',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} felt the ground heave beneath {pronoun.possessive} feet and knew immediately that this was different. This was the end of the world as {pronoun.subject} knew it. {pronoun.subject} ran, not knowing if {pronoun.subject} was running toward safety or toward death.',
    requiredContext: [],
  },

  // ============================================================================
  // PLAGUE
  // ============================================================================

  {
    id: 'disaster.plague.epic.high',
    category: EventCategory.Disaster,
    subtype: 'plague',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The great plague swept across {faction.name}, leaving devastation in its wake. No wall could stop it, no medicine cure it. Before it finally burned itself out, it had claimed a generation. The realm would never be the same.',
    requiredContext: [],
  },
  {
    id: 'disaster.plague.myth.high',
    category: EventCategory.Disaster,
    subtype: 'plague',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'Death rode through the land, and the living could only watch in horror. The plague was no natural thing—it bore the mark of powers beyond mortal understanding. Some called it divine judgment; others, a curse from darker places.',
    requiredContext: [],
  },
  {
    id: 'disaster.plague.personal.high',
    category: EventCategory.Disaster,
    subtype: 'plague',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: '{character.name} watched {pronoun.possessive} loved ones fall, one by one. {pronoun.subject} prayed and wept and raged, but the sickness showed no mercy. When at last {pronoun.subject} stood alone among the dead, {pronoun.subject} wondered why {pronoun.subject} had been spared.',
    requiredContext: [],
  },
  {
    id: 'disaster.plague.scholarly.high',
    category: EventCategory.Disaster,
    subtype: 'plague',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 71, max: 100 },
    template: 'Demographic analysis indicates mortality rates between 30% and 50% in affected regions. Contemporary accounts describe symptoms consistent with hemorrhagic fever, though definitive identification remains controversial.',
    requiredContext: [],
  },

  // ============================================================================
  // FLOOD
  // ============================================================================

  {
    id: 'disaster.flood.epic.high',
    category: EventCategory.Disaster,
    subtype: 'flood',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The waters rose without mercy, consuming everything in their path. Fields became lakes, villages became graves, and the survivors fled to high ground with nothing but their lives. The great flood would be spoken of for generations.',
    requiredContext: [],
  },
  {
    id: 'disaster.flood.myth.high',
    category: EventCategory.Disaster,
    subtype: 'flood',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The waters of the deep rose to reclaim what mortals had built. It was as if the world was being washed clean, returned to the primordial chaos from which it had first emerged. Only the chosen few would survive to rebuild.',
    requiredContext: [],
  },
  {
    id: 'disaster.flood.personal.medium',
    category: EventCategory.Disaster,
    subtype: 'flood',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 41, max: 70 },
    template: '{character.name} watched the rising waters with growing dread. Everything {pronoun.subject} had built, everything {pronoun.subject} loved—the river was taking it all. There was nothing {pronoun.subject} could do but run.',
    requiredContext: [],
  },

  // ============================================================================
  // VOLCANIC ERUPTION
  // ============================================================================

  {
    id: 'disaster.volcanic_eruption.epic.high',
    category: EventCategory.Disaster,
    subtype: 'volcanic_eruption',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The mountain roared, and fire rained from the sky. The eruption buried {site.name} beneath ash and stone, preserving it forever as a monument to the power of forces beyond mortal control.',
    requiredContext: [],
  },
  {
    id: 'disaster.volcanic_eruption.myth.high',
    category: EventCategory.Disaster,
    subtype: 'volcanic_eruption',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The fire mountain awakened, and the gods of the deep unleashed their fury upon the world. Molten rock flowed like blood from a wound in the earth, and the sky turned dark as night. It was as if creation itself was being unmade.',
    requiredContext: [],
  },
  {
    id: 'disaster.volcanic_eruption.personal.high',
    category: EventCategory.Disaster,
    subtype: 'volcanic_eruption',
    tone: NarrativeTone.PersonalCharacterFocus,
    significanceRange: { min: 71, max: 100 },
    template: 'The ground shook beneath {character.name}\'s feet as the mountain exploded. The sound was beyond imagining—the end of the world made audible. {pronoun.subject} ran as ash fell like snow and the air grew thick with sulfur and fear.',
    requiredContext: [],
  },

  // ============================================================================
  // MAGICAL BLIGHT
  // ============================================================================

  {
    id: 'disaster.magical_blight.epic.high',
    category: EventCategory.Disaster,
    subtype: 'magical_blight',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'A magical blight spread across the land, corrupting everything it touched. Crops withered, water turned foul, and the very air became poison. The cause was arcane, and so too must be the cure—if any could be found.',
    requiredContext: [],
  },
  {
    id: 'disaster.magical_blight.myth.high',
    category: EventCategory.Disaster,
    subtype: 'magical_blight',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The corruption seeped into the land like a wound that would not heal. Some said it was a curse, others the remnant of forgotten magic. Whatever its source, it twisted nature itself, creating abominations where once there had been life.',
    requiredContext: [],
  },

  // ============================================================================
  // ECOLOGICAL COLLAPSE
  // ============================================================================

  {
    id: 'disaster.ecological_collapse.epic.high',
    category: EventCategory.Disaster,
    subtype: 'ecological_collapse',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 71, max: 100 },
    template: 'The delicate balance of nature in {site.name} collapsed entirely. Fish died in the rivers, birds fell from the sky, and the forests grew silent. What had taken ages to build was destroyed in the span of a single season.',
    requiredContext: [],
  },
  {
    id: 'disaster.ecological_collapse.scholarly.high',
    category: EventCategory.Disaster,
    subtype: 'ecological_collapse',
    tone: NarrativeTone.Scholarly,
    significanceRange: { min: 71, max: 100 },
    template: 'Environmental records indicate a cascading ecosystem failure during this period. Species extinctions and habitat degradation created a feedback loop that fundamentally altered the regional ecology.',
    requiredContext: [],
  },
  {
    id: 'disaster.ecological_collapse.myth.high',
    category: EventCategory.Disaster,
    subtype: 'ecological_collapse',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 71, max: 100 },
    template: 'The spirits of the land fled, and with them went the life they had nurtured. The old pact between mortals and nature was broken, and the world grew cold and silent. What remained was but a shadow of what had been.',
    requiredContext: [],
  },

  // ============================================================================
  // DEFAULT FALLBACK
  // ============================================================================

  {
    id: 'disaster.default.epic',
    category: EventCategory.Disaster,
    subtype: 'default',
    tone: NarrativeTone.EpicHistorical,
    significanceRange: { min: 0, max: 100 },
    template: 'A great disaster struck, leaving devastation in its wake.',
    requiredContext: [],
  },
  {
    id: 'disaster.default.myth',
    category: EventCategory.Disaster,
    subtype: 'default',
    tone: NarrativeTone.Mythological,
    significanceRange: { min: 0, max: 100 },
    template: 'The forces of destruction were unleashed upon the world.',
    requiredContext: [],
  },
];
