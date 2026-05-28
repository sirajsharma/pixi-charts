import type { ChartSpec } from 'pixi-charts';

import { gettingStartedSpec } from './getting-started-spec.js';

/**
 * Same data as `gettingStartedSpec`, rendered as a bar chart. Used in the
 * "Switching chart types" section of Getting Started to make the
 * one-spec-shape-fits-all point viscerally: change `type`, render again.
 */
export const gettingStartedBarSpec: ChartSpec = {
  ...gettingStartedSpec,
  type: 'bar',
};
