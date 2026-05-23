import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock pixi.js at the module boundary — happy-dom has no WebGL. Same shape
 * as `LineChart.test.ts`'s mock; the area chart's compositional behaviour
 * is observed through `Graphics` fill/stroke/lineTo spies and stage
 * children.
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
    fillCalls: { color?: number; alpha?: number }[] = [];
    strokeCalls: { color?: number; width?: number; alpha?: number }[] = [];
    moveToCalls: { x: number; y: number }[] = [];
    lineToCalls: { x: number; y: number }[] = [];
    closePathCalls = 0;
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
    closePath = vi.fn((): this => {
      this.closePathCalls += 1;
      return this;
    });
    rect = vi.fn((_x: number, _y: number, _w: number, _h: number): this => this);
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

import { AreaChart } from '../../src/charts/AreaChart.js';
import type { ChartSpec } from '../../src/spec/ChartSpec.js';

type MockGfx = {
  clearCalls: number;
  fillCalls: { color?: number; alpha?: number }[];
  strokeCalls: { color?: number; width?: number; alpha?: number }[];
  moveToCalls: { x: number; y: number }[];
  lineToCalls: { x: number; y: number }[];
  closePathCalls: number;
  parent: { children: unknown[] } | null;
  destroyed: boolean;
};
type MockSpriteT = { width: number; height: number; eventMode: string };
type MockTxt = { text: string; destroyed: boolean };
type MockContainerT = { children: unknown[]; destroyed: boolean };
type MockApp = {
  destroy: ReturnType<typeof vi.fn>;
  ticker: { add: ReturnType<typeof vi.fn> };
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
    type: 'area',
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

/** The data-area Graphics are the ones stroked at the 2px outline width. */
function areaGraphics(): MockGfx[] {
  return MockGraphics.gInstances.filter((g) => g.strokeCalls.some((s) => s.width === 2));
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

describe('AreaChart — construction', () => {
  it('does not create a PIXI Application or render anything', () => {
    const container = makeContainer();
    const chart = new AreaChart({ container, spec: makeSpec() });
    expect(MockApp.instances).toHaveLength(0);
    expect(MockGraphics.gInstances).toHaveLength(0);
    expect(chart.initialized).toBe(false);
    expect(chart.destroyed).toBe(false);
  });
});

describe('AreaChart — init() + first render', () => {
  it('creates an Application AND runs the first render with axes and an area', async () => {
    const container = makeContainer();
    const chart = new AreaChart({ container, spec: makeSpec() });

    await chart.init();

    expect(MockApp.instances).toHaveLength(1);
    expect(chart.initialized).toBe(true);
    expect(MockText.instances.length).toBeGreaterThan(0);

    const areas = areaGraphics();
    expect(areas).toHaveLength(1);
    // The area is a filled, closed polygon with a stroked top edge.
    expect(areas[0]!.fillCalls.length).toBeGreaterThanOrEqual(1);
    expect(areas[0]!.closePathCalls).toBeGreaterThanOrEqual(1);

    chart.destroy();
  });

  it('renders N areas for a multi-series (color-encoded) spec', async () => {
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
    const chart = new AreaChart({ container, spec });
    await chart.init();

    expect(areaGraphics()).toHaveLength(3);

    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Baseline projection                                                        *
 * -------------------------------------------------------------------------- */

describe('AreaChart — baseline through the y-adapter', () => {
  // Container 800×600, margins {24,24,40,56} → plot 720 × 536.
  const PLOT_BOTTOM = 536;

  it('anchors the baseline at the plot bottom when the domain does not include zero ([100,500])', async () => {
    const container = makeContainer();
    const chart = new AreaChart({
      container,
      spec: makeSpec({
        data: [
          { x: 0, y: 100 },
          { x: 1, y: 500 },
        ],
      }),
    });
    await chart.init();

    const g = areaGraphics()[0]!;
    // Polygon lineTo order: [p1-top, (lastX, baseline), (firstX, baseline), p1-top].
    const baselineY = g.lineToCalls[1]!.y;
    expect(baselineY).toBe(g.lineToCalls[2]!.y);
    expect(baselineY).toBeCloseTo(PLOT_BOTTOM, 0);

    chart.destroy();
  });

  it('places the baseline mid-plot when the domain crosses zero ([-50,100])', async () => {
    const container = makeContainer();
    const chart = new AreaChart({
      container,
      spec: makeSpec({
        data: [
          { x: 0, y: -50 },
          { x: 1, y: 100 },
        ],
      }),
    });
    await chart.init();

    const g = areaGraphics()[0]!;
    const baselineY = g.lineToCalls[1]!.y;
    expect(baselineY).toBeGreaterThan(0);
    expect(baselineY).toBeLessThan(PLOT_BOTTOM);

    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Downsampling (shared pipeline wiring)                                       *
 * -------------------------------------------------------------------------- */

describe('AreaChart — downsampling', () => {
  it('does NOT downsample or log for a small series', async () => {
    const data = Array.from({ length: 500 }, (_, i) => ({ x: i, y: Math.sin(i / 10) }));
    const container = makeContainer();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const chart = new AreaChart({ container, spec: makeSpec({ data }) });
    await chart.init();

    expect(areaGraphics()).toHaveLength(1);
    expect(infoSpy).not.toHaveBeenCalled();
    infoSpy.mockRestore();

    chart.destroy();
  });

  it('downsamples a series exceeding 10,000 points and logs once', async () => {
    const data = Array.from({ length: 15_000 }, (_, i) => ({ x: i, y: Math.sin(i / 100) }));
    const container = makeContainer();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const chart = new AreaChart({ container, spec: makeSpec({ data }) });
    await chart.init();

    expect(areaGraphics()).toHaveLength(1);
    expect(infoSpy).toHaveBeenCalledWith(expect.stringMatching(/AreaChart: downsampled/));
    infoSpy.mockRestore();

    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Tooltip / Legend / interaction                                             *
 * -------------------------------------------------------------------------- */

describe('AreaChart — tooltip', () => {
  it('creates a tooltip <div> by default', async () => {
    const container = makeContainer();
    const chart = new AreaChart({ container, spec: makeSpec() });
    await chart.init();
    expect(container.querySelector('div')).not.toBeNull();
    chart.destroy();
  });

  it('does NOT create a tooltip when showTooltip: false', async () => {
    const container = makeContainer();
    const chart = new AreaChart({ container, spec: makeSpec({ options: { showTooltip: false } }) });
    await chart.init();
    expect(container.querySelector('div')).toBeNull();
    chart.destroy();
  });
});

describe('AreaChart — legend', () => {
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
    const chart = new AreaChart({ container, spec });
    await chart.init();
    const labels = MockText.instances.filter((t) => t.text === 'A' || t.text === 'B');
    expect(labels.length).toBeGreaterThanOrEqual(2);
    chart.destroy();
  });

  it('skips the legend for a single-series spec', async () => {
    const container = makeContainer();
    const chart = new AreaChart({ container, spec: makeSpec() });
    await chart.init();
    const emptyLabel = MockText.instances.find((t) => t.text === '');
    expect(emptyLabel).toBeUndefined();
    chart.destroy();
  });
});

describe('AreaChart — interaction sprite', () => {
  it('creates a Sprite covering the plot area with eventMode "static"', async () => {
    const container = makeContainer(800, 600);
    const chart = new AreaChart({ container, spec: makeSpec() });
    await chart.init();

    expect(MockSprite.sInstances).toHaveLength(1);
    expect(MockSprite.sInstances[0]!.eventMode).toBe('static');
    expect(MockSprite.sInstances[0]!.width).toBe(720);
    expect(MockSprite.sInstances[0]!.height).toBe(536);

    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Animation                                                                  *
 * -------------------------------------------------------------------------- */

describe('AreaChart — animation', () => {
  it('animation.enter: false skips the tween (no ticker.add calls)', async () => {
    const container = makeContainer();
    const chart = new AreaChart({ container, spec: makeSpec({ animation: { enter: false } }) });
    await chart.init();
    expect(MockApp.instances[0]!.ticker.add).not.toHaveBeenCalled();
    chart.destroy();
  });

  it('animation default (undefined) registers a ticker callback', async () => {
    const container = makeContainer();
    const spec: ChartSpec = {
      type: 'area',
      data: [
        { x: 0, y: 1 },
        { x: 1, y: 2 },
      ],
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
    };
    const chart = new AreaChart({ container, spec });
    await chart.init();
    expect(MockApp.instances[0]!.ticker.add).toHaveBeenCalled();
    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Destroy                                                                    *
 * -------------------------------------------------------------------------- */

describe('AreaChart — destroy', () => {
  it('destroys the PIXI app, tooltip, and interaction sprite', async () => {
    const container = makeContainer();
    const chart = new AreaChart({ container, spec: makeSpec() });
    await chart.init();

    expect(container.querySelector('div')).not.toBeNull();

    chart.destroy();

    expect(chart.destroyed).toBe(true);
    expect(MockApp.instances[0]!.destroy).toHaveBeenCalledTimes(1);
    expect(container.querySelector('div')).toBeNull();
  });

  it('is idempotent — second destroy is a no-op', async () => {
    const container = makeContainer();
    const chart = new AreaChart({ container, spec: makeSpec() });
    await chart.init();
    chart.destroy();
    chart.destroy();
    expect(MockApp.instances[0]!.destroy).toHaveBeenCalledTimes(1);
  });
});
