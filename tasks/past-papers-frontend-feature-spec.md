# Past Papers Frontend Feature Specification

## Document Metadata
- **Created**: 2025-01-10
- **Status**: Implemented
- **Feature Type**: User-facing Frontend Feature
- **Related Backend**: `claud_author_agent/` (Walkthrough Author Agent)

---

## Executive Summary

A comprehensive frontend feature that allows students to browse SQA past papers and view examiner-aligned walkthroughs. The feature provides hierarchical navigation through subjects, levels, years, and individual questions with step-by-step solutions.

**Key User Benefits**:
- **Browse Past Papers**: Navigate through available SQA past papers by subject and level
- **View Step-by-Step Solutions**: Each question walkthrough shows exactly what earns marks
- **Mark Labelling**: See which mark each step earns (•1, •2, etc.)
- **Error Prevention**: Learn common mistakes and how to avoid them
- **Dashboard Integration**: Quick access via "Past Papers" button when available

---

## User Journey

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         PAST PAPERS USER JOURNEY                            │
└────────────────────────────────────────────────────────────────────────────┘

Dashboard                 Browse Page              Paper Page              Walkthrough
┌──────────┐             ┌───────────────┐        ┌──────────────┐        ┌──────────────┐
│          │  Click      │ Mathematics   │ Click  │ 2023 Paper 1 │ Click  │ Question 1   │
│ [Past    │ ──────────► │ ├─ National 5 │ ────► │ ├─ Q1 (2 mk) │ ────► │              │
│ Papers]  │             │ │  └─ 2023    │        │ ├─ Q2 (3 mk) │        │ •1: Strategy │
│          │             │ │  └─ 2022    │        │ └─ Q3 (4 mk) │        │ •2: Simplify │
└──────────┘             │ └─ Higher     │        └──────────────┘        │              │
                         └───────────────┘                                │ Common Errors│
                                                                          │ Examiner Tips│
                                                                          └──────────────┘
```

---

## Architecture Overview

### Component Hierarchy

```
/past-papers (Main Browse)
├── /[subject]/[level] (Papers List)
│   └── /[year]/[paperCode] (Questions List)
│       └── /[questionNumber] (Walkthrough View)
```

### Data Flow

```
┌─────────────┐     ┌────────────────┐     ┌──────────────────┐
│   Browser   │────►│   API Routes   │────►│  PastPaperDriver │
└─────────────┘     └────────────────┘     └──────────────────┘
                                                    │
                    ┌──────────────────────────────┘
                    ▼
    ┌───────────────────────────────────────────────────────┐
    │              Appwrite (sqa_education database)         │
    │  ┌─────────────┐           ┌───────────────────┐      │
    │  │  us_papers  │           │  us_walkthroughs  │      │
    │  └─────────────┘           └───────────────────┘      │
    └───────────────────────────────────────────────────────┘
```

---

## File Structure

```
assistant-ui-frontend/
├── app/
│   ├── (protected)/
│   │   └── past-papers/
│   │       ├── page.tsx                              # Main browse page
│   │       └── [subject]/
│   │           └── [level]/
│   │               ├── page.tsx                      # Papers list for subject/level
│   │               └── [year]/
│   │                   └── [paperCode]/
│   │                       ├── page.tsx              # Questions list for paper
│   │                       └── [questionNumber]/
│   │                           └── page.tsx          # Walkthrough view
│   └── api/
│       └── past-papers/
│           ├── route.ts                              # Base route
│           ├── browse/
│           │   └── route.ts                          # GET subjects/levels
│           ├── [paperId]/
│           │   ├── route.ts                          # GET paper details
│           │   └── questions/
│           │       └── [questionNumber]/
│           │           └── walkthrough/
│           │               └── route.ts              # GET walkthrough
│           └── availability/
│               └── [courseId]/
│                   └── route.ts                      # GET availability check
├── components/
│   ├── past-papers/
│   │   └── WalkthroughAccordion.tsx                 # Main walkthrough display
│   └── dashboard/
│       └── EnhancedStudentDashboard.tsx             # (Modified) Past Papers button
├── lib/
│   └── appwrite/
│       └── driver/
│           └── PastPaperDriver.ts                   # Data access layer
└── tests/
    ├── api/
    │   └── past-papers.test.ts                      # API tests
    └── e2e/
        └── past-papers.spec.ts                      # Playwright E2E tests
