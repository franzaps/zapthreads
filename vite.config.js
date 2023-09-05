import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
  publicDir: false,
  plugins: [
    solidPlugin(),
    viteCompression({ algorithm: 'brotliCompress' }),
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