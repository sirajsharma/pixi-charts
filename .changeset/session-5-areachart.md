---
"pixi-charts": minor
---

Add `AreaChart` — single- and multi-series filled area charts with the same encoding, scales, downsampling, and interaction as `LineChart`. The fill closes along zero projected through the y-scale, so the baseline is correct even when the y-domain doesn't include or crosses zero; a 2px stroked top edge is drawn over the fill. Stacking is intentionally not implemented (multi-series areas overlap at 0.4 fill alpha).

**New public API**

- `AreaChart` (imperative escape hatch) — re-exported from the package root alongside `LineChart`. The spec API needs no new exports: `render()` now dispatches `type: 'area'`.

**Internal refactor**

- The cartesian line-family logic shared by Line and Area (series grouping, LTTB downsampling, scale/adapter/`Axis` construction, hit-testing, tooltip formatting, margin/size resolution) was extracted into an internal `charts/_shared/cartesian.ts` module consumed as plain functions. Both chart classes continue to extend `Chart` directly — composition, not inheritance. `LineChart`'s observable behavior is unchanged; its `Series` / `SeriesPoint` / `Hit` / `XValue` types and `createLineHitTester` remain exported (now aliases over the shared definitions).

**Behavior change**

- A `console.warn` is now emitted (for every cartesian chart) when a `color` encoding produces more than 20 distinct series, since categorical palettes wrap and colors would silently repeat.
