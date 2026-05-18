// ScatterChart performance harness.
//
// Plain ESM importing the built bundle — same convention as dev/main.js (no
// dev bundler in this workspace; run `pnpm build` first, then open this file
// over http, e.g. `npx serve packages/pixi-charts/dev`).
//
// Verifies the headline claim: 100k+ points at 60fps with sub-frame
// hit-testing. The FPS counter is a requestAnimationFrame delta (independent
// of PixiJS's own ticker) refreshed once per second; render() time is wall
// time around the full `render(spec, container)` (validate + init + first
// draw). Move the mouse over the cloud at 1M points — the tooltip should
// track instantly (d3-quadtree O(log n) hit-testing, not a linear scan).

import { render } from '../dist/index.js';

const chartEl = document.getElementById('chart');
const fpsEl = document.getElementById('fps');
const rtEl = document.getElementById('rt');
const countEl = document.getElementById('count');
const metaEl = document.getElementById('meta');
const buttons = [...document.querySelectorAll('#controls button')];

metaEl.textContent = `Built bundle loaded · page opened ${new Date().toISOString()}`;

/** Deterministic-ish pseudo-random cloud with a quantitative colour field. */
function makeData(n) {
  const data = new Array(n);
  for (let i = 0; i < n; i += 1) {
    // Two overlapping Gaussian-ish blobs so the plot looks real, not uniform.
    const a = Math.random();
    const cx = a < 0.5 ? 30 : 70;
    const cy = a < 0.5 ? 70 : 35;
    const x = cx + (Math.random() - 0.5) * 40;
    const y = cy + (Math.random() - 0.5) * 40;
    data[i] = { x, y, density: Math.hypot(x - 50, y - 50) };
  }
  return data;
}

let chart = null;

async function load(n) {
  for (const b of buttons) b.classList.toggle('active', Number(b.dataset.n) === n);
  countEl.textContent = n.toLocaleString();

  if (chart) {
    chart.destroy();
    chart = null;
  }

  const data = makeData(n);
  const spec = {
    type: 'scatter',
    data,
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      color: { field: 'density', type: 'quantitative', scheme: 'viridis' },
    },
    animation: { enter: n <= 100000 }, // skip the fade tween at 1M (still cheap, but keeps the timing clean)
  };

  const t0 = performance.now();
  chart = await render(spec, chartEl);
  const t1 = performance.now();
  rtEl.textContent = (t1 - t0).toFixed(1);
}

// FPS meter — rAF delta, reported once per second.
let frames = 0;
let last = performance.now();
function tick(now) {
  frames += 1;
  if (now - last >= 1000) {
    fpsEl.textContent = String(Math.round((frames * 1000) / (now - last)));
    frames = 0;
    last = now;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

for (const b of buttons) {
  b.addEventListener('click', () => {
    void load(Number(b.dataset.n));
  });
}

// Default tier: 100k — the number the architecture is pitched on.
void load(100000);
