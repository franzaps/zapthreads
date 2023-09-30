import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import dts from "vite-plugin-dts";

export default defineConfig({
  publicDir: false,
  plugins: [
    solidPlugin(),
    dts({ insertTypesEntry: true, rollupTypes: true }),
  ],
  build: {
    minify: 'terser',
    lib: {
      entry: './src/index.tsx',
      name: 'ZapThreads',
      fileName: 'zapthreads',
      formats: ['es', 'umd', 'iife']
    },
  },
});