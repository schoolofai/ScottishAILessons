# Lesson Author Agent - Usage Documentation

**Version:** 1.0
**Status:** Production-ready
**Graph ID:** `lesson_author`

## Overview

The **Lesson Author Agent** is a LangGraph DeepAgent that orchestrates 8 specialized subagents to produce publication-ready **LessonTemplate JSON documents** for Scottish secondary education. It accepts a SoW (Scheme of Work) entry and research pack as input, then authors detailed lesson plans with pedagogical cards, checks for understanding (CFUs), rubrics, and misconception identification—all aligned with Scottish CfE/SQA standards.

### Key Features

- **8 Subagents**: Research (1), Data fetching (1), Authoring (1), Critics (5)
- **LLM-Driven Orchestration**: Gemini 2.5-pro dynamically chooses workflow based on context
- **Multi-Iteration Critique Loop**: Up to 3 rounds of parallel critic review with thresholds
- **Scottish Authenticity**: £ currency, local contexts (ScotRail, NHS), SQA terminology
- **Accessibility**: CEFR plain language levels, dyslexia-friendly design
- **Dual JSON Input**: SoW entry metadata + research pack with exemplars

---

## Architecture

### DeepAgent Pattern

Unlike workflow agents with hard-coded state transitions, this agent uses **LLM-driven orchestration**:

```
__start__ → SummarizationMiddleware → model_request ⇄ tools → __end__
                                            ↑              ↓
                                            └──────────────┘
```

- **model_request**: The LLM decides next action based on prompt instructions
- **tools**: All 8 subagents are available as tools; LLM calls them dynamically
- **SummarizationMiddleware**: Compresses conversation history to maintain context limits

### 8 Subagents

| Subagent | Type | Purpose | Tools |
|----------|------|---------|-------|
| `research_subagent` | Reused | Answer clarification questions with Scottish context | Tavily + Appwrite MCP |
| `course_outcome_subagent` | Reused | Fetch SQA course data from Appwrite → `Course_data.txt` | Appwrite MCP only |
| `lesson_author_subagent` | New | Draft/edit LessonTemplate → `lesson_template.json` | Tavily + Appwrite MCP |
| `pedagogical_design_critic` | Critic | Validate I-We-You progression, scaffolding (≥0.85) | Tavily + Appwrite MCP |
| `assessment_design_critic` | Critic | Review CFU variety, rubrics, misconceptions (≥0.90) | Tavily + Appwrite MCP |
| `accessibility_critic` | Critic | Check plain language, dyslexia-friendly (≥0.90) | Tavily only |
| `scottish_context_critic` | Critic | Verify £, local examples, SQA terms (≥0.90) | Tavily + Appwrite MCP |
| `coherence_critic` | Critic | Ensure SoW alignment, timing, policy (≥0.85) | Appwrite MCP only |

---

## Input Format

### Required: Dual JSON Input

The agent expects **TWO comma-separated JSON objects** in a single message:

1. **SoW Entry** (from `sow_authored_*.json`)
2. **Research Pack** (from `research_pack_json_*.txt`)

#### SoW Entry Structure

```json
{
  "order": 1,
  "lessonTemplateRef": "AUTO_TBD_1",
  "label": "Introduction to Numeracy Skills",
  "lesson_type": "teach",
  "coherence": {
    "unit": "Numeracy (National 3)",
    "block_name": "Core Skills: Notation and Units",
    "block_index": "1.1",
    "prerequisites": []
  },
  "policy": {
    "calculator_section": "non_calc",
    "assessment_notes": "Focus on understanding place value and symbols."
  },
  "engagement_tags": ["foundations", "notation"],
  "outcomeRefs": ["O1"],
  "assessmentStandardRefs": ["AS1.1"],
  "pedagogical_blocks": ["starter", "modelling", "guided_practice", "independent_practice"],
  "accessibility_profile": {
    "dyslexia_friendly": true,
    "plain_language_level": "CEFR_A2",
    "extra_time": true
  },
  "estMinutes": 50,
  "notes": "Introduce core mathematical symbols (+, -, ×, /, ÷, .) and units for money, time, and measurement."
}
```

#### Research Pack Structure

```json
{
  "research_pack_version": 3,
  "subject": "Application of Math",
  "level": "National 3",
  "exemplars_from_sources": [
    {
      "source": "https://www.sqa.org.uk/...",
      "content": "...",
      "summary": "...",
      "lesson_context": "..."
    }
  ],
  "distilled_data": {
    "canonical_terms": [...],
    "assessment_stems": [...],
    "pedagogical_patterns": {
      "misconceptions": [...]
    }
  }
}
```

