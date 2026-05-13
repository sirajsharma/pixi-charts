# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This is a pnpm workspace. All commands run from the repo root.

```sh
pnpm install        # install (also runs husky via `prepare`)
pnpm test           # vitest run (single-run, not watch) across the workspace
pnpm test:watch     # vitest in watch mode
pnpm typecheck      # tsc --noEmit per package
pnpm lint           # eslint .
pnpm lint:fix       # eslint --fix .
pnpm build          # tsup → packages/*/dist/
pnpm format         # prettier --write .
pnpm changeset      # add a changeset (required for any user-facing PR)
```

Running a single test or a filtered set (must `cd` into the package because vitest doesn't traverse the workspace):

```sh
cd packages/pixi-charts
pnpm exec vitest run tests/core/animation.test.ts
pnpm exec vitest run -t "reduced motion"   # filter by test name
```

CI runs `lint → typecheck → test → build` on Node 20 and 22. Pre-commit (`.husky/pre-commit`) runs lint-staged (prettier + eslint --fix). Commit-msg (`.husky/commit-msg`) enforces Conventional Commits via commitlint — see `commitlint.config.js` for allowed types.

## Architecture

### Monorepo shape

- **Root** is private (`"private": true`); only orchestrates pnpm workspace scripts.
- **`packages/pixi-charts/`** is the only package today. More packages (an AI explorer, a docs site) are planned but not present.
- The published bundle is **ESM-only**. PixiJS v8 is ESM-only — emitting CJS would ship a broken entry. `"type": "module"` is set in both root and package.
- Build is `tsup` with `dts: true`. Externals: `pixi.js` (peer) and every `d3-*` submodule.

### The library's two contracts

1. **Public surface = `packages/pixi-charts/src/index.ts`.** Only symbols re-exported from this file are user-facing. Everything else is internal and can be refactored freely. **Named exports only — no default exports.**

2. **Chart lifecycle is explicit, not implicit:**
   ```ts
   const chart = new SomeChart({ container }); // pure — no PIXI, no DOM
   await chart.init(); // PIXI v8 Application + ResizeObserver
   // ... chart.render() etc.
   chart.destroy(); // idempotent; cancels tweens, destroys PIXI app, removes canvas
   ```
   The async `init()` exists because PIXI v8 requires `await app.init(...)`. Constructors do nothing observable — this is a deliberate testability and timing-control choice.

### `core/Chart.ts`

Abstract base — every chart extends this. It owns the `Application`, a `ResizeObserver`, and a list of tween cancel functions. `destroy()` is the single drain: it cancels tracked tweens, disconnects the observer, calls `app.destroy({ removeView: true }, { children: true })`, and flips the `destroyed` flag. `addTween()` after destroy invokes the cancel synchronously rather than retaining it — this is the no-leak invariant. Subclasses implement the protected abstract `render()`.

### `core/animation.ts`

`tween(ticker, opts)` returns an idempotent cancel function. Timing is `performance.now()`-based (not delta accumulation) so a dropped frame still yields the correct progress. Two short-circuit paths fire `onUpdate(1)` + `onComplete()` synchronously and never touch the ticker: `prefers-reduced-motion: reduce` matching, or `window` being undefined (SSR). The ticker is a parameter — never reach for a global. Every code path that adds a listener has exactly one removal path.

## Architectural rules (enforced where possible)

These are described in detail in `CONTRIBUTING.md`. The load-bearing ones:

- **D3 submodules only, never the umbrella `d3` package.** ESLint-enforced in `eslint.config.js` via `no-restricted-imports` scoped to `packages/pixi-charts/src/**`. The umbrella defeats tree-shaking.
- **D3 does math; PixiJS does pixels.** A file should rarely do both; when it must, the boundary is explicit. Never use D3's SVG output.
- **No global state.** Every chart owns its `Application`, ticker subscriptions, and DOM listeners. Memory-leak prevention is verified by tests.
- **`prefers-reduced-motion` short-circuits animation.** Built into `tween()` — do not bypass.
- **Bundle size is a feature.** Target <50KB gzipped for core + one chart. New runtime deps need PR-description justification.

TypeScript is configured strict, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` (see `tsconfig.base.json`).

## Testing conventions

- **Test files mirror `src/`** under `tests/` (`src/core/Chart.ts` ↔ `tests/core/Chart.test.ts`).
- **happy-dom** is the test environment. It has no WebGL and no `ResizeObserver`.
- **`tests/setup.ts`** installs a `MockResizeObserver` (with a `.trigger(entries)` helper for tests to drive callbacks manually) and a controllable `matchMedia` stub. Use `setMediaMatch('(prefers-reduced-motion: reduce)', true)` to test reduced-motion paths.
- **`pixi.js` is mocked at the module boundary** in `Chart.test.ts` via `vi.mock('pixi.js', ...)`. No GPU needed. Reuse this pattern for any test that touches `Application`.
- **`performance.now()`** is mocked with `vi.spyOn(performance, 'now')` rather than vitest fake timers — fake-timer interaction with `performance` in vitest 2.x is ambiguous; a direct spy isn't.
- Test files have a relaxed ESLint override (non-null assertions, `any` in mocks, etc.) — don't fight it, but don't propagate test-style code into `src/`.

## Status and roadmap

- Alpha. Only the foundation (Chart base + tween) is implemented. Coming: `core/Axis.ts`, the `ChartSpec` type + zod validator + `render(spec, container)` dispatcher, and six chart types (Line, Area, Bar, Scatter, Heatmap, Pie/Donut).
- The `packages/pixi-charts/tests/visual/` directory is a placeholder for future Playwright visual regression tests — intentionally empty today.

## Known issues

- TypeDoc 0.26 declares a TS peer range that maxes at 5.6.x; the workspace uses TS 5.9. Works in practice; pnpm prints a peer-dep warning at install. Awaiting a TypeDoc release that widens the range.
- `packages/pixi-charts/package.json` has `https://github.com/TODO/pixi-charts` as a placeholder for `homepage`, `repository.url`, and `bugs.url`. Replace `TODO` with the actual GitHub path once the repo is pushed.
