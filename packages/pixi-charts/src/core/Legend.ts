import { format } from 'd3-format';
import { Container, Graphics, Text } from 'pixi.js';

import { getSequentialColor, type SequentialSchemeName } from './ColorScheme.js';

/**
 * Number of color samples used to approximate a continuous gradient.
 *
 * The gradient is rendered as `GRADIENT_SAMPLES` thin rectangles laid side
 * by side across the bar's length, each filled with
 * `getSequentialColor(scheme, t)` for evenly spaced `t ∈ [0, 1]`.
 *
 * Why 64: visually indistinguishable from a true gradient at typical legend
 * sizes (≤ ~160 px), trivially cheap to draw, and far below the threshold
 * where a shader-based gradient would be worth the complexity. A custom
 * shader is a future optimization we'll consider only if profiling shows
 * the rectangle approach is a bottleneck.
 */
const GRADIENT_SAMPLES = 64;

const DEFAULT_CATEGORICAL_ORIENTATION = 'vertical';
const DEFAULT_CONTINUOUS_ORIENTATION = 'horizontal';
const DEFAULT_SWATCH_SIZE = 12;
const DEFAULT_SPACING = 6;
const DEFAULT_FONT_SIZE = 11;
const DEFAULT_FONT_FAMILY = 'sans-serif';
const DEFAULT_LABEL_COLOR = 0x333333;
const DEFAULT_GRADIENT_LENGTH = 160;
const DEFAULT_GRADIENT_THICKNESS = 10;
/**
 * Default `d3-format` specifier for continuous-legend min/max labels.
 *
 * `~g` = general number format with trimmed trailing zeros. Produces plain
 * numbers a human would read directly across the common ranges (0–1, 0–100,
 * 1k–100k, etc.) without surprise SI-prefix suffixes. The previous default
 * `.3~s` applied SI prefixes which turned values like `0.870` into `"870m"`
 * (milli) — readable to engineers, misleading to most chart consumers.
 *
 * Override via `ContinuousLegendOptions.tickFormat` for domain-specific
 * formats (currency, dates-as-numbers, etc.).
 */
const DEFAULT_TICK_FORMAT_SPECIFIER = '~g';

/**
 * Structural equality across two resolved {@link LegendOptions}. Used by
 * {@link Legend.update} to short-circuit the destroy/rebuild when a caller
 * passes the same data. Cheap — categorical legends carry ≤ ~12 items in
 * practice, continuous legends carry a fixed handful of scalars.
 */
function legendOptionsEquivalent(a: LegendOptions, b: LegendOptions): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'categorical' && b.type === 'categorical') {
    if (
      a.orientation !== b.orientation ||
      a.swatchSize !== b.swatchSize ||
      a.spacing !== b.spacing ||
      a.fontSize !== b.fontSize ||
      a.fontFamily !== b.fontFamily ||
      a.labelColor !== b.labelColor ||
      a.items.length !== b.items.length
    ) {
      return false;
    }
    for (let i = 0; i < a.items.length; i += 1) {
      const ai = a.items[i];
      const bi = b.items[i];
      if (ai === undefined || bi === undefined) return false;
      if (ai.label !== bi.label || ai.color !== bi.color) return false;
    }
    return true;
  }
  if (a.type === 'continuous' && b.type === 'continuous') {
    return (
      a.scheme === b.scheme &&
      a.domain[0] === b.domain[0] &&
      a.domain[1] === b.domain[1] &&
      a.length === b.length &&
      a.thickness === b.thickness &&
      a.orientation === b.orientation &&
      a.tickFormat === b.tickFormat &&
      a.fontSize === b.fontSize &&
      a.fontFamily === b.fontFamily &&
      a.labelColor === b.labelColor
    );
  }
  return false;
}

/** One entry in a categorical legend: a label and the swatch color to draw next to it. */
export interface CategoricalLegendItem {
  /** Human-readable label rendered next to the swatch. */
  label: string;
  /** PIXI numeric color (`0xRRGGBB`) for the swatch fill. */
  color: number;
}

