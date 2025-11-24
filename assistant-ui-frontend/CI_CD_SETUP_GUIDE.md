# CI/CD Test Setup Guide
## Scottish AI Lessons - Assistant UI Frontend

This guide explains how to set up and run the CI/CD test suite after the test audit cleanup.

---

## Quick Start

### Run Smoke Tests (Tier 1 - Critical Path)
```bash
npm run test:smoke           # Playwright smoke tests
npm run test:integration     # Jest integration tests
```
**Expected runtime:** ~2-3 minutes

### Run Core Features (Tier 2 - PR Validation)
```bash
npm run test:auth            # Auth flows
npm run test:security        # Security tests
npx playwright test tests/middleware.spec.ts  # Middleware
```
**Expected runtime:** ~8-12 minutes

### Run Full Suite (Tier 3 - Nightly)
```bash
npm run test                 # All Playwright tests
npm run test:jest            # All Jest tests
```
**Expected runtime:** ~25-35 minutes

---

## Test Suite Structure

### Tier 1: Critical Path (Every Commit)

**Purpose:** Catch breaking changes quickly
**When:** On every push to main/develop

**Tests:**
- ✅ `tests/smoke-tests.spec.ts` - Homepage, navigation, auth redirects
- ✅ `__tests__/integration/api/completion.test.ts` - Lesson completion API

**How to run:**
```bash
npm run test:smoke
npm run test:integration
```

**CI/CD:** GitHub Actions on push (see `.github/workflows/ci-tests.yml`)

### Tier 2: Core Features (PR Merge)

**Purpose:** Validate auth and security before merge
**When:** On pull request

**Tests:**
- ✅ `tests/auth-flows.spec.ts` - Signup, login, validation
- ✅ `tests/security.spec.ts` - XSS, CSRF, SQLi protection
- ✅ `tests/middleware.spec.ts` - Route protection

**How to run:**
```bash
npm run test:auth
npm run test:security
npx playwright test tests/middleware.spec.ts
```

**CI/CD:** GitHub Actions on PR

### Tier 3: Full Suite (Nightly)

**Purpose:** Comprehensive regression testing
**When:** Scheduled nightly at 2 AM UTC

**Tests:** All 22 test files including:
- Auth flows
- Security
- OAuth
- Password reset
- Drawing features
- Context chat
- Lesson progress
- Component tests
- All Jest integration tests

**How to run:**
```bash
npm run test        # All Playwright
npm run test:jest   # All Jest
```

**CI/CD:** GitHub Actions scheduled run

---

## Configuration

### Environment Variables

Create `.env.local` with:
```env
# Appwrite Backend
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id

# LangGraph Backend
NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:2024

# Test User (for e2e tests)
TEST_USER_EMAIL=test@scottishailessons.com
TEST_USER_PASSWORD=red12345
```

### GitHub Secrets

Configure these in your GitHub repository settings:

```
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id
LANGGRAPH_API_URL=http://localhost:2024
SLACK_BOT_TOKEN=xoxb-your-token  # Optional for notifications
```

### Test Configuration Files

- **`jest.config.js`** - Jest unit/integration test config
  - ✅ Fixed ESM module transforms
  - ✅ Fixed ts-jest deprecation warning
  - Timeout: 30 seconds
  - Environment: jsdom

- **`playwright.config.ts`** - Playwright e2e test config
  - Workers: 1 (prevents Appwrite rate limiting)
  - Browsers: Chromium, Firefox, WebKit, Mobile Chrome
  - Retries: 2 in CI, 0 locally
  - Base URL: http://localhost:3000

---

## Known Issues & Fixes

### ✅ Issue #1: Obsolete Demo Tests (RESOLVED)

**Status:** Fixed ✅

**What we did:**
- Removed `tests/demo-playwright.spec.ts` (420 lines)
- Removed `tests/test-runner.spec.ts` (74 lines)

**Why:** These were example/meta-tests that didn't verify actual application functionality.

