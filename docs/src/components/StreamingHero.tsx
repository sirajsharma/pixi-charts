import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChartSpec, Theme } from 'pixi-charts';
import { HeroChart } from './HeroChart';
import { PerfStreamingChart, type PerfStreamingChartHandle } from './perf/PerfStreamingChart';
import { StreamGenerator, type StreamPoint } from './perf/streamGenerator';
import { useStreamLoop } from './perf/useStreamLoop';

// Desktop vs mobile streaming budgets. Mobile keeps the same live experience
// but with ~3× less GPU load: smaller window, fewer points per frame. Frame
// rate stays at 30fps on both — visible smoothness matters more than the
// marginal battery savings of dropping to 24fps.
const DESKTOP_CONFIG = { windowSize: 20_000, pointsPerFrame: 75, targetFps: 30 };
const MOBILE_CONFIG = { windowSize: 6_000, pointsPerFrame: 25, targetFps: 30 };
const MOBILE_MQ = '(max-width: 768px)';

// StreamGenerator walks around (0, 0) within ±100. Shift +60 on x so the
// cluster's visual center sits right of mid, mirroring the spiral's cx=68
// offset and keeping the left side mostly clear for the hero text overlay.
function shiftRight60(p: StreamPoint): StreamPoint {
  return { x: p.x + 60, y: p.y };
}

function heroSpecBuilder(data: readonly StreamPoint[], theme: Theme): ChartSpec {
  return {
    type: 'scatter',
    data: data as readonly Record<string, unknown>[],
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      // Plasma by x-position — gradient flows naturally as the cluster wanders.
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

interface InitialState {
  mode: 'streaming' | 'fallback';
  isMobile: boolean;
}

function initialState(): InitialState {
  if (typeof window === 'undefined') return { mode: 'fallback', isMobile: false };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.matchMedia(MOBILE_MQ).matches;
  return { mode: reduced ? 'fallback' : 'streaming', isMobile: small };
}

/**
 * Landing-page hero. Streams a continuously-evolving scatter as live proof of
 * the library's perf claims — 20k points on desktop, 6k on mobile, both at
 * 30fps. Falls back to the existing static spiral ({@link HeroChart}) only
 * under `prefers-reduced-motion: reduce`; small viewports still get the live
 * experience, just with a lighter GPU/battery budget.
 *
 * The streaming path reuses the perf-page primitives — `StreamGenerator`,
 * `useStreamLoop`, `PerfStreamingChart` — with battery knobs flipped on:
 * frame-rate cap, pause on tab hide, pause on scroll-out via
 * `IntersectionObserver`.
 */
export function StreamingHero() {
  const [state, setState] = useState<InitialState>(initialState);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<PerfStreamingChartHandle | null>(null);

  // Live-track preference changes so the user can toggle reduced-motion or
  // resize across the mobile breakpoint mid-session and see the hero adapt.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const smallMq = window.matchMedia(MOBILE_MQ);
    const decide = () => {
      setState({
        mode: reducedMq.matches ? 'fallback' : 'streaming',
        isMobile: smallMq.matches,
      });
    };
    reducedMq.addEventListener('change', decide);
    smallMq.addEventListener('change', decide);
    return () => {
      reducedMq.removeEventListener('change', decide);
      smallMq.removeEventListener('change', decide);
    };
  }, []);

  const config = state.isMobile ? MOBILE_CONFIG : DESKTOP_CONFIG;

  // Seed the chart's first render with a pre-filled window so the hero looks
  // full from the first paint instead of fading in over the first seconds.
  // Re-seeded when crossing the mobile breakpoint — the new identity also
  // triggers PerfStreamingChart to rebuild with the right-sized window.
  const initialData = useMemo(() => {
    const seed = new StreamGenerator({ seed: 1 });
    return seed.nextBatch(config.windowSize).map(shiftRight60);
  }, [config.windowSize]);

  useStreamLoop({
    running: state.mode === 'streaming',
    windowSize: config.windowSize,
    pointsPerFrame: config.pointsPerFrame,
    targetFps: config.targetFps,
    pauseWhenHidden: true,
    intersectionTarget: containerRef,
    onTick: (window) => {
      const chart = chartRef.current;
      if (!chart) return;
      // Shift each new batch into hero coordinate space before updating.
      // 20k allocations per tick (6k on mobile) is in the hundreds of µs —
      // well under the 33ms/30fps budget.
      chart.update(window.map(shiftRight60));
    },
  });

  if (state.mode === 'fallback') return <HeroChart />;

  const ariaLabel = `Live streaming scatter — ${config.windowSize.toLocaleString()} points, plasma gradient, continuously evolving`;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <PerfStreamingChart
        ref={chartRef}
        initialData={initialData}
        specBuilder={heroSpecBuilder}
        showPlaceholder={false}
        ariaLabel={ariaLabel}
      />
    </div>
  );
}