/** Constructor options for the categorical (discrete swatches) variant of {@link Legend}. */
export interface CategoricalLegendOptions {
  type: 'categorical';
  /** Items in the order they should be displayed. */
  items: CategoricalLegendItem[];
  /** Layout direction. Default `'vertical'`. */
  orientation?: 'horizontal' | 'vertical';
  /** Side length of each square swatch in pixels. Default `12`. */
  swatchSize?: number;
  /** Gap between swatch and label, and between consecutive items. Default `6`. */
  spacing?: number;
  /** Label font size in CSS pixels. Default `11`. */
  fontSize?: number;
  /** Label font family. Default `'sans-serif'`. */
  fontFamily?: string;
  /** Label color (PIXI numeric). Default `0x333333`. */
  labelColor?: number;
}

/** Constructor options for the continuous (gradient bar) variant of {@link Legend}. */
export interface ContinuousLegendOptions {
  type: 'continuous';
  /** Sequential color scheme name from {@link SequentialSchemeName}. */
  scheme: SequentialSchemeName;
  /** `[min, max]` domain values used for the end labels. */
  domain: [number, number];
  /** Length of the gradient bar in pixels. Default `160`. */
  length?: number;
  /** Thickness of the gradient bar in pixels. Default `10`. */
  thickness?: number;
  /** Layout direction. Default `'horizontal'`. */
  orientation?: 'horizontal' | 'vertical';
  /** Formatter for the min/max labels. Default `format('~g')` from `d3-format` (plain numbers, trimmed trailing zeros — no SI suffixes). */
  tickFormat?: (value: number) => string;
  /** Label font size in CSS pixels. Default `11`. */
  fontSize?: number;
  /** Label font family. Default `'sans-serif'`. */
  fontFamily?: string;
  /** Label color (PIXI numeric). Default `0x333333`. */
  labelColor?: number;
}

/** Constructor options for {@link Legend}. */
export type LegendOptions = CategoricalLegendOptions | ContinuousLegendOptions;

/**
 * PIXI-rendered chart legend. Two modes are supported via the `type`
 * discriminator on {@link LegendOptions}:
 *
 * - **Categorical**: a row or column of swatch + label pairs, one per entry
 *   in `items`.
 * - **Continuous**: a gradient bar built from a sequential color scheme,
 *   with `[min, max]` labels at the ends. Vertical continuous gradients run
 *   bottom-to-top with `min` at the bottom, matching y-axis convention.
 *
 * The consumer adds {@link Legend.container} to its own stage and positions
 * it. {@link Legend.width} and {@link Legend.height} report the rendered
 * extent so consumers can lay the legend out relative to other elements.
 *
 * Lifecycle mirrors the other primitives in this package: {@link update}
 * does a full clear-and-rebuild, {@link destroy} is idempotent and frees
 * GPU-backed Text textures. Calling {@link update} after destroy throws.
 *
 * **Bounds measurement.** Width and height are tracked manually during
 * render rather than via `container.getBounds()`. PIXI's bounds computation
 * is only reliable once the container is in a render tree; the consumer
 * may need these values before adding the legend, so we accumulate
 * `max(x + width, y + height)` as children are placed.
 */
export class Legend {
  /** The PIXI container holding all legend children. Consumer adds this to its stage. */
  readonly container: Container;

  private options: LegendOptions;
  private _destroyed = false;
  private _measuredWidth = 0;
  private _measuredHeight = 0;

  constructor(opts: LegendOptions) {
    this.options = opts;
    this.container = new Container();
    this.build();
  }

  /** `true` once {@link destroy} has run. */
  get destroyed(): boolean {
    return this._destroyed;
  }

  /** Measured width of the rendered legend in pixels. Recalculated on {@link update}. */
  get width(): number {
    return this._measuredWidth;
  }

  /** Measured height of the rendered legend in pixels. Recalculated on {@link update}. */
  get height(): number {
    return this._measuredHeight;
  }

