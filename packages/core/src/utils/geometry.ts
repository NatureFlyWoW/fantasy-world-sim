/**
 * Pure geometry utilities for Æternum.
 * These functions are rendering-agnostic and provide only mathematical operations.
 */

/**
 * A 2D integer point.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Draw a line between two points using Bresenham's line algorithm.
 * Returns an array of points along the line from (x0, y0) to (x1, y1) inclusive.
 *
 * This is a pure geometry function with no rendering logic.
 * Callers are responsible for interpreting the points (e.g., rasterizing to a grid,
 * drawing ASCII characters, rendering PixiJS graphics, etc.).
 *
 * @param x0 - Starting x coordinate
 * @param y0 - Starting y coordinate
 * @param x1 - Ending x coordinate
 * @param y1 - Ending y coordinate
 * @returns Array of points along the line, including start and end points
 *
 * @example
 * ```ts
 * const points = bresenhamLine(0, 0, 3, 2);
 * // Returns: [{x:0,y:0}, {x:1,y:1}, {x:2,y:1}, {x:3,y:2}]
 * ```
 */
export function bresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): Point[] {
  const points: Point[] = [];

  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  let cx = x0;
  let cy = y0;

  for (;;) {
    points.push({ x: cx, y: cy });

    if (cx === x1 && cy === y1) break;

    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      cx += sx;
    }
    if (e2 <= dx) {
      err += dx;
      cy += sy;
    }
  }

  return points;
}
