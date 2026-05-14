import { extent, max as d3max, min as d3min } from 'd3-array';
import { format as d3format } from 'd3-format';
import { scaleBand, scaleLinear, scaleTime } from 'd3-scale';
import { timeFormat } from 'd3-time-format';
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
import {
  bandAdapter,
  linearAdapter,
  timeAdapter,
  type ScaleAdapter,
} from '../core/ScaleAdapter.js';
import { Tooltip } from '../core/Tooltip.js';
import { tween } from '../core/animation.js';
import type { ChartSpec, FieldType } from '../spec/ChartSpec.js';
import { lttb, type DataPoint } from '../utils/lttb.js';

/** Downsampling cutoff: series larger than this get LTTB-reduced. */
const DOWNSAMPLE_THRESHOLD = 10_000;
/** Target point count after downsampling. Trades resolution for draw cost. */
const DOWNSAMPLE_TARGET = 2000;

/** Default margins, in CSS pixels. */
const DEFAULT_MARGIN = { top: 24, right: 24, bottom: 40, left: 56 } as const;
/** Default canvas size when no `options.width/height` or container size is available. */
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;
/** Default categorical scheme used when `encoding.color.scheme` is unset. */
const DEFAULT_COLOR_SCHEME: CategoricalSchemeName = 'category10';
/** Hit-test pixel radius for continuous x-axes. */
const HIT_TEST_RADIUS_PX = 20;
/** Stroke width for plotted lines. */
const LINE_STROKE_WIDTH = 2;

/**
 * X-axis domain element. `string` for band scales, `Date` for time scales,
 * `number` for linear. The chart carries this through with a discriminator
 * pattern so the hit-tester and axis types flow cleanly.
 */
export type XValue = number | string | Date;

/** A single point in a series, post-transformation. Internal — exposed for hit-tester tests. */
export interface SeriesPoint {
  /** Numeric x for math (epoch ms for temporal, band index for categorical, raw for quantitative). */
  xNum: number;
  /** Original-typed x (used for scale lookup). */
  xRaw: XValue;
  /** Numeric y. */
  y: number;
  /** Original row, preserved for tooltips and click datum. */
  datum: Record<string, unknown>;
}

/** A named line series. Internal — exposed for hit-tester tests. */
export interface Series {
  name: string;
  color: number;
  points: SeriesPoint[];
  /** Whether this series was downsampled. */
  downsampled: boolean;
}

/** Hit-test result carried out of the InteractionLayer to the tooltip. */
export interface Hit {
  series: Series;
  point: SeriesPoint;
}

/**
 * Build a {@link HitTester} for a line chart's plot area.
 *
 * Strategy depends on the x-adapter's `kind`:
 * - `'band'` — iterate the domain to find the band the pointer's x falls
 *   into, then return the closest point (by y) in any series for that band.
 * - `'continuous'` / `'time'` — pixel-radius nearest point across all
 *   series; returns `null` if nothing is within `radiusPx`.
 *
 * Pure function: takes a snapshot of `series` and the adapters and
 * returns a closure. Exported separately from the class so unit tests can
 * exercise the strategy without standing up a PIXI Application — matches
 * the {@link import('../core/InteractionLayer.js').handlePointerSample}
 * pattern from Session 3.
 */
