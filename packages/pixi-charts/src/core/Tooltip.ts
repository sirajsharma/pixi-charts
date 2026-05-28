/**
 * Constructor options for {@link Tooltip}.
 */
export interface TooltipOptions {
  /**
   * Host element. The tooltip's `<div>` is appended here — NOT to
   * `document.body` — so it scopes inside the chart, respects ancestor CSS
   * isolation, and is cleaned up when the host is removed.
   */
  container: HTMLElement;
}

/**
 * Options for {@link Tooltip.show}.
 */
export interface TooltipShowOptions {
  /** X coordinate in CSS pixels, relative to the container. */
  x: number;
  /** Y coordinate in CSS pixels, relative to the container. */
  y: number;
  /**
   * Content to render. Strings are written via `textContent` (XSS-safe).
   * `HTMLElement` values are appended as-is — the caller is responsible for
   * sanitising any user-supplied HTML before passing it in.
   */
  content: string | HTMLElement;
}

/** Pixel offset between the cursor and the tooltip's near edge. */
const CURSOR_OFFSET_PX = 8;

/**
 * DOM-based tooltip overlay positioned over the chart canvas.
 *
 * Why DOM and not a `PIXI.Text`:
 * - Wraps long strings with CSS without re-measuring on every frame.
 * - Accessible by default (screen readers see real text).
 * - Trivial to style and inspect.
 *
 * Why inline styles instead of a stylesheet:
 * - Zero CSS configuration for consumers.
 * - No risk of stylesheet pollution or scoping bugs.
 * - The tradeoff is no `:hover` / pseudo-class theming — acceptable, since
 *   the tooltip has `pointer-events: none` and is informational.
 */
export class Tooltip {
  private readonly container: HTMLElement;
  private el: HTMLDivElement | null;
  private _destroyed = false;

  constructor(opts: TooltipOptions) {
    this.container = opts.container;

    // The tooltip element uses `position: absolute`, which resolves against
    // the nearest *positioned* ancestor — not the DOM parent. If the
    // container is `static` (the default), the tooltip would anchor to some
    // higher ancestor (often `<body>`) and appear far from the chart. Promote
    // a static container to `relative`; `relative` has no visual side effect
    // on the container's own layout. If the container is already positioned
    // (relative/absolute/fixed/sticky), leave it alone.
    if (typeof window !== 'undefined') {
      const computed = window.getComputedStyle(this.container).position;
      if (computed === '' || computed === 'static') {
        this.container.style.position = 'relative';
      }
    }

    const el = document.createElement('div');
    const s = el.style;
    s.position = 'absolute';
    s.pointerEvents = 'none';
    s.background = '#ffffff';
    s.border = '1px solid #dddddd';
    s.borderRadius = '4px';
    s.padding = '6px 8px';
    s.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
    s.maxWidth = '300px';
    s.fontFamily = 'inherit';
    s.fontSize = '12px';
    s.lineHeight = '1.4';
    s.color = '#222222';
    s.display = 'none';
    s.boxSizing = 'border-box';
    s.zIndex = '10';
    s.left = '0px';
    s.top = '0px';

    this.container.appendChild(el);
    this.el = el;
  }

  /** `true` once {@link destroy} has run. */
  get destroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Render the tooltip at `(x, y)` (container-relative) with the given
   * content, then make it visible.
   *
   * Performs edge avoidance against the container's bounding rect:
   *
   * 1. **Flip.** Default placement is below-and-right of the cursor. If
   *    that would overflow the right edge, the tooltip flips to the left
   *    of the cursor; if it would overflow the bottom, it flips above.
   * 2. **Clamp.** After flipping, the result is clamped to the container
   *    bounds so it remains fully visible even when:
   *    - the flipped position itself overflows (cursor near the left/top
   *      edge plus a tooltip wider than the available space on the cursor's
   *      preferred side), or
   *    - the tooltip is larger than the container in some dimension
   *      (clamps to `0` rather than escaping past the near edge).
   *
   * Cursor-follow callers (every chart's hover handler) re-invoke `show()`
   * on every pointermove with the same content when the datum hasn't
   * changed; that's intentional — collision must run each move, only the
   * tooltip's content is deduped at the call site via `event.isNewDatum`.
   *
   * @throws If called after {@link destroy}. Silent no-ops mask bugs.
   */
  show(opts: TooltipShowOptions): void {
    if (this._destroyed || this.el === null) {
      throw new Error('Tooltip: cannot show() after destroy()');
    }

    const el = this.el;

    if (typeof opts.content === 'string') {
      // textContent is XSS-safe — innerHTML would render arbitrary markup.
      el.textContent = opts.content;
    } else {
      // Remove previous children before appending the new element so repeated
      // show() calls don't accumulate stale DOM.
      while (el.firstChild !== null) {
        el.removeChild(el.firstChild);
      }
      el.appendChild(opts.content);
    }

    // Make visible BEFORE measuring — display:none gives 0×0.
    el.style.display = 'block';

    const containerRect = this.container.getBoundingClientRect();
    const tooltipW = el.offsetWidth;
    const tooltipH = el.offsetHeight;

    let left = opts.x + CURSOR_OFFSET_PX;
    let top = opts.y + CURSOR_OFFSET_PX;

    // Flip horizontally if the preferred (right-of-cursor) placement would
    // overflow the right edge. Same vertically for the bottom edge.
    if (left + tooltipW > containerRect.width) {
      left = opts.x - tooltipW - CURSOR_OFFSET_PX;
    }
    if (top + tooltipH > containerRect.height) {
      top = opts.y - tooltipH - CURSOR_OFFSET_PX;
    }

    // Clamp into the container. Handles:
    // (1) Initial top/left overflow — `opts.x`/`opts.y` near 0 with no flip
    //     ever triggered (cursor in the top-left corner).
    // (2) Flipped position still overflows the opposite edge — cursor near
    //     left/top with a tooltip wider/taller than the cursor's offset.
    // (3) Tooltip larger than container — `containerRect - tooltip` goes
    //     negative; `Math.max(0, …)` pins the upper bound to `0` so the
    //     tooltip aligns to the near edge rather than escaping past it.
    const maxLeft = Math.max(0, containerRect.width - tooltipW);
    const maxTop = Math.max(0, containerRect.height - tooltipH);
    if (left < 0) left = 0;
    else if (left > maxLeft) left = maxLeft;
    if (top < 0) top = 0;
    else if (top > maxTop) top = maxTop;

    el.style.left = `${String(left)}px`;
    el.style.top = `${String(top)}px`;
  }

  /**
   * Hide the tooltip without removing it from the DOM. Subsequent
   * {@link show} calls are cheap because no element creation is needed.
   * Calling on a destroyed tooltip is a silent no-op.
   */
  hide(): void {
    if (this._destroyed || this.el === null) return;
    this.el.style.display = 'none';
  }

  /**
   * Remove the tooltip element from the DOM and release internal references.
   * Idempotent — calling more than once is safe.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    if (this.el !== null) {
      this.el.parentNode?.removeChild(this.el);
      this.el = null;
    }
  }
}
