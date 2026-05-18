# Pixi Charts — Session 3: Legend and InteractionLayer

## Context

This is Session 3 of building `pixi-charts`. Sessions 1, 2, and 2.5 are complete:

- **Session 1** — Project scaffolding, `Chart` abstract base class, `tween()` animation helper.
- **Session 2** — `ColorScheme`, `Tooltip`, `Axis` primitives.
- **Session 2.5** — Refactor: introduced `core/ScaleAdapter.ts` (the `ScaleAdapter<TDomain>` interface plus `linearAdapter`, `bandAdapter`, `timeAdapter` factories). `Axis` is now generic over its scale domain and consumes a `ScaleAdapter` rather than a raw d3 scale.

All prior code is in place with passing tests.

**Before starting, read `CLAUDE.md` at the repo root** and skim the files in `packages/pixi-charts/src/core/` — in particular `ScaleAdapter.ts` and the refactored `Axis.ts`, since this session's `InteractionLayer` will consume `ScaleAdapter`. The conventions established in earlier sessions apply unchanged: strict typing, no `any`, no default exports, D3 submodule imports only, predictable side-effect ordering, tests as documentation, JSDoc on every exported symbol.

## What This Session Delivers

The remaining two core primitives that will let the first chart (LineChart, in Session 4) compose into a complete implementation:

1. **`core/Legend.ts`** — Categorical and continuous color legends rendered in PIXI.
2. **`core/InteractionLayer.ts`** — Pointer event handling and hit-test dispatch.

Like the primitives from Session 2, these are NOT exported from the public `src/index.ts` yet. They remain internal until the first chart consumes them in Session 4.

## Scope Boundaries (What NOT to Do)

- Do NOT build any chart implementations — Session 4 covers LineChart.
- Do NOT modify `core/Chart.ts`, `core/animation.ts`, `core/Axis.ts`, `core/Tooltip.ts`, `core/ColorScheme.ts`, or `core/ScaleAdapter.ts` unless a new primitive genuinely requires it. If you find yourself needing to, stop and propose the change in chat first — this is exactly the kind of thing the earlier API reviews existed to catch in advance.
- Do NOT add visual regression tests yet.
- Do NOT add gesture support (pinch-zoom, multi-touch). Single-pointer events only for v1.
- Do NOT add keyboard accessibility for the legend yet — interactive legends are out of scope for this session. Build the Legend as a static visual element; click-to-toggle will be added when the first chart needs it.

## Specific Implementation Requirements

### `core/Legend.ts` (build first — simpler, sets the pattern)

A legend rendered into a `PIXI.Container`. Supports two modes: categorical (discrete swatches with labels) and continuous (a gradient bar with min/max labels for sequential color scales).

**Export a single class `Legend`:**

```ts
type CategoricalLegendItem = {
  label: string;
  color: number; // PIXI numeric color
};

type CategoricalLegendOptions = {
  type: 'categorical';
  items: CategoricalLegendItem[];
  orientation?: 'horizontal' | 'vertical'; // default 'vertical'
  swatchSize?: number; // default 12
  spacing?: number; // gap between items, default 6
  fontSize?: number; // default 11
  fontFamily?: string; // default 'sans-serif'
  labelColor?: number; // default 0x333333
};

type ContinuousLegendOptions = {
  type: 'continuous';
  scheme: SequentialSchemeName; // from ColorScheme
  domain: [number, number]; // [min, max] for end labels
  length?: number; // gradient bar length in px, default 160
  thickness?: number; // gradient bar thickness, default 10
  orientation?: 'horizontal' | 'vertical'; // default 'horizontal'
  tickFormat?: (value: number) => string; // default uses d3-format
  fontSize?: number;
  fontFamily?: string;
  labelColor?: number;
};

type LegendOptions = CategoricalLegendOptions | ContinuousLegendOptions;

class Legend {
  readonly container: PIXI.Container;
  constructor(opts: LegendOptions);
  update(opts: Partial<LegendOptions>): void;
  destroy(): void;
  get destroyed(): boolean;
  get width(): number; // measured bounds after render
  get height(): number;
}
```

