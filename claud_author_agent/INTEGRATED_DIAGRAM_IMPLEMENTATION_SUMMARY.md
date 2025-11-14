# Integrated Lesson + Diagram Authoring Implementation Summary

**Date**: 2025-11-14
**Spec**: `tasks/integrated_lesson_diagram_authoring_spec.md`
**Status**: Core utilities and prompts completed, integration pending

---

## 1. Implementation Summary

### ✅ Completed Components

#### 1.1 Core Utility Modules

**Created: `src/utils/diagram_generator.py`**
- Orchestrates complete diagram generation pipeline (Phase 3)
- Handles JSXGraph JSON generation via subagent
- Renders PNG via DiagramScreenshot service (HTTP direct call)
- Iterative critique with 4D scoring (clarity, accuracy, pedagogy, aesthetics)
- Graceful failure mode: failed diagrams don't block lesson completion
- Max iterations: 3, score threshold: 0.85
- **Key Features**:
  - Per-card diagram generation with retry logic
  - Integration with diagram_generation_subagent and diagram_critic_subagent
  - Direct HTTP calls to DiagramScreenshot service (localhost:3001)
  - File-based PNG storage in workspace/diagrams/
  - Returns diagram_metadata with generation_status, visual_critique_score, critique_iterations

**Created: `src/utils/diagram_uploader.py`**
- Uploads diagram PNGs from workspace to Appwrite Storage (Phase 6)
- Updates lesson_template cards with image_file_id
- Removes local image_path references after upload
- Bucket: `lesson_diagrams` (needs to be created in Appwrite)
- Deterministic file IDs: `lesson_dgm_{hash}`
- Graceful failure: continues even if individual uploads fail
- **Key Features**:
  - Batch processing of all cards with successful diagrams
  - Uses Appwrite Python SDK directly
  - Idempotent uploads (re-creates file if exists)
  - Returns upload statistics (uploaded, failed, failed_card_ids)

#### 1.2 Enhanced Prompts

**Created: `src/prompts/lesson_author_prompt_v3.md`**
- Enhanced version of v2 with diagram planning integrated
- **New Step 4.2**: Diagram Planning after content authoring
  - Determine diagram eligibility (per-card analysis)
  - Write rich diagram_description (2-3 sentences)
  - Set diagram_context (6 context types)
  - Initialize diagram_metadata with pending status
- **New Fields**: diagram_eligible, diagram_description, diagram_context, diagram_metadata
- **Validation**: Includes diagram field validation in per-card checks
- Preserves all existing v2 functionality (Edit-first workflow, per-card validation, etc.)

**Created: `src/prompts/lesson_critic_prompt_v3.md`**
- Enhanced version of v2 with diagram coherence validation
- **New Dimension 2**: Lesson-Diagram Coherence (15% weight, ≥0.85 threshold)
  - 4 sub-dimensions:
    1. Pedagogical Alignment (30%): Does diagram support learning objective?
    2. Content Consistency (30%): Notation, variables, units consistent?
    3. Scottish Context Authenticity (20%): Realistic Scottish examples?
    4. Accessibility & Design Intent (20%): Clear, readable design?
  - Outputs diagrams_needing_regeneration array for revision loop
- **Updated Weights**:
  - SOW-Template Fidelity: 75% (unchanged)
  - Diagram Coherence: 15% (new)
  - Basic Quality: 10% (reduced from 25%)
- **Updated Formula**: `overall_score = (0.75 × fidelity) + (0.15 × diagram) + (0.10 × quality)`
- If no diagrams exist (all diagram_eligible=false), dimension scores 1.0 automatically

---

## 2. Integration Steps Required

### 2.1 Update `src/lesson_author_claude_client.py`

**Current State**: Uses lesson_author_prompt_v2.md and lesson_critic_prompt_v2.md

**Required Changes**:

#### Change 1: Update Subagent Definitions (Line 88-119)

