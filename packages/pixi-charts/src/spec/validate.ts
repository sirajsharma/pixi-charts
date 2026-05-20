import { z } from 'zod';

import type { ChartSpec } from './ChartSpec.js';

/**
 * Thrown by {@link validateChartSpec} when an input does not conform to
 * {@link ChartSpec}. The message is intentionally verbose and teaching —
 * each issue includes the path, what was received, what was expected, and
 * a minimal valid example. Consumers can catch this specifically.
 */
export class ChartSpecValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChartSpecValidationError';
  }
}

const fieldTypeSchema = z.enum(['quantitative', 'categorical', 'temporal']);
const chartTypeSchema = z.enum(['line', 'area', 'bar', 'scatter', 'heatmap', 'pie']);
const easingSchema = z.enum(['linear', 'easeOut', 'easeInOut']);
const orientationSchema = z.enum(['vertical', 'horizontal']);

const encodingFieldSchema = z.object({
  field: z.string(),
  type: fieldTypeSchema,
});

const colorEncodingSchema = z.object({
  field: z.string(),
  type: z.enum(['categorical', 'quantitative']).optional(),
  scheme: z.string().optional(),
});

const chartEncodingSchema = z.object({
  x: encodingFieldSchema.optional(),
  y: encodingFieldSchema.optional(),
  color: colorEncodingSchema.optional(),
  size: z.object({ field: z.string() }).optional(),
  value: z.object({ field: z.string() }).optional(),
});

const animationEnterObjectSchema = z.object({
  duration: z.number().optional(),
  ease: easingSchema.optional(),
});

const animationOptionsSchema = z.object({
  enter: z.union([z.boolean(), animationEnterObjectSchema]).optional(),
});

const marginSchema = z.object({
  top: z.number().optional(),
  right: z.number().optional(),
  bottom: z.number().optional(),
  left: z.number().optional(),
});

const chartOptionsSchema = z.object({
  title: z.string().optional(),
  showLegend: z.boolean().optional(),
  showTooltip: z.boolean().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  margin: marginSchema.optional(),
  orientation: orientationSchema.optional(),
});

/**
 * zod schema mirroring {@link ChartSpec}. Exported for consumers who want
 * to embed validation in their own pipelines or extend the spec.
 *
 * The shape uses `passthrough` at the top level so unknown options forward-
 * compatibly survive (with a `console.warn`) rather than being rejected —
 * see {@link validateChartSpec} for the warning behaviour.
 */
export const chartSpecSchema: z.ZodType<ChartSpec> = z.object({
  type: chartTypeSchema,
  data: z.array(z.record(z.unknown())).readonly(),
  encoding: chartEncodingSchema,
  options: chartOptionsSchema.optional(),
  animation: animationOptionsSchema.optional(),
}) as z.ZodType<ChartSpec>;

/**
 * Minimal valid examples for the most error-prone paths. Used to teach by
 * showing the right shape rather than describing it.
 */
const examples: Record<string, string> = {
  type: '"line"',
  data: '[{ x: 0, y: 1 }, { x: 1, y: 2 }]',
  encoding:
    '{ x: { field: "date", type: "temporal" }, y: { field: "value", type: "quantitative" } }',
  'encoding.x': '{ field: "date", type: "temporal" }',
  'encoding.y': '{ field: "value", type: "quantitative" }',
  'encoding.x.type': '{ field: "revenue", type: "quantitative" }',
  'encoding.y.type': '{ field: "revenue", type: "quantitative" }',
  'encoding.x.field': '{ field: "date", type: "temporal" }',
  'encoding.y.field': '{ field: "revenue", type: "quantitative" }',
  'encoding.color': '{ field: "category", scheme: "category10" }',
  'animation.enter': '{ duration: 600, ease: "easeOut" }',
  'options.orientation': '"vertical" | "horizontal"',
};

function pathToDotted(path: readonly (string | number)[]): string {
  return path.map((p) => String(p)).join('.');
}

