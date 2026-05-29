import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { render, type Chart, type ChartSpec, type Theme } from 'pixi-charts';
import type { StreamPoint } from './streamGenerator';

interface Props {
  /**
   * Initial point count. Used to seed the first render with `initialData`
   * shaped like the streaming window. The parent feeds subsequent windows
   * through the imperative `update()` ref.
   */
  initialData: readonly StreamPoint[];
  /** Container pixel height. */
  height?: number;
  ariaLabel?: string;
  /**
   * Build the chart spec from the current data + theme. Defaults to the
   * perf-page's `makeStreamingSpec` (plasma by x, no chrome, point r=1.5,
   * alpha 0.4). The landing-page hero overrides this to tune point size,
   * alpha, or color encoding for the background-motion use case.
   */
  specBuilder?: (data: readonly StreamPoint[], theme: Theme) => ChartSpec;
  /**
   * Show the "Booting WebGL…" placeholder during the ~400ms cold start.
   * Defaults to true (perf-page demo). The hero sets this to false so the
   * placeholder text doesn't bleed through its gradient overlay.
   */
  showPlaceholder?: boolean;
}

export interface PerfStreamingChartHandle {
  /**
   * Synchronously push a new window of data into the chart. Returns the
   * elapsed wall time of the underlying `chart.update()` call in ms, or
   * `null` if the chart isn't ready yet (still booting GL).
   */
  update(window: readonly StreamPoint[]): number | null;
}

function readStarlightTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  const attr = document.documentElement.dataset.theme;
  if (attr === 'light') return 'light';
  if (attr === 'dark') return 'dark';
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function makeStreamingSpec(data: readonly StreamPoint[], theme: Theme): ChartSpec {
  return {
    type: 'scatter',
    data: data as readonly Record<string, unknown>[],
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      // Plasma gradient by x-position so density/cluster structure is
      // visible. Matched on the Chart.js side via per-point rgba.
      color: { field: 'x', type: 'quantitative', scheme: 'plasma' },
    },
    options: {
      showAxes: false,
      showGrid: false,
      showLegend: false,
      showTooltip: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      pointRadius: 1.5,
      pointAlpha: 0.4,
      theme,
    },
    animation: { enter: false },
  };
}

/**
 * pixi-charts scatter with an imperative `update()` ref. Used by the
 * streaming demo and the comparison: the parent's rAF loop calls
 * `ref.current.update(window)` per frame and times the call.
 *
 * Differs from `LiveChart` in that it does *not* re-render the chart when
 * the data changes — `update()` stays on the existing instance. The chart
 * is only torn down and recreated when `initialData.length` (window size)
 * or theme changes, since both affect static spec choices.
 */
export const PerfStreamingChart = forwardRef<PerfStreamingChartHandle, Props>(
  function PerfStreamingChart(
    {
      initialData,
      height = 500,
      ariaLabel = 'pixi-charts scatter stream',
      specBuilder = makeStreamingSpec,
      showPlaceholder = true,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<Chart | null>(null);
    const [theme, setTheme] = useState<Theme>(() => readStarlightTheme());
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Observe Starlight's <html data-theme> like LiveChart does, so the
    // chart re-renders with new chrome colors on toggle.
    useEffect(() => {
      if (typeof document === 'undefined') return;
      const root = document.documentElement;
      const observer = new MutationObserver(() => {
        setTheme(readStarlightTheme());
      });
      observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
      return () => {
        observer.disconnect();
      };
    }, []);

    // The chart instance is keyed by initialData (its identity reflects
    // window-size changes from the parent) and theme. Building the spec is
    // cheap; this memo just keeps the object stable per render.
    const spec = useMemo<ChartSpec>(
      () => specBuilder(initialData, theme),
      [initialData, theme, specBuilder],
    );

    useLayoutEffect(() => {
      if (!containerRef.current) return;
      let cancelled = false;
      setLoading(true);
      setError(null);

      render(spec, containerRef.current)
        .then((chart) => {
          if (cancelled) {
            chart.destroy();
            return;
          }
          chartRef.current = chart;
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const message = err instanceof Error ? err.message : 'Failed to render chart';
          setError(message);
          setLoading(false);
        });

      return () => {
        cancelled = true;
        chartRef.current?.destroy();
        chartRef.current = null;
      };
    }, [spec]);

    useImperativeHandle(
      ref,
      () => ({
        update(window) {
          const chart = chartRef.current;
          if (!chart) return null;
          const t0 = performance.now();
          chart.update(window as readonly Record<string, unknown>[]);
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
        {loading && !error && showPlaceholder && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--sl-color-text-accent, #888)',
              fontSize: '0.875rem',
              pointerEvents: 'none',
            }}
          >
            Booting WebGL…
          </div>
        )}
        {error && (
          <div
            role="alert"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              color: 'var(--sl-color-red, #f85149)',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}
          >
            Chart error: {error}
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    );
  },
);
