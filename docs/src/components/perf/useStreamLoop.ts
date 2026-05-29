import { useEffect, useRef, useState } from 'react';
import { StreamGenerator, type StreamPoint } from './streamGenerator';

interface StreamLoopOpts {
  /** When true, the rAF loop is running. False stops the loop cleanly. */
  running: boolean;
  /** How many points the rolling window holds. */
  windowSize: number;
  /** How many new points to generate per frame. */
  pointsPerFrame: number;
  /** Called inside the rAF callback with the freshly-sliced window. */
  onTick: (window: readonly StreamPoint[]) => void;
}

/**
 * Owns the rAF loop, the {@link StreamGenerator}, and the windowed buffer
 * for the perf-page streaming demos. Per frame:
 *
 *  1. Generate `pointsPerFrame` new points.
 *  2. Slide the rolling window forward (oldest points fall off the left).
 *  3. Call `onTick(window)` so the parent can drive its chart update(s).
 *
 * The window is materialized fresh on each tick (a copy of the live ring
 * into a contiguous array) because `chart.update()` takes a plain readonly
 * array — copying ≤100k references is in the tens of microseconds.
 */
export function useStreamLoop({
  running,
  windowSize,
  pointsPerFrame,
  onTick,
}: StreamLoopOpts): void {
  // Keep `onTick` current without restarting the loop each render — the
  // loop closure reads through this ref.
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!running) return;

    const gen = new StreamGenerator({ seed: 1 });
    // Pre-fill the window so the chart looks "full" from the first tick
    // rather than fading in over the first few seconds.
    let buffer: readonly StreamPoint[] = gen.nextBatch(windowSize);

    let rafId = 0;
    const tick = () => {
      const batch = gen.nextBatch(pointsPerFrame);
      // Slide the window: drop the oldest `pointsPerFrame` and append the
      // new batch. Both operations together are O(windowSize) — under 200µs
      // even at the 100k preset, well under the frame budget.
      buffer = [...buffer.slice(pointsPerFrame), ...batch];
      onTickRef.current(buffer);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId !== 0) cancelAnimationFrame(rafId);
    };
  }, [running, windowSize, pointsPerFrame]);
}

interface RollingMetrics {
  /** Push a `chart.update()` wall time (ms) recorded inside the loop. */
  push(updateMs: number): void;
  /**
   * Drop the rolling sample buffer and reset the displayed numbers to
   * their pre-measurement default. Used by the comparison demo when the
   * visitor swaps libraries: the next library's first frame would otherwise
   * blend with the previous library's residual mean.
   */
  reset(): void;
  /** Rolling-mean update time in ms, throttled to 2× per second. */
  updateMs: number;
  /**
   * Throughput-derived FPS: `1000 / mean(updateMs)`. Uncapped — high
   * refresh-rate displays (90/120/144/240Hz) really can show more, so
   * clamping at 60 would hide pixi-charts' true update rate on this
   * hardware.
   */
  fps: number;
}

/**
 * Per-library metrics for the streaming demos. Aggregates `chart.update()`
 * wall times over a rolling 1-second window and exposes throttled
 * read-outs so the on-screen numbers don't flicker 60× per second.
 *
 * Why FPS is derived from update time, not from rAF cadence: rAF is gated
 * by the display refresh, so two libs running on the same page both see
 * ~60 rAF callbacks/sec regardless of how slow either one is. The
 * meaningful "FPS" is "how fast could this library go if nothing else was
 * on the thread", which is exactly `1000 / updateMs`.
 */
export function useRollingMetrics(): RollingMetrics {
  const samplesRef = useRef<{ t: number; ms: number }[]>([]);
  const lastDisplayRef = useRef(0);
  const [display, setDisplay] = useState({ updateMs: 0, fps: 0 });

  return {
    push(updateMs) {
      const now = performance.now();
      const samples = samplesRef.current;
      samples.push({ t: now, ms: updateMs });
      // Drop anything older than 1s.
      const cutoff = now - 1000;
      while (samples.length > 0 && samples[0].t < cutoff) samples.shift();

      if (now - lastDisplayRef.current >= 500) {
        lastDisplayRef.current = now;
        let sum = 0;
        for (const s of samples) sum += s.ms;
        const mean = samples.length > 0 ? sum / samples.length : 0;
        const fps = mean > 0 ? 1000 / mean : 0;
        setDisplay({ updateMs: mean, fps });
      }
    },
    reset() {
      samplesRef.current = [];
      lastDisplayRef.current = 0;
      setDisplay({ updateMs: 0, fps: 0 });
    },
    updateMs: display.updateMs,
    fps: display.fps,
  };
}
