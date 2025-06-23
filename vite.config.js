import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import glsl from 'vite-plugin-glsl';
import { resolve } from 'path';

export default defineConfig({
  base: '/BFS-Flowfield-webgpu/',
  plugins: [
    tailwindcss(),
    glsl(),
  ],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  assetsInclude: ['**/*.wgsl', '**/*.csv'],
  server: {
    port: 3000,
  }
});