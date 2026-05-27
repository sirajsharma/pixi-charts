import type { ChartSpec } from 'pixi-charts';

/**
 * Top eight SaaS products by quarterly revenue. The product names are long
 * enough that vertical orientation would crowd the x-axis labels; horizontal
 * lets each label sit on its own row.
 */
function makeProductRevenue(): { product: string; quarterly_revenue_usd: number }[] {
  return [
    { product: 'Customer Success Platform', quarterly_revenue_usd: 4_820_000 },
    { product: 'Marketing Automation Suite', quarterly_revenue_usd: 4_310_000 },
    { product: 'Identity & Access Manager', quarterly_revenue_usd: 3_950_000 },
    { product: 'Observability Cloud', quarterly_revenue_usd: 3_410_000 },
    { product: 'Workflow Orchestrator', quarterly_revenue_usd: 2_870_000 },
    { product: 'Data Lineage Tracker', quarterly_revenue_usd: 2_290_000 },
    { product: 'Field Service Console', quarterly_revenue_usd: 1_640_000 },
    { product: 'Compliance Reporter', quarterly_revenue_usd: 1_180_000 },
  ];
}

export const barHorizontalSpec: ChartSpec = {
  type: 'bar',
  data: makeProductRevenue(),
  encoding: {
    x: { field: 'quarterly_revenue_usd', type: 'quantitative' },
    y: { field: 'product', type: 'categorical' },
  },
  options: {
    orientation: 'horizontal',
  },
};
