import { scaleBand, scaleLinear } from 'd3-scale';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock pixi.js at the module boundary. happy-dom has no WebGL — a real
 * PIXI Application / Container / Graphics would fail to allocate. The
 * mocks expose enough surface for the chart's compositional behaviour to
 * be observable from a test.
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
    strokeCalls: { color?: number; width?: number; alpha?: number }[] = [];
    moveToCalls: { x: number; y: number }[] = [];
    lineToCalls: { x: number; y: number }[] = [];
    clear = vi.fn((): this => {
      this.clearCalls += 1;
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
    rect = vi.fn((_x: number, _y: number, _w: number, _h: number): this => this);
    fill = vi.fn((_opts: unknown): this => this);
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

import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';

import { LineChart, createLineHitTester, type Series } from '../../src/charts/LineChart.js';
import { bandAdapter, linearAdapter } from '../../src/core/ScaleAdapter.js';
import type { ChartSpec } from '../../src/spec/ChartSpec.js';

type MockGfx = {
  clearCalls: number;
  moveToCalls: { x: number; y: number }[];
  lineToCalls: { x: number; y: number }[];
  strokeCalls: { color?: number; width?: number }[];
  parent: { children: unknown[] } | null;
  destroyed: boolean;
};
type MockSpriteT = {
  width: number;
  height: number;
  eventMode: string;
  parent: { children: unknown[] } | null;
  handlers: Map<string, Set<(e: unknown) => void>>;
  destroy: ReturnType<typeof vi.fn>;
};
type MockTxt = { text: string; destroyed: boolean };
type MockContainerT = { children: unknown[]; destroyed: boolean };
type MockApp = {
  init: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  stage: MockContainerT;
  renderer: { resize: ReturnType<typeof vi.fn>; width: number; height: number; resolution: number };
  ticker: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
  canvas: HTMLCanvasElement;
};

const MockApp = Application as unknown as { instances: MockApp[] };
const MockGraphics = Graphics as unknown as { gInstances: MockGfx[] };
const MockText = Text as unknown as { instances: MockTxt[] };
const MockSprite = Sprite as unknown as { sInstances: MockSpriteT[] };
const MockContainerS = Container as unknown as { instances: MockContainerT[] };

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
    type: 'line',
    data: [
      { x: 0, y: 10 },
      { x: 1, y: 30 },
      { x: 2, y: 20 },
      { x: 3, y: 50 },
    ],
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
    },
    animation: { enter: false },
    ...overrides,
  };
}

beforeEach(() => {
  MockApp.instances = [];
  MockGraphics.gInstances = [];
  MockText.instances = [];
  MockSprite.sInstances = [];
  MockContainerS.instances = [];
});

/* -------------------------------------------------------------------------- *
 * Construction & init                                                        *
 * -------------------------------------------------------------------------- */

describe('LineChart — construction', () => {
  it('does not create a PIXI Application or render anything', () => {
    const container = makeContainer();
    const chart = new LineChart({ container, spec: makeSpec() });
    expect(MockApp.instances).toHaveLength(0);
    expect(MockGraphics.gInstances).toHaveLength(0);
    expect(chart.initialized).toBe(false);
    expect(chart.destroyed).toBe(false);
  });
});

