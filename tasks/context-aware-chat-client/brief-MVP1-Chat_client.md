# MVP1 Context-Aware Chat Client Design Brief

## Executive Summary

The MVP1 Context-Aware Chat Client is a supplementary chat interface that provides students with contextual assistance during their learning sessions. This feature adds a secondary chat panel alongside the main teaching interface, enabling students to ask questions about their current lesson without disrupting the primary teaching flow. The chat client has real-time access to the teaching session state and can provide contextual responses enriched with lesson details, student progress, and recent exchanges.

## Problem Statement

### Current Challenges
1. **Learning Disruption**: Students cannot ask clarifying questions without interrupting the main teaching flow
2. **Context Loss**: Generic chat interfaces lack awareness of the current lesson state
3. **Fragmented Experience**: Students need to switch between different tools for help
4. **Limited Support**: No real-time assistance during complex lesson interactions

### User Pain Points
- Students get stuck on concepts but can't get immediate help without losing lesson progress
- Questions about lesson content require starting over or breaking the teaching flow
- No way to get contextual explanations of current lesson materials
- Difficulty understanding how current exercises relate to overall learning objectives

## Solution Architecture

### High-Level Architecture
```
┌─────────────────────────────────────────────────┐
│           SessionChatAssistant.tsx              │
├──────────────────┬──────────────────────────────┤
│   Main Teaching  │   Context Chat Panel         │
│   Panel (2/3)    │   (1/3)                     │
│                  │                              │
│  MyAssistant     │  ContextChatPanel            │
│  ↓ Thread A      │  ↓ Thread B                 │
│                  │                              │
├──────────────────┼──────────────────────────────┤
│  Teaching Graph  │  Context Chat Graph          │
│  Port 2024       │  Port 2025                   │
│  graph_interrupt │  Enhanced react_agent        │
└──────────────────┴──────────────────────────────┘
```

### Key Components

#### Frontend Components
1. **ContextChatPanel.tsx** - New chat interface component
2. **Enhanced SessionChatAssistant.tsx** - Modified to support dual-panel layout
3. **State extraction mechanism** - getMainGraphState() method
4. **Environment configuration** - Separate API endpoints

#### Backend Components
1. **Enhanced langgraph-generic-chat** - Context-aware agent
2. **State processing** - Teaching context extraction
3. **Search integration** - Tavily search with context
4. **Deployment configuration** - Independent service

## User Experience

### Visual Layout
```
┌─────────────────────────────────────────────────────────────────────┐
│                     Session Header                                  │
├─────────────────────────────────┬───────────────────────────────────┤
│                                 │  Learning Assistant               │
│                                 │  Ask questions about your lesson  │
│        Main Teaching            ├───────────────────────────────────┤
│         Interface               │                                   │
│                                 │  💬 Student: What does this       │
│  🎓 Lesson Card                 │     fraction mean?                │
│  📊 Progress Tracking           │                                   │
│  🔄 Interactive Elements        │  🤖 Assistant: Based on your     │
│                                 │     current lesson on fractions,  │
│                                 │     you're looking at 2/10...    │
│                                 │                                   │
│                                 │  💬 Student: Can you search       │
│                                 │     for more examples?            │
│                                 │                                   │
│                                 │  🔍 Assistant: I'll search for    │
│                                 │     fraction examples related     │
│                                 │     to your current topic...      │
│                                 │                                   │
└─────────────────────────────────┴───────────────────────────────────┘
```

### User Journey
1. **Lesson Start**: Student begins lesson in main panel
2. **Question Arises**: Student has question about current content
3. **Context Chat**: Student asks in right panel without disrupting main flow
4. **Contextual Response**: Assistant provides answer based on current lesson state
5. **Enhanced Learning**: Student continues with better understanding

### Key Features
- **Real-time Context**: Always aware of current lesson state
- **Non-disruptive**: Doesn't interfere with main teaching flow
- **Search Integration**: Can find additional resources when needed
- **Progress Awareness**: Understands student's learning journey
- **Conversational Memory**: Maintains chat history within session