function exampleFor(path: string): string | null {
  if (Object.prototype.hasOwnProperty.call(examples, path)) return examples[path] ?? null;
  // Walk up the path looking for a parent example (e.g. `encoding.x.type` →
  // falls back to `encoding.x` if `encoding.x.type` has no entry).
  const segments = path.split('.');
  while (segments.length > 0) {
    segments.pop();
    const key = segments.join('.');
    if (key !== '' && Object.prototype.hasOwnProperty.call(examples, key))
      return examples[key] ?? null;
  }
  return null;
}

function describeReceived(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array (length ${String(value.length)})`;
  if (typeof value === 'object') return 'object';
  return JSON.stringify(value);
}

function describeExpected(issue: z.ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.expected;
    case 'invalid_enum_value':
      return issue.options.map((o) => JSON.stringify(o)).join(', ');
    case 'invalid_union':
      return 'one of the allowed shapes (see ChartSpec types)';
    default:
      return issue.message;
  }
}

function formatIssue(issue: z.ZodIssue, input: unknown): string {
  const path = pathToDotted(issue.path);
  // Walk the input by path to recover the received value.
  let received: unknown = input;
  for (const seg of issue.path) {
    if (received === null || received === undefined) break;
    received = (received as Record<string, unknown>)[String(seg)];
  }

  const lines = [
    `Invalid value at \`${path === '' ? '<root>' : path}\`.`,
    `  Received: ${describeReceived(received)}`,
    `  Expected: ${describeExpected(issue)}`,
  ];
  const ex = exampleFor(path);
  if (ex !== null) lines.push(`  Example: ${ex}`);
  return lines.join('\n');
}

/**
 * The fields the spec object is *officially* allowed to contain. Anything
 * outside this set on the root object triggers a `console.warn` (forward
 * compat) rather than a validation failure.
 *
 * @internal
 */
const KNOWN_SPEC_KEYS = new Set(['type', 'data', 'encoding', 'options', 'animation']);

/**
 * Parse and validate a {@link ChartSpec} candidate.
 *
 * - On success, returns the input cast as a typed `ChartSpec`.
 * - On failure, throws a {@link ChartSpecValidationError} whose message
 *   lists every issue with its path, the received value, the expected
 *   shape, and (where useful) a minimal example.
 *
 * Beyond shape validation this also enforces a few semantic rules:
 *
 * - `data` must be non-empty (a zero-row chart is almost always a bug).
 * - Every `field` referenced by `encoding` must exist in the first data
 *   row's keys. Catches typos like `'revenu'` for `'revenue'`.
 * - For `type: 'line'` and `type: 'area'`, both `encoding.x` and
 *   `encoding.y` are required.
 * - For `type: 'bar'`, the category/value axis roles depend on
 *   `options.orientation` — see {@link requireBarEncoding}.
 * - For `type: 'scatter'`, `encoding.x`/`encoding.y` are required and must
 *   be quantitative or temporal; quantitative-color and size fields are
 *   sanity-checked with warnings — see {@link requireScatterEncoding}.
 *
 * `options.orientation` is validated for its *shape* (one of `'vertical'` /
 * `'horizontal'`) for every spec, but its *meaning* is read only for
 * `type: 'bar'`. Line, area, and other types that set it are neither warned
 * nor errored — the field is deliberately on the shared `ChartOptions`.
 *
 * Other chart types' encoding rules will be added alongside their
 * implementations; today they pass shape validation but throw at the
 * dispatcher level with a "not implemented yet" message.
 *
 * Unknown top-level keys do NOT fail validation — a `console.warn` is
 * emitted instead. This protects consumers writing forward-compat code
 * (e.g. setting a future `theme:` field) without locking the spec.
 */
/**
 * Cartesian line-family encoding rule: `x` and `y` are both required. Used
 * for `'line'` and `'area'` (and any future cartesian type) so the teaching
 * message stays identical and the check isn't copy-pasted per type.
 */
function requireXAndY(spec: ChartSpec, type: 'line' | 'area'): void {
  const missing: string[] = [];
  if (spec.encoding.x === undefined) missing.push('encoding.x');
  if (spec.encoding.y === undefined) missing.push('encoding.y');
  if (missing.length > 0) {
    throw new ChartSpecValidationError(
      `ChartSpec(type: '${type}') requires ${missing.join(' and ')}. Example: ` +
        `{ x: { field: 'date', type: 'temporal' }, y: { field: 'revenue', type: 'quantitative' } }.`,
    );
  }
}

