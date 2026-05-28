---
editUrl: false
next: false
prev: false
title: 'HeatmapChart'
---

Defined in: [packages/pixi-charts/src/charts/HeatmapChart.ts:185](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/HeatmapChart.ts#L185)

Heatmap chart — categorical × categorical grid, coloured by a quantitative
value field.

## Rendering: texture-from-buffer (one draw call)

For an MxN grid of coloured cells, three options were considered:

- **`Graphics` rectangles, one per cell** — collapses past ~10⁴ cells; not
  viable as a default.
- **Custom WebGL shader** — fastest possible, but adds a
  shader-compilation/debugging surface not justified for v1. Same posture
  `ScatterChart` took toward shaders.
- **Texture-from-buffer** — allocate a `Uint8ClampedArray` of `(width *
height * 4)` RGBA bytes where `width`/`height` are the **grid
  dimensions** (not pixel dimensions), wrap it in a Texture via a
  BufferImageSource, render as a single Sprite stretched
  across the plot area. **One draw call regardless of grid size**, GPU-
  native scaling, and resize is free — only the sprite's pixel `width`/
  `height` change, the texture itself is reused.

The choice is texture-from-buffer. Custom shaders remain a documented
future optimisation.

**Crisp cells via `scaleMode: 'nearest'`.** When the (small) texture is
stretched across the (much larger) plot area, the default linear
interpolation produces fuzzy gradients across cell borders — wrong for
discrete heatmap cells. Nearest-neighbour sampling (the PIXI v8 string
literal `'nearest'`, set on the `BufferImageSource`'s `scaleMode`) gives
crisp cell edges.

## Axis convention

**Both axes are band scales.** This is the first chart in the library
with `bandAdapter` on x AND y simultaneously. Heatmaps in v1 do **not**
auto-bin continuous data; consumers pre-bin into discrete categories and
pass `encoding.x.type` / `encoding.y.type` as `'categorical'` (enforced by
the validator — see `spec/validate.ts:requireHeatmapEncoding`). A
quantitative-pre-binned axis is treated as ordered categorical by simply
stringifying the values.

**Y convention: index 0 at top of plot.** The first y category in
insertion order renders at the top edge of the plot (screen-top). The
y-axis labels run top-to-bottom in the same order. This matches the
common heatmap convention (calendars, confusion matrices). The texture
buffer is laid out row-major with `(yIdx * width + xIdx) * 4` — combined
with a band y-scale ranging `[0, plotHeight]`, yIdx 0 ends up at the top.

## Colour

Always quantitative (validator-enforced); default scheme `viridis`
(perceptually uniform, colourblind-safe). Each cell's normalised value
`t = (value - min) / (max - min)` is passed to getSequentialColor
to yield a PIXI `0xRRGGBB`. A span of zero (every value identical) maps
everything to `t = 0.5` so the heatmap still renders something meaningful
rather than NaN-coloured cells.

## Sparse cells

If `(x, y)` pairs are missing from `data`, those buffer positions stay
`(0, 0, 0, 0)` — fully transparent. The container's background shows
through. The hit-tester returns `null` for sparse positions so tooltips
don't show stale data.

## Legend

Always a continuous gradient (Legend `type: 'continuous'`) sized
to the value-field's `[min, max]`. Positioned top-right of the plot, same
placement as `ScatterChart`'s continuous legend.

## No enter animation

Heatmaps don't animate well in v1: a left-to-right reveal (Line/Area
style) doesn't fit a grid, a per-cell cascade looks gimmicky at any
realistic size, and a whole-grid alpha fade adds little value over a
straight static render. Deliberately omitted. `spec.animation.enter:
false` is honoured trivially (it's the only behaviour); `true` or an
object form is accepted by the validator but ignored here.

## Lifecycle (identical to the other charts)

```ts
const chart = new HeatmapChart({ container, spec });
await chart.init(); // creates the PIXI Application AND does the first render
chart.destroy(); // idempotent; frees the GPU texture + primitives
```

Construction is pure. Resize rebuilds scales/axes/legend (cheap) and
resizes the sprite (GPU-side); the buffer-backed texture is reused. The
texture is freed in [destroy](/api/classes/heatmapchart/#destroy) via `texture.destroy(true)` — same
GPU-memory discipline `ScatterChart` established for its shared particle
texture, and covered by an explicit test.

For most use cases, prefer the declarative [render](/api/functions/render/) entry point —
use this class directly only when you need fine-grained lifecycle control.

## Example

```ts
import { HeatmapChart } from 'pixi-charts';

const chart = new HeatmapChart({
  container: document.getElementById('chart')!,
  spec: {
    type: 'heatmap',
    data: [
      { hour: '00', day: 'Mon', count: 12 },
      { hour: '00', day: 'Tue', count: 18 },
      { hour: '01', day: 'Mon', count: 9 },
      // ...
    ],
    encoding: {
      x: { field: 'hour', type: 'categorical' },
      y: { field: 'day', type: 'categorical' },
      color: { field: 'count', type: 'quantitative' },
      value: { field: 'count', type: 'quantitative' },
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

> **new HeatmapChart**(`opts`): `HeatmapChart`

Defined in: [packages/pixi-charts/src/charts/HeatmapChart.ts:228](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/HeatmapChart.ts#L228)

#### Parameters

##### opts

`HeatmapChartOptions`

#### Returns

`HeatmapChart`

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

Defined in: [packages/pixi-charts/src/charts/HeatmapChart.ts:259](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/HeatmapChart.ts#L259)

Destroy every owned primitive plus the GPU-backed texture, in addition
to the base-class teardown. Idempotent — the base guards a second call
and each primitive's own destroy is itself idempotent.

`texture.destroy(true)` frees the underlying source too; without it the
buffer-backed `BufferImageSource` (and the GPU texture it owns) would
survive `app.destroy({ texture: false })` — same per-instance leak
`ScatterChart` guards against.

#### Returns

`void`

#### Overrides

[`Chart`](/api/classes/chart/).[`destroy`](/api/classes/chart/#destroy)

---

### init()

> **init**(): `Promise`\<`void`\>

Defined in: [packages/pixi-charts/src/charts/HeatmapChart.ts:242](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/charts/HeatmapChart.ts#L242)

Override of [Chart.init](/api/classes/chart/#init): after the PIXI Application is ready,
runs the first render so the spec dispatcher hands back a fully-
rendered chart.

#### Returns

`Promise`\<`void`\>

#### Overrides

[`Chart`](/api/classes/chart/).[`init`](/api/classes/chart/#init)
