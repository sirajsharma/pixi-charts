import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock pixi.js. happy-dom has no WebGL and PIXI v8's federated event system
 * is awkward to drive synthetically, so we replace `Sprite` with a mock that
 * captures listener registrations on a per-instance map. Tests then invoke
 * `sprite._fire(eventName, syntheticEvent)` to drive the state machine
 * deterministically — sidestepping the renderer entirely.
 *
 * `Texture.EMPTY` is a sentinel object; the mocked `Sprite` constructor only
 * needs to accept whatever we pass in.
 *
 * `Rectangle` records its constructor args so we can assert the hit-area
 * region matches the sprite size.
 */
vi.mock('pixi.js', () => {
  class MockContainer {
    static instances: MockContainer[] = [];
    children: unknown[] = [];
    destroyed = false;
    addChild = vi.fn((child: unknown): unknown => {
      this.children.push(child);
      (child as { parent: MockContainer | null }).parent = this;
      return child;
    });
    removeChild = vi.fn((child: unknown): unknown => {
      this.children = this.children.filter((c) => c !== child);
      (child as { parent: MockContainer | null }).parent = null;
      return child;
    });
    destroy = vi.fn((): void => {
      this.destroyed = true;
    });
    constructor() {
      MockContainer.instances.push(this);
    }
  }

  class MockRectangle {
    static instances: MockRectangle[] = [];
    x: number;
    y: number;
    width: number;
    height: number;
    constructor(x: number, y: number, w: number, h: number) {
      this.x = x;
      this.y = y;
      this.width = w;
      this.height = h;
      MockRectangle.instances.push(this);
    }
  }

  class MockSprite {
    static instances: MockSprite[] = [];
    width = 0;
    height = 0;
    eventMode = 'auto';
    hitArea: unknown = null;
    parent: MockContainer | null = null;
    destroyed = false;
    _listeners = new Map<string, ((event: unknown) => void)[]>();

    constructor(_texture: unknown) {
      MockSprite.instances.push(this);
    }

    on = vi.fn((eventName: string, fn: (event: unknown) => void): this => {
      const list = this._listeners.get(eventName) ?? [];
      list.push(fn);
      this._listeners.set(eventName, list);
      return this;
    });
    off = vi.fn((eventName: string, fn: (event: unknown) => void): this => {
      const list = this._listeners.get(eventName) ?? [];
      this._listeners.set(
        eventName,
        list.filter((cb) => cb !== fn),
      );
      return this;
    });
    destroy = vi.fn((): void => {
      this.destroyed = true;
    });

    /** Test helper: fire `eventName` to every registered listener. */
    _fire(eventName: string, event: unknown): void {
      const list = this._listeners.get(eventName) ?? [];
      for (const fn of list) fn(event);
    }
  }

  const Texture = { EMPTY: { __empty: true } };

  return {
    Container: MockContainer,
    Sprite: MockSprite,
    Rectangle: MockRectangle,
    Texture,
  };
});

import { Container, Rectangle, Sprite } from 'pixi.js';

import { InteractionLayer, type HitTester, type Point } from '../../src/core/InteractionLayer.js';

type MockContainerStatic = {
  instances: {
    children: unknown[];
    destroyed: boolean;
    addChild: ReturnType<typeof vi.fn>;
    removeChild: ReturnType<typeof vi.fn>;
  }[];
};
type MockRectangleStatic = {
  instances: { x: number; y: number; width: number; height: number }[];
};
type MockSpriteStatic = {
  instances: {
    width: number;
    height: number;
    eventMode: string;
    hitArea: unknown;
    parent: unknown;
    destroyed: boolean;
    _listeners: Map<string, ((event: unknown) => void)[]>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    _fire(eventName: string, event: unknown): void;
  }[];
};

const MockContainer = Container as unknown as MockContainerStatic;
const MockRectangle = Rectangle as unknown as MockRectangleStatic;
const MockSprite = Sprite as unknown as MockSpriteStatic;

beforeEach(() => {
  MockContainer.instances = [];
  MockRectangle.instances = [];
  MockSprite.instances = [];
});

interface Datum {
  id: string;
}

function makeEvent(opts: { local: Point; client?: Point; button?: number }): {
  getLocalPosition: () => Point;
  client: Point;
  button: number;
} {
  return {
    getLocalPosition: (): Point => opts.local,
    client: opts.client ?? { x: 0, y: 0 },
    button: opts.button ?? 0,
  };
}

