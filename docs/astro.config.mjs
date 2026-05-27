// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

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
        { label: 'API Reference', link: '/api/', badge: 'TODO' },
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
