import { useEffect, useState } from 'react';

/**
 * Page-wide FPS sampler. A single `requestAnimationFrame` loop counts frames
 * over a rolling 1-second window — same pattern as `dev/scatter-perf.js`.
 *
 * One loop is enough even when two charts share the page: rAF runs once per
 * frame for the whole tab, so the sampled value reflects the combined
 * render cost of everything on screen, which is exactly what the comparison
 * is trying to show.
 */
export function useFpsCounter(): number {
  const [fps, setFps] = useState(60);

  useEffect(() => {
    let rafId = 0;
    let frames = 0;
    let last = performance.now();

    const tick = (now: number) => {
      frames += 1;
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  return fps;
}
