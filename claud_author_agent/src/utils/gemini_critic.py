"""Gemini-based visual critic for diagram validation.

Uses Gemini's vision capabilities to validate generated diagrams
against their generation prompts with structured output.

This provides more accurate critique than Claude's vision because
Gemini can better understand what it generated and identify
specific issues with mathematical/educational accuracy.
"""

import json
import logging
import os
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field, asdict

from .gemini_client import get_gemini_client, get_gemini_config, GeminiAPIError

logger = logging.getLogger(__name__)


class GeminiCritiqueError(GeminiAPIError):
    """Raised when visual critique fails."""
    pass


@dataclass
class RequirementCheck:
    """Single requirement validation result."""
    requirement: str
    expected: str
    observed: str
    match: bool
    severity: str = "normal"  # critical, major, minor, normal


@dataclass
class CritiqueResult:
    """Result of Gemini visual critique.

    Attributes:
        decision: ACCEPT, REFINE, or REJECT
        final_score: Score from 0.0 to 1.0
        requirements_matched: Number of requirements that matched
        requirements_total: Total number of requirements checked
        requirements_checklist: List of individual requirement checks
        reasoning: Summary of validation reasoning
        correction_prompt: Detailed correction prompt for Gemini (if REFINE)
    """
    decision: str
    final_score: float
    requirements_matched: int
    requirements_total: int
    requirements_checklist: List[Dict[str, Any]]
    reasoning: str
    correction_prompt: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


# System prompt for Gemini critique
CRITIQUE_SYSTEM_PROMPT = """You are a strict visual critic for educational diagrams. Your job is REQUIREMENT VERIFICATION, not subjective quality assessment.

## Your Task
Validate that the generated image ACCURATELY represents every requirement in the generation prompt. Be STRICT - if the prompt says "EXACTLY 10 mm marks", you must COUNT and verify there are exactly 10.

## Validation Process

### Step 1: Parse Requirements
Extract ALL verifiable requirements from the generation prompt:
- ACCURACY REQUIREMENTS section
- Key Elements list
- Specific counts/values (e.g., "EXACTLY 10 mm marks")
- Color specifications (e.g., "green #28a745 for answers")
- Label/annotation requirements
- Position requirements (e.g., "3rd mark after 14 cm")

### Step 2: Verify Each Requirement
For EACH requirement, check the image:
- COUNT elements when quantities specified
- VERIFY positions when locations specified
- CHECK colors when hex codes given
- CONFIRM presence of required labels/annotations

### Step 3: Build Requirements Checklist
Create a verification entry for each requirement:
{
  "requirement": "description of requirement",
  "expected": "what the prompt specified",
  "observed": "what you actually see in the image",
  "match": true/false,
  "severity": "critical|major|minor|normal"
}

Severity levels:
- critical: Accuracy requirements, wrong values/counts/positions
- major: Missing key elements, wrong colors for answers
- minor: Style issues, slight misalignments
- normal: Met requirements

### Step 4: Calculate Score
score = requirements_matched / requirements_total

Score to decision mapping:
- >= 0.90: ACCEPT (excellent match)
- 0.85-0.89: ACCEPT (with notes)
- 0.70-0.84: REFINE (needs improvement)
- < 0.70: REFINE (significant issues)

CRITICAL FAILURE RULES (force REFINE regardless of score):
- Any accuracy requirement failed → REFINE
- CFU diagram shows answer value → REFINE with score capped at 0.40
- Major structural element missing → REFINE

### Step 5: Generate Correction Prompt (if REFINE)
When decision is REFINE, create a detailed correction prompt that:
1. References the original image (Gemini can see it)
2. Lists SPECIFIC fixes with current vs required
3. States what to KEEP unchanged

Correction prompt format:
```
Looking at this ruler diagram image, please make these specific corrections while keeping everything else the same:

## CRITICAL FIXES (MUST CHANGE)

1. [ISSUE NAME]:
   - CURRENT: [what you see in the image]
   - REQUIRED: [what the prompt specified]
   - ACTION: [specific fix instruction]

2. [ISSUE NAME]:
   ...

## KEEP UNCHANGED
- [list elements that are correct]

Generate a corrected version of this diagram with these fixes applied.
```

## CFU Special Rule
For diagram_context="cfu": If ANY answer value is visible that students should calculate themselves:
- Cap score at 0.40 maximum
- Decision MUST be REFINE
- Add to correction_prompt: "CRITICAL: Remove answer value [X] - this is an assessment where students must calculate this themselves. Show only '?' placeholder."

## Output Format
Return ONLY valid JSON (no markdown code blocks):
{
  "decision": "ACCEPT|REFINE|REJECT",
  "final_score": 0.XX,
  "requirements_matched": N,
  "requirements_total": M,
  "requirements_checklist": [
    {
      "requirement": "description",
      "expected": "what prompt specified",
      "observed": "what image shows",
      "match": true/false,
      "severity": "critical|major|minor|normal"
    }
  ],
  "reasoning": "Summary of validation with specific issues found",
  "correction_prompt": "Detailed correction prompt if REFINE, null if ACCEPT"
}"""