  /**
   * Apply a partial options update and re-render from scratch.
   *
   * If `opts.type` is present and differs from the current mode, the
   * supplied object is treated as the complete new options (full mode
   * switch). Otherwise `opts` is merged into the current options. This
   * avoids the partial-discriminated-union ambiguity that would arise from
   * naively spreading across a mode boundary.
   *
   * @throws If called after {@link destroy}.
   */
  update(opts: Partial<LegendOptions>): void {
    if (this._destroyed) {
      throw new Error('Legend: cannot update() after destroy()');
    }
    const isModeSwitch = opts.type !== undefined && opts.type !== this.options.type;
    const merged = isModeSwitch
      ? (opts as LegendOptions)
      : ({ ...this.options, ...opts } as LegendOptions);
    // Skip the clear-and-rebuild when nothing visible changed. Consumers
    // (charts) call update() unconditionally on every warm redraw; without
    // this short-circuit, identical inputs still destroy and recreate every
    // Graphics + Text child, causing visible flicker on streaming updates.
    if (!isModeSwitch && legendOptionsEquivalent(this.options, merged)) {
      return;
    }
    this.options = merged;
    this.clearChildren();
    this.build();
  }

  /**
   * Destroy the container and every child it owns. Idempotent.
   *
   * Text children hold GPU texture references; iterating and calling
   * `.destroy()` on each before destroying the container ensures those
   * textures are released even when PIXI's `{ children: true }` path
   * changes between versions.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.clearChildren();
    this.container.destroy({ children: true });
  }

  /**
   * Drop every current child, destroying each so PIXI textures are released.
   * Resets the cached measurement so {@link width} and {@link height} reflect
   * the new build that follows.
   *
   * @internal
   */
  private clearChildren(): void {
    // Iterate a copy because removeChildren mutates `this.container.children`.
    const children = [...this.container.children];
    for (const child of children) {
      child.destroy();
    }
    this.container.removeChildren();
    this._measuredWidth = 0;
    this._measuredHeight = 0;
  }

  /** @internal */
  private build(): void {
    if (this.options.type === 'categorical') {
      this.buildCategorical(this.options);
    } else {
      this.buildContinuous(this.options);
    }
  }

  /** @internal */
  private buildCategorical(opts: CategoricalLegendOptions): void {
    const orientation = opts.orientation ?? DEFAULT_CATEGORICAL_ORIENTATION;
    const swatchSize = opts.swatchSize ?? DEFAULT_SWATCH_SIZE;
    const spacing = opts.spacing ?? DEFAULT_SPACING;
    const fontSize = opts.fontSize ?? DEFAULT_FONT_SIZE;
    const fontFamily = opts.fontFamily ?? DEFAULT_FONT_FAMILY;
    const labelColor = opts.labelColor ?? DEFAULT_LABEL_COLOR;

    let maxX = 0;
    let maxY = 0;

    if (orientation === 'horizontal') {
      let cursorX = 0;
      for (const item of opts.items) {
        const swatch = new Graphics();
        swatch.rect(cursorX, 0, swatchSize, swatchSize).fill({ color: item.color });
        this.container.addChild(swatch);

        const label = new Text({
          text: item.label,
          style: { fontFamily, fontSize, fill: labelColor },
        });
        label.anchor.set(0, 0.5);
        label.position.set(cursorX + swatchSize + spacing, swatchSize / 2);
        this.container.addChild(label);

        const itemEnd = cursorX + swatchSize + spacing + label.width;
        maxX = Math.max(maxX, itemEnd);
        maxY = Math.max(maxY, swatchSize, label.height);
        cursorX = itemEnd + spacing;
      }
    } else {
      let cursorY = 0;
      for (const item of opts.items) {
        const swatch = new Graphics();
        swatch.rect(0, cursorY, swatchSize, swatchSize).fill({ color: item.color });
        this.container.addChild(swatch);

        const label = new Text({
          text: item.label,
          style: { fontFamily, fontSize, fill: labelColor },
        });
        label.anchor.set(0, 0.5);
        label.position.set(swatchSize + spacing, cursorY + swatchSize / 2);
        this.container.addChild(label);

        maxX = Math.max(maxX, swatchSize + spacing + label.width);
        cursorY += Math.max(swatchSize, label.height) + spacing;
      }
      // The last addition includes a trailing `+ spacing`; the legend's
      // bottom edge is the last swatch, not an empty gap.
      maxY = Math.max(0, cursorY - spacing);
    }

    this._measuredWidth = maxX;
    this._measuredHeight = maxY;
  }

