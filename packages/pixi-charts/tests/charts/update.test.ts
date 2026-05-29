import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Cross-chart contract tests for the `chart.update(newData, options?)`
 * public API on the `Chart` base class. Per-chart tests (e.g.
 * `tests/charts/BarChart.test.ts`) cover chart-specific update behaviour;
 * this file covers the behaviour that should be identical across every
 * chart type:
 *
 * - `update()` before `init()` throws with the documented message.
 * - `update()` after `destroy()` is a silent no-op.
 * - `update()` preserves the PIXI Application identity (the warm-path
 *   guarantee — no GL re-init).
 * - `update()` swaps the data without throwing on any chart type.
 *
 * Mocks pixi.js with a permissive stub shape compatible with every chart
 * in the library — extends `tests/spec/render.test.ts`'s mock with the
 * extra primitives Scatter / Heatmap need (Particle, ParticleContainer,
 * BufferImageSource, Texture as a constructible class).
 */
vi.mock('pixi.js', () => {
  class MockContainer {
    children: any[] = [];
    position = { set: vi.fn(), x: 0, y: 0 };
    parent: MockContainer | null = null;
    alpha = 1;
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
    removeChildren = vi.fn();
    destroy = vi.fn();
  }
  class MockGraphics extends MockContainer {
    clear = vi.fn(() => this);
    moveTo = vi.fn(() => this);
    lineTo = vi.fn(() => this);
    arc = vi.fn(() => this);
    closePath = vi.fn(() => this);
    rect = vi.fn(() => this);
    circle = vi.fn(() => this);
    fill = vi.fn(() => this);
    stroke = vi.fn(() => this);
  }
  class MockText {
    text: string;
    anchor = { set: vi.fn() };
    position = { set: vi.fn() };
    rotation = 0;
    width = 30;
    height = 12;
    destroy = vi.fn();
    constructor(opts: { text: string }) {
      this.text = opts.text;
    }
  }
  class MockSprite extends MockContainer {
    eventMode = 'none';
    width = 0;
    height = 0;
    anchor = { set: vi.fn() };
    scale = { x: 1, y: 1, set: vi.fn() };
    tint = 0;
    texture: unknown;
    on = vi.fn(() => this);
    off = vi.fn(() => this);
    constructor(t: unknown) {
      super();
      this.texture = t;
    }
  }
  class MockParticle {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    tint: number;
    constructor(opts: { x?: number; y?: number; scaleX?: number; scaleY?: number; tint?: number }) {
      this.x = opts.x ?? 0;
      this.y = opts.y ?? 0;
      this.scaleX = opts.scaleX ?? 1;
      this.scaleY = opts.scaleY ?? 1;
      this.tint = opts.tint ?? 0xffffff;
    }
  }
  class MockParticleContainer extends MockContainer {
    particleChildren: MockParticle[] = [];
    addParticle = vi.fn((p: MockParticle): void => {
      this.particleChildren.push(p);
    });
    removeParticles = vi.fn((): void => {
      this.particleChildren = [];
    });
    update = vi.fn();
    constructor(_opts: unknown) {
      super();
    }
  }
  class MockBufferImageSource {
    width: number;
    height: number;
    resource: Uint8ClampedArray;
    update = vi.fn();
    destroy = vi.fn();
    constructor(opts: { resource: Uint8ClampedArray; width: number; height: number }) {
      this.resource = opts.resource;
      this.width = opts.width;
      this.height = opts.height;
    }
  }
  class MockTexture {
    static EMPTY = {};
    source: unknown;
    destroy = vi.fn();
    constructor(opts: { source: unknown }) {
      this.source = opts.source;
    }
  }
  class MockApplication {
    canvas = document.createElement('canvas');
    stage = new MockContainer();
    renderer = {
      resize: vi.fn(),
      width: 800,
      height: 600,
      resolution: 1,
      generateTexture: vi.fn((): MockTexture => new MockTexture({ source: {} })),
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
    BufferImageSource: MockBufferImageSource,
    Texture: MockTexture,
  };
});

import { AreaChart } from '../../src/charts/AreaChart.js';
import { BarChart } from '../../src/charts/BarChart.js';
import { HeatmapChart } from '../../src/charts/HeatmapChart.js';
import { LineChart } from '../../src/charts/LineChart.js';
import { PieChart } from '../../src/charts/PieChart.js';
import { ScatterChart } from '../../src/charts/ScatterChart.js';
import type { Chart } from '../../src/core/Chart.js';
import type { ChartSpec } from '../../src/spec/ChartSpec.js';

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
 * Per-chart-type fixture: a constructor we can call with `{ container, spec }`,
 * a starting spec, and a `newData` array with the same shape that the
 * `update()` calls will pass.
 */
interface ChartCase {
  name: string;
  ctor: new (opts: { container: HTMLElement; spec: ChartSpec }) => Chart;
  spec: ChartSpec;
  newData: readonly Record<string, unknown>[];
}

const cartesianData = [
  { x: 0, y: 10 },
  { x: 1, y: 20 },
  { x: 2, y: 15 },
];
const cartesianNewData = [
  { x: 0, y: 50 },
  { x: 1, y: 80 },
  { x: 2, y: 65 },
  { x: 3, y: 90 },
];
const cartesianEncoding = {
  x: { field: 'x', type: 'quantitative' as const },
  y: { field: 'y', type: 'quantitative' as const },
};
const noEnter = { enter: false as const };

const cases: ChartCase[] = [
  {
    name: 'LineChart',
    ctor: LineChart,
    spec: { type: 'line', data: cartesianData, encoding: cartesianEncoding, animation: noEnter },
    newData: cartesianNewData,
  },
  {
    name: 'AreaChart',
    ctor: AreaChart,
    spec: { type: 'area', data: cartesianData, encoding: cartesianEncoding, animation: noEnter },
    newData: cartesianNewData,
  },
  {
    name: 'BarChart',
    ctor: BarChart,
    spec: {
      type: 'bar',
      data: [
        { name: 'A', count: 10 },
        { name: 'B', count: 20 },
        { name: 'C', count: 15 },
      ],
      encoding: {
        x: { field: 'name', type: 'categorical' },
        y: { field: 'count', type: 'quantitative' },
      },
      animation: noEnter,
    },
    newData: [
      { name: 'A', count: 60 },
      { name: 'B', count: 80 },
      { name: 'C', count: 45 },
    ],
  },
  {
    name: 'PieChart',
    ctor: PieChart,
    spec: {
      type: 'pie',
      data: [
        { browser: 'Chrome', share: 60 },
        { browser: 'Safari', share: 30 },
        { browser: 'Firefox', share: 10 },
      ],
      encoding: {
        x: { field: 'browser', type: 'categorical' },
        value: { field: 'share' },
      },
      animation: noEnter,
    },
    newData: [
      { browser: 'Chrome', share: 50 },
      { browser: 'Safari', share: 40 },
      { browser: 'Firefox', share: 10 },
    ],
  },
  {
    name: 'ScatterChart',
    ctor: ScatterChart,
    spec: {
      type: 'scatter',
      data: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
      ],
      encoding: cartesianEncoding,
      animation: noEnter,
    },
    newData: [
      { x: 2, y: 3 },
      { x: 4, y: 5 },
      { x: 6, y: 7 },
      { x: 8, y: 9 },
    ],
  },
  {
    name: 'HeatmapChart',
    ctor: HeatmapChart,
    spec: {
      type: 'heatmap',
      data: [
        { day: 'Mon', hour: '00', count: 1 },
        { day: 'Mon', hour: '01', count: 2 },
        { day: 'Tue', hour: '00', count: 3 },
        { day: 'Tue', hour: '01', count: 4 },
      ],
      encoding: {
        x: { field: 'hour', type: 'categorical' },
        y: { field: 'day', type: 'categorical' },
        value: { field: 'count' },
        color: { field: 'count', type: 'quantitative' },
      },
      animation: noEnter,
    },
    newData: [
      { day: 'Mon', hour: '00', count: 9 },
      { day: 'Mon', hour: '01', count: 7 },
      { day: 'Tue', hour: '00', count: 5 },
      { day: 'Tue', hour: '01', count: 3 },
    ],
  },
];

