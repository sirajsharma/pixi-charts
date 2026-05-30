import { extent } from 'd3-array';
import { format as d3format } from 'd3-format';
import { scaleBand } from 'd3-scale';
import { BufferImageSource, Container, Graphics, Sprite, Texture } from 'pixi.js';

import { Axis } from '../core/Axis.js';
import { Chart, type UpdateOptions } from '../core/Chart.js';
import { getSequentialColor, type SequentialSchemeName } from '../core/ColorScheme.js';
import {
  InteractionLayer,
  type HitTester,
  type InteractionEvent,
  type Point,
} from '../core/InteractionLayer.js';
import { Legend } from '../core/Legend.js';
import { bandAdapter, type ScaleAdapter } from '../core/ScaleAdapter.js';
import { Tooltip } from '../core/Tooltip.js';
import { tween } from '../core/animation.js';
import { computeLayout } from '../core/layout.js';
import { measureBandAxisMargin } from '../core/text.js';
import { resolveTheme } from '../core/theme.js';
import type { ChartSpec } from '../spec/ChartSpec.js';

import { resolveHeight, resolveMargin, resolveWidth, toNumber } from './_shared/cartesian.js';

/** Default sequential scheme. Matches `ScatterChart`'s quantitative-colour default. */
const DEFAULT_SCHEME: SequentialSchemeName = 'viridis';
/** Numeric format for tooltip value display. Same `~s` SI used by other axes. */
const VALUE_TOOLTIP_FORMAT = ',.3~s';

/** Duration (ms) of hover decoration fade-in / fade-out. */
const HOVER_ANIMATION_MS = 120;
/** Stroke width (px) of the hover-cell border. */
const HOVER_BORDER_WIDTH = 2;
/** Border color (white). Low contrast on light cells is acceptable for v1. */
const HOVER_BORDER_COLOR = 0xffffff;

/**
 * One cell in the heatmap, post-transformation.
 *
 * `value` is the raw numeric magnitude that drove the colour-scale lookup;
 * `color` is the resolved 0xRRGGBB; `datum` is the original row so the
 * tooltip can show whatever fields the consumer wants.
 */
export interface HeatmapCell {
  /** Stringified x category (band-axis key on the x-axis). */
  xCategory: string;
  /** Stringified y category (band-axis key on the y-axis). */
  yCategory: string;
  /** Raw numeric value from `encoding.value`. */
  value: number;
  /** Resolved PIXI numeric colour `0xRRGGBB`. */
  color: number;
  /** Original `data` row. */
  datum: Record<string, unknown>;
}

export interface HeatmapChartOptions {
  /** DOM element the chart canvas will be appended to. */
  container: HTMLElement;
  /** Parsed and validated spec. */
  spec: ChartSpec;
}

