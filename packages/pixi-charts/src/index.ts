/**
 * `pixi-charts` — public entry point.
 *
 * Only named re-exports from this file. Internals (primitives like Axis,
 * Legend, Tooltip, InteractionLayer, ColorScheme, ScaleAdapter, the
 * animation helpers, and the LTTB downsampler) remain internal and can be
 * refactored freely. We can promote them to the public surface later if
 * there's demand — keeping it small now preserves freedom.
 */

// --- Spec API (primary entry point for most consumers) ---
export { render } from './spec/render.js';
export { validateChartSpec, ChartSpecValidationError } from './spec/validate.js';
export type {
  ChartSpec,
  ChartType,
  ChartEncoding,
  EncodingField,
  ColorEncoding,
  ChartOptions,
  AnimationOptions,
  FieldType,
} from './spec/ChartSpec.js';

// --- Imperative API (escape hatch for advanced consumers) ---
export { Chart } from './core/Chart.js';
export { LineChart } from './charts/LineChart.js';
export { AreaChart } from './charts/AreaChart.js';
