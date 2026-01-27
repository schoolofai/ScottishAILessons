"""Walkthrough Models - Pydantic schemas for Past Paper Walkthrough generation.

These models define the structure for:
- Step-by-step walkthroughs aligned with SQA marking schemes
- Common errors and examiner warnings
- Storage in us_walkthroughs collection

The walkthrough content maps directly from SQA marking instructions:
- generic_scheme[].process → step description (what earns the mark)
- illustrative_scheme[].answer_latex → working shown (expected answer)
- solution.notes[] → examiner tips and warnings
"""

from enum import Enum
from typing import Dict, List, Optional, Literal, Any
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, timezone
import json
import gzip
import base64


# =============================================================================
# Enums and Literals
# =============================================================================

ErrorType = Literal[
    "notation",           # Wrong mathematical notation (decimal instead of fraction, wrong symbols)
    "calculation",        # Arithmetic or computational error (sign error, arithmetic mistake)
    "concept",            # Fundamental misunderstanding (wrong formula, misapplied rule)
    "omission",           # Missing required information (no working shown, units omitted)
    "misinterpretation",  # Misreading the question (answering different question, wrong values)
    "sign_error",         # Sign handling mistakes (negative instead of positive, wrong ±)
    "procedural",         # Skipping required steps (missing intermediate working)
    "rounding"            # Inappropriate rounding (too few decimal places, premature rounding)
]
WalkthroughStatus = Literal["draft", "published", "archived"]


# =============================================================================
# Core Walkthrough Models
# =============================================================================

class WalkthroughStep(BaseModel):
    """A single step in the walkthrough, aligned with SQA marking scheme bullet.

    Each step maps to one bullet point from the marking scheme:
    - bullet: The •1, •2, etc. from the marking scheme
    - process: What the student must do to earn this mark (from generic_scheme)
    - working: The actual mathematical working (from illustrative_scheme)

    V2 Enhancement: Pedagogical fields for student-friendly explanations.
    """
    bullet: int = Field(
        ...,
        ge=1,
        description="Bullet number matching SQA marking scheme (1, 2, 3...)"
    )
    label: str = Field(
        ...,
        description="Display label like '•1: strategy' or '•2: calculation'"
    )
    process: str = Field(
        ...,
        min_length=1,
        description="What process earns this mark (from generic_scheme)"
    )
    working: str = Field(
        ...,
        description="The actual mathematical working shown"
    )
    working_latex: str = Field(
        ...,
        description="LaTeX formatted working for KaTeX rendering"
    )
    marks_earned: int = Field(
        ...,
        ge=0,
        description="Number of marks available for this step (usually 1)"
    )
    examiner_notes: Optional[str] = Field(
        None,
        description="Relevant examiner notes or conditions for this step"
    )

    # V2 Pedagogical fields (optional for backward compatibility)
    concept_explanation: Optional[str] = Field(
        None,
        description="Student-friendly explanation of WHY this step works mathematically"
    )
    peer_tip: Optional[str] = Field(
        None,
        description="Peer explainer tip (e.g., 'So basically...')"
    )
    student_warning: Optional[str] = Field(
        None,
        description="Transformed examiner note as student-facing warning"
    )


class CommonError(BaseModel):
    """A common error students make, with mark implications.

    These are generated from:
    1. solution.notes[] - explicit examiner warnings
    2. AI inference - based on marking scheme conditions

    V2 Enhancement: Dual-perspective analysis (learning gap + marking impact).
    """
    error_type: ErrorType = Field(
        ...,
        description="Category: notation, calculation, concept, omission, misinterpretation, sign_error, procedural, or rounding"
    )
    description: str = Field(
        ...,
        min_length=10,
        description="What students commonly do wrong"
    )
    why_marks_lost: str = Field(
        ...,
        description="Which bullet points/marks are lost and why"
    )
    prevention_tip: str = Field(
        ...,
        description="How to avoid this error"
    )

    # V2 Pedagogical fields (optional for backward compatibility)
    learning_gap: Optional[str] = Field(
        None,
        description="What concept the student misunderstood (learning gap analysis)"
    )
    marking_impact: Optional[str] = Field(
        None,
        description="Plain English explanation of how this affects their grade"
    )
    related_topics: List[str] = Field(
        default_factory=list,
        description="Topic tags for revision/remediation"
    )


