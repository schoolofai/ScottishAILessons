# Multi-Diagram Support Refactor Plan

**Date**: 2025-01-21
**Status**: Planning
**Problem**: Agent tries to cram multiple logical diagrams into one image, resulting in poor quality visualizations

---

## Problem Statement

### Current Behavior
- Agent generates **ONE diagram per card** (per diagram_context)
- When card requires multiple diagrams (e.g., Q2: bar chart, Q4: rainfall chart), agent combines them into **one image**
- **Result**: Poor quality, cluttered, hard-to-read diagrams

### Example
![Bad Multi-Diagram Example](../example_bad_multi_diagram.png)
*Q2: Team Goals Bar Chart + Q4: Rainfall Bar Chart + Pie Chart all crammed into one image*

### Root Cause
- Database constraint: ONE `image_file_id` per (lessonTemplateId, cardId, diagram_context)
- Prompt doesn't instruct agent to generate multiple separate diagrams
- Upserter only handles single diagram output per card

---

## Solution: Add `diagram_index` Field

### Approach
Add `diagram_index` integer field to support N diagrams per card, where each diagram is a **separate document** with its own `image_file_id`.

**New Unique Constraint**: `(lessonTemplateId, cardId, diagram_context, diagram_index)`

### Why This is the Simplest Approach

✅ **Minimal schema change** - Add ONE integer field
✅ **Backward compatible** - Existing diagrams get `diagram_index = 0` by default
✅ **No array handling** - Each diagram remains a separate document (simpler queries)
✅ **Simple upserter logic** - Loop through diagrams, increment index
✅ **No data migration** - Old diagrams work as-is

### Alternative Approaches (Rejected)

#### ❌ Option A: Change `image_file_id` from string to array
- **Cons**: Schema migration needed, complex array handling in queries, more upserter complexity
- **Why rejected**: Arrays in document fields are harder to query and update

#### ❌ Option B: New `lesson_diagram_variants` collection
- **Cons**: Additional collection, foreign keys, complex joins
- **Why rejected**: Over-engineered for simple use case

---

## Implementation Plan

### Phase 1: Database Schema (MUST BE FIRST)

#### Step 1.1: Add `diagram_index` Attribute

**Via Appwrite Console (Recommended)**:
1. Navigate to **Databases** → `default` → `lesson_diagrams` → **Attributes**
2. Click **+ Create Attribute** → **Integer**
3. Configuration:
   - **Key**: `diagram_index`
   - **Min**: `0`
   - **Max**: `10` (reasonable limit - most cards need 1-3 diagrams)
   - **Required**: No (backward compatibility)
   - **Default**: `0` (existing diagrams)
   - **Array**: No

**Via Appwrite CLI**:
```bash
appwrite databases createIntegerAttribute \
    --databaseId default \
    --collectionId lesson_diagrams \
    --key diagram_index \
    --min 0 \
    --max 10 \
    --required false \
    --default 0
```

#### Step 1.2: Update Unique Index

**CRITICAL**: Update the unique constraint to include `diagram_index`

**Current Index**: `(lessonTemplateId, cardId, diagram_context)`
**New Index**: `(lessonTemplateId, cardId, diagram_context, diagram_index)`

**Via Appwrite Console**:
1. Go to **Databases** → `default` → `lesson_diagrams` → **Indexes**
2. Delete existing unique index (if present)
3. Create new unique index with all 4 fields

**Via Appwrite CLI**:
```bash
# Delete old index (if exists)
appwrite databases deleteIndex \
    --databaseId default \
    --collectionId lesson_diagrams \
    --key unique_lesson_card_context

# Create new index
appwrite databases createIndex \
    --databaseId default \
    --collectionId lesson_diagrams \
    --key unique_lesson_card_context_index \
    --type unique \
    --attributes lessonTemplateId cardId diagram_context diagram_index
```

#### Step 1.3: Verify Schema Update

