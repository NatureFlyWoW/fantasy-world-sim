/**
 * Generic Quadtree for efficient spatial queries.
 * Subdivides 2D space into four quadrants recursively.
 */

import { euclideanSquared, withinRect, circleIntersectsRect, rectsIntersect } from './distance.js';

/**
 * Axis-aligned bounding box.
 */
export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * A point with associated data stored in the quadtree.
 */
interface QuadtreeEntry<T> {
  readonly x: number;
  readonly y: number;
  readonly data: T;
}

export class Quadtree<T> {
  private entries: QuadtreeEntry<T>[] = [];
  private children: [Quadtree<T>, Quadtree<T>, Quadtree<T>, Quadtree<T>] | undefined;
  private depth: number;

  constructor(
    private readonly bounds: Bounds,
    private readonly maxEntries: number = 8,
    private readonly maxDepth: number = 8,
    depth = 0
  ) {
    this.depth = depth;
  }

  /**
   * Insert a point with associated data.
   */
  insert(x: number, y: number, data: T): boolean {
    // Point must be within bounds
    if (!withinRect(x, y, this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height)) {
      return false;
    }

    // If we have children, delegate to the appropriate child
    if (this.children !== undefined) {
      return this.insertIntoChild(x, y, data);
    }

    // Add to this node
    this.entries.push({ x, y, data });

    // Subdivide if needed
    if (this.entries.length > this.maxEntries && this.depth < this.maxDepth) {
      this.subdivide();
    }

    return true;
  }

  /**
   * Remove a point with matching data.
   * Returns true if the entry was found and removed.
   */
  remove(x: number, y: number, data: T): boolean {
    if (!withinRect(x, y, this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height)) {
      return false;
    }

    if (this.children !== undefined) {
      for (const child of this.children) {
        if (child.remove(x, y, data)) {
          return true;
        }
      }
      return false;
    }

    const index = this.entries.findIndex(
      (entry) => entry.x === x && entry.y === y && entry.data === data
    );

    if (index === -1) {
      return false;
    }

    this.entries.splice(index, 1);
    return true;
  }

  /**
   * Query all entries within a rectangular region.
   */
  queryRect(x: number, y: number, width: number, height: number): T[] {
    const results: T[] = [];
    this.queryRectInternal(x, y, width, height, results);
    return results;
  }

  /**
   * Query all entries within a circular radius.
   */
  queryRadius(cx: number, cy: number, radius: number): T[] {
    const results: T[] = [];
    this.queryRadiusInternal(cx, cy, radius, results);
    return results;
  }

  /**
   * Query the nearest N entries to a point.
   */
  queryNearest(x: number, y: number, count: number): T[] {
    // Collect all entries with distances
    const allWithDist: Array<{ data: T; distSq: number }> = [];
    this.collectAllWithDistance(x, y, allWithDist);

    // Sort by distance and take the closest
    allWithDist.sort((a, b) => a.distSq - b.distSq);

    return allWithDist.slice(0, count).map((entry) => entry.data);
  }

  /**
   * Get the total number of entries in the tree.
   */
  size(): number {
    if (this.children !== undefined) {
      let total = 0;
      for (const child of this.children) {
        total += child.size();
      }
      return total;
    }
    return this.entries.length;
  }

  /**
   * Clear all entries and children.
   */
  clear(): void {
    this.entries = [];
    this.children = undefined;
  }

  /**
   * Rebuild the tree from scratch (rebalance).
   */
  rebalance(): void {
    // Collect all entries
    const allEntries: QuadtreeEntry<T>[] = [];
    this.collectAll(allEntries);

    // Clear and re-insert
    this.clear();
    for (const entry of allEntries) {
      this.insert(entry.x, entry.y, entry.data);
    }
  }

  /**
   * Get the bounds of this quadtree node.
   */
  getBounds(): Bounds {
    return this.bounds;
  }

  /**
   * Get the depth of this node.
   */
  getDepth(): number {
    return this.depth;
  }

  /**
   * Get all entries in this node (not children).
   */
  getEntries(): ReadonlyArray<{ x: number; y: number; data: T }> {
    return this.entries;
  }

  // --- Internal methods ---

  private subdivide(): void {
    const halfW = this.bounds.width / 2;
    const halfH = this.bounds.height / 2;
    const x = this.bounds.x;
    const y = this.bounds.y;
    const nextDepth = this.depth + 1;

    this.children = [
      // NW
      new Quadtree<T>({ x, y, width: halfW, height: halfH }, this.maxEntries, this.maxDepth, nextDepth),
      // NE
      new Quadtree<T>({ x: x + halfW, y, width: halfW, height: halfH }, this.maxEntries, this.maxDepth, nextDepth),
      // SW
      new Quadtree<T>({ x, y: y + halfH, width: halfW, height: halfH }, this.maxEntries, this.maxDepth, nextDepth),
      // SE
      new Quadtree<T>({ x: x + halfW, y: y + halfH, width: halfW, height: halfH }, this.maxEntries, this.maxDepth, nextDepth),
    ];

    // Re-insert existing entries into children
    const existingEntries = this.entries;
    this.entries = [];

    for (const entry of existingEntries) {
      this.insertIntoChild(entry.x, entry.y, entry.data);
    }
  }

  private insertIntoChild(x: number, y: number, data: T): boolean {
    if (this.children === undefined) return false;

    for (const child of this.children) {
      if (child.insert(x, y, data)) {
        return true;
      }
    }

    // Point didn't fit in any child (shouldn't happen if bounds are correct)
    // Store it in this node as a fallback
    this.entries.push({ x, y, data });
    return true;
  }

  private queryRectInternal(
    qx: number,
    qy: number,
    qw: number,
    qh: number,
    results: T[]
  ): void {
    // Check if query rect intersects this node's bounds
    if (!rectsIntersect(
      this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height,
      qx, qy, qw, qh
    )) {
      return;
    }

    // Check entries in this node
    for (const entry of this.entries) {
      if (withinRect(entry.x, entry.y, qx, qy, qw, qh)) {
        results.push(entry.data);
      }
    }

    // Recurse into children
    if (this.children !== undefined) {
      for (const child of this.children) {
        child.queryRectInternal(qx, qy, qw, qh, results);
      }
    }
  }

  private queryRadiusInternal(
    cx: number,
    cy: number,
    radius: number,
    results: T[]
  ): void {
    // Check if circle intersects this node's bounds
    if (!circleIntersectsRect(
      cx, cy, radius,
      this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height
    )) {
      return;
    }

    const radiusSq = radius * radius;

    // Check entries in this node
    for (const entry of this.entries) {
      if (euclideanSquared(entry.x, entry.y, cx, cy) <= radiusSq) {
        results.push(entry.data);
      }
    }

    // Recurse into children
    if (this.children !== undefined) {
      for (const child of this.children) {
        child.queryRadiusInternal(cx, cy, radius, results);
      }
    }
  }

  private collectAllWithDistance(
    x: number,
    y: number,
    results: Array<{ data: T; distSq: number }>
  ): void {
    for (const entry of this.entries) {
      results.push({
        data: entry.data,
        distSq: euclideanSquared(entry.x, entry.y, x, y),
      });
    }

    if (this.children !== undefined) {
      for (const child of this.children) {
        child.collectAllWithDistance(x, y, results);
      }
    }
  }

  private collectAll(results: QuadtreeEntry<T>[]): void {
    for (const entry of this.entries) {
      results.push(entry);
    }

    if (this.children !== undefined) {
      for (const child of this.children) {
        child.collectAll(results);
      }
    }
  }
}
