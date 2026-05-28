---
editUrl: false
next: false
prev: false
title: 'Chart'
---

Defined in: [packages/pixi-charts/src/core/Chart.ts:50](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/core/Chart.ts#L50)

Abstract base class for every chart in `pixi-charts`.

Responsibilities of this class — and ONLY these:

1. Hold the lifecycle: `new Chart() → await chart.init() → ... → chart.destroy()`.
   The constructor is intentionally side-effect-free. Nothing renders, no
   PIXI application is created, until [init](/api/classes/chart/#init) is called.
2. Own and manage a single PIXI Application.
3. Observe the container for size changes and forward them to the renderer.
4. Track tween cancel functions registered via addTween so they
   can all be cancelled when the chart is destroyed.
5. Clean up everything in [destroy](/api/classes/chart/#destroy), idempotently, without
   requiring the user to know which steps initialised.

Subclasses implement the abstract [render](/api/functions/render/) method. Anything
chart-type-specific — axes, legend, tooltip, data marshalling — composes
out of small modules rather than extending this class further.

`Chart` is abstract — instantiate a concrete subclass (e.g.
import('../charts/LineChart.js').LineChart) or, in most cases,
use the declarative import('../spec/render.js').render entry
point which returns a `Chart` already constructed and initialised.

## Example

```ts
import { LineChart } from 'pixi-charts';

const chart = new LineChart({ container, spec });
await chart.init(); // creates the PIXI app and does the first render

// ...later
chart.destroy(); // idempotent — safe to call more than once
```

## Extended by

- [`LineChart`](/api/classes/linechart/)
- [`AreaChart`](/api/classes/areachart/)
- [`BarChart`](/api/classes/barchart/)
- [`ScatterChart`](/api/classes/scatterchart/)
- [`HeatmapChart`](/api/classes/heatmapchart/)
- [`PieChart`](/api/classes/piechart/)

## Constructors

### Constructor

> **new Chart**(`opts`): `Chart`

Defined in: [packages/pixi-charts/src/core/Chart.ts:63](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/core/Chart.ts#L63)

#### Parameters

##### opts

`ChartOptions`

#### Returns

`Chart`

## Accessors

### destroyed

#### Get Signature

> **get** **destroyed**(): `boolean`

Defined in: [packages/pixi-charts/src/core/Chart.ts:70](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/core/Chart.ts#L70)

`true` once [destroy](/api/classes/chart/#destroy) has run.

##### Returns

`boolean`

---

### initialized

#### Get Signature

> **get** **initialized**(): `boolean`

Defined in: [packages/pixi-charts/src/core/Chart.ts:75](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/core/Chart.ts#L75)

`true` once [init](/api/classes/chart/#init) has completed.

##### Returns

`boolean`

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [packages/pixi-charts/src/core/Chart.ts:157](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/core/Chart.ts#L157)

Releases every resource owned by this chart:

- Cancels all tracked tweens.
- Disconnects the ResizeObserver.
- Destroys the PIXI Application (and removes its canvas from the DOM).
- Nulls internal references so the GC can collect them.

Idempotent — calling more than once is safe and does no extra work.

#### Returns

`void`

---

### init()

> **init**(): `Promise`\<`void`\>

Defined in: [packages/pixi-charts/src/core/Chart.ts:89](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/core/Chart.ts#L89)

Creates the PIXI Application, attaches its canvas to the container, and
starts observing the container for size changes.

PIXI v8 requires `await app.init(...)` — this is why initialisation is
separate from construction. After this resolves, [render](/api/functions/render/) may be
called by the subclass (or by the user).

Calling `init()` more than once is a no-op.

#### Returns

`Promise`\<`void`\>
