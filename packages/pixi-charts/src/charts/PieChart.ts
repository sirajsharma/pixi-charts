import { format as d3format } from 'd3-format';
import { Container, Graphics } from 'pixi.js';

import { Chart } from '../core/Chart.js';
import { getCategoricalColor, type CategoricalSchemeName } from '../core/ColorScheme.js';
import {
  InteractionLayer,
  type HitTester,
  type InteractionEvent,
  type Point,
} from '../core/InteractionLayer.js';
import { Legend } from '../core/Legend.js';
import { Tooltip } from '../core/Tooltip.js';
import { tween } from '../core/animation.js';
import { computeLayout } from '../core/layout.js';
import type { ChartSpec } from '../spec/ChartSpec.js';
import { angleInRange, pointInRing, pointToAngle } from '../utils/geometry.js';

/** Default categorical palette for unmapped slices (matches BarChart's default). */
const DEFAULT_COLOR_SCHEME: CategoricalSchemeName = 'category10';
/** Small uniform inset between the slice ring and the plot-area bounds, in px. */
const RADIUS_PADDING = 8;
/** Pie default margins — uniform 16px on all sides (no axis-area allocations). */
const PIE_DEFAULT_MARGIN = { top: 16, right: 16, bottom: 16, left: 16 } as const;
/** Default canvas size when no `options.width/height` or container size is available. */
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;
/** Tooltip percent formatter (`'.1%'` outputs e.g. `"23.5%"`). */
const formatPercent = d3format('.1%');
/** Tooltip value formatter — matches BarChart's numeric style for visual consistency. */
const formatValue = d3format(',.2~f');

const TWO_PI = Math.PI * 2;

/** Duration (ms) of hover decoration fade-in / fade-out. */
const HOVER_ANIMATION_MS = 120;
/** Stroke width (px) of the hover-slice border. */
const HOVER_BORDER_WIDTH = 2;
/** Border color (white). Low contrast on light slices is acceptable for v1. */
const HOVER_BORDER_COLOR = 0xffffff;

/**
 * One slice, post-transformation. `category` labels the slice (drawn in
 * the legend and tooltip), `value` is its raw numeric magnitude, `percent`
 * is the proportional share in `[0, 1]`, and `color` is the resolved fill
 * (`0xRRGGBB`). `startAngle` and `endAngle` are both stored normalized
 * into `[0, 2π)`; a slice that crosses the `2π → 0` boundary has
 * `endAngle < startAngle` (and {@link angleInRange} handles it).
 *
 * `datum` carries the original row through for tooltip rendering, the same
 * convention every other chart uses.
 */
export interface PieSlice {
  category: string;
  value: number;
  percent: number;
  color: number;
  startAngle: number;
  endAngle: number;
  datum: Record<string, unknown>;
}

/** One legend entry: a distinct slice label and its swatch color. */
interface SliceLegendItem {
  label: string;
  color: number;
}

export interface PieChartOptions {
  /** DOM element the chart canvas will be appended to. */
  container: HTMLElement;
  /** Parsed and validated spec. */
  spec: ChartSpec;
}

/** @internal — convert any cell value to a finite number, or `null`. */
function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** @internal — convert a row value to a stable string key. */
function stringifyKey(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  return JSON.stringify(v);
}

/** @internal — normalize an angle (in radians) to `[0, 2π)`. */
function normalizeAngle(a: number): number {
  const m = a % TWO_PI;
  return m < 0 ? m + TWO_PI : m;
}

/** @internal — signed clockwise sweep from `start` to `end`, in `(0, 2π]`. */
function angularExtent(start: number, end: number): number {
  if (end >= start) return end - start;
  return TWO_PI - (start - end);
}

