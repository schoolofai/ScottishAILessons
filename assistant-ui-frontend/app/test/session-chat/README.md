# SessionChatAssistant Test Page

## Overview

This test page allows you to manually test the `SessionChatAssistant` component in isolation using **fake data** - no backend connection required!

## Access

Navigate to: **http://localhost:3000/test/session-chat**

## Features

### 🎭 Fake Components

All components use fake implementations that simulate real behavior:

- **FakeMyAssistant**: Main teaching interface with realistic conversation flow
- **FakeContextChatPanel**: Context-aware help panel with AI tutor simulation
- **FakeSessionHeader**: Displays lesson metadata from mock data

### 📊 Test Controls

The yellow banner at the top provides real-time controls:

#### Session Status Controls
- **Active**: Session is in progress (navigation prevention enabled)
- **Completed**: Lesson is finished
- **Failed**: Session encountered an error

#### State Display
- **Main Thread ID**: Shows the main conversation thread
- **Context Thread ID**: Shows the context chat thread
- **Current Status**: Visual indicator of session state

### 🗨️ Interactive Features

#### Main Teaching Panel
- Type responses to questions
- Get instant AI feedback (fake responses based on keywords)
- Progress through lesson cards
- See realistic lesson progression

Try these inputs in the main chat:
- `yes` or `ready` → Start the lesson
- `1/5` or `a` → Answer the multiple choice question
- `help` → Get a hint
- `next` → Move to next card
- `0.2` → Answer the decimal conversion question

#### Context Chat Panel (AI Tutor)
- Ask questions about the lesson
- Get context-aware help
- Collapsible sidebar

Try these inputs in the context chat:
- `What is a fraction?`
- `Explain equivalent fractions`
- `How do I convert to decimal?`
- `I'm stuck` → Get general help
- `Give me an example` → See real-world examples

### 🎨 UI Testing

#### Navigation Prevention
1. Set status to **Active**
2. Try to navigate away (close tab, go back, etc.)
3. Should see exit warning modal
4. Click "Leave Anyway" to allow navigation

#### Context Chat Collapse
1. Click the `▶` button to collapse the context chat
2. Should show floating "Ask Your AI Tutor" button
3. Click button to expand again

#### Responsive Layout
- Resize browser window
- Panels should adapt responsively
- Test on different screen sizes

## Mock Data Structure

The test page uses realistic data from `@/__mocks__/session-data.ts`:

```typescript
{
  sessionId: "test-session-123-fake",
  lesson: "Understanding Equivalent Fractions",
  course: "Mathematics: National 3",
  cards: [
    { id: "card_001", title: "Introduction to Equivalent Fractions", ... },
    { id: "card_002", title: "Converting Fractions to Decimals", ... }
  ],
  outcomes: [
    { outcomeId: "O1", title: "Understand and use fractions", ... },
    { outcomeId: "O2", title: "Apply numerical reasoning", ... }
  ]
}
```

## Architecture

### Component Hierarchy

```
TestSessionChatPage
├── NavigationPreventionProvider (handles exit warnings)
├── CurrentCardProvider (tracks lesson progress)
├── Test Controls Banner (status buttons)
└── Main Layout
    ├── FakeSessionHeader (lesson metadata)
    ├── FakeMyAssistant (main teaching chat)
    └── FakeContextChatPanel (AI tutor sidebar)
```

### Data Flow

```
Mock Data (session-data.ts)
    ↓
Test Page (loads mock data)
    ↓
Fake Components (render with mock data)
    ↓
User Interactions (trigger fake responses)
    ↓
Console Logs (debug output)
```

## Development Workflow

### Testing New Features

1. **Add mock data** to `__mocks__/session-data.ts`
2. **Update fake components** to handle new data structures
3. **Test in browser** at `/test/session-chat`
4. **Iterate quickly** without backend dependencies

### Debugging

Open the browser console to see detailed logs:

