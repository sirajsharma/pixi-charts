---
'pixi-charts': minor
---

Add `theme: 'light' | 'dark'` and per-color overrides (`colors.axis`, `colors.label`, `colors.grid`, `colors.legendText`) to `ChartOptions` for dark-mode support. Band-axis margins now size to fit category labels (capped, with ellipsis truncation for very long labels), fixing clipping on horizontal bar charts and either-axis clipping on heatmaps. Tooltips now flip and clamp to stay fully within the chart container near edges, including when the tooltip is larger than the container. Defaults preserve existing light-theme rendering.
