import type { EasingName } from '../core/animation.js';
import type { Theme, ThemeColors } from '../core/theme.js';

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
 * The kinds of chart supported by the spec dispatcher.
 *
 * All listed types are implemented and dispatched by
 * {@link import('./render.js').render}. The union is closed: adding a new
 * chart type is a coordinated change across this file, the validator,
 * the dispatcher, and a chart implementation.
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
  /**
   * Value channel — used by `pie` (the numeric value each slice represents,
   * proportionally summed to the full circle) and reserved for `heatmap`'s
   * cell value. The field is interpreted as quantitative; missing or
   * non-finite values are skipped with a console warning.
   */
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
  /**
   * Inner radius for pie charts, in CSS pixels. `0` (the default) renders a
   * true pie; any positive value renders a donut. The value is clamped at
   * render time to `[0, outerRadius - 1]` so a too-large inner radius
   * degrades gracefully to "almost the full disk" rather than crashing.
   *
   * Like {@link orientation}, this lives on the general `ChartOptions` for
   * shape simplicity. Non-pie chart types ignore it — the validator
   * neither warns nor errors when it is set on them.
   */
  innerRadius?: number;
  /**
   * Starting angle of the pie sweep, in **radians**, using the same
   * screen-coordinate convention as
   * {@link import('../utils/geometry.js').pointToAngle}: `0` is 3 o'clock
   * and angles increase clockwise. The default is `-Math.PI / 2`
   * (12 o'clock — the most common pie-chart layout).
   *
   * Ignored by non-pie chart types; the validator does not warn or error
   * when it is set on them.
   */
  startAngle?: number;
  /**
   * Whether to render axis chrome (axis line, tick marks, tick labels, and
   * axis title). Default: `true`. Set to `false` for sparkline embeds, hero
   * charts, and other decorative chart instances that should render without
   * axis lines or tick labels.
   *
   * Gridlines are controlled separately by {@link showGrid}: with
   * `showAxes: false` and `showGrid: true`, only gridlines render.
   *
   * Ignored for chart types that have no cartesian axes (`pie`). Validation
   * does not warn or error when it is set on pie specs.
   */
  showAxes?: boolean;
  /**
   * Whether to render gridlines through the plot area. Default: `true`.
   * Independent of {@link showAxes} — you can show axes without gridlines
   * for a cleaner look, or gridlines without axes for a minimalist embed.
   *
   * Ignored for chart types without gridlines (`heatmap` already renders
   * none; `pie` has no gridlines at all).
   */
  showGrid?: boolean;
  /**
   * Axis titles. Optional semantic labels rendered alongside each axis to
   * describe what the axis represents (e.g. `Revenue (USD)`, `Months`). On
   * the x-axis the title sits below the tick labels, centered. On the
   * y-axis it sits to the left of the tick labels, rotated -90° so the
   * text reads bottom-to-top.
   *
   * Setting a title adds a fixed inset to the relevant margin so the title
   * has space to render without clipping the plot area.
   *
   * Ignored for chart types without axes (`pie`). Validation does not warn
   * or error when it is set on pie specs.
   */
  axisTitles?: {
    x?: string;
    y?: string;
  };
  /**
   * Named chrome theme. Sets sensible default colors for axes, tick labels,
   * gridlines, and legend text in one move. Default `'light'` — preserves
   * pre-theme rendering byte-for-byte.
   *
   * Affects chart **chrome only**; data-series colors still come from
   * {@link ColorEncoding.scheme} regardless of theme. Per-color overrides
   * via {@link ChartOptions.colors} win over the preset for any field they
   * specify.
   *
   * No auto-detection from CSS / DOM: pass `'dark'` explicitly when
   * rendering on a dark background.
   */
  theme?: Theme;
  /**
   * Per-color chrome overrides. Each field is independently optional;
   * specified entries win over the {@link ChartOptions.theme} preset, while
   * omitted entries fall through to the preset.
   *
   * Use to fine-tune a single chrome color (e.g. `colors: { grid: 0x404040 }`
   * with `theme: 'dark'`) rather than redefining the whole preset.
   */
  colors?: ThemeColors;
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
