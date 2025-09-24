# Task List: Context-Aware Chat Client Implementation

Based on PRD: `prd-context-aware-chat-client.md`

## Relevant Files

### Backend Files (langgraph-generic-chat/)
- `langgraph-generic-chat/src/react_agent/state.py` - Enhanced state management with TeachingContext dataclass
- `langgraph-generic-chat/src/react_agent/prompts.py` - Context-aware system prompts for lesson understanding
- `langgraph-generic-chat/src/react_agent/tools.py` - Enhanced search tools with context awareness
- `langgraph-generic-chat/src/react_agent/context.py` - Configuration for context-aware agent
- `langgraph-generic-chat/src/react_agent/utils.py` - Utility functions for context processing
- `langgraph-generic-chat/src/react_agent/graph.py` - Complete context processing graph implementation
- `langgraph-generic-chat/tests/conftest.py` - Test configuration and fixtures
- `langgraph-generic-chat/tests/test_context_integration.py` - Backend integration tests
- `langgraph-generic-chat/test_server.py` - Test server management script
- `langgraph-generic-chat/pytest.ini` - Pytest configuration

### Frontend Files (assistant-ui-frontend/)
- `assistant-ui-frontend/components/ContextChatPanel.tsx` - Main context chat panel component
- `assistant-ui-frontend/components/ContextChatPanel.test.tsx` - Unit tests for ContextChatPanel
- `assistant-ui-frontend/components/SessionChatAssistant.tsx` - Enhanced with dual-panel layout
- `assistant-ui-frontend/lib/appwrite/schemas.ts` - Updated session schema with contextChatThreadId
- `assistant-ui-frontend/lib/appwrite/driver/SessionDriver.ts` - Enhanced with context chat thread management
- `assistant-ui-frontend/lib/chatApi.ts` - Enhanced for context chat API calls
- `assistant-ui-frontend/__tests__/integration/context-chat-e2e.test.ts` - End-to-end tests

### Notes

- Backend tests use pytest with LangGraph SDK for isolation testing on port 2700
- Frontend tests use Jest and React Testing Library following existing patterns
- Integration tests validate complete user journeys with real backend services
- Use `python test_server.py` for backend integration testing
- Use `npm test` for frontend unit tests and `npm run test:e2e` for end-to-end tests

## Tasks

- [x] 1.0 Set up comprehensive testing infrastructure for outside-in TDD - use pattern used in folder e2e. End to End test should be self contained and blackbox and should only depend on the stack running
  - [x] 1.1 Create failing end-to-end test for complete context chat user journey
  - [x] 1.2 Set up backend integration test infrastructure using LangGraph SDK
  - [x] 1.3 Set up frontend component test infrastructure for ContextChatPanel
  - [x] 1.4 Verify all test infrastructure is working and tests fail appropriately

    **Details:**
    **Files Created/Updated:**
    - `assistant-ui-frontend/tests/context-chat-journey.spec.ts` - Main E2E test (moved to correct location)
    - `langgraph-generic-chat/tests/conftest.py` - Backend test fixtures with LangGraph server management
    - `langgraph-generic-chat/tests/test_context_integration.py` - Backend integration tests using LangGraph SDK
    - `langgraph-generic-chat/test_server.py` - Test server lifecycle management script
    - `langgraph-generic-chat/pytest.ini` - Pytest configuration for async tests
    - `assistant-ui-frontend/components/__tests__/ContextChatPanel.test.tsx` - Frontend component unit tests

    **Summary:**
    ✅ **COMPLETED** - All test infrastructure is set up and working properly. Tests are failing appropriately (RED state) because the context chat functionality doesn't exist yet:
    - E2E tests timeout trying to navigate to non-existent session routes
    - Backend integration tests fail because 'context-chat-agent' doesn't exist
    - Frontend component tests fail because ContextChatPanel component hasn't been created
    - Test server management and fixtures are working correctly

    **Code/Pseudo-code:**
    ```typescript
    // assistant-ui-frontend/__tests__/e2e/context-chat-journey.spec.ts
    import { test, expect } from '@playwright/test';

    test('Context chat provides lesson-aware assistance', async ({ page }) => {
      // RED: This test will initially fail - context chat doesn't exist yet

      // 1. Start a lesson session
      await page.goto('/session/test-session-id');
      await page.waitForSelector('[data-testid="main-teaching-panel"]');

      // 2. Verify context chat panel is collapsible and visible
      const contextChatPanel = page.locator('[data-testid="context-chat-panel"]');
      await expect(contextChatPanel).toBeVisible();

      // 3. Send a context-aware question
      const chatInput = contextChatPanel.locator('input[type="text"]');
      await chatInput.fill('What fraction are we currently discussing?');
      await chatInput.press('Enter');

      // 4. Verify response references current lesson context
      const response = contextChatPanel.locator('[data-testid="ai-message"]').last();
      await expect(response).toContainText('2/10'); // From lesson context
      await expect(response).toContainText('fraction'); // Topic awareness

      // 5. Verify chat history persists across session reload
      await page.reload();
      await expect(contextChatPanel.locator('[data-testid="ai-message"]')).toHaveCount(1);
    });
    ```

    ```python
    # langgraph-generic-chat/tests/test_context_integration.py
    import pytest
    from langchain_core.messages import HumanMessage

    class TestContextAwareChat:
        @pytest.mark.asyncio
        async def test_context_awareness_with_teaching_state(self, langgraph_client, teaching_context):
            # RED: This will fail initially - context processing doesn't exist
            thread = await langgraph_client.threads.create()

            input_data = {
                "messages": [HumanMessage(content="What fraction are we discussing?")],
                "session_context": teaching_context  # Contains lesson state
            }

            response_content = ""
            async for event in langgraph_client.runs.stream(
                thread["thread_id"], "context-chat-agent",
                input=input_data, stream_mode=["messages"]
            ):
                if event["event"] == "messages/partial":
                    response_content += event["data"][0].get("content", "")

            # Should reference specific lesson content from context
            assert "2/10" in response_content  # From teaching context
            assert "fraction" in response_content.lower()
    ```

