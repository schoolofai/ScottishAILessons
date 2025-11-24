# Test Suite Audit Report
## Scottish AI Lessons - Assistant UI Frontend

**Date:** November 24, 2025
**Auditor:** Claude
**Purpose:** Identify obsolete tests and establish CI/CD test suite

---

## Executive Summary

The frontend currently has **24 test files** split between:
- **Jest unit/integration tests** (4 files in `__tests__/`)
- **Playwright e2e tests** (20 files in `tests/`)

**Key Findings:**
- ✅ **2 obsolete files removed** (demo-playwright.spec.ts, test-runner.spec.ts)
- ⚠️ **3 Jest integration tests failing** due to ESM module configuration issues
- ✅ **Most Playwright tests are functional** and cover critical user journeys
- 🔧 **Configuration issues** need fixing before CI/CD deployment

---

## Test Inventory

### Jest Tests (`__tests__/integration/`)

| Test File | Purpose | Status | CI/CD Priority |
|-----------|---------|--------|----------------|
| `EvidenceDriver.test.ts` | Tests evidence recording API and data persistence | ❌ **BROKEN** (ESM import issues) | **HIGH** |
| `SOWDriver.test.ts` | Tests Scheme of Work driver and reference architecture | ❌ **BROKEN** (ESM import issues) | **HIGH** |
| `MasteryDriver.test.ts` | Tests mastery tracking and EMA calculations | ❌ **BROKEN** (ESM import issues) | **HIGH** |
| `api/completion.test.ts` | Tests lesson completion API endpoint | ✅ **PASSING** | **CRITICAL** |

**Issue:** Jest cannot parse ESM modules (`node-fetch-native-with-agent`, `node-appwrite`). Need to update `jest.config.js` transformIgnorePatterns.

### Playwright E2E Tests (`tests/`)

#### 🎯 Critical Path Tests (KEEP for CI/CD)

| Test File | Purpose | Lines | CI/CD Priority |
|-----------|---------|-------|----------------|
| `smoke-tests.spec.ts` | Critical path verification - homepage, navigation, auth redirects | 254 | **CRITICAL** |
| `auth-flows.spec.ts` | Email/password signup, login, validation | 379 | **CRITICAL** |
| `security.spec.ts` | XSS, CSRF, SQL injection, session security | 484 | **HIGH** |
| `middleware.spec.ts` | Auth middleware, route protection, redirects | 316 | **HIGH** |
| `e2e-real-auth.spec.ts` | Real authentication with test@scottishailessons.com | 150 | **MEDIUM** |

#### 🧪 Feature-Specific Tests (KEEP for full test runs)

| Test File | Purpose | Lines | CI/CD Priority |
|-----------|---------|-------|----------------|
| `landing.spec.ts` | Landing page elements and navigation | 108 | **LOW** |
| `password-reset.spec.ts` | Password recovery flow | 437 | **MEDIUM** |
| `oauth.spec.ts` | Google OAuth integration | 350 | **MEDIUM** |
| `context-chat-journey.spec.ts` | Context chat backend integration | 181 | **MEDIUM** |
| `lesson-progress.spec.ts` | Lesson progress tracking | 326 | **MEDIUM** |

#### 🎨 Drawing & Storage Tests (KEEP - specialized features)

| Test File | Purpose | Lines | Status |
|-----------|---------|-------|--------|
| `EvidenceDriver.drawing.test.ts` | Drawing evidence persistence | 480 | Keep |
| `StudentDrawingStorageDriver.test.ts` | Drawing storage driver | 368 | Keep |

#### 🔬 Integration Tests (Playwright environment)

These are in `tests/integration/` but use Playwright:

| Test File | Purpose | Lines | Issue |
|-----------|---------|-------|-------|
| `session-history-persistence.test.ts` | Session history persistence | 16,240 chars | ⚠️ Uses `@jest/globals` in Playwright |
| `session-completion.test.ts` | Session completion flow | 7,388 chars | ⚠️ Uses `@jest/globals` in Playwright |
| `session-replay-cleanup-example.test.ts` | Session replay cleanup | 17,137 chars | ⚠️ Uses `@jest/globals` in Playwright |
| `appwrite-schema-validation.test.ts` | Appwrite schema validation | 9,795 chars | ⚠️ Uses `@jest/globals` in Playwright |