```

---

## Component Specifications

### 1. Main Browse Page (`/past-papers`)

**File**: `app/(protected)/past-papers/page.tsx`

**Purpose**: Entry point displaying available subjects and levels

**Features**:
- Groups papers by subject with gradient-styled headers
- Shows levels within each subject
- Displays available years as badges
- Click-through navigation to level pages

**UI Components**:
- Subject cards with blue gradient headers
- Level buttons with year badges
- Loading spinner state
- Error handling with retry option

---

### 2. Papers List Page (`/past-papers/[subject]/[level]`)

**File**: `app/(protected)/past-papers/[subject]/[level]/page.tsx`

**Purpose**: Show available papers for a subject/level combination

**Features**:
- Lists papers by year
- Shows paper metadata (total marks, calculator allowed)
- Question count per paper
- Breadcrumb navigation

---

### 3. Questions List Page (`/past-papers/[subject]/[level]/[year]/[paperCode]`)

**File**: `app/(protected)/past-papers/[subject]/[level]/[year]/[paperCode]/page.tsx`

**Purpose**: Show questions within a paper

**Features**:
- Question numbers with marks
- Topic tags per question
- Walkthrough availability indicator
- Click to view walkthrough

---

### 4. Walkthrough View Page (`/past-papers/.../[questionNumber]`)

**File**: `app/(protected)/past-papers/[subject]/[level]/[year]/[paperCode]/[questionNumber]/page.tsx`

**Purpose**: Display the examiner-aligned walkthrough

**Features**:
- Question stem with LaTeX rendering
- Expandable solution steps accordion
- Common errors panel
- Examiner summary callout

---

### 5. WalkthroughAccordion Component

**File**: `components/past-papers/WalkthroughAccordion.tsx`

**Purpose**: Reusable component for displaying walkthrough content

**Subcomponents**:
| Component | Purpose | Theme |
|-----------|---------|-------|
| Question Card | Display question stem | Blue |
| Steps Accordion | Expandable solution steps | White |
| CommonErrorsPanel | Show common mistakes | Red |
| ExaminerNotesCallout | Show examiner tips | Amber |

**Props Interface**:
```typescript
interface WalkthroughAccordionProps {
  walkthrough: {
    question_stem: string;
    question_stem_latex: string;
    topic_tags: string[];
    total_marks: number;
    steps: WalkthroughStep[];
    common_errors: CommonError[];
    examiner_summary: string;
    diagram_refs: string[];
  };
}
```

---

## API Routes

### GET `/api/past-papers/browse`

**Purpose**: Get navigation structure (subjects, levels, years)

**Response**:
```json
{
  "subjects": [
    {
      "name": "Mathematics",
      "levels": [
        { "name": "National 5", "years": [2023, 2022, 2021] },
        { "name": "Higher", "years": [2023, 2022] }
      ]
    }
  ]
}
```

### GET `/api/past-papers/[paperId]`

**Purpose**: Get paper details with questions list

**Response**:
```json
{
  "paper": {
    "paperId": "mathematics-n5-2023-X847-75-01",
    "subject": "Mathematics",
    "level": "National 5",
    "year": 2023,
    "paperCode": "X847/75/01",
    "totalMarks": 50
  },
  "questions": [
    { "number": "1", "marks": 2, "topicTags": ["fractions"], "hasWalkthrough": true }
  ]
}
```

### GET `/api/past-papers/[paperId]/questions/[questionNumber]/walkthrough`

**Purpose**: Get walkthrough content for a question

**Response**:
```json
{
  "walkthrough": {
    "question_stem_latex": "Evaluate $2\\frac{1}{6} \\div \\frac{8}{9}$",
    "total_marks": 2,
    "steps": [
      {
        "bullet": 1,
        "label": "•1: strategy",
        "process": "convert to improper fraction and multiply by reciprocal",
        "working_latex": "\\frac{13}{6} \\times \\frac{9}{8}",
        "marks_earned": 1
      }
    ],
    "common_errors": [...],
    "examiner_summary": "..."
  }
}
```

### GET `/api/past-papers/availability/[courseId]`

**Purpose**: Check if past papers exist for a course (dashboard integration)

**Response**:
```json
{
  "success": true,
  "available": true,
  "subject": "Mathematics",
  "level": "National 5",
  "subjectSlug": "mathematics",
  "levelSlug": "national-5"
}
```

---

## Data Access Layer

### PastPaperDriver

**File**: `lib/appwrite/driver/PastPaperDriver.ts`

**Database**: `sqa_education` (not `default`)

**Collections**:
- `us_papers`: Past paper documents with questions
- `us_walkthroughs`: Generated walkthrough content

**Key Methods**:

| Method | Purpose |
|--------|---------|
| `getAvailableSubjectsAndLevels()` | Get navigation structure |
| `getPapers(filter)` | Get papers by subject/level/year |
| `getPaper(paperId)` | Get single paper with parsed data |
| `getQuestionsList(paperId)` | Get questions for navigation |
| `getWalkthrough(paperId, questionNumber)` | Get walkthrough content |
| `hasPastPapersForSubjectLevel(subject, level)` | Availability check |

---

## Dashboard Integration

### EnhancedStudentDashboard Modifications

**File**: `components/dashboard/EnhancedStudentDashboard.tsx`

**Changes Made**:
1. Added state for past papers availability check
2. Added useEffect to check availability when course changes
3. Added "Past Papers" button (purple theme) next to Mock Exam button

**Button Appearance**:
- Purple gradient styling (`bg-purple-600 hover:bg-purple-700`)
- `ClipboardList` icon
- Only visible when `pastPapersAvailable === true`
- Navigates to `/past-papers/{subject}/{level}`

**Flow**:
```
Dashboard loads
    │
    ▼