/**
 * Heatmap chart — categorical × categorical grid, coloured by a quantitative
 * value field.
 *
 * ## Rendering: texture-from-buffer (one draw call)
 *
 * For an MxN grid of coloured cells, three options were considered:
 *
 * - **`Graphics` rectangles, one per cell** — collapses past ~10⁴ cells; not
 *   viable as a default.
 * - **Custom WebGL shader** — fastest possible, but adds a
 *   shader-compilation/debugging surface not justified for v1. Same posture
 *   `ScatterChart` took toward shaders.
 * - **Texture-from-buffer** — allocate a `Uint8ClampedArray` of `(width *
 *   height * 4)` RGBA bytes where `width`/`height` are the **grid
 *   dimensions** (not pixel dimensions), wrap it in a {@link Texture} via a
 *   {@link BufferImageSource}, render as a single {@link Sprite} stretched
 *   across the plot area. **One draw call regardless of grid size**, GPU-
 *   native scaling, and resize is free — only the sprite's pixel `width`/
 *   `height` change, the texture itself is reused.
 *
 * The choice is texture-from-buffer. Custom shaders remain a documented
 * future optimisation.
 *
 * **Crisp cells via `scaleMode: 'nearest'`.** When the (small) texture is
 * stretched across the (much larger) plot area, the default linear
 * interpolation produces fuzzy gradients across cell borders — wrong for
 * discrete heatmap cells. Nearest-neighbour sampling (the PIXI v8 string
 * literal `'nearest'`, set on the `BufferImageSource`'s `scaleMode`) gives
 * crisp cell edges.
 *
 * ## Axis convention
 *
 * **Both axes are band scales.** This is the first chart in the library
 * with `bandAdapter` on x AND y simultaneously. Heatmaps in v1 do **not**
 * auto-bin continuous data; consumers pre-bin into discrete categories and
 * pass `encoding.x.type` / `encoding.y.type` as `'categorical'` (enforced by
 * the validator — see `spec/validate.ts:requireHeatmapEncoding`). A
 * quantitative-pre-binned axis is treated as ordered categorical by simply
 * stringifying the values.
 *
 * **Y convention: index 0 at top of plot.** The first y category in
 * insertion order renders at the top edge of the plot (screen-top). The
 * y-axis labels run top-to-bottom in the same order. This matches the
 * common heatmap convention (calendars, confusion matrices). The texture
 * buffer is laid out row-major with `(yIdx * width + xIdx) * 4` — combined
 * with a band y-scale ranging `[0, plotHeight]`, yIdx 0 ends up at the top.
 *
 * ## Colour
 *
 * Always quantitative (validator-enforced); default scheme `viridis`
 * (perceptually uniform, colourblind-safe). Each cell's normalised value
 * `t = (value - min) / (max - min)` is passed to {@link getSequentialColor}
 * to yield a PIXI `0xRRGGBB`. A span of zero (every value identical) maps
 * everything to `t = 0.5` so the heatmap still renders something meaningful
 * rather than NaN-coloured cells.
 *
 * ## Sparse cells
 *
 * If `(x, y)` pairs are missing from `data`, those buffer positions stay
 * `(0, 0, 0, 0)` — fully transparent. The container's background shows
 * through. The hit-tester returns `null` for sparse positions so tooltips
 * don't show stale data.
 *
 * ## Legend
 *
 * Always a continuous gradient ({@link Legend} `type: 'continuous'`) sized
 * to the value-field's `[min, max]`. Positioned top-right of the plot, same
 * placement as `ScatterChart`'s continuous legend.
 *
 * ## No enter animation
 *
 * Heatmaps don't animate well in v1: a left-to-right reveal (Line/Area
 * style) doesn't fit a grid, a per-cell cascade looks gimmicky at any
 * realistic size, and a whole-grid alpha fade adds little value over a
 * straight static render. Deliberately omitted. `update({ animate: true })`
 * is accepted but ignored — heatmap updates always snap.
 *
 * ## Lifecycle
 *
 * ```ts
 * const chart = new HeatmapChart({ container, spec });
 * await chart.init();    // creates the PIXI Application AND does the first render
 * chart.update(newRows); // reuses the sprite/texture when grid dims unchanged
 * chart.destroy();       // idempotent; frees the GPU texture + primitives
 * ```
 *
 * **Resize** keeps the sprite/texture and just changes the sprite's pixel
 * dimensions. **{@link Chart.update}** reuses the same sprite. When the
 * grid dimensions match (same category sets), the existing buffer is
 * rewritten in place and uploaded via `source.update()` — no GPU
 * reallocation. When grid dimensions change, the old {@link Texture} +
 * {@link BufferImageSource} are destroyed **before** the new ones are
 * allocated, preventing GPU memory growth across many updates.
 *
 * For most use cases, prefer the declarative {@link render} entry point —
 * use this class directly only when you need fine-grained lifecycle control.
 */
export class HeatmapChart extends Chart {
  private spec: ChartSpec;

  private plotContainer: Container | null = null;
  /**
   * Back-most child of {@link plotContainer}. Holds each axis's
   * `gridContainer` — the heatmap is opaque so gridlines are typically
   * invisible, but the layer keeps the container convention consistent
   * across all six charts.
   *
   * @internal
   */
  private gridLayer: Container | null = null;
  private axesHolder: Container | null = null;
  private xAxis: Axis<string> | null = null;
  private yAxis: Axis<string> | null = null;
  private tooltip: Tooltip | null = null;
  private interactionLayer: InteractionLayer<HeatmapCell> | null = null;
  private legend: Legend | null = null;