**Behavior:**

- On construction, renders the legend into `this.container`. Consumer adds it to its stage and positions it.
- **Categorical mode:** renders a row (horizontal) or column (vertical) of swatch + label pairs. Each swatch is a small filled rectangle (`PIXI.Graphics`). Labels are `PIXI.Text` positioned next to the swatch with consistent spacing.
- **Continuous mode:** renders a gradient bar using the sequential color scheme, with the min and max domain values labeled at the ends. The gradient is implemented by drawing many thin rectangles (e.g., 64 samples) across the bar's length, each colored by `getSequentialColor(scheme, t)`. This is the simple, correct approach — a shader-based gradient is a future optimization we'll consider only if it shows up in profiling.
- **Width/height getters** return the measured bounding box of the rendered legend, so consumers can position it relative to other chart elements. Use `container.getBounds()` and cache the result; recalculate on `update()`.
- `update()` is a full re-render — clear children, dispose `PIXI.Text` objects via `.destroy()`, rebuild. Mirror the Axis pattern from Session 2.
- `destroy()` empties the container, calls `.destroy()` on each child (especially Text), destroys the container, zeros internal references. Idempotent.

**Implementation notes:**

- The continuous mode's gradient sampling count (64) should be a named constant at the top of the file with a comment explaining the choice. Document the perf-vs-fidelity tradeoff in JSDoc.
- For continuous mode, import `getSequentialColor` from `ColorScheme.ts` and `format` from `d3-format` for default label formatting.
- Vertical continuous gradients should run bottom-to-top with min at bottom (consistent with how y-axes work), unless you have a strong reason to do otherwise — if you do, justify it in the summary.
- The `width` / `height` getters must work even if the consumer hasn't added the container to a parent yet. `PIXI.Container.getBounds()` requires the object to be in a render tree in some PIXI versions; if you hit this, fall back to manually tracking max-extent during render. (Session 2's `Axis` may have hit and solved this already — check how `Axis` handles bounds measurement and reuse that approach for consistency.)

**Tests:**

- Categorical mode renders the expected number of children: N swatches + N labels.
- Categorical orientation 'horizontal' lays out left-to-right (assert relative x positions).
- Categorical orientation 'vertical' lays out top-to-bottom (assert relative y positions).
- Continuous mode renders 64 gradient samples + 2 labels.
- Continuous mode with custom `tickFormat` uses it for min/max labels.
- `width` and `height` getters return reasonable values (positive, non-zero) after construction.
- `update()` from categorical to continuous works correctly (children fully replaced).
- `update()` from continuous to categorical works correctly.
- `destroy()` empties the container.
- `destroy()` is idempotent.
- Re-calling `update()` after `destroy()` throws a descriptive error.
- Unknown sequential scheme name produces a useful error (defense in depth — TypeScript should catch this, but runtime check matters; mirror the defensive-guard pattern `ColorScheme` already established in Session 2).

### `core/InteractionLayer.ts` (build second — the trickier one)

A reusable abstraction over PIXI's pointer event system that lets charts register a hit-test function and receive normalized `hover` / `click` / `leave` events with the relevant datum attached. Each chart constructs one InteractionLayer covering its plot area.

**Export:**

```ts
type Point = { x: number; y: number };

type HoverEvent<D> = {
  type: 'hover';
  datum: D;
  position: Point; // pointer position in plot-area coordinates
  globalPosition: Point; // pointer position in page coordinates (for tooltip)
};

type ClickEvent<D> = {
  type: 'click';
  datum: D;
  position: Point;
  globalPosition: Point;
};

type LeaveEvent = {
  type: 'leave';
};

type InteractionEvent<D> = HoverEvent<D> | ClickEvent<D> | LeaveEvent;

type HitTester<D> = (point: Point) => D | null;

type InteractionLayerOptions<D> = {
  stage: PIXI.Container; // parent to attach the hit-test sprite to
  width: number; // plot area dimensions
  height: number;
  hitTest: HitTester<D>; // returns matching datum or null
  onEvent: (event: InteractionEvent<D>) => void;
};

class InteractionLayer<D> {
  constructor(opts: InteractionLayerOptions<D>);
  resize(width: number, height: number): void;
  setHitTester(hitTest: HitTester<D>): void; // for live data updates
  destroy(): void;
  get destroyed(): boolean;
}
```

