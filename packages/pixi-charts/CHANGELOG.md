# pixi-charts

## 0.1.0

### Minor Changes

- 8df9df6: Add `showAxes`, `showGrid`, and `axisTitles` options to `ChartOptions`. Charts can now opt out of axis rendering entirely (sparkline embeds, hero charts), toggle gridlines independently, and label axes with semantic titles. `showAxes: false` combined with `showGrid: true` puts the axis into a grid-only mode that draws gridlines without the axis line, tick marks, tick labels, or title. All three options default to behavior that preserves existing rendering — no breaking changes. Inert for pie charts.
- 5f781be: Add a click event API to every chart. `chart.on('click', handler)` fires a `ChartClickEvent` with the clicked datum, its index in the data array, the click position (plot-area-local pixels), and — for multi-series Line and Area charts — the series name. Returns an unsubscribe function; `chart.off(...)` and `destroy()` also clear handlers. Available on all six chart types.

  Pair this with `chart.update(newData)` to build instant drilldown: clicking reports what was clicked, your application decides what each click means, and `update()` swaps the data without recreating the WebGL context. The library stays a renderer; the navigation pattern lives in your code. See the new **Interactions → Click** page in the docs for a worked example.

  Click semantics now follow the conventional `pointerdown` → `pointerup` contract with thresholds (≤ 5 px movement, ≤ 500 ms duration), so clicks no longer fire mid-drag or during a long press.

- ee968e4: Add hover decorations to all six chart types. The data element under the cursor now receives a chart-appropriate highlight: line/area charts show a marker at the active point, bars lighten, scatter points enlarge, heatmap cells and pie slices show a white border. Decorations animate in over 120ms and respect `prefers-reduced-motion`. No public API changes.
- 3756dff: Add `theme: 'light' | 'dark'` and per-color overrides (`colors.axis`, `colors.label`, `colors.grid`, `colors.legendText`) to `ChartOptions` for dark-mode support. Band-axis margins now size to fit category labels (capped, with ellipsis truncation for very long labels), fixing clipping on horizontal bar charts and either-axis clipping on heatmaps. Tooltips now flip and clamp to stay fully within the chart container near edges, including when the tooltip is larger than the container. Defaults preserve existing light-theme rendering.
- 5c9ff1b: Add `pointRadius` and `pointAlpha` to `ChartOptions` for `type: 'scatter'`. `pointRadius` sets a fixed marker radius in CSS pixels, overriding the default and any `size` encoding so dense scatters can use uniform small markers and let density emerge from overlap. `pointAlpha` multiplies the rendered alpha of the entire point cloud in `[0, 1]`, letting overlapping points accumulate into a density gradient. Both options are scatter-only; the validator allows them on any spec but other chart types ignore them. No breaking changes.
- c404437: Add three internal core primitives that future chart implementations will compose:
  - `core/ColorScheme` — typed wrappers for a curated subset of `d3-scale-chromatic` categorical palettes (`category10`, `tableau10`, `set2`, `paired`) and sequential interpolators (`viridis`, `blues`, `inferno`, `plasma`), plus `getCategoricalColor` / `getSequentialColor` / `cssColorToPixi` helpers returning PIXI numeric colors.
  - `core/Tooltip` — DOM-based tooltip overlay with inline styling, XSS-safe string content, optional HTMLElement content, and edge avoidance against the host container's bounding rect.
  - `core/Axis` — PIXI-rendered axis (top / right / bottom / left) supporting linear, band, time, and log scales with optional gridlines, custom tick formatters, and a `update()` / `destroy()` lifecycle.

  These modules are not yet re-exported from the public `src/index.ts` — they ship as internal building blocks and will become part of the public API when the first chart consumes them.

