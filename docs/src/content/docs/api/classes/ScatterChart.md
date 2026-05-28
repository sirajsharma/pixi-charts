---
editUrl: false
next: false
prev: false
title: 'ScatterChart'
---

Defined in: [packages/pixi-charts/src/charts/ScatterChart.ts:209](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/ScatterChart.ts#L209)

Scatter plot — the library's performance flagship.

Renders **100k+ points at 60fps** by drawing every point as a PixiJS v8
Particle in a single ParticleContainer (one batched draw
call), and answering pointer hit-tests in `O(log n)` via a
SpatialIndex (`d3-quadtree`) instead of a linear scan.

## Architectural decisions

**`ParticleContainer`, not `Graphics` or custom shaders.** `Graphics`
(one circle per point) collapses above ~5k points; custom WebGL shaders
are faster still but add a shader-compilation/debugging surface not worth
it for v1. `ParticleContainer` is purpose-built for "many sprites, one
texture, one draw call". A custom-shader pass is a documented future
optimization if profiling ever demands it.

**One white texture + per-particle tint** (not pre-baked per-colour
textures). PIXI **v8**'s `Particle` supports a per-particle `tint` over a
shared texture while still batching into a single draw — so a single
white circle texture, tinted per point, covers categorical _and_
continuous colour with no per-colour bake step and exactly one texture to
free. (The "pre-bake one texture per colour" workaround is a PIXI **v7**
concern; v8's per-particle tint makes it unnecessary.)

**Square-root size scale.** With a `size` encoding, radius ∝ √value so
that _area_ (visual weight) ∝ value. Scaling radius linearly with value —
the common footgun — makes area grow with value², badly overstating large
values. Range defaults to `[3, 12]` px (`d3-scale`'s `scaleSqrt`).

**Viridis for continuous colour.** A `'quantitative'` colour encoding maps
through a sequential interpolator (default **viridis** — perceptually
uniform and colourblind-safe), paired with a continuous Legend.
Categorical colour uses the discrete palette + categorical legend, like
every other chart.

## Scope (v1)

Static view: hover shows a tooltip, leave hides it, click is a wired
no-op. No zoom/pan/brush, no multi-series shapes, circles only, no
jitter. A **size legend** is a deliberate future addition (colour legends
ship now).

## Lifecycle (identical to the other charts)

```ts
const chart = new ScatterChart({ container, spec });
await chart.init(); // creates the PIXI app AND does the first render
chart.destroy(); // idempotent; frees the shared texture + primitives
```

Construction is pure. Resize rebuilds scales, re-projects points, updates
particle transforms in place, rebuilds the spatial index, and draws at the
final state (no enter re-run).

**Texture lifecycle.** The shared particle texture is GPU-backed, baked
once, and **not** freed by the base class's `app.destroy({ texture: false })`;
this class destroys it explicitly in [destroy](/api/classes/scatterchart/#destroy) (it lives for the
chart's lifetime — not recreated per render). Skipping that is a real
per-instance GPU leak — covered by a test.

For most use cases, prefer the declarative [render](/api/functions/render/) entry point —
use this class directly only when you need fine-grained lifecycle control.

## Example

```ts
import { ScatterChart } from 'pixi-charts';

const chart = new ScatterChart({
  container: document.getElementById('chart')!,
  spec: {
    type: 'scatter',
    data: [
      { x: 1.2, y: 3.4, group: 'a' },
      { x: 2.7, y: 1.8, group: 'b' },
      { x: 4.1, y: 5.2, group: 'a' },
    ],
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      color: { field: 'group', type: 'categorical' },
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

> **new ScatterChart**(`opts`): `ScatterChart`

Defined in: [packages/pixi-charts/src/charts/ScatterChart.ts:248](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/ScatterChart.ts#L248)

#### Parameters

##### opts

`ScatterChartOptions`

#### Returns

`ScatterChart`

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

Defined in: [packages/pixi-charts/src/charts/ScatterChart.ts:274](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/ScatterChart.ts#L274)

Destroy every owned primitive plus the shared particle texture, in
addition to the base-class teardown. Idempotent — the base guards a
second call and each primitive's own destroy is idempotent too.

#### Returns

`void`

#### Overrides

[`Chart`](/api/classes/chart/).[`destroy`](/api/classes/chart/#destroy)

---

### init()

> **init**(): `Promise`\<`void`\>

Defined in: [packages/pixi-charts/src/charts/ScatterChart.ts:262](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/ScatterChart.ts#L262)

Override of [Chart.init](/api/classes/chart/#init): after the PIXI Application is ready,
runs the first render so the spec dispatcher hands back a fully-rendered
chart.

#### Returns

`Promise`\<`void`\>

#### Overrides

[`Chart`](/api/classes/chart/).[`init`](/api/classes/chart/#init)
