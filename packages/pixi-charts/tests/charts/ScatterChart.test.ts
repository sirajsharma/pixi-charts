import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MockResizeObserver, setMediaMatch } from '../setup.js';

/**
 * Mock pixi.js at the module boundary — happy-dom has no WebGL. Extends the
 * BarChart.test.ts mock shape with: `Graphics.circle`, a tracked
 * generated-texture factory on `renderer.generateTexture` (each texture
 * carries a `destroy` spy so the GPU-leak guarantee is testable), and v8
 * `ParticleContainer`/`Particle`. `Texture` is the tracked texture class
 * itself (with a static `EMPTY` for `InteractionLayer`).
 */
vi.mock('pixi.js', () => {
  class MockTexture {
    static EMPTY = { __empty: true };
    static tInstances: MockTexture[] = [];
    destroy = vi.fn((_freeSource?: boolean): void => undefined);
    constructor() {
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
    circleCalls: { x: number; y: number; r: number }[] = [];
    fillCalls: unknown[] = [];
    clear = vi.fn((): this => this);
    moveTo = vi.fn((): this => this);
    lineTo = vi.fn((): this => this);
    stroke = vi.fn((): this => this);
    rect = vi.fn((x: number, y: number, w: number, h: number): this => {
      this.rectCalls.push({ x, y, w, h });
      return this;
    });
    circle = vi.fn((x: number, y: number, r: number): this => {
      this.circleCalls.push({ x, y, r });
      return this;
    });
    fill = vi.fn((o: unknown): this => {
      this.fillCalls.push(o);
      return this;
    });
    constructor() {
      super();
      MockGraphics.gInstances.push(this);
    }
  }

  class MockParticle {
    static pInstances: MockParticle[] = [];
    texture: unknown;
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    tint: number;
    constructor(opts: any) {
      this.texture = opts.texture;
      this.x = opts.x;
      this.y = opts.y;
      this.scaleX = opts.scaleX;
      this.scaleY = opts.scaleY;
      this.tint = opts.tint;
      MockParticle.pInstances.push(this);
    }
  }

  class MockParticleContainer {
    static pcInstances: MockParticleContainer[] = [];
    particleChildren: MockParticle[] = [];
    alpha = 1;
    options: any;
    parent: MockContainer | null = null;
    destroyed = false;
    addParticle = vi.fn((p: MockParticle): MockParticle => {
      this.particleChildren.push(p);
      return p;
    });
    removeParticles = vi.fn((): MockParticle[] => {
      const r = this.particleChildren;
      this.particleChildren = [];
      return r;
    });
    update = vi.fn();
    destroy = vi.fn((): void => {
      this.destroyed = true;
    });
    constructor(opts: any) {
      this.options = opts;
      MockParticleContainer.pcInstances.push(this);
    }
  }

  class MockText {
    static instances: MockText[] = [];
    text: string;
    anchor = { set: vi.fn() };
    position = { set: vi.fn() };
    width = 30;
    height = 12;
    destroy = vi.fn();
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
    alpha = 1;
    tint = 0xffffff;
    anchor = { set: vi.fn() };
    scale = {
      x: 1,
      y: 1,
      set: vi.fn(function (this: { x: number; y: number }, x: number, y?: number) {
        this.x = x;
        this.y = y ?? x;
      }),
    };
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
    constructor(_t: unknown) {
      super();
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
    Container: MockContainer,
    Graphics: MockGraphics,
    Text: MockText,
    Sprite: MockSprite,
    ParticleContainer: MockParticleContainer,
    Particle: MockParticle,
    Texture: MockTexture,
  };
});

import { Application, Graphics, Particle, ParticleContainer, Sprite, Text, Texture } from 'pixi.js';

import {
  ScatterChart,
  buildScatterHitTester,
  type ScatterRecord,
} from '../../src/charts/ScatterChart.js';
import type { ChartSpec } from '../../src/spec/ChartSpec.js';
import { SpatialIndex } from '../../src/utils/quadtree.js';

const MockApp = Application as unknown as {
  instances: { ticker: { add: ReturnType<typeof vi.fn> }; destroy: ReturnType<typeof vi.fn> }[];
};
const MockPC = ParticleContainer as unknown as {
  pcInstances: {
    particleChildren: { x: number }[];
    alpha: number;
    parent: unknown;
    update: ReturnType<typeof vi.fn>;
  }[];
};
const MockP = Particle as unknown as { pInstances: { tint: number; scaleX: number }[] };
const MockGfx = Graphics as unknown as {
  gInstances: { rectCalls: unknown[]; fillCalls: unknown[] }[];
};
const MockTxt = Text as unknown as { instances: { text: string }[] };
const MockTex = Texture as unknown as { tInstances: { destroy: ReturnType<typeof vi.fn> }[] };
const MockSprite = Sprite as unknown as {
  sInstances: {
    alpha: number;
    tint: number;
    scale: { x: number; y: number; set: (...args: number[]) => void };
    anchor: { set: ReturnType<typeof vi.fn> };
    handlers: Map<string, Set<(e: unknown) => void>>;
    position: { x: number; y: number };
    eventMode: string;
  }[];
};

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
    type: 'scatter',
    data: [
      { gx: 1, gy: 2, grp: 'a', mag: 5, q: 10 },
      { gx: 5, gy: 9, grp: 'b', mag: 20, q: 50 },
      { gx: 9, gy: 4, grp: 'a', mag: 12, q: 30 },
      { gx: 3, gy: 7, grp: 'b', mag: 8, q: 90 },
    ],
    encoding: {
      x: { field: 'gx', type: 'quantitative' },
      y: { field: 'gy', type: 'quantitative' },
    },
    animation: { enter: false },
    ...overrides,
  };
}

