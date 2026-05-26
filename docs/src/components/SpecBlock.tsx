import type { ChartSpec } from 'pixi-charts';

interface Props {
  spec: ChartSpec;
  dataPreview?: number;
}

/**
 * Renders a ChartSpec as a JSON code block.
 *
 * For specs whose `data` arrays are large (hero, perf demos), set
 * `dataPreview` to truncate the data array in the display while still
 * showing the structural shape consumers care about.
 */
export function SpecBlock({ spec, dataPreview }: Props) {
  const displaySpec =
    dataPreview !== undefined && spec.data.length > dataPreview
      ? {
          ...spec,
          data: [
            ...spec.data.slice(0, dataPreview),
            `/* … ${String(spec.data.length - dataPreview)} more rows omitted from this preview */`,
          ] as unknown as ChartSpec['data'],
        }
      : spec;

  const json = JSON.stringify(displaySpec, null, 2);

  return (
    <pre
      style={{
        background: 'var(--sl-color-bg-inline-code, #0d1117)',
        color: 'var(--sl-color-text, #c9d1d9)',
        padding: '1rem',
        borderRadius: '0.5rem',
        overflowX: 'auto',
        fontSize: '0.8125rem',
        lineHeight: 1.5,
        border: '1px solid var(--sl-color-hairline-light, #30363d)',
      }}
    >
      <code>{json}</code>
    </pre>
  );
}
