# Ollama DeepSeek-R1 Integration Specification

**Status:** Planning
**Created:** 2025-10-07
**Type:** Model Provider Integration
**Priority:** High

---

## Executive Summary

This specification defines the integration of local Ollama models (DeepSeek-R1 32B/70B) into the Lesson Author Agent, enabling runtime model selection between cloud-based Gemini and local Ollama models for A/B testing and cost optimization.

**Goal:** Enable seamless switching between Gemini Flash-Lite, DeepSeek-R1-32B, and DeepSeek-R1-70B models via environment variables and seeding script parameters.

---

## Problem Statement

### Current State
The Lesson Author Agent is **hardcoded** to use Google Gemini Flash-Lite:

```python
# langgraph-author-agent/src/lesson_author_agent.py (line 58-64)
gemini = ChatGoogleGenerativeAI(
    model="models/gemini-flash-lite-latest",
    api_key=os.environ["GOOGLE_API_KEY"],
    temperature=0.7,
)
```

**Limitations:**
- ❌ No ability to switch models without code changes
- ❌ Cannot test local Ollama models for cost optimization
- ❌ No A/B testing capability for model comparison
- ❌ API costs for every lesson generation

### Desired State
- ✅ Runtime model selection via environment variables
- ✅ Support for 3 models: Gemini Flash-Lite, DeepSeek-R1 32B, DeepSeek-R1 70B
- ✅ CLI parameter in seeding script to override model
- ✅ Track which model generated each lesson template
- ✅ Zero code changes needed to switch models

---

## Architecture Overview

### Model Selection Flow

```
CLI: npm run seed:authored-lesson <courseId> <order> <pack> [modelVersion]
  │
  ├─> modelVersion passed to LangGraph agent
  │
  └─> Environment Variable: MODEL_VERSION
        │
        ├─> "gemini-flash-lite" (default)
        ├─> "deepseek-r1-32b"
        └─> "deepseek-r1-70b"
              │
              └─> model_factory.py: init_chat_model()
                    │
                    ├─> Gemini: ChatGoogleGenerativeAI
                    ├─> Ollama 32B: init_chat_model("deepseek-r1:32b", "ollama")
                    └─> Ollama 70B: init_chat_model("deepseek-r1:70b", "ollama")
                          │
                          └─> LangGraph DeepAgent uses selected model
```

### Data Flow

```
1. Seeding Script (seedAuthoredLesson.ts)
   └─> Reads CLI parameter: modelVersion (optional 4th arg)
   └─> Sets environment: LESSON_MODEL_VERSION
   └─> Calls LangGraph agent

2. LangGraph Agent (lesson_author_agent.py)
   └─> Reads: os.environ.get("LESSON_MODEL_VERSION", "gemini-flash-lite")
   └─> Calls: model_factory.get_model(model_version)
   └─> Returns: LangChain ChatModel instance
   └─> Creates: DeepAgent with selected model

3. Model Factory (model_factory.py)
   └─> Pattern match on model_version
   └─> Instantiate appropriate provider
   └─> Return unified ChatModel interface

4. Lesson Template Storage
   └─> lesson_templates.model_version = "deepseek-r1-32b"
   └─> Tracks which model generated the lesson
```

---

## Implementation Design

### Component 1: Model Factory

**File:** `langgraph-author-agent/src/model_factory.py` (NEW)

**Purpose:** Centralized model instantiation using LangChain's `init_chat_model` pattern recommended by DeepAgents.

**Design Pattern:** Factory pattern with provider abstraction

