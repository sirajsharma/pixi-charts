import { render } from '../dist/index.js';

// --- Data ---

const lineData = Array.from({ length: 200 }, (_, i) => ({
  date: new Date(2024, 0, i + 1).toISOString(),
  value: 500 + Math.sin(i / 8) * 200 + Math.random() * 60,
}));

const AREA_SERIES = ['Product A', 'Product B', 'Product C'];
const areaData = AREA_SERIES.flatMap((series, si) =>
  Array.from({ length: 200 }, (_, i) => ({
    date: new Date(2024, 0, i + 1).toISOString(),
    value: Math.max(0, 420 - si * 100 + Math.sin((i + si * 22) / 10) * 130 + Math.random() * 35),
    series,
  })),
);

const barData = [
  { month: 'Jan', sales: 420 },
  { month: 'Feb', sales: 385 },
  { month: 'Mar', sales: 510 },
  { month: 'Apr', sales: 630 },
  { month: 'May', sales: 495 },
  { month: 'Jun', sales: 720 },
  { month: 'Jul', sales: 72 }, // notably small
  { month: 'Aug', sales: 980 }, // notably large
];

const scatterData = Array.from({ length: 5000 }, () => {
  const cluster = Math.random() < 0.5;
  const cx = cluster ? 30 : 70;
  const cy = cluster ? 70 : 35;
  const x = cx + (Math.random() - 0.5) * 40;
  const y = cy + (Math.random() - 0.5) * 40;
  return { x, y, density: Math.hypot(x - 50, y - 50), radius: 1 + Math.random() * 7 };
});

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const heatmapData = DAYS.flatMap((day) =>
  HOURS.map((hour, h) => {
    const isWeekend = day === 'Sat' || day === 'Sun';
    const z = (h - 14) / 4;
    const base = (isWeekend ? 20 : 90) * Math.exp(-0.5 * z * z);
    return { hour, day, count: Math.max(0, Math.round(base + (Math.random() - 0.5) * 10)) };
  }),
);

const pieData = [
  { segment: 'Chrome', share: 62 },
  { segment: 'Safari', share: 18 },
  { segment: 'Edge', share: 8 },
  { segment: 'Firefox', share: 6 },
  { segment: 'Samsung', share: 3 },
  { segment: 'Other', share: 3 },
];

// --- Specs ---

const lineSpec = {
  type: 'line',
  data: lineData,
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
};

const areaSpec = {
  type: 'area',
  data: areaData,
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'series' },
  },
};

const barSpec = {
  type: 'bar',
  data: barData,
  encoding: {
    x: { field: 'month', type: 'categorical' },
    y: { field: 'sales', type: 'quantitative' },
  },
};

const scatterSpec = {
  type: 'scatter',
  data: scatterData,
  encoding: {
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
    color: { field: 'density', type: 'quantitative', scheme: 'viridis' },
    size: { field: 'radius' },
  },
};

const heatmapSpec = {
  type: 'heatmap',
  data: heatmapData,
  encoding: {
    x: { field: 'hour', type: 'categorical' },
    y: { field: 'day', type: 'categorical' },
    color: { field: 'count', type: 'quantitative', scheme: 'viridis' },
    value: { field: 'count' },
  },
};

const pieSpec = {
  type: 'pie',
  data: pieData,
  encoding: {
    x: { field: 'segment', type: 'categorical' },
    value: { field: 'share' },
  },
  options: { innerRadius: 60 },
};

// --- Render all in parallel ---

const loadTimeEl = document.getElementById('load-time');
const t0 = performance.now();

const specs = [
  { name: 'line', spec: lineSpec, id: 'chart-line' },
  { name: 'area', spec: areaSpec, id: 'chart-area' },
  { name: 'bar', spec: barSpec, id: 'chart-bar' },
  { name: 'scatter', spec: scatterSpec, id: 'chart-scatter' },
  { name: 'heatmap', spec: heatmapSpec, id: 'chart-heatmap' },
  { name: 'pie', spec: pieSpec, id: 'chart-pie' },
];

const results = await Promise.allSettled(
  specs.map(({ spec, id }) => render(spec, document.getElementById(id))),
);

const elapsed = (performance.now() - t0).toFixed(0);
const charts = [];

for (const [i, result] of results.entries()) {
  if (result.status === 'fulfilled') {
    charts.push(result.value);
  } else {
    console.error(`[all-charts] ${specs[i].name} failed:`, result.reason);
  }
}

const failed = results.filter((r) => r.status === 'rejected').length;
const status =
  failed === 0
    ? `All 6 charts loaded in ${elapsed} ms`
    : `${6 - failed}/6 charts loaded in ${elapsed} ms — ${failed} failed (see console)`;
loadTimeEl.textContent = `${status} · ${new Date().toLocaleTimeString()}`;

window.addEventListener('beforeunload', () => {
  for (const chart of charts) chart.destroy();
});
