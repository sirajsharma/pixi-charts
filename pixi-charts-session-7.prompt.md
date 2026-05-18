# Pixi Charts — Session 7: ScatterChart (The Performance Chart)

## Context

This is Session 7 of building `pixi-charts`. Sessions 1–6 are complete:

- **Session 1** — Project scaffolding, `Chart` abstract base class, `tween()` animation helper.
- **Session 2** — `ColorScheme`, `Tooltip`, `Axis` primitives.
- **Session 2.5** — `ScaleAdapter` interface and adapter factories.
- **Session 3** — `Legend`, `InteractionLayer` primitives.
- **Session 4** — `ChartSpec` API, dispatcher, `lttb`, `LineChart`, public API surface.
- **Session 5** — `AreaChart`, `charts/_shared/cartesian.ts`.
- **Session 6** — `BarChart` (vertical + horizontal, single series).

All prior code is in place with passing tests. Three charts (line, area, bar) ship working.

**Before starting, read `CLAUDE.md` at the repo root**, the existing chart implementations, and `charts/_shared/cartesian.ts`. ScatterChart will exercise parts of the shared module that haven't been hit (both axes typically continuous, hit-testing fundamentally different) and may need additions for the new encoding channels (size, continuous color).

## What This Session Delivers

This is the chart that justifies the library's existence. By the end:

1. **`charts/ScatterChart.ts`** — A scatter plot rendering at least 100,000 points at 60fps, with sub-millisecond hit-testing.
2. **`utils/quadtree.ts`** — A thin wrapper around `d3-quadtree` exposing the API ScatterChart needs (and any future chart that wants spatial indexing).
3. **`spec/ChartSpec.ts` updates** — Size encoding and continuous color encoding properly typed.
4. **`spec/validate.ts` updates** — Scatter encoding rules + the new encoding fields validated.
5. **`spec/render.ts` updates** — Dispatcher handles `type: 'scatter'`.
6. **`src/index.ts` update** — `ScatterChart` exported.
7. **Possible additions to `charts/_shared/cartesian.ts`** — for genuinely shared cartesian work; resist over-sharing per the discipline established in Sessions 5/6.
8. **A performance benchmark in the dev harness** — a stress-test page (1k / 10k / 100k / 1M points) verifying the 60fps claim.

## Architectural Decisions (Locked Before Implementation)

ScatterChart has several big design choices. Each is decided here so Claude Code doesn't waste time relitigating them mid-session.

### Decision 1: `PIXI.ParticleContainer`, not custom shaders, not `Graphics`

For rendering many sprites, PIXI v8 offers three options:

- **`PIXI.Graphics` with one circle per point** — falls over above ~5,000 points. Not viable.
- **Custom WebGL shaders** — fastest, but adds substantial complexity, a shader-compilation step, and a non-trivial debugging surface. Save for a future optimization pass if profiling shows `ParticleContainer` isn't enough.
- **`PIXI.ParticleContainer`** — designed exactly for this case: many sprites sharing a texture, batched in a single draw call. The right v1 choice. Documented limitations (no per-sprite tinting in some versions, no per-sprite interactivity) are workable.

**Use `ParticleContainer`.** Document the choice in JSDoc with a note that custom shaders are a known future optimization.

If `ParticleContainer` in PIXI v8 has the per-sprite tinting limitation, the workaround is to pre-bake textures for the distinct colors used. For categorical color (≤20 unique colors per the soft-warn limit), this is cheap. For continuous color, sample the gradient into ~32 discrete textures rather than baking one texture per point — humans can't see the difference, and 32 textures is trivial.

### Decision 2: `d3-quadtree` for hit-testing, exposed via a thin internal wrapper

Linear-scan hit-testing on 100k points at 60Hz would burn the CPU. `d3-quadtree` gives O(log n) nearest-neighbor queries.

`utils/quadtree.ts` provides a thin wrapper that:

- Builds a quadtree from `{x, y, datum}` records in pixel space (already-projected coordinates, not domain values).
- Exposes a `findNearest(point, radius)` query that returns the closest record within `radius` pixels, or null.
- Hides d3-quadtree's API quirks (mutable add/remove, accessor functions for x/y) behind a small, focused interface.

The wrapper isn't a heavy abstraction — it's there because (a) ScatterChart shouldn't directly couple to `d3-quadtree`'s API, and (b) any future chart that needs spatial indexing (a future heatmap variant, density plot, anything with discrete points) reuses it.