/**
 * Bar-chart encoding rule. Which axis carries the categories and which
 * carries the quantitative values depends on `options.orientation`
 * (default `'vertical'`):
 *
 * - **vertical** (default): `encoding.x` is the category axis (must be
 *   `type: 'categorical'`); `encoding.y` is the value axis (must be
 *   `type: 'quantitative'`).
 * - **horizontal**: roles swap — `encoding.y` is categorical, `encoding.x`
 *   is quantitative.
 *
 * Each failure throws a teaching {@link ChartSpecValidationError} naming the
 * exact path, the required type, and what was received. `orientation` is
 * read **only here** (and only for `type: 'bar'`); the schema has already
 * proven it is one of the two allowed values when present.
 */
function requireBarEncoding(spec: ChartSpec): void {
  const orientation = spec.options?.orientation ?? 'vertical';
  const categoryChannel = orientation === 'horizontal' ? 'y' : 'x';
  const valueChannel = orientation === 'horizontal' ? 'x' : 'y';
  const adjective = orientation === 'horizontal' ? 'horizontal' : 'vertical';

  const requireChannel = (
    channel: 'x' | 'y',
    expectedType: 'categorical' | 'quantitative',
  ): void => {
    const enc = spec.encoding[channel];
    if (enc === undefined) {
      throw new ChartSpecValidationError(
        `ChartSpec(type: 'bar') with ${adjective} orientation requires ` +
          `\`encoding.${channel}\` (the ${
            expectedType === 'categorical' ? 'category' : 'value'
          } axis). Example: { x: { field: 'name', type: 'categorical' }, ` +
          `y: { field: 'count', type: 'quantitative' } }.`,
      );
    }
    if (enc.type !== expectedType) {
      throw new ChartSpecValidationError(
        `For ${adjective} bar charts, \`encoding.${channel}.type\` must be ` +
          `\`'${expectedType}'\`. Received: \`'${enc.type}'\`.`,
      );
    }
  };

  requireChannel(categoryChannel, 'categorical');
  requireChannel(valueChannel, 'quantitative');
}

/** True only for a value that is (or parses to) a finite number. */
function isFiniteNumeric(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string' && v !== '') return Number.isFinite(Number(v));
  return false;
}

/**
 * Scatter-chart encoding rule.
 *
 * - `encoding.x` and `encoding.y` are both required and must be
 *   `'quantitative'` or `'temporal'`. Categorical x/y (a strip/dot plot) is
 *   an unusual encoding deliberately rejected for v1 with a teaching error —
 *   the common categorical-vs-quantitative case is a bar chart.
 * - A `'quantitative'` `encoding.color` field that contains missing or
 *   non-numeric values **warns** (not rejects): a sparse column still yields
 *   a usable plot (such points clamp to the colour-scale domain edge), and a
 *   hard failure on real-world data would be hostile.
 * - A negative `encoding.size` value **warns**: the square-root size scale
 *   still renders it, but a negative magnitude is almost always a data bug.
 *
 * Field *existence* is enforced by the shared check in
 * {@link validateChartSpec} (which throws a better teaching error), so the
 * data scans here are guarded by first-row presence and never duplicate it.
 */
