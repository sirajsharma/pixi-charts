# Pixi Charts — Session 8: HeatmapChart (Completes the Chart Set)

## Context

This is Session 8 of building `pixi-charts`. Sessions 1–7 are complete:

- **Session 1** — Project scaffolding, `Chart` base class, `tween()`.
- **Session 2** — `ColorScheme`, `Tooltip`, `Axis`.
- **Session 2.5** — `ScaleAdapter` interface and adapters.
- **Session 3** — `Legend`, `InteractionLayer`.
- **Session 4** — `ChartSpec` API, dispatcher, `lttb`, `LineChart`, public API surface.
- **Session 5** — `AreaChart`, `charts/_shared/cartesian.ts`.
- **Session 6** — `BarChart` (vertical + horizontal, single series).
- **Session 7** — `ScatterChart`, `utils/quadtree.ts`, continuous color encoding, size encoding, perf harness.

All prior code is in place with passing tests. Four charts ship working; the 100k-points-at-60fps claim is verified.

**Before starting, read `CLAUDE.md` at the repo root**, and especially:

- `charts/ScatterChart.ts` — the precedent for continuous color encoding and texture-from-buffer thinking.
- `charts/BarChart.ts` — the precedent for two-band-axes layout (vertical bars use band on x; heatmaps use band on both).
- `charts/_shared/cartesian.ts` — what it currently supports and what it doesn't.

After Session 8 the chart roster is complete (Line, Area, Bar, Scatter, Heatmap, Pie planned for Session 9). This is the last "fundamentally different rendering approach" session — Heatmap's texture-from-buffer technique is the third major rendering strategy in the library (after Graphics-stroke and ParticleContainer-sprites).

## What This Session Delivers

1. **`charts/HeatmapChart.ts`** — A grid heatmap with categorical-categorical or binned-continuous axes, rendered via a procedurally-generated texture.
2. **`spec/ChartSpec.ts` updates** — Ensure the `value` encoding field is properly typed (declared since Session 4 but unused until now).
3. **`spec/validate.ts` updates** — Heatmap encoding rules.
4. **`spec/render.ts` updates** — Dispatcher handles `type: 'heatmap'`.
5. **`src/index.ts` update** — `HeatmapChart` exported.
6. **Possible additions to `charts/_shared/cartesian.ts`** — only if genuinely warranted. Resist over-sharing per the discipline established in Sessions 5/6/7.
7. **Dev harness page for heatmap** — verifies the texture-from-buffer approach renders correctly in-browser.

## Architectural Decisions (Locked Before Implementation)

### Decision 1: Texture-from-buffer rendering, not Graphics rectangles or shaders

For an MxN grid of colored cells, three rendering approaches:

