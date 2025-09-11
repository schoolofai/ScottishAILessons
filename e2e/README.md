# Scottish AI Lessons - E2E Test Suite

Comprehensive end-to-end test suite for the Scottish AI Lessons platform using Playwright. This test suite is completely standalone and tests real AI interactions, lesson flows, and system behavior.

## 📋 Test Coverage

Based on comprehensive manual testing documented in `../playwright-e2e-test-log.md`, this suite covers:

### ✅ Test Scenarios
1. **Authentication Flow** (`auth.spec.ts`)
   - Valid/invalid credentials
   - Session persistence
   - Logout functionality

2. **Happy Path Lesson Flow** (`lesson-happy-path.spec.ts`)
   - Complete lesson with correct answers
   - Individual question type validation
   - Progress tracking
   - Session state management

3. **Error Handling & Retry** (`lesson-error-handling.spec.ts`)
   - Wrong format answers
   - Off-topic responses  
   - Help requests
   - Multiple retry attempts
   - Contextual hints

4. **Post-Completion Interactions** (`lesson-post-completion.spec.ts`)
   - Performance summary generation
   - No new content after completion
   - Detailed analytics
   - Skill improvement recommendations

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Scottish AI Lessons system running locally

### Installation
```bash
cd e2e
npm install
npx playwright install
```

### Environment Setup
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Start the System
**Option 1: LangGraph (default)**
```bash
cd ../langgraph-agent && ./start.sh
```

**Option 2: Aegra**
```bash
cd ../aegra-agent && ./start-aegra.sh
# Update BASE_URL in .env to http://localhost:3001
```

### Run Tests
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:auth
npm run test:happy-path
npm run test:error-handling
npm run test:post-completion

# Run with UI for debugging
npm run test:ui

# Run in headed mode
npm run test:headed
```

## 🔧 Configuration

### Environment Variables (.env)
```bash
# Application URL
BASE_URL=http://localhost:3000  # LangGraph
# BASE_URL=http://localhost:3001  # Aegra

# Test credentials (pre-configured in system)
TEST_USER_EMAIL=test@scottishailessons.com
TEST_USER_PASSWORD=red12345

# Completed session for post-completion tests
COMPLETED_SESSION_ID=68baa782001b883a1113

