# Pixi Charts — Session 2.5: Scale Adapter Refactor

## Context

This is an interim session between Sessions 2 and 3. The repo currently sits at end-of-Session-2: `ColorScheme`, `Tooltip`, and `Axis` are implemented with passing tests, but the Session 2 review surfaced two real API problems in `Axis` that will propagate into every future chart if left alone.

We are pausing forward progress to fix them now, while only one consumer exists.

**Before starting, read `CLAUDE.md` at the repo root** and the current `core/Axis.ts`, `tests/core/Axis.test.ts`. The conventions established in earlier sessions apply unchanged.

## The Two Problems Being Fixed

### Problem 1: `AxisTickFormatter` type was `(value: never) => string`

`never` is uncallable. The Session 2 implementation worked around this by widening to `(value: number | string | Date) => string`, which pushes type-narrowing onto every caller. Future charts shouldn't have to discriminate the union themselves.

**Fix:** make `Axis` generic over its scale type. The tick formatter receives the scale's actual domain type. No unions, no narrowing at call sites.

### Problem 2: The d3-scale union doesn't unify cleanly

`ScaleLinear | ScaleBand | ScaleTime | ScaleLogarithmic` has differently-typed domains and `ScaleBand` lacks `.ticks()`. The Session 2 implementation handles this with an `isBandScale` type predicate and a `ContinuousScale` projection cast — a workable but expanding pattern. Adding `ScalePoint`, `ScaleOrdinal`, or other scales later compounds the problem.

**Fix:** introduce a thin `ScaleAdapter<TDomain>` interface. D3 scales become an implementation detail behind it. `Axis` consumes a `ScaleAdapter`, not a raw D3 scale. Each scale type gets a small adapter wrapper.

## What This Session Delivers

1. **`core/ScaleAdapter.ts`** (new) — The `ScaleAdapter<TDomain>` interface and three adapter factory functions (`linearAdapter`, `bandAdapter`, `timeAdapter`).
2. **`core/Axis.ts`** (refactor) — Generic over scale type. Consumes `ScaleAdapter`, not raw D3 scales. The `AxisTickFormatter` becomes correctly typed. The `ContinuousScale` projection cast and the widened formatter union both go away.
3. **`tests/core/ScaleAdapter.test.ts`** (new) — Unit tests for each adapter.
4. **`tests/core/Axis.test.ts`** (update) — Adjust existing tests to construct `Axis` with adapters instead of raw scales. Tests must still cover the same behaviors they did at end-of-Session-2; this is a refactor, not a feature change. No tests should be deleted unless they tested implementation details that no longer exist.

This is a pure refactor session. No new functionality. No new chart types. No new primitives. The library's externally observable behavior is unchanged.

## Scope Boundaries (What NOT to Do)

- Do NOT add new features to `Axis`. The output is identical to before.
- Do NOT modify `core/Chart.ts`, `core/animation.ts`, `core/Tooltip.ts`, or `core/ColorScheme.ts`.
- Do NOT export `ScaleAdapter` or the adapter factories from `src/index.ts` yet. They're internal until a chart needs them publicly (which won't happen this session).
- Do NOT add adapters for scale types not currently used (`ScalePoint`, `ScaleOrdinal`, etc.). YAGNI. The interface should be designed so adding them later is trivial, but don't write them today.
- Do NOT introduce a `ChartSpec` API or any spec-related code. That comes in Session 4.

## Specific Implementation Requirements

### `core/ScaleAdapter.ts`

The interface and three adapters.

**Export:**

