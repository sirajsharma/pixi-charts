---
'pixi-charts': minor
---

Add `pointRadius` and `pointAlpha` to `ChartOptions` for `type: 'scatter'`. `pointRadius` sets a fixed marker radius in CSS pixels, overriding the default and any `size` encoding so dense scatters can use uniform small markers and let density emerge from overlap. `pointAlpha` multiplies the rendered alpha of the entire point cloud in `[0, 1]`, letting overlapping points accumulate into a density gradient. Both options are scatter-only; the validator allows them on any spec but other chart types ignore them. No breaking changes.
