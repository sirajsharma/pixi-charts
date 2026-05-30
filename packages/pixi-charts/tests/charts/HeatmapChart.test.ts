import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MockResizeObserver, setMediaMatch } from '../setup.js';

/**
 * Mock pixi.js at the module boundary. happy-dom has no WebGL — every PIXI
 * symbol the chart touches needs a stand-in. Extends the
 * ScatterChart.test.ts shape with:
 *
 * - `BufferImageSource` (the new v8 texture-from-buffer source). Tracks
 *   constructor calls so the resize test can assert the source is built
 *   once per data-change, not per resize. Stores `scaleMode` for the
 *   "crisp cells" assertion.
 * - `Texture` accepts `{ source }` and remembers the source so tests can
 *   reach `texture.source.scaleMode` / `.resource`.
 * - `Sprite` exposes settable `width`/`height` and a `texture` field
 *   (the chart reassigns when the source dims change).
 */
vi.mock('pixi.js', () => {
  class MockBufferImageSource {
    static instances: MockBufferImageSource[] = [];
    resource: Uint8ClampedArray;
    width: number;
    height: number;
    scaleMode: string;
    update = vi.fn();
    destroy = vi.fn();
    constructor(opts: {
      resource: Uint8ClampedArray;
      width: number;
      height: number;
      scaleMode?: string;
    }) {
      this.resource = opts.resource;
      this.width = opts.width;
      this.height = opts.height;
      this.scaleMode = opts.scaleMode ?? 'linear';
      MockBufferImageSource.instances.push(this);
    }
  }

  class MockTexture {
    static EMPTY = { __empty: true };
    static tInstances: MockTexture[] = [];
    source: MockBufferImageSource | null;
    destroy = vi.fn((freeSource?: boolean): void => {
      if (freeSource === true && this.source !== null) this.source.destroy();
    });
    constructor(opts?: { source?: MockBufferImageSource }) {
      this.source = opts?.source ?? null;
      MockTexture.tInstances.push(this);
    }
  }

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
      const r = this.children;
      this.children = [];
      return r;
    });
    destroy = vi.fn((): void => {
      this.destroyed = true;
    });
    constructor() {
      MockContainer.instances.push(this);
    }
  }

  class MockGraphics extends MockContainer {
    static gInstances: MockGraphics[] = [];
    rectCalls: { x: number; y: number; w: number; h: number }[] = [];
    fillCalls: unknown[] = [];
    strokeCalls: { color?: number; width?: number; alpha?: number }[] = [];
    clear = vi.fn((): this => {
      this.rectCalls = [];
      return this;
    });
    moveTo = vi.fn((): this => this);
    lineTo = vi.fn((): this => this);
    stroke = vi.fn((opts: { color?: number; width?: number; alpha?: number }): this => {
      this.strokeCalls.push({ ...opts });
      return this;
    });
    rect = vi.fn((x: number, y: number, w: number, h: number): this => {
      this.rectCalls.push({ x, y, w, h });
      return this;
    });
    circle = vi.fn((): this => this);
    fill = vi.fn((o: unknown): this => {
      this.fillCalls.push(o);
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
    anchor = { set: vi.fn() };
    position = { set: vi.fn() };
    width = 30;
    height = 12;
    destroyed = false;
    destroy = vi.fn((): void => {
      this.destroyed = true;
    });
    constructor(opts: { text: string }) {
      this.text = opts.text;
      MockText.instances.push(this);
    }
  }

  class MockSprite extends MockContainer {
    static sInstances: MockSprite[] = [];
    eventMode = 'none';
    width = 0;
    height = 0;
    scale = { x: 1, y: 1 };
    texture: any;
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
    constructor(t: any) {
      super();
      this.texture = t;
      MockSprite.sInstances.push(this);
    }
  }

  class MockApplication {
    static instances: MockApplication[] = [];
    canvas = document.createElement('canvas');
    stage = new MockContainer();
    renderer = {
      resize: vi.fn((w: number, h: number): void => {
        this.renderer.width = w;
        this.renderer.height = h;
        this.screen.width = w;
        this.screen.height = h;
      }),
      width: 800,
      height: 600,
      resolution: 1,
      generateTexture: vi.fn(() => new MockTexture()),
    };
    screen = { width: 800, height: 600, x: 0, y: 0 };
    ticker = { add: vi.fn(), remove: vi.fn() };
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
    BufferImageSource: MockBufferImageSource,
    Container: MockContainer,
    Graphics: MockGraphics,
    Text: MockText,
    Sprite: MockSprite,
    Texture: MockTexture,
  };
});

