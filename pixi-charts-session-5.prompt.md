# Pixi Charts — Session 5: AreaChart

## Context

This is Session 5 of building `pixi-charts`. Sessions 1–4 are complete:

- **Session 1** — Project scaffolding, `Chart` abstract base class, `tween()` animation helper.
- **Session 2** — `ColorScheme`, `Tooltip`, `Axis` primitives.
- **Session 2.5** — `ScaleAdapter` interface and adapter factories; `Axis` refactored to be generic over scale domain.
- **Session 3** — `Legend`, `InteractionLayer` primitives.
- **Session 4** — `ChartSpec` API, `validate.ts`, `render.ts` dispatcher, `lttb.ts`, `LineChart`, public API surface. The library is now consumable: `await render(spec, container)` returns a fully-rendered chart.

All prior code is in place with passing tests. The library is verified working in-browser via the dev harness.

**Before starting, read `CLAUDE.md` at the repo root** and the current `charts/LineChart.ts`. AreaChart shares ~80% of its behavior with LineChart; this session is partly about implementing AreaChart and partly about deciding how shared behavior is factored.

## What This Session Delivers

1. **`charts/AreaChart.ts`** — The second chart type. Same axes, same scales, same hit-testing, same interaction model as LineChart — but with a filled area below the line.
2. **A refactor of shared behavior** between LineChart and AreaChart (see Architectural Decision below).
3. **Updates to `spec/render.ts`** — dispatcher now handles `type: 'area'`.
4. **Updates to `src/index.ts`** — `AreaChart` exported from the imperative API.
5. **Updates to `spec/validate.ts`** — area type's encoding requirements validated (same as line: x and y required).

## Architectural Decision: Composition, Not Inheritance

The original Session 4 plan said AreaChart would `extend LineChart`. **Don't do that.** Here's why, and what to do instead.

**The problem with `AreaChart extends LineChart`:**

- It encodes a permanent claim that "an area chart IS a line chart with fill," which isn't quite true — there are subtle differences (stacking semantics in the future, baseline handling, fill-vs-stroke alpha, legend swatch shape) that will eventually want to diverge.
- The base class for every chart is already `Chart`. A two-level hierarchy (`Chart` → `LineChart` → `AreaChart`) makes the inheritance tree start branching, and the Session 1 architectural principles explicitly said "composition over inheritance, except for the `Chart` base class." Extending LineChart violates that.
- The shared behavior between Line and Area is mostly _data transformation and scale setup_, not rendering. Sharing via inheritance forces them to share rendering too, which they shouldn't.

**The composition approach:**

Extract the genuinely-shared pieces into a small module under `charts/`, and have both `LineChart` and `AreaChart` consume them as plain functions. Both classes continue to extend `Chart` directly.

Create `charts/_shared/cartesian.ts` (the underscore prefix signals "internal to charts/, not exported from the package"):

```ts
// Functions and types shared between LineChart, AreaChart, and any future
// cartesian (x/y axis) line-family charts.

export type CartesianPoint<D> = { x: number; y: number; datum: D };

export type CartesianSeries<D> = {
  key: string; // the color-field value, or '__single__' for no-color encoding
  color: number;
  points: CartesianPoint<D>[];
};

export type CartesianSetup<D> = {
  xAdapter: ScaleAdapter<number | string | Date>;
  yAdapter: ScaleAdapter<number>;
  xRaw: AnyD3Scale; // for any rare cases where the adapter doesn't cover something
  yRaw: ScaleLinear<number, number>;
  series: CartesianSeries<D>[];
  plotWidth: number;
  plotHeight: number;
};

// Builds scales (+ adapters) and groups data into series.
export function buildCartesianSetup<D extends Record<string, unknown>>(
  spec: ChartSpec,
  plotWidth: number,
  plotHeight: number,
): CartesianSetup<D>;

// Builds the hit-tester for cartesian charts. Branches on the x adapter's
// `kind` discriminator (continuous → invert + nearest; band → iterate domain).
export function buildCartesianHitTester<D>(setup: CartesianSetup<D>): HitTester<CartesianPoint<D>>;

// Formats the tooltip content given an x-field name, y-field name, and a hit point.
export function formatCartesianTooltip<D>(
  xField: string,
  yField: string,
  xType: FieldType,
  yType: FieldType,
  point: CartesianPoint<D>,
): string;
```

