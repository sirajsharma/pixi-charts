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

const encodingFieldSchema = z.object({
  field: z.string(),
  type: fieldTypeSchema,
});

const colorEncodingSchema = z.object({
  field: z.string(),
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
 * - For `type: 'line'`, both `encoding.x` and `encoding.y` are required.
 *
 * Other chart types' encoding rules will be added alongside their
 * implementations; today they pass shape validation but throw at the
 * dispatcher level with a "not implemented yet" message.
 *
 * Unknown top-level keys do NOT fail validation — a `console.warn` is
 * emitted instead. This protects consumers writing forward-compat code
 * (e.g. setting a future `theme:` field) without locking the spec.
 */
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

  if (spec.type === 'line') {
    const missing: string[] = [];
    if (spec.encoding.x === undefined) missing.push('encoding.x');
    if (spec.encoding.y === undefined) missing.push('encoding.y');
    if (missing.length > 0) {
      throw new ChartSpecValidationError(
        `ChartSpec(type: 'line') requires ${missing.join(' and ')}. Example: ` +
          `{ x: { field: 'date', type: 'temporal' }, y: { field: 'revenue', type: 'quantitative' } }.`,
      );
    }
  }

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
