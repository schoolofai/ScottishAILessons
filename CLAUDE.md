# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔑 CRITICAL: Database Architecture - Users vs Students

**DO NOT GET CONFUSED BETWEEN USER IDs AND STUDENT IDs**

The application has TWO types of IDs that are often confused:

1. **Auth User ID** (from Appwrite's built-in auth system)
   - Example: `68d28b6b0028ea8966c9`
   - This is the authenticated user's ID in Appwrite's auth database
   - Used in document permissions: `read("user:68d28b6b0028ea8966c9")`
   - Retrieved from `account.get()` as `user.$id`

2. **Student Document ID** (from our `students` collection)
   - Example: `68d28c190016b1458092`
   - This is the document ID in the `students` collection
   - Each student document has a `userId` field that links to the auth user
   - Retrieved from `students` collection query

**Relationship:**
```
students collection document (ID: 68d28c190016b1458092)
  └─ userId: "68d28b6b0028ea8966c9" (links to auth user)
```

**When checking permissions:**
- Document permissions use the **auth user ID** (e.g., `user:68d28b6b0028ea8966c9`)
- Business logic queries use the **student document ID** (e.g., `68d28c190016b1458092`)
- Always link them via the `userId` field in the students collection

**Example Flow:**
1. User logs in → get auth user ID: `68d28b6b0028ea8966c9`
2. Query students collection for `userId === 68d28b6b0028ea8966c9`
3. Get student document with ID: `68d28c190016b1458092`
4. Use student document ID for queries (sessions, mastery, etc.)
5. Permissions are checked against auth user ID

## Build and Development Commands

### Quick Start
```bash
# Start all services (main + context chat backends + frontend)
./start.sh

# Stop all services
./stop.sh

# Aegra (self-hosted alternative)
cd aegra-agent && ./start-aegra.sh
```

**IMPORTANT for Testing:**
- Local servers start FAST (typically ready in 5-10 seconds)
- When testing with Playwright after restart, DO NOT sleep more than 10 seconds
- Services run on localhost, so no network latency
- Typical wait times:
  - After `./start.sh`: 5-8 seconds for all services
  - Page navigation: 2-3 seconds
  - Dashboard data load: 3-5 seconds

### Submodule Management

**IMPORTANT**: `langgraph-agent` and `langgraph-generic-chat` are now Git submodules.

```bash
# First-time clone (get submodules automatically)
git clone --recurse-submodules https://github.com/schoolofai/ScottishAILessons.git

# Or initialize submodules in existing clone
git submodule update --init --recursive

# Update all submodules to latest
git submodule update --remote

# Update specific submodule
cd langgraph-agent && git pull origin main
cd .. && git add langgraph-agent && git commit -m "Update submodule"
```

### LangGraph Agent

**Note**: This is a submodule at `https://github.com/schoolofai/langgraph-agent`

#### Development Setup
```bash
cd langgraph-agent
python3 -m venv .venv  # Each submodule has its own venv
source .venv/bin/activate
pip install -e . "langgraph-cli[inmem]"
```

#### Running Services
```bash
# Standalone backend (port 2024)
cd langgraph-agent
source .venv/bin/activate
langgraph dev

# Or use root start.sh (recommended - starts all services)
cd .. && ./start.sh
```

#### Testing
```bash
cd langgraph-agent
source .venv/bin/activate
pytest tests/
```

### LangGraph Generic Chat

**Note**: This is a submodule at `https://github.com/schoolofai/langgraph-generic-chat`

#### Development Setup
```bash
cd langgraph-generic-chat
python3 -m venv .venv  # Separate venv from main backend
source .venv/bin/activate
pip install -e . "langgraph-cli[inmem]"
```

#### Running Services
```bash
# Standalone backend (port 2700)
cd langgraph-generic-chat
source .venv/bin/activate
langgraph dev --port 2700

# Or use root start.sh (recommended - starts all services)
cd .. && ./start.sh
```

#### Testing
```bash
cd langgraph-generic-chat
source .venv/bin/activate
pytest tests/
```

### Aegra Agent

#### Development Setup
```bash
cd aegra-agent
uv sync  # or: python3 -m venv .venv && source .venv/bin/activate && pip install -e .
docker compose up postgres -d
source .venv/bin/activate
python3 scripts/migrate.py upgrade
```

#### Running Services
```bash
# Backend (port 8000)
python3 run_server.py
# or with uvicorn:
uv run uvicorn src.agent_server.main:app --reload

# Frontend (port 3001)
cd ../assistant-ui-frontend
PORT=3001 npm run dev
```

#### Testing
```bash
cd aegra-agent
uv run pytest
uv run pytest tests/test_threads_history.py  # Specific test
uv run pytest --cov=src --cov-report=html  # With coverage
```

#### Database Management
```bash
# Apply migrations
python3 scripts/migrate.py upgrade

# Create new migration
python3 scripts/migrate.py revision -m "description"

# Check status
python3 scripts/migrate.py current
```

### Frontend (Shared)

#### Development Commands
```bash
cd assistant-ui-frontend

# Install dependencies
npm install --legacy-peer-deps

# Development server
npm run dev

# Build for production
npm run build

# Linting
npm run lint
```

#### Environment Configuration
The frontend uses different configurations based on the backend:
- `.env.local.langgraph` - LangGraph backend configuration (port 2024, frontend 3000)
- `.env.local.aegra` - Aegra backend configuration (port 8000, frontend 3001)
- `.env.local` - Active configuration (auto-generated by startup scripts)

## High-Level Architecture

### Dual Implementation Strategy
This repository provides two complete LangGraph implementations:

1. **Official LangGraph** (`langgraph-agent/`)
   - Managed cloud service with local development server
   - Uses LangGraph's built-in state management
   - Integrates with LangGraph Studio for visual debugging
   - Simple deployment with minimal configuration

2. **Aegra** (`aegra-agent/`)
   - Self-hosted alternative with PostgreSQL persistence
   - Full control over infrastructure and data
   - Agent Protocol compliant server wrapping LangGraph
   - Docker-based deployment with database migrations

### Shared Components

#### Frontend Architecture (`assistant-ui-frontend/`)
- Single React/Next.js application serves both backends
- Uses `@assistant-ui/react-langgraph` for LangGraph communication
- Environment-based backend switching via `.env.local` templates
- Responsive chat interface with streaming support
- Components: `MyAssistant.tsx` (main chat), `markdown-message.tsx` (rendering)

#### Agent Logic (`agents/`)
- `shared_chat_logic.py` - Core business logic used by both systems
- `langgraph_agent.py` - LangGraph wrapper using add_messages reducer
- `aegra_agent.py` - Aegra wrapper converting AIMessage to AIMessageChunk

### Backend Architecture Differences

#### Official LangGraph
- **Event Protocol**: Uses `event: values` for complete messages
- **Message Types**: Accepts both `AIMessage` and `AIMessageChunk`
- **State Management**: Built-in with LangGraph's StateGraph
- **Graph Definition**: Direct in `src/agent/graph.py`
- **Checkpointing**: Handled implicitly by LangGraph CLI in dev mode (stored in `.langraph_api` directory) - NO manual SqliteSaver setup needed

#### Aegra
- **Event Protocol**: Uses `event: messages` for streaming chunks
- **Message Types**: Requires `AIMessageChunk` for frontend compatibility
- **State Management**: PostgreSQL via LangGraph checkpoint system
- **Graph Loading**: Dynamic from `aegra.json` configuration
- **Database**: Hybrid approach - LangGraph handles state, SQLAlchemy tracks metadata

### Key Integration Points

#### LangGraph SDK Communication
Both systems use the same frontend SDK (`@langchain/langgraph-sdk`) but handle events differently:
- Official: Smart event selection based on message type
- Aegra: Consistent streaming-first approach with AIMessageChunk

#### Subgraph Streaming Configuration
**IMPORTANT**: The frontend must set `streamSubgraphs: true` in the client configuration to receive messages from subgraphs. This was discovered as a critical requirement for proper message streaming from the teaching subgraph. Without this setting, subgraph messages won't reach the frontend.

#### Structured Output Filtering with LangGraph Streaming
**CRITICAL GOTCHA**: When using `with_structured_output()` in LangGraph nodes, the JSON output streams to the frontend alongside regular content, creating duplicate/confusing UI messages.

**Problem**: LangGraph sends structured output as two separate streams:
1. `messages/metadata` event with `tags: ["json"]` and a specific `runId`
2. `messages/partial` events with the same `runId` containing JSON chunks token-by-token
3. Regular conversational content comes as separate `messages/partial` events with different `runId`s

**Solution**: Implement runId-based filtering in frontend streaming (see `assistant-ui-frontend/lib/chatApi.ts`):

```typescript
// Track runIds marked with "json" tag
const jsonRunIds = new Set<string>();

// 1. Detect metadata events and track JSON runIds
if (event.event === "messages/metadata" && event.data) {
  for (const [runId, runData] of Object.entries(event.data)) {
    if (runData.metadata?.tags?.includes("json")) {
      jsonRunIds.add(runId);
    }
  }
}

// 2. Filter partial events by runId
if (event.event === "messages/partial" && event.data?.[0]?.id) {
  if (jsonRunIds.has(event.data[0].id)) {
    continue; // Skip JSON chunks
  }
}
```

**Backend Setup**: Tag structured LLM calls with JSON:
```python
structured_llm = self.llm.with_structured_output(ResponseModel)
response = structured_llm.invoke(
    messages,
    config={"tags": ["json"], "run_name": "structured_evaluation"}
)
```

This approach is **generic** and works with any structured output schema, avoiding hardcoded content filtering.

#### AIMessage ID Duplication and Custom Tool Calls

**CRITICAL DISCOVERY**: When an LLM response is received, it already has a unique ID. Wrapping it in a new AIMessage creates a NEW unique ID, causing duplicate messages in the frontend.

**Problem**: 
```python
# DON'T DO THIS - causes duplication
message_obj = llm.invoke(...)  # Has ID: abc123
ai_message = AIMessage(content=message_obj.content, ...)  # NEW ID: xyz789
# Frontend sees both messages!
```

**Solution**:
```python
# Option 1: Use original message directly
return {"messages": [message_obj]}

# Option 2: Return both for different purposes
tool_message = AIMessage(content="", tool_calls=[...])  # Empty content
return {"messages": [message_obj, tool_message]}  # Content + tool trigger
```

**Custom Tool Calls for Assistant UI**:
You can create custom tool calls without LLM by wrapping in AIMessage:
```python
# Generate tool calls programmatically for Assistant UI components
tool_message = AIMessage(
    content="",  # Empty to avoid duplication
    tool_calls=[ToolCall(
        id="custom_id",
        name="ui_component_name",
        args={...}
    )]
)
```

This enables triggering Assistant UI's generative UI features even when the tool call isn't from a real LLM.

#### LangGraph Interrupt-Based Human-in-the-Loop Patterns

**📖 REFERENCE**: For detailed interrupt flow documentation, debugging, and implementation patterns, see: `/docs/interrupt-flow-documentation.md`

**Key Interrupt Patterns**:
- **Tool Calls for Data**: Use tool calls to transport lesson data to frontend UI components
- **Interrupts for Flow Control**: Use `interrupt({})` with empty payloads to pause execution and wait for user input
- **Resume Wrapper**: Always wrap `sendCommand` payloads in `resume: JSON.stringify({...})`
- **Hook Order**: React hooks (`useLangGraphInterruptState`, `useLangGraphSendCommand`) must be called before any conditional returns
- **Interrupt Check**: UI components should only render when `interrupt` is not null

**Critical Implementation Files**:
- Frontend: `assistant-ui-frontend/components/tools/LessonCardPresentationTool.tsx`
- Backend: `langgraph-agent/src/agent/teacher_graph_toolcall_interrupt.py`

**Common Debugging Scenarios**:
- Empty UI components → Check interrupt state and hook order
- Routing loops → Verify stage transitions and conditional edge logic  
- Missing data → Ensure data comes from tool call args, not interrupt payloads
- JSON parsing errors → Confirm resume wrapper pattern with proper JSON stringification

#### Authentication Systems
- Official LangGraph: Built-in authentication
- Aegra: Configurable (`AUTH_TYPE=noop` or `AUTH_TYPE=custom`)

#### Database Patterns
- Official: Managed by LangGraph platform
- Aegra: PostgreSQL with Alembic migrations + LangGraph checkpoint tables

## Git Submodule Management

**Three backends are managed as Git submodules:**

1. **langgraph-agent** - Main teaching backend (`https://github.com/schoolofai/langgraph-agent`)
2. **langgraph-generic-chat** - Context chat backend (`https://github.com/schoolofai/langgraph-generic-chat`)
3. **aegra-agent** - Self-hosted alternative (`https://github.com/schoolofai/aegra`)

```bash
# Clone with all submodules
git clone --recurse-submodules https://github.com/schoolofai/ScottishAILessons.git

# Update all submodules to latest
git submodule update --remote

# Update specific submodule
git submodule update --remote langgraph-agent

# Work on submodule (example: langgraph-agent)
cd langgraph-agent
git checkout -b feature/my-feature
# Make changes
git add . && git commit -m "Add feature"
git push origin feature/my-feature
cd ..
git add langgraph-agent && git commit -m "Update langgraph-agent submodule"
```

## Project Structure

```
ScottishAILessons/
├── start.sh                    # Orchestrates all services
├── stop.sh                     # Stops all services
├── logs/                       # Centralized log directory
│   ├── backend.log
│   ├── context-chat.log
│   └── frontend.log
├── assistant-ui-frontend/       # Shared frontend
│   ├── components/             # React components
│   ├── app/                    # Next.js app router
│   └── .env.local.*           # Environment templates
├── langgraph-agent/            # Submodule: Main teaching backend
│   ├── .venv/                 # Own virtual environment
│   ├── src/agent/             # Graph definitions
│   ├── tests/                 # Tests
│   └── langgraph.json         # LangGraph config
├── langgraph-generic-chat/     # Submodule: Context chat backend
│   ├── .venv/                 # Own virtual environment
│   ├── src/react_agent/       # ReAct agent
│   ├── tests/                 # Tests
│   └── langgraph.json         # LangGraph config
├── aegra-agent/               # Self-hosted (submodule)
│   ├── src/agent_server/      # FastAPI server
│   ├── graphs/                # Agent definitions
│   ├── scripts/migrate.py    # Migration tool
│   └── start-aegra.sh       # Startup script
└── agents/                   # Shared logic
    ├── shared_chat_logic.py
    ├── langgraph_agent.py
    └── aegra_agent.py
```

## Testing Strategy

- Run `pytest` in langgraph-agent for official LangGraph tests
- Run `uv run pytest` in aegra-agent for Aegra tests
- No linting/type checking configured - focus on functional testing
- Both systems support hot-reload during development
- for mvp the test user login details are email - test@scottishailessons.com , password = red12345
- always use playwright mcp tool to mannually test after every code change
- can you rememeber to call @langgraph-agent/stop.sh that stops the front end and the back end and then use @langgraph-agent/start.sh so we dont get port aleady in use issue.
- when application is not starting run @langgraph-agent/stop.sh and then @langgraph-agent/start.sh again - there is no need to check ports etc. just restart
- the graph to use is @langgraph-agent/src/agent/graph_interrupt.py as it is pointed to by @langgraph-agent/langgraph.json do not use @langgraph-agent/src/agent/graph.py as this is only an example.
- always check the entry point for the langgraph agent from @langgraph-agent/langgraph.json do not assume the graph to use for testing
- Never use fallback pattern as it is an anti pattern and caused silent fails - always throw exceptions for failing fast and perform detailed error logging
- do not run long runnign author agents in @claud_author_agent/ without confirming even in bypass mode
- the @start.sh script starts local servers so it loads fast do not sleep more that 10 seconds when testing with playwright
- all access to appwrite should use server side auth and any client side auth is not allowed
- in @langgraph-agent/ @claud_author_agent/ @langgraph-generic-chat/ and @langgraph-author-agent/ are generative AI apps - is schema validation fails e.g. with pydantic - then you should not silently implement post porcessing hacks to fix the issue - the real issue needs to be sorted with context and / or prompt engineering.