/**
 * Pie / donut chart — categorical proportions of a whole.
 *
 * **One class, two variants.** `options.innerRadius` (default `0`) controls
 * the shape: zero renders a true pie; any positive value renders a donut.
 * The geometry, hit-test, animation, legend, and tooltip are otherwise
 * identical — same single-class-for-related-variants pattern
 * {@link import('./BarChart.js').BarChart} uses for orientation.
 *
 * **Encoding contract.** `encoding.x` (categorical) names the slice label;
 * `encoding.value` carries the numeric magnitude divided proportionally
 * into angular slices. `encoding.color` is optional — when omitted, slices
 * take distinct colors from `category10`; when present, the color field's
 * distinct values drive the palette assignment.
 *
 * **Geometry.** Centered in the plot area with `outerRadius =
 * min(plotW, plotH) / 2 - 8`; `innerRadius` is clamped to
 * `[0, outerRadius - 1]`. The sweep starts at `options.startAngle`
 * (default `-π/2`, i.e. 12 o'clock) and proceeds clockwise on screen.
 *
 * **Animation.** A parallel sweep — all slices grow together, finishing at
 * the same instant — driven by {@link tween}. `spec.animation.enter:
 * false` skips it; `prefers-reduced-motion` is honored by `tween()`.
 *
 * **Hit-testing.** Polar — pointer offset from center is converted to
 * `(r, θ)` and matched against each slice's ring + angular range. Pure
 * function in {@link buildPieHitTester}, unit-tested without a PIXI app.
 *
 * **Lifecycle / resize** mirror BarChart: construction is pure, the first
 * render runs at the tail of {@link init}, resize redraws at the final
 * state (the enter animation does not re-run), {@link destroy} is
 * idempotent.
 *
 * For most use cases, prefer the declarative {@link render} entry point —
 * use this class directly only when you need fine-grained lifecycle control.
 *
 * @example
 * ```ts
 * import { PieChart } from 'pixi-charts';
 *
 * const chart = new PieChart({
 *   container: document.getElementById('chart')!,
 *   spec: {
 *     type: 'pie',
 *     data: [
 *       { browser: 'Chrome', share: 64 },
 *       { browser: 'Safari', share: 19 },
 *       { browser: 'Firefox', share: 8 },
 *       { browser: 'Other', share: 9 },
 *     ],
 *     encoding: {
 *       x: { field: 'browser', type: 'categorical' },
 *       value: { field: 'share', type: 'quantitative' },
 *     },
 *     options: { innerRadius: 60 }, // donut; omit or 0 for a true pie
 *   },
 * });
 * await chart.init();
 * chart.destroy();
 * ```
 */
export class PieChart extends Chart {
  private readonly spec: ChartSpec;
  private readonly innerRadiusOpt: number;
  private readonly startAngleOpt: number;

  private slices: PieSlice[] = [];
  private plotContainer: Container | null = null;
  private graphics: Graphics | null = null;
  private centerX = 0;
  private centerY = 0;
  private plotWidth = 0;
  private plotHeight = 0;
  private outerRadius = 0;
  private innerRadius = 0;

  private tooltip: Tooltip | null = null;
  private interactionLayer: InteractionLayer<PieSlice> | null = null;
  private legend: Legend | null = null;
  private legendItems: SliceLegendItem[] | null = null;

  /**
   * Hover decoration — a Graphics overlay above the main pie graphics that
   * strokes the hovered slice's outline (wedge for pies, annular wedge for
   * donuts). Recreated each render as a child of the rebuilt plotContainer;
   * reset at the top of render so a resize-during-hover starts fresh.
   */
  private hoverBorder: Graphics | null = null;
  private hoverAnimationCancel: (() => void) | null = null;

  /** Tracks whether the first render has happened (resize skips the enter animation). */
  private didInitialRender = false;

  constructor(opts: PieChartOptions) {
    const c = opts.container;
    super({
      container: c,
      width: opts.spec.options?.width ?? (c.clientWidth > 0 ? c.clientWidth : DEFAULT_WIDTH),
      height: opts.spec.options?.height ?? (c.clientHeight > 0 ? c.clientHeight : DEFAULT_HEIGHT),
    });
    this.spec = opts.spec;
    this.innerRadiusOpt = opts.spec.options?.innerRadius ?? 0;
    this.startAngleOpt = opts.spec.options?.startAngle ?? -Math.PI / 2;
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
   * Idempotent — each primitive is itself idempotent so a partial-init
   * failure stays safe.
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
  }

