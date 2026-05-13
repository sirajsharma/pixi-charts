/**
 * `pixi-charts` — public entry point.
 *
 * Only named re-exports from this file. Internals live under `src/core/` etc.
 * and should never be imported directly by users.
 */

export { Chart } from './core/Chart.js';
export type { ChartOptions } from './core/Chart.js';

export { tween, easings } from './core/animation.js';
export type { EasingName, TweenOptions } from './core/animation.js';
