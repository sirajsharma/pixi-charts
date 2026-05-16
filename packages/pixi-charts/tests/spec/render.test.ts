import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock pixi.js — see LineChart.test.ts for the full pattern. This test
 * exercises the dispatcher end-to-end against the real LineChart.
 */
vi.mock('pixi.js', () => {
  class MockContainer {
    children: any[] = [];
    position = { set: vi.fn(), x: 0, y: 0 };
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
    removeChildren = vi.fn();
    destroy = vi.fn();
  }
  class MockGraphics extends MockContainer {
    clear = vi.fn(() => this);
    moveTo = vi.fn(() => this);
    lineTo = vi.fn(() => this);
    closePath = vi.fn(() => this);
    rect = vi.fn(() => this);
    fill = vi.fn(() => this);
    stroke = vi.fn(() => this);
  }
  class MockText {
    text: string;
    anchor = { set: vi.fn() };
    position = { set: vi.fn() };
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
    on = vi.fn(() => this);
    off = vi.fn(() => this);
    constructor(_t: unknown) {
      super();
    }
  }
  class MockApplication {
    canvas = document.createElement('canvas');
    stage = new MockContainer();
    renderer = { resize: vi.fn(), width: 800, height: 600, resolution: 1 };
    ticker = { add: vi.fn(), remove: vi.fn() };
    init = vi.fn(async (opts?: { width?: number; height?: number }) => {
      if (opts?.width !== undefined) this.renderer.width = opts.width;
      if (opts?.height !== undefined) this.renderer.height = opts.height;
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
    Texture: { EMPTY: {} },
  };
});

import { AreaChart } from '../../src/charts/AreaChart.js';
import { LineChart } from '../../src/charts/LineChart.js';
import type { ChartSpec } from '../../src/spec/ChartSpec.js';
import { render } from '../../src/spec/render.js';
import { ChartSpecValidationError } from '../../src/spec/validate.js';

function makeContainer(width = 800, height = 600): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height });
  el.getBoundingClientRect = (): DOMRect =>
    ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0 }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

const validLineSpec: ChartSpec = {
  type: 'line',
  data: [
    { x: 0, y: 10 },
    { x: 1, y: 20 },
  ],
  encoding: {
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
  },
  animation: { enter: false },
};

beforeEach(() => undefined);

describe('render(spec, container)', () => {
  it('returns a LineChart instance for a valid line spec', async () => {
    const container = makeContainer();
    const chart = await render(validLineSpec, container);
    expect(chart).toBeInstanceOf(LineChart);
    expect(chart.initialized).toBe(true);
    expect(chart.destroyed).toBe(false);
    chart.destroy();
  });

  it('returns a fully-rendered chart (initialized: true)', async () => {
    const container = makeContainer();
    const chart = await render(validLineSpec, container);
    expect(chart.initialized).toBe(true);
    chart.destroy();
  });

  it('returns a fully-rendered AreaChart instance for a valid area spec', async () => {
    const container = makeContainer();
    const chart = await render({ ...validLineSpec, type: 'area' }, container);
    expect(chart).toBeInstanceOf(AreaChart);
    expect(chart.initialized).toBe(true);
    expect(chart.destroyed).toBe(false);
    chart.destroy();
  });

  it('propagates ChartSpecValidationError for invalid input', async () => {
    const container = makeContainer();
    const bad = { ...validLineSpec, data: [] };
    await expect(render(bad, container)).rejects.toBeInstanceOf(ChartSpecValidationError);
  });

  it('throws a useful message for unimplemented chart types', async () => {
    const container = makeContainer();
    const spec: ChartSpec = {
      ...validLineSpec,
      type: 'scatter',
    };
    await expect(render(spec, container)).rejects.toThrow(
      /not implemented yet.*Available: line, area/,
    );
  });
});
