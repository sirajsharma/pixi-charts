import { format } from 'd3-format';
import { Container, Graphics, Text } from 'pixi.js';

import { getSequentialColor, sequentialSchemes, type SequentialSchemeName } from './ColorScheme.js';

/**
 * One entry in a categorical legend: a swatch color and the label that sits
 * next to it.
 */
export interface CategoricalLegendItem {
  /** Display label rendered next to the swatch. */
  label: string;
  /** Swatch fill as a PIXI numeric color (`0xRRGGBB`). */
  color: number;
}

/**
 * Options for a discrete categorical legend (one swatch + label pair per
 * item). Selected by `type: 'categorical'`.
 */
export interface CategoricalLegendOptions {
  type: 'categorical';
  /** Items to render, in display order. */
  items: CategoricalLegendItem[];
  /** Layout direction. Default `'vertical'`. */
  orientation?: 'horizontal' | 'vertical';
  /** Side length of each swatch in CSS pixels. Default `12`. */
  swatchSize?: number;
  /** Gap between a swatch and its label (and between successive items). Default `6`. */
  spacing?: number;
  /** Label font size in CSS pixels. Default `11`. */
  fontSize?: number;
  /** Label font family. Default `'sans-serif'`. */
  fontFamily?: string;
  /** Label color as a PIXI numeric color. Default `0x333333`. */
  labelColor?: number;
}

/**
 * Options for a continuous gradient legend with min/max end labels.
 * Selected by `type: 'continuous'`.
 */
export interface ContinuousLegendOptions {
  type: 'continuous';
  /** Sequential scheme to sample. Must be a key of {@link sequentialSchemes}. */
  scheme: SequentialSchemeName;
  /** Domain endpoints `[min, max]` used for the end labels. */
  domain: [number, number];
  /** Gradient bar length along its main axis in CSS pixels. Default `160`. */
  length?: number;
  /** Gradient bar thickness perpendicular to its main axis. Default `10`. */
  thickness?: number;
  /** Bar direction. Default `'horizontal'`. */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Custom formatter for the min/max labels. Default: `d3-format('.3~g')`,
   * which produces compact representations like `1.23`, `1.23k`, `0.001`.
   */
  tickFormat?: (value: number) => string;
  /** Label font size in CSS pixels. Default `11`. */
  fontSize?: number;
  /** Label font family. Default `'sans-serif'`. */
  fontFamily?: string;
  /** Label color as a PIXI numeric color. Default `0x333333`. */
  labelColor?: number;
}

/**
 * Constructor options for {@link Legend}. Discriminated on `type`.
 */
export type LegendOptions = CategoricalLegendOptions | ContinuousLegendOptions;

/**
 * Number of discrete fill rectangles used to draw a continuous gradient.
 *
 * 64 samples is the perf-vs-fidelity sweet spot for legend-sized bars
 * (typically 100–300 px long): at this density the human eye cannot
 * distinguish individual bands, while the draw-call cost stays negligible
 * compared with typical chart content. A shader-based gradient would be a
 * future optimization to consider only if profiling shows otherwise.
 */
const CONTINUOUS_GRADIENT_SAMPLES = 64;

const DEFAULT_SWATCH_SIZE = 12;
const DEFAULT_SPACING = 6;
const DEFAULT_FONT_SIZE = 11;
const DEFAULT_FONT_FAMILY = 'sans-serif';
const DEFAULT_LABEL_COLOR = 0x333333;
const DEFAULT_CONTINUOUS_LENGTH = 160;
const DEFAULT_CONTINUOUS_THICKNESS = 10;
const DEFAULT_CONTINUOUS_ORIENTATION: 'horizontal' | 'vertical' = 'horizontal';
const DEFAULT_CATEGORICAL_ORIENTATION: 'horizontal' | 'vertical' = 'vertical';
const DEFAULT_CONTINUOUS_TICK_FORMAT = format('.3~g');

/** Char-width ÷ fontSize ratio used to estimate label widths without measuring. */
const TEXT_WIDTH_FACTOR = 0.6;
/** Gap between the gradient bar and its end labels. */
const LABEL_BAR_GAP = 4;
/** Sub-pixel overlap to hide seams between adjacent gradient samples. */
const GRADIENT_SAMPLE_OVERLAP = 0.5;

/**
 * Rough estimate of a rendered `Text`'s width.
 *
 * Used by the layout to size the legend bounding box without going through
 * PIXI's measurement system. PIXI v8's `Text.width` can require the text to
 * be in an active render tree, and {@link Legend} is designed to be measured
 * before the consumer attaches it to a stage. The estimate is intentionally
 * generous to avoid clipping — consumers needing pixel-perfect alignment
 * should measure their labels separately.
 *
 * @internal
 */
