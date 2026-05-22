import { describe, expect, it } from 'vitest';

import { angleInRange, pointInRing, pointToAngle } from '../../src/utils/geometry.js';

const TWO_PI = Math.PI * 2;

describe('pointToAngle — cardinal directions', () => {
  // These four tests double as documentation of the screen-coordinate
  // convention (y grows downward; angles increase clockwise on screen).
  it("(1, 0) → 0 (right / 3 o'clock)", () => {
    expect(pointToAngle(1, 0)).toBeCloseTo(0, 12);
  });

  it("(0, 1) → π/2 (down / 6 o'clock)", () => {
    expect(pointToAngle(0, 1)).toBeCloseTo(Math.PI / 2, 12);
  });

  it("(-1, 0) → π (left / 9 o'clock)", () => {
    expect(pointToAngle(-1, 0)).toBeCloseTo(Math.PI, 12);
  });

  it("(0, -1) → 3π/2 (up / 12 o'clock)", () => {
    expect(pointToAngle(0, -1)).toBeCloseTo((3 * Math.PI) / 2, 12);
  });
});

describe('pointToAngle — diagonals', () => {
  it('(1, 1) → π/4 (4:30 — down-right)', () => {
    expect(pointToAngle(1, 1)).toBeCloseTo(Math.PI / 4, 12);
  });

  it('(-1, 1) → 3π/4 (7:30 — down-left)', () => {
    expect(pointToAngle(-1, 1)).toBeCloseTo((3 * Math.PI) / 4, 12);
  });

  it('(-1, -1) → 5π/4 (10:30 — up-left)', () => {
    expect(pointToAngle(-1, -1)).toBeCloseTo((5 * Math.PI) / 4, 12);
  });

  it('(1, -1) → 7π/4 (1:30 — up-right)', () => {
    expect(pointToAngle(1, -1)).toBeCloseTo((7 * Math.PI) / 4, 12);
  });
});

describe('pointToAngle — range guarantees', () => {
  it('returns a value in [0, 2π) for varied inputs', () => {
    for (const [dx, dy] of [
      [3, 5],
      [-7, 2],
      [-0.3, -0.4],
      [11, -9],
      [0.0001, -0.0001],
    ] as const) {
      const a = pointToAngle(dx, dy);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(TWO_PI);
    }
  });

  it('origin maps to 0 (atan2(0, 0) convention)', () => {
    expect(pointToAngle(0, 0)).toBe(0);
  });
});

describe('pointInRing — full disk (innerRadius = 0)', () => {
  it('point inside the disk returns true', () => {
    expect(pointInRing(3, 4, 0, 10)).toBe(true); // r = 5
  });

  it('point exactly on the outer boundary returns true (inclusive)', () => {
    expect(pointInRing(10, 0, 0, 10)).toBe(true);
    expect(pointInRing(0, 10, 0, 10)).toBe(true);
  });

  it('point outside the outer boundary returns false', () => {
    expect(pointInRing(11, 0, 0, 10)).toBe(false);
  });

  it('the center itself returns true', () => {
    expect(pointInRing(0, 0, 0, 10)).toBe(true);
  });
});

describe('pointInRing — annular ring (donut)', () => {
  it('point inside the ring returns true', () => {
    expect(pointInRing(0, 7, 5, 10)).toBe(true);
  });

  it('point inside the hole returns false', () => {
    expect(pointInRing(0, 3, 5, 10)).toBe(false);
  });

  it('the center (deep in the hole) returns false', () => {
    expect(pointInRing(0, 0, 5, 10)).toBe(false);
  });

  it('point exactly on the inner boundary returns true (inclusive)', () => {
    expect(pointInRing(5, 0, 5, 10)).toBe(true);
  });

  it('point exactly on the outer boundary returns true (inclusive)', () => {
    expect(pointInRing(0, -10, 5, 10)).toBe(true);
  });

  it('point well outside the outer boundary returns false', () => {
    expect(pointInRing(20, 20, 5, 10)).toBe(false);
  });
});

describe('angleInRange — non-wrap (start <= end)', () => {
  it('angle inside the range returns true', () => {
    expect(angleInRange(1.0, 0.5, 1.5)).toBe(true);
  });

  it('angle below the start returns false', () => {
    expect(angleInRange(0.4, 0.5, 1.5)).toBe(false);
  });

  it('angle above the end returns false', () => {
    expect(angleInRange(1.6, 0.5, 1.5)).toBe(false);
  });

  it('angle exactly on start returns true (inclusive)', () => {
    expect(angleInRange(0.5, 0.5, 1.5)).toBe(true);
  });

  it('angle exactly on end returns true (inclusive)', () => {
    expect(angleInRange(1.5, 0.5, 1.5)).toBe(true);
  });
});

describe('angleInRange — wraparound (start > end)', () => {
  it('angle in the upper half of the wrap (above start) returns true', () => {
    // range = 5.5 → 2π → 0.5
    expect(angleInRange(5.7, 5.5, 0.5)).toBe(true);
  });

  it('angle in the lower half of the wrap (below end) returns true', () => {
    expect(angleInRange(0.1, 5.5, 0.5)).toBe(true);
  });

  it("angle in the 'gap' between end and start returns false", () => {
    // The non-covered arc is (0.5, 5.5).
    expect(angleInRange(3.0, 5.5, 0.5)).toBe(false);
    expect(angleInRange(1.0, 5.5, 0.5)).toBe(false);
    expect(angleInRange(5.0, 5.5, 0.5)).toBe(false);
  });

  it('angle exactly on start returns true', () => {
    expect(angleInRange(5.5, 5.5, 0.5)).toBe(true);
  });

  it('angle exactly on end returns true', () => {
    expect(angleInRange(0.5, 5.5, 0.5)).toBe(true);
  });
});