## Technical Implementation

### Backend Architecture (langgraph-generic-chat)

#### 1. State Management (`state.py`)
```python
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
    timestamp: str = ""

@dataclass
class State(InputState):
    """Complete state including context and search capabilities."""
    is_last_step: IsLastStep = field(default=False)
    teaching_context: Optional[TeachingContext] = None
    main_graph_state: Optional[Dict[str, Any]] = None
    search_results: List[Dict[str, Any]] = field(default_factory=list)
    context_processed: bool = field(default=False)
```

#### 2. Context-Aware Prompts (`prompts.py`)
```python
SYSTEM_PROMPT_WITH_CONTEXT = """You are a helpful AI assistant supporting a student during their learning session.

Current Teaching Session Context:
- Session ID: {session_id}
- Current Lesson: {lesson_title}
- Topic: {lesson_topic}
- Learning Stage: {current_stage}

Recent Teaching Exchanges:
{recent_exchanges}

Your role is to:
1. Answer questions about the current lesson and topic
2. Provide clarifications without disrupting the main teaching flow
3. Use search when additional information is needed
4. Keep responses contextual and supportive
"""
```

#### 3. Enhanced Tools (`tools.py`)
```python
async def search_lesson_resources(query: str, topic: str) -> Optional[dict[str, Any]]:
    """Search for educational resources related to the lesson topic."""
    runtime = get_runtime(Context)
    enhanced_query = f"{query} {topic} educational resources tutorial"
    wrapped = TavilySearch(max_results=runtime.context.max_search_results)
    return await wrapped.ainvoke({"query": enhanced_query})

TOOLS = [search, search_lesson_resources]
```

#### 4. Configuration (`context.py`)
```python
"""Configurable parameters for context-aware agent."""

from __future__ import annotations
import os
from dataclasses import dataclass, field, fields
from typing import Annotated
from . import prompts

@dataclass(kw_only=True)
class Context:
    """The context for the context-aware chat agent."""

    system_prompt_with_context: str = field(
        default=prompts.SYSTEM_PROMPT_WITH_CONTEXT,
        metadata={"description": "System prompt when teaching context is available"}
    )

    system_prompt_no_context: str = field(
        default=prompts.SYSTEM_PROMPT_NO_CONTEXT,
        metadata={"description": "System prompt when no teaching context"}
    )

    model: Annotated[str, {"__template_metadata__": {"kind": "llm"}}] = field(
        default="anthropic/claude-3-5-sonnet-20240620",
        metadata={"description": "Language model for context-aware chat"}
    )

    max_search_results: int = field(
        default=5,
        metadata={"description": "Max search results (reduced for context chat)"}
    )

    max_recent_exchanges: int = field(
        default=5,
        metadata={"description": "Number of recent teaching exchanges to include"}
    )

    enable_proactive_help: bool = field(
        default=True,
        metadata={"description": "Proactively suggest help based on detected struggles"}
    )

    def __post_init__(self) -> None:
        """Fetch env vars for attributes."""
        for f in fields(self):
            if not f.init:
                continue
            if getattr(self, f.name) == f.default:
                setattr(self, f.name, os.environ.get(f.name.upper(), f.default))
```

