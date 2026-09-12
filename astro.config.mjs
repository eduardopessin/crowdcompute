import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://crowdcompute.eu',
  output: 'static',
  build: { inlineStylesheets: 'never' },
  vite: { build: { assetsInlineLimit: 0 } },
});
