import type { ChartSpec } from 'pixi-charts';

/**
 * Landing-page hero spec factory.
 *
 * Generates an Archimedean spiral with noise — visually striking, reads
 * as deliberate, and the color encoding flows along the spiral's progression
 * which makes the gradient look intentional rather than random.
 *
 * Exported as a function (not a const) so importing this module has zero
 * runtime cost. The data array is only built when makeHeroSpec is actually
 * called — and the only caller, HeroChart, calls it inside a client-only
 * useMemo, so the work happens in the browser, never during SSR.
 */
function makeSpiralData(n: number) {
  const data: { x: number; y: number; t: number }[] = [];
  const turns = 4; // number of spiral revolutions
  const maxRadius = 42; // outer reach in plot units
  const noise = 1.8; // perpendicular jitter, tunes "fluffy" feel
  const cx = 50;
  const cy = 50;

  for (let i = 0; i < n; i += 1) {
    // t goes from 0 → 1 along the spiral's progression
    const t = i / (n - 1);
    const angle = t * turns * 2 * Math.PI;
    const radius = t * maxRadius;

    // Base position on the spiral
    const baseX = cx + radius * Math.cos(angle);
    const baseY = cy + radius * Math.sin(angle);

    // Perpendicular noise (radial-out, not box-shaped)
    const noiseAngle = Math.random() * 2 * Math.PI;
    const noiseDist = (Math.random() - 0.5) * noise * 2;

    data.push({
      x: baseX + Math.cos(noiseAngle) * noiseDist,
      y: baseY + Math.sin(noiseAngle) * noiseDist,
      t,
    });
  }
  return data;
}

export function makeHeroSpec(pointCount = 30_000): ChartSpec {
  return {
    type: 'scatter',
    data: makeSpiralData(pointCount),
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      color: { field: 't', type: 'quantitative', scheme: 'plasma' },
    },
    options: {
      showLegend: false,
      showTooltip: false,
    },
    animation: { enter: true },
  };
}
