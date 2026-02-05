import { describe, it, expect } from 'vitest';
import { Quadtree } from './quadtree.js';

describe('Quadtree', () => {
  describe('insert', () => {
    it('should insert a point within bounds', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      expect(qt.insert(50, 50, 'a')).toBe(true);
      expect(qt.size()).toBe(1);
    });

    it('should reject a point outside bounds', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      expect(qt.insert(150, 50, 'a')).toBe(false);
      expect(qt.size()).toBe(0);
    });

    it('should insert points at the boundary edges', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      expect(qt.insert(0, 0, 'origin')).toBe(true);
      expect(qt.insert(100, 100, 'corner')).toBe(true);
      expect(qt.insert(100, 0, 'topRight')).toBe(true);
      expect(qt.insert(0, 100, 'bottomLeft')).toBe(true);
      expect(qt.size()).toBe(4);
    });

    it('should subdivide when exceeding maxEntries', () => {
      const qt = new Quadtree<number>({ x: 0, y: 0, width: 100, height: 100 }, 4, 8);

      for (let i = 0; i < 5; i++) {
        qt.insert(i * 10, i * 10, i);
      }

      expect(qt.size()).toBe(5);
    });

    it('should handle many insertions into the same quadrant', () => {
      const qt = new Quadtree<number>({ x: 0, y: 0, width: 100, height: 100 }, 4, 8);

      // All points in NW quadrant
      for (let i = 0; i < 20; i++) {
        qt.insert(i, i, i);
      }

      expect(qt.size()).toBe(20);
    });

    it('should handle duplicate positions with different data', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      qt.insert(50, 50, 'a');
      qt.insert(50, 50, 'b');
      expect(qt.size()).toBe(2);
    });
  });

  describe('remove', () => {
    it('should remove an existing entry', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      qt.insert(50, 50, 'a');
      expect(qt.remove(50, 50, 'a')).toBe(true);
      expect(qt.size()).toBe(0);
    });

    it('should return false for non-existent entry', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      qt.insert(50, 50, 'a');
      expect(qt.remove(50, 50, 'b')).toBe(false);
      expect(qt.size()).toBe(1);
    });

    it('should return false for point outside bounds', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      expect(qt.remove(150, 150, 'a')).toBe(false);
    });

    it('should remove only the matching entry when duplicates exist', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      qt.insert(50, 50, 'a');
      qt.insert(50, 50, 'b');
      expect(qt.remove(50, 50, 'a')).toBe(true);
      expect(qt.size()).toBe(1);
    });

    it('should remove from subdivided tree', () => {
      const qt = new Quadtree<number>({ x: 0, y: 0, width: 100, height: 100 }, 2, 8);

      qt.insert(10, 10, 1);
      qt.insert(20, 20, 2);
      qt.insert(80, 80, 3);
      // After 3 inserts with maxEntries=2, tree should subdivide

      expect(qt.remove(80, 80, 3)).toBe(true);
      expect(qt.size()).toBe(2);
    });
  });

  describe('queryRect', () => {
    it('should return entries within a rectangle', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      qt.insert(10, 10, 'a');
      qt.insert(20, 20, 'b');
      qt.insert(80, 80, 'c');

      const results = qt.queryRect(0, 0, 50, 50);
      expect(results).toContain('a');
      expect(results).toContain('b');
      expect(results).not.toContain('c');
    });

    it('should return empty array for region with no entries', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      qt.insert(10, 10, 'a');

      const results = qt.queryRect(50, 50, 50, 50);
      expect(results).toHaveLength(0);
    });

    it('should return all entries when query covers entire bounds', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      qt.insert(10, 10, 'a');
      qt.insert(50, 50, 'b');
      qt.insert(90, 90, 'c');

      const results = qt.queryRect(0, 0, 100, 100);
      expect(results).toHaveLength(3);
    });
  });

  describe('queryRadius', () => {
    it('should return entries within a circular radius', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      qt.insert(50, 50, 'center');
      qt.insert(55, 50, 'near');
      qt.insert(90, 90, 'far');

      const results = qt.queryRadius(50, 50, 10);
      expect(results).toContain('center');
      expect(results).toContain('near');
      expect(results).not.toContain('far');
    });

    it('should include entries exactly on the radius boundary', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      qt.insert(50, 50, 'center');
      qt.insert(60, 50, 'onBoundary'); // distance = 10

      const results = qt.queryRadius(50, 50, 10);
      expect(results).toContain('onBoundary');
    });

    it('should return empty for radius query with no nearby entries', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      qt.insert(90, 90, 'far');

      const results = qt.queryRadius(10, 10, 5);
      expect(results).toHaveLength(0);
    });
  });

  describe('queryNearest', () => {
    it('should return the N nearest entries', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      qt.insert(50, 50, 'center');
      qt.insert(52, 50, 'close');
      qt.insert(60, 50, 'medium');
      qt.insert(90, 90, 'far');

      const results = qt.queryNearest(50, 50, 2);
      expect(results).toHaveLength(2);
      expect(results[0]).toBe('center');
      expect(results[1]).toBe('close');
    });

    it('should return all entries if count exceeds total', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      qt.insert(10, 10, 'a');
      qt.insert(20, 20, 'b');

      const results = qt.queryNearest(10, 10, 5);
      expect(results).toHaveLength(2);
    });

    it('should return entries sorted by distance', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      qt.insert(90, 90, 'far');
      qt.insert(10, 10, 'near');
      qt.insert(50, 50, 'mid');

      const results = qt.queryNearest(0, 0, 3);
      expect(results[0]).toBe('near');
      expect(results[1]).toBe('mid');
      expect(results[2]).toBe('far');
    });
  });

  describe('size', () => {
    it('should return 0 for empty tree', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      expect(qt.size()).toBe(0);
    });

    it('should track size across insertions and removals', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      qt.insert(10, 10, 'a');
      qt.insert(20, 20, 'b');
      expect(qt.size()).toBe(2);

      qt.remove(10, 10, 'a');
      expect(qt.size()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      qt.insert(10, 10, 'a');
      qt.insert(20, 20, 'b');
      qt.insert(30, 30, 'c');

      qt.clear();
      expect(qt.size()).toBe(0);
      expect(qt.queryRect(0, 0, 100, 100)).toHaveLength(0);
    });
  });

  describe('rebalance', () => {
    it('should maintain all entries after rebalancing', () => {
      const qt = new Quadtree<number>({ x: 0, y: 0, width: 100, height: 100 }, 4, 8);

      for (let i = 0; i < 20; i++) {
        qt.insert(i * 5, i * 5, i);
      }

      const sizeBefore = qt.size();
      qt.rebalance();
      expect(qt.size()).toBe(sizeBefore);

      // Verify all entries still queryable
      const all = qt.queryRect(0, 0, 100, 100);
      expect(all).toHaveLength(20);
    });
  });

  describe('getBounds and getDepth', () => {
    it('should return the bounds of the root node', () => {
      const qt = new Quadtree<string>({ x: 10, y: 20, width: 200, height: 300 });
      const bounds = qt.getBounds();
      expect(bounds.x).toBe(10);
      expect(bounds.y).toBe(20);
      expect(bounds.width).toBe(200);
      expect(bounds.height).toBe(300);
    });

    it('should return depth 0 for root node', () => {
      const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
      expect(qt.getDepth()).toBe(0);
    });
  });

  describe('performance', () => {
    it('should handle 10000 entities with query under 10ms', () => {
      const qt = new Quadtree<number>(
        { x: 0, y: 0, width: 10000, height: 10000 },
        16,
        10
      );

      // Insert 10000 entities at pseudo-random positions
      for (let i = 0; i < 10000; i++) {
        const x = (i * 7919) % 10000; // prime scatter
        const y = (i * 6271) % 10000;
        qt.insert(x, y, i);
      }

      expect(qt.size()).toBe(10000);

      // Warm-up query
      qt.queryRadius(5000, 5000, 500);

      // Timed radius query
      const start = performance.now();
      const results = qt.queryRadius(5000, 5000, 500);
      const elapsed = performance.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(10);
    });

    it('should handle 10000 entities with rect query under 10ms', () => {
      const qt = new Quadtree<number>(
        { x: 0, y: 0, width: 10000, height: 10000 },
        16,
        10
      );

      for (let i = 0; i < 10000; i++) {
        const x = (i * 7919) % 10000;
        const y = (i * 6271) % 10000;
        qt.insert(x, y, i);
      }

      // Warm-up
      qt.queryRect(4000, 4000, 2000, 2000);

      const start = performance.now();
      const results = qt.queryRect(4000, 4000, 2000, 2000);
      const elapsed = performance.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(10);
    });

    it('should handle 10000 entities with nearest query under 10ms', () => {
      const qt = new Quadtree<number>(
        { x: 0, y: 0, width: 10000, height: 10000 },
        16,
        10
      );

      for (let i = 0; i < 10000; i++) {
        const x = (i * 7919) % 10000;
        const y = (i * 6271) % 10000;
        qt.insert(x, y, i);
      }

      // Warm-up
      qt.queryNearest(5000, 5000, 10);

      const start = performance.now();
      const results = qt.queryNearest(5000, 5000, 10);
      const elapsed = performance.now() - start;

      expect(results).toHaveLength(10);
      expect(elapsed).toBeLessThan(10);
    });
  });
});
