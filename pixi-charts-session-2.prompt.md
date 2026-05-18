# Pixi Charts — Session 2: Core Primitives (Axis, Tooltip, ColorScheme)

## Context

This is Session 2 of building `pixi-charts`. Session 1 established the project scaffolding, the `Chart` abstract base class, and the `tween()` animation helper. All of that should now exist in the repo with passing tests.

**Before starting, read `CLAUDE.md` at the repo root** (or, if it doesn't exist yet, `CONTRIBUTING.md` and the existing files in `packages/pixi-charts/src/core/`). The architectural principles and conventions established in Session 1 apply to everything you build today — strict typing, no `any`, no default exports, D3 submodule imports only, predictable side-effect ordering, tests as documentation.

## What This Session Delivers

Three core primitives that future chart implementations will compose:

1. **`core/Axis.ts`** — PIXI-rendered axis (horizontal or vertical, supporting linear / band / time / log scales).
2. **`core/Tooltip.ts`** — DOM-based tooltip overlay, positioned over the canvas.
3. **`core/ColorScheme.ts`** — Wraps `d3-scale-chromatic` palettes with a typed, ergonomic API.

These are NOT exported from the public `src/index.ts` yet — they remain internal until a chart consumes them. We'll add exports in the session that introduces the first chart.

## Scope Boundaries (What NOT to Do)

- Do NOT build Legend or InteractionLayer this session — those come in Session 3.
- Do NOT build any chart implementations.
- Do NOT add visual regression tests (Playwright) — unit tests with `happy-dom` only.
- Do NOT modify `core/Chart.ts` or `core/animation.ts` unless a primitive genuinely requires it. If you find yourself needing to, stop and propose the change in chat first.

## Specific Implementation Requirements

### `core/ColorScheme.ts` (start here — simplest, sets the pattern)

This is the easiest primitive and worth building first to warm up.

**Export:**

- `categoricalSchemes`: a typed record of categorical palette names → arrays of hex strings, wrapping a curated subset of `d3-scale-chromatic` schemes (`schemeCategory10`, `schemeTableau10`, `schemeSet2`, `schemePaired`).
- `sequentialSchemes`: a typed record of sequential interpolator names → interpolator functions, wrapping `interpolateViridis`, `interpolateBlues`, `interpolateInferno`, `interpolatePlasma`.
- `CategoricalSchemeName` and `SequentialSchemeName`: string literal union types derived from the records (use `keyof typeof ...` so adding a scheme updates the type automatically).
- `getCategoricalColor(scheme: CategoricalSchemeName, index: number): number` — returns a PIXI-compatible numeric color (0xRRGGBB), wrapping the palette on overflow.
- `getSequentialColor(scheme: SequentialSchemeName, t: number): number` — `t` is in [0, 1]; clamps out-of-range values and returns a PIXI numeric color.

**Implementation notes:**

- D3 returns colors as CSS strings (`"#1f77b4"` or `"rgb(...)"`). PIXI wants numbers (`0x1f77b4`). Write a small internal `cssColorToPixi(css: string): number` helper using `d3-color`'s `color()` function — it normalizes any CSS color string into RGB components you can bit-shift into a number. Do not write a regex parser; use `d3-color`.
- The wrapping behavior for `getCategoricalColor` (`index % palette.length`) should be documented in JSDoc — it's a deliberate ergonomic choice so consumers don't have to handle overflow.
- Throw a descriptive error if an unknown scheme name is passed (defense in depth, even though TypeScript should catch it at compile time).

**Tests:**

- Returns expected color for known scheme + index pairs (snapshot a few known values).
- Wraps correctly when index exceeds palette length.
- Clamps `t` in `getSequentialColor` to [0, 1].
- Throws with a useful error message on unknown scheme name.
- `cssColorToPixi` handles `#rgb`, `#rrggbb`, `rgb(...)`, and named colors.

### `core/Tooltip.ts`

A DOM-based tooltip — explicitly NOT a PIXI object. Easier to style, supports HTML content, and accessible by default.

**Export a single class `Tooltip`:**

```ts
class Tooltip {
  constructor(opts: { container: HTMLElement });
  show(opts: { x: number; y: number; content: string | HTMLElement }): void;
  hide(): void;
  destroy(): void;
  get destroyed(): boolean;
}
```

**Behavior:**

- On construction, creates a `<div>` element styled with sensible defaults (absolute positioning, pointer-events: none, white background, subtle border, padding, font-family inheriting from container, box-shadow, border-radius, max-width 300px, hidden by default via `display: none`).
- The tooltip div is appended to the constructor's `container` argument, NOT to `document.body`. This ensures it scopes correctly inside the chart's container, respects CSS isolation, and cleans up when the container is removed.
- `show({ x, y, content })` positions the tooltip at `(x, y)` relative to the container, then makes it visible. `content` may be a plain string (rendered as text) or an `HTMLElement` (appended as-is — caller is responsible for sanitization).
- **Edge avoidance:** when the tooltip would overflow the container's right or bottom edge, flip it to the left or above the cursor respectively. Use the container's `getBoundingClientRect()` and the tooltip's own measured width/height. This is a real polish detail that elevates the library above naive implementations.
- `hide()` sets `display: none` but does not remove the element from the DOM (so subsequent `show()` calls are cheap).
- `destroy()` removes the element from the DOM and zeros internal references. Idempotent.
- All styling is applied via inline styles set in TypeScript, not via injected stylesheets. This keeps the library zero-CSS-config and avoids stylesheet pollution. Document this decision in JSDoc.

**Tests:**

- Construction creates a hidden div inside the container.
- `show()` makes it visible and positions correctly.
- `show()` with a string sets `textContent` (not `innerHTML` — XSS safety by default).
- `show()` with an `HTMLElement` appends it as a child.
- Edge avoidance: tooltip flips left when near the right edge of the container.
- Edge avoidance: tooltip flips up when near the bottom edge.
- `hide()` sets `display: none` but keeps the element.
- `destroy()` removes the element from the DOM.
- `destroy()` is idempotent.
- Re-calling `show()` after `destroy()` throws a descriptive error (don't silently no-op — that hides bugs).

### `core/Axis.ts` (the meaty one — save for last)

The most complex primitive. Renders an axis line, tick marks, tick labels, and optional gridlines into a PIXI container.

**Export a single class `Axis`:**

```ts
import type { ScaleLinear, ScaleBand, ScaleTime, ScaleLogarithmic } from 'd3-scale';

type AxisScale =
  | ScaleLinear<number, number>
  | ScaleBand<string>
  | ScaleTime<number, number>
  | ScaleLogarithmic<number, number>;

type AxisOrientation = 'top' | 'right' | 'bottom' | 'left';

type AxisOptions = {
  scale: AxisScale;
  orientation: AxisOrientation;
  length: number; // pixel length of the axis line
  tickCount?: number; // hint, default 5 (ignored for band scales)
  tickFormat?: (value: never) => string; // override d3's default formatter
  showGrid?: boolean; // gridlines extending across the plot area
  gridLength?: number; // required if showGrid is true
  labelColor?: number; // PIXI color, default 0x555555
  lineColor?: number; // PIXI color, default 0x888888
  gridColor?: number; // PIXI color, default 0xeeeeee
  fontSize?: number; // default 11
  fontFamily?: string; // default 'sans-serif'
};

class Axis {
  readonly container: PIXI.Container;
  constructor(opts: AxisOptions);
  update(opts: Partial<AxisOptions>): void; // re-render with new options
  destroy(): void;
  get destroyed(): boolean;
}
```

**Behavior:**

- On construction, creates a `PIXI.Container` and renders the axis into it. The consumer adds `axis.container` to its own stage and positions it.
- **Ticks come from D3, drawing comes from us.** Use `scale.ticks(tickCount)` for linear/time/log scales. For band scales, the "ticks" are the band domain values themselves (`scale.domain()`). Never call `scale.tickFormat()` if `opts.tickFormat` was provided.
- Renders, in order, into the container:
  1. The main axis line (a `PIXI.Graphics` line of length `opts.length`).
  2. Tick marks (short perpendicular lines, ~6px long, at each tick position).
  3. Tick labels (`PIXI.Text` objects, positioned with appropriate offset and anchor based on orientation).
  4. Optional gridlines (perpendicular lines extending `gridLength` into the plot area, behind the axis line — `zIndex: -1` on the gridline graphics, or add them to the container first).
- Tick label positioning differs by orientation: bottom/top axes anchor labels horizontally centered with vertical offset; left/right axes anchor labels vertically centered with horizontal offset.
- `update()` is a full re-render — clear the container's children, dispose of old PIXI.Text objects (call `.destroy()` on them), and rebuild. Future optimization (diffing) is out of scope; document the simple approach in JSDoc.
- `destroy()` removes all children, calls `.destroy()` on each (especially Text objects, which hold texture references), and destroys the container itself. Idempotent.

**Implementation notes:**

- Band scales don't have a `.ticks()` method — handle this with a type narrowing function (`isBandScale`). Don't use `'ticks' in scale` checks; write a proper type predicate.
- `PIXI.Text` is expensive to create. For this session, accept the cost; we'll explore `BitmapText` or text pooling in a later performance pass. Document this in JSDoc as a known optimization opportunity.
- For temporal axes, `d3-time-format`'s default formatter produces sensible labels — don't override unless `opts.tickFormat` is provided.
- For log scales, only show labels at major ticks (`scale.ticks()` returns these); minor ticks are out of scope for v1.

**Tests:**

- Construction renders the expected number of children (line + N ticks + N labels for linear scale).
- Band scale produces one tick per domain entry.
- Orientation correctly positions labels (assert on Text object `x`, `y`, `anchor`).
- `showGrid: true` adds gridline graphics; `showGrid: false` does not.
- `update()` clears old children and renders new ones (no leaks — assert child count after update).
- `destroy()` empties the container and marks itself destroyed.
- `destroy()` is idempotent.
- Custom `tickFormat` overrides d3's default.
- Linear scale with `tickCount: 10` produces approximately 10 ticks (d3 may return slightly more or fewer — d3 picks "nice" round numbers, so test for a reasonable range like `[8, 12]` rather than exactly 10).

## Working Style (Reminder from Session 1)

- Ask clarifying questions before starting if anything is ambiguous.
- Show me the planned file changes before implementing.
- Explain key design choices in chat for non-trivial files.
- Run tests yourself and paste the output before declaring done.
- If a test reveals an API problem, fix the API — don't loosen the test.
- If you exceed ~200 lines of implementation without corresponding tests, stop and write tests first.

## What to Deliver

1. The three new files: `core/ColorScheme.ts`, `core/Tooltip.ts`, `core/Axis.ts`.
2. Their corresponding test files under `tests/core/`.
3. Updated dependencies in `packages/pixi-charts/package.json` if any new D3 submodules are needed (likely `d3-color` is the only addition — `d3-scale-chromatic`, `d3-scale`, `d3-time-format` should already be there from Session 1's spec).
4. JSDoc comments on every exported symbol explaining purpose, parameters, return values, and any non-obvious behavior (especially the "why" behind design decisions).
5. A changeset entry (`.changeset/`) describing what was added, using `pnpm changeset` semantics: this is a `minor` bump for `pixi-charts` since these are additive internal modules.
6. All tests passing — run them and paste the output.
7. A short summary at the end covering: what was built, any decisions you made that warrant my review, any APIs you found awkward while building (these signal places to refactor before charts depend on them), and anything you deferred to a follow-up session.

Begin by asking any clarifying questions, then propose your implementation order and start.
