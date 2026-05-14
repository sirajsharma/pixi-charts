# pixi-charts

> A WebGL-rendered TypeScript charting library built on [PixiJS](https://pixijs.com/) and D3 submodules.

**Status:** alpha — under active development. API is not yet stable; expect breaking changes between minor versions until 1.0.

## Why

SVG-based charting libraries (Recharts, Chart.js, D3-with-SVG) hit a wall around 10k DOM nodes. `pixi-charts` renders to a single WebGL canvas via PixiJS, targeting **60fps with 100k+ data points** and graceful handling up to 1M points. The math (scales, layouts, color interpolation, spatial indexing) is delegated to D3 submodules — only the rendering layer is replaced.

## Install

```sh
pnpm add pixi-charts pixi.js
```

`pixi.js` (^8) is a **peer dependency**.

## Usage

Every chart is described by the same `ChartSpec` JSON shape, and a single `render(spec, container)` call dispatches to the right implementation. This makes the API trivially consumable by LLMs that emit chart specifications.

```ts
import { render } from 'pixi-charts';

const chart = await render(
  {
    type: 'line',
    data: [
      { date: '2024-01-01', revenue: 100 },
      { date: '2024-02-01', revenue: 130 },
      { date: '2024-03-01', revenue: 120 },
      { date: '2024-04-01', revenue: 165 },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'revenue', type: 'quantitative' },
    },
  },
  document.getElementById('chart')!,
);

// Later, when tearing down:
chart.destroy();
```

`render` returns a `Promise<Chart>` — it awaits PixiJS's async initialization and runs the first render, so the resolved chart is ready to interact with. Invalid specs throw a `ChartSpecValidationError` whose message includes the path, the received value, and a minimal example of the right shape.

## Available chart types

- [x] **Line** — single- or multi-series, quantitative / categorical / temporal x-axis, hover tooltips, automatic LTTB downsampling above 10,000 points per series.
- [ ] Area
- [ ] Bar
- [ ] Scatter
- [ ] Heatmap
- [ ] Pie / Donut

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the architectural principles every chart implementation follows.

## Monorepo layout

```
packages/
  pixi-charts/        the published library
```

Future packages (an AI-driven chart explorer; a docs site) will live alongside.

## Development

```sh
pnpm install
pnpm test          # run all package tests
pnpm typecheck     # tsc --noEmit across the workspace
pnpm lint          # eslint
pnpm build         # tsup → dist/
```

## License

MIT © Siraj Sharma. See [`LICENSE`](./LICENSE).
