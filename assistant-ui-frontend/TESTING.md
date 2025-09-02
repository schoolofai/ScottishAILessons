# Authentication System Testing Guide

## Overview

This testing suite provides comprehensive end-to-end testing for the Scottish AI Lessons authentication system using Playwright. The tests cover all authentication flows, security features, and user interactions.

## Test Structure

### Test Categories

#### 1. **Smoke Tests** (`tests/smoke-tests.spec.ts`)
- **Purpose**: Verify critical functionality works
- **Duration**: ~2-3 minutes
- **When to run**: Before every deployment, in CI/CD pipeline
- **Coverage**: Login, signup, navigation, basic validation

#### 2. **Authentication Flow Tests** (`tests/auth-flows.spec.ts`)
- **Purpose**: Complete auth system validation
- **Duration**: ~5-8 minutes  
- **When to run**: After auth-related changes
- **Coverage**: Email/password auth, form validation, session management

#### 3. **Route Protection Tests** (`tests/middleware.spec.ts`)
- **Purpose**: Verify middleware and route security
- **Duration**: ~3-5 minutes
- **When to run**: After middleware changes
- **Coverage**: Protected routes, redirects, session validation

#### 4. **OAuth Integration Tests** (`tests/oauth.spec.ts`)
- **Purpose**: Test Google OAuth flow
- **Duration**: ~4-6 minutes
- **When to run**: After OAuth configuration changes
- **Coverage**: OAuth initiation, callback handling, error scenarios

#### 5. **Password Reset Tests** (`tests/password-reset.spec.ts`)
- **Purpose**: Validate password recovery flow
- **Duration**: ~4-6 minutes
- **When to run**: After password reset changes
- **Coverage**: Reset request, token validation, password update

#### 6. **Security Tests** (`tests/security.spec.ts`)
- **Purpose**: Security vulnerability testing
- **Duration**: ~6-10 minutes
- **When to run**: Weekly, before production deployments
- **Coverage**: XSS, CSRF, injection attacks, rate limiting

#### 7. **UI/Landing Tests** (`tests/landing.spec.ts`)
- **Purpose**: Frontend UI and UX validation
- **Duration**: ~3-5 minutes
- **When to run**: After UI changes
- **Coverage**: Landing page, responsive design, navigation

## Setup & Installation

### Prerequisites
```bash
# Install dependencies
npm install --legacy-peer-deps

# Install Playwright browsers
npm run test:install
```

### Environment Configuration
Copy test environment configuration:
```bash
# Test environment is already configured in .env.test
# Modify values if needed for your test setup
```

### Running Tests

#### Quick Commands
```bash
# Run all tests
npm test

# Run with browser UI (helpful for debugging)
npm run test:headed

# Run specific test suite
npm run test:smoke      # Critical path tests
npm run test:auth       # Authentication tests
npm run test:security   # Security tests
npm run test:ui         # UI/UX tests

# Debug mode (interactive)
npm run test:debug

# View test reports
npm run test:report
```

#### Advanced Options
```bash
# Run in parallel (faster)
npm run test:parallel

# Run serially (for debugging)
npm run test:serial

# Run specific test file
npx playwright test tests/landing.spec.ts

# Run specific test
npx playwright test -g "should login successfully"

# Run with specific browser
npx playwright test --project=chromium
```

## Test Configuration

### Browser Matrix
- **Chrome** (Primary testing browser)
- **Firefox** (Cross-browser compatibility)
- **Safari/WebKit** (macOS compatibility)
- **Mobile Chrome** (Mobile responsiveness)
- **Mobile Safari** (iOS compatibility)

### Viewports Tested
- Desktop: 1920x1080
- Mobile: 375x667 (iPhone)
- Tablet: 768x1024
- Large Desktop: 2560x1440

## Test Helpers & Utilities

### Page Objects
- `LandingPage`: Homepage interactions
- `LoginPage`: Login form operations  
- `SignupPage`: Registration form operations
- `ChatPage`: Protected chat interface
- `ResetPasswordPage`: Password recovery

### Helper Classes
- `AuthHelper`: Authentication state management
- Mock API responses and session handling
- Cookie manipulation and validation
- Error state verification

### Test Data
- Valid/invalid user credentials
- Email format variations
- Password complexity scenarios
- Edge cases and boundary conditions

## Mock Strategy

### API Mocking
Tests use Playwright's route interception to mock:
- Authentication endpoints (`/api/auth/*`)
- Success/failure responses
- Network errors and timeouts
- Rate limiting scenarios

