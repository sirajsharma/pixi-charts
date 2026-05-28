---
editUrl: false
next: false
prev: false
title: 'LineChart'
---

Defined in: [packages/pixi-charts/src/charts/LineChart.ts:132](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/LineChart.ts#L132)

Line chart — the first end-to-end chart in `pixi-charts`.

Composes the v1 primitive set: two Axis instances wrapped over
ScaleAdapter adapters, an optional Legend (for
categorical color encoding with multiple series), an optional
Tooltip attached to the container, and an
InteractionLayer fed a chart-specific hit-tester.

The data + scale layer (series grouping, downsampling, scale/adapter/axis
construction, hit-testing, tooltip formatting) is shared with
import('./AreaChart.js').AreaChart via plain functions in
`charts/_shared/cartesian.ts`. LineChart still extends [Chart](/api/classes/chart/)
directly — composition, not inheritance.

**Lifecycle.** Extends [Chart](/api/classes/chart/), so the public lifecycle is:

```ts
const chart = new LineChart({ container, spec });
await chart.init(); // creates the PIXI app AND does the first render
// ...
chart.destroy(); // idempotent; cancels tweens, tears down primitives
```

Construction is pure — no PIXI app, no DOM mutations beyond the spec
being captured. The first render happens at the tail of `init()` so the
spec dispatcher can hand consumers a fully-rendered chart back.

**Resize.** Inherited `ResizeObserver` re-invokes the protected
[render](/api/functions/render/) on container size changes; LineChart rebuilds its scales
and adapters with the new ranges and skips the enter animation on those
subsequent passes.

**Hit-testing strategy.** Built using the ScaleAdapter's `kind`
discriminator. Continuous adapters (linear, time) use `invert()` to map
the pointer's x back to the domain, then find the nearest datum within
HIT_TEST_RADIUS_PX. Band adapters iterate the domain to find the
band the pointer falls inside. Across multiple series, the closest point
in pixel space wins.

For most use cases, prefer the declarative [render](/api/functions/render/) entry point —
use this class directly only when you need fine-grained lifecycle control
or want to bypass spec validation.

## Example

```ts
import { LineChart } from 'pixi-charts';

const chart = new LineChart({
  container: document.getElementById('chart')!,
  spec: {
    type: 'line',
    data: [
      { month: 'Jan', revenue: 12_400 },
      { month: 'Feb', revenue: 13_900 },
      { month: 'Mar', revenue: 15_200 },
    ],
    encoding: {
      x: { field: 'month', type: 'categorical' },
      y: { field: 'revenue', type: 'quantitative' },
    },
  },
});
await chart.init();

// later, e.g. when the component unmounts
chart.destroy();
```

## Extends

- [`Chart`](/api/classes/chart/)

## Constructors

### Constructor

> **new LineChart**(`opts`): `LineChart`

Defined in: [packages/pixi-charts/src/charts/LineChart.ts:160](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/LineChart.ts#L160)

#### Parameters

##### opts

`LineChartOptions`

#### Returns

`LineChart`

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

Defined in: [packages/pixi-charts/src/charts/LineChart.ts:186](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/LineChart.ts#L186)

Destroy every owned primitive in addition to the base-class teardown.
Idempotent — the base class guards a second call, but each primitive
is also idempotent so a partial-init failure stays safe.

#### Returns

`void`

#### Overrides

[`Chart`](/api/classes/chart/).[`destroy`](/api/classes/chart/#destroy)

---

### init()

> **init**(): `Promise`\<`void`\>

Defined in: [packages/pixi-charts/src/charts/LineChart.ts:174](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/LineChart.ts#L174)

Override of [Chart.init](/api/classes/chart/#init): after the PIXI Application is ready,
runs the first render so the spec dispatcher can hand consumers a
fully-rendered chart back.

#### Returns

`Promise`\<`void`\>

#### Overrides

[`Chart`](/api/classes/chart/).[`init`](/api/classes/chart/#init)