beforeEach(() => {
  MockApp.instances = [];
  MockPC.pcInstances = [];
  MockP.pInstances = [];
  MockGfx.gInstances = [];
  MockTxt.instances = [];
  MockTex.tInstances = [];
  MockSprite.sInstances = [];
});

describe('ScatterChart — construction', () => {
  it('does not create a PIXI Application or render anything', () => {
    const chart = new ScatterChart({ container: makeContainer(), spec: makeSpec() });
    expect(MockApp.instances).toHaveLength(0);
    expect(MockPC.pcInstances).toHaveLength(0);
    expect(chart.initialized).toBe(false);
  });
});

describe('ScatterChart — init + first render', () => {
  it('builds axes, one ParticleContainer, one particle per datum, one texture', async () => {
    const chart = new ScatterChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();

    expect(MockApp.instances).toHaveLength(1);
    expect(MockPC.pcInstances).toHaveLength(1);
    expect(MockP.pInstances).toHaveLength(4);
    expect(MockPC.pcInstances[0]!.parent).not.toBeNull();
    expect(MockTex.tInstances).toHaveLength(1);
    expect(MockTxt.instances.length).toBeGreaterThan(0);
    chart.destroy();
  });

  it('drops rows with a non-numeric x or y', async () => {
    const chart = new ScatterChart({
      container: makeContainer(),
      spec: makeSpec({
        data: [
          { gx: 1, gy: 2 },
          { gx: 'nope', gy: 5 },
          { gx: 4, gy: 8 },
        ],
      }),
    });
    await chart.init();
    expect(MockP.pInstances).toHaveLength(2);
    chart.destroy();
  });
});