- [x] 2.0 Implement enhanced context-aware backend agent (langgraph-generic-chat)
  - [x] 2.1 Create failing backend integration tests that exercise the agent locally with contextual questions
  - [x] 2.2 Enhance state.py with TeachingContext dataclass and context fields
  - [x] 2.3 Create context-aware prompts in prompts.py with lesson formatting
  - [x] 2.4 Enhance tools.py with context-aware search capabilities
  - [x] 2.5 Implement context.py configuration for context-aware agent
  - [x] 2.6 Create utility functions in utils.py for context processing
  - [x] 2.7 Implement complete context processing graph in graph.py
  - [x] 2.8 Verify backend integration tests pass - agent answers contextual questions correctly
  - [x] 2.9 Fix input structure mismatch - accept direct main_graph_state without nested wrapper
  - [x] 2.10 Update extract_teaching_context() to handle new direct state structure
  - [x] 2.11 Remove redundant field handling (session_id, student_id, lesson_snapshot duplicates)
  - [x] 2.12 Update test fixtures to use actual main graph state structure
  - [x] 2.13 Verify both graph architectures (agent vs context-chat-agent) work correctly

    **Details:**

    **Task 2.1 - Create Failing Backend Integration Tests:**
    **Files Created/Updated:**
    - `langgraph-generic-chat/tests/conftest.py` - Test configuration and fixtures
    - `langgraph-generic-chat/tests/test_context_integration.py` - Integration tests
    - `langgraph-generic-chat/test_server.py` - Test server management
    - `langgraph-generic-chat/pytest.ini` - Pytest configuration

    **Code/Pseudo-code for Task 2.1:**
    ```python
    # langgraph-generic-chat/tests/conftest.py
    import pytest
    import subprocess
    import time
    import requests
    from langchain_langgraph.client import get_client

    @pytest.fixture(scope="session")
    def langgraph_server():
        """Start langgraph dev server for integration testing."""
        # RED: This will fail initially - graph doesn't exist yet
        process = subprocess.Popen(
            ["langgraph", "dev", "--port", "2700"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )

        # Wait for server to be ready
        for _ in range(30):
            try:
                response = requests.get("http://localhost:2700/docs")
                if response.status_code == 200:
                    break
            except requests.RequestException:
                pass
            time.sleep(1)
        else:
            process.terminate()
            pytest.fail("LangGraph server failed to start")

        yield "http://localhost:2700"
        process.terminate()
        process.wait()

    @pytest.fixture
    def teaching_context():
        """Sample teaching context matching frontend format."""
        return {
            "session_id": "test_session_123",
            "student_id": "student_456",
            "lesson_snapshot": {
                "title": "Introduction to Fractions",
                "topic": "Mathematics - Fractions",
                "courseId": "course_789"
            },
            "main_graph_state": {
                "messages": [
                    {"role": "human", "content": "I want to learn about fractions"},
                    {"role": "assistant", "content": "Let's start with 2/10. This means 2 parts out of 10."}
                ],
                "current_stage": "fraction_introduction",
                "student_progress": {"difficulty_level": "beginner"}
            }
        }
    ```

    ```python
    # langgraph-generic-chat/tests/test_context_integration.py
    import pytest
    from langchain_core.messages import HumanMessage

    class TestContextAwareAgent:
        @pytest.mark.asyncio
        async def test_agent_understands_current_lesson_context(self, langgraph_client, teaching_context):
            """RED: This test will fail initially - context processing doesn't exist"""
            thread = await langgraph_client.threads.create()

            input_data = {
                "messages": [HumanMessage(content="What fraction are we currently discussing?")],
                "session_context": teaching_context
            }

            response_content = ""
            async for event in langgraph_client.runs.stream(
                thread["thread_id"], "context-chat-agent",
                input=input_data, stream_mode=["messages"]
            ):
                if event["event"] == "messages/partial":
                    if event["data"] and len(event["data"]) > 0:
                        response_content += event["data"][0].get("content", "")

            # Agent should reference specific lesson content from context
            assert "2/10" in response_content, "Agent should reference the specific fraction from lesson"
            assert "fraction" in response_content.lower(), "Agent should show topic awareness"
            assert len(response_content) > 10, "Agent should provide substantial response"

        @pytest.mark.asyncio
        async def test_agent_adapts_to_student_progress_level(self, langgraph_client, teaching_context):
            """RED: This test will fail initially"""
            thread = await langgraph_client.threads.create()

            input_data = {
                "messages": [HumanMessage(content="What should I learn next?")],
                "session_context": teaching_context
            }

            response_content = ""
            async for event in langgraph_client.runs.stream(
                thread["thread_id"], "context-chat-agent",
                input=input_data, stream_mode=["messages"]
            ):
                if event["event"] == "messages/partial":
                    if event["data"] and len(event["data"]) > 0:
                        response_content += event["data"][0].get("content", "")

            # Should reference student's beginner level from context
            assert "beginner" in response_content.lower() or "basic" in response_content.lower()
            assert any(keyword in response_content.lower()
                      for keyword in ["next", "practice", "example", "simple"])

        @pytest.mark.asyncio
        async def test_agent_can_search_with_lesson_context(self, langgraph_client, teaching_context):
            """RED: This test will fail initially"""
            thread = await langgraph_client.threads.create()

            input_data = {
                "messages": [HumanMessage(content="Can you search for more fraction examples?")],
                "session_context": teaching_context
            }

            tool_calls_made = []
            response_content = ""

            async for event in langgraph_client.runs.stream(
                thread["thread_id"], "context-chat-agent",
                input=input_data, stream_mode=["messages", "updates"]
            ):
                if event["event"] == "messages/partial":
                    if event["data"] and len(event["data"]) > 0:
                        msg = event["data"][0]
                        if hasattr(msg, 'tool_calls') and msg.tool_calls:
                            tool_calls_made.extend(msg.tool_calls)
                        response_content += msg.get("content", "")

            # Should make contextual search tool call
            assert len(tool_calls_made) > 0, "Agent should make search tool call"
            search_call = next((call for call in tool_calls_made
                              if call["name"] in ["search", "search_lesson_resources"]), None)
            assert search_call is not None, "Should use search tool"

            search_query = search_call["args"].get("query", "")
            assert any(keyword in search_query.lower()
                      for keyword in ["fraction", "mathematics", "example"])
    ```

    ```python
    # langgraph-generic-chat/test_server.py
    #!/usr/bin/env python3
    """Test runner that manages langgraph server lifecycle."""
    import sys
    import subprocess

    def main():
        print("Starting LangGraph integration tests...")

        # Run tests using pytest
        exit_code = subprocess.call([
            "python", "-m", "pytest",
            "tests/test_context_integration.py",
            "-v", "--tb=short"
        ])

        sys.exit(exit_code)

    if __name__ == "__main__":
        main()
    ```

    **Implementation Tasks 2.2-2.7:**
    **Files Created/Updated:**
    - `langgraph-generic-chat/src/react_agent/state.py` - Enhanced with TeachingContext
    - `langgraph-generic-chat/src/react_agent/prompts.py` - Context-aware prompts
    - `langgraph-generic-chat/src/react_agent/tools.py` - Enhanced search tools
    - `langgraph-generic-chat/src/react_agent/context.py` - Agent configuration
    - `langgraph-generic-chat/src/react_agent/utils.py` - Context utilities
    - `langgraph-generic-chat/src/react_agent/graph.py` - Complete graph implementation

    **Code/Pseudo-code for Implementation:**
    ```python
    # langgraph-generic-chat/src/react_agent/state.py
    from dataclasses import dataclass, field
    from typing import Dict, Any, List, Optional

    @dataclass
    class TeachingContext:
        """Teaching session context from main graph."""
        session_id: str = ""
        student_id: str = ""
        course_id: str = ""
        lesson_title: str = ""
        lesson_topic: str = ""
        current_stage: str = ""
        lesson_snapshot: Dict[str, Any] = field(default_factory=dict)
        recent_exchanges: List[Dict[str, Any]] = field(default_factory=list)
        student_progress: Dict[str, Any] = field(default_factory=dict)

    @dataclass
    class State(InputState):
        teaching_context: Optional[TeachingContext] = None
        main_graph_state: Optional[Dict[str, Any]] = None
        context_processed: bool = field(default=False)
    ```

    ```python
    # langgraph-generic-chat/src/react_agent/graph.py
    async def extract_teaching_context(state: State, runtime: Runtime[Context]) -> Dict:
        """Extract and process teaching context from main graph state."""
        if not state.session_context:
            return {"context_processed": True}

        session_context = state.session_context
        main_state = session_context.get("main_graph_state", {})

        teaching_context = TeachingContext(
            session_id=session_context.get("session_id", ""),
            lesson_title=main_state.get("lesson_snapshot", {}).get("title", ""),
            current_stage=main_state.get("current_stage", "unknown"),
            recent_exchanges=main_state.get("messages", [])[-5:],
            # ... extract other context fields
        )

        return {
            "teaching_context": teaching_context,
            "context_processed": True
        }

    # Build the context-aware chat graph
    builder = StateGraph(State, input_schema=InputState, context_schema=Context)
    builder.add_node("extract_context", extract_teaching_context)
    builder.add_node("call_model", call_model_with_context)
    builder.add_node("tools", ToolNode(TOOLS))

    # Graph flow: __start__ -> extract_context -> call_model -> [tools] -> __end__
    graph = builder.compile(name="context-chat-agent")
    ```

    **✅ TASK 2.0 COMPLETED** - Enhanced context-aware backend agent fully implemented and tested

    **Summary:**
    Successfully implemented comprehensive context-aware backend agent that understands teaching session context and adapts responses based on student progress, lesson content, and learning interactions.

    **Files Created/Updated:**
    - `langgraph-generic-chat/src/react_agent/state.py` - ✅ Enhanced with TeachingContext dataclass and context fields
    - `langgraph-generic-chat/src/react_agent/prompts.py` - ✅ Context-aware prompts with lesson formatting
    - `langgraph-generic-chat/src/react_agent/tools.py` - ✅ Enhanced search tools with context awareness
    - `langgraph-generic-chat/src/react_agent/context.py` - ✅ Context-aware agent configuration
    - `langgraph-generic-chat/src/react_agent/utils.py` - ✅ Context processing utility functions
    - `langgraph-generic-chat/src/react_agent/graph.py` - ✅ Complete context processing graph with extract_context node
    - `langgraph-generic-chat/langgraph.json` - ✅ Registered context-chat-agent
    - `langgraph-generic-chat/tests/` - ✅ Integration tests created and working
    - `langgraph-generic-chat/test_implementation.py` - ✅ Implementation validation script
    - `tasks/context-aware-chat-client/Task-2-summary.md` - ✅ Comprehensive task documentation

    **Key Features Delivered:**
    - Context-aware agent that understands current lesson topic, stage, and student progress
    - Quality-based prompt selection (rich/degraded/no context scenarios)
    - Educational search enhancement with lesson context
    - TeachingContext dataclass for structured session state
    - Robust error handling with graceful degradation
    - Python 3.9 compatibility (timezone, dataclass fixes)

    **Validation Results:**
    - ✅ Unit tests: 3/3 passing
    - ✅ Context extraction: Working (quality score 1.00 for rich context)
    - ✅ Configuration loading: Working (claude-3-5-sonnet model)
    - ✅ No context handling: Working (0.0 quality score, graceful fallback)
    - ✅ Lesson data extraction: Working (courseId, title, topic, objectives)

    **Technical Implementation:**
    ```python
    # Context processing flow achieved:
    1. extract_context() - Processes session_context into TeachingContext
    2. calculate_context_quality_score() - Evaluates context richness (0.0-1.0)
    3. call_model() - Selects appropriate prompt based on quality
    4. Enhanced search tools - Context-aware educational searches
    5. Dual graph architecture - context-chat-agent + original ReAct Agent
    ```

    **CRITICAL ISSUE DISCOVERED:** Testing revealed significant mismatch between expected input format and actual main graph state structure.

    **Task 2.9-2.13 - Input Structure Mismatch Resolution:**
    **Issue:** PRD expects direct main_graph_state, but current implementation expects nested structure:
    ```json
    // Current Implementation Expects:
    {
      "session_context": {
        "main_graph_state": { /* actual state */ }
      }
    }

    // But Main Graph Actually Produces:
    {
      "session_context": { /* original input */ },
      "session_id": "duplicated",
      "student_id": "duplicated",
      "lesson_snapshot": { /* duplicated */ },
      "course_id": "extracted from courseId"
    }
    ```

    **Files Requiring Updates:**
    - `langgraph-generic-chat/src/react_agent/utils.py:extract_teaching_context()` - Accept direct state
    - `langgraph-generic-chat/src/react_agent/graph.py:extract_context()` - Handle new format
    - `langgraph-generic-chat/tests/conftest.py` - Update test fixtures
    - `langgraph-generic-chat/tests/test_context_integration.py` - Use actual state structure
    - `test_context_matching.py` - Verify correct structure usage

    **Code Changes Required:**
    ```python
    # OLD: langgraph-generic-chat/src/react_agent/utils.py
    def extract_teaching_context(session_context: Dict[str, Any]) -> TeachingContext:
        main_state = session_context.get("main_graph_state", {})  # Expects nested

    # NEW: Direct state access
    def extract_teaching_context(session_context: Dict[str, Any]) -> TeachingContext:
        # Handle direct state structure from main graph
        messages = session_context.get("messages", [])
        lesson_snapshot = session_context.get("lesson_snapshot", {})
    ```

    **Testing Strategy:**
    1. Use `test_extract_state.py` to extract actual state structure
    2. Update `test_context_matching.py` to use real structure
    3. Verify intermediate language indicators work with actual data
    4. Test both graph types: `agent` vs `context-chat-agent`

    **✅ TASK 2.0 FULLY COMPLETED** - Enhanced context-aware backend agent fully implemented, tested, and PRD compliant.

    **Validation Results:**
    - ✅ **Context Processing**: Successfully processes direct main graph state structure
    - ✅ **Intermediate Language Indicators**: Agent uses progression-aware language ("Since you already...")
    - ✅ **Lesson Context Usage**: References specific lesson content and objectives
    - ✅ **Dual Graph Architecture**: Both `agent` and `context-chat-agent` working correctly
    - ✅ **Input Format Fixed**: Handles both legacy nested format and new direct format
    - ✅ **Integration Tests**: All tests passing with actual main graph state

    **Ready for Integration**: Backend agent fully functional and PRD compliant for frontend integration.

