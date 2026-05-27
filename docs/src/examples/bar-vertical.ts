import type { ChartSpec } from 'pixi-charts';

/**
 * Monthly active users across a fiscal year. Categorical x (month label),
 * quantitative y (user count). Single series — color is left unset so every
 * bar gets the default palette colour.
 */
function makeMonthlyActiveUsers(): { month: string; monthly_active_users: number }[] {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const baseline = [
    42_000, 41_500, 48_200, 55_800, 61_400, 68_900, 71_300, 73_500, 79_200, 84_600, 91_100, 96_400,
  ];
  return months.map((month, i) => ({
    month,
    monthly_active_users: baseline[i] ?? 0,
  }));
}

export const barVerticalSpec: ChartSpec = {
  type: 'bar',
  data: makeMonthlyActiveUsers(),
  encoding: {
    x: { field: 'month', type: 'categorical' },
    y: { field: 'monthly_active_users', type: 'quantitative' },
  },
};