```ts
import type { ScaleLinear, ScaleBand, ScaleTime, ScaleLogarithmic } from 'd3-scale';

/**
 * A unified abstraction over d3-scale's scale types. All scales used by the
 * library are accessed via this interface so internal code (Axis, charts,
 * hit-testing) doesn't have to discriminate on the underlying scale class.
 *
 * - `scale(value)` projects a domain value to a pixel position.
 * - `ticks(count?)` returns tick values in the domain. For band scales, this
 *   returns the domain itself (band scales have no notion of "fewer ticks").
 * - `invert(pixel)` is optional — only continuous scales (linear, time, log)
 *   support it. Band scales return `undefined`.
 * - `bandwidth()` is optional — only band scales expose it.
 * - `tickFormat(count?, specifier?)` returns a formatter appropriate to the
 *   underlying scale, used as a default when the caller doesn't supply one.
 */
export interface ScaleAdapter<TDomain> {
  readonly kind: 'continuous' | 'band' | 'time';
  scale(value: TDomain): number;
  invert?(pixel: number): TDomain;
  ticks(count?: number): TDomain[];
  range(): [number, number];
  bandwidth?(): number;
  tickFormat(count?: number, specifier?: string): (value: TDomain) => string;
}

export function linearAdapter(
  scale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>,
): ScaleAdapter<number>;

export function bandAdapter(scale: ScaleBand<string>): ScaleAdapter<string>;

export function timeAdapter(scale: ScaleTime<number, number>): ScaleAdapter<Date>;
```

**Adapter behavior:**