---

## Usage

### 1. Start the LangGraph Server

```bash
cd langgraph-author-agent
source venv/bin/activate
langgraph dev --port 2024
```

**Verify server is running:**

```bash
curl http://127.0.0.1:2024/ok
# Should return: {"ok":true}
```

### 2. Access the Agent

- **LangGraph Studio**: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
- **API Docs**: http://127.0.0.1:2024/docs
- **Graph ID**: `lesson_author`

### 3. Prepare Input

#### Option A: Extract from Existing Files

```bash
# Extract a single SoW entry (example: entry at index 0)
cd data
python3 << 'EOF'
import json

# Load the full SoW document
with open('sow_authored_AOM_nat3.json', 'r') as f:
    sow_data = json.load(f)

# Extract first entry
sow_entry = sow_data['entries'][0]

# Load research pack
with open('research_pack_json_AOM_nat3.txt', 'r') as f:
    research_pack = json.load(f)

# Combine with comma separator
dual_input = json.dumps(sow_entry) + ",\n" + json.dumps(research_pack)

# Save for easy copy-paste
with open('lesson_author_input_example.txt', 'w') as f:
    f.write(dual_input)

print("✅ Input prepared: lesson_author_input_example.txt")
print(f"SoW entry: {sow_entry['label']}")
print(f"Lesson type: {sow_entry['lesson_type']}")
EOF
```

#### Option B: Manual Construction

Create a file `my_lesson_input.json` with the dual JSON structure shown above.

### 4. Run the Agent

#### Via LangGraph Studio (Recommended)

1. Open https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
2. Select the `lesson_author` graph
3. Paste the dual JSON input (SoW entry + research pack)
4. Click "Submit"
5. Monitor the real-time execution graph as subagents are called

#### Via API

```bash
# Create a thread
THREAD_ID=$(curl -s -X POST http://127.0.0.1:2024/threads \
  -H "Content-Type: application/json" | jq -r '.thread_id')

# Send the dual JSON input
curl -X POST "http://127.0.0.1:2024/threads/$THREAD_ID/runs/stream" \
  -H "Content-Type: application/json" \
  -d '{
    "assistant_id": "lesson_author",
    "input": {
      "messages": [
        {
          "role": "user",
          "content": "< paste dual JSON here >"
        }
      ]
    },
    "stream_mode": "values"
  }'
```

#### Via Python SDK

```python
from langgraph_sdk import get_client
import json

# Connect to local server
client = get_client(url="http://127.0.0.1:2024")

# Load input
with open('data/lesson_author_input_example.txt', 'r') as f:
    dual_json_input = f.read()

# Create thread
thread = client.threads.create()

# Run agent
for chunk in client.runs.stream(
    thread['thread_id'],
    assistant_id="lesson_author",
    input={"messages": [{"role": "user", "content": dual_json_input}]},
    stream_mode="values"
):
    print(chunk)
```

---

## Workflow

### Standard Execution Flow

```
1. Parse Dual JSON Input
   ↓
2. Write to Files
   - sow_entry_input.json
   - research_pack.json
   ↓
3. Fetch Course Data
   - course_outcome_subagent → Course_data.txt
   ↓
4. Draft Lesson Template
   - lesson_author_subagent → lesson_template.json (draft v1)
   ↓
5. Parallel Critic Review (Iteration 1)
   ├─ pedagogical_design_critic → pedagogical_critic_result.json
   ├─ assessment_design_critic → assessment_critic_result.json
   ├─ accessibility_critic → accessibility_critic_result.json
   ├─ scottish_context_critic → scottish_context_critic_result.json
   └─ coherence_critic → coherence_critic_result.json
   ↓
6. Check Thresholds
   ├─ All pass (≥ threshold) → ✅ COMPLETE
   └─ Some fail → Revise lesson_template.json
   ↓
7. Repeat steps 5-6 (max 3 iterations)
   ↓
8. Final Output
   ├─ If all critics pass: lesson_template.json (publishable)
   └─ If some still fail: lesson_template.json (best effort) + lesson_todos.json
```

### Critic Thresholds

- **Pedagogical Design**: ≥0.85 (I-We-You flow, scaffolding, lesson type alignment)
- **Assessment Design**: ≥0.90 (CFU variety, rubric clarity, misconceptions)
- **Accessibility**: ≥0.90 (CEFR level, dyslexia-friendly, explainer_plain)
- **Scottish Context**: ≥0.90 (£ currency, local examples, SQA terms)
- **Coherence**: ≥0.85 (SoW alignment, timing, calculator policy)

