---
editUrl: false
next: false
prev: false
title: 'FieldType'
---

> **FieldType** = `"quantitative"` \| `"categorical"` \| `"temporal"`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:14](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L14)

How a data field should be interpreted by the chart.

- `'quantitative'` — numeric values (counts, measurements, currency).
  Mapped with a linear scale.
- `'categorical'` — discrete strings (categories, group names). Mapped
  with a band scale on positional channels; with a categorical palette
  on the color channel.
- `'temporal'` — date/time values. Parsed to `Date` and mapped with a
  time scale.
