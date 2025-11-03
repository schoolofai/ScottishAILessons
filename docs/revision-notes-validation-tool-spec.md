# Revision Notes JSON Schema Validation Tool Specification

## Overview

This specification defines a Pydantic-based JSON validation tool for revision notes, following the same pattern as the existing `lesson_validator` and `sow_validator` tools in the codebase.

**Tool Name**: `mcp__validator__validate_revision_notes`

**File Location**: `claud_author_agent/src/tools/revision_notes_validator_tool.py`

**Purpose**: Provides fast-fail validation with detailed error messages before revision notes reach the database upserter, catching JSON syntax errors and schema violations early.

---

## 1. Complete Pydantic Schema Models

### File: `claud_author_agent/src/tools/revision_notes_validator_tool.py`

```python
"""JSON Validation Tool for Revision Notes using Pydantic.

Provides fast-fail validation with detailed error messages and cognitive science checks.
Validates revision_notes.json OUTPUT schema with comprehensive quality metrics.

Usage:
    Tool name: mcp__validator__validate_revision_notes
    Args: {"file_path": "revision_notes.json"}

Returns:
    - Success: {"is_valid": true, "message": "✅ Validation passed", ...}
    - Failure: {"is_valid": false, "error_type": "...", "errors": [...]}
"""

import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field, field_validator, model_validator, ValidationError, ConfigDict

from claude_agent_sdk import tool, create_sdk_mcp_server


# ═══════════════════════════════════════════════════════════════
# Configuration Constants
# ═══════════════════════════════════════════════════════════════

# Maximum number of detailed errors to return (prevents token overflow)
MAX_ERRORS_DETAILED = 10

# Word count targets (cognitive science: conciseness principle)
TARGET_WORD_COUNT_MIN = 500
TARGET_WORD_COUNT_MAX = 800

# Section count targets (cognitive science: chunking principle)
KEY_CONCEPTS_MIN = 3
KEY_CONCEPTS_MAX = 5
WORKED_EXAMPLES_MIN = 1
WORKED_EXAMPLES_MAX = 2
COMMON_MISTAKES_MIN = 3
COMMON_MISTAKES_MAX = 4
QUICK_QUIZ_MIN = 3
QUICK_QUIZ_MAX = 5
MEMORY_AIDS_MIN = 2
MEMORY_AIDS_MAX = 4
EXAM_TIPS_MIN = 3
EXAM_TIPS_MAX = 5

# Key concept explanation word count (cognitive science: conciseness)
KEY_CONCEPT_EXPLANATION_MIN = 30
KEY_CONCEPT_EXPLANATION_MAX = 50


# ═══════════════════════════════════════════════════════════════
# Component Models
# ═══════════════════════════════════════════════════════════════

class KeyConcept(BaseModel):
    """Single key concept with dual coding (verbal + visual)."""
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=5, max_length=80, description="Clear, specific concept name")
    explanation: str = Field(..., min_length=30, max_length=300, description="30-50 words target, crystal clear")
    visual_representation: Optional[str] = Field(None, description="LaTeX formula or ASCII diagram (optional)")
    real_world_connection: Optional[str] = Field(None, description="Brief Scottish context example (optional)")

    @field_validator('explanation')
    @classmethod
    def validate_explanation_word_count(cls, v):
        """Validate explanation is within cognitive load target (30-50 words)."""
        word_count = len(v.split())
        if word_count < KEY_CONCEPT_EXPLANATION_MIN:
            raise ValueError(
                f"Explanation too short: {word_count} words. "
                f"Target: {KEY_CONCEPT_EXPLANATION_MIN}-{KEY_CONCEPT_EXPLANATION_MAX} words for optimal retention."
            )
        if word_count > KEY_CONCEPT_EXPLANATION_MAX + 20:  # Allow some flexibility
            raise ValueError(
                f"Explanation too long: {word_count} words. "
                f"Target: {KEY_CONCEPT_EXPLANATION_MIN}-{KEY_CONCEPT_EXPLANATION_MAX} words. "
                f"Conciseness is key for cognitive load management."
            )
        return v

    @field_validator('visual_representation')
    @classmethod
    def validate_latex_syntax(cls, v):
        """Basic LaTeX syntax validation."""
        if v is None:
            return v

        # Check for balanced delimiters
        if v.count('$') % 2 != 0:
            raise ValueError("Unbalanced $ delimiters in LaTeX")
        if v.count('$$') % 2 != 0:
            raise ValueError("Unbalanced $$ delimiters in LaTeX")
        if v.count('{') != v.count('}'):
            raise ValueError("Unbalanced {} braces in LaTeX")

        return v

    @field_validator('real_world_connection')
    @classmethod
    def validate_scottish_context(cls, v):
        """Encourage Scottish contexts (soft validation)."""
        if v is None:
            return v

        # Scottish keywords (not exhaustive, just hints)
        scottish_keywords = [
            'scot', 'edinburgh', 'glasgow', 'nhs', 'scotrail', 'tesco', 'sainsbury',
            '£', 'pounds', 'pence', 'ben nevis', 'loch', 'highland', 'forth',
            'hampden', 'murrayfield', 'cairngorms'
        ]

        has_scottish_context = any(keyword in v.lower() for keyword in scottish_keywords)

        if not has_scottish_context and len(v) > 20:
            # Warning, not error (soft validation)
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(
                f"Real-world connection may not be Scottish-specific: '{v[:50]}...'. "
                f"Consider using Scottish contexts for relevance."
            )

        return v


class WorkedExample(BaseModel):
    """Fully worked example with step-by-step reasoning."""
    model_config = ConfigDict(extra="forbid")

    problem: str = Field(..., min_length=10, max_length=500, description="Exam-style problem statement")
    solution_steps: List[str] = Field(..., min_length=2, description="Step-by-step breakdown with reasoning")
    answer: str = Field(..., min_length=1, max_length=200, description="Final answer with units")
    key_insight: str = Field(..., min_length=20, max_length=300, description="Why this example matters")

    @field_validator('solution_steps')
    @classmethod
    def validate_solution_steps(cls, v):
        """Ensure steps are detailed enough."""
        for i, step in enumerate(v, 1):
            if len(step.split()) < 5:
                raise ValueError(
                    f"Solution step {i} too brief: '{step}'. "
                    f"Each step should include reasoning, not just calculations."
                )
        return v


class CommonMistake(BaseModel):
    """Common misconception with root cause analysis."""
    model_config = ConfigDict(extra="forbid")

    mistake: str = Field(..., min_length=10, max_length=300, description="Specific error pattern")
    why_wrong: str = Field(..., min_length=20, max_length=400, description="Root cause explanation")
    correction: str = Field(..., min_length=20, max_length=400, description="How to fix thinking")
    tip: str = Field(..., min_length=10, max_length=200, description="Memory trick to avoid error")


class QuickCheckQuestion(BaseModel):
    """Retrieval practice question for self-testing."""
    model_config = ConfigDict(extra="forbid")

    question: str = Field(..., min_length=10, max_length=300, description="Self-test question")
    answer: str = Field(..., min_length=1, max_length=300, description="Correct answer")
    explanation: str = Field(..., min_length=10, max_length=300, description="Brief why/how clarification")


class MemoryAid(BaseModel):
    """Mnemonic or memory trick."""
    model_config = ConfigDict(extra="forbid")

    type: Literal["mnemonic", "pattern", "trick", "visual"] = Field(..., description="Memory aid category")
    content: str = Field(..., min_length=10, max_length=300, description="The memorable aid itself")
    application: str = Field(..., min_length=10, max_length=200, description="When/how to use it")


class RevisionNotesMetadata(BaseModel):
    """Metadata about revision notes."""
    model_config = ConfigDict(extra="forbid")

    difficulty_level: str = Field(..., description="SQA level: National 3|4|5|Higher|Advanced Higher")
    estimated_study_time: int = Field(..., ge=10, le=60, description="Realistic study time (10-60 minutes)")
    sqa_outcome_refs: List[str] = Field(..., min_length=1, description="SQA outcome codes covered")

    @field_validator('difficulty_level')
    @classmethod
    def validate_difficulty_level(cls, v):
        """Validate SQA level enum."""
        allowed_levels = {
            "National 3", "National 4", "National 5",
            "Higher", "Advanced Higher"
        }
        if v not in allowed_levels:
            raise ValueError(
                f"Invalid difficulty_level: '{v}'. "
                f"Must be one of: {', '.join(sorted(allowed_levels))}"
            )
        return v


# ═══════════════════════════════════════════════════════════════
# Top-Level Revision Notes Model
# ═══════════════════════════════════════════════════════════════

class RevisionNotes(BaseModel):
    """Complete revision_notes.json schema with cognitive science validation.

    Validates output from revision_notes_author agent for Scottish secondary education.
    Implements 9 cognitive science principles: dual coding, chunking, elaboration,
    retrieval practice, worked examples, error correction, spacing, transfer, mnemonics.
    """

    model_config = ConfigDict(extra="forbid")

    # === CONTENT SECTIONS ===
    summary: str = Field(..., min_length=50, max_length=500, description="2-3 sentence lesson essence")
    key_concepts: List[KeyConcept] = Field(..., min_length=KEY_CONCEPTS_MIN, max_length=KEY_CONCEPTS_MAX)
    worked_examples: List[WorkedExample] = Field(..., min_length=WORKED_EXAMPLES_MIN, max_length=WORKED_EXAMPLES_MAX)
    common_mistakes: List[CommonMistake] = Field(..., min_length=COMMON_MISTAKES_MIN, max_length=COMMON_MISTAKES_MAX)
    quick_quiz: List[QuickCheckQuestion] = Field(..., min_length=QUICK_QUIZ_MIN, max_length=QUICK_QUIZ_MAX)
    memory_aids: List[MemoryAid] = Field(..., min_length=MEMORY_AIDS_MIN, max_length=MEMORY_AIDS_MAX)
    exam_tips: List[str] = Field(..., min_length=EXAM_TIPS_MIN, max_length=EXAM_TIPS_MAX)

    # === METADATA ===
    metadata: RevisionNotesMetadata = Field(..., description="Notes metadata")

    @field_validator('summary')
    @classmethod
    def validate_summary_mentions_sqa(cls, v):
        """Encourage SQA context in summary."""
        if 'sqa' not in v.lower() and 'national' not in v.lower() and 'higher' not in v.lower():
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(
                "Summary should mention SQA level or relevance for exam context."
            )
        return v

    @field_validator('exam_tips')
    @classmethod
    def validate_exam_tips_content(cls, v):
        """Validate exam tips are actionable and SQA-specific."""
        for i, tip in enumerate(v, 1):
            if len(tip.split()) < 5:
                raise ValueError(
                    f"Exam tip {i} too brief: '{tip}'. "
                    f"Tips should be actionable and specific."
                )
        return v

    @model_validator(mode='after')
    def validate_overall_word_count(self):
        """Validate total word count for conciseness (cognitive science principle)."""
        # Calculate total word count across all text fields
        total_words = 0

        # Summary
        total_words += len(self.summary.split())

        # Key concepts
        for kc in self.key_concepts:
            total_words += len(kc.title.split())
            total_words += len(kc.explanation.split())
            if kc.real_world_connection:
                total_words += len(kc.real_world_connection.split())

        # Worked examples
        for we in self.worked_examples:
            total_words += len(we.problem.split())
            for step in we.solution_steps:
                total_words += len(step.split())
            total_words += len(we.answer.split())
            total_words += len(we.key_insight.split())

        # Common mistakes
        for cm in self.common_mistakes:
            total_words += len(cm.mistake.split())
            total_words += len(cm.why_wrong.split())
            total_words += len(cm.correction.split())
            total_words += len(cm.tip.split())

        # Quick quiz
        for qq in self.quick_quiz:
            total_words += len(qq.question.split())
            total_words += len(qq.answer.split())
            total_words += len(qq.explanation.split())

        # Memory aids
        for ma in self.memory_aids:
            total_words += len(ma.content.split())
            total_words += len(ma.application.split())

        # Exam tips
        for tip in self.exam_tips:
            total_words += len(tip.split())

        # Validate against target range
        if total_words < TARGET_WORD_COUNT_MIN:
            raise ValueError(
                f"Total word count too low: {total_words} words. "
                f"Target: {TARGET_WORD_COUNT_MIN}-{TARGET_WORD_COUNT_MAX} words for comprehensive coverage. "
                f"Add more detail to key concepts or worked examples."
            )

        if total_words > TARGET_WORD_COUNT_MAX + 100:  # Allow some flexibility
            raise ValueError(
                f"Total word count too high: {total_words} words. "
                f"Target: {TARGET_WORD_COUNT_MIN}-{TARGET_WORD_COUNT_MAX} words for conciseness. "
                f"Cognitive load principle: students retain more from focused notes. "
                f"Consider condensing explanations or reducing examples."
            )

        return self

    @model_validator(mode='after')
    def validate_dual_coding_present(self):
        """Validate dual coding principle: at least some visual representations."""
        visual_count = sum(1 for kc in self.key_concepts if kc.visual_representation)

        if visual_count == 0:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(
                "No visual representations found in key concepts. "
                "Dual coding principle: verbal + visual = better retention. "
                "Consider adding LaTeX formulas or diagrams."
            )

        return self


# ═══════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════

def _format_validation_errors(pydantic_errors: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Format Pydantic validation errors with token limits.

    Args:
        pydantic_errors: List of error dictionaries from Pydantic ValidationError.errors()

    Returns:
        Dictionary with formatted errors, limited to MAX_ERRORS_DETAILED items
    """
    total_errors = len(pydantic_errors)
    detailed_errors = []

    # Process first MAX_ERRORS_DETAILED errors only
    for error in pydantic_errors[:MAX_ERRORS_DETAILED]:
        # Build field path (e.g., "key_concepts.0.explanation")
        field_path = ".".join(str(loc) for loc in error['loc'])

        # Build concise error object
        error_info = {
            "field": field_path,
            "error": error['msg'],
            "type": error['type']
        }

        # Include input value for primitives only
        input_val = error.get('input')
        if input_val is not None and isinstance(input_val, (str, int, float, bool)):
            input_str = str(input_val)
            if len(input_str) > 100:
                error_info["input_value"] = input_str[:100] + "..."
            else:
                error_info["input_value"] = input_val

        detailed_errors.append(error_info)

    # Build response with error summary
    response = {
        "is_valid": False,
        "error_type": "SCHEMA_VALIDATION_ERROR",
        "message": f"Found {total_errors} validation error(s)",
        "errors_shown": len(detailed_errors),
        "total_errors": total_errors,
        "errors": detailed_errors,
        "fix_suggestions": [
            "Check that all required sections are present (summary, key_concepts, etc.)",
            "Verify key_concepts count is 3-5 (chunking principle)",
            "Ensure worked_examples count is 1-2 (representative examples)",
            "Check common_mistakes count is 3-4 (address key errors)",
            "Verify quick_quiz has 3-5 questions (retrieval practice)",
            "Ensure memory_aids has 2-4 items (mnemonic support)",
            "Check exam_tips has 3-5 tips (SQA alignment)",
            "Validate key concept explanations are 30-50 words (conciseness)",
            "Check total word count is 500-800 words (cognitive load)",
            "Verify LaTeX syntax is correct (balanced $, $$, {})",
            "Ensure SQA outcome refs are present in metadata",
            "Check estimated_study_time is realistic (10-60 minutes)"
        ]
    }

    # Add truncation notice if errors were limited
    if total_errors > MAX_ERRORS_DETAILED:
        response["truncation_notice"] = (
            f"Showing first {MAX_ERRORS_DETAILED} of {total_errors} errors. "
            f"Fix these errors and re-validate to see remaining issues."
        )

    return response


def _calculate_quality_metrics(notes: RevisionNotes) -> Dict[str, Any]:
    """Calculate quality metrics for successful validation.

    Returns metrics about cognitive science alignment:
    - Word counts per section
    - Dual coding coverage (% concepts with visuals)
    - Scottish context usage
    - Retrieval practice quality
    """
    # Calculate total word count
    total_words = 0
    total_words += len(notes.summary.split())
    for kc in notes.key_concepts:
        total_words += len(kc.explanation.split())
    for we in notes.worked_examples:
        total_words += len(we.problem.split())
        total_words += sum(len(step.split()) for step in we.solution_steps)
    for cm in notes.common_mistakes:
        total_words += len(cm.mistake.split()) + len(cm.why_wrong.split()) + len(cm.correction.split())
    for qq in notes.quick_quiz:
        total_words += len(qq.question.split()) + len(qq.answer.split())
    for ma in notes.memory_aids:
        total_words += len(ma.content.split())
    for tip in notes.exam_tips:
        total_words += len(tip.split())

    # Dual coding metrics
    visual_count = sum(1 for kc in notes.key_concepts if kc.visual_representation)
    dual_coding_percentage = (visual_count / len(notes.key_concepts)) * 100 if notes.key_concepts else 0

    # Scottish context metrics
    scottish_context_count = sum(1 for kc in notes.key_concepts if kc.real_world_connection)

    return {
        "total_word_count": total_words,
        "word_count_status": "✅ Optimal" if TARGET_WORD_COUNT_MIN <= total_words <= TARGET_WORD_COUNT_MAX else "⚠️ Outside target",
        "key_concepts_count": len(notes.key_concepts),
        "worked_examples_count": len(notes.worked_examples),
        "common_mistakes_count": len(notes.common_mistakes),
        "quick_quiz_count": len(notes.quick_quiz),
        "memory_aids_count": len(notes.memory_aids),
        "exam_tips_count": len(notes.exam_tips),
        "dual_coding_coverage": f"{dual_coding_percentage:.0f}%",
        "scottish_contexts": scottish_context_count,
        "estimated_study_time": notes.metadata.estimated_study_time,
        "sqa_outcomes_covered": len(notes.metadata.sqa_outcome_refs),
        "cognitive_science_alignment": {
            "chunking": "✅" if KEY_CONCEPTS_MIN <= len(notes.key_concepts) <= KEY_CONCEPTS_MAX else "❌",
            "dual_coding": "✅" if visual_count > 0 else "⚠️",
            "retrieval_practice": "✅" if QUICK_QUIZ_MIN <= len(notes.quick_quiz) <= QUICK_QUIZ_MAX else "❌",
            "mnemonics": "✅" if MEMORY_AIDS_MIN <= len(notes.memory_aids) <= MEMORY_AIDS_MAX else "❌",
            "conciseness": "✅" if TARGET_WORD_COUNT_MIN <= total_words <= TARGET_WORD_COUNT_MAX else "⚠️"
        }
    }


# ═══════════════════════════════════════════════════════════════
# Custom Tool Implementation
# ═══════════════════════════════════════════════════════════════

@tool(
    "validate_revision_notes",
    "Validate revision_notes.json against comprehensive Pydantic schema with cognitive science checks",
    {"file_path": str}
)
async def validate_revision_notes(args):
    """Validate revision notes JSON file using comprehensive Pydantic models.

    Args:
        args: Dictionary with 'file_path' key pointing to JSON file

    Returns:
        Tool response with validation results:
        - Success: is_valid=True with quality metrics
        - Failure: is_valid=False with detailed error list

    Error Types:
        - JSON_SYNTAX_ERROR: Invalid JSON format
        - SCHEMA_VALIDATION_ERROR: Valid JSON but violates Pydantic schema
        - FILE_NOT_FOUND: File does not exist
    """
    file_path = args["file_path"]

    try:
        # Read and parse JSON file
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Validate with Pydantic
        notes = RevisionNotes(**data)

        # Calculate quality metrics
        metrics = _calculate_quality_metrics(notes)

        # Success response
        return {
            "content": [{
                "type": "text",
                "text": json.dumps({
                    "is_valid": True,
                    "message": "✅ Validation passed - Revision notes meet all quality standards",
                    "metrics": metrics
                }, indent=2)
            }]
        }

    except json.JSONDecodeError as e:
        # JSON parsing error
        error_msg = {
            "is_valid": False,
            "error_type": "JSON_SYNTAX_ERROR",
            "message": f"Invalid JSON syntax at line {e.lineno}, column {e.colno}",
            "details": {
                "error": str(e.msg),
                "position": f"line {e.lineno}, column {e.colno}"
            },
            "fix_suggestions": [
                "Check for missing commas between fields",
                "Ensure all strings are properly quoted",
                "Check for trailing commas (not allowed in JSON)",
                "Validate JSON structure with a JSON linter"
            ]
        }
        return {
            "content": [{
                "type": "text",
                "text": json.dumps(error_msg, indent=2)
            }],
            "isError": True
        }

    except ValidationError as e:
        # Pydantic validation errors
        error_msg = _format_validation_errors(e.errors())

        return {
            "content": [{
                "type": "text",
                "text": json.dumps(error_msg, indent=2)
            }],
            "isError": True
        }

    except FileNotFoundError:
        # File doesn't exist
        error_msg = {
            "is_valid": False,
            "error_type": "FILE_NOT_FOUND",
            "message": f"File not found: {file_path}",
            "details": {
                "file_path": file_path,
                "absolute_path": str(Path(file_path).absolute())
            },
            "fix_suggestions": [
                "Check that the file path is correct",
                "Ensure the file has been written before validation",
                "Verify you're in the correct working directory"
            ]
        }
        return {
            "content": [{
                "type": "text",
                "text": json.dumps(error_msg, indent=2)
            }],
            "isError": True
        }

    except Exception as e:
        # Unexpected error
        error_msg = {
            "is_valid": False,
            "error_type": "UNEXPECTED_ERROR",
            "message": f"Unexpected error during validation: {type(e).__name__}",
            "details": str(e)
        }
        return {
            "content": [{
                "type": "text",
                "text": json.dumps(error_msg, indent=2)
            }],
            "isError": True
        }


# ═══════════════════════════════════════════════════════════════
# Create MCP Server
# ═══════════════════════════════════════════════════════════════

validation_server = create_sdk_mcp_server(
    name="revision-notes-validator",
    version="1.0.0",
    tools=[validate_revision_notes]
)

# Tool naming convention: mcp__revision-notes-validator__validate_revision_notes
```

