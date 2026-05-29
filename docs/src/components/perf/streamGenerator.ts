/**
 * Tiny seedable 2D random-walk generator for the perf-page streaming demo.
 *
 * Each call to {@link StreamGenerator.nextBatch} advances an internal `(x, y)`
 * state by Gaussian-distributed deltas (Box–Muller transform fed by a small
 * linear-congruential PRNG so the stream is deterministic when seeded).
 *
 * Bounds reflect: x and y stay in roughly `[-100, 100]` so the points stay
 * inside the chart's fixed viewport without the random walk drifting off
 * forever.
 *
 * Pure — no DOM, no async, no globals.
 */
export interface StreamPoint {
  x: number;
  y: number;
}

interface StreamGeneratorOptions {
  /** PRNG seed. Default 1. Same seed + same call sequence = same points. */
  seed?: number;
  /** Standard deviation of each step. Default 1.5. */
  volatility?: number;
}

const BOUND = 100;

export class StreamGenerator {
  private state: number;
  private readonly volatility: number;
  private x = 0;
  private y = 0;

  constructor(opts: StreamGeneratorOptions = {}) {
    this.state = (opts.seed ?? 1) >>> 0 || 1;
    this.volatility = opts.volatility ?? 1.5;
  }

  /** Park–Miller LCG. Returns a float in (0, 1). */
  private random(): number {
    this.state = (this.state * 48271) % 0x7fffffff;
    return this.state / 0x7fffffff;
  }

  /** Box–Muller. Returns one standard-normal sample (mean 0, sd 1). */
  private gauss(): number {
    const u1 = Math.max(this.random(), 1e-9);
    const u2 = this.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private step(value: number): number {
    let next = value + this.gauss() * this.volatility;
    if (next > BOUND) next = BOUND - (next - BOUND);
    else if (next < -BOUND) next = -BOUND - (next + BOUND);
    return next;
  }

  /** Generate `n` new points. Allocates a fresh array. */
  nextBatch(n: number): StreamPoint[] {
    const out = new Array<StreamPoint>(n);
    for (let i = 0; i < n; i += 1) {
      this.x = this.step(this.x);
      this.y = this.step(this.y);
      out[i] = { x: this.x, y: this.y };
    }
    return out;
  }

  /** Reset walk position. Does not reseed the PRNG. */
  reset(): void {
    this.x = 0;
    this.y = 0;
  }
}
