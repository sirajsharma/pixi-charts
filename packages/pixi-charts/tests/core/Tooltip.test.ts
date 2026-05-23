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