- 8a747de: Add two internal core primitives that future chart implementations will compose:
  - `core/Legend` — PIXI-rendered chart legend with two modes: **categorical** (rows or columns of swatch + label pairs) and **continuous** (a gradient bar built from a sequential `ColorScheme` with `[min, max]` end labels). Provides `width` / `height` getters (manually tracked, no `getBounds()` dependency) so consumers can lay out the legend relative to other chart elements. `update()` supports same-mode partial merges as well as full mode-switches; `destroy()` is idempotent and releases GPU-backed `Text` textures.
  - `core/InteractionLayer<D>` — scale-agnostic pointer-event abstraction over PIXI's federated event system. The consumer supplies a `HitTester<D>` (the layer itself does not import `ScaleAdapter`); the layer dispatches normalized `hover` / `click` / `leave` events with hover-deduplication, primary-button-only clicks, and plot-area-local coordinates plus page-coordinate `globalPosition` for DOM tooltip positioning. The state machine is extracted into a pure `handlePointerSample` helper so its hover/click/leave logic is testable in isolation, independent of PIXI's event simulation.

  Both modules are not yet re-exported from the public `src/index.ts` — they ship as internal building blocks and will become part of the public API once the first chart consumes them.

- a4329ac: First end-to-end chart and the declarative spec API. After this release, `pixi-charts` is usable: a consumer can describe a chart as a JSON-shaped `ChartSpec` and hand it to a single `render()` call.

  **New public API**
  - `render(spec, container): Promise<Chart>` — primary entry point. Validates the spec, dispatches on `spec.type`, awaits PixiJS's async `Application.init()`, runs the first render, and returns the fully-rendered chart instance. The returned `Promise` reflects the fact that PIXI v8 requires `await app.init(...)` — a synchronous signature would force handing back a half-built chart.
  - `validateChartSpec(input): ChartSpec` and the `ChartSpecValidationError` class — runtime validator built on zod with intentionally teaching error messages: every issue includes its path, the received value, the expected shape, and (where useful) a minimal example. Unknown top-level keys do not fail validation; they emit a `console.warn` for forward compatibility.
  - `LineChart` (imperative escape hatch) — composes `Axis × 2`, optional `Legend` and `Tooltip`, and an `InteractionLayer` whose `HitTester` is built using the `ScaleAdapter`'s `kind` discriminator (`invert()` + binary search for continuous / time x-axes; band-iteration for categorical x-axes). The `Series` / `SeriesPoint` types and a pure `createLineHitTester` helper are exported alongside the class so the hit-test strategy can be unit-tested in isolation.
  - Type re-exports: `ChartSpec`, `ChartType`, `ChartEncoding`, `EncodingField`, `ColorEncoding`, `ChartOptions`, `AnimationOptions`, `FieldType`.

  **Internal additions**
  - `utils/lttb.ts` — Largest Triangle Three Buckets downsampling. LineChart routes any series with more than 10,000 points through this with a threshold of 2,000, preserving the first/last points and a recognizable shape.

  **Removed from the public surface**

  The previously exported `tween` / `easings` helpers and the `EasingName` / `TweenOptions` / imperative `ChartOptions` types are no longer re-exported from `src/index.ts`. They remain internal building blocks; reach for them via the imperative API only if you're authoring a chart that lives outside this package. We can promote them back to the public surface later if demand justifies the API-stability cost.

- ce70a86: Add `AreaChart` — single- and multi-series filled area charts with the same encoding, scales, downsampling, and interaction as `LineChart`. The fill closes along zero projected through the y-scale, so the baseline is correct even when the y-domain doesn't include or crosses zero; a 2px stroked top edge is drawn over the fill. Stacking is intentionally not implemented (multi-series areas overlap at 0.4 fill alpha).

  **New public API**
  - `AreaChart` (imperative escape hatch) — re-exported from the package root alongside `LineChart`. The spec API needs no new exports: `render()` now dispatches `type: 'area'`.

  **Internal refactor**
  - The cartesian line-family logic shared by Line and Area (series grouping, LTTB downsampling, scale/adapter/`Axis` construction, hit-testing, tooltip formatting, margin/size resolution) was extracted into an internal `charts/_shared/cartesian.ts` module consumed as plain functions. Both chart classes continue to extend `Chart` directly — composition, not inheritance. `LineChart`'s observable behavior is unchanged; its `Series` / `SeriesPoint` / `Hit` / `XValue` types and `createLineHitTester` remain exported (now aliases over the shared definitions).

  **Behavior change**
  - A `console.warn` is now emitted (for every cartesian chart) when a `color` encoding produces more than 20 distinct series, since categorical palettes wrap and colors would silently repeat.

