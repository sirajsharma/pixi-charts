import type { ChartSpec } from 'pixi-charts';

export interface PerfPoint {
  x: number;
  y: number;
}

/**
 * Generate `n` uniform-random 2D points on [0, 100]². Shared between the
 * pixi-charts demo and the Chart.js comparison so neither library renders
 * a different dataset.
 */
export function makePerfData(n: number): PerfPoint[] {
  const data = new Array<PerfPoint>(n);
  for (let i = 0; i < n; i += 1) {
    data[i] = { x: Math.random() * 100, y: Math.random() * 100 };
  }
  return data;
}

/**
 * Build the scatter spec used by PerfHero and the pixi-charts column of
 * PerfComparison. Color encoded by x so the cloud has visual depth without
 * needing a legend.
 *
 * Enter animation is skipped once `n >= 100_000` — the tween itself is
 * cheap, but at 100k+ points it adds a multi-second fade-in that delays
 * the FPS counter from settling. The static demo is the point.
 */
export function makePerfScatterSpec(n: number, data?: readonly PerfPoint[]): ChartSpec {
  return {
    type: 'scatter',
    data: data ?? makePerfData(n),
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      color: { field: 'x', type: 'quantitative', scheme: 'viridis' },
    },
    options: {
      showAxes: false,
      showGrid: false,
      showLegend: false,
      showTooltip: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    },
    animation: { enter: n < 100_000 },
  };
}
