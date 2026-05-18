# Pixi Charts — Session 4: LineChart (First End-to-End Chart)

## Context

This is Session 4 of building `pixi-charts`. Sessions 1–3 are complete:

- **Session 1** — Project scaffolding, `Chart` abstract base class, `tween()` animation helper.
- **Session 2** — `ColorScheme`, `Tooltip`, `Axis` primitives.
- **Session 2.5** — Refactor: `core/ScaleAdapter.ts` introduced (the `ScaleAdapter<TDomain>` interface plus `linearAdapter`, `bandAdapter`, `timeAdapter` factories). `Axis` is now generic over its scale domain and consumes a `ScaleAdapter`, not a raw d3 scale.
- **Session 3** — `Legend`, `InteractionLayer` primitives. `InteractionLayer` is scale-agnostic; it takes a generic `HitTester<D>` function, and the charts that own it are responsible for building hit-testers (using `ScaleAdapter` where scale-based hit-testing is needed).

All prior code is in place with passing tests (137/137 as of end of Session 3).

**Before starting, read `CLAUDE.md` at the repo root** and skim the files in `packages/pixi-charts/src/core/` — especially `ScaleAdapter.ts`, `Axis.ts`, `InteractionLayer.ts`, `Tooltip.ts`, `Legend.ts`, and the `Chart` base class. LineChart composes all of them; you need to know their exact current APIs. The conventions established in earlier sessions apply unchanged.

## What This Session Delivers

The first end-to-end chart implementation, plus the public `ChartSpec` API that all future charts will follow:

1. **`spec/ChartSpec.ts`** — The unified TypeScript type definitions for the declarative spec API.
2. **`spec/validate.ts`** — Runtime zod schema mirroring the TypeScript types, with teaching error messages.
3. **`spec/render.ts`** — The dispatcher: `render(spec, container) → Chart`.
4. **`utils/lttb.ts`** — Largest Triangle Three Buckets downsampling.
5. **`charts/LineChart.ts`** — The first chart, composing all five primitives.
6. **Public API surface** — `src/index.ts` now exports the user-facing symbols.

This is the session where the library becomes usable. By the end, a consumer can write `render({ type: 'line', data: [...], encoding: {...} }, container)` and see a chart appear.

## Scope Boundaries (What NOT to Do)

- Do NOT implement other chart types — only LineChart this session.
- Do NOT add update animations or data-update transitions. Enter animations only.
- Do NOT add zoom, pan, or brush — interaction is hover/click tooltips only.
- Do NOT add a docs site or examples package. Those come later.
- Do NOT modify primitives (`Chart`, `animation`, `ScaleAdapter`, `Axis`, `Tooltip`, `Legend`, `InteractionLayer`, `ColorScheme`) unless a genuine API problem surfaces during integration. If you find yourself wanting to, stop and propose the change in chat first — the earlier API reviews existed precisely to front-load this. Small additive changes (a new optional option, a new getter) with a note in the summary are acceptable; signature changes need a pause.

## Specific Implementation Requirements

### `spec/ChartSpec.ts` (build first — defines the API contract)

The unified spec type. For this session, only the `'line'` chart type is fully supported; other type literals are declared but their consumers don't exist yet (the dispatcher throws a useful error for them).

```ts
export type FieldType = 'quantitative' | 'categorical' | 'temporal';

export type EncodingField = {
  field: string;
  type: FieldType;
};

export type ColorEncoding = {
  field: string;
  scheme?: string; // resolves to a categorical or sequential scheme by name
};

export type ChartEncoding = {
  x?: EncodingField;
  y?: EncodingField;
  color?: ColorEncoding;
  size?: { field: string }; // scatter (not used in this session)
  value?: { field: string }; // pie, heatmap (not used in this session)
};

export type AnimationOptions = {
  enter?:
    | boolean
    | {
        duration?: number;
        ease?: 'linear' | 'easeOut' | 'easeInOut';
      };
};

export type ChartOptions = {
  title?: string;
  showLegend?: boolean;
  showTooltip?: boolean;
  width?: number;
  height?: number;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
};

export type ChartType = 'line' | 'area' | 'bar' | 'scatter' | 'heatmap' | 'pie';

export type ChartSpec = {
  type: ChartType;
  data: ReadonlyArray<Record<string, unknown>>;
  encoding: ChartEncoding;
  options?: ChartOptions;
  animation?: AnimationOptions;
};
```