**Expected Schema**:
```typescript
interface LessonDiagram {
  $id: string;
  lessonTemplateId: string;        // FK to lesson_templates
  cardId: string;                   // e.g., "card_001"
  diagram_context: "lesson" | "cfu"; // NEW: context
  diagram_index: number;            // NEW: 0, 1, 2, ... (default 0)
  jsxgraph_json: string;            // Serialized JSXGraph JSON
  image_file_id: string;            // Appwrite Storage file ID
  diagram_type: "geometry" | "algebra" | "statistics" | "mixed";
  diagram_description?: string;     // Optional description
  visual_critique_score: number;    // 0.0-1.0
  critique_iterations: number;      // 1-3
  critique_feedback: string;        // Serialized JSON array
  execution_id: string;             // exec_YYYYMMDD_HHMMSS
  failure_reason?: string;          // Optional error message
  $createdAt: string;
  $updatedAt: string;
  $permissions: string[];
}
```

---

### Phase 2: Update Diagram Generation Prompt

**File**: `src/prompts/diagram_generation_subagent.md`

#### Change 1: Update "Your Role" Section

**Current** (line ~7):
```markdown
Generate mathematically accurate, pedagogically effective JSXGraph diagrams...
```

**New**:
```markdown
Generate mathematically accurate, pedagogically effective JSXGraph diagrams that render as high-quality PNG images through the DiagramScreenshot service.

**IMPORTANT**: When card content requires multiple distinct diagrams (e.g., multiple questions, multiple examples), generate SEPARATE diagrams - one per logical concept. Do NOT combine multiple diagrams into one image.
```

#### Change 2: Add "Multiple Diagrams" Section

**Insert after line ~78** (after JSXGraph JSON Structure):

```markdown
## When to Generate Multiple Diagrams

Generate **MULTIPLE SEPARATE DIAGRAMS** (as an array) when:

✅ **Multiple CFU questions**: Each question gets its own diagram
   - Example: "Q2: Draw bar chart. Q4: Draw rainfall chart" → 2 diagrams

✅ **Multiple worked examples**: Each example gets its own diagram
   - Example: "Example 1: Triangle. Example 2: Square" → 2 diagrams

✅ **Before/After transformations**: Show original and transformed separately
   - Example: "Show triangle before and after rotation" → 2 diagrams

✅ **Different mathematical concepts**: Each concept gets its own diagram
   - Example: "Show sine and cosine graphs" → 2 diagrams

❌ **DO NOT generate multiple diagrams for**:
   - Single complex diagram (e.g., labeled triangle with multiple annotations)
   - Related elements on same axes (e.g., two functions on same graph)
   - Multiple data series on same chart (e.g., bar chart with grouped bars)

### Single Diagram vs Multiple Diagrams Examples

**SINGLE DIAGRAM** (correct):
- Triangle ABC with labeled sides, angles, and measurements → ONE diagram
- Quadratic function with vertex, roots, and axis of symmetry → ONE diagram
- Bar chart comparing 4 cities' rainfall → ONE diagram

**MULTIPLE DIAGRAMS** (correct):
- "Q2: Bar chart of team goals. Q4: Rainfall chart for Edinburgh" → TWO diagrams
  - Diagram 1: Team goals bar chart
  - Diagram 2: Edinburgh rainfall chart
- "Example 1: Right triangle. Example 2: Isosceles triangle" → TWO diagrams
- "Before rotation: Triangle at (0,0). After rotation: Triangle at 90°" → TWO diagrams

**INCORRECT** (DO NOT DO THIS):
- Cramming Q2 bar chart + Q4 rainfall chart + pie chart into ONE image ❌
- Overlapping unrelated diagrams on same axes ❌
- Multiple disconnected concepts in one bounding box ❌
```

#### Change 3: Update Output Format Section

**Current** (line ~853):
```json
{
  "jsxgraph_json": "{\"board\": {...}, \"elements\": [...]}",
  "image_base64": "iVBORw0KGgo...",
  "diagram_type": "geometry",
  "diagram_context": "lesson",
  "diagram_description": "...",
  "status": "ready_for_critique",
  "render_attempts": 1,
  "render_time_ms": 450
}
```