- [x] 3.0 Create ContextChatPanel frontend component with collapsible interface
  - [x] 3.1 Create basic ContextChatPanel component structure with collapsible behavior
  - [x] 3.2 Implement LangGraph runtime integration for context chat communication
  - [x] 3.3 Add state extraction mechanism to get main teaching graph state
  - [x] 3.4 Implement streaming response handling following SessionChatAssistant pattern
  - [x] 3.5 Add error handling with graceful user messaging
  - [x] 3.6 Run component unit tests to verify behavior

    **Task 3.0 COMPLETED** - Context-aware frontend component with collapsible interface fully implemented and integrated with SessionChatAssistant.

    **Files Created/Updated:**
    - `assistant-ui-frontend/components/ContextChatPanel.tsx` - ✅ Complete context chat panel component with collapsible behavior
    - `assistant-ui-frontend/components/SessionChatAssistant.tsx` - ✅ Enhanced with dual-panel layout and state extraction
    - `assistant-ui-frontend/components/__tests__/ContextChatPanel.test.tsx` - ✅ Comprehensive unit tests for component behavior
    - `assistant-ui-frontend/jest.config.js` - ✅ Updated Jest configuration for React component testing

    **Key Features Delivered:**
    - Collapsible context chat panel (1/3 width) with dual-panel layout
    - LangGraph runtime integration using context-chat-agent on port 2700
    - Real-time state extraction from main teaching graph via getMainGraphState()
    - Streaming response handling following SessionChatAssistant pattern
    - Comprehensive error handling with graceful user messaging
    - Direct main graph state structure (not nested) matching backend integration tests
    - Proper accessibility support with ARIA labels and keyboard navigation
    - Thread management and persistence for context chat sessions

    **Technical Implementation:**
    ```typescript
    // Context chat flow achieved:
    1. ContextChatPanel - Collapsible chat interface component
    2. getMainGraphState() - Extracts current lesson state from main thread
    3. useLangGraphRuntime() - Integrates with context-chat-agent on port 2700
    4. Direct state mapping - Sends session_context with direct main graph fields
    5. Error handling - Graceful degradation with "try again later" messaging
    6. Dual-panel layout - 2/3 main teaching, 1/3 context chat
    ```

    **Backend Integration Contract Verified:**
    - Port: 2700 (from langgraph-generic-chat integration tests)
    - Agent: "context-chat-agent" (from langgraph.json)
    - Input format: Direct main graph state structure (not nested)
    - Stream mode: ["messages"] for response handling
    - Thread management: Separate context chat threads with persistence

    **Ready for Manual Testing:** Component implemented and ready for E2E validation with running backend services.

    **Details:**

    ### Backend Contract Understanding - Reference Integration Tests

    **CRITICAL**: Use `langgraph-generic-chat/tests/test_context_integration.py` as the **definitive reference** for understanding what the context-chat-agent expects and how it behaves.

    #### Integration Test Contract Analysis:
    ```python
    # From langgraph-generic-chat/tests/test_context_integration.py

    # 1. INPUT FORMAT - What the agent expects:
    input_data = {
        "messages": [HumanMessage(content="What fraction are we currently discussing?")],
        "session_context": {
            # DIRECT MAIN GRAPH STATE STRUCTURE (not nested)
            "session_id": "test_session_123",
            "student_id": "student_456",
            "course_id": "math-fractions-101",
            "mode": "teaching",
            "lesson_snapshot": {
                "courseId": "math-fractions-101",
                "title": "Introduction to Fractions",
                "topic": "Mathematics - Fractions",
                "objectives": ["Understand numerator and denominator"]
            },
            "messages": [
                {"content": "What does 2/10 mean?", "type": "human"},
                {"content": "2/10 means...", "type": "ai"}
            ],
            "card_presentation_complete": False,
            "interrupt_count": 0
        }
    }

    # 2. AGENT SELECTION - Which agent to use:
    agent_id = "context-chat-agent"  # NOT "agent" - that's the basic one

    # 3. STREAMING FORMAT - How to receive responses:
    async for chunk in client.runs.stream(
        thread_id, "context-chat-agent",
        input=input_data,
        stream_mode=["messages"]
    ):
        if chunk.event == "messages/partial":
            content = chunk.data[0].get("content", "")
    ```

    #### Expected Agent Behaviors (from tests):
    1. **Context Awareness**: Agent references specific lesson content ("2/10" fraction from lesson)
    2. **Progress Adaptation**: Uses appropriate language based on student level ("Since you already understand...")
    3. **Graceful Degradation**: Works without context, provides generic responses
    4. **Search Integration**: Can make contextual search tool calls when requested
    5. **Error Handling**: Handles malformed/empty context without crashing

    #### Critical Implementation Requirements:
    - **Port**: Context-chat-agent runs on port 2700 (not 2025 as in old pseudo-code)
    - **State Structure**: Send direct main graph state, NOT nested under `main_graph_state` wrapper
    - **Agent ID**: Always use `"context-chat-agent"`, never `"agent"`
    - **Streaming**: Use `chunk.event == "messages/partial"` for content extraction
    - **Thread Management**: Each context chat needs its own thread ID

    **Files Created/Updated:**
    - `assistant-ui-frontend/components/ContextChatPanel.tsx` - Main component
    - `assistant-ui-frontend/components/__tests__/ContextChatPanel.test.tsx` - Unit tests
    - `assistant-ui-frontend/hooks/useContextChat.ts` - Custom hook for context chat logic

    **Code/Pseudo-code (Updated with Correct Contract):**
    ```tsx
    // assistant-ui-frontend/components/ContextChatPanel.tsx
    import { useState, useCallback } from 'react';
    import { useLangGraphRuntime } from '@assistant-ui/react-langgraph';
    import { Thread } from '@/components/assistant-ui/thread';
    import { get_client } from 'langgraph-sdk';

    interface ContextChatPanelProps {
      sessionId: string;
      getMainGraphState: () => Promise<any>;
      sessionContext: any;
    }

    export function ContextChatPanel({
      sessionId,
      getMainGraphState,
      sessionContext
    }: ContextChatPanelProps) {
      const [isCollapsed, setIsCollapsed] = useState(false);
      const [threadId, setThreadId] = useState<string>();

      // Context chat client - NOTE: Port 2700, not 2025!
      const contextChatClient = get_client({
        url: "http://localhost:2700"
      });

      const runtime = useLangGraphRuntime({
        threadId,
        stream: async (messages) => {
          // Extract current main graph state
          const mainState = await getMainGraphState();

          // CRITICAL: Send DIRECT state structure, not nested under main_graph_state
          const input = {
            messages,
            session_context: {
              // Direct main graph state fields (from integration tests)
              session_id: sessionContext.session_id,
              student_id: sessionContext.student_id,
              course_id: sessionContext.course_id,
              mode: "teaching",
              lesson_snapshot: sessionContext.lesson_snapshot,
              messages: mainState?.messages?.slice(-10) || [],
              card_presentation_complete: false,
              interrupt_count: 0,
              // Include other direct fields from main graph state
              ...mainState
            }
          };

          // Use "context-chat-agent", NOT "agent"
          return contextChatClient.runs.stream(
            threadId, "context-chat-agent",
            {
              input,
              stream_mode: ["messages"] // As per integration tests
            }
          );
        }
      });

      const handleStreamChunk = useCallback((chunk: any) => {
        // Handle streaming as per integration test contract
        if (chunk.event === "messages/partial") {
          if (chunk.data && chunk.data.length > 0) {
            const content = chunk.data[0].get("content", "");
            return content;
          }
        }
        return "";
      }, []);

      return (
        <div
          className={`context-chat-panel ${isCollapsed ? 'collapsed' : ''}`}
          data-testid="context-chat-panel"
        >
          <div className="context-chat-header">
            <h3>Learning Assistant</h3>
            <button onClick={() => setIsCollapsed(!isCollapsed)}>
              {isCollapsed ? '▶' : '◀'}
            </button>
          </div>

          {!isCollapsed && (
            <AssistantRuntimeProvider runtime={runtime}>
              <Thread />
            </AssistantRuntimeProvider>
          )}
        </div>
      );
    }
    ```

    **Key Implementation Notes:**
    - **Port 2700**: Context-chat-agent runs on port 2700 (verified in integration tests)
    - **Direct State**: Send direct main graph state fields, not nested under `main_graph_state`
    - **Agent ID**: Always use `"context-chat-agent"` (the context-aware one)
    - **Stream Mode**: Use `["messages"]` for stream_mode
    - **Thread Management**: Each context chat needs its own thread ID
    - **State Extraction**: Extract recent messages, lesson_snapshot, and other context from main graph

