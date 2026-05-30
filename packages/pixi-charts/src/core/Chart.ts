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
 * Options accepted by {@link Chart.update}.
 *
 * - `animate: false` (default) — snap to the new data immediately. Correct
 *   default for streaming and for `update()` callers that want the cheapest
 *   path.
 * - `animate: true` — tween from the previous state to the new state where
 *   the chart can do so without diffing. Supported on **bar** and **pie**
 *   when the category set is unchanged; ignored (snaps) on all other charts
 *   and on bar/pie when categories change. Animated updates with changing
 *   data shape genuinely need diffing — that's a deferred session.
 */
export interface UpdateOptions {
  /** Tween from old to new where the chart supports it. Default `false`. */
  animate?: boolean;
}

/**
 * Event types the public {@link Chart.on} / {@link Chart.off} API accepts.
 * Currently only `'click'`. Kept as a string-literal union so additional
 * events (e.g. `'hover'`) can be added without breaking the API shape.
 */
export type ChartEventType = 'click';

/**
 * Payload fired to handlers registered via {@link Chart.on}`('click', ...)`.
 *
 * The library reports the click; the consumer decides what to do with it
 * (open a detail panel, drill into the next data level via `chart.update()`,
 * etc.). Drilldown is a pattern, not a built-in — see the docs example.
 */
export interface ChartClickEvent {
  /**
   * The original data row from the chart's current `data` array — the same
   * reference that was passed in `spec.data`. Use this to identify what
   * the user clicked.
   */
  datum: Record<string, unknown>;
  /**
   * Index of {@link datum} in the chart's current `data` array, or `-1`
   * if it could not be located (e.g. the data was replaced between the
   * hit-test and event emission — should not happen in practice).
   */
  index: number;
  /**
   * Click position in plot-area-local pixel coordinates (origin at the
   * plot area's top-left). Useful for positioning a popover or context
   * menu at the click site.
   */
  position: { x: number; y: number };
  /**
   * For multi-series charts (Line, Area), the name of the series the
   * clicked datum belongs to. Undefined on single-series charts (Bar,
   * Scatter, Heatmap, Pie).
   */
  series?: string;
}

