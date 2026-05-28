import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { render, type ChartSpec, type Chart, type Theme } from 'pixi-charts';

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

/**
 * Read the current Starlight theme from `<html data-theme>`. Returns
 * `'dark'` for `'dark'`, `'light'` for `'light'`, and resolves `'auto'`
 * (or anything else / unset) against `prefers-color-scheme`. SSR-safe —
 * defaults to `'dark'` when `document` is unavailable so the docs site's
 * dark-by-default chrome stays consistent during hydration.
 */
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

export function LiveChart({ spec, height = 400, className, ariaLabel, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<Theme>(() => readStarlightTheme());

  // Track Starlight's theme toggle. The site sets `<html data-theme>` to
  // `'light'` / `'dark'` / `'auto'` on toggle; observe attribute changes
  // and re-render the chart so its chrome colors follow the toggle.
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

  // Inject the resolved theme into the spec. `useMemo` keeps the merged
  // object referentially stable for a given (spec, theme) pair so the
  // render effect below doesn't re-run unnecessarily.
  const themedSpec = useMemo<ChartSpec>(
    () => ({ ...spec, options: { ...spec.options, theme } }),
    [spec, theme],
  );

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    const t0 = performance.now();
    render(themedSpec, containerRef.current)
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
  }, [themedSpec, onReady]);

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