```
🎭 [FAKE] Creating driver: SessionDriver
🧵 Main thread created: fake-thread-1234567890
📊 Session status changed to: active
📝 [FAKE] Updated session thread ID: { sessionId, threadId }
```

### Testing Different Scenarios

#### Scenario 1: New User (No Thread ID)
- Default state on page load
- Should create new thread IDs
- Watch console for thread creation logs

#### Scenario 2: Returning User (Has Thread ID)
- Manually set `existingThreadId` in code
- Should reuse existing thread
- Thread ID should persist

#### Scenario 3: Completed Session
- Click "Completed" status button
- UI should reflect completed state
- Navigation prevention should be disabled

#### Scenario 4: Error Handling
- Click "Failed" status button
- Components should handle gracefully
- No crashes or console errors

## Comparison with Real Component

| Feature | Real Component | Test Page |
|---------|---------------|-----------|
| **Data Source** | Appwrite API | Mock fixtures |
| **Backend** | LangGraph (ports 2024/2700) | Fake runtime |
| **Responses** | OpenAI GPT-4 | Keyword-based fake responses |
| **Thread Management** | Persisted to database | Console logs only |
| **Network Calls** | Real HTTP requests | Simulated delays (300-1000ms) |
| **Authentication** | Required | Not needed |
| **State Persistence** | Database | In-memory only |

## Use Cases

### 1. Frontend Development
Develop and test UI changes without running the backend:
```bash
npm run dev
# Navigate to http://localhost:3000/test/session-chat
```

### 2. Visual Regression Testing
Take screenshots at different states for comparison

### 3. Demo/Presentation
Show the UI without worrying about backend uptime

### 4. QA Testing
Test edge cases and user flows quickly

### 5. Performance Testing
Profile frontend performance in isolation

## Extending the Test Page

### Adding New Test Scenarios

Edit `app/test/session-chat/page.tsx`:

```typescript
// Add new controls
<button onClick={() => simulateError()}>
  Simulate Error
</button>

// Add new state
const [showSpecialFeature, setShowSpecialFeature] = useState(false);
```

### Adding New Fake Responses

Edit `components/test/FakeMyAssistant.tsx`:

```typescript
function generateFakeResponse(userInput: string): string {
  if (userInput.includes('my-keyword')) {
    return 'My custom response';
  }
  // ... existing logic
}
```

### Adding New Mock Data

Edit `__mocks__/session-data.ts`:

```typescript
export const mockNewScenario: Session = {
  // ... your mock data
};
```

## Troubleshooting

### Page Not Loading
- Ensure you're running `npm run dev`
- Check console for TypeScript errors
- Verify all imports are correct

### Components Not Rendering
- Check React DevTools
- Look for errors in browser console
- Verify mock data structure matches types

### Fake Responses Not Working
- Check console logs for keyword matching
- Verify input is being captured
- Test with exact keywords from code comments

## Next Steps

After testing with fake data:

1. **Unit Tests**: Use `__mocks__/appwrite-drivers.ts` for Jest tests
2. **Integration Tests**: Test with real backend using Playwright
3. **E2E Tests**: Full user journeys with authenticated sessions

## Files Created for This Feature

```
assistant-ui-frontend/
├── __mocks__/
│   ├── appwrite-drivers.ts        # Mock driver factory functions
│   ├── session-data.ts             # Realistic test fixtures
│   └── langgraph-client.ts         # LangGraph SDK mocks
├── lib/test-utils/
│   └── fake-providers.tsx          # Browser-compatible fake providers
├── components/test/
│   ├── FakeMyAssistant.tsx         # Fake main teaching interface
│   ├── FakeContextChatPanel.tsx    # Fake AI tutor panel
│   └── FakeSessionHeader.tsx       # Fake lesson header
└── app/test/session-chat/
    ├── page.tsx                    # Main test page
    └── README.md                   # This file
```

## Questions?

Check the mock data structure in `__mocks__/session-data.ts` or component implementation in `components/SessionChatAssistant.tsx`.