```python
"""Model factory for Lesson Author Agent - supports Gemini and Ollama models."""
import os
from typing import Literal
from langchain.chat_models import init_chat_model
from langchain_google_genai import ChatGoogleGenerativeAI

# Type alias for supported models
ModelVersion = Literal[
    "gemini-flash-lite",
    "deepseek-r1-32b",
    "deepseek-r1-70b"
]

# Model configuration mapping
MODEL_CONFIGS = {
    "gemini-flash-lite": {
        "provider": "google_genai",
        "model_name": "models/gemini-flash-lite-latest",
        "requires_api_key": "GOOGLE_API_KEY"
    },
    "deepseek-r1-32b": {
        "provider": "ollama",
        "model_name": "deepseek-r1:32b",
        "requires_api_key": None,
        "base_url": "http://localhost:11434"
    },
    "deepseek-r1-70b": {
        "provider": "ollama",
        "model_name": "deepseek-r1:70b",
        "requires_api_key": None,
        "base_url": "http://localhost:11434"
    }
}

def get_model(
    model_version: ModelVersion = "gemini-flash-lite",
    temperature: float = 0.7,
    verbose: bool = True
):
    """
    Get a LangChain ChatModel instance based on model version.

    Uses LangChain's init_chat_model for unified interface (DeepAgents pattern).

    Args:
        model_version: Model identifier (gemini-flash-lite, deepseek-r1-32b, deepseek-r1-70b)
        temperature: Sampling temperature (0.0-1.0)
        verbose: Enable verbose logging

    Returns:
        BaseChatModel: LangChain chat model instance

    Raises:
        ValueError: If model_version is not supported
        EnvironmentError: If required API key is missing

    Example:
        >>> model = get_model("deepseek-r1-32b", temperature=0.7)
        >>> # Use with DeepAgent
        >>> agent = create_deep_agent(model=model, ...)
    """
    if model_version not in MODEL_CONFIGS:
        raise ValueError(
            f"Unsupported model: {model_version}. "
            f"Supported: {list(MODEL_CONFIGS.keys())}"
        )

    config = MODEL_CONFIGS[model_version]

    # Check for required API key
    if config["requires_api_key"]:
        api_key = os.environ.get(config["requires_api_key"])
        if not api_key:
            raise EnvironmentError(
                f"Missing required API key: {config['requires_api_key']} "
                f"for model {model_version}"
            )

    if verbose:
        print(f"🤖 Initializing model: {model_version}")
        print(f"   Provider: {config['provider']}")
        print(f"   Model: {config['model_name']}")
        print(f"   Temperature: {temperature}")

    # Use DeepAgents recommended pattern: init_chat_model
    if config["provider"] == "ollama":
        # Ollama-specific initialization
        base_url = os.environ.get("OLLAMA_BASE_URL", config.get("base_url", "http://localhost:11434"))

        model = init_chat_model(
            model=config["model_name"],
            model_provider="ollama",
            temperature=temperature,
            base_url=base_url
        )

        if verbose:
            print(f"   Ollama URL: {base_url}")

    elif config["provider"] == "google_genai":
        # Gemini-specific initialization (existing pattern)
        model = ChatGoogleGenerativeAI(
            model=config["model_name"],
            api_key=os.environ[config["requires_api_key"]],
            temperature=temperature
        )

    else:
        raise ValueError(f"Unsupported provider: {config['provider']}")

    if verbose:
        print(f"✅ Model initialized successfully")

    return model


def get_model_display_name(model_version: ModelVersion) -> str:
    """
    Get human-readable model name for logging.

    Args:
        model_version: Model identifier

    Returns:
        str: Display-friendly model name

    Example:
        >>> get_model_display_name("deepseek-r1-32b")
        "DeepSeek-R1 32B (Ollama)"
    """
    display_names = {
        "gemini-flash-lite": "Google Gemini Flash-Lite",
        "deepseek-r1-32b": "DeepSeek-R1 32B (Ollama)",
        "deepseek-r1-70b": "DeepSeek-R1 70B (Ollama)"
    }
    return display_names.get(model_version, model_version)
```

`★ Insight ─────────────────────────────────────`
**DeepAgents Pattern:** The `init_chat_model` function from LangChain provides a unified interface across all providers (Ollama, OpenAI, Anthropic, Google). This is the recommended pattern from DeepAgents documentation because it ensures all models expose the same ChatModel interface, making them interchangeable without changing agent code.
`─────────────────────────────────────────────────`

