import { AreaChart } from '../charts/AreaChart.js';
import { BarChart } from '../charts/BarChart.js';
import { HeatmapChart } from '../charts/HeatmapChart.js';
import { LineChart } from '../charts/LineChart.js';
import { PieChart } from '../charts/PieChart.js';
import { ScatterChart } from '../charts/ScatterChart.js';
import type { Chart } from '../core/Chart.js';

import type { ChartSpec } from './ChartSpec.js';
import { validateChartSpec } from './validate.js';

/**
 * Render a declarative chart spec into a DOM container.
 *
 * This is the primary entry point of `pixi-charts`. The spec is validated
 * up-front (throws {@link import('./validate.js').ChartSpecValidationError}
 * with teaching messages on bad input), then dispatched on `spec.type` to
 * the concrete chart implementation. The returned {@link Chart} has been
 * constructed AND fully initialized (PIXI Application up, first render
 * complete) — consumers receive a working chart, not a half-built one.
 *
 * The container's existing children are NOT cleared — the consumer is
 * responsible for managing the parent element. The PIXI canvas is
 * appended as a new child.
 *
 * **Why this returns a Promise.** PIXI v8 requires `await app.init(...)`;
 * a synchronous return would force the dispatcher to either skip init
 * (handing back a half-rendered chart) or to block on it (impossible in
 * a browser). Awaiting is the honest signature.
 *
 * **Why this returns `Chart` not `LineChart`.** Future dispatch targets
 * will return their own subclasses; the union is `Chart`. Consumers who
 * need a specific subclass can use the imperative API (`new LineChart`
 * etc.) re-exported from the package root.
 *
 * @example
 * ```ts
 * import { render } from 'pixi-charts';
 *
 * const chart = await render(
 *   {
 *     type: 'line',
 *     data: rows,
 *     encoding: {
 *       x: { field: 'date', type: 'temporal' },
 *       y: { field: 'revenue', type: 'quantitative' },
 *     },
 *   },
 *   document.getElementById('chart')!,
 * );
 *
 * // Later, when tearing down:
 * chart.destroy();
 * ```
 *
 * @throws {ChartSpecValidationError} If `spec` fails validation.
 */
export async function render(spec: ChartSpec, container: HTMLElement): Promise<Chart> {
  const validated = validateChartSpec(spec);

  switch (validated.type) {
    case 'line': {
      const chart = new LineChart({ container, spec: validated });
      await chart.init();
      return chart;
    }
    case 'area': {
      const chart = new AreaChart({ container, spec: validated });
      await chart.init();
      return chart;
    }
    case 'bar': {
      const chart = new BarChart({ container, spec: validated });
      await chart.init();
      return chart;
    }
    case 'scatter': {
      const chart = new ScatterChart({ container, spec: validated });
      await chart.init();
      return chart;
    }
    case 'heatmap': {
      const chart = new HeatmapChart({ container, spec: validated });
      await chart.init();
      return chart;
    }
    case 'pie': {
      const chart = new PieChart({ container, spec: validated });
      await chart.init();
      return chart;
    }
    default: {
      // Exhaustiveness check — adding a new ChartType without updating this
      // dispatcher becomes a compile-time error here.
      const _exhaustive: never = validated.type;
      throw new Error(`Unhandled chart type: ${String(_exhaustive)}`);
    }
  }
}