### ✅ Issue #2: Completion API Test Assertions (RESOLVED)

**Status:** Fixed ✅

**What we did:**
- Updated test expectations to include `conversationHistoryPersisted` field
- Tests now pass with current API response format

### ⚠️ Issue #3: Jest ESM Module Configuration (PARTIALLY RESOLVED)

**Status:** Partially Fixed ⚠️

**Problem:** Jest cannot parse ESM modules in `node-appwrite` and `node-fetch-native-with-agent`

**What we did:**
- Updated `jest.config.js` transformIgnorePatterns
- Fixed ts-jest deprecation warning
- Moved ts-jest config out of globals

**Current Status:**
- ✅ `completion.test.ts` - PASSING
- ⚠️ `EvidenceDriver.test.ts` - Still failing
- ⚠️ `SOWDriver.test.ts` - Still failing
- ⚠️ `MasteryDriver.test.ts` - Still failing

**Error:**
```
SyntaxError: Unexpected token 'export'
node_modules/node-fetch-native-with-agent/dist/native.mjs:1
```

**Next Steps to Fix:**

Option 1: Add jest-environment-node-single-context (recommended)
```bash
npm install --save-dev jest-environment-node-single-context
```

Update jest.config.js:
```javascript
testEnvironment: 'jest-environment-node-single-context',
```

Option 2: Mock the problematic modules
```javascript
moduleNameMapper: {
  '^node-fetch-native-with-agent$': '<rootDir>/__mocks__/node-fetch.js'
}
```

Option 3: Use experimental ESM support
```javascript
// package.json
"jest": {
  "extensionsToTreatAsEsm": [".ts"],
  "transform": {
    "^.+\\.tsx?$": ["ts-jest", {
      "useESM": true
    }]
  }
}
```

### ⚠️ Issue #4: Playwright Integration Tests Using Jest Globals

**Status:** Identified, not yet fixed ⚠️

**Problem:** 4 integration tests in `tests/integration/` import `@jest/globals` but run with Playwright

**Affected Files:**
- `tests/integration/session-history-persistence.test.ts`
- `tests/integration/session-completion.test.ts`
- `tests/integration/session-replay-cleanup-example.test.ts`
- `tests/integration/appwrite-schema-validation.test.ts`

**How to Fix:**

Option A: Convert to Playwright (recommended)
```typescript
// Before
import { describe, it, expect } from '@jest/globals';

// After
import { test as it, expect } from '@playwright/test';
```

Option B: Move to Jest
```bash
mv tests/integration/*.test.ts __tests__/integration/
```

---

## Test Data Management

### Test User

**Email:** `test@scottishailessons.com`
**Password:** `red12345`

This user should be flagged as a test account in your database to prevent accidental deletion.

**Flag test users:**
```bash
npm run flag-test-users
```

### Cleanup After Tests

Most tests clean up after themselves, but if you see orphaned test data:

```bash
# Connect to Appwrite console
# Navigate to databases
# Filter by studentId or email containing "test"
# Bulk delete test records
```

---

## Debugging Failed Tests

### Playwright Failures

1. **Run in headed mode:**
   ```bash
   npm run test:headed
   # or
   npx playwright test --headed
   ```

2. **Debug specific test:**
   ```bash
   npm run test:debug
   # or
   npx playwright test --debug tests/auth-flows.spec.ts
   ```

3. **View HTML report:**
   ```bash
   npm run test:report
   # or
   npx playwright show-report
   ```

4. **Check screenshots/videos:**
   ```
   playwright-report/
   test-results/
   ```

### Jest Failures

1. **Run in watch mode:**
   ```bash
   npm run test:integration:watch
   ```

2. **Run specific test file:**
   ```bash
   npx jest __tests__/integration/api/completion.test.ts
   ```

3. **Verbose output:**
   ```bash
   npx jest --verbose
   ```

4. **Check logs:**
   - Jest outputs to console by default
   - Look for `console.log` statements in test output