#### 5. Utilities (`utils.py`)
```python
"""Utility & helper functions for context-aware chat."""

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage
from typing import Dict, Any, List

def get_message_text(msg: BaseMessage) -> str:
    """Get the text content of a message."""
    content = msg.content
    if isinstance(content, str):
        return content
    elif isinstance(content, dict):
        return content.get("text", "")
    else:
        txts = [c if isinstance(c, str) else (c.get("text") or "") for c in content]
        return "".join(txts).strip()

def load_chat_model(fully_specified_name: str) -> BaseChatModel:
    """Load a chat model from a fully specified name."""
    provider, model = fully_specified_name.split("/", maxsplit=1)
    return init_chat_model(model, model_provider=provider)

def format_recent_exchanges(messages: List[Dict[str, Any]], max_count: int = 5) -> str:
    """Format recent teaching exchanges for prompt inclusion."""
    if not messages:
        return "No recent exchanges"

    recent = messages[-max_count:]
    formatted = []

    for msg in recent:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        # Truncate long messages
        if len(content) > 150:
            content = content[:147] + "..."
        formatted.append(f"- {role.capitalize()}: {content}")

    return "\n".join(formatted)

def extract_lesson_keywords(lesson_snapshot: Dict[str, Any]) -> List[str]:
    """Extract key terms from lesson snapshot for search enhancement."""
    keywords = []

    if lesson_snapshot.get("title"):
        keywords.extend(lesson_snapshot["title"].lower().split())

    if lesson_snapshot.get("topic"):
        keywords.extend(lesson_snapshot["topic"].lower().split())

    # Remove common words
    stop_words = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with"}
    keywords = [k for k in keywords if k not in stop_words and len(k) > 2]

    return list(set(keywords))  # Remove duplicates
```

