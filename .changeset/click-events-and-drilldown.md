---
'pixi-charts': minor
---

Add a click event API to every chart. `chart.on('click', handler)` fires a `ChartClickEvent` with the clicked datum, its index in the data array, the click position (plot-area-local pixels), and — for multi-series Line and Area charts — the series name. Returns an unsubscribe function; `chart.off(...)` and `destroy()` also clear handlers. Available on all six chart types.

Pair this with `chart.update(newData)` to build instant drilldown: clicking reports what was clicked, your application decides what each click means, and `update()` swaps the data without recreating the WebGL context. The library stays a renderer; the navigation pattern lives in your code. See the new **Interactions → Click** page in the docs for a worked example.

Click semantics now follow the conventional `pointerdown` → `pointerup` contract with thresholds (≤ 5 px movement, ≤ 500 ms duration), so clicks no longer fire mid-drag or during a long press.