function requireScatterEncoding(spec: ChartSpec): void {
  const requirePositional = (channel: 'x' | 'y'): void => {
    const enc = spec.encoding[channel];
    if (enc === undefined) {
      throw new ChartSpecValidationError(
        `ChartSpec(type: 'scatter') requires \`encoding.${channel}\`. A scatter plot ` +
          `draws one point per row at (x, y); both axes are mandatory. Example: ` +
          `{ x: { field: 'weight', type: 'quantitative' }, ` +
          `y: { field: 'height', type: 'quantitative' } }.`,
      );
    }
    if (enc.type !== 'quantitative' && enc.type !== 'temporal') {
      throw new ChartSpecValidationError(
        `For scatter charts, \`encoding.${channel}.type\` must be ` +
          `'quantitative' or 'temporal'. Received: '${enc.type}'. Categorical scatter ` +
          `(a strip/dot plot) is an unusual encoding not supported in v1 — use a bar ` +
          `chart for categorical-vs-quantitative, or move the category to the \`color\` ` +
          `channel. Example: { field: '${enc.field}', type: 'quantitative' }.`,
      );
    }
  };
  requirePositional('x');
  requirePositional('y');

  const firstRow = spec.data[0];
  const hasField = (f: string): boolean =>
    firstRow !== undefined && Object.prototype.hasOwnProperty.call(firstRow, f);

  const color = spec.encoding.color;
  if (color?.type === 'quantitative' && hasField(color.field)) {
    let bad = 0;
    for (const row of spec.data) {
      if (!isFiniteNumeric(row[color.field])) bad += 1;
    }
    if (bad > 0) {
      console.warn(
        `pixi-charts: scatter quantitative color field "${color.field}" has ` +
          `${String(bad)}/${String(spec.data.length)} missing or non-numeric values. ` +
          `Those points clamp to the colour scale's domain edge; provide numeric ` +
          `values for an accurate colour mapping.`,
      );
    }
  }

  const size = spec.encoding.size;
  if (size !== undefined && hasField(size.field)) {
    let neg = 0;
    for (const row of spec.data) {
      const v = row[size.field];
      if (typeof v === 'number' && v < 0) neg += 1;
    }
    if (neg > 0) {
      console.warn(
        `pixi-charts: scatter size field "${size.field}" has ${String(neg)} negative ` +
          `value(s). The square-root size scale still renders them, but a negative ` +
          `size is visually meaningless — check the data.`,
      );
    }
  }
}

/**
 * Heatmap encoding rule.
 *
 * - `encoding.x` and `encoding.y` are both required and must be
 *   `'categorical'`. v1 does **not** implement automatic binning of
 *   continuous values into cells: that's a separate feature with its own
 *   design choices (bin count, equal-width vs. equal-frequency, etc.). A
 *   teaching error names the path AND mentions the binning scope so
 *   consumers see *why* the categorical constraint exists rather than just
 *   the constraint itself.
 * - `encoding.color` is required and must be `'quantitative'`. A heatmap
 *   without colour is meaningless — colour IS the chart's primary visual
 *   channel — and a categorical-colour heatmap is a different chart
 *   (closer to a confusion matrix) not in scope for v1.
 * - `encoding.value` is required: it is the field carrying each cell's
 *   numeric magnitude (driving the colour scale's input). The shared
 *   field-existence check in {@link validateChartSpec} verifies it
 *   afterwards.
 * - Duplicate `(x, y)` pairs are **warned**, not rejected: the chart will
 *   pick one arbitrarily (last-write-wins), which is almost always an
 *   upstream aggregation bug worth surfacing without hard-failing.
 */
function requireHeatmapEncoding(spec: ChartSpec): void {
  const requireCategorical = (channel: 'x' | 'y'): void => {
    const enc = spec.encoding[channel];
    if (enc === undefined) {
      throw new ChartSpecValidationError(
        `ChartSpec(type: 'heatmap') requires \`encoding.${channel}\`. A heatmap ` +
          `draws one cell per (x, y) pair; both axes are mandatory. Example: ` +
          `{ field: 'hour', type: 'categorical' }.`,
      );
    }
    if (enc.type !== 'categorical') {
      throw new ChartSpecValidationError(
        `For heatmaps, \`encoding.${channel}.type\` must be 'categorical'. ` +
          `Received: '${enc.type}'. Heatmaps in v1 do not auto-bin continuous ` +
          `data — pre-bin into discrete categories upstream and pass the binned ` +
          `field with \`type: 'categorical'\`. Example: ` +
          `{ field: '${enc.field}', type: 'categorical' }.`,
      );
    }
  };
  requireCategorical('x');
  requireCategorical('y');

  const color = spec.encoding.color;
  if (color === undefined) {
    throw new ChartSpecValidationError(
      `ChartSpec(type: 'heatmap') requires \`encoding.color\`. Color IS the ` +
        `heatmap's primary visual channel — without it the cells have nothing ` +
        `to encode. Example: { field: 'count', type: 'quantitative' }.`,
    );
  }
  if (color.type !== 'quantitative') {
    throw new ChartSpecValidationError(
      `For heatmaps, \`encoding.color.type\` must be 'quantitative'. Received: ` +
        `'${String(color.type)}'. Heatmaps require quantitative color (a sequential ` +
        `interpolator like viridis); a categorical-color heatmap is a different ` +
        `chart (more like a confusion matrix) and not in scope for v1. Example: ` +
        `{ field: '${color.field}', type: 'quantitative', scheme: 'viridis' }.`,
    );
  }

  if (spec.encoding.value === undefined) {
    throw new ChartSpecValidationError(
      `ChartSpec(type: 'heatmap') requires \`encoding.value\` — the field ` +
        `carrying each cell's numeric magnitude. Example: { field: 'count' }.`,
    );
  }

  // Warn (don't throw) on duplicate (x, y) pairs. The chart picks last-write-
  // wins; a duplicate is almost always an upstream aggregation bug.
  const xField = spec.encoding.x?.field;
  const yField = spec.encoding.y?.field;
  if (xField !== undefined && yField !== undefined) {
    const seen = new Set<string>();
    let duplicates = 0;
    for (const row of spec.data) {
      const key = `${String(row[xField])} ${String(row[yField])}`;
      if (seen.has(key)) duplicates += 1;
      else seen.add(key);
    }
    if (duplicates > 0) {
      console.warn(
        `pixi-charts: heatmap data has ${String(duplicates)} duplicate (x, y) ` +
          `pair(s) on fields ("${xField}", "${yField}"). The chart picks one ` +
          `arbitrarily per cell — usually a sign the upstream aggregation needs ` +
          `attention.`,
      );
    }
  }
}