function setup(
  hitTest: HitTester<Datum>,
  width = 100,
  height = 100,
): {
  stage: MockContainerStatic['instances'][number];
  sprite: MockSpriteStatic['instances'][number];
  events: import('../../src/core/InteractionLayer.js').InteractionEvent<Datum>[];
  layer: InteractionLayer<Datum>;
} {
  const events: import('../../src/core/InteractionLayer.js').InteractionEvent<Datum>[] = [];
  const stage = new Container();
  const layer = new InteractionLayer<Datum>({
    stage,
    width,
    height,
    hitTest,
    onEvent: (e): void => {
      events.push(e);
    },
  });
  const stageMock = MockContainer.instances[MockContainer.instances.length - 1]!;
  const spriteMock = MockSprite.instances[MockSprite.instances.length - 1]!;
  return { stage: stageMock, sprite: spriteMock, events, layer };
}

describe('InteractionLayer — construction', () => {
  it('creates a sprite and adds it to the provided stage', () => {
    const { stage, sprite } = setup(() => null);

    expect(MockSprite.instances).toHaveLength(1);
    expect(stage.addChild).toHaveBeenCalledTimes(1);
    expect(stage.children).toContain(sprite);
    expect(sprite.parent).toBe(stage);
  });

  it('sets sprite width, height, eventMode="static", and an explicit hitArea Rectangle', () => {
    const { sprite } = setup(() => null, 250, 180);

    expect(sprite.width).toBe(250);
    expect(sprite.height).toBe(180);
    expect(sprite.eventMode).toBe('static');

    expect(MockRectangle.instances).toHaveLength(1);
    const rect = MockRectangle.instances[0]!;
    expect(rect).toEqual({ x: 0, y: 0, width: 250, height: 180 });
    expect(sprite.hitArea).toBe(rect);
  });

  it('registers listeners for pointermove, pointerdown, and pointerleave', () => {
    const { sprite } = setup(() => null);

    expect(sprite._listeners.get('pointermove')).toHaveLength(1);
    expect(sprite._listeners.get('pointerdown')).toHaveLength(1);
    expect(sprite._listeners.get('pointerleave')).toHaveLength(1);
  });
});

describe('InteractionLayer — hover dispatch', () => {
  it('emits one hover event when the hit-test returns a datum', () => {
    const target: Datum = { id: 'a' };
    const { sprite, events } = setup(() => target);

    sprite._fire('pointermove', makeEvent({ local: { x: 5, y: 7 }, client: { x: 100, y: 200 } }));

    expect(events).toHaveLength(1);
    const e = events[0]!;
    expect(e.type).toBe('hover');
    if (e.type !== 'hover') return; // narrowing
    expect(e.datum).toBe(target);
    expect(e.position).toEqual({ x: 5, y: 7 });
    expect(e.globalPosition).toEqual({ x: 100, y: 200 });
  });

  it('emits NO event when hit-test returns null and nothing was previously hovered', () => {
    const { sprite, events } = setup(() => null);
    sprite._fire('pointermove', makeEvent({ local: { x: 1, y: 1 } }));
    expect(events).toHaveLength(0);
  });

  it('deduplicates consecutive hovers over the same datum', () => {
    const target: Datum = { id: 'a' };
    const { sprite, events } = setup(() => target);

    sprite._fire('pointermove', makeEvent({ local: { x: 1, y: 1 } }));
    sprite._fire('pointermove', makeEvent({ local: { x: 2, y: 2 } }));
    sprite._fire('pointermove', makeEvent({ local: { x: 3, y: 3 } }));

    expect(events.filter((e) => e.type === 'hover')).toHaveLength(1);
  });

  it('emits a new hover event when moving from datum A to datum B', () => {
    const a: Datum = { id: 'a' };
    const b: Datum = { id: 'b' };
    let next: Datum = a;
    const { sprite, events } = setup(() => next);

    sprite._fire('pointermove', makeEvent({ local: { x: 1, y: 1 } }));
    next = b;
    sprite._fire('pointermove', makeEvent({ local: { x: 2, y: 2 } }));

    const hovers = events.filter((e) => e.type === 'hover');
    expect(hovers).toHaveLength(2);
    expect(hovers[0]!.datum).toBe(a);
    expect(hovers[1]!.datum).toBe(b);
  });

  it('emits a leave event when moving from a datum to empty space', () => {
    const target: Datum = { id: 'a' };
    let next: Datum | null = target;
    const { sprite, events } = setup(() => next);

    sprite._fire('pointermove', makeEvent({ local: { x: 1, y: 1 } }));
    next = null;
    sprite._fire('pointermove', makeEvent({ local: { x: 2, y: 2 } }));

    expect(events.map((e) => e.type)).toEqual(['hover', 'leave']);
  });
});

