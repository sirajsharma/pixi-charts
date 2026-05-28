import { Container, Graphics } from 'pixi.js';

import { Axis } from '../core/Axis.js';
import { Chart } from '../core/Chart.js';
import {
  InteractionLayer,
  type HitTester,
  type InteractionEvent,
} from '../core/InteractionLayer.js';
import { Legend } from '../core/Legend.js';
import type { ScaleAdapter } from '../core/ScaleAdapter.js';
import { Tooltip } from '../core/Tooltip.js';
import { tween } from '../core/animation.js';
import { computeLayout } from '../core/layout.js';
import type { ChartSpec } from '../spec/ChartSpec.js';

import {
  DOWNSAMPLE_TARGET,
  DOWNSAMPLE_THRESHOLD,
  HIT_TEST_RADIUS_PX,
  buildCartesianHitTester,
  buildCartesianScales,
  buildCartesianSeries,
  formatCartesianTooltip,
  resolveAxisOptions,
  resolveHeight,
  resolveMargin,
  resolveWidth,
  type CartesianHit,
  type CartesianSeries,
  type XValue,
} from './_shared/cartesian.js';

/** Stroke width for the area's top edge outline. */
const AREA_STROKE_WIDTH = 2;
/** Fill opacity for the area body. Low enough that overlapping series stay readable. */
const AREA_FILL_ALPHA = 0.4;

/** Hover-marker radius (pixels) drawn at the active datum on hover. */
const HOVER_MARKER_RADIUS = 6;

/** Duration (ms) of hover decoration fade-in / fade-out. */
const HOVER_ANIMATION_MS = 120;

export interface AreaChartOptions {
  /** DOM element the chart canvas will be appended to. */
  container: HTMLElement;
  /** Parsed and validated spec. */
  spec: ChartSpec;
}

/**
 * Area chart — a filled region between each series' line and a zero
 * baseline, with a stroked top edge.
 *
 * Shares the entire data + scale layer with
 * {@link import('./LineChart.js').LineChart} via
 * `charts/_shared/cartesian.ts` (series grouping, downsampling, scale /
 * adapter / axis construction, hit-testing, tooltip formatting). Both
 * classes extend {@link Chart} directly — composition, not inheritance.
 * Only the drawing differs: a closed polygon (`fill` + top-edge `stroke`)
 * rather than a bare stroke.
 *
 * **Lifecycle / resize / hit-testing** are identical to `LineChart`:
 *
 * ```ts
 * const chart = new AreaChart({ container, spec });
 * await chart.init();    // creates the PIXI app AND does the first render
 * chart.destroy();       // idempotent; cancels tweens, tears down primitives
 * ```
 *
 * **Baseline.** The fill closes along `yAdapter.scale(0)` — zero projected
 * through the y-adapter, *not* `plotHeight`. When the y-domain doesn't
 * include zero it is anchored at the plot bottom; when it crosses zero the
 * baseline sits mid-plot. The hit-tester is the shared cartesian one, so
 * the tooltip reports the point on the top edge (areas are not expected to
 * hit-test the filled body).
 *
 * **Known gap — stacking.** Multi-series areas are drawn in order and
 * overlap, with {@link AREA_FILL_ALPHA} keeping overlaps readable. Stacked
 * areas (cumulative baselines) are a future feature with their own design
 * decisions and are intentionally not implemented here.
 *
 * For most use cases, prefer the declarative {@link render} entry point —
 * use this class directly only when you need fine-grained lifecycle control.
 *
 * @example
 * ```ts
 * import { AreaChart } from 'pixi-charts';
 *
 * const chart = new AreaChart({
 *   container: document.getElementById('chart')!,
 *   spec: {
 *     type: 'area',
 *     data: [
 *       { day: 1, visits: 240 },
 *       { day: 2, visits: 312 },
 *       { day: 3, visits: 198 },
 *     ],
 *     encoding: {
 *       x: { field: 'day', type: 'quantitative' },
 *       y: { field: 'visits', type: 'quantitative' },
 *     },
 *   },
 * });
 * await chart.init();
 * chart.destroy();
 * ```
 */
