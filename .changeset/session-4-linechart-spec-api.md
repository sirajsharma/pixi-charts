---
"pixi-charts": minor
---

First end-to-end chart and the declarative spec API. After this release, `pixi-charts` is usable: a consumer can describe a chart as a JSON-shaped `ChartSpec` and hand it to a single `render()` call.

**New public API**

- `render(spec, container): Promise<Chart>` — primary entry point. Validates the spec, dispatches on `spec.type`, awaits PixiJS's async `Application.init()`, runs the first render, and returns the fully-rendered chart instance. The returned `Promise` reflects the fact that PIXI v8 requires `await app.init(...)` — a synchronous signature would force handing back a half-built chart.
- `validateChartSpec(input): ChartSpec` and the `ChartSpecValidationError` class — runtime validator built on zod with intentionally teaching error messages: every issue includes its path, the received value, the expected shape, and (where useful) a minimal example. Unknown top-level keys do not fail validation; they emit a `console.warn` for forward compatibility.
- `LineChart` (imperative escape hatch) — composes `Axis × 2`, optional `Legend` and `Tooltip`, and an `InteractionLayer` whose `HitTester` is built using the `ScaleAdapter`'s `kind` discriminator (`invert()` + binary search for continuous / time x-axes; band-iteration for categorical x-axes). The `Series` / `SeriesPoint` types and a pure `createLineHitTester` helper are exported alongside the class so the hit-test strategy can be unit-tested in isolation.
- Type re-exports: `ChartSpec`, `ChartType`, `ChartEncoding`, `EncodingField`, `ColorEncoding`, `ChartOptions`, `AnimationOptions`, `FieldType`.

**Internal additions**

- `utils/lttb.ts` — Largest Triangle Three Buckets downsampling. LineChart routes any series with more than 10,000 points through this with a threshold of 2,000, preserving the first/last points and a recognizable shape.

**Removed from the public surface**

The previously exported `tween` / `easings` helpers and the `EasingName` / `TweenOptions` / imperative `ChartOptions` types are no longer re-exported from `src/index.ts`. They remain internal building blocks; reach for them via the imperative API only if you're authoring a chart that lives outside this package. We can promote them back to the public surface later if demand justifies the API-stability cost.
