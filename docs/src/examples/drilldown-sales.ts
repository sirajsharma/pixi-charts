/**
 * Hierarchical sales dataset for the drilldown docs example.
 *
 * Every level uses the same row shape — `{ label, value, kind }` — so the
 * chart's encoding (`x: label, y: value`) is identical at every drill depth.
 * `chart.update(newData)` swaps the rows; the WebGL context, scales, and
 * axis chrome are reused. That reuse is what makes the drilldown feel
 * instant. The `kind` field is consumer-side metadata used by the demo to
 * resolve the next level via {@link childrenOf}.
 */
export interface SalesRow extends Record<string, unknown> {
  label: string;
  value: number;
  kind: 'region' | 'country' | 'city';
}

/** Top-level rows: revenue by world region, in millions of USD. */
export const regions: SalesRow[] = [
  { label: 'North America', value: 1850, kind: 'region' },
  { label: 'Europe', value: 1420, kind: 'region' },
  { label: 'Asia', value: 2100, kind: 'region' },
  { label: 'South America', value: 540, kind: 'region' },
];

const countriesByRegion: Record<string, SalesRow[]> = {
  'North America': [
    { label: 'United States', value: 1450, kind: 'country' },
    { label: 'Canada', value: 280, kind: 'country' },
    { label: 'Mexico', value: 120, kind: 'country' },
  ],
  Europe: [
    { label: 'United Kingdom', value: 420, kind: 'country' },
    { label: 'Germany', value: 380, kind: 'country' },
    { label: 'France', value: 320, kind: 'country' },
    { label: 'Spain', value: 300, kind: 'country' },
  ],
  Asia: [
    { label: 'Japan', value: 780, kind: 'country' },
    { label: 'India', value: 720, kind: 'country' },
    { label: 'Singapore', value: 600, kind: 'country' },
  ],
  'South America': [
    { label: 'Brazil', value: 360, kind: 'country' },
    { label: 'Argentina', value: 180, kind: 'country' },
  ],
};

const citiesByCountry: Record<string, SalesRow[]> = {
  'United States': [
    { label: 'New York', value: 580, kind: 'city' },
    { label: 'San Francisco', value: 420, kind: 'city' },
    { label: 'Chicago', value: 240, kind: 'city' },
    { label: 'Austin', value: 210, kind: 'city' },
  ],
  Canada: [
    { label: 'Toronto', value: 140, kind: 'city' },
    { label: 'Vancouver', value: 90, kind: 'city' },
    { label: 'Montréal', value: 50, kind: 'city' },
  ],
  Mexico: [
    { label: 'Mexico City', value: 80, kind: 'city' },
    { label: 'Guadalajara', value: 40, kind: 'city' },
  ],
  'United Kingdom': [
    { label: 'London', value: 290, kind: 'city' },
    { label: 'Manchester', value: 80, kind: 'city' },
    { label: 'Bristol', value: 50, kind: 'city' },
  ],
  Germany: [
    { label: 'Berlin', value: 170, kind: 'city' },
    { label: 'Munich', value: 130, kind: 'city' },
    { label: 'Hamburg', value: 80, kind: 'city' },
  ],
  France: [
    { label: 'Paris', value: 200, kind: 'city' },
    { label: 'Lyon', value: 70, kind: 'city' },
    { label: 'Marseille', value: 50, kind: 'city' },
  ],
  Spain: [
    { label: 'Madrid', value: 170, kind: 'city' },
    { label: 'Barcelona', value: 130, kind: 'city' },
  ],
  Japan: [
    { label: 'Tokyo', value: 470, kind: 'city' },
    { label: 'Osaka', value: 210, kind: 'city' },
    { label: 'Kyoto', value: 100, kind: 'city' },
  ],
  India: [
    { label: 'Mumbai', value: 320, kind: 'city' },
    { label: 'Bengaluru', value: 260, kind: 'city' },
    { label: 'Delhi', value: 140, kind: 'city' },
  ],
  Singapore: [{ label: 'Singapore', value: 600, kind: 'city' }],
  Brazil: [
    { label: 'São Paulo', value: 230, kind: 'city' },
    { label: 'Rio de Janeiro', value: 130, kind: 'city' },
  ],
  Argentina: [
    { label: 'Buenos Aires', value: 140, kind: 'city' },
    { label: 'Córdoba', value: 40, kind: 'city' },
  ],
};

/**
 * Return the next-level rows for a clicked row, or `null` if the row is a
 * leaf (a city in this dataset). The demo uses this to decide whether a
 * click should drill in or stay put.
 */
export function childrenOf(row: SalesRow): SalesRow[] | null {
  if (row.kind === 'region') return countriesByRegion[row.label] ?? null;
  if (row.kind === 'country') return citiesByCountry[row.label] ?? null;
  return null;
}
