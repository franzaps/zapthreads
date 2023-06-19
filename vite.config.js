import { resolve } from 'path';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  publicDir: false,
  plugins: [
    solidPlugin(),
  ],
  build: {
    minify: true,
    lib: {
      entry: resolve(__dirname, 'src/ZapThreads.tsx'),
      name: 'ZapThreads',
      fileName: 'zapthreads',
      formats: ['iife']
    },
    rollupOptions: {
      // external: ['@nostr-dev-kit/ndk'],
      // output: {
      //   globals: {
      //     "@nostr-dev-kit/ndk": 'NDK',
      //   },
      // },
    },
  },
});