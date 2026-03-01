// Jest setup file for API tests
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set default test timeout
jest.setTimeout(30000);

// Mock console methods during tests to reduce noise
// Uncomment if you want cleaner test output
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Global test utilities
declare global {
  // eslint-disable-next-line no-var
  var testUtils: {
    createMockRequest: (overrides?: any) => any;
    createMockResponse: () => any;
    createMockStory: (overrides?: any) => any;
  };
}

global.testUtils = {
  createMockRequest: (overrides = {}) => ({
    headers: {},
    params: {},
    query: {},
    body: {},
    user: null,
    ...overrides,
  }),

  createMockResponse: () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  }),

  createMockStory: (overrides = {}) => ({
    id: '1',
    title: 'Test Story',
    summary: 'Test summary',
    label: 'verified',
    confidence: 0.9,
    hotScore: 85,
    evidenceCount: 5,
    contradictionsCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};

// Clean up after all tests
afterAll(async () => {
  // Add any global cleanup here
  // e.g., close database connections, clear caches
});
