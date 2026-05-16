import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChartSpecValidationError, validateChartSpec } from '../../src/spec/validate.js';

const validLineSpec = {
  type: 'line' as const,
  data: [
    { date: '2024-01-01', revenue: 100 },
    { date: '2024-02-01', revenue: 120 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' as const },
    y: { field: 'revenue', type: 'quantitative' as const },
  },
};

describe('validateChartSpec — happy path', () => {
  it('returns a typed spec for a valid line spec', () => {
    const result = validateChartSpec(validLineSpec);
    expect(result).toEqual(validLineSpec);
    expect(result.type).toBe('line');
    expect(result.encoding.x?.field).toBe('date');
  });

  it('accepts optional animation/options blocks', () => {
    const spec = {
      ...validLineSpec,
      options: { showLegend: true, margin: { top: 10 } },
      animation: { enter: { duration: 700, ease: 'easeOut' as const } },
    };
    expect(() => validateChartSpec(spec)).not.toThrow();
  });
});

describe('validateChartSpec — line-specific encoding requirements', () => {
  it('throws when encoding.x is missing for a line chart', () => {
    const spec = {
      ...validLineSpec,
      encoding: { y: validLineSpec.encoding.y },
    };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.x/);
  });

  it('throws when encoding.y is missing for a line chart', () => {
    const spec = {
      ...validLineSpec,
      encoding: { x: validLineSpec.encoding.x },
    };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.y/);
  });
});

describe('validateChartSpec — area-specific encoding requirements', () => {
  const validAreaSpec = { ...validLineSpec, type: 'area' as const };

  it('passes for a valid area spec', () => {
    const result = validateChartSpec(validAreaSpec);
    expect(result.type).toBe('area');
  });

  it('throws when encoding.x is missing for an area chart', () => {
    const spec = { ...validAreaSpec, encoding: { y: validAreaSpec.encoding.y } };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.x/);
    expect(() => validateChartSpec(spec)).toThrow(/type: 'area'/);
  });

  it('throws when encoding.y is missing for an area chart', () => {
    const spec = { ...validAreaSpec, encoding: { x: validAreaSpec.encoding.x } };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.y/);
  });
});

describe('validateChartSpec — type/enum failures', () => {
  it('throws and lists allowed types when type is invalid', () => {
    const spec = { ...validLineSpec, type: 'bogus' };
    let caught: ChartSpecValidationError | null = null;
    try {
      validateChartSpec(spec);
    } catch (e) {
      caught = e as ChartSpecValidationError;
    }
    expect(caught).toBeInstanceOf(ChartSpecValidationError);
    expect(caught?.message).toContain('line');
    expect(caught?.message).toContain('bar');
    expect(caught?.message).toContain('scatter');
  });

  it('throws and lists allowed FieldTypes when encoding.x.type is invalid', () => {
    const spec = {
      ...validLineSpec,
      encoding: {
        x: { field: 'date', type: 'number' as unknown as 'quantitative' },
        y: validLineSpec.encoding.y,
      },
    };
    expect(() => validateChartSpec(spec)).toThrow(/quantitative/);
    expect(() => validateChartSpec(spec)).toThrow(/categorical/);
    expect(() => validateChartSpec(spec)).toThrow(/temporal/);
  });

  it('includes a minimal example in the error for encoding.x.type failures', () => {
    const spec = {
      ...validLineSpec,
      encoding: {
        x: { field: 'date', type: 'number' as unknown as 'quantitative' },
        y: validLineSpec.encoding.y,
      },
    };
    expect(() => validateChartSpec(spec)).toThrow(/Example:/);
  });
});

describe('validateChartSpec — semantic checks', () => {
  it('throws when data is an empty array', () => {
    const spec = { ...validLineSpec, data: [] };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/empty/i);
  });

  it('throws and lists available fields when an encoded field is missing from data', () => {
    const spec = {
      ...validLineSpec,
      encoding: {
        x: { field: 'dat', type: 'temporal' as const }, // typo
        y: validLineSpec.encoding.y,
      },
    };
    let caught: ChartSpecValidationError | null = null;
    try {
      validateChartSpec(spec);
    } catch (e) {
      caught = e as ChartSpecValidationError;
    }
    expect(caught).toBeInstanceOf(ChartSpecValidationError);
    expect(caught?.message).toContain('"dat"');
    expect(caught?.message).toContain('"date"');
    expect(caught?.message).toContain('"revenue"');
  });
});

describe('validateChartSpec — forward compatibility', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  afterEach(() => {
    warnSpy.mockClear();
  });

  it('does NOT throw on unknown top-level keys, warns instead', () => {
    const spec = { ...validLineSpec, theme: 'dark' };
    expect(() => validateChartSpec(spec)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/unknown.*theme/));
  });
});

describe('validateChartSpec — error type', () => {
  it('throws an instance of ChartSpecValidationError, not a plain ZodError', () => {
    try {
      validateChartSpec({});
    } catch (e) {
      expect(e).toBeInstanceOf(ChartSpecValidationError);
      expect(e).toBeInstanceOf(Error);
    }
  });
});