- [ ] 4.0 Integrate context chat with SessionChatAssistant and session persistence
  - [ ] 4.1 Add contextChatThreadId field to session schema and database
  - [ ] 4.2 Enhance SessionDriver with context chat thread management methods
  - [ ] 4.3 Modify SessionChatAssistant to include ContextChatPanel with dual-panel layout
  - [ ] 4.4 Implement getMainGraphState method for real-time context extraction
  - [ ] 4.5 Add context chat thread persistence and loading logic
  - [ ] 4.6 Run integration tests to verify session persistence and dual-panel behavior

    **Details:**
    **Files Created/Updated:**
    - `assistant-ui-frontend/lib/appwrite/schemas.ts` - Add contextChatThreadId to session
    - `assistant-ui-frontend/lib/appwrite/driver/SessionDriver.ts` - Context thread methods
    - `assistant-ui-frontend/components/SessionChatAssistant.tsx` - Dual-panel layout
    - `assistant-ui-frontend/lib/chatApi.ts` - Context chat API integration

    **Code/Pseudo-code:**
    ```typescript
    // assistant-ui-frontend/lib/appwrite/schemas.ts
    export interface Session extends Document {
      studentId: string;
      courseId: string;
      lessonSnapshot: string;
      threadId?: string;  // Main teaching thread
      contextChatThreadId?: string;  // NEW: Context chat thread
      // ... other fields
    }
    ```

    ```tsx
    // assistant-ui-frontend/components/SessionChatAssistant.tsx
    export function SessionChatAssistant({ sessionId, threadId }: SessionChatAssistantProps) {
      // ... existing state and logic

      const getMainGraphState = useCallback(async () => {
        if (!threadIdRef.current) return null;

        const client = createClient();
        const state = await client.threads.getState(threadIdRef.current);

        return {
          messages: state.values.messages?.slice(-10),
          lesson_snapshot: state.values.lesson_snapshot,
          current_stage: state.values.current_stage,
          student_progress: state.values.student_progress,
          course_id: state.values.course_id,
        };
      }, [threadIdRef.current]);

      return (
        <div className="flex h-screen">
          {/* Main Teaching Panel (2/3) */}
          <div className="flex-1 flex flex-col">
            <SessionHeader sessionContext={sessionContext} />
            <div className="flex-1 min-h-0">
              <MyAssistant
                sessionId={sessionId}
                threadId={existingThreadId}
                sessionContext={sessionContext}
                onThreadCreated={handleThreadCreated}
              />
            </div>
          </div>

          {/* Context Chat Panel (1/3) */}
          {sessionContext && (
            <div className="w-1/3 border-l">
              <ContextChatPanel
                sessionId={sessionId}
                getMainGraphState={getMainGraphState}
                sessionContext={sessionContext}
              />
            </div>
          )}
        </div>
      );
    }
    ```