function estimateTextWidth(text: string, fontSize: number): number {
  return Math.max(1, text.length) * fontSize * TEXT_WIDTH_FACTOR;
}

/**
 * PIXI-rendered color legend with two display modes:
 *
 * - **Categorical** — a row or column of swatch + label pairs.
 * - **Continuous** — a sampled-gradient bar with min/max labels at the ends.
 *
 * Lifecycle mirrors {@link import('./Axis.js').Axis}: the constructor builds
 * everything synchronously, {@link update} clears and rebuilds, and
 * {@link destroy} is idempotent. The consumer adds {@link container} to its
 * own stage and positions it.
 *
 * **Width / height** are tracked internally during render rather than via
 * `container.getBounds()`, so the getters work whether or not the container
 * has been attached to a parent. {@link estimateTextWidth} is used to size
 * label-containing rows; this is intentionally rough — see its JSDoc.
 *
 * **Not interactive.** Click-to-toggle and keyboard navigation are out of
 * scope for v1; they'll be added when the first chart needing them lands.
 */
export class Legend {
  /** The PIXI container holding every child element. */
  readonly container: Container;

  private options: LegendOptions;
  private _destroyed = false;
  private _w = 0;
  private _h = 0;

  /**
   * @param opts - Either {@link CategoricalLegendOptions} or
   *   {@link ContinuousLegendOptions}, discriminated by `opts.type`.
   */
  constructor(opts: LegendOptions) {
    this.options = opts;
    this.container = new Container();
    this.build();
  }

  /** `true` once {@link destroy} has run. */
  get destroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Width of the rendered legend in CSS pixels, measured during the last
   * `build()`. Stays readable after {@link destroy}.
   */
  get width(): number {
    return this._w;
  }

  /**
   * Height of the rendered legend in CSS pixels, measured during the last
   * `build()`. Stays readable after {@link destroy}.
   */
  get height(): number {
    return this._h;
  }

  /**
   * Apply a partial options patch and re-render from scratch.
   *
   * Behaviour:
   * - If `opts.type` matches the current mode (or is omitted), the patch is
   *   shallow-merged on top of the prior options.
   * - If `opts.type` switches modes, the prior options are discarded and
   *   `opts` is used as-is. The caller must supply a complete options object
   *   for the new type; stale fields (e.g. an `orientation: 'vertical'`
   *   carried over from a categorical legend) would otherwise leak into the
   *   new mode's defaults.
   *
   * @throws If called after {@link destroy}.
   */
  update(opts: Partial<LegendOptions>): void {
    if (this._destroyed) {
      throw new Error('Legend: cannot update() after destroy()');
    }
    if (opts.type !== undefined && opts.type !== this.options.type) {
      this.options = opts as LegendOptions;
    } else {
      // Object.assign returns `target & ...sources`, which collapses to
      // `LegendOptions` for our inputs — sidesteps the object-literal-
      // assertion lint rule that would forbid `{...a, ...b} as T`.
      this.options = Object.assign({}, this.options, opts);
    }
    this.clearChildren();
    this.build();
  }

  /**
   * Destroy every child PIXI object and the container itself. Idempotent.
   * The cached {@link width} / {@link height} remain readable afterwards.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.clearChildren();
    this.container.destroy({ children: true });
  }

  /** @internal */
  private clearChildren(): void {
    // Iterate a copy because removeChildren mutates `this.container.children`.
    const children = [...this.container.children];
    for (const child of children) {
      child.destroy();
    }
    this.container.removeChildren();
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
    const {
      items,
      orientation = DEFAULT_CATEGORICAL_ORIENTATION,
      swatchSize = DEFAULT_SWATCH_SIZE,
      spacing = DEFAULT_SPACING,
      fontSize = DEFAULT_FONT_SIZE,
      fontFamily = DEFAULT_FONT_FAMILY,
      labelColor = DEFAULT_LABEL_COLOR,
    } = opts;

    let maxW = 0;
    let maxH = 0;

    if (orientation === 'vertical') {
      const rowStride = Math.max(swatchSize, fontSize) + spacing;
      let y = 0;
      for (const item of items) {
        const swatch = new Graphics();
        swatch.rect(0, y, swatchSize, swatchSize).fill({ color: item.color });
        this.container.addChild(swatch);

        const label = new Text({
          text: item.label,
          style: { fontFamily, fontSize, fill: labelColor },
        });
        label.anchor.set(0, 0);
        label.position.set(swatchSize + spacing, y);
        this.container.addChild(label);

        const rowW = swatchSize + spacing + estimateTextWidth(item.label, fontSize);
        if (rowW > maxW) maxW = rowW;
        y += rowStride;
      }
      maxH = items.length === 0 ? 0 : y - spacing;
    } else {
      let x = 0;
      for (const item of items) {
        const swatch = new Graphics();
        swatch.rect(x, 0, swatchSize, swatchSize).fill({ color: item.color });
        this.container.addChild(swatch);

        const labelX = x + swatchSize + spacing;
        const label = new Text({
          text: item.label,
          style: { fontFamily, fontSize, fill: labelColor },
        });
        label.anchor.set(0, 0);
        label.position.set(labelX, 0);
        this.container.addChild(label);

        x = labelX + estimateTextWidth(item.label, fontSize) + spacing;
      }
      maxW = items.length === 0 ? 0 : x - spacing;
      maxH = Math.max(swatchSize, fontSize);
    }

    this._w = maxW;
    this._h = maxH;
  }

