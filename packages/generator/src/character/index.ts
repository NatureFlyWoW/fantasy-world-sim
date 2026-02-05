/**
 * Character module — name generation with Markov chains and cultural presets.
 */

export { MarkovChainGenerator } from './markov.js';

export { getAllCultures, getCulture, CULTURE_IDS } from './name-culture.js';
export type { NameCulture } from './name-culture.js';

export type { CultureNameData } from './name-data.js';

export { NameGenerator } from './name-generator.js';
export type { PersonName } from './name-generator.js';
