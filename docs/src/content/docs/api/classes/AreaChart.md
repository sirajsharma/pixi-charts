---
editUrl: false
next: false
prev: false
title: 'AreaChart'
---

Defined in: [packages/pixi-charts/src/charts/AreaChart.ts:110](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/AreaChart.ts#L110)

Area chart — a filled region between each series' line and a zero
baseline, with a stroked top edge.

Shares the entire data + scale layer with
import('./LineChart.js').LineChart via
`charts/_shared/cartesian.ts` (series grouping, downsampling, scale /
adapter / axis construction, hit-testing, tooltip formatting). Both
classes extend [Chart](/api/classes/chart/) directly — composition, not inheritance.
Only the drawing differs: a closed polygon (`fill` + top-edge `stroke`)
rather than a bare stroke.

**Lifecycle / resize / hit-testing** are identical to `LineChart`:

```ts
const chart = new AreaChart({ container, spec });
await chart.init(); // creates the PIXI app AND does the first render
chart.destroy(); // idempotent; cancels tweens, tears down primitives
```

**Baseline.** The fill closes along `yAdapter.scale(0)` — zero projected
through the y-adapter, _not_ `plotHeight`. When the y-domain doesn't
include zero it is anchored at the plot bottom; when it crosses zero the
baseline sits mid-plot. The hit-tester is the shared cartesian one, so
the tooltip reports the point on the top edge (areas are not expected to
hit-test the filled body).

**Known gap — stacking.** Multi-series areas are drawn in order and
overlap, with AREA_FILL_ALPHA keeping overlaps readable. Stacked
areas (cumulative baselines) are a future feature with their own design
decisions and are intentionally not implemented here.

For most use cases, prefer the declarative [render](/api/functions/render/) entry point —
use this class directly only when you need fine-grained lifecycle control.

## Example

```ts
import { AreaChart } from 'pixi-charts';

const chart = new AreaChart({
  container: document.getElementById('chart')!,
  spec: {
    type: 'area',
    data: [
      { day: 1, visits: 240 },
      { day: 2, visits: 312 },
      { day: 3, visits: 198 },
    ],
    encoding: {
      x: { field: 'day', type: 'quantitative' },
      y: { field: 'visits', type: 'quantitative' },
    },
  },
});
await chart.init();
chart.destroy();
```

## Extends

- [`Chart`](/api/classes/chart/)

## Constructors

### Constructor

> **new AreaChart**(`opts`): `AreaChart`

Defined in: [packages/pixi-charts/src/charts/AreaChart.ts:138](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/AreaChart.ts#L138)

#### Parameters

##### opts

`AreaChartOptions`

#### Returns

`AreaChart`

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

Defined in: [packages/pixi-charts/src/charts/AreaChart.ts:164](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/AreaChart.ts#L164)

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

Defined in: [packages/pixi-charts/src/charts/AreaChart.ts:152](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/AreaChart.ts#L152)

Override of [Chart.init](/api/classes/chart/#init): after the PIXI Application is ready,
runs the first render so the spec dispatcher can hand consumers a
fully-rendered chart back.

#### Returns

`Promise`\<`void`\>

#### Overrides

[`Chart`](/api/classes/chart/).[`init`](/api/classes/chart/#init)
