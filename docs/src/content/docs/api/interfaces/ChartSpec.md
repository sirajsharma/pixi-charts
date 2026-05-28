---
editUrl: false
next: false
prev: false
title: 'ChartSpec'
---

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:251](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L251)

The declarative spec consumed by import('./render.js').render.

Roughly inspired by Vega-Lite's grammar — `type` + `data` + `encoding`

- `options` — without committing to its full algebra. Future chart
  types add their own per-type rules in import('./validate.js').validateChartSpec,
  not new top-level fields.

## Example

```ts
const spec: ChartSpec = {
  type: 'line',
  data: rows,
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'revenue', type: 'quantitative' },
  },
};
```

## Properties

### animation?

> `optional` **animation?**: [`AnimationOptions`](/api/interfaces/animationoptions/)

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:265](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L265)

Animation configuration. See [AnimationOptions](/api/interfaces/animationoptions/).

---

### data

> **data**: readonly `Record`\<`string`, `unknown`\>[]

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:259](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L259)

The rows to plot. Declared `ReadonlyArray<Record<string, unknown>>` to
signal the library does not mutate consumer data and to force
type-narrowing at use sites rather than implicit `any` access.

---

### encoding

> **encoding**: [`ChartEncoding`](/api/interfaces/chartencoding/)

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:261](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L261)

Channel-to-field mapping. See [ChartEncoding](/api/interfaces/chartencoding/).

---

### options?

> `optional` **options?**: [`ChartOptions`](/api/interfaces/chartoptions/)

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:263](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L263)

General presentation options. See [ChartOptions](/api/interfaces/chartoptions/).

---

### type

> **type**: [`ChartType`](/api/type-aliases/charttype/)

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:253](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L253)

Which chart type to render.
