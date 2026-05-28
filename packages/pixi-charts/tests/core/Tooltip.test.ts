import { describe, expect, it } from 'vitest';

import { Tooltip } from '../../src/core/Tooltip.js';

function makeContainer(width = 400, height = 300): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: () => undefined,
      }) as DOMRect,
  });
  document.body.appendChild(el);
  return el;
}

/** Stub the tooltip element's measured size — happy-dom returns 0 by default. */
function stubTooltipSize(container: HTMLElement, width: number, height: number): void {
  // The tooltip is the most recently appended child of the container.
  const el = container.lastElementChild as HTMLElement;
  Object.defineProperty(el, 'offsetWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'offsetHeight', { configurable: true, value: height });
}

describe('Tooltip — construction', () => {
  it('appends a hidden div to the container', () => {
    const container = makeContainer();
    new Tooltip({ container });

    const el = container.querySelector('div');
    expect(el).not.toBeNull();
    expect(el!.style.display).toBe('none');
    expect(el!.style.position).toBe('absolute');
    expect(el!.style.pointerEvents).toBe('none');
  });

  it('makes the tooltip a child of the container, not of document.body', () => {
    const container = makeContainer();
    new Tooltip({ container });

    const tooltipDiv = container.querySelector('div');
    expect(tooltipDiv).not.toBeNull();
    expect(tooltipDiv!.parentElement).toBe(container);
  });
});

describe('Tooltip — positioning context', () => {
  it('promotes a position: static parent to position: relative', () => {
    const container = makeContainer();
    // Sanity: parent has no explicit positioning.
    expect(container.style.position === '' || container.style.position === 'static').toBe(true);

    new Tooltip({ container });

    expect(container.style.position).toBe('relative');
  });

  it('leaves a non-static parent alone', () => {
    for (const pos of ['relative', 'absolute', 'fixed', 'sticky'] as const) {
      const container = makeContainer();
      container.style.position = pos;

      new Tooltip({ container });

      expect(container.style.position).toBe(pos);
    }
  });
});

describe('Tooltip — show()', () => {
  it('makes the tooltip visible and positions it', () => {
    const container = makeContainer(400, 300);
    const tooltip = new Tooltip({ container });
    stubTooltipSize(container, 80, 30);

    tooltip.show({ x: 50, y: 50, content: 'hello' });

    const el = container.lastElementChild as HTMLElement;
    expect(el.style.display).toBe('block');
    expect(el.textContent).toBe('hello');
    // Default offset is +8 in both axes — well inside 400×300.
    expect(el.style.left).toBe('58px');
    expect(el.style.top).toBe('58px');
  });

  it('uses textContent (not innerHTML) for string content — XSS-safe', () => {
    const container = makeContainer();
    const tooltip = new Tooltip({ container });
    stubTooltipSize(container, 80, 30);

    tooltip.show({ x: 10, y: 10, content: '<b>bold</b>' });

    const el = container.lastElementChild as HTMLElement;
    expect(el.textContent).toBe('<b>bold</b>');
    // No child elements — the angle brackets are literal text.
    expect(el.querySelectorAll('b')).toHaveLength(0);
    expect(el.children).toHaveLength(0);
  });

  it('appends an HTMLElement as a child', () => {
    const container = makeContainer();
    const tooltip = new Tooltip({ container });
    stubTooltipSize(container, 80, 30);

    const inner = document.createElement('span');
    inner.textContent = 'rich';
    inner.className = 'custom';
    tooltip.show({ x: 10, y: 10, content: inner });

    const el = container.lastElementChild as HTMLElement;
    expect(el.children).toHaveLength(1);
    expect(el.children[0]).toBe(inner);
  });

  it('clears previous HTMLElement children before appending a new one', () => {
    const container = makeContainer();
    const tooltip = new Tooltip({ container });
    stubTooltipSize(container, 80, 30);

    const first = document.createElement('span');
    first.textContent = 'first';
    tooltip.show({ x: 10, y: 10, content: first });

    const second = document.createElement('span');
    second.textContent = 'second';
    tooltip.show({ x: 10, y: 10, content: second });

    const el = container.lastElementChild as HTMLElement;
    expect(el.children).toHaveLength(1);
    expect(el.children[0]).toBe(second);
  });
});

describe('Tooltip — edge avoidance', () => {
  it('flips left when overflowing the right edge', () => {
    const container = makeContainer(400, 300);
    const tooltip = new Tooltip({ container });
    stubTooltipSize(container, 100, 30);

    // x=380, tooltip width 100, offset 8 → 380+8+100=488 > 400 → flip left.
    tooltip.show({ x: 380, y: 50, content: 'edge' });

    const el = container.lastElementChild as HTMLElement;
    // Expected: left = 380 - 100 - 8 = 272.
    expect(el.style.left).toBe('272px');
    expect(parseInt(el.style.left, 10)).toBeLessThan(380);
  });

  it('flips up when overflowing the bottom edge', () => {
    const container = makeContainer(400, 300);
    const tooltip = new Tooltip({ container });
    stubTooltipSize(container, 60, 80);

    // y=280, tooltip height 80, offset 8 → 280+8+80=368 > 300 → flip up.
    tooltip.show({ x: 50, y: 280, content: 'edge' });

    const el = container.lastElementChild as HTMLElement;
    // Expected: top = 280 - 80 - 8 = 192.
    expect(el.style.top).toBe('192px');
    expect(parseInt(el.style.top, 10)).toBeLessThan(280);
  });

  it('flips both axes when near the bottom-right corner', () => {
    const container = makeContainer(400, 300);
    const tooltip = new Tooltip({ container });
    stubTooltipSize(container, 100, 80);

    tooltip.show({ x: 380, y: 280, content: 'corner' });

    const el = container.lastElementChild as HTMLElement;
    expect(parseInt(el.style.left, 10)).toBeLessThan(380);
    expect(parseInt(el.style.top, 10)).toBeLessThan(280);
  });

  it('clamps to left=0 when cursor is at the left edge (no flip needed)', () => {
    const container = makeContainer(400, 300);
    const tooltip = new Tooltip({ container });
    stubTooltipSize(container, 60, 30);

    // x=0: preferred placement is 0 + 8 = 8 (already inside) — no overflow,
    // no clamp action needed. Sanity check that the new clamp didn't push it.
    tooltip.show({ x: 0, y: 50, content: 'left' });
    const el = container.lastElementChild as HTMLElement;
    expect(parseInt(el.style.left, 10)).toBe(8);
  });

  it('clamps to left=0 when the flipped position itself overflows the left edge', () => {
    const container = makeContainer(400, 300);
    const tooltip = new Tooltip({ container });
    // Tooltip wider than the cursor offset can accommodate. Preferred
    // placement at x=395 + 8 = 403 overflows right (403 + 200 > 400), flip
    // would target x=395 - 200 - 8 = 187 — that fits, so no clamp needed
    // for this branch. Use a scenario where the FLIP overflows left:
    // x=5, tooltip width 200 → preferred 5+8+200=213 (fits, no flip).
    // Cursor at x=395 with tooltip width 410 → flip target = 395-410-8 = -23.
    stubTooltipSize(container, 410, 30);
    tooltip.show({ x: 395, y: 50, content: 'wide' });
    const el = container.lastElementChild as HTMLElement;
    expect(parseInt(el.style.left, 10)).toBe(0);
  });

  it('clamps to top=0 when the flipped position itself overflows the top edge', () => {
    const container = makeContainer(400, 300);
    const tooltip = new Tooltip({ container });
    // Cursor at bottom with a tooltip taller than the canvas → flip target
    // 280 - 320 - 8 = -48; should clamp to 0.
    stubTooltipSize(container, 60, 320);
    tooltip.show({ x: 50, y: 280, content: 'tall' });
    const el = container.lastElementChild as HTMLElement;
    expect(parseInt(el.style.top, 10)).toBe(0);
  });

  it('aligns to the near edge when the tooltip is larger than the container', () => {
    const container = makeContainer(100, 100);
    const tooltip = new Tooltip({ container });
    // Tooltip 200×200 in a 100×100 container. Whatever flip path runs, the
    // final position must clamp to (0, 0) — aligning to the near edge is
    // preferable to escaping past it.
    stubTooltipSize(container, 200, 200);
    tooltip.show({ x: 50, y: 50, content: 'huge' });
    const el = container.lastElementChild as HTMLElement;
    expect(parseInt(el.style.left, 10)).toBe(0);
    expect(parseInt(el.style.top, 10)).toBe(0);
  });

  it('center hover position is unchanged (no clamp action when no overflow)', () => {
    const container = makeContainer(400, 300);
    const tooltip = new Tooltip({ container });
    stubTooltipSize(container, 60, 30);

    tooltip.show({ x: 100, y: 100, content: 'center' });
    const el = container.lastElementChild as HTMLElement;
    // 100 + 8 = 108 horizontally, 100 + 8 = 108 vertically. No flip, no clamp.
    expect(el.style.left).toBe('108px');
    expect(el.style.top).toBe('108px');
  });
});

describe('Tooltip — hide()', () => {
  it('sets display: none but keeps the element in the DOM', () => {
    const container = makeContainer();
    const tooltip = new Tooltip({ container });
    stubTooltipSize(container, 80, 30);
    tooltip.show({ x: 10, y: 10, content: 'hi' });

    const el = container.lastElementChild as HTMLElement;
    expect(el.style.display).toBe('block');

    tooltip.hide();
    expect(el.style.display).toBe('none');
    expect(container.contains(el)).toBe(true);
  });

  it('is a silent no-op after destroy', () => {
    const container = makeContainer();
    const tooltip = new Tooltip({ container });
    tooltip.destroy();

    expect(() => {
      tooltip.hide();
    }).not.toThrow();
  });
});

describe('Tooltip — destroy()', () => {
  it('removes the element from the DOM and flips destroyed', () => {
    const container = makeContainer();
    const tooltip = new Tooltip({ container });
    const el = container.lastElementChild as HTMLElement;

    tooltip.destroy();

    expect(container.contains(el)).toBe(false);
    expect(tooltip.destroyed).toBe(true);
  });

  it('is idempotent', () => {
    const container = makeContainer();
    const tooltip = new Tooltip({ container });
    tooltip.destroy();
    expect(() => {
      tooltip.destroy();
    }).not.toThrow();
    expect(tooltip.destroyed).toBe(true);
  });

  it('throws when show() is called after destroy()', () => {
    const container = makeContainer();
    const tooltip = new Tooltip({ container });
    tooltip.destroy();

    expect(() => {
      tooltip.show({ x: 0, y: 0, content: 'late' });
    }).toThrow(/cannot show\(\) after destroy/);
  });
});
