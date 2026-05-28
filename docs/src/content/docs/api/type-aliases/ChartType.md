---
editUrl: false
next: false
prev: false
title: 'ChartType'
---

> **ChartType** = `"line"` \| `"area"` \| `"bar"` \| `"scatter"` \| `"heatmap"` \| `"pie"`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:24](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L24)

The kinds of chart supported by the spec dispatcher.

All listed types are implemented and dispatched by
import('./render.js').render. The union is closed: adding a new
chart type is a coordinated change across this file, the validator,
the dispatcher, and a chart implementation.
