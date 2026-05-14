---
"pixi-charts": minor
---

Add two internal core primitives that future chart implementations will compose:

- `core/Legend` — PIXI-rendered chart legend with two modes: **categorical** (rows or columns of swatch + label pairs) and **continuous** (a gradient bar built from a sequential `ColorScheme` with `[min, max]` end labels). Provides `width` / `height` getters (manually tracked, no `getBounds()` dependency) so consumers can lay out the legend relative to other chart elements. `update()` supports same-mode partial merges as well as full mode-switches; `destroy()` is idempotent and releases GPU-backed `Text` textures.
- `core/InteractionLayer<D>` — scale-agnostic pointer-event abstraction over PIXI's federated event system. The consumer supplies a `HitTester<D>` (the layer itself does not import `ScaleAdapter`); the layer dispatches normalized `hover` / `click` / `leave` events with hover-deduplication, primary-button-only clicks, and plot-area-local coordinates plus page-coordinate `globalPosition` for DOM tooltip positioning. The state machine is extracted into a pure `handlePointerSample` helper so its hover/click/leave logic is testable in isolation, independent of PIXI's event simulation.

Both modules are not yet re-exported from the public `src/index.ts` — they ship as internal building blocks and will become part of the public API once the first chart consumes them.
