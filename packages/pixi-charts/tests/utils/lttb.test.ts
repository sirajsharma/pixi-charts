import { describe, expect, it } from 'vitest';

import { lttb, type DataPoint } from '../../src/utils/lttb.js';

function makeSine(n: number, amplitude = 100, periods = 4): DataPoint[] {
  const out: DataPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({ x: i, y: amplitude * Math.sin((i / n) * periods * 2 * Math.PI) });
  }
  return out;
}

describe('lttb — pass-through edge cases', () => {
  it('returns a shallow copy unchanged when threshold >= data.length', () => {
    const data: DataPoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];
    const out = lttb(data, 100);
    expect(out).toEqual(data);
    // Shallow copy — not the same array reference.
    expect(out).not.toBe(data);
  });

  it('returns a shallow copy unchanged when threshold < 3', () => {
    const data: DataPoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    expect(lttb(data, 2)).toEqual(data);
    expect(lttb(data, 0)).toEqual(data);
  });

  it('returns an empty array for empty input', () => {
    expect(lttb([], 100)).toEqual([]);
    expect(lttb([], 2)).toEqual([]);
  });
});

describe('lttb — downsampling', () => {
  it('produces exactly `threshold` points when threshold < data.length', () => {
    const data = makeSine(1000);
    const out = lttb(data, 100);
    expect(out).toHaveLength(100);
  });

  it('preserves the first and last points exactly', () => {
    const data = makeSine(1000);
    const out = lttb(data, 50);
    expect(out[0]).toEqual(data[0]);
    expect(out[out.length - 1]).toEqual(data[data.length - 1]);
  });

  it('does not mutate the input array', () => {
    const data = makeSine(500);
    const snapshot = data.map((p) => ({ ...p }));
    lttb(data, 50);
    expect(data).toEqual(snapshot);
  });

  it('preserves the visual shape of a sine wave (extrema survive within tolerance)', () => {
    // Property: the original max and min y-values should appear (approximately)
    // in the output. LTTB selects extrema preferentially because extrema form
    // larger triangles.
    const data = makeSine(2000, 100, 4);
    const out = lttb(data, 200);

    const origMax = Math.max(...data.map((p) => p.y));
    const origMin = Math.min(...data.map((p) => p.y));
    const outMax = Math.max(...out.map((p) => p.y));
    const outMin = Math.min(...out.map((p) => p.y));

    // Within 5% — LTTB doesn't guarantee exact extrema but should be close
    // for a clean sine wave with this density.
    expect(outMax).toBeGreaterThan(origMax * 0.95);
    expect(outMin).toBeLessThan(origMin * 0.95);
  });

  it('all output points are members of the input (no synthesis)', () => {
    const data = makeSine(500);
    const out = lttb(data, 50);
    const inputSet = new Set(data);
    for (const p of out) {
      expect(inputSet.has(p)).toBe(true);
    }
  });
});