describe('ScatterChart — color resolution', () => {
  it('no color encoding → every particle one tint', async () => {
    const chart = new ScatterChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();
    expect(new Set(MockP.pInstances.map((p) => p.tint)).size).toBe(1);
    chart.destroy();
  });

  it('categorical color → tint by color-field value', async () => {
    const chart = new ScatterChart({
      container: makeContainer(),
      spec: makeSpec({
        encoding: {
          x: { field: 'gx', type: 'quantitative' },
          y: { field: 'gy', type: 'quantitative' },
          color: { field: 'grp' },
        },
      }),
    });
    await chart.init();
    const tints = MockP.pInstances.map((p) => p.tint);
    expect(new Set(tints).size).toBe(2);
    expect(tints[0]).toBe(tints[2]);
    expect(tints[0]).not.toBe(tints[1]);
    chart.destroy();
  });

  it('soft-warns when categorical color exceeds the 20-value threshold', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const data = Array.from({ length: 25 }, (_, i) => ({ gx: i, gy: i, grp: `g${String(i)}` }));
    const chart = new ScatterChart({
      container: makeContainer(),
      spec: makeSpec({
        data,
        encoding: {
          x: { field: 'gx', type: 'quantitative' },
          y: { field: 'gy', type: 'quantitative' },
          color: { field: 'grp' },
        },
      }),
    });
    await chart.init();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/distinct values, exceeding 20/));
    warn.mockRestore();
    chart.destroy();
  });

  it('quantitative color → distinct sampled tints, no soft-warn, continuous gradient legend', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const chart = new ScatterChart({
      container: makeContainer(),
      spec: makeSpec({
        encoding: {
          x: { field: 'gx', type: 'quantitative' },
          y: { field: 'gy', type: 'quantitative' },
          color: { field: 'q', type: 'quantitative', scheme: 'viridis' },
        },
      }),
    });
    await chart.init();
    // 4 distinct q values → 4 sampled colors (not a 2-entry categorical palette).
    expect(new Set(MockP.pInstances.map((p) => p.tint)).size).toBe(4);
    expect(warn).not.toHaveBeenCalled();
    // The continuous Legend lays down a many-sample gradient (one rect+fill
    // Graphics per sample) — the categorical legend never does that.
    const gradient = MockGfx.gInstances.filter(
      (g) => g.rectCalls.length === 1 && g.fillCalls.length === 1,
    );
    expect(gradient.length).toBeGreaterThanOrEqual(32);
    warn.mockRestore();
    chart.destroy();
  });
});

describe('ScatterChart — size resolution', () => {
  it('no size encoding → all particles the same scale', async () => {
    const chart = new ScatterChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();
    expect(new Set(MockP.pInstances.map((p) => p.scaleX)).size).toBe(1);
    chart.destroy();
  });

  it('size encoding → scale varies and is monotonic in value (sqrt)', async () => {
    const chart = new ScatterChart({
      container: makeContainer(),
      spec: makeSpec({
        data: [
          { gx: 1, gy: 1, mag: 1 },
          { gx: 2, gy: 2, mag: 100 },
          { gx: 3, gy: 3, mag: 25 },
        ],
        encoding: {
          x: { field: 'gx', type: 'quantitative' },
          y: { field: 'gy', type: 'quantitative' },
          size: { field: 'mag' },
        },
      }),
    });
    await chart.init();
    const [s1, s100, s25] = MockP.pInstances.map((p) => p.scaleX);
    expect(s1!).toBeLessThan(s25!);
    expect(s25!).toBeLessThan(s100!);
    chart.destroy();
  });
});

describe('buildScatterHitTester', () => {
  const records: ScatterRecord[] = [
    { x: 10, y: 10, radius: 4, color: 1, datum: { id: 'a' } },
    { x: 90, y: 90, radius: 4, color: 2, datum: { id: 'b' } },
  ];
  const index = new SpatialIndex<ScatterRecord>(records.map((r) => ({ x: r.x, y: r.y, datum: r })));

  it('returns the nearest record within the hit radius', () => {
    expect(buildScatterHitTester(index, 12)({ x: 12, y: 13 })?.datum.id).toBe('a');
  });

  it('returns null when the pointer is farther than the hit radius', () => {
    expect(buildScatterHitTester(index, 12)({ x: 50, y: 50 })).toBeNull();
  });

  it('a larger hit radius catches a point a smaller one would miss', () => {
    expect(buildScatterHitTester(index, 12)({ x: 10, y: 25 })).toBeNull(); // 15 px away
    expect(buildScatterHitTester(index, 20)({ x: 10, y: 25 })?.datum.id).toBe('a');
  });
});

