import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock PIXI Text the same way Axis.test.ts does. Width is proportional to
 * string length so binary-search truncation has a deterministic monotonic
 * signal to work against.
 */
vi.mock('pixi.js', () => {
  class MockText {
    static instances: MockText[] = [];
    text: string;
    style: Record<string, unknown>;
    destroyed = false;
    width: number;
    height: number;
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
  return { Text: MockText };
});

import { Text } from 'pixi.js';

import {
  LABEL_MARGIN_PAD,
  MAX_BAND_MARGIN_FRACTION,
  measureBandAxisMargin,
  measureText,
  truncateToWidth,
} from '../../src/core/text.js';

type MockTextStatic = {
  instances: { text: string; destroyed: boolean }[];
};
const MockText = Text as unknown as MockTextStatic;

beforeEach(() => {
  MockText.instances = [];
});

describe('measureText', () => {
  it('returns the PIXI Text width/height for the given style', () => {
    const out = measureText('hello', { fontFamily: 'sans-serif', fontSize: 10 });
    // Mock: width = 5 * 10 * 0.6 = 30, height = 10 * 1.2 = 12.
    expect(out.width).toBeCloseTo(30);
    expect(out.height).toBeCloseTo(12);
  });

  it('destroys the underlying Text so no GPU texture is retained', () => {
    measureText('disposable', { fontFamily: 'sans-serif', fontSize: 11 });
    expect(MockText.instances).toHaveLength(1);
    expect(MockText.instances[0]!.destroyed).toBe(true);
  });
});

describe('truncateToWidth', () => {
  const style = { fontFamily: 'sans-serif', fontSize: 10 };

  it('returns the original string when it already fits', () => {
    // 'hi' → width 12 ≤ 100.
    expect(truncateToWidth('hi', style, 100)).toBe('hi');
  });

  it('returns "" when input is empty', () => {
    expect(truncateToWidth('', style, 100)).toBe('');
  });

  it('returns an ellipsized string that measures ≤ maxWidth', () => {
    const out = truncateToWidth('Customer Relationship Management Platform', style, 60);
    expect(out.endsWith('…')).toBe(true);
    const w = measureText(out, style).width;
    expect(w).toBeLessThanOrEqual(60);
  });

  it('returns "…" when even the ellipsis alone exceeds the budget', () => {
    // Width of '…' is 1 * 10 * 0.6 = 6 in the mock; cap below that.
    expect(truncateToWidth('anything', style, 1)).toBe('…');
  });

  it('returns "…" when maxWidth is 0 or negative', () => {
    expect(truncateToWidth('hello', style, 0)).toBe('…');
    expect(truncateToWidth('hello', style, -5)).toBe('…');
  });
});

describe('measureBandAxisMargin', () => {
  const style = { fontFamily: 'sans-serif', fontSize: 10 };

  it('returns 0 / null for empty labels', () => {
    const out = measureBandAxisMargin([], style, 1000, 'cross-horizontal');
    expect(out.margin).toBe(0);
    expect(out.truncated).toBeNull();
  });

  it('returns max-label-width-driven margin when labels fit under the cap', () => {
    // 'abc' width = 18; inset = TICK_MARK_LENGTH(6) + TICK_LABEL_OFFSET(4) + LABEL_MARGIN_PAD(4) = 14.
    // Desired = 32. Cap = 1000 * 0.35 = 350. Returns 32, no truncation.
    const out = measureBandAxisMargin(['a', 'ab', 'abc'], style, 1000, 'cross-horizontal');
    expect(out.margin).toBeCloseTo(18 + 14);
    expect(out.truncated).toBeNull();
  });

  it('caps margin and truncates labels exceeding the fraction', () => {
    // A long label at chartDimension = 100 → cap = 35. With label widths up to
    // ~108 (length 18), desired ≫ cap. Should return cap and a truncation map.
    const labels = ['Marketing Operations'];
    const out = measureBandAxisMargin(labels, style, 100, 'cross-horizontal');
    expect(out.margin).toBeCloseTo(100 * MAX_BAND_MARGIN_FRACTION);
    expect(out.truncated).not.toBeNull();
    const truncated = out.truncated!.get('Marketing Operations');
    expect(truncated).toBeDefined();
    expect(truncated!.endsWith('…')).toBe(true);
  });

  it('measures cross-vertical via label height (single measurement)', () => {
    const out = measureBandAxisMargin(['Jan', 'Feb', 'Mar'], style, 1000, 'cross-vertical');
    // height = 12. inset = 14. desired = 26 ≤ cap. truncated stays null (rotation deferred).
    expect(out.margin).toBeCloseTo(12 + 14);
    expect(out.truncated).toBeNull();
  });

  it('LABEL_MARGIN_PAD is included in the inset', () => {
    const out = measureBandAxisMargin(['A'], style, 1000, 'cross-horizontal');
    // width('A') = 6. Inset = 6+4+LABEL_MARGIN_PAD. So margin = 6 + 10 + LABEL_MARGIN_PAD.
    expect(out.margin).toBeCloseTo(6 + 10 + LABEL_MARGIN_PAD);
  });
});