```python
def _get_subagent_definitions(self) -> Dict[str, AgentDefinition]:
    """Load subagent definitions with prompts."""
    prompts_dir = Path(__file__).parent / "prompts"

    # Load 5 subagents (added diagram generation + diagram critic)
    subagents = {
        "research_subagent": AgentDefinition(
            description="Research subagent for answering clarifications with Scottish context",
            prompt=(prompts_dir / "research_subagent_prompt.md").read_text()
        ),
        "lesson_author": AgentDefinition(
            description="Lesson author v3 for creating lesson templates with diagram planning",
            prompt=(prompts_dir / "lesson_author_prompt_v3.md").read_text()  # v2 → v3
        ),
        "combined_lesson_critic": AgentDefinition(
            description="Combined lesson critic v3 with diagram coherence validation",
            prompt=(prompts_dir / "lesson_critic_prompt_v3.md").read_text()  # v2 → v3
        ),
        # NEW: Diagram generation subagent
        "diagram_generation_subagent": AgentDefinition(
            description="Generates JSXGraph JSON diagrams for lesson cards",
            prompt=(prompts_dir / "diagram_generation_subagent.md").read_text()
        ),
        # NEW: Diagram critic subagent
        "diagram_critic_subagent": AgentDefinition(
            description="Critiques diagrams across 4 dimensions (clarity, accuracy, pedagogy, aesthetics)",
            prompt=(prompts_dir / "visual_critic_subagent.md").read_text()
        )
    }

    logger.info(f"Loaded {len(subagents)} subagent definitions")
    return subagents
```

#### Change 2: Register DiagramScreenshot MCP Tool (Line 235-239)

```python
# Import diagram screenshot tool
from .tools.diagram_screenshot_tool import create_diagram_screenshot_server_with_workspace

mcp_servers_for_lesson_author = {
    "validator": validation_server,
    # NEW: Register diagram screenshot MCP with workspace path
    "diagram-screenshot": create_diagram_screenshot_server_with_workspace(str(workspace_path))
}
logger.info("Registered validator + diagram-screenshot MCP tools")
```

#### Change 3: Add Diagram Screenshot Tool to Allowed Tools (Line 282-288)

```python
allowed_tools=[
    'Read', 'Write', 'Edit', 'Glob', 'Grep', 'TodoWrite', 'Task',
    'WebSearch', 'WebFetch',
    'mcp__validator__validate_lesson_template',
    'mcp__diagram-screenshot__render_diagram'  # NEW
],
```

#### Change 4: Add DiagramScreenshot Health Check (After Line 267, Before SDK Client Creation)

```python
# ═══════════════════════════════════════════════════════════════
# Health Check: DiagramScreenshot Service
# ═══════════════════════════════════════════════════════════════
logger.info("Checking DiagramScreenshot service health...")

from .tools.diagram_screenshot_tool import check_diagram_service_health

health_result = check_diagram_service_health()

if not health_result.get("available", False):
    logger.warning(
        f"⚠️ DiagramScreenshot service NOT available: {health_result.get('error', 'Unknown error')}"
    )
    logger.warning(f"   URL: {health_result.get('url', 'http://localhost:3001')}")
    logger.warning("   Diagrams will be skipped if service is unavailable during execution")
else:
    logger.info(f"✅ DiagramScreenshot service available at: {health_result['url']}")
```

#### Change 5: Add Phase 3 - Diagram Generation (After Line 353, Before Python Upserting)

```python
# ═══════════════════════════════════════════════════════════════
# PHASE 3: Diagram Generation (NEW)
# ═══════════════════════════════════════════════════════════════
logger.info("Phase 3: Generating diagrams for eligible cards...")

from .utils.diagram_generator import DiagramGenerator

# Initialize diagram generator
diagram_generator = DiagramGenerator(
    mcp_config_path=self.mcp_config_path,
    workspace_path=workspace_path,
    max_iterations=3,
    score_threshold=0.85
)

# Load lesson_template.json
lesson_template_path = workspace_path / "lesson_template.json"
with open(lesson_template_path, 'r') as f:
    lesson_template = json.load(f)

# Generate diagrams (graceful failure)
try:
    diagram_result = await diagram_generator.generate_diagrams_for_lesson(
        lesson_template=lesson_template,
        subagent_definitions=self._get_subagent_definitions(),
        mcp_servers=mcp_servers_for_lesson_author
    )

    logger.info(
        f"✅ Phase 3 complete: {diagram_result['diagrams_generated']}/{diagram_result['total_eligible']} diagrams generated"
    )

    if diagram_result['diagrams_failed'] > 0:
        logger.warning(
            f"⚠️ {diagram_result['diagrams_failed']} diagrams failed (graceful degradation): "
            f"{diagram_result['failed_card_ids']}"
        )

except Exception as e:
    logger.error(f"❌ Phase 3 diagram generation failed: {e}", exc_info=True)
    logger.warning("Continuing without diagrams (graceful degradation)")
```

