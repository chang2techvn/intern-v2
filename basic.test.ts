import { describe, it, expect } from 'vitest';

// Root level test file to ensure tests are found in CI
describe('Basic test suite in root directory', () => {
  it('should pass basic assertions', () => {
    expect(true).toBe(true);
    expect(1 + 1).toBe(2);
  });
});