export function createLineHitTester(
  series: readonly Series[],
  xAdapter: ScaleAdapter<XValue>,
  yAdapter: ScaleAdapter<number>,
  radiusPx: number,
): HitTester<Hit> {
  if (xAdapter.kind === 'band') {
    const bandwidth = xAdapter.bandwidth?.() ?? 0;
    return (point: Point): Hit | null => {
      let bandX: string | null = null;
      for (const dom of xAdapter.ticks()) {
        const px = xAdapter.scale(dom);
        if (point.x >= px && point.x <= px + bandwidth) {
          bandX = dom as string;
          break;
        }
      }
      if (bandX === null) return null;

      let best: Hit | null = null;
      let bestDist = Infinity;
      for (const s of series) {
        for (const sp of s.points) {
          if (sp.xRaw !== bandX) continue;
          const py = yAdapter.scale(sp.y);
          const d = Math.abs(py - point.y);
          if (d < bestDist) {
            bestDist = d;
            best = { series: s, point: sp };
          }
        }
      }
      return best;
    };
  }

  // Continuous (linear) and time. Use invert() to convert the pointer x
  // to a domain value, then bisect each series' sorted `xNum` list to
  // find the nearest candidate point cheaply. Final accept/reject is in
  // pixel space against `radiusPx`.
  const invertFn = xAdapter.invert?.bind(xAdapter);
  return (point: Point): Hit | null => {
    let targetNum: number;
    if (invertFn !== undefined) {
      const inv = invertFn(point.x);
      targetNum = inv instanceof Date ? inv.getTime() : (inv as number);
    } else {
      targetNum = point.x;
    }

    let best: Hit | null = null;
    let bestDist = Infinity;

    for (const s of series) {
      // Binary search for the first point with xNum >= targetNum.
      let lo = 0;
      let hi = s.points.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        const sp = s.points[mid];
        if (sp !== undefined && sp.xNum < targetNum) lo = mid + 1;
        else hi = mid;
      }
      // Check the candidate at `lo` and its left neighbour at `lo - 1`.
      for (const idx of [lo - 1, lo]) {
        const sp = s.points[idx];
        if (sp === undefined) continue;
        const px = xAdapter.scale(sp.xRaw);
        const py = yAdapter.scale(sp.y);
        const dx = px - point.x;
        const dy = py - point.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) {
          bestDist = d;
          best = { series: s, point: sp };
        }
      }
    }
    if (best === null || bestDist > radiusPx) return null;
    return best;
  };
}

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

  private series: Series[] = [];
  private plotContainer: Container | null = null;
  private linesContainer: Container | null = null;
  private xAxis: Axis<XValue> | null = null;
  private yAxis: Axis<number> | null = null;
  private xAdapter: ScaleAdapter<XValue> | null = null;
  private yAdapter: ScaleAdapter<number> | null = null;
  private plotWidth = 0;
  private plotHeight = 0;
  private tooltip: Tooltip | null = null;
  private interactionLayer: InteractionLayer<Hit> | null = null;
  private legend: Legend | null = null;
  /** Tracks whether the very first render has happened (so resize skips the enter animation). */
  private didInitialRender = false;
  /** Tracks whether downsampling notice has already been logged for this instance. */
  private loggedDownsample = false;

  constructor(opts: LineChartOptions) {
    super({
      container: opts.container,
      width: resolveWidth(opts),
      height: resolveHeight(opts),
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

    const margin = this.resolveMargin();
    const canvasW = this.app.renderer.width / this.app.renderer.resolution;
    const canvasH = this.app.renderer.height / this.app.renderer.resolution;
    this.plotWidth = Math.max(0, canvasW - margin.left - margin.right);
    this.plotHeight = Math.max(0, canvasH - margin.top - margin.bottom);

    if (this.plotWidth <= 0 || this.plotHeight <= 0) return;

    this.series = this.buildSeries();

    const xAxisType = this.spec.encoding.x?.type ?? 'quantitative';
    const { xAdapter, xAxis } = this.buildXAxis(xAxisType);
    const { yAdapter, yAxis } = this.buildYAxis();
    this.xAdapter = xAdapter;
    this.yAdapter = yAdapter;
    this.xAxis = xAxis;
    this.yAxis = yAxis;

    // Plot container holds everything inside the margins; positioned once
    // so axis / line / interaction-layer children live in plot-local
    // coordinates (origin at the plot's top-left).
    const plotContainer = new Container();
    plotContainer.position.set(margin.left, margin.top);
    stage.addChild(plotContainer);
    this.plotContainer = plotContainer;

    // Axes go on the plot container so their tick labels align with the
    // plot edges. Y axis at x=0; X axis at y=plotHeight.
    plotContainer.addChild(this.yAxis.container);
    this.xAxis.container.position.set(0, this.plotHeight);
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

    // Legend in the plot-area top-right, if multi-series.
    this.maybeBuildLegend();

    this.didInitialRender = true;
  }

  /**
   * Build a hit-tester from the chart's current adapters and series.
   * Delegates to {@link createLineHitTester} so the strategy can be unit-
   * tested without standing up a real chart.
   *
   * @internal
   */
  private buildHitTester(): HitTester<Hit> {
    const xAdapter = this.xAdapter;
    const yAdapter = this.yAdapter;
    if (xAdapter === null || yAdapter === null) return () => null;
    return createLineHitTester(this.series, xAdapter, yAdapter, HIT_TEST_RADIUS_PX);
  }

  /** Convert raw spec data into typed series. @internal */
  private buildSeries(): Series[] {
    const xField = this.spec.encoding.x?.field ?? '';
    const yField = this.spec.encoding.y?.field ?? '';
    const xType = this.spec.encoding.x?.type ?? 'quantitative';

    const colorField = this.spec.encoding.color?.field;
    const scheme =
      (this.spec.encoding.color?.scheme as CategoricalSchemeName | undefined) ??
      DEFAULT_COLOR_SCHEME;

    const transform = (row: Record<string, unknown>, bandIndex: number): SeriesPoint | null => {
      const yRaw = row[yField];
      const y = toNumber(yRaw);
      if (y === null) return null;

      const xRaw = row[xField];
      let xVal: XValue;
      let xNum: number;
      if (xType === 'temporal') {
        const d = toDate(xRaw);
        if (d === null) return null;
        xVal = d;
        xNum = d.getTime();
      } else if (xType === 'categorical') {
        xVal = String(xRaw);
        xNum = bandIndex;
      } else {
        const n = toNumber(xRaw);
        if (n === null) return null;
        xVal = n;
        xNum = n;
      }
      return { xRaw: xVal, xNum, y, datum: row };
    };

    const grouped = new Map<string, Record<string, unknown>[]>();
    if (colorField !== undefined) {
      for (const row of this.spec.data) {
        const key = stringifyKey(row[colorField]);
        let arr = grouped.get(key);
        if (arr === undefined) {
          arr = [];
          grouped.set(key, arr);
        }
        arr.push(row);
      }
    } else {
      grouped.set('', this.spec.data.slice());
    }

    const seriesNames = [...grouped.keys()];
    const out: Series[] = [];
    seriesNames.forEach((name, seriesIdx) => {
      const rows = grouped.get(name) ?? [];
      let points: SeriesPoint[] = [];
      rows.forEach((row, i) => {
        const sp = transform(row, i);
        if (sp !== null) points.push(sp);
      });
      // Sort points by xNum so the line is drawn in order regardless of
      // the input ordering. Stable enough across categorical/quantitative/
      // temporal because xNum is a single numeric per point.
      points.sort((a, b) => a.xNum - b.xNum);

      let downsampled = false;
      if (points.length > DOWNSAMPLE_THRESHOLD) {
        const reduced = lttb(
          points.map<DataPoint>((p) => ({ x: p.xNum, y: p.y })),
          DOWNSAMPLE_TARGET,
        );
        // Re-pair the LTTB output back to SeriesPoints by xNum lookup.
        const byXNum = new Map(points.map((p) => [p.xNum, p]));
        points = reduced
          .map((d) => byXNum.get(d.x))
          .filter((p): p is SeriesPoint => p !== undefined);
        downsampled = true;
      }

      const color =
        seriesNames.length > 1
          ? getCategoricalColor(scheme, seriesIdx)
          : getCategoricalColor(scheme, 0);

      out.push({
        name,
        color,
        points,
        downsampled,
      });
    });

    if (out.some((s) => s.downsampled) && !this.loggedDownsample) {
      console.info(
        `LineChart: downsampled one or more series exceeding ${String(DOWNSAMPLE_THRESHOLD)} ` +
          `points to ${String(DOWNSAMPLE_TARGET)} via LTTB.`,
      );
      this.loggedDownsample = true;
    }

    return out;
  }

  /** @internal */
  private buildXAxis(xType: FieldType): {
    xAdapter: ScaleAdapter<XValue>;
    xAxis: Axis<XValue>;
  } {
    if (xType === 'temporal') {
      const dates = this.series.flatMap((s) => s.points.map((p) => p.xRaw as Date));
      const [a, b] = extent(dates) as [Date | undefined, Date | undefined];
      const scale = scaleTime()
        .domain([a ?? new Date(0), b ?? new Date(1)])
        .range([0, this.plotWidth]);
      const adapter = timeAdapter(scale) as unknown as ScaleAdapter<XValue>;
      const axis = new Axis<XValue>({
        scale: adapter,
        orientation: 'bottom',
        length: this.plotWidth,
        tickFormat: (v) => timeFormat('%b %d')(v as Date),
      });
      return { xAdapter: adapter, xAxis: axis };
    }
    if (xType === 'categorical') {
      const domain: string[] = [];
      const seen = new Set<string>();
      for (const s of this.series) {
        for (const p of s.points) {
          const v = p.xRaw as string;
          if (!seen.has(v)) {
            seen.add(v);
            domain.push(v);
          }
        }
      }
      const scale = scaleBand().domain(domain).range([0, this.plotWidth]).padding(0);
      const adapter = bandAdapter(scale) as unknown as ScaleAdapter<XValue>;
      const axis = new Axis<XValue>({
        scale: adapter,
        orientation: 'bottom',
        length: this.plotWidth,
      });
      return { xAdapter: adapter, xAxis: axis };
    }
    // quantitative
    const xs = this.series.flatMap((s) => s.points.map((p) => p.xNum));
    const [a, b] = extent(xs);
    const scale = scaleLinear()
      .domain([a ?? 0, b ?? 1])
      .range([0, this.plotWidth]);
    const adapter = linearAdapter(scale) as unknown as ScaleAdapter<XValue>;
    const axis = new Axis<XValue>({
      scale: adapter,
      orientation: 'bottom',
      length: this.plotWidth,
      tickFormat: (v) => d3format('~g')(v as number),
    });
    return { xAdapter: adapter, xAxis: axis };
  }

  /** @internal */
  private buildYAxis(): { yAdapter: ScaleAdapter<number>; yAxis: Axis<number> } {
    const ys = this.series.flatMap((s) => s.points.map((p) => p.y));
    const minY = d3min(ys) ?? 0;
    const maxY = d3max(ys) ?? 1;
    const domain: [number, number] = minY >= 0 ? [0, maxY] : [minY, maxY];
    const scale = scaleLinear().domain(domain).range([this.plotHeight, 0]).nice();
    const adapter = linearAdapter(scale);
    const axis = new Axis<number>({
      scale: adapter,
      orientation: 'left',
      length: this.plotHeight,
      tickFormat: (v) => d3format('~s')(v),
      showGrid: true,
      gridLength: this.plotWidth,
    });
    return { yAdapter: adapter, yAxis: axis };
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
    const handleEvent = (event: InteractionEvent<Hit>): void => {
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

    this.interactionLayer = new InteractionLayer<Hit>({
      stage: this.plotContainer,
      width: this.plotWidth,
      height: this.plotHeight,
      hitTest: hitTester,
      onEvent: handleEvent,
    });
  }

  /** @internal */
  private formatTooltip(hit: Hit): string {
    const xField = this.spec.encoding.x?.field ?? 'x';
    const yField = this.spec.encoding.y?.field ?? 'y';
    const xType = this.spec.encoding.x?.type ?? 'quantitative';
    let xStr: string;
    if (xType === 'temporal') {
      xStr = timeFormat('%b %d, %Y')(hit.point.xRaw as Date);
    } else if (xType === 'categorical') {
      xStr = hit.point.xRaw as string;
    } else {
      xStr = d3format('~g')(hit.point.xRaw as number);
    }
    const yStr = d3format(',.2~f')(hit.point.y);
    return `${xField}: ${xStr} • ${yField}: ${yStr}`;
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
    // Position in the plot-area top-right, padded slightly from the edge.
    const padding = 8;
    const x = Math.max(0, this.plotWidth - legend.width - padding);
    const y = padding;
    legend.container.position.set(x, y);
    this.plotContainer.addChild(legend.container);
    this.legend = legend;
  }

  /** @internal */
  private resolveMargin(): { top: number; right: number; bottom: number; left: number } {
    const m = this.spec.options?.margin;
    return {
      top: m?.top ?? DEFAULT_MARGIN.top,
      right: m?.right ?? DEFAULT_MARGIN.right,
      bottom: m?.bottom ?? DEFAULT_MARGIN.bottom,
      left: m?.left ?? DEFAULT_MARGIN.left,
    };
  }
}

/**
 * Convert an unknown row value into a string key for series grouping.
 * Uses primitive-aware conversion so a `null` or `undefined` becomes the
 * empty string and arbitrary objects become a JSON snapshot rather than
 * the useless `'[object Object]'`.
 */
function stringifyKey(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
    return String(v);
  }
  return JSON.stringify(v);
}

/** Coerce a value (typically from `Record<string, unknown>`) to a number, or `null`. */
function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Coerce a value to a `Date`, or `null` if it can't be parsed. */
function toDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function resolveWidth(opts: LineChartOptions): number {
  return (
    opts.spec.options?.width ??
    (opts.container.clientWidth > 0 ? opts.container.clientWidth : DEFAULT_WIDTH)
  );
}

function resolveHeight(opts: LineChartOptions): number {
  return (
    opts.spec.options?.height ??
    (opts.container.clientHeight > 0 ? opts.container.clientHeight : DEFAULT_HEIGHT)
  );
}
