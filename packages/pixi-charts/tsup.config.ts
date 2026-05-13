import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2020',
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: false,
  external: [
    'pixi.js',
    'd3-array',
    'd3-color',
    'd3-format',
    'd3-quadtree',
    'd3-scale',
    'd3-scale-chromatic',
    'd3-shape',
    'd3-time-format',
    'zod',
  ],
});
