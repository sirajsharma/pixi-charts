---
'pixi-charts': patch
---

Improve JSDoc on the public API surface so the generated reference renders
with examples and complete parameter info. Adds `@example` blocks to the
six chart classes (`LineChart`, `AreaChart`, `BarChart`, `ScatterChart`,
`HeatmapChart`, `PieChart`) and the `Chart` base class, and adds
`@param` / `@returns` / `@throws` / `@example` to `validateChartSpec`
(whose existing documentation block was orphaned from the function
declaration — now properly attached). No public API changes.
