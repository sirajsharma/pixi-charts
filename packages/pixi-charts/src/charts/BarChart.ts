import { max as d3max, min as d3min } from 'd3-array';
import { format as d3format } from 'd3-format';
import { scaleBand, scaleLinear } from 'd3-scale';
import { Container, Graphics } from 'pixi.js';

import { Axis, type AxisOptions } from '../core/Axis.js';
import { Chart, type UpdateOptions } from '../core/Chart.js';
import { getCategoricalColor, type CategoricalSchemeName } from '../core/ColorScheme.js';
import {
  InteractionLayer,
  type HitTester,
  type InteractionEvent,
  type Point,
} from '../core/InteractionLayer.js';
import { Legend } from '../core/Legend.js';
import { bandAdapter, linearAdapter, type ScaleAdapter } from '../core/ScaleAdapter.js';
import { Tooltip } from '../core/Tooltip.js';
import { tween } from '../core/animation.js';
import { computeLayout } from '../core/layout.js';
import { measureBandAxisMargin } from '../core/text.js';
import type { ResolvedThemeColors } from '../core/theme.js';
import type { ChartSpec } from '../spec/ChartSpec.js';

import {
  COLOR_GROUP_WARN_THRESHOLD,
  DEFAULT_COLOR_SCHEME,
  formatCategoryValueTooltip,
  resolveChartTheme,
  resolveHeight,
  resolveMargin,
  resolveWidth,
  stringifyKey,
  toNumber,
} from './_shared/cartesian.js';

/**
 * Gap between adjacent bars, as a fraction of the band step. A small visible
 * gap is the conventional bar-chart look; matches the `padding(0.1)` most
 * charting libraries default to.
 */
const BAND_PADDING = 0.1;

/** Duration (ms) of hover decoration fade-in / fade-out. */
const HOVER_ANIMATION_MS = 120;
/**
 * Maximum interpolation toward white for a hovered bar. At full hover the
 * fill is `lightenColor(baseColor, 0.18)` — visibly lighter without losing
 * series identity.
 */
const HOVER_LIGHTEN_AMOUNT = 0.18;

/**
 * Interpolate a `0xRRGGBB` color toward white by factor `t` in `[0, 1]`.
 * `t = 0` returns the original color; `t = 1` returns white.
 *
 * @internal
 */
function lightenColor(color: number, t: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const lr = Math.round(r + (255 - r) * t);
  const lg = Math.round(g + (255 - g) * t);
  const lb = Math.round(b + (255 - b) * t);
  return (lr << 16) | (lg << 8) | lb;
}

/** Bar orientation. See {@link BarChart} and `ChartOptions.orientation`. */
type Orientation = 'vertical' | 'horizontal';

/**
 * One bar, post-transformation. `category` is the band-axis key, `value` the
 * quantitative magnitude, `datum` the original row (for tooltips), `color`
 * the resolved per-bar fill (`0xRRGGBB`).
 */
export interface BarRecord {
  category: string;
  value: number;
  datum: Record<string, unknown>;
  color: number;
}

/** One legend entry: a distinct color-field value and its swatch color. */
interface ColorLegendItem {
  label: string;
  color: number;
}

/**
 * Result of the data + scale transform — everything needed to drive a redraw
 * without committing to constructing or updating the {@link Axis} primitives.
 */
interface BarSetup {
  records: BarRecord[];
  /** Band scale over the categories (x for vertical, y for horizontal). */
  bandAdapter: ScaleAdapter<string>;
  /** Linear scale over the values (y for vertical, x for horizontal). */
  valueAdapter: ScaleAdapter<number>;
  /** Options for the bottom-edge axis. Caller decides create-vs-update. */
  xAxisOpts: AxisOptions<string> | AxisOptions<number>;
  /** Options for the left-edge axis. */
  yAxisOpts: AxisOptions<string> | AxisOptions<number>;
  /** Categorical legend entries, or `null` when no legend should show. */
  legendItems: ColorLegendItem[] | null;
}

export interface BarChartOptions {
  /** DOM element the chart canvas will be appended to. */
  container: HTMLElement;
  /** Parsed and validated spec. */
  spec: ChartSpec;
}