---

### Component 2: Agent Configuration Update

**File:** `langgraph-author-agent/src/lesson_author_agent.py` (MODIFIED)

**Changes Required:**

#### Change 1: Replace Hardcoded Model Instantiation

**Location:** Lines 58-64

**OLD:**
```python
# Initialize Gemini model
# Flash-lite for main agent and all subagents (fast, cost-effective)
gemini = ChatGoogleGenerativeAI(
    model="models/gemini-flash-lite-latest",
    api_key=os.environ["GOOGLE_API_KEY"],
    temperature=0.7,
)
```

**NEW:**
```python
# Import model factory
try:
    from src.model_factory import get_model, get_model_display_name
except ImportError:
    from model_factory import get_model, get_model_display_name

# Initialize model based on environment variable (runtime selection)
# Supports: gemini-flash-lite (default), deepseek-r1-32b, deepseek-r1-70b
model_version = os.environ.get("LESSON_MODEL_VERSION", "gemini-flash-lite")
model = get_model(model_version=model_version, temperature=0.7, verbose=True)

print(f"🚀 Lesson Author Agent using: {get_model_display_name(model_version)}")
```

#### Change 2: Update DeepAgent Creation

**Location:** Line 135

**OLD:**
```python
agent = async_create_deep_agent(
    model=gemini,  # ← Hardcoded Gemini reference
    tools=all_tools,
    instructions=LESSON_AGENT_PROMPT,
    ...
)
```

**NEW:**
```python
agent = async_create_deep_agent(
    model=model,  # ← Uses factory-created model (supports all providers)
    tools=all_tools,
    instructions=LESSON_AGENT_PROMPT,
    subagents=[
        research_subagent,
        lesson_author_subagent,
        pedagogical_design_critic,
        assessment_design_critic,
        accessibility_critic,
        scottish_context_critic,
        coherence_critic
    ],
    context_schema=LessonAuthorState,
).with_config({"recursion_limit": 1000})
```

**Note:** All subagents automatically inherit the model from the main agent - no changes needed to subagent definitions.

---

### Component 3: Environment Configuration

**File:** `langgraph-author-agent/.env.example` (MODIFIED)

**Add New Variables:**

```bash
# API Keys Configuration
# Copy this file to .env and fill in your actual API keys

# Tavily API Key for web search
# Get your key at: https://tavily.com/
TAVILY_API_KEY=your_tavily_api_key_here

# Google Gemini API Key (for Gemini Flash-Lite model)
# Get your key at: https://aistudio.google.com/apikey
GOOGLE_API_KEY=your_google_api_key_here

# Anthropic API Key for Claude LLM (legacy - not currently used)
# Get your key at: https://console.anthropic.com/
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: LangSmith for tracing (helpful for debugging)
# Get your key at: https://smith.langchain.com/
# LANGSMITH_API_KEY=your_langsmith_api_key_here
# LANGSMITH_TRACING=true
# LANGSMITH_PROJECT=langgraph-author-agent

# Appwrite MCP Integration (required for SoW Author Agent)
# Required for accessing curriculum database with SQA education data
# Get credentials from: https://cloud.appwrite.io/console
APPWRITE_PROJECT_ID=your_project_id_here
APPWRITE_API_KEY=your_api_key_here
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1

# Available Appwrite databases:
# - sqa_education: Production SQA curriculum data and course structures
# - sqa_education_test: Testing/staging curriculum data
# - default: Scottish AI Lessons general data

# ============================================================================
# MODEL SELECTION CONFIGURATION (NEW)
# ============================================================================

# Model Version Selection
# Controls which AI model is used for lesson authoring
# Options:
#   - gemini-flash-lite (default): Google Gemini Flash-Lite (cloud, API costs)
#   - deepseek-r1-32b: DeepSeek-R1 32B via Ollama (local, no API costs, best math)
#   - deepseek-r1-70b: DeepSeek-R1 70B via Ollama (local, no API costs, most powerful)
LESSON_MODEL_VERSION=gemini-flash-lite

# Ollama Base URL (for local model inference)
# Default: http://localhost:11434
# Only used when LESSON_MODEL_VERSION is deepseek-r1-32b or deepseek-r1-70b
OLLAMA_BASE_URL=http://localhost:11434

# Model Comparison Notes:
# - Gemini Flash-Lite: Fast, low cost ($0.075/1M tokens), good general quality
# - DeepSeek-R1 32B: Free (local), best math reasoning (AIME: 72.6%), ~18 GB VRAM
# - DeepSeek-R1 70B: Free (local), most powerful (MATH-500: 94.5%), ~40 GB VRAM
```

