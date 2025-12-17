import { defineConfig } from 'vite';

export default defineConfig({
  // For GitHub Pages, set base to your repo name, or '/' for root
  base: process.env.GITHUB_PAGES ? '/eliza-creative/' : '/',
  build: {
    outDir: 'docs',
    assetsDir: 'assets',
    // Copy manifest.json to docs
    copyPublicDir: true
  },
  publicDir: 'public',
  server: {
    port: 3000,
    open: true
  }
});