**New**:
```json
// SINGLE DIAGRAM (when card needs only one diagram)
{
  "diagrams": [
    {
      "jsxgraph_json": "{\"board\": {...}, \"elements\": [...]}",
      "image_base64": "iVBORw0KGgo...",
      "diagram_type": "geometry",
      "diagram_context": "lesson",
      "diagram_description": "Right triangle ABC with sides a=3cm and b=4cm",
      "status": "ready_for_critique",
      "render_attempts": 1,
      "render_time_ms": 450
    }
  ]
}

// MULTIPLE DIAGRAMS (when card needs multiple diagrams)
{
  "diagrams": [
    {
      "jsxgraph_json": "{\"board\": {...}, \"elements\": [...]}",
      "image_base64": "iVBORw0KGgo...",
      "diagram_type": "statistics",
      "diagram_context": "cfu",
      "diagram_description": "Q2: Bar chart showing team goals for Rangers, Celtic, Hearts, and Hibs",
      "status": "ready_for_critique",
      "render_attempts": 1,
      "render_time_ms": 420
    },
    {
      "jsxgraph_json": "{\"board\": {...}, \"elements\": [...]}",
      "image_base64": "iVBORw0KGgo...",
      "diagram_type": "statistics",
      "diagram_context": "cfu",
      "diagram_description": "Q4: Rainfall bar chart comparing Edinburgh, Glasgow, Stirling, and Perth",
      "status": "ready_for_critique",
      "render_attempts": 1,
      "render_time_ms": 380
    }
  ]
}
```

**IMPORTANT**:
- Always return `diagrams` as an **array**, even for single diagrams
- Each diagram in the array is a complete, independent visualization
- `diagram_description` should identify which question/example it addresses (e.g., "Q2: ...", "Example 1: ...")

---

### Phase 3: Update Diagram Upserter

**File**: `src/utils/diagram_upserter.py`

#### Change 1: Update `upsert_lesson_diagram()` Signature

**Add `diagram_index` parameter**:

```python
async def upsert_lesson_diagram(
    lesson_template_id: str,
    card_id: str,
    jsxgraph_json: str,
    image_base64: str,
    diagram_type: str,
    visual_critique_score: float,
    critique_iterations: int,
    critique_feedback: List[Dict[str, Any]],
    execution_id: str,
    diagram_context: Optional[str] = None,
    diagram_description: Optional[str] = None,
    diagram_index: int = 0,  # NEW: diagram index (default 0 for backward compatibility)
    mcp_config_path: str = ".mcp.json"
) -> Dict[str, Any]:
```

**Update docstring** (line ~131):
```python
"""Upsert lesson diagram to Appwrite lesson_diagrams collection.

Implements FR-044: Persist diagram data to Appwrite with upsert semantics.
- If (lessonTemplateId, cardId, diagram_context, diagram_index) exists: UPDATE
- If not exists: CREATE

Args:
    ... (existing args)
    diagram_index: Diagram index for multi-diagram cards (0-based, default 0)
    ...
```

#### Change 2: Update Query to Include `diagram_index`

**Current** (line ~234):
```python
queries = [
    f'equal("lessonTemplateId", "{lesson_template_id}")',
    f'equal("cardId", "{card_id}")'
]
if diagram_context is not None:
    queries.append(f'equal("diagram_context", "{diagram_context}")')
```

**New**:
```python
queries = [
    f'equal("lessonTemplateId", "{lesson_template_id}")',
    f'equal("cardId", "{card_id}")',
    f'equal("diagram_index", {diagram_index})'  # NEW: include diagram_index in query
]
if diagram_context is not None:
    queries.append(f'equal("diagram_context", "{diagram_context}")')
```

#### Change 3: Update Hash Generation to Include `diagram_index`

**Current** (line ~293):
```python
context_suffix = f"_{diagram_context}" if diagram_context else ""
combined = f"{lesson_template_id}_{card_id}{context_suffix}"
hash_suffix = hashlib.md5(combined.encode()).hexdigest()[:8]
document_id = f"dgm_{hash_suffix}"
```

