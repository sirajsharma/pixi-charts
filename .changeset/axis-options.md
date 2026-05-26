---
'pixi-charts': minor
---

Add `showAxes`, `showGrid`, and `axisTitles` options to `ChartOptions`. Charts can now opt out of axis rendering entirely (sparkline embeds, hero charts), toggle gridlines independently, and label axes with semantic titles. `showAxes: false` combined with `showGrid: true` puts the axis into a grid-only mode that draws gridlines without the axis line, tick marks, tick labels, or title. All three options default to behavior that preserves existing rendering — no breaking changes. Inert for pie charts.
