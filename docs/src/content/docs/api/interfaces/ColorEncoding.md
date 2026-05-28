---
editUrl: false
next: false
prev: false
title: 'ColorEncoding'
---

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:50](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L50)

Color channel encoding.

For line / area / bar this is always categorical: the field's distinct
values produce one series (or one per-bar color) each — `type` is ignored
by those charts. `ScatterChart` (Session 7) is the first chart to support
a **quantitative** color field, mapped through a continuous sequential
scale instead of a discrete palette.

## Properties

### field

> **field**: `string`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:52](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L52)

Name of the column to colour by.

---

### scheme?

> `optional` **scheme?**: `string`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:73](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L73)

Colour scheme name. For categorical fields, one of the categorical
scheme names (import('../core/ColorScheme.js').categoricalSchemes);
for quantitative fields, one of the sequential scheme names
(import('../core/ColorScheme.js').sequentialSchemes). When
omitted the chart picks a sensible per-type default (`category10` for
categorical, `viridis` for quantitative).

---

### type?

> `optional` **type?**: `"categorical"` \| `"quantitative"`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:64](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L64)

How the colour field is interpreted:

- `'categorical'` — each distinct value gets a discrete colour from a
  categorical palette.
- `'quantitative'` — values are mapped through a continuous sequential
  colour scale (e.g. viridis), paired with a continuous legend.
- omitted — treated as categorical. (Line/area/bar are categorical-only
  and ignore this field; scatter must set `'quantitative'` explicitly to
  opt into continuous colour.)
