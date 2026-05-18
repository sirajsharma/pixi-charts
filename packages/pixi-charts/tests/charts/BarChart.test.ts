import { scaleBand, scaleLinear } from 'd3-scale';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock pixi.js at the module boundary — happy-dom has no WebGL. Same shape
 * as `AreaChart.test.ts`'s mock, with `rect()` extended to record its args
 * so bar geometry can be asserted (Area/Line only need lineTo/fill).
 */
vi.mock('pixi.js', () => {
  class MockContainer {
    static instances: MockContainer[] = [];
    children: any[] = [];
    position = { set: vi.fn((_x: number, _y: number) => undefined), x: 0, y: 0 };
    destroyed = false;
    parent: MockContainer | null = null;
    addChild = vi.fn((child: any): any => {
      this.children.push(child);
      if (child && typeof child === 'object') child.parent = this;
      return child;
    });
    removeChild = vi.fn((child: any): any => {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      if (child && typeof child === 'object') child.parent = null;
      return child;
    });
    removeChildren = vi.fn((): any[] => {
      const removed = this.children;
      this.children = [];
      return removed;
    });
    destroy = vi.fn((_opts?: unknown): void => {
      this.destroyed = true;
    });
    constructor() {
      MockContainer.instances.push(this);
    }
  }

  class MockGraphics extends MockContainer {
    static gInstances: MockGraphics[] = [];
    clearCalls = 0;
    rectCalls: { x: number; y: number; w: number; h: number }[] = [];
    fillCalls: { color?: number; alpha?: number }[] = [];
    strokeCalls: { color?: number; width?: number; alpha?: number }[] = [];
    moveToCalls: { x: number; y: number }[] = [];
    lineToCalls: { x: number; y: number }[] = [];
    closePathCalls = 0;
    clear = vi.fn((): this => {
      this.clearCalls += 1;
      this.rectCalls = [];
      this.moveToCalls = [];
      this.lineToCalls = [];
      return this;
    });
    moveTo = vi.fn((x: number, y: number): this => {
      this.moveToCalls.push({ x, y });
      return this;
    });
    lineTo = vi.fn((x: number, y: number): this => {
      this.lineToCalls.push({ x, y });
      return this;
    });
    closePath = vi.fn((): this => {
      this.closePathCalls += 1;
      return this;
    });
    rect = vi.fn((x: number, y: number, w: number, h: number): this => {
      this.rectCalls.push({ x, y, w, h });
      return this;
    });
    fill = vi.fn((opts: { color?: number; alpha?: number }): this => {
      this.fillCalls.push({ ...opts });
      return this;
    });
    stroke = vi.fn((opts: { color?: number; width?: number; alpha?: number }): this => {
      this.strokeCalls.push({ ...opts });
      return this;
    });
    constructor() {
      super();
      MockGraphics.gInstances.push(this);
    }
  }

  class MockText {
    static instances: MockText[] = [];
    text: string;
    style: Record<string, unknown>;
    destroyed = false;
    anchor = { set: vi.fn() };
    position = { set: vi.fn() };
    width = 30;
    height = 12;
    destroy = vi.fn((): void => {
      this.destroyed = true;
    });
    constructor(opts: { text: string; style: Record<string, unknown> }) {
      this.text = opts.text;
      this.style = opts.style;
      MockText.instances.push(this);
    }
  }

  class MockSprite extends MockContainer {
    static sInstances: MockSprite[] = [];
    eventMode = 'none';
    handlers = new Map<string, Set<(e: unknown) => void>>();
    on = vi.fn((event: string, handler: (e: unknown) => void): this => {
      let set = this.handlers.get(event);
      if (set === undefined) {
        set = new Set();
        this.handlers.set(event, set);
      }
      set.add(handler);
      return this;
    });
    off = vi.fn((event: string, handler: (e: unknown) => void): this => {
      this.handlers.get(event)?.delete(handler);
      return this;
    });
    constructor(_texture: unknown) {
      super();
      MockSprite.sInstances.push(this);
    }
  }

  class MockApplication {
    static instances: MockApplication[] = [];
    canvas: HTMLCanvasElement = document.createElement('canvas');
    stage: MockContainer = new MockContainer();
    renderer = {
      resize: vi.fn((_w: number, _h: number) => undefined),
      width: 800,
      height: 600,
      resolution: 1,
    };
    ticker = {
      add: vi.fn(),
      remove: vi.fn(),
    };
    init = vi.fn(async (opts?: { width?: number; height?: number }): Promise<void> => {
      if (opts?.width !== undefined) this.renderer.width = opts.width;
      if (opts?.height !== undefined) this.renderer.height = opts.height;
      await Promise.resolve();
    });
    destroy = vi.fn();
    constructor() {
      MockApplication.instances.push(this);
    }
  }

  return {
    Application: MockApplication,
    Container: MockContainer,
    Graphics: MockGraphics,
    Text: MockText,
    Sprite: MockSprite,
    Texture: { EMPTY: { __empty: true } },
  };
});