class PrerequisiteLink(BaseModel):
    """Links walkthrough topics to course lessons for revision.

    V2 Enhancement: Enables students to access relevant lessons directly
    from the walkthrough when they need to brush up on prerequisites.
    """
    topic_tag: str = Field(
        ...,
        description="Topic tag from the question (e.g., 'fractions', 'quadratics')"
    )
    reminder_text: str = Field(
        ...,
        min_length=20,
        description="Quick concept reminder for this topic"
    )
    lesson_refs: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of {lesson_template_id, label, sow_order} for matching lessons"
    )
    course_fallback: Optional[str] = Field(
        None,
        description="Course overview link if no specific lesson matches"
    )


class QuestionWalkthrough(BaseModel):
    """Complete walkthrough for a single question.

    This is the main content stored in the walkthrough_content field,
    containing everything needed to display an examiner-aligned solution.

    V2 Enhancement: Includes prerequisite_links for lesson navigation.
    """
    question_stem: str = Field(
        ...,
        description="Original question text (markdown)"
    )
    question_stem_latex: str = Field(
        ...,
        description="Question text with LaTeX for rendering"
    )
    topic_tags: List[str] = Field(
        default_factory=list,
        description="Topic tags from us_papers"
    )
    total_marks: int = Field(
        ...,
        ge=1,
        description="Total marks available for this question"
    )
    steps: List[WalkthroughStep] = Field(
        ...,
        description="Step-by-step solution aligned with marking scheme"
    )
    common_errors: List[CommonError] = Field(
        default_factory=list,
        description="Common errors with mark implications"
    )
    examiner_summary: str = Field(
        ...,
        description="Key examiner guidance (from general principles and notes)"
    )
    diagram_refs: List[str] = Field(
        default_factory=list,
        description="DEPRECATED: Diagrams now fetched directly from us_papers. "
                    "Kept for backward compatibility with existing walkthroughs."
    )

    # V2 Pedagogical field
    prerequisite_links: List[PrerequisiteLink] = Field(
        default_factory=list,
        description="Links to prerequisite lessons for revision (V2 enhancement)"
    )

    @field_validator('steps')
    @classmethod
    def steps_not_empty(cls, v):
        """Ensure at least one step exists."""
        if len(v) == 0:
            raise ValueError("Walkthrough must have at least one step")
        return v


# =============================================================================
# Database Document Model
# =============================================================================

class WalkthroughDocument(BaseModel):
    """Full document model for us_walkthroughs collection.

    This model represents a complete row in the Appwrite database,
    including denormalized metadata for efficient queries.
    """
    # Foreign key and identifiers
    paper_id: str = Field(
        ...,
        description="FK to us_papers.$id"
    )
    question_number: str = Field(
        ...,
        description="Question number like '1', '4a', '5b(i)'"
    )

    # Denormalized metadata (for efficient queries without JOIN)
    paper_code: str = Field(
        ...,
        description="SQA paper code like 'X847/75/01'"
    )
    year: int = Field(
        ...,
        ge=2014,
        le=2030,
        description="Exam year"
    )
    subject: str = Field(
        ...,
        description="Subject name like 'Mathematics'"
    )
    level: str = Field(
        ...,
        description="Level like 'National 5'"
    )
    marks: int = Field(
        ...,
        ge=1,
        description="Total marks for this question"
    )

    # Content
    walkthrough: QuestionWalkthrough = Field(
        ...,
        description="The full walkthrough content"
    )

    # Status and versioning
    status: WalkthroughStatus = Field(
        ...,
        description="Publication status"
    )
    model_version: str = Field(
        ...,
        description="Version of the walkthrough author agent"
    )

    # Optional metadata
    generation_metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Token usage, cost, timestamp etc."
    )
    catalog_version: Optional[str] = Field(
        None,
        description="Catalog version from us_papers"
    )

    def generate_document_id(self) -> str:
        """Generate unique document ID for Appwrite (max 36 chars).

        Format: {paper_id}-q{question_number}
        Example: mathematics-n5-2023-X847-75-01-q4a

        Appwrite document IDs:
        - Max length: 36 characters (platform constraint)
        - Allowed chars: a-z, A-Z, 0-9, hyphen, underscore, period
        - Parentheses are removed
        - Leading Q/q prefix is stripped before adding standard q prefix

        For IDs exceeding 36 chars, uses MD5 hash suffix to maintain
        determinism for upserts while fitting within the limit.
        """
        import hashlib

        # Normalize question number for ID
        # 1. Lowercase and remove parentheses
        # 2. Strip leading "q" to avoid double-q when we add our prefix
        q_normalized = self.question_number.lower().replace("(", "").replace(")", "").lstrip("q")

        # Build the base ID
        base_id = f"{self.paper_id}-q{q_normalized}"

        # If within limit, return as-is
        if len(base_id) <= 36:
            return base_id

        # For long IDs: truncate + hash suffix for uniqueness
        # Hash the full ID to maintain determinism across runs
        hash_suffix = hashlib.md5(base_id.encode()).hexdigest()[:8]
        # Keep as much of original as possible: 36 - 1 (dash) - 8 (hash) = 27 chars
        truncated = base_id[:27]
        return f"{truncated}-{hash_suffix}"

    def compress_walkthrough(self) -> str:
        """Compress walkthrough content for storage.

        Returns base64-encoded gzip compressed JSON.
        """
        json_str = self.walkthrough.model_dump_json()
        compressed = gzip.compress(json_str.encode('utf-8'))
        return base64.b64encode(compressed).decode('utf-8')

    def to_appwrite_row(self) -> Dict[str, Any]:
        """Convert to dictionary for Appwrite row creation.

        Compresses walkthrough content and formats for storage.
        """
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        row = {
            "paper_id": self.paper_id,
            "question_number": self.question_number,
            "paper_code": self.paper_code,
            "year": self.year,
            "subject": self.subject,
            "level": self.level,
            "marks": self.marks,
            "walkthrough_content": self.compress_walkthrough(),
            "common_errors": json.dumps([e.model_dump() for e in self.walkthrough.common_errors]),
            "status": self.status,
            "model_version": self.model_version,
            "generation_metadata": json.dumps(self.generation_metadata) if self.generation_metadata else None,
            "catalog_version": self.catalog_version,
            "last_modified": now,
        }

        return row

    @classmethod
    def decompress_walkthrough(cls, compressed: str) -> QuestionWalkthrough:
        """Decompress walkthrough content from storage.

        Args:
            compressed: Base64-encoded gzip compressed JSON

        Returns:
            QuestionWalkthrough instance
        """
        decoded = base64.b64decode(compressed)
        decompressed = gzip.decompress(decoded)
        data = json.loads(decompressed.decode('utf-8'))
        return QuestionWalkthrough(**data)


