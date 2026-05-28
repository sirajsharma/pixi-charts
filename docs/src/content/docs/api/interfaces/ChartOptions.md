---
editUrl: false
next: false
prev: false
title: 'ChartOptions'
---

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:139](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L139)

General chart options. All fields are optional; sensible defaults are
applied at the chart level.

## Properties

### axisTitles?

> `optional` **axisTitles?**: `object`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:225](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L225)

Axis titles. Optional semantic labels rendered alongside each axis to
describe what the axis represents (e.g. `Revenue (USD)`, `Months`). On
the x-axis the title sits below the tick labels, centered. On the
y-axis it sits to the left of the tick labels, rotated -90° so the
text reads bottom-to-top.

Setting a title adds a fixed inset to the relevant margin so the title
has space to render without clipping the plot area.

Ignored for chart types without axes (`pie`). Validation does not warn
or error when it is set on pie specs.

#### x?

> `optional` **x?**: `string`

#### y?

> `optional` **y?**: `string`

---

### height?

> `optional` **height?**: `number`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:152](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L152)

Explicit canvas height in CSS pixels. Falls back to container size, then `400`.

---

### innerRadius?

> `optional` **innerRadius?**: `number`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:178](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L178)

Inner radius for pie charts, in CSS pixels. `0` (the default) renders a
true pie; any positive value renders a donut. The value is clamped at
render time to `[0, outerRadius - 1]` so a too-large inner radius
degrades gracefully to "almost the full disk" rather than crashing.

Like [orientation](/api/interfaces/chartoptions/#orientation), this lives on the general `ChartOptions` for
shape simplicity. Non-pie chart types ignore it — the validator
neither warns nor errors when it is set on them.

---

### margin?

> `optional` **margin?**: `object`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:154](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L154)

Plot-area inset in CSS pixels. Any subset is allowed; missing edges use chart defaults.

#### bottom?

> `optional` **bottom?**: `number`

#### left?

> `optional` **left?**: `number`

#### right?

> `optional` **right?**: `number`

#### top?

> `optional` **top?**: `number`

---

### orientation?

> `optional` **orientation?**: `"horizontal"` \| `"vertical"`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:167](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L167)

Orientation of the chart. **Currently only meaningful for
`type: 'bar'`**, where it controls whether bars run vertically (band
scale on the x-axis, the default) or horizontally (band scale on the
y-axis). Defaults to `'vertical'` when omitted.

It lives on `ChartOptions` rather than a bar-specific options object so
that programmatic specs keep a single options shape and a future chart
type that wants orientation can adopt it without a schema change. Line,
area, and every other current chart type **ignore** this field entirely
— the validator neither warns nor errors when it is set on them.

---

### showAxes?

> `optional` **showAxes?**: `boolean`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:202](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L202)

Whether to render axis chrome (axis line, tick marks, tick labels, and
axis title). Default: `true`. Set to `false` for sparkline embeds, hero
charts, and other decorative chart instances that should render without
axis lines or tick labels.

Gridlines are controlled separately by [showGrid](/api/interfaces/chartoptions/#showgrid): with
`showAxes: false` and `showGrid: true`, only gridlines render.

Ignored for chart types that have no cartesian axes (`pie`). Validation
does not warn or error when it is set on pie specs.

---

### showGrid?

> `optional` **showGrid?**: `boolean`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:211](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L211)

Whether to render gridlines through the plot area. Default: `true`.
Independent of [showAxes](/api/interfaces/chartoptions/#showaxes) — you can show axes without gridlines
for a cleaner look, or gridlines without axes for a minimalist embed.

Ignored for chart types without gridlines (`heatmap` already renders
none; `pie` has no gridlines at all).

---

### showLegend?

> `optional` **showLegend?**: `boolean`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:146](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L146)

Show the legend when the chart has one. Default `true`. Charts with a
single series ignore this and skip the legend regardless.

---

### showTooltip?

> `optional` **showTooltip?**: `boolean`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:148](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L148)

Show hover tooltips. Default `true`.

---

### startAngle?

> `optional` **startAngle?**: `number`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:189](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L189)

Starting angle of the pie sweep, in **radians**, using the same
screen-coordinate convention as
import('../utils/geometry.js').pointToAngle: `0` is 3 o'clock
and angles increase clockwise. The default is `-Math.PI / 2`
(12 o'clock — the most common pie-chart layout).

Ignored by non-pie chart types; the validator does not warn or error
when it is set on them.

---

### title?

> `optional` **title?**: `string`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:141](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L141)

Title text. Not yet rendered. Reserved for v2.

---

### width?

> `optional` **width?**: `number`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:150](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L150)

Explicit canvas width in CSS pixels. Falls back to container size, then `600`.
