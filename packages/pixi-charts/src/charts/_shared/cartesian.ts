import { extent, max as d3max, min as d3min } from 'd3-array';
import { format as d3format } from 'd3-format';
import { scaleBand, scaleLinear, scaleTime } from 'd3-scale';
import { timeFormat } from 'd3-time-format';

import { Axis } from '../../core/Axis.js';
import { getCategoricalColor, type CategoricalSchemeName } from '../../core/ColorScheme.js';
import type { HitTester, Point } from '../../core/InteractionLayer.js';
import {
  bandAdapter,
  linearAdapter,
  timeAdapter,
  type ScaleAdapter,
} from '../../core/ScaleAdapter.js';
import type { ChartSpec, FieldType } from '../../spec/ChartSpec.js';
import { lttb, type DataPoint } from '../../utils/lttb.js';

/**
 * Internal module: logic shared between `LineChart`, `AreaChart`, and any
 * future cartesian (x/y axis) line-family charts. Consumed as plain
 * functions — both chart classes extend {@link import('../../core/Chart.js').Chart}
 * directly (composition, not inheritance). Nothing here is re-exported from
 * the package public surface (`src/index.ts`); the leading underscore on the
 * directory signals "internal to `charts/`".
 */

/** Downsampling cutoff: series larger than this get LTTB-reduced. */
export const DOWNSAMPLE_THRESHOLD = 10_000;
/** Target point count after downsampling. Trades resolution for draw cost. */
export const DOWNSAMPLE_TARGET = 2000;

/** Default margins, in CSS pixels. */
export const DEFAULT_MARGIN = { top: 24, right: 24, bottom: 40, left: 56 } as const;
/** Default canvas size when no `options.width/height` or container size is available. */
export const DEFAULT_WIDTH = 600;
export const DEFAULT_HEIGHT = 400;
/** Default categorical scheme used when `encoding.color.scheme` is unset. */
export const DEFAULT_COLOR_SCHEME: CategoricalSchemeName = 'category10';
/** Hit-test pixel radius for continuous x-axes. */
export const HIT_TEST_RADIUS_PX = 20;
/**
 * Distinct color-group count above which categorical palettes wrap and
 * colors start repeating; we warn rather than silently produce ambiguous
 * series. The widest bundled scheme (`paired`) has 12 entries, so 20 is a
 * generous ceiling that still flags genuinely unreadable encodings.
 */
export const COLOR_GROUP_WARN_THRESHOLD = 20;

/**
 * X-axis domain element. `string` for band scales, `Date` for time scales,
 * `number` for linear. Charts carry this through with a discriminator
 * pattern so the hit-tester and axis types flow cleanly.
 */
export type XValue = number | string | Date;

/** A single point in a series, post-transformation. */
export interface CartesianPoint {
  /** Numeric x for math (epoch ms for temporal, band index for categorical, raw for quantitative). */
  xNum: number;
  /** Original-typed x (used for scale lookup). */
  xRaw: XValue;
  /** Numeric y. */
  y: number;
  /** Original row, preserved for tooltips and click datum. */
  datum: Record<string, unknown>;
}

/** A named series (one line or one filled area). */
export interface CartesianSeries {
  name: string;
  color: number;
  points: CartesianPoint[];
  /** Whether this series was downsampled via LTTB. */
  downsampled: boolean;
}

/** Hit-test result carried out of the InteractionLayer to the tooltip. */
export interface CartesianHit {
  series: CartesianSeries;
  point: CartesianPoint;
}

/**
 * Everything a cartesian chart needs after the data + scale layer is done:
 * grouped/downsampled series, the x/y adapters, and the two constructed
 * {@link Axis} instances (axis construction is byte-identical between Line
 * and Area, so it lives here rather than being duplicated per chart). The
 * caller owns margin math and the PIXI container assembly.
 */
export interface CartesianSetup {
  series: CartesianSeries[];
  xAdapter: ScaleAdapter<XValue>;
  yAdapter: ScaleAdapter<number>;
  xAxis: Axis<XValue>;
  yAxis: Axis<number>;
  plotWidth: number;
  plotHeight: number;
}

