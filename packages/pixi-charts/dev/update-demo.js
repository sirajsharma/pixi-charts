import { render } from '../dist/index.js';

/**
 * Each card in update-demo.html wires up its chart, its Regenerate button,
 * and (for line + scatter) an optional Stream toggle that drives
 * `chart.update(newData)` on a rAF loop.
 *
 * The point: every update call is timed via performance.now() so the demo
 * doubles as a perf check. Initial render is ~250–400ms (PIXI app boot +
 * shader compile). `update()` should be single-digit to low-double-digit
 * ms even for 5k-point scatters and large heatmaps.
 */

function rand(min, max) {
  return min + Math.random() * (max - min);
}

const BAR_CATEGORIES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];

function makeLineData(n = 200, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({
    x: i + offset,
    y: 50 + Math.sin((i + offset) / 10) * 30 + Math.random() * 20,
  }));
}
function makeAreaData(n = 200) {
  return Array.from({ length: n }, (_, i) => ({
    x: i,
    y: 100 + Math.cos(i / 12) * 40 + Math.random() * 25,
  }));
}
function makeBarData(values) {
  return BAR_CATEGORIES.map((name, i) => ({
    name,
    count: values ? values[i] : Math.round(rand(20, 100)),
  }));
}
function makeBarDataDifferentCategories() {
  const k = 3 + Math.floor(Math.random() * 4);
  return Array.from({ length: k }, (_, i) => ({
    name: `Cat${i + 1}-${Math.floor(Math.random() * 100)}`,
    count: Math.round(rand(10, 100)),
  }));
}
function makePieData() {
  return ['Chrome', 'Safari', 'Firefox', 'Edge', 'Other'].map((browser) => ({
    browser,
    share: Math.max(1, Math.round(rand(5, 50))),
  }));
}
function makeScatterData(n = 5000) {
  return Array.from({ length: n }, () => ({
    x: rand(-100, 100),
    y: rand(-100, 100),
    g: Math.random() < 0.5 ? 'a' : 'b',
  }));
}
function makeHeatmapData(grid) {
  const data = [];
  for (let y = 0; y < grid.h; y += 1) {
    for (let x = 0; x < grid.w; x += 1) {
      data.push({
        day: `D${y}`,
        hour: `H${x}`,
        count: Math.round(rand(0, 100)),
      });
    }
  }
  return data;
}

const charts = new Map();

