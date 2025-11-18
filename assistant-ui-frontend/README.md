# Scottish AI Lessons - Assistant UI Frontend

This is the [assistant-ui](https://github.com/Yonom/assistant-ui) frontend for Scottish AI Lessons, a sophisticated AI-powered learning platform using LangGraph multi-agent architecture.

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **UI Framework**: Assistant-UI (generative UI for AI interactions)
- **Backend**: LangGraph (dual-agent system)
- **Database**: Appwrite (student data, courses, sessions, mastery)
- **AI**: LangChain, OpenAI GPT-4

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- Appwrite instance (cloud or self-hosted)
- OpenAI API key

### Quick Start

The easiest way to start the entire application is using the startup script:

```bash
cd langgraph-agent
./start.sh
```

This script will:
1. ✅ Set up Python virtual environment
2. ✅ Install backend dependencies
3. ✅ Start main LangGraph backend (port 2024)
4. ✅ Start context chat backend (port 2700)
5. ✅ Install frontend dependencies
6. ✅ Configure environment for LangGraph
7. ✅ Start Next.js frontend (port 3000)
8. ✅ Open browser automatically

To stop all services:

```bash
cd langgraph-agent
./stop.sh
```

### Manual Setup (Frontend Only)

If you need to run just the frontend:

```bash
cd assistant-ui-frontend

# Install dependencies
npm install --legacy-peer-deps

# Configure environment (choose one)
cp .env.local.langgraph .env.local   # For LangGraph backend
cp .env.local.aegra .env.local       # For Aegra backend

# Start development server
npm run dev
```

### Environment Configuration

The frontend uses different `.env.local` templates:

**For LangGraph** (`.env.local.langgraph`):
```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:2024
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=agent
NEXT_PUBLIC_CONTEXT_CHAT_API_URL=http://localhost:2700
```

**For Aegra** (`.env.local.aegra`):
```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:8000
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=agent
```

### Stripe Configuration (Payment Integration)

To enable subscription payments and AI feature gating, add these Stripe environment variables:

```env
# Required - Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...           # Server-side only (from Stripe Dashboard → API keys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Client-side key
STRIPE_WEBHOOK_SECRET=whsec_...         # From Stripe CLI or Dashboard webhooks
STRIPE_PRICE_ID=price_...               # Monthly subscription price ID

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000  # For success/cancel URLs
```

**Getting Stripe Keys:**

1. Create account at [stripe.com](https://stripe.com)
2. Enable test mode in Dashboard
3. Get API keys: Developers → API keys
4. Create subscription product: Products → Add product (recurring monthly)
5. Copy price ID from product page

**Local Webhook Testing:**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS

# Login and forward webhooks
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret (`whsec_...`) to your `.env.local`.

**Test Cards:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires auth: `4000 0025 0000 3155`

See [Payment System Documentation](../docs/payment-system.md) for complete details.

### Test Credentials

For MVP testing, use these credentials:

- **Email**: `test@scottishailessons.com`
- **Password**: `red12345`

---

## How to Use the App

### Student Experience

#### 1. Login

1. Navigate to http://localhost:3000
2. Enter test credentials
3. System automatically creates student record if first login
4. Auto-enrolls in National 3 Mathematics course (C844 73)

**Database State After Login:**
- `students` collection: 1 record with your userId
- `enrollments` collection: 1 record for C844 73 only
- Dashboard display: ALL 3 courses (C844_73, C843_73, nat5-maths-2024) regardless of enrollment

#### 2. Dashboard Overview

After login, you'll see the **Enhanced Student Dashboard** with:

- **Welcome Header**: Personalized greeting with student name
- **Course Navigation Tabs**: Shows ALL courses in the database (not filtered by enrollment)
- **Recommendation Section**: AI-recommended lessons based on:
  - Your mastery levels (EMA scores)
  - Scheme of Work (SOW) schedule
  - Overdue lessons
  - Lesson dependencies

**Current MVP Behavior:**
- System auto-enrolls you in **C844 73 (National 3 Mathematics)** on first login
- Dashboard displays ALL courses from database: C844_73, C843_73, nat5-maths-2024
- You can view and attempt lessons from any course, regardless of enrollment status
- Recommendations will only work for courses with SOWV2 data

The recommendation system uses the **LangGraph Course Manager** agent to analyze your progress and suggest the optimal next lesson.

#### 3. Starting a Lesson

1. Review the recommended lessons (sorted by priority score)
2. Read the **reasons** for each recommendation
3. Click **"Start Lesson"** on your chosen lesson
4. System creates a new session and navigates to the lesson interface

**Behind the scenes:**
- Creates session record in Appwrite
- Maintains thread continuity from Course Manager
- Loads lesson snapshot with cards and objectives

#### 4. Interactive Lesson Cards

The lesson interface uses **generative UI** with interactive components:

**Card Types:**
- **Concept Cards**: Learning content with explanations
- **Example Cards**: Worked examples with step-by-step solutions
- **Practice Cards**: Interactive problems requiring student input

**Interaction Flow:**
1. Read the card content (may include LaTeX math rendering)
2. For practice cards, enter your answer
3. Submit your response
4. Receive immediate feedback from the AI teacher
5. System updates your mastery level based on performance

**Teaching Agent Features:**
- Adaptive hints (3 levels)
- Detailed feedback on mistakes
- Mastery tracking per learning outcome
- Progress through lesson cards

#### 5. Using the AI Tutor (Context Chat)

The **Context Chat Panel** provides on-demand help without interrupting your lesson:

**How to Use:**
1. **Expanded Mode**: Panel visible on the right side of screen
   - Ask questions about current card
   - Request clarification on concepts
   - Get additional examples

2. **Collapsed Mode**: Click the blue bubble in bottom-right
   - Shows: "Stuck? Ask Your AI Tutor"
   - Click to expand panel

**Context Chat Features:**
- Aware of your current lesson card
- Can reference lesson objectives
- Provides hints without revealing answers
- Separate conversation thread from main teaching

**Resizable Panel:**
- Drag the left edge to resize (20% to 50% width)
- Adjusts to your preferred layout

#### 6. Completing Lessons

As you progress through cards:
- Green checkmarks show completed cards
- Mastery scores update in real-time
- Evidence of learning is recorded
- Final assessment determines outcome mastery

### Developer Experience

#### Running Tests

Always test changes using the Playwright MCP tool:

```bash
# Restart application after code changes
cd langgraph-agent
./stop.sh && ./start.sh
```

**Manual Testing Checklist:**
1. ✅ Login with test credentials
2. ✅ Dashboard loads with recommendations
3. ✅ Course navigation switches correctly
4. ✅ Start lesson creates session
5. ✅ Lesson cards render properly
6. ✅ Student responses trigger feedback
7. ✅ Context chat opens and responds
8. ✅ Mastery updates persist

#### Viewing Logs

The start script creates log files in `langgraph-agent/`:

```bash
# Real-time log viewing
tail -f langgraph-agent/backend.log         # Main backend
tail -f langgraph-agent/context-chat.log   # Context chat backend
tail -f langgraph-agent/frontend.log       # Next.js frontend
```

#### LangGraph Studio

Access visual debugging for agent graphs:

- **Main Teaching Agent**: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
- **Context Chat Agent**: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2700

Studio allows you to:
- Visualize graph execution
- Inspect state at each node
- Replay conversations
- Debug tool calls and interrupts

#### API Documentation

- **Main Backend**: http://localhost:2024/docs
- **Context Chat Backend**: http://localhost:2700/docs

---

## Architecture Documentation

### Architecture Overview

The system uses a **dual-backend architecture**:
- **Appwrite** - Persistent data storage (students, courses, sessions, mastery, SOW)
- **LangGraph** - AI agents for recommendations and teaching

`★ Insight ─────────────────────────────────────`
The dashboard implements a **separation of concerns** pattern:
- Appwrite handles ALL persistent state (database of record)
- LangGraph provides stateless AI decision-making
- Frontend coordinates between both systems
`─────────────────────────────────────────────────`

### 1. Dashboard Initialization Flow

#### Step 1: Student Authentication & Setup
**Location:** `components/dashboard/EnhancedStudentDashboard.tsx` - `initializeStudent()` (lines 47-128)

```
User Login → Appwrite Session → Student Record → Auto-Enrollment
```

**Data Flow:**
1. Retrieves session from localStorage (`cookieFallback`)
2. Creates Appwrite client with session token
3. Queries `students` collection by `userId`
4. If no student record exists, creates one with permissions
5. Calls `loadCoursesClientSide()` with authenticated databases instance

**Key Pattern:** Client-side Appwrite SDK usage with explicit session management (lines 59-76)

#### Step 2: Course Loading & Auto-Enrollment
**Location:** `loadCoursesClientSide()` (lines 131-187)

```
Fetch ALL Courses → Check C844 73 Enrollment → Auto-Enroll if Needed → Display ALL Courses
```

**Critical Logic:**
```typescript
// Line 136: Fetch ALL courses from database (no enrollment filter)
const coursesResult = await databases.listDocuments('default', 'courses');

// Lines 140-147: Check enrollment ONLY for C844 73 (National 3)
const enrollmentsResult = await databases.listDocuments(
  'default',
  'enrollments',
  [
    Query.equal('studentId', student.$id),
    Query.equal('courseId', 'C844 73')  // Only checks this specific course
  ]
);

// Lines 149-163: Auto-enroll in C844 73 if not already enrolled
if (enrollmentsResult.documents.length === 0) {
  await databases.createDocument('default', 'enrollments', ID.unique(), {
    studentId: student.$id,
    courseId: 'C844 73',
    role: 'student'
  }, [`read("user:${student.userId}")`, `write("user:${student.userId})")`]);
}

// Lines 165-170: Display ALL courses (no enrollment filtering applied)
const coursesData = coursesResult.documents;  // All courses from DB
setCourses(coursesData);
const transformedCourses = transformCoursesForNavigation(coursesData);
setCourseData(transformedCourses);  // Shows everything to student
```

**Current MVP Behavior:**
- Fetches ALL courses from the `courses` collection without filtering
- Only checks/creates enrollment for `C844 73` (National 3)
- Displays ALL courses regardless of enrollment status
- Student can navigate to any course and attempt to load recommendations
- Recommendations will fail with SOWV2 error if course lacks SOW data

**Production TODO:** Filter `coursesResult` by student's enrollment records before displaying

### 2. Recommendation System (LangGraph Integration)

#### Step 3: Loading Recommendations via Course Manager
**Location:** `loadRecommendations()` (lines 190-456)

This is the **most complex flow** - it builds a complete context and calls the LangGraph Course Manager agent.

**Data Collection Phase:**
```
Student Data → Course Data → Lesson Templates → MasteryV2 → SOWV2 → Build Context
```

**Key Data Sources:**

1. **Course Query** (lines 209-219):
   - Queries by `courseId` field (NOT document $id)
   - Critical for multi-course support

2. **Lesson Templates** (lines 222-226):
   - All available lessons for the course
   - Contains `outcomeRefs`, `estMinutes`

3. **MasteryV2 Records** (lines 228-256):
   - Uses `MasteryV2Driver` with session token
   - Converts EMA scores to legacy mastery format
   - Pattern: `emaByOutcomeId` → mastery level mapping

4. **SOWV2 (Scheme of Work)** (lines 260-319):
   - **NO FALLBACKS** - fast fail if missing (line 276)
   - JSON parsing of `entries` field (line 307)
   - Transforms to `{templateId, order, plannedAt}` format

`★ Insight ─────────────────────────────────────`
**Fast-Fail Pattern**: The code explicitly rejects fallback
mechanisms (line 276-283). This follows the CLAUDE.md
directive: "never use fallback mechanisms unless specifically
asked for - this should be considered a severe anti pattern"

Missing SOWV2 data throws immediately with detailed context.
`─────────────────────────────────────────────────`

#### Step 4: LangGraph Course Manager Call
**Location:** lines 321-410

**Context Structure:**
```typescript
const context = {
  mode: "course_manager",
  student: { id, name, email },
  course: { $id, courseId, subject, sqaCode },
  templates: [{ $id, title, outcomeRefs, estMinutes }],
  mastery: [{ outcomeRef, masteryLevel }],
  sow: [{ templateId, order, plannedAt }]
};
```

**LangGraph SDK Flow:**
```typescript
// Create thread
const thread = await langGraphClient.threads.create();

// Run Course Manager with context
const run = await langGraphClient.runs.create(
  thread.thread_id,
  process.env.NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID,
  { input: { session_context: context, mode: "course_manager" } }
);

// Wait for completion
const result = await langGraphClient.runs.join(thread.thread_id, run.run_id);

// Extract state
const state = await langGraphClient.threads.getState(thread.thread_id);
const courseRecommendation = state.values?.course_recommendation;
```

**Backend Processing** (see `langgraph-agent/src/agent/graph_interrupt.py:entry_node_interrupt`):
- Detects `mode: "course_manager"` in session_context
- Routes to `course_manager_subgraph`
- Returns `course_recommendation` with prioritized lessons

**Response Transformation** (lines 418-436):
```typescript
{
  available: true,
  recommendations_ready: true,
  thread_id: thread.thread_id,
  candidates: [
    {
      lessonTemplateId: rec.lessonId,
      title: rec.title,
      priorityScore: rec.score,
      reasons: rec.reasons,
      flags: rec.flags
    }
  ],
  metadata: {
    total_candidates: count,
    generated_at: timestamp,
    graph_run_id: run.run_id,
    rubric: 'Overdue > Low Mastery > Early Order | -Recent -Too Long'
  }
}
```

### 3. Starting a Lesson

#### Step 5: Lesson Start Handler
**Location:** `handleStartLesson()` (lines 465-502)

**Flow:**
```
Validate Context → Create Session → Navigate to Session Page
```

**Session Creation:**
```typescript
const { createLessonSession } = await import('@/lib/sessions/session-manager');

const newSession = await createLessonSession({
  lessonTemplateId,
  studentId: student.$id,
  courseId: activeCourse,
  threadId: recommendations?.thread_id  // Thread continuity!
});

router.push(`/session/${newSession.$id}`);
```

`★ Insight ─────────────────────────────────────`
**Thread Continuity Pattern**: The dashboard passes the
Course Manager's `thread_id` to the new session. This enables
the teaching agent to continue the conversation thread,
maintaining context about WHY this lesson was recommended.

This is sophisticated multi-agent coordination!
`─────────────────────────────────────────────────`

### 4. Session Execution (SessionChatAssistant)

#### Step 6: Session Loading
**Location:** `components/SessionChatAssistant.tsx` - `loadSessionContext()` (lines 30-87)

**Data Flow:**
```
Session ID → SessionDriver → Session + Thread IDs → Build Context
```

**Key Operations:**

1. **Get Session with Thread Info** (line 35):
   ```typescript
   const sessionWithThread = await sessionDriver.getSessionWithContextChat(sessionId);
   ```
   Returns: `{ threadId, contextChatThreadId, hasExistingConversation }`

2. **Get Session State** (line 36):
   ```typescript
   const sessionStateData = await sessionDriver.getSessionState(sessionId);
   ```
   Returns: `{ session, parsedSnapshot }`

3. **Thread Priority Logic** (lines 44-54):
   - **Priority 1**: `session.threadId` (from Dashboard's thread continuity)
   - **Priority 2**: `sessionWithThread.threadId` (existing conversation)
   - **Priority 3**: Create new thread (handled by MyAssistant)

**Context Structure:**
```typescript
const context: SessionContext = {
  session_id: session.$id,
  student_id: session.studentId,
  lesson_snapshot: parsedSnapshot  // Contains lesson data
};
```

#### Step 7: Dual-Panel Architecture

**Layout Structure:**
```tsx
<CurrentCardProvider>  {/* Shared state for current card */}
  <div className="flex h-screen">
    {/* Main Teaching Panel */}
    <div className="flex-1">
      <SessionHeader sessionContext={sessionContext} />
      <MyAssistant
        sessionId={sessionId}
        threadId={existingThreadId}
        sessionContext={sessionContext}
        onThreadCreated={handleThreadCreated}
      />
    </div>

    {/* Context Chat Panel - Resizable */}
    {!isContextChatCollapsed && (
      <div style={{ width: `${contextChatWidth}%` }}>
        <ContextChatPanel
          sessionId={sessionId}
          sessionContext={sessionContext}
          existingContextThreadId={contextChatThreadId}
          onThreadCreated={handleContextThreadCreated}
        />
      </div>
    )}
  </div>
</CurrentCardProvider>
```

`★ Insight ─────────────────────────────────────`
**CurrentCardProvider Pattern**: This context shares the
current lesson card state between the main teaching panel
and context chat panel. The context chat can reference
"this card" without explicit card ID passing.

This replaced the older `getMainGraphState()` approach
for more deterministic context handling.
`─────────────────────────────────────────────────`

#### Step 8: Thread Persistence

**Main Teaching Thread** (lines 90-99):
```typescript
const handleThreadCreated = async (newThreadId: string) => {
  await sessionDriver.updateSessionThreadId(sessionId, newThreadId);
  threadIdRef.current = newThreadId;
};
```

**Context Chat Thread** (lines 104-113):
```typescript
const handleContextThreadCreated = async (newContextThreadId: string) => {
  await sessionDriver.updateContextChatThreadId(sessionId, newContextThreadId);
  setContextChatThreadId(newContextThreadId);
};
```

### 5. Teaching Agent Interaction

**MyAssistant Component** interacts with the **teaching subgraph**:

**Backend Processing** (see `langgraph-agent/src/agent/graph_interrupt.py`):
1. **Entry Node** detects `session_id` in `session_context`
2. **Router** sets `mode: "teaching"`
3. Routes to **teaching subgraph** (`teacher_graph_toolcall_interrupt.py`)
4. Teaching agent uses **tool calls + interrupts** for lesson cards

**Frontend Tool Handling:**
- LessonCardPresentationTool receives card data via tool calls
- Renders interactive UI components
- Student responses sent back via `sendCommand` with `resume` wrapper

**Interrupt Flow** (see `/docs/interrupt-flow-documentation.md`):
- Tool calls transport lesson data to UI components
- `interrupt({})` pauses execution waiting for user input
- User responses wrapped in `resume: JSON.stringify({...})`
- State machines manage card progression and feedback loops

### 6. Context Chat Agent Interaction

**ContextChatPanel** is a **separate LangGraph instance**:

**Backend Configuration:**
- Runs on **port 2700** (separate from main backend on 2024)
- Uses `langgraph-generic-chat` graph
- Has access to `CurrentCardContext` via session state

**Communication Pattern:**
```
Student Question → Context Chat Agent → Accesses CurrentCard → Contextual Response
```

The context chat agent can answer questions about:
- The current lesson card being displayed
- The lesson objectives
- Hints without affecting main teaching flow

### Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DASHBOARD INITIALIZATION                                  │
│                                                              │
│ Appwrite Auth → Student Record → Courses → Auto-Enroll      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. RECOMMENDATION GENERATION                                 │
│                                                              │
│ Student + Course + Templates + MasteryV2 + SOWV2            │
│           ↓                                                  │
│    Build Context (mode: "course_manager")                   │
│           ↓                                                  │
│    LangGraph Course Manager (port 2024)                     │
│           ↓                                                  │
│    course_recommendation with prioritized lessons           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. LESSON START                                              │
│                                                              │
│ createLessonSession(templateId, studentId, courseId, threadId)│
│           ↓                                                  │
│    New Session in Appwrite                                  │
│           ↓                                                  │
│    Navigate to /session/{sessionId}                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. SESSION INITIALIZATION                                    │
│                                                              │
│ SessionDriver.getSessionWithContextChat(sessionId)          │
│           ↓                                                  │
│    { threadId, contextChatThreadId, session, snapshot }     │
│           ↓                                                  │
│    Build SessionContext                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌──────────────────────┐  ┌──────────────────────┐
│ 5A. MAIN TEACHING    │  │ 5B. CONTEXT CHAT     │
│                      │  │                      │
│ MyAssistant          │  │ ContextChatPanel     │
│    ↓                 │  │    ↓                 │
│ LangGraph Teaching   │  │ LangGraph Generic    │
│ (port 2024)          │  │ (port 2700)          │
│    ↓                 │  │    ↓                 │
│ Tool Calls +         │  │ Chat Messages        │
│ Interrupts           │  │                      │
│    ↓                 │  │ Accesses:            │
│ LessonCardTool       │  │ - CurrentCardContext │
│    ↓                 │  │ - Session State      │
│ Student Response     │  │                      │
│    ↓                 │  │                      │
│ Update Mastery       │  │                      │
└──────────────────────┘  └──────────────────────┘
          │                         │
          └────────────┬────────────┘
                       ▼
        ┌──────────────────────────┐
        │ CurrentCardProvider       │
        │ (Shared State)            │
        └──────────────────────────┘
```

### Key Architectural Patterns

1. **Client-Side Appwrite SDK** - All database operations happen directly from browser with user permissions

2. **Dual-Agent System** - Course Manager (recommendations) + Teaching Agent (lesson execution) + Context Chat (help)

3. **Thread Continuity** - Course Manager's thread flows into teaching session for context preservation

4. **Fast-Fail Error Handling** - No fallbacks; explicit errors with detailed context (SOWV2, course_recommendation)

5. **Shared State via Context** - CurrentCardProvider enables cross-panel communication

6. **Interrupt-Based Teaching** - Tool calls transport data, interrupts pause for user input

7. **Separation of Concerns**:
   - Appwrite = Persistent state (source of truth)
   - LangGraph = Stateless AI decision-making
   - Frontend = Orchestration layer

8. **MVP Enrollment Behavior** (Current Implementation):
   - Dashboard shows ALL courses from database (no enrollment filter)
   - Auto-enrollment only for C844 73 (National 3)
   - Students can access any course regardless of enrollment
   - Production should filter courses by enrollment records

`★ Insight ─────────────────────────────────────`
**Enrollment vs Display Discrepancy**: The current code has
a deliberate MVP shortcut where:

- Enrollment logic is MINIMAL (1 record in C844 73)
- Display logic is MAXIMAL (all courses shown)

This allows easy testing of multiple courses without manual
enrollment setup, but creates a security/UX gap for production.

**Why this matters:**
- Database: 1 enrollment record (C844 73)
- UI: 3 courses displayed (C844_73, C843_73, nat5-maths-2024)
- Recommendations fail on non-enrolled courses (no SOWV2 data)

**Production fix**: Filter courses query by enrollment records:
`Query.equal('courseId', enrolledCourseIds)`
`─────────────────────────────────────────────────`

---

## Development Commands Reference

### Application Lifecycle

```bash
# Start everything
cd langgraph-agent && ./start.sh

# Stop everything
cd langgraph-agent && ./stop.sh

# Restart after code changes
cd langgraph-agent && ./stop.sh && ./start.sh
```

### Frontend Only

```bash
cd assistant-ui-frontend

# Install dependencies
npm install --legacy-peer-deps

# Development server
npm run dev

# Production build
npm run build

# Linting
npm run lint
```

### Backend Development

```bash
cd langgraph-agent

# Activate virtual environment
source ../venv/bin/activate

# Run main backend manually
langgraph dev

# Run context chat backend manually
cd ../langgraph-generic-chat
langgraph dev --port 2700
```

### Testing

```bash
# Unit tests (backend)
cd langgraph-agent
pytest tests/

# Manual testing with Playwright MCP
# Use Playwright MCP tool in Claude Code for browser testing
```

### Port Reference

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Main Backend API | 2024 | http://localhost:2024/docs |
| Context Chat API | 2700 | http://localhost:2700/docs |
| LangGraph Studio (Main) | N/A | https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024 |
| LangGraph Studio (Context) | N/A | https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2700 |

---

## Troubleshooting

### Port Already in Use

```bash
cd langgraph-agent
./stop.sh
./start.sh
```

The stop script kills processes on ports 3000, 2024, and 2700.

### Frontend Not Loading

1. Check backend is running: `curl http://localhost:2024/docs`
2. Check context chat is running: `curl http://localhost:2700/docs`
3. Verify `.env.local` configuration
4. Clear browser cache and reload

### Recommendations Not Loading

Common causes:
1. **Missing SOWV2 data** - Check error message for student/course ID
   - Current MVP shows ALL courses, but recommendations only work for courses with SOW data
   - Only C844 73 (National 3) has guaranteed SOWV2 data after auto-enrollment
   - Switching to C843_73 or nat5-maths-2024 will fail unless SOW data exists
2. **MasteryV2 not initialized** - Run lesson to create initial mastery records
3. **LangGraph backend offline** - Check `backend.log`

**Expected Error for Non-Enrolled Courses:**
```
SOW Data Missing: No SOWV2 data found for student: {studentId}, course: {courseId}
```
This is normal MVP behavior when selecting courses without enrollment/SOW data.

### Lesson Cards Not Rendering

1. Check browser console for errors
2. Verify interrupt flow in LangGraph Studio
3. Check teaching backend logs: `tail -f langgraph-agent/backend.log`

### Context Chat Not Responding

1. Verify context chat backend: `curl http://localhost:2700/docs`
2. Check `context-chat.log` for errors
3. Ensure `NEXT_PUBLIC_CONTEXT_CHAT_API_URL` is set correctly

---

## Contributing

When making changes:

1. ✅ Update documentation in this README
2. ✅ Test with Playwright MCP tool
3. ✅ Follow fast-fail error handling (no fallbacks)
4. ✅ Keep functions under 50 lines (extract helpers)
5. ✅ Keep files under 500 lines (use utility files)
6. ✅ Use `./stop.sh && ./start.sh` after changes

See `CLAUDE.md` for full development guidelines.

---

## License

This project uses Assistant-UI and LangGraph. Check respective licenses for usage terms.
