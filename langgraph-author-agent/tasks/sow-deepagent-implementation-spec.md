# SoW DeepAgent Implementation Plan

## Overview
Transform `sow_author_agent.py` from a simple research example into a specialized **Scheme of Work (SoW) Author DeepAgent** that orchestrates 8 subagents to produce schema-compliant SoW JSON documents for Scottish secondary education.

---

## 1. **File Structure Changes**

### 1.1 Update `src/sow_author_agent.py`
- **Replace entire file** with SoW-specific implementation
- Keep the existing `internet_search` tool and `tavily_client` initialization (lines 1-25)
- Add Gemini 2.5 Pro model initialization (matching `research_agent_sqa.py` pattern)

---

## 2. **Import Management**

### 2.1 Add New Imports
```python
from langchain_google_genai import ChatGoogleGenerativeAI

# Dual-import pattern for prompts
try:
    from src.sow_author_prompts import (
        SOW_AGENT_PROMPT,
        SOW_AUTHOR_SUBAGENT_PROMPT,
        SOW_COVERAGE_CRITIC_PROMPT,
        SOW_SEQUENCING_CRITIC_PROMPT,
        SOW_POLICY_CRITIC_PROMPT,
        SOW_ACCESSIBILITY_CRITIC_PROMPT,
        SOW_AUTHENTICITY_CRITIC_PROMPT
    )
    from src.research_agent_prompts import SUB_RESEARCH_PROMPT
    from src.shared_prompts import COURSE_OUTCOME_SUBAGENT_PROMPT
except ImportError:
    from sow_author_prompts import (...)
    from research_agent_prompts import SUB_RESEARCH_PROMPT
    from shared_prompts import COURSE_OUTCOME_SUBAGENT_PROMPT
```

### 2.2 Keep Existing Imports
- `os`, `typing.Literal`
- `TavilyClient`, `create_deep_agent`

---

## 3. **Model Initialization**

### 3.1 Initialize Gemini Model
```python
gemini = ChatGoogleGenerativeAI(
    model="gemini-2.5-pro",
    api_key=os.environ["GOOGLE_API_KEY"],
    temperature=0.7,
)
```

---

## 4. **Subagent Configuration**

### 4.1 Research Subagent (with internet access)
```python
research_subagent = {
    "name": "research_subagent",
    "description": "Answer clarification questions with Scotland-specific information (policy notes, sequencing hints, example contexts). No file writes unless explicitly asked.",
    "prompt": SUB_RESEARCH_PROMPT,  # Reuse from research_agent_prompts.py
    "tools": [internet_search]
}
```

### 4.2 Course Outcome Subagent (no tools)
```python
course_outcome_subagent = {
    "name": "course_outcome_subagent",
    "description": "Propose consistent unit/block labels and simple indices for entries[].coherence (e.g., unit 'Number & Proportion', block_name 'Percents', block_index '2.1'). Do not fabricate formal SQA codes.",
    "prompt": COURSE_OUTCOME_SUBAGENT_PROMPT,  # From shared_prompts.py
    "tools": []
}
```

### 4.3 SoW Author Subagent (no tools)
```python
sow_author_subagent = {
    "name": "sow_author_subagent",
    "description": "Draft/edit the SoW according to the schema defined in <schema_sow_with_field_descriptions> and write it to authored_sow_json.",
    "prompt": SOW_AUTHOR_SUBAGENT_PROMPT,  # From sow_author_prompts.py
    "tools": []
}
```

### 4.4 Coverage Critic Subagent (with internet access)
```python
sow_coverage_critic = {
    "name": "sow_coverage_critic",
    "description": "Evaluates completeness and representativeness of SoW. Checks exemplars breadth, balance, metadata sufficiency (≥0.90 threshold).",
    "prompt": SOW_COVERAGE_CRITIC_PROMPT,
    "tools": [internet_search]
}
```

### 4.5 Sequencing Critic Subagent (with internet access)
```python
sow_sequencing_critic = {
    "name": "sow_sequencing_critic",
    "description": "Validates logical ordering of SoW entries. Ensures prerequisites first, realistic lesson_type cadence (≥0.80 threshold).",
    "prompt": SOW_SEQUENCING_CRITIC_PROMPT,
    "tools": [internet_search]
}
```

### 4.6 Policy Consistency Critic Subagent (with internet access)
```python
sow_policy_consistency = {
    "name": "sow_policy_consistency",
    "description": "Checks calculator usage staging, assessment cadence, and timing consistency with research policy notes (≥0.80 threshold).",
    "prompt": SOW_POLICY_CRITIC_PROMPT,
    "tools": [internet_search]
}
```

