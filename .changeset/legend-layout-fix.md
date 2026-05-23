---
'pixi-charts': patch
---

Fix continuous legend formatting and move legends outside the plot area.

**Continuous legend formatting.** The default `d3-format` specifier for the min/max labels on a continuous legend was `.3~s`, which applies SI prefixes — a ScatterChart value of `0.870` rendered as `"870m"` (milli), and similar surprises across normal numeric ranges. Default is now `~g` (general number with trimmed trailing zeros), which produces plain readable labels across the common ranges. Consumer overrides via `ContinuousLegendOptions.tickFormat` are unchanged.

**Legend placement.** Every chart with a legend (Line, Area, Bar, Scatter, Heatmap, Pie) was positioning it inside the plot area's top-right corner, where it overlapped the rendered marks. Legends now sit to the right of the plot, in their own column — the plot's width is reduced by `legend.width + 12px` to make room. A new pure helper `core/layout.ts` (internal) centralises the math.

No public API changes; the spec, exports, and `showLegend` semantics are unchanged. The rendered output is visibly better in the all-charts harness.
