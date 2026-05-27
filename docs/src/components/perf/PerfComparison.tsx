import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ChartSpec } from 'pixi-charts';
import { LiveChart } from '../LiveChart';
import { ChartJsScatter } from './ChartJsScatter';
import { makePerfData, makePerfScatterSpec, type PerfPoint } from '../../examples/perf-scatter';
import { useFpsCounter } from './useFpsCounter';

const STEPS = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000] as const;

const formatCount = (n: number): string => (n >= 1_000 ? `${(n / 1_000).toFixed(0)}k` : String(n));

export function PerfComparison() {
  const [stepIndex, setStepIndex] = useState(2); // default to 10k
  const [debouncedIndex, setDebouncedIndex] = useState(2);
  const [pixiRenderMs, setPixiRenderMs] = useState<number | null>(null);
  const [chartJsRenderMs, setChartJsRenderMs] = useState<number | null>(null);
  const fps = useFpsCounter();

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedIndex(stepIndex);
    }, 150);
    return () => {
      window.clearTimeout(t);
    };
  }, [stepIndex]);

  const points = STEPS[debouncedIndex] ?? 10_000;

  // Single dataset shared between both libraries — fairness invariant.
  const data: readonly PerfPoint[] = useMemo(() => makePerfData(points), [points]);
  const spec: ChartSpec = useMemo(() => makePerfScatterSpec(points, data), [points, data]);

  const handlePixiReady = useCallback((ms: number) => {
    setPixiRenderMs(ms);
  }, []);
  const handleChartJsReady = useCallback((ms: number) => {
    setChartJsRenderMs(ms);
  }, []);

  return (
    <div className="perf-cmp">
      <div className="perf-cmp-controls">
        <label htmlFor="perf-cmp-slider" className="perf-cmp-label">
          Points: <span className="perf-cmp-count">{formatCount(points)}</span>
        </label>
        <input
          id="perf-cmp-slider"
          type="range"
          min={0}
          max={STEPS.length - 1}
          step={1}
          value={stepIndex}
          onChange={(e) => {
            setStepIndex(Number(e.target.value));
          }}
          aria-valuetext={`${formatCount(points)} points`}
        />
        <div className="perf-cmp-ticks" aria-hidden="true">
          {STEPS.map((n) => (
            <span key={n}>{formatCount(n)}</span>
          ))}
        </div>
      </div>

      <div className="perf-cmp-grid">
        <div className="perf-cmp-col">
          <div className="perf-cmp-col-head">
            <span className="perf-cmp-col-title">pixi-charts</span>
            <span className="perf-cmp-col-tag perf-cmp-tag-good">WebGL</span>
          </div>
          <LiveChart
            key={`pixi-${String(points)}`}
            spec={spec}
            height={420}
            ariaLabel={`pixi-charts scatter plot of ${points.toLocaleString()} points`}
            onReady={handlePixiReady}
          />
          <div className="perf-cmp-stats">
            <span>{fps} fps</span>
            <span className="perf-overlay-sep">·</span>
            <span>render {pixiRenderMs === null ? '—' : pixiRenderMs.toFixed(0)} ms</span>
          </div>
        </div>

        <div className="perf-cmp-col">
          <div className="perf-cmp-col-head">
            <span className="perf-cmp-col-title">Chart.js</span>
            <span className="perf-cmp-col-tag">Canvas</span>
          </div>
          <ChartJsScatter
            key={`cjs-${String(points)}`}
            data={data}
            height={420}
            ariaLabel={`Chart.js scatter plot of ${points.toLocaleString()} points`}
            onReady={handleChartJsReady}
          />
          <div className="perf-cmp-stats">
            <span>{fps} fps</span>
            <span className="perf-overlay-sep">·</span>
            <span>render {chartJsRenderMs === null ? '—' : chartJsRenderMs.toFixed(0)} ms</span>
          </div>
        </div>
      </div>

      <p className="perf-cmp-fineprint">
        Both charts render the same dataset, drawn from a uniform-random distribution. Animations,
        tooltips, axes, and legends are disabled on both libraries so the comparison reflects raw
        render speed. FPS is page-wide — both charts share the same frame budget — so the per-chart
        differentiator at high point counts is the render-time number.
      </p>
    </div>
  );
}
