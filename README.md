# LangGraph Chat Applications - Official + Self-Hosted

[![CI](https://github.com/langchain-ai/new-langgraph-project/actions/workflows/unit-tests.yml/badge.svg)](https://github.com/langchain-ai/new-langgraph-project/actions/workflows/unit-tests.yml)
[![Integration Tests](https://github.com/langchain-ai/new-langgraph-project/actions/workflows/integration-tests.yml/badge.svg)](https://github.com/langchain-ai/new-langgraph-project/actions/workflows/integration-tests.yml)

This repository provides **two complete LangGraph implementations** for building AI-powered conversational applications:

1. **Official LangGraph** - Managed cloud service with LangGraph Studio
2. **Aegra** - Self-hosted alternative with PostgreSQL persistence

Both systems feature streaming support, thread management, and modern React frontends powered by [Assistant-UI](https://www.assistant-ui.com/).

<div align="center">
  <img src="./static/studio_ui.png" alt="Graph view in LangGraph studio UI" width="75%" />
</div>

## 🚀 Quick Start

### Prerequisites
- **Python 3.11+** installed
- **Node.js 18+** and npm installed
- **Docker** for Aegra's PostgreSQL database
- **Git** for version control
- A code editor (VS Code recommended)

### 🎯 Choose Your Implementation

#### Option 1: Official LangGraph
```bash
cd langgraph-agent
./start.sh
```

#### Option 2: Aegra (Self-hosted)  
```bash
cd aegra-agent
./start-aegra.sh
```

These scripts will:
- ✅ Check prerequisites (Python, Node.js)
- ✅ Create virtual environment if needed
- ✅ Install all dependencies automatically
- ✅ Configure environment files (.env, .env.local)
- ✅ Start both servers simultaneously
- ✅ Wait for servers to be ready
- ✅ Open your browser automatically
- ✅ Display all relevant URLs
- ✅ Create log files for debugging
- ✅ Handle graceful shutdown with Ctrl+C
- ✅ Monitor server health

### Option 2: Manual Setup

If you prefer to set up manually or the scripts don't work:

```bash
# 1. Navigate to the project
cd langgraph-agent

# 2. Set up Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install backend dependencies
pip install -e . "langgraph-cli[inmem]"

# 4. Configure environment
cp .env.example .env
# Add your API keys to .env if needed

# 5. Install frontend dependencies
cd assistant-ui-frontend
npm install --legacy-peer-deps
cd ..

# 6. Start both servers (in separate terminals)

# Terminal 1 - Backend:
langgraph dev

# Terminal 2 - Frontend:
cd assistant-ui-frontend
npm run dev
```

### 🌐 URLs & Ports

#### Official LangGraph:
- 🎯 **Frontend**: http://localhost:3000
- 🔧 **Backend API**: http://localhost:2024
- 📊 **LangGraph Studio**: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024

#### Aegra (Self-hosted):
- 🎯 **Frontend**: http://localhost:3001
- 🔧 **Backend API**: http://localhost:8000
- 📖 **API Docs**: http://localhost:8000/docs
- 🗄️ **PostgreSQL**: localhost:5432

### Option 2: Create From Scratch

Follow these steps to recreate this template from the beginning:

## 📝 Detailed Setup Instructions

### Step 1: Create Project Structure

```bash
# Create main project directory
mkdir my-langgraph-app
cd my-langgraph-app

# Set up Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### Step 2: Install LangGraph CLI

```bash
# Install LangGraph CLI with in-memory runtime support
pip install --upgrade "langgraph-cli[inmem]"
```

### Step 3: Create LangGraph Backend

```bash
# Create new LangGraph project from template
langgraph new langgraph-agent --template new-langgraph-project-python

# Navigate to the backend directory
cd langgraph-agent

# Install backend dependencies
pip install -e .

# Set up environment configuration
cp .env.example .env
```

### Step 4: Configure Backend for Chat

Replace the contents of `src/agent/graph.py` with a chat-compatible implementation:

```python
"""LangGraph chat interface for Assistant-UI frontend."""

from typing import Annotated, TypedDict
from langchain_core.messages import AIMessage, BaseMessage
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages


class State(TypedDict):
    """State for the chat agent."""
    messages: Annotated[list[BaseMessage], add_messages]


async def chat_node(state: State) -> dict:
    """Process chat messages and generate responses."""
    if state["messages"]:
        last_message = state["messages"][-1]
        user_input = last_message.content if hasattr(last_message, 'content') else str(last_message)
        
        # Add your AI logic here - this is a simple demo
        if "hello" in user_input.lower():
            response = "Hello! I'm your LangGraph assistant. How can I help you today?"
        elif "joke" in user_input.lower():
            response = "Why don't scientists trust atoms? Because they make up everything! 😄"
        else:
            response = f"I received: '{user_input}'. To add AI capabilities, integrate an LLM provider."
    else:
        response = "Hello! Send me a message to get started."
    
    return {"messages": [AIMessage(content=response)]}


# Define and compile the graph
graph = (
    StateGraph(State)
    .add_node("chat", chat_node)
    .add_edge("__start__", "chat")
    .compile(name="agent")  # Must match NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID
)
```

### Step 5: Create Assistant-UI Frontend

```bash
# From the langgraph-agent directory
npx create-assistant-ui@latest -t langgraph assistant-ui-frontend

# If you encounter dependency conflicts, install with:
cd assistant-ui-frontend
npm install --legacy-peer-deps
```

### Step 6: Configure Frontend Environment

Create `.env.local` in the `assistant-ui-frontend` directory:

```bash
# assistant-ui-frontend/.env.local
NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:2024
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=agent
```

### Step 7: Start the Application

```bash
# Terminal 1 - Start Backend (from langgraph-agent directory)
langgraph dev

# Terminal 2 - Start Frontend (from assistant-ui-frontend directory)
npm run dev
```

## 📚 Documentation & Resources

### Backend (LangGraph)

- **[LangGraph Documentation](https://langchain-ai.github.io/langgraph/)** - Complete guide to LangGraph
- **[LangGraph Concepts](https://langchain-ai.github.io/langgraph/concepts/)** - Core concepts and architecture
- **[State Management](https://langchain-ai.github.io/langgraph/concepts/low_level/#state)** - Understanding graph state
- **[Message Handling](https://langchain-ai.github.io/langgraph/concepts/low_level/#messages)** - Working with messages
- **[LangGraph Server](https://langchain-ai.github.io/langgraph/concepts/langgraph_server/)** - Server deployment guide
- **[LangGraph Studio](https://langchain-ai.github.io/langgraph/concepts/langgraph_studio/)** - Visual debugging IDE

### Frontend (Assistant-UI)

- **[Assistant-UI Documentation](https://www.assistant-ui.com/docs)** - Official docs
- **[Getting Started Guide](https://www.assistant-ui.com/docs/getting-started)** - Quick start tutorial
- **[LangGraph Integration](https://www.assistant-ui.com/docs/runtimes/langgraph)** - Specific LangGraph setup
- **[Components Reference](https://www.assistant-ui.com/docs/components)** - UI component library
- **[Theming Guide](https://www.assistant-ui.com/docs/theming)** - Customize appearance

### AI/LLM Integration

- **[LangChain Models](https://python.langchain.com/docs/integrations/platforms/)** - Integrate various LLMs
- **[OpenAI Integration](https://python.langchain.com/docs/integrations/platforms/openai/)** - Use OpenAI models
- **[Anthropic Integration](https://python.langchain.com/docs/integrations/platforms/anthropic/)** - Use Claude models

### Aegra (Self-hosted)

- **[Aegra GitHub](https://github.com/ibbybuilds/aegra)** - Self-hosted LangGraph alternative
- **[Agent Protocol](https://www.agentprotocol.ai/)** - Standard for agent communication
- **[Docker Documentation](https://docs.docker.com/)** - Container deployment guide
- **[PostgreSQL Docs](https://www.postgresql.org/docs/)** - Database configuration

## 📊 Implementation Comparison

| Feature | Official LangGraph | Aegra (Self-hosted) |
|---------|-------------------|-------------------|
| **Deployment** | Managed cloud service | Self-hosted Docker |
| **Database** | Managed | PostgreSQL (you control) |
| **Cost** | Pay-per-use | Infrastructure only |
| **Data Control** | Vendor-managed | Full ownership |
| **Debugging** | LangGraph Studio | API docs + logs |
| **Authentication** | Built-in | Configurable (noop/custom) |
| **Scaling** | Automatic | Manual |
| **Setup Time** | ~2 minutes | ~5 minutes |
| **Customization** | Limited | Full control |
| **Vendor Lock-in** | Yes | No |

## 🛠️ Project Structure

```
ScottishAILessons/
├── langgraph-agent/                    # Official LangGraph
│   ├── src/agent/graph.py             # Graph logic
│   ├── assistant-ui-frontend/         # Frontend (port 3000)
│   ├── start.sh                       # Startup script
│   └── .env                           # Environment config
├── aegra-agent/                        # Self-hosted Aegra (Git Submodule)
│   ├── graphs/chat_agent.py          # Chat agent implementation
│   ├── start-aegra.sh                # Aegra startup script
│   ├── docker-compose.yml            # PostgreSQL config
│   └── .env                           # Environment config
├── assistant-ui-frontend-aegra/       # Aegra frontend (port 3001)
│   ├── .env.local                     # Aegra backend config
│   └── package.json                   # Port 3001 config
└── README.md                          # This file
```

## 🎯 Key Features

### Both Implementations
- **🔄 Real-time Streaming**: Messages stream from backend to frontend
- **💬 Thread Management**: Conversation history and context preservation
- **🎨 Modern UI**: Clean, responsive chat interface powered by Assistant-UI
- **🚀 Hot Reload**: Both frontend and backend support hot reloading
- **📊 State Management**: Robust state handling with LangGraph
- **🔌 Extensible**: Easy to add LLM providers and custom logic

### Official LangGraph Exclusive
- **🔍 Visual Debugging**: LangGraph Studio integration for graph visualization
- **☁️ Cloud Managed**: No infrastructure management required
- **📈 Auto-scaling**: Handles traffic spikes automatically

### Aegra Exclusive
- **🏠 Self-hosted**: Full control over your infrastructure
- **🗄️ PostgreSQL**: Persistent storage with full database control
- **🔓 Zero Vendor Lock-in**: Open source with Apache 2.0 license
- **🛡️ Data Sovereignty**: Your data never leaves your infrastructure
- **💰 Cost Control**: Pay only for your infrastructure costs

## 💡 Customization Guide

### Adding LLM Support

To integrate a real LLM (e.g., OpenAI, Anthropic), modify `src/agent/graph.py`:

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

async def chat_node(state: State) -> dict:
    # Initialize your LLM
    llm = ChatOpenAI(model="gpt-4", temperature=0.7)
    
    # Get conversation history
    messages = state["messages"]
    
    # Generate response
    response = await llm.ainvoke(messages)
    
    return {"messages": [response]}
```

Don't forget to:
1. Install the provider: `pip install langchain-openai`
2. Add API keys to `.env`: `OPENAI_API_KEY=your-key`

### Customizing the Frontend

Edit `assistant-ui-frontend/components/MyAssistant.tsx` to customize:
- Welcome messages
- UI theme and styling
- Tool rendering
- Message formatting

### Adding Tools/Functions

Extend the graph with tool-calling capabilities:

```python
from langgraph.prebuilt import ToolNode
from langchain_core.tools import tool

@tool
def search_web(query: str) -> str:
    """Search the web for information."""
    # Implement search logic
    return f"Search results for: {query}"

# Add tools to your graph
tools = [search_web]
tool_node = ToolNode(tools)

graph = (
    StateGraph(State)
    .add_node("chat", chat_node)
    .add_node("tools", tool_node)
    .add_conditional_edges("chat", should_use_tools)
    .add_edge("tools", "chat")
    .compile()
)
```

## 🚢 Deployment

### Deploy Backend to LangGraph Cloud

1. Push your code to GitHub
2. Go to [LangSmith](https://smith.langchain.com/)
3. Navigate to Deployments → New Deployment
4. Connect your GitHub repository
5. Deploy and get your API URL

### Deploy Frontend to Vercel

1. Push frontend to GitHub
2. Import to [Vercel](https://vercel.com)
3. Set environment variables:
   ```
   LANGCHAIN_API_KEY=your_key
   LANGGRAPH_API_URL=https://your-deployment-url
   NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=agent
   ```

## 🐛 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Change backend port in langgraph.json
# Change frontend port: npm run dev -- -p 3001
```

**Dependency conflicts:**
```bash
# Frontend: use --legacy-peer-deps
npm install --legacy-peer-deps

# Backend: use virtual environment
python3 -m venv venv
source venv/bin/activate
```

**Messages not appearing:**
- Check browser console for errors
- Verify `.env.local` configuration
- Ensure both servers are running
- Check network tab for API calls

**Graph not updating:**
- LangGraph dev server auto-reloads on file changes
- If not, restart with `langgraph dev`

## 📖 Learn More

### Tutorials
- [Build a Chatbot](https://langchain-ai.github.io/langgraph/tutorials/introduction/)
- [Multi-Agent Systems](https://langchain-ai.github.io/langgraph/tutorials/multi_agent/)
- [RAG Applications](https://langchain-ai.github.io/langgraph/tutorials/rag/)

### Examples
- [Customer Support Bot](https://github.com/langchain-ai/langgraph/tree/main/examples/customer-support)
- [Research Assistant](https://github.com/langchain-ai/langgraph/tree/main/examples/research-assistant)
- [Code Assistant](https://github.com/langchain-ai/langgraph/tree/main/examples/code-assistant)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with [LangGraph](https://github.com/langchain-ai/langgraph) by LangChain
- Frontend powered by [Assistant-UI](https://www.assistant-ui.com/)
- Inspired by modern conversational AI applications

---

## 🤔 Which Implementation Should You Choose?

### Choose **Official LangGraph** if you:
- ✅ Want the fastest setup (2 minutes)
- ✅ Prefer managed services
- ✅ Need LangGraph Studio for visual debugging
- ✅ Don't want to manage infrastructure
- ✅ Are prototyping or doing small projects

### Choose **Aegra** if you:
- ✅ Need full control over your data
- ✅ Want to avoid vendor lock-in
- ✅ Have specific compliance requirements
- ✅ Want to minimize long-term costs
- ✅ Need custom authentication/authorization
- ✅ Want to run on-premises

### Run **Both** if you:
- ✅ Want to compare implementations
- ✅ Are evaluating which approach to use
- ✅ Want to learn different deployment strategies
- ✅ Need a migration path between systems

## 🎯 Quick Commands Summary

```bash
# Official LangGraph only
cd langgraph-agent && ./start.sh

# Aegra (self-hosted) only
cd aegra-agent && ./start-aegra.sh
```

## 🔗 Git Submodule Management

The `aegra-agent/` directory is managed as a Git submodule using our fork at `https://github.com/schoolofai/aegra.git`. This allows us to:

- Keep sync with upstream Aegra development
- Version control our customizations
- Maintain clean separation between upstream and local changes

### Submodule Commands

```bash
# Clone repository with submodules
git clone --recurse-submodules https://github.com/schoolofai/ScottishAILessons.git

# Initialize submodules (if already cloned)
git submodule update --init --recursive

# Update submodule to latest from fork
git submodule update --remote aegra-agent

# Work on Aegra customizations
cd aegra-agent
# Make changes, commit, and push to fork
git add . && git commit -m "Custom changes" && git push

# Update main repo to reference new submodule commit
cd ..
git add aegra-agent && git commit -m "Update Aegra submodule"
```

### Syncing with Upstream

To sync your fork with the original Aegra repository:

```bash
cd aegra-agent
git remote add upstream https://github.com/ibbybuilds/aegra.git
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

---

**Need help?** Check the [LangGraph Discord](https://discord.gg/langchain), [Assistant-UI GitHub](https://github.com/Yonom/assistant-ui), or [Aegra Repository](https://github.com/ibbybuilds/aegra)