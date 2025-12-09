# Infinite Practice Implementation Plan

## Goal Description
Implement critical robustness and persistence features for the Infinite Practice system. This ensures session data is saved/restored (preventing data loss), the system is resilient to LLM output formatting errors, and configuration (models, thresholds) is decoupled from code.

## User Review Required
> [!IMPORTANT]
> **Appwrite CRUD Location**: **UPDATED DECISION**: The CRUD operations for **Practice Session State** will be implemented in the **Frontend** (`PracticeSessionDriver` + `PracticeChatAssistant`), mirroring the `SessionChatAssistant` pattern. The Backend will be stateless/agnostic.
> **Refactor Plan**: See [Infinite Practice Refactor Plan](file:///Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/tasks/infinite_practice_refactor_plan.md) for detailed architecture.

> [!WARNING]
> This implementation assumes an Appwrite Persistent Layer (Collection) exists. We will need to define the schema for `practice_sessions` in the driver.

## Proposed Changes

### 1. Robustness: Structured Output Parsing
**Component:** `langgraph-agent`
- **File:** `src/agent/infinite_practice_graph.py`
  - Replace manual JSON string parsing with `ChatAnthropic.with_structured_output` (or equivalent Pydantic parser) for:
    - `generate_question_node`
    - `mark_response_node`
  - Define Pydantic models for `Question` and `MarkingResult` to ensure type safety.

### 2. Configuration: Environment Variables
**Component:** `langgraph-agent`
- **File:** `src/agent/infinite_practice_graph.py` (and potentially `src/agent/config.py` if exists)
  - Replace hardcoded `claude-sonnet-4-20250514` with `os.getenv("INFINITE_PRACTICE_MODEL", "gpt-4o-mini")` (as requested "gpt5.1-mini", likely unavailable, suggesting `gpt-4o-mini` or similar current model as default). *Correction: User asked for `gpt5.1-mini`, will use that as default string, assuming it's a proxy/internal alias.*
- **File:** `.env.local` (and others)
  - Add `INFINITE_PRACTICE_MODEL=gpt5.1-mini`

### 3. Tuning: Configurable Thresholds
**Component:** `langgraph-agent`
- **File:** `src/agent/practice_session.py`
  - Update `create_practice_session` to accept `adaptive_thresholds` dict.
  - Default: `{ "advance": 0.8, "demote": 0.4 }`
- **File:** `src/agent/infinite_practice_graph.py`
  - Update `update_progress_node` to use these values from `session["adaptive_thresholds"]`.

### 4. Persistence: Frontend-Driven (Refactor)
**Component:** `assistant-ui-frontend` & `langgraph-agent`
- **Frontend File:** `lib/appwrite/driver/PracticeSessionDriver.ts` (New)
  - Implement `createSession`, `updateSession`.
- **Frontend File:** `components/PracticeChatAssistant.tsx`
  - Manage Lifecycle: Load session -> Start Graph -> Listen to Tools -> Save State.
- **Backend File:** `src/agent/infinite_practice_graph.py`
  - **Remove** `load/save` stubs.
  - **Update** `initialize_node` to accept session in context.

## Tracking Checklist

- [x] Create implementation plan in `tasks/infinite_practice_implementation_plan.md`
- [x] Create detailed refactor plan in `tasks/infinite_practice_refactor_plan.md`
- [ ] **Frontend**: Implement `PracticeSessionDriver` (Mock/Real)
- [ ] **Frontend**: Update `PracticeChatAssistant.tsx` to check/load session
- [ ] **Backend**: Remove Appwrite Stubs from `infinite_practice_graph.py`
- [ ] **Backend**: Update `initialize_node` to parse session from context
- [ ] **Backend**: Ensure `PracticeSession` model is serializable/clean
- [ ] **Verification**: Verify session resumes after refresh

## Verification Plan

### Automated Tests
- **Pydantic Validation:**
  - Create a test script `tests/test_structure_parsing.py` that mocks LLM responses and asserts valid Pydantic object creation.
  - Run: `python tests/test_structure_parsing.py`

### Manual Verification
1.  **Persistence Test:**
    - Start a practice session at `/practice/[id]`.
    - Answer one question.
    - Refresh the page.
    - **Expectation:** Session resumes from the same question (or next), progress is preserved.
2.  **Configuration Test:**
    - Change `.env` model to a different string.
    - **Expectation:** Logs show new model being initialized.