import { Application, BufferImageSource, Graphics, Sprite, Text, Texture } from 'pixi.js';

import {
  buildHeatmapHitTester,
  HeatmapChart,
  type HeatmapCell,
} from '../../src/charts/HeatmapChart.js';
import { bandAdapter } from '../../src/core/ScaleAdapter.js';
import type { ChartSpec } from '../../src/spec/ChartSpec.js';
import { scaleBand } from 'd3-scale';

const MockApp = Application as unknown as {
  instances: {
    ticker: { add: ReturnType<typeof vi.fn> };
    destroy: ReturnType<typeof vi.fn>;
    renderer: { width: number; height: number; resolution: number };
  }[];
};
const MockBuf = BufferImageSource as unknown as {
  instances: {
    resource: Uint8ClampedArray;
    width: number;
    height: number;
    scaleMode: string;
    destroy: ReturnType<typeof vi.fn>;
  }[];
};
const MockTex = Texture as unknown as {
  tInstances: { destroy: ReturnType<typeof vi.fn>; source: { scaleMode: string } | null }[];
};
const MockGfx = Graphics as unknown as {
  gInstances: {
    rectCalls: { x: number; y: number; w: number; h: number }[];
    strokeCalls: { color?: number; width?: number; alpha?: number }[];
    alpha?: number;
    position: { x: number; y: number };
    parent: unknown;
  }[];
};
const MockSpr = Sprite as unknown as {
  sInstances: {
    width: number;
    height: number;
    parent: unknown;
    texture: { source?: unknown };
    handlers: Map<string, Set<(e: unknown) => void>>;
  }[];
};

/**
 * The heatmap renders into a `Sprite` whose texture is a buffer-backed
 * `Texture`. `InteractionLayer` also creates a `Sprite`, but it uses
 * `Texture.EMPTY` (the plain `{ __empty: true }` sentinel). Filter on
 * presence of a `.texture.source` to isolate the heatmap's rendering
 * sprite from the hit-test layer's transparent overlay.
 */
function heatmapSprites(): { width: number; height: number; parent: unknown }[] {
  return MockSpr.sInstances.filter((s) => (s.texture as { source?: unknown }).source !== undefined);
}

function makeContainer(width = 800, height = 600): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height });
  el.getBoundingClientRect = (): DOMRect =>
    ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0 }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

/**
 * Realistic, small heatmap fixture: 3 x-categories ('A','B','C') × 2
 * y-categories ('p','q') = 6 cells. Values span 0..50 so the colour
 * scale's [min, max] is visible, and they're distinct enough that hit-
 * testing can be checked unambiguously.
 */
function makeSpec(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    type: 'heatmap',
    data: [
      { x: 'A', y: 'p', count: 5 },
      { x: 'A', y: 'q', count: 10 },
      { x: 'B', y: 'p', count: 20 },
      { x: 'B', y: 'q', count: 30 },
      { x: 'C', y: 'p', count: 40 },
      { x: 'C', y: 'q', count: 50 },
    ],
    encoding: {
      x: { field: 'x', type: 'categorical' },
      y: { field: 'y', type: 'categorical' },
      color: { field: 'count', type: 'quantitative', scheme: 'viridis' },
      value: { field: 'count' },
    },
    animation: { enter: false },
    ...overrides,
  };
}

beforeEach(() => {
  MockApp.instances = [];
  MockBuf.instances = [];
  MockTex.tInstances = [];
  MockSpr.sInstances = [];
  MockGfx.gInstances = [];
});