import { Application, Graphics, Sprite, Text } from 'pixi.js';

import { BarChart, buildBarHitTester, type BarRecord } from '../../src/charts/BarChart.js';
import { bandAdapter, linearAdapter } from '../../src/core/ScaleAdapter.js';
import type { ChartSpec } from '../../src/spec/ChartSpec.js';

type MockGfx = {
  clearCalls: number;
  rectCalls: { x: number; y: number; w: number; h: number }[];
  fillCalls: { color?: number; alpha?: number }[];
  parent: { children: unknown[] } | null;
};
type MockSpriteT = { width: number; height: number; eventMode: string };
type MockTxt = { text: string };
type MockApp = {
  destroy: ReturnType<typeof vi.fn>;
  ticker: { add: ReturnType<typeof vi.fn> };
};

const MockApp = Application as unknown as { instances: MockApp[] };
const MockGraphics = Graphics as unknown as { gInstances: MockGfx[] };
const MockText = Text as unknown as { instances: MockTxt[] };
const MockSprite = Sprite as unknown as { sInstances: MockSpriteT[] };

// Container 800×600, margins {24,24,40,56} → plot 720 × 536.
const PLOT_W = 720;
const PLOT_H = 536;

function makeContainer(width = 800, height = 600): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height });
  el.getBoundingClientRect = (): DOMRect =>
    ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0 }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

function makeSpec(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    type: 'bar',
    data: [
      { name: 'A', count: 10 },
      { name: 'B', count: 30 },
      { name: 'C', count: 20 },
    ],
    encoding: {
      x: { field: 'name', type: 'categorical' },
      y: { field: 'count', type: 'quantitative' },
    },
    animation: { enter: false },
    ...overrides,
  };
}

/** The single bars Graphics is the one that received `rect()` calls. */
function barsGfx(): MockGfx {
  const g = MockGraphics.gInstances.find((x) => x.rectCalls.length > 0);
  if (g === undefined) throw new Error('no bars graphics found');
  return g;
}

beforeEach(() => {
  MockApp.instances = [];
  MockGraphics.gInstances = [];
  MockText.instances = [];
  MockSprite.sInstances = [];
});

/* -------------------------------------------------------------------------- *
 * Construction & init                                                        *
 * -------------------------------------------------------------------------- */

describe('BarChart — construction', () => {
  it('does not create a PIXI Application or render anything', () => {
    const container = makeContainer();
    const chart = new BarChart({ container, spec: makeSpec() });
    expect(MockApp.instances).toHaveLength(0);
    expect(MockGraphics.gInstances).toHaveLength(0);
    expect(chart.initialized).toBe(false);
    expect(chart.destroyed).toBe(false);
  });
});

