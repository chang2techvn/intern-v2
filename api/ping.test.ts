import { describe, it, expect } from 'vitest';

// Simple isolated test that doesn't rely on Encore runtime
describe('Basic test suite', () => {
  it('should pass basic assertions', () => {
    expect(true).toBe(true);
    expect(1 + 1).toBe(2);
  });
});