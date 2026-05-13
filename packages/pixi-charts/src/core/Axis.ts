import type { ScaleBand, ScaleLinear, ScaleLogarithmic, ScaleTime } from 'd3-scale';
import { Container, Graphics, Text } from 'pixi.js';

/**
 * Scales an {@link Axis} can render. Linear / time / log share a `ticks()` +
 * `tickFormat()` shape; band is handled separately because its "ticks" are
 * the domain entries themselves.
 */
export type AxisScale =
  | ScaleLinear<number, number>
  | ScaleBand<string>
  | ScaleTime<number, number>
  | ScaleLogarithmic<number, number>;

/** Edge of the plot area an axis sits on. */
export type AxisOrientation = 'top' | 'right' | 'bottom' | 'left';

/**
 * Custom label formatter. The union covers every domain value type that
 * {@link AxisScale} can produce.
 *
 * The session-2 spec drafted this as `(value: never) => string`, but `never`
 * is uncallable — the union below is what the formatter actually needs to
 * accept.
 */
export type AxisTickFormatter = (value: number | string | Date) => string;

/**
 * Constructor options for {@link Axis}.
 */
export interface AxisOptions {
  /** The d3 scale that maps domain values to the axis's pixel range. */
  scale: AxisScale;
  /** Which edge of the plot this axis sits on. */
  orientation: AxisOrientation;
  /** Pixel length of the axis line. */
  length: number;
  /** Approximate tick count hint for continuous scales. Default `5`. Ignored for band scales. */
  tickCount?: number;
  /** Override the default formatter produced by `scale.tickFormat()`. */
  tickFormat?: AxisTickFormatter;
  /** Render perpendicular gridlines extending `gridLength` into the plot area. */
  showGrid?: boolean;
  /** Length of gridlines into the plot area. Required when `showGrid` is `true`. */
  gridLength?: number;
  /** Tick-label color (PIXI numeric). Default `0x555555`. */
  labelColor?: number;
  /** Axis-line and tick-mark color (PIXI numeric). Default `0x888888`. */
  lineColor?: number;
  /** Gridline color (PIXI numeric). Default `0xeeeeee`. */
  gridColor?: number;
  /** Label font size in CSS pixels. Default `11`. */
  fontSize?: number;
  /** Label font family. Default `'sans-serif'`. */
  fontFamily?: string;
}

const DEFAULT_TICK_COUNT = 5;
const TICK_MARK_LENGTH = 6;
const TICK_LABEL_OFFSET = 4;
const AXIS_LINE_WIDTH = 1;
const TICK_LINE_WIDTH = 1;
const GRID_LINE_WIDTH = 1;
const DEFAULT_LABEL_COLOR = 0x555555;
const DEFAULT_LINE_COLOR = 0x888888;
const DEFAULT_GRID_COLOR = 0xeeeeee;
const DEFAULT_FONT_SIZE = 11;
const DEFAULT_FONT_FAMILY = 'sans-serif';

/**
 * Discriminates band scales from continuous scales via a structural check on
 * `.bandwidth`. Avoids `'ticks' in scale`-style duck typing, which would
 * silently break if d3 added the method to a base type.
 *
 * @internal
 */
function isBandScale(scale: AxisScale): scale is ScaleBand<string> {
  return typeof (scale as { bandwidth?: unknown }).bandwidth === 'function';
}

interface TickData {
  values: readonly (number | string | Date)[];
  positions: readonly number[];
  format: AxisTickFormatter;
}

/**
 * Project the three continuous scale types (linear/time/log) onto a single
 * callable shape. Each one independently satisfies this shape — we use the
 * projection to call `ticks()`, `tickFormat()`, and the scale itself
 * uniformly without an exhaustive `if`-ladder.
 *
 * @internal
 */
interface ContinuousScale {
  (v: number | Date): number;
  ticks(count?: number): (number | Date)[];
  tickFormat(count?: number): (v: number | Date) => string;
}