  /**
   * The buffer-backed texture and the Sprite displaying it. Both **persist
   * for the chart's lifetime when the grid dimensions are stable** — created
   * on first render with the grid's resolution, reused on resize (only the
   * sprite's `width`/`height` change, the texture is GPU-scaled), the
   * buffer rewritten in place on {@link Chart.update} when dimensions match.
   * Freed only in {@link destroy} or when the grid dimensions change — in
   * which case the OLD {@link Texture}/{@link BufferImageSource} are
   * destroyed BEFORE new ones are allocated, to prevent GPU memory growth
   * across many updates.
   */
  private sprite: Sprite | null = null;
  private texture: Texture | null = null;
  private source: BufferImageSource | null = null;

  /**
   * Hover decoration — a Graphics overlay above the heatmap sprite that
   * strokes the hovered cell's pixel rectangle. Created once in
   * {@link ensureSetup} and reused across renders.
   */
  private hoverBorder: Graphics | null = null;
  private hoverAnimationCancel: (() => void) | null = null;
  private lastTooltipContent: string | null = null;

  /** Cached cell records keyed `(xCategory, yCategory) → cell` for hit-test. */
  private cellMap = new Map<string, Map<string, HeatmapCell>>();
  /** Insertion-order x categories. Drives the band domain and texture layout. */
  private xCategories: string[] = [];
  /** Insertion-order y categories. */
  private yCategories: string[] = [];
  private plotWidth = 0;
  private plotHeight = 0;
  private xAdapter: ScaleAdapter<string> | null = null;
  private yAdapter: ScaleAdapter<string> | null = null;

  constructor(opts: HeatmapChartOptions) {
    super({
      container: opts.container,
      width: resolveWidth(opts.spec, opts.container),
      height: resolveHeight(opts.spec, opts.container),
    });
    this.spec = opts.spec;
  }

  /**
   * Override of {@link Chart.init}: after the PIXI Application is ready,
   * runs the first render so the spec dispatcher hands back a fully-
   * rendered chart.
   */
  override async init(): Promise<void> {
    await super.init();
    if (!this.destroyed) {
      this.render();
    }
  }