### Session Simulation
- Cookie-based session testing
- Multi-tab/context scenarios
- Session expiration handling
- Concurrent user testing

## Security Testing

### Covered Attack Vectors
1. **Cross-Site Scripting (XSS)**
   - Input field injection
   - Error message XSS
   - URL parameter injection

2. **SQL Injection**
   - Login form injection attempts
   - Parameter manipulation
   - Special character handling

3. **Cross-Site Request Forgery (CSRF)**
   - Cookie SameSite validation
   - Origin checking
   - State parameter verification

4. **Session Security**
   - Cookie attributes (HttpOnly, Secure, SameSite)
   - Session fixation prevention
   - Session hijacking protection

5. **Rate Limiting**
   - Login attempt throttling
   - Signup rate limiting
   - Password reset frequency limits

## Continuous Integration

### GitHub Actions Integration
```yaml
# Example CI configuration
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci --legacy-peer-deps
      - run: npm run test:install
      - run: npm run test:smoke
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

### Test Stages
1. **Pre-commit**: Smoke tests only
2. **Pull Request**: Full test suite
3. **Pre-deployment**: Security + regression tests
4. **Nightly**: Complete suite with performance tests

## Debugging Tests

### Common Issues & Solutions

#### Test Timeouts
```bash
# Increase timeout for slow tests
npx playwright test --timeout=60000
```

#### Flaky Tests
```bash
# Run with retries
npx playwright test --retries=3
```

#### Visual Debugging
```bash
# Run with browser UI
npm run test:headed

# Step-through debugging
npm run test:debug
```

#### Screenshots & Videos
- Automatic screenshots on failure
- Video recording on test failure
- Trace files for detailed debugging

### Debugging Specific Scenarios

#### Authentication Issues
1. Check cookie settings in test output
2. Verify API mock responses
3. Inspect network requests in browser

#### UI Issues  
1. Use `--headed` mode to see browser
2. Add `await page.pause()` for manual inspection
3. Check responsive design with different viewports

#### Performance Issues
1. Monitor test execution times
2. Check for unnecessary waits
3. Optimize selector strategies

## Test Reporting

### HTML Reports
```bash
# Generate and view HTML report
npm run test:report
```

### JSON Reports
- Machine-readable test results
- CI/CD integration data
- Performance metrics
- Failure analysis

### Custom Reports
- Screenshot gallery for failures
- Performance benchmarks
- Security scan results
- Cross-browser compatibility matrix

## Best Practices

### Writing Tests
1. **Use Page Objects**: Maintain component abstractions
2. **Mock External Services**: Isolate tests from dependencies
3. **Test User Journeys**: Focus on complete workflows
4. **Handle Race Conditions**: Use proper waits and assertions
5. **Clean Test Data**: Reset state between tests

### Maintenance
1. **Regular Updates**: Keep selectors and test data current
2. **Review Flaky Tests**: Address inconsistent tests promptly
3. **Performance Monitoring**: Track test execution times
4. **Documentation**: Update test docs with code changes

### Security Testing
1. **Regular Security Reviews**: Weekly security test runs
2. **Update Attack Vectors**: Stay current with security threats
3. **Penetration Testing**: Supplement automated tests with manual testing
4. **Monitor Production**: Real-time security monitoring

## Performance Benchmarks

### Target Execution Times
- Smoke tests: < 3 minutes
- Full auth suite: < 15 minutes
- Security tests: < 10 minutes
- Complete suite: < 30 minutes

### Performance Monitoring
- Test execution tracking
- Resource usage monitoring
- Browser performance metrics
- Network request timing

## Troubleshooting

### Common Errors
1. **"Browser not found"** → Run `npm run test:install`
2. **"Port already in use"** → Check dev server is running
3. **"Timeout waiting for element"** → Increase timeout or fix selector
4. **"Mock not working"** → Check route pattern and timing

### Support Resources
- Playwright Documentation: https://playwright.dev/
- Project Issues: Check GitHub issues
- Test Debugging: Use `--debug` mode
- Community: Playwright Discord/Stack Overflow

## Roadmap

### Planned Improvements
1. **Visual Regression Testing**: Screenshot comparisons
2. **API Contract Testing**: Schema validation
3. **Load Testing**: Concurrent user simulation
4. **Mobile App Testing**: React Native integration
5. **Accessibility Testing**: WCAG compliance validation