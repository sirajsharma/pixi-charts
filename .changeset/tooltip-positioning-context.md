---
'pixi-charts': patch
---

Fix tooltip positioning when the chart container isn't already a positioning context. The `Tooltip` element is `position: absolute`, which resolves against the nearest positioned ancestor — not the DOM parent. If the host container defaulted to `position: static`, the tooltip anchored to a higher ancestor (often `<body>`) and appeared far from the chart, sometimes overlapping a different chart's card in multi-chart layouts. `Tooltip` now promotes a static parent to `position: relative` at construction; non-static parents (relative/absolute/fixed/sticky) are left alone. `relative` has no visual side effect on the parent's own layout. No public API changes.