describe('BarChart — init() + first render (vertical)', () => {
  it('creates an Application and draws one rect per datum with axis labels', async () => {
    const container = makeContainer();
    const chart = new BarChart({ container, spec: makeSpec() });

    await chart.init();

    expect(MockApp.instances).toHaveLength(1);
    expect(chart.initialized).toBe(true);

    const g = barsGfx();
    expect(g.rectCalls).toHaveLength(3);
    expect(g.fillCalls).toHaveLength(3);

    // Both axes rendered: category labels + numeric value labels present.
    const labels = MockText.instances.map((t) => t.text);
    expect(labels).toEqual(expect.arrayContaining(['A', 'B', 'C']));
    expect(labels.some((t) => /\d/.test(t))).toBe(true);

    // Vertical: equal bar widths (bandwidth), x positions increase by band.
    const widths = new Set(g.rectCalls.map((r) => Math.round(r.w)));
    expect(widths.size).toBe(1);
    const xs = g.rectCalls.map((r) => r.x);
    expect(xs[0]!).toBeLessThan(xs[1]!);
    expect(xs[1]!).toBeLessThan(xs[2]!);

    chart.destroy();
  });
});

describe('BarChart — horizontal orientation', () => {
  it('swaps the scales: equal bar heights, increasing y, x starts at the baseline', async () => {
    const container = makeContainer();
    const spec = makeSpec({
      encoding: {
        x: { field: 'count', type: 'quantitative' },
        y: { field: 'name', type: 'categorical' },
      },
      options: { orientation: 'horizontal' },
    });
    const chart = new BarChart({ container, spec });
    await chart.init();

    const g = barsGfx();
    expect(g.rectCalls).toHaveLength(3);

    // Horizontal: equal heights (bandwidth), y positions increase per band.
    const heights = new Set(g.rectCalls.map((r) => Math.round(r.h)));
    expect(heights.size).toBe(1);
    const ys = g.rectCalls.map((r) => r.y);
    expect(ys[0]!).toBeLessThan(ys[1]!);
    expect(ys[1]!).toBeLessThan(ys[2]!);

    // All-positive domain → baseline at x=0; bars start at the left edge.
    for (const r of g.rectCalls) expect(r.x).toBeCloseTo(0, 0);
    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Baseline projection & negative values                                      *
 * -------------------------------------------------------------------------- */

describe('BarChart — baseline projection', () => {
  it('anchors the baseline at the plot bottom for an all-positive domain ([100,500])', async () => {
    const container = makeContainer();
    const chart = new BarChart({
      container,
      spec: makeSpec({
        data: [
          { name: 'A', count: 100 },
          { name: 'B', count: 500 },
        ],
      }),
    });
    await chart.init();

    const g = barsGfx();
    // Each bar's bottom edge (y + h) sits at the plot bottom (≈ PLOT_H).
    for (const r of g.rectCalls) {
      expect(r.y + r.h).toBeCloseTo(PLOT_H, 0);
    }
    chart.destroy();
  });

  it('grows negative bars below the baseline, positive above (vertical, [-50,100])', async () => {
    const container = makeContainer();
    const chart = new BarChart({
      container,
      spec: makeSpec({
        data: [
          { name: 'pos', count: 100 },
          { name: 'neg', count: -50 },
        ],
      }),
    });
    await chart.init();

    const g = barsGfx();
    const [pos, neg] = g.rectCalls;
    // The positive bar's top is above the negative bar's top.
    expect(pos!.y).toBeLessThan(neg!.y);
    // They share a baseline: positive bottom == negative top.
    expect(pos!.y + pos!.h).toBeCloseTo(neg!.y, 0);
    chart.destroy();
  });

  it('grows negative bars left of the baseline, positive right (horizontal, [-50,100])', async () => {
    const container = makeContainer();
    const spec = makeSpec({
      data: [
        { name: 'pos', count: 100 },
        { name: 'neg', count: -50 },
      ],
      encoding: {
        x: { field: 'count', type: 'quantitative' },
        y: { field: 'name', type: 'categorical' },
      },
      options: { orientation: 'horizontal' },
    });
    const chart = new BarChart({ container, spec });
    await chart.init();

    const g = barsGfx();
    const [pos, neg] = g.rectCalls;
    // Negative bar starts left of the positive bar's start; shared baseline.
    expect(neg!.x).toBeLessThan(pos!.x);
    expect(neg!.x + neg!.w).toBeCloseTo(pos!.x, 0);
    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Hit-testing                                                                *
 * -------------------------------------------------------------------------- */

describe('buildBarHitTester', () => {
  const records: BarRecord[] = [
    { category: 'A', value: 10, datum: { name: 'A', count: 10 }, color: 1 },
    { category: 'B', value: 30, datum: { name: 'B', count: 30 }, color: 2 },
  ];

  it('vertical: a point inside a bar returns its record; outside returns null', () => {
    const band = bandAdapter(scaleBand().domain(['A', 'B']).range([0, 100]).padding(0.1));
    const value = linearAdapter(scaleLinear().domain([0, 30]).range([200, 0]));
    const hit = buildBarHitTester(records, 'vertical', band, value);

    const aX = band.scale('A') + (band.bandwidth?.() ?? 0) / 2;
    // value 10 → y in [scale(10), scale(0)=200]; pick a y inside.
    const inside = hit({ x: aX, y: value.scale(5) });
    expect(inside?.category).toBe('A');

    expect(hit({ x: aX, y: 5 })).toBeNull(); // above the bar's top
    expect(hit({ x: -10, y: 100 })).toBeNull(); // left of every band
  });

  it('horizontal: a point inside a bar returns its record; outside returns null', () => {
    const band = bandAdapter(scaleBand().domain(['A', 'B']).range([0, 100]).padding(0.1));
    const value = linearAdapter(scaleLinear().domain([0, 30]).range([0, 200]));
    const hit = buildBarHitTester(records, 'horizontal', band, value);

    const bY = band.scale('B') + (band.bandwidth?.() ?? 0) / 2;
    const inside = hit({ x: value.scale(20), y: bY });
    expect(inside?.category).toBe('B');

    expect(hit({ x: value.scale(40), y: bY })).toBeNull(); // beyond the bar end
    expect(hit({ x: 10, y: -5 })).toBeNull(); // above every band
  });

  it('does not crash at the exact boundary between two bands', () => {
    const band = bandAdapter(scaleBand().domain(['A', 'B']).range([0, 100]).padding(0.1));
    const value = linearAdapter(scaleLinear().domain([0, 30]).range([200, 0]));
    const hit = buildBarHitTester(records, 'vertical', band, value);
    const boundary = band.scale('B'); // start of the second band
    const result = hit({ x: boundary, y: value.scale(5) });
    // Either the B record or null (the padding gap) — both are acceptable;
    // the contract is "deterministic and does not throw".
    expect(result === null || result.category === 'B').toBe(true);
  });
});

/* -------------------------------------------------------------------------- *
 * Color resolution                                                           *
 * -------------------------------------------------------------------------- */

describe('BarChart — color resolution', () => {
  it('no color encoding → every bar the same color', async () => {
    const container = makeContainer();
    const chart = new BarChart({ container, spec: makeSpec() });
    await chart.init();
    const colors = new Set(barsGfx().fillCalls.map((f) => f.color));
    expect(colors.size).toBe(1);
    chart.destroy();
  });

  it('categorical color encoding → bars colored by color-field value', async () => {
    const container = makeContainer();
    const chart = new BarChart({
      container,
      spec: makeSpec({
        data: [
          { name: 'A', count: 10, grp: 'x' },
          { name: 'B', count: 30, grp: 'y' },
          { name: 'C', count: 20, grp: 'x' },
        ],
        encoding: {
          x: { field: 'name', type: 'categorical' },
          y: { field: 'count', type: 'quantitative' },
          color: { field: 'grp' },
        },
      }),
    });
    await chart.init();
    const fills = barsGfx().fillCalls.map((f) => f.color);
    // grp x/y/x → two distinct colors, first and third equal.
    expect(new Set(fills).size).toBe(2);
    expect(fills[0]).toBe(fills[2]);
    expect(fills[0]).not.toBe(fills[1]);
    chart.destroy();
  });

  it('warns when distinct color values exceed the threshold (>20)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const data = Array.from({ length: 25 }, (_, i) => ({
      name: `cat${String(i)}`,
      count: i + 1,
      grp: `g${String(i)}`,
    }));
    const container = makeContainer();
    const chart = new BarChart({
      container,
      spec: makeSpec({
        data,
        encoding: {
          x: { field: 'name', type: 'categorical' },
          y: { field: 'count', type: 'quantitative' },
          color: { field: 'grp' },
        },
      }),
    });
    await chart.init();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/distinct values, exceeding 20/));
    warnSpy.mockRestore();
    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Legend / tooltip / interaction / animation / destroy                       *
 * -------------------------------------------------------------------------- */

describe('BarChart — legend', () => {
  it('shows a legend for a categorical color encoding with ≥2 values', async () => {
    const container = makeContainer();
    const chart = new BarChart({
      container,
      spec: makeSpec({
        data: [
          { name: 'A', count: 10, grp: 'x' },
          { name: 'B', count: 30, grp: 'y' },
        ],
        encoding: {
          x: { field: 'name', type: 'categorical' },
          y: { field: 'count', type: 'quantitative' },
          color: { field: 'grp' },
        },
      }),
    });
    await chart.init();
    const labels = MockText.instances.map((t) => t.text);
    expect(labels).toEqual(expect.arrayContaining(['x', 'y']));
    chart.destroy();
  });

  it('shows no legend without a color encoding', async () => {
    const container = makeContainer();
    const chart = new BarChart({ container, spec: makeSpec() });
    await chart.init();
    // No color field → no extra non-axis swatch labels beyond categories.
    const labels = MockText.instances.map((t) => t.text);
    expect(labels.filter((t) => t === 'A')).toHaveLength(1);
    chart.destroy();
  });
});

describe('BarChart — tooltip & interaction', () => {
  it('creates a tooltip <div> by default and a hit-test sprite', async () => {
    const container = makeContainer();
    const chart = new BarChart({ container, spec: makeSpec() });
    await chart.init();
    expect(container.querySelector('div')).not.toBeNull();
    expect(MockSprite.sInstances).toHaveLength(1);
    expect(MockSprite.sInstances[0]!.eventMode).toBe('static');
    expect(MockSprite.sInstances[0]!.width).toBe(PLOT_W);
    expect(MockSprite.sInstances[0]!.height).toBe(PLOT_H);
    chart.destroy();
  });

  it('does NOT create a tooltip when showTooltip: false', async () => {
    const container = makeContainer();
    const chart = new BarChart({ container, spec: makeSpec({ options: { showTooltip: false } }) });
    await chart.init();
    expect(container.querySelector('div')).toBeNull();
    chart.destroy();
  });
});

describe('BarChart — animation', () => {
  it('animation.enter: false draws bars at full extent without a tween', async () => {
    const container = makeContainer();
    const chart = new BarChart({ container, spec: makeSpec({ animation: { enter: false } }) });
    await chart.init();
    expect(MockApp.instances[0]!.ticker.add).not.toHaveBeenCalled();
    expect(barsGfx().rectCalls).toHaveLength(3);
    chart.destroy();
  });

  it('animation default registers a ticker callback', async () => {
    const container = makeContainer();
    const spec: ChartSpec = {
      type: 'bar',
      data: [
        { name: 'A', count: 10 },
        { name: 'B', count: 20 },
      ],
      encoding: {
        x: { field: 'name', type: 'categorical' },
        y: { field: 'count', type: 'quantitative' },
      },
    };
    const chart = new BarChart({ container, spec });
    await chart.init();
    expect(MockApp.instances[0]!.ticker.add).toHaveBeenCalled();
    chart.destroy();
  });
});

describe('BarChart — destroy', () => {
  it('destroys the PIXI app and tooltip; is idempotent', async () => {
    const container = makeContainer();
    const chart = new BarChart({ container, spec: makeSpec() });
    await chart.init();
    expect(container.querySelector('div')).not.toBeNull();

    chart.destroy();
    chart.destroy();

    expect(chart.destroyed).toBe(true);
    expect(MockApp.instances[0]!.destroy).toHaveBeenCalledTimes(1);
    expect(container.querySelector('div')).toBeNull();
  });
});
