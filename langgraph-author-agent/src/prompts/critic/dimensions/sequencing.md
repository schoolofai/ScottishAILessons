# Dimension 2: Sequencing - Detailed Validation

**Threshold**: ≥0.80
**Purpose**: Validate logical ordering, prerequisite relationships, and realistic lesson_type cadence

---

## Validation Criteria (Comprehensive)

### Course Structure Sequencing
- SoW follows `recommended_sequence` from Course_data.txt
- SoW respects `sequence_rationale` from Course_data.txt
- Units ordered according to SQA guidelines

### Prerequisite Logic
- Prerequisites (`coherence.prerequisites`) are correctly ordered
- Each entry's prerequisites must come earlier in the sequence (lower `order` field)
- No circular dependencies

### Block Progression
- `coherence.block_index` progresses logically and consistently
- Block indices are ascending (e.g., "1.1", "1.2", "2.1", "2.2")
- Transparent ordering for visual clarity

### Lesson Type Cadence
- Lesson_type cadence is realistic and varied across the SoW
- Not repetitive (e.g., avoid 5 consecutive teach lessons without practice)
- Follows pedagogical progression patterns

### Teach→Revision Pairing Validation
- **Mandatory pairing**: Every teach lesson MUST be immediately followed (or closely followed) by its corresponding revision lesson
- **Ordering check**: teach→revision should be consecutive or have minimal gap (no more than 1-2 intervening lessons)
- **Pairing count**: Number of teach lessons must equal number of revision lessons (1:1 ratio)

### Chunked Lesson Block Validation
- **Thematic coherence**: Consolidated standards (2-3, or up to 5 if justified) must have clear pedagogical justification
- **Lesson type sequencing within blocks**: Must follow mandatory teach→revision pairing, then formative_assessment → independent_practice
- **Standards sequencing within blocks**: Prerequisites must come first (foundational before advanced)

### Metadata Alignment
- Metadata sequencing notes in `metadata.sequencing_notes` are honored
- Alignment with `delivery_notes` (e.g., interdisciplinary opportunities, ICT use)

### Enriched Format Validation
- assessmentStandardRefs are objects (code, description, outcome) - NOT bare codes
- Lesson plan presence: Every entry has lesson_plan with 6-12 detailed cards

---

## Validation Process (Step-by-Step)

1. **Validate unit sequence follows recommended_sequence**
   - Read Course_data.txt `course_structure.recommended_sequence`
   - Compare SoW entry order to recommended sequence
   - Flag any violations (e.g., Unit 3 before Unit 1)

2. **Check prerequisite logic**: each entry's `prerequisites` must come earlier
   - For each entry with `coherence.prerequisites`:
     * Extract prerequisite references (order or label)
     * Verify prerequisite entries have lower `order` field values
     * Flag any prerequisite appearing after dependent entry

3. **Validate block_index**: ascending, transparent ordering
   - Extract all `coherence.block_index` values
   - Verify ascending progression (1.1, 1.2, 1.3, 2.1, 2.2, etc.)
   - Flag non-ascending or inconsistent block indices

4. **Evaluate lesson_type cadence** (varied, not repetitive) and validate teach→revision pairing:
   - Extract lesson_type sequence across all entries
   - Check for repetitive patterns (e.g., "teach, teach, teach, teach")
   - **Teach→revision pairing check**:
     * For each teach lesson, identify its position (`order` field)
     * Search for corresponding revision lesson
     * Verify revision appears soon after teach (consecutive or minimal gap)
     * Flag if revision appears before teach or is missing entirely
   - **Pairing count check**:
     * Count total teach lessons
     * Count total revision lessons
     * Verify counts are equal (1:1 ratio)

5. **Validate chunked sequences**:
   - Identify consolidated lesson blocks (entries with 2+ assessmentStandardRefs)
   - For each block:
     * **Thematic coherence**: Verify standards are related (share contexts, build progressively)
     * **Lesson type ordering**: Confirm teach→revision→formative→independent sequence within block
     * **Standards ordering**: Verify prerequisites come before advanced standards within block

6. **Validate enriched format and guidance presence**
   - Check entry-level assessmentStandardRefs use objects (code/description/outcome)
   - Verify lesson_plan exists with 6-12 cards
   - Check card-level standards_addressed use enriched objects

7. **Check alignment with delivery_notes**
   - Read Course_data.txt `delivery_notes`
   - Verify SoW incorporates interdisciplinary opportunities, ICT use, etc.

---

## Common Issues to Flag

### Sequencing Violations
- **Unit sequence doesn't follow recommended_sequence**: Units ordered incorrectly
- **Prerequisites reference later lessons**: Dependent entry appears before prerequisite entry
- **Block_index non-ascending or inconsistent**: e.g., "1.1, 1.3, 1.2" or "A, B, 1"

### Lesson Type Issues
- **Lesson_type cadence repetitive or unrealistic**: e.g., 8 consecutive teach lessons with no practice
- **Teach→revision pairing broken**:
  * Teach lesson NOT followed by revision lesson
  * Revision lesson appears before its corresponding teach lesson
  * Teach:revision ratio not 1:1 (e.g., 10 teach, 5 revision)

### Chunked Lesson Block Issues
- **Standards lack thematic coherence**: Unrelated standards grouped together (e.g., fractions + trigonometry)
- **Lesson types within blocks out of order**: e.g., independent_practice before teach lesson
- **Standards within block violate prerequisites**: Advanced standard before foundational standard

### Format and Guidance Issues
- **Missing enriched format**: Bare codes instead of objects
- **Missing lesson_plan**: Entry lacks detailed card structure
- **Missing guidance fields**: coherence, lesson_instruction, etc.

---

## Scoring Guidance

**Suggested Weights** (adjust based on priorities):

| Criterion | Weight | Pass Condition |
|-----------|--------|----------------|
| Unit sequence follows recommended | 0.20 | Exact match |
| Prerequisite logic correct | 0.20 | No circular deps, correct ordering |
| Block_index ascending | 0.10 | Consistent, transparent |
| Lesson_type cadence varied | 0.15 | No excessive repetition |
| Teach→revision pairing valid | 0.20 | Every teach followed by revision, 1:1 ratio |
| Chunked sequences coherent | 0.10 | Thematic, ordered, prerequisites respected |
| Enriched format present | 0.05 | Entry AND card level |

**Scoring Calculation**:
- Start with 1.0 (perfect)
- Deduct weighted penalties for each violation
- Floor at 0.0

**Pass Threshold**: ≥0.80