/**
 * Bar chart — single series, vertical or horizontal.
 *
 * **One class, two orientations.** A horizontal bar chart is a vertical one
 * with the axes swapped: same data, same encoding, same hit-testing — only
 * which axis carries the band scale differs. `options.orientation`
 * (`'vertical'` default, or `'horizontal'`) selects the layout; everything
 * else is a single branch in the scale-setup and drawing code. See
 * `ChartOptions.orientation` for the user-facing contract.
 *
 * **Single series.** Grouped and stacked bars are out of scope here
 * (Session 7+). The `encoding.color` channel here controls **per-bar
 * color**, not a series split: with no color encoding every bar takes the
 * default scheme's first color; with a categorical color encoding each bar
 * is colored by its color-field value (so coloring by the category field —
 * the common case — yields one color per bar). Above
 * {@link COLOR_GROUP_WARN_THRESHOLD} distinct color values a `console.warn`
 * fires (palettes wrap and colors repeat).
 *
 * **Lifecycle / resize / update.** Construction is pure. The first render
 * runs at the tail of `init()`. Resize and {@link Chart.update} both flow
 * through the base class's render orchestrator, which reuses the persistent
 * PIXI containers, axes, legend, interaction layer, and tooltip — only the
 * data-dependent state (records, scale domains, axis ticks, bar geometry,
 * hit-tester backing) is recomputed.
 *
 * **Baseline.** Bars grow from `valueAdapter.scale(0)` — zero projected
 * through the value scale, *not* an assumed plot edge. Negative values grow
 * the opposite side of that baseline; a domain that doesn't include zero
 * still projects a correct (possibly off-plot) baseline. Same correctness
 * point {@link import('./AreaChart.js').AreaChart} established.
 *
 * For most use cases, prefer the declarative {@link render} entry point —
 * use this class directly only when you need fine-grained lifecycle control.
 */
export class BarChart extends Chart {
  private spec: ChartSpec;
  private readonly orientation: Orientation;

  private records: BarRecord[] = [];
  /**
   * Per-bar value currently being drawn. Parallel to {@link records}. The
   * enter animation interpolates these from `0` up to each record's
   * `value`; an animated `update()` interpolates from the previous values
   * to the new ones. The `redrawBars` path reads only this array, which
   * keeps both animations a single drawing loop.
   *
   * @internal
   */
  private displayValues: number[] = [];

  private plotContainer: Container | null = null;
  /**
   * Back-most layer inside {@link plotContainer}. Holds each axis's
   * `gridContainer`, added BEFORE {@link barsContainer} so gridlines render
   * behind bars instead of cutting through them. The layer is empty when
   * neither axis has `showGrid: true`.
   */
  private gridLayer: Container | null = null;
  private barsContainer: Container | null = null;
  private barsGraphics: Graphics | null = null;

  private xAxis: Axis<string> | Axis<number> | null = null;
  private yAxis: Axis<string> | Axis<number> | null = null;
  private bandAdapterRef: ScaleAdapter<string> | null = null;
  private valueAdapterRef: ScaleAdapter<number> | null = null;
  private plotWidth = 0;
  private plotHeight = 0;
  private tooltip: Tooltip | null = null;
  private interactionLayer: InteractionLayer<BarRecord> | null = null;
  private legend: Legend | null = null;
  private lastTooltipContent: string | null = null;

  /**
   * The bar currently under the pointer. Reference identity (the same
   * {@link BarRecord} instance held in {@link records}) is the cancel-key
   * for {@link applyHoverDecoration}.
   */
  private hoveredRecord: BarRecord | null = null;
  /** Current hover-fade progress (0 = base color, 1 = fully lightened). */
  private hoverProgress = 0;
  private hoverAnimationCancel: (() => void) | null = null;
  /** Tracks whether the first render has happened (resize skips the enter animation). */
  private didInitialRender = false;

  constructor(opts: BarChartOptions) {
    super({
      container: opts.container,
      width: resolveWidth(opts.spec, opts.container),
      height: resolveHeight(opts.spec, opts.container),
    });
    this.spec = opts.spec;
    this.orientation = opts.spec.options?.orientation ?? 'vertical';
  }

  /**
   * Override of {@link Chart.init}: after the PIXI Application is ready,
   * runs the first render so the spec dispatcher hands back a fully-rendered
   * chart.
   */
  override async init(): Promise<void> {
    await super.init();
    if (!this.destroyed) {
      this.render();
    }
  }

  /**
   * Destroy every owned primitive in addition to the base-class teardown.
   * Idempotent — the base class guards a second call, and each primitive is
   * itself idempotent so a partial-init failure stays safe.
   */
  override destroy(): void {
    if (this.destroyed) return;

    super.destroy();

    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
    if (this.interactionLayer) {
      this.interactionLayer.destroy();
      this.interactionLayer = null;
    }
    if (this.legend) {
      this.legend.destroy();
      this.legend = null;
    }
    if (this.xAxis) {
      this.xAxis.destroy();
      this.xAxis = null;
    }
    if (this.yAxis) {
      this.yAxis.destroy();
      this.yAxis = null;
    }
  }

  protected override replaceData(newData: readonly Record<string, unknown>[]): void {
    this.spec = { ...this.spec, data: newData };
  }