**New**:
```python
context_suffix = f"_{diagram_context}" if diagram_context else ""
combined = f"{lesson_template_id}_{card_id}{context_suffix}_{diagram_index}"  # NEW: include index
hash_suffix = hashlib.md5(combined.encode()).hexdigest()[:8]
document_id = f"dgm_{hash_suffix}"
```

#### Change 4: Add `diagram_index` to Document Data

**Current** (line ~304):
```python
create_data = {
    "lessonTemplateId": lesson_template_id,
    "cardId": card_id,
    ...
}
```

**New**:
```python
create_data = {
    "lessonTemplateId": lesson_template_id,
    "cardId": card_id,
    "diagram_index": diagram_index,  # NEW: add diagram_index
    ...
}
```

**Also update** (line ~257 for update_data):
```python
update_data = {
    "jsxgraph_json": jsxgraph_json,
    ...
    # lessonTemplateId, cardId, and diagram_index are immutable (not updated)
}
```

#### Change 5: Update `batch_upsert_diagrams()` to Handle Diagram Arrays

**Current** (line ~395):
```python
for idx, diagram_data in enumerate(diagrams_data, start=1):
    try:
        # Extract fields from diagram_data
        lesson_template_id = diagram_data["lesson_template_id"]
        card_id = diagram_data["card_id"]

        # Upsert single diagram
        doc = await upsert_lesson_diagram(
            lesson_template_id=lesson_template_id,
            card_id=card_id,
            ...
        )
```

**New**:
```python
for idx, diagram_data in enumerate(diagrams_data, start=1):
    try:
        # Extract fields from diagram_data
        lesson_template_id = diagram_data["lesson_template_id"]
        card_id = diagram_data["card_id"]
        diagram_index = diagram_data.get("diagram_index", 0)  # NEW: extract diagram_index (default 0)

        logger.info(
            f"[{idx}/{total}] Upserting diagram: "
            f"lessonTemplateId={lesson_template_id}, cardId={card_id}, diagram_index={diagram_index}"
        )

        # Upsert single diagram
        doc = await upsert_lesson_diagram(
            lesson_template_id=lesson_template_id,
            card_id=card_id,
            jsxgraph_json=diagram_data["jsxgraph_json"],
            image_base64=diagram_data["image_base64"],
            diagram_type=diagram_data["diagram_type"],
            visual_critique_score=diagram_data["visual_critique_score"],
            critique_iterations=diagram_data["critique_iterations"],
            critique_feedback=diagram_data["critique_feedback"],
            execution_id=diagram_data["execution_id"],
            diagram_context=diagram_data.get("diagram_context"),
            diagram_description=diagram_data.get("diagram_description"),
            diagram_index=diagram_index,  # NEW: pass diagram_index
            mcp_config_path=mcp_config_path
        )
```

---

### Phase 4: Update Main Orchestrator

**File**: `src/diagram_author_claude_client.py`

#### Change 1: Update Diagram Processing Loop

**Location**: Around line ~430 (diagram processing loop in `execute()` method)

**Current flow**:
1. Loop through eligible cards
2. Invoke diagram generation subagent → returns **single diagram**
3. Invoke visual critic subagent → critiques single diagram
4. Collect single diagram output

**New flow**:
1. Loop through eligible cards
2. Invoke diagram generation subagent → returns **array of diagrams**
3. **Loop through diagrams array**:
   a. Invoke visual critic subagent for each diagram
   b. Collect diagram output with `diagram_index`