# Test timing (milliseconds)
AI_RESPONSE_TIMEOUT=15000
AI_STREAMING_DELAY=2000
PAGE_LOAD_TIMEOUT=30000
```

### Test Data
Tests use realistic data based on the actual lesson:
- **Subject**: National 3, Applications of Mathematics
- **Lesson**: "Fractions ↔ Decimals ↔ Percentages in Money"
- **Correct Answers**: ['1/5', '£16.20', '2']
- **Wrong Answers**: Various format/content errors for testing

## 🧪 Test Architecture

### File Structure
```
e2e/
├── tests/
│   ├── auth.spec.ts                   # Authentication tests
│   ├── lesson-happy-path.spec.ts      # Complete lesson flow
│   ├── lesson-error-handling.spec.ts  # Error scenarios
│   ├── lesson-post-completion.spec.ts # Post-completion interactions
│   └── helpers/
│       ├── auth.ts                    # Auth utilities
│       ├── lesson.ts                  # Lesson interaction utilities
│       ├── constants.ts               # Test data & selectors
│       └── global-setup.ts            # System verification
├── playwright.config.ts               # Playwright configuration
└── test-results/                      # Generated reports & artifacts
```

### Key Utilities

#### Authentication (`helpers/auth.ts`)
- `authenticateUser()` - Login with test credentials
- `isAuthenticated()` - Check login state
- `ensureAuthenticated()` - Login if needed

#### Lesson Interactions (`helpers/lesson.ts`)
- `startLesson()` - Begin new lesson
- `submitAnswer()` - Send answer in chat
- `verifySuccessfulAnswer()` - Check positive AI feedback
- `verifyErrorHandling()` - Check error feedback patterns
- `verifyLessonCompletion()` - Check completion message
- `verifyPerformanceSummary()` - Check post-completion analysis

#### AI Response Patterns (`helpers/constants.ts`)
```typescript
AI_PATTERNS = {
  success: [/Great job!/i, /correctly/i, /excellent work/i],
  error: [/Thank you for your attempt/i, /helpful hint/i],
  completion: [/Congratulations.*completing.*cards/i],
  summary: [/Performance Analysis/i, /accuracy.*%/i]
}
```

## 🎯 AI Response Testing

### Response Pattern Validation
Tests verify AI responses match expected educational patterns:

**Success Feedback**
- "Great job!" / "Correctly" / "Excellent work"
- Specific mathematical validation
- Encouraging progression messages

**Error Handling** 
- "Thank you for your attempt"
- Helpful hints without negative language
- Contextual guidance based on question type

**Completion**
- "Congratulations on completing all X cards"
- Achievement acknowledgment
- Positive reinforcement

**Performance Summary**
- "Performance Analysis" with quantified metrics
- "Areas for Improvement" with specific skills
- "Recommendations" with actionable steps

### Streaming Response Handling
Tests account for AI streaming responses:
- 2-second delay for streaming completion
- 15-second timeout for complete responses
- Pattern matching on final streamed content

## 📊 Test Execution

### Browser Support
- ✅ Chromium (primary)
- ✅ Firefox
- ✅ WebKit/Safari
- 📱 Mobile (optional configuration)

### Parallel Execution
- Tests run sequentially for stability
- Each test creates fresh sessions
- Authentication handled per test

### Failure Handling
- Screenshots on failure
- Video recording for complex flows
- Trace collection for debugging
- HTML report generation

### Performance Considerations
- **AI Responses**: 2-5 seconds typical
- **Session Loading**: ~1 second
- **Page Navigation**: <3 seconds
- **Error Recovery**: Instant retry capability

## 🐛 Debugging

### Common Issues

**System Not Running**
```bash
# Verify system is accessible
curl http://localhost:3000
# or
curl http://localhost:3001
```

**Test User Not Found**
- Ensure `test@scottishailessons.com` is configured in the system
- Verify password is `red12345`

**AI Responses Timeout**
- Increase `AI_RESPONSE_TIMEOUT` in .env
- Check system performance and load

**Session Issues**
- Use fresh session for each test
- Check completed session ID exists: `68baa782001b883a1113`

### Debug Commands
```bash
# Run single test with debug
npx playwright test auth.spec.ts --debug

# Run with trace viewer
npx playwright test --trace on

# Generate and view report
npm run test:report
```

### Logs and Artifacts
- Test results: `test-results/`
- Screenshots: `test-results/artifacts/`
- Videos: `test-results/artifacts/`
- HTML report: `test-results/html-report/`

## 🚢 CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run E2E Tests
  run: |
    cd e2e
    npm ci
    npx playwright install --with-deps
    npm test
  env:
    BASE_URL: ${{ secrets.TEST_BASE_URL }}
```

### Docker Support
```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-focal
WORKDIR /app/e2e
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "test"]
```

## 📈 Test Results Interpretation

### Success Criteria
- ✅ All authentication flows work
- ✅ Complete lessons can be finished
- ✅ Error handling provides educational feedback
- ✅ Post-completion provides performance analysis
- ✅ AI responses match expected patterns

### Key Metrics
- **Response Time**: AI responses < 15 seconds
- **Accuracy**: Pattern matching > 90%
- **Coverage**: All 3 documented test scenarios
- **Stability**: Tests pass consistently across browsers

## 🤝 Contributing

### Adding New Tests
1. Follow existing test structure
2. Use helper utilities
3. Document AI response patterns
4. Include comprehensive assertions
5. Add to appropriate test suite

### Test Data Updates
- Update `helpers/constants.ts` for new patterns
- Add new session IDs for different scenarios
- Document lesson structure changes

This E2E suite provides comprehensive validation of the Scottish AI Lessons platform, ensuring educational quality and system reliability through automated testing of real AI interactions.