---

## 2. Integration with Agent

### In `revision_notes_claude_client.py`

```python
from .tools.revision_notes_validator_tool import validation_server

# When configuring agent options
mcp_servers_for_revision_notes = {
    "validator": validation_server  # Revision notes validation tool
}

options = ClaudeAgentOptions(
    model='claude-sonnet-4-5',
    permission_mode='bypassPermissions',
    system_prompt=self._get_agent_definition(),
    mcp_servers=mcp_servers_for_revision_notes,  # Register validator
    allowed_tools=[
        'Read', 'Write', 'Edit', 'TodoWrite', 'WebSearch', 'WebFetch',
        'mcp__validator__validate_revision_notes'  # Add to allowed tools
    ],
    max_turns=100,
    cwd=str(workspace_path)
)
```

---

## 3. Agent Prompt Usage

### In `revision_notes_author_prompt.md`

```markdown
### Step 4: Validate Output

After writing `revision_notes.json`, **validate with the schema tool**:

```
mcp__validator__validate_revision_notes {"file_path": "revision_notes.json"}
```

**Check result**:
- `is_valid: true` → ✅ Proceed to completion
- `is_valid: false` → ❌ Fix errors and re-validate

**Validation Checks**:
1. **Structure**: All 9 sections present (summary, key_concepts, worked_examples, etc.)
2. **Counts**:
   - Key concepts: 3-5 (chunking principle)
   - Worked examples: 1-2
   - Common mistakes: 3-4
   - Quick quiz: 3-5 (retrieval practice)
   - Memory aids: 2-4
   - Exam tips: 3-5
3. **Word Count**: 500-800 words total (conciseness principle)
4. **Key Concept Explanations**: 30-50 words each (cognitive load)
5. **LaTeX Syntax**: Balanced delimiters ($, $$, {})
6. **SQA Alignment**: Outcome refs present, difficulty level valid
7. **Cognitive Science**: Dual coding, chunking, retrieval practice checks

**Fix-Validate Loop** (if validation fails):
- Read error list (max 10 errors shown per validation)
- Use Edit tool to fix EACH error
- Re-run validation
- Repeat until `is_valid: true`

**Common Errors**:
- Key concepts count not 3-5 (violates chunking principle)
- Total word count outside 500-800 range (violates conciseness)
- Key concept explanation < 30 or > 50 words (cognitive load issue)
- Missing visual representations (no dual coding)
- LaTeX syntax errors (unbalanced delimiters)
- Quick quiz count not 3-5 (inadequate retrieval practice)
- Memory aids count not 2-4 (insufficient mnemonic support)
- Exam tips too brief (< 5 words)
```