The signatures above are illustrative — adapt the concrete types to what LineChart actually has today. The goal is: pull out the logic that's identical between Line and Area, hand it back to both classes as plain functions, and leave rendering / animation / legend-population as chart-specific concerns.

**What stays in each chart class:**

- The PIXI.Graphics drawing code (different per chart — stroke vs. fill+stroke).
- The enter-animation logic (similar shape, but AreaChart has to redraw the polygon, not just the stroke).
- The destroy override (each chart owns its specific PIXI objects).
- Anything chart-specific that AreaChart wants to do differently from LineChart later.

**What this refactor is NOT:**

- It's not a generic "BaseCartesianChart" class. Inheritance was the wrong tool; introducing a different kind of inheritance to "solve" it is the same mistake. Plain functions are the right tool.
- It's not a refactor of the primitives (`Axis`, `Tooltip`, etc.). Those are already shared via composition and don't change.
- It's not an attempt to factor everything Line and Area might ever share. Just factor what they share _today_. If a future chart (BarChart, ScatterChart) ends up wanting some of these helpers, generalize them at that point with a real second consumer informing the API. Don't speculate.

## Scope Boundaries (What NOT to Do)

- Do NOT change the public API surface (no new exports from `src/index.ts` other than `AreaChart`).
- Do NOT implement stacked areas. Single-baseline (zero) areas only this session. Stacking is a future feature with its own design decisions; flag it as a known gap in JSDoc.
- Do NOT change the `ChartSpec` shape. Area uses the same encoding as Line.
- Do NOT modify primitives (`Chart`, `animation`, `ScaleAdapter`, `Axis`, `Tooltip`, `Legend`, `InteractionLayer`, `ColorScheme`) unless a real integration issue surfaces. Same rule as Session 4: small additive changes (a new optional option, a new getter) acceptable with a note; signature changes need a pause and a proposal in chat.
- Do NOT modify `LineChart`'s public behavior. The refactor must leave LineChart's observable behavior identical — same rendered output, same tooltip content, same hit-test results, same tests passing.

## Specific Implementation Requirements

### Step 1: Refactor `LineChart` to use the shared module

Before writing AreaChart, refactor LineChart to consume `charts/_shared/cartesian.ts`. This isolates the refactor from the new-feature work and lets the existing LineChart test suite verify nothing broke.

Process:

1. Create `charts/_shared/cartesian.ts` with the shared functions, populated by lifting code out of LineChart.
2. Update `LineChart` to import from the shared module and delegate the now-shared work.
3. Run the LineChart test suite. All tests must pass without modification. If a test needs to change, the refactor went too far — pull back.
4. Add a small test file `tests/charts/_shared/cartesian.test.ts` for the extracted functions, exercising them directly (this is the kind of pure-function-extraction-for-testability pattern Sessions 3 and 4 already established).

Decisions to make as part of this step (flag your choice in the summary):

- **Where does color resolution live?** LineChart currently picks colors via `getCategoricalColor`. That logic looks shared, but the eventual continuous-color-on-scatter path will differ. My recommendation: lift the _categorical_ color resolution into the shared module (since Line/Area share it) and leave space for chart-specific color logic to live in each chart class for future variants. If you see a cleaner cut, justify it.
- **Where does the >20-unique-values color warning live?** It's part of the data-grouping step, so it belongs in `buildCartesianSetup`. Move it there.
- **Where does downsampling (`lttb`) live?** It operates on `{x, y}` pairs — pure data transformation, no rendering. It belongs in the shared module too. The named constants (`DOWNSAMPLE_THRESHOLD = 10000`, `DOWNSAMPLE_TARGET = 2000`) move with it.

### Step 2: `charts/AreaChart.ts`

Now the actual new code. Should be small after the refactor.

**Export:**

