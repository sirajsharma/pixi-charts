/**
 * Largest Triangle Three Buckets (LTTB) downsampling.
 *
 * Reduces a sequence of `N` ordered `{x, y}` points to `M` points (M < N)
 * while preserving the visual shape of the original series. Conceptually:
 * divide the data into `M - 2` equally sized buckets and, for each bucket,
 * pick the single point that forms the largest triangle (by area) with the
 * previous chosen point and the centroid of the *next* bucket. The first
 * and last points are always retained as anchors.
 *
 * Reference: Sveinn Steinarsson, "Downsampling Time Series for Visual
 * Representation" (M.Sc. thesis, University of Iceland, 2013).
 *
 * **Known limitation.** The triangle-area formula uses cross-products of
 * raw coordinate values. For extremely large `x` (e.g. `Date.getTime()`
 * relative to year-3000 timestamps multiplied by extreme `y` magnitudes)
 * the multiplications can lose precision. For typical chart-pixel and
 * chart-domain magnitudes this is not an issue; we accept the risk in v1
 * and will revisit only if a real consumer hits it.
 */

/** A single `{x, y}` data point. Both axes are numeric — convert `Date`s to ms first. */
export interface DataPoint {
  x: number;
  y: number;
}

/**
 * Downsample `data` to approximately `threshold` points using LTTB.
 *
 * Edge cases that pass through unchanged (as a shallow copy, so callers
 * cannot accidentally mutate the input):
 * - `threshold >= data.length` — already small enough.
 * - `threshold < 3` — LTTB needs at least 3 buckets to be meaningful.
 *
 * Otherwise the output length is exactly `threshold`: the first point,
 * `threshold - 2` selected bucket representatives, and the last point.
 *
 * Pure: no side effects, no mutation of `data`.
 */
export function lttb(data: readonly DataPoint[], threshold: number): DataPoint[] {
  if (threshold >= data.length || threshold < 3) {
    return data.slice();
  }

  const sampled: DataPoint[] = [];
  const bucketSize = (data.length - 2) / (threshold - 2);

  // Always include the first point as the anchor.
  const first = data[0];
  if (first === undefined) return [];
  sampled.push(first);

  let prev = first;

  for (let i = 0; i < threshold - 2; i += 1) {
    // Index range of the next bucket — used to compute its average point,
    // which serves as the third vertex of the candidate triangles.
    const nextBucketStart = Math.floor((i + 1) * bucketSize) + 1;
    const nextBucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);

    let avgX = 0;
    let avgY = 0;
    const nextBucketLen = nextBucketEnd - nextBucketStart;
    for (let j = nextBucketStart; j < nextBucketEnd; j += 1) {
      const p = data[j];
      if (p === undefined) continue;
      avgX += p.x;
      avgY += p.y;
    }
    avgX /= nextBucketLen;
    avgY /= nextBucketLen;

    // Index range of the current bucket — pick the point inside this
    // bucket that maximises triangle area with `prev` and the next-
    // bucket centroid.
    const currBucketStart = Math.floor(i * bucketSize) + 1;
    const currBucketEnd = Math.floor((i + 1) * bucketSize) + 1;

    let maxArea = -1;
    let chosen = data[currBucketStart];

    for (let j = currBucketStart; j < currBucketEnd; j += 1) {
      const p = data[j];
      if (p === undefined) continue;
      // Triangle area = 0.5 * |x_a (y_b - y_c) + x_b (y_c - y_a) + x_c (y_a - y_b)|.
      // The 0.5 is a constant factor; omitted because we only need the argmax.
      const area = Math.abs((prev.x - avgX) * (p.y - prev.y) - (prev.x - p.x) * (avgY - prev.y));
      if (area > maxArea) {
        maxArea = area;
        chosen = p;
      }
    }

    if (chosen !== undefined) {
      sampled.push(chosen);
      prev = chosen;
    }
  }

  const last = data[data.length - 1];
  if (last !== undefined) sampled.push(last);

  return sampled;
}
