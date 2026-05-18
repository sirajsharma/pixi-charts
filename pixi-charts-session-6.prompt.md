# Pixi Charts — Session 6: BarChart (Vertical + Horizontal, Single Series)

## Context

This is Session 6 of building `pixi-charts`. Sessions 1–5 are complete:

- **Session 1** — Project scaffolding, `Chart` abstract base class, `tween()` animation helper.
- **Session 2** — `ColorScheme`, `Tooltip`, `Axis` primitives.
- **Session 2.5** — `ScaleAdapter` interface and adapter factories; `Axis` generic over scale domain.
- **Session 3** — `Legend`, `InteractionLayer` primitives.
- **Session 4** — `ChartSpec` API, `validate.ts`, `render.ts` dispatcher, `lttb.ts`, `LineChart`, public API surface.
- **Session 5** — `AreaChart`, `charts/_shared/cartesian.ts` extracted from LineChart, both charts using shared cartesian setup via composition.

All prior code is in place with passing tests. The library is in-browser verified.

**Before starting, read `CLAUDE.md` at the repo root**, the existing `charts/LineChart.ts` and `charts/AreaChart.ts`, and especially `charts/_shared/cartesian.ts`. BarChart will exercise parts of the shared module that Line and Area didn't fully stress (band scales on the value axis are a no-op for Line/Area but central to Bar), and may surface gaps in the cut you made in Session 5.

## What This Session Delivers

1. **`charts/BarChart.ts`** — A single class supporting both vertical and horizontal bar charts, single series. (See Architectural Decision below for why one class, not two.)
2. **Possible additions to `charts/_shared/cartesian.ts`** — only if BarChart genuinely shares behavior with Line/Area that isn't already factored. See "Sharing Discipline" below.
3. **Updates to `spec/render.ts`** — dispatcher now handles `type: 'bar'`.
4. **Updates to `spec/validate.ts`** — bar type's encoding requirements validated.
5. **Updates to `src/index.ts`** — `BarChart` exported from the imperative API.
6. **Updates to `ChartSpec`** — a new optional `orientation` field on `ChartOptions`, scoped to bar charts for now (documented as such).

## Architectural Decision: One Class with an Orientation Option

The choice is between `BarChart` + `HorizontalBarChart` (two classes) versus `BarChart` with `options.orientation: 'vertical' | 'horizontal'`. **Use the single-class-with-option approach.**

Reasoning:

- A vertical and a horizontal bar chart are _literally the same chart with the axes swapped_. Same data, same encoding, same hit-testing logic — just band scale on x vs. y. Two classes would be 90% duplicated code.
- The user-facing model is cleaner: "I have a bar chart and I want it horizontal" is a property of the chart, not a different chart type. Consumers won't have to remember whether to write `type: 'bar-horizontal'` (ugly) or `type: 'hbar'` (cryptic).
- The `ChartType` literal union stays clean: just `'bar'`, no `'hbar'` proliferation. Future variants (grouped, stacked) layer on as additional options.
- Inside `BarChart.ts`, orientation becomes a single branch in the scale-setup and drawing code — small, contained, easy to test both paths from one test file.

The mechanical implication: `ChartOptions` gains an `orientation?: 'vertical' | 'horizontal'` field (default `'vertical'`). It's a property of _bar charts specifically_, not all charts — line and area don't have a meaningful orientation. Document this scoping clearly in JSDoc and in the validator's behavior (see below).

## Sharing Discipline: Resist Premature Generalization

In Session 5, the `charts/_shared/cartesian.ts` module captured what Line and Area genuinely shared. BarChart will tempt you to lift more code into shared utilities. **Resist where the cut isn't obvious.**

Things that are clearly shared and should stay in the shared module:

- `buildCartesianSetup` — BarChart still needs scales (just with a band scale on a different axis).
- `buildCartesianHitTester` — BarChart still needs to map pointer-to-datum.
- `formatCartesianTooltip` — BarChart still needs tooltip content.
- The downsampling utilities (`lttb`) — not relevant to bars; leave untouched.

