# Nat5+ SQA Mock Exam System

## Overview

A complete mock exam system for National 5+ SQA courses with three components:

1. **Offline Mock Exam Generator** - Claude author agent generating unique exams
2. **LangGraph Evaluator** - AI-powered SQA-style marking
3. **Frontend** - `/sqa-mock-exam` route for taking exams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     NAT5+ MOCK EXAM SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │  AUTHOR AGENT   │    │    FRONTEND     │    │    EVALUATOR    │        │
│  │  (Offline)      │    │  /sqa-mock-exam │    │   (LangGraph)   │        │
│  │                 │    │                 │    │                 │        │
│  │  • Generate     │───▶│  • Browse exams │───▶│  • SQA marking  │        │
│  │  • Validate     │    │  • Take exam    │    │  • Feedback     │        │
│  │  • Upsert       │    │  • Submit       │    │  • Grades       │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
│           │                      │                     │                   │
│           └──────────────────────┼─────────────────────┘                   │
│                                  ▼                                         │
│                        ┌─────────────────┐                                 │
│                        │    APPWRITE     │                                 │
│                        │  nat5_plus_*    │                                 │
│                        └─────────────────┘                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Generate an Exam

```bash
cd claud_author_agent
source .venv/bin/activate

python -m src.nat5_plus.exam_generator_client \
  --course-id "YOUR_COURSE_ID" \
  --workspace ./workspaces/exam_001
```

### 2. Start the Application

```bash
./start.sh
```

### 3. Take an Exam

Navigate to `http://localhost:3000/sqa-mock-exam` and select an exam.

## Appwrite Collections

### nat5_plus_mock_exams

Stores generated exams with compressed content.

| Field | Type | Description |
|-------|------|-------------|
| courseId | string | Course identifier |
| subject | string | Subject name |
| level | string | Qualification level |
| exam_version | integer | Version number |
| status | enum | draft/published/archived |
| metadata | string (JSON) | Title, marks, duration |
| sections | string (compressed) | Questions with marking schemes |
| topic_coverage | string[] | Topics covered |
| difficulty_distribution | string (JSON) | Easy/medium/hard mix |

### nat5_plus_exam_attempts

Tracks student exam attempts and results.

| Field | Type | Description |
|-------|------|-------------|
| examId | string | Exam reference |
| studentId | string | Student reference |
| attempt_number | integer | Which attempt |
| status | enum | in_progress/submitted/graded |
| answers_snapshot | string (compressed) | Student answers |
| result_snapshot | string (compressed) | Evaluation result |
| marks_earned | integer | Total marks earned |
| marks_possible | integer | Maximum possible |
| percentage | float | Score percentage |
| grade | string | A/B/C/D/No Award |

### nat5_plus_exam_summaries

For uniqueness tracking by the author agent. Each generated exam creates a summary with question fingerprints (SHA-256 hashes of normalized stems).

| Field | Type | Description |
|-------|------|-------------|
| courseId | string | Course identifier |
| exam_id | string | Exam reference |
| topic_ids | string[] | Topics used |
| question_styles | string[] | Styles used |
| difficulty_mix | string (JSON) | Easy/medium/hard distribution |
| question_fingerprints | string (JSON) | SHA-256 content hashes for uniqueness |
| created_at | string | Creation timestamp |

## Cross-Exam Uniqueness

### How It Works

The system guarantees unique questions across multiple exams for the same course:

1. **Load Phase**: When generating a new exam, all existing `nat5_plus_exam_summaries` for the course are loaded
2. **Build Known Set**: All fingerprints from previous exams are combined into a known set
3. **Generate & Check**: Each new question's stem is fingerprinted and checked against known set
4. **Persist**: New exam's fingerprints are saved for future generations

### Verification Results (2026-01-13)

| Exam | Document ID | Internal Duplicates | Cross-Exam Overlap |
|------|-------------|--------------------|--------------------|
| Exam 1 (Pre-Fix) | `6966428c...` | 40% ❌ | - |
| Exam 2 (Post-Fix) | `69664b50...` | 0% ✅ | 0 fingerprints ✅ |
| Exam 3 (Post-Fix) | `69664c57...` | 0% ✅ | 0 fingerprints ✅ |

