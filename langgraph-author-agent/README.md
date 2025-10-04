# LangGraph Author Agent - Gemini 2.5 Pro Edition

A research agent powered by LangGraph, DeepAgents, and Google's Gemini 2.5 Pro that conducts thorough research using web search and generates comprehensive reports with citations.

## Features

- **Gemini 2.5 Pro Integration**: Powered by Google's latest large language model
- **Deep Research**: Uses Tavily web search to gather information from multiple sources
- **Iterative Refinement**: Employs sub-agents for research and critique to improve report quality
- **Structured Output**: Generates well-formatted markdown reports with proper citations
- **Flexible Structure**: Adapts report structure based on the research question
- **Scottish Education Focus**: Specialized prompts for SQA, CfE, and Scottish context

## 🎯 Multiple Agents Available

This repository contains multiple specialized agents:

### 1. **Research Agent** (this README)
   - Conducts thorough web research
   - Generates comprehensive reports with citations
   - Graph ID: `research`

### 2. **SoW Author Agent**
   - Authors complete Schemes of Work for Scottish courses
   - Graph ID: `sow_author`

### 3. **Lesson Author Agent** 📚 [**Full Documentation →**](./docs/)
   - Authors individual lesson templates with pedagogical cards
   - Orchestrates 8 specialized subagents
   - Validates with 5 quality critics
   - Graph ID: `lesson_author`
   - **Quick Start**: See [`docs/QUICKSTART_LESSON_AUTHOR.md`](./docs/QUICKSTART_LESSON_AUTHOR.md)
   - **Comprehensive Guide**: See [`docs/README_LESSON_AUTHOR.md`](./docs/README_LESSON_AUTHOR.md)

---

## Prerequisites

