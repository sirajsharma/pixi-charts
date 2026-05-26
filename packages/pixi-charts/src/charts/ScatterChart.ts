import { extent } from 'd3-array';
import { format as d3format } from 'd3-format';
import { scaleLinear, scaleSqrt, scaleTime } from 'd3-scale';
import { timeFormat } from 'd3-time-format';
import { Container, Graphics, Particle, ParticleContainer, Sprite, type Texture } from 'pixi.js';

import { Axis } from '../core/Axis.js';
import { Chart } from '../core/Chart.js';
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

import {
  COLOR_GROUP_WARN_THRESHOLD,
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
  xAxis: Axis<AxisValue>;
  yAxis: Axis<AxisValue>;
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
 * Renders **100k+ points at 60fps** by drawing every point as a PixiJS v8
 * {@link Particle} in a single {@link ParticleContainer} (one batched draw
 * call), and answering pointer hit-tests in `O(log n)` via a
 * {@link SpatialIndex} (`d3-quadtree`) instead of a linear scan.
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
 * ## Lifecycle (identical to the other charts)
 *
 * ```ts
 * const chart = new ScatterChart({ container, spec });
 * await chart.init();   // creates the PIXI app AND does the first render
 * chart.destroy();      // idempotent; frees the shared texture + primitives
 * ```
 *
 * Construction is pure. Resize rebuilds scales, re-projects points, updates
 * particle transforms in place, rebuilds the spatial index, and draws at the
 * final state (no enter re-run).
 *
 * **Texture lifecycle.** The shared particle texture is GPU-backed, baked
 * once, and **not** freed by the base class's `app.destroy({ texture: false })`;
 * this class destroys it explicitly in {@link destroy} (it lives for the
 * chart's lifetime — not recreated per render). Skipping that is a real
 * per-instance GPU leak — covered by a test.
 */
export class ScatterChart extends Chart {
  private readonly spec: ChartSpec;

  private records: ScatterRecord[] = [];
  private plotContainer: Container | null = null;
  /**
   * The ParticleContainer and its shared texture **persist for the chart's
   * lifetime** — created on first render, transforms updated in place on
   * resize, destroyed only in {@link destroy}. Destroying and recreating a
   * ParticleContainer that PixiJS rendered on the previous frame crashes the
   * GL particle pipe (it executes the now-freed buffer's instruction set);
   * the prompt's resize guidance — "update positions in place, don't
   * recreate the ParticleContainer" — exists for exactly this reason.
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
  /**
   * Hover decoration — a single overlay {@link Sprite} sharing the particle
   * texture, drawn above the {@link ParticleContainer}. We use an overlay
   * instead of mutating a particle's `scaleX/Y` because the container is
   * constructed with `dynamicProperties.scale: false` (see
   * {@link syncParticles}); a per-frame scale animation on a particle would
   * force a full static-buffer re-upload every frame for the entire cloud.
   * The overlay is a regular Sprite with no upload cost, and it visually
   * covers the small particle underneath when scaled up.
   */
  private hoverOverlay: Sprite | null = null;
  private hoverAnimationCancel: (() => void) | null = null;
  /** First render done? Resize passes skip the fade-in. */
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
   * addition to the base-class teardown. Idempotent — the base guards a
   * second call and each primitive's own destroy is idempotent too.
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
      // Detach before the base class's app.destroy({ children: true }) runs
      // (if it's still parented it gets destroyed there anyway; this just
      // makes ownership explicit and the reference release unambiguous).
      this.particles = null;
    }
    if (this.pointTexture) {
      this.pointTexture.destroy(true);
      this.pointTexture = null;
    }
  }

  /**
   * Full render pass. Called by {@link init} for the first frame and by the
   * base class's resize observer afterwards. Axes/legend/interaction are
   * destroyed and rebuilt each pass (cheap); the ParticleContainer and its
   * texture are **reused** and updated in place (see {@link syncParticles}).
   * The spatial index and hit-tester are rebuilt from the new pixel-space
   * records so hover stays correct after a resize.
   */
  protected override render(): void {
    if (this.destroyed || this.app === null) return;

    const stage = this.app.stage;

    // Cancel the previous pass's enter tween BEFORE tearing its targets down.
    // A resize re-enters render() while the fade-in is still running; without
    // this, the tween's next tick mutates a just-destroyed ParticleContainer
    // and PixiJS crashes drawing a freed particle buffer. (The real-browser
    // ResizeObserver fires an initial callback right after observe(), so this
    // overlap is the common case, not an edge case — unit tests miss it
    // because the mock ResizeObserver never auto-fires.)
    this.cancelAllTweens();

    // The hover overlay was a child of the old plotContainer (about to be
    // destroyed). Drop our reference so the next hover starts fresh;
    // cancelAllTweens() above has already invalidated any in-flight fade.
    this.hoverOverlay = null;
    this.hoverAnimationCancel = null;

    if (this.plotContainer !== null) {
      // Rescue the persistent ParticleContainer before destroying the plot —
      // `{ children: true }` would otherwise free it (and crash a queued
      // frame). It is reparented into the new plot in syncParticles().
      if (this.particles !== null) this.plotContainer.removeChild(this.particles);
      stage.removeChild(this.plotContainer);
      this.plotContainer.destroy({ children: true });
      this.plotContainer = null;
    }
    // NOTE: `this.particles` and `this.pointTexture` are intentionally NOT
    // torn down here — they live for the chart's lifetime (see the field
    // docs) and are freed only in destroy().
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

    // Build the color resolver + legend spec first — it doesn't depend on
    // plot dimensions, and the legend's width feeds into layout. Done once
    // (not duplicated inside buildSetup) so the COLOR_GROUP_WARN_THRESHOLD
    // warning fires at most once per render.
    const { colorOf, legend: legendSpec } = this.buildColorResolver();
    const showLegend = this.spec.options?.showLegend !== false;
    const legend = showLegend && legendSpec !== null ? this.constructLegend(legendSpec) : null;

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

    const setup = this.buildSetup(plotWidth, plotHeight, colorOf);
    this.records = setup.records;
    this.xAxis = setup.xAxis;
    this.yAxis = setup.yAxis;

    const plotContainer = new Container();
    plotContainer.position.set(layout.plotRect.x, layout.plotRect.y);
    stage.addChild(plotContainer);
    this.plotContainer = plotContainer;

    plotContainer.addChild(this.yAxis.container);
    this.xAxis.container.position.set(0, plotHeight);
    plotContainer.addChild(this.xAxis.container);

    this.syncParticles();

    // Hover overlay: a single Sprite over the persistent ParticleContainer,
    // reusing the shared point texture. Sits above the particles so the
    // hovered point's enlarged version is fully visible. Created after
    // syncParticles() so the texture is guaranteed to exist.
    if (this.pointTexture !== null) {
      const overlay = new Sprite(this.pointTexture);
      overlay.anchor.set(0.5);
      overlay.alpha = 0;
      overlay.scale.set(0);
      plotContainer.addChild(overlay);
      this.hoverOverlay = overlay;
    }

    // Spatial index over the SAME pixel-space records used for drawing —
    // built once here, reused for every pointer event (never per-frame).
    this.spatialIndex = new SpatialIndex<ScatterRecord>(
      this.records.map<SpatialRecord<ScatterRecord>>((r) => ({ x: r.x, y: r.y, datum: r })),
    );

    this.setupInteractionAndTooltip(setup.maxRadius);

    if (legend !== null && layout.legendRect !== null) {
      legend.container.position.set(layout.legendRect.x, layout.legendRect.y);
      stage.addChild(legend.container);
      this.legend = legend;
    }

    this.didInitialRender = true;
  }

  /**
   * Construct a {@link Legend} from a {@link LegendSpec}. Caller positions
   * the returned legend and adds it to the stage after layout is computed.
   *
   * @internal
   */
  private constructLegend(spec: NonNullable<LegendSpec>): Legend {
    return spec.kind === 'continuous'
      ? new Legend({ type: 'continuous', scheme: spec.scheme, domain: spec.domain })
      : new Legend({ type: 'categorical', orientation: 'vertical', items: spec.items });
  }

  /**
   * Project `spec.data` into pixel-space {@link ScatterRecord}s and build
   * the x/y scales, adapters, and {@link Axis} instances.
   *
   * Scatter's setup is **not** routed through `_shared/cartesian.ts`'s
   * `buildCartesianSetup`: that helper groups rows into series by the colour
   * field and sorts by x for path drawing — both meaningless for an
   * ungrouped point cloud whose colour is a per-point visual channel. Only
   * the genuinely shared leaf helpers (`resolveMargin/Width/Height`,
   * `toNumber`, `toDate`) are reused. (Integration finding: the cartesian
   * module is series-shaped; a v2 refactor could factor out a
   * "two continuous axes, no grouping" helper if more such charts appear.)
   *
   * @internal
   */
  private buildSetup(
    plotWidth: number,
    plotHeight: number,
    colorOf: (row: Record<string, unknown>) => number,
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

    const xAxis = new Axis<AxisValue>({
      scale: xAdapter,
      orientation: 'bottom',
      length: plotWidth,
      tickFormat: xTemporal ? (v) => timeFormat('%b %d')(v as Date) : (v) => d3format('~g')(v),
      showChrome,
      ...(xTitle !== undefined && xTitle !== '' ? { title: xTitle } : {}),
    });
    const yAxis = new Axis<AxisValue>({
      scale: yAdapter,
      orientation: 'left',
      length: plotHeight,
      tickFormat: yTemporal ? (v) => timeFormat('%b %d')(v as Date) : (v) => d3format('~s')(v),
      showGrid,
      gridLength: plotWidth,
      showChrome,
      ...(yTitle !== undefined && yTitle !== '' ? { title: yTitle } : {}),
    });

    return { records, xAdapter, yAdapter, xAxis, yAxis, maxRadius };
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
    const idx = new Map<string, number>();
    for (const row of this.spec.data) {
      const key = stringifyKey(row[color.field]);
      if (!idx.has(key)) {
        idx.set(key, order.length);
        order.push(key);
      }
    }
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
   * Create-or-reuse the shared white circle texture and the single
   * {@link ParticleContainer}, reconcile its particles with the current
   * records, and reparent it into the (freshly rebuilt) plot container.
   *
   * **Why reuse, not rebuild.** The texture and container are baked once and
   * kept for the chart's lifetime. On resize, particle transforms are
   * updated in place and `ParticleContainer.update()` re-uploads the static
   * buffers — *not* a destroy/recreate, which would crash PixiJS's GL
   * particle pipe when it executes a queued frame's instruction set against
   * the freed buffer. Only a change in *point count* (not a resize) forces a
   * particle rebuild; the container itself still survives.
   *
   * **One white circle, per-particle `tint` + `scaleX/Y`** → one batched
   * draw call for the whole cloud (PIXI v8 supports per-particle tint over a
   * shared texture).
   *
   * Enter animation is a fade-in: one tween on the container's `alpha`
   * 0 → 1 (one value per frame regardless of N — free at 1M points), only
   * on the first render. Honors `spec.animation.enter` and reduced-motion
   * via `tween()`; resize passes draw at full alpha.
   *
   * @internal
   */
  private syncParticles(): void {
    if (this.plotContainer === null || this.app === null) return;

    if (this.pointTexture === null) {
      const g = new Graphics();
      g.circle(TEXTURE_RADIUS, TEXTURE_RADIUS, TEXTURE_RADIUS).fill({ color: 0xffffff });
      this.pointTexture = this.app.renderer.generateTexture(g);
      g.destroy();
    }
    const texture = this.pointTexture;

    // All-static dynamicProperties: nothing animates per-particle (the
    // fade-in is a single container-level alpha). Static = fastest upload;
    // update() re-syncs the buffer when we mutate transforms on resize.
    this.particles ??= new ParticleContainer<Particle>({
      texture,
      dynamicProperties: { position: false, scale: false, rotation: false, color: false },
    });
    const pc = this.particles;
    const existing = pc.particleChildren;

    if (existing.length !== this.records.length) {
      // First render, or a point-count change: (re)build the particle set.
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
      // Resize: same points, new pixel positions — mutate in place.
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

    this.plotContainer.addChild(pc);

    const enter = this.spec.animation?.enter ?? true;
    const animate = enter !== false && !this.didInitialRender;
    const enterOptions = typeof enter === 'object' ? enter : {};

    if (!animate) {
      pc.alpha = 1;
      return;
    }

    pc.alpha = 0;
    const tweenOpts: Parameters<typeof tween>[1] = {
      onUpdate: (p) => {
        pc.alpha = p;
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

    const hitRadius = Math.max(MIN_HIT_RADIUS, maxRadius);
    const index = this.spatialIndex;
    const hitTester: HitTester<ScatterRecord> =
      index === null ? () => null : buildScatterHitTester(index, hitRadius);

    let lastTooltipContent: string | null = null;
    const handleEvent = (event: InteractionEvent<ScatterRecord>): void => {
      if (event.type === 'hover') {
        if (event.isNewDatum) {
          this.applyHoverDecoration(event.datum);
        }
        if (this.tooltip !== null) {
          if (event.isNewDatum || lastTooltipContent === null) {
            lastTooltipContent = this.formatTooltip(event.datum);
          }
          const rect = this.container.getBoundingClientRect();
          this.tooltip.show({
            x: event.globalPosition.x - rect.left,
            y: event.globalPosition.y - rect.top,
            content: lastTooltipContent,
          });
        }
      } else if (event.type === 'leave') {
        this.clearHoverDecoration();
        this.tooltip?.hide();
        lastTooltipContent = null;
      }
      // click: no-op for v1 (wired so a future handler drops in cleanly).
    };

    this.interactionLayer = new InteractionLayer<ScatterRecord>({
      stage: this.plotContainer,
      width: this.plotWidth,
      height: this.plotHeight,
      hitTest: hitTester,
      onEvent: handleEvent,
    });
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
