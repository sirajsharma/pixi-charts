import { Container, type FederatedPointerEvent, Sprite, Texture } from 'pixi.js';

/** A 2D coordinate. Used for both plot-area-local and page-global positions. */
export interface Point {
  x: number;
  y: number;
}

/** Fired when the pointer enters a new datum (or moves between datums). */
export interface HoverEvent<D> {
  type: 'hover';
  /** The datum returned by the hit-tester for the current pointer position. */
  datum: D;
  /** Pointer position in plot-area-local coordinates (origin at the plot's top-left). */
  position: Point;
  /** Pointer position in page coordinates, suitable for positioning a DOM tooltip. */
  globalPosition: Point;
}

/** Fired on a primary-button (button 0) pointerdown that hits a datum. */
export interface ClickEvent<D> {
  type: 'click';
  datum: D;
  position: Point;
  globalPosition: Point;
}

/** Fired when the pointer leaves the previously-hovered datum (or the layer entirely). */
export interface LeaveEvent {
  type: 'leave';
}

/** Discriminated union of every event {@link InteractionLayer} can dispatch. */
export type InteractionEvent<D> = HoverEvent<D> | ClickEvent<D> | LeaveEvent;

/**
 * Hit-test callback supplied by the consumer.
 *
 * Receives a `point` in plot-area-local coordinates and returns the datum
 * under that point, or `null` if nothing is hit. The callback is invoked
 * on every `pointermove` and `pointerdown`, so it should be cheap.
 *
 * **Recommended strategies** for chart authors (this layer does not
 * implement either — it stays scale-agnostic so it can be reused by charts
 * whose hit-test isn't scale-based at all, e.g. pies use angular geometry
 * and heatmaps use grid-cell math):
 *
 * - **Continuous scales** (linear, log, time): use the
 *   {@link './ScaleAdapter.js'.ScaleAdapter}'s `invert()` to convert the
 *   pointer coordinate back to a domain value, then find the nearest
 *   datum (e.g. with `d3-array`'s `bisector`).
 * - **Band scales**: `invert()` is unavailable. Iterate the band domain
 *   using the adapter's `scale()` and `bandwidth()` to find which band
 *   the pointer falls in.
 */
export type HitTester<D> = (point: Point) => D | null;

/** Constructor options for {@link InteractionLayer}. */
export interface InteractionLayerOptions<D> {
  /** Parent container the hit-test sprite will be added to. */
  stage: Container;
  /** Width of the plot area in pixels. */
  width: number;
  /** Height of the plot area in pixels. */
  height: number;
  /** Hit-test function. See {@link HitTester} for the recommended strategies. */
  hitTest: HitTester<D>;
  /** Event handler. Called once per emitted event. */
  onEvent: (event: InteractionEvent<D>) => void;
}

/** @internal */
type PointerKind = 'move' | 'down' | 'leave';

/** @internal — mutable state for hover deduplication. */
interface HoverState<D> {
  lastDatum: D | null;
}

/**
 * Pure event-state machine used by {@link InteractionLayer}.
 *
 * Exported for unit testing — the class is a thin shell that wires PIXI
 * pointer events to this helper. Mutates `state` in place.
 *
 * Behavior:
 * - `move`: if hit returns a datum different from `lastDatum`, emit `hover`
 *   and update `lastDatum`. If hit returns the same datum, return `null`
 *   (deduplication). If hit returns `null` and we had a prior datum, emit
 *   `leave` and clear `lastDatum`.
 * - `down`: only emits when `isPrimaryButton` is true AND hit returns a
 *   datum. State is not touched (a click never implies a hover transition).
 * - `leave`: if we had a prior datum, emit `leave` and clear `lastDatum`.
 *
 * @internal
 */
export function handlePointerSample<D>(
  state: HoverState<D>,
  kind: PointerKind,
  point: Point,
  globalPosition: Point,
  hitTest: HitTester<D>,
  isPrimaryButton: boolean,
): InteractionEvent<D> | null {
  if (kind === 'leave') {
    if (state.lastDatum !== null) {
      state.lastDatum = null;
      return { type: 'leave' };
    }
    return null;
  }

  if (kind === 'down') {
    if (!isPrimaryButton) return null;
    const datum = hitTest(point);
    if (datum === null) return null;
    return { type: 'click', datum, position: point, globalPosition };
  }

  // kind === 'move'
  const datum = hitTest(point);
  if (datum === null) {
    if (state.lastDatum !== null) {
      state.lastDatum = null;
      return { type: 'leave' };
    }
    return null;
  }
  if (Object.is(datum, state.lastDatum)) {
    return null;
  }
  state.lastDatum = datum;
  return { type: 'hover', datum, position: point, globalPosition };
}