**Notes:**

- `data` is `ReadonlyArray` to signal the library doesn't mutate consumer data.
- `Record<string, unknown>` (not `any`) for row values — forces consumers and the library to type-narrow at use sites.
- All literal unions (`FieldType`, `ChartType`, ease names) should be exported for consumers who want to construct specs programmatically with type safety.
- The `animation.enter.ease` literal union must exactly match the `EasingName` type that `core/animation.ts` already exports. Import and reuse `EasingName` rather than re-declaring the string literals — single source of truth. If they've drifted, flag it.
- Document each field with JSDoc — these types are the public API and will appear in IDE intellisense.

### `spec/validate.ts`

A zod schema that mirrors `ChartSpec` exactly, plus a validation function.

**Export:**

- `chartSpecSchema: z.ZodType<ChartSpec>` — the zod schema.
- `validateChartSpec(input: unknown): ChartSpec` — parses and returns a typed spec, or throws a `ChartSpecValidationError` with a teaching message.
- `ChartSpecValidationError extends Error` — custom error class so consumers can catch it specifically.

**Error message requirements (the "teach, don't punish" principle — same spirit as the `ScaleAdapter` and `ColorScheme` defensive guards):**

When validation fails, the error message must include:

1. The path to the invalid field (e.g., `encoding.x.type`).
2. What was received (the actual value).
3. What was expected (the allowed values or shape).
4. A minimal valid example of that field.

Example of the kind of error we want:

```
ChartSpecValidationError: Invalid value at `encoding.x.type`.
  Received: "number"
  Expected one of: "quantitative", "categorical", "temporal"
  Example: { field: "revenue", type: "quantitative" }
```

To produce these, intercept zod's `ZodError`, walk its `issues` array, and format each issue using a small helper. Don't just rethrow zod's default formatting — it's clinical and unhelpful. The minimal-example snippets can live in a `const examples` map keyed by field path.

**Behavior:**

- Validates that `data` is non-empty (a chart with zero rows is almost always a bug; throw a clear error suggesting the consumer check their data pipeline).
- Validates that every field referenced in `encoding` exists in the first data row's keys. This catches typos like `encoding.x.field: 'revenue'` when the data has `revenu`. Include the available field names in the error message.
- For `type: 'line'` specifically, validates that both `encoding.x` and `encoding.y` are present.
- Other chart types' encoding requirements are NOT validated this session — they'll be added as those charts are implemented. Document this in JSDoc.

**Tests:**

