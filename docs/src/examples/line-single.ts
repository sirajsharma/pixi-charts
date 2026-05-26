import type { ChartSpec } from 'pixi-charts';

/**
 * 200-day daily revenue series — sine wave + noise.
 *
 * Same data shape used in packages/pixi-charts/dev/main.js so the docs page
 * and the dev harness stay visually consistent. Generated at module load on
 * the client; not serialized into the SSR HTML.
 */
function makeRevenueSeries(): { date: string; revenue: number }[] {
  const data: { date: string; revenue: number }[] = [];
  for (let i = 0; i < 200; i += 1) {
    data.push({
      date: new Date(2024, 0, i + 1).toISOString(),
      revenue: 1000 + Math.sin(i / 10) * 400 + Math.random() * 100,
    });
  }
  return data;
}

export const lineSingleSpec: ChartSpec = {
  type: 'line',
  data: makeRevenueSeries(),
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'revenue', type: 'quantitative' },
  },
};