### 4.7 Accessibility & Engagement Critic Subagent (with internet access)
```python
sow_accessibility_engage = {
    "name": "sow_accessibility_engage",
    "description": "Reviews plain-language guidance, dyslexia-friendly cues, and authentic engagement/context tags (≥0.90 threshold).",
    "prompt": SOW_ACCESSIBILITY_CRITIC_PROMPT,
    "tools": [internet_search]
}
```

### 4.8 Scotland Authenticity Critic Subagent (with internet access)
```python
sow_authenticity_scotland = {
    "name": "sow_authenticity_scotland",
    "description": "Verifies Scottish authenticity (currency in £, local services, SQA/CfE phrasing, place-based examples).",
    "prompt": SOW_AUTHENTICITY_CRITIC_PROMPT,  # From sow_author_prompts.py
    "tools": [internet_search]
}
```

---

## 5. **Main Agent Creation**

### 5.1 Create DeepAgent with All 8 Subagents
```python
agent = create_deep_agent(
    model=gemini,
    tools=[internet_search],
    instructions=SOW_AGENT_PROMPT,
    subagents=[
        research_subagent,
        course_outcome_subagent,
        sow_author_subagent,
        sow_coverage_critic,
        sow_sequencing_critic,
        sow_policy_consistency,
        sow_accessibility_engage,
        sow_authenticity_scotland
    ],
).with_config({"recursion_limit": 1000})
```

---

## 6. **Additional File Changes**

### 6.1 New File: `shared_prompts.py`
✅ **COMPLETED** - Created `src/shared_prompts.py` containing:
- `COURSE_OUTCOME_SUBAGENT_PROMPT` - Structured prompt for unit/block coherence proposals (2,434 chars)

### 6.2 Add Authenticity Critic Prompt to `sow_author_prompts.py`
✅ **COMPLETED** - Added `SOW_AUTHENTICITY_CRITIC_PROMPT` (934 chars) to `src/sow_author_prompts.py`
- Ensures Scottish authenticity: £ currency, CfE/SQA terminology, local contexts
- All 7 SoW prompts now complete and importable

---

## 7. **Expected Output Files**

When the agent runs, it will produce these files in the DeepAgent filesystem:
- `authored_sow_json` - Final SoW document (schema-compliant JSON as defined in `<schema_sow_with_field_descriptions>`)
- `sow_coverage_critic_result_json` - Coverage evaluation
- `sow_sequencing_critic_result_json` - Sequencing evaluation
- `sow_policy_critic_result_json` - Policy consistency evaluation
- `sow_accessibility_critic_result_json` - Accessibility evaluation
- `sow_authenticity_critic_result_json` - Scottish authenticity evaluation
- `sow_todos_json` (optional) - Outstanding tasks if critics fail

---

## 8. **Testing Strategy**

### 8.1 Import Validation
```bash
python -c "from src.sow_author_agent import agent; print('✅ Agent imported')"
```

### 8.2 Agent Invocation Test
```bash
# In LangGraph Studio or via langgraph dev
# Provide input: {"subject": "Mathematics", "level": "National 5"}
# Verify all output files are created
```

---

## Summary of Changes

| Component | Action | Details | Status |
|-----------|--------|---------|--------|
| Imports | Add | Gemini model, 7 SoW prompts, SUB_RESEARCH_PROMPT, COURSE_OUTCOME_SUBAGENT_PROMPT | ✅ Complete |
| Model | Add | Gemini 2.5 Pro initialization (temperature=0.7) | ✅ Complete |
| Subagents | Replace All | 8 specialized subagents (1 research, 1 outcome, 1 author, 5 critics) | ✅ Complete |
| Main Agent | Replace | Use SOW_AGENT_PROMPT with full subagent ensemble, recursion_limit=1000 | ✅ Complete |
| New File | Create | `src/shared_prompts.py` with COURSE_OUTCOME_SUBAGENT_PROMPT (2,434 chars) | ✅ Complete |
| Prompts File | Add | SOW_AUTHENTICITY_CRITIC_PROMPT (934 chars) to sow_author_prompts.py | ✅ Complete |
| Dependencies | Install | `langchain-google-genai` package for Gemini support | ✅ Complete |
| Implementation | Complete | `src/sow_author_agent.py` fully implemented and tested | ✅ Complete |

---

## Key Design Decisions

1. **Reuse Research Infrastructure**: The generic `SUB_RESEARCH_PROMPT` + `internet_search` pattern works perfectly for SoW clarification questions
2. **No Tools for Author/Outcome Subagents**: File I/O is handled by the DeepAgent framework; these subagents only process and generate JSON
3. **All Critics Have Internet Access**: Critics can validate against live SQA/Education Scotland resources
4. **Gemini 2.5 Pro**: Same model as research agent for consistency and performance
5. **Dual-Import Pattern**: Maintains compatibility with both package and direct file loading
