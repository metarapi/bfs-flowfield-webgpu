import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import glsl from 'vite-plugin-glsl';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    tailwindcss(),
    glsl(),
  ],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // Keep assets as separate files
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const extType = info[info.length - 1];
          if (/wgsl/.test(extType)) {
            return 'src/shaders/[name][extname]';
          }
          if (/csv/.test(extType)) {
            return 'src/assets/[name][extname]';
          }
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