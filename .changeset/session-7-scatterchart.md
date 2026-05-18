---
"pixi-charts": minor
---

Add `ScatterChart` — the library's performance flagship, rendering **100k+ points at 60fps** via a single PixiJS v8 `ParticleContainer` (one batched draw call) with `d3-quadtree`-backed spatial indexing for sub-frame hover hit-testing.

**New public API**

- `ScatterChart` exported from the imperative API.
- `render({ type: 'scatter', ... }, container)` now dispatches to `ScatterChart`.
- `ColorEncoding.type?: 'categorical' | 'quantitative'` — the colour channel can now be **continuous**. Quantitative colour maps through a sequential interpolator (default **viridis**, perceptually uniform / colourblind-safe) and pairs with a continuous gradient legend. Line/area/bar remain categorical-only and ignore `type`.
- `encoding.size` is now consumed (scatter only): values drive a **square-root** radius scale (`[3, 12]` px) so that *area* ∝ value — not radius ∝ value, which would overstate large values quadratically.

**Behaviour**

- Both positional axes are continuous (quantitative or temporal); categorical x/y is rejected at validation with a teaching error (use a bar chart instead). Quantitative-colour and size fields are sanity-checked with warnings (non-numeric colour values, negative sizes) rather than hard failures.
- One white circle texture, tinted per-particle (PIXI v8 supports per-particle `tint` over a shared texture in a single batch — the v7 "pre-bake one texture per colour" workaround is unnecessary). Exactly one GPU texture per instance, explicitly freed on destroy and before each rebuild (the base class's `app.destroy({ texture: false })` does not free it).
- Hover tooltip (`x • y • colour • size`), continuous *or* categorical legend, alpha fade-in enter animation (one value/frame — free at 1M points; honours `animation.enter` and reduced-motion), resize re-projection + spatial-index rebuild, idempotent destroy.

**New internals**

- `utils/quadtree.ts` — `SpatialIndex<D>` / `SpatialRecord<D>`, a thin `d3-quadtree` wrapper for `O(log n)` nearest-point queries, reusable by future spatially-indexed charts.

**Bug fix (all charts)**

Fixed a crash when the container resizes while the enter animation is still running: `render()` now cancels the previous pass's in-flight tween (`this.cancelAllTweens()`) before tearing down its render targets. Previously the tween's next tick drew into a just-destroyed `Graphics` (line/area/bar) or a freed particle buffer (scatter) and PixiJS threw. This reproduced on a normal page load because the browser's `ResizeObserver` fires an initial callback immediately after `observe()`, overlapping the enter animation. A new regression test (`tests/charts/resize-tween-safety.test.ts`) covers all four charts; the gap existed because the test-suite's mock `ResizeObserver` never auto-fires. ScatterChart additionally now keeps a single `ParticleContainer` + texture for its lifetime and updates particle transforms in place on resize (per the prompt's resize guidance), rather than destroying/recreating them.

**Scope**

Static view only: no zoom/pan/brush, no multi-series shapes, circles only, no jitter, no size legend (a deliberate future addition). The cartesian line-family shared module is **unchanged** — scatter's ungrouped, two-continuous-axis setup is built inline (an integration finding: `buildCartesianSetup` is series-shaped and was deliberately not coerced). Line/Area/Bar behaviour and tests are unaffected.
