import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { render, type Chart, type ChartClickEvent, type ChartSpec, type Theme } from 'pixi-charts';
import { childrenOf, regions, type SalesRow } from '../examples/drilldown-sales';

interface PathEntry {
  /** Label rendered in the breadcrumb (e.g. "All regions", "United States"). */
  label: string;
  /** Bars shown at this level. */
  data: SalesRow[];
}

const INITIAL_PATH: PathEntry[] = [{ label: 'All regions', data: regions }];

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

export function DrilldownDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [path, setPath] = useState<PathEntry[]>(INITIAL_PATH);
  const [theme, setTheme] = useState<Theme>(() => readStarlightTheme());

  // Track the latest path in a ref so the async chart-create callback can
  // restore the drilled-into level if the chart was rebuilt mid-drill (e.g.
  // because the user toggled the theme).
  const pathRef = useRef(path);
  pathRef.current = path;

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

  // Initial spec — only the theme drives its identity. Drilldown swaps data
  // via `chart.update()`, not a new spec, so the WebGL context survives.
  const initialSpec = useMemo<ChartSpec>(
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

  // Create the chart on mount and rebuild it on theme change. After a
  // rebuild we re-apply the current drilldown level so the user doesn't
  // see the chart snap back to "All regions".
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let off: (() => void) | null = null;

    render(initialSpec, containerRef.current)
      .then((chart) => {
        if (cancelled) {
          chart.destroy();
          return;
        }
        chartRef.current = chart;

        off = chart.on('click', (event: ChartClickEvent) => {
          const row = event.datum as SalesRow;
          const next = childrenOf(row);
          if (next === null) return; // leaf — nothing to drill into
          setPath((prev) => [...prev, { label: row.label, data: next }]);
        });

        // If we rebuilt mid-drill (theme toggle), restore the current data.
        const currentTop = pathRef.current[pathRef.current.length - 1];
        if (currentTop.data !== regions) {
          chart.update(currentTop.data);
        }
      })
      .catch((err: unknown) => {
        // Demo: surface the failure during local dev.
        console.error('DrilldownDemo render failed', err);
      });

    return () => {
      cancelled = true;
      off?.();
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [initialSpec]);

  // Apply drilldown updates by swapping data on the existing chart — no
  // teardown, no canvas re-mount. This is what makes the drill feel instant.
  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chart) return; // first mount: the chart hasn't resolved yet
    chart.update(path[path.length - 1].data);
  }, [path]);

  const currentLabel = path[path.length - 1].label;
  const isLeaf = path.length === 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <Breadcrumb
        path={path}
        onJump={(i) => {
          setPath((prev) => prev.slice(0, i + 1));
        }}
      />
      <div
        role="img"
        aria-label={`Sales by ${currentLabel}`}
        style={{
          position: 'relative',
          width: '100%',
          height: 400,
          borderRadius: '0.5rem',
          overflow: 'hidden',
          background: 'var(--sl-color-bg-nav, #0d1117)',
        }}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
      <p
        style={{
          margin: 0,
          fontSize: '0.8125rem',
          color: 'var(--sl-color-gray-3, #9aa4b2)',
        }}
      >
        {isLeaf
          ? 'You’re at a city — the deepest level. Click a breadcrumb above to drill back out.'
          : 'Click a bar to drill into the next level. The chart updates in place; the WebGL context is reused.'}
      </p>
    </div>
  );
}

interface BreadcrumbProps {
  path: PathEntry[];
  onJump: (index: number) => void;
}

function Breadcrumb({ path, onJump }: BreadcrumbProps) {
  return (
    <nav aria-label="Drilldown breadcrumb">
      <ol
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.25rem',
          margin: 0,
          padding: 0,
          listStyle: 'none',
          fontSize: '0.875rem',
        }}
      >
        {path.map((entry, i) => {
          const isCurrent = i === path.length - 1;
          return (
            <li
              key={`${String(i)}-${entry.label}`}
              // margin:0 resets Starlight's markdown-content block margins that
              // otherwise stretch the row and knock the crumbs out of alignment.
              style={{ display: 'flex', alignItems: 'center', margin: 0 }}
            >
              {i > 0 && (
                <span
                  aria-hidden="true"
                  style={{ margin: '0 0.4rem', color: 'var(--sl-color-gray-3, #9aa4b2)' }}
                >
                  ›
                </span>
              )}
              {isCurrent ? (
                <span aria-current="page" style={{ fontWeight: 600 }}>
                  {entry.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onJump(i);
                  }}
                  style={{
                    appearance: 'none',
                    background: 'transparent',
                    border: 'none',
                    margin: 0,
                    padding: '0.15rem 0.35rem',
                    borderRadius: '0.25rem',
                    color: 'var(--sl-color-text-accent, inherit)',
                    cursor: 'pointer',
                    font: 'inherit',
                    textDecoration: 'underline',
                  }}
                >
                  {entry.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