# =============================================================================
# Source Data Models (from us_papers)
# =============================================================================

class GenericMark(BaseModel):
    """A bullet from the generic marking scheme."""
    bullet: int
    process: str


class IllustrativeMark(BaseModel):
    """A bullet from the illustrative marking scheme."""
    bullet: int
    answer: str
    answer_latex: Optional[str] = None
    condition: Optional[str] = None
    alternative: Optional[str] = None
    alternative_latex: Optional[str] = None


class EmbeddedSolution(BaseModel):
    """Solution structure from us_papers question data."""
    max_marks: int
    generic_scheme: List[GenericMark]
    illustrative_scheme: List[IllustrativeMark]
    notes: List[str] = Field(default_factory=list)


class SourceQuestion(BaseModel):
    """Question structure from us_papers for extraction."""
    number: str
    text: str
    text_latex: Optional[str] = None
    marks: Optional[int] = None
    has_parts: bool = False
    parts: List[Any] = Field(default_factory=list)
    topic_tags: List[str] = Field(default_factory=list)
    diagrams: List[Any] = Field(default_factory=list)
    solution: Optional[EmbeddedSolution] = None


# =============================================================================
# Execution Metadata Models (for observability, resume, debug)
# =============================================================================

class ExecutionStatus(str, Enum):
    """Status of an execution pipeline."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class StageStatus(str, Enum):
    """Status of a pipeline stage."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class InputContext(BaseModel):
    """Input parameters for the execution."""
    paper_id: str
    question_number: str
    paper_code: Optional[str] = None
    year: Optional[int] = None
    subject: Optional[str] = None
    level: Optional[str] = None


class QuestionContext(BaseModel):
    """Extracted question metadata."""
    marks: int
    topic_tags: List[str] = Field(default_factory=list)
    has_diagrams: bool = False
    is_sub_question: bool = False
    parent_question: Optional[str] = None


class SourceExtraction(BaseModel):
    """Metadata about source data extraction."""
    generic_scheme_bullets: int
    illustrative_scheme_bullets: int
    solution_notes_count: int
    extraction_warnings: List[str] = Field(default_factory=list)


class AgentConfig(BaseModel):
    """Agent configuration used for this execution."""
    model: str = "claude-sonnet-4-5"
    max_critic_retries: int = 3
    prompt_versions: Dict[str, str] = Field(default_factory=dict)


