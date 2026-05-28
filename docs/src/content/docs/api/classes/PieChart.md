---
editUrl: false
next: false
prev: false
title: 'PieChart'
---

Defined in: [packages/pixi-charts/src/charts/PieChart.ts:167](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/PieChart.ts#L167)

Pie / donut chart — categorical proportions of a whole.

**One class, two variants.** `options.innerRadius` (default `0`) controls
the shape: zero renders a true pie; any positive value renders a donut.
The geometry, hit-test, animation, legend, and tooltip are otherwise
identical — same single-class-for-related-variants pattern
import('./BarChart.js').BarChart uses for orientation.

**Encoding contract.** `encoding.x` (categorical) names the slice label;
`encoding.value` carries the numeric magnitude divided proportionally
into angular slices. `encoding.color` is optional — when omitted, slices
take distinct colors from `category10`; when present, the color field's
distinct values drive the palette assignment.

**Geometry.** Centered in the plot area with `outerRadius =
min(plotW, plotH) / 2 - 8`; `innerRadius` is clamped to
`[0, outerRadius - 1]`. The sweep starts at `options.startAngle`
(default `-π/2`, i.e. 12 o'clock) and proceeds clockwise on screen.

**Animation.** A parallel sweep — all slices grow together, finishing at
the same instant — driven by tween. `spec.animation.enter:
false` skips it; `prefers-reduced-motion` is honored by `tween()`.

**Hit-testing.** Polar — pointer offset from center is converted to
`(r, θ)` and matched against each slice's ring + angular range. Pure
function in buildPieHitTester, unit-tested without a PIXI app.

**Lifecycle / resize** mirror BarChart: construction is pure, the first
render runs at the tail of [init](/api/classes/piechart/#init), resize redraws at the final
state (the enter animation does not re-run), [destroy](/api/classes/piechart/#destroy) is
idempotent.

For most use cases, prefer the declarative [render](/api/functions/render/) entry point —
use this class directly only when you need fine-grained lifecycle control.

## Example

```ts
import { PieChart } from 'pixi-charts';

const chart = new PieChart({
  container: document.getElementById('chart')!,
  spec: {
    type: 'pie',
    data: [
      { browser: 'Chrome', share: 64 },
      { browser: 'Safari', share: 19 },
      { browser: 'Firefox', share: 8 },
      { browser: 'Other', share: 9 },
    ],
    encoding: {
      x: { field: 'browser', type: 'categorical' },
      value: { field: 'share', type: 'quantitative' },
    },
    options: { innerRadius: 60 }, // donut; omit or 0 for a true pie
  },
});
await chart.init();
chart.destroy();
```

## Extends

- [`Chart`](/api/classes/chart/)

## Constructors

### Constructor

> **new PieChart**(`opts`): `PieChart`

Defined in: [packages/pixi-charts/src/charts/PieChart.ts:199](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/PieChart.ts#L199)

#### Parameters

##### opts

`PieChartOptions`

#### Returns

`PieChart`

#### Overrides

[`Chart`](/api/classes/chart/).[`constructor`](/api/classes/chart/#constructor)

## Accessors

### destroyed

#### Get Signature

> **get** **destroyed**(): `boolean`

Defined in: [packages/pixi-charts/src/core/Chart.ts:70](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/core/Chart.ts#L70)

`true` once [destroy](/api/classes/chart/#destroy) has run.

##### Returns

`boolean`

#### Inherited from

[`Chart`](/api/classes/chart/).[`destroyed`](/api/classes/chart/#destroyed)

---

### initialized

#### Get Signature

> **get** **initialized**(): `boolean`

Defined in: [packages/pixi-charts/src/core/Chart.ts:75](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/core/Chart.ts#L75)

`true` once [init](/api/classes/chart/#init) has completed.

##### Returns

`boolean`

#### Inherited from

[`Chart`](/api/classes/chart/).[`initialized`](/api/classes/chart/#initialized)

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [packages/pixi-charts/src/charts/PieChart.ts:228](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/PieChart.ts#L228)

Destroy every owned primitive in addition to the base-class teardown.
Idempotent — each primitive is itself idempotent so a partial-init
failure stays safe.

#### Returns

`void`

#### Overrides

[`Chart`](/api/classes/chart/).[`destroy`](/api/classes/chart/#destroy)

---

### init()

> **init**(): `Promise`\<`void`\>

Defined in: [packages/pixi-charts/src/charts/PieChart.ts:216](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/PieChart.ts#L216)

Override of [Chart.init](/api/classes/chart/#init): after the PIXI Application is ready,
runs the first render so the spec dispatcher hands back a fully-rendered
chart.

#### Returns

`Promise`\<`void`\>

#### Overrides

[`Chart`](/api/classes/chart/).[`init`](/api/classes/chart/#init)
