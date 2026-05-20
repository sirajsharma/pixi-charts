---
"pixi-charts": minor
---

Add `HeatmapChart` — categorical × categorical grid coloured by a quantitative value field, rendered via PIXI v8 **texture-from-buffer** (one draw call regardless of grid size).

**New public API**

- `HeatmapChart` exported from the imperative API.
- `render({ type: 'heatmap', ... }, container)` now dispatches to `HeatmapChart`. The dispatcher's "not implemented" message lists only `pie` going forward.
- `encoding.value: { field: string }` is now consumed (heatmap): the per-cell numeric magnitude that drives the colour scale's input.

**Behaviour**

- Both positional axes are band scales over discrete categories. v1 does **not** auto-bin continuous values into cells — pre-bin upstream and pass `encoding.x.type` / `encoding.y.type` as `'categorical'`. Quantitative or temporal x/y is rejected at validation with a teaching error pointing at the pre-binning scope decision.
- `encoding.color` is **required** and must be `'quantitative'` (validated). Default scheme `viridis` (perceptually uniform, colourblind-safe). A categorical-colour heatmap is a different chart (closer to a confusion matrix) and not in scope for v1.
- Y convention: insertion-order y-category index 0 lives at the top of the plot (screen-top), labels run top-to-bottom — the common heatmap convention.
- Sparse cells (missing `(x, y)` pairs) render as `(0, 0, 0, 0)` — fully transparent — so the container background shows through. The hit-tester returns `null` for sparse positions; no stale tooltips.
- Always a continuous gradient `Legend` (top-right of the plot, same placement as scatter's continuous legend).
- Hit-testing iterates the two band domains to resolve `(xCategory, yCategory)` then `O(1)`-looks up the cell record in a 2D `Map` built once per render.
- Duplicate `(x, y)` pairs are warned at validation (last-write-wins at render time) rather than hard-failed — almost always an upstream aggregation bug worth surfacing.

**Rendering**

- The cell colours are packed into a `Uint8ClampedArray` RGBA buffer at **grid resolution** (`xCategories.length * yCategories.length * 4` bytes) and wrapped in a single `PIXI.Texture` via `BufferImageSource` (PIXI v8's texture-from-buffer API: `new BufferImageSource({ resource, width, height, scaleMode: 'nearest' })`). A `Sprite` stretches that tiny texture across the plot area — one draw call regardless of grid size, GPU-native scaling, and resize is free (the sprite changes pixel dimensions; the texture is reused).
- `scaleMode: 'nearest'` (the v8 string literal — *not* the v7 numeric `SCALE_MODES.NEAREST`) keeps cell edges crisp; linear interpolation would blur cell boundaries.
- The texture is freed in `destroy()` via `texture.destroy(true)` — same GPU-memory discipline `ScatterChart` established for its shared particle texture, and covered by an explicit test.

**Scope**

No enter animation (heatmaps don't animate well in v1 — left-to-right reveals don't fit a grid, per-cell cascades look gimmicky at any realistic size). No cell-value text labels. No automatic binning. No custom shaders. The cartesian shared module is **unchanged** — heatmap's two-band-axes, ungrouped grid is built inline (third chart now that bypasses `buildCartesianSetup`; flagged as an integration finding rather than a refactor). Line/Area/Bar/Scatter behaviour and tests are unaffected.