/**
 * Build the data + scale layer for a cartesian chart: group `spec.data`
 * into series (by `encoding.color.field`, or one series if absent),
 * transform/sort/downsample points, assign categorical colors, and build
 * the x/y scales, adapters, and {@link Axis} instances.
 *
 * `plotWidth`/`plotHeight` are passed in because the caller derives them
 * from the live PIXI renderer dimensions and the resolved margin.
 *
 * **Behavior note (new in Session 5).** When a `color` encoding produces
 * more than {@link COLOR_GROUP_WARN_THRESHOLD} distinct series, a
 * `console.warn` is emitted: categorical palettes wrap, so colors would
 * silently repeat. This applies to every cartesian chart.
 *
 * The LTTB downsampling **notice** is *not* emitted here — series carry a
 * `downsampled` flag and each chart logs once per instance (preserving
 * pre-refactor LineChart behavior across resizes).
 *
 * **Known gap.** Stacking is not implemented; multi-series areas overlap.
 */
export function buildCartesianSetup(
  spec: ChartSpec,
  plotWidth: number,
  plotHeight: number,
): CartesianSetup {
  const xType = spec.encoding.x?.type ?? 'quantitative';
  const series = buildSeries(spec);
  const { xAdapter, xAxis } = buildXAxis(series, xType, plotWidth);
  const { yAdapter, yAxis } = buildYAxis(series, plotWidth, plotHeight);
  return { series, xAdapter, yAdapter, xAxis, yAxis, plotWidth, plotHeight };
}

/** Convert raw spec data into typed, grouped, sorted, downsampled series. */
function buildSeries(spec: ChartSpec): CartesianSeries[] {
  const xField = spec.encoding.x?.field ?? '';
  const yField = spec.encoding.y?.field ?? '';
  const xType = spec.encoding.x?.type ?? 'quantitative';

  const colorField = spec.encoding.color?.field;
  const scheme =
    (spec.encoding.color?.scheme as CategoricalSchemeName | undefined) ?? DEFAULT_COLOR_SCHEME;

  const transform = (row: Record<string, unknown>, bandIndex: number): CartesianPoint | null => {
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
    for (const row of spec.data) {
      const key = stringifyKey(row[colorField]);
      let arr = grouped.get(key);
      if (arr === undefined) {
        arr = [];
        grouped.set(key, arr);
      }
      arr.push(row);
    }
  } else {
    grouped.set('', spec.data.slice());
  }

  const seriesNames = [...grouped.keys()];

  if (colorField !== undefined && seriesNames.length > COLOR_GROUP_WARN_THRESHOLD) {
    console.warn(
      `pixi-charts: color encoding on "${colorField}" produced ${String(seriesNames.length)} ` +
        `series, exceeding ${String(COLOR_GROUP_WARN_THRESHOLD)}. Categorical palettes wrap, ` +
        `so colors will repeat and series become visually ambiguous. Consider aggregating ` +
        `the data or using a field with fewer distinct values.`,
    );
  }

  const out: CartesianSeries[] = [];
  seriesNames.forEach((name, seriesIdx) => {
    const rows = grouped.get(name) ?? [];
    let points: CartesianPoint[] = [];
    rows.forEach((row, i) => {
      const sp = transform(row, i);
      if (sp !== null) points.push(sp);
    });
    // Sort points by xNum so the line/area is drawn in order regardless of
    // the input ordering. Stable enough across categorical/quantitative/
    // temporal because xNum is a single numeric per point.
    points.sort((a, b) => a.xNum - b.xNum);

    let downsampled = false;
    if (points.length > DOWNSAMPLE_THRESHOLD) {
      const reduced = lttb(
        points.map<DataPoint>((p) => ({ x: p.xNum, y: p.y })),
        DOWNSAMPLE_TARGET,
      );
      // Re-pair the LTTB output back to CartesianPoints by xNum lookup.
      const byXNum = new Map(points.map((p) => [p.xNum, p]));
      points = reduced
        .map((d) => byXNum.get(d.x))
        .filter((p): p is CartesianPoint => p !== undefined);
      downsampled = true;
    }

    const color =
      seriesNames.length > 1
        ? getCategoricalColor(scheme, seriesIdx)
        : getCategoricalColor(scheme, 0);

    out.push({ name, color, points, downsampled });
  });

  return out;
}

