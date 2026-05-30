import { extent } from 'd3-array';
import { format as d3format } from 'd3-format';
import { scaleLinear, scaleSqrt, scaleTime } from 'd3-scale';
import { timeFormat } from 'd3-time-format';
import { Container, Graphics, Particle, ParticleContainer, Sprite, type Texture } from 'pixi.js';

import { Axis, type AxisOptions } from '../core/Axis.js';
import { Chart, type UpdateOptions } from '../core/Chart.js';
import {
  getCategoricalColor,
  getSequentialColor,
  sequentialSchemes,
  type CategoricalSchemeName,
  type SequentialSchemeName,
} from '../core/ColorScheme.js';
import {
  InteractionLayer,
  type HitTester,
  type InteractionEvent,
} from '../core/InteractionLayer.js';
import { Legend } from '../core/Legend.js';
import { linearAdapter, timeAdapter, type ScaleAdapter } from '../core/ScaleAdapter.js';
import { Tooltip } from '../core/Tooltip.js';
import { tween } from '../core/animation.js';
import { computeLayout } from '../core/layout.js';
import type { ChartSpec } from '../spec/ChartSpec.js';
import { SpatialIndex, type SpatialRecord } from '../utils/quadtree.js';

import type { ResolvedThemeColors } from '../core/theme.js';

import {
  COLOR_GROUP_WARN_THRESHOLD,
  resolveChartTheme,
  resolveHeight,
  resolveMargin,
  resolveWidth,
  stringifyKey,
  toDate,
  toNumber,
} from './_shared/cartesian.js';

/**
 * Default point radius (px) when there is no `size` encoding.
 */
const DEFAULT_RADIUS = 4;
/**
 * `[min, max]` pixel-radius range for the `size` encoding's square-root
 * scale. See {@link ScatterChart} for why the scale is sqrt, not linear.
 */
const SIZE_RANGE: readonly [number, number] = [3, 12];
/**
 * Radius (px) of the white circle baked into the shared particle texture.
 * Each particle is scaled down to its data radius, so this just sets the
 * texture's sampling resolution — 64 keeps small points crisp without
 * wasting GPU memory (one 128×128 texture per chart instance, total).
 */
const TEXTURE_RADIUS = 64;
/**
 * Floor for the pointer hit radius (px). The effective radius is
 * `max(MIN_HIT_RADIUS, largestRenderedRadius)` so a click near a fat point
 * still registers, and tiny points are still catchable.
 */
const MIN_HIT_RADIUS = 12;
/** Default sequential scheme for a quantitative colour encoding. */
const DEFAULT_SEQUENTIAL_SCHEME: SequentialSchemeName = 'viridis';
/** Default categorical scheme (matches the rest of the library). */
const DEFAULT_CATEGORICAL_SCHEME: CategoricalSchemeName = 'category10';

/** Duration (ms) of hover decoration fade/scale-in / fade/scale-out. */
const HOVER_ANIMATION_MS = 120;
/**
 * Scale multiplier applied to the hover overlay relative to the hovered
 * point's data-driven radius. 1.5× reads as a clear "enlarge" without
 * occluding neighbouring points.
 */
const HOVER_SCALE_MULTIPLIER = 1.5;

/** Scatter's positional axis value: a continuous number or a Date. */
type AxisValue = number | Date;

/**
 * One plotted point, post-projection. `x`/`y` are **pixel-space** (already
 * run through the axis scales); `radius` and `color` are the resolved
 * visual encoding; `datum` is the original row for the tooltip.
 */
export interface ScatterRecord {
  x: number;
  y: number;
  radius: number;
  color: number;
  datum: Record<string, unknown>;
}

/** Continuous-legend descriptor (quantitative colour). @internal */
interface ContinuousLegendSpec {
  kind: 'continuous';
  scheme: SequentialSchemeName;
  domain: [number, number];
}
/** Categorical-legend descriptor. @internal */
interface CategoricalLegendSpec {
  kind: 'categorical';
  items: { label: string; color: number }[];
}
type LegendSpec = ContinuousLegendSpec | CategoricalLegendSpec | null;

interface ScatterSetup {
  records: ScatterRecord[];
  xAdapter: ScaleAdapter<AxisValue>;
  yAdapter: ScaleAdapter<AxisValue>;
  xAxisOpts: AxisOptions<AxisValue>;
  yAxisOpts: AxisOptions<AxisValue>;
  /** Largest rendered radius, for sizing the hit target. */
  maxRadius: number;
}

