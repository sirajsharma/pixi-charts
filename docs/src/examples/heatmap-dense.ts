import type { ChartSpec } from 'pixi-charts';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

/**
 * 24×7 grid of business activity by hour and day. A Gaussian bump centred
 * around 14:00 on weekdays, dampened on the weekend, with modest noise.
 * Same data shape used in packages/pixi-charts/dev/heatmap.js so the docs
 * page and the dev harness stay visually consistent.
 */
function activityCount(hourIdx: number, day: string): number {
  const isWeekend = day === 'Sat' || day === 'Sun';
  const peak = 14;
  const sigma = 4;
  const z = (hourIdx - peak) / sigma;
  const gauss = Math.exp(-0.5 * z * z);
  const base = (isWeekend ? 25 : 100) * gauss;
  const noise = (Math.random() - 0.5) * 8;
  return Math.max(0, Math.round(base + noise));
}

function makeBusinessActivity(): { hour: string; day: string; count: number }[] {
  const data: { hour: string; day: string; count: number }[] = [];
  for (const day of DAYS) {
    for (let h = 0; h < HOURS.length; h += 1) {
      data.push({ hour: HOURS[h], day, count: activityCount(h, day) });
    }
  }
  return data;
}

export const heatmapDenseSpec: ChartSpec = {
  type: 'heatmap',
  data: makeBusinessActivity(),
  encoding: {
    x: { field: 'hour', type: 'categorical' },
    y: { field: 'day', type: 'categorical' },
    color: { field: 'count', type: 'quantitative', scheme: 'viridis' },
    value: { field: 'count' },
  },
};