describe('HeatmapChart — construction', () => {
  it('does not create a PIXI Application or render anything', () => {
    const chart = new HeatmapChart({ container: makeContainer(), spec: makeSpec() });
    expect(MockApp.instances).toHaveLength(0);
    expect(MockBuf.instances).toHaveLength(0);
    expect(heatmapSprites()).toHaveLength(0);
    expect(chart.initialized).toBe(false);
  });
});

describe('HeatmapChart — init + first render', () => {
  it('builds two axes, one BufferImageSource, one Texture, and exactly one Sprite', async () => {
    const chart = new HeatmapChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();

    expect(MockApp.instances).toHaveLength(1);
    // One source for the grid, exactly one sprite stretched across the plot.
    // (InteractionLayer also creates a Sprite for hit-testing; it uses
    // Texture.EMPTY — `heatmapSprites()` filters it out.)
    expect(MockBuf.instances).toHaveLength(1);
    expect(MockTex.tInstances).toHaveLength(1);
    expect(heatmapSprites()).toHaveLength(1);
    chart.destroy();
  });

  it('allocates the pixel buffer at grid resolution (3 x-cats × 2 y-cats × 4 bytes = 24)', async () => {
    const chart = new HeatmapChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();
    const source = MockBuf.instances[0]!;
    expect(source.width).toBe(3);
    expect(source.height).toBe(2);
    expect(source.resource.length).toBe(3 * 2 * 4);
    chart.destroy();
  });

  it('writes RGBA(?, ?, ?, 255) for present cells and (0, 0, 0, 0) for sparse cells', async () => {
    // Drop (B, q) so position (xIdx=1, yIdx=1) is sparse.
    const chart = new HeatmapChart({
      container: makeContainer(),
      spec: makeSpec({
        data: [
          { x: 'A', y: 'p', count: 5 },
          { x: 'A', y: 'q', count: 10 },
          { x: 'B', y: 'p', count: 20 },
          // (B, q) intentionally absent
          { x: 'C', y: 'p', count: 40 },
          { x: 'C', y: 'q', count: 50 },
        ],
      }),
    });
    await chart.init();
    const buf = MockBuf.instances[0]!.resource;
    // Width = 3 x-categories. Present cell at (B, p) → yIdx=0, xIdx=1 →
    // offset = (0*3+1)*4 = 4. Sparse cell at (B, q) → yIdx=1, xIdx=1 →
    // offset = (1*3+1)*4 = 16.
    expect(buf[4 + 3]).toBe(255); // alpha is fully opaque
    expect(buf[16]).toBe(0);
    expect(buf[16 + 1]).toBe(0);
    expect(buf[16 + 2]).toBe(0);
    expect(buf[16 + 3]).toBe(0);
    chart.destroy();
  });

  it("sets the BufferImageSource's scaleMode to 'nearest' so cells stay crisp", async () => {
    const chart = new HeatmapChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();
    expect(MockBuf.instances[0]!.scaleMode).toBe('nearest');
    // The texture also exposes the source — same value reachable that way.
    expect(MockTex.tInstances[0]!.source?.scaleMode).toBe('nearest');
    chart.destroy();
  });

  it('stretches the sprite to the plot-area pixel size (canvas minus margins minus legend column)', async () => {
    const chart = new HeatmapChart({
      container: makeContainer(800, 600),
      spec: makeSpec(),
    });
    await chart.init();
    // resolveMargin defaults: top 24, right 24, bottom 40, left 56.
    // Full content rect: 800 - 56 - 24 = 720 wide × 600 - 24 - 40 = 536 tall.
    // Continuous legend (length 160) + 12px gap reduces plot width by 172 →
    // 720 - 172 = 548. Height is unaffected.
    const sprite = heatmapSprites()[0]!;
    expect(sprite.width).toBe(548);
    expect(sprite.height).toBe(536);
    chart.destroy();
  });

  it('with showLegend: false the sprite fills the full content rect (no legend column)', async () => {
    const chart = new HeatmapChart({
      container: makeContainer(800, 600),
      spec: makeSpec({ options: { showLegend: false } }),
    });
    await chart.init();
    const sprite = heatmapSprites()[0]!;
    expect(sprite.width).toBe(720);
    expect(sprite.height).toBe(536);
    chart.destroy();
  });
});

