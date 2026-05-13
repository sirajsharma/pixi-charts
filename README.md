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
// API sketch — coming in a subsequent release.
import { render } from 'pixi-charts';

render(
  {
    type: 'line',
    data: [
      { x: 0, y: 10 },
      { x: 1, y: 20 },
    ],
    encoding: { x: 'x', y: 'y' },
  },
  document.getElementById('chart')!,
);
```

## Coming soon

Six chart types are planned for v1:

- [ ] Line
- [ ] Area
- [ ] Bar
- [ ] Scatter
- [ ] Heatmap
- [ ] Pie / Donut

This repository currently ships only the foundation: the `Chart` abstract base class and a ticker-based `tween()` animation helper. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the architectural principles every chart implementation will follow.

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
