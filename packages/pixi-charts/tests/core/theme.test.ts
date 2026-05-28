import { describe, expect, it } from 'vitest';

import {
  DARK_THEME,
  LIGHT_THEME,
  resolveTheme,
  type ResolvedThemeColors,
  type ThemeColors,
} from '../../src/core/theme.js';

describe('resolveTheme', () => {
  it('returns light preset when theme is undefined', () => {
    expect(resolveTheme(undefined, undefined)).toEqual(LIGHT_THEME);
  });

  it('returns light preset when theme === "light"', () => {
    expect(resolveTheme('light', undefined)).toEqual(LIGHT_THEME);
  });

  it('returns dark preset when theme === "dark"', () => {
    expect(resolveTheme('dark', undefined)).toEqual(DARK_THEME);
  });

  it('returns a fresh object — does not return the preset reference', () => {
    // Defensive: callers may mutate the result; the presets must stay intact.
    const out = resolveTheme('light', undefined);
    expect(out).not.toBe(LIGHT_THEME);
  });

  it('applies a single color override on top of the preset', () => {
    const out = resolveTheme('dark', { grid: 0x404040 });
    const expected: ResolvedThemeColors = { ...DARK_THEME, grid: 0x404040 };
    expect(out).toEqual(expected);
  });

  it('applies multiple color overrides on top of the preset', () => {
    const out = resolveTheme('dark', { axis: 0x111111, legendText: 0xffffff });
    expect(out).toEqual({ ...DARK_THEME, axis: 0x111111, legendText: 0xffffff });
  });

  it('ignores explicitly-undefined override keys (does not blank out the preset)', () => {
    // Runtime callers (JSON inputs, JS without type checks) may pass
    // `{ grid: undefined }` — `exactOptionalPropertyTypes` rejects that at
    // the type layer, so cast through `unknown` to exercise the runtime
    // defensive check inside resolveTheme.
    const overrides = { grid: undefined, label: 0xaaaaaa } as unknown as ThemeColors;
    const out = resolveTheme('dark', overrides);
    expect(out.grid).toBe(DARK_THEME.grid);
    expect(out.label).toBe(0xaaaaaa);
  });

  it('overrides win over light preset too', () => {
    const out = resolveTheme('light', { grid: 0xff0000 });
    expect(out).toEqual({ ...LIGHT_THEME, grid: 0xff0000 });
  });

  it('light preset matches Axis/Legend default chrome colors (default-preservation)', () => {
    // Documented invariant: pre-theme defaults render byte-identically.
    // Axis defaults: labelColor 0x555555, lineColor 0x888888, gridColor 0xeeeeee.
    // Legend default: labelColor 0x333333.
    expect(LIGHT_THEME.label).toBe(0x555555);
    expect(LIGHT_THEME.axis).toBe(0x888888);
    expect(LIGHT_THEME.grid).toBe(0xeeeeee);
    expect(LIGHT_THEME.legendText).toBe(0x333333);
  });
});
