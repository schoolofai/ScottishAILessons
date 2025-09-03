# MVP0 — Walking Skeleton (Auth ✅)  
**Next.js + Appwrite + LangGraph** for **Nat 3 Applications of Mathematics (C844 73)**  
**Seed topic:** Fractions ↔ Decimals ↔ Percentages in money contexts

---

## Problem Statement
Learners (especially neurodivergent and self-study students) need a calm, guided micro-lesson that:

- Teaches a small concept in a **familiar real-life context** (money, rounding to two decimal places).
- Checks understanding with **clear, kind feedback** and **deterministic marking** (numeric/MCQ).
- **Persists** progress so they can resume later, and **updates mastery** per learning outcome.

At **National 3**, SQA emphasises simple fractions/percentages (e.g., ½, ¼, 1/5, 1/10; 10%, 20%, 25%, 50%), rounding to **2 d.p.**, **calculator allowed**, **best-deal decisions**, and **data handling in simple forms**—all in **familiar, real-life contexts**.

---

## Solution Overview
Deliver a minimal, end-to-end product slice:

- **Frontend (Next.js)**: **Chat interface** where LangGraph agent delivers lessons conversationally (no custom card UI).
- **Auth**: ✅ Email/Password + Google + SMTP recovery (already working).
- **Persistence (Appwrite)**: students, courses, enrollments, lesson_templates, sessions (with **lessonSnapshot**), evidence (attempts), mastery.
- **LLM Graph (LangGraph)**: 4 nodes (**Design → Deliver → Mark → Progress**). Agent presents lesson cards as **chat messages** with CFU prompts.
- **Seed**: Pre-seeded **Nat 3** lesson available on dashboard, opens as chat session aligned to **H225 73 Numeracy** and **HV7Y 73 Manage Money & Data**.

**User Flow:** Dashboard → "Continue Learning" or start new lesson → **Chat interface** where agent guides through lesson cards conversationally.

**Outcome:** A learner completes a 10–15 min micro-lesson through **chat conversation**, with progress saved and resumable via threadId.

---

## Seed Lesson (published template)
**Course**: National 3 Applications of Mathematics (**C844 73**; mandatory units include **H225 73 Numeracy** and **HV7Y 73 Manage Money & Data**).

**Outcome alignment**
- **H225 73 (Numeracy) Outcome 1**: select & carry out calculations; **convert simple fractions/decimals/percents**; **round answers to two d.p.**; money contexts; calculator may be used.
- **HV7Y 73 Outcome 1.4**: **make a decision based on the best deal** (e.g., multi-pack vs unit price).

**Cards (snapshot)**
1) **Equivalences warm-up** → CFU (numeric): “Write **0.2** as a fraction in simplest form.” (→ **1/5**)
2) **10% discount** (money, 2 d.p.) → CFU (numeric): “£18, **10% off** → sale price?” (→ **£16.20**)
3) **Best deal** (unit price) → CFU (MCQ): “Cheaper per 100 g? **500 g £1.50** vs **1 kg £2.80**” (answer: **1 kg £2.80**)
(4) Optional: simple bar chart read (data handling) → identify a single fact.

**Notes:** Keep numbers small; **round money to 2 d.p.**; **calculator allowed**; familiar retail contexts.

---

## Technical Architecture

### Frontend-Driven Integration Pattern
**Core Principle:** Frontend orchestrates both persistence (Appwrite) and AI processing (LangGraph) without direct connection between the two services.

```
┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Appwrite     │  (Single source of truth)
│  (LessonRunner) │◀────│   (Sessions,    │  • All persistent data
│                 │     │    Evidence,    │  • Session → threadId mapping
│                 │     │    ThreadIDs)   │  • Progress tracking
│                 │     └─────────────────┘
│                 │     
│                 │     ┌─────────────────┐
│                 │────▶│   LangGraph     │  (AI processing only)
│                 │◀────│   (Teaching     │  • Receives context from frontend
└─────────────────┘     │    Logic)       │  • Returns intelligent responses
                        └─────────────────┘  • No persistence responsibility
```

### System Components
```
apps/web (Next.js)
├─ app/(routes)/dashboard            # SSR dashboard (requires auth cookie)
├─ app/(routes)/session/[id]         # Chat interface for lessons (SSR+CSR)
├─ app/api/chat/route.ts             # SSE proxy to LangGraph
├─ components/assistant-ui           # Chat interface (lesson delivery + general chat)
├─ lib/appwrite.ts                   # Admin, session clients
└─ lib/db.ts                         # CRUD for Appwrite collections

Appwrite (managed)
├─ Auth ✅                            # Email/Password, Google, SMTP recovery
└─ Databases                         # students, courses, enrollments, lesson_templates,
                                     # sessions (+ threadId), evidence, mastery

LangGraph (managed)
└─ Graph                             # Design → Delivery(sub-graph) → Mark → Progress (+checkpointing)
                                     # Receives session_context from frontend
                                     # Returns AI responses without persistence
```

