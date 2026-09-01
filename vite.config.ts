import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
  // Set this to your repo name when deploying to GitHub Pages
  // Example: If your repo is github.com/username/food-map
  // Set base to '/food-map/'
  base: '/',

  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },

  // Dev server configuration
  server: {
    port: 5173,
    open: true, // Auto-open browser
  },

  // Preview server (for testing production build)
  preview: {
    port: 4173,
  },
});