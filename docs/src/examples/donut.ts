import type { ChartSpec } from 'pixi-charts';
import { browserShareData } from './pie';

/**
 * Same browser market-share data as `pie.ts`, rendered as a donut. The
 * `innerRadius` carves space in the middle — typical use is overlaying a
 * central value (total, average, key metric) on top of the chart with
 * absolute positioning in the host layout.
 */
export const donutSpec: ChartSpec = {
  type: 'pie',
  data: browserShareData,
  encoding: {
    x: { field: 'browser', type: 'categorical' },
    value: { field: 'share_percent' },
  },
  options: {
    showLegend: true,
    innerRadius: 80,
  },
};