### Data Flow (Chat-Driven Lesson Delivery)
```
User (authed) → Dashboard → "Continue Learning" or start "Nat 3 Money Conversions"
1) Frontend: Load session + threadId → Open chat interface at /session/[id]
2) Chat Interface: Connect to LangGraph thread → Agent greets and starts lesson
3) Agent: "Let's start with equivalences. Write 0.2 as a fraction in simplest form."
4) User: Types response → LangGraph processes → Agent provides feedback
5) Agent: Continues through lesson cards conversationally → Updates progress in Appwrite
6) Session complete: Agent summarizes → Returns to dashboard with updated mastery
```

### Chat-Driven Lesson Flow
```
Dashboard Action                    Appwrite Storage              Chat Interface
───────────────                     ─────────────────             ─────────────
"Start Lesson"                 →    Create Session Record    →    Open Chat at /session/[id]
                                    {                             Connect to threadId
                                      sessionId: "sess_123",      
                                      threadId: "thread_abc",     Agent: "Hi! Ready to work on
                                      lessonSnapshot: {...},             fractions and money?"
                                      currentCardIndex: 0         
                                    }                             

"Continue Learning"            →    Load Existing Session    →    Resume Chat Thread
                                    {                             Load conversation history
                                      sessionId: "sess_456",      
                                      threadId: "thread_xyz",     Agent: "Let's continue where 
                                      currentCardIndex: 2              we left off..."
                                    }

User types in chat            →    Agent processes via         →    Real-time conversation
                                   LangGraph thread                 "1/5"
                                   Records evidence                 
                                   Updates progress                 Agent: "Excellent! Now let's
                                                                           try a money problem..."
```

---

## Data Model (slice)
```ts
// Core
interface Student { $id:string; userId:string; displayName?:string;
  accommodations?:string[]; interests?:string[]; studyWindows?:string[]; schema_version:1; }
interface Course  { $id:string; courseId:"C844 73"; subject:"Applications of Mathematics";
  phase:"Senior"; level:"Nat3"; schema_version:1; }
interface Enrollment { $id:string; studentId:string; courseId:string; role:"student"|"observer"; schema_version:1; }

// Content
interface LessonTemplate {
  $id:string; courseId:string; title:string;
  outcomeRefs:{unit:string; outcome:string; label:string}[];
  cards:LessonCard[]; version:number; status:"draft"|"published"; createdBy:string; schema_version:1;
}
interface LessonCard {
  id:string; title:string; explainer:string; example?:string[];
  cfu:{ type:"numeric"|"mcq"; id:string; stem:string; expected?:number|string;
        tolerance?:number; options?:string[]; answerIndex?:number };
  outcomeIds?:string[]; alt?:{ explainer?:string; example?:string[] };
}

// Runtime
interface Session {
  $id:string; studentId:string; courseId:string; lessonTemplateId?:string;
  threadId:string;                                   // ← NEW: Links to LangGraph thread
  currentCardIndex:number;                           // ← NEW: Progress tracking
  startedAt:string; endedAt?:string; stage:"design"|"deliver"|"mark"|"progress"|"done";
  lessonSnapshot:{ title:string; outcomeRefs:LessonTemplate["outcomeRefs"]; cards:LessonCard[]; templateVersion?:number };
  schema_version:1;
}
interface Evidence {
  $id:string; sessionId:string; itemId:string; response:string;
  correct:boolean; score:number; outcomeScores:Record<string,number>;
  attemptIndex:number; strategy:"baseline"|"hint"|"scaffold"|"regenerate";
  feedback?:string;                                  // ← AI-generated feedback
  attempts:number;                                   // ← Attempt tracking
  aiProcessed:boolean;                               // ← NEW: Processed by LangGraph
  misconceptionTag?:string; submittedAt:string; schema_version:1;
}
interface Mastery { $id:string; studentId:string; courseId:string; outcomeId:string; ema:number; updatedAt:string; schema_version:1; }
```

**Relationships & Indexes**
- `enrollments` unique (studentId, courseId)
- `mastery` unique (studentId, courseId, outcomeId)
- `sessions` (studentId, courseId, startedAt DESC)
- `evidence` (sessionId, submittedAt ASC)
- `lesson_templates` (courseId, status, title)

**Permissions**
- Templates: read public/org; write admin.
- Enrollments/Sessions/Evidence/Mastery: **owner-only** (Role.user(student.userId)).

---

## Graphs (ASCII visuals)

