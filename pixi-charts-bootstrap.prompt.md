# Pixi Charts — Bootstrap Prompt for Claude Code

You are helping me bootstrap an open-source TypeScript charting library called `pixi-charts`. This is a public project that will be published to npm and hosted on GitHub, so code quality, architectural clarity, and contributor experience matter as much as functionality.

## Project Overview

`pixi-charts` is a WebGL-rendered charting library that uses PixiJS for rendering and D3 submodules for data primitives (scales, shape generators, quadtree spatial indexing, color interpolation). The goal is to deliver 10-100x better performance than SVG-based alternatives (Recharts, Chart.js, D3 with SVG) on large datasets — targeting 60fps with 100k+ data points and graceful handling up to 1M points.

The library exposes a unified declarative spec API (`ChartSpec`) — every chart is described by the same JSON shape, and a single `render(spec, container)` function dispatches to the right chart implementation. This design also makes the library trivially consumable by LLMs that output chart specifications.

Six chart types are planned: Line, Area, Bar, Scatter, Heatmap, Pie/Donut. Animation is limited to enter animations only (v1), implemented via PixiJS's ticker — no GSAP dependency.

## What I Want You to Do in This Session

**Do NOT try to build the whole library.** Set up the foundation correctly, then implement ONE thing end-to-end as a reference for everything that follows: the project scaffolding + the `Chart` abstract base class + the `tween()` animation helper. Stop there. We will build out the rest in subsequent sessions.

Specifically:

1. Initialize a TypeScript library project with the tooling and conventions described below.
2. Set up the repository structure exactly as specified.
3. Implement `core/animation.ts` (the ticker-based tween helper).
4. Implement `core/Chart.ts` (the abstract base class — lifecycle, PIXI app setup, resize handling, tween tracking, abstract render method).
5. Write thorough JSDoc comments and unit tests for both.
6. Create the README, CONTRIBUTING, and LICENSE files.
7. Set up CI.

After this is done and reviewed, we'll add the next module (`core/Axis.ts`) in a follow-up session.

## Tech Stack and Tooling

- **Language:** TypeScript, strict mode (`"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`)
- **Build:** `tsup` for the library bundle (ESM + CJS + .d.ts). Target ES2020.
- **Package manager:** pnpm. The repo is a monorepo — set up `pnpm-workspace.yaml` with `packages/*` even though only `pixi-charts` exists today (the AI explorer package will be added later).
- **Testing:** Vitest for unit tests, with `happy-dom` for DOM stubbing. Visual regression tests will be added later (Playwright); just leave a `tests/visual/` directory with a README placeholder.
- **Linting:** ESLint (flat config, `eslint.config.js`) + Prettier. Use `@typescript-eslint` with the strict and stylistic configs.
- **Pre-commit:** Husky + lint-staged to run prettier and eslint on staged files.
- **Commit style:** Conventional Commits. Add a `commitlint` config.
- **Versioning:** Changesets for changelog and version management.
- **CI:** GitHub Actions — workflow for lint, typecheck, test on push and PR against Node 18 and 20.
- **Docs:** TypeDoc for API reference generation (config only; docs site is a separate package added later).

## Dependencies for `pixi-charts`

- **Peer:** `pixi.js` (^8.0.0)
- **Runtime:** `d3-scale`, `d3-array`, `d3-shape`, `d3-color`, `d3-scale-chromatic`, `d3-quadtree`, `d3-format`, `d3-time-format`, `zod`
- **Dev:** tsup, vitest, happy-dom, eslint, prettier, typescript, typedoc, husky, lint-staged, @changesets/cli, commitlint

**Import D3 only as submodules — never the full `d3` package.** This is a non-negotiable architectural rule and should be enforced via an ESLint rule (`no-restricted-imports`) that blocks `from 'd3'`.

## Repository Structure

```
siraj-viz/
├── .github/
│   ├── workflows/
│   │   └── ci.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
├── .changeset/
│   └── config.json
├── .husky/
├── packages/
│   └── pixi-charts/
│       ├── src/
│       │   ├── core/
│       │   │   ├── Chart.ts
│       │   │   └── animation.ts
│       │   └── index.ts
│       ├── tests/
│       │   ├── core/
│       │   │   ├── Chart.test.ts
│       │   │   └── animation.test.ts
│       │   └── visual/
│       │       └── README.md
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsup.config.ts
│       ├── vitest.config.ts
│       └── README.md
├── .editorconfig
├── .gitignore
├── .prettierrc
├── .prettierignore
├── eslint.config.js
├── commitlint.config.js
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── README.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
└── LICENSE          (MIT)
```

## Architectural Principles to Enforce

These are the rules every file in this library must follow. Encode them in `CONTRIBUTING.md` and reflect them in the code you write today.

1. **Separation of concerns: data vs. rendering.** D3 handles math (scales, layouts, generators). PIXI handles pixels. A file should rarely do both; when it does, the boundary is explicit. Never use D3's SVG output.