/** Handler signature for {@link Chart.on}`('click', handler)`. */
export type ChartEventHandler = (event: ChartClickEvent) => void;

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
 * 6. Orchestrate the **render / update / resize** flow as a single code
 *    path: each enters via {@link render}, which cancels active tweens,
 *    calls the subclass's {@link onBeforeUpdate} hook, runs lazy
 *    {@link ensureSetup}, and then drives the subclass-specific
 *    {@link redrawData}.
 *
 * Subclasses implement {@link redrawData} (and usually {@link replaceData},
 * {@link onBeforeUpdate}, and {@link ensureSetup}). Anything chart-type-
 * specific — axes, legend, tooltip, data marshalling — composes out of
 * small modules rather than extending this class further.
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
 * await chart.init();           // creates the PIXI app and does the first render
 *
 * // ...later, swap data without recreating the WebGL context
 * chart.update(newRows);
 *
 * chart.destroy();              // idempotent — safe to call more than once
 * ```
 */
export abstract class Chart {
  protected app: Application | null = null;
  protected readonly container: HTMLElement;

  private readonly initialWidth: number | undefined;
  private readonly initialHeight: number | undefined;

  private resizeObserver: ResizeObserver | null = null;
  private activeTweens: (() => void)[] = [];

  /**
   * Click handlers registered via {@link on}. Cleared on {@link destroy}.
   * @internal
   */
  private clickHandlers = new Set<ChartEventHandler>();

  /**
   * Carries {@link UpdateOptions} from {@link update} into the next
   * {@link render} pass so {@link redrawData} can read them. Cleared by
   * `render()` before invoking the subclass — every redraw that wasn't
   * triggered by `update()` (init, resize) sees `undefined`.
   *
   * @internal
   */
  private pendingUpdateOptions: UpdateOptions | undefined;

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
   * Swap the chart's data without recreating the WebGL context. Reuses the
   * existing PixiJS application, scales infrastructure, axes, legend, and
   * interaction layer; recomputes scales, geometry, and hit-testing from
   * the new data.
   *
   * `update()` cannot change the chart type, encoding, orientation, donut
   * inner radius, or color scheme — only the rows in `data`. To change any
   * of those, `destroy()` this chart and construct a fresh one.
   *
   * Synchronous. The PixiJS application is already initialised; updating
   * is just recompute + redraw.
   *
   * @throws If called before {@link init} has resolved.
   *
   * If called after {@link destroy}, this is a silent no-op.
   */
  update(newData: readonly Record<string, unknown>[], options?: UpdateOptions): void {
    if (this._destroyed) return;
    if (!this._initialized || !this.app) {
      throw new Error('Chart: update() called before init() resolved');
    }
    this.replaceData(newData);
    this.pendingUpdateOptions = options;
    this.render();
  }

  /**
   * Register a handler for a chart event. Returns an unsubscribe function;
   * calling it (or {@link off}) removes the handler.
   *
   * Currently only `'click'` is supported. Handlers receive a
   * {@link ChartClickEvent} describing the clicked datum, its index, the
   * plot-area-local pixel position, and (for multi-series charts) the
   * series name. The library reports the click; what it means is up to
   * the consumer — pair with {@link update} to build drilldown.
   *
   * Handlers are cleared automatically on {@link destroy}.
   *
   * @example
   * ```ts
   * const off = chart.on('click', (event) => {
   *   console.log('clicked', event.datum, 'at index', event.index);
   * });
   * // later: off();   //  or:  chart.off('click', handler);
   * ```
   */
  on(_event: 'click', handler: ChartEventHandler): () => void {
    this.clickHandlers.add(handler);
    return () => {
      this.clickHandlers.delete(handler);
    };
  }

  /**
   * Remove a previously registered click handler. No-op if the handler
   * wasn't registered, or after {@link destroy}.
   */
  off(_event: 'click', handler: ChartEventHandler): void {
    this.clickHandlers.delete(handler);
  }

  /**
   * Invoke every registered click handler with the given event. Each
   * handler is invoked in a try/catch so one throwing handler does not
   * block the others (errors are logged via `console.error`).
   *
   * Subclasses call this from their {@link import('./InteractionLayer.js').InteractionLayer} `onEvent`
   * handler when the layer emits a `click`.
   *
   * @internal
   */
  protected emitClick(event: ChartClickEvent): void {
    if (this._destroyed) return;
    for (const handler of this.clickHandlers) {
      try {
        handler(event);
      } catch (err) {
        // Surface handler errors without breaking other handlers.
        console.error('pixi-charts: click handler threw', err);
      }
    }
  }

  /**
   * The single render code path. Called by:
   *
   * - {@link update} after the data has been swapped, with
   *   {@link UpdateOptions} forwarded through {@link pendingUpdateOptions}.
   * - The {@link ResizeObserver} callback when the container resizes.
   * - The subclass's own `init()` after `super.init()` resolves, to draw
   *   the first frame.
   *
   * Funnelling every redraw through one method keeps the
   * `cancelAllTweens()` ordering, the destroyed/app guards, and the
   * tooltip/hover-state cleanup in one place.
   */
  protected render(): void {
    if (this._destroyed || !this.app) return;

    this.cancelAllTweens();

    const options = this.pendingUpdateOptions;
    this.pendingUpdateOptions = undefined;

    this.onBeforeUpdate();
    this.ensureSetup();
    this.redrawData(options);
  }

  /**
   * Subclass hook for chart-specific data recompute + redraw.
   *
   * Called by {@link render} after `cancelAllTweens()`, `onBeforeUpdate()`,
   * and `ensureSetup()`. Implementations should: rebuild any data-derived
   * records, recompute scales, refresh axes / legend / interaction
   * hit-tester via their `.update()` / `.setHitTester()` methods (do NOT
   * destroy and recreate them — they persist across updates), and redraw
   * geometry / sprites / textures.
   *
   * `options` is the {@link UpdateOptions} from the originating
   * {@link update} call, or `undefined` for init / resize.
   */
  protected abstract redrawData(options?: UpdateOptions): void;

  /**
   * Subclass hook for swapping the data field on the stored spec.
   *
   * Called by {@link update} before {@link render}. Concrete charts store
   * the {@link import('../spec/ChartSpec.js').ChartSpec} as a private
   * field and use this hook to clone the spec with the new `data`. The
   * data shape, encoding, and chart type are guaranteed by contract to
   * remain compatible.
   */
  protected abstract replaceData(newData: readonly Record<string, unknown>[]): void;

  /**
   * Subclass hook that runs at the start of every {@link render} pass,
   * before {@link ensureSetup} and {@link redrawData}. Default no-op.
   *
   * Charts override this to hide the tooltip and clear hover-related
   * state (e.g. `hoveredRecord = null`, `hoverOverlay.alpha = 0`). The
   * currently-hovered datum may not exist in the new data, so silently
   * leaving the tooltip visible would point at the wrong place.
   */
  protected onBeforeUpdate(): void {
    /* default no-op */
  }

  /**
   * Subclass hook for one-time chrome creation that survives across
   * updates and resizes (e.g. lazily instantiating the {@link Tooltip}
   * DOM element). Called on every render but expected to be a no-op
   * after the first invocation. Default no-op.
   */
  protected ensureSetup(): void {
    /* default no-op */
  }

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
    this.clickHandlers.clear();

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
