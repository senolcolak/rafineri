# Rafineri Testing Guide

> Complete guide for testing the Rafineri platform

---

## 🧪 Test Structure

```
rafineri/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   └── test/
│   │       ├── unit/           # Unit tests
│   │       ├── integration/    # Integration tests
│   │       ├── e2e/            # End-to-end tests
│   │       └── setup.ts        # Test setup
│   │
│   └── worker/
│       └── src/
│           └── scoring/__tests__/  # Worker tests
│
├── packages/
│   └── shared/
│       └── src/**/*.spec.ts    # Shared package tests
│
└── scripts/
    └── test.sh                 # Run all tests
```

---

## 🚀 Quick Start

### Run All Tests

```bash
# Run all tests across the monorepo
./scripts/test.sh

# Or using pnpm
pnpm test
```

### Run Tests for Specific App

```bash
# API tests
pnpm --filter api test

# Worker tests
pnpm --filter worker test

# Watch mode
pnpm --filter api test:watch

# Coverage
pnpm --filter api test:cov
```

---

## 📋 Test Types

### 1. Unit Tests

Test individual services and components in isolation.

**Location**: `apps/api/test/unit/`, `apps/worker/src/**/__tests__/`

```typescript
// Example: Testing AdminService
describe('AdminService', () => {
  it('should return dashboard stats', async () => {
    const result = await service.getDashboardStats();
    expect(result).toHaveProperty('totalStories');
  });
});
```

**Run**:
```bash
pnpm --filter api test -- --testPathPattern=unit
```

### 2. Integration Tests

Test API endpoints with database and dependencies.

**Location**: `apps/api/test/integration/`

```typescript
// Example: Testing AdminController
describe('AdminController', () => {
  it('should return dashboard with auth', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
```

**Run**:
```bash
pnpm --filter api test -- --testPathPattern=integration
```

### 3. E2E Tests

Test complete user flows and smoke tests.

**Location**: `apps/api/test/e2e/`

```bash
# Run E2E tests
pnpm --filter api test:e2e
```

---

## ⚙️ Configuration

### Environment Variables

Tests use `.env.test`:

```bash
# apps/api/.env.test
NODE_ENV=test
DATABASE_URL=postgresql://rafineri:rafineri@localhost:5432/rafineri_test
ADMIN_TOKEN=test-admin-token
MOCK_MODE=true
USE_LOCAL_AI=false
```

### Jest Configuration

**API**: `apps/api/jest.config.js`
- Root dir: `.`
- Test regex: `.*\.spec\.ts$`
- Coverage: `src/**/*.(t|j)s`
- Module aliases: `@/` → `src/`

**Worker**: `apps/worker/jest.config.js`
- Similar config, tests in `src/` directory

---

## 📝 Writing Tests

### Service Unit Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MyService } from './my.service';

describe('MyService', () => {
  let service: MyService;
  let mockDependency: any;

  beforeEach(async () => {
    mockDependency = {
      method: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyService,
        {
          provide: 'DEPENDENCY_TOKEN',
          useValue: mockDependency,
        },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should do something', async () => {
      // Arrange
      mockDependency.method.mockResolvedValue('result');

      // Act
      const result = await service.methodName();

      // Assert
      expect(result).toBe('result');
      expect(mockDependency.method).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockDependency.method.mockRejectedValue(new Error('Fail'));

      await expect(service.methodName()).rejects.toThrow('Fail');
    });
  });
});
```

### Controller Integration Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Controller (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/endpoint (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/endpoint')
      .expect(200);

    expect(response.body).toBeDefined();
  });
});
```

---

## 🎯 Test Coverage

### Current Coverage Areas

| Module | Unit | Integration | E2E |
|--------|------|-------------|-----|
| AdminService | ✅ | ✅ | ✅ |
| StoriesService | ✅ | ✅ | ✅ |
| ScoringService | ✅ | ❌ | ✅ |
| ClusteringService | ❌ | ❌ | ❌ |

### Generate Coverage Report

```bash
# API coverage
pnpm --filter api test:cov

# View report
open apps/api/coverage/lcov-report/index.html
```

---

## 🔧 Mocking

### Database Mock

```typescript
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([{ id: 1 }]),
  execute: jest.fn(),
};
```

### Redis Mock

```typescript
const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
};
```

### External Service Mock

```typescript
const mockAiService = {
  scoreStory: jest.fn().mockResolvedValue({
    label: 'verified',
    confidence: 0.9,
  }),
};
```

---

## 🐛 Debugging Tests

### Verbose Output

```bash
pnpm --filter api test -- --verbose
```

### Debug Specific Test

```bash
pnpm --filter api test -- --testNamePattern="should return dashboard"
```

### Debug with Node Inspector

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open Chrome DevTools and connect to `chrome://inspect`.

---

## 📊 CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: rafineri
          POSTGRES_PASSWORD: rafineri
          POSTGRES_DB: rafineri_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run tests
        run: ./scripts/test.sh
        env:
          DATABASE_URL: postgresql://rafineri:rafineri@localhost:5432/rafineri_test
          REDIS_URL: redis://localhost:6379
```

---

## 🎓 Best Practices

### DO ✅

- **Mock external dependencies** (database, Redis, AI services)
- **Test both success and error cases**
- **Use descriptive test names** (`should return 404 for non-existent story`)
- **Clean up after tests** (close connections, clear mocks)
- **Keep tests independent** (no shared state between tests)

### DON'T ❌

- **Don't test implementation details** (test behavior, not code structure)
- **Don't use real external services** in unit tests
- **Don't skip error cases**
- **Don't let tests depend on order**

---

## 📚 Test Utilities

### Global Test Helpers

```typescript
// In test/setup.ts
global.testUtils = {
  createMockStory: (overrides = {}) => ({
    id: '1',
    title: 'Test Story',
    ...overrides,
  }),
};

// Usage in tests
const story = testUtils.createMockStory({ label: 'verified' });
```

### Database Helpers

```typescript
// helpers/database.ts
export async function setupTestDatabase() {
  // Run migrations
  // Insert test data
}

export async function teardownTestDatabase() {
  // Clean up test data
}
```

---

## 🚨 Troubleshooting

### Common Issues

**Problem**: Tests fail with "Cannot find module"

**Solution**: Check `moduleNameMapper` in jest.config.js

```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
},
```

---

**Problem**: Database connection timeout

**Solution**: Increase test timeout and ensure test database exists

```bash
# Create test database
docker exec rafineri-postgres createdb -U rafineri rafineri_test
```

---

**Problem**: Redis connection refused

**Solution**: Use mock Redis or ensure Redis is running

```typescript
// Use mock in unit tests
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
};
```

---

## 📈 Test Metrics

Run this to see test statistics:

```bash
# Count tests
find apps -name "*.spec.ts" -o -name "*.test.ts" | wc -l

# Run with timing
pnpm --filter api test -- --verbose --detectOpenHandles
```

---

## ✅ Pre-Commit Checklist

Before committing:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Coverage hasn't decreased
- [ ] No test.only() left in code
- [ ] No console.log() in tests (unless debugging)

---

## 🎯 Coverage Goals

| Priority | Target | Current |
|----------|--------|---------|
| Critical paths | 90% | 70% |
| Services | 80% | 60% |
| Controllers | 70% | 80% |
| Overall | 75% | 65% |

---

**Happy Testing! 🧪**
