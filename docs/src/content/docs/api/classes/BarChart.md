---
editUrl: false
next: false
prev: false
title: 'BarChart'
---

Defined in: [packages/pixi-charts/src/charts/BarChart.ts:178](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/BarChart.ts#L178)

Bar chart — single series, vertical or horizontal.

**One class, two orientations.** A horizontal bar chart is a vertical one
with the axes swapped: same data, same encoding, same hit-testing — only
which axis carries the band scale differs. `options.orientation`
(`'vertical'` default, or `'horizontal'`) selects the layout; everything
else is a single branch in the scale-setup and drawing code. See
`ChartOptions.orientation` for the user-facing contract.

**Single series.** Grouped and stacked bars are out of scope here
(Session 7+). The `encoding.color` channel here controls **per-bar
color**, not a series split: with no color encoding every bar takes the
default scheme's first color; with a categorical color encoding each bar
is colored by its color-field value (so coloring by the category field —
the common case — yields one color per bar). Above
COLOR_GROUP_WARN_THRESHOLD distinct color values a `console.warn`
fires (palettes wrap and colors repeat).

**Lifecycle / resize** mirror import('./LineChart.js').LineChart:

```ts
const chart = new BarChart({ container, spec });
await chart.init(); // creates the PIXI app AND does the first render
chart.destroy(); // idempotent; cancels tweens, tears down primitives
```

Construction is pure. The first render runs at the tail of `init()`.
Resize rebuilds scales/axes and redraws at the final state (the enter
animation does not re-run).

**Baseline.** Bars grow from `valueAdapter.scale(0)` — zero projected
through the value scale, _not_ an assumed plot edge. Negative values grow
the opposite side of that baseline; a domain that doesn't include zero
still projects a correct (possibly off-plot) baseline. Same correctness
point import('./AreaChart.js').AreaChart established.

The data + scale layer is **not** shared with the cartesian line-family
charts: bar's data transform is per-datum (not series-grouped) and its
drawing is discrete rectangles, not paths. Only the small
formatCategoryValueTooltip string helper is shared. Like every
chart, this extends [Chart](/api/classes/chart/) directly — composition, not a chart
inheritance tree.

For most use cases, prefer the declarative [render](/api/functions/render/) entry point —
use this class directly only when you need fine-grained lifecycle control.

## Example

```ts
import { BarChart } from 'pixi-charts';

const chart = new BarChart({
  container: document.getElementById('chart')!,
  spec: {
    type: 'bar',
    data: [
      { team: 'Alpha', wins: 12 },
      { team: 'Beta', wins: 9 },
      { team: 'Gamma', wins: 15 },
    ],
    encoding: {
      x: { field: 'team', type: 'categorical' },
      y: { field: 'wins', type: 'quantitative' },
    },
    options: { orientation: 'vertical' },
  },
});
await chart.init();
chart.destroy();
```

## Extends

- [`Chart`](/api/classes/chart/)

## Constructors

### Constructor

> **new BarChart**(`opts`): `BarChart`

Defined in: [packages/pixi-charts/src/charts/BarChart.ts:219](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/BarChart.ts#L219)

#### Parameters

##### opts

`BarChartOptions`

#### Returns

`BarChart`

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

Defined in: [packages/pixi-charts/src/charts/BarChart.ts:246](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/BarChart.ts#L246)

Destroy every owned primitive in addition to the base-class teardown.
Idempotent — the base class guards a second call, and each primitive is
itself idempotent so a partial-init failure stays safe.

#### Returns

`void`

#### Overrides

[`Chart`](/api/classes/chart/).[`destroy`](/api/classes/chart/#destroy)

---

### init()

> **init**(): `Promise`\<`void`\>

Defined in: [packages/pixi-charts/src/charts/BarChart.ts:234](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/BarChart.ts#L234)

Override of [Chart.init](/api/classes/chart/#init): after the PIXI Application is ready,
runs the first render so the spec dispatcher hands back a fully-rendered
chart.

#### Returns

`Promise`\<`void`\>

#### Overrides

[`Chart`](/api/classes/chart/).[`init`](/api/classes/chart/#init)
