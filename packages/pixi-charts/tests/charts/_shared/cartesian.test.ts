import { scaleBand, scaleLinear } from 'd3-scale';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock pixi.js at the module boundary — `buildCartesianSetup` constructs
 * real {@link Axis} instances, and `Axis` imports `Container`, `Graphics`,
 * `Text`. happy-dom has no WebGL, so a minimal structural mock is enough.
 */
vi.mock('pixi.js', () => {
  class MockContainer {
    children: unknown[] = [];
    position = { set: vi.fn(), x: 0, y: 0 };
    destroyed = false;
    parent: MockContainer | null = null;
    addChild = vi.fn((c: unknown): unknown => {
      this.children.push(c);
      return c;
    });
    removeChild = vi.fn();
    removeChildren = vi.fn((): unknown[] => {
      const r = this.children;
      this.children = [];
      return r;
    });
    destroy = vi.fn((): void => {
      this.destroyed = true;
    });
  }
  class MockGraphics extends MockContainer {
    clear = vi.fn((): this => this);
    moveTo = vi.fn((): this => this);
    lineTo = vi.fn((): this => this);
    rect = vi.fn((): this => this);
    fill = vi.fn((): this => this);
    stroke = vi.fn((): this => this);
  }
  class MockText {
    anchor = { set: vi.fn() };
    position = { set: vi.fn() };
    width = 30;
    height = 12;
    destroyed = false;
    destroy = vi.fn((): void => {
      this.destroyed = true;
    });
    constructor(public opts: { text: string; style: Record<string, unknown> }) {}
  }
  return { Container: MockContainer, Graphics: MockGraphics, Text: MockText };
});

import { Axis } from '../../../src/core/Axis.js';
import {
  COLOR_GROUP_WARN_THRESHOLD,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  buildCartesianHitTester,
  buildCartesianSetup,
  formatCartesianTooltip,
  resolveHeight,
  resolveMargin,
  resolveWidth,
  type CartesianHit,
  type CartesianSeries,
} from '../../../src/charts/_shared/cartesian.js';
import { bandAdapter, linearAdapter } from '../../../src/core/ScaleAdapter.js';
import type { ChartSpec } from '../../../src/spec/ChartSpec.js';

function spec(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    type: 'line',
    data: [
      { x: 0, y: 10 },
      { x: 2, y: 20 },
      { x: 1, y: 30 },
      { x: 3, y: 50 },
    ],
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- *
 * buildCartesianSetup                                                        *
 * -------------------------------------------------------------------------- */

describe('buildCartesianSetup — series grouping', () => {
  it('produces a single series and sorts points by xNum when no color encoding', () => {
    const { series } = buildCartesianSetup(spec(), 400, 300);
    expect(series).toHaveLength(1);
    expect(series[0]!.points.map((p) => p.xNum)).toEqual([0, 1, 2, 3]);
  });

  it('groups into one series per distinct color-field value', () => {
    const { series } = buildCartesianSetup(
      spec({
        data: [
          { x: 0, y: 1, g: 'a' },
          { x: 1, y: 2, g: 'b' },
          { x: 2, y: 3, g: 'a' },
        ],
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
          color: { field: 'g' },
        },
      }),
      400,
      300,
    );
    expect(series.map((s) => s.name).sort()).toEqual(['a', 'b']);
    // Distinct colors across multiple series.
    expect(series[0]!.color).not.toBe(series[1]!.color);
  });

  it('builds two real Axis instances', () => {
    const { xAxis, yAxis } = buildCartesianSetup(spec(), 400, 300);
    expect(xAxis).toBeInstanceOf(Axis);
    expect(yAxis).toBeInstanceOf(Axis);
  });
});

describe('buildCartesianSetup — y baseline domain', () => {
  it('anchors the baseline at the plot bottom when all values are non-negative ([100,500])', () => {
    const { yAdapter } = buildCartesianSetup(
      spec({
        data: [
          { x: 0, y: 100 },
          { x: 1, y: 500 },
        ],
      }),
      400,
      300,
    );
    // Domain becomes [0, 500] → 0 projects to the bottom of the plot.
    expect(yAdapter.scale(0)).toBeCloseTo(300, 5);
  });

  it('places the baseline mid-plot when the domain crosses zero ([-50,100])', () => {
    const { yAdapter } = buildCartesianSetup(
      spec({
        data: [
          { x: 0, y: -50 },
          { x: 1, y: 100 },
        ],
      }),
      400,
      300,
    );
    const baseline = yAdapter.scale(0);
    expect(baseline).toBeGreaterThan(0);
    expect(baseline).toBeLessThan(300);
  });
});

describe('buildCartesianSetup — downsampling', () => {
  it('leaves series at or below the threshold untouched', () => {
    const data = Array.from({ length: 5000 }, (_, i) => ({ x: i, y: i % 7 }));
    const { series } = buildCartesianSetup(spec({ data }), 400, 300);
    expect(series[0]!.downsampled).toBe(false);
    expect(series[0]!.points).toHaveLength(5000);
  });

  it('LTTB-reduces a series above the threshold and flags it', () => {
    const data = Array.from({ length: 12_000 }, (_, i) => ({ x: i, y: Math.sin(i / 50) }));
    const { series } = buildCartesianSetup(spec({ data }), 400, 300);
    expect(series[0]!.downsampled).toBe(true);
    expect(series[0]!.points.length).toBeLessThanOrEqual(2000);
  });

  it('does NOT emit the downsampling console.info (the chart owns that, once per instance)', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const data = Array.from({ length: 12_000 }, (_, i) => ({ x: i, y: i }));
    buildCartesianSetup(spec({ data }), 400, 300);
    expect(info).not.toHaveBeenCalled();
  });
});