describe('InteractionLayer — click dispatch', () => {
  it('emits a click event for button 0 when hit-test returns a datum', () => {
    const target: Datum = { id: 'a' };
    const { sprite, events } = setup(() => target);

    sprite._fire(
      'pointerdown',
      makeEvent({ local: { x: 10, y: 20 }, client: { x: 30, y: 40 }, button: 0 }),
    );

    expect(events).toHaveLength(1);
    const e = events[0]!;
    expect(e.type).toBe('click');
    if (e.type !== 'click') return;
    expect(e.datum).toBe(target);
    expect(e.position).toEqual({ x: 10, y: 20 });
    expect(e.globalPosition).toEqual({ x: 30, y: 40 });
  });

  it('emits NO click when hit-test returns null', () => {
    const { sprite, events } = setup(() => null);
    sprite._fire('pointerdown', makeEvent({ local: { x: 1, y: 1 }, button: 0 }));
    expect(events).toHaveLength(0);
  });

  it('ignores right-click (button 2) even when hit-test returns a datum', () => {
    const target: Datum = { id: 'a' };
    const { sprite, events } = setup(() => target);
    sprite._fire('pointerdown', makeEvent({ local: { x: 1, y: 1 }, button: 2 }));
    expect(events).toHaveLength(0);
  });

  it('ignores middle-click (button 1)', () => {
    const target: Datum = { id: 'a' };
    const { sprite, events } = setup(() => target);
    sprite._fire('pointerdown', makeEvent({ local: { x: 1, y: 1 }, button: 1 }));
    expect(events).toHaveLength(0);
  });
});

describe('InteractionLayer — pointerleave', () => {
  it('emits a leave event if a datum was previously hovered', () => {
    const target: Datum = { id: 'a' };
    const { sprite, events } = setup(() => target);

    sprite._fire('pointermove', makeEvent({ local: { x: 1, y: 1 } }));
    sprite._fire('pointerleave', {});

    expect(events.map((e) => e.type)).toEqual(['hover', 'leave']);
  });

  it('emits NO event when nothing was hovered', () => {
    const { sprite, events } = setup(() => null);
    sprite._fire('pointerleave', {});
    expect(events).toHaveLength(0);
  });
});

describe('InteractionLayer — resize()', () => {
  it('updates sprite width, height, and replaces the hitArea Rectangle', () => {
    const { sprite, layer } = setup(() => null, 100, 100);
    expect(MockRectangle.instances).toHaveLength(1);

    layer.resize(400, 250);

    expect(sprite.width).toBe(400);
    expect(sprite.height).toBe(250);
    expect(MockRectangle.instances).toHaveLength(2);
    const newRect = MockRectangle.instances[1]!;
    expect(newRect).toEqual({ x: 0, y: 0, width: 400, height: 250 });
    expect(sprite.hitArea).toBe(newRect);
  });

  it('is a silent no-op after destroy', () => {
    const { layer, sprite } = setup(() => null);
    layer.destroy();
    expect(() => {
      layer.resize(200, 200);
    }).not.toThrow();
    // Width is whatever it was at destroy time — resize does not mutate.
    expect(sprite.destroyed).toBe(true);
  });
});

describe('InteractionLayer — setHitTester()', () => {
  it('swaps the active hit-tester for subsequent pointermove events', () => {
    const a: Datum = { id: 'a' };
    const b: Datum = { id: 'b' };
    const { sprite, events, layer } = setup(() => a);

    sprite._fire('pointermove', makeEvent({ local: { x: 1, y: 1 } }));
    expect((events[0] as { datum: Datum }).datum).toBe(a);

    layer.setHitTester(() => b);
    sprite._fire('pointermove', makeEvent({ local: { x: 2, y: 2 } }));

    const hovers = events.filter((e) => e.type === 'hover');
    expect(hovers).toHaveLength(2);
    expect(hovers[1]!.datum).toBe(b);
  });
});

describe('InteractionLayer — destroy()', () => {
  it('removes every listener, detaches the sprite, and destroys it', () => {
    const { sprite, stage, layer } = setup(() => null);

    layer.destroy();

    expect(sprite.off).toHaveBeenCalledTimes(3);
    expect(sprite.destroy).toHaveBeenCalledTimes(1);
    expect(stage.children).not.toContain(sprite);
    expect(sprite.destroyed).toBe(true);
    expect(layer.destroyed).toBe(true);
  });

  it('is idempotent', () => {
    const { sprite, layer } = setup(() => null);

    layer.destroy();
    layer.destroy();

    expect(sprite.destroy).toHaveBeenCalledTimes(1);
    expect(sprite.off).toHaveBeenCalledTimes(3);
  });

  it('events fired on the sprite after destroy do not reach onEvent', () => {
    const target: Datum = { id: 'a' };
    const { sprite, events, layer } = setup(() => target);

    layer.destroy();
    sprite._fire('pointermove', makeEvent({ local: { x: 1, y: 1 } }));
    sprite._fire('pointerdown', makeEvent({ local: { x: 1, y: 1 } }));
    sprite._fire('pointerleave', {});

    expect(events).toHaveLength(0);
  });
});