#### 6. Complete Context Processing Graph (`graph.py`)
```python
"""Context-aware chat agent graph - Complete implementation."""

from datetime import UTC, datetime
from typing import Dict, List, Literal, cast, Optional
import json

from langchain_core.messages import AIMessage, SystemMessage
from langgraph.graph import StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.runtime import Runtime

from react_agent.context import Context
from react_agent.state import InputState, State, TeachingContext
from react_agent.tools import TOOLS
from react_agent.utils import (
    load_chat_model,
    format_recent_exchanges,
    extract_lesson_keywords
)

async def extract_teaching_context(
    state: State, runtime: Runtime[Context]
) -> Dict:
    """Extract and process teaching context from main graph state."""

    # Check if we have teaching context from input
    teaching_context = state.teaching_context

    if not teaching_context and state.session_context:
        # Build teaching context from session_context if available
        session_context = state.session_context
        main_state = session_context.get("main_graph_state", {})
        lesson_snapshot = main_state.get("lesson_snapshot", {})

        # Extract recent exchanges and format them
        recent_messages = main_state.get("messages", [])
        student_progress = main_state.get("student_progress", {})

        teaching_context = TeachingContext(
            session_id=session_context.get("session_id", ""),
            student_id=session_context.get("student_id", ""),
            course_id=main_state.get("course_id", lesson_snapshot.get("courseId", "")),
            lesson_title=lesson_snapshot.get("title", ""),
            lesson_topic=lesson_snapshot.get("topic", ""),
            current_stage=main_state.get("current_stage", "unknown"),
            lesson_snapshot=lesson_snapshot,
            recent_exchanges=recent_messages[-runtime.context.max_recent_exchanges:],
            student_progress=student_progress,
            timestamp=datetime.now(tz=UTC).isoformat()
        )

    return {
        "teaching_context": teaching_context,
        "main_graph_state": state.session_context.get("main_graph_state") if state.session_context else None,
        "context_processed": True
    }

async def call_model_with_context(
    state: State, runtime: Runtime[Context]
) -> Dict[str, List[AIMessage]]:
    """Call LLM with teaching context awareness."""

    model = load_chat_model(runtime.context.model).bind_tools(TOOLS)

    # Choose prompt and context based on availability
    if state.teaching_context and state.teaching_context.session_id:
        context = state.teaching_context

        # Format recent exchanges for prompt
        recent_exchanges = format_recent_exchanges(
            context.recent_exchanges,
            runtime.context.max_recent_exchanges
        )

        # Format student progress
        progress_info = json.dumps(context.student_progress, indent=2) if context.student_progress else "No progress data available"

        # Extract lesson objectives if available
        objectives = context.lesson_snapshot.get("objectives", [])
        objectives_text = ", ".join(objectives) if objectives else "No specific objectives listed"

        system_message = runtime.context.system_prompt_with_context.format(
            session_id=context.session_id,
            student_id=context.student_id,
            lesson_title=context.lesson_title or "Current lesson",
            lesson_topic=context.lesson_topic or "Mathematics",
            current_stage=context.current_stage,
            recent_exchanges=recent_exchanges,
            student_progress=progress_info,
            lesson_objectives=objectives_text,
            system_time=datetime.now(tz=UTC).isoformat()
        )

        # Add context-aware instruction to the system message
        system_message += f"\n\nLesson Keywords: {', '.join(extract_lesson_keywords(context.lesson_snapshot))}"

    else:
        system_message = runtime.context.system_prompt_no_context.format(
            system_time=datetime.now(tz=UTC).isoformat()
        )

    # Prepare messages for the model
    messages_for_model = [
        {"role": "system", "content": system_message},
        *state.messages
    ]

    # Get model response
    response = cast(
        AIMessage,
        await model.ainvoke(messages_for_model),
    )

    # Handle last step with tool calls
    if state.is_last_step and response.tool_calls:
        return {
            "messages": [
                AIMessage(
                    id=response.id,
                    content="I apologize, but I need to complete my search to provide you with the best answer. Let me give you what I can based on the current lesson context.",
                )
            ]
        }

    return {"messages": [response]}

def should_search(state: State) -> bool:
    """Determine if the last message indicates a need for search."""
    if not state.messages:
        return False

    last_message = state.messages[-1]
    if not isinstance(last_message, AIMessage):
        return False

    # Check if the AI wants to use search tools
    return bool(last_message.tool_calls)

def route_model_output(state: State) -> Literal["__end__", "tools"]:
    """Route based on tool calls in the model output."""
    last_message = state.messages[-1]
    if not isinstance(last_message, AIMessage):
        raise ValueError(f"Expected AIMessage, got {type(last_message).__name__}")

    # If there are tool calls, route to tools
    if last_message.tool_calls:
        return "tools"

    # Otherwise, end the conversation
    return "__end__"

def determine_search_need(state: State) -> Dict:
    """Analyze user query to determine if search is needed."""
    if not state.messages:
        return {"needs_search": False}

    # Get the user's question
    user_messages = [msg for msg in state.messages if hasattr(msg, 'content') and not isinstance(msg, AIMessage)]
    if not user_messages:
        return {"needs_search": False}

    latest_user_message = user_messages[-1].content.lower()

    # Keywords that suggest search might be helpful
    search_keywords = [
        "search", "find", "look up", "more examples", "additional",
        "other resources", "explain more", "what else", "show me"
    ]

    needs_search = any(keyword in latest_user_message for keyword in search_keywords)

    # If we have teaching context, we might need less search
    if state.teaching_context and state.teaching_context.lesson_snapshot:
        # Rich context might reduce search need
        context_richness = len(str(state.teaching_context.lesson_snapshot))
        if context_richness > 200:  # Arbitrary threshold
            needs_search = needs_search and ("search" in latest_user_message or "find" in latest_user_message)

    return {
        "needs_search": needs_search,
        "search_query": latest_user_message if needs_search else ""
    }

# Build the context-aware chat graph
builder = StateGraph(State, input_schema=InputState, context_schema=Context)

# Add all nodes
builder.add_node("extract_context", extract_teaching_context)
builder.add_node("call_model", call_model_with_context)
builder.add_node("tools", ToolNode(TOOLS))

# Set up the flow
builder.add_edge("__start__", "extract_context")
builder.add_edge("extract_context", "call_model")

# Add conditional routing after model call
builder.add_conditional_edges(
    "call_model",
    route_model_output,
    {
        "__end__": "__end__",
        "tools": "tools"
    }
)

# After tools, go back to model
builder.add_edge("tools", "call_model")

# Compile the graph
graph = builder.compile(name="Context-Aware Chat Agent")
```

### Frontend Architecture

