import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@fws/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@fws/generator': path.resolve(__dirname, 'packages/generator/src/index.ts'),
      '@fws/renderer': path.resolve(__dirname, 'packages/renderer/src/index.ts'),
      '@fws/narrative': path.resolve(__dirname, 'packages/narrative/src/index.ts'),
      '@fws/cli': path.resolve(__dirname, 'packages/cli/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.{test,spec}.ts', '**/index.ts'],
    },
  },
});
