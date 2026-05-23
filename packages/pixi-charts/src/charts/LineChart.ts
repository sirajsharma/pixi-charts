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
  resolveHeight,
  resolveMargin,
  resolveWidth,
  type CartesianHit,
  type CartesianSeries,
  type XValue,
} from './_shared/cartesian.js';

/**
 * Re-exported for backward compatibility. The canonical definitions live in
 * `charts/_shared/cartesian.ts`; LineChart's original public-ish names are
 * preserved so existing consumers and tests keep resolving unchanged.
 */
export {
  buildCartesianHitTester as createLineHitTester,
  type CartesianSeries as Series,
  type CartesianPoint as SeriesPoint,
  type CartesianHit as Hit,
  type XValue,
} from './_shared/cartesian.js';

/** Stroke width for plotted lines. */
const LINE_STROKE_WIDTH = 2;

export interface LineChartOptions {
  /** DOM element the chart canvas will be appended to. */
  container: HTMLElement;
  /** Parsed and validated spec. */
  spec: ChartSpec;
}

/**
 * Line chart — the first end-to-end chart in `pixi-charts`.
 *
 * Composes the v1 primitive set: two {@link Axis} instances wrapped over
 * {@link ScaleAdapter} adapters, an optional {@link Legend} (for
 * categorical color encoding with multiple series), an optional
 * {@link Tooltip} attached to the container, and an
 * {@link InteractionLayer} fed a chart-specific hit-tester.
 *
 * The data + scale layer (series grouping, downsampling, scale/adapter/axis
 * construction, hit-testing, tooltip formatting) is shared with
 * {@link import('./AreaChart.js').AreaChart} via plain functions in
 * `charts/_shared/cartesian.ts`. LineChart still extends {@link Chart}
 * directly — composition, not inheritance.
 *
 * **Lifecycle.** Extends {@link Chart}, so the public lifecycle is:
 *
 * ```ts
 * const chart = new LineChart({ container, spec });
 * await chart.init();    // creates the PIXI app AND does the first render
 * // ...
 * chart.destroy();       // idempotent; cancels tweens, tears down primitives
 * ```
 *
 * Construction is pure — no PIXI app, no DOM mutations beyond the spec
 * being captured. The first render happens at the tail of `init()` so the
 * spec dispatcher can hand consumers a fully-rendered chart back.
 *
 * **Resize.** Inherited `ResizeObserver` re-invokes the protected
 * {@link render} on container size changes; LineChart rebuilds its scales
 * and adapters with the new ranges and skips the enter animation on those
 * subsequent passes.
 *
 * **Hit-testing strategy.** Built using the {@link ScaleAdapter}'s `kind`
 * discriminator. Continuous adapters (linear, time) use `invert()` to map
 * the pointer's x back to the domain, then find the nearest datum within
 * {@link HIT_TEST_RADIUS_PX}. Band adapters iterate the domain to find the
 * band the pointer falls inside. Across multiple series, the closest point
 * in pixel space wins.
 */
export class LineChart extends Chart {
  private readonly spec: ChartSpec;

  private series: CartesianSeries[] = [];
  private plotContainer: Container | null = null;
  private linesContainer: Container | null = null;
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

