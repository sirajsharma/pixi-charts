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

describe('validateChartSpec — bar-specific encoding requirements', () => {
  const barData = [
    { name: 'A', count: 10 },
    { name: 'B', count: 20 },
  ];

  it('passes for a valid vertical bar spec (x categorical, y quantitative)', () => {
    const result = validateChartSpec({
      type: 'bar',
      data: barData,
      encoding: {
        x: { field: 'name', type: 'categorical' },
        y: { field: 'count', type: 'quantitative' },
      },
    });
    expect(result.type).toBe('bar');
  });

  it('throws a teaching error naming encoding.x.type for a vertical bar with quantitative x', () => {
    const spec = {
      type: 'bar',
      data: barData,
      encoding: {
        x: { field: 'name', type: 'quantitative' as const },
        y: { field: 'count', type: 'quantitative' as const },
      },
    };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.x\.type/);
    expect(() => validateChartSpec(spec)).toThrow(/categorical/);
    expect(() => validateChartSpec(spec)).toThrow(/vertical/);
  });

  it('passes for a valid horizontal bar spec (y categorical, x quantitative)', () => {
    const result = validateChartSpec({
      type: 'bar',
      data: barData,
      encoding: {
        x: { field: 'count', type: 'quantitative' },
        y: { field: 'name', type: 'categorical' },
      },
      options: { orientation: 'horizontal' },
    });
    expect(result.type).toBe('bar');
  });

  it('throws a teaching error naming encoding.y.type for a horizontal bar with quantitative y', () => {
    const spec = {
      type: 'bar',
      data: barData,
      encoding: {
        x: { field: 'count', type: 'quantitative' as const },
        y: { field: 'name', type: 'quantitative' as const },
      },
      options: { orientation: 'horizontal' as const },
    };
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.y\.type/);
    expect(() => validateChartSpec(spec)).toThrow(/horizontal/);
  });

  it('throws when options.orientation is an invalid value', () => {
    const spec = {
      type: 'bar',
      data: barData,
      encoding: {
        x: { field: 'name', type: 'categorical' as const },
        y: { field: 'count', type: 'quantitative' as const },
      },
      options: { orientation: 'sideways' as unknown as 'vertical' },
    };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/options\.orientation/);
  });
});