  /**
   * Destroy every owned primitive plus the GPU-backed texture, in addition
   * to the base-class teardown. Idempotent.
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
    if (this.sprite) {
      this.sprite = null;
    }
    if (this.texture) {
      this.texture.destroy(true);
      this.texture = null;
      this.source = null;
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
    if (this.hoverBorder !== null) {
      this.hoverBorder.alpha = 0;
    }
  }

  protected override ensureSetup(): void {
    if (this.app === null) return;
    const stage = this.app.stage;

    if (this.plotContainer === null) {
      this.plotContainer = new Container();
      stage.addChild(this.plotContainer);
    }
    // gridLayer → axesHolder → (later) sprite → hoverBorder. Order ensures
    // gridlines and axis chrome sit behind the heatmap surface and hover
    // border draws on top.
    if (this.gridLayer === null) {
      this.gridLayer = new Container();
      this.plotContainer.addChild(this.gridLayer);
    }
    if (this.axesHolder === null) {
      this.axesHolder = new Container();
      this.plotContainer.addChild(this.axesHolder);
    }
    // The sprite is created lazily in syncTexture once the grid dimensions
    // are known. We don't pre-add a placeholder here — the addChild on
    // first creation lands it above the axes holder.
    if (this.hoverBorder === null) {
      this.hoverBorder = new Graphics();
      this.hoverBorder.alpha = 0;
      this.plotContainer.addChild(this.hoverBorder);
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
      this.gridLayer === null
    ) {
      return;
    }
    void _options;

    const stage = this.app.stage;
    const margin = resolveMargin(this.spec);
    const canvasW = this.app.screen.width;
    const canvasH = this.app.screen.height;

    const enc = this.spec.encoding;
    const xField = enc.x?.field ?? '';
    const yField = enc.y?.field ?? '';
    const valueField = enc.value?.field ?? '';
    const colorScheme: SequentialSchemeName =
      enc.color?.scheme !== undefined && isKnownScheme(enc.color.scheme)
        ? enc.color.scheme
        : DEFAULT_SCHEME;

    // Build cells, categories (insertion order), and the value extent in a
    // single pass over data — three traversals here would be wasteful. None
    // of this depends on plot pixel dimensions, so we can do it before
    // layout commits to a plot width (legend reduces width when present).
    const xCategories: string[] = [];
    const yCategories: string[] = [];
    const xSeen = new Set<string>();
    const ySeen = new Set<string>();
    const rawCells: {
      xCat: string;
      yCat: string;
      value: number;
      datum: Record<string, unknown>;
    }[] = [];
    for (const row of this.spec.data) {
      const v = toNumber(row[valueField]);
      if (v === null) continue;
      const xCat = String(row[xField]);
      const yCat = String(row[yField]);
      if (!xSeen.has(xCat)) {
        xSeen.add(xCat);
        xCategories.push(xCat);
      }
      if (!ySeen.has(yCat)) {
        ySeen.add(yCat);
        yCategories.push(yCat);
      }
      rawCells.push({ xCat, yCat, value: v, datum: row });
    }

    this.xCategories = xCategories;
    this.yCategories = yCategories;

    const [minRaw, maxRaw] = extent(rawCells.map((c) => c.value));
    const minValue = minRaw ?? 0;
    const maxValue = maxRaw ?? 1;
    const span = maxValue - minValue;
    const normalize = (n: number): number => (span === 0 ? 0.5 : (n - minValue) / span);

    const themeColors = resolveTheme(this.spec.options?.theme, this.spec.options?.colors);

    // Build / update the continuous legend before layout so its width can
    // reduce the plot. Reused across updates — only its domain / scheme
    // change with new data.
    const showLegend = this.spec.options?.showLegend !== false;
    if (showLegend) {
      if (this.legend === null) {
        this.legend = new Legend({
          type: 'continuous',
          scheme: colorScheme,
          domain: [minValue, maxValue],
          labelColor: themeColors.legendText,
        });
        stage.addChild(this.legend.container);
      } else {
        this.legend.update({
          type: 'continuous',
          scheme: colorScheme,
          domain: [minValue, maxValue],
          labelColor: themeColors.legendText,
        });
      }
    } else if (this.legend !== null) {
      this.legend.destroy();
      this.legend = null;
    }

    // Pre-measure both band axes' labels so the left margin fits the widest
    // y-category and the bottom margin fits the (rotated-or-not) x-category
    // labels.
    const labelStyle = { fontFamily: 'sans-serif', fontSize: 11 };
    const yBandMargin = measureBandAxisMargin(yCategories, labelStyle, canvasW, 'cross-horizontal');
    const xBandMargin = measureBandAxisMargin(xCategories, labelStyle, canvasH, 'cross-vertical');
    margin.left = Math.max(margin.left, yBandMargin.margin);
    margin.bottom = Math.max(margin.bottom, xBandMargin.margin);

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

    // Build the cell map and resolve colours.
    const cellMap = new Map<string, Map<string, HeatmapCell>>();
    for (const raw of rawCells) {
      const color = getSequentialColor(colorScheme, normalize(raw.value));
      const cell: HeatmapCell = {
        xCategory: raw.xCat,
        yCategory: raw.yCat,
        value: raw.value,
        color,
        datum: raw.datum,
      };
      let row = cellMap.get(raw.xCat);
      if (row === undefined) {
        row = new Map();
        cellMap.set(raw.xCat, row);
      }
      row.set(raw.yCat, cell);
    }
    this.cellMap = cellMap;

    // Build band scales/adapters. Padding 0 — heatmaps have no cell gaps by
    // default. X range left-to-right, Y range top-to-bottom (yIdx 0 at top).
    const xScale = scaleBand().domain(xCategories).range([0, plotWidth]).padding(0);
    const yScale = scaleBand().domain(yCategories).range([0, plotHeight]).padding(0);
    const xAdapter = bandAdapter(xScale);
    const yAdapter = bandAdapter(yScale);
    this.xAdapter = xAdapter;
    this.yAdapter = yAdapter;

    // Build axes options. First chart with band on BOTH axes — see Axis.ts:
    // `computeTickData` already half-offsets band labels via `bandwidth()/2`,
    // so labels sit centred over their cells without special-casing here.
    const showChrome = this.spec.options?.showAxes ?? true;
    const xTitle = this.spec.options?.axisTitles?.x;
    const yTitle = this.spec.options?.axisTitles?.y;
    const chromeColors = {
      labelColor: themeColors.label,
      lineColor: themeColors.axis,
      gridColor: themeColors.grid,
    };
    const yTruncated = yBandMargin.truncated;
    const xTruncated = xBandMargin.truncated;
    const xAxisOpts = {
      scale: xAdapter,
      orientation: 'bottom' as const,
      length: plotWidth,
      showChrome,
      ...chromeColors,
      ...(xTruncated !== null ? { tickFormat: (v: string): string => xTruncated.get(v) ?? v } : {}),
      ...(xTitle !== undefined && xTitle !== '' ? { title: xTitle } : {}),
    };
    const yAxisOpts = {
      scale: yAdapter,
      orientation: 'left' as const,
      length: plotHeight,
      showChrome,
      ...chromeColors,
      ...(yTruncated !== null ? { tickFormat: (v: string): string => yTruncated.get(v) ?? v } : {}),
      ...(yTitle !== undefined && yTitle !== '' ? { title: yTitle } : {}),
    };

    if (this.xAxis === null) {
      this.xAxis = new Axis<string>(xAxisOpts);
      this.gridLayer.addChild(this.xAxis.gridContainer);
      this.axesHolder.addChild(this.xAxis.container);
    } else {
      this.xAxis.update(xAxisOpts);
    }
    if (this.yAxis === null) {
      this.yAxis = new Axis<string>(yAxisOpts);
      this.gridLayer.addChild(this.yAxis.gridContainer);
      this.axesHolder.addChild(this.yAxis.container);
    } else {
      this.yAxis.update(yAxisOpts);
    }

    this.plotContainer.position.set(layout.plotRect.x, layout.plotRect.y);
    this.xAxis.container.position.set(0, plotHeight);
    this.xAxis.gridContainer.position.set(0, plotHeight);
    if (this.legend !== null && layout.legendRect !== null) {
      this.legend.container.position.set(layout.legendRect.x, layout.legendRect.y);
    }

    // Texture: rebuild only when the grid dimensions changed. Same-dim
    // updates rewrite the buffer in place. Whenever the sprite is first
    // created here, we add it as a child of plotContainer between
    // axesHolder and hoverBorder (in z-order) by adding after the axes
    // (already there) and BEFORE re-promoting hoverBorder to the top.
    const spriteJustCreated = this.sprite === null;
    this.syncTexture();

    if (this.sprite !== null) {
      this.sprite.width = plotWidth;
      this.sprite.height = plotHeight;
      this.sprite.position.set(0, 0);
      if (spriteJustCreated) {
        // First-time attach. We then re-promote hoverBorder to the top so
        // it draws above the sprite.
        this.plotContainer.addChild(this.sprite);
        if (this.hoverBorder !== null) {
          this.plotContainer.addChild(this.hoverBorder);
        }
      }
    }

    this.setupInteractionAndTooltip();
  }

  /**
   * Allocate or reuse the buffer-backed texture and its sprite.
   *
   * Rebuilds when the grid dimensions have changed since the prior render
   * (destroying the old {@link Texture}/{@link BufferImageSource} FIRST so
   * the GPU resources don't leak); otherwise rewrites the existing buffer
   * in place and calls `source.update()` to re-upload. Resize never lands
   * here for a dim change — only the sprite's pixel `width`/`height` need
   * to change, which happens outside this method.
   *
   * @internal
   */
  private syncTexture(): void {
    const width = this.xCategories.length;
    const height = this.yCategories.length;
    if (width === 0 || height === 0) return;

    const dimsChanged = this.source?.width !== width || this.source.height !== height;

    if (dimsChanged) {
      if (this.texture !== null) {
        // CRITICAL: free the old GPU resources BEFORE allocating the new
        // ones. Repeated updates that change grid dimensions would
        // otherwise accumulate textures and eventually crash the GPU.
        this.texture.destroy(true);
        this.texture = null;
        this.source = null;
      }
      const buffer = new Uint8ClampedArray(width * height * 4);
      writeCellsToBuffer(buffer, width, this.xCategories, this.yCategories, this.cellMap);
      // PIXI v8 texture-from-buffer: a `BufferImageSource` wraps the typed
      // array; the `Texture` wraps the source. `scaleMode: 'nearest'` (a
      // string literal in v8 — NOT the v7 numeric `SCALE_MODES.NEAREST`)
      // keeps cell edges crisp when the sprite stretches the texture to
      // plot-area size.
      const source = new BufferImageSource({
        resource: buffer,
        width,
        height,
        scaleMode: 'nearest',
      });
      this.source = source;
      this.texture = new Texture({ source });
      if (this.sprite === null) {
        this.sprite = new Sprite(this.texture);
      } else {
        this.sprite.texture = this.texture;
      }
    } else {
      // Same dimensions: rewrite the existing buffer in place and re-upload
      // to GPU. No new Texture / Source allocations — the warm path that
      // makes streaming updates affordable.
      const source = this.source;
      if (source === null) return;
      const buffer = source.resource as Uint8ClampedArray;
      buffer.fill(0);
      writeCellsToBuffer(buffer, width, this.xCategories, this.yCategories, this.cellMap);
      source.update();
    }
  }

