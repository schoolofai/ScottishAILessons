# Plan: Integrate SQA Course Data as Grounding Source

## Overview
Enable the `course_outcome_subagent` to fetch authoritative SQA course data from Appwrite and write it to `Course_data.txt` for all agents to use as grounding data. This ensures authenticity, completeness, and consistency with official SQA specifications.

---

## Database Structure Understanding

**Database**: `sqa_education` (ID: `sqa_education`)
**Collection**: `Current SQA Courses`
**Key Columns**:
- `subject` (e.g., `applications_of_mathematics`)
- `level` (e.g., `national_3`)
- `data` (JSON containing full course metadata)

**Data Column Contents**:
```json
{
  "level_name": "National 3",
  "qualification": {...},
  "course_structure": {
    "units": [
      {
        "code": "HV7Y 73",
        "title": "...",
        "outcomes": [...],
        "assessment_standards": [...]
      }
    ]
  },
  "assessment_model": {...},
  "marking_guidance": {...},
  "documents": {...}
}
```

---

## Step 1: Update `course_outcome_subagent` Prompt

**File**: `src/sow_author_prompts.py` (add to `COURSE_OUTCOME_SUBAGENT_PROMPT`)

**Add Section**:
```python
## Fetch SQA Course Data (CRITICAL FIRST STEP)

Before proposing unit/block structure, you MUST:

1. **Extract subject and level** from the research pack or user request
   - Example: "National 3 Applications of Mathematics" → subject: "Applications of Mathematics", level: "National 3"
   - Keep original format - do NOT normalize to underscores

2. **Query Appwrite for ALL course data**:
   ```
   Use tool: databases_list_documents
   - database_id: "sqa_education"
   - collection_id: "Current SQA Courses"
   - queries: []  # Empty - fetch all courses
   ```

3. **Find the best matching course**:
   - Compare extracted subject/level against the `subject` and `level` fields in returned documents
   - Use intelligent matching to handle variations:
     - "National 3", "Nat 3", "N3" all match level: "national_3"
     - "Applications of Mathematics", "Apps of Maths" match subject: "applications_of_mathematics"
   - Select the document with the closest match

4. **Write to Course_data.txt**:
   - Extract the `data` field from the matched document
   - Write the complete JSON to `Course_data.txt`
   - This provides official SQA curriculum structure for all agents

5. **Use the data** to propose:
   - Accurate unit names from `course_structure.units[].title`
   - Correct unit codes from `course_structure.units[].code`
   - Proper outcome IDs from `outcomes[].id`
   - Assessment standards from `outcomes[].assessment_standards[]`
   - Recommended sequence from `recommended_sequence`

## Example Workflow:

INPUT: User requests SoW for "National 3 Applications of Mathematics"

STEP 1: Extract subject and level
- subject: "Applications of Mathematics"
- level: "National 3"

STEP 2: Query Appwrite for all courses
- Fetch all documents from "Current SQA Courses"

STEP 3: Find best match
- Compare against returned documents:
  - Document 1: subject="applications_of_mathematics", level="national_3" ✅ MATCH
  - Document 2: subject="mathematics", level="national_5" ❌
  - Document 3: subject="computing_science", level="national_3" ❌
- Select Document 1

STEP 4: Write to file
```
write_file("Course_data.txt", json.dumps(course_data, indent=2))
```

STEP 5: Propose structure based on official units:
- Unit 1: "Applications of Mathematics: Manage Money and Data (National 3)" [HV7Y 73]
- Unit 2: "Applications of Mathematics: Shape, Space and Measures (National 3)" [HV80 73]
- Unit 3: "Numeracy (National 3)" [H225 73]
- Recommended sequence: Numeracy → Shape Space Measures → Manage Money Data

This ensures the SoW structure aligns with official SQA course specifications.
```

---

## Step 2: Update Other Agent Prompts to Reference Course_data.txt

