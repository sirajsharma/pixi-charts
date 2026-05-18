import { describe, expect, it } from 'vitest';

import { SpatialIndex, type SpatialRecord } from '../../src/utils/quadtree.js';

type Row = { id: string };
const rec = (x: number, y: number, id: string): SpatialRecord<Row> => ({ x, y, datum: { id } });

describe('SpatialIndex — empty', () => {
  it('size is 0 and every query returns null', () => {
    const idx = new SpatialIndex<Row>([]);
    expect(idx.size).toBe(0);
    expect(idx.findNearest({ x: 0, y: 0 }, 10)).toBeNull();
    expect(idx.findNearest({ x: 999, y: -999 }, 1e6)).toBeNull();
  });
});

describe('SpatialIndex — single record', () => {
  const idx = new SpatialIndex<Row>([rec(50, 50, 'only')]);

  it('size getter returns the record count', () => {
    expect(idx.size).toBe(1);
  });

  it('query at the exact position returns it', () => {
    expect(idx.findNearest({ x: 50, y: 50 }, 5)?.datum.id).toBe('only');
  });

  it('query within radius returns it', () => {
    // distance = 3-4-5 triangle → 5 px from (53, 54).
    expect(idx.findNearest({ x: 53, y: 54 }, 5.0001)?.datum.id).toBe('only');
  });

  it('query outside radius returns null', () => {
    expect(idx.findNearest({ x: 100, y: 100 }, 10)).toBeNull();
  });
});

describe('SpatialIndex — multiple records', () => {
  const records = [rec(0, 0, 'a'), rec(100, 0, 'b'), rec(0, 100, 'c'), rec(100, 100, 'd')];
  const idx = new SpatialIndex<Row>(records);

  it('size matches the record count', () => {
    expect(idx.size).toBe(4);
  });

  it('returns the nearest of several candidates', () => {
    expect(idx.findNearest({ x: 90, y: 10 }, 1000)?.datum.id).toBe('b');
    expect(idx.findNearest({ x: 5, y: 95 }, 1000)?.datum.id).toBe('c');
    expect(idx.findNearest({ x: 20, y: 20 }, 1000)?.datum.id).toBe('a');
  });

  it('respects the radius even when a point exists just outside it', () => {
    // Nearest is 'a' at distance ~14.14 from (10,10); radius 14 excludes it.
    expect(idx.findNearest({ x: 10, y: 10 }, 14)).toBeNull();
    expect(idx.findNearest({ x: 10, y: 10 }, 15)?.datum.id).toBe('a');
  });
});

describe('SpatialIndex — coincident points', () => {
  it('returns one of them without crashing', () => {
    const idx = new SpatialIndex<Row>([rec(10, 10, 'p1'), rec(10, 10, 'p2'), rec(10, 10, 'p3')]);
    expect(idx.size).toBe(3);
    const hit = idx.findNearest({ x: 10, y: 10 }, 1);
    expect(hit).not.toBeNull();
    expect(['p1', 'p2', 'p3']).toContain(hit?.datum.id);
  });
});

describe('SpatialIndex — does not mutate input', () => {
  it('leaves the caller array and records untouched', () => {
    const records = [rec(1, 2, 'x')];
    const snapshot = JSON.stringify(records);
    const idx = new SpatialIndex<Row>(records);
    idx.findNearest({ x: 1, y: 2 }, 5);
    expect(JSON.stringify(records)).toBe(snapshot);
    expect(records).toHaveLength(1);
  });
});
