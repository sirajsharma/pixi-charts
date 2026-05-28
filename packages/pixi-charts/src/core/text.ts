import { Text, type TextStyleOptions } from 'pixi.js';

import { TICK_LABEL_OFFSET, TICK_MARK_LENGTH } from './Axis.js';

/**
 * Maximum fraction of a chart dimension that a measurement-driven band-axis
 * margin can occupy. Past this, labels are ellipsis-truncated to fit the
 * cap rather than the margin growing further — long category names should
 * not eat half the plot.
 */
export const MAX_BAND_MARGIN_FRACTION = 0.35;

/**
 * Extra breathing room (px) between a measured label and the inside of the
 * plot, on top of {@link TICK_MARK_LENGTH} + {@link TICK_LABEL_OFFSET}.
 * Keeps labels from kissing the plot's edge after measurement-driven
 * margin sizing.
 */
export const LABEL_MARGIN_PAD = 4;

/**
 * Subset of `PIXI.TextStyleOptions` we actually need for axis-label
 * measurement. Narrowed so callers don't pass a full style and so we can
 * forward exactly the fields PIXI uses for layout.
 */
export interface MeasurableTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight?: TextStyleOptions['fontWeight'];
}

function styleFor(style: MeasurableTextStyle): TextStyleOptions {
  const out: TextStyleOptions = {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
  };
  if (style.fontWeight !== undefined) out.fontWeight = style.fontWeight;
  return out;
}

/**
 * Measure a text string against a PIXI text style without retaining a
 * display object.
 *
 * Implementation: construct a `PIXI.Text`, read `.width` / `.height`, and
 * destroy the texture. This is the same primitive `Axis.build()` already
 * trusts for post-construction text dimensions (see `Axis.ts:331`), so it
 * avoids exposing the `CanvasTextMetrics` surface which has had churn
 * across PIXI minors.
 *
 * Cost: each call creates and destroys a Text. Cheap enough for the
 * once-per-render measurements axis margin sizing needs (a band axis has
 * ≤~20 ticks in practice). Do not call inside a hot loop without batching.
 */
export function measureText(
  text: string,
  style: MeasurableTextStyle,
): { width: number; height: number } {
  const t = new Text({ text, style: styleFor(style) });
  const width = t.width;
  const height = t.height;
  t.destroy();
  return { width, height };
}

/**
 * Truncate `text` with a trailing `'…'` so its measured width is at most
 * `maxWidth`. Returns the original string when it already fits.
 *
 * If even the ellipsis alone doesn't fit (`maxWidth` is tiny), returns
 * `'…'` — a degraded but non-empty signal that the label is collapsed.
 * Returns `''` only when the input itself is empty.
 *
 * Strategy: binary search over the prefix length. O(log n) measurements
 * where n is the input length.
 */
export function truncateToWidth(
  text: string,
  style: MeasurableTextStyle,
  maxWidth: number,
): string {
  if (text === '') return '';
  if (maxWidth <= 0) return '…';
  if (measureText(text, style).width <= maxWidth) return text;

  const ellipsis = '…';
  if (measureText(ellipsis, style).width > maxWidth) {
    // Even '…' alone overflows — return it anyway, since collapsing to ''
    // would lose all signal that a label exists at this tick.
    return ellipsis;
  }

  // Binary search for the longest prefix where `prefix + '…'` fits.
  let lo = 0;
  let hi = text.length;
  let best = '';
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const candidate = text.slice(0, mid) + ellipsis;
    if (measureText(candidate, style).width <= maxWidth) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best === '' ? ellipsis : best;
}

/**
 * Result of {@link measureBandAxisMargin}.
 *
 * `margin` is the measurement-driven margin (in pixels) sized so the longest
 * category label fits, capped at {@link MAX_BAND_MARGIN_FRACTION} of the
 * supplied chart dimension. `truncated`, when non-null, maps original
 * category strings to their ellipsized forms — the caller threads this
 * into the `Axis`'s `tickFormat` so the rendered text actually fits the
 * capped margin.
 */
export interface BandAxisMargin {
  /** Pixels of margin needed to accommodate the labels (capped). */
  margin: number;
  /**
   * Truncated label text per original category, or `null` when no label
   * required truncation. Lookup keys are the original category strings.
   */
  truncated: Map<string, string> | null;
}

/**
 * Compute the margin needed to fit a band axis's category labels along its
 * cross-axis (label width for a left/right axis, label height for a
 * top/bottom axis), capped at {@link MAX_BAND_MARGIN_FRACTION} of the chart
 * dimension.
 *
 * When the unconstrained desired margin exceeds the cap, labels are
 * truncated with `'…'` so each rendered label fits the capped margin — the
 * returned `truncated` map is fed to the `Axis`'s `tickFormat` callback so
 * the on-screen text matches the reserved space.
 *
 * @param labels - Category label strings, in axis order.
 * @param style - Text style the labels will render with (must match the
 *   font passed to the `Axis`).
 * @param chartDimension - The chart dimension the cap is computed against
 *   (canvas width for a left/right axis, canvas height for a top/bottom
 *   axis).
 * @param axis - Which dimension to measure: `'cross-horizontal'` measures
 *   label width (for left/right band axes), `'cross-vertical'` measures
 *   label height (for top/bottom band axes).
 */
export function measureBandAxisMargin(
  labels: readonly string[],
  style: MeasurableTextStyle,
  chartDimension: number,
  axis: 'cross-horizontal' | 'cross-vertical',
): BandAxisMargin {
  if (labels.length === 0) {
    return { margin: 0, truncated: null };
  }

  const inset = TICK_MARK_LENGTH + TICK_LABEL_OFFSET + LABEL_MARGIN_PAD;
  const cap = Math.max(0, chartDimension * MAX_BAND_MARGIN_FRACTION);

  // Cross-vertical (top/bottom band axes): height of one label is enough —
  // PIXI text height is roughly constant per font size. Measure one and apply
  // to all; truncation is only meaningful along the layout axis labels rotate
  // along, which is deferred to a later session.
  if (axis === 'cross-vertical') {
    const h = measureText(labels[0] ?? '', style).height;
    const desired = h + inset;
    return { margin: Math.min(desired, cap), truncated: null };
  }

  // Cross-horizontal (left/right band axes): measure each label's width.
  let maxWidth = 0;
  const widths = new Map<string, number>();
  for (const label of labels) {
    if (widths.has(label)) continue;
    const w = measureText(label, style).width;
    widths.set(label, w);
    if (w > maxWidth) maxWidth = w;
  }

  const desired = maxWidth + inset;
  if (desired <= cap) {
    return { margin: desired, truncated: null };
  }

  // Cap exceeded — truncate each unique label with ellipsis so it fits the
  // available text width (cap minus the inset).
  const textBudget = Math.max(0, cap - inset);
  const truncated = new Map<string, string>();
  for (const label of widths.keys()) {
    truncated.set(label, truncateToWidth(label, style, textBudget));
  }
  return { margin: cap, truncated };
}