### 2.1: Update `SUB_RESEARCH_PROMPT`

**Add Section**:
```python
## Grounding Data Source

A file `Course_data.txt` contains official SQA course data for the current subject/level.

When answering questions, ALWAYS consult this file first to ensure:
- Accurate unit names and codes
- Correct outcome descriptions
- Official assessment standards
- Proper marking guidance
- Authentic SQA terminology

Example queries you can answer with this data:
- "What are the official unit names?"
- "What assessment standards apply to Outcome 1?"
- "What's the recommended unit sequence?"
- "What marking guidance applies to calculations?"
```

### 2.2: Update `SOW_AUTHOR_SUBAGENT_PROMPT`

**Add Section**:
```python
## Using Official SQA Course Data

The file `Course_data.txt` contains authoritative SQA course specifications.

When authoring the SoW, you MUST:
1. Read `Course_data.txt` to understand the official course structure
2. Use exact unit titles from `course_structure.units[].title`
3. Use correct unit codes from `course_structure.units[].code`
4. Map SoW entries to official outcomes from `outcomes[].id`
5. Reference assessment standards from `outcomes[].assessment_standards[]`
6. Follow the recommended sequence from `recommended_sequence`

This ensures the SoW is aligned with SQA specifications and ready for classroom use.
```

### 2.3: Update `SOW_COVERAGE_CRITIC_PROMPT`

**Add Section**:
```python
## Validating Against Official Specifications

The file `Course_data.txt` contains the official SQA course structure.

When critiquing coverage, check:
- Does the SoW cover all units in `course_structure.units[]`?
- Are all outcomes from `outcomes[]` addressed?
- Are assessment standards from `assessment_standards[]` represented?
- Does the SoW follow the `recommended_sequence`?
- Are unit codes correctly referenced?

Report any missing units, outcomes, or assessment standards by comparing the SoW against the official data.
```

### 2.4: Update `SOW_SEQUENCING_CRITIC_PROMPT`

**Add Section**:
```python
## Validating Sequence Against Official Guidance

The file `Course_data.txt` contains the recommended unit sequence.

Check:
- Does the SoW follow `recommended_sequence`?
- Does it respect the `sequence_rationale`?
- Are prerequisites properly ordered?
- Does it align with `delivery_notes` suggestions?

Example from National 3 Apps of Maths:
- Recommended: Numeracy → Shape Space Measures → Manage Money Data
- Rationale: "Numerical skills provide foundation for subsequent units"
```

### 2.5: Update `SOW_POLICY_CRITIC_PROMPT`

**Add Section**:
```python
## Validating Against SQA Assessment Policy

The file `Course_data.txt` contains official assessment policies.

Check the SoW against:
- `assessment_model.calculator_policy` (e.g., "calculators may be used")
- `assessment_model.coursework_notes` (thresholds, re-assessment rules)
- `marking_guidance.guidance` (error handling, rounding, units)
- Unit-specific `unit_marking_guidance`

Ensure the SoW reflects these official policies in lesson design and assessment planning.
```

### 2.6: Update `SOW_AUTHENTICITY_CRITIC_PROMPT`

**Add Section**:
```python
## Validating Terminology Against SQA Standards

The file `Course_data.txt` contains official SQA terminology.

Verify the SoW uses:
- Exact unit titles from `course_structure.units[].title`
- Correct unit codes (e.g., "HV7Y 73")
- Official outcome titles from `outcomes[].title`
- Standard assessment terminology from `assessment_standards[].desc`
- CfE/SQA-specific language (e.g., "SCQF credits", "AVU", "CFU")

Flag any informal or non-standard terminology that should be corrected.
```

---

## Step 3: Update `SOW_AGENT_PROMPT` (Main Orchestrator)

