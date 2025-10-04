# MVP2.5 Data Model — Changes (Focused on Authored_SOW & LessonTemplate)

**Product:** Multi-Course Agentic Tutor (SQA)

**Scope:** This canvas documents only the new/changed collections for **MVP2.5**, reflecting the redesigned SoW authoring workflow. All unchanged collections from MVP2 remain valid.

**Status:** Draft for review  
**Date:** 02 Oct 2025 (Europe/London)

---

## 1) Summary of Changes vs MVP2

- **New collection `Authored_SOW`** replaces `course_sow_base` for canonical authored schemes of work. Now includes direct references to outcomes and assessment standards.
- **New collection `LessonTemplate`** refined with richer pedagogy fields and alignment with SoW entries.
- Added **`outcomeRefs`** and **`assessmentStandardRefs`** fields to SoW entries for exact grounding against SQA.
- Added **`pedagogical_blocks`** to SoW entries to scaffold typical lesson design patterns.
- Harmonised `lesson_type` across SoW entries and LessonTemplates.
- Strengthened **accessibility_profile** shape with standardised boolean + CEFR-level + extra_time flags.

---

## 2) Collection: Authored_SOW

**Purpose:** Canonical author-owned Scheme of Work for each course and level. Acts as the authoritative source; copied into enrolments for delivery.

**Key Fields:**
- `$id`: Unique SoW identifier.
- `courseId`: Links to `courses` collection.
- `version`: Integer versioning (increment on updates).
- `status`: `draft` or `published`.
- `entries`: Array of SoW entries.
- `accessibility_notes`: Global accessibility guidance across SoW.
- `createdAt`, `updatedAt`: ISO datetimes.

**SoW Entry Fields:**
- `order`: Integer sequence.
- `lessonTemplateRef`: Placeholder for linking to LessonTemplate (`AUTO_TBD_x` if not yet created).
- `label`: Short teacher-facing name.
- `lesson_type`: One of `teach`, `independent_practice`, `formative_assessment`, `mock_assessment`, `revision`, `project`, `spiral_revisit`.
- `coherence`: Unit/block anchoring fields.
  - `unit`: Official unit title.
  - `block_name`: Sub-topic.
  - `block_index`: String index for ordering.
  - `prerequisites`: Array of prior lesson refs.
- `policy`: Local policy rules.
  - `calculator_section`: `non_calc`, `calc`, or `mixed`.
  - `assessment_notes`: Text.
- `engagement_tags`: Array of authentic contexts.
- `outcomeRefs`: Array of official outcome IDs (`O1`, `O2`, ...).
- `assessmentStandardRefs`: Array of assessment standard codes (`AS1.1`, `AS1.2`, ...).
- `pedagogical_blocks`: Optional list of teaching phases (`starter`, `guided_practice`, etc.).
- `accessibility_profile`: Object for entry-specific accessibility needs.
  - `dyslexia_friendly`: Boolean.
  - `plain_language_level`: CEFR level string.
  - `extra_time`: Boolean.
- `estMinutes`: Estimated duration.
- `notes`: Teacher-facing notes.

**Authored_SOW JSON Shape Example:**
```json
{
  "$id": "sow_nat3_appmath_v1",
  "courseId": "course_c84473",
  "version": 1,
  "status": "draft",
  "entries": [
    {
      "order": 86,
      "lessonTemplateRef": "AUTO_TBD_86",
      "label": "Revision: Best Deals",
      "lesson_type": "revision",
      "coherence": {
        "unit": "Applications of Mathematics: Manage Money and Data (National 3)",
        "block_name": "Best Deals",
        "block_index": "23.4",
        "prerequisites": ["Practice: Best Deals"]
      },
      "policy": {
        "calculator_section": "calc",
        "assessment_notes": "Consolidation of AS1.4."
      },
      "engagement_tags": ["consolidation", "revision_game"],
      "outcomeRefs": ["O1"],
      "assessmentStandardRefs": ["AS1.4"],
      "pedagogical_blocks": ["starter", "guided_practice"],
      "accessibility_profile": {
        "dyslexia_friendly": true,
        "plain_language_level": "CEFR_A2",
        "extra_time": true
      },
      "estMinutes": 50,
      "notes": "Use past-paper style questions to prepare for the unit assessment."
    }
  ],
  "accessibility_notes": "Global accessibility: use sans-serif fonts, chunked instructions.",
  "createdAt": "2025-09-01T08:00:00Z",
  "updatedAt": "2025-09-01T10:00:00Z"
}
```