#### Change 6: Update Initial Prompt to Reference v3 (Line 668)

```python
# In _build_initial_prompt method, change references:
- "See lesson_author_prompt_v2.md for detailed instructions."
+ "See lesson_author_prompt_v3.md for detailed instructions (with diagram planning)."

# Update subagent descriptions:
- "**Task**: Fill blank lesson template using pre-loaded files + research"
+ "**Task**: Fill blank lesson template + determine diagram eligibility for each card"

# Add diagram planning step:
  6. For EACH card:
     a. Fill all fields (use Edit, or Write if Edit causes syntax errors)
     b. **🎨 Determine diagram eligibility and add diagram fields**
     c. **🚨 VALIDATE using mcp__validator__validate_lesson_template**
     d. **Save validation result to /workspace/validation_result.json**
     e. Fix any errors and re-validate this card
     f. Mark card complete and move to next card
```

### 2.2 Update `src/utils/lesson_upserter.py`

**Current State**: Compresses and uploads lesson_template.json without diagram handling

**Required Changes**:

#### Add Diagram Upload Call (Before Compression)

```python
async def upsert_lesson_template(
    lesson_template_path: str,
    courseId: str,
    order: int,
    execution_id: str,
    mcp_config_path: str,
    authored_sow_id: str,
    authored_sow_version: str
) -> str:
    """Upsert lesson template with embedded diagrams to Appwrite."""
    from pathlib import Path
    import json
    from .compression import compress_json_gzip_base64
    from .diagram_uploader import upload_diagrams_to_storage  # NEW IMPORT

    # Load lesson template
    with open(lesson_template_path, 'r') as f:
        lesson_template = json.load(f)

    workspace_path = Path(lesson_template_path).parent

    # ═══════════════════════════════════════════════════════════════
    # NEW: Upload diagram PNGs to Appwrite Storage
    # ═══════════════════════════════════════════════════════════════
    logger.info("Uploading diagram PNGs to Appwrite Storage...")

    try:
        upload_result = await upload_diagrams_to_storage(
            lesson_template=lesson_template,
            workspace_path=workspace_path,
            mcp_config_path=mcp_config_path
        )

        logger.info(
            f"Diagram upload: {upload_result['uploaded']} succeeded, "
            f"{upload_result['failed']} failed"
        )

        # Update lesson_template.json with image_file_id references
        with open(lesson_template_path, 'w') as f:
            json.dump(lesson_template, f, indent=2)

    except Exception as e:
        logger.error(f"❌ Diagram upload failed: {e}", exc_info=True)
        logger.warning("Continuing with lesson upsert despite diagram upload failure")

    # Compress lesson template (existing code continues...)
    lesson_json = json.dumps(lesson_template)
    compressed_lesson = compress_json_gzip_base64(lesson_json)

    # Count successful diagrams
    diagrams_count = sum(
        1 for card in lesson_template.get("cards", [])
        if card.get("diagram_metadata", {}).get("generation_status") == "success"
    )

    # Prepare document data
    document_data = {
        "courseId": courseId,
        "sow_order": order,
        "lessonTemplateId": lesson_template.get("lessonTemplateId"),
        "lesson_template_compressed": compressed_lesson,
        "execution_id": execution_id,
        "authored_sow_id": authored_sow_id,
        "authored_sow_version": authored_sow_version,
        "diagrams_count": diagrams_count  # NEW FIELD
    }

    # ... rest of existing upsert code
```

### 2.3 Create Appwrite Infrastructure

**Required**: Storage bucket for diagram PNGs

```bash
# Create storage bucket via Appwrite Console or SDK:
# - Bucket ID: "lesson_diagrams"
# - Max file size: 10 MB
# - Allowed file extensions: ["png"]
# - Permissions: Read access for authenticated users
```

**Required**: Update lesson_templates collection schema

```bash
# Add new attribute to default.lesson_templates:
# - diagrams_count (integer, default: 0)
```

---

## 3. Outstanding Issues

### 3.1 Diagram Generation Subagent Integration

**Issue**: The `diagram_generator.py` calls subagents but the subagents are not yet tested in the integrated context.

**Solution Needed**:
- Test diagram_generation_subagent with lesson card context
- Test diagram_critic_subagent with PNG file input
- Verify subagent workspace access patterns