- Valid line spec passes validation and returns a properly typed `ChartSpec`.
- Missing `encoding.x` for line type throws with a message mentioning `encoding.x`.
- Invalid `type` value throws and lists allowed types.
- Invalid `encoding.x.type` throws and lists allowed FieldTypes.
- Empty `data` array throws with a useful message.
- Field referenced in encoding but not in data throws and lists available fields.
- The thrown error is an instance of `ChartSpecValidationError`.
- A spec with extra unknown options does NOT throw (forward compatibility — log a `console.warn` instead, but don't reject the spec).

### `spec/render.ts`

The dispatcher.

**Export:**

```ts
import type { ChartSpec } from './ChartSpec';
import type { Chart } from '../core/Chart';

export function render(spec: ChartSpec, container: HTMLElement): Chart;
```

**Behavior:**

- Validates the spec via `validateChartSpec`.
- Dispatches on `spec.type`:
  - `'line'` → constructs and returns a `LineChart` instance.
  - Other types → throws an error with the message `Chart type "<type>" is not implemented yet. Available: line.` Update this message as charts get added — it's a one-line maintenance burden worth keeping accurate.
- The returned `Chart` instance has been constructed AND has had `.render()` called on it. Consumers get a fully-rendered chart back, not a half-initialized object.
- The container's existing children are NOT cleared — that's the consumer's responsibility. Document this.

**Tests:**

- Valid line spec returns an instance of `LineChart`.
- Returned instance is fully rendered (assert via `LineChart`'s state, not just construction).
- Invalid spec propagates the `ChartSpecValidationError`.
- Unsupported chart type throws with the helpful message.

### `utils/lttb.ts`

Largest Triangle Three Buckets downsampling. Reduces a series of N points to M points (M < N) while preserving visual shape.

**Export:**

```ts
export type DataPoint = { x: number; y: number };
export function lttb(data: ReadonlyArray<DataPoint>, threshold: number): DataPoint[];
```

**Behavior:**

- If `threshold >= data.length` or `threshold < 3`, return a shallow copy of `data` unchanged.
- Otherwise, apply the standard LTTB algorithm. The algorithm is well-defined enough to implement from the description: divide the data into `threshold - 2` buckets of equal size; always include the first and last points; for each bucket, select the point that forms the largest triangle (by area) with the previous selected point and the average of the next bucket.
- Operate on the `{x, y}` shape directly. The line chart will convert its data into this shape before passing it in.
- This is a pure function — no side effects, no mutation of the input array. (Same pure-function discipline as the scale adapters and the InteractionLayer state helper.)

**Implementation notes:**

- Document the algorithm in a top-of-file comment with a one-paragraph explanation and a reference to the original work (Sveinn Steinarsson, 2013, University of Iceland). Helps future contributors and signals you understand what you're using.
- Numeric stability: the triangle area formula involves cross-products that can overflow for very large coordinate values. For v1, accept the risk — chart pixel coordinates won't get pathological. Note this in JSDoc as a known limitation.

**Tests:**

- Threshold >= data.length returns data unchanged.
- Threshold < 3 returns data unchanged.
- Threshold = 100 on a 1000-point input returns exactly 100 points.
- First and last points are always preserved.
- A known sine-wave input downsamples to a recognizable shape (assert that local extrema are preserved within tolerance — test the property, not specific output values).
- Pure function: input array is not mutated (snapshot before/after).
- Empty data returns empty array.

### `charts/LineChart.ts` (the main event)

The first chart. Composes Axis × 2, optional Legend, optional Tooltip, InteractionLayer, and uses `tween()` for the enter animation. Inherits from `Chart`.

**Export:**

```ts
import type { ChartSpec } from '../spec/ChartSpec';

export class LineChart extends Chart {
  constructor(opts: { container: HTMLElement; spec: ChartSpec });
  // inherits render(), destroy(), destroyed from Chart
}
```

**Behavior:**

#### Data transformation

- The chart accepts the raw spec and extracts what it needs:
  - `xField = spec.encoding.x.field`, `yField = spec.encoding.y.field`.
  - For each row, produce a `{ x, y, datum }` point where `x` and `y` are numeric (after type conversion based on `encoding.x.type` and `encoding.y.type`), and `datum` is the original row (preserved for tooltips and click events).
  - For `temporal` type, parse `x` to a `Date` (keep the `Date` object around for the time scale; also keep its `.getTime()` numeric form if convenient for sorting).
  - For `categorical` type on the x-axis (rare for line charts but valid), the x positions come from a band scale.
- If color encoding is present and the field is categorical, split the data into series by the color field; render one line per series with a different color from the categorical scheme (via `getCategoricalColor`).
- If color is absent or the encoded field has only one unique value, render a single line in the first color of `schemeCategory10` (via `getCategoricalColor(scheme, 0)`).

#### Layout

- Default margins: `{ top: 24, right: 24, bottom: 40, left: 56 }`. Override via `spec.options.margin`.
- Plot area dimensions are `width - margin.left - margin.right` and `height - margin.top - margin.bottom`.
- The chart's overall width/height come from `spec.options.width/height`, or fall back to the container's `clientWidth/clientHeight`, or fall back to 600×400.

#### Scales and adapters

This is the part that changed since the original Session 4 draft. The chart constructs d3 scales directly, then wraps each in the appropriate adapter from `core/ScaleAdapter.ts` before handing it to `Axis` (and before using it for hit-testing).

- X-axis scale, chosen by `encoding.x.type`:
  - `quantitative` → `scaleLinear()`, domain from `d3-array`'s `extent`, range `[0, plotWidth]`. Wrap with `linearAdapter`.
  - `temporal` → `scaleTime()`, domain from `extent` on the parsed `Date` values, range `[0, plotWidth]`. Wrap with `timeAdapter`.
  - `categorical` → `scaleBand<string>()`, domain from unique values in insertion order, range `[0, plotWidth]`, padding 0. Wrap with `bandAdapter`.
- Y-axis scale: always `scaleLinear()`, domain `[0, max]` if all y-values are non-negative, otherwise `extent`; use `.nice()`; range `[plotHeight, 0]` (inverted, as is conventional). Wrap with `linearAdapter`.
- Construct two `Axis` instances using the adapters: `new Axis<TDomain>({ scale: xAdapter, orientation: 'bottom', ... })` and `new Axis<number>({ scale: yAdapter, orientation: 'left', ... })`. The `Axis` generic parameter is inferred from the adapter — no manual annotation needed, but the types must flow cleanly. If you find yourself writing a cast to satisfy `Axis`, stop: that means either the adapter or the Axis generic isn't doing its job, and it's a primitive bug to report, not paper over.
- Keep references to both the raw scales AND the adapters on the instance. The raw scales are needed to project data points to pixels when drawing the line (`scale(value)` via the adapter works too — prefer the adapter's `scale()` method for consistency, and only reach for the raw d3 scale if the adapter genuinely doesn't expose what you need; if that happens, note it as an adapter gap).

#### Downsampling

- If a series has more than **10,000 points**, run it through `lttb` with a threshold of 2000 before drawing. Log a `console.info` once per chart instance noting downsampling occurred (helps consumers diagnose performance work). Make both numbers named constants.
- Downsampling operates on `{x, y}` pixel-or-domain pairs — decide which and document it. (Domain-space is cleaner: downsample before projecting, so the projection happens once on fewer points.)

#### Drawing the line

- Use `PIXI.Graphics`. For each series:
  - Stroke width 2, series color, alpha 1. Use the current PIXI v8 Graphics stroke API (`.stroke()` / `.moveTo()` / `.lineTo()` — match whatever pattern the `Axis` primitive already uses for its line drawing, for consistency).
  - `moveTo` the first point, `lineTo` for subsequent points, then stroke.
- For the enter animation: use `tween()` from `core/animation.ts`. Tween `progress` from 0 to 1; on each frame, clear the graphics and redraw only the portion of the line corresponding to the first `progress * points.length` points (left-to-right draw-on effect). At `progress = 1`, draw the full line.
- Register the tween's cancel handle with the base class's tween tracking (the `addTween` mechanism from Session 1) so `destroy()` cancels an in-flight animation cleanly.
- After the enter animation completes, the graphics object stays static — no per-frame redraw.
- Respect `spec.animation`: if `enter` is `false`, skip the animation and draw the full line immediately. If it's an object, pass `duration` and `ease` through to `tween()`. `tween()` already handles `prefers-reduced-motion` internally — don't re-implement that check.

#### Tooltip + InteractionLayer

- If `spec.options.showTooltip !== false` (default true), construct a `Tooltip` (Session 2) attached to the container.
- Construct an `InteractionLayer` (Session 3) covering the plot area. Remember: `InteractionLayer` is scale-agnostic — LineChart supplies the `HitTester<D>` function.
- **Building the hit-tester** — this is where the chart uses the adapter, per the strategy documented in `InteractionLayer`'s `HitTester` JSDoc:
  - For `quantitative` / `temporal` x-axes (continuous adapters): the hit-tester uses the x-adapter's `invert()` to convert the pointer's x-coordinate back to a domain value, then finds the nearest data point by x within a threshold (~20px in pixel space). For multi-series charts, search across all series and return the closest point.
  - For `categorical` x-axes (band adapter, no `invert()`): the hit-tester iterates the band domain using the adapter's `scale()` and `bandwidth()` to find which band the pointer's x falls in, then matches the data point(s) in that band.
  - Use the adapter's `kind` discriminator to choose the strategy cleanly rather than checking for the presence of `invert`.
- On `hover`: show the tooltip with content like `${xField}: ${formattedX} • ${yField}: ${formattedY}` (use `d3-format` for numbers, `d3-time-format` for dates). Position at the event's `globalPosition`.
- On `leave`: hide the tooltip.
- On `click`: no-op for v1, but the InteractionLayer is wired up so the integration is real (a click handler can be added later without rewiring).
- If the chart resizes (see below), the scales change, so the hit-tester must be rebuilt — use `InteractionLayer.setHitTester()` to swap in the new one rather than recreating the whole layer.

#### Legend

- If `spec.options.showLegend !== false` (default true) AND there's a color encoding producing multiple series, render a categorical `Legend` (Session 3) in the top-right of the plot area, vertically oriented. Use the `Legend`'s `width`/`height` getters to position it so it sits inside the plot area's top-right corner without overflowing.
- If there's only one series, skip the legend regardless of the option.

#### Resize

- The base class's `ResizeObserver` fires on container resize. Use whatever resize hook the `Chart` base class exposes (from Session 1) to: recompute plot dimensions, rebuild scales and adapters with the new ranges, call `Axis.update()` on both axes, rebuild and swap the hit-tester via `InteractionLayer.setHitTester()`, call `InteractionLayer.resize()`, reposition the legend, and redraw the line(s). If the base class doesn't expose a usable resize hook, adding one is a base-class change — pause and propose it in chat before implementing.
- Resize redraws the line in its final state (no re-running the enter animation on every resize — that would be annoying).

#### Destruction

- `destroy()` is inherited from the base class, which already cancels tracked tweens. But LineChart owns instances of `Axis` ×2, optionally `Legend`, optionally `Tooltip`, and `InteractionLayer` — each must be destroyed. Override `destroy()` to call `super.destroy()` first (cancels tweens, tears down the PIXI app per Session 1's implementation), then call `.destroy()` on each owned primitive. Make the override idempotent — guard against double-destroy.

**Tests (be pragmatic — full visual rendering is hard to test in happy-dom; focus on observable behavior and integration, consistent with how the primitives were tested):**

- Construction with a valid spec does not throw and does not auto-render.
- After `render()`: scales/adapters are constructed with expected domains (assert on the adapter's `range()` and on domain extents).
- After `render()`: two `Axis` instances exist and their containers are added to the stage (assert via stage children, or by spying on the `Axis` constructor).
- A single-series spec renders one line; a multi-series spec (categorical color encoding) renders N lines.
- Downsampling triggers on a series > 10000 points (generate the dataset; assert the drawn point count equals the threshold).
- Downsampling does NOT trigger below the threshold.
- Tooltip is created when `showTooltip` is true (default) and not when `false`.
- Legend is created for multi-series, not for single-series.
- Hit-tester strategy: for a continuous x-axis, the hit-tester resolves a pointer coordinate to the nearest datum (test the hit-tester function directly — it should be extractable as a pure-ish function, mirroring the InteractionLayer state-helper approach from Session 3).
- Hit-tester strategy: for a categorical x-axis, the hit-tester resolves a pointer coordinate to the correct band's datum.
- `animation.enter: false` draws the full line immediately (no tween registered).
- `destroy()` calls destroy on all owned primitives (spy on each).
- `destroy()` is idempotent.

### `src/index.ts` — public API surface

After this session, the library has a real public API. `index.ts` should export:

```ts
// Spec API (primary entry point for most consumers)
export { render } from './spec/render';
export { validateChartSpec, ChartSpecValidationError } from './spec/validate';
export type {
  ChartSpec,
  ChartType,
  ChartEncoding,
  EncodingField,
  ColorEncoding,
  ChartOptions,
  AnimationOptions,
  FieldType,
} from './spec/ChartSpec';

// Imperative API (escape hatch for advanced consumers)
export { Chart } from './core/Chart';
export { LineChart } from './charts/LineChart';
```

Do NOT export the internal primitives (`Axis`, `Legend`, `Tooltip`, `InteractionLayer`, `ColorScheme`, `ScaleAdapter` and its factories, `animation` helpers, `lttb`). They remain internal. We can promote them later if there's demand — keeping the public surface small now preserves freedom to refactor internals.

## Integration Discoveries

This is the first session where all the primitives integrate against a real consumer. You will likely discover small API frictions — a parameter that should have been optional, a missing accessor on `ScaleAdapter`, an awkward seam between `Axis.update()` and resize. **For each one, flag it in your summary.** Don't silently work around them by piling wrapper code into LineChart; that's how structural rot starts.

Pay particular attention to:

- Whether `ScaleAdapter` exposes everything LineChart needs for both drawing and hit-testing, or whether you reached for the raw d3 scale. Each reach-through is a signal the adapter interface has a gap.
- Whether the `Chart` base class's resize hook is actually usable for a real chart, or whether Session 1's design was too thin.
- Whether `Axis.update()` cleanly handles the resize case or fights you.

If a primitive's API genuinely needs to change: small additive changes (new optional option, new getter) are fine to do directly with a note in the summary; signature changes or behavior changes need a pause and a proposal in chat first.

## Working Style (Reminder)

- Ask clarifying questions before starting if anything is ambiguous.
- Show me the planned file changes and your intended implementation order before implementing — especially helpful this session given the breadth.
- Explain key design choices in chat for non-trivial files.
- Run the full test suite yourself and paste the output before declaring done.
- If a test reveals an API problem, fix the API — don't loosen the test.
- If you exceed ~200 lines of implementation without corresponding tests, stop and write tests first.

## What to Deliver

1. The new files: `spec/ChartSpec.ts`, `spec/validate.ts`, `spec/render.ts`, `utils/lttb.ts`, `charts/LineChart.ts`.
2. Updated `src/index.ts` with the public API surface.
3. Corresponding test files for each new file.
4. Any new dependencies in `package.json` — likely none, since all D3 submodules and zod were added in earlier sessions. Double-check and confirm.
5. JSDoc comments on every exported symbol — these now appear in consumer IDE intellisense, so quality matters more than ever.
6. A changeset entry — this is a `minor` bump (first usable version). The description should be substantive: name the LineChart, the spec API (`render`, `validateChartSpec`, `ChartSpec`), and the public exports.
7. Update the root `README.md`: move "Line chart" from "coming soon" into an "Available" / "Status" section, and add a small code example showing the `render(spec, container)` pattern.
8. All tests passing — run the full suite and paste the output. Note the new `dist/index.js` bundle size; this is the first session where the bundle grows meaningfully (LineChart pulls in all five primitives + the spec layer), so the number is worth recording.
9. A summary at the end covering: what was built, any primitive API frictions discovered and how you handled them (especially any `ScaleAdapter` gaps or `Chart` resize-hook issues), any decisions warranting my review, anything that surprised you during integration, the recorded bundle size, and what's queued for Session 5.

Begin by asking any clarifying questions, then propose your implementation order and start.
