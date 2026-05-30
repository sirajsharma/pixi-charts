import { Container, Graphics } from 'pixi.js';

import { Axis } from '../core/Axis.js';
import { Chart, type UpdateOptions } from '../core/Chart.js';
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
  buildCartesianAxisPrep,
  buildCartesianHitTester,
  buildCartesianSeries,
  formatCartesianTooltip,
  resolveAxisOptions,
  resolveChartTheme,
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

/** Hover-marker radius (pixels) drawn at the active datum on hover. */
const HOVER_MARKER_RADIUS = 6;

/** Duration (ms) of hover decoration fade-in / fade-out. */
const HOVER_ANIMATION_MS = 120;

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
 * **Lifecycle and updates.** Construction is pure. The first render runs
 * at the tail of {@link init} so the spec dispatcher hands consumers a
 * fully-rendered chart back. {@link Chart.update} swaps the data and
 * recomputes scales, geometry, axes, and the hit-tester — the PIXI
 * Application, axes, legend, and interaction layer are all reused
 * (no GL re-init, no DOM churn).
 *
 * **Update animation.** `update({ animate: true })` currently snaps;
 * tweening line geometry across changing point counts requires diffing
 * and is deferred.
 *
 * **Hit-testing strategy.** Built using the {@link ScaleAdapter}'s `kind`
 * discriminator. Continuous adapters (linear, time) use `invert()` to map
 * the pointer's x back to the domain, then find the nearest datum within
 * {@link HIT_TEST_RADIUS_PX}. Band adapters iterate the domain to find the
 * band the pointer falls inside. Across multiple series, the closest point
 * in pixel space wins.
 *
 * For most use cases, prefer the declarative {@link render} entry point —
 * use this class directly only when you need fine-grained lifecycle control
 * or want to bypass spec validation.
 */
export class LineChart extends Chart {
  private spec: ChartSpec;

  private series: CartesianSeries[] = [];
  private plotContainer: Container | null = null;
  /**
   * Back-most layer inside {@link plotContainer}. Holds each axis's
   * `gridContainer`, added BEFORE {@link linesContainer} so gridlines stay
   * behind the plotted lines.
   */
  private gridLayer: Container | null = null;
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
  private lastTooltipContent: string | null = null;