**Note on the hit-tester abstraction:** the `InteractionLayer` itself stays scale-agnostic — it deals only in plot-area coordinates and a `HitTester<D>` function. It does NOT import `ScaleAdapter`. The _charts_ that own an `InteractionLayer` are responsible for building a hit-tester, and they will use `ScaleAdapter` to do so. This separation is deliberate: it keeps `InteractionLayer` reusable for charts whose hit-testing isn't scale-based at all (e.g., pie charts use angular geometry, heatmaps use grid-cell math). Keep this boundary clean — do not leak scale concepts into `InteractionLayer`.

However, **the JSDoc for `HitTester` should briefly document the two hit-testing strategies charts will use**, so future contributors building charts know the intended pattern:

- For continuous scales (linear/time/log), a chart's hit-tester typically uses the `ScaleAdapter`'s `invert()` to convert the pointer coordinate back to a domain value, then finds the nearest datum.
- For band scales, where `invert()` is unavailable, a chart's hit-tester iterates the band domain (using the adapter's `scale()` and `bandwidth()`) to find which band the pointer falls in.
  This is documentation only — no code in `InteractionLayer` implements either strategy.

**Behavior:**

- On construction, creates a transparent `PIXI.Sprite` (using `PIXI.Texture.EMPTY` with explicit width/height) covering the plot area, makes it `eventMode = 'static'`, and adds it to the provided stage.
- Listens for `pointermove`, `pointerdown`, and `pointerleave` on the sprite.
- On `pointermove`: converts the global pointer position to plot-area-local coordinates, calls `hitTest(point)`. If it returns a datum AND the datum is different from the last hovered datum, fires a `hover` event. If it returns null AND there was a previously hovered datum, fires a `leave` event. Track the last hovered datum to deduplicate consecutive hovers on the same item.
- On `pointerdown` (button 0 only — ignore right-clicks for v1): same hit-test, fires a `click` event if a datum is hit.
- On `pointerleave`: fires a `leave` event if there was a previously hovered datum.
- `resize()` updates the sprite's `width` and `height`. Necessary because charts resize, and the hit area must follow.
- `setHitTester()` swaps the hit-test function. Necessary when chart data changes mid-render (e.g., for scatter plots where the quadtree must be rebuilt, or any chart whose scales change on resize).
- `destroy()` removes event listeners, removes the sprite from its parent, destroys the sprite, zeros references. Idempotent.

**Implementation notes:**