describe('LineChart — init() + first render', () => {
  it('creates an Application AND runs first render with axes and at least one line', async () => {
    const container = makeContainer();
    const chart = new LineChart({ container, spec: makeSpec() });

    await chart.init();

    expect(MockApp.instances).toHaveLength(1);
    expect(chart.initialized).toBe(true);
    // At least one Graphics for the line (axes may also create Graphics).
    expect(MockGraphics.gInstances.length).toBeGreaterThan(0);
    // Some Text instances were created (tick labels at minimum).
    expect(MockText.instances.length).toBeGreaterThan(0);

    chart.destroy();
  });

  it('renders one line for a single-series spec', async () => {
    const container = makeContainer();
    const chart = new LineChart({ container, spec: makeSpec() });
    await chart.init();

    // Find Graphics objects that have lineToCalls — those are the data lines
    // (axis lines call moveTo once + stroke, no lineToCalls).
    const lineGraphics = MockGraphics.gInstances.filter((g) => g.lineToCalls.length > 0);
    // Axis Graphics use lineTo too (for the axis line itself, which has one
    // lineTo). So separate by point count — data line will have > 1 lineTo.
    const dataLines = lineGraphics.filter((g) => g.lineToCalls.length >= 2);
    expect(dataLines).toHaveLength(1);

    chart.destroy();
  });

  it('renders N lines for a multi-series (color-encoded) spec', async () => {
    const container = makeContainer();
    const spec = makeSpec({
      data: [
        { x: 0, y: 10, group: 'A' },
        { x: 1, y: 20, group: 'A' },
        { x: 0, y: 5, group: 'B' },
        { x: 1, y: 15, group: 'B' },
        { x: 0, y: 30, group: 'C' },
        { x: 1, y: 25, group: 'C' },
      ],
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        color: { field: 'group' },
      },
    });
    const chart = new LineChart({ container, spec });
    await chart.init();

    const dataLines = MockGraphics.gInstances.filter((g) => g.lineToCalls.length >= 1);
    // 3 series → 3 data lines (each with at least 1 lineTo for 2 points).
    // Axis lines have exactly 1 lineTo too, so filter by count of unique
    // x positions across calls — easier: filter strokes with width === 2
    // (LINE_STROKE_WIDTH).
    const seriesLines = MockGraphics.gInstances.filter((g) =>
      g.strokeCalls.some((s) => s.width === 2),
    );
    expect(seriesLines).toHaveLength(3);
    void dataLines;

    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Downsampling                                                               *
 * -------------------------------------------------------------------------- */

describe('LineChart — downsampling', () => {
  it('does NOT downsample a small series', async () => {
    const data = Array.from({ length: 500 }, (_, i) => ({ x: i, y: Math.sin(i / 10) }));
    const container = makeContainer();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const chart = new LineChart({ container, spec: makeSpec({ data }) });
    await chart.init();

    // The drawn line should have ~500 points (= 499 lineTo + 1 moveTo).
    const seriesLines = MockGraphics.gInstances.filter((g) =>
      g.strokeCalls.some((s) => s.width === 2),
    );
    expect(seriesLines).toHaveLength(1);
    expect(seriesLines[0]!.lineToCalls.length).toBe(499);
    expect(infoSpy).not.toHaveBeenCalled();
    infoSpy.mockRestore();

    chart.destroy();
  });

  it('downsamples a series exceeding 10,000 points to 2,000', async () => {
    const data = Array.from({ length: 15_000 }, (_, i) => ({ x: i, y: Math.sin(i / 100) }));
    const container = makeContainer();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const chart = new LineChart({ container, spec: makeSpec({ data }) });
    await chart.init();

    const seriesLines = MockGraphics.gInstances.filter((g) =>
      g.strokeCalls.some((s) => s.width === 2),
    );
    expect(seriesLines).toHaveLength(1);
    // 2000 points → 1 moveTo + 1999 lineTo.
    expect(seriesLines[0]!.lineToCalls.length).toBe(1999);
    expect(infoSpy).toHaveBeenCalledWith(expect.stringMatching(/downsampled/));
    infoSpy.mockRestore();

    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Tooltip / Legend / interaction                                             *
 * -------------------------------------------------------------------------- */

describe('LineChart — tooltip', () => {
  it('creates a tooltip <div> by default', async () => {
    const container = makeContainer();
    const chart = new LineChart({ container, spec: makeSpec() });
    await chart.init();
    // Tooltip appends a div to the container.
    expect(container.querySelector('div')).not.toBeNull();
    chart.destroy();
  });

  it('does NOT create a tooltip when showTooltip: false', async () => {
    const container = makeContainer();
    const spec = makeSpec({ options: { showTooltip: false } });
    const chart = new LineChart({ container, spec });
    await chart.init();
    expect(container.querySelector('div')).toBeNull();
    chart.destroy();
  });
});

describe('LineChart — legend', () => {
  it('creates a legend for a multi-series spec', async () => {
    const container = makeContainer();
    const spec = makeSpec({
      data: [
        { x: 0, y: 1, g: 'A' },
        { x: 1, y: 2, g: 'A' },
        { x: 0, y: 3, g: 'B' },
        { x: 1, y: 4, g: 'B' },
      ],
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        color: { field: 'g' },
      },
    });
    const chart = new LineChart({ container, spec });
    await chart.init();
    // Legend creates 2 Text labels (one per series).
    const labels = MockText.instances.filter((t) => t.text === 'A' || t.text === 'B');
    expect(labels.length).toBeGreaterThanOrEqual(2);
    chart.destroy();
  });

  it('skips the legend for a single-series spec', async () => {
    const container = makeContainer();
    const chart = new LineChart({ container, spec: makeSpec() });
    await chart.init();
    // No way to perfectly assert "no legend exists", but no Text instance
    // should match an empty group key (single-series uses '' as the name).
    const emptyLabel = MockText.instances.find((t) => t.text === '');
    expect(emptyLabel).toBeUndefined();
    chart.destroy();
  });
});

describe('LineChart — interaction sprite', () => {
  it('creates a Sprite covering the plot area with eventMode "static"', async () => {
    const container = makeContainer(800, 600);
    const chart = new LineChart({ container, spec: makeSpec() });
    await chart.init();

    const sprites = MockSprite.sInstances;
    expect(sprites).toHaveLength(1);
    expect(sprites[0]!.eventMode).toBe('static');
    // Default margins {top:24, right:24, bottom:40, left:56} → plot 720 × 536.
    expect(sprites[0]!.width).toBe(720);
    expect(sprites[0]!.height).toBe(536);

    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Animation                                                                  *
 * -------------------------------------------------------------------------- */

describe('LineChart — animation', () => {
  it('animation.enter: false skips the tween (no ticker.add calls)', async () => {
    const container = makeContainer();
    const chart = new LineChart({ container, spec: makeSpec({ animation: { enter: false } }) });
    await chart.init();
    expect(MockApp.instances[0]!.ticker.add).not.toHaveBeenCalled();
    chart.destroy();
  });

  it('animation default (undefined) registers a ticker callback', async () => {
    const container = makeContainer();
    // No animation key at all — defaults to enter: true.
    const spec: ChartSpec = {
      type: 'line',
      data: [
        { x: 0, y: 1 },
        { x: 1, y: 2 },
      ],
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
    };
    const chart = new LineChart({ container, spec });
    await chart.init();
    expect(MockApp.instances[0]!.ticker.add).toHaveBeenCalled();
    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Destroy                                                                    *
 * -------------------------------------------------------------------------- */

describe('LineChart — destroy', () => {
  it('destroys the PIXI app, tooltip, interaction layer, axes, legend', async () => {
    const container = makeContainer();
    const spec = makeSpec({
      data: [
        { x: 0, y: 1, g: 'A' },
        { x: 1, y: 2, g: 'A' },
        { x: 0, y: 3, g: 'B' },
        { x: 1, y: 4, g: 'B' },
      ],
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        color: { field: 'g' },
      },
    });
    const chart = new LineChart({ container, spec });
    await chart.init();

    const tooltipEl = container.querySelector('div');
    expect(tooltipEl).not.toBeNull();

    chart.destroy();

    expect(chart.destroyed).toBe(true);
    expect(MockApp.instances[0]!.destroy).toHaveBeenCalledTimes(1);
    // Tooltip removed itself from the DOM.
    expect(container.querySelector('div')).toBeNull();
    // Interaction sprite destroyed.
    expect(MockSprite.sInstances[0]!.destroy).toHaveBeenCalled();
  });

  it('is idempotent — second destroy is a no-op', async () => {
    const container = makeContainer();
    const chart = new LineChart({ container, spec: makeSpec() });
    await chart.init();
    chart.destroy();
    chart.destroy();
    expect(MockApp.instances[0]!.destroy).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------------------------------------- *
 * Hit-tester                                                                 *
 * -------------------------------------------------------------------------- */

describe('createLineHitTester — continuous x-axis', () => {
  // Build a tiny synthetic series and adapters. The chart-internal
  // SeriesPoint shape requires xNum + xRaw — same value for quantitative.
  const series: Series[] = [
    {
      name: '',
      color: 0x111111,
      downsampled: false,
      points: [
        { xNum: 0, xRaw: 0, y: 10, datum: { x: 0, y: 10 } },
        { xNum: 10, xRaw: 10, y: 20, datum: { x: 10, y: 20 } },
        { xNum: 20, xRaw: 20, y: 30, datum: { x: 20, y: 30 } },
      ],
    },
  ];
  const xAdapter = linearAdapter(scaleLinear().domain([0, 20]).range([0, 200]));
  const yAdapter = linearAdapter(scaleLinear().domain([0, 30]).range([100, 0]));

  it('returns the nearest datum when the pointer is within radius', () => {
    const tester = createLineHitTester(series, xAdapter as never, yAdapter, 20);
    // x=10 in domain → 100 in pixels; y=20 in domain → ~33 in pixels.
    const hit = tester({ x: 102, y: 35 });
    expect(hit).not.toBeNull();
    expect(hit?.point.xNum).toBe(10);
  });

  it('returns null when the pointer is beyond radius', () => {
    const tester = createLineHitTester(series, xAdapter as never, yAdapter, 20);
    // Far away from any point.
    const hit = tester({ x: 100, y: 95 });
    expect(hit).toBeNull();
  });

  it('multi-series: returns the closest point across all series', () => {
    const series2: Series[] = [
      {
        name: 'A',
        color: 0xaaaaaa,
        downsampled: false,
        points: [{ xNum: 5, xRaw: 5, y: 10, datum: { x: 5, y: 10 } }],
      },
      {
        name: 'B',
        color: 0xbbbbbb,
        downsampled: false,
        points: [{ xNum: 5, xRaw: 5, y: 25, datum: { x: 5, y: 25 } }],
      },
    ];
    const tester = createLineHitTester(series2, xAdapter as never, yAdapter, 50);
    // Pointer near series B's point (x=5 → 50px, y=25 → 17px).
    const hit = tester({ x: 50, y: 17 });
    expect(hit?.series.name).toBe('B');
  });
});

describe('createLineHitTester — band x-axis', () => {
  it('resolves a pointer x into the correct band and returns that point', () => {
    const series: Series[] = [
      {
        name: '',
        color: 0,
        downsampled: false,
        points: [
          { xNum: 0, xRaw: 'A', y: 10, datum: {} },
          { xNum: 1, xRaw: 'B', y: 20, datum: {} },
          { xNum: 2, xRaw: 'C', y: 30, datum: {} },
        ],
      },
    ];
    const xScale = scaleBand().domain(['A', 'B', 'C']).range([0, 300]).padding(0);
    const xAdapter = bandAdapter(xScale);
    const yAdapter = linearAdapter(scaleLinear().domain([0, 30]).range([100, 0]));

    const tester = createLineHitTester(series, xAdapter as never, yAdapter, 50);
    // Each band is 100px wide. Pointer at x=150 lands inside band 'B' (100-200).
    const hit = tester({ x: 150, y: 50 });
    expect(hit?.point.xRaw).toBe('B');

    const hit2 = tester({ x: 250, y: 50 });
    expect(hit2?.point.xRaw).toBe('C');
  });

  it('returns null when the pointer x is outside the band range', () => {
    const series: Series[] = [
      {
        name: '',
        color: 0,
        downsampled: false,
        points: [{ xNum: 0, xRaw: 'A', y: 10, datum: {} }],
      },
    ];
    const xScale = scaleBand().domain(['A']).range([0, 100]).padding(0);
    const xAdapter = bandAdapter(xScale);
    const yAdapter = linearAdapter(scaleLinear().domain([0, 10]).range([100, 0]));
    const tester = createLineHitTester(series, xAdapter as never, yAdapter, 50);
    const hit = tester({ x: 500, y: 50 });
    expect(hit).toBeNull();
  });
});