**Issue:** These tests import `@jest/globals` but run with Playwright. Need to either:
1. Move to `__tests__/` and run with Jest
2. Convert to use Playwright's `test` API

#### 📦 Component Tests (`tests/components/`)

| Test File | Purpose | Status |
|-----------|---------|--------|
| `error-states-loading.spec.ts` | Error and loading states | Keep |
| `reason-badge.spec.ts` | Badge component | Keep |
| `user-interaction-flows.spec.ts` | User interaction patterns | Keep |
| `enhanced-student-dashboard.spec.ts` | Dashboard features | Keep |
| `course-navigation-tabs.spec.ts` | Course navigation | Keep |

---

## Removed Tests (Obsolete)

### ❌ `tests/demo-playwright.spec.ts` (420 lines)
**Reason:** Demo/example file showing Playwright MCP integration patterns
**Status:** **REMOVED** ✅

**Evidence:**
```typescript
/**
 * Demonstration of Playwright MCP Integration
 * These tests showcase how to use Playwright MCP tools for testing the authentication system
 */
```

### ❌ `tests/test-runner.spec.ts` (74 lines)
**Reason:** Only tests Jest/Playwright configuration, not actual features
**Status:** **REMOVED** ✅

**Evidence:**
- Tests like "should have proper test environment setup"
- Tests timeout configuration
- Tests screenshot capture
- Tests parallel execution
- Validates test data format

These are meta-tests that don't verify application functionality.

---

## CI/CD Test Suite Recommendation

### Tier 1: Critical Path (Run on every commit)
**Runtime: ~2-3 minutes**

```bash
# Smoke tests + completion API
npm run test:smoke           # smoke-tests.spec.ts
npm run test:integration     # Jest integration tests (once fixed)
```

**Tests Included:**
- Homepage loads
- Navigation works
- Auth redirects function
- Lesson completion API
- Critical business logic

### Tier 2: Core Features (Run on PR merge)
**Runtime: ~8-12 minutes**

```bash
# Auth + Security + Middleware
npm run test:auth            # auth-flows.spec.ts
npm run test:security        # security.spec.ts
playwright test tests/middleware.spec.ts
```

**Tests Included:**
- Complete auth flows (signup, login, logout)
- Security vulnerabilities (XSS, CSRF, SQLi)
- Route protection and middleware
- Session management

### Tier 3: Full Suite (Run nightly)
**Runtime: ~25-35 minutes**

```bash
# All tests
npm run test                 # All Playwright tests
npm run test:jest            # All Jest tests
```

**Tests Included:**
- Everything from Tier 1 & 2
- OAuth flows
- Password reset
- Drawing features
- Context chat
- Lesson progress
- Component tests
- Integration tests

---

## Issues Requiring Fixes

### 🔴 Critical: Jest ESM Module Configuration

**Problem:** Jest cannot parse ESM modules in dependencies

**Error:**
```
SyntaxError: Unexpected token 'export'
node_modules/node-fetch-native-with-agent/dist/native.mjs:1
```

**Solution:** Update `jest.config.js`:

```javascript
transformIgnorePatterns: [
  'node_modules/(?!(@assistant-ui|@langchain|nanoid|node-fetch-native-with-agent|node-appwrite)/)',
],
```

**Affected Tests:**
- ❌ `EvidenceDriver.test.ts`
- ❌ `SOWDriver.test.ts`
- ❌ `MasteryDriver.test.ts`
- ✅ `api/completion.test.ts` (passing with mocks)

### ⚠️ Medium: Playwright Integration Tests Using Jest Globals

**Problem:** 4 integration tests in `tests/integration/` use `@jest/globals` but run with Playwright

**Files:**
- `session-history-persistence.test.ts`
- `session-completion.test.ts`
- `session-replay-cleanup-example.test.ts`
- `appwrite-schema-validation.test.ts`

**Solution Options:**
1. **Move to Jest:** Relocate to `__tests__/integration/` and run with Jest
2. **Convert to Playwright:** Replace `import { describe, it, expect } from '@jest/globals'` with `import { test as it, expect } from '@playwright/test'`

---

## Test Configuration Summary

