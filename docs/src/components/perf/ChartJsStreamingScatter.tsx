import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { Chart as ChartJs, LinearScale, PointElement, ScatterController } from 'chart.js';
import { interpolatePlasmaRgba } from './plasma';
import type { StreamPoint } from './streamGenerator';

ChartJs.register(ScatterController, PointElement, LinearScale);

const ALPHA = 0.4;
const POINT_RADIUS = 1.5;
const X_MIN = -100;
const X_RANGE = 200;

function computeColors(data: readonly StreamPoint[]): string[] {
  const out = new Array<string>(data.length);
  for (let i = 0; i < data.length; i += 1) {
    out[i] = interpolatePlasmaRgba((data[i].x - X_MIN) / X_RANGE, ALPHA);
  }
  return out;
}

interface Props {
  /** Initial window — also drives identity-based re-mount on size change. */
  initialData: readonly StreamPoint[];
  height?: number;
  ariaLabel?: string;
}

export interface ChartJsStreamingScatterHandle {
  /**
   * Push a new window of data and update the Chart.js instance with no
   * animation. Returns elapsed wall time of the `chart.update('none')`
   * call in ms, or `null` if the chart isn't ready yet.
   */
  update(window: readonly StreamPoint[]): number | null;
}

/**
 * Chart.js scatter wrapper with the same imperative `update()` ref shape
 * as {@link import('./PerfStreamingChart').PerfStreamingChart}. The parent's
 * rAF loop calls both refs back-to-back with the same window and times
 * each independently so the comparison is apples-to-apples.
 *
 * Configuration matches pixi-charts as closely as possible: animations
 * off, tooltips off, legend off, axes hidden, single solid color, small
 * point radius. The fixed `[-100, 100]` scale matches the natural extent
 * of the streaming generator's reflected random walk.
 */
export const ChartJsStreamingScatter = forwardRef<ChartJsStreamingScatterHandle, Props>(
  function ChartJsStreamingScatter(
    { initialData, height = 500, ariaLabel = 'Chart.js scatter stream' },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<ChartJs<'scatter'> | null>(null);

    useLayoutEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const chart = new ChartJs(ctx, {
        type: 'scatter',
        data: {
          datasets: [
            {
              data: [...initialData],
              pointRadius: POINT_RADIUS,
              pointBackgroundColor: computeColors(initialData),
              pointBorderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            tooltip: { enabled: false },
            legend: { display: false },
          },
          scales: {
            x: { display: false, min: -100, max: 100 },
            y: { display: false, min: -100, max: 100 },
          },
        },
      });
      chartRef.current = chart;

      return () => {
        chart.destroy();
        chartRef.current = null;
      };
    }, [initialData]);

    useImperativeHandle(
      ref,
      () => ({
        update(window) {
          const chart = chartRef.current;
          if (!chart) return null;
          const t0 = performance.now();
          const ds = chart.data.datasets[0];
          ds.data = window as { x: number; y: number }[];
          ds.pointBackgroundColor = computeColors(window);
          chart.update('none');
          return performance.now() - t0;
        },
      }),
      [],
    );

    return (
      <div
        role="img"
        aria-label={ariaLabel}
        style={{
          position: 'relative',
          width: '100%',
          height,
          borderRadius: '0.5rem',
          overflow: 'hidden',
          background: 'var(--sl-color-bg-nav, #0d1117)',
        }}
      >
        <canvas ref={canvasRef} />
      </div>
    );
  },
);
