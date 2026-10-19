import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { imagetools } from 'vite-imagetools';
import { devApi } from './vite-plugins/dev-api.js';
import { seo } from './vite-plugins/seo.js';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), imagetools(), seo(), devApi({ mode })],
  server: { port: 5173, strictPort: false },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  test: {
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
    css: false,
  },
}));
