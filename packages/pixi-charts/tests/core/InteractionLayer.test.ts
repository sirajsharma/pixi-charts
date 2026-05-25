import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock the entire `pixi.js` module before importing anything that uses it.
 *
 * The `MockSprite` captures `.on()` handlers in a map so tests can retrieve
 * and invoke them directly with synthetic federated events. This sidesteps
 * happy-dom's lack of a real PIXI EventSystem.
 */
vi.mock('pixi.js', () => {
  class MockContainer {
    static instances: MockContainer[] = [];
    children: unknown[] = [];
    addChild = vi.fn((child: { parent: unknown }): unknown => {
      this.children.push(child);
      child.parent = this;
      return child;
    });
    removeChild = vi.fn((child: { parent: unknown }): unknown => {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      child.parent = null;
      return child;
    });
    constructor() {
      MockContainer.instances.push(this);
    }
  }

  class MockSprite {
    static instances: MockSprite[] = [];
    parent: MockContainer | null = null;
    width = 0;
    height = 0;
    scale = { x: 1, y: 1 };
    eventMode = 'none';
    destroyed = false;
    handlers = new Map<string, Set<(event: unknown) => void>>();

    on = vi.fn((event: string, handler: (event: unknown) => void): this => {
      let set = this.handlers.get(event);
      if (set === undefined) {
        set = new Set();
        this.handlers.set(event, set);
      }
      set.add(handler);
      return this;
    });
    off = vi.fn((event: string, handler: (event: unknown) => void): this => {
      this.handlers.get(event)?.delete(handler);
      return this;
    });
    destroy = vi.fn((): void => {
      this.destroyed = true;
    });

    constructor(_texture: unknown) {
      MockSprite.instances.push(this);
    }
  }

  const Texture = { EMPTY: { __empty: true } };

  return { Container: MockContainer, Sprite: MockSprite, Texture };
});

import { Container, Sprite } from 'pixi.js';

import {
  handlePointerSample,
  InteractionLayer,
  type HitTester,
  type InteractionEvent,
  type Point,
} from '../../src/core/InteractionLayer.js';

type MockContainerStatic = {
  instances: { children: unknown[]; addChild: ReturnType<typeof vi.fn> }[];
};
type MockSpriteStatic = {
  instances: {
    parent: { children: unknown[] } | null;
    width: number;
    height: number;
    eventMode: string;
    destroyed: boolean;
    handlers: Map<string, Set<(event: unknown) => void>>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }[];
};

const MockContainer = Container as unknown as MockContainerStatic;
const MockSprite = Sprite as unknown as MockSpriteStatic;

beforeEach(() => {
  MockContainer.instances = [];
  MockSprite.instances = [];
});

/* -------------------------------------------------------------------------- *
 * Pure helper unit tests                                                     *
 * -------------------------------------------------------------------------- */

