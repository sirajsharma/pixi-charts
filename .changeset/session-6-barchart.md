---
"pixi-charts": minor
---

Add `BarChart` — single-series bar charts in both vertical (default) and horizontal orientation, selected via the new `options.orientation` field. A vertical and a horizontal bar chart are the same chart with the axes swapped, so this is one class with an orientation branch, not two chart types; the `ChartType` union stays `'bar'`.

**New public API**

- `BarChart` exported from the imperative API.
- `render({ type: 'bar', ... }, container)` now dispatches to `BarChart`.
- `ChartOptions.orientation?: 'vertical' | 'horizontal'` — currently meaningful only for `type: 'bar'` (band scale on x for vertical, on y for horizontal); ignored by line/area and every other type (no warn, no error).

**Behavior**

- Per-bar color: with no `encoding.color`, all bars take the default scheme's first color; with a categorical color encoding, each bar is colored by its color-field value (coloring by the category field yields one color per bar). Above 20 distinct color values a `console.warn` fires.
- Bars grow from `valueScale(0)` — zero projected through the value scale — so negative values render on the opposite side of the baseline and a value domain that doesn't include zero still projects correctly.
- Discrete-rectangle hit-testing (band containment + value-extent containment), tooltip (`category • value`), legend (only when a categorical color encoding distinguishes ≥2 values), enter animation (bars grow from the baseline), resize, and idempotent destroy.

**Scope**

Single series only. Grouped and stacked (multi-series) bars are intentionally out of scope. The cartesian line-family shared module is unchanged except for one additive helper (`formatCategoryValueTooltip`); `LineChart` / `AreaChart` behavior is unaffected.