/**
 * Reusable pointer-event layer for a chart's plot area.
 *
 * Creates a transparent {@link Sprite} sized to the plot area, attaches it
 * to a parent stage, and dispatches normalized `hover` / `click` / `leave`
 * events to the consumer's `onEvent` callback. The layer is **scale-
 * agnostic** — it neither imports nor depends on `ScaleAdapter`. Charts
 * supply a {@link HitTester} that maps plot-area-local coordinates to a
 * datum.
 *
 * **Coordinate normalization.** The `point` passed to the hit-tester and
 * carried on the event is in plot-area-local coordinates (origin at the
 * sprite's top-left, which is the plot area's top-left). It is derived
 * via `event.getLocalPosition(this.sprite)` — exactly what PIXI's
 * federated event system exposes for this purpose.
 *
 * **`globalPosition`** is sourced from the federated event's `client`
 * field, which is the page-coordinate position suitable for placing a
 * DOM tooltip (matches `MouseEvent.clientX/Y`). Session 4's LineChart
 * relies on this to position its `Tooltip`.
 *
 * **Throttling.** `pointermove` can fire at very high frequency on some
 * devices. No throttling is applied in v1 — it's a deferred optimization
 * pending profiling. If hit-testing becomes a bottleneck, a per-frame
 * throttle hooked to the ticker is the natural next step.
 *
 * The generic parameter `D` is the datum type. It flows from the
 * consumer's `HitTester<D>` through the event-handler signature so
 * consumers get strongly typed datum access (no `any` in the type chain).
 */
export class InteractionLayer<D> {
  private readonly sprite: Sprite;
  private hitTest: HitTester<D>;
  private readonly onEvent: (event: InteractionEvent<D>) => void;
  private readonly state: HoverState<D> = { lastDatum: null };
  private _destroyed = false;

  // Bound handlers — stored so the exact reference can be passed to `.off()`.
  private readonly onPointerMove: (event: FederatedPointerEvent) => void;
  private readonly onPointerDown: (event: FederatedPointerEvent) => void;
  private readonly onPointerLeave: (event: FederatedPointerEvent) => void;

  constructor(opts: InteractionLayerOptions<D>) {
    this.hitTest = opts.hitTest;
    this.onEvent = opts.onEvent;

    const sprite = new Sprite(Texture.EMPTY);
    sprite.width = opts.width;
    sprite.height = opts.height;
    sprite.eventMode = 'static';
    opts.stage.addChild(sprite);
    this.sprite = sprite;

    this.onPointerMove = (event: FederatedPointerEvent): void => {
      this.dispatch('move', event, true);
    };
    this.onPointerDown = (event: FederatedPointerEvent): void => {
      this.dispatch('down', event, event.button === 0);
    };
    this.onPointerLeave = (event: FederatedPointerEvent): void => {
      this.dispatch('leave', event, true);
    };

    sprite.on('pointermove', this.onPointerMove);
    sprite.on('pointerdown', this.onPointerDown);
    sprite.on('pointerleave', this.onPointerLeave);
  }

  /** `true` once {@link destroy} has run. */
  get destroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Update the hit area's dimensions. Call when the plot area resizes —
   * the hit-test sprite must follow or events will fire at stale offsets.
   *
   * @throws If called after {@link destroy}.
   */
  resize(width: number, height: number): void {
    if (this._destroyed) {
      throw new Error('InteractionLayer: cannot resize() after destroy()');
    }
    this.sprite.width = width;
    this.sprite.height = height;
  }

  /**
   * Swap the active hit-tester. Necessary when chart data changes mid-
   * render (e.g. a scatter plot rebuilding its quadtree, or any chart
   * whose scales change on resize).
   *
   * Resets the cached `lastDatum` so the next `pointermove` re-emits a
   * `hover` even if the new tester returns the previously-hovered datum
   * — the underlying data may have changed and downstream consumers
   * (tooltips, highlights) need a chance to refresh.
   *
   * @throws If called after {@link destroy}.
   */
  setHitTester(hitTest: HitTester<D>): void {
    if (this._destroyed) {
      throw new Error('InteractionLayer: cannot setHitTester() after destroy()');
    }
    this.hitTest = hitTest;
    this.state.lastDatum = null;
  }

  /**
   * Remove event listeners, remove the sprite from its parent, destroy
   * the sprite, and release references. Idempotent.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this.sprite.off('pointermove', this.onPointerMove);
    this.sprite.off('pointerdown', this.onPointerDown);
    this.sprite.off('pointerleave', this.onPointerLeave);

    if (this.sprite.parent !== null) {
      this.sprite.parent.removeChild(this.sprite);
    }
    this.sprite.destroy();
  }

  /** @internal */
  private dispatch(kind: PointerKind, event: FederatedPointerEvent, isPrimary: boolean): void {
    const local = event.getLocalPosition(this.sprite);
    const point: Point = { x: local.x, y: local.y };
    const globalPosition: Point = { x: event.client.x, y: event.client.y };
    const emitted = handlePointerSample(
      this.state,
      kind,
      point,
      globalPosition,
      this.hitTest,
      isPrimary,
    );
    if (emitted !== null) {
      this.onEvent(emitted);
    }
  }
}
