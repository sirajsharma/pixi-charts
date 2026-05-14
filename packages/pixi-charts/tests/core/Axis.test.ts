import { scaleBand, scaleLinear, scaleLog, scaleTime } from 'd3-scale';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock the entire `pixi.js` module before importing anything that uses it.
 * happy-dom has no WebGL — real PIXI primitives would fail to allocate.
 *
 * Each mock class records its constructor calls in a static `instances`
 * array so tests can inspect what the Axis built without poking the
 * container tree.
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
    moveToCalls: { x: number; y: number }[] = [];
    lineToCalls: { x: number; y: number }[] = [];
    strokeCalls: { color?: number; width?: number }[] = [];

    moveTo = vi.fn((x: number, y: number): this => {
      this.moveToCalls.push({ x, y });
      return this;
    });
    lineTo = vi.fn((x: number, y: number): this => {
      this.lineToCalls.push({ x, y });
      return this;
    });
    stroke = vi.fn((style: { color?: number; width?: number }): this => {
      this.strokeCalls.push({ ...style });
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

import { Axis } from '../../src/core/Axis.js';
import { bandAdapter, linearAdapter, timeAdapter } from '../../src/core/ScaleAdapter.js';

type MockContainerStatic = {
  instances: { children: unknown[]; destroyed: boolean; destroy: ReturnType<typeof vi.fn> }[];
};
type MockGraphicsStatic = {
  instances: {
    moveToCalls: { x: number; y: number }[];
    lineToCalls: { x: number; y: number }[];
    strokeCalls: { color?: number; width?: number }[];
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

describe('Axis — construction with a linear scale', () => {
  it('creates one Container and the expected child count', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({ scale: linearAdapter(scale), orientation: 'bottom', length: 200 });

    expect(MockContainer.instances).toHaveLength(1);
    const container = MockContainer.instances[0]!;
    // axis line (1 Graphics) + N tick marks (Graphics) + N labels (Text).
    const tickCount = MockText.instances.length;
    expect(tickCount).toBeGreaterThanOrEqual(3);
    expect(container.children).toHaveLength(1 + tickCount * 2);
  });

  it('respects tickCount approximately (d3 picks nice numbers)', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 500]);
    new Axis({ scale: linearAdapter(scale), orientation: 'bottom', length: 500, tickCount: 10 });

    expect(MockText.instances.length).toBeGreaterThanOrEqual(8);
    expect(MockText.instances.length).toBeLessThanOrEqual(12);
  });
});

describe('Axis — construction with a band scale', () => {
  it('produces exactly one tick per domain entry', () => {
    const scale = scaleBand().domain(['a', 'b', 'c', 'd']).range([0, 400]);
    new Axis({ scale: bandAdapter(scale), orientation: 'bottom', length: 400 });

    expect(MockText.instances).toHaveLength(4);
    expect(MockText.instances.map((t) => t.text)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('Axis — construction with a time scale', () => {
  it('builds and produces tick labels via d3 default formatter', () => {
    const scale = scaleTime()
      .domain([new Date(2020, 0, 1), new Date(2020, 11, 31)])
      .range([0, 300]);
    new Axis({ scale: timeAdapter(scale), orientation: 'bottom', length: 300 });

    expect(MockText.instances.length).toBeGreaterThan(0);
    for (const t of MockText.instances) {
      expect(typeof t.text).toBe('string');
      expect(t.text.length).toBeGreaterThan(0);
    }
  });
});

describe('Axis — construction with a log scale', () => {
  it('builds with major-tick labels only', () => {
    const scale = scaleLog().domain([1, 1000]).range([0, 300]);
    new Axis({ scale: linearAdapter(scale), orientation: 'left', length: 300 });

    expect(MockText.instances.length).toBeGreaterThan(0);
  });
});

describe('Axis — custom tickFormat', () => {
  it('overrides d3 default formatting for every label', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({
      scale: linearAdapter(scale),
      orientation: 'bottom',
      length: 200,
      tickFormat: (v) => `$${String(v)}`,
    });

    expect(MockText.instances.length).toBeGreaterThan(0);
    for (const t of MockText.instances) {
      expect(t.text.startsWith('$')).toBe(true);
    }
  });
});

describe('Axis — orientations', () => {
  it('bottom: labels anchored centered-top, positioned below axis line', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({ scale: linearAdapter(scale), orientation: 'bottom', length: 200 });

    expect(MockText.instances.length).toBeGreaterThan(0);
    for (const t of MockText.instances) {
      expect(t.anchor.set).toHaveBeenCalledWith(0.5, 0);
      const [, y] = t.position.set.mock.calls[0]!;
      expect(y).toBeGreaterThan(0);
    }
  });

  it('top: labels anchored centered-bottom, positioned above axis line', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({ scale: linearAdapter(scale), orientation: 'top', length: 200 });

    for (const t of MockText.instances) {
      expect(t.anchor.set).toHaveBeenCalledWith(0.5, 1);
      const [, y] = t.position.set.mock.calls[0]!;
      expect(y).toBeLessThan(0);
    }
  });

  it('left: labels anchored right-middle, positioned left of axis line', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({ scale: linearAdapter(scale), orientation: 'left', length: 200 });

    for (const t of MockText.instances) {
      expect(t.anchor.set).toHaveBeenCalledWith(1, 0.5);
      const [x] = t.position.set.mock.calls[0]!;
      expect(x).toBeLessThan(0);
    }
  });

  it('right: labels anchored left-middle, positioned right of axis line', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({ scale: linearAdapter(scale), orientation: 'right', length: 200 });

    for (const t of MockText.instances) {
      expect(t.anchor.set).toHaveBeenCalledWith(0, 0.5);
      const [x] = t.position.set.mock.calls[0]!;
      expect(x).toBeGreaterThan(0);
    }
  });
});

