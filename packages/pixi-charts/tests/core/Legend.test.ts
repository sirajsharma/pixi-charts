import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock the entire `pixi.js` module before importing anything that uses it.
 * happy-dom has no WebGL — real PIXI primitives would fail to allocate.
 *
 * `MockText` exposes deterministic `width` / `height` getters derived from
 * the text content and font size, so Legend's manual extent tracking can
 * be exercised without depending on a real text-measurement backend.
 */
vi.mock('pixi.js', () => {
  class MockContainer {
    static instances: MockContainer[] = [];
    children: unknown[] = [];
    destroyed = false;
    addChild = vi.fn((child: unknown): unknown => {
      this.children.push(child);
      return child;
    });
    removeChildren = vi.fn((): unknown[] => {
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

  class MockGraphics {
    static instances: MockGraphics[] = [];
    destroyed = false;
    rectCalls: { x: number; y: number; w: number; h: number }[] = [];
    fillCalls: { color?: number }[] = [];

    rect = vi.fn((x: number, y: number, w: number, h: number): this => {
      this.rectCalls.push({ x, y, w, h });
      return this;
    });
    fill = vi.fn((style: { color?: number }): this => {
      this.fillCalls.push({ ...style });
      return this;
    });
    destroy = vi.fn((): void => {
      this.destroyed = true;
    });
    constructor() {
      MockGraphics.instances.push(this);
    }
  }

  class MockText {
    static instances: MockText[] = [];
    text: string;
    style: Record<string, unknown>;
    destroyed = false;
    anchor = { set: vi.fn((_x: number, _y: number): void => undefined) };
    position = {
      set: vi.fn((x: number, y: number): void => {
        this.lastPosition = { x, y };
      }),
    };
    lastPosition: { x: number; y: number } = { x: 0, y: 0 };
    destroy = vi.fn((): void => {
      this.destroyed = true;
    });
    constructor(opts: { text: string; style: Record<string, unknown> }) {
      this.text = opts.text;
      this.style = opts.style;
      MockText.instances.push(this);
    }
    // Deterministic, monotonic-with-text-length measurements so Legend's
    // layout math produces predictable values in tests.
    get width(): number {
      const fontSize = typeof this.style.fontSize === 'number' ? this.style.fontSize : 11;
      return this.text.length * fontSize * 0.6;
    }
    get height(): number {
      const fontSize = typeof this.style.fontSize === 'number' ? this.style.fontSize : 11;
      return fontSize;
    }
  }

  return { Container: MockContainer, Graphics: MockGraphics, Text: MockText };
});

import { Container, Graphics, Text } from 'pixi.js';

import { Legend } from '../../src/core/Legend.js';

type MockContainerStatic = {
  instances: { children: unknown[]; destroyed: boolean; destroy: ReturnType<typeof vi.fn> }[];
};
type MockGraphicsStatic = {
  instances: {
    rectCalls: { x: number; y: number; w: number; h: number }[];
    fillCalls: { color?: number }[];
    destroyed: boolean;
  }[];
};
type MockTextStatic = {
  instances: {
    text: string;
    style: Record<string, unknown>;
    anchor: { set: ReturnType<typeof vi.fn> };
    position: { set: ReturnType<typeof vi.fn> };
    lastPosition: { x: number; y: number };
    destroyed: boolean;
    width: number;
    height: number;
  }[];
};

const MockContainer = Container as unknown as MockContainerStatic;
const MockGraphics = Graphics as unknown as MockGraphicsStatic;
const MockText = Text as unknown as MockTextStatic;

beforeEach(() => {
  MockContainer.instances = [];
  MockGraphics.instances = [];
  MockText.instances = [];
});

const SAMPLE_ITEMS = [
  { label: 'Alpha', color: 0xff0000 },
  { label: 'Beta', color: 0x00ff00 },
  { label: 'Gamma', color: 0x0000ff },
];

describe('Legend — categorical construction', () => {
  it('renders N swatches (Graphics) + N labels (Text)', () => {
    new Legend({ type: 'categorical', items: SAMPLE_ITEMS });

    expect(MockGraphics.instances).toHaveLength(SAMPLE_ITEMS.length);
    expect(MockText.instances).toHaveLength(SAMPLE_ITEMS.length);

    const container = MockContainer.instances[0]!;
    expect(container.children).toHaveLength(SAMPLE_ITEMS.length * 2);
  });

  it('horizontal: label x positions are strictly increasing', () => {
    new Legend({ type: 'categorical', items: SAMPLE_ITEMS, orientation: 'horizontal' });

    const xs = MockText.instances.map((t) => t.lastPosition.x);
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
    }
    // All labels share the same y in horizontal mode.
    const ys = new Set(MockText.instances.map((t) => t.lastPosition.y));
    expect(ys.size).toBe(1);
  });

  it('vertical: label y positions are strictly increasing', () => {
    new Legend({ type: 'categorical', items: SAMPLE_ITEMS, orientation: 'vertical' });

    const ys = MockText.instances.map((t) => t.lastPosition.y);
    for (let i = 1; i < ys.length; i += 1) {
      expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
    }
    // All labels share the same x in vertical mode.
    const xs = new Set(MockText.instances.map((t) => t.lastPosition.x));
    expect(xs.size).toBe(1);
  });

  it('fills swatches with the supplied color', () => {
    new Legend({ type: 'categorical', items: SAMPLE_ITEMS });

    const fillColors = MockGraphics.instances.map((g) => g.fillCalls[0]?.color);
    expect(fillColors).toEqual(SAMPLE_ITEMS.map((i) => i.color));
  });
});

describe('Legend — continuous construction', () => {
  it('renders 64 gradient samples + 2 labels', () => {
    new Legend({ type: 'continuous', scheme: 'viridis', domain: [0, 100] });

    expect(MockGraphics.instances).toHaveLength(64);
    expect(MockText.instances).toHaveLength(2);

    const container = MockContainer.instances[0]!;
    expect(container.children).toHaveLength(64 + 2);
  });

  it('uses custom tickFormat for min/max labels', () => {
    const tickFormat = vi.fn((v: number) => `<${String(v)}>`);
    new Legend({ type: 'continuous', scheme: 'viridis', domain: [10, 90], tickFormat });

    expect(tickFormat).toHaveBeenCalledWith(10);
    expect(tickFormat).toHaveBeenCalledWith(90);
    const texts = MockText.instances.map((t) => t.text).sort();
    expect(texts).toEqual(['<10>', '<90>']);
  });

  it('vertical orientation places min label at the bottom (y=length)', () => {
    const length = 200;
    new Legend({
      type: 'continuous',
      scheme: 'viridis',
      domain: [0, 100],
      orientation: 'vertical',
      length,
      tickFormat: (v) => String(v),
    });

    const minLabel = MockText.instances.find((t) => t.text === '0')!;
    const maxLabel = MockText.instances.find((t) => t.text === '100')!;
    expect(minLabel.lastPosition.y).toBe(length);
    expect(maxLabel.lastPosition.y).toBe(0);
  });

  // Regression for the `.3~s` default that produced SI-prefixed labels like
  // "870m" (milli) for plain values. The fix swapped the default to `~g`
  // (general number, trimmed trailing zeros).
  describe('default tick format produces plain numbers (no SI suffix)', () => {
    it.each<[number, number, string, string]>([
      [0, 100, '0', '100'],
      [0, 0.5, '0', '0.5'],
      // d3-format renders the minus sign as U+2212 (Unicode minus), not ASCII '-'.
      [-50, 50, '−50', '50'],
      [1000, 100000, '1000', '100000'],
    ])('domain [%s, %s] → labels "%s" / "%s"', (min, max, minStr, maxStr) => {
      new Legend({ type: 'continuous', scheme: 'viridis', domain: [min, max] });
      const texts = MockText.instances.map((t) => t.text);
      expect(texts).toContain(minStr);
      expect(texts).toContain(maxStr);
      // Sanity: no SI suffixes leaked through.
      for (const t of texts) {
        expect(t).not.toMatch(/[a-zA-Zµμ]$/);
      }
    });
  });

  // Regression: the gradient bar's pixel rect should not be covered by the
  // min/max label rects. Computed from anchor + position + mock measurements.
  describe('continuous labels do not overlap the gradient bar', () => {
    function rectOf(
      label: {
        text: string;
        lastPosition: { x: number; y: number };
        width: number;
        height: number;
      },
      anchor: { x: number; y: number },
    ): { x0: number; y0: number; x1: number; y1: number } {
      const x0 = label.lastPosition.x - anchor.x * label.width;
      const y0 = label.lastPosition.y - anchor.y * label.height;
      return { x0, y0, x1: x0 + label.width, y1: y0 + label.height };
    }

    function intersects(
      a: { x0: number; y0: number; x1: number; y1: number },
      b: { x0: number; y0: number; x1: number; y1: number },
    ): boolean {
      return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    }

    it('horizontal orientation: labels sit below the gradient bar', () => {
      const length = 160;
      const thickness = 10;
      new Legend({
        type: 'continuous',
        scheme: 'viridis',
        domain: [0, 100],
        orientation: 'horizontal',
        length,
        thickness,
      });

      const barRect = { x0: 0, y0: 0, x1: length, y1: thickness };
      const minLabel = MockText.instances.find((t) => t.text === '0')!;
      const maxLabel = MockText.instances.find((t) => t.text === '100')!;

      // Horizontal: min anchor (0,0), max anchor (1,0).
      const minRect = rectOf(minLabel, { x: 0, y: 0 });
      const maxRect = rectOf(maxLabel, { x: 1, y: 0 });

      expect(intersects(minRect, barRect)).toBe(false);
      expect(intersects(maxRect, barRect)).toBe(false);
      // Labels are below the bar, not above.
      expect(minRect.y0).toBeGreaterThanOrEqual(thickness);
      expect(maxRect.y0).toBeGreaterThanOrEqual(thickness);
    });

    it('vertical orientation: labels sit to the right of the gradient bar', () => {
      const length = 160;
      const thickness = 10;
      new Legend({
        type: 'continuous',
        scheme: 'viridis',
        domain: [0, 100],
        orientation: 'vertical',
        length,
        thickness,
      });

      const barRect = { x0: 0, y0: 0, x1: thickness, y1: length };
      const minLabel = MockText.instances.find((t) => t.text === '0')!;
      const maxLabel = MockText.instances.find((t) => t.text === '100')!;

      // Vertical: min anchor (0,1), max anchor (0,0).
      const minRect = rectOf(minLabel, { x: 0, y: 1 });
      const maxRect = rectOf(maxLabel, { x: 0, y: 0 });

      expect(intersects(minRect, barRect)).toBe(false);
      expect(intersects(maxRect, barRect)).toBe(false);
      expect(minRect.x0).toBeGreaterThanOrEqual(thickness);
      expect(maxRect.x0).toBeGreaterThanOrEqual(thickness);
    });
  });

  it('throws when given an unknown scheme name (propagates ColorScheme guard)', () => {
    expect(() => {
      new Legend({
        type: 'continuous',
        scheme: 'not-a-real-scheme' as never,
        domain: [0, 1],
      });
    }).toThrow(/unknown scheme/);
  });
});

describe('Legend — width / height getters', () => {
  it('returns positive non-zero values after categorical construction', () => {
    const legend = new Legend({ type: 'categorical', items: SAMPLE_ITEMS });
    expect(legend.width).toBeGreaterThan(0);
    expect(legend.height).toBeGreaterThan(0);
  });

  it('returns positive non-zero values after continuous construction', () => {
    const legend = new Legend({ type: 'continuous', scheme: 'viridis', domain: [0, 100] });
    expect(legend.width).toBeGreaterThan(0);
    expect(legend.height).toBeGreaterThan(0);
  });

  it('recomputes on update()', () => {
    // Vertical default: 3 items must produce a taller legend than 1 item.
    const legend = new Legend({ type: 'categorical', items: [SAMPLE_ITEMS[0]!] });
    const before = legend.height;
    legend.update({ items: SAMPLE_ITEMS });
    expect(legend.height).toBeGreaterThan(before);
  });
});

describe('Legend — update() mode switching', () => {
  it('categorical → continuous: old children destroyed, new shape produced', () => {
    const legend = new Legend({ type: 'categorical', items: SAMPLE_ITEMS });

    const oldGraphics = [...MockGraphics.instances];
    const oldTexts = [...MockText.instances];

    legend.update({ type: 'continuous', scheme: 'viridis', domain: [0, 1] });

    for (const g of oldGraphics) expect(g.destroyed).toBe(true);
    for (const t of oldTexts) expect(t.destroyed).toBe(true);

    // After rebuild the container holds 64 gradient samples + 2 labels.
    const container = MockContainer.instances[0]!;
    expect(container.children).toHaveLength(64 + 2);
  });

  it('continuous → categorical: old children destroyed, new shape produced', () => {
    const legend = new Legend({ type: 'continuous', scheme: 'viridis', domain: [0, 1] });

    const oldGraphics = [...MockGraphics.instances];
    const oldTexts = [...MockText.instances];

    legend.update({ type: 'categorical', items: SAMPLE_ITEMS });

    for (const g of oldGraphics) expect(g.destroyed).toBe(true);
    for (const t of oldTexts) expect(t.destroyed).toBe(true);

    const container = MockContainer.instances[0]!;
    expect(container.children).toHaveLength(SAMPLE_ITEMS.length * 2);
  });

  it('same-mode partial update merges into current options', () => {
    const legend = new Legend({ type: 'categorical', items: SAMPLE_ITEMS, swatchSize: 12 });
    const heightBefore = legend.height;
    legend.update({ swatchSize: 30 });
    // Vertical default + bigger swatches → taller legend.
    expect(legend.height).toBeGreaterThan(heightBefore);
  });
});

describe('Legend — destroy()', () => {
  it('destroys all children and the container', () => {
    const legend = new Legend({ type: 'categorical', items: SAMPLE_ITEMS });

    const container = MockContainer.instances[0]!;
    const allGraphics = [...MockGraphics.instances];
    const allTexts = [...MockText.instances];

    legend.destroy();

    for (const g of allGraphics) expect(g.destroyed).toBe(true);
    for (const t of allTexts) expect(t.destroyed).toBe(true);
    expect(container.destroy).toHaveBeenCalledTimes(1);
    expect(container.destroy).toHaveBeenCalledWith(expect.objectContaining({ children: true }));
    expect(legend.destroyed).toBe(true);
  });

  it('is idempotent', () => {
    const legend = new Legend({ type: 'categorical', items: SAMPLE_ITEMS });
    const container = MockContainer.instances[0]!;

    legend.destroy();
    legend.destroy();

    expect(container.destroy).toHaveBeenCalledTimes(1);
  });

  it('throws when update() is called after destroy()', () => {
    const legend = new Legend({ type: 'categorical', items: SAMPLE_ITEMS });
    legend.destroy();

    expect(() => {
      legend.update({ items: [] });
    }).toThrow(/cannot update\(\) after destroy/);
  });
});