- Each factory returns an object that delegates to the underlying d3 scale. Implementations should be ~10 lines each.
- `linearAdapter` and `timeAdapter` set `kind: 'continuous'` and `kind: 'time'` respectively. Both expose `invert`. Neither exposes `bandwidth`.
- `bandAdapter` sets `kind: 'band'`. It does NOT expose `invert` (band scales don't have a meaningful inverse — pixel-to-category requires manual iteration, which the InteractionLayer can implement in Session 3). It DOES expose `bandwidth`.
- `ticks(count)`:
  - `linearAdapter` / `timeAdapter`: delegate to `scale.ticks(count)`.
  - `bandAdapter`: returns a copy of `scale.domain()`, ignoring the count parameter. Document that `count` is ignored for band scales in the JSDoc of the interface.
- `tickFormat`:
  - `linearAdapter` / `timeAdapter`: delegate to `scale.tickFormat(count, specifier)`.
  - `bandAdapter`: returns the identity function `(v: string) => v`. Specifier is ignored.
- The `kind` discriminator exists so consumers that need scale-specific logic (e.g., a chart deciding whether to use `bandwidth()` for bar widths) can narrow the type without `instanceof` checks. This is also useful for hit-testing in Session 3.

**Why expose `kind` at all?** It's a deliberate trade-off. A pure interface with no discriminator is more abstract but forces optional-method checks (`if (adapter.invert) { ... }`) at every site. The discriminator gives consumers a clean way to write exhaustive switches when they genuinely need to. Document this rationale in the file header.

**Why not also abstract `domain()` and `nice()`?** Scales need to be constructed and configured (set domain, range, nice) by the chart that owns them. The adapter is for _consuming_ a scale, not constructing one. Charts continue to construct d3 scales directly, then wrap them in adapters for passing to `Axis` and (in Session 3) `InteractionLayer`. Make this distinction clear in the file header.

**Tests:**

- `linearAdapter` correctly delegates `scale()`, `invert()`, `ticks()`, `range()`, `tickFormat()`.
- `linearAdapter` returns `kind: 'continuous'`.
- `linearAdapter` does not expose `bandwidth`.
- `bandAdapter` correctly delegates `scale()` and `range()`.
- `bandAdapter` `ticks()` returns the scale's domain, regardless of count argument.
- `bandAdapter` does not expose `invert`.
- `bandAdapter` exposes `bandwidth()`.
- `bandAdapter` `tickFormat()` returns an identity function.
- `timeAdapter` correctly delegates `scale()` and `invert()` (verify with a known date round-trip).
- `timeAdapter` `ticks(5)` returns approximately 5 Date values.
- `timeAdapter` returns `kind: 'time'`.
- Adapters are non-leaky: mutating the returned `range()` array does not affect the underlying scale (test by asserting the returned array's identity changes or by mutating and re-reading).

### `core/Axis.ts` — refactor

**The new signature:**

```ts
import type { ScaleAdapter } from './ScaleAdapter';

export type AxisOrientation = 'top' | 'right' | 'bottom' | 'left';

export type AxisOptions<TDomain> = {
  scale: ScaleAdapter<TDomain>;
  orientation: AxisOrientation;
  length: number;
  tickCount?: number;
  tickFormat?: (value: TDomain) => string;
  showGrid?: boolean;
  gridLength?: number;
  labelColor?: number;
  lineColor?: number;
  gridColor?: number;
  fontSize?: number;
  fontFamily?: string;
};

export class Axis<TDomain> {
  readonly container: PIXI.Container;
  constructor(opts: AxisOptions<TDomain>);
  update(opts: Partial<AxisOptions<TDomain>>): void;
  destroy(): void;
  get destroyed(): boolean;
}
```

**What changes internally:**

- The `isBandScale` type predicate goes away. Use `scale.kind === 'band'` if branching is needed (it shouldn't be much, since the adapter unifies the API).
- The `ContinuousScale` projection cast goes away.
- The formatter is now correctly typed `(value: TDomain) => string`. No `never`, no union, no narrowing.
- Tick generation uses `scale.ticks(tickCount)` uniformly. Band scales ignore `tickCount`, which the adapter already handles.
- Default tick formatting calls `scale.tickFormat(tickCount)(value)` instead of branching on scale type.
- Tick positioning uses `scale.scale(value)` uniformly. For band scales, optionally add `scale.bandwidth!() / 2` to center labels on the band (which is what Session 2 likely did already — preserve this behavior, just access bandwidth via the adapter).

**Implementation notes:**

- The `Axis<TDomain>` generic flows through to the consumer's variable types. Charts will declare `const xAxis = new Axis<Date>({ scale: timeAdapter(xScale), ... })` and the formatter parameter will be correctly typed `Date` without any annotation.
- The container, render output, and visual behavior must be identical to end-of-Session-2. Snapshot existing tests' behavioral assertions and confirm they still pass after the refactor.

**Tests:**

- Update existing `tests/core/Axis.test.ts` so each test constructs `Axis` with an appropriate adapter:
  - Linear-scale tests → `linearAdapter(scaleLinear()...)`.
  - Band-scale tests → `bandAdapter(scaleBand()...)`.
  - Time-scale tests → `timeAdapter(scaleTime()...)`.
- All assertions about rendered output (child counts, label positions, gridline presence/absence, custom tickFormat, destroy/idempotency) must continue to hold.
- Add ONE new test that demonstrates the type benefit: an Axis with a time scale and a custom `tickFormat: (d: Date) => d.getFullYear().toString()` compiles cleanly and produces the expected labels. This test is as much for human readers as for the test suite — it documents the fix.

## Working Style (Reminder)

- Ask clarifying questions before starting if anything is ambiguous.
- Before refactoring `Axis`, show me the new file outline (signatures + brief comments) so I can sanity-check the shape.
- Explain in chat any place the refactor produces a meaningfully different internal structure from end-of-Session-2.
- Run the FULL test suite (not just the changed files) and paste the output. A refactor like this should leave all pre-existing tests passing without modification (other than the Axis test file updates described above).
- If you discover that the refactor would require a behavior change (not just a type change) to keep tests passing, stop and report it in chat — that's a sign something deeper is off.

## What to Deliver

1. New file: `core/ScaleAdapter.ts` with the interface and three adapters.
2. New test file: `tests/core/ScaleAdapter.test.ts`.
3. Refactored `core/Axis.ts` consuming `ScaleAdapter` instead of raw d3 scales.
4. Updated `tests/core/Axis.test.ts` using adapters; all prior behavioral assertions preserved; plus the one new type-benefit test.
5. JSDoc on every exported symbol in `ScaleAdapter.ts`, with file-header comments explaining the rationale for the abstraction (why an adapter exists at all, why `kind` is exposed, why construction stays on the chart side).
6. A changeset entry. This is a `patch` bump — internal refactor, no public API change yet (since none of these symbols are exported from `src/index.ts`).
7. All tests passing — paste output of the full suite.
8. A summary at the end covering: what was refactored, how many lines were touched in `Axis.ts`, anything that surprised you (e.g., a test that needed a non-trivial adjustment, suggesting the abstraction missed something), and confirmation that the externally observable behavior is unchanged.

Begin by asking any clarifying questions, then proceed.
