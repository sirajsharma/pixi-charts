import { useLayoutEffect, useRef } from 'react';
import {
  Chart as ChartJs,
  ScatterController,
  PointElement,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import type { PerfPoint } from '../../examples/perf-scatter';

ChartJs.register(ScatterController, PointElement, LinearScale, Tooltip, Legend);

interface Props {
  data: readonly PerfPoint[];
  height?: number;
  ariaLabel?: string;
  /**
   * Fired once the first draw completes — wall time around the `new Chart()`
   * call and its synchronous initial render.
   */
  onReady?: (durationMs: number) => void;
}

/**
 * Chart.js scatter wrapper for the side-by-side comparison. Animations,
 * tooltips, legend, and axes are all disabled so the comparison measures
 * raw render speed against pixi-charts' equivalent stripped-down config.
 */
export function ChartJsScatter({ data, height = 400, ariaLabel, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const t0 = performance.now();
    const chart = new ChartJs(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            data: data as PerfPoint[],
            pointRadius: 2,
            pointBackgroundColor: 'rgba(100, 180, 240, 0.55)',
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
          x: { display: false, min: 0, max: 100 },
          y: { display: false, min: 0, max: 100 },
        },
      },
    });
    onReady?.(performance.now() - t0);

    return () => {
      chart.destroy();
    };
  }, [data, onReady]);

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? 'Chart.js scatter plot'}
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
}