class BatchContext(BaseModel):
    """Context for batch processing (if part of a batch)."""
    batch_id: str
    batch_index: int
    batch_total: int
    batch_dir: Optional[str] = None


class CommandContext(BaseModel):
    """CLI command that triggered this execution."""
    invocation: str
    cli_args: Dict[str, Any] = Field(default_factory=dict)


class ExecutionManifest(BaseModel):
    """Full execution context written at START of pre-processing.

    This provides complete traceability for any workspace back to
    the original paper, question, and command that triggered it.
    """
    execution_id: str
    created_at: str  # ISO 8601 timestamp
    workspace_path: str

    input: InputContext
    question_context: QuestionContext
    source_extraction: SourceExtraction
    agent_config: AgentConfig

    batch_context: Optional[BatchContext] = None
    command: Optional[CommandContext] = None

    def to_file(self) -> str:
        """Serialize to JSON string for file writing."""
        return self.model_dump_json(indent=2)

    @classmethod
    def from_file(cls, content: str) -> "ExecutionManifest":
        """Deserialize from JSON string."""
        return cls.model_validate_json(content)


class StageTokens(BaseModel):
    """Token usage for a stage."""
    input: int = 0
    output: int = 0


class StageResult(BaseModel):
    """Result from critic stage."""
    pass_status: bool = Field(alias="pass")
    overall_score: Optional[float] = None
    dimensional_scores: Optional[Dict[str, float]] = None

    class Config:
        populate_by_name = True


class ExecutionStage(BaseModel):
    """A single stage in the execution log."""
    stage: str
    status: StageStatus
    started_at: str
    completed_at: Optional[str] = None
    duration_ms: Optional[int] = None

    # Stage-specific data
    files_created: Optional[List[str]] = None
    tokens: Optional[StageTokens] = None
    steps_generated: Optional[int] = None
    errors_generated: Optional[int] = None
    attempt: Optional[int] = None
    result: Optional[StageResult] = None
    appwrite_document_id: Optional[str] = None
    error_message: Optional[str] = None


class ExecutionTotals(BaseModel):
    """Aggregate metrics for the execution."""
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0
    critic_attempts: int = 0


class ExecutionLog(BaseModel):
    """Step-by-step progress updated during pipeline execution.

    This is written after each stage completes, allowing resume
    and debugging even if the pipeline crashes mid-execution.
    """
    execution_id: str
    status: ExecutionStatus
    started_at: str
    completed_at: Optional[str] = None
    duration_seconds: Optional[float] = None

    stages: List[ExecutionStage] = Field(default_factory=list)
    totals: ExecutionTotals = Field(default_factory=ExecutionTotals)

    def add_stage(self, stage: ExecutionStage):
        """Add a completed stage to the log."""
        self.stages.append(stage)

    def to_file(self) -> str:
        """Serialize to JSON string for file writing."""
        return self.model_dump_json(indent=2)

    @classmethod
    def from_file(cls, content: str) -> "ExecutionLog":
        """Deserialize from JSON string."""
        return cls.model_validate_json(content)


class OutputMetrics(BaseModel):
    """Output metrics from successful execution."""
    appwrite_document_id: Optional[str] = None
    steps_count: int = 0
    errors_count: int = 0
    total_marks: int = 0


class QualityMetrics(BaseModel):
    """Quality metrics from critic validation."""
    critic_passed: bool = False
    critic_attempts: int = 0
    final_scores: Optional[Dict[str, float]] = None


class ExecutionMetrics(BaseModel):
    """Execution performance metrics."""
    total_duration_seconds: float = 0.0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0


class FinalResult(BaseModel):
    """Final outcome written at END of execution.

    This provides a quick summary of success/failure with key metrics,
    useful for batch reporting and resume logic.
    """
    execution_id: str
    success: bool
    completed_at: str

    output: OutputMetrics = Field(default_factory=OutputMetrics)
    quality: QualityMetrics = Field(default_factory=QualityMetrics)
    metrics: ExecutionMetrics = Field(default_factory=ExecutionMetrics)

    error: Optional[str] = None

    def to_file(self) -> str:
        """Serialize to JSON string for file writing."""
        return self.model_dump_json(indent=2)

    @classmethod
    def from_file(cls, content: str) -> "FinalResult":
        """Deserialize from JSON string."""
        return cls.model_validate_json(content)


