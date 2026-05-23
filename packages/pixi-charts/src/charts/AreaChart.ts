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
import type { ChartSpec } from '../spec/ChartSpec.js';

import {
  DOWNSAMPLE_TARGET,
  DOWNSAMPLE_THRESHOLD,
  HIT_TEST_RADIUS_PX,
  buildCartesianHitTester,
  buildCartesianSetup,
  formatCartesianTooltip,
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
    const plotWidth = Math.max(0, canvasW - margin.left - margin.right);
    const plotHeight = Math.max(0, canvasH - margin.top - margin.bottom);
    this.plotWidth = plotWidth;
    this.plotHeight = plotHeight;

    if (plotWidth <= 0 || plotHeight <= 0) return;

    const setup = buildCartesianSetup(this.spec, plotWidth, plotHeight);
    this.series = setup.series;
    this.xAdapter = setup.xAdapter;
    this.yAdapter = setup.yAdapter;
    this.xAxis = setup.xAxis;
    this.yAxis = setup.yAxis;

    this.maybeLogDownsample();

    const plotContainer = new Container();
    plotContainer.position.set(margin.left, margin.top);
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

    this.setupInteractionAndTooltip();

    this.maybeBuildLegend();

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
    const handleEvent = (event: InteractionEvent<CartesianHit>): void => {
      if (event.type === 'hover') {
        if (this.tooltip !== null) {
          const rect = this.container.getBoundingClientRect();
          const localX = event.globalPosition.x - rect.left;
          const localY = event.globalPosition.y - rect.top;
          this.tooltip.show({
            x: localX,
            y: localY,
            content: this.formatTooltip(event.datum),
          });
        }
      } else if (event.type === 'leave') {
        this.tooltip?.hide();
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

  /** @internal */
  private maybeBuildLegend(): void {
    if (this.plotContainer === null) return;
    const showLegend = this.spec.options?.showLegend !== false;
    if (!showLegend) return;
    if (this.series.length < 2) return;

    const legend = new Legend({
      type: 'categorical',
      orientation: 'vertical',
      items: this.series.map((s) => ({ label: s.name, color: s.color })),
    });
    const padding = 8;
    const x = Math.max(0, this.plotWidth - legend.width - padding);
    const y = padding;
    legend.container.position.set(x, y);
    this.plotContainer.addChild(legend.container);
    this.legend = legend;
  }
}