**Add Section**:
```python
## Workflow: SQA Course Data as Grounding Source

Your workflow should follow this pattern:

1. **Read the research pack** to identify subject and level
2. **Call course_outcome_subagent** to:
   - Fetch official SQA course data from Appwrite
   - Write it to `Course_data.txt`
   - Propose unit/block structure aligned with official specifications
3. **Call sow_author_subagent** to:
   - Read `Course_data.txt` for official structure
   - Author the SoW using exact unit names, codes, and outcomes
4. **Call critics** to validate against `Course_data.txt`:
   - Coverage: All units/outcomes covered?
   - Sequencing: Follows recommended sequence?
   - Policy: Aligns with assessment model?
   - Authenticity: Uses official SQA terminology?

This ensures the final SoW is grounded in authoritative SQA specifications.
```

---

## Step 4: Example Query Patterns for Prompts

**Add to `COURSE_OUTCOME_SUBAGENT_PROMPT`**:

```python
## Appwrite Query Examples

To fetch ALL course data and find the best match, use the `databases_list_documents` tool:

Example: Query all courses and match
```python
# Step 1: Fetch all courses
result = databases_list_documents(
    database_id="sqa_education",
    collection_id="Current SQA Courses",
    queries=[]  # Empty queries returns all documents
)

# Step 2: Examine returned documents
# Each document has:
# - subject: e.g., "applications_of_mathematics", "mathematics", "computing_science"
# - level: e.g., "national_3", "national_4", "national_5"
# - data: full course structure (JSON)

# Step 3: Find best match
# For user input "National 3 Applications of Mathematics":
# - Look for subject containing "applications" or "mathematics"
# - Look for level containing "national_3" or "3"
# - Select the document that best matches both fields

# Step 4: Extract and save
matched_document = documents[0]  # The best match
course_data = matched_document["data"]
write_file("Course_data.txt", json.dumps(course_data, indent=2))
```

**Matching Logic Examples**:
- "National 3" matches level: "national_3"
- "Nat 3" matches level: "national_3"
- "N3" matches level: "national_3"
- "Applications of Mathematics" matches subject: "applications_of_mathematics"
- "Apps of Maths" matches subject: "applications_of_mathematics"
- "Computing Science" matches subject: "computing_science"

The response will contain documents with a `data` field containing the full course structure.
```

---

## Step 6: Update Main Agent Tool Assignment

**File**: `src/sow_author_agent.py`

**Change** (line 79):
```python
course_outcome_subagent = {
    "name": "course_outcome_subagent",
    "description": "Fetch official SQA course data from Appwrite, write to Course_data.txt, and propose unit/block structure aligned with SQA specifications. MUST be called first to establish grounding data.",
    "prompt": COURSE_OUTCOME_SUBAGENT_PROMPT,
    "tools": appwrite_only_tools  # Already correct - has Appwrite access
}
```

---

## Benefits of This Approach

### ✅ Single Source of Truth
- All agents reference the same official SQA data
- Eliminates inconsistencies between agents
- Ensures curriculum alignment

### ✅ Authoritative Grounding
- Uses official SQA course specifications
- Includes exact unit codes, titles, outcomes
- Contains official marking guidance and policies

### ✅ Efficient Architecture
- Fetch once, use many times
- Reduces redundant Appwrite queries
- File-based sharing is simple and reliable

### ✅ Validation-Friendly
- Critics can compare SoW against official data
- Easy to spot missing units or outcomes
- Clear audit trail for quality assurance

---

## Workflow Summary

