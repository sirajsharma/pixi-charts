import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('pixi.js', () => {
  class MockApplication {
    static instances: MockApplication[] = [];
    canvas: HTMLCanvasElement = document.createElement('canvas');
    renderer = { resize: vi.fn() };
    init = vi.fn(async () => {
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
import { Chart, type ChartClickEvent } from '../../src/core/Chart.js';

const MockApp = Application as unknown as { instances: unknown[] };

/**
 * Minimal Chart subclass that exposes {@link Chart.emitClick} as a public
 * method so tests can drive the event API without standing up a real chart.
 */
class TestChart extends Chart {
  protected redrawData(): void {
    /* test stub */
  }
  protected replaceData(): void {
    /* test stub */
  }
  public emit(event: ChartClickEvent): void {
    this.emitClick(event);
  }
}

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: 100 });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: 100 });
  document.body.appendChild(el);
  return el;
}

function makeEvent(overrides: Partial<ChartClickEvent> = {}): ChartClickEvent {
  return {
    datum: { id: 1 },
    index: 0,
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

beforeEach(() => {
  MockApp.instances = [];
});

describe('Chart — on() / off() / emitClick()', () => {
  it('registers a click handler and invokes it on emitClick', () => {
    const chart = new TestChart({ container: makeContainer() });
    const handler = vi.fn<(e: ChartClickEvent) => void>();

    chart.on('click', handler);
    chart.emit(makeEvent({ datum: { id: 7 }, index: 3 }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ datum: { id: 7 }, index: 3 }));
  });

  it('returns an unsubscribe function from on() that removes the handler', () => {
    const chart = new TestChart({ container: makeContainer() });
    const handler = vi.fn<(e: ChartClickEvent) => void>();

    const unsubscribe = chart.on('click', handler);
    chart.emit(makeEvent());
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    chart.emit(makeEvent());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('off() removes a previously registered handler', () => {
    const chart = new TestChart({ container: makeContainer() });
    const handler = vi.fn<(e: ChartClickEvent) => void>();

    chart.on('click', handler);
    chart.off('click', handler);
    chart.emit(makeEvent());

    expect(handler).not.toHaveBeenCalled();
  });

  it('off() with an unregistered handler is a silent no-op', () => {
    const chart = new TestChart({ container: makeContainer() });
    const handler = vi.fn();
    expect(() => chart.off('click', handler)).not.toThrow();
  });

  it('supports multiple handlers — all of them fire on emit', () => {
    const chart = new TestChart({ container: makeContainer() });
    const a = vi.fn<(e: ChartClickEvent) => void>();
    const b = vi.fn<(e: ChartClickEvent) => void>();
    const c = vi.fn<(e: ChartClickEvent) => void>();

    chart.on('click', a);
    chart.on('click', b);
    chart.on('click', c);
    chart.emit(makeEvent());

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
  });

  it('a throwing handler does not block subsequent handlers', () => {
    const chart = new TestChart({ container: makeContainer() });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      /* silence expected error log */
    });

    const throwing = vi.fn(() => {
      throw new Error('boom');
    });
    const after = vi.fn<(e: ChartClickEvent) => void>();

    chart.on('click', throwing);
    chart.on('click', after);
    chart.emit(makeEvent());

    expect(throwing).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('the same handler registered twice fires only once (Set semantics)', () => {
    const chart = new TestChart({ container: makeContainer() });
    const handler = vi.fn<(e: ChartClickEvent) => void>();

    chart.on('click', handler);
    chart.on('click', handler);
    chart.emit(makeEvent());

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('destroy() clears all click handlers — emit after destroy is a no-op', async () => {
    const chart = new TestChart({ container: makeContainer() });
    await chart.init();
    const handler = vi.fn<(e: ChartClickEvent) => void>();

    chart.on('click', handler);
    chart.destroy();
    chart.emit(makeEvent());

    expect(handler).not.toHaveBeenCalled();
  });

  it('on() registrations after destroy() are tolerated but never fire', async () => {
    const chart = new TestChart({ container: makeContainer() });
    await chart.init();
    chart.destroy();

    const handler = vi.fn<(e: ChartClickEvent) => void>();
    chart.on('click', handler);
    chart.emit(makeEvent());

    expect(handler).not.toHaveBeenCalled();
  });
});
