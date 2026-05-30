import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Docs-package vitest setup. The only test today is the example-spec
 * regression guard (`tests/examples.test.ts`) — it imports every spec the
 * docs site renders and exercises it against the real library under a
 * mocked pixi.js. Any API change that breaks a docs example fails the build
 * here before the docs site can ship a broken sample.
 *
 * The `pixi-charts` alias points vitest at the library's source rather
 * than its built `dist/`, so the harness runs on a fresh checkout without
 * needing `pnpm build` first.
 */
export default defineConfig({
  resolve: {
    alias: {
      'pixi-charts': fileURLToPath(
        new URL('../packages/pixi-charts/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
  },
});