---

## 3) Collection: LessonTemplate

**Purpose:** Defines reusable lesson patterns that SoW entries reference.

**Key Fields:**
- `$id`: Unique template identifier.
- `courseId`: Associated course.
- `title`: Should match the SoW label.
- `tags`: Array of optional discovery tags.
- `outcomeRefs`: Array of outcome IDs covered by this template.
- `assessmentStandardRefs`: Array of assessment standard codes covered.
- `lesson_type`: Must align with SoW lesson_type.
- `estMinutes`: Duration.
- `version`: Integer version.
- `status`: Draft/published.
- `engagement_tags`: Array of authentic contexts.
- `policy`: Calculator and tool policies.
- `accessibility`: Accessibility design metadata.
- `cards`: Ordered list of pedagogical steps/activities.

**LessonTemplate JSON Shape Example (Actual Appwrite Database Schema):**

**IMPORTANT**:
- Complex fields (outcomeRefs, cards, engagement_tags, policy) are stored as **JSON strings** in the database
- Accessibility features (explainer_plain, dyslexia-friendly) are embedded within card objects in the cards JSON
- Assessment standards are combined with outcomeRefs in a single JSON array
- Document $id is managed by Appwrite, not stored as a field

```json
{
  // Document ID is stored at document level by Appwrite, not as field "$id"
  "courseId": "course_c84473",  // string (max 50 chars, required)
  "title": "Revision: Best Deals",  // string (max 255 chars, required)
  "outcomeRefs": "[\"O1\", \"AS1.4\"]",  // JSON string (max 4000 chars, required) - stores both outcomes and assessment standards
  "lesson_type": "revision",  // string (max 50 chars)
  "estMinutes": 50,  // integer (5-120, default 30)
  "version": 1,  // integer (default 1)
  "status": "draft",  // enum: 'draft' or 'published' (default 'draft')
  "createdBy": "lesson_author_agent",  // string (max 50 chars, required)
  "sow_order": 57,  // integer (1-1000) - position in scheme of work
  "engagement_tags": "[\"consolidation\", \"revision_game\"]",  // JSON string (max 1000 chars, default '[]')
  "policy": "{\"calculator_allowed\": true}",  // JSON string (max 2000 chars, default '{}')
  "cards": "[{\"id\":\"c1\",\"title\":\"Starter Quiz\",\"explainer\":\"Quick recap on best deals.\",\"explainer_plain\":\"Short sentences, clear layout.\",\"cfu\":{\"type\":\"mcq\",\"id\":\"q1\",\"stem\":\"Which is the better deal: 2 for £3 or 3 for £4?\",\"options\":[\"2 for £3\",\"3 for £4\"],\"answerIndex\":1},\"rubric\":{\"total_points\":1,\"criteria\":[{\"description\":\"Correct choice\",\"points\":1}]},\"misconceptions\":[{\"id\":\"MISC_COMPARE_UNITS\",\"misconception\":\"Students forget to calculate unit cost.\",\"clarification\":\"Remind them to divide total price by quantity.\"}]}]"  // JSON string (max 8000 chars, required) - includes explainer_plain for accessibility
}
```

**Authoring Note**: When creating LessonTemplates, author them as nested JSON structures. The frontend/backend will stringify complex fields (outcomeRefs, cards, engagement_tags, policy) before saving to Appwrite.

---

## 4) Notes
- **Validation rule:** SoW.entry.lesson_type must match LessonTemplate.lesson_type.
- **Coverage rule:** Every `outcomeRefs` + `assessmentStandardRefs` in SoW must be backed by at least one LessonTemplate.
- **Flexibility:** SoW gives the **sequence & policy context**, LessonTemplates define the **pedagogical depth**.

