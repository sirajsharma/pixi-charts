/**
 * Chart chrome colors (axes, tick labels, gridlines, legend text). The single
 * source for "what color is the non-data scaffolding" across every chart.
 *
 * **Scope.** Theme covers *chrome only*. Data-series colors come from
 * {@link import('./ColorScheme.js').getCategoricalColor} /
 * {@link import('./ColorScheme.js').getSequentialColor} and are explicitly
 * untouched — a categorical bar chart still cycles through `category10`
 * regardless of light/dark.
 *
 * **Resolution model.** `resolveTheme(theme, overrides)`:
 * 1. Picks a preset (`LIGHT_THEME` / `DARK_THEME`) per the `theme` arg
 *    (defaults to light when undefined).
 * 2. Overlays any `overrides` values present, ignoring keys set to
 *    `undefined`.
 *
 * So `theme: 'dark'` flips all four chrome colors in one move; a consumer
 * wanting dark everything except a custom grid sets
 * `theme: 'dark', colors: { grid: 0x404040 }`.
 *
 * The library itself never reads CSS / DOM to detect a theme — that's
 * deliberate (kept DOM-agnostic). Consumers (e.g. the docs site) do the
 * detection and pass the resolved value through `spec.options.theme`.
 */

/** Named theme preset. */
export type Theme = 'light' | 'dark';

/**
 * Per-color overrides that win over the preset. Each field is independently
 * optional; the resolver merges defined entries onto the preset and leaves
 * undefined entries falling through to the preset value.
 */
export interface ThemeColors {
  /** Axis line + tick-mark color (PIXI numeric). */
  axis?: number;
  /** Tick-label + axis-title color (PIXI numeric). */
  label?: number;
  /** Gridline color (PIXI numeric). */
  grid?: number;
  /** Legend label text color (PIXI numeric). */
  legendText?: number;
}

/** Theme colors with every field present — what charts consume. */
export interface ResolvedThemeColors {
  axis: number;
  label: number;
  grid: number;
  legendText: number;
}

/**
 * Light preset. Values match the previously-hardcoded defaults in
 * `Axis.ts` and `Legend.ts` so existing charts without a `theme:` option
 * render byte-identically.
 */
export const LIGHT_THEME: ResolvedThemeColors = {
  axis: 0x888888,
  label: 0x555555,
  grid: 0xeeeeee,
  legendText: 0x333333,
};

/**
 * Dark preset. Tuned for the Starlight dark-mode background (~`#17181c`):
 * tick labels and legend text lean toward `#cccccc`/`#e0e0e0` for high
 * contrast; gridlines drop to a low-luminance `#333333` so they're visible
 * but not dominant; the axis line stays a neutral mid-gray.
 */
export const DARK_THEME: ResolvedThemeColors = {
  axis: 0x888888,
  label: 0xcccccc,
  grid: 0x333333,
  legendText: 0xe0e0e0,
};

/**
 * Resolve a `theme` + `colors` pair from the spec into a fully-populated
 * color set. Undefined `colors` keys are stripped so they don't accidentally
 * overwrite preset values with `undefined`.
 */
export function resolveTheme(
  theme: Theme | undefined,
  overrides: ThemeColors | undefined,
): ResolvedThemeColors {
  const base = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  if (overrides === undefined) return { ...base };
  const out: ResolvedThemeColors = { ...base };
  if (overrides.axis !== undefined) out.axis = overrides.axis;
  if (overrides.label !== undefined) out.label = overrides.label;
  if (overrides.grid !== undefined) out.grid = overrides.grid;
  if (overrides.legendText !== undefined) out.legendText = overrides.legendText;
  return out;
}
