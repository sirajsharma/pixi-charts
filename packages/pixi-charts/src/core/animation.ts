import type { Ticker } from 'pixi.js';

/**
 * Built-in easing function names. Add new easings here and in {@link easings}.
 */
export type EasingName = 'linear' | 'easeOut' | 'easeInOut';

/**
 * Easing functions that map a normalised progress value `t ∈ [0, 1]` to an
 * eased output also in `[0, 1]`. Each function MUST return `0` for `t === 0`
 * and `1` for `t === 1` so the tween reaches its end-state exactly.
 */
export const easings: Record<EasingName, (t: number) => number> = {
  linear: (t) => t,
  easeOut: (t) => 1 - (1 - t) ** 3,
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

/**
 * Options for a {@link tween}.
 *
 * `onUpdate` is called every frame with the eased progress in `[0, 1]`. It is
 * guaranteed to be called at least once with `1` (either on natural
 * completion, on the synchronous reduced-motion / SSR short-circuit) so
 * consumers do not need a separate "finalise" callback path. `onComplete` is
 * called immediately after that final `onUpdate(1)`.
 */
export interface TweenOptions {
  /** Duration in milliseconds. Default: `500`. */
  duration?: number;
  /** Easing function. Default: `'easeOut'`. */
  ease?: EasingName;
  /** Per-frame callback; `progress` is the eased value in `[0, 1]`. */
  onUpdate: (progress: number) => void;
  /** Called once after `onUpdate(1)` on natural completion. NOT called on cancel. */
  onComplete?: () => void;
}

const DEFAULT_DURATION_MS = 500;
const DEFAULT_EASING: EasingName = 'easeOut';

/**
 * Returns `true` if the user has requested reduced motion via OS-level
 * preferences. Safe to call in SSR — returns `false` when `window` is absent.
 *
 * @internal
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Runs a time-based tween driven by a PixiJS {@link Ticker}.
 *
 * Behavior:
 * - Uses `performance.now()` for timing (frame-drop resilient — falling
 *   behind one frame still yields the correct progress, unlike accumulating
 *   `ticker.deltaMS`).
 * - If the user prefers reduced motion, OR if `window` is unavailable (SSR),
 *   `onUpdate(1)` and `onComplete()` fire synchronously and no ticker
 *   subscription is created.
 * - The returned function cancels the tween: it removes the ticker listener
 *   and prevents any further `onUpdate` / `onComplete` from firing. Calling
 *   it after natural completion or twice is a no-op.
 *
 * @param ticker - The PIXI ticker to drive the tween. Usually
 *                 `chart.app.ticker`.
 * @param opts   - Tween options.
 * @returns A `cancel()` function. Idempotent.
 *
 * @example
 * ```ts
 * const cancel = tween(this.app.ticker, {
 *   duration: 400,
 *   onUpdate: (t) => bar.scale.y = t,
 *   onComplete: () => console.log('done'),
 * });
 * // ...later, if the chart is destroyed before completion:
 * cancel();
 * ```
 */
export function tween(ticker: Ticker, opts: TweenOptions): () => void {
  const duration = opts.duration ?? DEFAULT_DURATION_MS;
  const easeFn = easings[opts.ease ?? DEFAULT_EASING];

  if (prefersReducedMotion() || typeof performance === 'undefined') {
    opts.onUpdate(1);
    opts.onComplete?.();
    return () => {
      /* already complete — nothing to cancel */
    };
  }

  const start = performance.now();
  let finished = false;

  const tick = (): void => {
    if (finished) return;
    const elapsed = performance.now() - start;
    const rawProgress = duration <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / duration));
    const eased = rawProgress >= 1 ? 1 : easeFn(rawProgress);

    if (rawProgress >= 1) {
      finished = true;
      ticker.remove(tick);
      opts.onUpdate(1);
      opts.onComplete?.();
      return;
    }

    opts.onUpdate(eased);
  };

  ticker.add(tick);

  return (): void => {
    if (finished) return;
    finished = true;
    ticker.remove(tick);
  };
}
