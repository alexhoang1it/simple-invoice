/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    resolve: {
      alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) },
    },

    server: {
      port: 5174,
      host: true,
      proxy: {
        // The app only ever calls /api/*. Vite forwards those in development,
        // nginx does the same in the container, so no API host is ever baked
        // into the bundle.
        '/api': {
          target: env.VITE_API_PROXY ?? 'http://localhost:4000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },

    build: { outDir: 'dist', sourcemap: true },

    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/**/*.d.ts'],
        thresholds: { statements: 60, branches: 60, functions: 60, lines: 60 },
      },
    },
  };
});
