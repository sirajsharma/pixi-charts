import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChartJsStreamingScatter,
  type ChartJsStreamingScatterHandle,
} from './ChartJsStreamingScatter';
import { PerfStreamingChart, type PerfStreamingChartHandle } from './PerfStreamingChart';
import { StreamGenerator, type StreamPoint } from './streamGenerator';
import { useRollingMetrics } from './useStreamLoop';

const PRESETS = [
  { value: 1_000, label: '1k', large: false },
  { value: 5_000, label: '5k', large: false },
  { value: 10_000, label: '10k', large: false },
  { value: 50_000, label: '50k', large: true },
  { value: 100_000, label: '100k', large: true },
] as const;

const POINTS_PER_FRAME = 100;
const DEFAULT_WINDOW = 10_000;

type Library = 'pixi' | 'chartjs';

interface Measurement {
  fps: number;
  updateMs: number;
}

type MeasurementMap = Record<Library, Partial<Record<number, Measurement>>>;

function regenWindow(n: number): StreamPoint[] {
  const gen = new StreamGenerator({ seed: (Date.now() | 0) >>> 0 || 1 });
  return gen.nextBatch(n);
}

function libraryLabel(lib: Library): string {
  return lib === 'pixi' ? 'pixi-charts' : 'Chart.js';
}

export function PerfComparison() {
  const [library, setLibrary] = useState<Library>('pixi');
  const [windowSize, setWindowSize] = useState<number>(DEFAULT_WINDOW);
  const [streaming, setStreaming] = useState(true);
  const [lastMeasurements, setLastMeasurements] = useState<MeasurementMap>({
    pixi: {},
    chartjs: {},
  });

  const pixiRef = useRef<PerfStreamingChartHandle>(null);
  const cjsRef = useRef<ChartJsStreamingScatterHandle>(null);
  const metrics = useRollingMetrics();

  // Refs let the rAF loop and the persistence effect read the active state
  // without re-creating themselves every render — see comments at each use.
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;
  const libraryRef = useRef(library);
  libraryRef.current = library;
  const windowSizeRef = useRef(windowSize);
  windowSizeRef.current = windowSize;

  const initialData = useMemo<readonly StreamPoint[]>(() => regenWindow(windowSize), [windowSize]);

  // Snapshot every new throttled reading into the per-(library, windowSize)
  // map so the readout under the chart can report the other library's most
  // recent observed numbers. Reads library/windowSize through refs because
  // we don't want a chip swap to overwrite the new bucket with the stale
  // reading from the just-departed configuration. Guard on updateMs > 0 so
  // the post-reset {0, 60} default doesn't smash valid history.
  useEffect(() => {
    if (metrics.updateMs <= 0) return;
    const lib = libraryRef.current;
    const size = windowSizeRef.current;
    const sample: Measurement = { fps: metrics.fps, updateMs: metrics.updateMs };
    setLastMeasurements((prev) => ({
      ...prev,
      [lib]: { ...prev[lib], [size]: sample },
    }));
  }, [metrics.fps, metrics.updateMs]);

  // Reset the rolling metrics when swapping library or window size so the
  // overlay briefly shows "—" rather than the previous configuration's
  // residual mean bleeding into the new chart's first half-second.
  useEffect(() => {
    metricsRef.current.reset();
  }, [library, windowSize]);

  // Single rAF chain — only one chart is alive at a time, so loop coupling
  // (the bug the prior side-by-side version had) is structurally impossible.
  // The producer rAF maintains the rolling window; the consumer rAF reads
  // the active ref through libraryRef so a library toggle doesn't need to
  // restart the loop. The chart components mount/unmount under React's
  // commit phase: by the time the next consumer tick runs, the new ref is
  // populated (useLayoutEffect on the child runs synchronously after commit).
  useEffect(() => {
    if (!streaming) return undefined;

    const gen = new StreamGenerator({ seed: 1 });
    let currentWindow: readonly StreamPoint[] = initialData;

    let producerRaf = 0;
    const produce = () => {
      const batch = gen.nextBatch(POINTS_PER_FRAME);
      currentWindow = [...currentWindow.slice(POINTS_PER_FRAME), ...batch];
      producerRaf = requestAnimationFrame(produce);
    };
    producerRaf = requestAnimationFrame(produce);

    let consumerRaf = 0;
    const consume = () => {
      consumerRaf = requestAnimationFrame(consume);
      const ref = libraryRef.current === 'pixi' ? pixiRef.current : cjsRef.current;
      const ms = ref?.update(currentWindow);
      if (ms !== null && ms !== undefined) metricsRef.current.push(ms);
    };
    consumerRaf = requestAnimationFrame(consume);

    return () => {
      if (producerRaf !== 0) cancelAnimationFrame(producerRaf);
      if (consumerRaf !== 0) cancelAnimationFrame(consumerRaf);
    };
  }, [streaming, initialData]);

  const otherLibrary: Library = library === 'pixi' ? 'chartjs' : 'pixi';
  const otherMeasurement = lastMeasurements[otherLibrary][windowSize];
  const currentHasReading = metrics.updateMs > 0;
  const sizeLabel = windowSize.toLocaleString();

  return (
    <div className="perf-cmp">
      <div className="perf-stream-controls">
        <div className="perf-presets" role="group" aria-label="Library">
          <button
            type="button"
            className="perf-preset"
            aria-pressed={library === 'pixi'}
            onClick={() => {
              setLibrary('pixi');
            }}
          >
            pixi-charts
          </button>
          <button
            type="button"
            className="perf-preset"
            aria-pressed={library === 'chartjs'}
            onClick={() => {
              setLibrary('chartjs');
            }}
          >
            Chart.js
          </button>
        </div>
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
        </div>
      </div>

      <div className="perf-chart-wrap">
        {library === 'pixi' ? (
          <PerfStreamingChart
            ref={pixiRef}
            initialData={initialData}
            height={540}
            ariaLabel={`pixi-charts streaming scatter, ${sizeLabel} points`}
          />
        ) : (
          <ChartJsStreamingScatter
            ref={cjsRef}
            initialData={initialData}
            height={540}
            ariaLabel={`Chart.js streaming scatter, ${sizeLabel} points`}
          />
        )}
        <div className="perf-overlay" aria-live="polite">
          <span className="perf-overlay-fps">
            {currentHasReading ? metrics.fps.toFixed(1) : '—'} fps
          </span>
          <span className="perf-overlay-sep">·</span>
          <span>{currentHasReading ? `${metrics.updateMs.toFixed(1)} ms` : '— ms'}</span>
        </div>
      </div>

      <div className="perf-other-readout" aria-live="polite">
        {otherMeasurement ? (
          <>
            Last {libraryLabel(otherLibrary)} reading at {sizeLabel}:{' '}
            <strong>{otherMeasurement.fps.toFixed(1)} fps</strong>
            <span className="perf-overlay-sep"> · </span>
            {otherMeasurement.updateMs.toFixed(1)} ms/update
          </>
        ) : (
          <>
            No {libraryLabel(otherLibrary)} reading at {sizeLabel} yet — toggle to{' '}
            {libraryLabel(otherLibrary)} to capture one.
          </>
        )}
      </div>

      <p className="perf-cmp-fineprint">
        Each library runs alone — the prior side-by-side version coupled them through the main
        thread, dragging pixi-charts' visible cadence down to Chart.js's at large window sizes.
        Toggle between libraries to see each one's true throughput at the same window size; the
        readout above shows the other library's most recent measurement at that size. The overlay
        reports throughput (1000 ÷ mean update time) and the per-update wall time.
      </p>
    </div>
  );
}
