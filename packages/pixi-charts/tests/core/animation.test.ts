import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Ticker, TickerCallback } from 'pixi.js';

import { easings, tween } from '../../src/core/animation.js';
import { setMediaMatch } from '../setup.js';

/**
 * Minimal Ticker stand-in. Tracks added/removed listeners and lets tests
 * advance frames synchronously. Real `performance.now()` is mocked via
 * `vi.spyOn(performance, 'now')` so frame-driven progress is deterministic.
 *
 * We deliberately do not import a real `pixi.js` Ticker — driving it
 * deterministically in tests is more invasive than a tiny fake, and a fake
 * also catches accidental coupling to ticker internals.
 */
class FakeTicker {
  listeners: TickerCallback<unknown>[] = [];

  add = vi.fn((fn: TickerCallback<unknown>): this => {
    this.listeners.push(fn);
    return this;
  });

  remove = vi.fn((fn: TickerCallback<unknown>): this => {
    this.listeners = this.listeners.filter((l) => l !== fn);
    return this;
  });

  /** Invoke every registered listener once (i.e. simulate one frame). */
  tick(): void {
    // Iterate a copy: a listener may remove itself during the tick.
    for (const fn of [...this.listeners]) {
      fn(this as unknown as Ticker);
    }
  }
}

function makeTicker(): FakeTicker {
  return new FakeTicker();
}

/**
 * Helper: spy on `performance.now` and return a setter that lets tests
 * control the returned value precisely.
 */
function mockNow(): { setNow: (ms: number) => void } {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  return {
    setNow: (ms) => {
      now = ms;
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('easings', () => {
  it('all easings satisfy ease(0) === 0 and ease(1) === 1', () => {
    for (const [name, fn] of Object.entries(easings)) {
      expect(fn(0), `${name}(0)`).toBe(0);
      expect(fn(1), `${name}(1)`).toBe(1);
    }
  });

  it('linear is the identity function', () => {
    expect(easings.linear(0.25)).toBe(0.25);
    expect(easings.linear(0.5)).toBe(0.5);
    expect(easings.linear(0.75)).toBe(0.75);
  });

  it('easeOut is monotonically non-decreasing on a 5-point sample', () => {
    const samples = [0, 0.25, 0.5, 0.75, 1].map((t) => easings.easeOut(t));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1] as number);
    }
  });
});

describe('tween — normal animation path', () => {
  it('subscribes to the ticker exactly once', () => {
    mockNow();
    const ticker = makeTicker();
    tween(ticker as unknown as Ticker, { duration: 100, onUpdate: () => undefined });
    expect(ticker.add).toHaveBeenCalledTimes(1);
    expect(ticker.listeners).toHaveLength(1);
  });

  it('runs onUpdate then onComplete, removes the listener on completion', () => {
    const { setNow } = mockNow();
    const ticker = makeTicker();
    const onUpdate = vi.fn();
    const onComplete = vi.fn();

    tween(ticker as unknown as Ticker, {
      duration: 100,
      ease: 'linear',
      onUpdate,
      onComplete,
    });

    setNow(50);
    ticker.tick();
    expect(onUpdate).toHaveBeenLastCalledWith(0.5);
    expect(onComplete).not.toHaveBeenCalled();

    setNow(200);
    ticker.tick();
    expect(onUpdate).toHaveBeenLastCalledWith(1);
    expect(onComplete).toHaveBeenCalledTimes(1);

    expect(ticker.remove).toHaveBeenCalledTimes(1);
    expect(ticker.listeners).toHaveLength(0);
  });

  it('progress is monotonically non-decreasing across multiple frames', () => {
    const { setNow } = mockNow();
    const ticker = makeTicker();
    const seen: number[] = [];

    tween(ticker as unknown as Ticker, {
      duration: 100,
      ease: 'linear',
      onUpdate: (p) => seen.push(p),
    });

    for (const t of [10, 25, 50, 75, 100, 150]) {
      setNow(t);
      ticker.tick();
    }

    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1] as number);
    }
    expect(seen[seen.length - 1]).toBe(1);
  });

  it('applies default duration (500ms) and default ease (easeOut)', () => {
    const { setNow } = mockNow();
    const ticker = makeTicker();
    const onUpdate = vi.fn();

    tween(ticker as unknown as Ticker, { onUpdate });

    // 250ms in is raw progress 0.5; eased via easeOut → 1 - 0.5^3 = 0.875.
    setNow(250);
    ticker.tick();
    expect(onUpdate.mock.lastCall?.[0]).toBeCloseTo(easings.easeOut(0.5), 10);

    // Default duration is 500ms, so 600ms completes the tween.
    setNow(600);
    ticker.tick();
    expect(onUpdate).toHaveBeenLastCalledWith(1);
  });
});

describe('tween — cancellation', () => {
  it('returned cancel removes the ticker listener and stops further onUpdate', () => {
    const { setNow } = mockNow();
    const ticker = makeTicker();
    const onUpdate = vi.fn();
    const onComplete = vi.fn();

    const cancel = tween(ticker as unknown as Ticker, {
      duration: 100,
      ease: 'linear',
      onUpdate,
      onComplete,
    });

    setNow(20);
    ticker.tick();
    expect(onUpdate).toHaveBeenCalledTimes(1);

    cancel();
    expect(ticker.remove).toHaveBeenCalledTimes(1);
    expect(ticker.listeners).toHaveLength(0);

    setNow(80);
    ticker.tick();
    expect(onUpdate).toHaveBeenCalledTimes(1); // unchanged
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('cancel is idempotent: second call is a no-op', () => {
    mockNow();
    const ticker = makeTicker();
    const cancel = tween(ticker as unknown as Ticker, {
      duration: 100,
      onUpdate: () => undefined,
    });
    cancel();
    cancel();
    expect(ticker.remove).toHaveBeenCalledTimes(1);
  });

  it('cancel after natural completion is a no-op', () => {
    const { setNow } = mockNow();
    const ticker = makeTicker();

    const cancel = tween(ticker as unknown as Ticker, {
      duration: 100,
      ease: 'linear',
      onUpdate: () => undefined,
    });

    setNow(200);
    ticker.tick();
    expect(ticker.remove).toHaveBeenCalledTimes(1);

    cancel();
    expect(ticker.remove).toHaveBeenCalledTimes(1);
  });
});

describe('tween — reduced motion', () => {
  it('fires onUpdate(1) and onComplete synchronously and does not touch the ticker', () => {
    setMediaMatch('(prefers-reduced-motion: reduce)', true);

    const ticker = makeTicker();
    const onUpdate = vi.fn();
    const onComplete = vi.fn();

    const cancel = tween(ticker as unknown as Ticker, {
      duration: 1000,
      onUpdate,
      onComplete,
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(ticker.add).not.toHaveBeenCalled();
    expect(ticker.listeners).toHaveLength(0);

    expect(() => cancel()).not.toThrow();
  });
});

describe('tween — leak check', () => {
  it('leaves no listener on the ticker after natural completion', () => {
    const { setNow } = mockNow();
    const ticker = makeTicker();
    tween(ticker as unknown as Ticker, {
      duration: 50,
      onUpdate: () => undefined,
    });
    setNow(100);
    ticker.tick();
    expect(ticker.listeners).toHaveLength(0);
  });

  it('leaves no listener on the ticker after cancel', () => {
    mockNow();
    const ticker = makeTicker();
    const cancel = tween(ticker as unknown as Ticker, {
      duration: 1000,
      onUpdate: () => undefined,
    });
    cancel();
    expect(ticker.listeners).toHaveLength(0);
  });
});
