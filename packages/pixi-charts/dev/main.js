import { render } from '../dist/index.js';

const data = Array.from({ length: 200 }, (_, i) => ({
  date: new Date(2024, 0, i + 1).toISOString(),
  revenue: 1000 + Math.sin(i / 10) * 400 + Math.random() * 100,
}));

await render(
  {
    type: 'line',
    data,
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'revenue', type: 'quantitative' },
    },
  },
  document.getElementById('chart'),
);
