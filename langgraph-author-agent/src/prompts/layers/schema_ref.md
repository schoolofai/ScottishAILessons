# Layer 3: Schema References (On-Demand)

**Priority**: Load when detailed schema information needed
**Token Estimate**: ~100 tokens
**Purpose**: Point to extracted schema documentation

---

## Schema Documentation Locations

### 1. SOW Schema (`authored_sow_json` structure)
**File**: `src/schemas/sow_schema.md`

**When to read**:
- Authoring SOW entries
- Validating metadata structure
- Checking required fields
- Understanding enriched format requirements

**Key sections**:
- Complete schema structure
- Field details tables (Metadata, Entry, Card fields)
- Enriched format examples (correct vs incorrect)
- Validation checklist
- Critical requirements

---

### 2. Lesson Card Schema (card_structure detail)
**File**: `src/schemas/lesson_card_schema.md`

**When to read**:
- Designing lesson_plan.card_structure
- Choosing appropriate card_type for pedagogical goal
- Understanding conditional fields (key_concepts, worked_example, practice_problems, rubric_guidance)
- Checking CFU strategy requirements
- Validating card timing

**Key sections**:
- Card types and usage (starter, explainer, modelling, guided_practice, independent_practice, exit_ticket)
- Required vs conditional fields by card type
- CFU strategy examples (specific, not generic)
- Card sequence design patterns
- Scottish context requirements

---

### 3. Research Pack Schema (`research_pack_json` structure)
**File**: `src/schemas/research_pack_schema.md`

**When to read**:
- Understanding research pack structure
- Extracting pedagogical patterns
- Finding Scottish context hooks
- Applying chunking examples
- Using assessment stems

**Key sections**:
- Exemplars from sources
- Distilled data (canonical_terms, assessment_stems, pedagogical_patterns, calculator_policy)
- Guidance for author (sequencing_principles, context_hooks, accessibility_patterns, chunking_examples)
- Citations and metadata

---

## Usage Pattern

Instead of embedding full schemas in prompts:

```
# OLD (embedded schema - 400+ tokens)
<schema_sow_with_field_descriptions>
{
  "metadata": { ... 100 lines ... },
  "entries": [ ... 200 lines ... ]
}
</schema_sow_with_field_descriptions>

# NEW (schema reference - ~10 tokens)
See complete SOW schema structure at: src/schemas/sow_schema.md
```

When you need detailed field information, explicitly read the schema file:
```
READ: src/schemas/sow_schema.md
(Extract relevant section: e.g., "card_structure field requirements")
```

---

## Dynamic Loading Strategy

**Token Budget Tiers**:

1. **Default (no schema detail)**: ~550 tokens
   - Layers 1-2 only
   - Use when: General SOW authoring, familiar with structure

2. **Schema Reference (Layer 3)**: ~650 tokens
   - Layers 1-3
   - Use when: Need schema reminders, validating structure

3. **Full Schema Read**: ~1000+ tokens
   - Layers 1-3 + READ schema files
   - Use when: First time authoring, complex validation, debugging issues

---

**Token Count**: ~95 tokens (measured)