---

## 4. Validation Features

### Cognitive Science Validation Checks

The validator implements **evidence-based quality metrics**:

| Principle | Check | Error/Warning |
|-----------|-------|---------------|
| **Chunking** | Key concepts count: 3-5 | Error if outside range |
| **Conciseness** | Total word count: 500-800 | Error if < 500 or > 900 |
| **Conciseness** | Key concept explanation: 30-50 words | Error if < 30, warning if > 70 |
| **Dual Coding** | Visual representations present | Warning if none |
| **Elaboration** | Scottish contexts used | Warning if absent |
| **Retrieval Practice** | Quick quiz count: 3-5 | Error if outside range |
| **Worked Examples** | Solution steps detailed (> 5 words each) | Error if too brief |
| **Mnemonics** | Memory aids count: 2-4 | Error if outside range |
| **SQA Alignment** | Outcome refs present | Error if missing |
| **SQA Alignment** | Difficulty level valid enum | Error if invalid |

### Quality Metrics in Success Response

When validation passes, the tool returns comprehensive quality metrics:

```json
{
  "is_valid": true,
  "message": "✅ Validation passed - Revision notes meet all quality standards",
  "metrics": {
    "total_word_count": 650,
    "word_count_status": "✅ Optimal",
    "key_concepts_count": 4,
    "worked_examples_count": 2,
    "common_mistakes_count": 3,
    "quick_quiz_count": 4,
    "memory_aids_count": 3,
    "exam_tips_count": 4,
    "dual_coding_coverage": "75%",
    "scottish_contexts": 3,
    "estimated_study_time": 25,
    "sqa_outcomes_covered": 3,
    "cognitive_science_alignment": {
      "chunking": "✅",
      "dual_coding": "✅",
      "retrieval_practice": "✅",
      "mnemonics": "✅",
      "conciseness": "✅"
    }
  }
}
```

