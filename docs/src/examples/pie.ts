import type { ChartSpec } from 'pixi-charts';

/**
 * Browser market share, six slices. Numbers loosely match StatCounter
 * worldwide-desktop figures — realistic enough that the rendered pie reads
 * as a plausible market picture without claiming statistical fidelity.
 *
 * Re-exported as `browserShareData` so the donut variant can share the same
 * source array (slice geometry depends only on `data` and `value`).
 */
export const browserShareData: { browser: string; share_percent: number }[] = [
  { browser: 'Chrome', share_percent: 62 },
  { browser: 'Safari', share_percent: 18 },
  { browser: 'Edge', share_percent: 8 },
  { browser: 'Firefox', share_percent: 6 },
  { browser: 'Samsung Internet', share_percent: 3 },
  { browser: 'Other', share_percent: 3 },
];

export const pieSpec: ChartSpec = {
  type: 'pie',
  data: browserShareData,
  encoding: {
    x: { field: 'browser', type: 'categorical' },
    value: { field: 'share_percent' },
  },
  options: {
    showLegend: true,
  },
};
