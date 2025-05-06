import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    mockReset: true,
    setupFiles: ['./vitest.setup.ts'],
    isolate: true,
    include: [
      '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'api/**/*.test.ts'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**'
    ],
    testTimeout: 10000,
    globals: true,
    root: path.resolve(__dirname)
  }
});