---

## Output Files

All outputs are written to `state["files"]` (flat file storage in LangGraph state):

| File | Purpose | Written By |
|------|---------|------------|
| `sow_entry_input.json` | Parsed SoW entry | Main orchestrator |
| `research_pack.json` | Parsed research pack | Main orchestrator |
| `Course_data.txt` | Official SQA course data from Appwrite | `course_outcome_subagent` |
| `lesson_template.json` | **Final LessonTemplate (primary output)** | `lesson_author_subagent` |
| `pedagogical_critic_result.json` | I-We-You progression review | `pedagogical_design_critic` |
| `assessment_critic_result.json` | CFU/rubric quality review | `assessment_design_critic` |
| `accessibility_critic_result.json` | Inclusive design review | `accessibility_critic` |
| `scottish_context_critic_result.json` | Scottish authenticity review | `scottish_context_critic` |
| `coherence_critic_result.json` | SoW alignment review | `coherence_critic` |
| `lesson_todos.json` | Outstanding items if critics fail (optional) | Main orchestrator |

### Accessing Output Files

#### Via LangGraph Studio

1. Click on the final state node in the execution graph
2. Expand `state` → `files`
3. Click on `lesson_template.json` to view the final output

#### Via API

```bash
# Get the final state
curl -s "http://127.0.0.1:2024/threads/$THREAD_ID/state" | \
  jq '.values.files["lesson_template.json"]' > lesson_output.json
```

#### Via Python SDK

```python
# Get thread state
state = client.threads.get_state(thread['thread_id'])

# Extract lesson template
lesson_template = json.loads(state['values']['files']['lesson_template.json'])

# Save to file
with open('outputs/lesson_1.json', 'w') as f:
    json.dump(lesson_template, f, indent=2)

print(f"✅ Lesson template saved: {lesson_template['title']}")
```

---

## LessonTemplate Output Schema

The `lesson_template.json` follows this structure:

```json
{
  "$id": "lt_numeracy_intro_v1",
  "courseId": "course_c84473",
  "title": "Introduction to Numeracy Skills",
  "tags": ["numeracy", "notation"],
  "outcomeRefs": ["O1"],
  "assessmentStandardRefs": ["AS1.1"],
  "lesson_type": "teach",
  "estMinutes": 50,
  "version": 1,
  "status": "draft",
  "engagement_tags": ["foundations", "notation"],
  "policy": {
    "calculator_allowed": false
  },
  "accessibility": {
    "explainer_plain": "Short sentences. One instruction per line."
  },
  "cards": [
    {
      "id": "c1",
      "title": "Starter: Retrieval Practice",
      "explainer": "We use symbols like + for addition...",
      "explainer_plain": "Plus means add. Minus means take away.",
      "cfu": {
        "type": "mcq",
        "id": "q1",
        "stem": "Which symbol means 'multiply'?",
        "options": ["+", "×", "÷", "-"],
        "answerIndex": 1
      },
      "rubric": {
        "total_points": 1,
        "criteria": [
          {"description": "Correct symbol identified", "points": 1}
        ]
      },
      "misconceptions": [
        {
          "id": "MISC_SYMBOL_CONFUSION",
          "misconception": "Students confuse × and +",
          "clarification": "Remind them: × looks like a cross, + is straight lines"
        }
      ],
      "context_hooks": ["Use whiteboard for quick-fire symbol matching"]
    }
  ]
}
```

### Card Types by Lesson Type

| lesson_type | Expected Card Structure |
|-------------|-------------------------|
| `teach` | Starter → Modelling → Guided Practice → Independent Practice |
| `independent_practice` | 3-4 practice cards with progressive difficulty |
| `formative_assessment` | 2-3 assessment cards covering different CFU types |
| `revision` | Starter quiz → Practice problems → Challenge problems |
| `mock_assessment` | Full assessment cards matching unit standards |
| `project` | Multi-card project with scaffolded tasks |
| `spiral_revisit` | Mixed review of prior topics |

### CFU Types

- **numeric**: Requires numerical answer with optional tolerance (e.g., "Find 15% of £80")
- **mcq**: Multiple choice question with options array
- **short**: Short text answer (1-2 words)
- **structured**: Multi-part question with sub-rubrics

---

## Example Workflow

### Complete Example: Authoring Lesson 1