function computeTickData(
  scale: AxisScale,
  tickCount: number,
  customFormat: AxisTickFormatter | undefined,
): TickData {
  if (isBandScale(scale)) {
    const domain = scale.domain();
    const half = scale.bandwidth() / 2;
    const positions = domain.map((d) => (scale(d) ?? 0) + half);
    const format: AxisTickFormatter = customFormat ?? ((v): string => String(v));
    return { values: domain, positions, format };
  }

  const c = scale as unknown as ContinuousScale;
  const values = c.ticks(tickCount);
  const positions = values.map((v) => c(v));
  let format: AxisTickFormatter;
  if (customFormat !== undefined) {
    format = customFormat;
  } else {
    // Honour the spec: never call `scale.tickFormat()` if a custom formatter
    // was provided.
    const d3Format = c.tickFormat(tickCount);
    format = (v): string => d3Format(v as number | Date);
  }
  return { values, positions, format };
}

/**
 * Geometry describing where labels, ticks, and gridlines go for each
 * orientation. All values are deltas from the axis-line position.
 *
 * @internal
 */
interface OrientationGeometry {
  axisLineEnd: { x: number; y: number };
  tickEnd: { x: number; y: number };
  gridEnd: { x: number; y: number };
  labelPos: { x: number; y: number };
  labelAnchor: { x: number; y: number };
  /** `'horizontal'` = ticks lie along x; `'vertical'` = ticks lie along y. */
  axis: 'horizontal' | 'vertical';
}

function geometryFor(
  orientation: AxisOrientation,
  length: number,
  gridLength: number,
): OrientationGeometry {
  switch (orientation) {
    case 'bottom':
      return {
        axis: 'horizontal',
        axisLineEnd: { x: length, y: 0 },
        tickEnd: { x: 0, y: TICK_MARK_LENGTH },
        gridEnd: { x: 0, y: -gridLength },
        labelPos: { x: 0, y: TICK_MARK_LENGTH + TICK_LABEL_OFFSET },
        labelAnchor: { x: 0.5, y: 0 },
      };
    case 'top':
      return {
        axis: 'horizontal',
        axisLineEnd: { x: length, y: 0 },
        tickEnd: { x: 0, y: -TICK_MARK_LENGTH },
        gridEnd: { x: 0, y: gridLength },
        labelPos: { x: 0, y: -(TICK_MARK_LENGTH + TICK_LABEL_OFFSET) },
        labelAnchor: { x: 0.5, y: 1 },
      };
    case 'left':
      return {
        axis: 'vertical',
        axisLineEnd: { x: 0, y: length },
        tickEnd: { x: -TICK_MARK_LENGTH, y: 0 },
        gridEnd: { x: gridLength, y: 0 },
        labelPos: { x: -(TICK_MARK_LENGTH + TICK_LABEL_OFFSET), y: 0 },
        labelAnchor: { x: 1, y: 0.5 },
      };
    case 'right':
      return {
        axis: 'vertical',
        axisLineEnd: { x: 0, y: length },
        tickEnd: { x: TICK_MARK_LENGTH, y: 0 },
        gridEnd: { x: -gridLength, y: 0 },
        labelPos: { x: TICK_MARK_LENGTH + TICK_LABEL_OFFSET, y: 0 },
        labelAnchor: { x: 0, y: 0.5 },
      };
  }
}

/**
 * PIXI-rendered chart axis: line, tick marks, tick labels, and optional
 * gridlines. The consumer adds {@link Axis.container} to its own stage and
 * positions it.
 *
 * Lifecycle mirrors {@link import('./Chart.js').Chart}: explicit
 * {@link destroy} that's idempotent and after which {@link update} throws.
 *
 * **Render strategy.** `update()` is a full re-render — children are
 * destroyed and rebuilt. Diffing is a deferred optimization; ticks rarely
 * exceed ~20 per axis and `PIXI.Text` construction dominates that cost
 * anyway. A future pass may introduce `BitmapText` or a small object pool.
 *
 * **Layering.** Gridlines are added FIRST so they render behind the axis
 * line and ticks without needing `sortableChildren` (which adds a per-frame
 * sort cost).
 */
