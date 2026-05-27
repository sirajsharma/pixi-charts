import type { ChartSpec } from 'pixi-charts';

/**
 * 400 days of solar-array output. X = hours of sunlight, y = kWh produced.
 * The color channel encodes ambient temperature as a continuous variable
 * (viridis ramp); the size channel encodes the number of panels feeding the
 * reading (sqrt scale so visual area tracks panel count).
 */
function makeSolarOutput(): {
  hours_of_sunlight: number;
  kwh: number;
  ambient_temperature_c: number;
  panel_count: number;
}[] {
  const data: {
    hours_of_sunlight: number;
    kwh: number;
    ambient_temperature_c: number;
    panel_count: number;
  }[] = [];
  for (let i = 0; i < 400; i += 1) {
    const hours = 2 + Math.random() * 10;
    const temp = 5 + Math.random() * 30;
    const panelCount = 60 + Math.floor(Math.random() * 280);
    const efficiency = 0.18 + (35 - temp) * 0.0015;
    const kwh = Math.max(0, hours * panelCount * efficiency + (Math.random() - 0.5) * 8);
    data.push({
      hours_of_sunlight: Number(hours.toFixed(2)),
      kwh: Number(kwh.toFixed(1)),
      ambient_temperature_c: Number(temp.toFixed(1)),
      panel_count: panelCount,
    });
  }
  return data;
}

export const scatterContinuousSpec: ChartSpec = {
  type: 'scatter',
  data: makeSolarOutput(),
  encoding: {
    x: { field: 'hours_of_sunlight', type: 'quantitative' },
    y: { field: 'kwh', type: 'quantitative' },
    color: { field: 'ambient_temperature_c', type: 'quantitative' },
    size: { field: 'panel_count' },
  },
  options: {
    showLegend: true,
  },
};
