import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';

export default defineConfig({
  plugins: [
    solidPlugin(),
    devtools()
  ],
  server: {
    port: 3000,
    hmr: false,
  },
  build: {
    target: "esnext"
  },
});