**Workaround**: The subagent definitions exist (from diagram_author), just need to verify they work in integrated context.

### 3.2 DiagramScreenshot Service Dependency

**Issue**: System assumes DiagramScreenshot service is running at http://localhost:3001

**Solution**: Health check added (warns if unavailable), graceful degradation implemented

**Required Setup**:
1. Start DiagramScreenshot service before running lesson author
2. Or accept that diagrams will be skipped if service is down

### 3.3 Phase 5 Revision Loop Not Implemented

**Issue**: The spec requires auto-regeneration of diagrams when lesson content changes during critic revisions.

**Current State**: Phase 5 logic is NOT implemented in the integration steps above.

**Required Implementation**:
After combined_lesson_critic fails, the revision loop should:
1. Identify cards_with_content_changes
2. Combine with diagrams_needing_regeneration from critic
3. Regenerate diagrams for affected cards
4. Re-run critic

**Code Stub** (to be added after Phase 4 critic execution):

```python
# After critic execution...
if not critic_result.get("pass", False):
    logger.info("Starting revision loop (Phase 5)...")

    revision_count = 0

    while revision_count < self.max_critic_retries:
        revision_count += 1
        logger.info(f"Revision iteration {revision_count}/{self.max_critic_retries}")

        # Extract feedback
        cards_to_revise = critic_result.get("cards_needing_revision", [])
        diagrams_to_regenerate = critic_result.get("diagrams_needing_regeneration", [])

        # Track content changes
        cards_with_content_changes = set()

        # Revise lesson content (existing logic - needs implementation)
        for card_id in cards_to_revise:
            # TODO: Call lesson_author subagent for targeted revision
            cards_with_content_changes.add(card_id)

        # Auto-regenerate diagrams
        all_diagrams_to_regenerate = set(diagrams_to_regenerate) | cards_with_content_changes

        # Filter to diagram-eligible cards
        all_diagrams_to_regenerate = {
            card_id for card_id in all_diagrams_to_regenerate
            if any(
                card.get("id") == card_id and card.get("diagram_eligible", False)
                for card in lesson_template.get("cards", [])
            )
        }

        if all_diagrams_to_regenerate:
            logger.info(f"Regenerating {len(all_diagrams_to_regenerate)} diagrams...")

            for card_id in all_diagrams_to_regenerate:
                card = next((c for c in lesson_template["cards"] if c["id"] == card_id), None)
                if not card:
                    continue

                try:
                    diagram_metadata = await diagram_generator._generate_single_diagram(
                        card=card,
                        lesson_template=lesson_template,
                        subagent_definitions=self._get_subagent_definitions(),
                        mcp_servers=mcp_servers_for_lesson_author
                    )

                    card["diagram_metadata"] = diagram_metadata
                    logger.info(f"✅ Regenerated diagram for {card_id}")

                except Exception as e:
                    logger.error(f"❌ Regeneration failed for {card_id}: {e}")
                    card["diagram_metadata"] = {
                        "generation_status": "failed",
                        "error_message": f"Regeneration failed: {str(e)}"
                    }

        # Re-run critic
        # TODO: Implement critic re-execution
        # Break if critic passes
        if critic_result.get("pass", False):
            logger.info(f"✅ Lesson passed critic after {revision_count} revisions")
            break

    # Check if max revisions exceeded
    if revision_count >= self.max_critic_retries and not critic_result.get("pass", False):
        raise Exception(f"Lesson failed after {self.max_critic_retries} revisions")
```

### 3.4 Missing Diagram Subagent Prompts

**Issue**: The diagram_generation_subagent.md and visual_critic_subagent.md exist in src/prompts/ (from diagram_author), but may need adaptation for integrated context.

**Solution**: Verify existing prompts work, or create adapted versions.

**Files**:
- `src/prompts/diagram_generation_subagent.md` (exists)
- `src/prompts/visual_critic_subagent.md` (exists)

### 3.5 Token Budget Management

**Issue**: Adding diagram generation significantly increases token usage.

**Estimated Impact** (per lesson with 5 diagrams):
- Phase 3 Diagram Generation: +100,000 tokens (~$0.30)
- Phase 3 Diagram Critique: +100,000 tokens (~$0.30)
- Total increase: ~+200,000 tokens (~$0.60)

**Mitigation**: Already implemented graceful failure, so failed diagrams don't retry infinitely.

---

## 4. Test Procedure

