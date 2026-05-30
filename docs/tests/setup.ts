import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Minimal `ResizeObserver` stub. happy-dom does not implement
 * `ResizeObserver`; the chart base class instantiates one during `init()`,
 * so an unstubbed run throws immediately. The stub captures the callback
 * but never fires — tests in this package exercise the first render path,
 * not resize behavior.
 */
class MockResizeObserver {
  callback: ResizeObserverCallback;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe = vi.fn((target: Element): void => {
    this.observed.push(target);
  });

  unobserve = vi.fn((target: Element): void => {
    this.observed = this.observed.filter((el) => el !== target);
  });

  disconnect = vi.fn((): void => {
    this.disconnected = true;
    this.observed = [];
  });
}

globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

/**
 * `matchMedia` stub. happy-dom provides a basic one but the library's
 * `tween()` calls `matchMedia('(prefers-reduced-motion: reduce)')` and
 * expects the standard shape. Default everything to `matches: false`.
 */
function installMatchMedia(): void {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

beforeEach(() => {
  installMatchMedia();
});

afterEach(() => {
  vi.restoreAllMocks();
});