export class AreaChart extends Chart {
  private readonly spec: ChartSpec;

  private series: CartesianSeries[] = [];
  private plotContainer: Container | null = null;
  private areasContainer: Container | null = null;
  private xAxis: Axis<XValue> | null = null;
  private yAxis: Axis<number> | null = null;
  private xAdapter: ScaleAdapter<XValue> | null = null;
  private yAdapter: ScaleAdapter<number> | null = null;
  private plotWidth = 0;
  private plotHeight = 0;
  private tooltip: Tooltip | null = null;
  private interactionLayer: InteractionLayer<CartesianHit> | null = null;
  private legend: Legend | null = null;
  /**
   * Hover decoration — a filled circle drawn at the active datum on the
   * area's top edge. Recreated each render as a child of the rebuilt
   * plotContainer and reset to null at the top of render so a
   * resize-during-hover starts fresh on the next pointermove.
   */
  private hoverMarker: Graphics | null = null;
  private hoverAnimationCancel: (() => void) | null = null;
  /** Tracks whether the very first render has happened (so resize skips the enter animation). */
  private didInitialRender = false;
  /** Tracks whether the downsampling notice has already been logged for this instance. */
  private loggedDownsample = false;

  constructor(opts: AreaChartOptions) {
    super({
      container: opts.container,
      width: resolveWidth(opts.spec, opts.container),
      height: resolveHeight(opts.spec, opts.container),
    });
    this.spec = opts.spec;
  }

  /**
   * Override of {@link Chart.init}: after the PIXI Application is ready,
   * runs the first render so the spec dispatcher can hand consumers a
   * fully-rendered chart back.
   */
  override async init(): Promise<void> {
    await super.init();
    if (!this.destroyed) {
      this.render();
    }
  }

  /**
   * Destroy every owned primitive in addition to the base-class teardown.
   * Idempotent — the base class guards a second call, but each primitive
   * is also idempotent so a partial-init failure stays safe.
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
   * Full render pass. Called by {@link init} for the first frame, and by
   * the base class's resize observer on subsequent container resizes.
   * Existing primitives are destroyed and rebuilt on each pass.
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

    // The hover marker lives inside plotContainer and dies with it below.
    // Drop our references so the next hover starts clean; cancelAllTweens()
    // above has already invalidated any in-flight hover fade.
    this.hoverMarker = null;
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

    // Series first → optional Legend → layout → scales. Same flow as LineChart;
    // see the comment block there for why this ordering matters.
    const series = buildCartesianSeries(this.spec);
    const showLegend = this.spec.options?.showLegend !== false;
    const legend =
      showLegend && series.length >= 2
        ? new Legend({
            type: 'categorical',
            orientation: 'vertical',
            items: series.map((s) => ({ label: s.name, color: s.color })),
          })
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

    const setup = buildCartesianScales(
      this.spec,
      series,
      plotWidth,
      plotHeight,
      resolveAxisOptions(this.spec),
    );
    this.series = setup.series;
    this.xAdapter = setup.xAdapter;
    this.yAdapter = setup.yAdapter;
    this.xAxis = setup.xAxis;
    this.yAxis = setup.yAxis;

    this.maybeLogDownsample();

    const plotContainer = new Container();
    plotContainer.position.set(layout.plotRect.x, layout.plotRect.y);
    stage.addChild(plotContainer);
    this.plotContainer = plotContainer;

    plotContainer.addChild(this.yAxis.container);
    this.xAxis.container.position.set(0, plotHeight);
    plotContainer.addChild(this.xAxis.container);

    // Areas container — separate from axes for easier z-order management.
    const areasContainer = new Container();
    plotContainer.addChild(areasContainer);
    this.areasContainer = areasContainer;

    this.drawAreas();

    // Hover marker sits above the areas so it isn't occluded by series fills.
    // Lives inside plotContainer so it's destroyed/recreated with each render
    // — no per-render leak risk.
    const hoverMarker = new Graphics();
    hoverMarker.alpha = 0;
    plotContainer.addChild(hoverMarker);
    this.hoverMarker = hoverMarker;

    this.setupInteractionAndTooltip();

    if (legend !== null && layout.legendRect !== null) {
      legend.container.position.set(layout.legendRect.x, layout.legendRect.y);
      stage.addChild(legend.container);
      this.legend = legend;
    }

    this.didInitialRender = true;
  }

  /**
   * Emit the once-per-instance LTTB downsampling notice if any series was
   * reduced. Kept in the chart class (not the shared module) so the notice
   * fires exactly once per chart even across resizes.
   *
   * @internal
   */
  private maybeLogDownsample(): void {
    if (this.series.some((s) => s.downsampled) && !this.loggedDownsample) {
      console.info(
        `AreaChart: downsampled one or more series exceeding ${String(DOWNSAMPLE_THRESHOLD)} ` +
          `points to ${String(DOWNSAMPLE_TARGET)} via LTTB.`,
      );
      this.loggedDownsample = true;
    }
  }

