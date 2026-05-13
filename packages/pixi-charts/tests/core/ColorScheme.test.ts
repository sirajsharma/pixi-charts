import { describe, expect, it } from 'vitest';

import {
  categoricalSchemes,
  cssColorToPixi,
  getCategoricalColor,
  getSequentialColor,
  sequentialSchemes,
} from '../../src/core/ColorScheme.js';

describe('cssColorToPixi', () => {
  it('converts #rrggbb literals', () => {
    expect(cssColorToPixi('#000000')).toBe(0x000000);
    expect(cssColorToPixi('#ffffff')).toBe(0xffffff);
    expect(cssColorToPixi('#1f77b4')).toBe(0x1f77b4);
  });

  it('converts #rgb shorthand', () => {
    // #abc expands to #aabbcc
    expect(cssColorToPixi('#000')).toBe(0x000000);
    expect(cssColorToPixi('#fff')).toBe(0xffffff);
    expect(cssColorToPixi('#abc')).toBe(0xaabbcc);
  });

  it('converts rgb(...) function syntax', () => {
    expect(cssColorToPixi('rgb(255, 0, 0)')).toBe(0xff0000);
    expect(cssColorToPixi('rgb(0, 128, 255)')).toBe(0x0080ff);
  });

  it('converts CSS named colors', () => {
    expect(cssColorToPixi('red')).toBe(0xff0000);
    expect(cssColorToPixi('white')).toBe(0xffffff);
    expect(cssColorToPixi('black')).toBe(0x000000);
  });

  it('throws on unparseable input', () => {
    expect(() => cssColorToPixi('notacolor')).toThrow(/invalid CSS color/);
    expect(() => cssColorToPixi('')).toThrow(/invalid CSS color/);
  });
});

describe('getCategoricalColor', () => {
  it('returns the expected first color for category10', () => {
    // schemeCategory10[0] is "#1f77b4" in d3-scale-chromatic.
    expect(getCategoricalColor('category10', 0)).toBe(0x1f77b4);
  });

  it('returns colors that match the palette entries', () => {
    const palette = categoricalSchemes.category10;
    for (let i = 0; i < palette.length; i += 1) {
      expect(getCategoricalColor('category10', i)).toBe(cssColorToPixi(palette[i]!));
    }
  });

  it('wraps when index exceeds palette length', () => {
    const len = categoricalSchemes.category10.length;
    expect(getCategoricalColor('category10', len)).toBe(getCategoricalColor('category10', 0));
    expect(getCategoricalColor('category10', len + 3)).toBe(getCategoricalColor('category10', 3));
  });

  it('mirrors negative indices via Math.abs', () => {
    expect(getCategoricalColor('category10', -1)).toBe(getCategoricalColor('category10', 1));
    expect(getCategoricalColor('category10', -3)).toBe(getCategoricalColor('category10', 3));
  });

  it('truncates fractional indices', () => {
    expect(getCategoricalColor('category10', 2.7)).toBe(getCategoricalColor('category10', 2));
  });

  it('throws with a useful message on unknown scheme', () => {
    expect(() =>
      // @ts-expect-error — deliberately invalid scheme name to exercise the runtime guard.
      getCategoricalColor('bogus', 0),
    ).toThrow(/unknown scheme.*bogus/);
  });
});

describe('getSequentialColor', () => {
  it('returns endpoint colors that match the interpolator output', () => {
    expect(getSequentialColor('viridis', 0)).toBe(cssColorToPixi(sequentialSchemes.viridis(0)));
    expect(getSequentialColor('viridis', 1)).toBe(cssColorToPixi(sequentialSchemes.viridis(1)));
  });

  it('clamps t below 0 to 0', () => {
    expect(getSequentialColor('viridis', -0.5)).toBe(getSequentialColor('viridis', 0));
    expect(getSequentialColor('blues', -100)).toBe(getSequentialColor('blues', 0));
  });

  it('clamps t above 1 to 1', () => {
    expect(getSequentialColor('viridis', 1.5)).toBe(getSequentialColor('viridis', 1));
    expect(getSequentialColor('plasma', 99)).toBe(getSequentialColor('plasma', 1));
  });

  it('throws with a useful message on unknown scheme', () => {
    expect(() =>
      // @ts-expect-error — deliberately invalid scheme name.
      getSequentialColor('bogus', 0.5),
    ).toThrow(/unknown scheme.*bogus/);
  });
});
