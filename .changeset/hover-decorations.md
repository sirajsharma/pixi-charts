---
'pixi-charts': minor
---

Add hover decorations to all six chart types. The data element under the cursor now receives a chart-appropriate highlight: line/area charts show a marker at the active point, bars lighten, scatter points enlarge, heatmap cells and pie slices show a white border. Decorations animate in over 120ms and respect `prefers-reduced-motion`. No public API changes.