  /** @internal */
  private setupInteractionAndTooltip(): void {
    if (this.plotContainer === null || this.app === null) return;
    if (this.xAdapter === null || this.yAdapter === null) return;

    const showTooltip = this.spec.options?.showTooltip !== false;
    if (this.tooltip && !showTooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }

    const hitTester = buildHeatmapHitTester(
      this.xAdapter,
      this.yAdapter,
      this.cellMap,
      this.plotWidth,
      this.plotHeight,
    );

    if (this.interactionLayer === null) {
      this.interactionLayer = new InteractionLayer<HeatmapCell>({
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
  private handleInteraction(event: InteractionEvent<HeatmapCell>): void {
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
  private formatTooltip(cell: HeatmapCell): string {
    const enc = this.spec.encoding;
    const xField = enc.x?.field ?? 'x';
    const yField = enc.y?.field ?? 'y';
    const valueField = enc.value?.field ?? 'value';
    const valueStr = d3format(VALUE_TOOLTIP_FORMAT)(cell.value);
    return `${xField}: ${cell.xCategory} • ${yField}: ${cell.yCategory} • ${valueField}: ${valueStr}`;
  }

  /**
   * Position and reveal the hover border on a newly-hovered cell. Cancels
   * any in-flight fade so rapid cell-to-cell movement reads as
   * cancel-and-restart.
   *
   * @internal
   */
  private applyHoverDecoration(cell: HeatmapCell): void {
    const border = this.hoverBorder;
    const xAdapter = this.xAdapter;
    const yAdapter = this.yAdapter;
    if (border === null || xAdapter === null || yAdapter === null || this.app === null) return;

    const bandwidthX = xAdapter.bandwidth?.() ?? 0;
    const bandwidthY = yAdapter.bandwidth?.() ?? 0;
    if (bandwidthX <= 0 || bandwidthY <= 0) return;

    if (this.hoverAnimationCancel !== null) {
      this.hoverAnimationCancel();
      this.hoverAnimationCancel = null;
    }

    const x = xAdapter.scale(cell.xCategory);
    const y = yAdapter.scale(cell.yCategory);
    border
      .clear()
      .rect(x, y, bandwidthX, bandwidthY)
      .stroke({ width: HOVER_BORDER_WIDTH, color: HOVER_BORDER_COLOR, alpha: 1 });

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
 * Write each cell's RGBA bytes into `buffer` at its `(yIdx * width + xIdx)
 * * 4` offset. Sparse cells (no entry in `cellMap`) are left as `(0,0,0,0)`
 * — fully transparent — which is what the caller's `fill(0)` already
 * guarantees, so we only need to write the present cells. Alpha is always
 * 255 for present cells.
 *
 * @internal
 */
function writeCellsToBuffer(
  buffer: Uint8ClampedArray,
  width: number,
  xCategories: readonly string[],
  yCategories: readonly string[],
  cellMap: ReadonlyMap<string, ReadonlyMap<string, HeatmapCell>>,
): void {
  // Pre-build x and y index lookups once: O(1) per cell instead of
  // O(width)+O(height) `indexOf` walks per write.
  const xIndex = new Map<string, number>();
  xCategories.forEach((cat, i) => xIndex.set(cat, i));
  const yIndex = new Map<string, number>();
  yCategories.forEach((cat, i) => yIndex.set(cat, i));

  for (const [xCat, row] of cellMap) {
    const xIdx = xIndex.get(xCat);
    if (xIdx === undefined) continue;
    for (const [yCat, cell] of row) {
      const yIdx = yIndex.get(yCat);
      if (yIdx === undefined) continue;
      const offset = (yIdx * width + xIdx) * 4;
      buffer[offset] = (cell.color >> 16) & 0xff;
      buffer[offset + 1] = (cell.color >> 8) & 0xff;
      buffer[offset + 2] = cell.color & 0xff;
      buffer[offset + 3] = 255;
    }
  }
}

/**
 * Find the band-axis category whose pixel range contains `pixel`, or `null`
 * if `pixel` falls outside every band. Used by the heatmap hit-tester for
 * both axes (the first chart that needs this on x AND y).
 *
 * Linear scan over the domain — fine for any realistic category count. A
 * binary search would be premature for `O(domain)` ≤ ~100 in practice.
 *
 * @internal
 */
function findBandAt(adapter: ScaleAdapter<string>, pixel: number): string | null {
  const bw = adapter.bandwidth?.() ?? 0;
  for (const cat of adapter.ticks()) {
    const pos = adapter.scale(cat);
    if (pixel >= pos && pixel < pos + bw) return cat;
  }
  return null;
}

/**
 * Build the heatmap hit-tester.
 *
 * The {@link InteractionLayer} hands the closure a `point` in plot-area-
 * local pixels (origin at the plot's top-left). We:
 *
 * 1. Bounds-check against `[0, plotWidth) × [0, plotHeight)` — outside the
 *    plot returns `null` (no spurious hovers when the pointer is over the
 *    axes or the legend).
 * 2. Resolve x and y categories via {@link findBandAt} on the two band
 *    adapters.
 * 3. Look up the cell in the 2D `Map<x, Map<y, cell>>`. Sparse positions
 *    return `null`.
 *
 * Exported (not re-exported from the package root) for unit testing without
 * standing up a PIXI Application — same posture as the cartesian/scatter
 * hit-testers.
 *
 * @internal
 */
export function buildHeatmapHitTester(
  xAdapter: ScaleAdapter<string>,
  yAdapter: ScaleAdapter<string>,
  cellMap: ReadonlyMap<string, ReadonlyMap<string, HeatmapCell>>,
  plotWidth: number,
  plotHeight: number,
): HitTester<HeatmapCell> {
  return (point: Point): HeatmapCell | null => {
    if (point.x < 0 || point.x >= plotWidth || point.y < 0 || point.y >= plotHeight) {
      return null;
    }
    const xCat = findBandAt(xAdapter, point.x);
    if (xCat === null) return null;
    const yCat = findBandAt(yAdapter, point.y);
    if (yCat === null) return null;
    return cellMap.get(xCat)?.get(yCat) ?? null;
  };
}

/** @internal — narrow `string` to a known sequential scheme name. */
function isKnownScheme(name: string): name is SequentialSchemeName {
  return name === 'viridis' || name === 'blues' || name === 'inferno' || name === 'plasma';
}
