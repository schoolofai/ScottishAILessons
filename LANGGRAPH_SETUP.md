# LangGraph Scaffolding Setup

This project now has a complete LangGraph application with Python backend and Assistant-UI frontend.

## Project Structure

```
ScottishAILessons/
├── venv/                       # Python virtual environment
├── langgraph-agent/            # LangGraph Python backend
│   ├── src/
│   │   └── agent/
│   │       └── graph.py        # Main graph logic (needs customization)
│   ├── .env                    # Environment variables
│   ├── langgraph.json          # LangGraph configuration
│   └── assistant-ui-frontend/  # Next.js frontend
│       ├── app/                # Next.js app directory
│       ├── components/         # React components
│       └── .env.local          # Frontend environment variables
└── test_integration.py         # Integration test script
```

## Quick Start

### 1. Start the Backend (Terminal 1)
```bash
cd /Users/niladribose/code/ScottishAILessons
source venv/bin/activate
cd langgraph-agent
langgraph dev
```

Backend will be available at:
- API: http://localhost:2024
- Docs: http://localhost:2024/docs  
- Studio: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024

### 2. Start the Frontend (Terminal 2)
```bash
cd /Users/niladribose/code/ScottishAILessons/langgraph-agent/assistant-ui-frontend
npm run dev
```

Frontend will be available at:
- http://localhost:3000

## Current Status

✅ **Backend**: Running on port 2024
✅ **Frontend**: Running on port 3000
⚠️ **Graph Logic**: Using template (needs customization in `src/agent/graph.py`)

## Next Steps

1. **Customize the Graph**: 
   - Edit `/langgraph-agent/src/agent/graph.py` to implement your agent logic
   - The current implementation is a simple template that returns a predefined response

2. **Add API Keys**:
   - Add your LANGSMITH_API_KEY to `/langgraph-agent/.env`
   - Add any LLM provider API keys (OpenAI, Anthropic, etc.)

3. **Deploy to Cloud** (Optional):
   - Push to GitHub
   - Deploy via LangSmith Deployments
   - Update frontend env vars to point to cloud URL

## Customizing the Agent

The default graph in `src/agent/graph.py` needs to be modified for a chat interface. Here's a basic example:

```python
from typing import Annotated, TypedDict
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage

class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

async def chat_model(state: State):
    # Add your LLM logic here
    return {"messages": [{"role": "assistant", "content": "Hello from LangGraph!"}]}

graph = (
    StateGraph(State)
    .add_node("chat", chat_model)
    .add_edge("__start__", "chat")
    .compile(name="Chat Agent")
)
```

## Troubleshooting

- If ports are already in use, you can change them in the respective config files
- Make sure to activate the virtual environment before running Python commands
- The frontend may show dependency warnings - these can be resolved with `npm audit fix`