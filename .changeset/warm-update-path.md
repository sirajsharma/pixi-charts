---
'pixi-charts': minor
---

Add `chart.update(newData, options?)` to update a chart's data without recreating the WebGL context. Reuses the existing PixiJS application, scales infrastructure, axes, legend, and interaction layer; recomputes scales, geometry, axes, and hit-testing from the new data. Enables interactive and streaming use cases that previously required a full re-render. Updates snap instantly by default; pass `{ animate: true }` for tweened transitions where supported (bar and pie when the category set is unchanged — other charts always snap). Changing chart type, encoding, or orientation still requires a fresh `render()`.