  /** @internal */
  private buildContinuous(opts: ContinuousLegendOptions): void {
    const orientation = opts.orientation ?? DEFAULT_CONTINUOUS_ORIENTATION;
    const length = opts.length ?? DEFAULT_GRADIENT_LENGTH;
    const thickness = opts.thickness ?? DEFAULT_GRADIENT_THICKNESS;
    const fontSize = opts.fontSize ?? DEFAULT_FONT_SIZE;
    const fontFamily = opts.fontFamily ?? DEFAULT_FONT_FAMILY;
    const labelColor = opts.labelColor ?? DEFAULT_LABEL_COLOR;
    const tickFormat = opts.tickFormat ?? format(DEFAULT_TICK_FORMAT_SPECIFIER);
    const [minV, maxV] = opts.domain;

    const sampleSize = length / GRADIENT_SAMPLES;

    if (orientation === 'horizontal') {
      for (let i = 0; i < GRADIENT_SAMPLES; i += 1) {
        const t = i / (GRADIENT_SAMPLES - 1);
        const color = getSequentialColor(opts.scheme, t);
        const g = new Graphics();
        g.rect(i * sampleSize, 0, sampleSize, thickness).fill({ color });
        this.container.addChild(g);
      }

      const minLabel = new Text({
        text: tickFormat(minV),
        style: { fontFamily, fontSize, fill: labelColor },
      });
      minLabel.anchor.set(0, 0);
      minLabel.position.set(0, thickness + DEFAULT_SPACING);
      this.container.addChild(minLabel);

      const maxLabel = new Text({
        text: tickFormat(maxV),
        style: { fontFamily, fontSize, fill: labelColor },
      });
      maxLabel.anchor.set(1, 0);
      maxLabel.position.set(length, thickness + DEFAULT_SPACING);
      this.container.addChild(maxLabel);

      this._measuredWidth = Math.max(length, minLabel.width, maxLabel.width);
      this._measuredHeight =
        thickness + DEFAULT_SPACING + Math.max(minLabel.height, maxLabel.height);
    } else {
      // Vertical: gradient runs bottom-to-top with min at the bottom, matching
      // y-axis convention. Sample i (t=0..1) is placed so t=0 is at y=length
      // and t=1 is at y=0.
      for (let i = 0; i < GRADIENT_SAMPLES; i += 1) {
        const t = i / (GRADIENT_SAMPLES - 1);
        const color = getSequentialColor(opts.scheme, t);
        const y = length - (i + 1) * sampleSize;
        const g = new Graphics();
        g.rect(0, y, thickness, sampleSize).fill({ color });
        this.container.addChild(g);
      }

      const minLabel = new Text({
        text: tickFormat(minV),
        style: { fontFamily, fontSize, fill: labelColor },
      });
      minLabel.anchor.set(0, 1);
      minLabel.position.set(thickness + DEFAULT_SPACING, length);
      this.container.addChild(minLabel);

      const maxLabel = new Text({
        text: tickFormat(maxV),
        style: { fontFamily, fontSize, fill: labelColor },
      });
      maxLabel.anchor.set(0, 0);
      maxLabel.position.set(thickness + DEFAULT_SPACING, 0);
      this.container.addChild(maxLabel);

      this._measuredWidth = thickness + DEFAULT_SPACING + Math.max(minLabel.width, maxLabel.width);
      this._measuredHeight = length;
    }
  }
}