#### 1. Context Chat Panel (`ContextChatPanel.tsx`)
```typescript
interface ContextChatPanelProps {
  sessionId: string;
  getMainGraphState: () => Promise<any>;
  sessionContext: any;
}

export function ContextChatPanel({ sessionId, getMainGraphState, sessionContext }: ContextChatPanelProps) {
  const runtime = useLangGraphRuntime({
    stream: async (messages) => {
      const mainState = await getMainGraphState();
      const input = {
        messages,
        session_context: {
          ...sessionContext,
          main_graph_state: mainState,
        }
      };

      return contextChatClient.runs.stream(threadId, "context-chat-agent", {
        input,
        streamMode: ["messages", "updates"],
      });
    }
  });

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="p-4 bg-white border-b">
        <h3 className="font-semibold">Learning Assistant</h3>
        <p className="text-sm text-gray-600">Ask questions about your lesson</p>
      </div>
      <AssistantRuntimeProvider runtime={runtime}>
        <Thread />
      </AssistantRuntimeProvider>
    </div>
  );
}
```

#### 2. Enhanced Session Component (`SessionChatAssistant.tsx`)
```typescript
// Add state extraction method
const getMainGraphState = useCallback(async () => {
  if (!threadIdRef.current) return null;

  const client = createClient();
  const state = await client.threads.getState(threadIdRef.current);

  return {
    messages: state.values.messages?.slice(-10), // Last 10 messages
    lesson_snapshot: state.values.lesson_snapshot,
    current_stage: state.values.current_stage,
    student_progress: state.values.student_progress,
    // ... other relevant state
  };
}, [threadIdRef.current]);

// Modified layout
return (
  <div className="flex h-screen">
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
```

## Data Flow

### Context Extraction Flow
```
1. User sends message in context chat
   ↓
2. ContextChatPanel calls getMainGraphState()
   ↓
3. getMainGraphState() queries main thread via LangGraph SDK
   ↓
4. Main graph state extracted (messages, lesson_snapshot, progress, etc.)
   ↓
5. State packaged with user message and session_context
   ↓
6. Sent to context-chat-agent on port 2025
   ↓
7. extract_teaching_context node processes the state
   ↓
8. Context-aware prompt generated with lesson details
   ↓
9. LLM response enriched with search if needed
   ↓
10. Response streamed back to ContextChatPanel
```

### State Synchronization
- **Trigger**: Every message sent to context chat
- **Source**: Main teaching thread state (port 2024)
- **Target**: Context chat thread state (port 2025)
- **Frequency**: Real-time (per message)
- **Content**: Last 10 messages, lesson snapshot, progress, current stage

### Data Security
- No persistent storage of main graph state in context agent
- State extracted fresh on each interaction
- Session-scoped context (not shared between sessions)
- Follows existing authentication patterns

## API Design

### Context Chat Endpoints
- **Base URL**: `http://localhost:2025`
- **Agent ID**: `context-chat-agent`
- **Thread Management**: Standard LangGraph SDK patterns

### Message Format
```typescript
interface ContextChatInput {
  messages: LangChainMessage[];
  session_context: {
    session_id: string;
    student_id: string;
    lesson_snapshot: LessonSnapshot;
    main_graph_state: {
      messages: Message[];
      lesson_snapshot: any;
      current_stage: string;
      student_progress: any;
      course_id: string;
    };
  };
}
```

### Response Format
- Standard LangGraph streaming response
- Tool calls for search operations
- Context-enriched content based on lesson state

## Testing Strategy

### Backend Integration Testing

#### Overview
Comprehensive backend integration testing validates the context-aware chat agent in complete isolation using the LangGraph Python SDK against a live `langgraph dev` server. Tests use the exact input format the frontend provides and validate contextual response accuracy.

#### Test Architecture
```
┌─────────────────────────────────────────────┐
│           Integration Test Suite            │
├─────────────────────────────────────────────┤
│  pytest + LangGraph SDK Client             │
│  ↓ Exact Frontend Input Format             │
├─────────────────────────────────────────────┤
│  langgraph dev --port 2700                 │
│  ↓ Context-Aware Chat Agent                │
├─────────────────────────────────────────────┤
│  Enhanced react_agent Graph                │
│  • extract_teaching_context                │
│  • call_model_with_context                 │
│  • tools (search)                          │
└─────────────────────────────────────────────┘
```