  protected override onBeforeUpdate(): void {
    this.tooltip?.hide();
    this.lastTooltipContent = null;
    this.hoveredRecord = null;
    this.hoverProgress = 0;
    if (this.hoverAnimationCancel !== null) {
      this.hoverAnimationCancel();
      this.hoverAnimationCancel = null;
    }
  }

  protected override ensureSetup(): void {
    if (this.app === null) return;
    const stage = this.app.stage;

    if (this.plotContainer === null) {
      this.plotContainer = new Container();
      stage.addChild(this.plotContainer);
    }
    // gridLayer added BEFORE barsContainer so gridlines render behind bars.
    if (this.gridLayer === null) {
      this.gridLayer = new Container();
      this.plotContainer.addChild(this.gridLayer);
    }
    if (this.barsContainer === null) {
      this.barsContainer = new Container();
      this.plotContainer.addChild(this.barsContainer);
    }
    if (this.barsGraphics === null) {
      this.barsGraphics = new Graphics();
      this.barsContainer.addChild(this.barsGraphics);
    }
    if (this.tooltip === null && this.spec.options?.showTooltip !== false) {
      this.tooltip = new Tooltip({ container: this.container });
    }
  }

  protected override redrawData(options?: UpdateOptions): void {
    if (this.app === null || this.plotContainer === null) return;

    const stage = this.app.stage;
    const wantAnimate = options?.animate === true;

    const margin = resolveMargin(this.spec);
    const canvasW = this.app.screen.width;
    const canvasH = this.app.screen.height;

    const themeColors = resolveChartTheme(this.spec);

    // Legend items are derived from the color encoding alone — independent of
    // plot pixel dimensions — so we can size the legend before committing to
    // the final plot rect (which the legend's width feeds into).
    const legendItems = this.computeLegendItems();
    const showLegend = this.spec.options?.showLegend !== false;
    const shouldShowLegend = showLegend && legendItems !== null && legendItems.length > 0;

    // Manage the Legend lifecycle BEFORE layout so its measured size feeds
    // the plot-rect calculation. The legend is recreated only when its
    // existence flips — otherwise it's updated in place.
    if (shouldShowLegend) {
      if (this.legend === null) {
        this.legend = new Legend({
          type: 'categorical',
          orientation: 'vertical',
          items: legendItems,
          labelColor: themeColors.legendText,
        });
        stage.addChild(this.legend.container);
      } else {
        this.legend.update({
          type: 'categorical',
          orientation: 'vertical',
          items: legendItems,
          labelColor: themeColors.legendText,
        });
      }
    } else if (this.legend !== null) {
      this.legend.destroy();
      this.legend = null;
    }

    // Pre-measure the band-axis labels so the relevant margin grows to fit
    // long category names (capped at the cross-axis cap inside
    // measureBandAxisMargin).
    const categories = this.extractCategories();
    const labelStyle = { fontFamily: 'sans-serif', fontSize: 11 };
    const bandMargin =
      this.orientation === 'horizontal'
        ? measureBandAxisMargin(categories, labelStyle, canvasW, 'cross-horizontal')
        : measureBandAxisMargin(categories, labelStyle, canvasH, 'cross-vertical');
    if (this.orientation === 'horizontal') {
      margin.left = Math.max(margin.left, bandMargin.margin);
    } else {
      margin.bottom = Math.max(margin.bottom, bandMargin.margin);
    }

    const layout = computeLayout({
      totalWidth: canvasW,
      totalHeight: canvasH,
      margin,
      legend: this.legend ? { width: this.legend.width, height: this.legend.height } : undefined,
    });
    const plotWidth = layout.plotRect.width;
    const plotHeight = layout.plotRect.height;
    this.plotWidth = plotWidth;
    this.plotHeight = plotHeight;

    if (plotWidth <= 0 || plotHeight <= 0) {
      return;
    }

    const setup = this.buildSetup(plotWidth, plotHeight, themeColors, bandMargin.truncated);

    // Capture previous values BEFORE replacing records so we can animate
    // from the old state into the new. Only valid when categories are
    // elementwise identical; otherwise we silently snap (matches the
    // documented `animate: true` fallback).
    const prevRecords = this.records;
    const categoriesIdentical =
      prevRecords.length === setup.records.length &&
      prevRecords.every((r, i) => r.category === setup.records[i]?.category);
    const prevValues = categoriesIdentical ? prevRecords.map((r) => r.value) : null;

    this.records = setup.records;
    this.bandAdapterRef = setup.bandAdapter;
    this.valueAdapterRef = setup.valueAdapter;

    // Position the plot container per the layout. Always — the legend's
    // measured size may have shifted on resize or after data change.
    this.plotContainer.position.set(layout.plotRect.x, layout.plotRect.y);

    // Axes: create on first redraw, update afterwards. The orientation is
    // class-fixed by the spec, so the generic of each Axis is also fixed.
    // Each axis's gridContainer is added to gridLayer (behind data), while
    // its chrome container is added to plotContainer (in front of data so
    // labels stay legible).
    const gridLayer = this.gridLayer;
    if (gridLayer === null) return;
    if (this.xAxis === null) {
      this.xAxis = createBarAxis(setup.xAxisOpts);
      gridLayer.addChild(this.xAxis.gridContainer);
      this.plotContainer.addChild(this.xAxis.container);
    } else {
      updateBarAxis(this.xAxis, setup.xAxisOpts);
    }
    if (this.yAxis === null) {
      this.yAxis = createBarAxis(setup.yAxisOpts);
      gridLayer.addChild(this.yAxis.gridContainer);
      this.plotContainer.addChild(this.yAxis.container);
    } else {
      updateBarAxis(this.yAxis, setup.yAxisOpts);
    }
    // x-axis sits on the bottom edge of the plot — chrome AND gridContainer
    // share the same local origin (gridContainer extents are local deltas).
    this.xAxis.container.position.set(0, plotHeight);
    this.xAxis.gridContainer.position.set(0, plotHeight);
    // y-axis chrome and grid sit at (0, 0); no explicit set required.

    if (this.legend !== null && layout.legendRect !== null) {
      this.legend.container.position.set(layout.legendRect.x, layout.legendRect.y);
    }

    // Interaction layer: create on first redraw, refresh hit-tester +
    // resize afterwards.
    this.setupInteractionAndTooltip();

    // Drive bar drawing. Three modes:
    //   - First render with enter-animation enabled → tween 0 → value.
    //   - update() with animate: true and identical categories → tween
    //     prevValue → newValue.
    //   - Anything else (first render with animation off, resize, update
    //     without animation, update with changed categories) → snap.
    const enter = this.spec.animation?.enter ?? true;
    const isFirstRender = !this.didInitialRender;
    const wantEnterAnim = isFirstRender && enter !== false;
    const wantUpdateAnim = !isFirstRender && wantAnimate && prevValues !== null;

    if (wantEnterAnim) {
      this.runEnterAnimation(typeof enter === 'object' ? enter : {});
    } else if (wantUpdateAnim) {
      this.runUpdateAnimation(prevValues);
    } else {
      this.displayValues = this.records.map((r) => r.value);
      this.redrawBars();
    }

    this.didInitialRender = true;
  }