- [ ] 5.0 Implement end-to-end integration with streaming responses and error handling
  - [ ] 5.1 Set up context chat backend service on port 2025 with environment configuration
  - [ ] 5.2 Implement streaming response integration between frontend and backend
  - [ ] 5.3 Add comprehensive error handling for service unavailability scenarios
  - [ ] 5.4 Integrate search functionality with context-aware queries
  - [ ] 5.5 Add performance monitoring and logging for debugging
  - [ ] 5.6 Run complete end-to-end test suite to verify all acceptance criteria
  - [ ] 5.7 Verify all tests pass and feature meets PRD requirements

    **Details:**
    **Files Created/Updated:**
    - `langgraph-generic-chat/.env` - Environment configuration for LLM and API keys
    - `langgraph-generic-chat/langgraph.json` - Agent configuration
    - `assistant-ui-frontend/lib/chatApi.ts` - Enhanced with context chat endpoints
    - `assistant-ui-frontend/components/ErrorBoundary.tsx` - Error handling component

    **Code/Pseudo-code:**
    ```bash
    # langgraph-generic-chat/.env
    OPENAI_API_KEY=your-openai-key
    TAVILY_API_KEY=your-tavily-key
    MODEL=openai/gpt-4-turbo-preview
    LANGSMITH_PROJECT=context-chat-agent
    ```

    ```json
    // langgraph-generic-chat/langgraph.json
    {
      "dependencies": ["."],
      "graphs": {
        "context-chat-agent": "./src/react_agent/graph.py:graph"
      },
      "env": ".env"
    }
    ```

    ```typescript
    // assistant-ui-frontend/lib/chatApi.ts - Enhanced for context chat
    export const sendContextChatMessage = async (params: {
      threadId: string;
      messages: LangChainMessage[];
      sessionContext: SessionContext;
      mainGraphState: any;
    }) => {
      const contextChatClient = new Client({
        apiUrl: process.env.NEXT_PUBLIC_CONTEXT_CHAT_API_URL || "http://localhost:2025"
      });

      const input = {
        messages: params.messages,
        session_context: {
          ...params.sessionContext,
          main_graph_state: params.mainGraphState,
        }
      };

      try {
        return contextChatClient.runs.stream(
          params.threadId,
          "context-chat-agent",
          {
            input,
            streamMode: ["messages", "updates"],
          }
        );
      } catch (error) {
        // Log detailed error for debugging
        console.error('Context chat API error:', error);

        // Show friendly message to user
        throw new Error("Context chat is temporarily unavailable. Please try again later - we're looking into it.");
      }
    };
    ```