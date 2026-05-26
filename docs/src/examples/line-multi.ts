import type { ChartSpec } from 'pixi-charts';

/**
 * Three-region revenue series over 24 weeks.
 *
 * The `region` field is the categorical color split that fans the data out
 * into three line series. Same data shape across all rows; the library
 * groups by the color field automatically.
 */
function makeRegionSeries(): { week: number; revenue: number; region: string }[] {
  const regions = [
    { name: 'North America', base: 18_000, amplitude: 2_000, phase: 0 },
    { name: 'Europe', base: 14_000, amplitude: 1_600, phase: 1.2 },
    { name: 'Asia Pacific', base: 11_000, amplitude: 2_400, phase: 2.4 },
  ];
  const data: { week: number; revenue: number; region: string }[] = [];
  for (const r of regions) {
    for (let w = 0; w < 24; w += 1) {
      data.push({
        week: w,
        region: r.name,
        revenue: r.base + Math.sin(w / 4 + r.phase) * r.amplitude + (Math.random() - 0.5) * 800,
      });
    }
  }
  return data;
}

export const lineMultiSpec: ChartSpec = {
  type: 'line',
  data: makeRegionSeries(),
  encoding: {
    x: { field: 'week', type: 'quantitative' },
    y: { field: 'revenue', type: 'quantitative' },
    color: { field: 'region', type: 'categorical' },
  },
  options: {
    showLegend: true,
  },
};