describe('handlePointerSample', () => {
  const point: Point = { x: 10, y: 20 };
  const globalPosition: Point = { x: 110, y: 120 };
  const datumA = { id: 'a' };
  const datumB = { id: 'b' };

  it('move: hit a new datum with no prior → emits hover with isNewDatum=true and stores it', () => {
    const state = { lastDatum: null as typeof datumA | null };
    const result = handlePointerSample(state, 'move', point, globalPosition, () => datumA, true);

    expect(result).toEqual({
      type: 'hover',
      datum: datumA,
      position: point,
      globalPosition,
      isNewDatum: true,
    });
    expect(state.lastDatum).toBe(datumA);
  });

  it('move: hit the same datum as before → emits hover with isNewDatum=false', () => {
    const state = { lastDatum: datumA as typeof datumA | null };
    const result = handlePointerSample(state, 'move', point, globalPosition, () => datumA, true);

    expect(result).toEqual({
      type: 'hover',
      datum: datumA,
      position: point,
      globalPosition,
      isNewDatum: false,
    });
    expect(state.lastDatum).toBe(datumA);
  });

  it('move: in-datum move with different point coords → event.position reflects the new point', () => {
    const state = { lastDatum: datumA as typeof datumA | null };
    const newPoint: Point = { x: 99, y: 88 };
    const newGlobal: Point = { x: 199, y: 188 };
    const result = handlePointerSample(state, 'move', newPoint, newGlobal, () => datumA, true);

    expect(result).toEqual({
      type: 'hover',
      datum: datumA,
      position: newPoint,
      globalPosition: newGlobal,
      isNewDatum: false,
    });
  });

  it('move: hit a different datum → emits hover with isNewDatum=true for the new datum', () => {
    const state = { lastDatum: datumA as typeof datumA | null };
    const result = handlePointerSample(state, 'move', point, globalPosition, () => datumB, true);

    expect(result).toEqual({
      type: 'hover',
      datum: datumB,
      position: point,
      globalPosition,
      isNewDatum: true,
    });
    expect(state.lastDatum).toBe(datumB);
  });

  it('move: miss with prior datum → emits leave and clears state', () => {
    const state = { lastDatum: datumA as typeof datumA | null };
    const result = handlePointerSample(state, 'move', point, globalPosition, () => null, true);

    expect(result).toEqual({ type: 'leave' });
    expect(state.lastDatum).toBeNull();
  });

  it('move: miss with no prior datum → returns null', () => {
    const state = { lastDatum: null as typeof datumA | null };
    const result = handlePointerSample(state, 'move', point, globalPosition, () => null, true);

    expect(result).toBeNull();
    expect(state.lastDatum).toBeNull();
  });

  it('down: primary button + hit → emits click; state untouched', () => {
    const state = { lastDatum: null as typeof datumA | null };
    const result = handlePointerSample(state, 'down', point, globalPosition, () => datumA, true);

    expect(result).toEqual({ type: 'click', datum: datumA, position: point, globalPosition });
    expect(state.lastDatum).toBeNull();
  });

  it('down: primary button + miss → returns null', () => {
    const state = { lastDatum: null as typeof datumA | null };
    const result = handlePointerSample(state, 'down', point, globalPosition, () => null, true);

    expect(result).toBeNull();
  });

  it('down: non-primary button → returns null regardless of hit', () => {
    const state = { lastDatum: null as typeof datumA | null };
    const result = handlePointerSample(state, 'down', point, globalPosition, () => datumA, false);

    expect(result).toBeNull();
  });

  it('leave: with prior datum → emits leave and clears state', () => {
    const state = { lastDatum: datumA as typeof datumA | null };
    const result = handlePointerSample(state, 'leave', point, globalPosition, () => null, true);

    expect(result).toEqual({ type: 'leave' });
    expect(state.lastDatum).toBeNull();
  });

  it('leave: with no prior datum → returns null', () => {
    const state = { lastDatum: null as typeof datumA | null };
    const result = handlePointerSample(state, 'leave', point, globalPosition, () => null, true);

    expect(result).toBeNull();
  });
});

/* -------------------------------------------------------------------------- *
 * Class wiring tests                                                         *
 * -------------------------------------------------------------------------- */

interface TestDatum {
  id: string;
}

interface MockFederatedEvent {
  button: number;
  client: { x: number; y: number };
  getLocalPosition: (sprite: unknown) => { x: number; y: number };
}

function makeEvent(opts: {
  local?: { x: number; y: number };
  client?: { x: number; y: number };
  button?: number;
}): MockFederatedEvent {
  return {
    button: opts.button ?? 0,
    client: opts.client ?? { x: 0, y: 0 },
    getLocalPosition: () => opts.local ?? { x: 0, y: 0 },
  };
}

function fire(spriteIndex: number, eventName: string, event: MockFederatedEvent): void {
  const sprite = MockSprite.instances[spriteIndex]!;
  const handlers = sprite.handlers.get(eventName);
  if (handlers === undefined) throw new Error(`no handlers for ${eventName}`);
  for (const h of handlers) h(event);
}

describe('InteractionLayer — construction', () => {
  it('creates a Sprite, adds it to the stage, sets eventMode=static and dimensions', () => {
    const stage = new Container();
    new InteractionLayer<TestDatum>({
      stage,
      width: 400,
      height: 300,
      hitTest: () => null,
      onEvent: () => undefined,
    });

    expect(MockSprite.instances).toHaveLength(1);
    const sprite = MockSprite.instances[0]!;
    expect(sprite.width).toBe(400);
    expect(sprite.height).toBe(300);
    expect(sprite.eventMode).toBe('static');
    expect(sprite.parent).toBe(MockContainer.instances[0]);
  });

  it('registers pointermove, pointerdown, pointerleave handlers', () => {
    const stage = new Container();
    new InteractionLayer<TestDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => null,
      onEvent: () => undefined,
    });

    const sprite = MockSprite.instances[0]!;
    expect(sprite.handlers.get('pointermove')?.size).toBe(1);
    expect(sprite.handlers.get('pointerdown')?.size).toBe(1);
    expect(sprite.handlers.get('pointerleave')?.size).toBe(1);
  });
});