  /**
   * Enumerate categorical legend items from the spec's color encoding
   * without touching the plot dimensions. Mirrors the distinct-color-value
   * computation inside {@link buildSetup} so the legend can be measured
   * before layout commits to a plot width. `null` when no legend should
   * render (no color field, fewer than 2 distinct values).
   *
   * @internal
   */
  private computeLegendItems(): ColorLegendItem[] | null {
    const colorField = this.spec.encoding.color?.field;
    if (colorField === undefined) return null;
    const scheme =
      (this.spec.encoding.color?.scheme as CategoricalSchemeName | undefined) ??
      DEFAULT_COLOR_SCHEME;

    const seen = new Set<string>();
    const order: string[] = [];
    for (const row of this.spec.data) {
      const key = stringifyKey(row[colorField]);
      if (!seen.has(key)) {
        seen.add(key);
        order.push(key);
      }
    }
    if (order.length < 2) return null;
    return order.map((label, i) => ({ label, color: getCategoricalColor(scheme, i) }));
  }

  /**
   * Distinct category labels from `spec.data`, in first-seen order, filtered
   * the same way {@link buildSetup} filters records (skip rows with no
   * parseable value). Used by `render()` for pre-layout band-axis margin
   * measurement before the records-and-axes pass runs.
   *
   * @internal
   */
  private extractCategories(): string[] {
    const enc = this.spec.encoding;
    const categoryField =
      this.orientation === 'horizontal' ? (enc.y?.field ?? '') : (enc.x?.field ?? '');
    const valueField =
      this.orientation === 'horizontal' ? (enc.x?.field ?? '') : (enc.y?.field ?? '');
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of this.spec.data) {
      if (toNumber(row[valueField]) === null) continue;
      const cat = String(row[categoryField]);
      if (!seen.has(cat)) {
        seen.add(cat);
        out.push(cat);
      }
    }
    return out;
  }

  /**
   * Transform `spec.data` into {@link BarRecord}s and build the band/value
   * scales + adapters, returning the {@link AxisOptions} that the caller
   * uses to create or update the two {@link Axis} instances. Records
   * preserve input order — the consumer controls bar order via their data
   * array; we never sort.
   *
   * @internal
   */
  private buildSetup(
    plotWidth: number,
    plotHeight: number,
    themeColors: ResolvedThemeColors,
    truncatedCategoryLabels: Map<string, string> | null,
  ): BarSetup {
    const enc = this.spec.encoding;
    const categoryField =
      this.orientation === 'horizontal' ? (enc.y?.field ?? '') : (enc.x?.field ?? '');
    const valueField =
      this.orientation === 'horizontal' ? (enc.x?.field ?? '') : (enc.y?.field ?? '');

    const colorField = enc.color?.field;
    const scheme = (enc.color?.scheme as CategoricalSchemeName | undefined) ?? DEFAULT_COLOR_SCHEME;

    // Distinct color-field values, in first-seen order, drive both per-bar
    // color assignment and the legend.
    const colorValues: string[] = [];
    const colorIndex = new Map<string, number>();
    if (colorField !== undefined) {
      const seen = new Set<string>();
      for (const row of this.spec.data) {
        const key = stringifyKey(row[colorField]);
        if (!seen.has(key)) {
          seen.add(key);
          colorValues.push(key);
        }
      }
      // Sort alphabetically so legend order and color-to-value mapping are
      // stable across update() calls regardless of incoming data order. The
      // colorIndex is built after sorting so palette indices follow the
      // sorted order.
      colorValues.sort();
      colorValues.forEach((v, i) => colorIndex.set(v, i));
      if (colorValues.length > COLOR_GROUP_WARN_THRESHOLD) {
        console.warn(
          `pixi-charts: bar color encoding on "${colorField}" produced ` +
            `${String(colorValues.length)} distinct values, exceeding ` +
            `${String(COLOR_GROUP_WARN_THRESHOLD)}. Categorical palettes wrap, so ` +
            `colors will repeat and become ambiguous. Consider a field with fewer ` +
            `distinct values.`,
        );
      }
    }

    const records: BarRecord[] = [];
    const categories: string[] = [];
    const seenCat = new Set<string>();
    for (const row of this.spec.data) {
      const value = toNumber(row[valueField]);
      if (value === null) continue;
      const category = String(row[categoryField]);
      if (!seenCat.has(category)) {
        seenCat.add(category);
        categories.push(category);
      }
      const color =
        colorField === undefined
          ? getCategoricalColor(scheme, 0)
          : getCategoricalColor(scheme, colorIndex.get(stringifyKey(row[colorField])) ?? 0);
      records.push({ category, value, datum: row, color });
    }

    // Value-axis domain: anchor at zero when all values are non-negative,
    // otherwise span [min, max] so a zero-crossing baseline lands correctly
    // (same rule as the shared cartesian y-axis).
    const values = records.map((r) => r.value);
    const minV = d3min(values) ?? 0;
    const maxV = d3max(values) ?? 1;
    const valueDomain: [number, number] = minV >= 0 ? [0, maxV] : [minV, maxV];

    const bandScale = scaleBand().domain(categories).padding(BAND_PADDING);
    const valueScale = scaleLinear().domain(valueDomain).nice();

    let bAdapter: ScaleAdapter<string>;
    let vAdapter: ScaleAdapter<number>;
    let xAxisOpts: AxisOptions<string> | AxisOptions<number>;
    let yAxisOpts: AxisOptions<string> | AxisOptions<number>;

    const showChrome = this.spec.options?.showAxes ?? true;
    const showGrid = this.spec.options?.showGrid ?? true;
    const xTitle = this.spec.options?.axisTitles?.x;
    const yTitle = this.spec.options?.axisTitles?.y;

    // Pre-truncated band-axis tick formatter. When measurement decided some
    // category labels exceed the margin cap, render their ellipsized form
    // instead of the original so the on-screen text matches reserved space.
    const bandTickFormat =
      truncatedCategoryLabels === null
        ? undefined
        : (v: string): string => truncatedCategoryLabels.get(v) ?? v;

    const chromeColors = {
      labelColor: themeColors.label,
      lineColor: themeColors.axis,
      gridColor: themeColors.grid,
    };

    if (this.orientation === 'horizontal') {
      bandScale.range([0, plotHeight]);
      valueScale.range([0, plotWidth]);
      bAdapter = bandAdapter(bandScale);
      vAdapter = linearAdapter(valueScale);
      // x = value (bottom), y = category band (left).
      xAxisOpts = {
        scale: vAdapter,
        orientation: 'bottom',
        length: plotWidth,
        tickFormat: (v: number) => d3format('~s')(v),
        showGrid,
        gridLength: plotHeight,
        showChrome,
        ...chromeColors,
        ...(xTitle !== undefined && xTitle !== '' ? { title: xTitle } : {}),
      };
      yAxisOpts = {
        scale: bAdapter,
        orientation: 'left',
        length: plotHeight,
        showChrome,
        ...chromeColors,
        ...(bandTickFormat !== undefined ? { tickFormat: bandTickFormat } : {}),
        ...(yTitle !== undefined && yTitle !== '' ? { title: yTitle } : {}),
      };
    } else {
      bandScale.range([0, plotWidth]);
      valueScale.range([plotHeight, 0]);
      bAdapter = bandAdapter(bandScale);
      vAdapter = linearAdapter(valueScale);
      // x = category band (bottom), y = value (left).
      xAxisOpts = {
        scale: bAdapter,
        orientation: 'bottom',
        length: plotWidth,
        showChrome,
        ...chromeColors,
        ...(bandTickFormat !== undefined ? { tickFormat: bandTickFormat } : {}),
        ...(xTitle !== undefined && xTitle !== '' ? { title: xTitle } : {}),
      };
      yAxisOpts = {
        scale: vAdapter,
        orientation: 'left',
        length: plotHeight,
        tickFormat: (v: number) => d3format('~s')(v),
        showGrid,
        gridLength: plotWidth,
        showChrome,
        ...chromeColors,
        ...(yTitle !== undefined && yTitle !== '' ? { title: yTitle } : {}),
      };
    }

    // Legend only when a categorical color encoding actually distinguishes
    // bars (≥2 distinct values). A single value (or no color encoding) needs
    // no legend — there is nothing to disambiguate.
    let legendItems: ColorLegendItem[] | null = null;
    if (colorField !== undefined && colorValues.length >= 2) {
      legendItems = colorValues.map((label, i) => ({
        label,
        color: getCategoricalColor(scheme, i),
      }));
    }

    return {
      records,
      bandAdapter: bAdapter,
      valueAdapter: vAdapter,
      xAxisOpts,
      yAxisOpts,
      legendItems,
    };
  }

  /**
   * Compute a bar's pixel rectangle for a given `displayValue` — the
   * currently-drawn value (animated state, not necessarily the record's
   * final value). With a linear value scale and baseline at
   * `valueAdapter.scale(0)`, plugging in the interpolated value yields the
   * bar edge at every animation frame — correct for positive and negative
   * values alike.
   *
   * @internal
   */
  private barRect(
    record: BarRecord,
    bandAdapter: ScaleAdapter<string>,
    valueAdapter: ScaleAdapter<number>,
    baseline: number,
    displayValue: number,
  ): { x: number; y: number; width: number; height: number } {
    const bandPos = bandAdapter.scale(record.category);
    const bandSize = bandAdapter.bandwidth?.() ?? 0;
    const valuePx = valueAdapter.scale(displayValue);
    const lo = Math.min(valuePx, baseline);
    const extent = Math.abs(valuePx - baseline);
    if (this.orientation === 'horizontal') {
      return { x: lo, y: bandPos, width: extent, height: bandSize };
    }
    return { x: bandPos, y: lo, width: bandSize, height: extent };
  }

  /**
   * Run the first-frame enter animation: tween a single 0 → 1 progress with
   * `displayValues[i] = records[i].value * progress`. Honors
   * `spec.animation.enter` (`object` → `duration` / `ease`), and
   * reduced-motion via `tween()`.
   *
   * @internal
   */
  private runEnterAnimation(enterOptions: {
    duration?: number;
    ease?: import('../core/animation.js').EasingName;
  }): void {
    if (this.app === null) return;
    const targets = this.records.map((r) => r.value);
    this.displayValues = this.records.map(() => 0);
    this.redrawBars();
    const tweenOpts: Parameters<typeof tween>[1] = {
      onUpdate: (p) => {
        this.displayValues = targets.map((v) => v * p);
        this.redrawBars();
      },
    };
    if (enterOptions.duration !== undefined) tweenOpts.duration = enterOptions.duration;
    if (enterOptions.ease !== undefined) tweenOpts.ease = enterOptions.ease;
    const cancel = tween(this.app.ticker, tweenOpts);
    this.addTween(cancel);
  }

  /**
   * Run an animated update: tween from the previous values into the new
   * record values. Called only when categories are elementwise identical
   * to the previous render — otherwise the orchestrator snaps.
   *
   * @internal
   */
  private runUpdateAnimation(prevValues: number[]): void {
    if (this.app === null) return;
    const targets = this.records.map((r) => r.value);
    this.displayValues = prevValues.slice();
    this.redrawBars();
    const cancel = tween(this.app.ticker, {
      onUpdate: (p) => {
        this.displayValues = targets.map((target, i) => {
          const prev = prevValues[i] ?? 0;
          return prev + (target - prev) * p;
        });
        this.redrawBars();
      },
    });
    this.addTween(cancel);
  }

  /**
   * Clear and redraw every bar into {@link barsGraphics} using the current
   * {@link displayValues} and hover state ({@link hoveredRecord} +
   * {@link hoverProgress}). Called on every frame of the enter / update
   * tween and on every hover redraw — typical bar counts (5–50) keep this
   * cheap.
   *
   * @internal
   */
  private redrawBars(): void {
    const graphics = this.barsGraphics;
    const bandAdapter = this.bandAdapterRef;
    const valueAdapter = this.valueAdapterRef;
    if (graphics === null || bandAdapter === null || valueAdapter === null) return;

    const baseline = valueAdapter.scale(0);
    const hovered = this.hoveredRecord;
    const lighten = this.hoverProgress * HOVER_LIGHTEN_AMOUNT;

    graphics.clear();
    for (let i = 0; i < this.records.length; i += 1) {
      const record = this.records[i];
      if (record === undefined) continue;
      const displayValue = this.displayValues[i] ?? record.value;
      const r = this.barRect(record, bandAdapter, valueAdapter, baseline, displayValue);
      const fill = record === hovered ? lightenColor(record.color, lighten) : record.color;
      graphics.rect(r.x, r.y, r.width, r.height).fill({ color: fill, alpha: 1 });
    }
  }

  /**
   * Build the bar hit-tester. Discrete-rectangle hit-testing, not the
   * nearest-point logic the cartesian charts use: find the band the pointer
   * falls in (iterate the band domain via the `kind === 'band'` adapter),
   * then accept it only if the pointer is also between the baseline and the
   * bar's value edge along the value axis.
   *
   * @internal
   */
  private buildHitTester(): HitTester<BarRecord> {
    const bandAdapter = this.bandAdapterRef;
    const valueAdapter = this.valueAdapterRef;
    if (bandAdapter === null || valueAdapter === null) return () => null;
    return buildBarHitTester(this.records, this.orientation, bandAdapter, valueAdapter);
  }

  /**
   * Create the {@link InteractionLayer} on the first call; on subsequent
   * calls, swap the hit-tester and resize. The sprite is added to
   * {@link plotContainer} once and persists across updates.
   *
   * @internal
   */
  private setupInteractionAndTooltip(): void {
    if (this.plotContainer === null || this.app === null) return;

    const showTooltip = this.spec.options?.showTooltip !== false;
    if (this.tooltip && !showTooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
    // ensureSetup() created the tooltip on the first render when
    // showTooltip was true — no further creation here.

    const hitTester = this.buildHitTester();

    if (this.interactionLayer === null) {
      this.interactionLayer = new InteractionLayer<BarRecord>({
        stage: this.plotContainer,
        width: this.plotWidth,
        height: this.plotHeight,
        hitTest: hitTester,
        onEvent: (event) => {
          this.handleInteraction(event);
        },
      });
    } else {
      this.interactionLayer.setHitTester(hitTester);
      this.interactionLayer.resize(this.plotWidth, this.plotHeight);
    }
  }

  /** @internal */
  private handleInteraction(event: InteractionEvent<BarRecord>): void {
    if (event.type === 'hover') {
      if (event.isNewDatum) {
        this.applyHoverDecoration(event.datum);
      }
      if (this.tooltip !== null) {
        if (event.isNewDatum || this.lastTooltipContent === null) {
          this.lastTooltipContent = this.formatTooltip(event.datum);
        }
        const rect = this.container.getBoundingClientRect();
        const localX = event.globalPosition.x - rect.left;
        const localY = event.globalPosition.y - rect.top;
        this.tooltip.show({
          x: localX,
          y: localY,
          content: this.lastTooltipContent,
        });
      }
    } else if (event.type === 'leave') {
      this.clearHoverDecoration();
      this.tooltip?.hide();
      this.lastTooltipContent = null;
    } else {
      // Narrowed to ClickEvent — hover/leave handled above.
      const datum = event.datum.datum;
      this.emitClick({
        datum,
        index: this.spec.data.indexOf(datum),
        position: { x: event.position.x, y: event.position.y },
      });
    }
  }

  /** @internal */
  private formatTooltip(record: BarRecord): string {
    const enc = this.spec.encoding;
    const categoryField =
      this.orientation === 'horizontal'
        ? (enc.y?.field ?? 'category')
        : (enc.x?.field ?? 'category');
    const valueField =
      this.orientation === 'horizontal' ? (enc.x?.field ?? 'value') : (enc.y?.field ?? 'value');
    return formatCategoryValueTooltip(categoryField, record.category, valueField, record.value);
  }

  /**
   * Begin lightening the hovered bar. Cancels any in-flight hover fade so
   * rapid bar-to-bar movement reads as cancel-and-restart — the previous
   * bar drops back to base instantly and the new bar starts fading toward
   * lit. (`tween()`'s reduced-motion shortcut still applies: under reduced
   * motion the new bar snaps to fully lit.)
   *
   * @internal
   */
  private applyHoverDecoration(record: BarRecord): void {
    if (this.app === null) return;

    if (this.hoverAnimationCancel !== null) {
      this.hoverAnimationCancel();
      this.hoverAnimationCancel = null;
    }
    // Switching to a new bar resets the previous bar to base — the lighten
    // factor is owned by `hoveredRecord`, so reassigning is enough.
    this.hoveredRecord = record;
    this.hoverProgress = 0;
    this.redrawBars();

    const cancel = tween(this.app.ticker, {
      duration: HOVER_ANIMATION_MS,
      onUpdate: (p) => {
        this.hoverProgress = p;
        this.redrawBars();
      },
    });
    this.hoverAnimationCancel = cancel;
    this.addTween(cancel);
  }

  /**
   * Fade the hovered bar back to its base color. Leaves {@link hoveredRecord}
   * referenced through the fade so the redraw still targets the correct bar;
   * cleared once the tween reaches 0.
   *
   * @internal
   */
  private clearHoverDecoration(): void {
    if (this.app === null || this.hoveredRecord === null) return;

    if (this.hoverAnimationCancel !== null) {
      this.hoverAnimationCancel();
      this.hoverAnimationCancel = null;
    }

    const start = this.hoverProgress;
    if (start === 0) {
      this.hoveredRecord = null;
      return;
    }

    const cancel = tween(this.app.ticker, {
      duration: HOVER_ANIMATION_MS,
      onUpdate: (p) => {
        this.hoverProgress = start * (1 - p);
        this.redrawBars();
        if (p >= 1) {
          this.hoveredRecord = null;
        }
      },
    });
    this.hoverAnimationCancel = cancel;
    this.addTween(cancel);
  }
}