describe('validateChartSpec — scatter-specific encoding requirements', () => {
  const scatterData = [
    { weight: 70, height: 175, bmi: 22.9, pop: 1200 },
    { weight: 82, height: 168, bmi: 29.1, pop: 800 },
  ];
  const validScatterSpec = {
    type: 'scatter' as const,
    data: scatterData,
    encoding: {
      x: { field: 'weight', type: 'quantitative' as const },
      y: { field: 'height', type: 'quantitative' as const },
    },
  };

  it('passes for a valid scatter spec with quantitative x/y', () => {
    const result = validateChartSpec(validScatterSpec);
    expect(result.type).toBe('scatter');
  });

  it('passes with temporal x and quantitative y', () => {
    expect(() =>
      validateChartSpec({
        ...validScatterSpec,
        data: [{ t: '2024-01-01', height: 175 }],
        encoding: {
          x: { field: 't', type: 'temporal' as const },
          y: { field: 'height', type: 'quantitative' as const },
        },
      }),
    ).not.toThrow();
  });

  it('throws a teaching error when encoding.x is categorical', () => {
    const spec = {
      ...validScatterSpec,
      encoding: {
        x: { field: 'weight', type: 'categorical' as const },
        y: { field: 'height', type: 'quantitative' as const },
      },
    };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.x\.type/);
    expect(() => validateChartSpec(spec)).toThrow(/quantitative.*or.*temporal/);
    expect(() => validateChartSpec(spec)).toThrow(/Example:/);
  });

  it('throws a teaching error when encoding.y is categorical', () => {
    const spec = {
      ...validScatterSpec,
      encoding: {
        x: { field: 'weight', type: 'quantitative' as const },
        y: { field: 'height', type: 'categorical' as const },
      },
    };
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.y\.type/);
  });

  it('throws when encoding.x is missing', () => {
    const spec = {
      ...validScatterSpec,
      encoding: { y: { field: 'height', type: 'quantitative' as const } },
    };
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.x/);
    expect(() => validateChartSpec(spec)).toThrow(/type: 'scatter'/);
  });

  it('passes with a quantitative color encoding', () => {
    expect(() =>
      validateChartSpec({
        ...validScatterSpec,
        encoding: {
          ...validScatterSpec.encoding,
          color: { field: 'bmi', type: 'quantitative' as const, scheme: 'viridis' },
        },
      }),
    ).not.toThrow();
  });

  it('passes with a categorical color encoding (type omitted)', () => {
    expect(() =>
      validateChartSpec({
        ...validScatterSpec,
        data: [{ weight: 70, height: 175, grp: 'a' }],
        encoding: { ...validScatterSpec.encoding, color: { field: 'grp' } },
      }),
    ).not.toThrow();
  });

  it('warns (does not throw) when a quantitative color field has non-numeric values', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const spec = {
      ...validScatterSpec,
      data: [
        { weight: 70, height: 175, bmi: 22.9 },
        { weight: 82, height: 168, bmi: 'n/a' },
      ],
      encoding: {
        ...validScatterSpec.encoding,
        color: { field: 'bmi', type: 'quantitative' as const },
      },
    };
    expect(() => validateChartSpec(spec)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/non-numeric/));
    warnSpy.mockRestore();
  });

  it('throws (shared existence check) when the size field does not exist', () => {
    const spec = {
      ...validScatterSpec,
      encoding: { ...validScatterSpec.encoding, size: { field: 'nope' } },
    };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/"nope"/);
  });

  it('warns (does not throw) when the size field has negative values', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const spec = {
      ...validScatterSpec,
      data: [
        { weight: 70, height: 175, mag: 5 },
        { weight: 82, height: 168, mag: -3 },
      ],
      encoding: { ...validScatterSpec.encoding, size: { field: 'mag' } },
    };
    expect(() => validateChartSpec(spec)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/negative/));
    warnSpy.mockRestore();
  });
});