```bash
# 1. Start server
cd langgraph-author-agent
source venv/bin/activate
langgraph dev --port 2024

# 2. Prepare input (in a new terminal)
cd data
python3 << 'EOF'
import json

# Load SoW document
with open('sow_authored_AOM_nat3.json', 'r') as f:
    sow = json.load(f)

# Load research pack
with open('research_pack_json_AOM_nat3.txt', 'r') as f:
    research = json.load(f)

# Extract first entry
entry = sow['entries'][0]

# Create dual input
dual_input = json.dumps(entry) + ",\n" + json.dumps(research)

# Save
with open('../outputs/lesson_1_input.txt', 'w') as f:
    f.write(dual_input)

print("✅ Input ready: outputs/lesson_1_input.txt")
print(f"Lesson: {entry['label']}")
print(f"Type: {entry['lesson_type']}")
print(f"Duration: {entry['estMinutes']} minutes")
print(f"Outcomes: {entry['outcomeRefs']}")
print(f"Standards: {entry['assessmentStandardRefs']}")
EOF

# 3. Run agent via Python
python3 << 'EOF'
from langgraph_sdk import get_client
import json

client = get_client(url="http://127.0.0.1:2024")

# Read input
with open('outputs/lesson_1_input.txt', 'r') as f:
    dual_input = f.read()

# Create thread and run
thread = client.threads.create()
print(f"Thread created: {thread['thread_id']}")

print("\n🚀 Starting lesson authoring...")
for chunk in client.runs.stream(
    thread['thread_id'],
    assistant_id="lesson_author",
    input={"messages": [{"role": "user", "content": dual_input}]},
    stream_mode="values"
):
    if 'messages' in chunk and chunk['messages']:
        last_msg = chunk['messages'][-1]
        if hasattr(last_msg, 'content'):
            print(f"📝 {last_msg.content[:100]}...")

# Get final state
state = client.threads.get_state(thread['thread_id'])

# Extract and save lesson template
if 'lesson_template.json' in state['values'].get('files', {}):
    lesson = json.loads(state['values']['files']['lesson_template.json'])

    with open('outputs/lesson_1_output.json', 'w') as f:
        json.dump(lesson, f, indent=2)

    print(f"\n✅ Lesson template created: {lesson['title']}")
    print(f"Cards: {len(lesson['cards'])}")
    print(f"Status: {lesson['status']}")

    # Check critic results
    for critic in ['pedagogical', 'assessment', 'accessibility', 'scottish_context', 'coherence']:
        critic_file = f"{critic}_critic_result.json"
        if critic_file in state['values']['files']:
            result = json.loads(state['values']['files'][critic_file])
            print(f"  {critic}: {result['score']:.2f} {'✅' if result['passed'] else '❌'}")
else:
    print("❌ No lesson template generated")
    if 'lesson_todos.json' in state['values'].get('files', {}):
        todos = json.loads(state['values']['files']['lesson_todos.json'])
        print(f"Outstanding TODOs: {len(todos)}")
EOF
```

---

## Troubleshooting

### Issue: "SyntaxError: invalid start byte"

**Cause**: Non-UTF-8 characters in prompt files (Windows-1252 encoding)

**Solution**:
```bash
cd src
python3 << 'EOF'
# Convert all prompt files to UTF-8
for file in lesson_author_prompts.py sow_author_prompts.py research_agent_prompts.py:
    with open(file, 'rb') as f:
        content = f.read()
    text = content.decode('windows-1252')
    with open(file, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f"✅ Converted {file} to UTF-8")
EOF
```

### Issue: Agent produces empty lesson_template.json

**Cause**: Missing required fields in SoW entry or research pack

**Checklist**:
- SoW entry has `outcomeRefs` and `assessmentStandardRefs`
- Research pack has `distilled_data.assessment_stems`
- Input is valid JSON (use `jq` to validate)

```bash
# Validate input
cat outputs/lesson_1_input.txt | jq '.' > /dev/null && echo "✅ Valid JSON" || echo "❌ Invalid JSON"
```

### Issue: Critics all fail after 3 iterations

**Cause**: Research pack lacks sufficient exemplars or SoW entry is incomplete

**Solution**: Check `lesson_todos.json` for specific issues:

```python
import json
with open('outputs/lesson_todos.json', 'r') as f:
    todos = json.load(f)
for todo in todos:
    print(f"- {todo['critic']}: {todo['issue']}")
```

### Issue: Appwrite MCP tools not available

**Cause**: Missing `.env` configuration or Appwrite server not running

