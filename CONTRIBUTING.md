# Contributing to pixi-charts

Thanks for your interest in contributing. This document describes how the library is structured, the principles every contribution should follow, and the practical workflow for getting changes merged.

By participating, you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Architectural principles

Every file in this library should follow these rules. They are listed in approximate order of importance.

1. **Separation of concerns: data vs. rendering.** D3 handles math (scales, layouts, generators, color interpolation, spatial indexing). PixiJS handles pixels. A file should rarely do both; when it must, the boundary is explicit. **Never** use D3's SVG output — we render to WebGL.

2. **One public entry point.** Only `src/index.ts` re-exports symbols intended for library users. Everything else is internal. Tree-shakeable **named exports only** — no default exports.

3. **Composition over inheritance — except for the `Chart` base class.** The base class exists to share lifecycle (init, resize, destroy, tween tracking). Beyond that, chart-specific behavior composes small modules (axis, legend, tooltip) rather than extending deeply.

4. **No global state.** Every chart owns its PixiJS Application, ticker subscriptions, and DOM listeners. Destroying a chart cleans up all of them. Memory-leak prevention is a first-class concern — write a test for it.

5. **Strict typing, no `any`.** Use generics where data shape matters. The `ChartSpec` will be the canonical typed interface between users and the library; runtime validation via zod mirrors the compile-time types.

6. **Respect user preferences.** `prefers-reduced-motion` short-circuits animations. This is built into the `tween()` helper — do not bypass it.

7. **Predictable side-effect ordering.** Constructors **do not** start rendering. Charts have an explicit async `.init()` (for PIXI v8) and an explicit `.render()`. This makes testing trivial and gives users control over timing.

8. **Error messages teach.** When the spec validator rejects input, the error should explain what was wrong and what a correct shape looks like. Same for any runtime error the library throws.

9. **Bundle size is a feature.** Every runtime dependency added gets justified in the PR description. The published bundle should target **<50KB gzipped** for the core + one chart.

10. **Tests are documentation.** Each public class/function has a co-located test file. Tests describe behavior in plain English (`it('cleans up ticker listeners on destroy')`), not implementation details.

## D3 imports

**Import D3 only as submodules — never the full `d3` package.** This is non-negotiable and is enforced by an ESLint `no-restricted-imports` rule:

```ts
// ✅ allowed
import { scaleLinear } from 'd3-scale';
import { line } from 'd3-shape';

// ❌ blocked at lint time
import { scaleLinear } from 'd3';
```

The full `d3` umbrella package re-exports every submodule and defeats tree-shaking.

## Development setup

Requirements: Node 20+, pnpm 9+.

```sh
git clone <repo>
cd pixi-charts
pnpm install
```

Common commands (run from the repo root):

```sh
pnpm test            # all package tests, single run
pnpm test:watch      # all package tests, watch mode
pnpm typecheck       # tsc --noEmit across the workspace
pnpm lint            # eslint
pnpm lint:fix        # eslint --fix
pnpm build           # tsup → dist/
pnpm format          # prettier --write
```

CI runs `lint → typecheck → test → build` on Node 20 and Node 22 for every PR. All four must pass before a PR can merge.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/). Commitlint enforces this on every commit via a Husky `commit-msg` hook.

```
<type>(<optional scope>): <subject>
```

Allowed `type`s: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `revert`.

Examples:

```
feat(line): add stepped interpolation mode
fix(animation): cancel ticker listener when chart destroyed mid-tween
perf(scatter): switch hit-testing to d3-quadtree
docs: clarify peer-dependency requirement in README
```

## Changesets

Every PR that changes user-facing behavior of a published package must include a changeset. From the repo root:

```sh
pnpm changeset
```

Pick the affected packages, choose `patch` / `minor` / `major`, and write a short, user-facing summary in the imperative mood. The summary becomes a CHANGELOG entry.

PRs that are docs-only, internal refactors with no API change, or test-only do not need a changeset.

## Pull request checklist

- [ ] Tests added or updated.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass locally.
- [ ] A changeset was added (if user-facing).
- [ ] Any new runtime dependency is justified in the PR description.
- [ ] Commit messages follow Conventional Commits.

## File-level conventions

- **Tests** live alongside `src/` in a sibling `tests/` directory, mirroring the source tree (`src/core/Chart.ts` ↔ `tests/core/Chart.test.ts`).
- **Public surface** — anything users should be able to import — flows through `packages/pixi-charts/src/index.ts`. If it isn't re-exported there, treat it as internal and refactor freely.
- **TypeScript** — strict mode plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. If you need a type assertion, prefer narrowing.
- **JSDoc** every public symbol. Internal symbols get a short comment only when the _why_ is non-obvious.

## Reporting issues

- Bugs → use the [Bug report](./.github/ISSUE_TEMPLATE/bug_report.md) template. Include the `ChartSpec` you used, the rendered output, and what you expected.
- Feature requests → use the [Feature request](./.github/ISSUE_TEMPLATE/feature_request.md) template.

## License

By contributing, you agree that your contributions will be licensed under the MIT License (see [`LICENSE`](./LICENSE)).
