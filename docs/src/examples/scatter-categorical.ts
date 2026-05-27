import type { ChartSpec } from 'pixi-charts';

/**
 * Iris-flavoured measurements: petal length vs. petal width, ~50 specimens
 * per species, three species. The categorical color encoding splits the
 * cloud into three discrete clusters — the canonical "classification looks
 * easy" picture for this dataset.
 */
function makePetalMeasurements(): {
  petal_length_cm: number;
  petal_width_cm: number;
  species: string;
}[] {
  const species = [
    { name: 'setosa', length: 1.5, width: 0.25, lengthSpread: 0.35, widthSpread: 0.12 },
    { name: 'versicolor', length: 4.3, width: 1.3, lengthSpread: 0.55, widthSpread: 0.25 },
    { name: 'virginica', length: 5.6, width: 2.05, lengthSpread: 0.65, widthSpread: 0.3 },
  ];
  const data: { petal_length_cm: number; petal_width_cm: number; species: string }[] = [];
  for (const s of species) {
    for (let i = 0; i < 50; i += 1) {
      const lengthJitter = (Math.random() - 0.5) * 2 * s.lengthSpread;
      const widthJitter = (Math.random() - 0.5) * 2 * s.widthSpread;
      data.push({
        species: s.name,
        petal_length_cm: Number((s.length + lengthJitter).toFixed(2)),
        petal_width_cm: Number((s.width + widthJitter).toFixed(2)),
      });
    }
  }
  return data;
}

export const scatterCategoricalSpec: ChartSpec = {
  type: 'scatter',
  data: makePetalMeasurements(),
  encoding: {
    x: { field: 'petal_length_cm', type: 'quantitative' },
    y: { field: 'petal_width_cm', type: 'quantitative' },
    color: { field: 'species', type: 'categorical' },
  },
  options: {
    showLegend: true,
  },
};
