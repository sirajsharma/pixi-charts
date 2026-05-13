---
"pixi-charts": minor
---

Add two internal core primitives needed for the first chart implementation:

- `core/Legend` — categorical (swatch + label pairs) and continuous (sampled-gradient bar) color legends rendered into a `PIXI.Container`. Continuous mode samples the sequential scheme at 64 points and labels the domain endpoints with `d3-format` by default. Mirrors `Axis`'s lifecycle: render in constructor, `update()` is a full re-render, `destroy()` is idempotent. `width` / `height` getters are tracked internally during render so they don't depend on `container.getBounds()`.
- `core/InteractionLayer` — a generic `InteractionLayer<D>` over PIXI v8 pointer events. Attaches a transparent hit-test sprite (with an explicit `Rectangle` hit-area, required because `Texture.EMPTY` has no intrinsic bounds in v8) to a stage and dispatches normalized `hover` / `click` / `leave` events with the matching datum. Includes hover deduplication, primary-button-only clicks, and `resize` / `setHitTester` for live data updates.

These modules ship as internal building blocks; they are not re-exported from the public `src/index.ts` yet and will become public once the first chart (LineChart) validates the surface.