# =============================================================================
# Batch Metadata Models (for batch processing)
# =============================================================================

class BatchStatus(str, Enum):
    """Status of a batch processing job."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    COMPLETED_WITH_ERRORS = "completed_with_errors"
    FAILED = "failed"
    CANCELLED = "cancelled"


class BatchFilter(BaseModel):
    """Filter criteria used for batch selection."""
    subject: Optional[str] = None
    level: Optional[str] = None
    year: Optional[int] = None
    paper_id: Optional[str] = None


class BatchScope(BaseModel):
    """Scope of the batch (what will be processed)."""
    total_papers: int
    total_questions: int
    paper_ids: List[str] = Field(default_factory=list)


class BatchConfig(BaseModel):
    """Configuration for batch processing."""
    max_concurrent: int = 3
    force_regenerate: bool = False
    mcp_config_path: str = ".mcp.json"


class BatchManifest(BaseModel):
    """Batch context written at batch START.

    Provides complete information about what the batch will process,
    useful for resume and reporting.
    """
    batch_id: str
    created_at: str

    filter: BatchFilter
    cli_command: str
    scope: BatchScope
    config: BatchConfig

    def to_file(self) -> str:
        """Serialize to JSON string for file writing."""
        return self.model_dump_json(indent=2)

    @classmethod
    def from_file(cls, content: str) -> "BatchManifest":
        """Deserialize from JSON string."""
        return cls.model_validate_json(content)


class BatchCounts(BaseModel):
    """Current counts for batch progress."""
    total: int
    completed: int = 0
    failed: int = 0
    skipped: int = 0
    pending: int = 0


class CurrentProcessing(BaseModel):
    """Currently processing question."""
    paper_id: str
    question_number: str
    started_at: str
    execution_id: Optional[str] = None


class LastCompleted(BaseModel):
    """Last completed question."""
    paper_id: str
    question_number: str
    execution_id: str
    success: bool


class BatchProgress(BaseModel):
    """Live progress tracking updated during batch.

    Written after each question completes, allowing accurate
    progress reporting and resume capability.
    """
    batch_id: str
    updated_at: str
    status: BatchStatus

    counts: BatchCounts
    current_processing: List[CurrentProcessing] = Field(default_factory=list)
    last_completed: Optional[LastCompleted] = None

    def to_file(self) -> str:
        """Serialize to JSON string for file writing."""
        return self.model_dump_json(indent=2)

    @classmethod
    def from_file(cls, content: str) -> "BatchProgress":
        """Deserialize from JSON string."""
        return cls.model_validate_json(content)


class FailedQuestion(BaseModel):
    """A single failed question with details."""
    paper_id: str
    question_number: str
    execution_id: str
    failed_at: str
    error_type: str
    error_message: str
    critic_attempts: Optional[int] = None
    workspace_path: str


class FailedQuestions(BaseModel):
    """Persistent failure tracking for batch resume.

    Written immediately when a question fails, ensuring
    failures are preserved even if batch crashes.
    """
    batch_id: str
    updated_at: str

    failures: List[FailedQuestion] = Field(default_factory=list)
    retry_command: Optional[str] = None

    def add_failure(self, failure: FailedQuestion):
        """Add a failed question to the list."""
        self.failures.append(failure)
        self.updated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    def to_file(self) -> str:
        """Serialize to JSON string for file writing."""
        return self.model_dump_json(indent=2)

    @classmethod
    def from_file(cls, content: str) -> "FailedQuestions":
        """Deserialize from JSON string."""
        return cls.model_validate_json(content)


# =============================================================================
# File Name Constants
# =============================================================================

WALKTHROUGH_SOURCE_FILE = "walkthrough_source.json"
WALKTHROUGH_TEMPLATE_FILE = "walkthrough_template.json"
WALKTHROUGH_OUTPUT_FILE = "walkthrough_output.json"
COMMON_ERRORS_OUTPUT_FILE = "common_errors.json"
WALKTHROUGH_CRITIC_RESULT_FILE = "walkthrough_critic_result.json"

# Metadata file constants
EXECUTION_MANIFEST_FILE = "execution_manifest.json"
EXECUTION_LOG_FILE = "execution_log.json"
FINAL_RESULT_FILE = "final_result.json"

# Batch metadata file constants
BATCH_MANIFEST_FILE = "batch_manifest.json"
BATCH_PROGRESS_FILE = "progress.json"
FAILED_QUESTIONS_FILE = "failed_questions.json"