---

### Component 4: Seeding Script Integration

**File:** `assistant-ui-frontend/scripts/seedAuthoredLesson.ts` (MODIFIED)

#### Change 1: Accept Optional Model Version Parameter

**Location:** Line 76-90 (argument parsing)

**OLD:**
```typescript
const [courseId, orderStr, resourcePackPath] = process.argv.slice(2);

if (!courseId || !orderStr || !resourcePackPath) {
  console.error('Usage: npm run seed:authored-lesson <courseId> <order> <resourcePackPath>');
  console.error('Example: npm run seed:authored-lesson "course_c84774" 0 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"');
  process.exit(1);
}
```

**NEW:**
```typescript
const [courseId, orderStr, resourcePackPath, modelVersion] = process.argv.slice(2);

if (!courseId || !orderStr || !resourcePackPath) {
  console.error('Usage: npm run seed:authored-lesson <courseId> <order> <resourcePackPath> [modelVersion]');
  console.error('');
  console.error('Parameters:');
  console.error('  courseId         - Course identifier (e.g., "course_c84774")');
  console.error('  order            - SOW entry order number (0-based)');
  console.error('  resourcePackPath - Path to research pack JSON file');
  console.error('  modelVersion     - Optional: AI model to use (default: gemini-flash-lite)');
  console.error('');
  console.error('Model Options:');
  console.error('  gemini-flash-lite  - Google Gemini Flash-Lite (cloud, default)');
  console.error('  deepseek-r1-32b    - DeepSeek-R1 32B via Ollama (local, best math)');
  console.error('  deepseek-r1-70b    - DeepSeek-R1 70B via Ollama (local, most powerful)');
  console.error('');
  console.error('Examples:');
  console.error('  npm run seed:authored-lesson "course_c84774" 0 "../data/pack.txt"');
  console.error('  npm run seed:authored-lesson "course_c84774" 0 "../data/pack.txt" "deepseek-r1-32b"');
  console.error('  npm run seed:authored-lesson "course_c84774" 0 "../data/pack.txt" "deepseek-r1-70b"');
  process.exit(1);
}

// Use provided model or default to gemini-flash-lite
const selectedModel = modelVersion || process.env.LESSON_MODEL_VERSION || 'gemini-flash-lite';

console.log('🚀 Starting Lesson Authoring Pipeline');
console.log('=====================================');
console.log(`Course ID: ${courseId}`);
console.log(`Order: ${order}`);
console.log(`Resource Pack: ${resourcePackPath}`);
console.log(`Model: ${selectedModel}`);
console.log('');
```

#### Change 2: Pass Model Version to LangGraph Agent

**Location:** Line 161-177 (before calling agent)

**NEW (Add before runLessonAuthorAgent):**
```typescript
// Set environment variable for model selection
// LangGraph agent reads LESSON_MODEL_VERSION to select model via model_factory
const originalModelEnv = process.env.LESSON_MODEL_VERSION;
process.env.LESSON_MODEL_VERSION = selectedModel;

console.log('🔧 Model Configuration:');
console.log(`   Selected: ${selectedModel}`);
console.log(`   Environment: LESSON_MODEL_VERSION=${process.env.LESSON_MODEL_VERSION}`);
console.log('');

try {
  const lessonTemplate = await runLessonAuthorAgent(quadrupleInput, LANGGRAPH_URL, logFile);
  // ... rest of processing ...
} finally {
  // Restore original environment
  if (originalModelEnv !== undefined) {
    process.env.LESSON_MODEL_VERSION = originalModelEnv;
  } else {
    delete process.env.LESSON_MODEL_VERSION;
  }
}
```