**Checklist**:
```bash
# Check .env file
grep APPWRITE_API_KEY .env  # Should not be empty
grep APPWRITE_PROJECT_ID .env
grep APPWRITE_DATABASE_ID .env

# Verify MCP initialization
langgraph dev --port 2024 2>&1 | grep "Initialized.*Appwrite MCP tools"
# Should show: "✅ Initialized 55 Appwrite MCP tools"
```

### Issue: Server fails to start on port 2024

**Cause**: Port already in use

**Solution**:
```bash
# Kill existing process
lsof -ti:2024 | xargs kill -9

# Or use a different port
langgraph dev --port 2025
```

---

## Advanced Usage

### Batch Processing Multiple Lessons

```python
from langgraph_sdk import get_client
import json
from pathlib import Path

client = get_client(url="http://127.0.0.1:2024")

# Load SoW and research pack
with open('data/sow_authored_AOM_nat3.json', 'r') as f:
    sow = json.load(f)

with open('data/research_pack_json_AOM_nat3.txt', 'r') as f:
    research = json.load(f)

# Process first 5 lessons
for i, entry in enumerate(sow['entries'][:5]):
    print(f"\n🚀 Processing lesson {i+1}: {entry['label']}")

    # Create dual input
    dual_input = json.dumps(entry) + ",\n" + json.dumps(research)

    # Create thread and run
    thread = client.threads.create()

    # Stream execution
    for chunk in client.runs.stream(
        thread['thread_id'],
        assistant_id="lesson_author",
        input={"messages": [{"role": "user", "content": dual_input}]},
        stream_mode="values"
    ):
        pass  # Silent processing

    # Get final state
    state = client.threads.get_state(thread['thread_id'])

    # Save lesson template
    if 'lesson_template.json' in state['values'].get('files', {}):
        lesson = json.loads(state['values']['files']['lesson_template.json'])

        output_path = f"outputs/lesson_{i+1:03d}_{entry['lesson_type']}.json"
        with open(output_path, 'w') as f:
            json.dump(lesson, f, indent=2)

        print(f"✅ Saved: {output_path}")
        print(f"   Cards: {len(lesson['cards'])}, Type: {lesson['lesson_type']}")
    else:
        print(f"❌ Failed to generate lesson {i+1}")
```

### Custom Critic Thresholds

Modify thresholds in `src/lesson_author_prompts.py`:

```python
# In LESSON_AGENT_PROMPT, change the thresholds:
# From:
#   a) `pedagogical_design_critic` → threshold ≥0.85
# To:
#   a) `pedagogical_design_critic` → threshold ≥0.80

# Restart server for changes to take effect
```

### Debugging Subagent Calls

Enable verbose logging in LangGraph Studio:
1. Settings → Debugging → Enable "Show all intermediate steps"
2. Expand each subagent call to see full input/output
3. Check `todos` field for critic feedback

---

## Performance

### Typical Execution Times

| Lesson Type | Cards | Iterations | Duration |
|-------------|-------|------------|----------|
| `teach` | 4 | 1 | 45-60s |
| `teach` | 4 | 3 (with revisions) | 2-3 min |
| `independent_practice` | 3 | 1 | 30-45s |
| `formative_assessment` | 2 | 2 | 60-90s |
| `revision` | 3 | 1 | 35-50s |

### Token Usage Estimates (Gemini 2.5-pro)

- **Input tokens**: ~8,000-12,000 (dual JSON + prompts)
- **Output tokens**: ~15,000-25,000 (lesson template + 5 critics)
- **Total per lesson**: ~25,000-40,000 tokens

### Optimization Tips

1. **Reduce iterations**: If quality is acceptable at iteration 1, modify prompt to exit early
2. **Smaller research packs**: Trim `exemplars_from_sources` to most relevant entries
3. **Parallel processing**: Run multiple threads concurrently (recommended max: 3)

---

## Integration with SoW Author Agent

The Lesson Author Agent is designed to work **downstream** from the SoW Author Agent:

```
SoW Author Agent → produces → sow_authored_*.json (with many entries)
                        ↓
                   Extract single entry
                        ↓
Lesson Author Agent → consumes → SoW entry + research pack
                        ↓
                   Produces → lesson_template.json
```

### Workflow Integration

1. **SoW Authoring Phase**: Use `sow_author` graph to generate complete SoW
2. **Lesson Authoring Phase**: Extract each `AUTO_TBD_*` entry and process with `lesson_author`
3. **Update SoW**: Replace `lessonTemplateRef` values with actual lesson template IDs

