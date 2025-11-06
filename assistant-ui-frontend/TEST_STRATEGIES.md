# Testing Strategies for SessionChatAssistant

## Problem Statement

`SessionChatAssistant` has hardcoded dependencies:
```typescript
import { useAppwrite, SessionDriver } from "@/lib/appwrite";
import { useRouter } from "next/navigation";
import { enrichOutcomeRefs } from "@/lib/sessions/outcome-enrichment";
```

These cannot be easily mocked in a browser environment without build-time configuration.

## Available Testing Strategies

### ✅ Strategy 1: Fake Component Testing (CURRENTLY IMPLEMENTED)

**Location**: `/test/session-chat`

**How it works**:
- Creates fake versions of child components (`FakeMyAssistant`, `FakeContextChatPanel`)
- Uses real mock data (`@/__mocks__/session-data.ts`)
- Tests UI interactions and layout without backend

**Pros**:
- ✅ Works immediately in browser
- ✅ No build configuration needed
- ✅ Fast iteration
- ✅ Tests UI/UX flows

**Cons**:
- ❌ Doesn't test real component logic
- ❌ Doesn't test actual data loading flow
- ❌ Doesn't catch bugs in SessionChatAssistant itself

**Use for**:
- UI/UX testing
- Visual regression testing
- Demo/presentation mode

---

### ✅ Strategy 2: Jest Unit Testing (RECOMMENDED FOR CI/CD)

**Location**: `components/__tests__/SessionChatAssistant.test.tsx` (not yet created)

**How it works**:
```typescript
jest.mock('@/lib/appwrite', () => ({
  useAppwrite: () => mockUseAppwrite,
  SessionDriver: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/lib/sessions/outcome-enrichment', () => ({
  enrichOutcomeRefs: jest.fn().mockResolvedValue(mockEnrichedOutcomes),
}));

describe('SessionChatAssistant', () => {
  test('loads session data', async () => {
    render(<SessionChatAssistant sessionId="test-123" />);
    // ... assertions
  });
});
```

**Pros**:
- ✅ Tests REAL component logic
- ✅ Full control over mocks
- ✅ Can test error scenarios
- ✅ Integrates with CI/CD

**Cons**:
- ❌ No visual verification
- ❌ Requires test runner (not browser)
- ❌ Setup complexity

**Use for**:
- Automated testing
- Regression prevention
- CI/CD pipelines

**Status**: Mocks are ready in `__mocks__/` directory, test file not created yet.

---

### ⚠️ Strategy 3: Real Component + Browser Mocks (COMPLEX)

**How it would work**:
1. Create test-specific versions of dependencies:
   ```
   lib/appwrite/index.test.ts  (returns mock drivers)
   hooks/usePreventNavigation.test.ts  (no-op implementation)
   ```

2. Configure Next.js webpack aliases in `next.config.js`:
   ```javascript
   webpack: (config, { isServer }) => {
     if (process.env.TEST_MODE === 'true') {
       config.resolve.alias = {
         ...config.resolve.alias,
         '@/lib/appwrite$': path.resolve(__dirname, 'lib/appwrite/index.test.ts'),
         '@/hooks/usePreventNavigation': path.resolve(__dirname, 'hooks/usePreventNavigation.test.ts'),
       };
     }
     return config;
   }
   ```

3. Run with environment variable:
   ```bash
   TEST_MODE=true npm run dev
   ```

**Pros**:
- ✅ Tests REAL component in browser
- ✅ Visual verification
- ✅ Tests actual data flow

**Cons**:
- ❌ Complex webpack configuration
- ❌ Requires separate build mode
- ❌ Hard to maintain
- ❌ Can't easily switch between real/mock

**Use for**:
- Only if you MUST test real component visually

---

## Recommended Approach

### For Manual Browser Testing
**Use Strategy 1** (Current implementation at `/test/session-chat`)
- Quick visual feedback
- No setup needed
- Good for UI/UX iteration

### For Automated Testing
**Use Strategy 2** (Jest unit tests)
- Create `__tests__/SessionChatAssistant.test.tsx`
- Use existing mocks from `__mocks__/` directory
- Run with `npm test`

### For Full Integration Testing
**Use Playwright E2E tests** with real backend
- Test complete user flows
- Use actual backend (start with `./start.sh`)
- Already configured in your project

---

## Current Status

### ✅ Completed
1. Mock utilities created (`__mocks__/appwrite-drivers.ts`)
2. Test fixtures created (`__mocks__/session-data.ts`)
3. Fake component test page (`/test/session-chat`)
4. Works in browser immediately

### ❌ Not Implemented
1. Jest unit tests for real component
2. Webpack aliasing for browser mocks
3. MSW (Mock Service Worker) setup

---

## Next Steps

### Option A: Use Current Fake Component Approach
**You can test NOW at**: `http://localhost:3000/test/session-chat`

**Features**:
- Interactive UI testing
- Fake conversations
- Status controls
- Collapse/expand panels
- No backend needed

### Option B: Create Jest Unit Tests
**If you want to test real component logic**:

```bash
# Create test file
touch components/__tests__/SessionChatAssistant.test.tsx

# Run tests
npm test
```

I can create the Jest test file if you want automated testing of the real component.

### Option C: Complex Webpack Setup
**Only if absolutely necessary** - requires significant configuration.

---

## Recommendation

**For your use case (manual browser testing):**

The current implementation at `/test/session-chat` is the right approach. It provides:
- ✅ Immediate visual feedback
- ✅ Interactive testing
- ✅ No backend dependency
- ✅ Easy to iterate

**To test the REAL component logic**, use Jest unit tests instead of browser testing. The mocks are already prepared - I just need to create the test file.

Would you like me to:
1. **Keep the current fake component approach** for browser testing? (Recommended)
2. **Create Jest unit tests** for real component logic testing?
3. **Set up webpack aliasing** for real component + browser mocks? (Complex, not recommended)
