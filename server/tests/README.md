# CLIRDEC:PRESENCE Testing Suite

Comprehensive testing suite for the CLIRDEC:PRESENCE attendance management system.

## 🧪 Test Categories

### 1. Unit Tests (`tests/unit/`)

- **Purpose**: Test individual functions, methods, and components in isolation
- **Framework**: Jest with ts-jest
- **Coverage**: 80% minimum coverage required
- **Location**: `tests/unit/**/*.test.ts`

### 2. Integration Tests (`tests/integration/`)

- **Purpose**: Test API endpoints, database operations, and service interactions
- **Framework**: Jest with Supertest
- **Focus**: End-to-end API workflows, database integrity
- **Location**: `tests/integration/**/*.test.ts`

### 3. End-to-End Tests (`tests/e2e/`)

- **Purpose**: Test complete user workflows through the browser
- **Framework**: Playwright
- **Coverage**: Critical user journeys, UI interactions
- **Location**: `tests/e2e/**/*.test.ts`

### 4. Load Tests (`tests/load/`)

- **Purpose**: Performance testing under various load conditions
- **Framework**: Artillery.io
- **Scenarios**: Normal load, peak load, stress testing
- **Location**: `tests/load/artillery.yml`

## 🚀 Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Install Artillery globally (optional)
npm install -g artillery
```

### Test Commands

```bash
# Run all unit tests
npm run test:unit

# Run all integration tests
npm run test:integration

# Run all E2E tests
npm run test:e2e

# Run load tests
npm run test:load

# Run all tests
npm run test:all

# Run smoke tests (quick validation)
npm run test:smoke

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run E2E tests with UI
npm run test:e2e:ui
```

### CI/CD Pipeline

```bash
# Run all tests for CI
npm run test:ci
```

## 📊 Test Configuration

### Jest Configuration (`jest.config.js`)

- **Test Environment**: Node.js
- **Coverage Thresholds**: 80% branches, functions, lines, statements
- **Timeout**: 10 seconds per test
- **Setup Files**: `tests/setup.ts`
- **Global Setup/Teardown**: Database isolation

### Playwright Configuration (`playwright.config.ts`)

- **Browsers**: Chromium, Firefox, WebKit
- **Mobile Testing**: Pixel 5, iPhone 12
- **Parallel Execution**: Fully parallel
- **Screenshots**: On failure only
- **Videos**: On failure only
- **Traces**: On first retry

### Artillery Configuration (`tests/load/artillery.yml`)

- **Phases**: Warm-up, Normal Load, Peak Load, Stress Test, Recovery
- **Scenarios**: Authentication, Dashboard, Attendance, RFID Simulation
- **Metrics**: Response times, error rates, throughput

## 🏗️ Test Structure

```
tests/
├── setup.ts                    # Global test setup
├── globalSetup.ts             # Database setup
├── globalTeardown.ts          # Database cleanup
├── unit/                      # Unit tests
│   ├── services/
│   │   ├── monitoringService.test.ts
│   │   └── attendanceMonitor.test.ts
│   └── middleware/
│       └── errorHandler.test.ts
├── integration/               # Integration tests
│   ├── attendance.test.ts
│   └── auth.test.ts
├── e2e/                       # End-to-end tests
│   ├── attendance-flow.test.ts
│   └── dashboard.test.ts
├── load/                      # Load tests
│   └── artillery.yml
└── README.md
```

## 🧩 Test Utilities

### Global Test Helpers (`tests/setup.ts`)

```typescript
// Generate test data
global.testUtils.generateTestUser(overrides);
global.testUtils.generateTestStudent(overrides);
global.testUtils.generateTestSchedule(overrides);