**Key Findings:**
- Post-fix exams have **0% internal duplicates** (Bug #13 fixed)
- **0 overlapping fingerprints** between any pair of exams
- Cross-exam uniqueness algorithm working correctly

## API Routes

### List Exams
```
GET /api/sqa-mock-exam?courseId={courseId}
```

### Get Exam
```
GET /api/sqa-mock-exam/{examId}
```

### Create Attempt
```
POST /api/sqa-mock-exam/attempt
Body: { examId, courseId }
```

### Submit Exam
```
POST /api/sqa-mock-exam/{examId}/submit
Body: { attemptId, answers[], mock_exam }
```

### Get Attempt Status
```
GET /api/sqa-mock-exam/attempt/{attemptId}
```

## SQA Marking System

The evaluator uses SQA-style marking:

### Grade Bands

| Grade | Percentage |
|-------|------------|
| A | 85-100% |
| B | 70-84% |
| C | 55-69% |
| D | 40-54% |
| No Award | 0-39% |

### Marking Principles

1. **Bullet-by-bullet marking** - Each mark point assessed independently
2. **Follow-through marks** - Credit for correct method with wrong values
3. **Tolerance ranges** - Accept values within specified tolerances
4. **Equivalent forms** - Accept mathematically equivalent answers

## Frontend Components

### ExamBrowser
Lists available exams with metadata and allows selection.

### SQAExamContainer
Main orchestrator for the exam experience:
- Instructions phase
- In-progress with timer
- Submitting with polling
- Results display

### SQAQuestionDisplay
Renders individual questions with:
- LaTeX support
- Working/solution input
- Final answer input
- Flag for review

### SQAResultsSummary
Displays overall results:
- Grade with band visualization
- Section breakdown
- Performance summary

### SQAFeedbackPanel
Detailed per-question feedback:
- Bullet-by-bullet marks
- Expected vs actual answers
- Misconception detection

## Testing

### Run All Tests

```bash
# Contract tests
pytest claud_author_agent/tests/contracts/ -v
pytest langgraph-agent/tests/unit_tests/test_nat5_plus_contracts.py -v
npm test -- --testPathPattern=contracts

# Unit tests
pytest claud_author_agent/tests/unit/ -v
pytest langgraph-agent/tests/unit_tests/test_nat5_plus*.py -v

# Integration tests
pytest claud_author_agent/tests/integration/ -v
```

### Validation Script

```bash
./scripts/validate_nat5_plus_system.sh
```

## Contract Fixtures

Shared JSON fixtures define the API contracts:

- `fixtures/sample_nat5_plus_exam.json` - Author → Frontend
- `fixtures/sample_nat5_plus_submission.json` - Frontend → Evaluator
- `fixtures/sample_nat5_plus_evaluation.json` - Evaluator → Frontend

## Environment Variables

```bash
# Appwrite
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key

# LangGraph
LANGGRAPH_URL=http://localhost:2024

# Anthropic
ANTHROPIC_API_KEY=your_claude_api_key
```

## Troubleshooting

### "No exams available"
- Check `nat5_plus_mock_exams` collection has published exams
- Verify courseId filter if applied

### "Grading failed"
- Check LangGraph backend is running on port 2024
- Verify `graph_nat5_plus_exam` is registered in `langgraph.json`
- Check backend logs for errors

### "Failed to create attempt"
- Verify student is authenticated
- Check `nat5_plus_exam_attempts` collection permissions

## Related Files

- Author Agent: `claud_author_agent/src/nat5_plus/`
- Evaluator: `langgraph-agent/src/agent/graph_nat5_plus_exam.py`
- Frontend Types: `assistant-ui-frontend/lib/sqa-mock-exam/types.ts`
- Components: `assistant-ui-frontend/components/sqa-mock-exam/`
- API Routes: `assistant-ui-frontend/app/api/sqa-mock-exam/`
- Pages: `assistant-ui-frontend/app/(protected)/sqa-mock-exam/`
