---
"pixi-charts": minor
---

Add `PieChart` — categorical proportions of a whole, supporting both **pie** (`innerRadius: 0`, the default) and **donut** (`innerRadius > 0`) variants from a single class. This completes the v0.1 chart roster: `render({ type, ... })` now dispatches every planned chart type (line, area, bar, scatter, heatmap, pie).

**New public API**

- `PieChart` exported from the imperative API.
- `render({ type: 'pie', ... }, container)` dispatches to `PieChart`. The dispatcher now uses a TypeScript exhaustiveness assertion (a `never` check) so adding a future `ChartType` becomes a compile-time error rather than a silent runtime gap. The "not implemented yet" branch is removed.
- `ChartOptions.innerRadius` and `ChartOptions.startAngle` are new pie-only options on the shared `ChartOptions` shape — same scoping pattern as `orientation` (lives at the top level, validator ignores them on non-pie specs). `innerRadius` is clamped to `[0, outerRadius − 1]` at render time; `startAngle` defaults to `-Math.PI / 2` (12 o'clock).
- `encoding.value` now has its first consumer: the numeric field whose magnitudes are summed and divided proportionally into slice angles.

**Behaviour**

- `encoding.x` (categorical) names each slice and `encoding.value` carries its magnitude. Both are required; the validator throws teaching errors when missing or mistyped. `encoding.color` is optional — when omitted slices take distinct colors from `category10`; when present, the color field's distinct values drive a categorical palette assignment (so coloring by the category field yields one color per slice, the natural case). Quantitative color is rejected at validation — pies use categorical color.
- Zero or missing value rows are warned at validation (not rejected). Negative or zero values are dropped at render time so they don't pollute the slice list with invisible records. A total of zero after dropping logs a warning and short-circuits to an empty plot rather than crashing on a NaN angle.
- **Parallel sweep enter animation** — all slices grow simultaneously from `startAngle`, finishing together. Honors `spec.animation.enter: false` and `prefers-reduced-motion: reduce` via the shared `tween()`.
- Categorical `Legend` (vertical, top-right of plot area) shows when there are 2+ slices; a single-slice (full-disc) pie suppresses it. `showLegend: false` also suppresses.
- Tooltip carries category, raw value (`d3-format ',.2~f'`), and percent-of-total (`d3-format '.1%'`).
- **Polar hit-testing** in `utils/geometry.ts` — pointer offset from center is converted via `pointToAngle(dx, dy)` (atan2 normalized to `[0, 2π)`, screen-coordinate convention documented in JSDoc and pinned by 4 cardinal-direction unit tests). `pointInRing` rejects points outside the ring (including donut-hole rejection), and `angleInRange` correctly handles the wraparound case where a slice crosses the `2π → 0` boundary. Pure functions, fully unit-tested without a PIXI app, mirroring the `lttb` / `quadtree` discipline.

**Rendering**

- Slices drawn into a single `PIXI.Graphics` using v8's Canvas-style `.arc(cx, cy, r, start, end, ccw?)` (verified against `pixi.js@8.18.1` source). The pie path is `moveTo center → arc → closePath`; the donut path is `moveTo inner-start → lineTo outer-start → arc outer (forward) → lineTo inner-end → arc inner (counter-clockwise) → closePath`. One Graphics instance for all slices; batched fills.
- Centered in the plot area with `outerRadius = min(plotW, plotH) / 2 − 8`. Pie-specific 16px uniform default margins (no axis-margin allocations).

**Integration / pressure-test findings**

This was the architectural pressure-test session — pie is the first chart with no axes, no d3 scales, no rectangular hit regions. **Zero primitive bugs were surfaced**, and the audit found no hidden coordinate-compensation in `PieChart.ts` either. The abstractions held:

- `InteractionLayer`'s scale-agnostic, plot-area-local coordinate contract (its JSDoc already named pies as a use case) integrated verbatim — the rectangular hit-test sprite still works because the polar hit-tester rejects out-of-ring points.
- `Chart` base class has no shape assumptions — subclasses own all layout math, so `PieChart`'s no-axes layout slotted in without changes.
- `Legend` is position-agnostic; placing it in an axis-free top-right corner needed no Legend changes.
- `Tooltip` is point-based and reused as-is.

The only test-infrastructure addition was extending `MockGraphics` with `arc()` and `arcCalls` so slice geometry can be asserted in unit tests — mirroring how prior chart sessions added `rectCalls` and similar.

**Scope**

No slice labels (inside or outside slices). No exploded slices. No leader lines. No multi-ring donuts or sunburst charts. No click handlers beyond what `InteractionLayer` natively emits (v1 ignores click). The cartesian shared module is **unchanged**; PieChart inlines its tiny utility functions rather than coupling to cartesian abstractions. Line/Area/Bar/Scatter/Heatmap behaviour and tests are unaffected — all 354 prior tests continue passing alongside the new 60 pie / geometry / validate tests, total **383 passing**.

**Bundle size**: 30.0 KB gzipped (`gzip -c dist/index.js | wc -c` → 30,643 bytes), up from 26.1 KB at the end of Session 8 (+3.9 KB for PieChart + geometry helpers + pie validation). Still under the package's <50 KB target.