2. **One public entry point.** Only `src/index.ts` re-exports symbols intended for library users. Everything else is internal. Tree-shakeable named exports only — no default exports.

3. **Composition over inheritance, except for the `Chart` base class.** The base class exists to share lifecycle (init, resize, destroy, tween tracking). Beyond that, chart-specific behavior composes small modules (axis, legend, tooltip) rather than extending deeply.

4. **No global state.** Every chart owns its PIXI Application, ticker subscriptions, and DOM listeners. Destroying a chart cleans up all of them. Memory-leak prevention is a first-class concern — write a test for it.

5. **Strict typing, no `any`.** Use generics where data shape matters. The `ChartSpec` will be the canonical typed interface between users and the library; runtime validation via zod mirrors the compile-time types.

6. **Respect user preferences.** `prefers-reduced-motion` must short-circuit animations. Build this into the `tween()` helper from day one.

7. **Predictable side-effect ordering.** Constructors should NOT start rendering. Charts have an explicit `.render()` call. This makes testing trivial and gives users control over timing.

8. **Error messages teach.** When the spec validator rejects input, the error should explain what was wrong and what a correct shape looks like. Same for any runtime error the library throws.

9. **Bundle size is a feature.** Every dependency added gets justified in the PR description. The published bundle should target <50KB gzipped for the core + one chart.

10. **Tests are documentation.** Each public class/function has a co-located test file. Tests describe behavior in plain English (`it('cleans up ticker listeners on destroy')`), not implementation details.

## Specific Implementation Requirements for This Session

### `core/animation.ts`

**Export:**

- `easings`: object with `linear`, `easeOut`, `easeInOut` functions
- `EasingName`: type union of the easing keys
- `TweenOptions`: type with `duration?: number`, `ease?: EasingName`, `onUpdate: (progress: number) => void`, `onComplete?: () => void`
- `tween(ticker: PIXI.Ticker, opts: TweenOptions): () => void` — returns a cancel function

**Behavior:**

- Uses `performance.now()` for timing, not ticker delta accumulation (more accurate and resilient to frame drops).
- Checks `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and, if true, immediately calls `onUpdate(1)` and `onComplete()` then returns a no-op cancel.
- Handles SSR safely (`typeof window === 'undefined'`).
- Default duration: 500ms. Default ease: `easeOut`.
- Removes the ticker listener on completion or cancellation. A test must verify no leaked ticker callbacks remain after either path.

### `core/Chart.ts`

**Abstract base class with:**

- Constructor takes `{ container: HTMLElement, width?: number, height?: number }`
- Creates a `PIXI.Application` on `init()` (async — PIXI v8 requires this).
- Sets up a `ResizeObserver` on the container for responsive resizing.
- Maintains a private `activeTweens: Array<() => void>` and a protected `addTween(cancel: () => void)` method.
- Protected `cancelAllTweens()` method.
- Abstract `protected render(): void` method that subclasses implement.
- Public `destroy()` method that: cancels all tweens, disconnects the ResizeObserver, removes all event listeners, destroys the PIXI Application (with `removeView: true`), and zeros internal references. Idempotent — calling twice does not throw.
- A `destroyed` getter so tests and users can verify cleanup.

**Tests must cover:**

- Construction does not call render automatically.
- `destroy()` cleans up PIXI app, ResizeObserver, and pending tweens.
- `destroy()` is idempotent.
- Resize updates the PIXI renderer dimensions.
- Tweens added via `addTween` are cancelled on destroy.

## What to Deliver

1. The full repo scaffolded with all configuration files filled in.
2. `core/animation.ts` and `core/Chart.ts` implemented per the specs above.
3. Vitest tests for both with the coverage described above. Run them and confirm they pass.
4. `README.md` at the repo root explaining what `pixi-charts` is, the status ("alpha — under active development"), and a "Coming soon" section listing the six planned chart types.
5. `CONTRIBUTING.md` encoding the 10 architectural principles above plus instructions for running tests, the conventional commit format, and the changeset workflow.
6. CI workflow that runs `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` on Node 18 and 20.
7. A short summary at the end of what you built, what you deferred for later sessions, and any decisions you made that I should review.

## Working Style I Want From You

- **Ask me clarifying questions before starting** if anything in this prompt is ambiguous or if you'd recommend a different choice than what I've specified. I'd rather pause and align than rewrite later.
- **After scaffolding, show me the file tree before filling in implementations** so I can sanity-check the structure.
- **For each non-trivial file you write, briefly explain (in chat, not in code comments) the key design choices** — especially anywhere you departed from an obvious approach.
- **Run the tests yourself and paste the output before declaring the session done.** Don't tell me "tests should pass"; show me they do.
- **If you find yourself writing more than ~200 lines of implementation code without a corresponding test, stop and write the tests first.**

Begin by asking any clarifying questions you have, then proceed.
