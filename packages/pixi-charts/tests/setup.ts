import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Minimal ResizeObserver stub.
 *
 * happy-dom does not implement ResizeObserver. Tests that observe DOM nodes
 * need a deterministic stub they can drive manually. The stub captures the
 * callback so individual tests can call `instance.trigger([entries])`.
 *
 * The global is reset between tests so the spy state is clean.
 */
export class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  callback: ResizeObserverCallback;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
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

  /** Drive the observer callback with synthetic entries. */
  trigger(entries: Partial<ResizeObserverEntry>[]): void {
    this.callback(entries as ResizeObserverEntry[], this as unknown as ResizeObserver);
  }
}

globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

/**
 * `matchMedia` stub. happy-dom provides a basic one, but we override it so
 * tests can control `prefers-reduced-motion` deterministically. Default:
 * everything is `false` (motion allowed).
 */
type MediaState = { matches: boolean };
const mediaStates = new Map<string, MediaState>();

export function setMediaMatch(query: string, matches: boolean): void {
  mediaStates.set(query, { matches });
}

function installMatchMedia(): void {
  window.matchMedia = ((query: string) => {
    const state = mediaStates.get(query) ?? { matches: false };
    return {
      matches: state.matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

beforeEach(() => {
  installMatchMedia();
});

afterEach(() => {
  MockResizeObserver.instances = [];
  mediaStates.clear();
});