  constructor(opts: LineChartOptions) {
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

    // The base destroy() flips `destroyed` and cancels tweens before we
    // walk the owned primitives — `super.destroy()` first guarantees
    // ordering even if a primitive throws on destroy.
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
   *
   * The render is mostly idempotent: existing primitive instances are
   * destroyed and rebuilt on each pass. A future optimization could diff
   * scales and call `axis.update()` rather than reconstructing — for v1,
   * the simpler shape wins.
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

    // Tear down any prior content. On a resize this can be the second
    // pass; the first pass starts with all slots null.
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

    // Build series first so we know the series count (which decides whether
    // a categorical legend is needed). Legend dimensions feed back into
    // layout, which sets the final plot width before scales are built.
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

    const setup = buildCartesianScales(this.spec, series, plotWidth, plotHeight);
    this.series = setup.series;
    this.xAdapter = setup.xAdapter;
    this.yAdapter = setup.yAdapter;
    this.xAxis = setup.xAxis;
    this.yAxis = setup.yAxis;

    this.maybeLogDownsample();

    // Plot container holds everything inside the margins; positioned once
    // so axis / line / interaction-layer children live in plot-local
    // coordinates (origin at the plot's top-left).
    const plotContainer = new Container();
    plotContainer.position.set(layout.plotRect.x, layout.plotRect.y);
    stage.addChild(plotContainer);
    this.plotContainer = plotContainer;

    // Axes go on the plot container so their tick labels align with the
    // plot edges. Y axis at x=0; X axis at y=plotHeight.
    plotContainer.addChild(this.yAxis.container);
    this.xAxis.container.position.set(0, plotHeight);
    plotContainer.addChild(this.xAxis.container);

    // Lines container — separate from axes for easier z-order management.
    const linesContainer = new Container();
    plotContainer.addChild(linesContainer);
    this.linesContainer = linesContainer;

    this.drawLines();

    // Interaction + tooltip wiring. The tooltip is created lazily on the
    // first render rather than reusing across renders, so its DOM stays
    // clean if a resize redraws.
    this.setupInteractionAndTooltip();

    // Legend sits to the right of the plot area (in stage-absolute coords),
    // not inside the plot container — keeps it from overlapping the marks.
    if (legend !== null && layout.legendRect !== null) {
      legend.container.position.set(layout.legendRect.x, layout.legendRect.y);
      stage.addChild(legend.container);
      this.legend = legend;
    }

    this.didInitialRender = true;
  }

  /**
   * Emit the once-per-instance LTTB downsampling notice if any series was
   * reduced. Kept in the chart class (not the shared module) so the
   * notice fires exactly once per chart even across resizes — preserving
   * the pre-refactor observable behavior.
   *
   * @internal
   */
  private maybeLogDownsample(): void {
    if (this.series.some((s) => s.downsampled) && !this.loggedDownsample) {
      console.info(
        `LineChart: downsampled one or more series exceeding ${String(DOWNSAMPLE_THRESHOLD)} ` +
          `points to ${String(DOWNSAMPLE_TARGET)} via LTTB.`,
      );
      this.loggedDownsample = true;
    }
  }

  /**
   * Build a hit-tester from the chart's current adapters and series.
   * Delegates to {@link buildCartesianHitTester} so the strategy can be
   * unit-tested without standing up a real chart.
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
   * Draw each series as a stroked line. Honors `spec.animation.enter` —
   * `false` skips the tween entirely, an object passes its `duration` /
   * `ease` through to `tween()`.
   *
   * @internal
   */
  private drawLines(): void {
    if (this.linesContainer === null) return;
    const linesContainer = this.linesContainer;
    const xAdapter = this.xAdapter;
    const yAdapter = this.yAdapter;
    if (xAdapter === null || yAdapter === null) return;

    const enter = this.spec.animation?.enter ?? true;
    const animate = enter !== false && !this.didInitialRender;
    const enterOptions = typeof enter === 'object' ? enter : {};

    for (const series of this.series) {
      const graphics = new Graphics();
      linesContainer.addChild(graphics);

      const renderUpTo = (progress: number): void => {
        graphics.clear();
        const pts = series.points;
        if (pts.length === 0) return;
        const count = Math.max(2, Math.floor(pts.length * progress));
        const first = pts[0];
        if (first === undefined) return;
        graphics.moveTo(xAdapter.scale(first.xRaw), yAdapter.scale(first.y));
        for (let i = 1; i < Math.min(count, pts.length); i += 1) {
          const p = pts[i];
          if (p === undefined) continue;
          graphics.lineTo(xAdapter.scale(p.xRaw), yAdapter.scale(p.y));
        }
        graphics.stroke({ color: series.color, width: LINE_STROKE_WIDTH, alpha: 1 });
      };

      if (!animate || this.app === null) {
        renderUpTo(1);
        continue;
      }

      // Build options without spreading `undefined` keys — TweenOptions
      // uses `exactOptionalPropertyTypes`, which rejects explicit
      // `key: undefined`.
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

    // Tear down a prior interaction layer (resize path). The tooltip is
    // kept across resizes — its DOM survives untouched, only the hit-test
    // wiring needs rebuilding.
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
}