```ts
import type { ChartSpec } from '../spec/ChartSpec';

export class AreaChart extends Chart {
  constructor(opts: { container: HTMLElement; spec: ChartSpec });
  // inherits init(), destroy(), destroyed from Chart
  // overrides protected render()
}
```

**Behavior:**

- Constructor stores the spec; `init()` (inherited from `Chart`) calls `super.init()` then the protected `render()` method — same lifecycle pattern LineChart established in Session 4.
- `render()`:
  - Calls `buildCartesianSetup` from the shared module to get scales, adapters, and series.
  - Constructs two `Axis` instances exactly as LineChart does.
  - Constructs a `Tooltip` if `spec.options.showTooltip !== false`.
  - Constructs an `InteractionLayer` with `buildCartesianHitTester(setup)` as its hit-tester — same as LineChart.
  - Constructs a `Legend` for multi-series specs — same as LineChart.
  - Draws the area for each series (this is the part that's different).

**Drawing an area:**

- For each series, the filled region is a polygon: the line of data points across the top, then back along the baseline (y = 0 in domain space, projected through `yAdapter.scale(0)`) to close.
- Use `PIXI.Graphics`. Pattern (PIXI v8 API — match exactly what `Axis` and `LineChart` already use for stroke/fill):
  - `moveTo` the first point.
  - `lineTo` each subsequent point along the top edge.
  - `lineTo` from the last data point down to the baseline at the same x.
  - `lineTo` along the baseline back to the first point's x.
  - `closePath`, then `.fill({ color: seriesColor, alpha: 0.4 })`.
  - Then _also_ stroke the top edge (without the baseline closure) with `{ width: 2, color: seriesColor, alpha: 1 }` — a stroked outline on top of the fill is the standard area-chart appearance and reads better than fill alone.
- Multi-series areas overlap. Render them in order; the alpha of 0.4 makes overlaps readable. This is the right default; consumers wanting stacked areas will need the future stacking feature.
- The baseline is `yAdapter.scale(0)` — important to project zero through the _adapter_, not assume it's `plotHeight`. If the y-domain is `[-50, 100]`, the baseline isn't at the bottom of the plot. This is one of the genuine differences from LineChart.

**Enter animation:**

- Same `tween()` infrastructure as LineChart, registered via `addTween` so destroy cancels cleanly.
- The animation: tween `progress` from 0 to 1; on each frame, clear and redraw the area using only the first `progress * points.length` points. Same left-to-right reveal as LineChart, but the polygon is rebuilt each frame (top edge + projected baseline closure).
- Respects `spec.animation.enter: false` and lets `tween()` handle reduced-motion.

**Hit-testing:**

- Uses `buildCartesianHitTester` from the shared module, identical to LineChart. The tooltip on area charts shows the same point-on-the-line that LineChart shows — this is the right behavior; area charts aren't expected to hit-test on the filled region itself.

**Resize:**

- Same pattern as LineChart: rebuild scales/adapters via `buildCartesianSetup`, update both axes, swap the hit-tester via `InteractionLayer.setHitTester`, resize the interaction layer, reposition the legend, redraw the area in its final state (no re-running the enter animation).

**Destruction:**

- Override `destroy()`: call `super.destroy()`, then destroy owned primitives (`Axis` ×2, `Tooltip`, `Legend`, `InteractionLayer`). Idempotent.

**Tests:**

- Construction with a valid spec does not throw and does not auto-render.
- After `init()` completes: scales/adapters built with expected domains; two `Axis` instances exist; the area polygon was drawn (assert via spy on Graphics calls, or via stage children).
- Single-series spec renders one area; multi-series renders N areas with the expected number of stage children.
- The baseline calculation correctly handles a y-domain that doesn't include zero (e.g., `[100, 500]`) and a y-domain that crosses zero (e.g., `[-50, 100]`).
- `animation.enter: false` draws the full area immediately (no tween registered).
- Downsampling triggers via the shared `lttb` pipeline when a series exceeds the threshold (this is mostly verifying the shared module is wired correctly — the lttb test from Session 4 already verifies the algorithm).
- Hit-testing returns the correct datum (test via the shared hit-tester directly, since it's the same code path LineChart uses).
- `destroy()` calls destroy on all owned primitives and is idempotent.

### Step 3: Update `spec/render.ts`

- Add `'area'` to the dispatch: constructs and `init()`s an `AreaChart` instance, returns it.
- Update the "not implemented" error message to reflect that `line` and `area` are now available.

**Tests:**

- Valid area spec returns an instance of `AreaChart`, fully rendered.
- Updated "not implemented" error message lists both `line` and `area`.

### Step 4: Update `spec/validate.ts`

- The validation rule for line ("x and y both required") applies equally to area. Extract the rule into a small helper (`requireXAndY`) and apply it for both `'line'` and `'area'` types. Don't copy-paste the check.

**Tests:**

- Area spec missing `encoding.x` throws with the same teaching message shape as line.
- Area spec missing `encoding.y` throws likewise.
- Valid area spec passes validation.

### Step 5: Update `src/index.ts`

- Export `AreaChart` alongside `LineChart` in the imperative API section.
- The spec-API exports don't change — `render()` and the types already handle `type: 'area'`.

### Step 6: Update `README.md`

- Move "Area chart" from "Coming soon" into "Available" alongside Line.
- If the README has a short code example, the existing one is fine — no need to add a separate area example. Consumers see the chart-type list and infer the pattern.

## Integration Discoveries

This is the second-consumer test for every primitive that LineChart already exercised, plus the first real test of the new `charts/_shared/cartesian.ts` module. **Flag any frictions in your summary**, especially:

- Any place the shared module's API felt awkward in service to AreaChart — these are the signs that the cut was wrong and bar/scatter will hit the same wall.
- Any primitive that needed an additive change to support a second consumer (`Legend` swatch styling for areas vs. lines, `Tooltip` positioning when the visible chart-content is a polygon, etc.).
- Whether the `tween()` redraw pattern scales: redrawing a polygon (potentially hundreds of points) every frame is a more expensive enter animation than redrawing a stroke. If you see noticeable jank with realistic data sizes, note it — we'll know whether the next optimization pass needs to target animation specifically.

Small additive changes are fine to land directly with a note. Signature or behavior changes to primitives need a pause.

## Working Style (Reminder)

- Ask clarifying questions before starting if anything is ambiguous.
- **Do the refactor (Step 1) and verify LineChart tests still pass before writing any AreaChart code.** This is the single most important sequencing choice this session — if the refactor breaks LineChart, you want to know that with LineChart's existing tests, not with brand-new AreaChart tests confounding the signal.
- Show me the planned shape of `charts/_shared/cartesian.ts` (signatures + brief comments) before lifting code into it. I'd rather adjust the cut before the code moves than after.
- Explain key design choices in chat for non-trivial files.
- Run the full test suite yourself and paste the output before declaring done.
- If a test reveals an API problem, fix the API — don't loosen the test.
- If you exceed ~200 lines of implementation without corresponding tests, stop and write tests first.

## What to Deliver

1. New file: `charts/_shared/cartesian.ts`.
2. New file: `charts/AreaChart.ts`.
3. Refactored `charts/LineChart.ts` consuming the shared module (observable behavior unchanged).
4. Updated `spec/render.ts`, `spec/validate.ts`, `src/index.ts`.
5. Updated `README.md`.
6. New test files: `tests/charts/_shared/cartesian.test.ts`, `tests/charts/AreaChart.test.ts`.
7. LineChart tests (`tests/charts/LineChart.test.ts`) must still pass without modification. If you find yourself needing to modify them, that's a signal — pause and report.
8. JSDoc on every exported symbol from the shared module and AreaChart.
9. A changeset entry — `minor` bump for the new chart type. Description names AreaChart and notes the internal refactor briefly.
10. All tests passing — run the full suite and paste the output. Note the new bundle size and compare to end-of-Session-4.
11. A summary at the end covering: what was built, the refactor decisions (especially where the cut between shared and per-chart code landed), any primitive API frictions discovered, any decisions warranting my review, any performance observations from the dev-harness verification, the recorded bundle size, and what's queued for Session 6.

Begin by asking any clarifying questions, then propose your implementation order — specifically, the shape of `charts/_shared/cartesian.ts` before lifting code into it.