export interface ScatterChartOptions {
  /** DOM element the chart canvas will be appended to. */
  container: HTMLElement;
  /** Parsed and validated spec. */
  spec: ChartSpec;
}

/**
 * Scatter plot — the library's performance flagship.
 *
 * Built for the **100k-point regime** via a single batched
 * {@link ParticleContainer} draw call: every point is a PixiJS v8
 * {@link Particle} sharing one tinted texture, so streaming stays smooth at
 * scales where per-point Canvas libraries become unresponsive. Pointer
 * hit-tests answer in `O(log n)` via a {@link SpatialIndex} (`d3-quadtree`)
 * instead of a linear scan. See the [Performance page](https://pixicharts.com/performance/)
 * for live numbers on commodity hardware.
 *
 * ## Architectural decisions
 *
 * **`ParticleContainer`, not `Graphics` or custom shaders.** `Graphics`
 * (one circle per point) collapses above ~5k points; custom WebGL shaders
 * are faster still but add a shader-compilation/debugging surface not worth
 * it for v1. `ParticleContainer` is purpose-built for "many sprites, one
 * texture, one draw call". A custom-shader pass is a documented future
 * optimization if profiling ever demands it.
 *
 * **One white texture + per-particle tint** (not pre-baked per-colour
 * textures). PIXI **v8**'s `Particle` supports a per-particle `tint` over a
 * shared texture while still batching into a single draw — so a single
 * white circle texture, tinted per point, covers categorical *and*
 * continuous colour with no per-colour bake step and exactly one texture to
 * free. (The "pre-bake one texture per colour" workaround is a PIXI **v7**
 * concern; v8's per-particle tint makes it unnecessary.)
 *
 * **Square-root size scale.** With a `size` encoding, radius ∝ √value so
 * that *area* (visual weight) ∝ value. Scaling radius linearly with value —
 * the common footgun — makes area grow with value², badly overstating large
 * values. Range defaults to `[3, 12]` px (`d3-scale`'s `scaleSqrt`).
 *
 * **Viridis for continuous colour.** A `'quantitative'` colour encoding maps
 * through a sequential interpolator (default **viridis** — perceptually
 * uniform and colourblind-safe), paired with a continuous {@link Legend}.
 * Categorical colour uses the discrete palette + categorical legend, like
 * every other chart.
 *
 * ## Scope (v1)
 *
 * Static view: hover shows a tooltip, leave hides it, click is a wired
 * no-op. No zoom/pan/brush, no multi-series shapes, circles only, no
 * jitter. A **size legend** is a deliberate future addition (colour legends
 * ship now).
 *
 * ## Lifecycle
 *
 * ```ts
 * const chart = new ScatterChart({ container, spec });
 * await chart.init();      // creates the PIXI app AND does the first render
 * chart.update(newRows);   // warm path: reuses GL context + ParticleContainer
 * chart.destroy();         // idempotent; frees the shared texture + primitives
 * ```
 *
 * Construction is pure. {@link Chart.update} reuses the persistent
 * {@link ParticleContainer}, particle texture, axes, legend, and
 * interaction layer; only the data-derived particles, spatial index,
 * scale domains, and axis ticks are recomputed. {@link Chart.update}
 * ignores `{ animate: true }` for scatter (always snaps) — animated
 * updates across changing point counts genuinely need diffing.
 *
 * **Texture lifecycle.** The shared particle texture is GPU-backed, baked
 * once, and **not** freed by the base class's `app.destroy({ texture: false })`;
 * this class destroys it explicitly in {@link destroy} (it lives for the
 * chart's lifetime — not recreated per render or per update). Skipping that
 * is a real per-instance GPU leak — covered by a test.
 *
 * For most use cases, prefer the declarative {@link render} entry point —
 * use this class directly only when you need fine-grained lifecycle control.
 */
export class ScatterChart extends Chart {
  private spec: ChartSpec;