- 88eb271: Add `BarChart` — single-series bar charts in both vertical (default) and horizontal orientation, selected via the new `options.orientation` field. A vertical and a horizontal bar chart are the same chart with the axes swapped, so this is one class with an orientation branch, not two chart types; the `ChartType` union stays `'bar'`.

  **New public API**
  - `BarChart` exported from the imperative API.
  - `render({ type: 'bar', ... }, container)` now dispatches to `BarChart`.
  - `ChartOptions.orientation?: 'vertical' | 'horizontal'` — currently meaningful only for `type: 'bar'` (band scale on x for vertical, on y for horizontal); ignored by line/area and every other type (no warn, no error).

  **Behavior**
  - Per-bar color: with no `encoding.color`, all bars take the default scheme's first color; with a categorical color encoding, each bar is colored by its color-field value (coloring by the category field yields one color per bar). Above 20 distinct color values a `console.warn` fires.
  - Bars grow from `valueScale(0)` — zero projected through the value scale — so negative values render on the opposite side of the baseline and a value domain that doesn't include zero still projects correctly.
  - Discrete-rectangle hit-testing (band containment + value-extent containment), tooltip (`category • value`), legend (only when a categorical color encoding distinguishes ≥2 values), enter animation (bars grow from the baseline), resize, and idempotent destroy.

  **Scope**

  Single series only. Grouped and stacked (multi-series) bars are intentionally out of scope. The cartesian line-family shared module is unchanged except for one additive helper (`formatCategoryValueTooltip`); `LineChart` / `AreaChart` behavior is unaffected.