/**
 * Create an {@link Axis} from the orientation-erased options that
 * {@link BarChart.buildSetup} returns. The orientation of the bar chart
 * fixes which generic each axis is — `string` for the band axis,
 * `number` for the value axis — so the cast is sound at runtime.
 *
 * @internal
 */
function createBarAxis(
  opts: AxisOptions<string> | AxisOptions<number>,
): Axis<string> | Axis<number> {
  if (opts.scale.kind === 'band') {
    return new Axis<string>(opts as AxisOptions<string>);
  }
  return new Axis<number>(opts as AxisOptions<number>);
}

/**
 * Update an existing bar-chart {@link Axis} in place using the same
 * orientation-erased options. The axis's generic is class-fixed by the
 * chart's orientation; passing options for the matching scale kind is safe.
 *
 * @internal
 */
function updateBarAxis(
  axis: Axis<string> | Axis<number>,
  opts: AxisOptions<string> | AxisOptions<number>,
): void {
  if (opts.scale.kind === 'band') {
    (axis as Axis<string>).update(opts as Partial<AxisOptions<string>>);
  } else {
    (axis as Axis<number>).update(opts as Partial<AxisOptions<number>>);
  }
}

/**
 * Pure bar hit-tester (exported-shaped as a module function, like the
 * cartesian one, so it can be unit-tested without a PIXI Application).
 *
 * `bandAdapter` is the categorical axis (x for vertical, y for horizontal);
 * `valueAdapter` the quantitative one. The pointer must fall inside a band
 * **and** between the baseline (`valueAdapter.scale(0)`) and the bar's value
 * edge. Returns the matching {@link BarRecord} or `null`.
 *
 * Exported for unit testing (not re-exported from the package root, so it
 * stays out of the public API surface — same posture as the cartesian
 * hit-tester).
 *
 * @internal
 */