- **Coordinate normalization:** The `point` passed to `hitTest` must be in plot-area-local coordinates (origin at top-left of the plot area, not the canvas origin). PIXI's `event.global` gives you canvas-global coordinates. The cleanest source is `event.getLocalPosition(this.sprite)` — that's exactly what it's for, and since the sprite IS the plot area, local-to-sprite coordinates are plot-area coordinates.
- **`globalPosition`** in the event should be page coordinates suitable for positioning a DOM tooltip. The cleanest source is `event.client` (or `event.global` mapped through the canvas's bounding rect). Document which is used and why — the LineChart in Session 4 will rely on this to position its `Tooltip`.
- **Don't capture pointer events on `pointerdown`.** This is a common over-correction; charts should not block the page's normal pointer behavior. Single click event only.
- **Throttling:** `pointermove` can fire at very high frequency on some devices. For v1, do NOT add throttling — premature optimization. Note in JSDoc that throttling is a potential future addition if profiling shows hit-testing is a bottleneck.
- **Generic `<D>`:** the type parameter flows from the consumer's hit-tester to the event handler. Make sure the type is preserved end-to-end so consumers get strongly-typed datum access. This is the same end-to-end-generic discipline the `ScaleAdapter<TDomain>` refactor established — apply it here consistently. No `any`, no `unknown` in the type chain.

**Tests (use happy-dom; PIXI's event system works in JSDOM-likes if you dispatch events on the sprite directly):**

- Construction adds the sprite to the provided stage.
- Hit-test returning a datum on `pointermove` fires a `hover` event with the correct datum and coordinates.
- Hit-test returning null on `pointermove` does NOT fire a hover event (when no prior datum was hovered).
- Hover events deduplicate: two consecutive `pointermove` events over the same datum fire ONE hover event.
- Moving from one datum to another fires a `hover` event for the new datum (and implicitly handles the transition).
- `pointerleave` fires a `leave` event if there was a previously hovered datum.
- `pointerleave` does NOT fire a leave event if nothing was hovered.
- `pointerdown` with button 0 fires a `click` event when hit-test returns a datum.
- `pointerdown` with button 2 (right-click) does NOT fire a click event.
- `resize()` updates the sprite dimensions.
- `setHitTester()` swaps the active hit-tester (verify by changing it and dispatching a new event).
- `destroy()` removes the sprite from its parent and removes event listeners.
- `destroy()` is idempotent.
- The generic type is preserved: a hit-tester returning a specific datum type produces events typed with that same type (this is partly a compile-time assertion — include a test that would fail typecheck if the generic were widened to `unknown`).

**Testing PIXI events with happy-dom:** PIXI v8's `EventSystem` uses synthetic events on the renderer's view. Simulating these in tests is annoying. The cleanest approach: rather than dispatching DOM events and hoping PIXI's federated event system fires correctly, you can directly invoke the listener PIXI would have called. Look at how your existing `Chart.test.ts` (Session 1) and `Axis.test.ts` (Sessions 2 / 2.5) mock or stub PIXI. Follow that same pattern for consistency.

If you find PIXI event simulation impossible to test cleanly in this environment, fall back to extracting the event-handling logic into a small pure-function helper (e.g., `handlePointerMove(state, point, hitTest, onEvent)`) and unit-testing that directly, while wiring it to PIXI events in the class itself. This is a legitimate testability refactor — and it mirrors the kind of pure-function extraction that makes `lttb` (Session 4) and the scale adapters easy to test. If you go this route, flag it in the summary.

## Working Style (Reminder)

- Ask clarifying questions before starting if anything is ambiguous.
- Show me the planned file changes before implementing.
- Explain key design choices in chat for non-trivial files.
- Run the full test suite yourself and paste the output before declaring done.
- If a test reveals an API problem, fix the API — don't loosen the test.
- If you exceed ~200 lines of implementation without corresponding tests, stop and write tests first.

## What to Deliver

1. The two new files: `core/Legend.ts`, `core/InteractionLayer.ts`.
2. Their corresponding test files under `tests/core/`.
3. Any new dependencies in `packages/pixi-charts/package.json` — likely none, since `d3-format` and `d3-scale-chromatic` were added in earlier sessions.
4. JSDoc comments on every exported symbol explaining purpose, parameters, return values, and any non-obvious behavior. For `InteractionLayer`, include the documentation of the two hit-testing strategies in the `HitTester` JSDoc as described above.
5. A changeset entry (`.changeset/`) describing what was added — `minor` bump for additive internal modules.
6. All tests passing — run the full suite and paste the output.
7. A short summary at the end covering: what was built, any decisions you made that warrant my review, any APIs you found awkward (now is the last chance to fix them before LineChart hardens these APIs through use in Session 4), any testing strategies you had to adopt due to PIXI event-system testability, and anything you deferred to a follow-up session.

Begin by asking any clarifying questions, then propose your implementation order and start.