```python
# Example: Update SoW with lesson template IDs
import json

# Load SoW
with open('data/sow_authored_AOM_nat3.json', 'r') as f:
    sow = json.load(f)

# Load generated lesson templates
lesson_ids = {}
for i in range(1, 6):
    with open(f'outputs/lesson_{i:03d}_*.json', 'r') as f:
        lesson = json.load(f)
        lesson_ids[f"AUTO_TBD_{i}"] = lesson['$id']

# Update SoW entries
for entry in sow['entries'][:5]:
    if entry['lessonTemplateRef'] in lesson_ids:
        entry['lessonTemplateRef'] = lesson_ids[entry['lessonTemplateRef']]

# Save updated SoW
with open('data/sow_authored_AOM_nat3_updated.json', 'w') as f:
    json.dump(sow, f, indent=2)

print("✅ SoW updated with lesson template IDs")
```

---

## API Reference

### Graph Endpoints

**Base URL**: `http://127.0.0.1:2024`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ok` | GET | Health check |
| `/info` | GET | Server version and flags |
| `/assistants/lesson_author/graph` | GET | Get graph schema |
| `/threads` | POST | Create new thread |
| `/threads/{thread_id}/runs/stream` | POST | Run agent with streaming |
| `/threads/{thread_id}/state` | GET | Get final state and outputs |

### Input Schema

```json
{
  "assistant_id": "lesson_author",
  "input": {
    "messages": [
      {
        "role": "user",
        "content": "<SoW entry JSON>,\n<research pack JSON>"
      }
    ]
  },
  "stream_mode": "values"
}
```

### State Schema

```json
{
  "values": {
    "messages": [...],
    "files": {
      "lesson_template.json": "...",
      "pedagogical_critic_result.json": "...",
      "assessment_critic_result.json": "...",
      "accessibility_critic_result.json": "...",
      "scottish_context_critic_result.json": "...",
      "coherence_critic_result.json": "..."
    }
  }
}
```

---

## Contributing

### Adding New Subagents

1. Define prompt in `src/lesson_author_prompts.py`
2. Add subagent config in `src/lesson_author_agent.py`:

```python
new_critic = {
    "name": "new_critic_name",
    "description": "Purpose and threshold",
    "prompt": NEW_CRITIC_PROMPT,
    "tools": all_tools  # or specific tool subset
}
```

3. Update main orchestrator prompt to call new subagent
4. Restart server and test

### Modifying Prompts

All prompts are in `src/lesson_author_prompts.py`. After editing:

```bash
# Ensure UTF-8 encoding
iconv -f UTF-8 -t UTF-8 src/lesson_author_prompts.py > /tmp/prompts.tmp
mv /tmp/prompts.tmp src/lesson_author_prompts.py

# Restart server (hot reload enabled)
# Changes should be picked up automatically
```

---

## FAQ

**Q: Can I use a different LLM instead of Gemini?**

A: Yes, edit `src/lesson_author_agent.py`:

```python
# Replace Gemini with OpenAI
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4",
    api_key=os.environ["OPENAI_API_KEY"],
    temperature=0.7
)

agent = async_create_deep_agent(
    model=llm,  # Use new LLM
    ...
)
```

**Q: How do I skip the critique loop?**

A: Modify `LESSON_AGENT_PROMPT` to exit after draft:

```python
# Change step 6 from:
# 6) **Critique loop** (up to 3 iterations, run critics in parallel):
# To:
# 6) **Skip critique** and proceed to output
```

**Q: Can I author lessons for different subjects?**

A: Yes, but you must provide appropriate research packs and SoW entries. The agent is designed for Scottish secondary mathematics but can adapt if given:
- Subject-specific research pack with exemplars
- SoW entries with correct outcomeRefs/assessmentStandardRefs
- Course data from Appwrite for the new subject

**Q: How do I integrate with the Appwrite database?**

A: The agent automatically uses Appwrite MCP tools if configured in `.env`. Ensure:

```bash
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key
APPWRITE_DATABASE_ID=your_database_id
```

---

## License

MIT License - See repository root for details.

---

## Support

- **Issues**: https://github.com/schoolofai/ScottishAILessons/issues
- **Documentation**: This file (`README_LESSON_AUTHOR.md`)
- **Implementation Plan**: `tasks/lesson-author-agent-implementation.md`

---

**Last Updated**: 2025-10-03
**Agent Version**: 1.0
**LangGraph Version**: 1.0.0a4