- Python 3.11 or higher
- [Google API Key](https://makersuite.google.com/app/apikey) for Gemini 2.5 Pro
- [Tavily API Key](https://tavily.com/) for web search
- [LangSmith API Key](https://smith.langchain.com/) (optional, for tracing)

## Quick Start

### Using the Start Script (Recommended)

The easiest way to get started:

```bash
./start.sh
```

This script will:
- Create/activate virtual environment
- Install dependencies automatically
- Verify API keys are configured
- Start LangGraph server with Gemini 2.5 Pro

The server will be available at:
- 🚀 API: http://127.0.0.1:2025
- 🎨 Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2025
- 📚 API Docs: http://127.0.0.1:2025/docs

### Automated Installation Test

To validate the installation process works correctly:

```bash
./test_clean_install.sh
```

**Note**: This script will remove any existing `venv` directory to ensure a clean test.

### Manual Installation

Follow these steps to set up the project manually:

### 1. Create and Activate Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate

# On Windows:
# venv\Scripts\activate
```

### 2. Install Dependencies

The project uses a `setup.py` file to manage dependencies. Install in editable mode:

```bash
pip install -e .
```

This will install:
- `langgraph-cli[inmem]` - LangGraph development server
- `tavily-python` - Web search client
- `deepagents` - Agent framework with all LangChain dependencies

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Copy example if available, or create new
cp .env.example .env  # if example exists

# Or create manually
cat > .env << EOF
GOOGLE_API_KEY=your_google_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here

# Optional (for LangSmith tracing)
LANGSMITH_PROJECT=research-agent
LANGSMITH_API_KEY=your_langsmith_api_key_here
EOF
```

**Important**:
- Get your Google API Key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Get your Tavily API Key from [Tavily](https://tavily.com/)
- Replace the placeholder values with your actual API keys

### 4. Start the Development Server

**Important**: Use the `--allow-blocking` flag for Gemini compatibility:

```bash
langgraph dev --allow-blocking --port 2025
```

The server will start on `http://127.0.0.1:2025` and automatically open LangGraph Studio in your browser.

**Why `--allow-blocking`?**: Gemini's initialization makes synchronous file I/O calls that would otherwise block the async event loop. This flag is safe for development.

You should see output like:
```
╦  ┌─┐┌┐┌┌─┐╔═╗┬─┐┌─┐┌─┐┬ ┬
║  ├─┤││││ ┬║ ╦├┬┘├─┤├─┘├─┤
╩═╝┴ ┴┘└┘└─┘╚═╝┴└─┴ ┴┴  ┴ ┴

- 🚀 API: http://127.0.0.1:2024
- 🎨 Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
- 📚 API Docs: http://127.0.0.1:2024/docs
```

### 5. Test the Agent

Open the Studio UI and:
1. Select the "research" assistant
2. Start a new thread
3. Send a research query, e.g., "What are the latest developments in quantum computing?"

The agent will:
- Break down your question into research topics
- Search the web for information
- Generate a comprehensive report
- Optionally critique and refine the report

## Project Structure

```
langgraph-author-agent/
├── README.md                  # This file
├── setup.py                   # Package configuration
├── requirements.txt           # Direct dependencies
├── langgraph.json            # LangGraph configuration
├── .env                      # Environment variables (not tracked)
├── .env.example              # Environment template
├── .gitignore                # Git ignore rules
├── test_clean_install.sh     # Installation validation script
├── venv/                     # Virtual environment (not tracked)
└── src/
    ├── __init__.py           # Package marker
    ├── prompts.py            # All prompt templates
    └── research_agent.py     # Main agent implementation
```

## Architecture

### Import Pattern

The project uses a dual-import pattern to work with both:
- **Installed package mode**: When using `pip install -e .`
- **Direct file loading**: When LangGraph CLI loads modules directly

```python
try:
    from src.research_agent_prompts import SUB_RESEARCH_PROMPT  # Package mode
except ImportError:
    from research_agent_prompts import SUB_RESEARCH_PROMPT      # Direct loading
```

### Agent Components

1. **LLM Backend**: Google Gemini 2.5 Pro (temperature: 0.7)
2. **Research Sub-Agent**: Conducts deep research on specific topics
3. **Critique Sub-Agents**: Multiple specialized critics for quality assurance
4. **Main Agent**: Orchestrates research, writing, and refinement

### Gemini 2.5 Pro Configuration

The agent uses Google's Gemini 2.5 Pro model configured in `src/research_agent_sqa.py`:

```python
from langchain_google_genai import ChatGoogleGenerativeAI

gemini = ChatGoogleGenerativeAI(
    model="gemini-2.5-pro",
    api_key=os.environ["GOOGLE_API_KEY"],
    temperature=0.7,
)

agent = create_deep_agent(
    model=gemini,  # Gemini model passed here
    tools=[internet_search],
    instructions=RESEARCH_INSTRUCTIONS_SQA,
    subagents=[...],
)
```

**Model Options**:
- `gemini-2.5-pro` - Latest production model (recommended)
- `gemini-2.0-flash-exp` - Faster experimental model
- `gemini-1.5-pro` - Previous generation

**Temperature**: 0.7 balances creativity with consistency for research tasks

### Prompt Organization

All prompts are centralized in `src/research_agent_prompts.py` (8 prompts total, 609 lines, 32KB):

**Main Research Instructions:**
- `RESEARCH_INSTRUCTIONS_SQA` - Scottish Qualifications Authority research (currently in use)
- `RESEARCH_INSTRUCTIONS` - Generic research instructions (available as alternative)

**Sub-Agent Prompts:**
- `SUB_RESEARCH_PROMPT` - Instructions for research sub-agent
- `SUB_CRITIQUE_PROMPT` - Generic critique sub-agent (legacy)

**Specialized Critic Ensemble (for SQA Research):**
- `SUB_CRITIC_COVERAGE` - Evaluates completeness and representativeness (≥0.90 threshold)
- `SUB_CRITIC_SOURCE_QUALITY` - Assesses authority, recency, reliability (≥0.80 threshold)
- `SUB_CRITIC_AUTHENTICITY` - Validates Scottish context and terminology (≥0.90 threshold)
- `SUB_CRITIC_PEDAGOGY` - Judges author usability for SoW and lessons (≥0.90 threshold)

#### SQA-Specific Research Agent

The agent is configured to produce **Research Packs** for Scottish secondary education, specifically targeting:
- **Curriculum for Excellence** terminology
- **SQA** (Scottish Qualifications Authority) course specifications
- Scottish school resources (*.sch.uk domains)
- Scottish context: £ currency, local services, place names
- Accessibility patterns for Scottish classrooms

The output is a structured JSON file (`research_pack_json`) containing:
- Real source exemplars from Scottish educational resources
- Canonical terms and assessment stems
- Pedagogical patterns (starters, CFUs, rubrics)
- Calculator policy notes
- Accessibility patterns (plain language, dyslexia-friendly)
- Proper citations with verification URLs

#### Critic Ensemble Quality Control

The SQA research process includes a **4-dimensional critique ensemble** that iteratively improves research quality:

1. **Coverage Critic** (≥0.90): Evaluates breadth, depth, and balance
   - Checks for multiple authentic sources
   - Ensures both SoW and lesson construction support
   - Validates metadata sufficiency and source diversity
   - Outputs: coverage scores, gap analysis, concrete TODOs

2. **Source Quality Critic** (≥0.80): Assesses trust and reliability
   - Prioritizes SQA, Education Scotland, GTCS, Scottish schools
   - Validates recency and traceability
   - Flags weak sources with specific issues
   - Outputs: authority scores, weak source list, replacement queries

3. **Authenticity Critic** (≥0.90): Validates Scottish correctness
   - Checks Scottish/UK English and £ currency usage
   - Validates CfE/SQA terminology alignment
   - Ensures realistic Scottish contexts (places, services)
   - Outputs: fit scores, mismatch examples, correction instructions

4. **Pedagogy Critic** (≥0.90): Judges author usability
   - Evaluates SoW sequencing actionability
   - Assesses lesson template construction readiness
   - Validates CFU variety and rubric support
   - Outputs: actionability scores, gap list, rewrite examples

**Iterative Process**: The research agent runs up to 3 critique iterations. Each critic provides:
- `pass` boolean (whether threshold met)
- Dimensional scores (0-1 scale)
- Specific findings/gaps
- Actionable TODOs with example queries
- Brief notes

The agent stops when all critics pass or after 3 iterations, ensuring high-quality research packs.

## Development

### Installing in Editable Mode

The `-e` flag installs the package in "editable" mode, meaning changes to source files are immediately reflected without reinstalling:

```bash
pip install -e .
```

This creates a link to your source directory in the virtual environment's site-packages.

### Adding New Dependencies

When you need to add additional dependencies to the project (e.g., `langchain-mcp-adapters`):

#### 1. Activate the Virtual Environment

```bash
source venv/bin/activate  # or ../venv/bin/activate if shared venv
```

#### 2. Install the New Package

```bash
pip install package-name
```

Example:
```bash
pip install langchain-mcp-adapters
```

#### 3. Verify the Import

Test that the package imports correctly:

```bash
python3 -c "from package_name import ClassName; print('✅ Import successful')"
```

Example:
```bash
python3 -c "from langchain_mcp_adapters.client import MultiServerMCPClient; print('✅ Import successful')"
```

#### 4. Update requirements.txt (Optional)

If you want to track the dependency for future installations:

```bash
pip freeze | grep package-name >> requirements.txt
```

Or manually add it to `setup.py` in the `install_requires` list for a cleaner dependency management.

#### 5. Verify Agent Code

Check that your agent files compile without syntax errors:

```bash
python3 -m py_compile src/your_agent_file.py
```

Example:
```bash
python3 -m py_compile src/research_agent_sqa.py src/sow_author_agent.py
```

**Note**: The agent may fail to fully import if environment variables (like `TAVILY_API_KEY`) are missing, but the syntax check will confirm that the import statements themselves are valid.

### Why We Need setup.py

LangGraph CLI loads modules directly from file paths, which can break relative imports. The `setup.py` file solves this by:

1. **Making `src/` a proper Python package**: Registers the package with pip so Python knows about it
2. **Managing dependencies**: Automatically installs all required packages (langgraph-cli, tavily-python, deepagents)
3. **Enabling editable installs**: The `-e` flag creates a link to your source code, so changes are immediately reflected
4. **Supporting the import fallback pattern**: Allows imports to work both in package mode and direct file loading mode

**Without setup.py**: You'd get `ImportError: attempted relative import with no known parent package` when LangGraph CLI tries to load your graph.

**With setup.py**: The dual-import pattern works seamlessly:
```python
try:
    from src.research_agent_prompts import PROMPT  # Works when installed as package
except ImportError:
    from research_agent_prompts import PROMPT      # Works when loaded directly by CLI
```

### Verifying Installation

Check that the package is installed:

```bash
pip list | grep langgraph-author-agent
```

You should see:
```
langgraph-author-agent    0.1.0    /path/to/langgraph-author-agent
```

### Troubleshooting

**ImportError: attempted relative import with no known parent package**
- Make sure you've run `pip install -e .`
- Verify `src/__init__.py` exists
- Check that `setup.py` is in the project root

**Module not found: deepagents**
- Run `pip install -e .` to install all dependencies
- Or manually: `pip install deepagents`

**TAVILY_API_KEY or ANTHROPIC_API_KEY not found**
- Create `.env` file with your API keys
- Ensure `.env` is in the same directory as `langgraph.json`

**Port 2024 already in use**
- Stop existing LangGraph server: `lsof -ti:2024 | xargs kill -9`
- Or use a different port: `langgraph dev --port 8080`

**BlockingError: Blocking call to io.TextIOWrapper.read**
- This occurs when Gemini initializes without `--allow-blocking` flag
- Solution: Always use `langgraph dev --allow-blocking` (included in `start.sh`)
- For production: Set `BG_JOB_ISOLATED_LOOPS=true` environment variable

**ALTS Credentials Warning**
- Warning: `ALTS creds ignored. Not running on GCP` is normal
- This is a harmless gRPC security feature for Google Cloud Platform
- No action needed - Gemini API works fine without GCP

**Module not found: langchain_google_genai**
- Run `pip install langchain-google-genai`
- Or reinstall all dependencies: `pip install -r requirements.txt`

## Usage Examples

### SQA Research Pack Generation

```json
Input: {"subject":"Applications of Mathematics", "level":"National 3"}

Agent will:
1. Search for Scottish SoW and lesson resources
2. Extract real exemplars from SQA, Education Scotland, Scottish schools
3. Distill canonical terms, assessment stems, pedagogical patterns
4. Create structured JSON research pack
5. Run critique ensemble (Coverage, Trust, Authenticity, Pedagogy)
6. Iterate up to 3 times until all critics pass thresholds

Output: research_pack_json (complete JSON with all required fields)
```

### Basic Research Query

```
User: "What are the main benefits of renewable energy?"

Agent will:
1. Break down into sub-topics (solar, wind, environmental impact, etc.)
2. Research each topic in parallel
3. Generate structured report with citations
4. Optionally critique and refine
```

### Comparative Analysis

```
User: "Compare React and Vue.js frameworks"

Agent will:
1. Research React features and ecosystem
2. Research Vue.js features and ecosystem
3. Generate comparison report with pros/cons
4. Include sources for all claims
```

### List Generation

```
User: "List top 10 AI companies in 2025"

Agent will:
1. Search for recent information
2. Compile list with details
3. Cite sources for each entry
```

## Advanced Configuration

### Changing Recursion Limit

The agent has a recursion limit of 1000 steps. To modify:

```python
# In src/research_agent.py
agent = create_deep_agent(
    tools=[internet_search],
    instructions=RESEARCH_INSTRUCTIONS,
    subagents=[critique_sub_agent, research_sub_agent],
).with_config({"recursion_limit": 2000})  # Increase limit
```

### Customizing Search Parameters

Modify the `internet_search` function in `src/research_agent.py`:

```python
def internet_search(
    query: str,
    max_results: int = 10,  # Increase results
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = True,  # Include full content
):
    ...
```

### Customizing Prompts

Edit prompts in `src/research_agent_prompts.py` to change agent behavior:
- Modify SQA research requirements in `RESEARCH_INSTRUCTIONS_SQA`
- Add domain expertise in `SUB_RESEARCH_PROMPT`
- Change critique criteria in `SUB_CRITIQUE_PROMPT`

**Note**: The agent currently uses `RESEARCH_INSTRUCTIONS_SQA` for Scottish education context. To switch back to general research, change line 51 in `src/research_agent.py` from `instructions=RESEARCH_INSTRUCTIONS_SQA` to `instructions=RESEARCH_INSTRUCTIONS` (after adding the generic prompt back to research_agent_prompts.py).

## API Endpoints

When the server is running:

- **API Base**: `http://127.0.0.1:2024`
- **OpenAPI Docs**: `http://127.0.0.1:2024/docs`
- **Assistant Info**: `GET /assistants/research`
- **Create Thread**: `POST /threads`
- **Send Message**: `POST /threads/{thread_id}/runs`

## Deployment

For production deployment, use [LangGraph Platform](https://langchain-ai.github.io/langgraph/cloud/) instead of the in-memory development server.

## Contributing

When making changes:
1. Keep prompts in `src/research_agent_prompts.py`
2. Keep agent logic in `src/research_agent.py`
3. Test with `langgraph dev` before committing
4. Ensure imports work with the dual-import pattern
5. Run `./test_clean_install.sh` to validate setup still works

## Quick Reference

### Common Commands

```bash
# Quick start (recommended)
./start.sh

# Initial setup (manual)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start development server (with Gemini support)
langgraph dev --allow-blocking --port 2025

# Start development server (alternative)
./start.sh

# Run installation test
./test_clean_install.sh

# Deactivate virtual environment
deactivate

# Kill process on port 2025
lsof -ti:2025 | xargs kill -9

# Test Gemini import
python -c "from langchain_google_genai import ChatGoogleGenerativeAI; print('✅ OK')"

# View logs
tail -f /tmp/langgraph_test.log
```

### File Checklist

Before starting development, ensure these files exist:
- ✅ `.env` - API keys configured
- ✅ `venv/` - Virtual environment created
- ✅ `src/__init__.py` - Package marker exists
- ✅ `setup.py` - Package configuration
- ✅ `langgraph.json` - Graph configuration

### Import Pattern Reference

**In research_agent.py:**
```python
# Use this pattern for all imports from local modules
try:
    from src.research_agent_prompts import PROMPT_NAME  # Package mode
except ImportError:
    from research_agent_prompts import PROMPT_NAME      # Direct loading mode
```

**Why this works:**
- `pip install -e .` makes `src` a known package → first import succeeds
- LangGraph CLI loads files directly → second import succeeds

### API Key Setup

```bash
# Quick .env setup
cat > .env << EOF
TAVILY_API_KEY=tvly-xxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
EOF
```

### Validation Steps

After any major change:
1. Run `./test_clean_install.sh` to validate setup
2. Check server starts: `langgraph dev`
3. Test API: `curl http://127.0.0.1:2024/ok`
4. Open Studio: Visit the Studio URL in browser

## License

[Add your license here]

## Support

For issues or questions:
- LangGraph Documentation: https://langchain-ai.github.io/langgraph/
- DeepAgents: https://github.com/langchain-ai/deepagents
- Tavily API: https://tavily.com/docs

---

**Last Validated**: Process tested and working on Python 3.13.5 with clean installation.