- 54ea2fd: Add `ScatterChart` — the library's performance flagship, rendering **100k+ points at 60fps** via a single PixiJS v8 `ParticleContainer` (one batched draw call) with `d3-quadtree`-backed spatial indexing for sub-frame hover hit-testing.

  **New public API**
  - `ScatterChart` exported from the imperative API.
  - `render({ type: 'scatter', ... }, container)` now dispatches to `ScatterChart`.
  - `ColorEncoding.type?: 'categorical' | 'quantitative'` — the colour channel can now be **continuous**. Quantitative colour maps through a sequential interpolator (default **viridis**, perceptually uniform / colourblind-safe) and pairs with a continuous gradient legend. Line/area/bar remain categorical-only and ignore `type`.
  - `encoding.size` is now consumed (scatter only): values drive a **square-root** radius scale (`[3, 12]` px) so that _area_ ∝ value — not radius ∝ value, which would overstate large values quadratically.

  **Behaviour**
  - Both positional axes are continuous (quantitative or temporal); categorical x/y is rejected at validation with a teaching error (use a bar chart instead). Quantitative-colour and size fields are sanity-checked with warnings (non-numeric colour values, negative sizes) rather than hard failures.
  - One white circle texture, tinted per-particle (PIXI v8 supports per-particle `tint` over a shared texture in a single batch — the v7 "pre-bake one texture per colour" workaround is unnecessary). Exactly one GPU texture per instance, explicitly freed on destroy and before each rebuild (the base class's `app.destroy({ texture: false })` does not free it).
  - Hover tooltip (`x • y • colour • size`), continuous _or_ categorical legend, alpha fade-in enter animation (one value/frame — free at 1M points; honours `animation.enter` and reduced-motion), resize re-projection + spatial-index rebuild, idempotent destroy.

  **New internals**
  - `utils/quadtree.ts` — `SpatialIndex<D>` / `SpatialRecord<D>`, a thin `d3-quadtree` wrapper for `O(log n)` nearest-point queries, reusable by future spatially-indexed charts.

  **Bug fix (all charts)**

  Fixed a crash when the container resizes while the enter animation is still running: `render()` now cancels the previous pass's in-flight tween (`this.cancelAllTweens()`) before tearing down its render targets. Previously the tween's next tick drew into a just-destroyed `Graphics` (line/area/bar) or a freed particle buffer (scatter) and PixiJS threw. This reproduced on a normal page load because the browser's `ResizeObserver` fires an initial callback immediately after `observe()`, overlapping the enter animation. A new regression test (`tests/charts/resize-tween-safety.test.ts`) covers all four charts; the gap existed because the test-suite's mock `ResizeObserver` never auto-fires. ScatterChart additionally now keeps a single `ParticleContainer` + texture for its lifetime and updates particle transforms in place on resize (per the prompt's resize guidance), rather than destroying/recreating them.

  **Scope**

  Static view only: no zoom/pan/brush, no multi-series shapes, circles only, no jitter, no size legend (a deliberate future addition). The cartesian line-family shared module is **unchanged** — scatter's ungrouped, two-continuous-axis setup is built inline (an integration finding: `buildCartesianSetup` is series-shaped and was deliberately not coerced). Line/Area/Bar behaviour and tests are unaffected.

- 647a4ca: Add `HeatmapChart` — categorical × categorical grid coloured by a quantitative value field, rendered via PIXI v8 **texture-from-buffer** (one draw call regardless of grid size).

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
  - `scaleMode: 'nearest'` (the v8 string literal — _not_ the v7 numeric `SCALE_MODES.NEAREST`) keeps cell edges crisp; linear interpolation would blur cell boundaries.
  - The texture is freed in `destroy()` via `texture.destroy(true)` — same GPU-memory discipline `ScatterChart` established for its shared particle texture, and covered by an explicit test.

  **Scope**

  No enter animation (heatmaps don't animate well in v1 — left-to-right reveals don't fit a grid, per-cell cascades look gimmicky at any realistic size). No cell-value text labels. No automatic binning. No custom shaders. The cartesian shared module is **unchanged** — heatmap's two-band-axes, ungrouped grid is built inline (third chart now that bypasses `buildCartesianSetup`; flagged as an integration finding rather than a refactor). Line/Area/Bar/Scatter behaviour and tests are unaffected.

- c5627e5: Add `PieChart` — categorical proportions of a whole, supporting both **pie** (`innerRadius: 0`, the default) and **donut** (`innerRadius > 0`) variants from a single class. This completes the v0.1 chart roster: `render({ type, ... })` now dispatches every planned chart type (line, area, bar, scatter, heatmap, pie).

  **New public API**
  - `PieChart` exported from the imperative API.
  - `render({ type: 'pie', ... }, container)` dispatches to `PieChart`. The dispatcher now uses a TypeScript exhaustiveness assertion (a `never` check) so adding a future `ChartType` becomes a compile-time error rather than a silent runtime gap. The "not implemented yet" branch is removed.
  - `ChartOptions.innerRadius` and `ChartOptions.startAngle` are new pie-only options on the shared `ChartOptions` shape — same scoping pattern as `orientation` (lives at the top level, validator ignores them on non-pie specs). `innerRadius` is clamped to `[0, outerRadius − 1]` at render time; `startAngle` defaults to `-Math.PI / 2` (12 o'clock).
  - `encoding.value` now has its first consumer: the numeric field whose magnitudes are summed and divided proportionally into slice angles.

  **Behaviour**
  - `encoding.x` (categorical) names each slice and `encoding.value` carries its magnitude. Both are required; the validator throws teaching errors when missing or mistyped. `encoding.color` is optional — when omitted slices take distinct colors from `category10`; when present, the color field's distinct values drive a categorical palette assignment (so coloring by the category field yields one color per slice, the natural case). Quantitative color is rejected at validation — pies use categorical color.
  - Zero or missing value rows are warned at validation (not rejected). Negative or zero values are dropped at render time so they don't pollute the slice list with invisible records. A total of zero after dropping logs a warning and short-circuits to an empty plot rather than crashing on a NaN angle.
  - **Parallel sweep enter animation** — all slices grow simultaneously from `startAngle`, finishing together. Honors `spec.animation.enter: false` and `prefers-reduced-motion: reduce` via the shared `tween()`.
  - Categorical `Legend` (vertical, top-right of plot area) shows when there are 2+ slices; a single-slice (full-disc) pie suppresses it. `showLegend: false` also suppresses.
  - Tooltip carries category, raw value (`d3-format ',.2~f'`), and percent-of-total (`d3-format '.1%'`).
  - **Polar hit-testing** in `utils/geometry.ts` — pointer offset from center is converted via `pointToAngle(dx, dy)` (atan2 normalized to `[0, 2π)`, screen-coordinate convention documented in JSDoc and pinned by 4 cardinal-direction unit tests). `pointInRing` rejects points outside the ring (including donut-hole rejection), and `angleInRange` correctly handles the wraparound case where a slice crosses the `2π → 0` boundary. Pure functions, fully unit-tested without a PIXI app, mirroring the `lttb` / `quadtree` discipline.

  **Rendering**
  - Slices drawn into a single `PIXI.Graphics` using v8's Canvas-style `.arc(cx, cy, r, start, end, ccw?)` (verified against `pixi.js@8.18.1` source). The pie path is `moveTo center → arc → closePath`; the donut path is `moveTo inner-start → lineTo outer-start → arc outer (forward) → lineTo inner-end → arc inner (counter-clockwise) → closePath`. One Graphics instance for all slices; batched fills.
  - Centered in the plot area with `outerRadius = min(plotW, plotH) / 2 − 8`. Pie-specific 16px uniform default margins (no axis-margin allocations).

  **Integration / pressure-test findings**

  This was the architectural pressure-test session — pie is the first chart with no axes, no d3 scales, no rectangular hit regions. **Zero primitive bugs were surfaced**, and the audit found no hidden coordinate-compensation in `PieChart.ts` either. The abstractions held:
  - `InteractionLayer`'s scale-agnostic, plot-area-local coordinate contract (its JSDoc already named pies as a use case) integrated verbatim — the rectangular hit-test sprite still works because the polar hit-tester rejects out-of-ring points.
  - `Chart` base class has no shape assumptions — subclasses own all layout math, so `PieChart`'s no-axes layout slotted in without changes.
  - `Legend` is position-agnostic; placing it in an axis-free top-right corner needed no Legend changes.
  - `Tooltip` is point-based and reused as-is.

  The only test-infrastructure addition was extending `MockGraphics` with `arc()` and `arcCalls` so slice geometry can be asserted in unit tests — mirroring how prior chart sessions added `rectCalls` and similar.

  **Scope**

  No slice labels (inside or outside slices). No exploded slices. No leader lines. No multi-ring donuts or sunburst charts. No click handlers beyond what `InteractionLayer` natively emits (v1 ignores click). The cartesian shared module is **unchanged**; PieChart inlines its tiny utility functions rather than coupling to cartesian abstractions. Line/Area/Bar/Scatter/Heatmap behaviour and tests are unaffected — all 354 prior tests continue passing alongside the new 60 pie / geometry / validate tests, total **383 passing**.

  **Bundle size**: 30.0 KB gzipped (`gzip -c dist/index.js | wc -c` → 30,643 bytes), up from 26.1 KB at the end of Session 8 (+3.9 KB for PieChart + geometry helpers + pie validation). Still under the package's <50 KB target.

- 1b54739: Add `chart.update(newData, options?)` to update a chart's data without recreating the WebGL context. Reuses the existing PixiJS application, scales infrastructure, axes, legend, and interaction layer; recomputes scales, geometry, axes, and hit-testing from the new data. Enables interactive and streaming use cases that previously required a full re-render. Updates snap instantly by default; pass `{ animate: true }` for tweened transitions where supported (bar and pie when the category set is unchanged — other charts always snap). Changing chart type, encoding, or orientation still requires a fresh `render()`.

### Patch Changes

- bfca264: Tooltip now follows the cursor smoothly while hovering within a single data point's region, not just when crossing between data points. Most visible on BarChart and PieChart where individual hit regions are large. Adds an `isNewDatum` flag to hover events so consumers can skip redundant content re-renders. No public API changes.
- 1b54739: Fill in the real GitHub URL (`sirajsharma/pixi-charts`) for the `homepage`, `repository`, and `bugs` package.json metadata fields, replacing the previous `TODO` placeholder. No code or API change — only the published package's links are affected.
- 4e33e5a: Fix continuous legend formatting and move legends outside the plot area.

  **Continuous legend formatting.** The default `d3-format` specifier for the min/max labels on a continuous legend was `.3~s`, which applies SI prefixes — a ScatterChart value of `0.870` rendered as `"870m"` (milli), and similar surprises across normal numeric ranges. Default is now `~g` (general number with trimmed trailing zeros), which produces plain readable labels across the common ranges. Consumer overrides via `ContinuousLegendOptions.tickFormat` are unchanged.

  **Legend placement.** Every chart with a legend (Line, Area, Bar, Scatter, Heatmap, Pie) was positioning it inside the plot area's top-right corner, where it overlapped the rendered marks. Legends now sit to the right of the plot, in their own column — the plot's width is reduced by `legend.width + 12px` to make room. A new pure helper `core/layout.ts` (internal) centralises the math.

  No public API changes; the spec, exports, and `showLegend` semantics are unchanged. The rendered output is visibly better in the all-charts harness.

- e66bd00: Fix chart layout calculations using internal pixel buffer dimensions instead of logical CSS dimensions. On high-DPI displays (devicePixelRatio > 1), charts were rendering at approximately half the intended size, occupying the top-left of their containers. All six chart types are affected and fixed. No public API changes.
- f580aa6: Improve JSDoc on the public API surface so the generated reference renders
  with examples and complete parameter info. Adds `@example` blocks to the
  six chart classes (`LineChart`, `AreaChart`, `BarChart`, `ScatterChart`,
  `HeatmapChart`, `PieChart`) and the `Chart` base class, and adds
  `@param` / `@returns` / `@throws` / `@example` to `validateChartSpec`
  (whose existing documentation block was orphaned from the function
  declaration — now properly attached). No public API changes.
- 4c69ce6: Internal: refactor `Axis` to consume a new `ScaleAdapter<TDomain>`
  abstraction instead of raw d3 scales. `Axis` is now generic over its
  scale's domain type, so tick formatter callbacks receive correctly typed
  values (`number`, `string`, or `Date`) instead of a union — no more
  narrowing at the call site. The `isBandScale` predicate and the
  `ContinuousScale` projection cast are gone, replaced by adapter
  delegation. No public API change: both `Axis` and `ScaleAdapter` remain
  internal until a chart consumes them.
- 3766e3d: Fix tooltip positioning when the chart container isn't already a positioning context. The `Tooltip` element is `position: absolute`, which resolves against the nearest positioned ancestor — not the DOM parent. If the host container defaulted to `position: static`, the tooltip anchored to a higher ancestor (often `<body>`) and appeared far from the chart, sometimes overlapping a different chart's card in multi-chart layouts. `Tooltip` now promotes a static parent to `position: relative` at construction; non-static parents (relative/absolute/fixed/sticky) are left alone. `relative` has no visual side effect on the parent's own layout. No public API changes.