beforeEach(() => undefined);

describe.each(cases)('Chart.update — $name', ({ ctor, spec, newData }) => {
  it('throws when called before init() has resolved', () => {
    const container = makeContainer();
    const chart = new ctor({ container, spec });
    expect(() => chart.update(newData)).toThrow(/before init/);
  });

  it('is a silent no-op after destroy() — does not throw', async () => {
    const container = makeContainer();
    const chart = new ctor({ container, spec });
    await chart.init();
    chart.destroy();
    expect(() => chart.update(newData)).not.toThrow();
  });

  it('preserves the PIXI Application instance across update()', async () => {
    const container = makeContainer();
    const chart = new ctor({ container, spec });
    await chart.init();
    // Access the protected `app` via a cast — this is the warm-path
    // invariant the test is documenting.
    const appBefore = (chart as unknown as { app: unknown }).app;
    expect(appBefore).not.toBeNull();

    chart.update(newData);

    const appAfter = (chart as unknown as { app: unknown }).app;
    expect(appAfter).toBe(appBefore);
    chart.destroy();
  });

  it('completes update() without throwing', async () => {
    const container = makeContainer();
    const chart = new ctor({ container, spec });
    await chart.init();
    expect(() => chart.update(newData)).not.toThrow();
    chart.destroy();
  });
});
