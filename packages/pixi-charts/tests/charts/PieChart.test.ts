import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock pixi.js at the module boundary — happy-dom has no WebGL. Mirrors
 * BarChart.test.ts but extends MockGraphics with `arc` (PIXI v8's
 * Canvas-style `arc(cx, cy, r, start, end, counterclockwise?)`) so slice
 * geometry can be asserted.
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
    arcCalls: {
      cx: number;
      cy: number;
      r: number;
      start: number;
      end: number;
      ccw: boolean;
    }[] = [];
    moveToCalls: { x: number; y: number }[] = [];
    lineToCalls: { x: number; y: number }[] = [];
    fillCalls: { color?: number; alpha?: number }[] = [];
    strokeCalls: { color?: number; width?: number; alpha?: number }[] = [];
    rectCalls: { x: number; y: number; w: number; h: number }[] = [];
    closePathCalls = 0;
    clear = vi.fn((): this => {
      this.clearCalls += 1;
      this.arcCalls = [];
      this.moveToCalls = [];
      this.lineToCalls = [];
      this.rectCalls = [];
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
    arc = vi.fn(
      (cx: number, cy: number, r: number, start: number, end: number, ccw = false): this => {
        this.arcCalls.push({ cx, cy, r, start, end, ccw });
        return this;
      },
    );
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
    width = 0;
    height = 0;
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

import { Application, Graphics, Sprite } from 'pixi.js';

import { buildPieHitTester, PieChart, type PieSlice } from '../../src/charts/PieChart.js';
import type { ChartSpec } from '../../src/spec/ChartSpec.js';

type MockGfx = {
  arcCalls: { cx: number; cy: number; r: number; start: number; end: number; ccw: boolean }[];
  moveToCalls: { x: number; y: number }[];
  lineToCalls: { x: number; y: number }[];
  fillCalls: { color?: number; alpha?: number }[];
  closePathCalls: number;
  parent: { children: unknown[] } | null;
};
type MockSpriteT = { width: number; height: number; eventMode: string };
type MockApp = {
  destroy: ReturnType<typeof vi.fn>;
  ticker: { add: ReturnType<typeof vi.fn> };
};

const MockApp = Application as unknown as { instances: MockApp[] };
const MockGraphicsCls = Graphics as unknown as { gInstances: MockGfx[] };
const MockSpriteCls = Sprite as unknown as { sInstances: MockSpriteT[] };

// Container 800×600, pie margins {16,16,16,16}. The legend (added when ≥2
// slices) sits to the right of the plot and reduces plotWidth by
// `legend.width + legendGap`. With the mock Text.width = 30 and the
// categorical default of swatch(12) + spacing(6) + label(30) = 48, plus the
// 12px gap, the plot loses 60px of width. Single-slice tests would see
// PLOT_W_NO_LEGEND instead.
const CONTAINER_W = 800;
const CONTAINER_H = 600;
const MOCK_LEGEND_WIDTH = 12 + 6 + 30; // swatchSize + spacing + Text.width
const LEGEND_GAP = 12;
const PLOT_W = CONTAINER_W - 32 - MOCK_LEGEND_WIDTH - LEGEND_GAP;
const PLOT_W_NO_LEGEND = CONTAINER_W - 32;
const PLOT_H = CONTAINER_H - 32;
const TWO_PI = Math.PI * 2;

function makeContainer(width = CONTAINER_W, height = CONTAINER_H): HTMLElement {
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
    type: 'pie',
    data: [
      { browser: 'Chrome', share: 60 },
      { browser: 'Safari', share: 20 },
      { browser: 'Firefox', share: 10 },
      { browser: 'Edge', share: 10 },
    ],
    encoding: {
      x: { field: 'browser', type: 'categorical' },
      value: { field: 'share' },
    },
    animation: { enter: false },
    ...overrides,
  };
}

/**
 * Locate the slice-drawing Graphics — the one with arc calls. (Axis-style
 * Graphics may exist via the Legend's swatches but it draws rectangles via
 * `.rect()`, not arcs.)
 */
function sliceGfx(): MockGfx {
  const g = MockGraphicsCls.gInstances.find((x) => x.arcCalls.length > 0);
  if (g === undefined) throw new Error('no slice graphics found');
  return g;
}

beforeEach(() => {
  MockApp.instances = [];
  MockGraphicsCls.gInstances = [];
  MockSpriteCls.sInstances = [];
});

/* -------------------------------------------------------------------------- *
 * Construction                                                               *
 * -------------------------------------------------------------------------- */

describe('PieChart — construction', () => {
  it('does not create a PIXI Application or render anything', () => {
    const container = makeContainer();
    const chart = new PieChart({ container, spec: makeSpec() });
    expect(MockApp.instances).toHaveLength(0);
    expect(MockGraphicsCls.gInstances).toHaveLength(0);
    expect(chart.initialized).toBe(false);
    expect(chart.destroyed).toBe(false);
  });
});

/* -------------------------------------------------------------------------- *
 * Init + first render: pie geometry                                          *
 * -------------------------------------------------------------------------- */

describe('PieChart — init() + first render (pie, innerRadius: 0)', () => {
  it('draws one filled arc per datum on a single Graphics instance', async () => {
    const container = makeContainer();
    const chart = new PieChart({ container, spec: makeSpec() });
    await chart.init();

    const g = sliceGfx();
    expect(g.arcCalls).toHaveLength(4);
    // Pie path is `moveTo center → arc → closePath` per slice — no lineTo.
    expect(g.moveToCalls).toHaveLength(4);
    expect(g.lineToCalls).toHaveLength(0);
    expect(g.closePathCalls).toBe(4);
    expect(g.fillCalls).toHaveLength(4);
    chart.destroy();
  });

  it('each arc center matches the computed plot-area center', async () => {
    const container = makeContainer();
    const chart = new PieChart({ container, spec: makeSpec() });
    await chart.init();

    const g = sliceGfx();
    const cx = PLOT_W / 2;
    const cy = PLOT_H / 2;
    for (const a of g.arcCalls) {
      expect(a.cx).toBe(cx);
      expect(a.cy).toBe(cy);
    }
    chart.destroy();
  });

  it('uses the expected outerRadius (min(plotW,plotH)/2 - 8)', async () => {
    const container = makeContainer();
    const chart = new PieChart({ container, spec: makeSpec() });
    await chart.init();

    const g = sliceGfx();
    const expectedR = Math.min(PLOT_W, PLOT_H) / 2 - 8;
    for (const a of g.arcCalls) {
      expect(a.r).toBe(expectedR);
    }
    chart.destroy();
  });

  it('each moveTo lands on the pie center (a pie wedge has its apex at center)', async () => {
    const container = makeContainer();
    const chart = new PieChart({ container, spec: makeSpec() });
    await chart.init();

    const g = sliceGfx();
    const cx = PLOT_W / 2;
    const cy = PLOT_H / 2;
    for (const mt of g.moveToCalls) {
      expect(mt.x).toBe(cx);
      expect(mt.y).toBe(cy);
    }
    chart.destroy();
  });

  it('total angular extent across slices equals 2π (within 1e-9)', async () => {
    const container = makeContainer();
    const chart = new PieChart({ container, spec: makeSpec() });
    await chart.init();

    const g = sliceGfx();
    // Reconstruct each slice's clockwise extent from the recorded arc calls.
    const total = g.arcCalls.reduce((s, a) => {
      const ext = a.end >= a.start ? a.end - a.start : TWO_PI - (a.start - a.end);
      return s + ext;
    }, 0);
    expect(Math.abs(total - TWO_PI)).toBeLessThan(1e-9);
    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Donut path                                                                 *
 * -------------------------------------------------------------------------- */

describe('PieChart — donut path (innerRadius > 0)', () => {
  it('uses two arcs per slice (outer forward + inner reverse) plus two lineTos', async () => {
    const container = makeContainer();
    const chart = new PieChart({
      container,
      spec: makeSpec({ options: { innerRadius: 60 } }),
    });
    await chart.init();

    const g = sliceGfx();
    // 4 slices × 2 arcs = 8 arc calls.
    expect(g.arcCalls).toHaveLength(8);
    // 4 slices × 2 lineTos (out to outer-start, in to inner-end) = 8.
    expect(g.lineToCalls).toHaveLength(8);
    // moveTo to inner-start per slice (NOT to center).
    expect(g.moveToCalls).toHaveLength(4);
    expect(g.closePathCalls).toBe(4);
    expect(g.fillCalls).toHaveLength(4);
    chart.destroy();
  });

  it('moveTo lands on the ring (inner-radius), NOT the center', async () => {
    const container = makeContainer();
    const chart = new PieChart({
      container,
      spec: makeSpec({ options: { innerRadius: 60 } }),
    });
    await chart.init();

    const g = sliceGfx();
    const cx = PLOT_W / 2;
    const cy = PLOT_H / 2;
    for (const mt of g.moveToCalls) {
      const r2 = (mt.x - cx) ** 2 + (mt.y - cy) ** 2;
      expect(Math.sqrt(r2)).toBeCloseTo(60, 6);
    }
    chart.destroy();
  });

  it('the second arc per slice is counterclockwise (the inner one)', async () => {
    const container = makeContainer();
    const chart = new PieChart({
      container,
      spec: makeSpec({ options: { innerRadius: 60 } }),
    });
    await chart.init();

    const g = sliceGfx();
    // The donut path emits arcs as: outer (forward), inner (reverse) — so
    // odd-indexed arc calls are the inner ones with ccw = true.
    g.arcCalls.forEach((a, i) => {
      expect(a.ccw).toBe(i % 2 === 1);
    });
    chart.destroy();
  });

  it('inner radius is clamped to [0, outerRadius - 1]', async () => {
    const container = makeContainer();
    const chart = new PieChart({
      container,
      spec: makeSpec({ options: { innerRadius: 10_000 } }),
    });
    await chart.init();

    const g = sliceGfx();
    const outer = Math.min(PLOT_W, PLOT_H) / 2 - 8;
    // The inner arc (index 1) carries the clamped radius.
    const innerRadii = g.arcCalls.filter((_a, i) => i % 2 === 1).map((a) => a.r);
    for (const r of innerRadii) {
      expect(r).toBeLessThanOrEqual(outer - 1);
      expect(r).toBeGreaterThan(0);
    }
    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Color resolution                                                           *
 * -------------------------------------------------------------------------- */

describe('PieChart — color resolution', () => {
  it('with no color encoding, each slice gets a distinct palette color', async () => {
    const container = makeContainer();
    const chart = new PieChart({ container, spec: makeSpec() });
    await chart.init();

    const g = sliceGfx();
    const colors = g.fillCalls.map((f) => f.color);
    expect(new Set(colors).size).toBe(4);
    chart.destroy();
  });

  it('with categorical color = category, each slice gets a distinct color', async () => {
    const container = makeContainer();
    const chart = new PieChart({
      container,
      spec: makeSpec({
        encoding: {
          x: { field: 'browser', type: 'categorical' },
          value: { field: 'share' },
          color: { field: 'browser', type: 'categorical' },
        },
      }),
    });
    await chart.init();

    const g = sliceGfx();
    const colors = g.fillCalls.map((f) => f.color);
    expect(new Set(colors).size).toBe(4);
    chart.destroy();
  });

  it('with categorical color = a low-cardinality field, slices share colors by group', async () => {
    const container = makeContainer();
    const chart = new PieChart({
      container,
      spec: makeSpec({
        data: [
          { browser: 'Chrome', share: 60, kind: 'chromium' },
          { browser: 'Safari', share: 20, kind: 'webkit' },
          { browser: 'Firefox', share: 10, kind: 'gecko' },
          { browser: 'Edge', share: 10, kind: 'chromium' },
        ],
        encoding: {
          x: { field: 'browser', type: 'categorical' },
          value: { field: 'share' },
          color: { field: 'kind', type: 'categorical' },
        },
      }),
    });
    await chart.init();

    const g = sliceGfx();
    const colors = g.fillCalls.map((f) => f.color);
    // Chrome & Edge → 'chromium' → same color. 3 distinct colors.
    expect(new Set(colors).size).toBe(3);
    expect(colors[0]).toBe(colors[3]);
    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Interaction layer + hit-tester                                             *
 * -------------------------------------------------------------------------- */

describe('PieChart — interaction layer', () => {
  it('creates a Sprite-backed interaction layer sized to the plot area', async () => {
    const container = makeContainer();
    const chart = new PieChart({ container, spec: makeSpec() });
    await chart.init();

    // The interaction sprite is the only Sprite the chart creates.
    expect(MockSpriteCls.sInstances).toHaveLength(1);
    expect(MockSpriteCls.sInstances[0]!.width).toBe(PLOT_W);
    expect(MockSpriteCls.sInstances[0]!.height).toBe(PLOT_H);
    chart.destroy();
  });

  it('with showLegend: false the plot fills the full content rect (no legend column)', async () => {
    const container = makeContainer();
    const chart = new PieChart({
      container,
      spec: makeSpec({ options: { showLegend: false } }),
    });
    await chart.init();
    expect(MockSpriteCls.sInstances).toHaveLength(1);
    expect(MockSpriteCls.sInstances[0]!.width).toBe(PLOT_W_NO_LEGEND);
    expect(MockSpriteCls.sInstances[0]!.height).toBe(PLOT_H);
    chart.destroy();
  });

  it('does NOT create a tooltip when showTooltip: false', async () => {
    const container = makeContainer();
    const chart = new PieChart({
      container,
      spec: makeSpec({ options: { showTooltip: false } }),
    });
    await chart.init();
    expect(container.querySelector('div')).toBeNull();
    chart.destroy();
  });
});

describe('buildPieHitTester', () => {
  // Set up a known 4-quadrant pie (each slice quarter-circle wide):
  // - slice0: 12 o'clock (start = 3π/2) → 3 o'clock (end = 0/2π)
  // - slice1: 3  o'clock → 6 o'clock
  // - slice2: 6  o'clock → 9 o'clock
  // - slice3: 9  o'clock → 12 o'clock
  const cx = 100;
  const cy = 100;
  const innerR = 0;
  const outerR = 50;
  const TWO_PI = Math.PI * 2;
  const mkSlice = (idx: number, start: number, end: number): PieSlice => ({
    category: `s${String(idx)}`,
    value: 25,
    percent: 0.25,
    color: 0xff0000,
    startAngle: ((start % TWO_PI) + TWO_PI) % TWO_PI,
    endAngle: ((end % TWO_PI) + TWO_PI) % TWO_PI,
    datum: { idx },
  });
  const slices: PieSlice[] = [
    mkSlice(0, (3 * Math.PI) / 2, TWO_PI),
    mkSlice(1, 0, Math.PI / 2),
    mkSlice(2, Math.PI / 2, Math.PI),
    mkSlice(3, Math.PI, (3 * Math.PI) / 2),
  ];

  it("returns the 12-o'clock slice for a point just above center", () => {
    const hit = buildPieHitTester(slices, cx, cy, innerR, outerR);
    // 12 o'clock + slight right offset → upper-right wedge → first slice (s0).
    expect(hit({ x: cx + 5, y: cy - 20 })?.category).toBe('s0');
  });

  it("returns the 3-o'clock slice for a point to the right of center", () => {
    const hit = buildPieHitTester(slices, cx, cy, innerR, outerR);
    expect(hit({ x: cx + 20, y: cy + 5 })?.category).toBe('s1');
  });

  it("returns the 6-o'clock slice for a point below center", () => {
    const hit = buildPieHitTester(slices, cx, cy, innerR, outerR);
    expect(hit({ x: cx - 5, y: cy + 20 })?.category).toBe('s2');
  });

  it("returns the 9-o'clock slice for a point to the left of center", () => {
    const hit = buildPieHitTester(slices, cx, cy, innerR, outerR);
    expect(hit({ x: cx - 20, y: cy - 5 })?.category).toBe('s3');
  });

  it('returns null for a point outside the outer radius', () => {
    const hit = buildPieHitTester(slices, cx, cy, innerR, outerR);
    expect(hit({ x: cx + 100, y: cy })).toBeNull();
  });

  it('returns null in the donut hole', () => {
    const hit = buildPieHitTester(slices, cx, cy, 20, outerR);
    expect(hit({ x: cx + 5, y: cy + 5 })).toBeNull();
  });

  it('returns one of the adjacent slices on the angular boundary (no crash)', () => {
    const hit = buildPieHitTester(slices, cx, cy, innerR, outerR);
    // Exactly at 3 o'clock → on the boundary between s0 and s1.
    const result = hit({ x: cx + 10, y: cy });
    expect(result).not.toBeNull();
    expect(['s0', 's1']).toContain(result?.category);
  });

  it("handles a wraparound slice correctly (3 o'clock crossing, where angles wrap 2π → 0)", () => {
    // In our screen-coord convention angles increase clockwise from 3 o'clock,
    // so the angular discontinuity (2π → 0) is at 3 o'clock. A slice spanning
    // 2 o'clock → 3 o'clock → 4 o'clock wraps storage-wise: start ≈ 11π/6,
    // end ≈ π/6.
    const wrap: PieSlice[] = [mkSlice(0, (11 * Math.PI) / 6, Math.PI / 6)];
    const hit = buildPieHitTester(wrap, cx, cy, innerR, outerR);
    // 3 o'clock — inside the wrap.
    expect(hit({ x: cx + 20, y: cy })?.category).toBe('s0');
    // 2:30 — just before the wrap, still inside.
    expect(hit({ x: cx + 18, y: cy - 5 })?.category).toBe('s0');
    // 9 o'clock — well outside the wrap.
    expect(hit({ x: cx - 20, y: cy })).toBeNull();
  });
});

/* -------------------------------------------------------------------------- *
 * Single-slice full-disc case                                                *
 * -------------------------------------------------------------------------- */

describe('PieChart — single-slice full disc', () => {
  it('draws one full-circle slice', async () => {
    const container = makeContainer();
    const chart = new PieChart({
      container,
      spec: makeSpec({
        data: [{ browser: 'Chrome', share: 100 }],
      }),
    });
    await chart.init();

    const g = sliceGfx();
    expect(g.arcCalls).toHaveLength(1);
    expect(g.fillCalls).toHaveLength(1);
    chart.destroy();
  });

  it('hit-test returns the only slice for any in-disc point', () => {
    const single: PieSlice[] = [
      {
        category: 'only',
        value: 1,
        percent: 1,
        color: 0,
        // Single-slice convention: start === end stores a full disc.
        startAngle: 0,
        endAngle: 0,
        datum: {},
      },
    ];
    const hit = buildPieHitTester(single, 100, 100, 0, 50);
    expect(hit({ x: 105, y: 105 })?.category).toBe('only');
    expect(hit({ x: 90, y: 110 })?.category).toBe('only');
    expect(hit({ x: 200, y: 200 })).toBeNull(); // outside ring
  });
});

/* -------------------------------------------------------------------------- *
 * Animation                                                                  *
 * -------------------------------------------------------------------------- */

describe('PieChart — animation', () => {
  it('animation.enter: false draws slices immediately without a tween', async () => {
    const container = makeContainer();
    const chart = new PieChart({ container, spec: makeSpec({ animation: { enter: false } }) });
    await chart.init();
    expect(MockApp.instances[0]!.ticker.add).not.toHaveBeenCalled();
    expect(sliceGfx().arcCalls).toHaveLength(4);
    chart.destroy();
  });

  it('default animation registers a ticker callback', async () => {
    const container = makeContainer();
    const spec: ChartSpec = {
      type: 'pie',
      data: [
        { browser: 'A', share: 1 },
        { browser: 'B', share: 1 },
      ],
      encoding: {
        x: { field: 'browser', type: 'categorical' },
        value: { field: 'share' },
      },
    };
    const chart = new PieChart({ container, spec });
    await chart.init();
    expect(MockApp.instances[0]!.ticker.add).toHaveBeenCalled();
    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Zero-total data                                                            *
 * -------------------------------------------------------------------------- */

describe('PieChart — zero-total data', () => {
  it('warns and renders no slices when every value is zero', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const container = makeContainer();
    const chart = new PieChart({
      container,
      spec: makeSpec({
        data: [
          { browser: 'Chrome', share: 0 },
          { browser: 'Safari', share: 0 },
        ],
      }),
    });
    await chart.init();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/sums to 0/));
    // No graphics with arc calls produced.
    expect(MockGraphicsCls.gInstances.some((g) => g.arcCalls.length > 0)).toBe(false);
    warnSpy.mockRestore();
    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Destroy                                                                    *
 * -------------------------------------------------------------------------- */

describe('PieChart — destroy', () => {
  it('destroys the PIXI app and tooltip; is idempotent', async () => {
    const container = makeContainer();
    const chart = new PieChart({ container, spec: makeSpec() });
    await chart.init();
    expect(container.querySelector('div')).not.toBeNull();

    chart.destroy();
    chart.destroy();

    expect(chart.destroyed).toBe(true);
    expect(MockApp.instances[0]!.destroy).toHaveBeenCalledTimes(1);
    expect(container.querySelector('div')).toBeNull();
  });
});