describe('ScatterChart — animation', () => {
  it('animation.enter:false → no ticker callback, particles fully opaque', async () => {
    const chart = new ScatterChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();
    expect(MockApp.instances[0]!.ticker.add).not.toHaveBeenCalled();
    expect(MockPC.pcInstances[0]!.alpha).toBe(1);
    chart.destroy();
  });

  it('default animation registers a ticker callback (fade-in)', async () => {
    const spec: ChartSpec = {
      type: 'scatter',
      data: [
        { gx: 1, gy: 2 },
        { gx: 5, gy: 9 },
      ],
      encoding: {
        x: { field: 'gx', type: 'quantitative' },
        y: { field: 'gy', type: 'quantitative' },
      },
    };
    const chart = new ScatterChart({ container: makeContainer(), spec });
    await chart.init();
    expect(MockApp.instances[0]!.ticker.add).toHaveBeenCalled();
    chart.destroy();
  });
});

describe('ScatterChart — resize', () => {
  it('reuses the SAME ParticleContainer + texture and re-projects positions in place', async () => {
    const container = makeContainer(800, 600);
    const chart = new ScatterChart({ container, spec: makeSpec() });
    await chart.init();
    expect(MockPC.pcInstances).toHaveLength(1);
    expect(MockTex.tInstances).toHaveLength(1);
    const pc = MockPC.pcInstances[0]!;
    const firstXs = pc.particleChildren.map((p) => p.x); // copy of numbers

    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 1200 });
    const observers = MockResizeObserver.instances;
    observers[observers.length - 1]!.trigger([{}]);

    // No new ParticleContainer, no new texture — updated in place.
    expect(MockPC.pcInstances).toHaveLength(1);
    expect(MockTex.tInstances).toHaveLength(1);
    expect(pc.update).toHaveBeenCalled();
    const secondXs = MockPC.pcInstances[0]!.particleChildren.map((p) => p.x);
    expect(secondXs).not.toEqual(firstXs);
    chart.destroy();
  });
});

