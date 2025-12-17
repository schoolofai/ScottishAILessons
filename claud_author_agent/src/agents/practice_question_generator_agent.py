"""Practice Question Generator Agent - Generates practice questions for blocks.

Uses Claude Agent SDK with Write tool pattern to generate diverse practice
questions at specified difficulty levels for each concept block.

Input: Block data from block extraction
Output: generated_questions.json (validated with Pydantic)
"""

import json
import logging
import os
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime

# Disable SDK initialize timeout
os.environ.setdefault("CLAUDE_CODE_STREAM_CLOSE_TIMEOUT", "600000")

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, ResultMessage

from ..models.practice_question_models import (
    ExtractedBlock,
    GeneratedQuestion,
    QuestionBatch,
    QuestionGenerationResult,
    DifficultyLevel,
    QUESTION_GENERATION_OUTPUT_FILE
)

logger = logging.getLogger(__name__)


# Default question counts per difficulty per block
DEFAULT_QUESTIONS_PER_DIFFICULTY = {
    "easy": 5,
    "medium": 5,
    "hard": 3
}


class PracticeQuestionGeneratorAgent:
    """Agent for generating practice questions using Write tool pattern.

    Generates questions for each block at each difficulty level.
    Questions are validated with Pydantic after generation.
    """

    def __init__(
        self,
        workspace_path: Path,
        model: str = 'claude-sonnet-4-5',
        max_turns: int = 20,
        questions_per_difficulty: Dict[str, int] = None
    ):
        """Initialize Practice Question Generator Agent.

        Args:
            workspace_path: Path to workspace for input/output files
            model: Claude model to use
            max_turns: Maximum conversation turns per block/difficulty
            questions_per_difficulty: Dict of difficulty -> count
        """
        self.workspace_path = workspace_path
        self.model = model
        self.max_turns = max_turns
        self.questions_per_difficulty = questions_per_difficulty or DEFAULT_QUESTIONS_PER_DIFFICULTY

        # Load prompt from file
        prompts_dir = Path(__file__).parent.parent / "prompts"
        self.prompt_template = (prompts_dir / "practice_question_prompt.md").read_text()

    async def execute(
        self,
        lesson_template_id: str,
        blocks: List[ExtractedBlock],
        execution_id: str = None
    ) -> Dict[str, Any]:
        """Generate questions for all blocks across all difficulties.

        Args:
            lesson_template_id: Source lesson template ID
            blocks: List of extracted concept blocks
            execution_id: Execution ID for tracking (auto-generated if not provided)

        Returns:
            Dict with:
                - success: bool
                - generation_result: QuestionGenerationResult
                - message_count: int
                - total_questions: int

        Raises:
            RuntimeError: If agent fails (fail-fast)
        """
        if execution_id is None:
            execution_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        logger.info("=" * 60)
        logger.info("PRACTICE QUESTION GENERATOR - Starting execution")
        logger.info(f"   Workspace: {self.workspace_path}")
        logger.info(f"   Lesson Template ID: {lesson_template_id}")
        logger.info(f"   Execution ID: {execution_id}")
        logger.info(f"   Blocks: {len(blocks)}")
        logger.info(f"   Questions per difficulty: {self.questions_per_difficulty}")
        logger.info("=" * 60)

        all_questions: List[GeneratedQuestion] = []
        total_message_count = 0
        questions_by_difficulty = {"easy": 0, "medium": 0, "hard": 0}

        # Generate questions for each block at each difficulty
        for block_idx, block in enumerate(blocks):
            logger.info(f"\n--- Processing Block {block_idx + 1}/{len(blocks)}: {block.title} ---")

            for difficulty, count in self.questions_per_difficulty.items():
                logger.info(f"  Generating {count} {difficulty} questions...")

                batch_result = await self._generate_questions_for_block_difficulty(
                    block=block,
                    difficulty=difficulty,
                    count=count,
                    lesson_template_id=lesson_template_id
                )

                questions = batch_result["questions"]
                total_message_count += batch_result["message_count"]

                all_questions.extend(questions)
                questions_by_difficulty[difficulty] += len(questions)

                logger.info(f"  ✅ Generated {len(questions)} {difficulty} questions")

        # Build final result
        generation_result = QuestionGenerationResult(
            lesson_template_id=lesson_template_id,
            execution_id=execution_id,
            total_questions=len(all_questions),
            questions_by_difficulty=questions_by_difficulty,
            questions=all_questions
        )

        # Write consolidated output
        output_file = self.workspace_path / QUESTION_GENERATION_OUTPUT_FILE
        with open(output_file, 'w') as f:
            json.dump(generation_result.model_dump(), f, indent=2)

        logger.info("=" * 60)
        logger.info("PRACTICE QUESTION GENERATOR - Complete")
        logger.info(f"   Total Questions: {len(all_questions)}")
        logger.info(f"   By Difficulty: {questions_by_difficulty}")
        logger.info(f"   Total Messages: {total_message_count}")
        logger.info("=" * 60)

        return {
            "success": True,
            "generation_result": generation_result,
            "message_count": total_message_count,
            "total_questions": len(all_questions)
        }

    async def _generate_questions_for_block_difficulty(
        self,
        block: ExtractedBlock,
        difficulty: str,
        count: int,
        lesson_template_id: str
    ) -> Dict[str, Any]:
        """Generate questions for a single block at a single difficulty.

        Args:
            block: The concept block
            difficulty: Difficulty level (easy/medium/hard)
            count: Number of questions to generate
            lesson_template_id: Source lesson template ID

        Returns:
            Dict with questions list and message_count

        Raises:
            RuntimeError: If generation fails
        """
        # Create unique output file for this batch
        batch_output_file = f"questions_{block.block_id}_{difficulty}.json"
        output_path = str((self.workspace_path / batch_output_file).resolve())

        # Build prompt
        prompt = self._build_prompt(block, difficulty, count, output_path)

        # Configure agent
        options = ClaudeAgentOptions(
            model=self.model,
            permission_mode='bypassPermissions',
            allowed_tools=['Read', 'Write'],
            max_turns=self.max_turns,
            cwd=str(self.workspace_path)
        )

        message_count = 0

        async with ClaudeSDKClient(options) as client:
            await client.query(prompt)

            async for message in client.receive_messages():
                message_count += 1
                msg_type = type(message).__name__

                if isinstance(message, ResultMessage):
                    if message.subtype == 'error_max_turns':
                        raise RuntimeError(
                            f"Agent exceeded max turns generating {difficulty} "
                            f"questions for block '{block.title}'"
                        )
                    break

        # Validate output exists
        actual_output_path = self.workspace_path / batch_output_file
        if not actual_output_path.exists():
            raise RuntimeError(
                f"Agent did not write {batch_output_file}. "
                f"Check prompt or increase max_turns."
            )

        # Load and validate
        try:
            with open(actual_output_path) as f:
                raw_json = json.load(f)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Agent wrote invalid JSON: {e}")

        # Parse questions from output
        questions = self._parse_questions(
            raw_json,
            block,
            difficulty,
            lesson_template_id
        )

        return {
            "questions": questions,
            "message_count": message_count
        }

    def _build_prompt(
        self,
        block: ExtractedBlock,
        difficulty: str,
        count: int,
        output_path: str
    ) -> str:
        """Build prompt for question generation."""
        block_context = f"""## Block Information

**Block ID:** {block.block_id}
**Block Title:** {block.title}

### Explanation
{block.explanation}

### Worked Example
{json.dumps(block.worked_example.model_dump() if block.worked_example else None, indent=2)}

### Key Formulas
{json.dumps(block.key_formulas, indent=2)}

### Common Misconceptions (use these to create good distractors)
{json.dumps(block.common_misconceptions, indent=2)}

### Learning Outcomes
{json.dumps(block.outcome_refs, indent=2)}

---

## Generation Task

Generate **{count} {difficulty.upper()}** questions for this block.

**Difficulty Guidelines for {difficulty.upper()}:**
{self._get_difficulty_guidelines(difficulty)}

**Question Type Distribution (approximately):**
- 40% multiple_choice
- 40% numeric
- 20% short_answer

---

## Output Instructions

Use the Write tool to save your questions to: `{output_path}`

The JSON structure must be:
```json
{{
  "block_id": "{block.block_id}",
  "difficulty": "{difficulty}",
  "questions": [
    {{
      "question_id": "q_{block.block_id}_{difficulty}_001",
      "block_id": "{block.block_id}",
      "block_title": "{block.title}",
      "difficulty": "{difficulty}",
      "question_type": "numeric",
      "stem_preview": "...",
      "stem": "...",
      "options": null,
      "correct_answer": "...",
      "acceptable_answers": [...],
      "solution": "...",
      "hints": [...],
      "diagram_needed": false,
      "diagram_tool": "NONE",
      "outcome_refs": {json.dumps(block.outcome_refs)},
      "curriculum_topic": "..."
    }}
  ]
}}
```

**CRITICAL**: Verify all calculations before writing. Mathematical errors are unacceptable.

Write the complete JSON to `{output_path}` now.
"""
        return f"{self.prompt_template}\n\n{block_context}"

    def _get_difficulty_guidelines(self, difficulty: str) -> str:
        """Get difficulty-specific guidelines."""
        guidelines = {
            "easy": """- Direct application of the concept
- Single-step or two-step problems
- Numbers are manageable (small integers, simple fractions)
- Question clearly states what to find""",

            "medium": """- Requires understanding, not just memorization
- Multi-step problems (3-4 steps)
- May include real-world context
- Requires selecting the right approach""",

            "hard": """- Combines multiple concepts
- Requires problem decomposition
- Non-obvious approach needed
- May have multiple valid solution paths"""
        }
        return guidelines.get(difficulty, guidelines["medium"])

    def _parse_questions(
        self,
        raw_json: Dict[str, Any],
        block: ExtractedBlock,
        difficulty: str,
        lesson_template_id: str
    ) -> List[GeneratedQuestion]:
        """Parse and validate questions from raw JSON."""
        questions = []
        raw_questions = raw_json.get("questions", [])

        for idx, q in enumerate(raw_questions):
            try:
                # Ensure required fields
                q.setdefault("block_id", block.block_id)
                q.setdefault("block_title", block.title)
                q.setdefault("difficulty", difficulty)
                q.setdefault("question_id", f"q_{block.block_id}_{difficulty}_{idx:03d}")
                q.setdefault("diagram_needed", False)
                q.setdefault("diagram_tool", "NONE")
                q.setdefault("outcome_refs", block.outcome_refs)

                # Create preview if missing
                if not q.get("stem_preview") and q.get("stem"):
                    stem = q["stem"]
                    q["stem_preview"] = stem[:500] if len(stem) > 500 else stem

                # Validate with Pydantic
                question = GeneratedQuestion.model_validate(q)
                questions.append(question)

            except Exception as e:
                logger.warning(f"Failed to parse question {idx}: {e}")
                # Continue with other questions instead of failing completely
                continue

        if not questions:
            raise RuntimeError(
                f"No valid questions parsed for block '{block.title}' at {difficulty} difficulty"
            )

        return questions


async def run_question_generation(
    workspace_path: Path,
    lesson_template_id: str,
    blocks: List[ExtractedBlock],
    questions_per_difficulty: Dict[str, int] = None,
    execution_id: str = None
) -> QuestionGenerationResult:
    """Run question generation agent and return result.

    Args:
        workspace_path: Path to workspace
        lesson_template_id: Lesson template ID
        blocks: List of extracted blocks
        questions_per_difficulty: Optional custom counts
        execution_id: Optional execution ID

    Returns:
        Validated QuestionGenerationResult

    Raises:
        RuntimeError: If generation fails
    """
    agent = PracticeQuestionGeneratorAgent(
        workspace_path=workspace_path,
        questions_per_difficulty=questions_per_difficulty
    )

    result = await agent.execute(
        lesson_template_id=lesson_template_id,
        blocks=blocks,
        execution_id=execution_id
    )

    if not result["success"]:
        raise RuntimeError(f"Question generation failed: {result.get('error')}")

    return result["generation_result"]