/** Build the x scale + adapter + {@link Axis} for the given field type. */
function buildXAxis(
  series: readonly CartesianSeries[],
  xType: FieldType,
  plotWidth: number,
): { xAdapter: ScaleAdapter<XValue>; xAxis: Axis<XValue> } {
  if (xType === 'temporal') {
    const dates = series.flatMap((s) => s.points.map((p) => p.xRaw as Date));
    const [a, b] = extent(dates) as [Date | undefined, Date | undefined];
    const scale = scaleTime()
      .domain([a ?? new Date(0), b ?? new Date(1)])
      .range([0, plotWidth]);
    const adapter = timeAdapter(scale) as unknown as ScaleAdapter<XValue>;
    const axis = new Axis<XValue>({
      scale: adapter,
      orientation: 'bottom',
      length: plotWidth,
      tickFormat: (v) => timeFormat('%b %d')(v as Date),
    });
    return { xAdapter: adapter, xAxis: axis };
  }
  if (xType === 'categorical') {
    const domain: string[] = [];
    const seen = new Set<string>();
    for (const s of series) {
      for (const p of s.points) {
        const v = p.xRaw as string;
        if (!seen.has(v)) {
          seen.add(v);
          domain.push(v);
        }
      }
    }
    const scale = scaleBand().domain(domain).range([0, plotWidth]).padding(0);
    const adapter = bandAdapter(scale) as unknown as ScaleAdapter<XValue>;
    const axis = new Axis<XValue>({
      scale: adapter,
      orientation: 'bottom',
      length: plotWidth,
    });
    return { xAdapter: adapter, xAxis: axis };
  }
  // quantitative
  const xs = series.flatMap((s) => s.points.map((p) => p.xNum));
  const [a, b] = extent(xs);
  const scale = scaleLinear()
    .domain([a ?? 0, b ?? 1])
    .range([0, plotWidth]);
  const adapter = linearAdapter(scale) as unknown as ScaleAdapter<XValue>;
  const axis = new Axis<XValue>({
    scale: adapter,
    orientation: 'bottom',
    length: plotWidth,
    tickFormat: (v) => d3format('~g')(v as number),
  });
  return { xAdapter: adapter, xAxis: axis };
}

/**
 * Build the y scale + adapter + {@link Axis}. The domain starts at zero
 * when all values are non-negative, otherwise spans `[min, max]` — this is
 * what makes a zero baseline land correctly for area fills even when the
 * data doesn't include zero.
 */
function buildYAxis(
  series: readonly CartesianSeries[],
  plotWidth: number,
  plotHeight: number,
): { yAdapter: ScaleAdapter<number>; yAxis: Axis<number> } {
  const ys = series.flatMap((s) => s.points.map((p) => p.y));
  const minY = d3min(ys) ?? 0;
  const maxY = d3max(ys) ?? 1;
  const domain: [number, number] = minY >= 0 ? [0, maxY] : [minY, maxY];
  const scale = scaleLinear().domain(domain).range([plotHeight, 0]).nice();
  const adapter = linearAdapter(scale);
  const axis = new Axis<number>({
    scale: adapter,
    orientation: 'left',
    length: plotHeight,
    tickFormat: (v) => d3format('~s')(v),
    showGrid: true,
    gridLength: plotWidth,
  });
  return { yAdapter: adapter, yAxis: axis };
}

/**
 * Build a {@link HitTester} for a cartesian chart's plot area.
 *
 * Strategy depends on the x-adapter's `kind`:
 * - `'band'` — iterate the domain to find the band the pointer's x falls
 *   into, then return the closest point (by y) in any series for that band.
 * - `'continuous'` / `'time'` — pixel-radius nearest point across all
 *   series; returns `null` if nothing is within `radiusPx`.
 *
 * Pure function: takes a snapshot of `series` and the adapters and returns
 * a closure. Separated from the chart classes so unit tests can exercise
 * the strategy without standing up a PIXI Application.
 */
