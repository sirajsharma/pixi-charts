import { useCallback, useMemo, useState } from 'react';
import type { ChartSpec } from 'pixi-charts';
import { LiveChart } from '../LiveChart';
import { makePerfScatterSpec } from '../../examples/perf-scatter';
import { useFpsCounter } from './useFpsCounter';

const PRESETS = [1_000, 10_000, 100_000, 500_000] as const;
type Preset = (typeof PRESETS)[number];

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
};

export function PerfHero() {
  const [points, setPoints] = useState<Preset>(10_000);
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const fps = useFpsCounter();

  const spec = useMemo<ChartSpec>(() => makePerfScatterSpec(points), [points]);

  const handleReady = useCallback((durationMs: number) => {
    setRenderMs(durationMs);
  }, []);

  const handlePreset = (n: Preset) => {
    if (n === points) return;
    setRenderMs(null);
    setPoints(n);
  };

  return (
    <div className="perf-hero">
      <div className="perf-presets" role="group" aria-label="Point count">
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            className="perf-preset"
            aria-pressed={n === points}
            onClick={() => {
              handlePreset(n);
            }}
          >
            {formatCount(n)}
          </button>
        ))}
      </div>
      <div className="perf-chart-wrap">
        <LiveChart
          key={points}
          spec={spec}
          height={600}
          ariaLabel={`Scatter plot of ${points.toLocaleString()} uniform-random points`}
          onReady={handleReady}
        />
        <div className="perf-overlay" aria-live="polite">
          <span className="perf-overlay-fps">{fps} fps</span>
          <span className="perf-overlay-sep">·</span>
          <span className="perf-overlay-rt">
            {renderMs === null ? '— ms' : `${renderMs.toFixed(0)} ms`}
          </span>
        </div>
      </div>
      <p className="perf-note">
        Performance depends on your device&apos;s GPU. Try the presets to see how your hardware
        handles different point counts — the FPS counter shows the truth, whatever it is.
      </p>
    </div>
  );
}
