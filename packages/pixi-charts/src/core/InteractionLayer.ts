import { type Container, type FederatedPointerEvent, Rectangle, Sprite, Texture } from 'pixi.js';

/** A 2D point in CSS pixels. */
export interface Point {
  x: number;
  y: number;
}

/** A pointer is hovering over `datum`. Fires only when the hovered datum changes. */
export interface HoverEvent<D> {
  type: 'hover';
  datum: D;
  /** Pointer position in plot-area local coordinates. */
  position: Point;
  /** Pointer position in page coordinates (suitable for positioning a DOM tooltip). */
  globalPosition: Point;
}

/** A primary-button click landed on `datum`. */
export interface ClickEvent<D> {
  type: 'click';
  datum: D;
  /** Pointer position in plot-area local coordinates. */
  position: Point;
  /** Pointer position in page coordinates (suitable for positioning a DOM tooltip). */
  globalPosition: Point;
}

/** The pointer left the previously hovered datum (or the plot area entirely). */
export interface LeaveEvent {
  type: 'leave';
}

/**
 * Union of every event {@link InteractionLayer} dispatches to its consumer.
 * Discriminated on `type`.
 */
export type InteractionEvent<D> = HoverEvent<D> | ClickEvent<D> | LeaveEvent;

/**
 * Hit-tester: maps a plot-area-local point to the datum under it (or `null`
 * if no datum lies under the point). Consumers build this from whatever
 * spatial index suits their chart — a quadtree, a band-scale lookup, a
 * line-distance test, etc.
 */
export type HitTester<D> = (point: Point) => D | null;

/** Constructor options for {@link InteractionLayer}. */
export interface InteractionLayerOptions<D> {
  /** Container the hit-test sprite is attached to. Usually the chart's plot stage. */
  stage: Container;
  /** Plot-area width in CSS pixels. The hit-test region covers `(0, 0)` to `(width, height)`. */
  width: number;
  /** Plot-area height in CSS pixels. */
  height: number;
  /** Maps a local point to a datum, or `null` if nothing is under it. */
  hitTest: HitTester<D>;
  /** Receives every normalized event dispatched by the layer. */
  onEvent: (event: InteractionEvent<D>) => void;
}

/**
 * Reusable pointer-event abstraction for PIXI charts.
 *
 * Owns a transparent hit-test sprite covering the plot area, listens for
 * `pointermove`, `pointerdown`, and `pointerleave`, and dispatches
 * normalized `hover` / `click` / `leave` events via the supplied
 * {@link InteractionLayerOptions.onEvent} callback.
 *
 * **Hover dedup.** Successive `pointermove`s over the same datum collapse to
 * a single `hover` event. Moving from datum A → B emits one `hover` for B;
 * moving from a datum → empty space emits one `leave`; moving from empty
 * space → empty space emits nothing.
 *
 * **`hitArea` is set explicitly.** `Texture.EMPTY` has no intrinsic bounds
 * in PIXI v8, so without `sprite.hitArea = new Rectangle(0, 0, w, h)` the
 * federated event system would not deliver events to the sprite at all.
 * Don't remove this line.
 *
 * **Coordinate handling:**
 * - `event.position` is `event.getLocalPosition(sprite)` — relative to the
 *   plot-area origin. This is exactly what most chart hit-tests want.
 * - `event.globalPosition` comes from `event.client` (page coordinates),
 *   which is what {@link import('./Tooltip.js').Tooltip} needs for its
 *   DOM-based positioning.
 *
 * **What we deliberately do NOT do:**
 * - We don't capture `pointerdown` — charts should not block the page's
 *   normal pointer behavior.
 * - We don't throttle `pointermove`. Hit-testing is the consumer's
 *   responsibility; if profiling shows it's hot, that's the place to fix.
 *   A future revision may add an opt-in `requestAnimationFrame`-coalesced
 *   mode.
 * - No gesture support (pinch, multi-touch). Single-pointer events only.
 * - We don't reset `_lastHovered` inside {@link setHitTester}. The old
 *   datum reference may no longer be valid in the new dataset, but the
 *   next `pointermove` will detect the transition and emit a fresh
 *   `hover` or `leave` as appropriate.
 */
