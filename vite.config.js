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
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Simplify asset naming - only handle specific file types
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const extType = info[info.length - 1];
          if (/wgsl/.test(extType)) {
            return 'src/shaders/[name][extname]';
          }
          if (/csv/.test(extType)) {
            return 'src/assets/[name][extname]';
          }
          // Use default naming for CSS/JS and other assets
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  assetsInclude: ['**/*.wgsl', '**/*.csv'],
  server: {
    port: 3000,
  }
});