useEffect triggers on activeCourse change
    │
    ▼
Fetch /api/past-papers/availability/{courseId}
    │
    ▼
If available:
  └── Show "Past Papers" button
  └── Store subject/level slugs for navigation
```

---

## URL Structure

### Dynamic Route Segments

| Segment | Example | Purpose |
|---------|---------|---------|
| `[subject]` | `Mathematics` | URL-encoded subject name |
| `[level]` | `National%205` | URL-encoded level name |
| `[year]` | `2023` | Exam year |
| `[paperCode]` | `X847-75-01` | SQA paper code (slashes replaced) |
| `[questionNumber]` | `1`, `4a`, `5b(i)` | Question identifier |

### Example URLs

```
/past-papers
/past-papers/Mathematics/National%205
/past-papers/Mathematics/National%205/2023/X847-75-01
/past-papers/Mathematics/National%205/2023/X847-75-01/1
/past-papers/Mathematics/National%205/2023/X847-75-01/4a
```

---

## Testing Strategy

### API Tests (`tests/api/past-papers.test.ts`)

| Test | Description |
|------|-------------|
| Authentication required | All routes return 401 without auth |
| Browse returns structure | `/browse` returns subjects/levels |
| Paper details returned | `/[paperId]` returns paper data |
| Walkthrough content | `/[paperId]/questions/[q]/walkthrough` |
| Availability check | `/availability/[courseId]` works |

### E2E Tests (`tests/e2e/past-papers.spec.ts`)

| Test | Description |
|------|-------------|
| Dashboard integration | Past Papers button visibility |
| Browse hierarchy | Navigation through levels |
| Question list | Display questions for paper |
| Walkthrough view | Accordion expands correctly |
| Error handling | Graceful handling of missing data |
| Authentication | Route protection |

**Test Results**: 10 passed, 1 skipped (expected)

---

## Security Considerations

### Authentication
- All routes require authenticated user session
- Uses `createSessionClient()` for user context
- Uses `createAdminClient()` for database queries

### Authorization
- Past papers are public content (no per-user permissions)
- Authentication ensures only logged-in users access

### Data Protection
- No sensitive data exposed
- Walkthrough content is read-only
- No user input accepted (browse-only feature)

---

## Performance Considerations

### Data Compression
- Walkthrough content stored as gzip + base64
- Decompressed on API layer, not frontend
- Typical compression ratio: 40-60%

### Query Optimization
- `Query.limit(1)` for availability checks
- Indexed queries on subject/level
- Pagination not implemented (papers/questions counts are small)

### Caching Opportunities
- Browse data could be cached (subjects/levels change rarely)
- Paper data could be cached (static content)
- Not currently implemented

---

## Future Enhancements

### Planned
- [ ] Search across all papers by topic tag
- [ ] Bookmark favorite walkthroughs
- [ ] Track which walkthroughs user has viewed
- [ ] Print-friendly walkthrough format

### Potential
- [ ] Compare solutions across years
- [ ] Related questions recommendations
- [ ] Difficulty ratings per question
- [ ] Community discussion per question

---

## Related Documentation

### Backend (Author Agent)
- Spec: `claud_author_agent/tasks/WALKTHROUGH_AUTHOR_AGENT_SPEC.md`
- Models: `claud_author_agent/src/models/walkthrough_models.py`
- Prompts: `claud_author_agent/src/prompts/walkthrough_*.md`

### Database
- Database: `sqa_education`
- Collections: `us_papers`, `us_walkthroughs`

---

## Implementation Checklist

### Completed
- [x] PastPaperDriver data access layer
- [x] API routes for browse, paper, walkthrough
- [x] Main browse page (`/past-papers`)
- [x] Papers list page (`/[subject]/[level]`)
- [x] Questions list page (`/.../[year]/[paperCode]`)
- [x] Walkthrough view page (`/.../[questionNumber]`)
- [x] WalkthroughAccordion component
- [x] CommonErrorsPanel component
- [x] ExaminerNotesCallout component
- [x] Dashboard "Past Papers" button integration
- [x] Availability API for dashboard
- [x] API tests
- [x] E2E tests with Playwright

---

**END OF SPECIFICATION**