  private records: ScatterRecord[] = [];
  private plotContainer: Container | null = null;
  /**
   * Back-most child of {@link plotContainer}. Holds each axis's
   * `gridContainer` so gridlines render behind the point cloud. Empty
   * when neither axis has `showGrid: true`. See `Axis` docs for why
   * gridlines and chrome live in separate containers.
   *
   * @internal
   */
  private gridLayer: Container | null = null;
  /**
   * Holds the axis chrome containers. A child of {@link plotContainer},
   * sitting **below** {@link particles} in z-order so the axis line / ticks
   * / labels never get visually punctured by stray particles overlapping
   * the plot edge.
   *
   * @internal
   */
  private axesHolder: Container | null = null;
  /**
   * The ParticleContainer and its shared texture **persist for the chart's
   * lifetime** — created on first render, transforms updated in place on
   * resize and update, destroyed only in {@link destroy}. Destroying and
   * recreating a ParticleContainer that PixiJS rendered on the previous
   * frame crashes the GL particle pipe (it executes the now-freed buffer's
   * instruction set); the prompt's resize guidance — "update positions in
   * place, don't recreate the ParticleContainer" — exists for exactly this
   * reason. The same invariant covers {@link Chart.update}.
   */
  private particles: ParticleContainer<Particle> | null = null;
  private pointTexture: Texture | null = null;
  private xAxis: Axis<AxisValue> | null = null;
  private yAxis: Axis<AxisValue> | null = null;
  private spatialIndex: SpatialIndex<ScatterRecord> | null = null;
  private plotWidth = 0;
  private plotHeight = 0;
  private tooltip: Tooltip | null = null;
  private interactionLayer: InteractionLayer<ScatterRecord> | null = null;
  private legend: Legend | null = null;
  private currentLegendKind: 'continuous' | 'categorical' | null = null;
  private lastTooltipContent: string | null = null;

  /**
   * Hover decoration — a single overlay {@link Sprite} sharing the particle
   * texture, drawn above the {@link ParticleContainer}. We use an overlay
   * instead of mutating a particle's `scaleX/Y` because the container is
   * constructed with `dynamicProperties.scale: false` (see
   * {@link syncParticles}); a per-frame scale animation on a particle would
   * force a full static-buffer re-upload every frame for the entire cloud.
   * The overlay is a regular Sprite with no upload cost, and it visually
   * covers the small particle underneath when scaled up. Created once in
   * {@link ensureSetup} and reused across renders.
   */
  private hoverOverlay: Sprite | null = null;
  private hoverAnimationCancel: (() => void) | null = null;
  /** First render done? Resize / update passes skip the fade-in. */
  private didInitialRender = false;

