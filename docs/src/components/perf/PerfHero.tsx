import { useCallback, useMemo, useRef, useState } from 'react';
import { PerfStreamingChart, type PerfStreamingChartHandle } from './PerfStreamingChart';
import { StreamGenerator, type StreamPoint } from './streamGenerator';
import { useRollingMetrics, useStreamLoop } from './useStreamLoop';

const PRESETS = [
  { value: 1_000, label: '1k', large: false },
  { value: 5_000, label: '5k', large: false },
  { value: 10_000, label: '10k', large: false },
  { value: 50_000, label: '50k', large: true },
  { value: 100_000, label: '100k', large: true },
] as const;

const POINTS_PER_FRAME = 100;
const DEFAULT_WINDOW = 10_000;

/**
 * One-off generator used by the Regenerate button so it doesn't disturb
 * the stream-loop's PRNG state. Seeded from current time so successive
 * clicks give different windows.
 */
function regenWindow(n: number): StreamPoint[] {
  const gen = new StreamGenerator({ seed: (Date.now() | 0) >>> 0 || 1 });
  return gen.nextBatch(n);
}

export function PerfHero() {
  const [windowSize, setWindowSize] = useState<number>(DEFAULT_WINDOW);
  const [streaming, setStreaming] = useState(true);
  const chartRef = useRef<PerfStreamingChartHandle>(null);
  const metrics = useRollingMetrics();

  // Fresh initial window every time the size changes. Identity change here
  // forces PerfStreamingChart to tear down and recreate its chart with the
  // new point count.
  const initialData = useMemo<readonly StreamPoint[]>(() => regenWindow(windowSize), [windowSize]);

  const handleTick = useCallback(
    (window: readonly StreamPoint[]) => {
      const ms = chartRef.current?.update(window);
      if (ms !== null && ms !== undefined) metrics.push(ms);
    },
    [metrics],
  );

  useStreamLoop({
    running: streaming,
    windowSize,
    pointsPerFrame: POINTS_PER_FRAME,
    onTick: handleTick,
  });

  const handleRegenerate = useCallback(() => {
    const ms = chartRef.current?.update(regenWindow(windowSize));
    if (ms !== null && ms !== undefined) metrics.push(ms);
  }, [windowSize, metrics]);

  return (
    <div className="perf-hero">
      <div className="perf-stream-controls">
        <div className="perf-presets" role="group" aria-label="Window size">
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className="perf-preset"
              data-large={preset.large ? 'true' : undefined}
              aria-pressed={windowSize === preset.value}
              onClick={() => {
                setWindowSize(preset.value);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="perf-stream-actions">
          <button
            type="button"
            className="perf-preset"
            aria-pressed={streaming}
            onClick={() => {
              setStreaming((s) => !s);
            }}
          >
            {streaming ? '■ Stop' : '▶ Stream'}
          </button>
          <button
            type="button"
            className="perf-preset"
            onClick={handleRegenerate}
            aria-label="Regenerate window with fresh data"
          >
            ↻ Regenerate
          </button>
        </div>
      </div>

      <div className="perf-chart-wrap">
        <PerfStreamingChart
          ref={chartRef}
          initialData={initialData}
          height={500}
          ariaLabel="Streaming scatter chart rendered with pixi-charts"
        />
        <div className="perf-overlay" aria-live="polite">
          <span className="perf-overlay-fps">{metrics.fps.toFixed(1)} fps</span>
          <span className="perf-overlay-sep">·</span>
          <span>{metrics.updateMs.toFixed(1)} ms / update</span>
        </div>
      </div>

      <p className="perf-note">
        Streaming {POINTS_PER_FRAME} points / frame. Window: {windowSize.toLocaleString()} points.
        Numbers reflect your hardware — yours, not ours.
      </p>
    </div>
  );
}