describe('buildCartesianSetup — >20 color-group warning (new in Session 5)', () => {
  function colorSpec(groupCount: number): ChartSpec {
    return spec({
      data: Array.from({ length: groupCount }, (_, i) => ({ x: i, y: i, g: `grp-${String(i)}` })),
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        color: { field: 'g' },
      },
    });
  }

  it('warns when a color encoding produces more than the threshold of series', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    buildCartesianSetup(colorSpec(COLOR_GROUP_WARN_THRESHOLD + 1), 400, 300);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/exceeding 20/);
  });

  it('does not warn at exactly the threshold', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    buildCartesianSetup(colorSpec(COLOR_GROUP_WARN_THRESHOLD), 400, 300);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn when there is no color encoding, regardless of row count', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const data = Array.from({ length: 100 }, (_, i) => ({ x: i, y: i }));
    buildCartesianSetup(spec({ data }), 400, 300);
    expect(warn).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- *
 * buildCartesianHitTester                                                    *
 * -------------------------------------------------------------------------- */

describe('buildCartesianHitTester — continuous x-axis', () => {
  const series: CartesianSeries[] = [
    {
      name: 's',
      color: 0,
      downsampled: false,
      points: [
        { xNum: 0, xRaw: 0, y: 0, datum: {} },
        { xNum: 10, xRaw: 10, y: 100, datum: {} },
        { xNum: 20, xRaw: 20, y: 50, datum: {} },
      ],
    },
  ];
  const xAdapter = linearAdapter(scaleLinear().domain([0, 20]).range([0, 200]));
  const yAdapter = linearAdapter(scaleLinear().domain([0, 100]).range([200, 0]));

  it('returns the nearest point within the pixel radius', () => {
    const tester = buildCartesianHitTester(series, xAdapter as never, yAdapter, 20);
    const hit = tester({ x: 0, y: 200 });
    expect(hit?.point.xNum).toBe(0);
  });

  it('returns null when nothing is within the radius', () => {
    const tester = buildCartesianHitTester(series, xAdapter as never, yAdapter, 5);
    // Pixel-space points are (0,200), (100,0), (200,100); (50,100) is >5px
    // from every one of them.
    expect(tester({ x: 50, y: 100 })).toBeNull();
  });
});

describe('buildCartesianHitTester — band x-axis', () => {
  it('resolves the band under the pointer and the closest point by y', () => {
    const series: CartesianSeries[] = [
      {
        name: 's',
        color: 0,
        downsampled: false,
        points: [
          { xNum: 0, xRaw: 'a', y: 10, datum: {} },
          { xNum: 1, xRaw: 'b', y: 20, datum: {} },
        ],
      },
    ];
    const band = scaleBand().domain(['a', 'b']).range([0, 200]).padding(0);
    const xAdapter = bandAdapter(band);
    const yAdapter = linearAdapter(scaleLinear().domain([0, 20]).range([200, 0]));
    const tester = buildCartesianHitTester(series, xAdapter as never, yAdapter, 50);
    const hit = tester({ x: 150, y: 0 });
    expect(hit?.point.xRaw).toBe('b');
  });
});

/* -------------------------------------------------------------------------- *
 * formatCartesianTooltip                                                     *
 * -------------------------------------------------------------------------- */

describe('formatCartesianTooltip', () => {
  const mk = (xRaw: number | string | Date, y: number): CartesianHit => ({
    series: { name: 's', color: 0, downsampled: false, points: [] },
    point: { xNum: 0, xRaw, y, datum: {} },
  });

  it('formats a quantitative x', () => {
    // y uses the ',.2~f' specifier — `~` trims insignificant trailing zeros.
    expect(formatCartesianTooltip('xf', 'yf', 'quantitative', mk(1234, 5.5))).toBe(
      'xf: 1234 • yf: 5.5',
    );
  });

  it('formats a categorical x verbatim', () => {
    expect(formatCartesianTooltip('cat', 'v', 'categorical', mk('North', 42))).toBe(
      'cat: North • v: 42',
    );
  });

  it('formats a temporal x with a date format', () => {
    const out = formatCartesianTooltip('d', 'v', 'temporal', mk(new Date(2024, 0, 15), 7));
    expect(out).toMatch(/^d: Jan 15, 2024 • v: 7$/);
  });
});

/* -------------------------------------------------------------------------- *
 * resolve* helpers                                                           *
 * -------------------------------------------------------------------------- */

describe('resolve helpers', () => {
  function el(w: number, h: number): HTMLElement {
    const e = document.createElement('div');
    Object.defineProperty(e, 'clientWidth', { value: w });
    Object.defineProperty(e, 'clientHeight', { value: h });
    return e;
  }

  it('resolveMargin falls back to defaults and honors overrides', () => {
    expect(resolveMargin(spec())).toEqual({ top: 24, right: 24, bottom: 40, left: 56 });
    expect(resolveMargin(spec({ options: { margin: { left: 80 } } })).left).toBe(80);
  });

  it('resolveWidth/Height prefer the option, then container, then the default', () => {
    expect(resolveWidth(spec({ options: { width: 999 } }), el(0, 0))).toBe(999);
    expect(resolveWidth(spec(), el(640, 480))).toBe(640);
    expect(resolveWidth(spec(), el(0, 0))).toBe(DEFAULT_WIDTH);
    expect(resolveHeight(spec(), el(0, 0))).toBe(DEFAULT_HEIGHT);
  });
});
