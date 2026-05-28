import { render } from '../dist/index.js';

// Case 1: dark theme line chart on a dark background.
const lineData = Array.from({ length: 60 }, (_, i) => ({
  day: i + 1,
  revenue: 1000 + Math.sin(i / 7) * 220 + Math.random() * 80,
  costs: 600 + Math.cos(i / 9) * 150 + Math.random() * 70,
}));

await render(
  {
    type: 'line',
    data: lineData.flatMap((d) => [
      { day: d.day, value: d.revenue, series: 'Revenue' },
      { day: d.day, value: d.costs, series: 'Costs' },
    ]),
    encoding: {
      x: { field: 'day', type: 'quantitative' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'series' },
    },
    options: { theme: 'dark' },
  },
  document.getElementById('dark-line'),
);

// Case 2: horizontal bar with deliberately long category labels.
const longCategories = [
  'Customer Relationship Management Platform',
  'Enterprise Resource Planning Suite',
  'Data Warehouse & Analytics Stack',
  'Sales Operations & Forecasting',
  'Marketing Automation Pipeline',
  'Customer Success & Retention',
];
const longLabelData = longCategories.map((name, i) => ({
  name,
  arr: 120 + i * 35 + Math.random() * 25,
}));

await render(
  {
    type: 'bar',
    data: longLabelData,
    encoding: {
      x: { field: 'arr', type: 'quantitative' },
      y: { field: 'name', type: 'categorical' },
    },
    options: { orientation: 'horizontal', theme: 'dark' },
  },
  document.getElementById('long-labels'),
);

// Case 3: small chart for corner-tooltip stress. A scatter spreads points
// across all four corners so a single hover gesture can exercise every
// flip / clamp branch.
const cornerData = [];
for (let xi = 0; xi < 8; xi += 1) {
  for (let yi = 0; yi < 6; yi += 1) {
    cornerData.push({ x: xi, y: yi, group: (xi + yi) % 3 === 0 ? 'A' : 'B' });
  }
}

await render(
  {
    type: 'scatter',
    data: cornerData,
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      color: { field: 'group' },
    },
    options: { theme: 'dark', showLegend: false },
  },
  document.getElementById('corner-tooltip'),
);