export function buildBarHitTester(
  records: readonly BarRecord[],
  orientation: Orientation,
  bandAdapter: ScaleAdapter<string>,
  valueAdapter: ScaleAdapter<number>,
): HitTester<BarRecord> {
  const bandSize = bandAdapter.bandwidth?.() ?? 0;
  const baseline = valueAdapter.scale(0);
  const byCategory = new Map<string, BarRecord[]>();
  for (const r of records) {
    let arr = byCategory.get(r.category);
    if (arr === undefined) {
      arr = [];
      byCategory.set(r.category, arr);
    }
    arr.push(r);
  }

  return (point: Point): BarRecord | null => {
    // Which pointer axis runs along the band depends on orientation:
    // vertical bars band along x, horizontal bars band along y.
    const alongBand = orientation === 'horizontal' ? point.y : point.x;
    let category: string | null = null;
    for (const dom of bandAdapter.ticks()) {
      const pos = bandAdapter.scale(dom);
      if (alongBand >= pos && alongBand <= pos + bandSize) {
        category = dom;
        break;
      }
    }
    if (category === null) return null;

    const recs = byCategory.get(category);
    if (recs === undefined) return null;

    const alongValue = orientation === 'horizontal' ? point.x : point.y;
    for (const r of recs) {
      const valuePx = valueAdapter.scale(r.value);
      const lo = Math.min(valuePx, baseline);
      const hi = Math.max(valuePx, baseline);
      if (alongValue >= lo && alongValue <= hi) return r;
    }
    return null;
  };
}