describe('ScatterChart — destroy', () => {
  it('destroys the generated texture (frees GPU memory) and is idempotent', async () => {
    const chart = new ScatterChart({ container: makeContainer(), spec: makeSpec() });
    await chart.init();
    expect(MockTex.tInstances).toHaveLength(1);
    const texture = MockTex.tInstances[0]!;

    chart.destroy();
    chart.destroy();

    expect(chart.destroyed).toBe(true);
    expect(texture.destroy).toHaveBeenCalledWith(true);
    expect(MockApp.instances[0]!.destroy).toHaveBeenCalledTimes(1);
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
  const target = MockSprite.sInstances.find((s) => s.handlers.has(eventName));
  if (target === undefined) throw new Error(`no sprite with handler for ${eventName}`);
  for (const h of target.handlers.get(eventName)!) h(evt);
}
/** Hover overlay = the non-interaction sprite (eventMode 'none', anchor set). */
function findHoverOverlay(): (typeof MockSprite.sInstances)[number] {
  const found = MockSprite.sInstances.find(
    (s) =>
      s.eventMode === 'none' && (s.anchor.set as ReturnType<typeof vi.fn>).mock.calls.length > 0,
  );
  if (found === undefined) throw new Error('hover overlay sprite not found');
  return found;
}

describe('ScatterChart — hover decoration', () => {
  beforeEach(() => {
    setMediaMatch('(prefers-reduced-motion: reduce)', true);
  });

  // Custom spec: two points (1,1) and (10,10) — extents nice to [0,10] on
  // both axes, so first point maps to (72, 482) (10% inset) and last to
  // (720, 0). The exact pixel projection of these two corners is what we hit.
  function hoverSpec(): ChartSpec {
    return {
      type: 'scatter',
      data: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
      animation: { enter: false },
    };
  }
  // x=0 in [0,10] → 0; y=0 in [0,10] → 536 (bottom).
  const PT_FIRST = { x: 0, y: 536 };
  // x=10 → 720; y=10 → 0.
  const PT_LAST = { x: 720, y: 0 };

  it('creates an invisible overlay sprite (alpha 0, scale 0) after first render', async () => {
    const chart = new ScatterChart({ container: makeContainer(), spec: hoverSpec() });
    await chart.init();

    const overlay = findHoverOverlay();
    expect(overlay.alpha).toBe(0);
    expect(overlay.scale.x).toBe(0);
    expect(overlay.scale.y).toBe(0);

    chart.destroy();
  });

  it('on hover-enter, overlay positions on the hit, tints with point color, scales 1.5×', async () => {
    const chart = new ScatterChart({ container: makeContainer(), spec: hoverSpec() });
    await chart.init();

    fireOnInteractionSprite('pointermove', makePointerEvent(PT_FIRST));

    const overlay = findHoverOverlay();
    expect(overlay.alpha).toBe(1);
    // Default radius 4 → baseScale 4/64 = 0.0625; ×1.5 = 0.09375.
    expect(overlay.scale.x).toBeCloseTo(0.0625 * 1.5, 4);
    expect(overlay.scale.y).toBeCloseTo(0.0625 * 1.5, 4);
    expect(overlay.position.x).toBeCloseTo(0, 0);
    expect(overlay.position.y).toBeCloseTo(536, 0);

    chart.destroy();
  });

  it('on leave, overlay fades back to alpha 0', async () => {
    const chart = new ScatterChart({ container: makeContainer(), spec: hoverSpec() });
    await chart.init();

    fireOnInteractionSprite('pointermove', makePointerEvent(PT_FIRST));
    fireOnInteractionSprite('pointerleave', makePointerEvent(PT_FIRST));

    const overlay = findHoverOverlay();
    expect(overlay.alpha).toBe(0);

    chart.destroy();
  });

  it('rapid first → last point change repositions overlay to last point', async () => {
    const chart = new ScatterChart({ container: makeContainer(), spec: hoverSpec() });
    await chart.init();

    fireOnInteractionSprite('pointermove', makePointerEvent(PT_FIRST));
    fireOnInteractionSprite('pointermove', makePointerEvent(PT_LAST));

    const overlay = findHoverOverlay();
    expect(overlay.position.x).toBeCloseTo(720, 0);
    expect(overlay.position.y).toBeCloseTo(0, 0);
    expect(overlay.alpha).toBe(1);

    chart.destroy();
  });

  it('destroy() during hover does not throw', async () => {
    const chart = new ScatterChart({ container: makeContainer(), spec: hoverSpec() });
    await chart.init();

    fireOnInteractionSprite('pointermove', makePointerEvent(PT_FIRST));
    expect(() => {
      chart.destroy();
    }).not.toThrow();
    expect(chart.destroyed).toBe(true);
  });
});

describe('ScatterChart — click events', () => {
  function clickSpec(): ChartSpec {
    return {
      type: 'scatter',
      data: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
      animation: { enter: false },
    };
  }

  function fireClick(local: { x: number; y: number }): void {
    const evt = makePointerEvent(local);
    fireOnInteractionSprite('pointerdown', evt);
    fireOnInteractionSprite('pointerup', evt);
  }

  it('fires click with the source datum and correct index', async () => {
    const chart = new ScatterChart({ container: makeContainer(), spec: clickSpec() });
    await chart.init();

    const handler = vi.fn();
    chart.on('click', handler);
    fireClick({ x: 0, y: 536 });

    expect(handler).toHaveBeenCalledTimes(1);
    const payload = handler.mock.calls[0]![0];
    expect(payload.datum).toEqual({ x: 0, y: 0 });
    expect(payload.index).toBe(0);
    expect(payload.position).toEqual({ x: 0, y: 536 });
    expect(payload.series).toBeUndefined();
    chart.destroy();
  });

  it('drag does NOT fire click', async () => {
    const chart = new ScatterChart({ container: makeContainer(), spec: clickSpec() });
    await chart.init();

    const handler = vi.fn();
    chart.on('click', handler);
    fireOnInteractionSprite('pointerdown', makePointerEvent({ x: 0, y: 536 }));
    fireOnInteractionSprite('pointermove', makePointerEvent({ x: 100, y: 436 }));
    fireOnInteractionSprite('pointerup', makePointerEvent({ x: 100, y: 436 }));

    expect(handler).not.toHaveBeenCalled();
    chart.destroy();
  });
});
