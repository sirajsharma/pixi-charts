import { scaleBand, scaleLinear } from 'd3-scale';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setMediaMatch } from '../setup.js';

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
    position = {
      x: 0,
      y: 0,
      set: vi.fn(function (this: { x: number; y: number }, x: number, y: number) {
        this.x = x;
        this.y = y;
      }),
    };
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
    circleCalls: { x: number; y: number; r: number }[] = [];
    clear = vi.fn((): this => {
      this.clearCalls += 1;
      this.moveToCalls = [];
      this.lineToCalls = [];
      this.circleCalls = [];
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
    circle = vi.fn((x: number, y: number, r: number): this => {
      this.circleCalls.push({ x, y, r });
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
    width = 0;
    height = 0;
    scale = { x: 1, y: 1 };
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
      resize: vi.fn((w: number, h: number) => {
        this.renderer.width = w;
        this.renderer.height = h;
        this.screen.width = w;
        this.screen.height = h;
      }),
      width: 800,
      height: 600,
      resolution: 1,
    };
    // PIXI v8: `app.screen` is the logical CSS-pixel rect (renderer / resolution).
    // Charts read screen for layout to stay HiDPI-correct.
    screen = { width: 800, height: 600, x: 0, y: 0 };
    ticker = {
      add: vi.fn(),
      remove: vi.fn(),
    };
    init = vi.fn(async (opts?: { width?: number; height?: number }): Promise<void> => {
      if (opts?.width !== undefined) {
        this.renderer.width = opts.width;
        this.screen.width = opts.width;
      }
      if (opts?.height !== undefined) {
        this.renderer.height = opts.height;
        this.screen.height = opts.height;
      }
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

/* -------------------------------------------------------------------------- *
 * Hover decoration                                                           *
 * -------------------------------------------------------------------------- */

/**
 * Synthetic FederatedPointerEvent shape — same minimal surface as the one in
 * `tests/core/InteractionLayer.test.ts`. Charts call `getLocalPosition(sprite)`
 * to derive the plot-local coordinate and read `client.x/y` for the global
 * (page) coordinate.
 */
interface PointerEvt {
  button: number;
  client: { x: number; y: number };
  getLocalPosition: (s: unknown) => { x: number; y: number };
}
function makePointerEvent(local: { x: number; y: number }, client = local): PointerEvt {
  return { button: 0, client, getLocalPosition: () => local };
}
function fireOnInteractionSprite(eventName: string, evt: PointerEvt): void {
  // The InteractionLayer's hit-test sprite is the only Sprite the chart
  // creates that has 'pointermove' / 'pointerleave' handlers wired.
  const target = MockSprite.sInstances.find((s) => s.handlers.has(eventName));
  if (target === undefined) throw new Error(`no sprite with handler for ${eventName}`);
  for (const h of target.handlers.get(eventName)!) h(evt);
}
/**
 * Find the hover-marker Graphics inside the LineChart's plotContainer. It is
 * a Graphics with exactly one `circleCalls` entry (drawn at radius 6) and
 * `alpha` set as a numeric property — anything else (axes, series lines)
 * either has no circles or has different stroke geometry.
 *
 * NOTE: This MockGraphics has no `circleCalls` array — it captures circle
 * via mock methods but we want the marker's identity for alpha/position
 * assertions. The marker is created LAST (after axes + lines), so it's the
 * most recently constructed Graphics whose `alpha` was set to 0.
 */
function findHoverMarker(): MockGfx & { alpha?: number; position: { x: number; y: number } } {
  // Marker is the only Graphics with circleCalls (it draws a single filled
  // circle on hover). Before any hover, it has no circleCalls — so it's
  // the most-recent Graphics with alpha === 0.
  const all = MockGraphics.gInstances as unknown as (MockGfx & {
    alpha?: number;
    circleCalls?: { x: number; y: number; r: number }[];
    position: { x: number; y: number };
  })[];
  // Walk in reverse construction order — the hover marker is created last
  // inside render() (after lines), so this lands on it.
  for (let i = all.length - 1; i >= 0; i -= 1) {
    const g = all[i]!;
    // Hover marker has no lineTo (only circle + fill) and alpha is defined.
    if (g.lineToCalls.length === 0 && g.alpha !== undefined) {
      return g;
    }
  }
  throw new Error('hover marker Graphics not found');
}

describe('LineChart — hover decoration', () => {
  beforeEach(() => {
    // Reduced motion makes tween() synchronous (onUpdate(1) + onComplete fire
    // immediately) — deterministic decoration state after each event.
    setMediaMatch('(prefers-reduced-motion: reduce)', true);
  });

  it('creates an invisible hover marker (alpha 0) after first render', async () => {
    const container = makeContainer();
    const chart = new LineChart({ container, spec: makeSpec() });
    await chart.init();

    const marker = findHoverMarker();
    expect(marker.alpha).toBe(0);
    // No circle drawn yet — marker is invisible until first hover.
    const circleCalls = (marker as unknown as { circleCalls?: unknown[] }).circleCalls ?? [];
    expect(circleCalls).toHaveLength(0);

    chart.destroy();
  });

  // Test data: x ∈ [0, 3], y ∈ {10, 20, 30, 50}; y-scale nices to [0, 50].
  // Plot is 720 × 536 (after default margins). First datum projects to
  // (0, 428.8); last datum to (720, 0).
  const DATUM_0 = { x: 0, y: 429 };
  const DATUM_3 = { x: 720, y: 0 };

  it('on hover-enter, marker draws a circle and animates to alpha 1', async () => {
    const container = makeContainer(800, 600);
    const chart = new LineChart({ container, spec: makeSpec() });
    await chart.init();

    fireOnInteractionSprite('pointermove', makePointerEvent(DATUM_0));

    const marker = findHoverMarker();
    expect(marker.alpha).toBe(1); // reduced-motion → final state immediately
    const circleCalls = (marker as unknown as { circleCalls: { r: number }[] }).circleCalls;
    expect(circleCalls.length).toBeGreaterThan(0);
    expect(circleCalls[circleCalls.length - 1]!.r).toBe(6);

    chart.destroy();
  });

  it('isNewDatum=false (move within same datum) does NOT redraw the marker', async () => {
    const container = makeContainer(800, 600);
    const chart = new LineChart({ container, spec: makeSpec() });
    await chart.init();

    fireOnInteractionSprite('pointermove', makePointerEvent(DATUM_0));
    const marker = findHoverMarker();
    const circleCallsBefore = (marker as unknown as { circleCalls: unknown[] }).circleCalls.length;

    // Tiny move that stays within the SAME first-datum hit radius (20px).
    fireOnInteractionSprite('pointermove', makePointerEvent({ x: 1, y: 428 }));

    const circleCallsAfter = (marker as unknown as { circleCalls: unknown[] }).circleCalls.length;
    expect(circleCallsAfter).toBe(circleCallsBefore); // no redraw

    chart.destroy();
  });

  it('on leave, marker fades back to alpha 0', async () => {
    const container = makeContainer(800, 600);
    const chart = new LineChart({ container, spec: makeSpec() });
    await chart.init();

    fireOnInteractionSprite('pointermove', makePointerEvent(DATUM_0));
    fireOnInteractionSprite('pointerleave', makePointerEvent(DATUM_0));

    const marker = findHoverMarker();
    expect(marker.alpha).toBe(0);

    chart.destroy();
  });

  it('rapid A → B datum change cancels A and ends at B', async () => {
    const container = makeContainer(800, 600);
    const chart = new LineChart({ container, spec: makeSpec() });
    await chart.init();

    fireOnInteractionSprite('pointermove', makePointerEvent(DATUM_0));
    const marker = findHoverMarker();
    const positionAfterA = { x: marker.position.x, y: marker.position.y };

    fireOnInteractionSprite('pointermove', makePointerEvent(DATUM_3));

    // Marker repositioned to datum B (plot-x ≈ 720), not somewhere between A and B.
    expect(marker.position.x).not.toBe(positionAfterA.x);
    expect(marker.position.x).toBeGreaterThan(700);
    expect(marker.alpha).toBe(1);

    chart.destroy();
  });

  it('destroy() during hover does not throw', async () => {
    const container = makeContainer(800, 600);
    const chart = new LineChart({ container, spec: makeSpec() });
    await chart.init();

    fireOnInteractionSprite('pointermove', makePointerEvent(DATUM_0));
    expect(() => {
      chart.destroy();
    }).not.toThrow();
    expect(chart.destroyed).toBe(true);
  });
});
