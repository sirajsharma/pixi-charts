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
    rotation = 0;
    // Approximate dimensions so positioning math (e.g. axis-title placement)
    // computes finite values under happy-dom, which has no real text metrics.
    width: number;
    height: number;
    anchor = { set: vi.fn((_x: number, _y: number): void => undefined) };
    position = { set: vi.fn((_x: number, _y: number): void => undefined) };
    destroy = vi.fn((): void => {
      this.destroyed = true;
    });
    constructor(opts: { text: string; style: Record<string, unknown> }) {
      this.text = opts.text;
      this.style = opts.style;
      const fontSize = typeof opts.style.fontSize === 'number' ? opts.style.fontSize : 11;
      this.width = Math.max(1, opts.text.length) * fontSize * 0.6;
      this.height = fontSize * 1.2;
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
    rotation: number;
    width: number;
    height: number;
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
  it('creates a chrome Container plus an (empty) grid Container, with the expected child count', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({ scale: linearAdapter(scale), orientation: 'bottom', length: 200 });

    // Two containers: chrome (index 0) + gridContainer (index 1).
    expect(MockContainer.instances).toHaveLength(2);
    const chrome = MockContainer.instances[0]!;
    const grid = MockContainer.instances[1]!;
    // axis line (1 Graphics) + N tick marks (Graphics) + N labels (Text)
    // all live in the chrome container; the grid container is empty when
    // showGrid is unset.
    const tickCount = MockText.instances.length;
    expect(tickCount).toBeGreaterThanOrEqual(3);
    expect(chrome.children).toHaveLength(1 + tickCount * 2);
    expect(grid.children).toHaveLength(0);
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
  it('adds N gridline Graphics into the gridContainer (separate from chrome) when showGrid is true', () => {
    const scale = scaleBand().domain(['a', 'b', 'c']).range([0, 300]);
    new Axis({
      scale: bandAdapter(scale),
      orientation: 'bottom',
      length: 300,
      showGrid: true,
      gridLength: 200,
      gridColor: 0xeeeeee,
    });

    const chrome = MockContainer.instances[0]!;
    const grid = MockContainer.instances[1]!;
    // Gridlines live in the gridContainer (3), chrome holds the rest:
    // 1 axis line + 3 tick marks + 3 labels = 7 chrome children.
    expect(grid.children).toHaveLength(3);
    expect(chrome.children).toHaveLength(7);

    // The first 3 Graphics constructed are the gridlines (built before chrome).
    const firstThree = MockGraphics.instances.slice(0, 3);
    for (const g of firstThree) {
      expect(g.strokeCalls.some((s) => s.color === 0xeeeeee)).toBe(true);
    }
  });

  it('does NOT add gridline graphics when showGrid is false (default)', () => {
    const scale = scaleBand().domain(['a', 'b', 'c']).range([0, 300]);
    new Axis({ scale: bandAdapter(scale), orientation: 'bottom', length: 300 });

    const chrome = MockContainer.instances[0]!;
    const grid = MockContainer.instances[1]!;
    // 1 axis line + 3 tick marks + 3 labels = 7 chrome children; grid empty.
    expect(chrome.children).toHaveLength(7);
    expect(grid.children).toHaveLength(0);
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

    const chrome = MockContainer.instances[0]!;
    // 1 axis line + 4 ticks + 4 labels = 9 chrome children, plus 0 old children retained.
    expect(chrome.children).toHaveLength(9);

    // Smoke: a different child count than before, so we know the rebuild happened.
    expect(chrome.children.length).not.toBe(oldChildrenCount);
  });
});