**Pseudo-code**:
```python
# Inside execute() method, after eligible cards loop starts

for card_idx, card_data in enumerate(eligible_cards_json, start=1):
    card_id = card_data["id"]

    # 1. Generate diagrams (subagent returns ARRAY now)
    generation_result = await self._invoke_diagram_generation_subagent(
        card_data=card_data,
        diagram_context=diagram_context
    )

    # 2. Extract diagrams array from result
    diagrams = generation_result.get("diagrams", [])

    if not diagrams:
        logger.warning(f"No diagrams generated for card {card_id}")
        continue

    logger.info(f"Generated {len(diagrams)} diagram(s) for card {card_id}")

    # 3. Process each diagram separately
    for diagram_index, diagram_data in enumerate(diagrams):
        logger.info(f"Processing diagram {diagram_index + 1}/{len(diagrams)} for card {card_id}")

        # 4. Invoke critic for this specific diagram
        critique_result = await self._invoke_visual_critic_subagent(
            diagram_data=diagram_data,
            card_id=card_id,
            diagram_index=diagram_index
        )

        # 5. Collect for upserting (add diagram_index)
        final_diagrams_data.append({
            "lesson_template_id": lesson_template_id,
            "card_id": card_id,
            "diagram_index": diagram_index,  # NEW
            "jsxgraph_json": diagram_data["jsxgraph_json"],
            "image_base64": diagram_data["image_base64"],
            "diagram_type": diagram_data["diagram_type"],
            "diagram_description": diagram_data.get("diagram_description", ""),
            "visual_critique_score": critique_result["final_score"],
            "critique_iterations": critique_result["iterations"],
            "critique_feedback": critique_result["feedback"],
            "execution_id": self.execution_id,
            "diagram_context": diagram_context
        })
```

#### Change 2: Update Result Reporting

**Update final summary** to report total diagrams across all indices:

```python
logger.info(
    f"Generated {len(final_diagrams_data)} total diagrams "
    f"(across {len(eligible_cards_json)} cards with multi-diagram support)"
)
```

---

### Phase 5: Testing Plan

#### Test 1: Single Diagram (Backward Compatibility)

**Input**: Card with simple content requiring one diagram
**Expected**: One diagram document with `diagram_index = 0`

**Validation**:
```bash
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --order 1 \
  --card-order 1  # Card with single diagram need
```

**Check Database**:
- Document created with `diagram_index = 0`
- Existing diagrams still work (no migration needed)

#### Test 2: Multiple Diagrams (New Feature)

**Input**: Card with content like "Q2: Bar chart. Q4: Rainfall chart"
**Expected**: Two diagram documents with `diagram_index = 0, 1`

**Validation**:
```bash
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --order 1 \
  --card-order 2  # Card needing multiple diagrams
```

**Check Database**:
- Two documents created:
  - `diagram_index = 0`: Q2 bar chart
  - `diagram_index = 1`: Q4 rainfall chart
- Each has separate `image_file_id` in Appwrite Storage

#### Test 3: Full Lesson (Integration)

**Input**: Full lesson with mix of single and multi-diagram cards
**Expected**: Correct diagram counts and indices

**Validation**:
```bash
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --order 1  # Full lesson
```

**Check**:
- Cards needing 1 diagram → 1 document (index 0)
- Cards needing 2 diagrams → 2 documents (index 0, 1)
- Cards needing 3 diagrams → 3 documents (index 0, 1, 2)

---

## Migration Strategy

### Existing Diagrams
- **No migration needed** - `diagram_index` defaults to `0`
- Existing diagrams remain queryable and functional
- New diagrams use `diagram_index >= 0`

### Frontend Compatibility
Frontend code reading diagrams should:

**Before** (fetches single diagram per card):
```typescript
const diagram = await databases.listDocuments(
  "default",
  "lesson_diagrams",
  [
    Query.equal("lessonTemplateId", lessonId),
    Query.equal("cardId", cardId),
    Query.equal("diagram_context", "lesson")
  ]
);
// Returns 0 or 1 document
```

**After** (fetches all diagrams for card):
```typescript
const diagrams = await databases.listDocuments(
  "default",
  "lesson_diagrams",
  [
    Query.equal("lessonTemplateId", lessonId),
    Query.equal("cardId", cardId),
    Query.equal("diagram_context", "lesson"),
    Query.orderAsc("diagram_index")  // NEW: order by index
  ]
);
// Returns array of diagrams (1+)
// diagrams.documents[0] → diagram_index 0
// diagrams.documents[1] → diagram_index 1 (if exists)
```