export function buildCartesianHitTester(
  series: readonly CartesianSeries[],
  xAdapter: ScaleAdapter<XValue>,
  yAdapter: ScaleAdapter<number>,
  radiusPx: number,
): HitTester<CartesianHit> {
  if (xAdapter.kind === 'band') {
    const bandwidth = xAdapter.bandwidth?.() ?? 0;
    return (point: Point): CartesianHit | null => {
      let bandX: string | null = null;
      for (const dom of xAdapter.ticks()) {
        const px = xAdapter.scale(dom);
        if (point.x >= px && point.x <= px + bandwidth) {
          bandX = dom as string;
          break;
        }
      }
      if (bandX === null) return null;

      let best: CartesianHit | null = null;
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
  return (point: Point): CartesianHit | null => {
    let targetNum: number;
    if (invertFn !== undefined) {
      const inv = invertFn(point.x);
      targetNum = inv instanceof Date ? inv.getTime() : (inv as number);
    } else {
      targetNum = point.x;
    }

    let best: CartesianHit | null = null;
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

/**
 * Format the tooltip line for a cartesian hit: `xField: xValue • yField:
 * yValue`, with the x value formatted per its {@link FieldType}.
 */
export function formatCartesianTooltip(
  xField: string,
  yField: string,
  xType: FieldType,
  hit: CartesianHit,
): string {
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

/**
 * Format a generic two-field tooltip line: `${labelField}: ${label} •
 * ${valueField}: ${valueStr}`, with the numeric value formatted via
 * `d3-format`'s `,.2~f` — byte-identical numeric formatting to the y-value
 * in {@link formatCartesianTooltip}.
 *
 * BarChart's hit datum is a `{ category, value }` record, not a
 * {@link CartesianHit} (`{ series, point }`), so it cannot reuse
 * `formatCartesianTooltip` directly. This is an **additive sibling**, not a
 * refactor: the cartesian (series/point) charts keep calling
 * `formatCartesianTooltip` unchanged, so their tooltip output is provably
 * untouched by this session.
 */
export function formatCategoryValueTooltip(
  labelField: string,
  label: string,
  valueField: string,
  value: number,
): string {
  return `${labelField}: ${label} • ${valueField}: ${d3format(',.2~f')(value)}`;
}

/** Resolve the effective plot margin from the spec, falling back to defaults. */
export function resolveMargin(spec: ChartSpec): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const m = spec.options?.margin;
  return {
    top: m?.top ?? DEFAULT_MARGIN.top,
    right: m?.right ?? DEFAULT_MARGIN.right,
    bottom: m?.bottom ?? DEFAULT_MARGIN.bottom,
    left: m?.left ?? DEFAULT_MARGIN.left,
  };
}

/** Resolve the initial canvas width: explicit option → container size → default. */
export function resolveWidth(spec: ChartSpec, container: HTMLElement): number {
  return spec.options?.width ?? (container.clientWidth > 0 ? container.clientWidth : DEFAULT_WIDTH);
}

/** Resolve the initial canvas height: explicit option → container size → default. */
export function resolveHeight(spec: ChartSpec, container: HTMLElement): number {
  return (
    spec.options?.height ?? (container.clientHeight > 0 ? container.clientHeight : DEFAULT_HEIGHT)
  );
}

/**
 * Convert an unknown row value into a string key for series grouping.
 * Uses primitive-aware conversion so a `null` or `undefined` becomes the
 * empty string and arbitrary objects become a JSON snapshot rather than
 * the useless `'[object Object]'`.
 */
export function stringifyKey(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
    return String(v);
  }
  return JSON.stringify(v);
}

/** Coerce a value (typically from `Record<string, unknown>`) to a number, or `null`. */
export function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Coerce a value to a `Date`, or `null` if it can't be parsed. */
export function toDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}