def get_max_iterations() -> int:
    """Get maximum iterations from environment."""
    try:
        return int(os.environ.get("DIAGRAM_MAX_ITERATIONS", "3"))
    except ValueError:
        return 3


class GeminiCritic:
    """Gemini-based visual critic for educational diagrams.

    Uses Gemini's vision capabilities to validate generated diagrams
    against their exact generation prompts.

    Usage:
        critic = GeminiCritic()
        result = critic.critique(
            image_path="/path/to/diagram.png",
            generation_prompt="Create a ruler showing...",
            card_content="The explainer text...",
            diagram_context="lesson",
            iteration=1
        )
        if result.decision == "REFINE":
            # Use result.correction_prompt for refinement
    """

    def __init__(self, model: Optional[str] = None):
        """Initialize Gemini critic.

        Args:
            model: Gemini model ID for critique (default from env: gemini-3-pro-preview)
        """
        config = get_gemini_config()
        self.model = model or config.get("critique_model", "gemini-3-pro-preview")
        self.client = None

        logger.info(f"GeminiCritic initialized with model: {self.model}")

    def _ensure_client(self):
        """Ensure Gemini client is initialized."""
        if self.client is None:
            self.client = get_gemini_client()

    def critique(
        self,
        image_path: str,
        generation_prompt: str,
        card_content: str,
        diagram_context: str,
        iteration: int,
        max_iterations: Optional[int] = None
    ) -> CritiqueResult:
        """Critique a diagram using Gemini vision.

        Args:
            image_path: Absolute path to the PNG image
            generation_prompt: The EXACT prompt used to generate the image
            card_content: Original card content for context
            diagram_context: "lesson" or "cfu"
            iteration: Current iteration number (1-based)
            max_iterations: Maximum allowed iterations (default from env)

        Returns:
            CritiqueResult with decision, score, and correction_prompt if needed

        Raises:
            GeminiCritiqueError: If critique fails
            FileNotFoundError: If image file not found
        """
        self._ensure_client()

        if max_iterations is None:
            max_iterations = get_max_iterations()

        # Load the image
        image_path_obj = Path(image_path)
        if not image_path_obj.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        image_bytes = image_path_obj.read_bytes()

        logger.info(f"Critiquing image: {image_path}")
        logger.info(f"Iteration: {iteration}/{max_iterations}")
        logger.info(f"Diagram context: {diagram_context}")

        # Build user prompt
        context_instruction = (
            "Answers SHOULD be visible and in GREEN (#28a745)"
            if diagram_context == "lesson"
            else "Answers MUST NOT be visible - this is an assessment. Only show '?' placeholders."
        )

        user_prompt = f"""## Image to Validate
[Image attached above]

## Generation Prompt (VALIDATE AGAINST THIS - CHECK EVERY REQUIREMENT)
{generation_prompt}

## Card Content (for educational context)
{card_content}

## Diagram Context
{diagram_context} - {context_instruction}

## Iteration
{iteration} of {max_iterations}

Validate this image against EVERY requirement in the generation prompt.
COUNT elements, CHECK positions, VERIFY colors. Be STRICT.
Return your critique as JSON only (no markdown code blocks)."""

        try:
            from google.genai import types

            # Create image part
            image_part = types.Part.from_bytes(
                data=image_bytes,
                mime_type="image/png"
            )

            # Call Gemini with image + critique prompt
            response = self.client.models.generate_content(
                model=self.model,
                contents=[image_part, user_prompt],
                config=types.GenerateContentConfig(
                    system_instruction=CRITIQUE_SYSTEM_PROMPT,
                    temperature=0.1  # Low temperature for consistent critique
                )
            )

            # Parse response
            response_text = response.text.strip()

            # Handle markdown code blocks if present
            if response_text.startswith("```"):
                # Remove markdown code block wrapper
                lines = response_text.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].strip() == "```":
                    lines = lines[:-1]
                response_text = "\n".join(lines)

            critique_data = json.loads(response_text)

            logger.info(f"Critique result: decision={critique_data['decision']}, "
                       f"score={critique_data['final_score']}, "
                       f"matched={critique_data['requirements_matched']}/{critique_data['requirements_total']}")

            return CritiqueResult(
                decision=critique_data["decision"],
                final_score=critique_data["final_score"],
                requirements_matched=critique_data["requirements_matched"],
                requirements_total=critique_data["requirements_total"],
                requirements_checklist=critique_data.get("requirements_checklist", []),
                reasoning=critique_data["reasoning"],
                correction_prompt=critique_data.get("correction_prompt")
            )

        except json.JSONDecodeError as e:
            error_msg = f"Failed to parse Gemini critique response as JSON: {e}"
            logger.error(error_msg)
            logger.error(f"Raw response: {response_text[:500]}...")
            raise GeminiCritiqueError(error_msg) from e

        except Exception as e:
            error_msg = f"Gemini critique failed: {e}"
            logger.error(error_msg)
            raise GeminiCritiqueError(error_msg) from e