#### Change 3: Update Lesson Template Upsert to Track Model

**Location:** Line 580-593 (docData object in upsertLessonTemplate)

**Modify to add model_version field:**

```typescript
const docData = {
  courseId,
  sow_order: sowOrder,

  // NEW: Track which model generated this lesson (for A/B testing)
  model_version: process.env.LESSON_MODEL_VERSION || 'gemini-flash-lite',

  // Existing fields
  title: template.title,
  createdBy: 'lesson_author_agent',
  version: 1,
  status: 'draft',
  lesson_type: template.lesson_type || 'teach',
  estMinutes: template.estMinutes || 50,
  outcomeRefs: JSON.stringify(template.outcomeRefs || []),
  engagement_tags: JSON.stringify(template.engagement_tags || []),
  policy: JSON.stringify(template.policy || {}),
  cards: compressedCards
};
```

**Note:** This requires the `model_version` field to already exist in the `lesson_templates` schema (covered in the separate schema migration spec: `tasks/lesson-template-model-versioning-spec.md`).

---

## Dependencies

### Python Packages (langgraph-author-agent)

**File:** `langgraph-author-agent/requirements.txt` (ADD)

```txt
# Existing dependencies
langgraph
langchain-google-genai
tavily-python
deepagents

# NEW: Required for Ollama support via init_chat_model
langchain-ollama>=0.2.0
```

**Installation:**
```bash
cd langgraph-author-agent
source venv/bin/activate
pip install langchain-ollama
```

### System Requirements

1. **Ollama Installation:**
   ```bash
   # Already installed - verify version
   ollama --version  # Should be v0.11.10+ (v0.12.3 recommended)
   ```

2. **DeepSeek-R1 Models:**
   ```bash
   # Already downloaded
   ollama list | grep deepseek-r1
   # Should show: deepseek-r1:32b, deepseek-r1:70b
   ```

3. **Ollama Server Running:**
   ```bash
   # Ensure Ollama is running (starts automatically on macOS)
   curl http://localhost:11434/api/tags
   # Should return JSON list of models
   ```

---

## Testing Strategy

### Test Case 1: Default Model (Gemini)

**Objective:** Verify backward compatibility - existing usage should work unchanged

```bash
cd assistant-ui-frontend

# Test with no model parameter (should use Gemini)
npm run seed:authored-lesson "course_c84774" 0 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"

# Expected:
# - Uses Gemini Flash-Lite (default)
# - Lesson generated successfully
# - lesson_templates.model_version = "gemini-flash-lite"
```

### Test Case 2: DeepSeek-R1 32B

**Objective:** Verify Ollama 32B model integration

```bash
# Test with explicit 32B model
npm run seed:authored-lesson "course_c84774" 1 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt" "deepseek-r1-32b"

# Expected:
# - Uses DeepSeek-R1 32B via Ollama
# - Lesson generated successfully
# - lesson_templates.model_version = "deepseek-r1-32b"
# - Log shows: "🤖 Initializing model: deepseek-r1-32b"
```

### Test Case 3: DeepSeek-R1 70B

**Objective:** Verify Ollama 70B model integration

```bash
# Test with explicit 70B model
npm run seed:authored-lesson "course_c84774" 2 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt" "deepseek-r1-70b"

# Expected:
# - Uses DeepSeek-R1 70B via Ollama
# - Lesson generated successfully
# - lesson_templates.model_version = "deepseek-r1-70b"
# - Log shows: "🤖 Initializing model: deepseek-r1-70b"
```

### Test Case 4: Environment Variable Override