describe('Axis — gridlines', () => {
  it('adds N gridline Graphics when showGrid is true', () => {
    const scale = scaleBand().domain(['a', 'b', 'c']).range([0, 300]);
    new Axis({
      scale: bandAdapter(scale),
      orientation: 'bottom',
      length: 300,
      showGrid: true,
      gridLength: 200,
      gridColor: 0xeeeeee,
    });

    const container = MockContainer.instances[0]!;
    // 3 gridlines + 1 axis line + 3 tick marks + 3 labels = 10 children.
    expect(container.children).toHaveLength(10);

    // First 3 children should be gridlines with the gridColor.
    const firstThree = MockGraphics.instances.slice(0, 3);
    for (const g of firstThree) {
      expect(g.strokeCalls.some((s) => s.color === 0xeeeeee)).toBe(true);
    }
  });

  it('does NOT add gridline graphics when showGrid is false (default)', () => {
    const scale = scaleBand().domain(['a', 'b', 'c']).range([0, 300]);
    new Axis({ scale: bandAdapter(scale), orientation: 'bottom', length: 300 });

    const container = MockContainer.instances[0]!;
    // 1 axis line + 3 tick marks + 3 labels = 7 children.
    expect(container.children).toHaveLength(7);
  });

  it('throws if showGrid is true but gridLength is missing', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    expect(() => {
      new Axis({
        scale: linearAdapter(scale),
        orientation: 'bottom',
        length: 200,
        showGrid: true,
      });
    }).toThrow(/gridLength must be a positive number/);
  });
});

describe('Axis — update()', () => {
  it('destroys old children and rebuilds', () => {
    const scale = scaleBand().domain(['a', 'b']).range([0, 200]);
    const axis = new Axis({ scale: bandAdapter(scale), orientation: 'bottom', length: 200 });

    const oldChildrenCount = MockGraphics.instances.length + MockText.instances.length;
    const oldGraphics = [...MockGraphics.instances];
    const oldTexts = [...MockText.instances];

    const newScale = scaleBand().domain(['x', 'y', 'z', 'w']).range([0, 200]);
    axis.update({ scale: bandAdapter(newScale) });

    // Every prior child should be destroyed.
    for (const g of oldGraphics) expect(g.destroyed).toBe(true);
    for (const t of oldTexts) expect(t.destroyed).toBe(true);

    // New children reflect new domain.
    const newTexts = MockText.instances.slice(oldTexts.length);
    expect(newTexts.map((t) => t.text)).toEqual(['x', 'y', 'z', 'w']);

    const container = MockContainer.instances[0]!;
    // 1 axis line + 4 ticks + 4 labels = 9, plus 0 old children retained.
    expect(container.children).toHaveLength(9);

    // Smoke: a different child count than before, so we know the rebuild happened.
    expect(container.children.length).not.toBe(oldChildrenCount);
  });
});

describe('Axis — destroy()', () => {
  it('destroys all children and the container, marks destroyed', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    const axis = new Axis({ scale: linearAdapter(scale), orientation: 'bottom', length: 200 });

    const container = MockContainer.instances[0]!;
    const allGraphics = [...MockGraphics.instances];
    const allTexts = [...MockText.instances];

    axis.destroy();

    for (const g of allGraphics) expect(g.destroyed).toBe(true);
    for (const t of allTexts) expect(t.destroyed).toBe(true);
    expect(container.destroy).toHaveBeenCalledTimes(1);
    expect(container.destroy).toHaveBeenCalledWith(expect.objectContaining({ children: true }));
    expect(axis.destroyed).toBe(true);
  });

  it('is idempotent', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    const axis = new Axis({ scale: linearAdapter(scale), orientation: 'bottom', length: 200 });
    const container = MockContainer.instances[0]!;

    axis.destroy();
    axis.destroy();

    expect(container.destroy).toHaveBeenCalledTimes(1);
  });

  it('throws when update() is called after destroy()', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    const axis = new Axis({ scale: linearAdapter(scale), orientation: 'bottom', length: 200 });
    axis.destroy();

    expect(() => {
      axis.update({ length: 300 });
    }).toThrow(/cannot update\(\) after destroy/);
  });
});

describe('Axis — generic over scale domain', () => {
  // This test exists as much for human readers as for the test suite: it
  // demonstrates that `Axis<Date>` flows the domain type through to the
  // `tickFormat` callback, so `(d) => d.getFullYear()` compiles cleanly
  // with no `as Date` cast and no discriminated-union narrowing.
  it('Axis<Date> with timeAdapter accepts a (d: Date) => string formatter without narrowing', () => {
    const scale = scaleTime()
      .domain([new Date(2020, 0, 1), new Date(2024, 0, 1)])
      .range([0, 400]);

    new Axis({
      scale: timeAdapter(scale),
      orientation: 'bottom',
      length: 400,
      tickFormat: (d) => d.getFullYear().toString(),
    });

    expect(MockText.instances.length).toBeGreaterThan(0);
    for (const t of MockText.instances) {
      expect(t.text).toMatch(/^\d{4}$/);
    }
  });
});
