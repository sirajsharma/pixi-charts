// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

// https://astro.build/config
export default defineConfig({
  integrations: [
    react(),
    starlight({
      title: 'Pixi Charts',
      description: 'A WebGL-rendered TypeScript charting library handling 100k+ points at 60fps.',
      customCss: ['./src/styles/hero.css', './src/styles/perf.css'],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/sirajsharma/pixi-charts',
        },
      ],
      plugins: [
        starlightTypeDoc({
          entryPoints: ['../packages/pixi-charts/src/index.ts'],
          tsconfig: '../packages/pixi-charts/tsconfig.json',
          output: 'api',
          sidebar: {
            label: 'API Reference',
            collapsed: false,
          },
          typeDoc: {
            excludeInternal: true,
            excludePrivate: true,
            githubPages: false,
          },
        }),
      ],
      sidebar: [
        { label: 'Introduction', link: '/' },
        { label: 'Getting Started', link: '/getting-started/' },
        {
          label: 'Chart Gallery',
          items: [
            { label: 'Line Chart', link: '/charts/line/' },
            { label: 'Area Chart', link: '/charts/area/' },
            { label: 'Bar Chart', link: '/charts/bar/' },
            { label: 'Scatter Chart', link: '/charts/scatter/' },
            { label: 'Heatmap', link: '/charts/heatmap/' },
            { label: 'Pie & Donut', link: '/charts/pie/' },
          ],
        },
        { label: 'Performance', link: '/performance/' },
        typeDocSidebarGroup,
      ],
    }),
  ],
  vite: {
    ssr: {
      noExternal: ['pixi-charts'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'chart.js'],
    },
  },
});