---

## Performance Optimization

### Parallel Execution

**Playwright:**
```bash
# Fast (4 workers)
npm run test:parallel

# Slow but stable (1 worker) - use for CI
npm run test:serial
```

**Why 1 worker for CI?**
Appwrite Cloud has rate limits. Parallel tests cause "Project not found" errors when too many requests hit the API simultaneously.

### Test Isolation

Each test should:
- ✅ Clear cookies before running
- ✅ Use unique test data (UUID-based IDs)
- ✅ Clean up created records after test
- ✅ Not depend on other tests' state

### Caching

GitHub Actions caches `node_modules` using:
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
```

This speeds up CI runs by ~2-3 minutes.

---

## Adding New Tests

### Playwright Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/your-route');
  });

  test('should do something', async ({ page }) => {
    // Arrange
    const button = page.locator('[data-testid="submit"]');

    // Act
    await button.click();

    // Assert
    await expect(page).toHaveURL('/success');
  });
});
```

### Jest Test Template

```typescript
import { describe, it, expect } from '@jest/globals';

describe('Feature Name', () => {
  it('should do something', () => {
    // Arrange
    const input = { foo: 'bar' };

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

---

## Continuous Improvement

### Code Coverage

**Not yet configured** - Consider adding:

```bash
npm install --save-dev @playwright/test-coverage
```

Update playwright.config.ts:
```typescript
use: {
  coverage: {
    enabled: true,
    reporter: ['html', 'lcov']
  }
}
```

Target: 70% coverage for critical paths

### Visual Regression

Playwright supports screenshot comparison:

```typescript
await expect(page).toHaveScreenshot('homepage.png');
```

Consider adding for:
- Landing page
- Dashboard
- Lesson cards
- Drawing canvas

### Performance Monitoring

Add timing assertions:

```typescript
test('should load dashboard fast', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  const loadTime = Date.now() - startTime;

  expect(loadTime).toBeLessThan(3000); // 3 seconds max
});
```

---

## Troubleshooting

### "Project not found" errors in CI

**Cause:** Appwrite rate limiting from parallel tests

**Fix:** Use `workers: 1` in playwright.config.ts (already configured)

### "No session found" errors

**Cause:** Cookie not persisted between requests

**Fix:** Ensure test uses `page.context()` properly and doesn't clear cookies mid-test

### "Timed out waiting for element"

**Cause:** Element takes longer to render than default timeout

**Fix:** Increase timeout or wait for specific state:
```typescript
await page.waitForSelector('[data-testid="card"]', { timeout: 10000 });
```

### Module resolution errors

**Cause:** TypeScript path aliases not configured

**Fix:** Ensure `jest.config.js` has:
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/$1'
}
```

---

## Next Steps

1. ✅ **Fix remaining Jest ESM issues** (~1-2 hours)
   - Try jest-environment-node-single-context
   - Or add module mocks

2. ✅ **Convert Playwright integration tests** (~1-2 hours)
   - Remove @jest/globals imports
   - Use Playwright test API

3. ✅ **Test CI/CD pipeline** (~1 hour)
   - Push to feature branch
   - Verify Tier 1 runs automatically
   - Check GitHub Actions logs

4. 📊 **Add code coverage** (~2-3 hours)
   - Configure Playwright coverage
   - Set target thresholds
   - Add coverage badge to README

5. 📸 **Add visual regression** (~4-6 hours)
   - Screenshot critical pages
   - Set up baseline images
   - Configure difference threshold

6. 📈 **Monitor and optimize** (ongoing)
   - Track test execution time
   - Fix flaky tests
   - Add tests for new features

---

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Jest Documentation](https://jestjs.io/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Appwrite Testing Guide](https://appwrite.io/docs/testing)
- [Test Audit Report](./TEST_AUDIT_REPORT.md)

---

**Last Updated:** November 24, 2025
**Maintainer:** Development Team
**Questions?** Contact the team or create a GitHub issue
