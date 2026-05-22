/**
 * Polar-coordinate helpers used by `PieChart`'s slice layout and hit-tester.
 *
 * **Coordinate convention.** Pixel-space y grows downward (the standard
 * screen / canvas convention). Under this convention:
 *
 *   - `angle = 0` points to the right (3 o'clock).
 *   - Angles **increase clockwise** as seen on screen.
 *   - 12 o'clock corresponds to `3π/2` (≈ 4.712); 6 o'clock to `π/2`.
 *
 * This is `Math.atan2`'s natural output under a y-down coordinate system —
 * the page does not flip y, so atan2's mathematical "counter-clockwise"
 * appears clockwise to the viewer. Every contributor will re-derive this
 * the hard way; the JSDoc and the unit tests in `tests/utils/geometry.test.ts`
 * document it explicitly.
 *
 * Pure functions: no PIXI, no DOM, no allocation. Trivially unit-testable.
 * Mirrors the {@link import('./quadtree.js').SpatialIndex} discipline of
 * keeping math primitives independent of the rendering layer.
 */

const TWO_PI = Math.PI * 2;

/**
 * Convert an `(dx, dy)` offset relative to a center to a polar angle in
 * `[0, 2π)`, using the screen-coordinate convention described in this
 * module's preamble.
 *
 * Implementation: `Math.atan2(dy, dx)` returns a value in `(-π, π]`; we
 * fold the negative half into `[π, 2π)` by adding `2π`. The result is
 * **always finite and always in `[0, 2π)`** (the only edge case is
 * `(0, 0)` which atan2 maps to `0`).
 *
 * @example
 * pointToAngle(1, 0);   // 0      (right / 3 o'clock)
 * pointToAngle(0, 1);   // π/2    (down  / 6 o'clock)
 * pointToAngle(-1, 0);  // π      (left  / 9 o'clock)
 * pointToAngle(0, -1);  // 3π/2   (up    / 12 o'clock)
 */
export function pointToAngle(dx: number, dy: number): number {
  const raw = Math.atan2(dy, dx);
  return raw < 0 ? raw + TWO_PI : raw;
}

/**
 * Test whether a point at offset `(dx, dy)` from a center lies inside an
 * annular ring with the given inner and outer radii. Pass `innerRadius = 0`
 * to test a full disk.
 *
 * Boundaries are **inclusive on both sides** — a point exactly on the
 * inner or outer circle returns `true`. This matters for `PieChart`'s
 * hit-test at the exact edge of a slice: inclusive boundaries mean the
 * cursor never "falls through" a slice while still nominally over it.
 *
 * Compares squared distances to avoid a `Math.sqrt`. Not a measurable
 * perf win at pie-chart scale, but keeps the function allocation- and
 * call-free.
 */
export function pointInRing(
  dx: number,
  dy: number,
  innerRadius: number,
  outerRadius: number,
): boolean {
  const r2 = dx * dx + dy * dy;
  return r2 >= innerRadius * innerRadius && r2 <= outerRadius * outerRadius;
}

/**
 * Test whether `angle` (in `[0, 2π)`) falls inside an angular range
 * `[start, end]` (both also in `[0, 2π)`).
 *
 * Handles **wraparound**: if `end < start`, the range is taken to cross
 * the `2π → 0` boundary clockwise. For example, `angleInRange(0.1, 5.5,
 * 0.5)` returns `true` because the range `[5.5, 0.5]` goes `5.5 → 2π →
 * 0.5` and `0.1` falls inside that arc.
 *
 * Boundaries are **inclusive on both sides** — same rationale as
 * {@link pointInRing}.
 *
 * Callers are responsible for normalizing `angle`, `start`, and `end` into
 * `[0, 2π)` first; values outside that range produce undefined behavior.
 */
export function angleInRange(angle: number, start: number, end: number): boolean {
  if (start <= end) {
    return angle >= start && angle <= end;
  }
  // Wraparound: range crosses 0.
  return angle >= start || angle <= end;
}
