---
editUrl: false
next: false
prev: false
title: 'validateChartSpec'
---

> **validateChartSpec**(`input`): [`ChartSpec`](/api/interfaces/chartspec/)

Defined in: [packages/pixi-charts/src/spec/validate.ts:603](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/validate.ts#L603)

Parse and validate a [ChartSpec](/api/interfaces/chartspec/) candidate.

On success, returns the input cast as a typed `ChartSpec`. On failure,
throws a [ChartSpecValidationError](/api/classes/chartspecvalidationerror/) whose message lists every issue
with its path, the received value, the expected shape, and (where useful)
a minimal example.

Beyond shape validation this also enforces a few semantic rules:

- `data` must be non-empty (a zero-row chart is almost always a bug).
- Every `field` referenced by `encoding` must exist in the first data
  row's keys. Catches typos like `'revenu'` for `'revenue'`.
- For `type: 'line'` and `type: 'area'`, both `encoding.x` and
  `encoding.y` are required.
- For `type: 'bar'`, the category/value axis roles depend on
  `options.orientation`.
- For `type: 'scatter'`, `encoding.x`/`encoding.y` are required and must
  be quantitative or temporal; quantitative-color and size fields are
  sanity-checked with warnings.
- For `type: 'heatmap'`, both axes must be categorical and
  `encoding.color` and `encoding.value` are required.
- For `type: 'pie'`, `encoding.x` (categorical, the slice category) and
  `encoding.value` are required; `encoding.color` may not be quantitative.

`options.orientation` is validated for its _shape_ (one of `'vertical'` /
`'horizontal'`) for every spec, but its _meaning_ is read only for
`type: 'bar'`. Line, area, and other types that set it are neither warned
nor errored — the field is deliberately on the shared `ChartOptions`.

Unknown top-level keys do NOT fail validation — a `console.warn` is
emitted instead. This protects consumers writing forward-compat code
(e.g. setting a future `theme:` field) without locking the spec.

## Parameters

### input

`unknown`

A candidate spec to validate. Typically `unknown` from a
`JSON.parse`, an external API, or untyped configuration.

## Returns

[`ChartSpec`](/api/interfaces/chartspec/)

The same input value, typed as a [ChartSpec](/api/interfaces/chartspec/).

## Throws

When the candidate fails shape or
semantic validation. The error's `message` lists every issue in a
teaching format.

## Example

```ts
import { validateChartSpec, ChartSpecValidationError, render } from 'pixi-charts';

try {
  const spec = validateChartSpec(JSON.parse(userInput));
  await render(spec, container);
} catch (err) {
  if (err instanceof ChartSpecValidationError) {
    console.error(err.message);
  } else {
    throw err;
  }
}
```