### 4.1 Pre-Test Setup

**Step 1: Start DiagramScreenshot Service**
```bash
# Navigate to diagram screenshot service directory
cd <diagram-screenshot-service-path>

# Start service on port 3001
npm start

# Verify health endpoint
curl http://localhost:3001/health
```

**Step 2: Create Appwrite Storage Bucket**
```bash
# Via Appwrite Console:
# 1. Navigate to Storage section
# 2. Create bucket "lesson_diagrams"
# 3. Set max file size: 10 MB
# 4. Allowed extensions: png
# 5. Permissions: Read for authenticated users
```

**Step 3: Update lesson_templates Collection**
```bash
# Via Appwrite Console:
# 1. Navigate to Database → default → lesson_templates
# 2. Add attribute: diagrams_count (integer, default: 0)
```

### 4.2 Test Case 1: Happy Path (12 Cards, 5 Diagrams)

**Objective**: Verify complete pipeline with successful diagram generation

**Input**:
```json
{
  "courseId": "course_mathematics_nat5",
  "order": 3
}
```

**Expected Output**:
- lesson_template.json with 12 cards
- 5 cards with diagram_eligible=true
- 5 successful diagrams (generation_status="success")
- visual_critique_score ≥ 0.85 for all diagrams
- diagrams_count=5 in Appwrite document
- 5 PNG files in Appwrite Storage (bucket: lesson_diagrams)

**Success Criteria**:
- [ ] Pipeline completes without errors
- [ ] lesson_template.json has diagram_metadata for eligible cards
- [ ] PNG files exist in workspace/diagrams/ before upload
- [ ] PNG files uploaded to Appwrite Storage with image_file_id
- [ ] Lesson document has diagrams_count=5
- [ ] Total cost within expected range ($1.50-$2.50)

### 4.3 Test Case 2: No Diagrams (Pure Algebraic Lesson)

**Objective**: Verify graceful handling when no cards are diagram-eligible

**Input**:
```json
{
  "courseId": "course_mathematics_nat5",
  "order": 8
}
```

**SOW Design**: Pure algebraic manipulation lesson (no visual concepts)

**Expected Output**:
- lesson_template.json with 12 cards
- 0 cards with diagram_eligible=true
- diagram_coherence_score = 1.0 (automatic perfect score)
- diagrams_count=0 in Appwrite document

**Success Criteria**:
- [ ] Pipeline completes without errors
- [ ] Critic passes with diagram_coherence_score=1.0
- [ ] No diagram generation attempts made
- [ ] Cost similar to v2 pipeline (~$0.90-$1.50)

### 4.3 Test Case 3: DiagramScreenshot Service Down

**Objective**: Verify graceful degradation when service unavailable

**Setup**: Stop DiagramScreenshot service before execution

**Expected Output**:
- Health check warns service unavailable
- Pipeline continues with lesson authoring
- Diagram generation attempts fail gracefully
- All diagrams marked as generation_status="failed"
- Lesson still completes and uploads
- diagrams_count=0 (no successful diagrams)

**Success Criteria**:
- [ ] Pipeline does NOT crash
- [ ] Warnings logged for service unavailability
- [ ] Lesson template still created and uploaded
- [ ] Failed diagrams documented with error_message
- [ ] Critic handles missing diagrams appropriately

### 4.4 Test Case 4: Diagram Coherence Failure

**Objective**: Verify revision loop with diagram regeneration

**Setup**: Manually edit lesson_template.json after authoring to create diagram inconsistencies

**Expected Behavior**:
- Critic fails with diagram_coherence_score < 0.85
- diagrams_needing_regeneration array populated
- **NOTE**: Phase 5 revision loop NOT YET IMPLEMENTED
- Current behavior: Pipeline fails, manual retry needed

**Success Criteria** (when Phase 5 implemented):
- [ ] Critic identifies diagram issues
- [ ] Diagrams regenerated automatically
- [ ] Critic re-runs and passes
- [ ] Final lesson has coherent diagrams

### 4.5 Test Case 5: Mixed Success (3 Diagrams Success, 2 Fail)

**Objective**: Verify partial diagram generation doesn't block lesson completion

**Setup**: Inject errors in 2 diagram_description fields to cause generation failures

**Expected Output**:
- 3 diagrams with generation_status="success"
- 2 diagrams with generation_status="failed" and error_message
- Lesson still completes
- diagrams_count=3 in Appwrite document
- Critic evaluates only successful diagrams for coherence

