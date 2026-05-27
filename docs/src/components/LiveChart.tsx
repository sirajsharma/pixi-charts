import { useLayoutEffect, useRef, useState } from 'react';
import { render, type ChartSpec, type Chart } from 'pixi-charts';

interface Props {
  spec: ChartSpec;
  height?: number;
  className?: string;
  ariaLabel?: string;
  /**
   * Fired once the first render completes successfully. `durationMs` is wall
   * time from the `render(spec, container)` call to the resolved chart
   * instance — used by the perf page to surface render time.
   */
  onReady?: (durationMs: number) => void;
}

export function LiveChart({ spec, height = 400, className, ariaLabel, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    const t0 = performance.now();
    render(spec, containerRef.current)
      .then((chart) => {
        if (cancelled) {
          chart.destroy();
          return;
        }
        chartRef.current = chart;
        setLoading(false);
        onReady?.(performance.now() - t0);
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
  }, [spec, onReady]);

  return (
    <div
      className={className}
      role="img"
      aria-label={ariaLabel ?? `${spec.type} chart`}
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: '0.5rem',
        overflow: 'hidden',
        background: 'var(--sl-color-bg-nav, #0d1117)',
      }}
    >
      {loading && !error && (
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
          Rendering…
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
}
