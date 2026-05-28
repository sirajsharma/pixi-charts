---
editUrl: false
next: false
prev: false
title: 'ChartEncoding'
---

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:88](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L88)

Channel-to-field mapping for a chart.

Each chart type uses a different subset:

- Line / area / bar: `x` + `y` (+ optional `color` for series split).
- Scatter: `x` + `y` (+ optional `color`, `size`).
- Pie: `value` (+ optional `color`).
- Heatmap: `x` + `y` + `value` (+ optional `color`).

Only the encodings relevant to a given chart are required — see
import('./validate.js').validateChartSpec for the per-type rules.

## Properties

### color?

> `optional` **color?**: [`ColorEncoding`](/api/interfaces/colorencoding/)

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:94](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L94)

Color channel (categorical series split).

---

### size?

> `optional` **size?**: `object`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:99](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L99)

Size channel — scatter only. The field's values drive a square-root
radius scale (area ∝ value). Ignored by line/area/bar.

#### field

> **field**: `string`

---

### value?

> `optional` **value?**: `object`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:106](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L106)

Value channel — used by `pie` (the numeric value each slice represents,
proportionally summed to the full circle) and reserved for `heatmap`'s
cell value. The field is interpreted as quantitative; missing or
non-finite values are skipped with a console warning.

#### field

> **field**: `string`

---

### x?

> `optional` **x?**: [`EncodingField`](/api/interfaces/encodingfield/)

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:90](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L90)

Positional x-axis encoding.

---

### y?

> `optional` **y?**: [`EncodingField`](/api/interfaces/encodingfield/)

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:92](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L92)

Positional y-axis encoding.
