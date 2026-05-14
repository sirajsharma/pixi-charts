import { scaleBand, scaleLinear, scaleTime } from 'd3-scale';
import { describe, expect, it } from 'vitest';

import { bandAdapter, linearAdapter, timeAdapter } from '../../src/core/ScaleAdapter.js';

describe('linearAdapter', () => {
  it('reports kind: continuous', () => {
    expect(linearAdapter(scaleLinear()).kind).toBe('continuous');
  });

  it('delegates scale()', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    const adapter = linearAdapter(scale);
    expect(adapter.scale(0)).toBe(0);
    expect(adapter.scale(50)).toBe(100);
    expect(adapter.scale(100)).toBe(200);
  });

  it('delegates invert()', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    const adapter = linearAdapter(scale);
    expect(adapter.invert).toBeDefined();
    expect(adapter.invert!(100)).toBe(50);
  });

  it('delegates ticks()', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    const adapter = linearAdapter(scale);
    expect(adapter.ticks(5)).toEqual(scale.ticks(5));
  });

  it('delegates range()', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    const adapter = linearAdapter(scale);
    expect(adapter.range()).toEqual([0, 200]);
  });

  it('delegates tickFormat()', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    const adapter = linearAdapter(scale);
    const adapterFormat = adapter.tickFormat(5);
    const scaleFormat = scale.tickFormat(5);
    expect(adapterFormat(50)).toBe(scaleFormat(50));
    expect(adapterFormat(75)).toBe(scaleFormat(75));
  });

  it('does not expose bandwidth', () => {
    expect(linearAdapter(scaleLinear()).bandwidth).toBeUndefined();
  });
});

describe('bandAdapter', () => {
  it('reports kind: band', () => {
    const scale = scaleBand().domain(['a']).range([0, 100]);
    expect(bandAdapter(scale).kind).toBe('band');
  });

  it('delegates scale()', () => {
    const scale = scaleBand().domain(['a', 'b', 'c']).range([0, 300]);
    const adapter = bandAdapter(scale);
    expect(adapter.scale('a')).toBe(scale('a'));
    expect(adapter.scale('b')).toBe(scale('b'));
    expect(adapter.scale('c')).toBe(scale('c'));
  });

  it('ticks() returns the domain regardless of the count argument', () => {
    const scale = scaleBand().domain(['a', 'b', 'c', 'd']).range([0, 400]);
    const adapter = bandAdapter(scale);
    expect(adapter.ticks()).toEqual(['a', 'b', 'c', 'd']);
    expect(adapter.ticks(2)).toEqual(['a', 'b', 'c', 'd']);
    expect(adapter.ticks(99)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('delegates range()', () => {
    const scale = scaleBand().domain(['a', 'b']).range([0, 200]);
    expect(bandAdapter(scale).range()).toEqual([0, 200]);
  });

  it('does not expose invert', () => {
    const scale = scaleBand().domain(['a']).range([0, 100]);
    expect(bandAdapter(scale).invert).toBeUndefined();
  });

  it('exposes bandwidth()', () => {
    const scale = scaleBand().domain(['a', 'b', 'c', 'd']).range([0, 400]);
    const adapter = bandAdapter(scale);
    expect(adapter.bandwidth).toBeDefined();
    expect(adapter.bandwidth!()).toBe(scale.bandwidth());
  });

  it('tickFormat() returns an identity function (specifier ignored)', () => {
    const scale = scaleBand().domain(['a']).range([0, 100]);
    const format = bandAdapter(scale).tickFormat(5, 'ignored');
    expect(format('hello')).toBe('hello');
    expect(format('')).toBe('');
  });
});

describe('timeAdapter', () => {
  it('reports kind: time', () => {
    expect(timeAdapter(scaleTime()).kind).toBe('time');
  });

  it('delegates scale() and invert() with a date round-trip', () => {
    const start = new Date(2024, 0, 1);
    const end = new Date(2024, 11, 31);
    const scale = scaleTime().domain([start, end]).range([0, 1000]);
    const adapter = timeAdapter(scale);

    const mid = new Date(2024, 5, 16);
    const pixel = adapter.scale(mid);
    expect(pixel).toBe(scale(mid));

    expect(adapter.invert).toBeDefined();
    const inverted = adapter.invert!(pixel);
    expect(inverted.getTime()).toBeCloseTo(mid.getTime(), -3);
  });

  it('ticks(5) returns approximately 5 Date values', () => {
    const scale = scaleTime()
      .domain([new Date(2020, 0, 1), new Date(2024, 0, 1)])
      .range([0, 800]);
    const adapter = timeAdapter(scale);
    const ticks = adapter.ticks(5);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeLessThanOrEqual(7);
    for (const t of ticks) {
      expect(t).toBeInstanceOf(Date);
    }
  });

  it('does not expose bandwidth', () => {
    expect(timeAdapter(scaleTime()).bandwidth).toBeUndefined();
  });
});

describe('adapters are non-leaky', () => {
  it('mutating the array returned from range() does not affect the underlying scale', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    const adapter = linearAdapter(scale);

    const r = adapter.range();
    r[0] = 999;
    r[1] = -999;

    expect(adapter.range()).toEqual([0, 200]);
    expect(scale.range()).toEqual([0, 200]);
  });

  it('successive range() calls return arrays with different identity', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 200]);
    const adapter = linearAdapter(scale);
    expect(adapter.range()).not.toBe(adapter.range());
  });
});
