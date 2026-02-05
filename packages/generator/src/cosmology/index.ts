/**
 * Cosmology module — pantheon, magic system, planar structure.
 */

export { PantheonGenerator, Domain } from './pantheon.js';
export type { Deity, Pantheon, DivineRelationship, PersonalityTrait, RelationshipType } from './pantheon.js';

export { MagicSystemGenerator, MagicSchool, PowerSource } from './magic-system.js';
export type { MagicRules, MagicLimitation, SchoolInteraction } from './magic-system.js';

export { PlanarGenerator, PlaneType } from './planar.js';
export type { Plane, PlanarStructure, PlanarConnection } from './planar.js';