**Objective:** Verify environment variable takes precedence

```bash
# Set default model to DeepSeek via environment
export LESSON_MODEL_VERSION="deepseek-r1-32b"

# Run without CLI parameter
npm run seed:authored-lesson "course_c84774" 3 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"

# Expected:
# - Uses DeepSeek-R1 32B (from environment)
# - CLI parameter not required when env var is set

# Cleanup
unset LESSON_MODEL_VERSION
```

### Test Case 5: Error Handling

**Objective:** Verify graceful error messages

```bash
# Test with invalid model name
npm run seed:authored-lesson "course_c84774" 4 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt" "invalid-model"

# Expected:
# - Clear error message: "Unsupported model: invalid-model"
# - Lists supported models
# - Script exits with error code 1

# Test with Ollama not running
brew services stop ollama

npm run seed:authored-lesson "course_c84774" 5 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt" "deepseek-r1-32b"

# Expected:
# - Clear error message about Ollama connection failure
# - Suggests starting Ollama: "Run: brew services start ollama"

# Cleanup
brew services start ollama
```

---

## Performance Comparison

### Expected Performance Characteristics

| Metric | Gemini Flash-Lite | DeepSeek-R1 32B | DeepSeek-R1 70B |
|--------|-------------------|-----------------|-----------------|
| **Cost per Lesson** | ~$0.05-0.10 | $0 (local) | $0 (local) |
| **Latency** | 10-20s | 30-45s | 60-90s |
| **Math Quality (AIME)** | ~60% | **72.6%** | 70.0% |
| **General Quality (MATH-500)** | ~88% | 94.3% | **94.5%** |
| **VRAM Required** | 0 GB (cloud) | 18 GB | 40 GB |
| **Recommended For** | Fast iteration | Math-heavy lessons | Maximum quality |

`★ Insight ─────────────────────────────────────`
**Model Selection Strategy:** Use Gemini for rapid prototyping (fastest), DeepSeek-R1 32B for math-heavy lessons (best math reasoning + reasonable speed), and DeepSeek-R1 70B for final production lessons (highest overall quality). The 32B model is the sweet spot for most use cases - better math than 70B, 2x faster, uses half the VRAM.
`─────────────────────────────────────────────────`

---

## Implementation Checklist

### Phase 1: Core Integration

- [ ] **Create model_factory.py** with init_chat_model pattern
  - [ ] Implement get_model() function
  - [ ] Add model configuration mapping
  - [ ] Add error handling for missing dependencies
  - [ ] Add verbose logging

- [ ] **Update lesson_author_agent.py**
  - [ ] Import model_factory
  - [ ] Replace hardcoded gemini with get_model() call
  - [ ] Add environment variable reading
  - [ ] Test with all 3 models

- [ ] **Update .env.example**
  - [ ] Document LESSON_MODEL_VERSION variable
  - [ ] Document OLLAMA_BASE_URL variable
  - [ ] Add model comparison notes

- [ ] **Update requirements.txt**
  - [ ] Add langchain-ollama dependency
  - [ ] Test pip install

### Phase 2: Seeding Script Integration

- [ ] **Update seedAuthoredLesson.ts**
  - [ ] Accept optional modelVersion parameter
  - [ ] Pass to LangGraph via environment variable
  - [ ] Update usage documentation
  - [ ] Add model logging

- [ ] **Schema Migration** (separate spec)
  - [ ] Add model_version field to lesson_templates
  - [ ] Backfill existing lessons with "gemini-flash-lite"
  - [ ] Create index on model_version

### Phase 3: Testing

- [ ] **Test Case 1:** Default Gemini (backward compatibility)
- [ ] **Test Case 2:** DeepSeek-R1 32B
- [ ] **Test Case 3:** DeepSeek-R1 70B
- [ ] **Test Case 4:** Environment variable override
- [ ] **Test Case 5:** Error handling

### Phase 4: Documentation

- [ ] **Update langgraph-author-agent/README.md**
  - [ ] Document model selection
  - [ ] Add Ollama setup instructions
  - [ ] Add performance comparison table

