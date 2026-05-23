---
'pixi-charts': patch
---

Fix chart layout calculations using internal pixel buffer dimensions instead of logical CSS dimensions. On high-DPI displays (devicePixelRatio > 1), charts were rendering at approximately half the intended size, occupying the top-left of their containers. All six chart types are affected and fixed. No public API changes.