### High-level graph (MVP0)
```
Entry
  |
  v
+---------+          +------------------+          +----------+
| design  |  ----->  |  delivery_loop   |  ----->  | progress |
+---------+          +------------------+          +----------+
                                                        |
                                                        v
                                                      [END]
```

### Delivery sub-graph (HITL: hints/scaffolds/variants until success or pause)
```
                +--------------------+
entry  -------> |  generate_variant  |
                +---------+----------+
                          |
                          v
                +---------+----------+
                |     present_ui     |  <-- HUMAN answers or pauses
                +---------+----------+
                          |
                          v
                +---------+----------+
                |      evaluate      | (deterministic mark)
                +----+----------+----+
                     |          |
                     |          |
          correct -> |          | <- incorrect
                     v          v
                +----+----+  +--+----------------+
                |  mark   |  |  hint_or_scaffold |
                +----+----+  +--+----------------+
                     \           /
                      \         /
                       v       v
                    +-----------+        +-----------+
                    | persist_try| ----> | updateEMA | (compute or preview)
                    +-----------+        +-----------+
                           \                   /
                            \                 /
                             v               v
                               +-----------+
                               |  decide   |
                               +-----+-----+
                                     |
             +-----------------------+----------------------+
             |                       |                      |
             v                       v                      v
       [EXIT_SUCCESS]            [EXIT_PAUSE]           loop to
                                                        generate_variant
```

---

## Chat Interface Integration

### Dashboard → Chat Session Flow
1. **Dashboard loads available lessons** → Pre-seeded "Nat 3 Money Conversions" appears
2. **User clicks lesson** → Creates session with threadId → Redirects to `/session/[id]`
3. **Chat interface loads** → Connects to LangGraph thread → Agent begins conversation
4. **"Continue Learning" shows existing sessions** → Loads threadId to resume conversation

### Chat Component Responsibilities
```typescript
// /session/[id] page loads chat with session context
const ChatSession = ({ sessionId }: { sessionId: string }) => {
  // Load session from Appwrite to get threadId
  const session = await getSession(sessionId);
  
  // Connect chat to LangGraph thread
  return (
    <AssistantUI 
      threadId={session.threadId}
      sessionContext={{
        sessionId: session.$id,
        lessonSnapshot: session.lessonSnapshot,
        currentCardIndex: session.currentCardIndex
      }}
    />
  );
};
```

### Conversational Lesson Flow
```
Agent: "Hi! Ready to learn about fractions and money? Let's start with equivalences."
Agent: "Write 0.2 as a fraction in simplest form."
User: "1/5"
Agent: "Perfect! 0.2 = 1/5. Now let's try money problems..."
Agent: "If something costs £18 and has 10% off, what's the sale price?"
User: "£16.20" 
Agent: "Excellent! You rounded to 2 decimal places correctly..."
```

### Benefits of Chat-Driven Lessons
- ✅ **Natural Conversation**: Lessons feel like tutoring, not forms to fill
- ✅ **Adaptive Feedback**: Agent can provide hints and encouragement contextually
- ✅ **Progressive Disclosure**: Information revealed conversationally as needed
- ✅ **Resumable**: Chat history maintains lesson context across sessions
- ✅ **Unified Interface**: Same chat UI for lessons and general questions

---

## Onboarding & Seeding (first login)
1) Ensure **Student** doc for Appwrite user.
2) Ensure **Course** (**C844 73**) exists (Nat 3 AoM).
3) **Auto-enrol** student → course.
4) Ensure **LessonTemplate** (*Fractions ↔ Decimals ↔ Percents in Everyday Money*) exists/published (aligned to **H225 73** and **HV7Y 73**).
5) Create **Session** with **lessonSnapshot**; route to `/session/[id]`.

---

## Implementation Phases

**Phase 1 — Spine**
- Collections/indexes/ACL in Appwrite
- Seed **Course** + **LessonTemplate** (pre-populated on dashboard)
- Pages: `/dashboard` (shows available/continuing lessons), `/session/[id]` (chat interface)
- **Chat Interface**: Connect AssistantUI to LangGraph threads with session context
- Graph: **Design → Delivery(sub) → Mark → Progress** (delivers lesson cards conversationally)

**Phase 2 — Minimal Pedagogy**
- Agent presents 3 cards conversationally: equivalences; 10% off; best-deal
- **Chat-driven CFU**: Agent prompts, user responds, agent provides feedback
- Store **Evidence** per chat interaction; simple **EMA** update per outcome

**Phase 3 — UX polish**
- **Chat enhancements**: Quiet mode; large-text toggle; typing indicators
- **Dashboard polish**: Clear "Continue Learning" vs new lessons; progress indicators

---

