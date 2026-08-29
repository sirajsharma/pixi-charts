import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { render, type Chart, type ChartClickEvent, type ChartSpec, type Theme } from 'pixi-charts';
import { regions, type SalesRow } from '../examples/drilldown-sales';

/**
 * Read the current Starlight theme — same logic as `LiveChart.tsx`. Kept
 * inline so this component stays self-contained for the docs example.
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

/**
 * Simplest possible demonstration of the click API: one chart, one
 * handler, no `update()`, no navigation. Click a bar, see what you clicked.
 */
export function ClickBasicDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [clicked, setClicked] = useState<SalesRow | null>(null);
  const [theme, setTheme] = useState<Theme>(() => readStarlightTheme());

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

  const spec = useMemo<ChartSpec>(
    () => ({
      type: 'bar',
      data: regions,
      encoding: {
        x: { field: 'label', type: 'categorical' },
        y: { field: 'value', type: 'quantitative' },
      },
      options: { theme, showTooltip: true },
      animation: { enter: false },
    }),
    [theme],
  );

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let off: (() => void) | null = null;

    render(spec, containerRef.current)
      .then((chart) => {
        if (cancelled) {
          chart.destroy();
          return;
        }
        chartRef.current = chart;
        off = chart.on('click', (event: ChartClickEvent) => {
          setClicked(event.datum as SalesRow);
        });
      })
      .catch((err: unknown) => {
        console.error('ClickBasicDemo render failed', err);
      });

    return () => {
      cancelled = true;
      off?.();
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [spec]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div
        role="img"
        aria-label="Sales by region"
        style={{
          position: 'relative',
          width: '100%',
          height: 360,
          borderRadius: '0.5rem',
          overflow: 'hidden',
          background: 'var(--sl-color-bg-nav, #0d1117)',
        }}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
      <p style={{ margin: 0, fontSize: '0.875rem' }}>
        {clicked === null
          ? 'Click a bar to see its datum here.'
          : `Clicked: ${clicked.label} — ${String(clicked.value)}`}
      </p>
    </div>
  );
}