export function validateChartSpec(input: unknown): ChartSpec {
  const parsed = chartSpecSchema.safeParse(input);
  if (!parsed.success) {
    const message = [
      'ChartSpec failed validation:',
      ...parsed.error.issues.map((issue) => formatIssue(issue, input)),
    ].join('\n');
    throw new ChartSpecValidationError(message);
  }
  const spec = parsed.data;

  if (spec.data.length === 0) {
    throw new ChartSpecValidationError(
      'ChartSpec.data is empty. A chart needs at least one row; double-check the data ' +
        'pipeline feeding this spec (filtered too aggressively? upstream fetch failed?).',
    );
  }

  // Forward-compat warning for unknown root keys, but only if the input
  // really is an object (zod has already enforced that for the parsed shape).
  if (typeof input === 'object' && input !== null) {
    for (const key of Object.keys(input)) {
      if (!KNOWN_SPEC_KEYS.has(key)) {
        console.warn(
          `ChartSpec: unknown top-level key "${key}" — ignored. Known keys: ${[
            ...KNOWN_SPEC_KEYS,
          ].join(', ')}.`,
        );
      }
    }
  }

  if (spec.type === 'line') requireXAndY(spec, 'line');
  if (spec.type === 'area') requireXAndY(spec, 'area');
  if (spec.type === 'bar') requireBarEncoding(spec);
  if (spec.type === 'scatter') requireScatterEncoding(spec);
  if (spec.type === 'heatmap') requireHeatmapEncoding(spec);

  // Field existence check. We sample the first row only — the spec
  // contract is that data is row-uniform, and walking every row is
  // wasteful for large inputs. Consumers with sparse rows can pre-fill.
  const firstRow = spec.data[0];
  if (firstRow !== undefined) {
    const availableFields = Object.keys(firstRow);
    const referenced: string[] = [];
    if (spec.encoding.x !== undefined) referenced.push(spec.encoding.x.field);
    if (spec.encoding.y !== undefined) referenced.push(spec.encoding.y.field);
    if (spec.encoding.color !== undefined) referenced.push(spec.encoding.color.field);
    if (spec.encoding.size !== undefined) referenced.push(spec.encoding.size.field);
    if (spec.encoding.value !== undefined) referenced.push(spec.encoding.value.field);

    for (const field of referenced) {
      if (!availableFields.includes(field)) {
        throw new ChartSpecValidationError(
          `ChartSpec encoding references field "${field}", but data rows do not contain it. ` +
            `Available fields in the first row: ${availableFields.map((f) => `"${f}"`).join(', ')}. ` +
            'Check for typos.',
        );
      }
    }
  }

  return spec;
}