**Success Criteria**:
- [ ] Pipeline completes successfully
- [ ] 3 PNG files uploaded to Storage
- [ ] 2 failed diagrams documented with errors
- [ ] Lesson usable despite partial diagram failures

---

## 5. Performance Metrics

### 5.1 Expected Token Usage (Per Lesson)

| Phase | v2 (No Diagrams) | v3 (With 5 Diagrams) | Increase |
|-------|------------------|----------------------|----------|
| Pre-processing | 0 | 0 | - |
| Phase 1: Research | 5,000-10,000 | 5,000-10,000 | - |
| Phase 2: Lesson Author | 50,000-80,000 | 55,000-88,000 | +10% |
| Phase 3: Diagram Generation | - | 100,000 | NEW |
| Phase 3: Diagram Critique | - | 100,000 | NEW |
| Phase 4: Combined Critic | 12,000-15,000 | 12,000-15,000 | - |
| Phase 5: Revision | 20,000 (if needed) | 30,000 (if needed) | +50% |
| Phase 6: Post-processing | 0 | 0 | - |
| **Total** | **87,000-125,000** | **302,000-343,000** | **+246%** |

### 5.2 Expected Cost (Per Lesson)

**v2 (No Diagrams)**: $0.90-$1.50
**v3 (With 5 Diagrams)**: $1.50-$2.50
**Increase**: +$0.60-$1.00 per lesson (+66%)

**Cost Breakdown** (v3):
- Lesson authoring: $0.20
- Diagram generation: $0.30
- Diagram critique: $0.30
- Combined critic: $0.05
- Revision (if needed): $0.10
- **Total**: ~$0.95-$2.50

### 5.3 Expected Execution Time

**v2 (No Diagrams)**: 2-4 minutes
**v3 (With 5 Diagrams)**: 12-20 minutes
**Increase**: +10-16 minutes (+400%)

**Time Breakdown** (v3):
- Lesson authoring: 3-5 minutes
- Diagram generation (5 diagrams × 2 iterations): 10-15 minutes
- Combined critic: 2-3 minutes
- Revision (if needed): 3-5 minutes
- Upload: 1 minute

---

## 6. Next Steps

### 6.1 Immediate Actions (Before First Test)

1. **Apply Integration Changes**:
   - [ ] Update lesson_author_claude_client.py with 6 changes listed in Section 2.1
   - [ ] Update lesson_upserter.py with diagram upload call (Section 2.2)
   - [ ] Commit changes to git branch

2. **Setup Infrastructure**:
   - [ ] Start DiagramScreenshot service on port 3001
   - [ ] Create "lesson_diagrams" storage bucket in Appwrite
   - [ ] Add diagrams_count attribute to lesson_templates collection

3. **Run Test Case 2** (No Diagrams):
   - Easiest test to verify v3 prompts don't break existing functionality
   - Should behave identically to v2 but with v3 prompts
   - Validates prompt compatibility before testing diagram features

4. **Run Test Case 1** (Happy Path):
   - Full test of diagram generation pipeline
   - Verifies all 6 phases work together
   - Identifies integration issues

### 6.2 Follow-On Implementation (Phase 5 Revision Loop)

**Priority**: HIGH (spec requires this for auto-regeneration)

**Tasks**:
1. [ ] Implement revision loop logic after critic failure
2. [ ] Track cards_with_content_changes during revision
3. [ ] Combine with diagrams_needing_regeneration from critic
4. [ ] Call diagram_generator._generate_single_diagram for affected cards
5. [ ] Re-run critic after regeneration
6. [ ] Test with Test Case 4 (Diagram Coherence Failure)

### 6.3 Optimization Opportunities (Future)

**Not Required for MVP, but mentioned in spec**:

1. **Parallel Diagram Generation** (Section 5.3 of spec):
   - Generate multiple diagrams concurrently
   - Reduce Phase 3 time by 40-60%

2. **Diagram Pattern Caching**:
   - Reuse JSXGraph templates for similar cards
   - Reduce tokens by 20-30%

3. **Tiered Critique**:
   - Skip critic for simple diagrams
   - Reduce tokens by 30-40%

4. **Lazy Diagram Generation**:
   - Generate diagrams only after critic passes
   - Avoid wasted regenerations

---

## 7. File Inventory

### 7.1 New Files Created