  constructor(opts: ScatterChartOptions) {
    super({
      container: opts.container,
      width: resolveWidth(opts.spec, opts.container),
      height: resolveHeight(opts.spec, opts.container),
    });
    this.spec = opts.spec;
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
   * Destroy every owned primitive plus the shared particle texture, in
   * addition to the base-class teardown. Idempotent.
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
    // The base class destroys the PIXI app with `texture: false`, so the
    // GPU-backed point texture would leak if we didn't free it ourselves.
    if (this.particles) {
      this.particles = null;
    }
    if (this.pointTexture) {
      this.pointTexture.destroy(true);
      this.pointTexture = null;
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
    if (this.hoverOverlay !== null) {
      this.hoverOverlay.alpha = 0;
      this.hoverOverlay.scale.set(0);
    }
  }

  protected override ensureSetup(): void {
    if (this.app === null) return;
    const stage = this.app.stage;

    if (this.plotContainer === null) {
      this.plotContainer = new Container();
      stage.addChild(this.plotContainer);
    }

    // gridLayer first → axesHolder second → particles + hoverOverlay later
    // in this method. The order is what guarantees gridlines and axis
    // chrome stay behind the point cloud.
    if (this.gridLayer === null) {
      this.gridLayer = new Container();
      this.plotContainer.addChild(this.gridLayer);
    }
    if (this.axesHolder === null) {
      this.axesHolder = new Container();
      this.plotContainer.addChild(this.axesHolder);
    }

    // Bake the shared point texture eagerly so dependents (particles,
    // hoverOverlay) can be constructed in this same setup pass.
    if (this.pointTexture === null) {
      const g = new Graphics();
      g.circle(TEXTURE_RADIUS, TEXTURE_RADIUS, TEXTURE_RADIUS).fill({ color: 0xffffff });
      this.pointTexture = this.app.renderer.generateTexture(g);
      g.destroy();
    }

    if (this.particles === null) {
      // All-static dynamicProperties: nothing animates per-particle (the
      // fade-in is a single container-level alpha). Static = fastest upload;
      // update() re-syncs the buffer when we mutate transforms on
      // resize / update().
      this.particles = new ParticleContainer<Particle>({
        texture: this.pointTexture,
        dynamicProperties: { position: false, scale: false, rotation: false, color: false },
      });
      this.plotContainer.addChild(this.particles);
    }

    if (this.hoverOverlay === null) {
      this.hoverOverlay = new Sprite(this.pointTexture);
      this.hoverOverlay.anchor.set(0.5);
      this.hoverOverlay.alpha = 0;
      this.hoverOverlay.scale.set(0);
      this.plotContainer.addChild(this.hoverOverlay);
    }

    if (this.tooltip === null && this.spec.options?.showTooltip !== false) {
      this.tooltip = new Tooltip({ container: this.container });
    }
  }

  protected override redrawData(_options?: UpdateOptions): void {
    if (
      this.app === null ||
      this.plotContainer === null ||
      this.axesHolder === null ||
      this.gridLayer === null ||
      this.particles === null
    ) {
      return;
    }
    void _options;

    const stage = this.app.stage;
    const margin = resolveMargin(this.spec);
    const canvasW = this.app.screen.width;
    const canvasH = this.app.screen.height;
    const themeColors = resolveChartTheme(this.spec);

    // Build the color resolver + legend spec first — it doesn't depend on
    // plot dimensions, and the legend's width feeds into layout. Done once
    // (not duplicated inside buildSetup) so the COLOR_GROUP_WARN_THRESHOLD
    // warning fires at most once per render.
    const { colorOf, legend: legendSpec } = this.buildColorResolver();
    const showLegend = this.spec.options?.showLegend !== false;
    const shouldShowLegend = showLegend && legendSpec !== null;

    if (shouldShowLegend) {
      this.syncLegend(legendSpec, themeColors, stage);
    } else if (this.legend !== null) {
      this.legend.destroy();
      this.legend = null;
      this.currentLegendKind = null;
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

    const setup = this.buildSetup(plotWidth, plotHeight, colorOf, themeColors);
    this.records = setup.records;

    this.plotContainer.position.set(layout.plotRect.x, layout.plotRect.y);
    if (this.legend !== null && layout.legendRect !== null) {
      this.legend.container.position.set(layout.legendRect.x, layout.legendRect.y);
    }

    // Axes: create on first redraw, update afterwards. Chrome attaches to
    // axesHolder (behind particles); gridContainer attaches to gridLayer
    // (also behind particles, behind chrome). Both containers share the
    // same local origin — see Axis docs.
    if (this.xAxis === null) {
      this.xAxis = new Axis<AxisValue>(setup.xAxisOpts);
      this.gridLayer.addChild(this.xAxis.gridContainer);
      this.axesHolder.addChild(this.xAxis.container);
    } else {
      this.xAxis.update(setup.xAxisOpts);
    }
    this.xAxis.container.position.set(0, plotHeight);
    this.xAxis.gridContainer.position.set(0, plotHeight);

    if (this.yAxis === null) {
      this.yAxis = new Axis<AxisValue>(setup.yAxisOpts);
      this.gridLayer.addChild(this.yAxis.gridContainer);
      this.axesHolder.addChild(this.yAxis.container);
    } else {
      this.yAxis.update(setup.yAxisOpts);
    }

    this.syncParticles();

    // Spatial index over the SAME pixel-space records used for drawing —
    // rebuilt every redraw, reused for every pointer event (never per-frame).
    this.spatialIndex = new SpatialIndex<ScatterRecord>(
      this.records.map<SpatialRecord<ScatterRecord>>((r) => ({ x: r.x, y: r.y, datum: r })),
    );

    this.setupInteractionAndTooltip(setup.maxRadius);

    this.didInitialRender = true;
  }

  /**
   * Create or update the {@link Legend} from a {@link LegendSpec}. The
   * existing legend is reused when the kind matches (categorical → categorical
   * or continuous → continuous); a kind change forces a destroy + recreate
   * because the {@link Legend} constructor options are discriminated on
   * `type` and not safely partial-updatable across that boundary.
   *
   * @internal
   */
  private syncLegend(
    spec: NonNullable<LegendSpec>,
    themeColors: ResolvedThemeColors,
    stage: Container,
  ): void {
    if (this.legend !== null && this.currentLegendKind !== spec.kind) {
      this.legend.destroy();
      this.legend = null;
      this.currentLegendKind = null;
    }
    if (this.legend === null) {
      this.legend = this.constructLegend(spec, themeColors);
      this.currentLegendKind = spec.kind;
      stage.addChild(this.legend.container);
    } else if (spec.kind === 'continuous') {
      this.legend.update({
        type: 'continuous',
        scheme: spec.scheme,
        domain: spec.domain,
        labelColor: themeColors.legendText,
      });
    } else {
      this.legend.update({
        type: 'categorical',
        orientation: 'vertical',
        items: spec.items,
        labelColor: themeColors.legendText,
      });
    }
  }

  /**
   * Construct a {@link Legend} from a {@link LegendSpec}. Caller positions
   * the returned legend and adds it to the stage after layout is computed.
   *
   * @internal
   */
  private constructLegend(spec: NonNullable<LegendSpec>, themeColors: ResolvedThemeColors): Legend {
    return spec.kind === 'continuous'
      ? new Legend({
          type: 'continuous',
          scheme: spec.scheme,
          domain: spec.domain,
          labelColor: themeColors.legendText,
        })
      : new Legend({
          type: 'categorical',
          orientation: 'vertical',
          items: spec.items,
          labelColor: themeColors.legendText,
        });
  }

  /**
   * Project `spec.data` into pixel-space {@link ScatterRecord}s and build
   * the x/y scales, adapters, and the {@link AxisOptions} that configure
   * the two axes. Returns options rather than constructed axes so the
   * caller can create-on-first-render or update-on-subsequent-render
   * without ever destroying the {@link Axis} primitive.
   *
   * Scatter's setup is **not** routed through `_shared/cartesian.ts`'s
   * `buildCartesianAxisPrep`: that helper groups rows into series by the
   * colour field and sorts by x for path drawing — both meaningless for an
   * ungrouped point cloud whose colour is a per-point visual channel. Only
   * the genuinely shared leaf helpers (`resolveMargin/Width/Height`,
   * `toNumber`, `toDate`) are reused.
   *
   * @internal
   */
  private buildSetup(
    plotWidth: number,
    plotHeight: number,
    colorOf: (row: Record<string, unknown>) => number,
    themeColors: ResolvedThemeColors,
  ): ScatterSetup {
    const enc = this.spec.encoding;
    const xField = enc.x?.field ?? '';
    const yField = enc.y?.field ?? '';
    const xTemporal = enc.x?.type === 'temporal';
    const yTemporal = enc.y?.type === 'temporal';

    const readX = (row: Record<string, unknown>): AxisValue | null =>
      xTemporal ? toDate(row[xField]) : toNumber(row[xField]);
    const readY = (row: Record<string, unknown>): AxisValue | null =>
      yTemporal ? toDate(row[yField]) : toNumber(row[yField]);

    // Keep only rows that have a usable (x, y); a point with no position
    // can't be plotted (validation already warned about sparse columns).
    const rows: { row: Record<string, unknown>; xv: AxisValue; yv: AxisValue }[] = [];
    for (const row of this.spec.data) {
      const xv = readX(row);
      const yv = readY(row);
      if (xv === null || yv === null) continue;
      rows.push({ row, xv, yv });
    }

    const xAdapter = this.buildAdapter(
      xTemporal,
      rows.map((r) => r.xv),
      [0, plotWidth],
    );
    const yAdapter = this.buildAdapter(
      yTemporal,
      rows.map((r) => r.yv),
      [plotHeight, 0],
    );

    const radiusOf = this.buildSizeScale();

    let maxRadius = 0;
    const records: ScatterRecord[] = rows.map(({ row, xv, yv }) => {
      const radius = radiusOf(row);
      if (radius > maxRadius) maxRadius = radius;
      return {
        x: xAdapter.scale(xv),
        y: yAdapter.scale(yv),
        radius,
        color: colorOf(row),
        datum: row,
      };
    });

    const showChrome = this.spec.options?.showAxes ?? true;
    const showGrid = this.spec.options?.showGrid ?? true;
    const xTitle = this.spec.options?.axisTitles?.x;
    const yTitle = this.spec.options?.axisTitles?.y;

    const chromeColors = {
      labelColor: themeColors.label,
      lineColor: themeColors.axis,
      gridColor: themeColors.grid,
    };
    const xAxisOpts: AxisOptions<AxisValue> = {
      scale: xAdapter,
      orientation: 'bottom',
      length: plotWidth,
      tickFormat: xTemporal ? (v) => timeFormat('%b %d')(v as Date) : (v) => d3format('~g')(v),
      showChrome,
      ...chromeColors,
      ...(xTitle !== undefined && xTitle !== '' ? { title: xTitle } : {}),
    };
    const yAxisOpts: AxisOptions<AxisValue> = {
      scale: yAdapter,
      orientation: 'left',
      length: plotHeight,
      tickFormat: yTemporal ? (v) => timeFormat('%b %d')(v as Date) : (v) => d3format('~s')(v),
      showGrid,
      gridLength: plotWidth,
      showChrome,
      ...chromeColors,
      ...(yTitle !== undefined && yTitle !== '' ? { title: yTitle } : {}),
    };

    return { records, xAdapter, yAdapter, xAxisOpts, yAxisOpts, maxRadius };
  }

  /**
   * Build a continuous {@link ScaleAdapter} over `values` for the given
   * pixel `range`. Temporal axes use `scaleTime`, quantitative use a
   * `.nice()`d `scaleLinear` (both scatter axes are continuous, so a
   * rounded domain reads better than the raw extent).
   *
   * @internal
   */
  private buildAdapter(
    temporal: boolean,
    values: readonly AxisValue[],
    range: [number, number],
  ): ScaleAdapter<AxisValue> {
    if (temporal) {
      const [a, b] = extent(values as Date[]);
      const scale = scaleTime()
        .domain([a ?? new Date(0), b ?? new Date(1)])
        .range(range);
      return timeAdapter(scale) as unknown as ScaleAdapter<AxisValue>;
    }
    const [a, b] = extent(values as number[]);
    const scale = scaleLinear()
      .domain([a ?? 0, b ?? 1])
      .range(range)
      .nice();
    return linearAdapter(scale) as unknown as ScaleAdapter<AxisValue>;
  }

  /**
   * Resolve each row's radius. No `size` encoding → constant
   * {@link DEFAULT_RADIUS}. Otherwise a `d3-scale` `scaleSqrt` over the
   * field's numeric extent into {@link SIZE_RANGE}, so area ∝ value. Non-
   * numeric/missing values fall back to the smallest radius.
   *
   * @internal
   */
  private buildSizeScale(): (row: Record<string, unknown>) => number {
    // Fixed override wins — disables size encoding too. Lets dense scatters
    // use uniform small markers so density emerges from overlap.
    const fixed = this.spec.options?.pointRadius;
    if (fixed !== undefined && Number.isFinite(fixed) && fixed > 0) {
      return () => fixed;
    }
    const sizeField = this.spec.encoding.size?.field;
    if (sizeField === undefined) return () => DEFAULT_RADIUS;

    const vals: number[] = [];
    for (const row of this.spec.data) {
      const n = toNumber(row[sizeField]);
      if (n !== null) vals.push(n);
    }
    const [a, b] = extent(vals);
    const scale = scaleSqrt()
      .domain([a ?? 0, b ?? 1])
      .range([SIZE_RANGE[0], SIZE_RANGE[1]]);
    return (row) => {
      const n = toNumber(row[sizeField]);
      return n === null ? SIZE_RANGE[0] : scale(n);
    };
  }

  /**
   * Build the per-row colour resolver and the legend descriptor.
   *
   * - No colour encoding → every point the categorical scheme's first
   *   colour; no legend.
   * - `type: 'quantitative'` → sequential interpolator over the field's
   *   numeric extent (default viridis); continuous legend.
   * - categorical (type omitted or `'categorical'`) → distinct values to
   *   palette colours; categorical legend when ≥2 values. Soft-warns past
   *   {@link COLOR_GROUP_WARN_THRESHOLD}.
   *
   * @internal
   */
  private buildColorResolver(): {
    colorOf: (row: Record<string, unknown>) => number;
    legend: LegendSpec;
  } {
    const color = this.spec.encoding.color;
    if (color === undefined) {
      const c = getCategoricalColor(DEFAULT_CATEGORICAL_SCHEME, 0);
      return { colorOf: () => c, legend: null };
    }

    if (color.type === 'quantitative') {
      const schemeName: SequentialSchemeName =
        color.scheme !== undefined && color.scheme in sequentialSchemes
          ? (color.scheme as SequentialSchemeName)
          : DEFAULT_SEQUENTIAL_SCHEME;
      const vals: number[] = [];
      for (const row of this.spec.data) {
        const n = toNumber(row[color.field]);
        if (n !== null) vals.push(n);
      }
      const [a, b] = extent(vals);
      const min = a ?? 0;
      const max = b ?? 1;
      const span = max - min;
      const norm = (n: number): number => (span === 0 ? 0.5 : (n - min) / span);
      return {
        colorOf: (row) => {
          const n = toNumber(row[color.field]);
          return getSequentialColor(schemeName, n === null ? 0 : norm(n));
        },
        legend: { kind: 'continuous', scheme: schemeName, domain: [min, max] },
      };
    }

    // Categorical colour.
    const scheme =
      (color.scheme as CategoricalSchemeName | undefined) ?? DEFAULT_CATEGORICAL_SCHEME;
    const order: string[] = [];
    const seen = new Set<string>();
    for (const row of this.spec.data) {
      const key = stringifyKey(row[color.field]);
      if (!seen.has(key)) {
        seen.add(key);
        order.push(key);
      }
    }
    // Sort alphabetically so the legend order and per-category color mapping
    // are stable across update() calls regardless of incoming data order.
    order.sort();
    const idx = new Map<string, number>();
    order.forEach((k, i) => idx.set(k, i));
    if (order.length > COLOR_GROUP_WARN_THRESHOLD) {
      console.warn(
        `pixi-charts: scatter color encoding on "${color.field}" produced ` +
          `${String(order.length)} distinct values, exceeding ` +
          `${String(COLOR_GROUP_WARN_THRESHOLD)}. Categorical palettes wrap, so colors ` +
          `will repeat and become ambiguous. Use \`type: 'quantitative'\` for a ` +
          `continuous field, or a field with fewer distinct values.`,
      );
    }
    const colorOf = (row: Record<string, unknown>): number =>
      getCategoricalColor(scheme, idx.get(stringifyKey(row[color.field])) ?? 0);
    const legend: LegendSpec =
      order.length >= 2
        ? {
            kind: 'categorical',
            items: order.map((label, i) => ({ label, color: getCategoricalColor(scheme, i) })),
          }
        : null;
    return { colorOf, legend };
  }

  /**
   * Reconcile the persistent {@link ParticleContainer}'s particles with
   * the current {@link records}. The container and the shared point
   * texture are NEVER destroyed here — they live for the chart's lifetime
   * and are freed only in {@link destroy}. This invariant covers both
   * resize (same point count, new pixel positions) and update (potentially
   * different point count).
   *
   * **Three paths.**
   * - Particle count unchanged → mutate transforms in place, then call
   *   `pc.update()` so PixiJS re-uploads the static buffer.
   * - Particle count changed → `pc.removeParticles()` drains the old set,
   *   then we `pc.addParticle(...)` once per new record. The container
   *   itself still survives — only its children change.
   *
   * Enter animation is a single tween on the container's `alpha` 0 → 1
   * (one value per frame regardless of N — free at 1M points), only on the
   * first render. Honors `spec.animation.enter` and reduced-motion via
   * `tween()`; resize / update passes draw at full alpha.
   *
   * @internal
   */
  private syncParticles(): void {
    if (this.particles === null || this.pointTexture === null || this.app === null) return;
    const pc = this.particles;
    const texture = this.pointTexture;
    const existing = pc.particleChildren;

    if (existing.length !== this.records.length) {
      if (existing.length > 0) pc.removeParticles();
      for (const r of this.records) {
        const s = r.radius / TEXTURE_RADIUS;
        pc.addParticle(
          new Particle({
            texture,
            x: r.x,
            y: r.y,
            anchorX: 0.5,
            anchorY: 0.5,
            scaleX: s,
            scaleY: s,
            tint: r.color,
          }),
        );
      }
    } else {
      for (let i = 0; i < existing.length; i += 1) {
        const p = existing[i];
        const r = this.records[i];
        if (p === undefined || r === undefined) continue;
        const s = r.radius / TEXTURE_RADIUS;
        p.x = r.x;
        p.y = r.y;
        p.scaleX = s;
        p.scaleY = s;
        p.tint = r.color;
      }
      // Static props changed → PixiJS requires an explicit re-upload.
      pc.update();
    }

    const enter = this.spec.animation?.enter ?? true;
    const animate = enter !== false && !this.didInitialRender;
    const enterOptions = typeof enter === 'object' ? enter : {};
    const targetAlpha = (() => {
      const a = this.spec.options?.pointAlpha;
      if (a === undefined || !Number.isFinite(a)) return 1;
      return Math.max(0, Math.min(1, a));
    })();

    if (!animate) {
      pc.alpha = targetAlpha;
      return;
    }

    pc.alpha = 0;
    const tweenOpts: Parameters<typeof tween>[1] = {
      onUpdate: (p) => {
        pc.alpha = p * targetAlpha;
      },
    };
    if (enterOptions.duration !== undefined) tweenOpts.duration = enterOptions.duration;
    if (enterOptions.ease !== undefined) tweenOpts.ease = enterOptions.ease;
    this.addTween(tween(this.app.ticker, tweenOpts));
  }

  /** @internal */
  private setupInteractionAndTooltip(maxRadius: number): void {
    if (this.plotContainer === null || this.app === null) return;

    const showTooltip = this.spec.options?.showTooltip !== false;
    if (this.tooltip && !showTooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }

    const hitRadius = Math.max(MIN_HIT_RADIUS, maxRadius);
    const index = this.spatialIndex;
    const hitTester: HitTester<ScatterRecord> =
      index === null ? () => null : buildScatterHitTester(index, hitRadius);

    if (this.interactionLayer === null) {
      this.interactionLayer = new InteractionLayer<ScatterRecord>({
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
  private handleInteraction(event: InteractionEvent<ScatterRecord>): void {
    if (event.type === 'hover') {
      if (event.isNewDatum) {
        this.applyHoverDecoration(event.datum);
      }
      if (this.tooltip !== null) {
        if (event.isNewDatum || this.lastTooltipContent === null) {
          this.lastTooltipContent = this.formatTooltip(event.datum);
        }
        const rect = this.container.getBoundingClientRect();
        this.tooltip.show({
          x: event.globalPosition.x - rect.left,
          y: event.globalPosition.y - rect.top,
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
  private formatTooltip(record: ScatterRecord): string {
    const enc = this.spec.encoding;
    const xField = enc.x?.field ?? 'x';
    const yField = enc.y?.field ?? 'y';
    const fmtNum = d3format(',.2~f');
    const fmt = (field: string, type: string | undefined): string => {
      const raw = record.datum[field];
      if (type === 'temporal') {
        const d = toDate(raw);
        return d === null ? String(raw) : timeFormat('%b %d, %Y')(d);
      }
      const n = toNumber(raw);
      return n === null ? String(raw) : fmtNum(n);
    };

    const parts = [
      `${xField}: ${fmt(xField, enc.x?.type)}`,
      `${yField}: ${fmt(yField, enc.y?.type)}`,
    ];
    if (enc.color !== undefined) {
      parts.push(
        `${enc.color.field}: ${fmt(
          enc.color.field,
          enc.color.type === 'quantitative' ? 'quantitative' : undefined,
        )}`,
      );
    }
    if (enc.size !== undefined) {
      parts.push(`${enc.size.field}: ${fmt(enc.size.field, 'quantitative')}`);
    }
    return parts.join(' • ');
  }

  /**
   * Position and reveal the hover overlay on a newly-hovered point. Cancels
   * any in-flight scale/fade so rapid point-to-point movement reads as
   * cancel-and-restart, not a queued sequence or a blend.
   *
   * @internal
   */
  private applyHoverDecoration(record: ScatterRecord): void {
    const overlay = this.hoverOverlay;
    if (overlay === null || this.app === null) return;

    if (this.hoverAnimationCancel !== null) {
      this.hoverAnimationCancel();
      this.hoverAnimationCancel = null;
    }

    overlay.tint = record.color;
    overlay.position.set(record.x, record.y);

    const baseScale = record.radius / TEXTURE_RADIUS;
    const targetScale = baseScale * HOVER_SCALE_MULTIPLIER;
    const startScale = overlay.scale.x;
    const startAlpha = overlay.alpha;

    const cancel = tween(this.app.ticker, {
      duration: HOVER_ANIMATION_MS,
      onUpdate: (p) => {
        const s = startScale + (targetScale - startScale) * p;
        overlay.scale.set(s);
        overlay.alpha = startAlpha + (1 - startAlpha) * p;
      },
    });
    this.hoverAnimationCancel = cancel;
    this.addTween(cancel);
  }

  /**
   * Fade the hover overlay back to invisible. Leaves the overlay's scale at
   * its current value so a fast leave-then-re-enter doesn't snap visibly.
   *
   * @internal
   */
  private clearHoverDecoration(): void {
    const overlay = this.hoverOverlay;
    if (overlay === null || this.app === null) return;

    if (this.hoverAnimationCancel !== null) {
      this.hoverAnimationCancel();
      this.hoverAnimationCancel = null;
    }

    const startAlpha = overlay.alpha;
    if (startAlpha === 0) return;

    const cancel = tween(this.app.ticker, {
      duration: HOVER_ANIMATION_MS,
      onUpdate: (p) => {
        overlay.alpha = startAlpha * (1 - p);
      },
    });
    this.hoverAnimationCancel = cancel;
    this.addTween(cancel);
  }
}

/**
 * Pure scatter hit-tester: nearest indexed point within `hitRadius` px, or
 * `null`. A thin closure over {@link SpatialIndex} — exported (not
 * re-exported from the package root) so it can be unit-tested without a PIXI
 * Application, matching the cartesian/bar hit-tester posture.
 *
 * @internal
 */
export function buildScatterHitTester(
  index: SpatialIndex<ScatterRecord>,
  hitRadius: number,
): HitTester<ScatterRecord> {
  return (point) => index.findNearest(point, hitRadius)?.datum ?? null;
}
