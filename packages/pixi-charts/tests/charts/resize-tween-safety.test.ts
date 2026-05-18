import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MockResizeObserver } from '../setup.js';

/**
 * Regression coverage for the resize-during-enter-animation crash.
 *
 * **The bug.** Every chart's `render()` tore down its plot container (and the
 * Graphics / ParticleContainer inside it) but did NOT cancel the enter tween
 * the *previous* `render()` had started. In a real browser the
 * `ResizeObserver` fires an initial callback immediately after `observe()`,
 * so `render()` re-enters while the fade/draw-on tween is still live; the
 * tween's next tick then mutates a freed Graphics / particle buffer and
 * PixiJS throws.
 *
 * **Why no existing test caught it.** `tests/setup.ts`'s `MockResizeObserver`
 * never auto-fires — it only runs its callback when a test calls `.trigger()`,
 * and no existing test pairs a `.trigger()` with a still-running enter tween.
 * The mocked ticker is also inert (`add` is a no-op), so the tween never
 * advances on its own. This file closes that gap by asserting the structural
 * invariant the fix guarantees: **a `render()` pass cancels the prior pass's
 * in-flight tween** (`tween()` removes its ticker listener on cancel — see
 * `core/animation.ts`), and a resize mid-enter does not throw.
 *
 * The fix is one line at the top of each chart's `render()`:
 * `this.cancelAllTweens()`.
 */
vi.mock('pixi.js', () => {
  class MockTexture {
    static EMPTY = { __empty: true };
    static tInstances: MockTexture[] = [];
    destroy = vi.fn();
    constructor() {
      MockTexture.tInstances.push(this);
    }
  }
  class MockContainer {
    children: any[] = [];
    position = { set: vi.fn(), x: 0, y: 0 };
    parent: MockContainer | null = null;
    destroyed = false;
    addChild = vi.fn((c: any): any => {
      this.children.push(c);
      if (c && typeof c === 'object') c.parent = this;
      return c;
    });
    removeChild = vi.fn((c: any): any => {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      return c;
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
    closePath = vi.fn((): this => this);
    rect = vi.fn((): this => this);
    circle = vi.fn((): this => this);
    fill = vi.fn((): this => this);
    stroke = vi.fn((): this => this);
  }
  class MockParticle {
    x = 0;
    y = 0;
    scaleX = 1;
    scaleY = 1;
    tint = 0;
  }
  class MockParticleContainer {
    particleChildren: MockParticle[] = [];
    alpha = 1;
    parent: MockContainer | null = null;
    addParticle = vi.fn((p: MockParticle) => {
      this.particleChildren.push(p);
      return p;
    });
    removeParticles = vi.fn(() => {
      const r = this.particleChildren;
      this.particleChildren = [];
      return r;
    });
    update = vi.fn();
    destroy = vi.fn();
  }
  class MockText {
    text: string;
    anchor = { set: vi.fn() };
    position = { set: vi.fn() };
    width = 30;
    height = 12;
    destroy = vi.fn();
    constructor(o: { text: string }) {
      this.text = o.text;
    }
  }
  class MockSprite extends MockContainer {
    eventMode = 'none';
    width = 0;
    height = 0;
    on = vi.fn((): this => this);
    off = vi.fn((): this => this);
    constructor(_t: unknown) {
      super();
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
      }),
      width: 800,
      height: 600,
      resolution: 1,
      generateTexture: vi.fn(() => new MockTexture()),
    };
    ticker = { add: vi.fn(), remove: vi.fn() };
    init = vi.fn(async (o?: { width?: number; height?: number }): Promise<void> => {
      if (o?.width !== undefined) this.renderer.width = o.width;
      if (o?.height !== undefined) this.renderer.height = o.height;
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

import { Application } from 'pixi.js';

import { AreaChart } from '../../src/charts/AreaChart.js';
import { BarChart } from '../../src/charts/BarChart.js';
import { LineChart } from '../../src/charts/LineChart.js';
import { ScatterChart } from '../../src/charts/ScatterChart.js';
import type { ChartSpec } from '../../src/spec/ChartSpec.js';

const MockApp = Application as unknown as {
  instances: { ticker: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> } }[];
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

const lineLike = (type: 'line' | 'area'): ChartSpec => ({
  type,
  data: [
    { date: '2024-01-01', v: 10 },
    { date: '2024-02-01', v: 30 },
    { date: '2024-03-01', v: 20 },
  ],
  encoding: { x: { field: 'date', type: 'temporal' }, y: { field: 'v', type: 'quantitative' } },
  // animation deliberately left at its default (enabled) so an enter tween is live.
});
const barSpec: ChartSpec = {
  type: 'bar',
  data: [
    { name: 'A', c: 10 },
    { name: 'B', c: 30 },
  ],
  encoding: { x: { field: 'name', type: 'categorical' }, y: { field: 'c', type: 'quantitative' } },
};
const scatterSpec: ChartSpec = {
  type: 'scatter',
  data: [
    { x: 1, y: 2 },
    { x: 5, y: 9 },
    { x: 3, y: 4 },
  ],
  encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } },
};

const cases: [string, () => { init(): Promise<void>; destroy(): void; destroyed: boolean }][] = [
  ['LineChart', () => new LineChart({ container: makeContainer(), spec: lineLike('line') })],
  ['AreaChart', () => new AreaChart({ container: makeContainer(), spec: lineLike('area') })],
  ['BarChart', () => new BarChart({ container: makeContainer(), spec: barSpec })],
  ['ScatterChart', () => new ScatterChart({ container: makeContainer(), spec: scatterSpec })],
];

beforeEach(() => {
  MockApp.instances = [];
  MockResizeObserver.instances = [];
});

describe('resize during the enter animation does not crash', () => {
  for (const [name, make] of cases) {
    it(`${name}: a resize mid enter-tween cancels it (no stale-target draw)`, async () => {
      const chart = make();
      await chart.init();

      const app = MockApp.instances[0]!;
      // First render started the enter tween → ticker listener added.
      expect(app.ticker.add).toHaveBeenCalled();
      expect(app.ticker.remove).not.toHaveBeenCalled();

      // A resize re-enters render() while that tween is still live. The fix
      // (cancelAllTweens() at the top of render()) must remove the tween's
      // ticker listener BEFORE its targets are torn down — and not throw.
      const observers = MockResizeObserver.instances;
      const obs = observers[observers.length - 1]!;
      expect(() => obs.trigger([{}])).not.toThrow();

      expect(app.ticker.remove).toHaveBeenCalled();
      expect(chart.destroyed).toBe(false);

      chart.destroy();
    });
  }
});
