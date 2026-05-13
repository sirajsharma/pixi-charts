import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MockResizeObserver } from '../setup.js';

/**
 * Mock the entire `pixi.js` module before importing anything that uses it.
 * happy-dom has no WebGL — a real PIXI Application would fail to init.
 *
 * The mocked Application records constructor calls and exposes `init`,
 * `renderer.resize`, and `destroy` spies so the Chart's lifecycle can be
 * verified without GPU.
 */
vi.mock('pixi.js', () => {
  class MockApplication {
    static instances: MockApplication[] = [];

    canvas: HTMLCanvasElement = document.createElement('canvas');
    renderer = {
      resize: vi.fn((_w: number, _h: number) => undefined),
    };
    init = vi.fn(async (_opts?: unknown): Promise<void> => {
      // Intentionally async to mirror PIXI v8's contract.
      await Promise.resolve();
    });
    destroy = vi.fn();

    constructor() {
      MockApplication.instances.push(this);
    }
  }

  return { Application: MockApplication };
});

import { Application } from 'pixi.js';
import { Chart } from '../../src/core/Chart.js';

type MockApplication = InstanceType<typeof Application> & {
  init: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  renderer: { resize: ReturnType<typeof vi.fn> };
  canvas: HTMLCanvasElement;
};

const MockApp = Application as unknown as { instances: MockApplication[] };

/**
 * Concrete subclass for testing — records every call to `render()`.
 */
class TestChart extends Chart {
  renderCalls = 0;
  protected render(): void {
    this.renderCalls += 1;
  }

  // Expose the protected `addTween` to tests.
  public _addTween(cancel: () => void): void {
    this.addTween(cancel);
  }
}

function makeContainer(width = 800, height = 600): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height });
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  MockApp.instances = [];
});

describe('Chart — construction', () => {
  it('does not create a PIXI Application or call render', () => {
    const container = makeContainer();
    const chart = new TestChart({ container });
    expect(MockApp.instances).toHaveLength(0);
    expect(chart.renderCalls).toBe(0);
    expect(chart.initialized).toBe(false);
    expect(chart.destroyed).toBe(false);
  });
});

describe('Chart — init()', () => {
  it('creates one Application, awaits init, appends canvas, observes container', async () => {
    const container = makeContainer(640, 480);
    const chart = new TestChart({ container });

    await chart.init();

    expect(MockApp.instances).toHaveLength(1);
    const app = MockApp.instances[0]!;
    expect(app.init).toHaveBeenCalledTimes(1);
    expect(container.contains(app.canvas)).toBe(true);

    expect(MockResizeObserver.instances).toHaveLength(1);
    const ro = MockResizeObserver.instances[0]!;
    expect(ro.observed).toContain(container);

    expect(chart.initialized).toBe(true);
  });

  it('uses container clientWidth/clientHeight when no explicit dimensions are given', async () => {
    const container = makeContainer(321, 123);
    const chart = new TestChart({ container });
    await chart.init();

    const app = MockApp.instances[0]!;
    expect(app.init).toHaveBeenCalledWith(expect.objectContaining({ width: 321, height: 123 }));
  });

  it('uses explicit dimensions when provided', async () => {
    const container = makeContainer();
    const chart = new TestChart({ container, width: 500, height: 400 });
    await chart.init();

    const app = MockApp.instances[0]!;
    expect(app.init).toHaveBeenCalledWith(expect.objectContaining({ width: 500, height: 400 }));
  });

  it('is a no-op when called twice', async () => {
    const container = makeContainer();
    const chart = new TestChart({ container });
    await chart.init();
    await chart.init();
    expect(MockApp.instances).toHaveLength(1);
  });
});

describe('Chart — resize', () => {
  it('forwards a container size change to the renderer and re-renders', async () => {
    const container = makeContainer(800, 600);
    const chart = new TestChart({ container });
    await chart.init();

    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 1024 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 768 });

    const beforeRenders = chart.renderCalls;
    MockResizeObserver.instances[0]!.trigger([
      { contentRect: { width: 1024, height: 768 } as DOMRectReadOnly } as ResizeObserverEntry,
    ]);

    const app = MockApp.instances[0]!;
    expect(app.renderer.resize).toHaveBeenCalledWith(1024, 768);
    expect(chart.renderCalls).toBe(beforeRenders + 1);
  });

  it('ignores resize callbacks when width or height is 0', async () => {
    const container = makeContainer(800, 600);
    const chart = new TestChart({ container });
    await chart.init();

    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 0 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 0 });

    MockResizeObserver.instances[0]!.trigger([]);
    const app = MockApp.instances[0]!;
    expect(app.renderer.resize).not.toHaveBeenCalled();
    expect(chart.renderCalls).toBe(0);
  });
});

describe('Chart — addTween / cancelAllTweens', () => {
  it('cancels tracked tweens on destroy', async () => {
    const container = makeContainer();
    const chart = new TestChart({ container });
    await chart.init();

    const cancel1 = vi.fn();
    const cancel2 = vi.fn();
    chart._addTween(cancel1);
    chart._addTween(cancel2);

    chart.destroy();

    expect(cancel1).toHaveBeenCalledTimes(1);
    expect(cancel2).toHaveBeenCalledTimes(1);
  });

  it('addTween after destroy invokes the cancel synchronously and does not retain it', async () => {
    const container = makeContainer();
    const chart = new TestChart({ container });
    await chart.init();
    chart.destroy();

    const cancel = vi.fn();
    chart._addTween(cancel);
    expect(cancel).toHaveBeenCalledTimes(1);

    // A second destroy must NOT call the same cancel again.
    chart.destroy();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

describe('Chart — destroy()', () => {
  it('disconnects the observer, destroys the app with removeView: true, and flips destroyed', async () => {
    const container = makeContainer();
    const chart = new TestChart({ container });
    await chart.init();

    const app = MockApp.instances[0]!;
    const ro = MockResizeObserver.instances[0]!;

    chart.destroy();

    expect(ro.disconnect).toHaveBeenCalledTimes(1);
    expect(app.destroy).toHaveBeenCalledTimes(1);
    expect(app.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ removeView: true }),
      expect.objectContaining({ children: true }),
    );
    expect(chart.destroyed).toBe(true);
  });

  it('is idempotent — second call is a no-op', async () => {
    const container = makeContainer();
    const chart = new TestChart({ container });
    await chart.init();

    chart.destroy();
    chart.destroy();

    const app = MockApp.instances[0]!;
    const ro = MockResizeObserver.instances[0]!;
    expect(app.destroy).toHaveBeenCalledTimes(1);
    expect(ro.disconnect).toHaveBeenCalledTimes(1);
  });

  it('can be called on a never-initialised chart without throwing', () => {
    const container = makeContainer();
    const chart = new TestChart({ container });
    expect(() => {
      chart.destroy();
    }).not.toThrow();
    expect(chart.destroyed).toBe(true);
  });

  it('does not invoke render after destroy when the observer fires late', async () => {
    const container = makeContainer();
    const chart = new TestChart({ container });
    await chart.init();
    const ro = MockResizeObserver.instances[0]!;

    chart.destroy();

    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 200 });
    ro.trigger([]);

    expect(chart.renderCalls).toBe(0);
  });
});