  /**
   * Full render pass. Called by {@link init} for the first frame and by the
   * base class's resize observer afterwards. Existing primitives are
   * destroyed and rebuilt each pass.
   */
  protected override render(): void {
    if (this.destroyed || this.app === null) return;

    const stage = this.app.stage;

    // Cancel the prior pass's enter tween before tearing down its targets —
    // resize can re-enter render() mid-animation; without this the tween's
    // next tick would draw into a just-destroyed Graphics and crash.
    this.cancelAllTweens();

    // Hover state references the about-to-be-destroyed plotContainer's
    // children; drop so the next hover starts clean.
    this.hoverBorder = null;
    this.hoverAnimationCancel = null;

    if (this.plotContainer !== null) {
      stage.removeChild(this.plotContainer);
      this.plotContainer.destroy({ children: true });
      this.plotContainer = null;
      this.graphics = null;
    }
    if (this.interactionLayer) {
      this.interactionLayer.destroy();
      this.interactionLayer = null;
    }
    if (this.legend) {
      this.legend.destroy();
      this.legend = null;
    }

    const m = this.spec.options?.margin;
    const margin = {
      top: m?.top ?? PIE_DEFAULT_MARGIN.top,
      right: m?.right ?? PIE_DEFAULT_MARGIN.right,
      bottom: m?.bottom ?? PIE_DEFAULT_MARGIN.bottom,
      left: m?.left ?? PIE_DEFAULT_MARGIN.left,
    };
    const canvasW = this.app.screen.width;
    const canvasH = this.app.screen.height;

    // Slices first → legend (when ≥2 slices) → layout → geometry. Donut
    // radius depends on the legend-reduced plot rect, so this ordering keeps
    // the ring from being squashed behind a legend overlap.
    const slices = this.buildSlices();
    this.slices = slices;
    this.legendItems =
      slices.length >= 2 ? slices.map((s) => ({ label: s.category, color: s.color })) : null;

    const showLegend = this.spec.options?.showLegend !== false;
    const legend =
      showLegend && this.legendItems !== null && this.legendItems.length > 0
        ? new Legend({
            type: 'categorical',
            orientation: 'vertical',
            items: this.legendItems,
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

    // Geometry.
    this.centerX = plotWidth / 2;
    this.centerY = plotHeight / 2;
    this.outerRadius = Math.max(0, Math.min(plotWidth, plotHeight) / 2 - RADIUS_PADDING);
    this.innerRadius = Math.max(0, Math.min(this.innerRadiusOpt, this.outerRadius - 1));

    const plotContainer = new Container();
    plotContainer.position.set(layout.plotRect.x, layout.plotRect.y);
    stage.addChild(plotContainer);
    this.plotContainer = plotContainer;

    if (slices.length === 0) {
      // Zero-total case (validator warns at parse time; here we just
      // short-circuit cleanly with no graphics / interaction).
      legend?.destroy();
      this.didInitialRender = true;
      return;
    }

    const graphics = new Graphics();
    plotContainer.addChild(graphics);
    this.graphics = graphics;

    this.drawSlices();

    // Hover border sits above the pie's main graphics so the stroke isn't
    // occluded by the slice fills. Child of plotContainer — destroyed and
    // recreated each render.
    const hoverBorder = new Graphics();
    hoverBorder.alpha = 0;
    plotContainer.addChild(hoverBorder);
    this.hoverBorder = hoverBorder;

    this.setupInteractionAndTooltip();

    if (legend !== null && layout.legendRect !== null) {
      legend.container.position.set(layout.legendRect.x, layout.legendRect.y);
      stage.addChild(legend.container);
      this.legend = legend;
    }

    this.didInitialRender = true;
  }

  /**
   * Transform `spec.data` into {@link PieSlice} records: sum the values,
   * compute proportional angular extents, and walk slice positions in data
   * order from {@link startAngleOpt}.
   *
   * **Single-slice case.** A pie with one row (or all-but-one zero values)
   * produces a single slice with `extent = 2π` — a full disc. The legend
   * is suppressed elsewhere (`slices.length >= 2` rule), and hit-test
   * returns that one slice anywhere inside the ring.
   *
   * **Zero-total case.** If every value sums to zero we emit a
   * `console.warn` and return an empty array. The chart short-circuits to
   * an empty plot rather than crashing on a NaN angle.
   *
   * @internal
   */
  private buildSlices(): PieSlice[] {
    const enc = this.spec.encoding;
    const categoryField = enc.x?.field ?? '';
    const valueField = enc.value?.field ?? '';
    const colorField = enc.color?.field;
    const scheme = (enc.color?.scheme as CategoricalSchemeName | undefined) ?? DEFAULT_COLOR_SCHEME;

    // First pass: collect (category, value, datum, colorKey?). Skip rows
    // whose value is missing / non-numeric (validator already warned).
    interface Pending {
      category: string;
      value: number;
      datum: Record<string, unknown>;
      colorKey: string | null;
    }
    const pending: Pending[] = [];
    for (const row of this.spec.data) {
      const value = toNumber(row[valueField]);
      if (value === null || value <= 0) {
        // A negative or zero slice has no visible angular extent. Skip so
        // we don't pollute the slice list with invisible records (the
        // validator already surfaced the data issue with a warning).
        continue;
      }
      const category = String(row[categoryField]);
      pending.push({
        category,
        value,
        datum: row,
        colorKey: colorField === undefined ? null : stringifyKey(row[colorField]),
      });
    }

    const total = pending.reduce((s, p) => s + p.value, 0);
    if (total <= 0) {
      console.warn(
        `pixi-charts: pie value field "${valueField}" sums to ${String(total)} after ` +
          `dropping non-positive rows. Nothing to draw — check the upstream data.`,
      );
      return [];
    }

    // Color resolution. With no color encoding, each slice takes a distinct
    // palette color by index. With a color encoding, distinct color-field
    // values map to palette indices in first-seen order — so coloring by
    // the category field (the typical case) yields one color per slice.
    const colorIndex = new Map<string, number>();
    if (colorField !== undefined) {
      for (const p of pending) {
        const key = p.colorKey ?? '';
        if (!colorIndex.has(key)) colorIndex.set(key, colorIndex.size);
      }
    }
    const resolveColor = (p: Pending, sliceIdx: number): number => {
      if (colorField === undefined) return getCategoricalColor(scheme, sliceIdx);
      return getCategoricalColor(scheme, colorIndex.get(p.colorKey ?? '') ?? 0);
    };

    const slices: PieSlice[] = [];
    let cursor = normalizeAngle(this.startAngleOpt);
    pending.forEach((p, i) => {
      const extent = (p.value / total) * TWO_PI;
      const startAngle = cursor;
      // For a single-slice full disc, `cursor + 2π` normalizes back to
      // `cursor` itself — store the raw end so the ring matches the start
      // exactly (the renderer treats `endAngle === startAngle` as a full
      // sweep via the cross-2π canvas semantics).
      const rawEnd = cursor + extent;
      const endAngle = pending.length === 1 ? startAngle : normalizeAngle(rawEnd);
      slices.push({
        category: p.category,
        value: p.value,
        percent: p.value / total,
        color: resolveColor(p, i),
        startAngle,
        endAngle,
        datum: p.datum,
      });
      cursor = endAngle;
    });
    return slices;
  }

  /**
   * Draw every slice into a single {@link Graphics} (one object, batched
   * fills). Animates the sweep when first rendering — see {@link drawAt}
   * for the per-frame geometry.
   *
   * @internal
   */
  private drawSlices(): void {
    if (this.graphics === null || this.app === null) return;

    const renderAt = (progress: number): void => {
      this.drawAt(progress);
    };

    const enter = this.spec.animation?.enter ?? true;
    const animate = enter !== false && !this.didInitialRender;
    const enterOptions = typeof enter === 'object' ? enter : {};

    if (!animate) {
      renderAt(1);
      return;
    }

    const tweenOpts: Parameters<typeof tween>[1] = { onUpdate: renderAt };
    if (enterOptions.duration !== undefined) tweenOpts.duration = enterOptions.duration;
    if (enterOptions.ease !== undefined) tweenOpts.ease = enterOptions.ease;
    const cancel = tween(this.app.ticker, tweenOpts);
    this.addTween(cancel);
  }

  /**
   * Draw every slice at animation `progress` ∈ `[0, 1]`. Each slice's
   * currently-visible end-angle is interpolated linearly along its
   * clockwise extent from `startAngle`. Single-slice pies (full disc) are
   * a special case — at `progress < 1` we draw a partial wedge from
   * `startAngle`; at `progress = 1` the full disc.
   *
   * @internal
   */
  private drawAt(progress: number): void {
    const g = this.graphics;
    if (g === null) return;
    g.clear();
    const { centerX, centerY, innerRadius, outerRadius, slices } = this;
    const isDonut = innerRadius > 0;

    for (const slice of slices) {
      const extent = angularExtent(slice.startAngle, slice.endAngle);
      // Full-disc single-slice case: extent collapses to 0 in storage
      // (start === end) but visually it's a full sweep.
      const sweep = extent === 0 && slices.length === 1 ? TWO_PI * progress : extent * progress;
      const s = slice.startAngle;
      const e = s + sweep;

      // Skip slices that would be a degenerate zero-extent draw at progress = 0.
      if (sweep <= 0) continue;

      if (isDonut) {
        drawDonutSliceArc(g, centerX, centerY, innerRadius, outerRadius, s, e);
      } else {
        drawPieSliceArc(g, centerX, centerY, outerRadius, s, e);
      }
      g.fill({ color: slice.color, alpha: 1 });
    }
  }

  /** @internal */
  private setupInteractionAndTooltip(): void {
    if (this.plotContainer === null) return;

    const showTooltip = this.spec.options?.showTooltip !== false;

    if (showTooltip && this.tooltip === null) {
      this.tooltip = new Tooltip({ container: this.container });
    }
    if (!showTooltip && this.tooltip !== null) {
      this.tooltip.destroy();
      this.tooltip = null;
    }

    const hitTester = buildPieHitTester(
      this.slices,
      this.centerX,
      this.centerY,
      this.innerRadius,
      this.outerRadius,
    );
    let lastTooltipContent: string | null = null;
    const handleEvent = (event: InteractionEvent<PieSlice>): void => {
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

    this.interactionLayer = new InteractionLayer<PieSlice>({
      stage: this.plotContainer,
      width: this.plotWidth,
      height: this.plotHeight,
      hitTest: hitTester,
      onEvent: handleEvent,
    });
  }

  /** @internal */
  private formatTooltip(slice: PieSlice): string {
    const enc = this.spec.encoding;
    const categoryField = enc.x?.field ?? 'category';
    const valueField = enc.value?.field ?? 'value';
    return (
      `${categoryField}: ${slice.category} • ` +
      `${valueField}: ${formatValue(slice.value)} (${formatPercent(slice.percent)})`
    );
  }

  /**
   * Trace and reveal the hover border on a newly-hovered slice. Reuses the
   * same `drawPieSliceArc` / `drawDonutSliceArc` path helpers as the main
   * pie draw — they only describe the path (no fill), so a `.stroke(...)`
   * follow-up gives the slice's outline.
   *
   * @internal
   */
  private applyHoverDecoration(slice: PieSlice): void {
    const border = this.hoverBorder;
    if (border === null || this.app === null) return;

    if (this.hoverAnimationCancel !== null) {
      this.hoverAnimationCancel();
      this.hoverAnimationCancel = null;
    }

    const { centerX, centerY, innerRadius, outerRadius, slices } = this;
    const isDonut = innerRadius > 0;
    // Reproduce drawAt's full-disc handling so a one-slice full-disc pie
    // strokes a closed circle, not a zero-length wedge.
    const extent = angularExtent(slice.startAngle, slice.endAngle);
    const sweep = extent === 0 && slices.length === 1 ? TWO_PI : extent;
    const start = slice.startAngle;
    const end = start + sweep;

    border.clear();
    if (isDonut) {
      drawDonutSliceArc(border, centerX, centerY, innerRadius, outerRadius, start, end);
    } else {
      drawPieSliceArc(border, centerX, centerY, outerRadius, start, end);
    }
    border.stroke({ width: HOVER_BORDER_WIDTH, color: HOVER_BORDER_COLOR, alpha: 1 });

    const startAlpha = border.alpha;
    const cancel = tween(this.app.ticker, {
      duration: HOVER_ANIMATION_MS,
      onUpdate: (p) => {
        border.alpha = startAlpha + (1 - startAlpha) * p;
      },
    });
    this.hoverAnimationCancel = cancel;
    this.addTween(cancel);
  }

  /**
   * Fade the hover border back to invisible.
   *
   * @internal
   */
  private clearHoverDecoration(): void {
    const border = this.hoverBorder;
    if (border === null || this.app === null) return;

    if (this.hoverAnimationCancel !== null) {
      this.hoverAnimationCancel();
      this.hoverAnimationCancel = null;
    }

    const startAlpha = border.alpha;
    if (startAlpha === 0) return;

    const cancel = tween(this.app.ticker, {
      duration: HOVER_ANIMATION_MS,
      onUpdate: (p) => {
        border.alpha = startAlpha * (1 - p);
      },
    });
    this.hoverAnimationCancel = cancel;
    this.addTween(cancel);
  }
}

/**
 * Draw a pie slice (no inner hole) into `g` as a `moveTo center → arc
 * outer → closePath` triangle-with-curved-edge. Caller fills.
 *
 * @internal
 */
function drawPieSliceArc(
  g: Graphics,
  cx: number,
  cy: number,
  outer: number,
  startAngle: number,
  endAngle: number,
): void {
  g.moveTo(cx, cy).arc(cx, cy, outer, startAngle, endAngle).closePath();
}

/**
 * Draw a donut slice (annular wedge) into `g`. Path: move to the inner-
 * start point, line out to the outer-start, sweep the outer arc forward,
 * line in to the inner-end, sweep the inner arc backward (`counterclockwise =
 * true`), close. Caller fills.
 *
 * @internal
 */
function drawDonutSliceArc(
  g: Graphics,
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  startAngle: number,
  endAngle: number,
): void {
  const cosS = Math.cos(startAngle);
  const sinS = Math.sin(startAngle);
  const cosE = Math.cos(endAngle);
  const sinE = Math.sin(endAngle);
  g.moveTo(cx + inner * cosS, cy + inner * sinS)
    .lineTo(cx + outer * cosS, cy + outer * sinS)
    .arc(cx, cy, outer, startAngle, endAngle, false)
    .lineTo(cx + inner * cosE, cy + inner * sinE)
    .arc(cx, cy, inner, endAngle, startAngle, true)
    .closePath();
}

/**
 * Pure pie hit-tester (exported-shaped as a module function, like
 * {@link import('./BarChart.js').buildBarHitTester}, so it can be unit-
 * tested without a PIXI Application).
 *
 * Converts the pointer's plot-area-local position to polar coordinates
 * relative to the pie center, gates on the radial range
 * `[innerRadius, outerRadius]`, then finds the slice whose angular range
 * contains the angle. Returns the matching {@link PieSlice} or `null`.
 *
 * Linear scan over slices — pies rarely exceed ~20 slices, so a binary
 * search would be over-engineering. Returns the first match on the
 * (theoretically-zero-measure) angular boundary between two slices.
 *
 * Exported for unit testing; not re-exported from the package root.
 *
 * @internal
 */
export function buildPieHitTester(
  slices: readonly PieSlice[],
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
): HitTester<PieSlice> {
  // Single full-disc slice case: stored as start === end. Bypass the angular
  // check (it would degenerate to "only the exact start ray hits") and just
  // return that slice for any in-ring point.
  const singleFullDisc =
    slices.length === 1 && slices[0] !== undefined && slices[0].startAngle === slices[0].endAngle;

  return (point: Point): PieSlice | null => {
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    if (!pointInRing(dx, dy, innerRadius, outerRadius)) return null;
    if (singleFullDisc) return slices[0] ?? null;
    const angle = pointToAngle(dx, dy);
    for (const slice of slices) {
      if (angleInRange(angle, slice.startAngle, slice.endAngle)) return slice;
    }
    return null;
  };
}
