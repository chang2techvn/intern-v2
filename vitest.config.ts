import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    mockReset: true,
    setupFiles: ['./vitest.setup.ts'],
    isolate: true,
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    testTimeout: 10000
  }
});