```
┌─────────────────────────────────────────┐
│ User: "Create SoW for National 3 Apps   │
│        of Mathematics"                   │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ Main Agent: Routes to                   │
│   course_outcome_subagent               │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ course_outcome_subagent:                │
│  1. Extract: subject="Applications of   │
│     Mathematics", level="National 3"    │
│  2. Query Appwrite (ALL courses):       │
│     database_id: sqa_education          │
│     collection_id: Current SQA Courses  │
│     queries: [] # Empty = all           │
│  3. Match: Find best match in subject   │
│     and level columns                   │
│  4. Extract `data` field from match     │
│  5. Write to Course_data.txt            │
│  6. Propose structure from units[]      │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ sow_author_subagent:                    │
│  - Reads Course_data.txt                │
│  - Uses official unit names/codes       │
│  - Maps to outcomes and standards       │
│  - Authors SoW aligned with specs       │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ Critic Subagents:                       │
│  - Coverage: All units covered?         │
│  - Sequencing: Follows recommended?     │
│  - Policy: Aligns with assessment model?│
│  - Authenticity: Uses official terms?   │
│  ALL reference Course_data.txt          │
└─────────────────────────────────────────┘
```

---

## Testing Strategy

### Phase 1: Test Data Fetching
```bash
cd langgraph-author-agent
source ../venv/bin/activate

# Test Appwrite query
python -c "
from dotenv import load_dotenv
load_dotenv()
from src.sow_author_tools import appwrite_tools

# Find databases_list_documents tool
list_docs = [t for t in appwrite_tools if 'list_documents' in t.name][0]
print(f'Found tool: {list_docs.name}')
"
```

### Phase 2: Test Course Listing and Matching
```python
from src.sow_author_tools import appwrite_tools

# Find list_documents tool
list_docs = [t for t in appwrite_tools if 'list_documents' in t.name][0]

# Test querying all courses
result = list_docs.invoke({
    "database_id": "sqa_education",
    "collection_id": "Current SQA Courses",
    "queries": []
})

# Verify documents returned
print(f"Found {len(result['documents'])} courses")
for doc in result['documents']:
    print(f"  - {doc['subject']} ({doc['level']})")

# Test matching logic manually
user_subject = "Applications of Mathematics"
user_level = "National 3"

# Simple matching test
matches = [
    doc for doc in result['documents']
    if 'applications' in doc['subject'].lower() and
       'national_3' in doc['level'].lower()
]

print(f"Matched {len(matches)} courses for '{user_subject}' at '{user_level}'")
```

### Phase 3: Test End-to-End
```bash
# Run SoW Author Agent with test input
# Verify Course_data.txt is created
# Verify SoW uses official unit names
```

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/sow_author_prompts.py` | MODIFY | Add grounding instructions to all prompts |
| `src/sow_author_agent.py` | MODIFY | Update `course_outcome_subagent` description |

---

## Pseudo-code for course_outcome_subagent

```python
# Extract from research pack (keep original format)
subject = extract_subject(research_pack)  # "Applications of Mathematics"
level = extract_level(research_pack)      # "National 3"

# Query Appwrite for ALL courses
result = databases_list_documents(
    database_id="sqa_education",
    collection_id="Current SQA Courses",
    queries=[]  # Empty = fetch all documents
)

# Find best matching course using intelligent comparison
best_match = None
for doc in result["documents"]:
    db_subject = doc["subject"]  # e.g., "applications_of_mathematics"
    db_level = doc["level"]      # e.g., "national_3"

    # Match logic: compare user input against database values
    # Handle variations: "National 3" matches "national_3"
    #                   "Applications of Mathematics" matches "applications_of_mathematics"
    subject_matches = (
        "applications" in db_subject and "mathematics" in db_subject
        or db_subject.replace("_", " ").lower() in subject.lower()
    )

    level_matches = (
        "3" in level and "3" in db_level
        or db_level.replace("_", " ").lower() in level.lower()
    )

    if subject_matches and level_matches:
        best_match = doc
        break

# Extract data from matched document
course_data = best_match["data"]

# Write to file for all agents
write_file("Course_data.txt", json.dumps(course_data, indent=2))

# Propose structure using official units
units = course_data["course_structure"]["units"]
recommended_seq = course_data["recommended_sequence"]

return {
    "unit_structure": units,
    "recommended_sequence": recommended_seq,
    "grounding_file": "Course_data.txt",
    "matched_course": f"{best_match['subject']} ({best_match['level']})"
}
```