describe('InteractionLayer — event dispatch', () => {
  it('pointermove with hit → onEvent receives a hover with correct coords', () => {
    const stage = new Container();
    const onEvent = vi.fn<(event: InteractionEvent<TestDatum>) => void>();
    const datum: TestDatum = { id: 'p1' };

    new InteractionLayer<TestDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => datum,
      onEvent,
    });

    fire(0, 'pointermove', makeEvent({ local: { x: 25, y: 35 }, client: { x: 125, y: 235 } }));

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: 'hover',
      datum,
      position: { x: 25, y: 35 },
      globalPosition: { x: 125, y: 235 },
      isNewDatum: true,
    });
  });

  it('two consecutive moves over the same datum fire two hovers; second has isNewDatum=false', () => {
    const stage = new Container();
    const onEvent = vi.fn<(event: InteractionEvent<TestDatum>) => void>();
    const datum: TestDatum = { id: 'p1' };

    new InteractionLayer<TestDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => datum,
      onEvent,
    });

    fire(0, 'pointermove', makeEvent({ local: { x: 10, y: 10 } }));
    fire(0, 'pointermove', makeEvent({ local: { x: 12, y: 11 } }));

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent.mock.calls[0]![0]).toMatchObject({ type: 'hover', isNewDatum: true });
    expect(onEvent.mock.calls[1]![0]).toMatchObject({
      type: 'hover',
      isNewDatum: false,
      position: { x: 12, y: 11 },
    });
  });

  it('moving from datum A to datum B fires hover for B with isNewDatum=true', () => {
    const stage = new Container();
    const onEvent = vi.fn<(event: InteractionEvent<TestDatum>) => void>();
    const datumA: TestDatum = { id: 'a' };
    const datumB: TestDatum = { id: 'b' };
    let current: TestDatum = datumA;

    new InteractionLayer<TestDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => current,
      onEvent,
    });

    fire(0, 'pointermove', makeEvent({ local: { x: 10, y: 10 } }));
    current = datumB;
    fire(0, 'pointermove', makeEvent({ local: { x: 30, y: 30 } }));

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent.mock.calls[1]![0]).toMatchObject({
      type: 'hover',
      datum: datumB,
      isNewDatum: true,
    });
  });

  it('pointermove returning null does NOT fire when no prior datum was hovered', () => {
    const stage = new Container();
    const onEvent = vi.fn<(event: InteractionEvent<TestDatum>) => void>();

    new InteractionLayer<TestDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => null,
      onEvent,
    });

    fire(0, 'pointermove', makeEvent({ local: { x: 10, y: 10 } }));
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('pointerleave with prior datum → fires a leave event', () => {
    const stage = new Container();
    const onEvent = vi.fn<(event: InteractionEvent<TestDatum>) => void>();
    const datum: TestDatum = { id: 'p1' };

    new InteractionLayer<TestDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => datum,
      onEvent,
    });

    fire(0, 'pointermove', makeEvent({ local: { x: 5, y: 5 } }));
    onEvent.mockClear();
    fire(0, 'pointerleave', makeEvent({}));

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({ type: 'leave' });
  });

  it('pointerleave without prior datum → does NOT fire', () => {
    const stage = new Container();
    const onEvent = vi.fn<(event: InteractionEvent<TestDatum>) => void>();

    new InteractionLayer<TestDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => null,
      onEvent,
    });

    fire(0, 'pointerleave', makeEvent({}));
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('pointerdown button=0 with hit → fires click', () => {
    const stage = new Container();
    const onEvent = vi.fn<(event: InteractionEvent<TestDatum>) => void>();
    const datum: TestDatum = { id: 'p1' };

    new InteractionLayer<TestDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => datum,
      onEvent,
    });

    fire(0, 'pointerdown', makeEvent({ local: { x: 5, y: 5 }, button: 0 }));

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'click', datum }));
  });

  it('pointerdown button=2 (right-click) → does NOT fire', () => {
    const stage = new Container();
    const onEvent = vi.fn<(event: InteractionEvent<TestDatum>) => void>();
    const datum: TestDatum = { id: 'p1' };

    new InteractionLayer<TestDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => datum,
      onEvent,
    });

    fire(0, 'pointerdown', makeEvent({ button: 2 }));
    expect(onEvent).not.toHaveBeenCalled();
  });
});

