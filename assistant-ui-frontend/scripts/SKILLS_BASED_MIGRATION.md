# Skills-Based Course Migration Guide

## Overview

This guide documents the **dual-unit creation strategy** for seeding skills-based courses (National 5, Higher, Advanced Higher) into the `course_outcomes` collection.

**Problem:** National 5+ courses use a fundamentally different structure than National 3/4:
- ❌ **No traditional units** - The `units` array is empty
- ❌ **No outcomes hierarchy** - Skills are not nested under outcomes
- ✅ **Skills framework** - Flat list of atomic skills
- ✅ **Topic areas** - Skills grouped by subject area

**Solution:** Generate **two types of course_outcome documents**:
1. **TOPIC_ documents** - Represent curriculum structure (navigation)
2. **SKILL_ documents** - Represent atomic competencies (mastery tracking)

---

## Data Structure Comparison

### Unit-Based (National 3/4)

```json
{
  "course_structure": {
    "structure_type": "unit_based",
    "units": [
      {
        "code": "H8J0 73",
        "title": "Applications of Mathematics",
        "scqf_credits": 6,
        "outcomes": [
          {
            "id": "1",
            "title": "Use numerical skills...",
            "assessment_standards": [
              {
                "code": "1.1",
                "desc": "Apply numerical skills...",
                "skills_list": [...],
                "marking_guidance": "..."
              }
            ]
          }
        ]
      }
    ]
  }
}
```

**Extraction:** 1 unit → N outcomes → N course_outcome documents

---

### Skills-Based (National 5+)

```json
{
  "course_structure": {
    "structure_type": "skills_based",
    "units": [],  // Empty!
    "skills_framework": {
      "knowledge_understanding": [...],
      "skills": [
        {
          "name": "Working with surds",
          "description": "Simplification, Rationalising denominators",
          "examples": []
        },
        {
          "name": "Simplifying expressions using the laws of indices",
          "description": "Multiplication and division...",
          "examples": []
        }
      ]
    },
    "topic_areas": [
      {
        "title": "Numerical skills",
        "content_points": ["Simplification of surds", ...],
        "skills_assessed": [
          "Working with surds",
          "Simplifying expressions using the laws of indices",
          "Rounding",
          ...
        ],
        "marking_guidance": null
      }
    ]
  }
}
```

**Extraction:** M topic_areas + N skills → (M + N) course_outcome documents

---

## Dual-Unit Creation Strategy

### Type 1: Topic-as-Unit Documents

**Purpose:** Represent curriculum structure for navigation and planning.

**Generated Code Pattern:**
```
TOPIC_{NORMALIZED_TITLE}
```

**Example:**
```json
{
  "courseId": "course_c84775",
  "courseSqaCode": "C847 75",
  "unitCode": "TOPIC_NUMERICAL_SKILLS",
  "unitTitle": "Numerical skills",
  "scqfCredits": 0,
  "outcomeId": "TOPIC_NUMERICAL_SKILLS",
  "outcomeTitle": "Numerical skills",
  "assessmentStandards": "[{
    \"code\": \"TOPIC_OVERVIEW\",
    \"desc\": \"This topic covers: Working with surds, Simplifying expressions...\",
    \"skills_list\": [
      \"Working with surds\",
      \"Simplifying expressions using the laws of indices\",
      \"Rounding\",
      \"Working with reverse percentages\",
      \"Working with appreciation/depreciation\",
      \"Working with fractions\"
    ],
    \"marking_guidance\": \"\"
  }]",
  "teacherGuidance": "**Topic Overview**: Numerical skills\n\nThis topic area groups 6 related skills.\n\n**Content Points**:\n- Simplification of surds\n- Rationalising denominators\n...",
  "keywords": ["numerical", "skills"]
}
```

