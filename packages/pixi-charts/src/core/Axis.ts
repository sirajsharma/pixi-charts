import { Container, Graphics, Text } from 'pixi.js';

import type { ScaleAdapter } from './ScaleAdapter.js';

/** Edge of the plot area an axis sits on. */
export type AxisOrientation = 'top' | 'right' | 'bottom' | 'left';

/**
 * Constructor options for {@link Axis}.
 *
 * The generic parameter `TDomain` is the domain element type of the
 * underlying scale (e.g. `number` for linear, `string` for band, `Date`
 * for time). It flows through to {@link AxisOptions.tickFormat}, so
 * formatter callbacks receive correctly typed values without any
 * narrowing at the call site.
 */
export interface AxisOptions<TDomain> {
  /** The scale adapter that maps domain values to the axis's pixel range. */
  scale: ScaleAdapter<TDomain>;
  /** Which edge of the plot this axis sits on. */
  orientation: AxisOrientation;
  /** Pixel length of the axis line. */
  length: number;
  /** Approximate tick count hint for continuous scales. Default `5`. Ignored for band scales. */
  tickCount?: number;
  /** Override the default formatter produced by the adapter's `tickFormat()`. */
  tickFormat?: (value: TDomain) => string;
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

interface TickData<TDomain> {
  values: readonly TDomain[];
  positions: readonly number[];
  format: (value: TDomain) => string;
}

function computeTickData<TDomain>(
  scale: ScaleAdapter<TDomain>,
  tickCount: number,
  customFormat: ((value: TDomain) => string) | undefined,
): TickData<TDomain> {
  const values = scale.ticks(tickCount);
  // Honour the spec: never call `scale.tickFormat()` if a custom formatter
  // was provided.
  const format = customFormat ?? scale.tickFormat(tickCount);
  const half = scale.kind === 'band' ? (scale.bandwidth?.() ?? 0) / 2 : 0;
  const positions = values.map((v) => scale.scale(v) + half);
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
export class Axis<TDomain> {
  /** The PIXI container holding all axis children. Consumer adds this to its stage. */
  readonly container: Container;

  private options: AxisOptions<TDomain>;
  private _destroyed = false;

  constructor(opts: AxisOptions<TDomain>) {
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
  update(opts: Partial<AxisOptions<TDomain>>): void {
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
