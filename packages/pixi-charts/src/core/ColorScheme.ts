import { color } from 'd3-color';
import {
  interpolateBlues,
  interpolateInferno,
  interpolatePlasma,
  interpolateViridis,
  schemeCategory10,
  schemePaired,
  schemeSet2,
  schemeTableau10,
} from 'd3-scale-chromatic';

/**
 * Curated categorical palettes wrapped from `d3-scale-chromatic`.
 *
 * Each entry is a fixed-length tuple of CSS hex strings. Adding a new scheme
 * here automatically widens {@link CategoricalSchemeName} via `keyof typeof`,
 * so the call-site types stay in sync.
 */
export const categoricalSchemes = {
  category10: schemeCategory10,
  tableau10: schemeTableau10,
  set2: schemeSet2,
  paired: schemePaired,
} as const satisfies Readonly<Record<string, readonly string[]>>;

/**
 * Curated sequential interpolators wrapped from `d3-scale-chromatic`. Each
 * value is a function `(t: number) => string` that maps `t ∈ [0, 1]` to a CSS
 * color.
 */
export const sequentialSchemes = {
  viridis: interpolateViridis,
  blues: interpolateBlues,
  inferno: interpolateInferno,
  plasma: interpolatePlasma,
} as const satisfies Readonly<Record<string, (t: number) => string>>;

/** Name of a categorical palette declared in {@link categoricalSchemes}. */
export type CategoricalSchemeName = keyof typeof categoricalSchemes;

/** Name of a sequential interpolator declared in {@link sequentialSchemes}. */
export type SequentialSchemeName = keyof typeof sequentialSchemes;

/**
 * Convert any CSS color string (`#rgb`, `#rrggbb`, `rgb(...)`, named colors,
 * etc.) to a PIXI-compatible numeric color `0xRRGGBB`.
 *
 * Uses `d3-color`'s `color()` so every CSS color syntax browsers accept is
 * supported without writing a regex. Throws on input that `d3-color` cannot
 * parse — silently returning `0x000000` would mask consumer bugs.
 *
 * @internal
 */
export function cssColorToPixi(css: string): number {
  const c = color(css);
  if (c === null) {
    throw new Error(`cssColorToPixi: invalid CSS color: ${JSON.stringify(css)}`);
  }
  const { r, g, b } = c.rgb();
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function clamp01(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

/**
 * Pick a color from a categorical palette by index.
 *
 * Indices wrap with `Math.abs(index) % palette.length` so callers never have
 * to know the palette size — pass any integer and you get a usable color.
 * Negative indices are mirrored rather than rejected; this matches the
 * spirit of "ergonomic by default."
 *
 * @param scheme - Palette name. Must exist in {@link categoricalSchemes}.
 * @param index  - Any integer; wraps modulo palette length.
 * @returns PIXI-compatible numeric color (`0xRRGGBB`).
 * @throws If `scheme` is not a known palette name.
 *
 * @example
 * ```ts
 * getCategoricalColor('category10', 0);  // 0x1f77b4
 * getCategoricalColor('category10', 10); // wraps → same as index 0
 * ```
 */
export function getCategoricalColor(scheme: CategoricalSchemeName, index: number): number {
  // Widen the access type so the runtime guard isn't flagged as
  // `no-unnecessary-condition` — TS proves the key is valid statically, but
  // we still want to catch callers that bypass the type system.
  const palettes = categoricalSchemes as Readonly<Record<string, readonly string[] | undefined>>;
  const palette = palettes[scheme];
  if (palette === undefined) {
    throw new Error(
      `getCategoricalColor: unknown scheme ${JSON.stringify(scheme)}. ` +
        `Known schemes: ${Object.keys(categoricalSchemes).join(', ')}.`,
    );
  }
  const wrapped = Math.abs(Math.trunc(index)) % palette.length;
  const css = palette[wrapped];
  if (css === undefined) {
    throw new Error(
      `getCategoricalColor: palette index ${String(wrapped)} out of range ` +
        `(length ${String(palette.length)})`,
    );
  }
  return cssColorToPixi(css);
}

/**
 * Sample a sequential interpolator at `t`.
 *
 * `t` is clamped to `[0, 1]` before invoking the interpolator. Out-of-range
 * input is a common consumer mistake (e.g. dividing by a max that turned out
 * smaller than expected) — silently clamping prevents NaN/garbage colors
 * from leaking into the renderer.
 *
 * @param scheme - Interpolator name. Must exist in {@link sequentialSchemes}.
 * @param t      - Sample position; clamped to `[0, 1]`.
 * @returns PIXI-compatible numeric color (`0xRRGGBB`).
 * @throws If `scheme` is not a known interpolator name.
 */
export function getSequentialColor(scheme: SequentialSchemeName, t: number): number {
  const interpolators = sequentialSchemes as Readonly<
    Record<string, ((t: number) => string) | undefined>
  >;
  const interpolator = interpolators[scheme];
  if (interpolator === undefined) {
    throw new Error(
      `getSequentialColor: unknown scheme ${JSON.stringify(scheme)}. ` +
        `Known schemes: ${Object.keys(sequentialSchemes).join(', ')}.`,
    );
  }
  return cssColorToPixi(interpolator(clamp01(t)));
}