describe('validateChartSpec — heatmap-specific encoding requirements', () => {
  const heatmapData = [
    { hour: '08', day: 'Mon', count: 3 },
    { hour: '08', day: 'Tue', count: 5 },
    { hour: '09', day: 'Mon', count: 7 },
    { hour: '09', day: 'Tue', count: 11 },
  ];
  const validHeatmapSpec = {
    type: 'heatmap' as const,
    data: heatmapData,
    encoding: {
      x: { field: 'hour', type: 'categorical' as const },
      y: { field: 'day', type: 'categorical' as const },
      color: { field: 'count', type: 'quantitative' as const, scheme: 'viridis' },
      value: { field: 'count' },
    },
  };

  it('passes for a valid heatmap spec', () => {
    const result = validateChartSpec(validHeatmapSpec);
    expect(result.type).toBe('heatmap');
    expect(result.encoding.value?.field).toBe('count');
  });

  it('throws when encoding.x is missing', () => {
    const spec = {
      ...validHeatmapSpec,
      encoding: {
        y: validHeatmapSpec.encoding.y,
        color: validHeatmapSpec.encoding.color,
        value: validHeatmapSpec.encoding.value,
      },
    };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.x/);
    expect(() => validateChartSpec(spec)).toThrow(/type: 'heatmap'/);
  });

  it('throws when encoding.y is missing', () => {
    const spec = {
      ...validHeatmapSpec,
      encoding: {
        x: validHeatmapSpec.encoding.x,
        color: validHeatmapSpec.encoding.color,
        value: validHeatmapSpec.encoding.value,
      },
    };
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.y/);
  });

  it('throws a binning-scope teaching error when encoding.x.type is quantitative', () => {
    const spec = {
      ...validHeatmapSpec,
      encoding: {
        ...validHeatmapSpec.encoding,
        x: { field: 'hour', type: 'quantitative' as const },
      },
    };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.x\.type/);
    expect(() => validateChartSpec(spec)).toThrow(/categorical/);
    expect(() => validateChartSpec(spec)).toThrow(/pre-bin/);
  });

  it('throws when encoding.y.type is temporal (also points at the binning scope)', () => {
    const spec = {
      ...validHeatmapSpec,
      encoding: {
        ...validHeatmapSpec.encoding,
        y: { field: 'day', type: 'temporal' as const },
      },
    };
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.y\.type/);
    expect(() => validateChartSpec(spec)).toThrow(/pre-bin/);
  });

  it('throws when encoding.color is missing', () => {
    const spec = {
      ...validHeatmapSpec,
      encoding: {
        x: validHeatmapSpec.encoding.x,
        y: validHeatmapSpec.encoding.y,
        value: validHeatmapSpec.encoding.value,
      },
    };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.color/);
    expect(() => validateChartSpec(spec)).toThrow(/primary visual channel/);
  });

  it('throws a quantitative-only teaching error when encoding.color.type is categorical', () => {
    const spec = {
      ...validHeatmapSpec,
      encoding: {
        ...validHeatmapSpec.encoding,
        color: { field: 'count', type: 'categorical' as const },
      },
    };
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.color\.type/);
    expect(() => validateChartSpec(spec)).toThrow(/quantitative/);
    expect(() => validateChartSpec(spec)).toThrow(/heatmaps require quantitative color/i);
  });

  it('throws when encoding.value is missing', () => {
    const spec = {
      ...validHeatmapSpec,
      encoding: {
        x: validHeatmapSpec.encoding.x,
        y: validHeatmapSpec.encoding.y,
        color: validHeatmapSpec.encoding.color,
      },
    };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.value/);
  });

  it('warns (does not throw) when data has duplicate (x, y) pairs', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const spec = {
      ...validHeatmapSpec,
      data: [
        ...heatmapData,
        { hour: '08', day: 'Mon', count: 99 }, // duplicate of row 0
      ],
    };
    expect(() => validateChartSpec(spec)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/duplicate \(x, y\) pair/));
    warnSpy.mockRestore();
  });

  it('throws (shared existence check) when the value field does not exist in data', () => {
    const spec = {
      ...validHeatmapSpec,
      encoding: { ...validHeatmapSpec.encoding, value: { field: 'nope' } },
    };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/"nope"/);
  });
});