## API / Interface (examples)
```
POST /api/sessions
{ "courseId": "C844 73" }
→ 201 { "sessionId": "sess_..." }

GET  /api/sessions/:id
→ 200 { lessonSnapshot, stage, latestEvidence[] }

POST /api/chat (SSE)
{ "sessionId": "sess_...", "event": { "type":"response", "itemId":"q2", "value":"16.2" } }
→ stream of graph states + feedback
```

---

## Success Criteria
1) New authed learner completes the seed lesson; **Evidence** & **Mastery** persist; resume works.
2) Scores correct for numeric/MCQ; money answers shown in **2 d.p.**.
3) ≥70% session completion in pilot; ≥60% feedback as “clear & kind”.
4) No data leakage across accounts.

---

## Risks & Mitigations
| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| ACL misconfig leaks data | High | Low | Owner-only ACL; e2e tests with secondary account |
| Marking bugs (money rounding) | Med | Med | Unit tests; always **2 d.p.** for currency at N3 |
| Graph state desync | Med | Med | Pass `{userId, sessionId}` on every call; store `graphRunId` in `sessions` |
| Scope creep | Med | Med | Freeze MVP to 3 cards; defer free-text marking |

---

## Design Notes

### LLM Teacher Integration Architecture
**Role of llm_teacher.py:**
The `llm_teacher.py` module serves as the **conversational layer** that transforms the existing teaching graph from template-based responses into intelligent, contextual AI tutoring:

```
Current teaching_graph.py nodes:
├── design_node() → hardcoded "Let's start with equivalences..."
├── mark_node() → hardcoded "✓ Correct! Well done."
└── progress_node() → hardcoded "Moving to next card..."

Enhanced with llm_teacher.py:
├── design_node() → llm_teacher.present_card() → "Hi Sarah! Ready to explore fractions in everyday money situations? Let's start with a fun equivalence challenge..."
├── mark_node() → llm_teacher.evaluate_response() → "Excellent thinking! 0.2 = 1/5 is exactly right. You've got the concept of converting decimals to simplified fractions. Now let's see how this applies to money calculations..."
└── progress_node() → llm_teacher.transition_to_next() → "Perfect! You've mastered equivalences. Next, we'll tackle something practical - calculating discounts when shopping..."
```

**Integration Points:**
1. **ChatOpenAI Client**: Initialized with `OPENAI_API_KEY` from `.env.local`
2. **Teaching Prompts**: Structured prompts for each teaching stage:
   - Greeting & lesson introduction
   - Card presentation with context
   - Response evaluation with feedback
   - Transition between cards
3. **Smart Marking**: Combines LLM contextual understanding with deterministic scoring rules
4. **Conversational Flow**: Makes lessons feel like one-on-one tutoring rather than quiz forms

**Implementation Pattern:**
```python
# Before (teaching_graph.py)
return {"messages": [AIMessage(content="✓ Correct! Well done.")]}

# After (with llm_teacher.py)
from .llm_teacher import LLMTeacher
teacher = LLMTeacher()
feedback = await teacher.evaluate_response(
    student_response=student_response,
    expected_answer=cfu["expected"],
    card_context=current_card,
    attempt_number=attempts
)
return {"messages": [AIMessage(content=feedback)]}
```

### Frontend-Driven Architecture Decision
**Core Principle:** Frontend orchestrates both persistence (Appwrite) and AI processing (LangGraph) without direct connection between services.

**Rationale:**
- **Single Source of Truth**: Appwrite holds all persistent data
- **Context Control**: Frontend constructs session context and passes to LangGraph
- **Evidence Recording**: Frontend receives LangGraph responses and persists evidence
- **Session Management**: Frontend maps sessionId → threadId for conversation continuity
- **State Synchronization**: Frontend ensures consistency between chat state and database state

### Chat-Driven Lesson Architecture Decision
**Implementation:** Single chat interface for both general questions and structured lesson delivery.

**Benefits:**
- **Natural Conversation**: Lessons feel like tutoring, not forms
- **Adaptive Feedback**: Agent provides contextual hints and encouragement  
- **Progressive Disclosure**: Information revealed conversationally as needed
- **Resumable**: Chat history maintains lesson context across sessions
- **Unified Interface**: Same UI for lessons and general support

**Technical Implementation:**
- `/chat` → General assistant without session context
- `/session/[id]` → Same chat UI with lesson session context
- MyAssistant component accepts optional sessionContext for lesson mode
- LangGraph receives session context and delivers cards conversationally

## Open Questions
- Do we show a **simple data-handling** card in MVP0 or v0.1? (bar chart read)
- EMA weighting defaults (e.g., 0.6 recent / 0.4 prior) acceptable?
- Capture **calculator used** flag per attempt (analytics only)?
