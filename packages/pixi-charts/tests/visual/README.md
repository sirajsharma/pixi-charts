# Visual regression tests — placeholder

This directory will host Playwright-driven visual regression tests for `pixi-charts`. **No tests live here yet.**

## Plan

Once a renderable chart is implemented (Line first), this folder will contain:

- A Playwright config that boots a small test harness (a static HTML page that imports `pixi-charts` from `dist/` and renders fixtures).
- A `fixtures/` directory of `ChartSpec` JSON samples, one per chart type and significant variant (empty data, single point, log scale, etc.).
- Snapshot images committed under `__snapshots__/`.
- A `pnpm test:visual` script in `package.json` (and a matching CI job, gated behind a label so it only runs when intentionally updated).

## Why visual tests at all

Unit tests verify the lifecycle (init / resize / destroy / tween cleanup) and the data-layer math. But the whole point of `pixi-charts` is what ends up on the canvas — anti-aliased edges, axis tick alignment, marker positions, color interpolation. Those are properties only a screenshot can assert.

## Why Playwright (not jsdom / happy-dom)

Visual tests need a real GPU pipeline. happy-dom has no WebGL; jest-canvas-mock returns identity pixels. Playwright launches a headless Chromium with full WebGL support, so the screenshots match what users will see.

## Status

Tracked in the v1 roadmap. Until then, treat this directory as intentionally empty.
