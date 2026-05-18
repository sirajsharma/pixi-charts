import type { EasingName } from '../core/animation.js';

/**
 * How a data field should be interpreted by the chart.
 *
 * - `'quantitative'` — numeric values (counts, measurements, currency).
 *   Mapped with a linear scale.
 * - `'categorical'` — discrete strings (categories, group names). Mapped
 *   with a band scale on positional channels; with a categorical palette
 *   on the color channel.
 * - `'temporal'` — date/time values. Parsed to `Date` and mapped with a
 *   time scale.
 */
export type FieldType = 'quantitative' | 'categorical' | 'temporal';

/**
 * The kinds of chart supported (or planned) by the spec dispatcher.
 *
 * Only `'line'` is implemented in this release; other types parse
 * successfully but will throw at {@link import('./render.js').render} time
 * with a "not implemented yet" message. The full union is declared up-front
 * so consumer code can author specs against the final API surface as new
 * chart types come online.
 */
export type ChartType = 'line' | 'area' | 'bar' | 'scatter' | 'heatmap' | 'pie';

/**
 * A reference to a column in `data` plus its interpretation.
 *
 * @example
 * ```ts
 * { field: 'revenue', type: 'quantitative' }
 * ```
 */
export interface EncodingField {
  /** Name of the column in each `data` row to read from. */
  field: string;
  /** How to interpret the column. See {@link FieldType}. */
  type: FieldType;
}

/**
 * Color channel encoding.
 *
 * For line / area / bar this is always categorical: the field's distinct
 * values produce one series (or one per-bar color) each — `type` is ignored
 * by those charts. `ScatterChart` (Session 7) is the first chart to support
 * a **quantitative** color field, mapped through a continuous sequential
 * scale instead of a discrete palette.
 */
export interface ColorEncoding {
  /** Name of the column to colour by. */
  field: string;
  /**
   * How the colour field is interpreted:
   *
   * - `'categorical'` — each distinct value gets a discrete colour from a
   *   categorical palette.
   * - `'quantitative'` — values are mapped through a continuous sequential
   *   colour scale (e.g. viridis), paired with a continuous legend.
   * - omitted — treated as categorical. (Line/area/bar are categorical-only
   *   and ignore this field; scatter must set `'quantitative'` explicitly to
   *   opt into continuous colour.)
   */
  type?: 'categorical' | 'quantitative';
  /**
   * Colour scheme name. For categorical fields, one of the categorical
   * scheme names ({@link import('../core/ColorScheme.js').categoricalSchemes});
   * for quantitative fields, one of the sequential scheme names
   * ({@link import('../core/ColorScheme.js').sequentialSchemes}). When
   * omitted the chart picks a sensible per-type default (`category10` for
   * categorical, `viridis` for quantitative).
   */
  scheme?: string;
}

/**
 * Channel-to-field mapping for a chart.
 *
 * Each chart type uses a different subset:
 * - Line / area / bar: `x` + `y` (+ optional `color` for series split).
 * - Scatter: `x` + `y` (+ optional `color`, `size`).
 * - Pie: `value` (+ optional `color`).
 * - Heatmap: `x` + `y` + `value` (+ optional `color`).
 *
 * Only the encodings relevant to a given chart are required — see
 * {@link import('./validate.js').validateChartSpec} for the per-type rules.
 */
export interface ChartEncoding {
  /** Positional x-axis encoding. */
  x?: EncodingField;
  /** Positional y-axis encoding. */
  y?: EncodingField;
  /** Color channel (categorical series split). */
  color?: ColorEncoding;
  /**
   * Size channel — scatter only. The field's values drive a square-root
   * radius scale (area ∝ value). Ignored by line/area/bar.
   */
  size?: { field: string };
  /** Value channel — pie / heatmap. Not consumed in this release. */
  value?: { field: string };
}

/**
 * Animation configuration for a chart.
 *
 * Only the initial "enter" animation is configurable in this release.
 * Update transitions (data-change animations) are deliberately out of scope
 * until the spec stabilises across more chart types.
 */
export interface AnimationOptions {
  /**
   * Initial draw-on animation.
   * - `true` (default) — animate with sensible defaults.
   * - `false` — render in final state immediately, no tween.
   * - object — animate with explicit `duration` (ms) and / or `ease`.
   *
   * `prefers-reduced-motion: reduce` always wins, regardless of this
   * setting — the underlying {@link import('../core/animation.js').tween}
   * short-circuits to the final frame in that case.
   */
  enter?:
    | boolean
    | {
        duration?: number;
        ease?: EasingName;
      };
}

/**
 * General chart options. All fields are optional; sensible defaults are
 * applied at the chart level.
 */
export interface ChartOptions {
  /** Title text. Not yet rendered. Reserved for v2. */
  title?: string;
  /**
   * Show the legend when the chart has one. Default `true`. Charts with a
   * single series ignore this and skip the legend regardless.
   */
  showLegend?: boolean;
  /** Show hover tooltips. Default `true`. */
  showTooltip?: boolean;
  /** Explicit canvas width in CSS pixels. Falls back to container size, then `600`. */
  width?: number;
  /** Explicit canvas height in CSS pixels. Falls back to container size, then `400`. */
  height?: number;
  /** Plot-area inset in CSS pixels. Any subset is allowed; missing edges use chart defaults. */
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  /**
   * Orientation of the chart. **Currently only meaningful for
   * `type: 'bar'`**, where it controls whether bars run vertically (band
   * scale on the x-axis, the default) or horizontally (band scale on the
   * y-axis). Defaults to `'vertical'` when omitted.
   *
   * It lives on `ChartOptions` rather than a bar-specific options object so
   * that programmatic specs keep a single options shape and a future chart
   * type that wants orientation can adopt it without a schema change. Line,
   * area, and every other current chart type **ignore** this field entirely
   * — the validator neither warns nor errors when it is set on them.
   */
  orientation?: 'vertical' | 'horizontal';
}

/**
 * The declarative spec consumed by {@link import('./render.js').render}.
 *
 * Roughly inspired by Vega-Lite's grammar — `type` + `data` + `encoding`
 * + `options` — without committing to its full algebra. Future chart
 * types add their own per-type rules in {@link import('./validate.js').validateChartSpec},
 * not new top-level fields.
 *
 * @example
 * ```ts
 * const spec: ChartSpec = {
 *   type: 'line',
 *   data: rows,
 *   encoding: {
 *     x: { field: 'date', type: 'temporal' },
 *     y: { field: 'revenue', type: 'quantitative' },
 *   },
 * };
 * ```
 */
export interface ChartSpec {
  /** Which chart type to render. */
  type: ChartType;
  /**
   * The rows to plot. Declared `ReadonlyArray<Record<string, unknown>>` to
   * signal the library does not mutate consumer data and to force
   * type-narrowing at use sites rather than implicit `any` access.
   */
  data: readonly Record<string, unknown>[];
  /** Channel-to-field mapping. See {@link ChartEncoding}. */
  encoding: ChartEncoding;
  /** General presentation options. See {@link ChartOptions}. */
  options?: ChartOptions;
  /** Animation configuration. See {@link AnimationOptions}. */
  animation?: AnimationOptions;
}