#### Test Directory Structure
```
langgraph-generic-chat/
├── tests/
│   ├── __init__.py
│   ├── conftest.py                    # Test configuration and fixtures
│   ├── test_context_integration.py    # Main integration tests
│   ├── test_data/
│   │   ├── teaching_contexts.py       # Sample teaching contexts
│   │   └── expected_responses.py      # Expected response patterns
│   └── utils/
│       ├── __init__.py
│       ├── langgraph_client.py        # SDK client wrapper
│       └── test_helpers.py            # Test utilities
├── pytest.ini                        # Pytest configuration
└── test_server.py                     # Test server management
```

#### Test Configuration (`conftest.py`)
```python
import pytest
import asyncio
import subprocess
import time
import requests
from langchain_langgraph.client import get_client

@pytest.fixture(scope="session")
def langgraph_server():
    """Start langgraph dev server for testing."""
    # Start server
    process = subprocess.Popen(
        ["langgraph", "dev", "--port", "2700"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
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

    # Cleanup
    process.terminate()
    process.wait()

@pytest.fixture
def langgraph_client(langgraph_server):
    """LangGraph SDK client for testing."""
    return get_client(url=langgraph_server)

@pytest.fixture
def teaching_context():
    """Sample teaching context matching frontend format."""
    return {
        "session_id": "test_session_123",
        "student_id": "student_456",
        "lesson_snapshot": {
            "title": "Introduction to Fractions",
            "topic": "Mathematics - Fractions",
            "courseId": "course_789",
            "description": "Learning basic fraction concepts",
            "objectives": ["Understand numerator/denominator", "Compare fractions"]
        },
        "main_graph_state": {
            "messages": [
                {"role": "human", "content": "I want to learn about fractions"},
                {"role": "assistant", "content": "Let's start with basic fractions. A fraction has two parts: numerator (top) and denominator (bottom)."},
                {"role": "human", "content": "What does 2/10 mean?"},
                {"role": "assistant", "content": "2/10 means you have 2 parts out of 10 total parts. It can be simplified to 1/5."}
            ],
            "current_stage": "fraction_introduction",
            "student_progress": {
                "completed_steps": ["basic_definition"],
                "current_step": "fraction_examples",
                "difficulty_level": "beginner"
            },
            "course_id": "course_789"
        }
    }
```

