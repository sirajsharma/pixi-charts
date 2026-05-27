import type { ChartSpec } from 'pixi-charts';

/**
 * Daily mean temperature for three cities across 90 days. The `city` field is
 * the categorical color split — AreaChart overlays one filled region per
 * series at 40% alpha (no stacking in v0.1).
 */
function makeCityTemperatures(): { date: string; temperature_c: number; city: string }[] {
  const cities = [
    { name: 'Lisbon', base: 18, amplitude: 4, phase: 0 },
    { name: 'Reykjavik', base: 7, amplitude: 3, phase: 0.4 },
    { name: 'Marrakech', base: 24, amplitude: 5, phase: -0.2 },
  ];
  const data: { date: string; temperature_c: number; city: string }[] = [];
  for (const c of cities) {
    for (let i = 0; i < 90; i += 1) {
      const seasonal = c.base + Math.sin((i / 90) * Math.PI + c.phase) * c.amplitude;
      const jitter = (Math.random() - 0.5) * 2;
      data.push({
        date: new Date(2025, 3, i + 1).toISOString(),
        city: c.name,
        temperature_c: Number((seasonal + jitter).toFixed(1)),
      });
    }
  }
  return data;
}

export const areaMultiSpec: ChartSpec = {
  type: 'area',
  data: makeCityTemperatures(),
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'temperature_c', type: 'quantitative' },
    color: { field: 'city', type: 'categorical' },
  },
  options: {
    showLegend: true,
  },
};