### Current Setup

**Jest Configuration** (`jest.config.js`):
- Environment: `jsdom`
- Test pattern: `**/__tests__/**/*.test.{ts,tsx}`
- Timeout: 30 seconds
- Preset: `ts-jest`

**Playwright Configuration** (`playwright.config.ts`):
- Test directory: `./tests`
- Workers: 1 (to avoid Appwrite API rate limiting)
- Base URL: `http://localhost:3000`
- Browsers: Chromium, Firefox, WebKit, Mobile Chrome
- Retries: 2 in CI, 0 locally

### Test Commands

```json
{
  "test": "playwright test",
  "test:smoke": "playwright test tests/smoke-tests.spec.ts",
  "test:auth": "playwright test tests/auth-flows.spec.ts",
  "test:security": "playwright test tests/security.spec.ts",
  "test:e2e": "playwright test tests/e2e-real-auth.spec.ts",
  "test:jest": "jest",
  "test:integration": "jest __tests__/integration/",
  "test:parallel": "playwright test --workers=4",
  "test:serial": "playwright test --workers=1"
}
```

---

## Recommended Actions

### Immediate (Before CI/CD)

1. ✅ **Remove obsolete tests** (DONE)
   - Removed `demo-playwright.spec.ts`
   - Removed `test-runner.spec.ts`

2. 🔧 **Fix Jest ESM configuration**
   - Update `jest.config.js` transformIgnorePatterns
   - Verify all 4 Jest integration tests pass

3. 🔧 **Fix Playwright integration tests**
   - Move or convert 4 tests using `@jest/globals`
   - Ensure consistent test framework usage

4. ✅ **Verify test user exists**
   - Confirm `test@scottishailessons.com` (password: `red12345`) is available
   - Document in CI/CD secrets

### Short-term (CI/CD Setup)

1. **Create GitHub Actions workflow** with 3 tiers:
   - Tier 1: Every commit (smoke + completion API)
   - Tier 2: PR merge (auth + security + middleware)
   - Tier 3: Nightly (full suite)

2. **Set up test environment variables:**
   ```
   APPWRITE_ENDPOINT
   APPWRITE_PROJECT_ID
   NEXT_PUBLIC_APPWRITE_PROJECT_ID
   TEST_USER_EMAIL
   TEST_USER_PASSWORD
   ```

3. **Configure test data cleanup:**
   - Implement test data teardown after runs
   - Use test user flagging script: `npm run flag-test-users`

### Long-term (Maintenance)

1. **Add code coverage reporting**
   - Current setup ignores coverage for tests
   - Target: 70% coverage for critical paths

2. **Create test data factories**
   - Reduce boilerplate in tests
   - Centralize test user/course/lesson creation

3. **Add visual regression tests**
   - Playwright has screenshot capabilities
   - Track UI changes over time

---

## Test Quality Assessment

### ✅ Strengths

1. **Comprehensive coverage** of auth flows
2. **Security testing** for common vulnerabilities
3. **Real integration tests** with Appwrite backend
4. **Page object pattern** used for maintainability
5. **Helper utilities** (AuthHelper, test-data.ts) reduce duplication

### ⚠️ Areas for Improvement

1. **Test flakiness:** Some tests depend on timing (waitForTimeout)
2. **Parallel execution disabled:** Due to Appwrite API rate limits
3. **Mock inconsistency:** Mix of real API calls and mocks
4. **Test data cleanup:** Some tests don't clean up after themselves
5. **Configuration drift:** Jest tests have import issues

---

## Conclusion

After removing 2 obsolete demo/meta-test files, the test suite is streamlined to **22 functional test files**.

**Next Steps:**
1. Fix Jest ESM configuration (blocks 3 integration tests)
2. Resolve 4 Playwright tests using Jest globals
3. Implement Tier 1 CI/CD tests (smoke + completion API)
4. Gradually expand to Tier 2 and Tier 3

**Estimated Effort:**
- ESM config fix: 30 minutes
- Playwright integration test fix: 1-2 hours
- CI/CD Tier 1 setup: 2-3 hours
- Full CI/CD pipeline: 1-2 days

The core test suite is solid and covers critical user journeys. Once configuration issues are resolved, this will be a robust foundation for CI/CD.
