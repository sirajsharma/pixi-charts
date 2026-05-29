import { useCallback, useEffect, useRef, useState } from 'react';
import { render, type Chart, type ChartSpec, type Theme } from 'pixi-charts';
import { StreamGenerator, type StreamPoint } from './streamGenerator';

interface Measurement {
  coldMs: number;
  warmMs: number;
}

const SAMPLE_SIZE = 10_000;
const WARM_RUNS = 5;

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

function buildSpec(data: readonly StreamPoint[], theme: Theme): ChartSpec {
  return {
    type: 'scatter',
    data: data as readonly Record<string, unknown>[],
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
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

async function runMeasurement(container: HTMLElement): Promise<Measurement> {
  const theme = readStarlightTheme();
  const gen = new StreamGenerator({ seed: (Date.now() | 0) >>> 0 || 1 });
  const initial = gen.nextBatch(SAMPLE_SIZE);
  const coldT0 = performance.now();
  const chart: Chart = await render(buildSpec(initial, theme), container);
  const coldMs = performance.now() - coldT0;

  const warmSamples: number[] = [];
  for (let i = 0; i < WARM_RUNS; i += 1) {
    const next = gen.nextBatch(SAMPLE_SIZE) as readonly Record<string, unknown>[];
    const t0 = performance.now();
    chart.update(next);
    warmSamples.push(performance.now() - t0);
  }
  chart.destroy();
  warmSamples.sort((a, b) => a - b);
  const warmMs = warmSamples[Math.floor(warmSamples.length / 2)] ?? 0;

  return { coldMs, warmMs };
}

/**
 * Two-number breakout: cold start (one-time GL + shader compile) vs warm
 * update (per-frame data swap). Mounts a throwaway 10k-point chart in an
 * off-screen container, measures both, then disposes. The re-measure
 * button repeats so readers can see fresh numbers from their own GPU.
 *
 * Honest framing: the cold-start cost is real but paid once per chart.
 * Streaming smoothness is determined by the warm-update number, which
 * should match what the headline streaming demo reports at 10k.
 */
export function ColdStartBreakout() {
  const hiddenRef = useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const measure = useCallback(() => {
    const container = hiddenRef.current;
    if (!container || busy) return;
    setBusy(true);
    setError(null);
    runMeasurement(container)
      .then((m) => {
        setMeasurement(m);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Measurement failed';
        setError(msg);
      })
      .finally(() => {
        setBusy(false);
      });
  }, [busy]);

  // Auto-measure on mount, deferred so the PerfHero on the same page has
  // a chance to finish booting first. Without the delay the two GL boots
  // overlap and inflate the cold-start number unrealistically. Run-once
  // on mount, so we read `measure` through a ref to keep deps empty.
  const measureRef = useRef(measure);
  measureRef.current = measure;
  useEffect(() => {
    const id = window.setTimeout(() => {
      measureRef.current();
    }, 2500);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

  const renderCell = (label: string, value: number | null, unit: string) => (
    <div className="perf-cold-cell">
      <div className="perf-cold-label">{label}</div>
      <div className="perf-cold-value">
        {value === null
          ? busy
            ? 'measuring…'
            : '—'
          : `${value.toFixed(value < 10 ? 1 : 0)} ${unit}`}
      </div>
    </div>
  );

  return (
    <div className="perf-cold">
      <div className="perf-cold-grid">
        {renderCell('Cold start', measurement?.coldMs ?? null, 'ms')}
        {renderCell('Warm update (median of 5)', measurement?.warmMs ?? null, 'ms')}
      </div>
      <div className="perf-cold-actions">
        <button
          type="button"
          className="perf-preset"
          onClick={measure}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? 'Measuring…' : '↻ Re-measure on my hardware'}
        </button>
        {error && (
          <span role="alert" className="perf-cold-error">
            {error}
          </span>
        )}
      </div>
      <div
        ref={hiddenRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: 400,
          height: 300,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