describe('HeatmapChart — hit-testing', () => {
  // We build the band scales directly so the hit-tester can be exercised
  // without standing up the full chart — same posture as buildScatterHitTester.
  const xCats = ['A', 'B', 'C'];
  const yCats = ['p', 'q'];
  const plotWidth = 300;
  const plotHeight = 200;
  const xAdapter = bandAdapter(scaleBand().domain(xCats).range([0, plotWidth]).padding(0));
  const yAdapter = bandAdapter(scaleBand().domain(yCats).range([0, plotHeight]).padding(0));
  // Build a cellMap with (B, p) sparse.
  const cellMap = new Map<string, Map<string, HeatmapCell>>();
  const addCell = (xCat: string, yCat: string, value: number): void => {
    let row = cellMap.get(xCat);
    if (row === undefined) {
      row = new Map();
      cellMap.set(xCat, row);
    }
    row.set(yCat, {
      xCategory: xCat,
      yCategory: yCat,
      value,
      color: 0x123456,
      datum: { x: xCat, y: yCat, count: value },
    });
  };
  addCell('A', 'p', 1);
  addCell('A', 'q', 2);
  // (B, p) intentionally absent
  addCell('B', 'q', 4);
  addCell('C', 'p', 5);
  addCell('C', 'q', 6);

  const hitTest = buildHeatmapHitTester(xAdapter, yAdapter, cellMap, plotWidth, plotHeight);

  it("returns the cell at a pointer inside that cell's pixel region", () => {
    // Cell (A, p) covers x in [0, 100), y in [0, 100). Pointer (50, 50).
    expect(hitTest({ x: 50, y: 50 })?.datum).toEqual({ x: 'A', y: 'p', count: 1 });
    // Cell (C, q) covers x in [200, 300), y in [100, 200). Pointer (250, 150).
    expect(hitTest({ x: 250, y: 150 })?.datum).toEqual({ x: 'C', y: 'q', count: 6 });
  });

  it('returns null for a sparse cell position (no entry in the map)', () => {
    // (B, p) is sparse → pointer at (150, 50) is inside its band but no cell.
    expect(hitTest({ x: 150, y: 50 })).toBeNull();
  });

  it('returns null when the pointer is outside the plot area', () => {
    expect(hitTest({ x: -1, y: 50 })).toBeNull();
    expect(hitTest({ x: 50, y: -1 })).toBeNull();
    expect(hitTest({ x: plotWidth, y: 50 })).toBeNull();
    expect(hitTest({ x: 50, y: plotHeight })).toBeNull();
  });
});

describe('HeatmapChart — resize', () => {
  it('updates sprite dimensions but does NOT rebuild the texture or BufferImageSource', async () => {
    const container = makeContainer(800, 600);
    const chart = new HeatmapChart({ container, spec: makeSpec() });
    await chart.init();
    expect(MockBuf.instances).toHaveLength(1);
    expect(MockTex.tInstances).toHaveLength(1);
    expect(heatmapSprites()).toHaveLength(1);
    const sprite = heatmapSprites()[0]!;
    const widthBefore = sprite.width;

    // Resize the container: bigger canvas → bigger plot area.
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 1200 });
    MockApp.instances[0]!.renderer.width = 1200;
    const observers = MockResizeObserver.instances;
    observers[observers.length - 1]!.trigger([{}]);

    // No new source, no new texture, no new heatmap sprite — only the
    // sprite's pixel dimensions changed. That's the whole point of
    // texture-from-buffer.
    expect(MockBuf.instances).toHaveLength(1);
    expect(MockTex.tInstances).toHaveLength(1);
    expect(heatmapSprites()).toHaveLength(1);
    expect(heatmapSprites()[0]!.width).toBeGreaterThan(widthBefore);
    chart.destroy();
  });
});

