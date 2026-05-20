# pixi-charts

> A WebGL-rendered TypeScript charting library built on [PixiJS](https://pixijs.com/) and D3 submodules.

**Status:** alpha — under active development. API is not yet stable; expect breaking changes between minor versions until 1.0.

## Why

SVG-based charting libraries (Recharts, Chart.js, D3-with-SVG) hit a wall around 10k DOM nodes. `pixi-charts` renders to a single WebGL canvas via PixiJS, targeting **60fps with 100k+ data points** and graceful handling up to 1M points. The math (scales, layouts, color interpolation, spatial indexing) is delegated to D3 submodules — only the rendering layer is replaced.

The **scatter chart** makes this concrete: 100k+ points draw in a single `ParticleContainer` batch and hover hit-testing stays sub-frame via `d3-quadtree` spatial indexing — no linear scans, no per-point sprites. A live `dev/scatter-perf.html` harness benchmarks it at 1k / 10k / 100k / 1M.

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
- [x] **Area** — single- or multi-series filled area with a stroked top edge; same series composition, downsampling, and interaction as Line. Baseline projects zero through the y-scale (handles domains that don't include or that cross zero). Stacking not yet supported.
- [x] **Bar** — single series, vertical or horizontal (`options.orientation`). Per-bar color via a categorical color encoding (color by the category field for one color per bar). Baseline projects zero through the value scale, so negative values and domains that don't include zero render correctly. Grouped / stacked (multi-series) bars not yet supported.
- [x] **Scatter** — handles **100k+ points at 60fps** via a single PixiJS v8 `ParticleContainer` (one batched draw call) and `d3-quadtree` spatial indexing for sub-frame hover hit-testing. Quantitative or temporal x/y; optional **continuous colour** (sequential scheme, default viridis, with a gradient legend) or categorical colour; optional **size** encoding on a square-root scale (area ∝ value).
- [x] **Heatmap** — categorical × categorical grid coloured by a quantitative value field, rendered via a buffer-backed `PIXI.Texture` (PIXI v8's `BufferImageSource` with `scaleMode: 'nearest'` for crisp cell edges) stretched across the plot area in a **single draw call** regardless of grid size. Always pairs with a continuous gradient legend. Sparse `(x, y)` pairs render transparent. v1 does not auto-bin continuous data — pre-bin upstream and pass `type: 'categorical'`.
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

### Scatter performance harness

`packages/pixi-charts/dev/scatter-perf.html` benchmarks ScatterChart at 1k / 10k / 100k / 1M points (on-page FPS + `render()` timer). It loads the built bundle, so run `pnpm build` first, then serve the **`dev/` directory** and open it at the server root:

```sh
pnpm build
npx vite packages/pixi-charts/dev      # or: npx serve packages/pixi-charts/dev
# open  http://localhost:<port>/scatter-perf.html      ← note: NOT /dev/scatter-perf.html
```

The page is served from the `dev/` root, so the path is `/scatter-perf.html`. Requesting `/dev/scatter-perf.html` hits the SPA fallback and silently serves the LineChart demo (`index.html`) instead. The 1M tier intentionally stresses the architecture and briefly blocks the main thread while it allocates — that's the stress ceiling, not a hang.

## License

MIT © Siraj Sharma. See [`LICENSE`](./LICENSE).
