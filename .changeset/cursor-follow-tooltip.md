---
'pixi-charts': patch
---

Tooltip now follows the cursor smoothly while hovering within a single data point's region, not just when crossing between data points. Most visible on BarChart and PieChart where individual hit regions are large. Adds an `isNewDatum` flag to hover events so consumers can skip redundant content re-renders. No public API changes.
