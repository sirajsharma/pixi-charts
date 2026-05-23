import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_LEGEND_GAP,
  MIN_PLOT_DIMENSION,
  computeLayout,
  type LayoutInput,
} from '../../src/core/layout.js';

const margin = { top: 20, right: 30, bottom: 40, left: 50 } as const;

describe('computeLayout', () => {
  it('returns full content rectangle when no legend is supplied', () => {
    const layout = computeLayout({
      totalWidth: 800,
      totalHeight: 600,
      margin,
    });

    expect(layout.plotRect).toEqual({
      x: 50,
      y: 20,
      width: 800 - 50 - 30,
      height: 600 - 20 - 40,
    });
    expect(layout.legendRect).toBeNull();
  });

  it('reduces plot width by legend width + default gap when legend is supplied', () => {
    const layout = computeLayout({
      totalWidth: 800,
      totalHeight: 600,
      margin,
      legend: { width: 100, height: 60 },
    });

    const contentWidth = 800 - 50 - 30;
    expect(layout.plotRect.width).toBe(contentWidth - 100 - DEFAULT_LEGEND_GAP);
    expect(layout.plotRect.height).toBe(600 - 20 - 40);
    expect(layout.plotRect.x).toBe(50);
    expect(layout.plotRect.y).toBe(20);
  });

  it('positions legendRect to the right of the plot with the default gap', () => {
    const layout = computeLayout({
      totalWidth: 800,
      totalHeight: 600,
      margin,
      legend: { width: 100, height: 60 },
    });

    expect(layout.legendRect).not.toBeNull();
    expect(layout.legendRect!.x).toBe(
      layout.plotRect.x + layout.plotRect.width + DEFAULT_LEGEND_GAP,
    );
    expect(layout.legendRect!.width).toBe(100);
    expect(layout.legendRect!.height).toBe(60);
  });

  it('honours legendGap override', () => {
    const layout = computeLayout({
      totalWidth: 800,
      totalHeight: 600,
      margin,
      legend: { width: 100, height: 60 },
      legendGap: 24,
    });

    const contentWidth = 800 - 50 - 30;
    expect(layout.plotRect.width).toBe(contentWidth - 100 - 24);
    expect(layout.legendRect!.x).toBe(layout.plotRect.x + layout.plotRect.width + 24);
  });

  it('top-aligns the legend with the plot (legendRect.y === plotRect.y)', () => {
    const layout = computeLayout({
      totalWidth: 800,
      totalHeight: 600,
      margin,
      legend: { width: 100, height: 40 },
    });

    expect(layout.legendRect!.y).toBe(layout.plotRect.y);
  });

  describe('minimum plot guard', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('clamps plot width to MIN_PLOT_DIMENSION when legend is too wide', () => {
      const layout = computeLayout({
        totalWidth: 200,
        totalHeight: 600,
        margin: { top: 10, right: 10, bottom: 10, left: 10 },
        legend: { width: 250, height: 60 },
      });

      expect(layout.plotRect.width).toBe(MIN_PLOT_DIMENSION);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]![0]).toContain('legend width');
    });

    it('never returns negative dimensions', () => {
      const layout = computeLayout({
        totalWidth: 100,
        totalHeight: 60,
        margin: { top: 30, right: 30, bottom: 30, left: 30 },
        legend: { width: 500, height: 500 },
      });

      expect(layout.plotRect.width).toBeGreaterThanOrEqual(MIN_PLOT_DIMENSION);
      expect(layout.plotRect.height).toBeGreaterThanOrEqual(MIN_PLOT_DIMENSION);
    });

    it('clamps plot height to MIN_PLOT_DIMENSION when content rect is too short', () => {
      const layout = computeLayout({
        totalWidth: 800,
        totalHeight: 60,
        margin: { top: 30, right: 0, bottom: 30, left: 0 },
        legend: { width: 80, height: 40 },
      });

      expect(layout.plotRect.height).toBe(MIN_PLOT_DIMENSION);
    });

    it('also clamps plot dimensions to the minimum when no legend is supplied', () => {
      const layout = computeLayout({
        totalWidth: 60,
        totalHeight: 60,
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
      });

      expect(layout.plotRect.width).toBe(MIN_PLOT_DIMENSION);
      expect(layout.plotRect.height).toBe(MIN_PLOT_DIMENSION);
    });
  });

  it('is a pure function (identical inputs produce identical outputs)', () => {
    const input: LayoutInput = {
      totalWidth: 800,
      totalHeight: 600,
      margin,
      legend: { width: 100, height: 60 },
      legendGap: 16,
    };

    const a = computeLayout(input);
    const b = computeLayout(input);

    expect(a).toEqual(b);
    // Different object identity — the function does not return cached references.
    expect(a).not.toBe(b);
  });
});
