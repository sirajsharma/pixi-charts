---
'pixi-charts': patch
---

Internal: refactor `Axis` to consume a new `ScaleAdapter<TDomain>`
abstraction instead of raw d3 scales. `Axis` is now generic over its
scale's domain type, so tick formatter callbacks receive correctly typed
values (`number`, `string`, or `Date`) instead of a union — no more
narrowing at the call site. The `isBandScale` predicate and the
`ContinuousScale` projection cast are gone, replaced by adapter
delegation. No public API change: both `Axis` and `ScaleAdapter` remain
internal until a chart consumes them.