### Decision 3: Hit-tester rebuilds on resize and data change, not per-frame

The quadtree is built once per render pass and reused for every pointer event. Building it costs O(n log n); the prompt rule for resize is "rebuild scales, then swap the hit-tester via `InteractionLayer.setHitTester`" — apply that pattern here. Do NOT rebuild the quadtree on every `pointermove` event (obvious mistake but worth saying).

### Decision 4: Size encoding uses a square-root scale, not linear

A common scatter-plot footgun is using radius proportional to the data value, which makes the _area_ (and visual weight) proportional to the value _squared_. The right default is to scale the _area_ proportionally to the value, which means radius is proportional to the square root.

Use `d3-scale`'s `scaleSqrt()` for the size scale. Default range: `[3, 12]` pixels (radius). Override via future options if needed; not in scope here.

Document this decision in JSDoc — it's the kind of "we made a thoughtful default" detail that elevates the library above naive implementations.

### Decision 5: Continuous color uses `scaleSequential` + `interpolateViridis` by default

ScatterChart is the first chart to support `encoding.color` with a **quantitative** field (Line/Area/Bar treat color as categorical). When the color field is quantitative, use `scaleSequential` with a sequential interpolator from `d3-scale-chromatic`. Default scheme: viridis (perceptually uniform, colorblind-safe — the right default for quantitative data).

