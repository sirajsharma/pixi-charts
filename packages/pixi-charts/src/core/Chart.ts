import { Application } from 'pixi.js';

/**
 * Constructor options shared by every chart type.
 */
export interface ChartOptions {
  /** DOM element the chart canvas will be appended to. */
  container: HTMLElement;
  /** Initial width in CSS pixels. Defaults to the container's `clientWidth`. */
  width?: number;
  /** Initial height in CSS pixels. Defaults to the container's `clientHeight`. */
  height?: number;
}

/**
 * Abstract base class for every chart in `pixi-charts`.
 *
 * Responsibilities of this class — and ONLY these:
 *
 * 1. Hold the lifecycle: `new Chart() → await chart.init() → ... → chart.destroy()`.
 *    The constructor is intentionally side-effect-free. Nothing renders, no
 *    PIXI application is created, until {@link init} is called.
 * 2. Own and manage a single PIXI {@link Application}.
 * 3. Observe the container for size changes and forward them to the renderer.
 * 4. Track tween cancel functions registered via {@link addTween} so they
 *    can all be cancelled when the chart is destroyed.
 * 5. Clean up everything in {@link destroy}, idempotently, without
 *    requiring the user to know which steps initialised.
 *
 * Subclasses implement the abstract {@link render} method. Anything
 * chart-type-specific — axes, legend, tooltip, data marshalling — composes
 * out of small modules rather than extending this class further.
 *
 * `Chart` is abstract — instantiate a concrete subclass (e.g.
 * {@link import('../charts/LineChart.js').LineChart}) or, in most cases,
 * use the declarative {@link import('../spec/render.js').render} entry
 * point which returns a `Chart` already constructed and initialised.
 *
 * @example
 * ```ts
 * import { LineChart } from 'pixi-charts';
 *
 * const chart = new LineChart({ container, spec });
 * await chart.init();    // creates the PIXI app and does the first render
 *
 * // ...later
 * chart.destroy();       // idempotent — safe to call more than once
 * ```
 */
export abstract class Chart {
  protected app: Application | null = null;
  protected readonly container: HTMLElement;

  private readonly initialWidth: number | undefined;
  private readonly initialHeight: number | undefined;

  private resizeObserver: ResizeObserver | null = null;
  private activeTweens: (() => void)[] = [];

  private _initialized = false;
  private _destroyed = false;

  constructor(opts: ChartOptions) {
    this.container = opts.container;
    this.initialWidth = opts.width;
    this.initialHeight = opts.height;
  }

  /** `true` once {@link destroy} has run. */
  get destroyed(): boolean {
    return this._destroyed;
  }

  /** `true` once {@link init} has completed. */
  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Creates the PIXI Application, attaches its canvas to the container, and
   * starts observing the container for size changes.
   *
   * PIXI v8 requires `await app.init(...)` — this is why initialisation is
   * separate from construction. After this resolves, {@link render} may be
   * called by the subclass (or by the user).
   *
   * Calling `init()` more than once is a no-op.
   */
  async init(): Promise<void> {
    if (this._initialized || this._destroyed) return;

    const width = this.initialWidth ?? this.container.clientWidth;
    const height = this.initialHeight ?? this.container.clientHeight;

    const app = new Application();
    await app.init({
      width,
      height,
      antialias: true,
      autoDensity: true,
      resolution: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      backgroundAlpha: 0,
    });
    this.app = app;

    this.container.appendChild(app.canvas);

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(this.container);

    this._initialized = true;
  }

  /**
   * Subclass-provided render routine. Called by the resize observer when the
   * container dimensions change. Subclasses are also responsible for
   * invoking it themselves after the chart has data to draw.
   */
  protected abstract render(): void;

  /**
   * Tracks a tween cancel function so it will be cancelled by
   * {@link destroy}. If the chart is already destroyed, the cancel is
   * invoked synchronously to keep the leak-prevention guarantee intact.
   */
  protected addTween(cancel: () => void): void {
    if (this._destroyed) {
      cancel();
      return;
    }
    this.activeTweens.push(cancel);
  }

  /**
   * Cancels every tween currently tracked by this chart and clears the list.
   * Useful for subclasses that want to start a fresh animation pass.
   */
  protected cancelAllTweens(): void {
    const tweens = this.activeTweens;
    this.activeTweens = [];
    for (const cancel of tweens) {
      cancel();
    }
  }

  /**
   * Releases every resource owned by this chart:
   * - Cancels all tracked tweens.
   * - Disconnects the ResizeObserver.
   * - Destroys the PIXI Application (and removes its canvas from the DOM).
   * - Nulls internal references so the GC can collect them.
   *
   * Idempotent — calling more than once is safe and does no extra work.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this.cancelAllTweens();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.app) {
      // PIXI v8 destroy signature:
      //   destroy(rendererDestroyOptions, options)
      // `removeView: true` detaches the canvas from the DOM for us.
      this.app.destroy({ removeView: true }, { children: true, texture: false });
      this.app = null;
    }
  }

  /**
   * ResizeObserver callback: resize the PIXI renderer and re-render.
   * @internal
   */
  private handleResize(): void {
    if (!this._initialized || this._destroyed || !this.app) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width <= 0 || height <= 0) return;

    this.app.renderer.resize(width, height);
    this.render();
  }
}
