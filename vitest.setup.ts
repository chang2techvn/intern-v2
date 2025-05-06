import { vi } from 'vitest';

// Mock Encore modules to avoid requiring the Encore runtime
vi.mock('encore.dev', () => {
  return {
    default: {
      api: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      },
      auth: {
        requireAuth: vi.fn(() => ({ id: 'test-user-id' })),
      },
      cron: {
        every: vi.fn(),
      },
      pubsub: {
        topic: vi.fn(),
      },
    },
  };
});

// Set environment variables required by Encore
process.env.ENCORE_RUNTIME_LIB = 'mock-value';
process.env.ENCORE_APP_ENV = 'test';

// Mock other dependencies that might be used during testing
vi.mock('pg', () => {
  return {
    Pool: vi.fn(() => ({
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      }),
      query: vi.fn().mockResolvedValue({ rows: [] }),
    })),
  };
});