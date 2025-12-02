import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import eslint from 'vite-plugin-eslint';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import svgrPlugin from 'vite-plugin-svgr';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

const PROXY_ENDPOINT = 'http://localhost:7007';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./setupVitest.ts'],
      coverage: {
        reporter: ['text', 'html', 'cobertura', 'lcov', 'json-summary'],
        exclude: [
          '**/node_modules/**',
          '**/build/**',
          '**/*.js',
          '**/*.jsx',
          '**/*.cjs',
          '**/*.mjs',
          'src/main.tsx',
        ],
      },
    },
    plugins: [
      react(),
      eslint(),
      wasm(),
      topLevelAwait(),
      viteTsconfigPaths(),
      svgrPlugin(),
      tailwindcss(),
    ],
    optimizeDeps: {
      exclude: ['wasm-image-preview'],
    },
    server: {
      fs: {
        // Allow serving files from one level up to the project root
        allow: ['..'],
      },
      watch: {
        ignored: ['coverage', 'build'],
      },
      proxy: {
        '/api/': {
          target: PROXY_ENDPOINT,
          changeOrigin: true,
          secure: false,
        },
        '/graphql': {
          target: PROXY_ENDPOINT,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
