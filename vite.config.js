import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  publicDir: false,
  plugins: [
    solidPlugin(),
  ],
  build: {
    minify: 'terser',
    lib: {
      entry: './src/index.tsx',
      name: 'ZapThreads',
      fileName: 'zapthreads',
      formats: ['cjs', 'umd', 'iife']
    },
  },
});