export class InteractionLayer<D> {
  private readonly sprite: Sprite;
  private hitTest: HitTester<D>;
  private readonly onEvent: (event: InteractionEvent<D>) => void;
  private _lastHovered: D | null = null;
  private _destroyed = false;

  // Bound once in the constructor so the same function reference is passed
  // to both `sprite.on` and `sprite.off` — otherwise teardown silently
  // fails to remove the listener.
  private readonly handleMove: (event: FederatedPointerEvent) => void;
  private readonly handleDown: (event: FederatedPointerEvent) => void;
  private readonly handleLeave: () => void;

  constructor(opts: InteractionLayerOptions<D>) {
    this.hitTest = opts.hitTest;
    this.onEvent = opts.onEvent;

    const sprite = new Sprite(Texture.EMPTY);
    sprite.width = opts.width;
    sprite.height = opts.height;
    sprite.eventMode = 'static';
    // See class JSDoc: required for federated events to reach an EMPTY-textured sprite.
    sprite.hitArea = new Rectangle(0, 0, opts.width, opts.height);
    opts.stage.addChild(sprite);
    this.sprite = sprite;

    this.handleMove = (event: FederatedPointerEvent): void => {
      this.onMove(event);
    };
    this.handleDown = (event: FederatedPointerEvent): void => {
      this.onDown(event);
    };
    this.handleLeave = (): void => {
      this.onLeave();
    };

    sprite.on('pointermove', this.handleMove);
    sprite.on('pointerdown', this.handleDown);
    sprite.on('pointerleave', this.handleLeave);
  }

  /** `true` once {@link destroy} has run. */
  get destroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Resize the hit-test region to match a new plot-area size. Charts call
   * this from their own resize handlers.
   */
  resize(width: number, height: number): void {
    if (this._destroyed) return;
    this.sprite.width = width;
    this.sprite.height = height;
    this.sprite.hitArea = new Rectangle(0, 0, width, height);
  }

  /**
   * Replace the hit-tester. Used when chart data changes mid-render and
   * the underlying spatial index (e.g. a quadtree) must be rebuilt.
   */
  setHitTester(hitTest: HitTester<D>): void {
    this.hitTest = hitTest;
  }

  /**
   * Remove every listener, detach the sprite from its parent, destroy it,
   * and zero internal references. Idempotent.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this.sprite.off('pointermove', this.handleMove);
    this.sprite.off('pointerdown', this.handleDown);
    this.sprite.off('pointerleave', this.handleLeave);

    this.sprite.parent?.removeChild(this.sprite);
    this.sprite.destroy();
    this._lastHovered = null;
  }

  /** @internal */
  private onMove(event: FederatedPointerEvent): void {
    const local = event.getLocalPosition(this.sprite);
    const point: Point = { x: local.x, y: local.y };
    const datum = this.hitTest(point);

    if (datum !== null) {
      if (datum === this._lastHovered) return;
      this._lastHovered = datum;
      this.onEvent({
        type: 'hover',
        datum,
        position: point,
        globalPosition: { x: event.client.x, y: event.client.y },
      });
      return;
    }

    // datum === null
    if (this._lastHovered !== null) {
      this._lastHovered = null;
      this.onEvent({ type: 'leave' });
    }
  }

  /** @internal */
  private onDown(event: FederatedPointerEvent): void {
    // Ignore right-click and middle-click for v1. `event.button === 0` is
    // the primary pointer button (left mouse / first touch).
    if (event.button !== 0) return;

    const local = event.getLocalPosition(this.sprite);
    const point: Point = { x: local.x, y: local.y };
    const datum = this.hitTest(point);
    if (datum === null) return;

    this.onEvent({
      type: 'click',
      datum,
      position: point,
      globalPosition: { x: event.client.x, y: event.client.y },
    });
  }

  /** @internal */
  private onLeave(): void {
    if (this._lastHovered === null) return;
    this._lastHovered = null;
    this.onEvent({ type: 'leave' });
  }
}
