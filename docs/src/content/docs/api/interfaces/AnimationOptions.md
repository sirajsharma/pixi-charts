---
editUrl: false
next: false
prev: false
title: 'AnimationOptions'
---

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:116](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L116)

Animation configuration for a chart.

Only the initial "enter" animation is configurable in this release.
Update transitions (data-change animations) are deliberately out of scope
until the spec stabilises across more chart types.

## Properties

### enter?

> `optional` **enter?**: `boolean` \| \{ `duration?`: `number`; `ease?`: `EasingName`; \}

Defined in: [packages/pixi-charts/src/spec/ChartSpec.ts:127](https://github.com/sirajsharma/pixi-charts/blob/c8a0bc42f9722d345e87d3b5a8bfbe92334aaaf0/packages/pixi-charts/src/spec/ChartSpec.ts#L127)

Initial draw-on animation.

- `true` (default) — animate with sensible defaults.
- `false` — render in final state immediately, no tween.
- object — animate with explicit `duration` (ms) and / or `ease`.

`prefers-reduced-motion: reduce` always wins, regardless of this
setting — the underlying import('../core/animation.js').tween
short-circuits to the final frame in that case.
