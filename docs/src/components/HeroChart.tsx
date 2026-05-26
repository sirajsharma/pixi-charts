import { useMemo } from 'react';
import type { ChartSpec } from 'pixi-charts';
import { LiveChart } from './LiveChart';
import { makeHeroSpec } from '../examples/hero-spec';

interface HeroChartProps {
  height?: number;
  pointCount?: number;
}

/**
 * Landing-page hero scatter: 10k Gaussian-cluster points with viridis
 * density encoding.
 *
 * The spec is built inside this client-only component so the 10k data
 * array never crosses the SSR/island boundary as a serialized prop.
 */
export function HeroChart({ height = 460, pointCount = 10_000 }: HeroChartProps) {
  const spec = useMemo<ChartSpec>(() => makeHeroSpec(pointCount), [pointCount]);
  return (
    <LiveChart
      spec={spec}
      height={height}
      ariaLabel="10,000-point scatter plot demonstrating density-based viridis color encoding"
    />
  );
}