describe('HeatmapChart — destroy', () => {
  it('destroys the texture with freeSource=true (frees GPU memory) and is idempotent', async () => {
    const chart = new HeatmapChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();
    expect(MockTex.tInstances).toHaveLength(1);
    const texture = MockTex.tInstances[0]!;
    const source = MockBuf.instances[0]!;

    chart.destroy();
    chart.destroy(); // second call is a no-op

    expect(chart.destroyed).toBe(true);
    expect(texture.destroy).toHaveBeenCalledWith(true);
    // MockTexture's destroy(true) forwards to source.destroy(); covers the
    // BufferImageSource GPU cleanup path too.
    expect(source.destroy).toHaveBeenCalled();
    expect(MockApp.instances[0]!.destroy).toHaveBeenCalledTimes(1);
  });
});

describe('HeatmapChart — animation', () => {
  it('never registers a ticker callback (heatmaps have no enter animation in v1)', async () => {
    const chart = new HeatmapChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();
    expect(MockApp.instances[0]!.ticker.add).not.toHaveBeenCalled();
    chart.destroy();
  });

  it('honours spec.animation.enter:true the same way (still no animation)', async () => {
    const chart = new HeatmapChart({
      container: makeContainer(),
      spec: makeSpec({ animation: { enter: true } }),
    });
    await chart.init();
    expect(MockApp.instances[0]!.ticker.add).not.toHaveBeenCalled();
    chart.destroy();
  });
});

/* -------------------------------------------------------------------------- *
 * Hover decoration                                                           *
 * -------------------------------------------------------------------------- */

interface PointerEvt {
  button: number;
  client: { x: number; y: number };
  getLocalPosition: (s: unknown) => { x: number; y: number };
}
function makePointerEvent(local: { x: number; y: number }, client = local): PointerEvt {
  return { button: 0, client, getLocalPosition: () => local };
}
function fireOnInteractionSprite(eventName: string, evt: PointerEvt): void {
  const target = MockSpr.sInstances.find((s) => s.handlers.has(eventName));
  if (target === undefined) throw new Error(`no sprite with handler for ${eventName}`);
  for (const h of target.handlers.get(eventName)!) h(evt);
}
/**
 * Find the hover-border Graphics. The heatmap chart creates Graphics only
 * for axes (which never call `rect`) and the hover border (which strokes a
 * rect and has alpha set). The hover border is the only one with `alpha`
 * defined.
 */
function findHoverBorder(): (typeof MockGfx.gInstances)[number] {
  for (let i = MockGfx.gInstances.length - 1; i >= 0; i -= 1) {
    const g = MockGfx.gInstances[i]!;
    if (g.alpha !== undefined) return g;
  }
  throw new Error('hover border Graphics not found');
}

describe('HeatmapChart — hover decoration', () => {
  beforeEach(() => {
    setMediaMatch('(prefers-reduced-motion: reduce)', true);
  });

  // The continuous color legend reduces plot width to ~548. With 3 x-cats
  // and 2 y-cats over plot ~548×536, each cell is ≈ 183 × 268 px.
  // Cell ('A', 'p'): x ∈ [0, 183]. Cell ('C', 'q'): x ∈ [365, 548], y ∈ [268, 536].
  const CELL_AP = { x: 90, y: 130 };
  const CELL_CQ = { x: 450, y: 400 };

  it('creates an invisible hover-border Graphics (alpha 0) after first render', async () => {
    const chart = new HeatmapChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();

    const border = findHoverBorder();
    expect(border.alpha).toBe(0);

    chart.destroy();
  });

  it('on hover-enter, strokes a 2px white border and animates to alpha 1', async () => {
    const chart = new HeatmapChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();

    fireOnInteractionSprite('pointermove', makePointerEvent(CELL_AP));

    const border = findHoverBorder();
    expect(border.alpha).toBe(1);
    const lastStroke = border.strokeCalls[border.strokeCalls.length - 1];
    expect(lastStroke?.color).toBe(0xffffff);
    expect(lastStroke?.width).toBe(2);
    // The rect drawn covers cell 'A','p' starting at (0, 0).
    const lastRect = border.rectCalls[border.rectCalls.length - 1];
    expect(lastRect?.x).toBeCloseTo(0, 0);
    expect(lastRect?.y).toBeCloseTo(0, 0);

    chart.destroy();
  });

  it('on leave, border fades back to alpha 0', async () => {
    const chart = new HeatmapChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();

    fireOnInteractionSprite('pointermove', makePointerEvent(CELL_AP));
    fireOnInteractionSprite('pointerleave', makePointerEvent(CELL_AP));

    const border = findHoverBorder();
    expect(border.alpha).toBe(0);

    chart.destroy();
  });

  it('rapid cell A → C/q change repositions the border to C/q', async () => {
    const chart = new HeatmapChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();

    fireOnInteractionSprite('pointermove', makePointerEvent(CELL_AP));
    fireOnInteractionSprite('pointermove', makePointerEvent(CELL_CQ));

    const border = findHoverBorder();
    const lastRect = border.rectCalls[border.rectCalls.length - 1];
    // Cell ('C', 'q') sits at x ≈ 365, y ≈ 268 (after legend-reduced plot
    // width). New rect should be in the bottom-right of the plot.
    expect(lastRect?.x).toBeGreaterThan(300);
    expect(lastRect?.y).toBeGreaterThan(200);
    expect(border.alpha).toBe(1);

    chart.destroy();
  });

  it('destroy() during hover does not throw', async () => {
    const chart = new HeatmapChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();

    fireOnInteractionSprite('pointermove', makePointerEvent(CELL_AP));
    expect(() => {
      chart.destroy();
    }).not.toThrow();
    expect(chart.destroyed).toBe(true);
  });
});