  /**
   * Build a hit-tester from the chart's current adapters and series.
   * Delegates to the shared {@link buildCartesianHitTester} — area charts
   * hit-test the point on the top edge, exactly like a line chart.
   *
   * @internal
   */
  private buildHitTester(): HitTester<CartesianHit> {
    const xAdapter = this.xAdapter;
    const yAdapter = this.yAdapter;
    if (xAdapter === null || yAdapter === null) return () => null;
    return buildCartesianHitTester(this.series, xAdapter, yAdapter, HIT_TEST_RADIUS_PX);
  }

  /**
   * Draw each series as a filled polygon (top edge → down to the baseline
   * → back along the baseline → closed) plus a stroked top-edge outline.
   *
   * The enter animation tweens `progress` 0 → 1 and rebuilds the polygon
   * from the first `progress * points.length` points each frame — a
   * left-to-right reveal. Honors `spec.animation.enter` (`false` skips the
   * tween; an object passes `duration` / `ease` through) and reduced-motion
   * via `tween()`. Resize passes draw the final state immediately.
   *
   * @internal
   */
  private drawAreas(): void {
    if (this.areasContainer === null) return;
    const areasContainer = this.areasContainer;
    const xAdapter = this.xAdapter;
    const yAdapter = this.yAdapter;
    if (xAdapter === null || yAdapter === null) return;

    // Baseline is zero projected through the y-adapter — NOT plotHeight.
    // For a y-domain that doesn't include zero this lands at the plot
    // bottom; for one that crosses zero it sits mid-plot.
    const baselineY = yAdapter.scale(0);

    const enter = this.spec.animation?.enter ?? true;
    const animate = enter !== false && !this.didInitialRender;
    const enterOptions = typeof enter === 'object' ? enter : {};

    for (const series of this.series) {
      const graphics = new Graphics();
      areasContainer.addChild(graphics);

      const renderUpTo = (progress: number): void => {
        graphics.clear();
        const pts = series.points;
        if (pts.length === 0) return;
        const count = Math.min(pts.length, Math.max(2, Math.floor(pts.length * progress)));
        const first = pts[0];
        const last = pts[count - 1];
        if (first === undefined || last === undefined) return;

        // Filled polygon: top edge, down to the baseline at the last x,
        // back along the baseline to the first x, closed.
        graphics.moveTo(xAdapter.scale(first.xRaw), yAdapter.scale(first.y));
        for (let i = 1; i < count; i += 1) {
          const p = pts[i];
          if (p === undefined) continue;
          graphics.lineTo(xAdapter.scale(p.xRaw), yAdapter.scale(p.y));
        }
        graphics.lineTo(xAdapter.scale(last.xRaw), baselineY);
        graphics.lineTo(xAdapter.scale(first.xRaw), baselineY);
        graphics.closePath();
        graphics.fill({ color: series.color, alpha: AREA_FILL_ALPHA });

        // Stroked top edge on top of the fill — reads better than fill alone.
        graphics.moveTo(xAdapter.scale(first.xRaw), yAdapter.scale(first.y));
        for (let i = 1; i < count; i += 1) {
          const p = pts[i];
          if (p === undefined) continue;
          graphics.lineTo(xAdapter.scale(p.xRaw), yAdapter.scale(p.y));
        }
        graphics.stroke({ color: series.color, width: AREA_STROKE_WIDTH, alpha: 1 });
      };

      if (!animate || this.app === null) {
        renderUpTo(1);
        continue;
      }

      const tweenOpts: Parameters<typeof tween>[1] = { onUpdate: renderUpTo };
      if (enterOptions.duration !== undefined) tweenOpts.duration = enterOptions.duration;
      if (enterOptions.ease !== undefined) tweenOpts.ease = enterOptions.ease;
      const cancel = tween(this.app.ticker, tweenOpts);
      this.addTween(cancel);
    }
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
    const handleEvent = (event: InteractionEvent<CartesianHit>): void => {
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

    this.interactionLayer = new InteractionLayer<CartesianHit>({
      stage: this.plotContainer,
      width: this.plotWidth,
      height: this.plotHeight,
      hitTest: hitTester,
      onEvent: handleEvent,
    });
  }

  /** @internal */
  private formatTooltip(hit: CartesianHit): string {
    const xField = this.spec.encoding.x?.field ?? 'x';
    const yField = this.spec.encoding.y?.field ?? 'y';
    const xType = this.spec.encoding.x?.type ?? 'quantitative';
    return formatCartesianTooltip(xField, yField, xType, hit);
  }

  /**
   * Position and reveal the hover marker on a newly-hovered datum. Cancels
   * any in-flight fade so rapid datum-to-datum movement reads as
   * cancel-and-restart, not a queued sequence or a blend. Marker color
   * matches the hovered series.
   *
   * @internal
   */
  private applyHoverDecoration(hit: CartesianHit): void {
    const marker = this.hoverMarker;
    const xAdapter = this.xAdapter;
    const yAdapter = this.yAdapter;
    if (marker === null || xAdapter === null || yAdapter === null || this.app === null) return;

    if (this.hoverAnimationCancel !== null) {
      this.hoverAnimationCancel();
      this.hoverAnimationCancel = null;
    }

    marker.clear().circle(0, 0, HOVER_MARKER_RADIUS).fill({ color: hit.series.color, alpha: 1 });
    marker.position.set(xAdapter.scale(hit.point.xRaw), yAdapter.scale(hit.point.y));

    const startAlpha = marker.alpha;
    const cancel = tween(this.app.ticker, {
      duration: HOVER_ANIMATION_MS,
      onUpdate: (p) => {
        marker.alpha = startAlpha + (1 - startAlpha) * p;
      },
    });
    this.hoverAnimationCancel = cancel;
    this.addTween(cancel);
  }

  /**
   * Fade the hover marker back to invisible. Leaves the marker in place
   * (position unchanged) so a fast leave-then-re-enter on the same datum
   * doesn't snap visibly.
   *
   * @internal
   */
  private clearHoverDecoration(): void {
    const marker = this.hoverMarker;
    if (marker === null || this.app === null) return;

    if (this.hoverAnimationCancel !== null) {
      this.hoverAnimationCancel();
      this.hoverAnimationCancel = null;
    }

    const startAlpha = marker.alpha;
    if (startAlpha === 0) return;

    const cancel = tween(this.app.ticker, {
      duration: HOVER_ANIMATION_MS,
      onUpdate: (p) => {
        marker.alpha = startAlpha * (1 - p);
      },
    });
    this.hoverAnimationCancel = cancel;
    this.addTween(cancel);
  }
}
