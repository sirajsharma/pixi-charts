import type { ChartSpec } from 'pixi-charts';

/**
 * 120 days of daily mean temperature for a single city. Sinusoidal seasonal
 * sweep with modest noise — enough variation for the filled region to read
 * as a trend, not a flat ribbon.
 */
function makeDailyTemperature(): { date: string; temperature_c: number }[] {
  const data: { date: string; temperature_c: number }[] = [];
  for (let i = 0; i < 120; i += 1) {
    const seasonal = 14 + Math.sin((i / 120) * Math.PI) * 12;
    const jitter = (Math.random() - 0.5) * 3;
    data.push({
      date: new Date(2025, 2, i + 1).toISOString(),
      temperature_c: Number((seasonal + jitter).toFixed(1)),
    });
  }
  return data;
}

export const areaSingleSpec: ChartSpec = {
  type: 'area',
  data: makeDailyTemperature(),
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'temperature_c', type: 'quantitative' },
  },
};