// Mock HTTP objects
global.testUtils.createMockRequest(overrides);
global.testUtils.createMockResponse();
global.testUtils.createMockNext();
```

### Database Isolation

- **Global Setup**: Creates test database schema
- **Per-Test Isolation**: Transactions rolled back after each test
- **Global Teardown**: Cleans up test data

### Mock Services

- **WebSocket**: Mocked to avoid real-time complications
- **Email Service**: Mocked to prevent actual emails
- **Monitoring Service**: Mocked to avoid logging noise

## 🎯 Test Scenarios

### Unit Tests

- **MonitoringService**: Error logging, performance tracing, health checks
- **AttendanceMonitor**: RFID processing, sensor validation, statistics
- **ErrorHandler**: Custom error types, logging, response formatting
- **Validation**: Input sanitization, SQL injection prevention

### Integration Tests

- **Attendance API**: CRUD operations, validation, error handling
- **Authentication**: Login, session management, authorization
- **Database Operations**: Transactions, constraints, relationships
- **WebSocket Events**: Real-time updates, connection handling

### End-to-End Tests

- **Attendance Workflow**: RFID scan → sensor trigger → record creation
- **Manual Entry**: Form submission, validation, database persistence
- **Real-time Updates**: WebSocket events, UI updates
- **Error Scenarios**: Network failures, invalid data, edge cases

### Load Tests

- **Authentication Load**: 100 concurrent login attempts
- **Attendance Processing**: 50 concurrent RFID scans/second
- **Dashboard Access**: 200 concurrent dashboard loads
- **Report Generation**: 20 concurrent report requests

## 📈 Performance Benchmarks

### Response Time Targets

- **API Endpoints**: < 200ms average, < 500ms 95th percentile
- **Database Queries**: < 50ms average, < 100ms 95th percentile
- **Page Loads**: < 2s initial load, < 500ms subsequent loads

### Throughput Targets

- **Attendance Processing**: 100 RFID scans/second
- **API Requests**: 1000 requests/second
- **WebSocket Connections**: 500 concurrent connections

### Error Rate Targets

- **API Errors**: < 0.1% error rate
- **Database Errors**: < 0.01% error rate
- **WebSocket Errors**: < 1% disconnection rate

## 🔍 Test Coverage

### Code Coverage Requirements

```json
{
  "branches": 70,
  "functions": 80,
  "lines": 80,
  "statements": 80
}
```

### Coverage Areas

- **Services**: 90%+ coverage (core business logic)
- **Routes**: 80%+ coverage (API endpoints)
- **Middleware**: 85%+ coverage (request processing)
- **Utilities**: 75%+ coverage (helper functions)

## 🚨 Test Monitoring

### Test Results

- **JUnit XML**: `test-results/e2e-junit.xml`
- **JSON Results**: `test-results/e2e-results.json`
- **HTML Reports**: `playwright-report/index.html`
- **Coverage Reports**: `coverage/lcov-report/index.html`

### CI/CD Integration

- **GitHub Actions**: Automated test execution
- **Coverage Upload**: Codecov integration
- **Test Results**: Published as artifacts
- **Notifications**: Slack alerts on failures

## 🐛 Debugging Tests

### Running Specific Tests

```bash
# Run specific test file
npm test -- tests/unit/services/monitoringService.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should log errors"

# Run tests for specific path
npm run test:unit -- --testPathPattern=monitoringService
```

### Debugging E2E Tests

```bash
# Run with UI for debugging
npm run test:e2e:ui

# Run specific E2E test
npx playwright test tests/e2e/attendance-flow.test.ts

# Generate trace for debugging
npx playwright test --trace on
```

### Load Test Debugging

```bash
# Run load test with verbose output
artillery run --output test-results/load-test.json tests/load/artillery.yml

# Quick smoke test
artillery quick --count 10 --num 5 http://localhost:3000/health
```

## 📚 Best Practices

### Writing Tests

1. **Descriptive Names**: Test names should describe the behavior being tested
2. **Arrange-Act-Assert**: Clear separation of test setup, execution, and verification
3. **Independent Tests**: Each test should be able to run in isolation
4. **Mock External Dependencies**: Avoid testing external services directly
5. **Realistic Test Data**: Use data that represents real-world scenarios

### Test Organization

1. **One Concept Per Test**: Each test should verify one specific behavior
2. **Shared Setup**: Use `beforeEach`/`beforeAll` for common setup
3. **Cleanup**: Always clean up test data and reset mocks
4. **Timeouts**: Set appropriate timeouts for async operations
5. **Error Handling**: Test both success and error scenarios

### Performance Testing

1. **Gradual Load Increase**: Start with low load and gradually increase
2. **Realistic Scenarios**: Test actual user workflows, not just endpoints
3. **Resource Monitoring**: Monitor both application and infrastructure metrics
4. **Baseline Comparison**: Compare results against established baselines

## 🔧 Maintenance

### Adding New Tests

1. **Identify Test Type**: Unit, integration, or E2E
2. **Create Test File**: Follow naming convention `*.test.ts`
3. **Add to Appropriate Directory**: `unit/`, `integration/`, or `e2e/`
4. **Update Documentation**: Add new scenarios to this README

### Updating Test Configuration

1. **Jest Config**: Modify `jest.config.js` for new requirements
2. **Playwright Config**: Update `playwright.config.ts` for new browsers/devices
3. **Load Tests**: Modify `artillery.yml` for new scenarios

### CI/CD Updates

1. **GitHub Actions**: Update workflow files for new test requirements
2. **Docker**: Ensure test containers have necessary dependencies
3. **Secrets**: Add API keys/tokens for external service testing

This comprehensive testing suite ensures the reliability, performance, and quality of the CLIRDEC:PRESENCE system through automated validation at every level of the application stack.