describe('validateChartSpec — orientation is ignored for non-bar charts', () => {
  it('does not throw or warn when a line spec sets options.orientation', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const spec = { ...validLineSpec, options: { orientation: 'horizontal' as const } };
    expect(() => validateChartSpec(spec)).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not throw or warn when an area spec sets options.orientation', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const spec = {
      ...validLineSpec,
      type: 'area' as const,
      options: { orientation: 'vertical' as const },
    };
    expect(() => validateChartSpec(spec)).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('validateChartSpec — pie-specific encoding requirements', () => {
  const pieData = [
    { browser: 'Chrome', share: 60 },
    { browser: 'Safari', share: 20 },
    { browser: 'Firefox', share: 10 },
    { browser: 'Edge', share: 10 },
  ];
  const validPieSpec = {
    type: 'pie' as const,
    data: pieData,
    encoding: {
      x: { field: 'browser', type: 'categorical' as const },
      value: { field: 'share' },
    },
  };

  it('passes for a valid pie spec', () => {
    const result = validateChartSpec(validPieSpec);
    expect(result.type).toBe('pie');
    expect(result.encoding.x?.field).toBe('browser');
    expect(result.encoding.value?.field).toBe('share');
  });

  it('passes for a valid donut spec (with options.innerRadius)', () => {
    const spec = { ...validPieSpec, options: { innerRadius: 60 } };
    const result = validateChartSpec(spec);
    expect(result.options?.innerRadius).toBe(60);
  });

  it('passes for a spec that sets options.startAngle', () => {
    const spec = { ...validPieSpec, options: { startAngle: 0 } };
    const result = validateChartSpec(spec);
    expect(result.options?.startAngle).toBe(0);
  });

  it('throws when encoding.x is missing', () => {
    const spec = {
      ...validPieSpec,
      encoding: { value: validPieSpec.encoding.value },
    };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.x/);
    expect(() => validateChartSpec(spec)).toThrow(/category/);
  });

  it('throws a categorical-only teaching error when encoding.x.type is quantitative', () => {
    const spec = {
      ...validPieSpec,
      encoding: {
        ...validPieSpec.encoding,
        x: { field: 'browser', type: 'quantitative' as const },
      },
    };
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.x\.type/);
    expect(() => validateChartSpec(spec)).toThrow(/categorical/);
    expect(() => validateChartSpec(spec)).toThrow(/pre-bin/);
  });

  it('throws when encoding.value is missing', () => {
    const spec = {
      ...validPieSpec,
      encoding: { x: validPieSpec.encoding.x },
    };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.value/);
    expect(() => validateChartSpec(spec)).toThrow(/proportionally/);
  });

  it('throws when encoding.color.type is quantitative', () => {
    const spec = {
      ...validPieSpec,
      encoding: {
        ...validPieSpec.encoding,
        color: { field: 'share', type: 'quantitative' as const },
      },
    };
    expect(() => validateChartSpec(spec)).toThrow(/encoding\.color\.type/);
    expect(() => validateChartSpec(spec)).toThrow(/categorical/);
  });

  it('throws when options.innerRadius is negative', () => {
    const spec = { ...validPieSpec, options: { innerRadius: -1 } };
    expect(() => validateChartSpec(spec)).toThrow(/innerRadius/);
    expect(() => validateChartSpec(spec)).toThrow(/>= 0/);
  });

  it('throws when options.startAngle is NaN', () => {
    const spec = { ...validPieSpec, options: { startAngle: Number.NaN } };
    expect(() => validateChartSpec(spec)).toThrow(/startAngle/);
    expect(() => validateChartSpec(spec)).toThrow(/finite/);
  });

  it('throws when options.startAngle is Infinity', () => {
    const spec = { ...validPieSpec, options: { startAngle: Number.POSITIVE_INFINITY } };
    expect(() => validateChartSpec(spec)).toThrow(/startAngle/);
    expect(() => validateChartSpec(spec)).toThrow(/finite/);
  });

  it('warns (does not throw) when data has a zero value', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const spec = {
      ...validPieSpec,
      data: [
        { browser: 'Chrome', share: 60 },
        { browser: 'Safari', share: 0 },
        { browser: 'Firefox', share: 40 },
      ],
    };
    expect(() => validateChartSpec(spec)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/zero value/));
    warnSpy.mockRestore();
  });

  it('warns when a value is missing (undefined)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const spec = {
      ...validPieSpec,
      data: [
        { browser: 'Chrome', share: 60 },
        { browser: 'Safari' }, // share missing
        { browser: 'Firefox', share: 40 },
      ],
    };
    expect(() => validateChartSpec(spec)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/missing value/));
    warnSpy.mockRestore();
  });

  it('throws (shared existence check) when the value field does not exist in data', () => {
    // The pie validator warns about missing values for the (nonexistent)
    // field before the shared field-existence check throws — swallow so the
    // warn does not leak into other describe blocks.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const spec = {
      ...validPieSpec,
      encoding: { ...validPieSpec.encoding, value: { field: 'nope' } },
    };
    expect(() => validateChartSpec(spec)).toThrow(ChartSpecValidationError);
    expect(() => validateChartSpec(spec)).toThrow(/"nope"/);
    warnSpy.mockRestore();
  });
});

describe('validateChartSpec — pie-only options ignored for non-pie charts', () => {
  it('does not throw or warn when a line spec sets options.innerRadius / options.startAngle', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const spec = {
      ...validLineSpec,
      options: { innerRadius: 50, startAngle: Math.PI },
    };
    expect(() => validateChartSpec(spec)).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not throw or warn when an area / bar / scatter / heatmap spec sets pie options', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // area
    expect(() =>
      validateChartSpec({
        ...validLineSpec,
        type: 'area' as const,
        options: { innerRadius: -99, startAngle: Number.NaN },
      }),
    ).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
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
