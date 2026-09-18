# pixi-charts

> A WebGL-rendered TypeScript charting library built on [PixiJS](https://pixijs.com/) and D3. Renders tens of thousands of points at 60fps and stays interactive at 100k+ where Canvas-based libraries stall.

**Status:** alpha (`0.1.0`). The API is not yet stable — expect changes before `1.0`.

## Install

```sh
npm install pixi-charts pixi.js
```

`pixi.js` (v8) is a **peer dependency** — install it alongside `pixi-charts` so you control the exact PixiJS version. Both are ESM-only and work out of the box with Vite, esbuild, Rollup, webpack 5+, Next.js, and Astro.

## Your first chart

Every chart is one declarative `ChartSpec` — JSON that says _what_ to render, not _how_. Hand it to `render()` along with the DOM element that should host it:

```ts
import { render, type ChartSpec } from 'pixi-charts';

const spec: ChartSpec = {
  type: 'line',
  data: [
    { month: 'Jan', revenue: 12_400 },
    { month: 'Feb', revenue: 13_900 },
    { month: 'Mar', revenue: 15_200 },
    // …nine more months
  ],
  encoding: {
    x: { field: 'month', type: 'categorical' },
    y: { field: 'revenue', type: 'quantitative' },
  },
};

const container = document.getElementById('chart');
if (!container) throw new Error('Chart container #chart not found');
const chart = await render(spec, container);

// Later — e.g. when the component unmounts — clean up:
chart.destroy();
```

Swap `type: 'line'` for `'bar'`, `'area'`, `'scatter'`, `'heatmap'`, or `'pie'` to render the same data as a different chart — nothing else changes.

## Features

- **Six chart types** — line, area, bar, scatter, heatmap, and pie/donut — from one unified spec.
- **WebGL performance** — tens of thousands of points at 60fps; interactive at 100k+ where Canvas- and SVG-based libraries stall.
- **Declarative & LLM-friendly** — charts are values, not draw calls. Specs are validated up front with teaching-style error messages (`validateChartSpec`).
- **Streaming updates** — `chart.update(data)` takes a warm path (no GL re-init), for live and streaming data.
- **Interactions** — click events (with drilldown), hover tooltips, and hover decorations.
- **Theming** — built-in light/dark themes with per-color overrides.
- **TypeScript-first** — strict types, full autocomplete, named exports only.

Under the hood: D3 does the math (scales, layouts, spatial indexing); PixiJS does the pixels. Tree-shakeable, ESM-only.

## Links

- **Repository, docs & API reference:** https://github.com/sirajsharma/pixi-charts
- **Issues:** https://github.com/sirajsharma/pixi-charts/issues

## License

MIT © Siraj Sharma