describe('Axis — destroy()', () => {
  it('destroys all children and both containers, marks destroyed', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    const axis = new Axis({ scale: linearAdapter(scale), orientation: 'bottom', length: 200 });

    const chrome = MockContainer.instances[0]!;
    const grid = MockContainer.instances[1]!;
    const allGraphics = [...MockGraphics.instances];
    const allTexts = [...MockText.instances];

    axis.destroy();

    for (const g of allGraphics) expect(g.destroyed).toBe(true);
    for (const t of allTexts) expect(t.destroyed).toBe(true);
    expect(chrome.destroy).toHaveBeenCalledTimes(1);
    expect(chrome.destroy).toHaveBeenCalledWith(expect.objectContaining({ children: true }));
    expect(grid.destroy).toHaveBeenCalledTimes(1);
    expect(grid.destroy).toHaveBeenCalledWith(expect.objectContaining({ children: true }));
    expect(axis.destroyed).toBe(true);
  });

  it('is idempotent', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    const axis = new Axis({ scale: linearAdapter(scale), orientation: 'bottom', length: 200 });
    const chrome = MockContainer.instances[0]!;
    const grid = MockContainer.instances[1]!;

    axis.destroy();
    axis.destroy();

    expect(chrome.destroy).toHaveBeenCalledTimes(1);
    expect(grid.destroy).toHaveBeenCalledTimes(1);
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

describe('Axis — title rendering', () => {
  it('renders a Text child whose text matches the title option', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({
      scale: linearAdapter(scale),
      orientation: 'bottom',
      length: 200,
      title: 'Revenue (USD)',
    });

    const titleTexts = MockText.instances.filter((t) => t.text === 'Revenue (USD)');
    expect(titleTexts).toHaveLength(1);
  });

  it('does NOT render a title Text when title is undefined', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({ scale: linearAdapter(scale), orientation: 'bottom', length: 200 });

    // Only tick labels — every Text should be a numeric tick label, none bold.
    const bolds = MockText.instances.filter((t) => t.style.fontWeight === '600');
    expect(bolds).toHaveLength(0);
  });

  it('does NOT render a title Text when title is an empty string', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({
      scale: linearAdapter(scale),
      orientation: 'bottom',
      length: 200,
      title: '',
    });

    const bolds = MockText.instances.filter((t) => t.style.fontWeight === '600');
    expect(bolds).toHaveLength(0);
  });

  it('styles the title with bold weight and a larger font size than tick labels', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({
      scale: linearAdapter(scale),
      orientation: 'bottom',
      length: 200,
      title: 'X',
      fontSize: 11,
    });
    const title = MockText.instances.find((t) => t.text === 'X')!;
    expect(title.style.fontWeight).toBe('600');
    expect(title.style.fontSize).toBe(14); // fontSize + 3
  });

  it('positions the bottom-orientation title below the axis line (positive y)', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({
      scale: linearAdapter(scale),
      orientation: 'bottom',
      length: 200,
      title: 'X',
    });
    const title = MockText.instances.find((t) => t.text === 'X')!;
    const [x, y] = title.position.set.mock.calls[0]!;
    expect(x).toBeCloseTo(100); // length / 2
    expect(y).toBeGreaterThan(0);
    expect(title.rotation).toBe(0);
  });

  it('positions the top-orientation title above the axis line (negative y)', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({
      scale: linearAdapter(scale),
      orientation: 'top',
      length: 200,
      title: 'X',
    });
    const title = MockText.instances.find((t) => t.text === 'X')!;
    const [, y] = title.position.set.mock.calls[0]!;
    expect(y).toBeLessThan(0);
    expect(title.rotation).toBe(0);
  });

  it('rotates the left-orientation title -π/2 and places it left of the axis line', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({
      scale: linearAdapter(scale),
      orientation: 'left',
      length: 200,
      title: 'Y',
    });
    const title = MockText.instances.find((t) => t.text === 'Y')!;
    const [x, y] = title.position.set.mock.calls[0]!;
    expect(x).toBeLessThan(0);
    expect(y).toBeCloseTo(100); // length / 2
    expect(title.rotation).toBeCloseTo(-Math.PI / 2);
  });

  it('rotates the right-orientation title +π/2 and places it right of the axis line', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({
      scale: linearAdapter(scale),
      orientation: 'right',
      length: 200,
      title: 'Y',
    });
    const title = MockText.instances.find((t) => t.text === 'Y')!;
    const [x] = title.position.set.mock.calls[0]!;
    expect(x).toBeGreaterThan(0);
    expect(title.rotation).toBeCloseTo(Math.PI / 2);
  });

  it('honours custom titleFontSize and titleColor', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({
      scale: linearAdapter(scale),
      orientation: 'bottom',
      length: 200,
      title: 'X',
      titleFontSize: 18,
      titleColor: 0xff0000,
    });
    const title = MockText.instances.find((t) => t.text === 'X')!;
    expect(title.style.fontSize).toBe(18);
    expect(title.style.fill).toBe(0xff0000);
  });

  it('destroys the title Text cleanly on destroy()', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    const axis = new Axis({
      scale: linearAdapter(scale),
      orientation: 'bottom',
      length: 200,
      title: 'X',
    });
    const title = MockText.instances.find((t) => t.text === 'X')!;
    axis.destroy();
    expect(title.destroyed).toBe(true);
  });
});

describe('Axis — chrome-less mode (showChrome: false)', () => {
  it('renders only gridlines (into the gridContainer) when showChrome is false and showGrid is true', () => {
    const scale = scaleBand().domain(['a', 'b', 'c']).range([0, 300]);
    new Axis({
      scale: bandAdapter(scale),
      orientation: 'bottom',
      length: 300,
      showChrome: false,
      showGrid: true,
      gridLength: 200,
    });

    // Three gridline Graphics, no axis line, no tick marks, no labels.
    expect(MockGraphics.instances).toHaveLength(3);
    expect(MockText.instances).toHaveLength(0);
    // All three live in the gridContainer (index 1); chrome container is empty.
    const chrome = MockContainer.instances[0]!;
    const grid = MockContainer.instances[1]!;
    expect(chrome.children).toHaveLength(0);
    expect(grid.children).toHaveLength(3);
  });

  it('renders nothing when both showChrome and showGrid are false', () => {
    const scale = scaleBand().domain(['a', 'b', 'c']).range([0, 300]);
    new Axis({
      scale: bandAdapter(scale),
      orientation: 'bottom',
      length: 300,
      showChrome: false,
      showGrid: false,
    });

    expect(MockGraphics.instances).toHaveLength(0);
    expect(MockText.instances).toHaveLength(0);
  });

  it('skips title rendering when showChrome is false even if title is set', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    new Axis({
      scale: linearAdapter(scale),
      orientation: 'bottom',
      length: 200,
      showChrome: false,
      title: 'should not appear',
    });

    expect(MockText.instances.find((t) => t.text === 'should not appear')).toBeUndefined();
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