**Rendering**:
```tsx
// Render all diagrams for card
{diagrams.documents.map((diagram, idx) => (
  <img
    key={diagram.$id}
    src={getStorageUrl(diagram.image_file_id)}
    alt={diagram.diagram_description || `Diagram ${idx + 1}`}
  />
))}
```

---

## Rollout Checklist

### Pre-Deployment
- [ ] Add `diagram_index` attribute in Appwrite (default 0)
- [ ] Update unique index to include `diagram_index`
- [ ] Verify schema in Appwrite Console

### Code Changes
- [ ] Update `diagram_generation_subagent.md` prompt (multiple diagrams section)
- [ ] Update `diagram_upserter.py` (add diagram_index parameter)
- [ ] Update `diagram_author_claude_client.py` (process diagram arrays)
- [ ] Update documentation in `DIAGRAM_AUTHOR_GUIDE.md`

### Testing
- [ ] Test single diagram card (backward compatibility)
- [ ] Test multi-diagram card (new feature)
- [ ] Test full lesson (integration)
- [ ] Verify database documents have correct `diagram_index` values
- [ ] Verify Appwrite Storage has separate files per diagram

### Deployment
- [ ] Deploy schema changes (FIRST)
- [ ] Deploy code changes (SECOND)
- [ ] Run smoke test on production data
- [ ] Monitor first production execution

### Frontend Updates (Optional - can be done later)
- [ ] Update diagram fetching queries to use `orderAsc("diagram_index")`
- [ ] Update UI to render multiple diagrams per card
- [ ] Add carousel/gallery if needed for multi-diagram cards

---

## Success Criteria

✅ **Single diagram cards still work** - Backward compatibility maintained
✅ **Multi-diagram cards generate separate images** - No more cramming
✅ **Each diagram has unique document** - Separate `image_file_id` values
✅ **Diagrams are ordered by index** - Frontend can render in sequence
✅ **No data migration needed** - Existing diagrams default to `diagram_index = 0`
✅ **Agent prompt is clear** - Agent knows when to generate multiple diagrams

---

## Risks and Mitigations

### Risk 1: Agent generates too many diagrams
**Mitigation**: Set `max = 10` in schema (reasonable limit)
**Fallback**: If > 10 diagrams generated, log warning and take first 10

### Risk 2: Existing frontend breaks
**Mitigation**: `diagram_index = 0` for all existing diagrams ensures backward compatibility
**Fallback**: Frontend can filter to `diagram_index = 0` if needed temporarily

### Risk 3: Increased storage costs
**Mitigation**: Only generate multiple diagrams when truly needed (prompt is clear)
**Monitoring**: Track average diagrams per card metric

---

## Future Enhancements (Out of Scope)

- **Diagram ordering UI**: Allow teachers to reorder diagrams (change diagram_index)
- **Diagram deletion**: Allow deleting specific diagram_index without affecting others
- **Diagram variants**: Support A/B testing with different diagram styles (separate from diagram_index)
- **Diagram thumbnails**: Generate thumbnails for multi-diagram cards

---

## Questions and Answers

**Q: Why not use an array field for `image_file_id`?**
A: Appwrite doesn't support arrays of Storage file IDs well. Separate documents are simpler to query and update.

**Q: What if a card needs 10+ diagrams?**
A: Schema allows max 10. If needed, increase max value. But this should be rare - most cards need 1-3 diagrams.

**Q: How do we handle diagram regeneration with --force?**
A: Existing logic still works - query by `(lessonTemplateId, cardId, diagram_context, diagram_index)` and upsert.

**Q: What about diagram deletions?**
A: Delete all diagrams for a card: query by `(lessonTemplateId, cardId, diagram_context)` and delete all results.

---

**Document Status**: ✅ Complete - Ready for Implementation
**Next Step**: Phase 1 - Database Schema Update
