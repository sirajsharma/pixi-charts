import type { ScaleBand, ScaleLinear, ScaleLogarithmic, ScaleTime } from 'd3-scale';

/**
 * A unified abstraction over `d3-scale`'s scale types.
 *
 * **Why this exists.** D3's scale types are unrelated TypeScript shapes —
 * `ScaleBand` has no `.ticks()`, the continuous scales have no
 * `.bandwidth()`, and their domains have different element types
 * (`number` / `string` / `Date`). Library code that consumes scales (axes,
 * hit-testing, future charts) was previously forced to either discriminate
 * the union at every call site or carry a structural `ContinuousScale`
 * projection cast. `ScaleAdapter<TDomain>` is a thin internal wrapper that
 * gives consumers a single shape to work against and lets `Axis` become
 * correctly generic over its scale's domain — no more
 * `(value: number | string | Date) => string` formatter unions.
 *
 * **Why the `kind` discriminator is exposed.** A pure interface with no
 * discriminator is more abstract but forces optional-method checks
 * (`if (adapter.invert) { ... }`) at every site. Exposing `kind` lets
 * consumers write exhaustive switches when they genuinely need
 * scale-specific logic (e.g. a bar chart picking `bandwidth()` for bar
 * widths, or `InteractionLayer` choosing a hit-test strategy) without
 * `instanceof` checks against d3 internals.
 *
 * **Why we don't abstract `domain()` / `nice()`.** Scales must be
 * *constructed and configured* by the chart that owns them — domain from
 * data, range from layout, optional `.nice()`. The adapter is for
 * *consuming* a scale, not constructing one. Charts continue to build d3
 * scales directly, then wrap them in adapters for passing to `Axis` and
 * (in a later session) `InteractionLayer`.
 */
export interface ScaleAdapter<TDomain> {
  /**
   * Discriminator describing the underlying scale family.
   *
   * `'continuous'` covers linear and logarithmic; `'time'` is its own
   * value because time domains are `Date`, not `number`. Band scales get
   * `'band'`.
   */
  readonly kind: 'continuous' | 'band' | 'time';

  /** Project a domain value to a pixel position. */
  scale(value: TDomain): number;

  /**
   * Project a pixel position back to a domain value. Only present on
   * continuous and time scales — band scales have no meaningful inverse
   * (pixel-to-category needs manual iteration; see a future
   * `InteractionLayer`).
   */
  invert?(pixel: number): TDomain;

  /**
   * Return tick values in the domain.
   *
   * For continuous and time scales this delegates to `d3-scale`'s
   * `ticks(count)`. For band scales the count argument is ignored and the
   * full domain is returned (band scales have no notion of "fewer ticks").
   */
  ticks(count?: number): TDomain[];

  /** A defensive copy of the scale's pixel range as a 2-tuple. */
  range(): [number, number];

  /** Width of one band, in pixels. Only present on band scales. */
  bandwidth?(): number;

  /**
   * Return a formatter appropriate to the underlying scale, used as the
   * default when no custom `tickFormat` is supplied. For band scales the
   * returned function is the identity, and both arguments are ignored.
   */
  tickFormat(count?: number, specifier?: string): (value: TDomain) => string;
}

/**
 * Wrap a continuous numeric d3 scale (linear or logarithmic) as a
 * {@link ScaleAdapter}.
 *
 * Sets `kind: 'continuous'`. Exposes `invert`. Does not expose
 * `bandwidth`. `ticks` and `tickFormat` delegate directly to the
 * underlying scale.
 */
export function linearAdapter(
  scale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>,
): ScaleAdapter<number> {
  return {
    kind: 'continuous',
    scale: (v) => scale(v),
    invert: (pixel) => scale.invert(pixel),
    ticks: (count) => scale.ticks(count),
    range: () => {
      const r = scale.range();
      return [r[0] ?? 0, r[1] ?? 0];
    },
    tickFormat: (count, specifier) => scale.tickFormat(count, specifier),
  };
}

/**
 * Wrap a `ScaleBand<string>` d3 scale as a {@link ScaleAdapter}.
 *
 * Sets `kind: 'band'`. Exposes `bandwidth`. Does not expose `invert`.
 * `ticks` returns a fresh copy of the scale's domain regardless of the
 * count argument; `tickFormat` returns the identity function.
 */
export function bandAdapter(scale: ScaleBand<string>): ScaleAdapter<string> {
  return {
    kind: 'band',
    scale: (v) => scale(v) ?? 0,
    ticks: () => [...scale.domain()],
    range: () => {
      const r = scale.range();
      return [r[0], r[1]];
    },
    bandwidth: () => scale.bandwidth(),
    tickFormat: () => (v) => v,
  };
}

/**
 * Wrap a `ScaleTime<number, number>` d3 scale as a {@link ScaleAdapter}.
 *
 * Sets `kind: 'time'`. Exposes `invert`. Does not expose `bandwidth`.
 * `ticks` and `tickFormat` delegate directly to the underlying scale.
 */
export function timeAdapter(scale: ScaleTime<number, number>): ScaleAdapter<Date> {
  return {
    kind: 'time',
    scale: (v) => scale(v),
    invert: (pixel) => scale.invert(pixel),
    ticks: (count) => scale.ticks(count),
    range: () => {
      const r = scale.range();
      return [r[0] ?? 0, r[1] ?? 0];
    },
    tickFormat: (count, specifier) => scale.tickFormat(count, specifier),
  };
}