async function setup() {
  // Line
  {
    const card = document.querySelector('[data-chart="line"]');
    const el = card.querySelector('[data-role="chart"]');
    const timing = card.querySelector('[data-role="timing"]');
    const chart = await render(
      {
        type: 'line',
        data: makeLineData(),
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
        },
        animation: { enter: false },
      },
      el,
    );
    charts.set('line', { chart, card, timing, dataFactory: () => makeLineData(200) });
  }
  // Area
  {
    const card = document.querySelector('[data-chart="area"]');
    const el = card.querySelector('[data-role="chart"]');
    const timing = card.querySelector('[data-role="timing"]');
    const chart = await render(
      {
        type: 'area',
        data: makeAreaData(),
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
        },
        animation: { enter: false },
      },
      el,
    );
    charts.set('area', { chart, card, timing, dataFactory: () => makeAreaData(200) });
  }
  // Bar
  {
    const card = document.querySelector('[data-chart="bar"]');
    const el = card.querySelector('[data-role="chart"]');
    const timing = card.querySelector('[data-role="timing"]');
    const chart = await render(
      {
        type: 'bar',
        data: makeBarData(),
        encoding: {
          x: { field: 'name', type: 'categorical' },
          y: { field: 'count', type: 'quantitative' },
        },
        animation: { enter: false },
      },
      el,
    );
    charts.set('bar', {
      chart,
      card,
      timing,
      dataFactory: () => makeBarData(),
      animatedFactory: () => makeBarDataDifferentCategories(),
    });
  }
  // Pie
  {
    const card = document.querySelector('[data-chart="pie"]');
    const el = card.querySelector('[data-role="chart"]');
    const timing = card.querySelector('[data-role="timing"]');
    const chart = await render(
      {
        type: 'pie',
        data: makePieData(),
        encoding: {
          x: { field: 'browser', type: 'categorical' },
          value: { field: 'share' },
        },
        animation: { enter: false },
      },
      el,
    );
    charts.set('pie', { chart, card, timing, dataFactory: () => makePieData() });
  }
  // Scatter
  {
    const card = document.querySelector('[data-chart="scatter"]');
    const el = card.querySelector('[data-role="chart"]');
    const timing = card.querySelector('[data-role="timing"]');
    const chart = await render(
      {
        type: 'scatter',
        data: makeScatterData(),
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
          color: { field: 'g' },
        },
        animation: { enter: false },
      },
      el,
    );
    charts.set('scatter', { chart, card, timing, dataFactory: () => makeScatterData(5000) });
  }
  // Heatmap — varies grid dimensions sometimes (exercises the
  // destroy-old-source path in syncTexture).
  {
    const card = document.querySelector('[data-chart="heatmap"]');
    const el = card.querySelector('[data-role="chart"]');
    const timing = card.querySelector('[data-role="timing"]');
    const initialGrid = { w: 12, h: 7 };
    const chart = await render(
      {
        type: 'heatmap',
        data: makeHeatmapData(initialGrid),
        encoding: {
          x: { field: 'hour', type: 'categorical' },
          y: { field: 'day', type: 'categorical' },
          value: { field: 'count', type: 'quantitative' },
          color: { field: 'count', type: 'quantitative' },
        },
        animation: { enter: false },
      },
      el,
    );
    let counter = 0;
    charts.set('heatmap', {
      chart,
      card,
      timing,
      dataFactory: () => {
        counter += 1;
        // Every fifth regenerate, change grid dims to exercise the
        // destroy-then-allocate path. Otherwise reuse the buffer.
        const grid =
          counter % 5 === 0
            ? { w: 6 + Math.floor(Math.random() * 12), h: 4 + Math.floor(Math.random() * 6) }
            : initialGrid;
        return makeHeatmapData(grid);
      },
    });
  }
}

function timed(fn) {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

function fmt(ms) {
  return `${ms.toFixed(2)} ms`;
}

function wireCard(key) {
  const entry = charts.get(key);
  if (entry === undefined) return;
  const { chart, card, timing, dataFactory, animatedFactory } = entry;

  card.querySelector('[data-action="regenerate"]').addEventListener('click', () => {
    const dt = timed(() => chart.update(dataFactory(), { animate: true }));
    timing.textContent = `update: ${fmt(dt)}`;
  });

  const animatedBtn = card.querySelector('[data-action="regenerate-snap"]');
  if (animatedBtn && animatedFactory !== undefined) {
    animatedBtn.addEventListener('click', () => {
      const dt = timed(() => chart.update(animatedFactory(), { animate: true }));
      timing.textContent = `update (snap): ${fmt(dt)}`;
    });
  }

  const streamToggle = card.querySelector('[data-action="stream"]');
  if (streamToggle) {
    let running = false;
    let frameCount = 0;
    let frameSum = 0;
    let lastReport = 0;
    let rafId = 0;
    const loop = () => {
      if (!running) return;
      const dt = timed(() => chart.update(dataFactory()));
      frameCount += 1;
      frameSum += dt;
      const now = performance.now();
      if (now - lastReport > 250) {
        const avg = frameSum / frameCount;
        timing.textContent = `stream avg: ${fmt(avg)} (n=${frameCount})`;
        frameCount = 0;
        frameSum = 0;
        lastReport = now;
      }
      rafId = requestAnimationFrame(loop);
    };
    streamToggle.addEventListener('change', () => {
      running = streamToggle.checked;
      if (running) {
        lastReport = performance.now();
        rafId = requestAnimationFrame(loop);
      } else if (rafId !== 0) {
        cancelAnimationFrame(rafId);
      }
    });
  }
}

await setup();
for (const key of charts.keys()) wireCard(key);