export class Axis {
  /** The PIXI container holding all axis children. Consumer adds this to its stage. */
  readonly container: Container;

  private options: AxisOptions;
  private _destroyed = false;

  constructor(opts: AxisOptions) {
    this.options = opts;
    this.container = new Container();
    this.build();
  }

  /** `true` once {@link destroy} has run. */
  get destroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Apply a partial options update and re-render the axis from scratch.
   *
   * @throws If called after {@link destroy}.
   */
  update(opts: Partial<AxisOptions>): void {
    if (this._destroyed) {
      throw new Error('Axis: cannot update() after destroy()');
    }
    this.options = { ...this.options, ...opts };
    this.clearChildren();
    this.build();
  }

  /**
   * Destroy the container and every child it owns (Graphics and Text
   * instances — Text holds GPU texture references that must be released).
   * Idempotent.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.clearChildren();
    this.container.destroy({ children: true });
  }

  /**
   * Drop all current children, destroying each so PIXI textures are
   * released. Used by both {@link update} and {@link destroy}.
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
  }

  /**
   * Build the full set of axis children from the current options.
   *
   * @internal
   */
  private build(): void {
    const {
      scale,
      orientation,
      length,
      tickCount = DEFAULT_TICK_COUNT,
      tickFormat,
      showGrid = false,
      gridLength,
      labelColor = DEFAULT_LABEL_COLOR,
      lineColor = DEFAULT_LINE_COLOR,
      gridColor = DEFAULT_GRID_COLOR,
      fontSize = DEFAULT_FONT_SIZE,
      fontFamily = DEFAULT_FONT_FAMILY,
    } = this.options;

    if (showGrid && (gridLength === undefined || gridLength <= 0)) {
      throw new Error('Axis: gridLength must be a positive number when showGrid is true');
    }

    const resolvedGridLength = gridLength ?? 0;
    const geom = geometryFor(orientation, length, resolvedGridLength);
    const { values, positions, format } = computeTickData(scale, tickCount, tickFormat);

    // 1) Gridlines first, so subsequent layers render on top of them.
    if (showGrid) {
      for (const p of positions) {
        const g = new Graphics();
        const start = geom.axis === 'horizontal' ? { x: p, y: 0 } : { x: 0, y: p };
        const end =
          geom.axis === 'horizontal' ? { x: p, y: geom.gridEnd.y } : { x: geom.gridEnd.x, y: p };
        g.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({
          color: gridColor,
          width: GRID_LINE_WIDTH,
        });
        this.container.addChild(g);
      }
    }

    // 2) Axis line.
    const axisLine = new Graphics();
    axisLine.moveTo(0, 0).lineTo(geom.axisLineEnd.x, geom.axisLineEnd.y).stroke({
      color: lineColor,
      width: AXIS_LINE_WIDTH,
    });
    this.container.addChild(axisLine);

    // 3) Tick marks and 4) tick labels, paired per tick.
    for (let i = 0; i < positions.length; i += 1) {
      const p = positions[i];
      const value = values[i];
      if (p === undefined || value === undefined) continue;

      const tick = new Graphics();
      const tickStart = geom.axis === 'horizontal' ? { x: p, y: 0 } : { x: 0, y: p };
      const tickEnd =
        geom.axis === 'horizontal' ? { x: p, y: geom.tickEnd.y } : { x: geom.tickEnd.x, y: p };
      tick.moveTo(tickStart.x, tickStart.y).lineTo(tickEnd.x, tickEnd.y).stroke({
        color: lineColor,
        width: TICK_LINE_WIDTH,
      });
      this.container.addChild(tick);

      const label = new Text({
        text: format(value),
        style: {
          fontFamily,
          fontSize,
          fill: labelColor,
        },
      });
      label.anchor.set(geom.labelAnchor.x, geom.labelAnchor.y);
      const lx = geom.axis === 'horizontal' ? p + geom.labelPos.x : geom.labelPos.x;
      const ly = geom.axis === 'horizontal' ? geom.labelPos.y : p + geom.labelPos.y;
      label.position.set(lx, ly);
      this.container.addChild(label);
    }
  }
}