Things that look shared but aren't:

- **Series-grouping logic.** Line/Area split data into series by the color field (one line per series). Bar charts in this session are single-series; the color encoding controls per-bar color, not series-splitting. Don't reuse Line/Area's series-grouping path unchanged — Bar needs its own data-transformation step. If you find a small slice that IS shared (e.g., extracting unique color values), lift just that slice; don't drag the whole series-grouping pipeline along.
- **Drawing.** Bar drawing is fundamentally different from line/area drawing (discrete rectangles vs. continuous paths). Don't try to share rendering code.

Things you may need to add to the shared module:

- A helper for resolving a _per-datum color_ from a color encoding (categorical: assign color by datum's color-field value; absent: single color). LineChart's series-color logic does something similar but at the series level; Bar needs it at the datum level. If the existing helpers don't cleanly support both, add a small new function rather than overloading the existing ones. Flag this in the summary.

**Default rule:** when in doubt, leave it in `BarChart.ts`. If a third consumer (ScatterChart in Session 7) wants the same code, you'll have two real examples to design the abstraction against. Speculating about the right cut from one consumer is how shared modules become unmaintainable.

## Scope Boundaries (What NOT to Do)

- Do NOT implement multi-series bars (grouped or stacked). Single series only. Multi-series is a focused Session 7 topic.
- Do NOT modify primitives (`Chart`, `animation`, `ScaleAdapter`, `Axis`, `Tooltip`, `Legend`, `InteractionLayer`, `ColorScheme`) unless a real integration issue surfaces. Same rule as prior sessions: small additive changes acceptable with a note; signature changes need a pause.
- Do NOT modify `LineChart` or `AreaChart`'s observable behavior. The Session 5 test suites for both must continue to pass without modification. If extending the shared module breaks them, the cut went wrong — pull back.
- Do NOT add new chart options beyond `orientation`. No `barPadding`, no `cornerRadius`, no `valueLabels`. Each of those is a worthwhile feature with its own design questions — none of them is in scope here.

## Specific Implementation Requirements

### Step 1: `ChartSpec` and Validation Updates

**`spec/ChartSpec.ts`:**

Add an optional `orientation` field to `ChartOptions`:

```ts
export type ChartOptions = {
  // ...existing fields
  /**
   * Orientation of the chart. Currently only meaningful for `type: 'bar'`,
   * where it controls whether bars run vertically (band scale on x-axis,
   * default) or horizontally (band scale on y-axis). Ignored for other
   * chart types.
   */
  orientation?: 'vertical' | 'horizontal';
};
```

Keep it on `ChartOptions` rather than a bar-specific options object. The reasoning: future charts (e.g., a horizontal stacked area chart, if that ever became a real need) might want orientation too, and consumers writing programmatic specs benefit from a single options shape. The JSDoc carries the scoping note.

**`spec/validate.ts`:**

Bar's encoding requirements depend on orientation:

- **Vertical bars (default):** `encoding.x` must be present and `type: 'categorical'`; `encoding.y` must be present and `type: 'quantitative'`.
- **Horizontal bars:** `encoding.y` must be present and `type: 'categorical'`; `encoding.x` must be present and `type: 'quantitative'`.

Implement this as a `requireBarEncoding` helper. The teaching error messages should name what's wrong specifically — e.g., "For vertical bar charts, `encoding.x.type` must be `'categorical'`. Received: `'quantitative'`."

Also validate that `options.orientation`, if present, is one of the two allowed values. Use zod's enum.

For `type: 'line'` and `type: 'area'`, the validator should **ignore** `options.orientation` — not warn, not error. It's defined on `ChartOptions` for shape simplicity; non-bar charts simply don't read it. Document this in the validator's JSDoc.

**Tests:**

- Vertical bar with `encoding.x.type: 'categorical'` and `encoding.y.type: 'quantitative'` passes.
- Vertical bar with `encoding.x.type: 'quantitative'` throws a teaching error naming `encoding.x.type` and the allowed value.
- Horizontal bar with `encoding.y.type: 'categorical'` and `encoding.x.type: 'quantitative'` passes.
- Horizontal bar with `encoding.y.type: 'quantitative'` throws a teaching error naming `encoding.y.type`.
- `orientation: 'sideways'` (invalid value) throws.
- Line/area specs with `options.orientation` set do NOT throw and do NOT warn (orientation is ignored for them).

### Step 2: `charts/BarChart.ts`

**Export:**

```ts
import type { ChartSpec } from '../spec/ChartSpec';

export class BarChart extends Chart {
  constructor(opts: { container: HTMLElement; spec: ChartSpec });
  // inherits init(), destroy(), destroyed from Chart
  // overrides protected render()
}
```

**Behavior:**

#### Data transformation

- Extract `categoryField`, `valueField`, and (if present) `colorField` based on orientation:
  - Vertical: `categoryField = spec.encoding.x.field`, `valueField = spec.encoding.y.field`.
  - Horizontal: `categoryField = spec.encoding.y.field`, `valueField = spec.encoding.x.field`.
- Build an array of `{ category: string, value: number, datum: D, color: number }` records, preserving input order (do not sort; consumers control order via their data array).
- If `encoding.color` is absent, all bars get the first color from the default categorical scheme (`getCategoricalColor(0)`).
- If `encoding.color` is present and the field is categorical, each bar's color is determined by the unique value of its color field, using `getCategoricalColor` over the set of unique color-field values. If the bar's category-field value and color-field value are the same (a common case — coloring by category), this naturally produces one color per bar in a sensible way. Document the behavior.
- Soft guard: if the color field has more than 20 unique values, `console.warn` (same posture as the >20-unique-values warning in LineChart's series logic).

#### Scales and adapters

- **Vertical orientation:**
  - X-axis: `scaleBand<string>()` over unique categories, range `[0, plotWidth]`, padding 0.1 (a small visible gap between bars is conventional). Wrap with `bandAdapter`.
  - Y-axis: `scaleLinear()`, domain `[0, max(values)]` if all values non-negative, otherwise `extent`; `.nice()`; range `[plotHeight, 0]`. Wrap with `linearAdapter`.
- **Horizontal orientation:**
  - X-axis: `scaleLinear()`, same value-domain logic as vertical's y-axis; range `[0, plotWidth]`. Wrap with `linearAdapter`.
  - Y-axis: `scaleBand<string>()` over unique categories, range `[0, plotHeight]` (top-to-bottom), padding 0.1. Wrap with `bandAdapter`.
- Construct two `Axis` instances using the adapters, with appropriate orientations:
  - Vertical bars: x-axis is `'bottom'`, y-axis is `'left'`.
  - Horizontal bars: x-axis is `'bottom'`, y-axis is `'left'` (same orientations, but the axes carry different scales now).

The padding value (0.1) and any other layout constants should be named at the top of the file with comments.

#### Drawing the bars

- For each bar:
  - Vertical: rectangle from `(x = bandAdapter.scale(category), y = linearAdapter.scale(value))` with width `bandAdapter.bandwidth!()` and height `linearAdapter.scale(0) - linearAdapter.scale(value)`.
  - Horizontal: rectangle from `(x = linearAdapter.scale(0), y = bandAdapter.scale(category))` with width `linearAdapter.scale(value) - linearAdapter.scale(0)` and height `bandAdapter.bandwidth!()`.
- Use `PIXI.Graphics`, matching the v8 fill API already used in `LineChart`/`AreaChart`.
- One Graphics object total for all bars (single draw call), not one per bar. Fill per rectangle: `.fill({ color: bar.color, alpha: 1 })`.
- Important: project zero through the value adapter (`linearAdapter.scale(0)`) for the baseline, not assumed `plotHeight`/`0`. This is the same correctness point AreaChart established for negative-value-crossing domains.
- For negative values, the bar grows in the opposite direction from the baseline. Test this case explicitly — domains like `[-50, 100]` should produce bars below the baseline for negative values, above for positive.

#### Enter animation

- Use `tween()` from `core/animation.ts`, registered via the base class's `addTween`.
- The animation: each bar grows from the baseline to its full extent. Tween a single `progress` value from 0 to 1; on each frame, clear the Graphics and redraw all bars with the value dimension scaled by `progress`. (Per-bar staggered animations are a nice future polish; not in scope here.)
- Respect `spec.animation.enter: false` — draw bars at full extent immediately. `tween()` already handles `prefers-reduced-motion`.

#### Hit-testing

- BarChart's hit-tester is fundamentally different from Line/Area's nearest-x-point logic — bars are discrete rectangles, and hit-testing should check whether the pointer is inside any bar's rectangle.
- Implement a `buildBarHitTester(records, orientation, xAdapter, yAdapter)` function inside `BarChart.ts` (NOT in the shared module yet — single consumer). Return a `HitTester<BarRecord>` that:
  - For vertical: checks if the pointer's x falls in any band (using the band adapter), and the pointer's y is between the bar's top and the baseline.
  - For horizontal: checks if the pointer's y falls in any band, and the pointer's x is between the baseline and the bar's right edge.
- Use the band adapter's `kind === 'band'` discriminator to drive the band-direction check, consistent with the Session 3 hit-tester documentation.
- Pass this hit-tester to `InteractionLayer` exactly as Line/Area do.

#### Tooltip + Legend + Resize + Destruction

- Tooltip and Legend follow the same patterns as Line/Area:
  - Tooltip on hover, hidden on leave; content shows category and value, formatted via `d3-format` for numeric values.
  - Legend: a single-series bar chart with no color encoding shows no legend. With a categorical color encoding distinguishing bars, show a legend in the top-right (vertical orientation) with one swatch per unique color value.
- Resize: rebuild scales/adapters, update axes, rebuild and swap the hit-tester via `InteractionLayer.setHitTester`, resize the interaction layer, reposition the legend, redraw bars at final state (no re-running the enter animation).
- Destroy: `super.destroy()`, then destroy owned primitives. Idempotent.

**Tests:**

- Construction with a valid vertical-bar spec does not throw, does not auto-render.
- After `init()`: scales/adapters built with expected domains; two `Axis` instances exist; bars drawn (assert via spy on Graphics, or by inspecting the bar-record count after render).
- Horizontal orientation: scales swap correctly (band adapter on y, linear on x); bar rectangles oriented correctly (verify width/height assignment via the draw call, or by introspecting the chart's internal state).
- Negative values: a domain like `[-50, 100]` produces bars below the baseline for negative records, above for positive. Test for both orientations.
- Baseline projection: a domain like `[100, 500]` (zero not in domain) projects the baseline correctly using `linearAdapter.scale(0)` even when 0 isn't in the visible range. Bars extend from the projected baseline to the value — they may extend past the plot bounds; that's correct behavior (we don't clip; the consumer chose the domain).
- Hit-testing inside a bar's rectangle returns the bar's datum; outside any bar returns null. Test for both orientations.
- Hit-testing at the boundary between two bands resolves to one band (don't worry about which, but don't crash). Document the tie-breaking behavior.
- `animation.enter: false` draws bars at full extent immediately.
- Color resolution: no color encoding → all bars same color; categorical color encoding → bars colored by their color-field value; >20 unique color values triggers the soft warning.
- `destroy()` calls destroy on all owned primitives; idempotent.

### Step 3: Dispatcher Update

**`spec/render.ts`:**

- Add `'bar'` to dispatch: constructs and `init()`s a `BarChart` instance, returns it.
- Update the "not implemented" error message to list `line`, `area`, `bar`.

**Tests:**

- Valid bar spec returns a fully-rendered `BarChart`.
- "Not implemented" message correctly lists three available types.

### Step 4: Public API Update

**`src/index.ts`:**

- Export `BarChart` from the imperative API section.
- The spec-API exports don't change.

### Step 5: README

- Move "Bar chart" from "Coming soon" to "Available".
- If the README has an example, the existing line-chart example remains representative — no need to add a separate bar example.

## Integration Discoveries

This session is the first real stress test of the design assumption that "the cartesian primitives generalize to bar charts." Pay close attention to:

- **Where the shared module's API felt forced for BarChart.** If `buildCartesianSetup` returned something Line/Area need but Bar ignores (or vice versa), that's a cut-line issue. Note it; we may want to refactor before ScatterChart adds a third axis on these decisions.
- **Whether `bandAdapter` exposes everything BarChart needs.** Specifically: `bandwidth()` for bar size, `scale()` for bar position, `kind` for hit-tester branching, `domain()` (via `ticks()`) for iterating categories. If anything required reaching past the adapter to the raw d3 scale, flag it as an adapter gap.
- **Whether `linearAdapter.scale(0)` for the baseline projection works correctly in all the corner cases** (negative-only domain, zero-crossing domain, zero-not-in-domain). AreaChart established the pattern; BarChart exercises it harder.
- **Whether `Axis` correctly renders a band scale on the y-axis with categories.** Up to now, `Axis` has rendered band scales mainly on x-axes (in LineChart's categorical case). Horizontal bars are the first chart to put band-on-y in production. If labels misalign or tick positioning looks wrong for vertical band axes, it's a primitive bug, not a BarChart bug — pause and propose a fix.

Small additive changes (a new optional adapter method, a new `Axis` option) are fine to land directly with a note. Behavior changes need a pause.

## Working Style (Reminder)

- Ask clarifying questions before starting if anything is ambiguous.
- Verify Line/Area test suites still pass after any shared-module changes, before declaring done.
- Show me your planned shape for any additions to `charts/_shared/cartesian.ts` before lifting code, same as Session 5.
- Build vertical bars end-to-end first; add horizontal as a second pass once vertical is working and tested. This isolates the orientation-swap logic from the basic-correctness work.
- Verify both orientations in the dev harness before declaring done. The browser is the source of truth for "does this actually look right."
- If you exceed ~200 lines of implementation without corresponding tests, stop and write tests first.

## What to Deliver

1. New file: `charts/BarChart.ts`.
2. Updated: `spec/ChartSpec.ts` (orientation field), `spec/validate.ts` (bar encoding rules + orientation validation), `spec/render.ts` (bar dispatch), `src/index.ts` (BarChart export).
3. Possibly updated: `charts/_shared/cartesian.ts` — only if BarChart genuinely shares behavior that isn't already factored. Default to NOT changing this file.
4. New test file: `tests/charts/BarChart.test.ts`.
5. Updated tests in `tests/spec/validate.test.ts` for the new validation rules.
6. LineChart and AreaChart test suites must continue to pass without modification.
7. Updated `README.md` (bar chart promoted to "Available").
8. JSDoc on every new exported symbol; the new `orientation` field in `ChartOptions` carefully documented as bar-scoped.
9. A changeset entry — `minor` bump. Description names BarChart, calls out vertical + horizontal orientation as supported, notes single-series scope.
10. All tests passing — full suite, paste output. Record the new bundle size and compare to end-of-Session-5.
11. A summary covering: what was built, the architectural choice on orientation (one class), any shared-module changes you made (or, ideally, didn't need to make), any primitive API frictions discovered (especially around `bandAdapter` and `Axis` for band-on-y), any browser-verified visual issues, the recorded bundle size, and what's queued for Session 7.

Begin by asking any clarifying questions, then propose your implementation order.