---

## 5. Testing

### Unit Tests

**File**: `claud_author_agent/tests/test_revision_notes_validator.py`

```python
import pytest
import json
from src.tools.revision_notes_validator_tool import RevisionNotes, validate_revision_notes
from pydantic import ValidationError


def test_valid_revision_notes():
    """Test valid revision notes pass validation."""
    valid_data = {
        "summary": "This lesson covers fraction simplification by finding the HCF. Essential for National 3 algebra and appears in 60% of SQA exam papers.",
        "key_concepts": [
            {
                "title": "Simplifying Fractions",
                "explanation": "Divide numerator and denominator by their highest common factor (HCF) to simplify. For example, 8/12 has HCF of 4, so divide both by 4 to get 2/3. This is essential for algebra.",
                "visual_representation": "$$\\frac{8}{12} \\xrightarrow{\\div 4} \\frac{2}{3}$$",
                "real_world_connection": "Splitting a £12 restaurant bill among 8 friends: £12 ÷ 8 = £1.50 each"
            },
            # ... 2 more key concepts
        ],
        "worked_examples": [
            {
                "problem": "Calculate 3/5 of £40",
                "solution_steps": [
                    "Step 1: Interpret 'of' as multiplication → 3/5 × 40",
                    "Step 2: Multiply numerator by 40 → 3 × 40 = 120",
                    "Step 3: Divide by denominator → 120 ÷ 5 = 24"
                ],
                "answer": "£24",
                "key_insight": "The word 'of' always means multiply in fraction problems"
            }
        ],
        "common_mistakes": [
            {
                "mistake": "Adding fractions with different denominators: 1/3 + 1/4 = 2/7",
                "why_wrong": "Cannot add numerators when denominators differ. Like adding 1 apple + 1 orange ≠ 2 apples",
                "correction": "Find common denominator (12), convert both fractions, then add",
                "tip": "Remember: 'Denominators Down Below must MATCH before you GO'"
            },
            # ... 2 more mistakes
        ],
        "quick_quiz": [
            {
                "question": "Simplify 6/9",
                "answer": "2/3",
                "explanation": "HCF of 6 and 9 is 3, so divide both by 3"
            },
            # ... 2 more questions
        ],
        "memory_aids": [
            {
                "type": "mnemonic",
                "content": "Keep, Change, Flip for dividing fractions",
                "application": "Keep first fraction, Change ÷ to ×, Flip second fraction"
            },
            # ... 1 more aid
        ],
        "exam_tips": [
            "Always show working for method marks in SQA papers",
            "Check answer makes sense (e.g., fraction should simplify to smaller numbers)",
            "Use calculator for complex calculations but show the setup"
        ],
        "metadata": {
            "difficulty_level": "National 3",
            "estimated_study_time": 20,
            "sqa_outcome_refs": ["MTH_3-01a", "MTH_3-01b"]
        }
    }

    # Should not raise
    notes = RevisionNotes(**valid_data)
    assert len(notes.key_concepts) >= 3


def test_key_concepts_count_too_low():
    """Test validation fails when key concepts < 3."""
    invalid_data = {
        # ... valid other fields
        "key_concepts": [
            # Only 2 concepts - should fail
        ]
    }

    with pytest.raises(ValidationError) as excinfo:
        RevisionNotes(**invalid_data)

    assert "at least 3 items" in str(excinfo.value).lower()


def test_word_count_too_low():
    """Test validation fails when total word count < 500."""
    # Create minimal data with very short content
    # Should trigger word count validation error
    pass


def test_latex_unbalanced_delimiters():
    """Test validation fails with unbalanced LaTeX."""
    invalid_visual = "$$\\frac{8}{12}$"  # Missing closing $$

    with pytest.raises(ValidationError) as excinfo:
        KeyConcept(
            title="Test",
            explanation="A" * 40,
            visual_representation=invalid_visual
        )

    assert "unbalanced" in str(excinfo.value).lower()


def test_key_concept_explanation_too_short():
    """Test validation fails when explanation < 30 words."""
    short_explanation = "This is too short"  # Only 4 words

    with pytest.raises(ValidationError) as excinfo:
        KeyConcept(
            title="Test Concept",
            explanation=short_explanation
        )

    assert "30 words" in str(excinfo.value).lower()


def test_invalid_difficulty_level():
    """Test validation fails with invalid SQA level."""
    with pytest.raises(ValidationError) as excinfo:
        RevisionNotesMetadata(
            difficulty_level="Grade 9",  # Invalid - should be "National X"
            estimated_study_time=20,
            sqa_outcome_refs=["MTH_3-01a"]
        )

    assert "National" in str(excinfo.value)
```

---

## 6. Summary

This validation tool provides:

✅ **Comprehensive Schema Validation**: All fields, types, and structures
✅ **Cognitive Science Checks**: Word counts, section counts, chunking, dual coding
✅ **LaTeX Syntax Validation**: Balanced delimiters and braces
✅ **SQA Alignment**: Outcome refs, difficulty levels, exam context
✅ **Quality Metrics**: Detailed feedback on cognitive science alignment
✅ **Fast-Fail**: Catches errors before database upserting
✅ **Token-Optimized**: Max 10 errors per validation to prevent overflow
✅ **Actionable Feedback**: Specific fix suggestions for each error type

**Integration**: Follows exact same pattern as `lesson_validator` and `sow_validator` tools for consistency.

**Usage**: Agent validates JSON after writing, gets immediate feedback, fixes errors, and re-validates until passing.