  /** @internal */
  private buildContinuous(opts: ContinuousLegendOptions): void {
    const {
      scheme,
      domain,
      length = DEFAULT_CONTINUOUS_LENGTH,
      thickness = DEFAULT_CONTINUOUS_THICKNESS,
      orientation = DEFAULT_CONTINUOUS_ORIENTATION,
      tickFormat = DEFAULT_CONTINUOUS_TICK_FORMAT,
      fontSize = DEFAULT_FONT_SIZE,
      fontFamily = DEFAULT_FONT_FAMILY,
      labelColor = DEFAULT_LABEL_COLOR,
    } = opts;

    // Defense in depth: TS proves `scheme` is a known key, but runtime
    // callers can bypass the type system (e.g. through `unknown` or JSON).
    // Pattern mirrors `getSequentialColor` in ColorScheme.ts.
    const schemes = sequentialSchemes as Readonly<
      Record<string, ((t: number) => string) | undefined>
    >;
    if (schemes[scheme] === undefined) {
      throw new Error(
        `Legend: unknown sequential scheme ${JSON.stringify(scheme)}. ` +
          `Known schemes: ${Object.keys(sequentialSchemes).join(', ')}.`,
      );
    }

    const [minValue, maxValue] = domain;
    const samples = CONTINUOUS_GRADIENT_SAMPLES;
    const sampleSize = length / samples;

    const minLabelText = tickFormat(minValue);
    const maxLabelText = tickFormat(maxValue);
    const labelStyle = { fontFamily, fontSize, fill: labelColor };

    if (orientation === 'horizontal') {
      for (let i = 0; i < samples; i += 1) {
        const t = i / (samples - 1);
        const c = getSequentialColor(scheme, t);
        const rect = new Graphics();
        rect
          .rect(i * sampleSize, 0, sampleSize + GRADIENT_SAMPLE_OVERLAP, thickness)
          .fill({ color: c });
        this.container.addChild(rect);
      }

      const minLabel = new Text({ text: minLabelText, style: labelStyle });
      minLabel.anchor.set(0, 0);
      minLabel.position.set(0, thickness + LABEL_BAR_GAP);
      this.container.addChild(minLabel);

      const maxLabel = new Text({ text: maxLabelText, style: labelStyle });
      maxLabel.anchor.set(1, 0);
      maxLabel.position.set(length, thickness + LABEL_BAR_GAP);
      this.container.addChild(maxLabel);

      this._w = length;
      this._h = thickness + LABEL_BAR_GAP + fontSize;
    } else {
      // Vertical: min at the bottom, max at the top (y-axis convention).
      // In PIXI coords y increases downward, so i = 0 (t = 0, min color)
      // sits near y = length and i = samples-1 (t = 1, max color) sits near y = 0.
      for (let i = 0; i < samples; i += 1) {
        const t = i / (samples - 1);
        const c = getSequentialColor(scheme, t);
        const rect = new Graphics();
        const y = length - (i + 1) * sampleSize;
        rect
          .rect(0, y - GRADIENT_SAMPLE_OVERLAP / 2, thickness, sampleSize + GRADIENT_SAMPLE_OVERLAP)
          .fill({ color: c });
        this.container.addChild(rect);
      }

      const maxLabel = new Text({ text: maxLabelText, style: labelStyle });
      maxLabel.anchor.set(0, 0);
      maxLabel.position.set(thickness + LABEL_BAR_GAP, 0);
      this.container.addChild(maxLabel);

      const minLabel = new Text({ text: minLabelText, style: labelStyle });
      minLabel.anchor.set(0, 1);
      minLabel.position.set(thickness + LABEL_BAR_GAP, length);
      this.container.addChild(minLabel);

      const labelW = Math.max(
        estimateTextWidth(minLabelText, fontSize),
        estimateTextWidth(maxLabelText, fontSize),
      );
      this._w = thickness + LABEL_BAR_GAP + labelW;
      this._h = length;
    }
  }
}
