import { max as d3max, min as d3min } from 'd3-array';
import { format as d3format } from 'd3-format';
import { scaleBand, scaleLinear } from 'd3-scale';
import { Container, Graphics } from 'pixi.js';

import { Axis } from '../core/Axis.js';
import { Chart } from '../core/Chart.js';
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
import type { ChartSpec } from '../spec/ChartSpec.js';

import {
  COLOR_GROUP_WARN_THRESHOLD,
  DEFAULT_COLOR_SCHEME,
  formatCategoryValueTooltip,
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

interface BarSetup {
  records: BarRecord[];
  /** Band scale over the categories (x for vertical, y for horizontal). */
  bandAdapter: ScaleAdapter<string>;
  /** Linear scale over the values (y for vertical, x for horizontal). */
  valueAdapter: ScaleAdapter<number>;
  /** Axis on the plot's bottom edge. */
  xAxis: Axis<string> | Axis<number>;
  /** Axis on the plot's left edge. */
  yAxis: Axis<string> | Axis<number>;
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
 * **Lifecycle / resize** mirror {@link import('./LineChart.js').LineChart}:
 *
 * ```ts
 * const chart = new BarChart({ container, spec });
 * await chart.init();    // creates the PIXI app AND does the first render
 * chart.destroy();       // idempotent; cancels tweens, tears down primitives
 * ```
 *
 * Construction is pure. The first render runs at the tail of `init()`.
 * Resize rebuilds scales/axes and redraws at the final state (the enter
 * animation does not re-run).
 *
 * **Baseline.** Bars grow from `valueAdapter.scale(0)` — zero projected
 * through the value scale, *not* an assumed plot edge. Negative values grow
 * the opposite side of that baseline; a domain that doesn't include zero
 * still projects a correct (possibly off-plot) baseline. Same correctness
 * point {@link import('./AreaChart.js').AreaChart} established.
 *
 * The data + scale layer is **not** shared with the cartesian line-family
 * charts: bar's data transform is per-datum (not series-grouped) and its
 * drawing is discrete rectangles, not paths. Only the small
 * {@link formatCategoryValueTooltip} string helper is shared. Like every
 * chart, this extends {@link Chart} directly — composition, not a chart
 * inheritance tree.
 */
export class BarChart extends Chart {
  private readonly spec: ChartSpec;
  private readonly orientation: Orientation;

  private records: BarRecord[] = [];
  private plotContainer: Container | null = null;
  private barsContainer: Container | null = null;
  private xAxis: Axis<string> | Axis<number> | null = null;
  private yAxis: Axis<string> | Axis<number> | null = null;
  private bandAdapter: ScaleAdapter<string> | null = null;
  private valueAdapter: ScaleAdapter<number> | null = null;
  private plotWidth = 0;
  private plotHeight = 0;
  private tooltip: Tooltip | null = null;
  private interactionLayer: InteractionLayer<BarRecord> | null = null;
  private legend: Legend | null = null;
  /**
   * The single {@link Graphics} that draws every bar. Hoisted to a class
   * field so the hover-tween redraw can reach it from
   * {@link redrawBars} without re-running {@link drawBars}.
   */
  private barsGraphics: Graphics | null = null;
  /**
   * Current enter-animation progress (0 = collapsed onto baseline, 1 = full
   * extent). Held as a field so the hover redraw can paint bars at the same
   * extent the enter tween is targeting — if a hover happens during enter,
   * bars don't snap to full extent.
   */
  private enterProgress = 0;
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

  /**
   * Full render pass. Called by {@link init} for the first frame and by the
   * base class's resize observer afterwards. Existing primitives are
   * destroyed and rebuilt each pass (same simple shape as Line/Area).
   */
  protected override render(): void {
    if (this.destroyed || this.app === null) return;

    const stage = this.app.stage;

    // Cancel the prior pass's enter tween before tearing down its targets.
    // The real-browser ResizeObserver fires immediately on observe(), so a
    // resize re-enters render() mid enter-animation; without this the tween's
    // next tick draws into a just-destroyed Graphics and crashes. (Unit tests
    // miss it — the mock ResizeObserver never auto-fires during a live tween.)
    this.cancelAllTweens();

    // Hover state references objects in the about-to-be-destroyed
    // plotContainer; drop them so the next hover starts clean.
    this.barsGraphics = null;
    this.enterProgress = 0;
    this.hoveredRecord = null;
    this.hoverProgress = 0;
    this.hoverAnimationCancel = null;

    if (this.plotContainer !== null) {
      stage.removeChild(this.plotContainer);
      this.plotContainer.destroy({ children: true });
      this.plotContainer = null;
    }
    if (this.xAxis) {
      this.xAxis.destroy();
      this.xAxis = null;
    }
    if (this.yAxis) {
      this.yAxis.destroy();
      this.yAxis = null;
    }
    if (this.legend) {
      this.legend.destroy();
      this.legend = null;
    }

    const margin = resolveMargin(this.spec);
    const canvasW = this.app.screen.width;
    const canvasH = this.app.screen.height;

    // Legend items are derived from the color encoding alone — independent of
    // plot pixel dimensions — so we can size the legend before computing the
    // final plot rect (which the legend's width feeds into).
    const legendItems = this.computeLegendItems();
    const showLegend = this.spec.options?.showLegend !== false;
    const legend =
      showLegend && legendItems !== null && legendItems.length > 0
        ? new Legend({ type: 'categorical', orientation: 'vertical', items: legendItems })
        : null;

    const layout = computeLayout({
      totalWidth: canvasW,
      totalHeight: canvasH,
      margin,
      legend: legend ? { width: legend.width, height: legend.height } : undefined,
    });
    const plotWidth = layout.plotRect.width;
    const plotHeight = layout.plotRect.height;
    this.plotWidth = plotWidth;
    this.plotHeight = plotHeight;

    if (plotWidth <= 0 || plotHeight <= 0) {
      legend?.destroy();
      return;
    }

    const setup = this.buildSetup(plotWidth, plotHeight);
    this.records = setup.records;
    this.bandAdapter = setup.bandAdapter;
    this.valueAdapter = setup.valueAdapter;
    this.xAxis = setup.xAxis;
    this.yAxis = setup.yAxis;

    const plotContainer = new Container();
    plotContainer.position.set(layout.plotRect.x, layout.plotRect.y);
    stage.addChild(plotContainer);
    this.plotContainer = plotContainer;

    plotContainer.addChild(this.yAxis.container);
    this.xAxis.container.position.set(0, plotHeight);
    plotContainer.addChild(this.xAxis.container);

    const barsContainer = new Container();
    plotContainer.addChild(barsContainer);
    this.barsContainer = barsContainer;

    this.drawBars();
    this.setupInteractionAndTooltip();

    if (legend !== null && layout.legendRect !== null) {
      legend.container.position.set(layout.legendRect.x, layout.legendRect.y);
      stage.addChild(legend.container);
      this.legend = legend;
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
   * Transform `spec.data` into {@link BarRecord}s and build the band/value
   * scales, adapters, and the two {@link Axis} instances. Records preserve
   * input order — the consumer controls bar order via their data array; we
   * never sort.
   *
   * @internal
   */
  private buildSetup(plotWidth: number, plotHeight: number): BarSetup {
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
      for (const row of this.spec.data) {
        const key = stringifyKey(row[colorField]);
        if (!colorIndex.has(key)) {
          colorIndex.set(key, colorValues.length);
          colorValues.push(key);
        }
      }
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
    let xAxis: Axis<string> | Axis<number>;
    let yAxis: Axis<string> | Axis<number>;

    const showChrome = this.spec.options?.showAxes ?? true;
    const showGrid = this.spec.options?.showGrid ?? true;
    const xTitle = this.spec.options?.axisTitles?.x;
    const yTitle = this.spec.options?.axisTitles?.y;

    if (this.orientation === 'horizontal') {
      bandScale.range([0, plotHeight]);
      valueScale.range([0, plotWidth]);
      bAdapter = bandAdapter(bandScale);
      vAdapter = linearAdapter(valueScale);
      // x = value (bottom), y = category band (left).
      xAxis = new Axis<number>({
        scale: vAdapter,
        orientation: 'bottom',
        length: plotWidth,
        tickFormat: (v) => d3format('~s')(v),
        showGrid,
        gridLength: plotHeight,
        showChrome,
        ...(xTitle !== undefined && xTitle !== '' ? { title: xTitle } : {}),
      });
      yAxis = new Axis<string>({
        scale: bAdapter,
        orientation: 'left',
        length: plotHeight,
        showChrome,
        ...(yTitle !== undefined && yTitle !== '' ? { title: yTitle } : {}),
      });
    } else {
      bandScale.range([0, plotWidth]);
      valueScale.range([plotHeight, 0]);
      bAdapter = bandAdapter(bandScale);
      vAdapter = linearAdapter(valueScale);
      // x = category band (bottom), y = value (left).
      xAxis = new Axis<string>({
        scale: bAdapter,
        orientation: 'bottom',
        length: plotWidth,
        showChrome,
        ...(xTitle !== undefined && xTitle !== '' ? { title: xTitle } : {}),
      });
      yAxis = new Axis<number>({
        scale: vAdapter,
        orientation: 'left',
        length: plotHeight,
        tickFormat: (v) => d3format('~s')(v),
        showGrid,
        gridLength: plotWidth,
        showChrome,
        ...(yTitle !== undefined && yTitle !== '' ? { title: yTitle } : {}),
      });
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

    return { records, bandAdapter: bAdapter, valueAdapter: vAdapter, xAxis, yAxis, legendItems };
  }

  /**
   * Compute a bar's pixel rectangle at animation `progress` (0 → collapsed
   * onto the baseline, 1 → full extent). Because the value scale is linear
   * and the baseline is `scale(0)`, `scale(value * progress)` interpolates
   * the bar edge from the baseline to its final position — correct for
   * positive and negative values alike.
   *
   * @internal
   */
  private barRect(
    record: BarRecord,
    bandAdapter: ScaleAdapter<string>,
    valueAdapter: ScaleAdapter<number>,
    baseline: number,
    progress: number,
  ): { x: number; y: number; width: number; height: number } {
    const bandPos = bandAdapter.scale(record.category);
    const bandSize = bandAdapter.bandwidth?.() ?? 0;
    const valuePx = valueAdapter.scale(record.value * progress);
    const lo = Math.min(valuePx, baseline);
    const extent = Math.abs(valuePx - baseline);
    if (this.orientation === 'horizontal') {
      return { x: lo, y: bandPos, width: extent, height: bandSize };
    }
    return { x: bandPos, y: lo, width: bandSize, height: extent };
  }

  /**
   * Draw every bar into a single {@link Graphics} (one object, one draw
   * pass — not one Graphics per bar). The enter animation tweens a single
   * `progress` 0 → 1, clearing and redrawing all bars each frame so they
   * grow from the baseline together. Honors `spec.animation.enter`
   * (`false` → final state immediately; object → `duration` / `ease`
   * through to `tween()`), and reduced-motion via `tween()`. Resize passes
   * draw the final state immediately.
   *
   * @internal
   */
  private drawBars(): void {
    if (this.barsContainer === null) return;

    const graphics = new Graphics();
    this.barsContainer.addChild(graphics);
    this.barsGraphics = graphics;

    const enter = this.spec.animation?.enter ?? true;
    const animate = enter !== false && !this.didInitialRender;
    const enterOptions = typeof enter === 'object' ? enter : {};

    if (!animate || this.app === null) {
      this.enterProgress = 1;
      this.redrawBars();
      return;
    }

    const tweenOpts: Parameters<typeof tween>[1] = {
      onUpdate: (p) => {
        this.enterProgress = p;
        this.redrawBars();
      },
    };
    if (enterOptions.duration !== undefined) tweenOpts.duration = enterOptions.duration;
    if (enterOptions.ease !== undefined) tweenOpts.ease = enterOptions.ease;
    const cancel = tween(this.app.ticker, tweenOpts);
    this.addTween(cancel);
  }

  /**
   * Clear and redraw every bar into {@link barsGraphics} using the current
   * {@link enterProgress} and hover state ({@link hoveredRecord} +
   * {@link hoverProgress}). Called on every frame of both the enter tween
   * and the hover tween — typical bar counts (5–50) keep this cheap.
   *
   * @internal
   */
  private redrawBars(): void {
    const graphics = this.barsGraphics;
    const bandAdapter = this.bandAdapter;
    const valueAdapter = this.valueAdapter;
    if (graphics === null || bandAdapter === null || valueAdapter === null) return;

    const baseline = valueAdapter.scale(0);
    const hovered = this.hoveredRecord;
    const lighten = this.hoverProgress * HOVER_LIGHTEN_AMOUNT;
    const enterProgress = this.enterProgress;

    graphics.clear();
    for (const record of this.records) {
      const r = this.barRect(record, bandAdapter, valueAdapter, baseline, enterProgress);
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
   * **Tie-break.** At the exact boundary between two bands the first band in
   * domain (input) order that contains the pointer wins; within a band the
   * first record for that category wins. Deterministic, and which side of a
   * one-pixel seam is irrelevant in practice.
   *
   * @internal
   */
  private buildHitTester(): HitTester<BarRecord> {
    const bandAdapter = this.bandAdapter;
    const valueAdapter = this.valueAdapter;
    if (bandAdapter === null || valueAdapter === null) return () => null;
    return buildBarHitTester(this.records, this.orientation, bandAdapter, valueAdapter);
  }

  /** @internal */
  private setupInteractionAndTooltip(): void {
    if (this.plotContainer === null || this.app === null) return;

    const showTooltip = this.spec.options?.showTooltip !== false;

    if (this.interactionLayer) {
      this.interactionLayer.destroy();
      this.interactionLayer = null;
    }
    if (this.tooltip && !showTooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
    if (showTooltip && this.tooltip === null) {
      this.tooltip = new Tooltip({ container: this.container });
    }

    const hitTester = this.buildHitTester();
    let lastTooltipContent: string | null = null;
    const handleEvent = (event: InteractionEvent<BarRecord>): void => {
      if (event.type === 'hover') {
        if (event.isNewDatum) {
          this.applyHoverDecoration(event.datum);
        }
        if (this.tooltip !== null) {
          if (event.isNewDatum || lastTooltipContent === null) {
            lastTooltipContent = this.formatTooltip(event.datum);
          }
          const rect = this.container.getBoundingClientRect();
          const localX = event.globalPosition.x - rect.left;
          const localY = event.globalPosition.y - rect.top;
          this.tooltip.show({
            x: localX,
            y: localY,
            content: lastTooltipContent,
          });
        }
      } else if (event.type === 'leave') {
        this.clearHoverDecoration();
        this.tooltip?.hide();
        lastTooltipContent = null;
      }
      // click: no-op for v1.
    };

    this.interactionLayer = new InteractionLayer<BarRecord>({
      stage: this.plotContainer,
      width: this.plotWidth,
      height: this.plotHeight,
      hitTest: hitTester,
      onEvent: handleEvent,
    });
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