describe('HeatmapChart — click events', () => {
  const CELL_AP_PX = { x: 90, y: 130 };

  function fireClick(local: { x: number; y: number }): void {
    const evt = makePointerEvent(local);
    fireOnInteractionSprite('pointerdown', evt);
    fireOnInteractionSprite('pointerup', evt);
  }

  it('fires click with the source datum row and its index', async () => {
    const chart = new HeatmapChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();

    const handler = vi.fn();
    chart.on('click', handler);
    fireClick(CELL_AP_PX);

    expect(handler).toHaveBeenCalledTimes(1);
    const payload = handler.mock.calls[0]![0];
    // CELL_AP is the cell at x='A', y='p' → first row in the data.
    expect(payload.datum).toEqual({ x: 'A', y: 'p', count: 5 });
    expect(payload.index).toBe(0);
    expect(payload.position).toEqual(CELL_AP_PX);
    expect(payload.series).toBeUndefined();
    chart.destroy();
  });

  it('drag suppresses click', async () => {
    const chart = new HeatmapChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();

    const handler = vi.fn();
    chart.on('click', handler);
    fireOnInteractionSprite('pointerdown', makePointerEvent(CELL_AP_PX));
    fireOnInteractionSprite('pointermove', makePointerEvent({ x: 200, y: 200 }));
    fireOnInteractionSprite('pointerup', makePointerEvent({ x: 200, y: 200 }));

    expect(handler).not.toHaveBeenCalled();
    chart.destroy();
  });
});

describe('HeatmapChart — long band-axis labels', () => {
  it('truncates long y-category labels when the left margin cap is exceeded', async () => {
    // Force the left (y-band) measurement past the cap: tiny canvas width
    // → cap = canvasW * 0.35 = 42; mock label width is fixed 30; inset = 14
    // → desired = 44 > cap, truncation kicks in.
    const container = makeContainer(120, 300);
    const longY = ['North America Customer Success Org', 'Europe Sales & Marketing'];
    const chart = new HeatmapChart({
      container,
      spec: {
        type: 'heatmap',
        data: longY.flatMap((y) => [
          { x: 'A', y, count: 5 },
          { x: 'B', y, count: 10 },
        ]),
        encoding: {
          x: { field: 'x', type: 'categorical' },
          y: { field: 'y', type: 'categorical' },
          color: { field: 'count', type: 'quantitative' },
          value: { field: 'count' },
        },
        animation: { enter: false },
      },
    });
    await chart.init();

    const MockTxt = Text as unknown as {
      instances: { text: string; destroyed: boolean }[];
    };
    const rendered = MockTxt.instances.filter((t) => !t.destroyed).map((t) => t.text);
    for (const original of longY) {
      expect(rendered).not.toContain(original);
    }
    expect(rendered.some((t) => t.endsWith('…'))).toBe(true);

    chart.destroy();
  });
});
