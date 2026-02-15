import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.NAPKIN_VERSION || process.env.npm_package_version || '0.0.0'),
  },
  resolve: {
    alias: {
      '@': '/src',
      '$lib': '/src/lib'
    }
  },
  // Tauri expects a relative base path
  base: './',
  // Clear dev server config for Tauri
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
