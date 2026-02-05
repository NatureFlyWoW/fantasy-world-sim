/**
 * Distance calculation helpers for spatial operations.
 */

/**
 * Euclidean distance between two points.
 */
export function euclidean(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Squared Euclidean distance (avoids sqrt, useful for comparisons).
 */
export function euclideanSquared(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

/**
 * Manhattan distance between two points.
 */
export function manhattan(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

/**
 * Chebyshev distance between two points (king's move distance).
 */
export function chebyshev(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
}

/**
 * Check if a point is within a radius of another point.
 */
export function withinRadius(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  return euclideanSquared(px, py, cx, cy) <= radius * radius;
}

/**
 * Check if a point is inside an axis-aligned bounding box.
 */
export function withinRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/**
 * Check if a circle intersects an axis-aligned bounding box.
 * Used for quadtree range queries.
 */
export function circleIntersectsRect(
  cx: number,
  cy: number,
  radius: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  // Find closest point on rect to circle center
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  return euclideanSquared(cx, cy, closestX, closestY) <= radius * radius;
}

/**
 * Check if two axis-aligned bounding boxes intersect.
 */
export function rectsIntersect(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
