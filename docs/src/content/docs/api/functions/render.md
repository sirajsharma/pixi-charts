---
editUrl: false
next: false
prev: false
title: 'render'
---

> **render**(`spec`, `container`): `Promise`\<[`Chart`](/api/classes/chart/)\>

Defined in: [packages/pixi-charts/src/spec/render.ts:58](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/render.ts#L58)

Render a declarative chart spec into a DOM container.

This is the primary entry point of `pixi-charts`. The spec is validated
up-front (throws import('./validate.js').ChartSpecValidationError
with teaching messages on bad input), then dispatched on `spec.type` to
the concrete chart implementation. The returned [Chart](/api/classes/chart/) has been
constructed AND fully initialized (PIXI Application up, first render
complete) — consumers receive a working chart, not a half-built one.

The container's existing children are NOT cleared — the consumer is
responsible for managing the parent element. The PIXI canvas is
appended as a new child.

**Why this returns a Promise.** PIXI v8 requires `await app.init(...)`;
a synchronous return would force the dispatcher to either skip init
(handing back a half-rendered chart) or to block on it (impossible in
a browser). Awaiting is the honest signature.

**Why this returns `Chart` not `LineChart`.** Future dispatch targets
will return their own subclasses; the union is `Chart`. Consumers who
need a specific subclass can use the imperative API (`new LineChart`
etc.) re-exported from the package root.

## Parameters

### spec

[`ChartSpec`](/api/interfaces/chartspec/)

### container

`HTMLElement`

## Returns

`Promise`\<[`Chart`](/api/classes/chart/)\>

## Example

```ts
import { render } from 'pixi-charts';

const chart = await render(
  {
    type: 'line',
    data: rows,
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'revenue', type: 'quantitative' },
    },
  },
  document.getElementById('chart')!,
);

// Later, when tearing down:
chart.destroy();
```

## Throws

If `spec` fails validation.
