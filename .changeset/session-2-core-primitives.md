---
"pixi-charts": minor
---

Add three internal core primitives that future chart implementations will compose:

- `core/ColorScheme` — typed wrappers for a curated subset of `d3-scale-chromatic` categorical palettes (`category10`, `tableau10`, `set2`, `paired`) and sequential interpolators (`viridis`, `blues`, `inferno`, `plasma`), plus `getCategoricalColor` / `getSequentialColor` / `cssColorToPixi` helpers returning PIXI numeric colors.
- `core/Tooltip` — DOM-based tooltip overlay with inline styling, XSS-safe string content, optional HTMLElement content, and edge avoidance against the host container's bounding rect.
- `core/Axis` — PIXI-rendered axis (top / right / bottom / left) supporting linear, band, time, and log scales with optional gridlines, custom tick formatters, and a `update()` / `destroy()` lifecycle.

These modules are not yet re-exported from the public `src/index.ts` — they ship as internal building blocks and will become part of the public API when the first chart consumes them.