**Key Fields:**
- `unitCode` = `outcomeId` (same for topics)
- `skills_list` in assessmentStandards contains referenced skill names
- `teacherGuidance` includes content_points from SQA data
- `scqfCredits` = 0 (topics don't have SCQF credits)

---

### Type 2: Skill-as-Unit Documents

**Purpose:** Represent atomic competencies for granular mastery tracking.

**Generated Code Pattern:**
```
SKILL_{NORMALIZED_NAME}
```

**Example:**
```json
{
  "courseId": "course_c84775",
  "courseSqaCode": "C847 75",
  "unitCode": "SKILL_WORKING_WITH_SURDS",
  "unitTitle": "Working with surds",
  "scqfCredits": 0,
  "outcomeId": "SKILL_WORKING_WITH_SURDS",
  "outcomeTitle": "Working with surds",
  "assessmentStandards": "[{
    \"code\": \"AS1\",
    \"desc\": \"Simplification, Rationalising denominators\",
    \"skills_list\": [],
    \"marking_guidance\": \"\"
  }]",
  "teacherGuidance": "**Working with surds**\n\nSimplification, Rationalising denominators\n\n**Parent Topics**: Numerical skills",
  "keywords": [
    "working",
    "surds",
    "simplification",
    "rationalising",
    "denominators"
  ]
}
```

**Key Fields:**
- `unitCode` = `outcomeId` (same for skills)
- `teacherGuidance` includes **Parent Topics** section
- `assessmentStandards` contains skill description
- `scqfCredits` = 0 (individual skills don't have credits)

---

## Many-to-Many Relationships

### Problem

Skills can belong to multiple topic areas:

```
Topic: "Numerical skills"
  ├── Working with surds
  ├── Simplifying expressions using the laws of indices
  └── Rounding

Topic: "Reasoning skills" (cross-cutting)
  ├── Interpreting a situation where mathematics can be used
  └── Explaining a solution and relating it to context
```

**Note:** "Reasoning skills" apply across ALL operational skills.

### Solution

Store parent topics in the `teacherGuidance` field:

```markdown
**Working with surds**

Simplification, Rationalising denominators

**Parent Topics**: Numerical skills
```

For cross-cutting skills:

```markdown
**Interpreting a situation where mathematics can be used**

Can be attached to any operational skills to require analysis of a situation

**Parent Topics**: Reasoning skills
```

**Query Pattern:** Parse `teacherGuidance` to find parent topics (read-heavy workload, acceptable).

---

## Code Normalization

### Unit Code Generation

**Function:** `normalizeToUnitCode(title: string): string`

**Rules:**
1. Convert to UPPERCASE
2. Remove non-alphanumeric characters (except spaces)
3. Replace spaces with underscores
4. Collapse multiple underscores
5. Trim leading/trailing underscores

**Examples:**
```typescript
"Working with surds"        → "WORKING_WITH_SURDS"
"Algebraic skills"          → "ALGEBRAIC_SKILLS"
"Sine & cosine rules"       → "SINE_COSINE_RULES"
"Circle geometry"           → "CIRCLE_GEOMETRY"
"Determining the gradient..." → "DETERMINING_THE_GRADIENT"
```

---

## Example: National 5 Mathematics

**Course:** C847 75 - National 5 Mathematics
**Structure Type:** skills_based
**Total Outcomes:** 46 documents

### Topic Documents (6)

| unitCode | unitTitle | Skills Count |
|----------|-----------|--------------|
| `TOPIC_NUMERICAL_SKILLS` | Numerical skills | 6 |
| `TOPIC_ALGEBRAIC_SKILLS` | Algebraic skills | 15 |
| `TOPIC_GEOMETRIC_SKILLS` | Geometric skills | 10 |
| `TOPIC_TRIGONOMETRIC_SKILLS` | Trigonometric skills | 5 |
| `TOPIC_STATISTICAL_SKILLS` | Statistical skills | 2 |
| `TOPIC_REASONING_SKILLS` | Reasoning skills | 2 (cross-cutting) |

### Skill Documents (40)

**Sample Skills:**
```
SKILL_WORKING_WITH_SURDS
SKILL_SIMPLIFYING_EXPRESSIONS_USING_THE_LAWS_OF_INDICES
SKILL_ROUNDING
SKILL_WORKING_WITH_REVERSE_PERCENTAGES
SKILL_WORKING_WITH_APPRECIATION_DEPRECIATION
SKILL_WORKING_WITH_FRACTIONS
SKILL_WORKING_WITH_ALGEBRAIC_EXPRESSIONS_INVOLVING_EXPANSION_OF_BRACKETS
SKILL_FACTORISING_AN_ALGEBRAIC_EXPRESSION
...
SKILL_INTERPRETING_A_SITUATION_WHERE_MATHEMATICS_CAN_BE_USED
SKILL_EXPLAINING_A_SOLUTION_AND_RELATING_IT_TO_CONTEXT
```

---

## Query Patterns

### Get All Topics for a Course

```typescript
const topics = await databases.listDocuments(
  'default',
  'course_outcomes',
  [
    Query.equal('courseId', 'course_c84775'),
    Query.startsWith('unitCode', 'TOPIC_'),
    Query.limit(100)
  ]
);
```

### Get All Skills for a Course

```typescript
const skills = await databases.listDocuments(
  'default',
  'course_outcomes',
  [
    Query.equal('courseId', 'course_c84775'),
    Query.startsWith('unitCode', 'SKILL_'),
    Query.limit(100)
  ]
);
```

### Get Skills for a Specific Topic

**Step 1:** Fetch the topic document
```typescript
const topicDoc = await databases.listDocuments(
  'default',
  'course_outcomes',
  [
    Query.equal('courseId', 'course_c84775'),
    Query.equal('unitCode', 'TOPIC_NUMERICAL_SKILLS'),
    Query.limit(1)
  ]
);
```

**Step 2:** Parse skills_list from assessmentStandards
```typescript
const assessmentStandards = JSON.parse(topicDoc.documents[0].assessmentStandards);
const skillNames = assessmentStandards[0].skills_list;
// skillNames = ["Working with surds", "Simplifying expressions...", ...]
```

**Step 3:** Application-level filtering (Appwrite doesn't support IN queries easily)
```typescript
const allSkills = await databases.listDocuments(
  'default',
  'course_outcomes',
  [
    Query.equal('courseId', 'course_c84775'),
    Query.startsWith('unitCode', 'SKILL_'),
    Query.limit(100)
  ]
);

const topicSkills = allSkills.documents.filter(skill =>
  skillNames.includes(skill.unitTitle)
);
```

### Find Parent Topics for a Skill

```typescript
const skillDoc = await databases.getDocument(
  'default',
  'course_outcomes',
  skillDocumentId
);

// Parse teacherGuidance
const guidanceMatch = skillDoc.teacherGuidance.match(/\*\*Parent Topics\*\*: (.+)/);
const parentTopics = guidanceMatch ? guidanceMatch[1].split(', ') : [];
// parentTopics = ["Numerical skills"]
```

---

## Validation

### Built-in Validation

The `validateSkillsBasedStructure()` function checks:

**Errors (fail-fast):**
- ✅ All skills referenced in `topic_areas` exist in `skills_framework`
- ✅ No duplicate skill names

**Warnings (non-fatal):**
- ⚠️ Orphaned skills (skills not referenced by any topic)

**Example Output:**
```
✅ Validation passed

⚠️ 1 warnings:
   - Skill "Advanced topic X" is not referenced by any topic area
```

---

## Usage Guide

### Single Course Seeding (Recommended)

**NEW:** `seedSingleCourse.ts` now supports both unit-based and skills-based courses automatically.

```bash
# Dry-run test for National 5 Mathematics (skills-based)
tsx scripts/seedSingleCourse.ts --subject mathematics --level national_5 --dry-run

# Live run for National 3 Spanish (unit-based)
tsx scripts/seedSingleCourse.ts --subject spanish --level national_3
```

**Expected Output (Skills-Based):**
```
📝 Processing SQA document...
   ✅ Extracted course code: "C847 75"
   ✅ Generated courseId: course_c84775
   📊 Structure Type: skills_based
   🎯 Using skills-based extraction (National 5+ course)

🔍 Extracting outcomes from course data...
   📦 Processing 6 topic areas...
      ✅ Topic: Numerical skills (6 skills)
      ✅ Topic: Algebraic skills (15 skills)
      ...
   📦 Processing 40 skills...
      ✅ Skill: Working with surds (1 parent)
      ✅ Skill: Simplifying expressions... (1 parent)
      ...
   📊 Generated 46 course outcomes (6 topics + 40 skills)
   ✅ Extracted 46 outcomes
   📦 Topics: 6, Skills: 40

📊 Summary:
   Course ID: course_c84775
   SQA Code: C847 75
   Subject: mathematics
   Level: national-5
   Structure Type: skills_based
   Outcomes: 46
```

### Bulk Course Seeding

```bash
# Dry-run preview (mixed batch with both structure types)
tsx scripts/bulkSeedAllCourses.ts --dry-run --limit 50

# Live bulk run
tsx scripts/bulkSeedAllCourses.ts
```

**Mixed Batch Handling:**
- Unit-based courses → Traditional extraction
- Skills-based courses → Dual-unit extraction
- Structure type detected automatically per course
- Graceful error handling (continues on failure)
- JSON report includes structure type for each course

---

## Trade-offs & Design Decisions

### ✅ Advantages

1. **No Schema Changes** - Uses existing `course_outcomes` collection
2. **Consistent Data Model** - Both course types use same schema
3. **Hierarchical + Granular** - Supports both navigation and mastery tracking
4. **Query by Prefix** - Simple `TOPIC_` vs `SKILL_` filtering
5. **Cross-cutting Skills** - Reasoning skills appear in both categories
6. **Frontend Compatibility** - Teaching agents work without conditional logic

### ⚠️ Trade-offs

1. **Document Count Inflation** - 46 docs for Nat 5 Math (vs ~6-8 for unit-based)
2. **Many-to-Many Queries** - Finding skills within topic requires parsing
3. **Synthetic IDs** - `TOPIC_`/`SKILL_` prefixes don't match official SQA codes
4. **String Storage** - Parent topics stored as text in `teacherGuidance`
5. **SCQF Credits = 0** - Topics and skills don't have individual credit values

### 🎯 Accepted Constraints

- **Read-heavy workload** - Acceptable for educational platform
- **Application-level filtering** - Acceptable for small skill counts (40-60)
- **No junction tables** - Avoids additional complexity
- **Semantic loss** - Accept synthetic structure for compatibility

---

## Implementation Files

### Core Libraries (NEW: Refactored for Code Reuse)
- `scripts/lib/unitBasedExtraction.ts` - Unit-based extraction logic (National 3/4)
- `scripts/lib/skillsBasedExtraction.ts` - Skills-based extraction logic (National 5+)
- `scripts/lib/courseSeeding.ts` - Common seeding operations with auto-detection

### Seeding Scripts (Refactored to Use Shared Libraries)
- `scripts/seedSingleCourse.ts` - **Phase 1A:** Single course seeding (unit-based & skills-based)
- `scripts/bulkSeedAllCourses.ts` - **Phase 1B:** Bulk seeding with pagination (unit-based & skills-based)

### Legacy Scripts (Removed - 2025-11-01)
- ~~`scripts/extractSQAOutcomes.ts`~~ - ❌ REMOVED (replaced by seedSingleCourse.ts)
- ~~`scripts/migrateCourseOutcomes.ts`~~ - ❌ REMOVED (functionality now in seeding scripts)
- See `scripts/DEPRECATED.md` for migration guide

### Documentation
- `scripts/SKILLS_BASED_MIGRATION.md` - This file
- `scripts/README_PHASE1.md` - Phase 1 overview with shared library architecture
- `scripts/PHASE1A_TESTING.md` - seedSingleCourse.ts testing guide
- `scripts/PHASE1B_TESTING.md` - bulkSeedAllCourses.ts testing guide

---

## Future Enhancements

### Potential Improvements

1. **Add structure_type field** to `course_outcomes` collection
   - Enables filtering by structure type
   - Supports conditional UI logic

2. **Junction documents** for efficient many-to-many queries
   - Create `JUNCTION_` documents linking topics to skills
   - Trades document count for query performance

3. **Metadata enrichment**
   - Add difficulty levels to skills
   - Track prerequisite relationships
   - Store estimated time per skill

4. **SQA Code Mapping**
   - Map synthetic IDs to official SQA references
   - Maintain bidirectional lookup table

---

## Troubleshooting

### Issue: "No units found in course data"

**Cause:** Trying to use unit-based extraction on skills-based course.

**Solution:** Ensure structure_type detection is working. Check `data.course_structure.structure_type`.

### Issue: "Skills-based course missing skills_framework"

**Cause:** Malformed SQA data or parsing error.

**Solution:** Validate SQA source data has `skills_framework.skills` array.

### Issue: "Validation failed: Topic references non-existent skill"

**Cause:** Inconsistency between `topic_areas` and `skills_framework`.

**Solution:** Fix SQA source data or update skill references in topic_areas.

### Issue: "Orphaned skill" warning

**Cause:** Skill exists in `skills_framework` but no topic references it.

**Solution:** Non-fatal warning. Review if skill should be referenced by a topic.

---

## Migration Checklist

### Phase 1: Shared Library Implementation ✅ COMPLETED
- [x] Create shared library (`skillsBasedExtraction.ts`)
- [x] Create unit-based extraction library (`unitBasedExtraction.ts`)
- [x] Create common seeding library (`courseSeeding.ts`)
- [x] Refactor `bulkSeedAllCourses.ts` to use shared libraries
- [x] Refactor `seedSingleCourse.ts` to use shared libraries
- [x] Test with National 5 Mathematics (single course)
- [x] Test with bulk batch (mixed course types)
- [x] Update `README_PHASE1.md` with shared library architecture
- [x] Update `SKILLS_BASED_MIGRATION.md` with refactored script examples

### Phase 2: Production Deployment (Pending)
- [ ] Run production bulk seed for all courses
- [ ] Validate outcome counts match expected (topics + skills)
- [ ] Generate migration report with statistics

### Phase 3: Frontend Integration (Pending)
- [ ] Document query patterns in frontend code
- [ ] Update teaching agent to handle TOPIC_/SKILL_ prefixes
- [ ] Add UI components for topic/skill navigation

---

## References

- **SQA Course Specifications**: https://www.sqa.org.uk/
- **National 5 Mathematics Example**: Document ID `mathematics_national_5`
- **Phase 1 Overview**: `scripts/README_PHASE1.md`
- **Bulk Seeding Guide**: `scripts/PHASE1B_TESTING.md`
