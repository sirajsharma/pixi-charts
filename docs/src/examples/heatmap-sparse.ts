import type { ChartSpec } from 'pixi-charts';
import { heatmapDenseSpec } from './heatmap-dense';

/**
 * Same 24×7 business-activity grid as `heatmap-dense`, with roughly 15% of
 * cells filtered out. Missing (x, y) pairs render as transparent cells; the
 * hit-test returns null over them so tooltips stay quiet.
 */
function makeSparseActivity(): readonly Record<string, unknown>[] {
  return heatmapDenseSpec.data.filter(() => Math.random() > 0.15);
}

export const heatmapSparseSpec: ChartSpec = {
  type: 'heatmap',
  data: makeSparseActivity(),
  encoding: heatmapDenseSpec.encoding,
};