#### Main Integration Tests (`test_context_integration.py`)
```python
import pytest
import asyncio
from langchain_core.messages import HumanMessage

class TestContextAwareChat:
    """Integration tests for context-aware chat agent."""

    @pytest.mark.asyncio
    async def test_basic_context_awareness(self, langgraph_client, teaching_context):
        """Test that agent responds with awareness of current lesson context."""

        # Create thread
        thread = await langgraph_client.threads.create()

        # Input matching exact frontend format
        input_data = {
            "messages": [
                HumanMessage(content="What fraction are we currently discussing?")
            ],
            "session_context": teaching_context
        }

        # Stream response
        response_content = ""
        async for event in langgraph_client.runs.stream(
            thread["thread_id"],
            "context-chat-agent",
            input=input_data,
            stream_mode=["messages"]
        ):
            if event["event"] == "messages/partial":
                if event["data"] and len(event["data"]) > 0:
                    response_content += event["data"][0].get("content", "")

        # Assertions - Agent should reference current lesson context
        assert "2/10" in response_content or "fraction" in response_content.lower()
        assert "lesson" in response_content.lower() or "learning" in response_content.lower()
        assert any(keyword in response_content.lower()
                  for keyword in ["introduction", "fraction", "numerator", "denominator"])

    @pytest.mark.asyncio
    async def test_student_progress_awareness(self, langgraph_client, teaching_context):
        """Test agent understands student's current progress."""

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

        # Should reference student's current progress
        assert "beginner" in response_content.lower() or "examples" in response_content.lower()
        assert any(keyword in response_content.lower()
                  for keyword in ["next", "practice", "example", "compare"])

    @pytest.mark.asyncio
    async def test_search_integration_with_context(self, langgraph_client, teaching_context):
        """Test search tool works with lesson context."""

        thread = await langgraph_client.threads.create()

        input_data = {
            "messages": [
                HumanMessage(content="Can you search for more examples of fractions like the one we're studying?")
            ],
            "session_context": teaching_context
        }

        tool_calls_made = []
        async for event in langgraph_client.runs.stream(
            thread["thread_id"], "context-chat-agent",
            input=input_data, stream_mode=["messages", "updates"]
        ):
            if event["event"] == "messages/partial":
                if event["data"] and len(event["data"]) > 0:
                    msg = event["data"][0]
                    if hasattr(msg, 'tool_calls') and msg.tool_calls:
                        tool_calls_made.extend(msg.tool_calls)

        # Should have made a search tool call
        assert len(tool_calls_made) > 0
        search_call = next((call for call in tool_calls_made
                          if call["name"] in ["search", "search_lesson_resources"]), None)
        assert search_call is not None
        search_query = search_call["args"].get("query", "")
        assert any(keyword in search_query.lower()
                  for keyword in ["fraction", "mathematics", "numerator", "denominator"])
```

#### Test Execution Configuration (`pytest.ini`)
```ini
[tool:pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts =
    -v
    --tb=short
    --strict-markers
    --disable-warnings
    -p no:cacheprovider
markers =
    integration: Integration tests requiring live server
    slow: Tests that take longer to run
    search: Tests involving search functionality
asyncio_mode = auto
```

#### Test Runner Script (`test_server.py`)
```python
#!/usr/bin/env python3
"""Test runner that manages langgraph server lifecycle."""
import sys
import subprocess
import time
import requests
import signal
import os

def start_test_server():
    """Start langgraph dev server for testing."""
    print("Starting LangGraph test server on port 2700...")

    process = subprocess.Popen(
        ["langgraph", "dev", "--port", "2700"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        preexec_fn=os.setsid
    )

    # Wait for server
    for i in range(30):
        try:
            response = requests.get("http://localhost:2700/docs", timeout=1)
            if response.status_code == 200:
                print("✅ Server ready")
                return process
        except:
            pass
        print(f"Waiting for server... ({i+1}/30)")
        time.sleep(1)

    print("❌ Server failed to start")
    process.terminate()
    return None

def main():
    server_process = None
    try:
        server_process = start_test_server()
        if not server_process:
            sys.exit(1)

        pytest_args = sys.argv[1:] if len(sys.argv) > 1 else ["tests/test_context_integration.py"]
        exit_code = subprocess.call(["python", "-m", "pytest"] + pytest_args)
        sys.exit(exit_code)

    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted")
        sys.exit(130)
    finally:
        if server_process:
            print("Stopping test server...")
            os.killpg(os.getpgid(server_process.pid), signal.SIGTERM)

if __name__ == "__main__":
    main()
```

#### Test Execution
```bash
# Run all integration tests
python test_server.py

# Run specific test class
python test_server.py tests/test_context_integration.py::TestContextAwareChat

# Run with coverage
python test_server.py --cov=src --cov-report=html
```

### Frontend Unit Tests
1. **State Extraction**: Test getMainGraphState() method
2. **Context Processing**: Test extract_teaching_context node
3. **Prompt Generation**: Test context-aware prompt formatting
4. **Search Integration**: Test Tavily search with context

### Frontend Integration Tests
1. **Dual Panel Rendering**: Verify layout and responsiveness
2. **State Synchronization**: Test real-time context updates
3. **Cross-Thread Communication**: Verify state extraction works
4. **Search Functionality**: Test context-enhanced search