- **`PIXI.Graphics` drawing M\*N rectangles** — works for tiny grids (10×10) but degrades fast. A 100×100 heatmap is 10,000 rectangles; not viable as a default.
- **Custom WebGL fragment shader** — fastest possible, but the same complexity-cost argument from Session 7 applies. Save for a future optimization pass.
- **Texture-from-buffer** — generate a tiny pixel buffer where each pixel corresponds to one grid cell (or NxN pixels per cell for crispness), wrap it in a `PIXI.Texture` via `PIXI.Texture.fromBuffer` (or v8's equivalent — check the current API), then render as a single `PIXI.Sprite` stretched to fill the plot area. **One draw call, regardless of grid size**, GPU-native scaling, trivially performant.

**Use texture-from-buffer.** Document the choice in JSDoc with a note that custom shaders are a future optimization (same pattern Session 7 established for ParticleContainer).

Important detail: when the texture is scaled up to fill the plot area, **set the texture's scale mode to `NEAREST`** (not the default LINEAR). Linear interpolation between cells produces fuzzy gradients across cell boundaries, which is wrong for discrete heatmap cells. Nearest-neighbor gives crisp cell edges. In PIXI v8, this is set on the texture's source's `scaleMode` — verify the current API.

### Decision 2: Two axis types supported, no binning logic in v1

Heatmaps can have:

- **Categorical × Categorical** — both axes are band scales over discrete categories (e.g., day-of-week × hour-of-day).
- **Categorical × Quantitative-pre-binned** — one categorical, one quantitative where the consumer has already bucketed values into discrete cells.

In both cases, **the consumer has already aggregated their data into one row per cell.** This session does NOT implement automatic binning of raw continuous data. That's a separate feature with its own design questions (bin count? bin boundaries? equal-width vs. equal-frequency?). If a consumer wants a heatmap of continuous data, they bin first, then pass the binned data.

For v1, both axes are effectively treated as categorical. The categorical-quantitative case is handled by treating the quantitative axis's distinct values as ordered categories (sort them). Document this clearly — it's a real scope limit, not a bug.

### Decision 3: Color encoding is required, must be quantitative

A heatmap without color encoding is meaningless — color IS the chart's primary visual channel. Validate this:

- `encoding.color` MUST be present.
- `encoding.color.type` MUST be `'quantitative'`.
- Default scheme: viridis (same perceptually-uniform default as ScatterChart's continuous color).

A categorical-color heatmap is a different chart (more like a confusion matrix) and not in scope.

### Decision 4: Legend is always continuous

Since color is always quantitative, the legend is always Session 3's continuous legend (gradient bar with min/max labels). Same pattern ScatterChart established for continuous color. No legend-type branching.

### Decision 5: Hit-testing is grid-cell lookup, not spatial indexing

Each cell occupies a rectangular pixel region defined by the two band scales. The hit-tester:

1. Convert pointer x to the corresponding x-band using `bandAdapter.scale()` + `bandwidth()` (iterate domain — same band-hit-test strategy BarChart uses).
2. Same for pointer y.
3. Look up the cell record at that (x-category, y-category) position.

No quadtree needed. Heatmap cells are arranged in a regular grid, so lookup is O(1) once you know the band, and band-iteration is fast for any reasonable category count.

**Build a 2D map keyed by `(xCategory, yCategory) → cellRecord`** once per render. The hit-tester consults this map. Rebuild on resize/data-change, same pattern as ScatterChart's SpatialIndex.

### Decision 6: No animation on enter

Heatmaps don't animate well. A "left-to-right reveal" like Line/Area doesn't fit a grid. A per-cell fade-in cascading from top-left looks gimmicky on large grids. A simple opacity fade across the whole thing is fine but minimal value.

**No enter animation for v1.** Heatmap renders to final state immediately. Document in JSDoc as a deliberate choice, not an omission. Consumers wanting animated heatmaps have a specific use case in mind; v1 doesn't speculate.

Still honor `spec.animation.enter: false` — it's already the only behavior. Don't construct a tween that does nothing.

## Scope Boundaries (What NOT to Do)

- Do NOT implement automatic binning of continuous data. Consumers pre-bin.
- Do NOT implement categorical color heatmaps. Color is always quantitative.
- Do NOT implement enter animations. Static render only.
- Do NOT implement cell-value labels (text drawn on each cell showing the value). Nice future polish, not in scope.
- Do NOT implement custom shaders. Texture-from-buffer only.
- Do NOT modify primitives (`Chart`, `animation`, `ScaleAdapter`, `Axis`, `Tooltip`, `Legend`, `InteractionLayer`, `ColorScheme`) unless an integration issue surfaces. Same rule throughout: additive changes okay with a note; signature changes need a pause.
- Do NOT modify existing chart implementations or their tests. Line/Area/Bar/Scatter must continue passing without modification.

## Specific Implementation Requirements

### Step 1: `ChartSpec` and Validation Updates

**`spec/ChartSpec.ts`:**

Verify the `value` encoding field exists; it was declared back in Session 4 as part of the unified spec but never consumed. The current shape should be:

```ts
value?: { field: string };  // pie, heatmap
```

This is fine — `value` for heatmap is the field carrying the numeric value of each cell. No type field needed (it's always quantitative for heatmaps).

If the field doesn't exist or has drifted, add it now with JSDoc explaining its use.

**`spec/validate.ts`:**

Add a `requireHeatmapEncoding` helper validating:

- `encoding.x` present, type `'categorical'` (any other type rejected with a teaching error that mentions the binning-not-supported scope decision).
- `encoding.y` present, type `'categorical'`.
- `encoding.color` present, type `'quantitative'`.
- `encoding.value` present.
- Each row in `data` should ideally have one entry per (x, y) pair. Warn (not error) if duplicate (x, y) keys are found — the chart will pick one arbitrarily, which is probably a data-pipeline bug worth surfacing.

Teaching error messages name the path, show received vs. expected, give an example. Same posture as other validators.

**Tests:**

- Valid heatmap spec passes.
- Missing `encoding.color` throws.
- `encoding.color.type !== 'quantitative'` throws with a message mentioning that heatmaps require quantitative color.
- `encoding.x.type: 'quantitative'` throws with a message mentioning the pre-binning scope decision.
- Missing `encoding.value` throws.
- Duplicate (x, y) pairs in data produces a warning, not an error.

### Step 2: `charts/HeatmapChart.ts`

**Export:**

```ts
import type { ChartSpec } from '../spec/ChartSpec';

export class HeatmapChart extends Chart {
  constructor(opts: { container: HTMLElement; spec: ChartSpec });
  // inherits init(), destroy(), destroyed from Chart
  // overrides protected render()
}
```

**Behavior:**

#### Data transformation

- Extract `xField`, `yField`, `colorField`, `valueField`.
- Determine the unique x-categories and y-categories in insertion order (or sort them if the consumer's data is unsorted — use insertion order; consumer controls ordering by ordering their data).
- Build a 2D lookup: `Map<xCategory, Map<yCategory, { value, color: number, datum }>>`.
- Build the color scale: `scaleSequential` over the value-field extent, using the specified scheme (default viridis). Each cell's color is derived by evaluating the scale at the cell's value, then converted to a PIXI numeric color via the existing `cssColorToPixi` helper from `ColorScheme.ts`.

#### Scales and adapters

- X-axis: `scaleBand<string>()` over unique x-categories, range `[0, plotWidth]`, padding 0 (heatmaps don't have visible gaps between cells by default). Wrap with `bandAdapter`.
- Y-axis: `scaleBand<string>()` over unique y-categories, range `[0, plotHeight]`, padding 0. Wrap with `bandAdapter`.
- Construct two `Axis` instances using the adapters. This is the first chart with **both axes as band scales** — exercises whatever assumptions the Axis primitive may have made about scale types. Pay attention; if `Axis` mispositions labels for band-on-y or band-on-x in ways that look wrong, that's a primitive bug to surface (not a HeatmapChart bug).

Note: heatmaps don't benefit from `buildCartesianSetup` cleanly — it assumes series-grouping logic that doesn't apply. **Build scales inline** rather than forcing it through. Same posture Session 7 took for scatter. Flag this in the summary if it indicates the shared module needs reconsidering after three non-fitting consumers (scatter, heatmap, and ascertaining whether Pie in Session 9 will fit at all).

#### Rendering via texture-from-buffer

This is the new technique for this session.

1. Allocate a `Uint8ClampedArray` of size `(width * height * 4)` for RGBA pixels, where `width` and `height` are the grid dimensions (NOT pixel dimensions — just the cell count). For a 50×30 heatmap, that's `50 * 30 * 4 = 6000` bytes.
2. Walk the cell records and write each cell's RGBA color into the buffer at the corresponding position. RGBA values are 0–255 each; alpha is always 255 for present cells. For missing cells (a sparse heatmap where some (x, y) pairs have no data), write `(0, 0, 0, 0)` — fully transparent.
3. Create a `PIXI.Texture` from this buffer using PIXI v8's texture-from-buffer API (this may be `PIXI.Texture.from({ source: ... })` or `PIXI.Texture.fromBuffer(...)` — check the current v8 docs and follow what works).
4. Set the texture's scale mode to NEAREST (so cells stay crisp when scaled up).
5. Create a `PIXI.Sprite` from this texture. Set the sprite's width to `plotWidth` and height to `plotHeight`. Position at the plot origin.
6. Add the sprite to the stage. That's the entire heatmap, rendered in one draw call.

Important: the buffer layout follows row-major order, and PIXI textures' Y axis may run top-to-bottom (screen-space) while data Y often runs bottom-to-top (math-space). Decide convention: y-category index 0 lives at the **top** of the heatmap (screen-top), and the y-axis labels run top-to-bottom in the same order. This is the more common convention for heatmaps. Document it.

**Test that resize updates the sprite's size** without rebuilding the texture (the texture is grid-resolution, sprite scaling is GPU-side). Data-change or category-change DOES require rebuilding the texture.

#### Hit-testing

- Build a hit-tester that:
  - Converts pointer x to an x-category via band-iteration on the x-adapter (use `kind === 'band'` to confirm). Specifically, find which band `[xAdapter.scale(category), xAdapter.scale(category) + bandwidth]` the pointer falls within.
  - Same for pointer y.
  - Looks up the cell record in the 2D map.
  - Returns `null` if pointer is outside the plot area or in a sparse cell with no data.
- Pass to `InteractionLayer` as usual.

#### Tooltip

- Show: `${xField}: ${xCategory} • ${yField}: ${yCategory} • ${valueField}: ${formattedValue}`. Use `d3-format` for the numeric value.
- Standard show/hide on hover/leave.

#### Legend

- Continuous legend (`type: 'continuous'`) showing the value-field's range and color scheme. Position top-right of plot area (same as scatter's continuous legend).

#### Resize

- Recompute plot dimensions.
- Update axes via `Axis.update()` — the band scale's range changes but the domain doesn't.
- Update the sprite's width and height to the new plot area (texture itself unchanged).
- Reposition the legend.
- Swap the hit-tester via `InteractionLayer.setHitTester` (the band scale's range changed, so hit-test math changed).
- Resize the interaction layer.

Important: the texture is reused. The whole point of texture-from-buffer is that resize is cheap.

#### Destruction

- `super.destroy()`, then destroy the sprite, destroy the texture (`texture.destroy(true)` to free GPU memory — same texture-cleanup discipline ScatterChart established), destroy axes, tooltip, legend, interaction layer. Idempotent.
- Write a test asserting the texture is destroyed. GPU memory leaks are real failure modes; tests catch them where humans won't.

**Tests:**

- Construction with valid spec doesn't throw and doesn't auto-render.
- After `init()`: scales built; two band axes rendered; one sprite added to stage (assert sprite count == 1 — heatmaps are deliberately one draw call).
- The pixel buffer has the right size: `xCategories.length * yCategories.length * 4` bytes.
- Sparse heatmap (data missing some (x, y) pairs) produces transparent pixels in the buffer at those positions.
- Hit-testing in a cell's pixel region returns the cell's datum.
- Hit-testing in a sparse cell's region returns null.
- Hit-testing outside the plot area returns null.
- Resize updates sprite dimensions but does NOT rebuild the texture (spy on the texture-creation function to verify it's called once per data-change, not per resize).
- Data change DOES rebuild the texture.
- `destroy()` destroys the sprite and texture; idempotent.
- Texture's scaleMode is NEAREST (assert on the texture's source — this is the "crisp cells" test).

### Step 3: Dispatcher and Public API Updates

**`spec/render.ts`:** Add `'heatmap'` to dispatch. Update the "not implemented" message — at this point the message lists `line`, `area`, `bar`, `scatter`, `heatmap` and the only remaining unsupported type is `pie`.

**`src/index.ts`:** Export `HeatmapChart`.

### Step 4: Dev Harness Page

Create `packages/pixi-charts/dev/heatmap.html` and entry script with:

- A realistic-looking heatmap (e.g., 24 hours × 7 days of week, simulated activity data, or a similarly-sized real-feeling dataset).
- Visual verification points to call out in the harness page text:
  - Cells are crisp at the edges (NEAREST scale mode is doing its job).
  - The continuous legend's gradient matches the rendered cells' colors.
  - Hover tooltip shows the expected x-category, y-category, and value.
  - Resize the browser — cells stay aligned with axis ticks.
- A sparse-data variant: same dataset but with some (x, y) pairs deliberately removed. Visual verification: those cells appear transparent (or empty), not as a wrong color.

Commit this dev page. Same rationale as Session 7's perf harness — it's the start of the docs-site gallery entry, and it's the artifact that proves heatmap works visually, which unit tests can't fully verify for a render-heavy chart.

### Step 5: README Update

- Move "Heatmap" from "Coming soon" to "Available".
- Update any "five of six chart types" wording (if such phrasing exists) to reflect that five charts now ship, with Pie remaining.

## Integration Discoveries

This is the third chart (after scatter and bar's horizontal-orientation) that pressures the cartesian shared module by not fitting cleanly. Pay attention to:

- **Whether the texture-from-buffer API in PIXI v8 is what's documented or has shifted.** PIXI v8 reorganized a lot of texture APIs from v7. If `Texture.fromBuffer` isn't the right call, find the v8 equivalent and document it. This is the kind of detail that future contributors will hit.
- **Whether `Axis` correctly handles band-on-y AND band-on-x at the same time.** BarChart only ever had one band axis at a time. Heatmap has both. If labels misposition or tick spacing looks wrong, it's a primitive bug.
- **The two-band-adapter coordinate math in the hit-tester.** Iterating both bands to find a cell isn't conceptually hard, but it's the first place this pattern lives. If the math feels awkward, a small `findBandAt(adapter, pixel) → category | null` helper on `bandAdapter` or in a utilities file might be worth extracting. Don't add it speculatively — only if the heatmap code reads badly without it. Pie in Session 9 may benefit from the same helper if you add it.
- **`ColorScheme`'s sequential schemes.** Scatter was the first chart to use them; heatmap is the second. If the scheme names, RGB conversion, or `cssColorToPixi` showed friction in scatter that you papered over, fix it here.
- **Bundle size impact.** Heatmap should be small — no quadtree, no ParticleContainer, just `scaleSequential` (already pulled in by scatter) and the texture-from-buffer code. Record the size and compare.

## Working Style (Reminder)

- Ask clarifying questions before starting if anything is ambiguous, especially around the PIXI v8 texture-from-buffer API (this is the part of the prompt most likely to be slightly wrong about the current API).
- Show planned approach in chat before writing the texture-construction code — the layout details (row-major, Y-axis direction, alpha for sparse cells) are easy to get subtly wrong and hard to debug after the fact.
- Build the basic-correctness version first (small 5×5 grid, hardcoded), verify it renders in the harness, _then_ add the real data path. This is the same isolate-the-new-technique pattern Session 7 used.
- Run the dev harness in a real browser. Texture rendering issues (smoothing, alpha, color space) often don't surface in unit tests.
- If you exceed ~200 lines of implementation without corresponding tests, stop and write tests first.

## What to Deliver

1. New file: `charts/HeatmapChart.ts`.
2. Possibly updated: `charts/_shared/cartesian.ts` — only if a clean cut emerges, which is unlikely.
3. Updated: `spec/ChartSpec.ts` (verify `value` field), `spec/validate.ts` (heatmap rules), `spec/render.ts` (heatmap dispatch), `src/index.ts` (HeatmapChart export).
4. New test file: `tests/charts/HeatmapChart.test.ts`.
5. Updated `tests/spec/validate.test.ts` for the new rules.
6. All prior chart tests must continue passing without modification.
7. New dev harness page: `dev/heatmap.html` and entry script. Both standard and sparse variants demonstrable.
8. Updated `README.md` (heatmap promoted to "Available"; the chart-type list now reflects five-of-six available).
9. JSDoc on every new exported symbol; texture-from-buffer technique carefully documented since it's library-specific knowledge.
10. A changeset entry — `minor` bump. Description names HeatmapChart, calls out the texture-from-buffer rendering and the scope limits (no auto-binning, no enter animation, no cell labels).
11. All tests passing — full suite, paste output. Bundle size recorded and compared to end-of-Session-7.
12. A summary covering: what was built, the texture-from-buffer integration findings (PIXI v8 API surprises, scale-mode handling), any primitive API frictions discovered (especially `Axis` with two band scales), shared-module decisions (likely "skipped, here's why"), bundle size, and the chart-roster status going into Session 9.

Begin by asking any clarifying questions, then propose your implementation order.
