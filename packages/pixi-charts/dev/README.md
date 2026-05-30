# pixi-charts dev harness

This directory contains internal development harness pages. They are not part of the published library, not linked from the docs site, and not for end users.

## `all-charts.html` — verification harness

Renders all six chart types (Line, Area, Bar, Scatter, Heatmap, Pie/donut) side by side in a single page. Use this before every release, after any primitive-layer change (Axis, Tooltip, Legend, InteractionLayer, animation), and whenever a visual regression is suspected. The page shows the total load time once all charts resolve, and the footer embeds the verification checklist so it travels with the tool.

Open it with a static file server after building the library:

```sh
pnpm build            # or: pnpm --filter pixi-charts build
npx serve packages/pixi-charts
# then open http://localhost:3000/dev/all-charts.html
```

**Important:** serve from `packages/pixi-charts` (not `dev/`) so that
`/node_modules/pixi.js/dist/pixi.mjs` is reachable — the import map in the
HTML resolves pixi.js locally. The d3 packages and zod are fetched via esm.sh
CDN on first load (cached by the browser after that), so internet access is
required the first time.

Walk through the footer checklist in a real browser — check tooltips, enter animations, resize behavior, and the DevTools console. If you see something unexpected, note it and open a separate fix session rather than patching it here.

## Individual chart harness pages

Each page isolates one chart for deeper verification:

- **`index.html` / `main.js`** — Line chart, basic time-series.
- **`scatter-perf.html` / `scatter-perf.js`** — Scatter performance harness. Switchable 1k/10k/100k/1M point tiers. FPS meter and per-render wall-time display. Verifies the headline "interactive at the 100k-point regime" claim and O(log n) hit-testing via d3-quadtree.
- **`heatmap.html` / `heatmap.js`** — Heatmap with a full 24×7 grid and a sparse variant (15% of cells omitted). Verifies cell rendering, the continuous color legend, and sparse-data transparency.
- **`pie.html` / `pie.js`** — Pie and donut side by side. Verifies the transparent donut hole (striped page background intentionally shows through), the sweep enter animation, and hit-testing at cardinal positions.

Use these pages when you need to verify a specific chart type in isolation, run a perf regression, or step through edge cases that don't surface in the unit tests.

## Workflow before a release or merge

1. Run `pnpm build` to get a fresh bundle.
2. Open `all-charts.html` and walk the verification checklist.
3. If anything fails or looks wrong, do not merge — open a fix session first.
4. After the checklist passes, open individual harness pages for any chart type touched by the change.
5. Only then merge, tag, and proceed to the docs-site rebuild.
