import { describe, it, expect } from 'vitest';
import { bresenhamLine } from './geometry.js';

describe('bresenhamLine', () => {
  it('draws a horizontal line', () => {
    const points = bresenhamLine(0, 0, 3, 0);
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it('draws a vertical line', () => {
    const points = bresenhamLine(0, 0, 0, 3);
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
    ]);
  });

  it('draws a diagonal line', () => {
    const points = bresenhamLine(0, 0, 3, 3);
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]);
  });

  it('draws a line with positive slope < 1', () => {
    const points = bresenhamLine(0, 0, 3, 2);
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 2 },
    ]);
  });

  it('draws a line with negative slope', () => {
    const points = bresenhamLine(0, 3, 3, 0);
    expect(points).toEqual([
      { x: 0, y: 3 },
      { x: 1, y: 2 },
      { x: 2, y: 1 },
      { x: 3, y: 0 },
    ]);
  });

  it('draws a line backward (x1 < x0)', () => {
    const points = bresenhamLine(3, 0, 0, 0);
    expect(points).toEqual([
      { x: 3, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ]);
  });

  it('draws a line backward (y1 < y0)', () => {
    const points = bresenhamLine(0, 3, 0, 0);
    expect(points).toEqual([
      { x: 0, y: 3 },
      { x: 0, y: 2 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ]);
  });

  it('handles a single point (start == end)', () => {
    const points = bresenhamLine(5, 5, 5, 5);
    expect(points).toEqual([{ x: 5, y: 5 }]);
  });

  it('includes both start and end points', () => {
    const points = bresenhamLine(1, 1, 4, 3);
    expect(points[0]).toEqual({ x: 1, y: 1 });
    expect(points[points.length - 1]).toEqual({ x: 4, y: 3 });
  });

  it('produces correct number of points for steep line', () => {
    const points = bresenhamLine(0, 0, 2, 5);
    // Should have 6 points (0→5 inclusive)
    expect(points.length).toBe(6);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1]).toEqual({ x: 2, y: 5 });
  });
});
