# Infinite Practice Refactor: Frontend-Driven Persistence

## Overview
Refactor the Infinite Practice system to decouple the Backend (LangGraph) from Appwrite. All database persistence (CRUD) will be handled by the Frontend (`PracticeChatAssistant` and Tools) using a new `PracticeSessionDriver`. The Backend will remain functional, processing state and returning updates via Tool Calls.

## Architecture

### Data Flow
1.  **Initialization (Frontend):**
    -   User visits `/practice/[templateId]`.
    -   `PracticeChatAssistant` checks Appwrite for an *active* `PracticeSession` for this student+template.
    -   **If Found:** Loads full session JSON.
    -   **If Not Found:** Passes `null` (or explicit "new" flag) + `LessonTemplate` data.
    -   frontend sends `session_context` to Backend.

2.  **Processing (Backend - `infinite_practice_graph.py`):**
    -   `initialize_node`: Checks `session_context`.
        -   If session provided: Resumes.
        -   If missing: Runs `BlockFactory` (LLM) to generate `PracticeSession` object.
    -   **Output:** The graph State updates with the valid `PracticeSession` object.

3.  **Synchronization (Tool Calls):**
    -   Nodes (`present_concept`, `present_question`, `present_feedback`) include the **updated Session ID** and **Progress/State** in their Tool Call arguments.
    -   *Crucial change:* For a *new* session, the first tool call (`present_concept`) MUST include the full generated `PracticeSession` object (or the Frontend must be able to extract it from the thread state).

4.  **Persistence (Frontend):**
    -   **New Session:** When `PracticeChatAssistant` detects a new session layout (e.g., from the first Tool Call key args), it calls `PracticeSessionDriver.createSession(...)`.
    -   **Updates:** When `PracticeFeedbackTool` receives `new_mastery_score` or `block_complete`, it calls `PracticeSessionDriver.updateProgress(...)`.

## Detailed Changes

### 1. Frontend: New `PracticeSessionDriver`
**Location:** `assistant-ui-frontend/lib/appwrite/driver/PracticeSessionDriver.ts`
-   **checkActiveSession(studentId, templateId)**: Returns `PracticeSession` | `null`.
-   **createSession(sessionData)**: Creates document in `practice_sessions` collection.
-   **updateSessionProgress(sessionId, progressData)**: Updates `blocks_progress`, `mastery`, etc.

### 2. Frontend: `PracticeChatAssistant.tsx`
-   **Load Phase:**
    -   Call `checkActiveSession`.
    -   If exists, pass as `session_context: { stored_session: ... }`.
    -   If new, pass `session_context: { source_data: template }`.
-   **Save Phase (Session Creation):**
    -   Listen for the first `concept_presentation` tool call.
    -   If we don't have a `sessionId` in local state yet, verify if the Tool Call provides the new Session Data.
    -   **Better Approach:** The Backend `initialize_node` should probably output a specific **"Session Created"** event or structure if we want explicit saving, OR the frontend simply saves the *result* of the graph's initialization.
    -   *Simplification:* The first Tool Call (`concept_presentation`) will contain the `block_id` and `progress`. The Frontend can "create" the session skeleton in Appwrite at the *start* (before calling graph?) No, extraction happens in Graph.
    -   *Plan:* The Graph adds the full `PracticeSession` object to the `concept_presentation` tool args (only for the first call) OR we use `onThreadEvents` to read the Graph State.

### 3. Backend: `infinite_practice_graph.py`
-   **Remove:**
    -   `load_session_from_appwrite` (and imports).
    -   `save_session_to_appwrite` (and imports).
-   **Update `initialize_node`:**
    -   Read `state["session_context"]`.
    -   If `stored_session` exists: Use it.
    -   If not: Run BlockFactory -> Create Session Object -> Update State.
-   **Update `present_concept_node`:**
    -   Add `full_session_payload` to tool args IF it's a new session (so frontend can save it).

### 4. Backend: `practice_session.py`
-   Ensure models are serializable (Already `TypedDict`).

## Step-by-Step Implementation

1.  **Frontend Driver:** Create `PracticeSessionDriver.ts` (Mock/Stub for now until Appwrite schema is ready, or implement basic JSON persistence).
2.  **Backend Cleanup:** Remove Appwrite logic from `infinite_practice_graph.py`.
3.  **Backend State Passing:** Modify `initialize_node` to accept session from context.
4.  **Frontend Integration:** Update `PracticeChatAssistant` to check for session and pass to graph.

## Configuration Updates
-   **Structured Outputs:** (From previous plan) Still apply here.
-   **Env Vars:** Still apply.

> [!NOTE]
> This "Frontend-Driven" approach aligns with `SessionChatAssistant`, keeping the Backend as a pure logic engine.