describe('InteractionLayer — resize and setHitTester', () => {
  it('resize() updates sprite dimensions', () => {
    const stage = new Container();
    const layer = new InteractionLayer<TestDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => null,
      onEvent: () => undefined,
    });

    layer.resize(500, 400);

    const sprite = MockSprite.instances[0]!;
    expect(sprite.width).toBe(500);
    expect(sprite.height).toBe(400);
  });

  it('setHitTester() swaps the tester and resets the dedup state', () => {
    const stage = new Container();
    const onEvent = vi.fn<(event: InteractionEvent<TestDatum>) => void>();
    const datum: TestDatum = { id: 'p1' };

    const layer = new InteractionLayer<TestDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => datum,
      onEvent,
    });

    fire(0, 'pointermove', makeEvent({ local: { x: 5, y: 5 } }));
    expect(onEvent).toHaveBeenCalledTimes(1);

    onEvent.mockClear();

    // Swap to a tester that returns the SAME datum reference. Because
    // setHitTester resets lastDatum, the next move must re-emit hover.
    const newTester: HitTester<TestDatum> = () => datum;
    layer.setHitTester(newTester);
    fire(0, 'pointermove', makeEvent({ local: { x: 6, y: 6 } }));

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'hover', datum, isNewDatum: true }),
    );
  });
});

describe('InteractionLayer — destroy()', () => {
  it('removes handlers, removes sprite from parent, destroys sprite', () => {
    const stage = new Container();
    const layer = new InteractionLayer<TestDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => null,
      onEvent: () => undefined,
    });

    const sprite = MockSprite.instances[0]!;
    const container = MockContainer.instances[0]!;

    layer.destroy();

    expect(sprite.off).toHaveBeenCalledTimes(3);
    expect(sprite.handlers.get('pointermove')?.size ?? 0).toBe(0);
    expect(sprite.handlers.get('pointerdown')?.size ?? 0).toBe(0);
    expect(sprite.handlers.get('pointerleave')?.size ?? 0).toBe(0);
    expect(container.children).not.toContain(sprite);
    expect(sprite.destroyed).toBe(true);
    expect(layer.destroyed).toBe(true);
  });

  it('is idempotent', () => {
    const stage = new Container();
    const layer = new InteractionLayer<TestDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => null,
      onEvent: () => undefined,
    });

    const sprite = MockSprite.instances[0]!;
    layer.destroy();
    layer.destroy();

    expect(sprite.destroy).toHaveBeenCalledTimes(1);
  });

  it('resize() after destroy() throws', () => {
    const stage = new Container();
    const layer = new InteractionLayer<TestDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => null,
      onEvent: () => undefined,
    });
    layer.destroy();

    expect(() => layer.resize(200, 200)).toThrow(/cannot resize\(\) after destroy/);
  });

  it('setHitTester() after destroy() throws', () => {
    const stage = new Container();
    const layer = new InteractionLayer<TestDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => null,
      onEvent: () => undefined,
    });
    layer.destroy();

    expect(() => layer.setHitTester(() => null)).toThrow(/cannot setHitTester\(\) after destroy/);
  });
});

describe('InteractionLayer — generic type preservation', () => {
  // This block exists as much for human readers as for the runner: the body
  // uses the datum type at compile time inside `onEvent`, which would fail
  // typecheck if the generic were widened to `unknown` anywhere along the
  // chain (HitTester<D> → InteractionEvent<D> → onEvent).
  it('preserves D end-to-end from HitTester<D> through onEvent', () => {
    interface SpecificDatum {
      readonly tag: 'specific';
      value: number;
    }

    const stage = new Container();
    const seen: SpecificDatum[] = [];
    const datum: SpecificDatum = { tag: 'specific', value: 42 };

    new InteractionLayer<SpecificDatum>({
      stage,
      width: 100,
      height: 100,
      hitTest: () => datum,
      onEvent: (event) => {
        if (event.type === 'hover' || event.type === 'click') {
          // event.datum is SpecificDatum here — accessing `.value` and `.tag`
          // would fail typecheck if D were widened.
          seen.push({ tag: event.datum.tag, value: event.datum.value });
        }
      },
    });

    fire(0, 'pointermove', makeEvent({ local: { x: 1, y: 1 } }));
    expect(seen).toEqual([{ tag: 'specific', value: 42 }]);
  });
});
