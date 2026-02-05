/**
 * Spatial indexing module — Quadtree, SpatialIndex facade, distance helpers.
 */

export { euclidean, euclideanSquared, manhattan, chebyshev, withinRadius, withinRect, circleIntersectsRect, rectsIntersect } from './distance.js';
export { Quadtree } from './quadtree.js';
export type { Bounds } from './quadtree.js';
export { SpatialIndex } from './spatial-index.js';
