import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    mockReset: true,
    setupFiles: ['./vitest.setup.ts'],
    isolate: true,
    include: [
      './**/*.test.ts',
      './api/**/*.test.ts'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**'
    ],
    testTimeout: 10000,
    globals: true,
    root: __dirname
  }
});