- [ ] **Update assistant-ui-frontend/scripts README**
  - [ ] Document new CLI parameter
  - [ ] Add usage examples

---

## Migration Path

### For Existing Deployments

1. **Install Dependencies:**
   ```bash
   cd langgraph-author-agent
   pip install langchain-ollama
   ```

2. **Verify Ollama:**
   ```bash
   ollama list | grep deepseek-r1
   # Should show: deepseek-r1:32b, deepseek-r1:70b
   ```

3. **Deploy Code Changes:**
   - Add `model_factory.py`
   - Update `lesson_author_agent.py`
   - Update `seedAuthoredLesson.ts`
   - Update `.env.example`

4. **Test with Gemini (no behavior change):**
   ```bash
   npm run seed:authored-lesson "course_c84774" 0 "../data/pack.txt"
   ```

5. **Test with Ollama:**
   ```bash
   npm run seed:authored-lesson "course_c84774" 1 "../data/pack.txt" "deepseek-r1-32b"
   ```

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Ollama not running** | Seeding script fails | Add health check curl before invoking; clear error message with fix instructions |
| **Missing langchain-ollama** | Import error | Add to requirements.txt; check in CI/CD; graceful error message |
| **Model not downloaded** | Ollama 404 error | Check `ollama list` before invoking; suggest `ollama pull` in error |
| **VRAM insufficient** | OOM crash | Document VRAM requirements; add memory check; suggest smaller model |
| **Breaking change for users** | Existing scripts fail | Default to Gemini (backward compatible); no changes needed for current usage |

---

## Success Metrics

### Technical Validation

- [ ] All 3 models generate valid LessonTemplate JSON
- [ ] Model selection via CLI parameter works
- [ ] Model selection via environment variable works
- [ ] Error messages are clear and actionable
- [ ] Backward compatibility maintained (existing scripts work unchanged)

### Performance Validation

- [ ] DeepSeek-R1 32B completes lesson in <60s
- [ ] DeepSeek-R1 70B completes lesson in <120s
- [ ] Ollama models produce valid Scottish curriculum content
- [ ] No regression in lesson quality (manual review)

### Business Validation

- [ ] Zero API costs when using Ollama models
- [ ] Can generate 100 lessons for $0 (vs ~$5-10 with Gemini)
- [ ] A/B testing reveals best model for production

---

## Future Enhancements

### Post-MVP Improvements

1. **Model Auto-Selection:**
   ```python
   # Automatically select model based on lesson type
   if lesson_type == "teach" and has_geometry:
       model = "deepseek-r1-70b"  # Best for complex visuals
   elif lesson_type == "independent_practice":
       model = "deepseek-r1-32b"  # Best math reasoning
   else:
       model = "gemini-flash-lite"  # Fast iteration
   ```

2. **Multi-Model Ensemble:**
   - Generate lesson with 2 models
   - Use LLM-as-judge to select best cards
   - Hybrid approach for optimal quality

3. **Cost Tracking:**
   - Add telemetry for API costs
   - Dashboard showing: Gemini ($X) vs Ollama ($0)
   - ROI calculation for model selection

4. **Quality Metrics:**
   - Automated rubric scoring
   - Student performance correlation
   - Model performance leaderboard

---

## References

- **LangChain init_chat_model:** https://python.langchain.com/api_reference/langchain/chat_models/langchain.chat_models.base.init_chat_model.html
- **DeepAgents Documentation:** https://github.com/langchain-ai/deep-agents
- **Ollama Python SDK:** https://github.com/ollama/ollama-python
- **DeepSeek-R1 Benchmarks:** https://github.com/deepseek-ai/DeepSeek-R1
- **Related Spec:** `tasks/lesson-template-model-versioning-spec.md`

---

**Specification Version:** 1.0
**Last Updated:** 2025-10-07
**Reviewed By:** [Pending]
**Approved By:** [Pending]
