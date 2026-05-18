import { quadtree, type Quadtree } from 'd3-quadtree';

/**
 * One indexed point in **pixel space**.
 *
 * `x`/`y` are already-projected screen coordinates (the chart runs its data
 * through the x/y scales once per render and feeds the results here), *not*
 * domain values. `datum` is the original row, carried through untouched so a
 * hit can drive a tooltip or a future click handler.
 */
export interface SpatialRecord<D> {
  /** Pixel-space x. */
  x: number;
  /** Pixel-space y. */
  y: number;
  /** The original datum this point came from. */
  datum: D;
}

/**
 * A thin internal wrapper around `d3-quadtree`, exposing only the spatial
 * query `ScatterChart` (and any future spatially-indexed chart — density
 * plots, a heatmap variant, anything with discrete points) needs.
 *
 * **Why a wrapper, not raw `d3-quadtree`.** `d3-quadtree`'s API is built
 * for mutation (`add`/`remove`) and accessor configuration (`.x()`/`.y()`),
 * and its `find` returns `undefined` (not `null`) and an *accessor-shaped*
 * datum. Charts shouldn't couple to those quirks: this class fixes the
 * accessors, builds once from a record array, and presents a single
 * `findNearest` returning `SpatialRecord | null`.
 *
 * **Not a heavy abstraction.** It deliberately does *not* re-expose
 * incremental add/remove, visiting, or extent — `ScatterChart`'s model is
 * "rebuild the index once per render pass" (building is `O(n log n)`;
 * doing it per `pointermove` would be the obvious performance mistake).
 * If a future chart needs incremental mutation, widen this then.
 *
 * Pure data structure: no PIXI, no DOM. Fully unit-testable in isolation.
 */
export class SpatialIndex<D> {
  private readonly tree: Quadtree<SpatialRecord<D>>;
  private readonly _size: number;

  /**
   * Build the index from `records`. Records are held **by reference** and
   * never mutated. An empty array is valid — every query then returns
   * `null`.
   */
  constructor(records: readonly SpatialRecord<D>[]) {
    this._size = records.length;
    this.tree = quadtree<SpatialRecord<D>>()
      .x((r) => r.x)
      .y((r) => r.y)
      // d3-quadtree's typings want a mutable array; it only reads here.
      .addAll(records as SpatialRecord<D>[]);
  }

  /**
   * Nearest record to `point` within `radius` **pixels**, or `null` if
   * nothing is that close (or the index is empty).
   *
   * Delegates to `d3-quadtree`'s `find(x, y, radius)`: an `O(log n)`-typical
   * search that returns the single closest datum inside the radius. Distance
   * is Euclidean in pixel space — exactly what a circular hit-target wants.
   */
  findNearest(point: { x: number; y: number }, radius: number): SpatialRecord<D> | null {
    return this.tree.find(point.x, point.y, radius) ?? null;
  }

  /** Number of indexed records. Useful for tests and diagnostics. */
  get size(): number {
    return this._size;
  }
}