Continuous color encoding pairs with a continuous legend (Session 3's `Legend` already supports this). Categorical color encoding pairs with a categorical legend, same as other charts.

### Decision 6: Tooltip on hover; no per-point click handlers in v1

Same interaction model as other charts: hover shows tooltip, leave hides it, click is a no-op (but wired up so future click handlers integrate cleanly).

## Scope Boundaries (What NOT to Do)

- Do NOT implement custom shaders. `ParticleContainer` only.
- Do NOT implement zoom, pan, or brush selection. Static view with hover-tooltip only.
- Do NOT implement multi-series scatter (different shape per series, etc.). Color encoding distinguishes points; that's enough for v1.
- Do NOT implement point shapes other than circles. Squares, triangles, crosses are nice future polish — not in scope.
- Do NOT add jitter for overlapping categorical points. Overlap-handling is its own design topic.
- Do NOT modify primitives (`Chart`, `animation`, `ScaleAdapter`, `Axis`, `Tooltip`, `Legend`, `InteractionLayer`, `ColorScheme`) unless an integration issue surfaces. Same rule as always: additive changes okay with a note; signature changes need a pause.
- Do NOT modify existing chart implementations or their tests. Line/Area/Bar must continue passing without modification.

## Specific Implementation Requirements

### Step 1: `ChartSpec` and Validation Updates

**`spec/ChartSpec.ts`:**

Update `ColorEncoding` to support an optional type field:

```ts
export type ColorEncoding = {
  field: string;
  /**
   * Type of the color field. Determines how color is resolved:
   * - `'categorical'`: each unique value gets a distinct color from a
   *   categorical palette.
   * - `'quantitative'`: values are mapped to a continuous color scale
   *   (sequential interpolator).
   * - If omitted: inferred categorical for line/area/bar charts; required
   *   to be specified for scatter charts when continuous color is intended.
   */
  type?: 'categorical' | 'quantitative';
  /**
   * Color scheme name. For categorical: one of the categorical scheme names.
   * For quantitative: one of the sequential scheme names. Defaults differ
   * per type.
   */
  scheme?: string;
};
```

The `size` encoding type already exists in `ChartSpec` shape; verify it's there with `{ field: string }`. If not present, add it now.

**`spec/validate.ts`:**

Add a `requireScatterEncoding` helper validating:

- `encoding.x` present, type `'quantitative'` or `'temporal'` (NOT categorical — categorical scatter is an unusual edge case; reject for v1 with a teaching error).
- `encoding.y` present, type `'quantitative'` or `'temporal'`.
- If `encoding.color` present and `type: 'quantitative'`, the field must exist in the data and contain numeric values (warn, don't reject, if some values are missing or non-numeric — defensive but not fatal).
- If `encoding.size` present, the field must exist in the data; values should be non-negative (warn if negative values found — the square-root scale handles them but the visual result is meaningless).

Keep the teaching-error pattern: name the path, show received vs. expected, give an example.

**Tests:**

- Valid scatter spec with quantitative x/y passes.
- Categorical x or y on scatter throws a teaching error.
- Continuous color encoding with `type: 'quantitative'` passes; scheme name validation as per the existing pattern.
- Categorical color encoding on scatter (`type: 'categorical'` or omitted) passes.
- Size encoding with a non-existent field throws.
- Size encoding with negative values warns but doesn't throw.

### Step 2: `utils/quadtree.ts`

A thin internal wrapper around `d3-quadtree`.

**Export:**

```ts
export type SpatialRecord<D> = {
  x: number; // pixel-space x
  y: number; // pixel-space y
  datum: D;
};

export class SpatialIndex<D> {
  constructor(records: ReadonlyArray<SpatialRecord<D>>);
  findNearest(point: { x: number; y: number }, radius: number): SpatialRecord<D> | null;
  /** Number of indexed records — useful for tests and diagnostics. */
  get size(): number;
}
```

**Behavior:**

- Constructor builds a `d3-quadtree` from the records using `.x((r) => r.x)`, `.y((r) => r.y)`, and `.addAll(records)`. Records are copied by reference; the wrapper doesn't mutate them.
- `findNearest(point, radius)` uses `quadtree.find(point.x, point.y, radius)`. Returns the closest record within radius (in pixel distance) or null. Note: d3-quadtree's `find` with a radius returns the nearest within that radius; documented behavior.
- Empty record array is valid; queries always return null.
- The wrapper is a pure data structure — no PIXI dependency, no DOM dependency, fully testable in isolation.

**Tests:**

- Empty SpatialIndex returns null for any query.
- Single record: query at the record's exact position returns it.
- Single record: query within radius returns it.
- Single record: query outside radius returns null.
- Multiple records: query returns the nearest of several candidates.
- Records with identical positions: query returns one of them (don't test which; just don't crash).
- `size` getter returns the record count.

### Step 3: `charts/ScatterChart.ts`

The main event.

**Export:**

```ts
import type { ChartSpec } from '../spec/ChartSpec';

export class ScatterChart extends Chart {
  constructor(opts: { container: HTMLElement; spec: ChartSpec });
  // inherits init(), destroy(), destroyed from Chart
  // overrides protected render()
}
```

**Behavior:**

#### Data transformation

- Extract `xField`, `yField`, `colorField` (optional), `sizeField` (optional).
- Build pixel-space records: project each row through the x and y adapters to get `{ x: pxX, y: pxY, datum }`. Do this once per render; reuse for both drawing and hit-testing.
- For color:
  - No color encoding: all points use the first color of `schemeCategory10`.
  - Categorical color (`type: 'categorical'` or omitted): unique values mapped to `getCategoricalColor`. Soft-warn if >20 unique values.
  - Quantitative color (`type: 'quantitative'`): build a `scaleSequential` over the color field's extent, using `interpolateViridis` (or the named scheme). Each point's color comes from this scale.
- For size:
  - No size encoding: all points use a default radius (4px is sensible).
  - Size encoding present: build a `scaleSqrt` over the size field's extent, range `[3, 12]`. Each point's radius comes from this scale.

#### Scales and adapters

Use the cartesian shared module's `buildCartesianSetup` where possible. Scatter's x and y are both continuous (quantitative or temporal), so this is a straightforward consumer.

If `buildCartesianSetup` doesn't cleanly support "two continuous axes with no series-grouping" (since Line/Area/Bar all assume some form of grouping), that's a signal the shared module's signature needs adjustment. Two acceptable resolutions:

1. **Skip the shared module for scatter's setup** and build scales inline. Simpler if the shared module is too opinionated. Note in summary as an integration finding.
2. **Add a small helper to the shared module** specifically for the continuous-x continuous-y case. Acceptable if it's a clean cut.

Don't force scatter through `buildCartesianSetup` if it requires gymnastics. The shared module exists to reduce duplication, not to be a chokepoint.

#### Rendering with `ParticleContainer`

- Create a `PIXI.ParticleContainer` configured for the expected point count.
- For categorical color (≤20 unique colors): pre-bake one circle texture per color at the maximum radius. Each point sprite uses the texture matching its color, scaled to its size.
- For continuous color: pre-bake ~32 circle textures sampling the sequential color scale. Each point picks the nearest texture by mapping its color value to a bin. Document the 32-texture choice (perceptual indistinguishability vs. memory cost).
- For each record, create a `PIXI.Sprite` with the right texture, positioned at `(record.x, record.y)`, anchored at center, scaled so its effective radius matches the data point's radius. Add to the ParticleContainer.
- One ParticleContainer for all points (single draw call where PIXI allows). The whole point is the batch.

If `ParticleContainer` in v8 has API constraints that prevent some of the above (e.g., no per-sprite scale), document the workaround inline. The principle stays: get to a single batched draw for all points.

#### Hit-testing

- Build a `SpatialIndex<ScatterRecord>` from the pixel-space records.
- The hit-tester function uses `spatialIndex.findNearest(point, hitRadius)` where `hitRadius` accounts for the point's visual size (use 12px or the largest rendered point radius, whichever is larger).
- Pass to `InteractionLayer` exactly as other charts do.

#### Tooltip

- On hover, show: `${xField}: ${formattedX} • ${yField}: ${formattedY}` plus, if color or size encodings are present, those field values too. Use `d3-format` / `d3-time-format` per field type.
- Standard tooltip lifecycle: show on hover, hide on leave.

#### Legend

- Color encoding present + categorical: categorical legend in top-right (same pattern as other charts).
- Color encoding present + quantitative: continuous legend (Session 3's `Legend` already supports this — use `type: 'continuous'`). Position top-right.
- Size encoding present: a size legend is a nice-to-have but **not in scope** for v1. Note as a future addition in JSDoc.
- No color encoding: no legend.

#### Enter animation

- Scatter doesn't draw progressively the way Line/Area do. Use a fade-in: tween the ParticleContainer's `alpha` from 0 to 1.
- For very large point counts (>50k), the fade-in is a single ticker callback updating one alpha value — essentially free.
- Respect `spec.animation.enter: false`. `tween()` handles reduced-motion.

#### Resize

- On resize: rebuild scales/adapters, recompute pixel-space records, rebuild the `SpatialIndex`, swap the hit-tester via `InteractionLayer.setHitTester`, resize the interaction layer, update sprite positions in the ParticleContainer. Do NOT destroy and recreate the ParticleContainer if you can avoid it — update sprite positions in place.
- Axes update via `Axis.update()`.

#### Destruction

- `super.destroy()`, then destroy the ParticleContainer (which destroys its child sprites), destroy axes, tooltip, legend, interaction layer. Pre-baked textures must also be destroyed (`texture.destroy(true)` to free the GPU memory). Idempotent.
- **Important:** the texture-destruction step is a real failure mode if missed. Each chart instance creating textures and not freeing them is a GPU memory leak that wouldn't show up in normal tests. Write a test that asserts the textures are destroyed (spy on `texture.destroy`).

**Tests:**

- Construction with valid spec doesn't throw and doesn't auto-render.
- After `init()`: scales built, two axes rendered, ParticleContainer added to stage, sprite count matches data count.
- No color encoding: all sprites use one color.
- Categorical color: distinct colors used; soft-warn fires above 20 unique values.
- Quantitative color: continuous color scale built; legend type is continuous.
- No size encoding: all sprites use the default radius.
- Size encoding: sprite scales vary per data value, following the square-root scale.
- Hit-testing returns the nearest point within radius; returns null when pointer is far from any point.
- Hit-test radius accounts for the largest visible point size.
- `animation.enter: false` skips the fade-in.
- Resize updates sprite positions and rebuilds the SpatialIndex.
- `destroy()` destroys the ParticleContainer, all pre-baked textures, and all owned primitives. Idempotent.

### Step 4: Dispatcher and Public API Updates

**`spec/render.ts`:** Add `'scatter'` to dispatch. Update the "not implemented" message.

**`src/index.ts`:** Export `ScatterChart`.

### Step 5: Performance Benchmark Page in Dev Harness

This is the page that will eventually live on the docs site and sell the library. Build it now in the dev harness so the perf claim is verified, not asserted.

Create `packages/pixi-charts/dev/scatter-perf.html` (and corresponding TS entry) with:

- A scatter chart rendering N points where N is configurable via a slider or buttons: 1,000 / 10,000 / 100,000 / 1,000,000.
- An on-page FPS counter showing the current frames-per-second (use `requestAnimationFrame` delta-time, refresh once per second).
- A small "render time" counter showing how long the most recent `render()` call took.
- A note showing the current point count and the build timestamp.

Run this in a real browser (not just unit tests) and record:

- FPS at each point count during steady-state.
- Render time at each point count.
- Hit-test responsiveness during mouse-move at the highest point count (should feel instant — sub-frame).

If 100k points doesn't hit 60fps steady-state, that's a real finding — stop and investigate before declaring done. The library's whole architectural pitch depends on this number. Likely culprits if it's slow: per-sprite tinting fighting `ParticleContainer`'s batching, texture-bake step happening too often, hit-test radius too large causing the quadtree to scan too many candidates.

Commit this dev harness page — it's the start of the eventual docs-site performance page, and it's the artifact that proves the library works.

### Step 6: README Update

- Move "Scatter chart" from "Coming soon" to "Available".
- Add a one-line note (or a small section) calling out the performance characteristic: "Scatter charts handle 100k+ points at 60fps via PixiJS ParticleContainer and d3-quadtree spatial indexing." This is the library's selling line; put it where readers will see it.

## Integration Discoveries

This session exercises every primitive harder than any previous one. Pay particular attention to:

- **Whether the cartesian shared module is the right shape for a chart that doesn't have series grouping.** If `buildCartesianSetup` had to be coerced or skipped, the shared module's API needs reconsidering for v2.
- **Whether `Legend`'s continuous mode (Session 3) is correctly oriented and positioned for a real chart's first use.** It was built but never exercised by a chart until now.
- **Whether `Tooltip` handles the case where the visible chart-content under the pointer is moving rapidly through many candidates.** Linear-scan hit-testing would have made this a perf disaster; the quadtree should make it feel instant. Verify.
- **Any `ScaleAdapter` reach-throughs.** ScatterChart uses `linearAdapter`, `timeAdapter`, and possibly `sqrtScale`/`sequentialScale` (which AREN'T currently adapter-wrapped — they're internal to the chart). Decide whether the size and color scales benefit from being adapter-wrapped or stay as raw d3 scales. My recommendation: leave size/color as raw d3 scales for now (they don't drive axes; the adapter abstraction was designed for axis-driving scales). Note the decision.
- **Bundle size impact.** This is the biggest chart yet and pulls in `d3-quadtree` and `scaleSequential`/`scaleSqrt`. Record the new size and compare. If it grows alarmingly, investigate before shipping.

## Working Style (Reminder)

- Ask clarifying questions before starting if anything is ambiguous.
- Show planned shape of `utils/quadtree.ts` and any shared-module additions before lifting code.
- **Build the perf harness BEFORE optimizing.** Get a basic version of ScatterChart working at 1k points, then jump to 100k in the harness. If it's already fast, great. If not, profile in the browser and address the actual bottleneck rather than guessing. Don't pre-optimize.
- Run the full test suite. Run the perf harness in a real browser. Both are deliverables; neither alone is sufficient.
- If you exceed ~200 lines of implementation without corresponding tests, stop and write tests first.

## What to Deliver

1. New files: `charts/ScatterChart.ts`, `utils/quadtree.ts`.
2. Possibly updated: `charts/_shared/cartesian.ts` — only if scatter genuinely uses it.
3. Updated: `spec/ChartSpec.ts` (color type field, size encoding), `spec/validate.ts` (scatter rules), `spec/render.ts` (scatter dispatch), `src/index.ts` (ScatterChart export).
4. New test files: `tests/charts/ScatterChart.test.ts`, `tests/utils/quadtree.test.ts`.
5. Updated `tests/spec/validate.test.ts` for the new rules.
6. All prior chart tests (Line, Area, Bar) must continue passing without modification.
7. New dev harness page: `dev/scatter-perf.html` and entry script.
8. Updated `README.md` (scatter promoted to "Available"; performance claim added).
9. JSDoc on every new exported symbol; especially careful documentation on the architectural decisions (ParticleContainer choice, square-root size scale, viridis default).
10. A changeset entry — `minor` bump. Description names ScatterChart, calls out the performance target, and notes the new encoding channels (continuous color, size).
11. All tests passing — full suite, paste output. **Plus**: paste the FPS and render-time numbers from the perf harness at each point-count tier.
12. Recorded bundle size and comparison to end-of-Session-6.
13. A summary covering: what was built, the architectural decisions and whether any forced reconsideration, primitive API frictions discovered, the actual perf numbers achieved, any GPU/memory concerns (texture lifecycle), shared-module changes (or lack thereof), and what's queued for Session 8.

Begin by asking any clarifying questions, then propose your implementation order. Building basic-ScatterChart first, then perf harness, then optimization is the recommended order — but call out if you see a better one.
