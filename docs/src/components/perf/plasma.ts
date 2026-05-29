/**
 * Compact plasma LUT (24 stops, sampled from `d3-scale-chromatic`'s
 * `interpolatePlasma`). Hardcoded so the docs package doesn't need to
 * import a chroma library just to color a few thousand scatter points.
 *
 * `interpolatePlasmaRgba(t, alpha)` returns a `rgba(...)` CSS string for
 * `t ∈ [0, 1]`, linearly interpolated between adjacent stops. Mirrors the
 * gradient pixi-charts itself uses (it imports `interpolatePlasma`
 * directly), so visually the two libraries should match.
 */
const LUT: readonly (readonly [number, number, number])[] = [
  [13, 8, 135],
  [42, 6, 158],
  [65, 4, 174],
  [88, 1, 184],
  [110, 1, 190],
  [129, 3, 190],
  [149, 17, 186],
  [167, 32, 178],
  [184, 49, 166],
  [199, 65, 153],
  [213, 81, 138],
  [225, 97, 124],
  [235, 114, 109],
  [243, 131, 96],
  [248, 149, 81],
  [251, 167, 68],
  [252, 187, 55],
  [248, 206, 46],
  [241, 222, 39],
  [232, 236, 37],
  [223, 247, 39],
  [220, 252, 50],
  [240, 249, 33],
  [240, 249, 33],
];

export function interpolatePlasmaRgba(t: number, alpha: number): string {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const scaled = clamped * (LUT.length - 1);
  const i = Math.floor(scaled);
  const frac = scaled - i;
  const a = LUT[i];
  const b = LUT[Math.min(i + 1, LUT.length - 1)];
  const r = Math.round(a[0] + (b[0] - a[0]) * frac);
  const g = Math.round(a[1] + (b[1] - a[1]) * frac);
  const bl = Math.round(a[2] + (b[2] - a[2]) * frac);
  return `rgba(${String(r)}, ${String(g)}, ${String(bl)}, ${String(alpha)})`;
}