  /**
   * Hover decoration — a small filled circle drawn at the active datum.
   * Created once in {@link ensureSetup} and reused across updates; its
   * alpha is the only state carried between hover events.
   */
  private hoverMarker: Graphics | null = null;
  private hoverAnimationCancel: (() => void) | null = null;
  /** Tracks whether the very first render has happened (so resize/update skip the enter animation). */
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
   * Idempotent.
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
    if (this.hoverAnimationCancel !== null) {
      this.hoverAnimationCancel();
      this.hoverAnimationCancel = null;
    }
    if (this.hoverMarker !== null) {
      this.hoverMarker.alpha = 0;
    }
  }

  protected override ensureSetup(): void {
    if (this.app === null) return;
    const stage = this.app.stage;

    if (this.plotContainer === null) {
      this.plotContainer = new Container();
      stage.addChild(this.plotContainer);
    }
    if (this.gridLayer === null) {
      this.gridLayer = new Container();
      this.plotContainer.addChild(this.gridLayer);
    }
    if (this.linesContainer === null) {
      this.linesContainer = new Container();
      this.plotContainer.addChild(this.linesContainer);
    }
    if (this.hoverMarker === null) {
      this.hoverMarker = new Graphics();
      this.hoverMarker.alpha = 0;
      this.plotContainer.addChild(this.hoverMarker);
    }
    if (this.tooltip === null && this.spec.options?.showTooltip !== false) {
      this.tooltip = new Tooltip({ container: this.container });
    }
  }

  protected override redrawData(_options?: UpdateOptions): void {
    if (this.app === null || this.plotContainer === null || this.linesContainer === null) return;
    void _options;

    const stage = this.app.stage;
    const margin = resolveMargin(this.spec);
    const canvasW = this.app.screen.width;
    const canvasH = this.app.screen.height;
    const themeColors = resolveChartTheme(this.spec);

    // Series first → optional Legend → layout → scales. Legend
    // dimensions feed back into layout (the plot loses width to the
    // legend), so it must be sized before computing the plot rect.
    const series = buildCartesianSeries(this.spec);
    const showLegend = this.spec.options?.showLegend !== false;
    const shouldShowLegend = showLegend && series.length >= 2;
    const legendItems = series.map((s) => ({ label: s.name, color: s.color }));

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

    const prep = buildCartesianAxisPrep(
      this.spec,
      series,
      plotWidth,
      plotHeight,
      resolveAxisOptions(this.spec),
    );
    this.series = prep.series;
    this.xAdapter = prep.xAdapter;
    this.yAdapter = prep.yAdapter;

    this.maybeLogDownsample();

    this.plotContainer.position.set(layout.plotRect.x, layout.plotRect.y);
    if (this.legend !== null && layout.legendRect !== null) {
      this.legend.container.position.set(layout.legendRect.x, layout.legendRect.y);
    }

    // Axes: create on first redraw, update afterwards. Y-axis at x=0;
    // X-axis at y=plotHeight. Each axis's gridContainer is added to
    // gridLayer (behind data); chrome is added to plotContainer (in front
    // of data so labels stay legible).
    const gridLayer = this.gridLayer;
    if (gridLayer === null) return;
    if (this.xAxis === null) {
      this.xAxis = new Axis<XValue>(prep.xAxisOpts);
      gridLayer.addChild(this.xAxis.gridContainer);
      this.plotContainer.addChild(this.xAxis.container);
    } else {
      this.xAxis.update(prep.xAxisOpts);
    }
    this.xAxis.container.position.set(0, plotHeight);
    this.xAxis.gridContainer.position.set(0, plotHeight);

    if (this.yAxis === null) {
      this.yAxis = new Axis<number>(prep.yAxisOpts);
      gridLayer.addChild(this.yAxis.gridContainer);
      this.plotContainer.addChild(this.yAxis.container);
    } else {
      this.yAxis.update(prep.yAxisOpts);
    }

    // Wholesale lines redraw — the per-series Graphics count tracks
    // series.length, which can change when the color grouping changes.
    // Destroy and rebuild rather than diffing.
    this.clearLines();
    this.drawLines();

    this.setupInteractionAndTooltip();

    this.didInitialRender = true;
  }

  /**
   * Destroy every per-series {@link Graphics} currently inside
   * {@link linesContainer}. Called at the start of each {@link redrawData}
   * before {@link drawLines} repopulates with the new series. The
   * container itself is reused.
   *
   * @internal
   */
  private clearLines(): void {
    if (this.linesContainer === null) return;
    const children = [...this.linesContainer.children];
    for (const child of children) {
      child.destroy();
    }
    this.linesContainer.removeChildren();
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
   * `ease` through to `tween()`. The enter animation runs only on the
   * first render; resizes and updates draw the final state immediately.
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

    const hitTester = this.buildHitTester();

    if (this.interactionLayer === null) {
      this.interactionLayer = new InteractionLayer<CartesianHit>({
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
  private handleInteraction(event: InteractionEvent<CartesianHit>): void {
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
      const datum = event.datum.point.datum;
      const seriesName = event.datum.series.name;
      this.emitClick({
        datum,
        index: this.spec.data.indexOf(datum),
        position: { x: event.position.x, y: event.position.y },
        // Internal single-series sentinel is '' — omit so consumers see
        // `series === undefined` for single-line charts.
        ...(seriesName !== '' ? { series: seriesName } : {}),
      });
    }
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
   * cancel-and-restart, not a queued sequence or a blend.
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
