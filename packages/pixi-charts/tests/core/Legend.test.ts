import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock pixi.js before importing anything that touches it. happy-dom has no
 * WebGL, so real PIXI primitives can't allocate. Each class records its
 * constructor calls into a static `instances` array for inspection.
 *
 * Legend uses Graphics.rect/fill (not moveTo/lineTo/stroke like Axis), so
 * MockGraphics here records those instead.
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
    position = { set: vi.fn((_x: number, _y: number): void => undefined) };
    destroy = vi.fn((): void => {
      this.destroyed = true;
    });
    constructor(opts: { text: string; style: Record<string, unknown> }) {
      this.text = opts.text;
      this.style = opts.style;
      MockText.instances.push(this);
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
    destroy: ReturnType<typeof vi.fn>;
  }[];
};
type MockTextStatic = {
  instances: {
    text: string;
    style: Record<string, unknown>;
    anchor: { set: ReturnType<typeof vi.fn> };
    position: { set: ReturnType<typeof vi.fn> };
    destroyed: boolean;
    destroy: ReturnType<typeof vi.fn>;
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

describe('Legend — categorical mode', () => {
  it('renders one swatch Graphics and one Text per item', () => {
    new Legend({
      type: 'categorical',
      items: [
        { label: 'A', color: 0xff0000 },
        { label: 'B', color: 0x00ff00 },
        { label: 'C', color: 0x0000ff },
      ],
    });

    expect(MockContainer.instances).toHaveLength(1);
    expect(MockGraphics.instances).toHaveLength(3);
    expect(MockText.instances).toHaveLength(3);
    expect(MockText.instances.map((t) => t.text)).toEqual(['A', 'B', 'C']);
  });

  it('fills each swatch with the item color', () => {
    new Legend({
      type: 'categorical',
      items: [
        { label: 'A', color: 0xff0000 },
        { label: 'B', color: 0x00ff00 },
      ],
    });

    expect(MockGraphics.instances[0]!.fillCalls[0]!.color).toBe(0xff0000);
    expect(MockGraphics.instances[1]!.fillCalls[0]!.color).toBe(0x00ff00);
  });

  it('vertical orientation lays items out top-to-bottom (default)', () => {
    new Legend({
      type: 'categorical',
      items: [
        { label: 'A', color: 0xff0000 },
        { label: 'B', color: 0x00ff00 },
        { label: 'C', color: 0x0000ff },
      ],
    });

    const ys = MockText.instances.map((t) => t.position.set.mock.calls[0]![1] as number);
    expect(ys[0]).toBeLessThan(ys[1]!);
    expect(ys[1]).toBeLessThan(ys[2]!);

    const xs = MockText.instances.map((t) => t.position.set.mock.calls[0]![0] as number);
    // All labels share the same x in vertical mode.
    expect(new Set(xs).size).toBe(1);
  });

  it('horizontal orientation lays items out left-to-right', () => {
    new Legend({
      type: 'categorical',
      orientation: 'horizontal',
      items: [
        { label: 'A', color: 0xff0000 },
        { label: 'B', color: 0x00ff00 },
        { label: 'C', color: 0x0000ff },
      ],
    });

    const xs = MockText.instances.map((t) => t.position.set.mock.calls[0]![0] as number);
    expect(xs[0]).toBeLessThan(xs[1]!);
    expect(xs[1]).toBeLessThan(xs[2]!);

    const ys = MockText.instances.map((t) => t.position.set.mock.calls[0]![1] as number);
    // All labels share the same y in horizontal mode.
    expect(new Set(ys).size).toBe(1);
  });

  it('uses custom swatchSize and labelColor', () => {
    new Legend({
      type: 'categorical',
      items: [{ label: 'A', color: 0xff0000 }],
      swatchSize: 24,
      labelColor: 0xabcdef,
      fontFamily: 'monospace',
      fontSize: 14,
    });

    const swatch = MockGraphics.instances[0]!;
    expect(swatch.rectCalls[0]!.w).toBe(24);
    expect(swatch.rectCalls[0]!.h).toBe(24);

    const label = MockText.instances[0]!;
    expect(label.style.fill).toBe(0xabcdef);
    expect(label.style.fontFamily).toBe('monospace');
    expect(label.style.fontSize).toBe(14);
  });

  it('handles an empty items array without throwing', () => {
    const legend = new Legend({ type: 'categorical', items: [] });
    expect(MockGraphics.instances).toHaveLength(0);
    expect(MockText.instances).toHaveLength(0);
    expect(legend.width).toBe(0);
    expect(legend.height).toBe(0);
  });
});

describe('Legend — continuous mode', () => {
  it('renders 64 gradient samples + 2 end labels', () => {
    new Legend({
      type: 'continuous',
      scheme: 'viridis',
      domain: [0, 100],
    });

    expect(MockGraphics.instances).toHaveLength(64);
    expect(MockText.instances).toHaveLength(2);
  });

  it('uses a custom tickFormat for both end labels', () => {
    const fmt = vi.fn((v: number) => `$${String(v)}`);
    new Legend({
      type: 'continuous',
      scheme: 'viridis',
      domain: [10, 90],
      tickFormat: fmt,
    });

    expect(fmt).toHaveBeenCalledWith(10);
    expect(fmt).toHaveBeenCalledWith(90);
    expect(MockText.instances.map((t) => t.text).sort()).toEqual(['$10', '$90']);
  });

  it('default tickFormat produces non-empty strings', () => {
    new Legend({
      type: 'continuous',
      scheme: 'blues',
      domain: [0, 1000],
    });
    for (const t of MockText.instances) {
      expect(typeof t.text).toBe('string');
      expect(t.text.length).toBeGreaterThan(0);
    }
  });

  it('horizontal orientation places min label at the left, max at the right', () => {
    new Legend({
      type: 'continuous',
      scheme: 'viridis',
      domain: [0, 100],
      length: 200,
      // Default orientation: 'horizontal'.
    });

    expect(MockText.instances).toHaveLength(2);
    const [minLabel, maxLabel] = MockText.instances;
    const minX = minLabel!.position.set.mock.calls[0]![0] as number;
    const maxX = maxLabel!.position.set.mock.calls[0]![0] as number;
    expect(minX).toBeLessThan(maxX);
  });

  it('vertical orientation places min label at the bottom, max at the top', () => {
    new Legend({
      type: 'continuous',
      scheme: 'viridis',
      domain: [0, 100],
      length: 200,
      orientation: 'vertical',
    });

    expect(MockText.instances).toHaveLength(2);
    // Constructor order in buildContinuous (vertical): max first, then min.
    const [maxLabel, minLabel] = MockText.instances;
    const maxY = maxLabel!.position.set.mock.calls[0]![1] as number;
    const minY = minLabel!.position.set.mock.calls[0]![1] as number;
    expect(minY).toBeGreaterThan(maxY);
  });

  it('first gradient sample uses scheme(0), last uses scheme(1)', () => {
    new Legend({
      type: 'continuous',
      scheme: 'viridis',
      domain: [0, 100],
    });

    const first = MockGraphics.instances[0]!.fillCalls[0]!.color;
    const last = MockGraphics.instances[63]!.fillCalls[0]!.color;
    expect(typeof first).toBe('number');
    expect(typeof last).toBe('number');
    expect(first).not.toBe(last);
  });

  it('throws on an unknown sequential scheme', () => {
    expect(() => {
      new Legend({
        type: 'continuous',
        // @ts-expect-error — deliberately invalid scheme name.
        scheme: 'bogus',
        domain: [0, 1],
      });
    }).toThrow(/unknown sequential scheme/);
  });
});

describe('Legend — width / height getters', () => {
  it('returns positive non-zero values for a categorical legend', () => {
    const legend = new Legend({
      type: 'categorical',
      items: [
        { label: 'A', color: 0xff0000 },
        { label: 'B', color: 0x00ff00 },
      ],
    });
    expect(legend.width).toBeGreaterThan(0);
    expect(legend.height).toBeGreaterThan(0);
  });

  it('returns positive non-zero values for a horizontal continuous legend', () => {
    const legend = new Legend({
      type: 'continuous',
      scheme: 'viridis',
      domain: [0, 100],
      length: 200,
    });
    expect(legend.width).toBe(200);
    expect(legend.height).toBeGreaterThan(0);
  });

  it('returns positive non-zero values for a vertical continuous legend', () => {
    const legend = new Legend({
      type: 'continuous',
      scheme: 'viridis',
      domain: [0, 100],
      length: 200,
      orientation: 'vertical',
    });
    expect(legend.width).toBeGreaterThan(0);
    expect(legend.height).toBe(200);
  });

  it('recomputes width / height after update()', () => {
    const legend = new Legend({
      type: 'categorical',
      items: [{ label: 'A', color: 0xff0000 }],
    });
    const initialHeight = legend.height;

    legend.update({
      type: 'categorical',
      items: [
        { label: 'A', color: 0xff0000 },
        { label: 'B', color: 0x00ff00 },
        { label: 'C', color: 0x0000ff },
      ],
    });

    expect(legend.height).toBeGreaterThan(initialHeight);
  });
});

describe('Legend — update()', () => {
  it('categorical → categorical with new items destroys old children and renders new', () => {
    const legend = new Legend({
      type: 'categorical',
      items: [
        { label: 'A', color: 0xff0000 },
        { label: 'B', color: 0x00ff00 },
      ],
    });

    const oldGraphics = [...MockGraphics.instances];
    const oldTexts = [...MockText.instances];

    legend.update({
      type: 'categorical',
      items: [
        { label: 'X', color: 0x111111 },
        { label: 'Y', color: 0x222222 },
        { label: 'Z', color: 0x333333 },
      ],
    });

    for (const g of oldGraphics) expect(g.destroyed).toBe(true);
    for (const t of oldTexts) expect(t.destroyed).toBe(true);

    const newTexts = MockText.instances.slice(oldTexts.length);
    expect(newTexts.map((t) => t.text)).toEqual(['X', 'Y', 'Z']);
  });

  it('categorical → continuous fully replaces children', () => {
    const legend = new Legend({
      type: 'categorical',
      items: [
        { label: 'A', color: 0xff0000 },
        { label: 'B', color: 0x00ff00 },
      ],
    });

    const oldGraphics = [...MockGraphics.instances];
    const oldTexts = [...MockText.instances];

    legend.update({
      type: 'continuous',
      scheme: 'viridis',
      domain: [0, 100],
    });

    for (const g of oldGraphics) expect(g.destroyed).toBe(true);
    for (const t of oldTexts) expect(t.destroyed).toBe(true);

    const newGraphics = MockGraphics.instances.slice(oldGraphics.length);
    const newTexts = MockText.instances.slice(oldTexts.length);
    expect(newGraphics).toHaveLength(64);
    expect(newTexts).toHaveLength(2);

    const container = MockContainer.instances[0]!;
    // Container should now hold only the new continuous children: 64 + 2 = 66.
    expect(container.children).toHaveLength(66);
  });

  it('continuous → categorical fully replaces children', () => {
    const legend = new Legend({
      type: 'continuous',
      scheme: 'viridis',
      domain: [0, 100],
    });

    const oldGraphics = [...MockGraphics.instances];
    const oldTexts = [...MockText.instances];

    legend.update({
      type: 'categorical',
      items: [
        { label: 'A', color: 0xff0000 },
        { label: 'B', color: 0x00ff00 },
      ],
    });

    for (const g of oldGraphics) expect(g.destroyed).toBe(true);
    for (const t of oldTexts) expect(t.destroyed).toBe(true);

    const newGraphics = MockGraphics.instances.slice(oldGraphics.length);
    const newTexts = MockText.instances.slice(oldTexts.length);
    expect(newGraphics).toHaveLength(2);
    expect(newTexts).toHaveLength(2);
  });

  it('throws when called after destroy()', () => {
    const legend = new Legend({
      type: 'categorical',
      items: [{ label: 'A', color: 0xff0000 }],
    });
    legend.destroy();

    expect(() => {
      legend.update({ type: 'categorical', items: [{ label: 'B', color: 0x00ff00 }] });
    }).toThrow(/cannot update\(\) after destroy/);
  });
});

describe('Legend — destroy()', () => {
  it('destroys all children and the container', () => {
    const legend = new Legend({
      type: 'categorical',
      items: [
        { label: 'A', color: 0xff0000 },
        { label: 'B', color: 0x00ff00 },
      ],
    });

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
    const legend = new Legend({
      type: 'continuous',
      scheme: 'viridis',
      domain: [0, 1],
    });
    const container = MockContainer.instances[0]!;

    legend.destroy();
    legend.destroy();

    expect(container.destroy).toHaveBeenCalledTimes(1);
  });
});