### End-to-End Tests
1. **Complete User Journey**: Start lesson → Ask context question → Get response
2. **Context Accuracy**: Verify responses relate to current lesson
3. **Non-Interference**: Ensure context chat doesn't disrupt teaching
4. **Error Handling**: Test when main graph state unavailable

### Manual Testing Scenarios
1. **Basic Context Chat**: Ask question about current lesson
2. **Search Integration**: Ask question requiring external search
3. **Progress Awareness**: Ask about learning objectives
4. **Stage Transitions**: Verify context updates as lesson progresses

## Success Metrics

### User Engagement
- **Context Chat Usage**: % of sessions that use context chat
- **Message Volume**: Average messages per context chat session
- **Question Types**: Categories of questions asked (clarification, search, progress)

### Learning Effectiveness
- **Completion Rates**: Lesson completion before/after context chat
- **Time to Understanding**: Reduced time spent on confused states
- **Help-Seeking Behavior**: More proactive question asking

### Technical Performance
- **Response Time**: Context chat response latency
- **State Extraction Speed**: getMainGraphState() performance
- **Search Quality**: Relevance of context-enhanced search results
- **Error Rates**: Failed state extractions or context processing

### Success Criteria
- **95%+ uptime** for context chat service
- **< 2 second response time** for context-aware responses
- **80%+ user satisfaction** with contextual relevance
- **50%+ reduction** in lesson abandonment due to confusion

## Rollout Plan

### Phase 1: Development (Weeks 1-2)
1. **Backend Implementation**
   - Enhance langgraph-generic-chat with context awareness
   - Implement state.py, prompts.py, tools.py modifications
   - Create context processing graph

2. **Frontend Implementation**
   - Create ContextChatPanel component
   - Modify SessionChatAssistant layout
   - Implement state extraction mechanism

### Phase 2: Testing (Week 3)
1. **Unit Testing**: All components individually tested
2. **Integration Testing**: End-to-end flow validation
3. **Performance Testing**: State extraction and response times
4. **User Acceptance Testing**: Internal team validation

### Phase 3: Deployment (Week 4)
1. **Staging Deployment**: Deploy to staging environment
2. **Feature Flag**: Enable for internal users only
3. **Monitoring Setup**: Metrics collection and alerting
4. **Documentation**: User guides and technical docs

### Phase 4: Production Rollout (Weeks 5-6)
1. **Soft Launch**: 10% of sessions with feature flag
2. **Gradual Rollout**: Increase to 50%, then 100%
3. **Performance Monitoring**: Watch success metrics
4. **Feedback Collection**: User surveys and usage analytics

## Risk Mitigation

### Technical Risks
- **State Extraction Failure**: Fallback to generic chat mode
- **Performance Impact**: Async state extraction, caching strategies
- **Thread Synchronization**: Proper error handling and retry logic

### User Experience Risks
- **Information Overload**: Clean, focused UI design
- **Context Confusion**: Clear messaging about chat purpose
- **Distraction from Learning**: Non-intrusive design patterns

### Operational Risks
- **Service Dependencies**: Health checks and monitoring
- **Resource Usage**: Proper scaling and resource limits
- **Data Privacy**: Session-scoped context, no persistent storage

## Future Enhancements

### Short-term (Next Quarter)
- **Proactive Suggestions**: Identify when students might need help
- **Progress Integration**: Show learning path context in chat
- **Mobile Optimization**: Responsive design for mobile devices

### Medium-term (Next 6 Months)
- **Voice Integration**: Voice questions and responses
- **Visual Context**: Include lesson images/diagrams in context
- **Multi-language Support**: Context chat in student's native language

### Long-term (Future Releases)
- **AI Tutoring**: Advanced pedagogical strategies in responses
- **Peer Learning**: Connect students working on similar content
- **Analytics Dashboard**: Teachers can see common questions/struggles

---

*This design brief serves as the definitive specification for implementing MVP1 Context-Aware Chat Client. All implementation should follow the patterns and standards outlined in this document.*