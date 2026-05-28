---
editUrl: false
next: false
prev: false
title: 'EncodingField'
---

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:34](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L34)

A reference to a column in `data` plus its interpretation.

## Example

```ts
{ field: 'revenue', type: 'quantitative' }
```

## Properties

### field

> **field**: `string`

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:36](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L36)

Name of the column in each `data` row to read from.

---

### type

> **type**: [`FieldType`](/api/type-aliases/fieldtype/)

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:38](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L38)

How to interpret the column. See [FieldType](/api/type-aliases/fieldtype/).