```
claud_author_agent/
├── src/
│   ├── utils/
│   │   ├── diagram_generator.py          # NEW - Phase 3 orchestrator
│   │   └── diagram_uploader.py           # NEW - Phase 6 Storage uploader
│   └── prompts/
│       ├── lesson_author_prompt_v3.md    # NEW - Enhanced with diagram planning
│       └── lesson_critic_prompt_v3.md    # NEW - Enhanced with diagram coherence
└── INTEGRATED_DIAGRAM_IMPLEMENTATION_SUMMARY.md  # THIS FILE
```

### 7.2 Files Requiring Modification

```
claud_author_agent/
├── src/
│   ├── lesson_author_claude_client.py    # MODIFY - Integrate 6 phases
│   └── utils/
│       └── lesson_upserter.py            # MODIFY - Add diagram upload call
```

### 7.3 Existing Files Reused

```
claud_author_agent/
├── src/
│   ├── prompts/
│   │   ├── diagram_generation_subagent.md   # REUSE from diagram_author
│   │   └── visual_critic_subagent.md        # REUSE from diagram_author
│   └── tools/
│       └── diagram_screenshot_tool.py       # REUSE - already has health check
```

---

## 8. Success Criteria

### 8.1 Functional Requirements

- [ ] Lesson authoring completes with diagram planning (Phase 2)
- [ ] Diagrams generate for eligible cards (Phase 3)
- [ ] Diagrams critique iteratively (Phase 3)
- [ ] Combined critic validates diagram coherence (Phase 4)
- [ ] Diagrams upload to Appwrite Storage (Phase 6)
- [ ] Graceful failure when DiagramScreenshot unavailable
- [ ] Graceful failure for individual diagram generation errors
- [ ] lesson_template.json includes all diagram metadata
- [ ] Appwrite document has diagrams_count field
- [ ] Cost within expected range ($1.50-$2.50 for 5 diagrams)

### 8.2 Quality Requirements

- [ ] All new code follows existing patterns (async/await, logging, error handling)
- [ ] Graceful degradation implemented (no hard failures on diagram issues)
- [ ] Comprehensive logging at INFO level for debugging
- [ ] Error messages actionable and specific
- [ ] No token budget overruns (stay within 500K per lesson)

### 8.3 Documentation Requirements

- [x] Implementation summary created (this document)
- [ ] Integration steps tested and verified
- [ ] Test procedure documented with expected outcomes
- [ ] Outstanding issues clearly identified
- [ ] Follow-on implementation tasks prioritized

---

## 9. Risk Assessment

| Risk | Impact | Probability | Mitigation Status |
|------|--------|-------------|-------------------|
| DiagramScreenshot service down | Medium | Low | ✅ Health check + graceful degradation implemented |
| Diagram generation failures | Low | Medium | ✅ Graceful failure per-card, lesson continues |
| Token budget overrun | High | Low | ⚠️ Monitor actual usage in tests |
| Integration complexity | High | High | ⚠️ Incremental testing required (Test Case 2 first) |
| Phase 5 revision loop missing | High | Certain | ❌ Not yet implemented |
| Subagent context issues | Medium | Medium | ⚠️ Needs testing in integrated context |
| Appwrite Storage setup | Low | Low | ✅ Clear setup instructions provided |

---

## 10. Conclusion

**Implementation Status**: 70% Complete

**Core utilities and prompts are ready**. Integration into lesson_author_claude_client.py requires:
1. 6 targeted changes (well-documented above)
2. Infrastructure setup (DiagramScreenshot + Appwrite Storage)
3. Phased testing starting with Test Case 2 (no diagrams)

**Critical Gap**: Phase 5 revision loop with auto-regeneration not implemented. This is required by spec but can be added after basic integration is tested.

**Recommended Path**:
1. Apply integration changes (Section 2.1-2.2)
2. Run Test Case 2 to validate v3 prompts work
3. Setup infrastructure (DiagramScreenshot + Storage)
4. Run Test Case 1 to validate diagram pipeline
5. Implement Phase 5 revision loop
6. Run Test Case 4 to validate auto-regeneration

**Estimated Completion Time**:
- Integration changes: 2-3 hours
- Testing & debugging: 3-5 hours
- Phase 5 implementation: 2-3 hours
- **Total**: 7-11 hours

---

**Questions or Issues?** Refer to spec: `tasks/integrated_lesson_diagram_authoring_spec.md`
