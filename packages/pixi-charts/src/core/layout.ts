/**
 * Pure layout helper: given the chart canvas dimensions, margins, and the
 * legend's measured size (if any), compute the rectangle inside which the
 * plot content draws and the rectangle inside which the legend draws.
 *
 * Centralises the "where does the plot end and the legend begin" math that
 * was previously open-coded in every chart's `render()`. The function is
 * pure (no PIXI, no DOM) and keeps the layout policy in one place so all
 * charts agree on placement and gap.
 *
 * **Placement convention (v0.1).** The legend sits to the right of the plot
 * area, top-aligned with the plot. Top-aligned (rather than vertically
 * centered) keeps the legend's position stable as series are added or
 * removed — only the legend's height changes, not its anchor.
 *
 * **Coordinate space.** Both `plotRect` and `legendRect` are returned in
 * stage-absolute coordinates: the chart adds its plot container at
 * `(plotRect.x, plotRect.y)` and the legend container at
 * `(legendRect.x, legendRect.y)`.
 */

/** Pixel padding around the plot area on each side. */
export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutInput {
  /** Total chart canvas width in CSS pixels (e.g. `app.screen.width`). */
  totalWidth: number;
  /** Total chart canvas height in CSS pixels (e.g. `app.screen.height`). */
  totalHeight: number;
  /** Per-side pixel padding inside the canvas. */
  margin: Margin;
  /**
   * Measured legend size. Omit (or pass `undefined`) when no legend is
   * shown — in that case the plot area fills the full content rectangle
   * inside the margins. Accepting `undefined` lets callers write
   * `{ legend: maybeLegend && { width, height } }` without conditional
   * spreads under `exactOptionalPropertyTypes`.
   */
  legend?: { width: number; height: number } | undefined;
  /** Pixels of horizontal gap between the plot area's right edge and the legend. Default `12`. */
  legendGap?: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  /** Rectangle inside which the plot content (axes, marks, interaction layer) draws. */
  plotRect: Rect;
  /** Rectangle inside which the legend container should be placed, or `null` when no legend. */
  legendRect: Rect | null;
}

/** Default gap between the plot area's right edge and the legend column. */
export const DEFAULT_LEGEND_GAP = 12;

/**
 * Floor for the plot area's width and height. If reducing the plot by the
 * legend's width would leave less than this, we clamp to this value and emit
 * a one-shot console warning instead of returning a negative or zero-size
 * rect that downstream scale code can't handle.
 */
export const MIN_PLOT_DIMENSION = 50;

export function computeLayout(input: LayoutInput): Layout {
  const { totalWidth, totalHeight, margin, legend, legendGap } = input;
  const gap = legendGap ?? DEFAULT_LEGEND_GAP;

  const contentX = margin.left;
  const contentY = margin.top;
  const contentWidth = Math.max(0, totalWidth - margin.left - margin.right);
  const contentHeight = Math.max(0, totalHeight - margin.top - margin.bottom);

  if (legend === undefined) {
    return {
      plotRect: {
        x: contentX,
        y: contentY,
        width: Math.max(MIN_PLOT_DIMENSION, contentWidth),
        height: Math.max(MIN_PLOT_DIMENSION, contentHeight),
      },
      legendRect: null,
    };
  }

  const reservedWidth = legend.width + gap;
  let plotWidth = contentWidth - reservedWidth;
  let plotHeight = contentHeight;

  if (plotWidth < MIN_PLOT_DIMENSION) {
    console.warn(
      `pixi-charts: legend width (${String(legend.width)}px) leaves plot area below the ` +
        `${String(MIN_PLOT_DIMENSION)}px minimum at canvas width ${String(totalWidth)}px; ` +
        `clamping plot to ${String(MIN_PLOT_DIMENSION)}px.`,
    );
    plotWidth = MIN_PLOT_DIMENSION;
  }
  if (plotHeight < MIN_PLOT_DIMENSION) {
    plotHeight = MIN_PLOT_DIMENSION;
  }

  return {
    plotRect: {
      x: contentX,
      y: contentY,
      width: plotWidth,
      height: plotHeight,
    },
    legendRect: {
      x: contentX + plotWidth + gap,
      y: contentY,
      width: legend.width,
      height: legend.height,
    },
  };
}
