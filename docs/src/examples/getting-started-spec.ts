import type { ChartSpec } from 'pixi-charts';

/**
 * The smallest useful chart: monthly revenue across a year.
 *
 * Kept intentionally tiny so the "first chart" example fits on one screen
 * and consumers can grok the full spec shape in a single glance.
 */
export const gettingStartedSpec: ChartSpec = {
  type: 'line',
  data: [
    { month: 'Jan', revenue: 12_400 },
    { month: 'Feb', revenue: 13_900 },
    { month: 'Mar', revenue: 15_200 },
    { month: 'Apr', revenue: 14_600 },
    { month: 'May', revenue: 17_300 },
    { month: 'Jun', revenue: 19_800 },
    { month: 'Jul', revenue: 21_100 },
    { month: 'Aug', revenue: 20_400 },
    { month: 'Sep', revenue: 22_700 },
    { month: 'Oct', revenue: 24_000 },
    { month: 'Nov', revenue: 25_900 },
    { month: 'Dec', revenue: 27_300 },
  ],
  encoding: {
    x: { field: 'month', type: 'categorical' },
    y: { field: 'revenue', type: 'quantitative' },
  },
};
