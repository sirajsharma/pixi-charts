import { describe, expect, it, vi } from 'vitest';

/**
 * Mock pixi.js at the module boundary. happy-dom has no WebGL — every PIXI
 * symbol the library touches needs a stand-in. This mock unions the shapes
 * across all six chart types:
 *
 *  - `Application` / `Container` / `Graphics` / `Text` / `Sprite` — every chart
 *  - `Particle` + `ParticleContainer` — ScatterChart
 *  - `BufferImageSource` + `Texture` accepting `{ source }` — HeatmapChart
 *
 * Adapted from `packages/pixi-charts/tests/charts/HeatmapChart.test.ts` and
 * `packages/pixi-charts/tests/charts/ScatterChart.test.ts`. The point of
 * this file is *example-spec regression coverage*, not unit-level call
 * tracking, so the mocks are lean — just enough surface for the chart
 * lifecycle to complete.
 */
vi.mock('pixi.js', () => {
  class MockBufferImageSource {
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
    }
  }

  class MockTexture {
    static EMPTY = { __empty: true };
    source: MockBufferImageSource | null;
    destroy = vi.fn();
    constructor(opts?: { source?: MockBufferImageSource }) {
      this.source = opts?.source ?? null;
    }
  }

  class MockContainer {
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
  }

  class MockGraphics extends MockContainer {
    clear = vi.fn((): this => this);
    moveTo = vi.fn((): this => this);
    lineTo = vi.fn((): this => this);
    arc = vi.fn((): this => this);
    closePath = vi.fn((): this => this);
    rect = vi.fn((): this => this);
    circle = vi.fn((): this => this);
    stroke = vi.fn((): this => this);
    fill = vi.fn((): this => this);
  }

  class MockText {
    text: string;
    style: Record<string, unknown> = {};
    anchor = { set: vi.fn() };
    position = {
      x: 0,
      y: 0,
      set: vi.fn(function (this: { x: number; y: number }, x: number, y: number) {
        this.x = x;
        this.y = y;
      }),
    };
    width = 30;
    height = 12;
    destroyed = false;
    destroy = vi.fn((): void => {
      this.destroyed = true;
    });
    constructor(opts: { text: string }) {
      this.text = opts.text;
    }
  }

  class MockSprite extends MockContainer {
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
    constructor(t?: any) {
      super();
      this.texture = t;
    }
  }

  class MockParticle {
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
    }
  }

  class MockParticleContainer {
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
    }
  }

  class MockApplication {
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
  }

  return {
    Application: MockApplication,
    Container: MockContainer,
    Graphics: MockGraphics,
    Text: MockText,
    Sprite: MockSprite,
    Particle: MockParticle,
    ParticleContainer: MockParticleContainer,
    Texture: MockTexture,
    BufferImageSource: MockBufferImageSource,
  };
});

import { render, validateChartSpec, type ChartSpec } from 'pixi-charts';

import { areaMultiSpec } from '../src/examples/area-multi';
import { areaSingleSpec } from '../src/examples/area-single';
import { barHorizontalSpec } from '../src/examples/bar-horizontal';
import { barVerticalSpec } from '../src/examples/bar-vertical';
import { donutSpec } from '../src/examples/donut';
import { gettingStartedBarSpec } from '../src/examples/getting-started-bar';
import { gettingStartedSpec } from '../src/examples/getting-started-spec';
import { heatmapDenseSpec } from '../src/examples/heatmap-dense';
import { heatmapSparseSpec } from '../src/examples/heatmap-sparse';
import { makeHeroSpec } from '../src/examples/hero-spec';
import { lineMultiSpec } from '../src/examples/line-multi';
import { lineSingleSpec } from '../src/examples/line-single';
import { pieSpec } from '../src/examples/pie';
import { scatterCategoricalSpec } from '../src/examples/scatter-categorical';
import { scatterContinuousSpec } from '../src/examples/scatter-continuous';

/**
 * Make a happy-dom element that reports a non-zero size. The chart's first
 * render path reads `clientWidth`/`clientHeight` to choose the canvas
 * dimensions; happy-dom returns 0 by default, which downstream math (axis
 * scales) treats as a degenerate plot. Stubbing 800×600 mirrors the
 * library's own test harness.
 */
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
 * Every spec the docs site renders, paired with the human-readable name
 * shown in failing-test output. Adding a new example to the docs means
 * adding one line here.
 *
 * The hero spec is a factory — invoked with a small `pointCount` so the
 * test doesn't generate the full 30k spiral every run. The shape and types
 * are identical to the production export.
 */
const SPECS: readonly (readonly [string, ChartSpec])[] = [
  ['gettingStartedSpec', gettingStartedSpec],
  ['gettingStartedBarSpec', gettingStartedBarSpec],
  ['lineSingleSpec', lineSingleSpec],
  ['lineMultiSpec', lineMultiSpec],
  ['areaSingleSpec', areaSingleSpec],
  ['areaMultiSpec', areaMultiSpec],
  ['barVerticalSpec', barVerticalSpec],
  ['barHorizontalSpec', barHorizontalSpec],
  ['scatterCategoricalSpec', scatterCategoricalSpec],
  ['scatterContinuousSpec', scatterContinuousSpec],
  ['heatmapDenseSpec', heatmapDenseSpec],
  ['heatmapSparseSpec', heatmapSparseSpec],
  ['pieSpec', pieSpec],
  ['donutSpec', donutSpec],
  ['makeHeroSpec(500)', makeHeroSpec(500)],
];

describe('docs example specs', () => {
  for (const [name, spec] of SPECS) {
    describe(name, () => {
      it('passes validateChartSpec', () => {
        expect(() => validateChartSpec(spec)).not.toThrow();
      });

      it('renders against the real library without throwing', async () => {
        const container = makeContainer();
        const chart = await render(spec, container);
        try {
          expect(chart.initialized).toBe(true);
          expect(chart.destroyed).toBe(false);
        } finally {
          chart.destroy();
          container.remove();
        }
      });
    });
  }
});
