# SQA National 5 Mathematics - Document Extraction Design Specification

**Version:** 1.0
**Date:** December 2025
**Author:** Scottish AI Lessons
**Status:** Draft

-----

## Table of Contents

1. [Executive Summary](#1-executive-summary)
1. [Scope & Objectives](#2-scope--objectives)
1. [Input Document Types](#3-input-document-types)
1. [Structured Output Schemas](#4-structured-output-schemas)
1. [Field Reference Guide](#5-field-reference-guide)
1. [Appwrite Data Model](#6-appwrite-data-model)
1. [Storage Strategy](#7-storage-strategy)
1. [Cross-Document Linking](#8-cross-document-linking)
1. [LLM Extraction Guidelines](#9-llm-extraction-guidelines)
1. [Appendices](#10-appendices)

-----

## 1. Executive Summary

This document defines the data extraction strategy for converting SQA (Scottish Qualifications Authority) National 5 Mathematics exam documents into structured data for an AI tutoring platform. The platform's competitive advantage lies in training AI to generate solutions that match SQA examiner expectations, not just mathematically correct answers.

### 1.1 Document Types in Scope

|Document Type       |Priority|Status            |
|--------------------|--------|------------------|
|Question Papers     |P0      |✅ In Scope        |
|Marking Instructions|P0      |✅ In Scope        |
|Candidate Evidence  |P2      |🅿️ Parked (Phase 2)|
|Commentary          |P2      |🅿️ Parked (Phase 2)|

### 1.2 Key Design Decisions

1. **Dual-column marking scheme preservation**: Separate `generic_scheme` and `illustrative_scheme` collections to match SQA's marking structure
1. **Storage-first for large content**: SVG diagrams, long LaTeX expressions, and formula sheets stored in Appwrite Storage buckets
1. **Topic taxonomy**: Hierarchical topic classification aligned with SQA curriculum
1. **LaTeX-native**: All mathematical content stored in both plain text and LaTeX formats

-----

## 2. Scope & Objectives

### 2.1 Primary Objectives

1. **Extract structured question data** from SQA past papers to serve to students
1. **Extract marking schemes** to train AI to generate SQA-compliant solutions
1. **Preserve mark allocation logic** (bullet points, process marks, answer marks)
1. **Enable topic-based question retrieval** for personalised learning paths

### 2.2 Out of Scope (Phase 1)

- Candidate Evidence OCR and handwriting recognition
- Commentary/examiner reasoning extraction
- Higher and Advanced Higher levels (future expansion)
- Subjects other than Mathematics

### 2.3 Success Criteria

- 100% of questions from 2015-2024 papers extracted with correct mark allocations
- All marking schemes linked to corresponding questions
- Topic tags applied with >90% accuracy
- Diagrams extracted and renderable in web interface

-----

## 3. Input Document Types

### 3.1 Question Paper

#### Source Information

|Property              |Value                                                                                           |
|----------------------|------------------------------------------------------------------------------------------------|
|**Source URL Pattern**|`https://www.sqa.org.uk/pastpapers/papers/papers/{YEAR}/{LEVEL}_Mathematics_Paper{N}_{YEAR}.pdf`|
|**Level Codes**       |`N5` (National 5), `NH` (Higher), `NAH` (Advanced Higher)                                       |
|**Format**            |PDF (digitally created, not scanned)                                                            |
|**Typical Length**    |12-20 pages                                                                                     |

#### Document Structure

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER BLOCK (Page 1)                                        │
│ ─────────────────────────────────────────────────────────── │
│ • Paper code (e.g., X847/75/01)                             │
│ • Level + Subject (e.g., "National 5 Mathematics")          │
│ • Paper number + type (e.g., "Paper 1 (Non-calculator)")    │
│ • Exam date and time                                         │
│ • Total marks available                                      │
│ • Candidate instructions                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FORMULAE LIST (Pages 2-3, if applicable)                    │
│ ─────────────────────────────────────────────────────────── │
│ • Grouped by topic (Circle, Trigonometry, etc.)             │
│ • Mathematical notation in print format                      │
│ • Not all papers include formulae sheets                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ QUESTIONS (Repeating structure)                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ N.  [Question stem text]                              MARKS  │
│     [Diagram/graph if applicable]                            │
│                                                              │
│     (a) [Part a text]                                   [3]  │
│         (i)  [Subpart i text]                           [1]  │
│         (ii) [Subpart ii text]                          [2]  │
│     (b) [Part b text]                                   [4]  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Key Extraction Patterns

|Element        |Regex Pattern                |Notes                           |
|---------------|-----------------------------|--------------------------------|
|Question number|`^(\d+)\.\s`                 |Start of new question           |
|Part marker    |`\(([a-z])\)`                |Sub-question parts (a), (b), (c)|
|Subpart marker |`\(([ivx]+)\)`               |Roman numerals (i), (ii), (iii) |
|Marks          |`(\d+)\s*$` or `\[(\d+)\]`   |Right-aligned or bracketed      |
|Total marks    |`Total marks\s*[–—-]\s*(\d+)`|In header section               |
|Paper code     |`X\d{3}/\d{2}/\d{2}`         |SQA paper identifier            |

-----

### 3.2 Marking Instructions

#### Source Information

|Property              |Value                                                                                           |
|----------------------|------------------------------------------------------------------------------------------------|
|**Source URL Pattern**|`https://www.sqa.org.uk/pastpapers/papers/mi/{YEAR}/mi_{LEVEL}_Mathematics_Paper-{N}_{YEAR}.pdf`|
|**Format**            |PDF with embedded tables                                                                        |
|**Typical Length**    |15-30 pages                                                                                     |

#### Document Structure

```
┌─────────────────────────────────────────────────────────────┐
│ GENERAL MARKING PRINCIPLES (Pages 2-4)                      │
│ ─────────────────────────────────────────────────────────── │
│ (a) Positive marking philosophy                              │
│ (b) Marks per bullet point (•)                              │
│ (c) Error handling rules                                     │
│ (d) Transcription error policies                            │
│ (e) Horizontal vs vertical marking                          │
│ (f) Simplification requirements                              │
│ (g) Trivial error handling                                   │
│ (h) Arithmetic error policies                                │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PER-QUESTION MARKING TABLE                                   │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Question │ Generic Scheme      │ Illustrative Scheme        │
│ ─────────┼────────────────────┼───────────────────────────  │
│    1     │ •1 [process desc]  │ •1 [specific answer]        │
│          │ •2 [process desc]  │ •2 [specific answer]        │
│          │ •3 [process desc]  │ •3 [specific answer]        │
│          │                    │                    Max: 3   │
│          │                                                   │
│ Notes:                                                       │
│ 1. [Exception or clarification]                             │
│ 2. [Alternative acceptable methods]                         │
│                                                              │
│ Commonly Observed Responses:                                 │
│ Candidate A – [scenario description]                        │
│ [worked example with mark annotations]                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Key Extraction Patterns

|Element            |Pattern                                 |Notes                   |
|-------------------|----------------------------------------|------------------------|
|Mark bullet        |`[•·](\d+)`                             |Each bullet = 1 mark    |
|Generic process    |Text after bullet in Generic column     |What skill is assessed  |
|Illustrative answer|Text after bullet in Illustrative column|Expected answer         |
|Max marks          |`Max(?:imum)?(?:\s*mark)?[:\s]*(\d+)`   |Per question total      |
|Notes section      |`Notes?:` followed by numbered list     |Clarifications          |
|COR header         |`Commonly Observed Responses:`          |Start of worked examples|
|Candidate scenario |`Candidate\s+([A-Z])\s*[–—-]`           |Named example patterns  |

-----

## 4. Structured Output Schemas

### 4.1 Question Paper Schema

```typescript
interface QuestionPaperOutput {
  paper: PaperMetadata;
  formulae: FormulaSet[];
  questions: Question[];
}

interface PaperMetadata {
  code: string;              // "X847/75/01"
  year: number;              // 2023
  level: LevelCode;          // "N5" | "NH" | "NAH"
  level_name: string;        // "National 5"
  subject: string;           // "Mathematics"
  paper_number: number;      // 1 or 2
  calculator_allowed: boolean;
  exam_date: string | null;  // ISO date "2023-05-04"
  duration_minutes: number;  // 65
  total_marks: number;       // 40
  source_url: string;
}

interface FormulaSet {
  topic: string;             // "Circle", "Trigonometry"
  formulas: string[];        // Plain text versions
  formulas_latex: string[];  // LaTeX versions
}

interface Question {
  number: string;            // "1", "4", "12"
  text: string;              // Question stem (markdown)
  text_latex: string;        // LaTeX version
  marks: number | null;      // null if has parts
  has_parts: boolean;
  parts: QuestionPart[];
  topic_tags: string[];      // ["quadratics", "parabolas"]
  diagrams: DiagramRef[];
}

interface QuestionPart {
  part: string;              // "a", "b"
  subpart: string | null;    // "i", "ii" or null
  text: string;
  text_latex: string;
  marks: number;
  topic_tags: string[];
}

interface DiagramRef {
  id: string;                // Generated unique ID
  type: DiagramType;         // "graph" | "geometry" | "table" | "other"
  description: string;       // Alt text
  filename: string;          // "q4_parabola.svg"
}
```

### 4.2 Marking Instructions Schema

```typescript
interface MarkingInstructionsOutput {
  marking_scheme: MarkingSchemeMetadata;
  general_principles: GeneralPrinciple[];
  solutions: Solution[];
}

interface MarkingSchemeMetadata {
  paper_code: string;        // Links to paper.code
  year: number;
  paper_number: number;
  source_url: string;
}

interface GeneralPrinciple {
  principle_id: string;      // "a", "b", "g"
  principle: string;         // "positive_marking", "trivial_errors"
  description: string;       // Full text of principle
  exceptions: string[];      // ["see point (h)"]
}

interface Solution {
  question_number: string;   // "1", "4a", "4a(i)"
  part: string | null;
  subpart: string | null;
  max_marks: number;
  generic_scheme: GenericMark[];
  illustrative_scheme: IllustrativeMark[];
  notes: string[];
  commonly_observed_responses: COR[];  // Parked for Phase 2
}

interface GenericMark {
  bullet: number;            // 1, 2, 3
  process: string;           // "start to invert and multiply"
}

interface IllustrativeMark {
  bullet: number;
  answer: string;            // "13/6 × 9/8"
  answer_latex: string;
  condition: string | null;  // "stated or implied by •3"
  alternative: string | null;
  alternative_latex: string | null;
}

interface COR {
  candidate_id: string;      // "A", "B", "C"
  scenario: string;          // "correct method but does not simplify"
  working: string;
  working_latex: string;
  marks_awarded: string[];   // ["•1", "•2"]
}
```

-----

## 5. Field Reference Guide

This section provides detailed documentation for each field, including its purpose, how LLMs should extract/populate it, and validation rules.

### 5.1 Paper Metadata Fields

#### `code`

|Property          |Value                                                                                                                                            |
|------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`string`                                                                                                                                         |
|**Required**      |Yes                                                                                                                                              |
|**Max Length**    |20 characters                                                                                                                                    |
|**Format**        |`X###/##/##`                                                                                                                                     |
|**Example**       |`"X847/75/01"`                                                                                                                                   |
|**Purpose**       |Unique SQA identifier for the exam paper. Used for cross-referencing with marking schemes and official SQA resources.                            |
|**LLM Extraction**|Extract from the header block on page 1. Usually appears in the top-left corner. Pattern: `X` followed by 3 digits, `/`, 2 digits, `/`, 2 digits.|
|**Validation**    |Must match regex `^X\d{3}/\d{2}/\d{2}$`                                                                                                          |

#### `year`

|Property          |Value                                                                                            |
|------------------|-------------------------------------------------------------------------------------------------|
|**Type**          |`integer`                                                                                        |
|**Required**      |Yes                                                                                              |
|**Range**         |2014-2030                                                                                        |
|**Example**       |`2023`                                                                                           |
|**Purpose**       |Exam diet year. Used for filtering questions by recency and tracking curriculum changes.         |
|**LLM Extraction**|Extract from header block or filename. The year appears after the paper code or in the date line.|
|**Validation**    |Must be a 4-digit year within valid range                                                        |

#### `level`

|Property          |Value                                                                                            |
|------------------|-------------------------------------------------------------------------------------------------|
|**Type**          |`enum string`                                                                                    |
|**Required**      |Yes                                                                                              |
|**Allowed Values**|`"N5"`, `"NH"`, `"NAH"`                                                                          |
|**Example**       |`"N5"`                                                                                           |
|**Purpose**       |SQA qualification level code. Determines difficulty tier and curriculum alignment.               |
|**LLM Extraction**|Infer from document title or URL. "National 5" → `N5`, "Higher" → `NH`, "Advanced Higher" → `NAH`|

#### `level_name`

|Property          |Value                                                                                                  |
|------------------|-------------------------------------------------------------------------------------------------------|
|**Type**          |`string`                                                                                               |
|**Required**      |Yes                                                                                                    |
|**Max Length**    |50 characters                                                                                          |
|**Example**       |`"National 5"`                                                                                         |
|**Purpose**       |Human-readable qualification name for display in UI.                                                   |
|**LLM Extraction**|Extract the full level name from the document header (e.g., "National 5", "Higher", "Advanced Higher").|

#### `calculator_allowed`

|Property          |Value                                                                                                                                 |
|------------------|--------------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`boolean`                                                                                                                             |
|**Required**      |Yes                                                                                                                                   |
|**Example**       |`false`                                                                                                                               |
|**Purpose**       |Indicates exam conditions. Affects which questions are appropriate for practice modes. Paper 1 = non-calculator, Paper 2 = calculator.|
|**LLM Extraction**|Look for "Non-calculator" or "Calculator" in the paper title/header. Paper 1 is typically non-calculator, Paper 2 allows calculators. |

#### `exam_date`

|Property          |Value                                                                                                                                             |
|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`datetime` (ISO 8601) or `null`                                                                                                                   |
|**Required**      |No                                                                                                                                                |
|**Example**       |`"2023-05-04T09:00:00.000Z"`                                                                                                                      |
|**Purpose**       |Original exam sitting date. Useful for historical context and determining question "freshness".                                                   |
|**LLM Extraction**|Extract from header block. Format varies: "Thursday, 4 May", "4 May 2023", etc. Convert to ISO format. If time is not specified, default to 09:00.|

#### `duration_minutes`

|Property          |Value                                                                                                                                        |
|------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`integer`                                                                                                                                    |
|**Required**      |Yes                                                                                                                                          |
|**Example**       |`65`                                                                                                                                         |
|**Purpose**       |Allocated exam time. Used to calculate expected time per mark and pace recommendations.                                                      |
|**LLM Extraction**|Extract from header instructions. Look for patterns like "1 hour 5 minutes", "65 minutes", "1 hour and 30 minutes". Convert to total minutes.|

#### `total_marks`

|Property          |Value                                                                                     |
|------------------|------------------------------------------------------------------------------------------|
|**Type**          |`integer`                                                                                 |
|**Required**      |Yes                                                                                       |
|**Example**       |`40`                                                                                      |
|**Purpose**       |Sum of all available marks. Used for validation (sum of question marks should equal this).|
|**LLM Extraction**|Extract from header block. Pattern: "Total marks – ##" or "Total marks: ##".              |
|**Validation**    |Should equal sum of all question/part marks                                               |

-----

### 5.2 Question Fields

#### `number`

|Property          |Value                                                                                                          |
|------------------|---------------------------------------------------------------------------------------------------------------|
|**Type**          |`string`                                                                                                       |
|**Required**      |Yes                                                                                                            |
|**Max Length**    |10 characters                                                                                                  |
|**Example**       |`"4"`, `"12"`                                                                                                  |
|**Purpose**       |Question number as displayed in paper. String type preserves original formatting.                              |
|**LLM Extraction**|Extract the number before the question text. Pattern: number followed by period and space at start of question.|
|**Note**          |Stored as string (not integer) to handle potential future formats like "4A"                                    |

#### `text`

|Property          |Value                                                                                                                                                                                                                                |
|------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`string`                                                                                                                                                                                                                             |
|**Required**      |Yes                                                                                                                                                                                                                                  |
|**Max Length**    |5000 characters                                                                                                                                                                                                                      |
|**Storage**       |Database (if ≤5000 chars) or Storage bucket (if larger)                                                                                                                                                                              |
|**Example**       |`"The graph below shows part of a parabola of the form y = (x + a)² + b."`                                                                                                                                                           |
|**Purpose**       |The question stem/prompt shown to students. Markdown formatted for rendering.                                                                                                                                                        |
|**LLM Extraction**|Extract all text between the question number and either: (a) the first part marker like "(a)", or (b) the marks indicator, or (c) the next question. Include context-setting text but exclude instructions that are part of subparts.|
|**Formatting**    |Use Markdown. Convert mathematical notation to `$...$` for inline math.                                                                                                                                                              |

#### `text_latex`

|Property          |Value                                                                                                                                                                         |
|------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`string`                                                                                                                                                                      |
|**Required**      |No                                                                                                                                                                            |
|**Max Length**    |5000 characters                                                                                                                                                               |
|**Example**       |`"The graph below shows part of a parabola of the form $y = (x + a)^2 + b$."`                                                                                                 |
|**Purpose**       |LaTeX-formatted version for proper mathematical rendering in web UI.                                                                                                          |
|**LLM Extraction**|Convert the `text` field to proper LaTeX. Use `$...$` for inline math, `$$...$$` for display math. Convert fractions to `\frac{}{}`, powers to `^{}`, roots to `\sqrt{}`, etc.|

#### `marks`

|Property          |Value                                                                                                                                                                    |
|------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`integer` or `null`                                                                                                                                                      |
|**Required**      |Conditional                                                                                                                                                              |
|**Example**       |`3` or `null`                                                                                                                                                            |
|**Purpose**       |Total marks for this question. `null` if question has parts (marks are on parts instead).                                                                                |
|**LLM Extraction**|If question has no parts: extract the mark value from the right side of the question (usually in square brackets or right-aligned). If question has parts: set to `null`.|
|**Validation**    |Must be `null` if `has_parts` is `true`. Must be positive integer if `has_parts` is `false`.                                                                             |

#### `has_parts`

|Property          |Value                                                                                                                                                   |
|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`boolean`                                                                                                                                               |
|**Required**      |Yes                                                                                                                                                     |
|**Example**       |`true`                                                                                                                                                  |
|**Purpose**       |Indicates whether question has sub-parts. Determines whether to look for marks at question or part level.                                               |
|**LLM Extraction**|Set to `true` if the question contains markers like "(a)", "(b)", "(i)", "(ii)". Set to `false` if question is standalone with a single mark allocation.|

#### `topic_tags`

|Property              |Value                                                                                                                                                                               |
|----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Type**              |`array[string]`                                                                                                                                                                     |
|**Required**          |No                                                                                                                                                                                  |
|**Max Items**         |10                                                                                                                                                                                  |
|**Max Length per Tag**|50 characters                                                                                                                                                                       |
|**Example**           |`["quadratics", "parabolas", "turning_points"]`                                                                                                                                     |
|**Purpose**           |Curriculum topic classification for filtering and learning path recommendations.                                                                                                    |
|**LLM Extraction**    |Analyse the question content and classify into SQA N5 curriculum topics. Use the topic taxonomy in Appendix A. Apply 1-5 relevant tags, ordered by relevance. Use snake_case format.|
|**Validation**        |Tags should match entries in the `topics` reference collection                                                                                                                      |

#### `diagrams`

|Property          |Value                                                                                                                                                                                            |
|------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`array[string]`                                                                                                                                                                                  |
|**Required**      |No                                                                                                                                                                                               |
|**Example**       |`["diag-n5-2023-p1-q4"]`                                                                                                                                                                         |
|**Purpose**       |References to diagram records associated with this question.                                                                                                                                     |
|**LLM Extraction**|Identify any diagrams, graphs, tables, or figures referenced in the question. Create a diagram reference ID for each. Look for phrases like "the diagram shows", "the graph below", "see figure".|

-----

### 5.3 Question Part Fields

#### `part`

|Property          |Value                                                                                  |
|------------------|---------------------------------------------------------------------------------------|
|**Type**          |`string`                                                                               |
|**Required**      |Yes                                                                                    |
|**Max Length**    |5 characters                                                                           |
|**Example**       |`"a"`, `"b"`                                                                           |
|**Purpose**       |Part identifier within a question. Lowercase letter as displayed in paper.             |
|**LLM Extraction**|Extract the letter from within parentheses: "(a)" → "a", "(b)" → "b". Always lowercase.|

#### `subpart`

|Property          |Value                                                                                                                |
|------------------|---------------------------------------------------------------------------------------------------------------------|
|**Type**          |`string` or `null`                                                                                                   |
|**Required**      |No                                                                                                                   |
|**Max Length**    |5 characters                                                                                                         |
|**Example**       |`"i"`, `"ii"`, `null`                                                                                                |
|**Purpose**       |Subpart identifier for nested parts. Roman numeral as displayed. `null` if no subpart.                               |
|**LLM Extraction**|Extract roman numeral from within parentheses: "(i)" → "i", "(ii)" → "ii". Set to `null` if the part has no subparts.|

#### `sort_order`

|Property          |Value                                                                                                                                         |
|------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`integer`                                                                                                                                     |
|**Required**      |Yes                                                                                                                                           |
|**Example**       |`1`, `2`, `3`                                                                                                                                 |
|**Purpose**       |Maintains display order of parts within a question. Enables correct sequencing in UI.                                                         |
|**LLM Extraction**|Assign sequential integers starting from 1, in the order parts appear in the document. For nested structures: (a)(i)=1, (a)(ii)=2, (b)=3, etc.|

-----

### 5.4 Marking Scheme Fields

#### `principle_id`

|Property          |Value                                                                                                                                  |
|------------------|---------------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`string`                                                                                                                               |
|**Required**      |Yes                                                                                                                                    |
|**Max Length**    |5 characters                                                                                                                           |
|**Example**       |`"a"`, `"g"`, `"h"`                                                                                                                    |
|**Purpose**       |Identifier for the general marking principle. Matches lettering in SQA marking instructions.                                           |
|**LLM Extraction**|Extract the letter/number that precedes each principle in the general marking principles section. Usually format: "(a) Principle text…"|

#### `principle`

|Property          |Value                                                                                                                                                                                                                                                                                        |
|------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`string`                                                                                                                                                                                                                                                                                     |
|**Required**      |Yes                                                                                                                                                                                                                                                                                          |
|**Max Length**    |50 characters                                                                                                                                                                                                                                                                                |
|**Example**       |`"positive_marking"`, `"trivial_errors"`                                                                                                                                                                                                                                                     |
|**Purpose**       |Machine-readable slug for the principle type. Enables programmatic rule application.                                                                                                                                                                                                         |
|**LLM Extraction**|Create a snake_case slug that summarises the principle. Common values: `positive_marking`, `one_mark_per_bullet`, `error_handling`, `transcription_error`, `horizontal_marking`, `vertical_marking`, `simplification_required`, `trivial_errors`, `arithmetic_errors`, `show_that_questions`.|

#### `description`

|Property          |Value                                                                                                                                                        |
|------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`string`                                                                                                                                                     |
|**Required**      |Yes                                                                                                                                                          |
|**Max Length**    |1000 characters                                                                                                                                              |
|**Example**       |`"Candidates accumulate marks for the demonstration of relevant skills, knowledge and understanding."`                                                       |
|**Purpose**       |Full text of the marking principle. Used for displaying to students explaining marking criteria.                                                             |
|**LLM Extraction**|Extract the complete text of the principle, preserving the original wording. This is important for accuracy as students may reference official SQA documents.|

#### `exceptions`

|Property          |Value                                                                                                 |
|------------------|------------------------------------------------------------------------------------------------------|
|**Type**          |`array[string]` or `null`                                                                             |
|**Required**      |No                                                                                                    |
|**Example**       |`["see point (h) for arithmetic errors that change difficulty"]`                                      |
|**Purpose**       |Cross-references to other principles that modify or override this one.                                |
|**LLM Extraction**|Extract any "see point X" or "except when" clauses. These indicate interactions between marking rules.|

-----

### 5.5 Solution Fields

#### `max_marks`

|Property          |Value                                                                                                               |
|------------------|--------------------------------------------------------------------------------------------------------------------|
|**Type**          |`integer`                                                                                                           |
|**Required**      |Yes                                                                                                                 |
|**Example**       |`3`                                                                                                                 |
|**Purpose**       |Maximum marks available for this solution. Should equal count of bullets in generic/illustrative scheme.            |
|**LLM Extraction**|Extract from "Max mark" or "Max:" annotation in the marking table. Alternatively, count the number of bullet points.|
|**Validation**    |Must equal `len(generic_scheme)` and `len(illustrative_scheme)`                                                     |

#### `notes`

|Property               |Value                                                                                                                             |
|-----------------------|----------------------------------------------------------------------------------------------------------------------------------|
|**Type**               |`array[string]`                                                                                                                   |
|**Required**           |No                                                                                                                                |
|**Max Items**          |10                                                                                                                                |
|**Max Length per Note**|500 characters                                                                                                                    |
|**Example**            |`["Accept equivalent fractions", "Accept 2 7/16 or 39/16"]`                                                                       |
|**Purpose**            |Additional marking guidance not captured in bullet structure. Critical for understanding acceptable variations.                   |
|**LLM Extraction**     |Extract text from the "Notes:" section following the marking table for each question. Each numbered note becomes an array element.|

-----

### 5.6 Generic Scheme Fields

#### `bullet`

|Property          |Value                                                                                            |
|------------------|-------------------------------------------------------------------------------------------------|
|**Type**          |`integer`                                                                                        |
|**Required**      |Yes                                                                                              |
|**Example**       |`1`, `2`, `3`                                                                                    |
|**Purpose**       |Bullet point number corresponding to one mark. SQA uses "•1", "•2", etc.                         |
|**LLM Extraction**|Extract the number following the bullet symbol (• or ·). Each bullet represents exactly one mark.|

#### `process`

|Property          |Value                                                                                                                                                                                                                                     |
|------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`string`                                                                                                                                                                                                                                  |
|**Required**      |Yes                                                                                                                                                                                                                                       |
|**Max Length**    |500 characters                                                                                                                                                                                                                            |
|**Example**       |`"start to invert and multiply"`                                                                                                                                                                                                          |
|**Purpose**       |Description of the mathematical process/skill being assessed. This is what the examiner looks for, independent of specific numbers.                                                                                                       |
|**LLM Extraction**|Extract from the "Generic Scheme" column of the marking table. This describes WHAT the candidate should do, not the specific answer. Key phrases: "express", "differentiate", "substitute", "simplify", "state", "calculate", "determine".|
|**AI Usage**      |Use this to train the AI on what mathematical processes earn marks, enabling it to explain WHY each step is worth marks, not just WHAT the answer is.                                                                                     |

-----

### 5.7 Illustrative Scheme Fields

#### `answer`

|Property          |Value                                                                                                                         |
|------------------|------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`string`                                                                                                                      |
|**Required**      |Yes                                                                                                                           |
|**Max Length**    |500 characters                                                                                                                |
|**Example**       |`"13/6 × 9/8"`                                                                                                                |
|**Purpose**       |The specific expected answer/working for this bullet point.                                                                   |
|**LLM Extraction**|Extract from the "Illustrative Scheme" column. This is the concrete answer the examiner expects to see, with specific numbers.|

#### `answer_latex`

|Property          |Value                                                                                                              |
|------------------|-------------------------------------------------------------------------------------------------------------------|
|**Type**          |`string`                                                                                                           |
|**Required**      |No                                                                                                                 |
|**Max Length**    |500 characters                                                                                                     |
|**Example**       |`"\\frac{13}{6} \\times \\frac{9}{8}"`                                                                             |
|**Purpose**       |LaTeX-formatted version for proper mathematical rendering.                                                         |
|**LLM Extraction**|Convert the `answer` field to LaTeX notation. Use proper commands for fractions, powers, roots, Greek letters, etc.|

#### `condition`

|Property          |Value                                                                                                                                                         |
|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Type**          |`string` or `null`                                                                                                                                            |
|**Required**      |No                                                                                                                                                            |
|**Max Length**    |200 characters                                                                                                                                                |
|**Example**       |`"stated or implied by •3"`                                                                                                                                   |
|**Purpose**       |Conditions under which this mark can be awarded even without explicit working shown.                                                                          |
|**LLM Extraction**|Look for parenthetical notes or conditions attached to the illustrative answer. Common patterns: "stated or implied by", "may be embedded in", "if no errors".|
|**AI Usage**      |Use this to understand when partial marks can be awarded based on subsequent work.                                                                            |

#### `alternative`

|Property          |Value                                                                                              |
|------------------|---------------------------------------------------------------------------------------------------|
|**Type**          |`string` or `null`                                                                                 |
|**Required**      |No                                                                                                 |
|**Max Length**    |500 characters                                                                                     |
|**Example**       |`"2 7/16"`                                                                                         |
|**Purpose**       |Alternative acceptable form of the answer. Important for training AI on equivalent expressions.    |
|**LLM Extraction**|Look for "or" statements, alternative forms in brackets, or notes indicating acceptable variations.|
|**AI Usage**      |Ensure AI-generated solutions mention when multiple answer forms are acceptable.                   |

-----

## 6. Appwrite Data Model

### 6.1 Appwrite Limitations Reference

Based on Appwrite's MariaDB backend:

|Constraint        |Limit                    |Mitigation Strategy                               |
|------------------|-------------------------|--------------------------------------------------|
|Row size limit    |~16KB for indexed strings|Use size >16384 for large text (becomes TEXT type)|
|String index limit|768 characters           |Only add indexes to short strings                 |
|Attribute count   |~1000 per collection     |Split into related collections                    |
|Single string max |~4GB (LONGTEXT)          |Use size 16777216 for very large content          |
|Array strings     |Auto LONGTEXT            |No explicit size needed                           |

### 6.2 Collection Definitions

#### 6.2.1 `papers` Collection

```javascript
{
  "$id": "papers",
  "name": "Papers",
  "attributes": [
    // Identity - Indexable (< 768 chars)
    {
      "key": "code",
      "type": "string",
      "size": 20,
      "required": true,
      "array": false,
      "description": "SQA paper code (e.g., X847/75/01)"
    },
    {
      "key": "year",
      "type": "integer",
      "required": true,
      "min": 2014,
      "max": 2030,
      "description": "Exam year"
    },
    {
      "key": "level",
      "type": "string",
      "size": 10,
      "required": true,
      "description": "Level code: N5, NH, NAH"
    },
    {
      "key": "level_name",
      "type": "string",
      "size": 50,
      "required": true,
      "description": "Display name: National 5, Higher, Advanced Higher"
    },
    {
      "key": "subject",
      "type": "string",
      "size": 50,
      "required": true,
      "description": "Subject name"
    },
    {
      "key": "paper_number",
      "type": "integer",
      "required": true,
      "min": 1,
      "max": 3,
      "description": "Paper number within exam diet"
    },

    // Exam conditions
    {
      "key": "calculator_allowed",
      "type": "boolean",
      "required": true,
      "description": "Whether calculator is permitted"
    },
    {
      "key": "exam_date",
      "type": "datetime",
      "required": false,
      "description": "Original exam sitting date"
    },
    {
      "key": "duration_minutes",
      "type": "integer",
      "required": true,
      "min": 30,
      "max": 180,
      "description": "Allocated exam time in minutes"
    },
    {
      "key": "total_marks",
      "type": "integer",
      "required": true,
      "min": 1,
      "max": 150,
      "description": "Total marks available"
    },

    // Source references
    {
      "key": "source_url",
      "type": "url",
      "required": false,
      "description": "SQA download URL"
    },
    {
      "key": "source_file_id",
      "type": "string",
      "size": 36,
      "required": false,
      "description": "Appwrite Storage file ID for PDF"
    }
  ],
  "indexes": [
    {
      "key": "code_unique",
      "type": "unique",
      "attributes": ["code"]
    },
    {
      "key": "year_level_paper",
      "type": "key",
      "attributes": ["year", "level", "paper_number"]
    },
    {
      "key": "level_idx",
      "type": "key",
      "attributes": ["level"]
    }
  ]
}
```

#### 6.2.2 `formulae` Collection

```javascript
{
  "$id": "formulae",
  "name": "Formulae",
  "attributes": [
    {
      "key": "paper_id",
      "type": "string",
      "size": 36,
      "required": true,
      "description": "Reference to papers collection"
    },
    {
      "key": "topic",
      "type": "string",
      "size": 100,
      "required": true,
      "description": "Formula category (e.g., Circle, Trigonometry)"
    },
    {
      "key": "formulas",
      "type": "string",
      "size": 65535,  // TEXT type, auto-excludes from row limit
      "required": true,
      "array": true,
      "description": "Array of formula strings in plain text"
    },
    {
      "key": "formulas_latex",
      "type": "string",
      "size": 65535,
      "required": false,
      "array": true,
      "description": "Array of formula strings in LaTeX"
    },
    {
      "key": "sort_order",
      "type": "integer",
      "required": true,
      "description": "Display order within paper"
    }
  ],
  "indexes": [
    {
      "key": "paper_id_idx",
      "type": "key",
      "attributes": ["paper_id"]
    }
  ]
}
```

#### 6.2.3 `questions` Collection

```javascript
{
  "$id": "questions",
  "name": "Questions",
  "attributes": [
    {
      "key": "paper_id",
      "type": "string",
      "size": 36,
      "required": true,
      "description": "Reference to papers collection"
    },
    {
      "key": "number",
      "type": "string",
      "size": 10,
      "required": true,
      "description": "Question number as displayed"
    },
    {
      "key": "text",
      "type": "string",
      "size": 16777216,  // LONGTEXT - excludes from row limit
      "required": true,
      "description": "Question stem in Markdown"
    },
    {
      "key": "text_latex",
      "type": "string",
      "size": 16777216,
      "required": false,
      "description": "Question stem with LaTeX math"
    },
    {
      "key": "marks",
      "type": "integer",
      "required": false,
      "min": 1,
      "max": 20,
      "description": "Marks (null if has parts)"
    },
    {
      "key": "has_parts",
      "type": "boolean",
      "required": true,
      "default": false,
      "description": "Whether question has sub-parts"
    },
    {
      "key": "topic_tags",
      "type": "string",
      "size": 50,
      "required": false,
      "array": true,
      "description": "Curriculum topic classifications"
    },
    {
      "key": "diagram_ids",
      "type": "string",
      "size": 36,
      "required": false,
      "array": true,
      "description": "References to diagrams collection"
    }
  ],
  "indexes": [
    {
      "key": "paper_id_idx",
      "type": "key",
      "attributes": ["paper_id"]
    },
    {
      "key": "paper_number_idx",
      "type": "key",
      "attributes": ["paper_id", "number"]
    },
    {
      "key": "topics_fulltext",
      "type": "fulltext",
      "attributes": ["topic_tags"]
    }
  ]
}
```

#### 6.2.4 `question_parts` Collection

```javascript
{
  "$id": "question_parts",
  "name": "Question Parts",
  "attributes": [
    {
      "key": "question_id",
      "type": "string",
      "size": 36,
      "required": true,
      "description": "Reference to questions collection"
    },
    {
      "key": "part",
      "type": "string",
      "size": 5,
      "required": true,
      "description": "Part label (a, b, c)"
    },
    {
      "key": "subpart",
      "type": "string",
      "size": 5,
      "required": false,
      "description": "Subpart label (i, ii, iii) or null"
    },
    {
      "key": "text",
      "type": "string",
      "size": 16777216,
      "required": true,
      "description": "Part text in Markdown"
    },
    {
      "key": "text_latex",
      "type": "string",
      "size": 16777216,
      "required": false,
      "description": "Part text with LaTeX"
    },
    {
      "key": "marks",
      "type": "integer",
      "required": true,
      "min": 1,
      "max": 10,
      "description": "Marks for this part"
    },
    {
      "key": "topic_tags",
      "type": "string",
      "size": 50,
      "required": false,
      "array": true,
      "description": "Topic classifications"
    },
    {
      "key": "sort_order",
      "type": "integer",
      "required": true,
      "description": "Display order within question"
    }
  ],
  "indexes": [
    {
      "key": "question_id_idx",
      "type": "key",
      "attributes": ["question_id"]
    },
    {
      "key": "sort_idx",
      "type": "key",
      "attributes": ["question_id", "sort_order"]
    }
  ]
}
```

#### 6.2.5 `diagrams` Collection

```javascript
{
  "$id": "diagrams",
  "name": "Diagrams",
  "attributes": [
    {
      "key": "question_id",
      "type": "string",
      "size": 36,
      "required": true,
      "description": "Reference to questions collection"
    },
    {
      "key": "filename",
      "type": "string",
      "size": 100,
      "required": true,
      "description": "Original filename"
    },
    {
      "key": "type",
      "type": "string",
      "size": 30,
      "required": true,
      "description": "Diagram type: graph, geometry, table, other"
    },
    {
      "key": "description",
      "type": "string",
      "size": 500,
      "required": false,
      "description": "Alt text / description for accessibility"
    },
    {
      "key": "file_id",
      "type": "string",
      "size": 36,
      "required": false,
      "description": "Appwrite Storage file ID for image/SVG"
    },
    {
      "key": "render_type",
      "type": "string",
      "size": 30,
      "required": false,
      "description": "Rendering engine: jsxgraph, desmos, matplotlib, static"
    },
    {
      "key": "render_config_file_id",
      "type": "string",
      "size": 36,
      "required": false,
      "description": "Storage file ID for render config JSON"
    }
  ],
  "indexes": [
    {
      "key": "question_id_idx",
      "type": "key",
      "attributes": ["question_id"]
    }
  ]
}
```

#### 6.2.6 `marking_schemes` Collection

```javascript
{
  "$id": "marking_schemes",
  "name": "Marking Schemes",
  "attributes": [
    {
      "key": "paper_id",
      "type": "string",
      "size": 36,
      "required": true,
      "description": "Reference to papers collection"
    },
    {
      "key": "source_url",
      "type": "url",
      "required": false,
      "description": "SQA download URL"
    },
    {
      "key": "source_file_id",
      "type": "string",
      "size": 36,
      "required": false,
      "description": "Appwrite Storage file ID for PDF"
    }
  ],
  "indexes": [
    {
      "key": "paper_id_unique",
      "type": "unique",
      "attributes": ["paper_id"]
    }
  ]
}
```

#### 6.2.7 `general_marking_principles` Collection

```javascript
{
  "$id": "general_marking_principles",
  "name": "General Marking Principles",
  "attributes": [
    {
      "key": "marking_scheme_id",
      "type": "string",
      "size": 36,
      "required": true,
      "description": "Reference to marking_schemes collection"
    },
    {
      "key": "principle_id",
      "type": "string",
      "size": 5,
      "required": true,
      "description": "Principle identifier (a, b, g)"
    },
    {
      "key": "principle",
      "type": "string",
      "size": 50,
      "required": true,
      "description": "Machine-readable principle slug"
    },
    {
      "key": "description",
      "type": "string",
      "size": 2000,
      "required": true,
      "description": "Full principle text"
    },
    {
      "key": "exceptions",
      "type": "string",
      "size": 200,
      "required": false,
      "array": true,
      "description": "Cross-references to other principles"
    },
    {
      "key": "sort_order",
      "type": "integer",
      "required": true,
      "description": "Display order"
    }
  ],
  "indexes": [
    {
      "key": "marking_scheme_id_idx",
      "type": "key",
      "attributes": ["marking_scheme_id"]
    }
  ]
}
```

#### 6.2.8 `solutions` Collection

```javascript
{
  "$id": "solutions",
  "name": "Solutions",
  "attributes": [
    {
      "key": "marking_scheme_id",
      "type": "string",
      "size": 36,
      "required": true,
      "description": "Reference to marking_schemes collection"
    },
    {
      "key": "question_id",
      "type": "string",
      "size": 36,
      "required": true,
      "description": "Reference to questions collection"
    },
    {
      "key": "part_id",
      "type": "string",
      "size": 36,
      "required": false,
      "description": "Reference to question_parts (null if whole question)"
    },
    {
      "key": "max_marks",
      "type": "integer",
      "required": true,
      "min": 1,
      "max": 20,
      "description": "Maximum marks for this solution"
    },
    {
      "key": "notes",
      "type": "string",
      "size": 1000,
      "required": false,
      "array": true,
      "description": "Additional marking notes"
    }
  ],
  "indexes": [
    {
      "key": "question_id_idx",
      "type": "key",
      "attributes": ["question_id"]
    },
    {
      "key": "part_id_idx",
      "type": "key",
      "attributes": ["part_id"]
    },
    {
      "key": "marking_scheme_id_idx",
      "type": "key",
      "attributes": ["marking_scheme_id"]
    }
  ]
}
```

#### 6.2.9 `generic_scheme` Collection

```javascript
{
  "$id": "generic_scheme",
  "name": "Generic Scheme",
  "attributes": [
    {
      "key": "solution_id",
      "type": "string",
      "size": 36,
      "required": true,
      "description": "Reference to solutions collection"
    },
    {
      "key": "bullet",
      "type": "integer",
      "required": true,
      "min": 1,
      "max": 20,
      "description": "Bullet point number (each = 1 mark)"
    },
    {
      "key": "process",
      "type": "string",
      "size": 500,
      "required": true,
      "description": "Process description (what skill is assessed)"
    },
    {
      "key": "sort_order",
      "type": "integer",
      "required": true,
      "description": "Display order"
    }
  ],
  "indexes": [
    {
      "key": "solution_id_idx",
      "type": "key",
      "attributes": ["solution_id"]
    }
  ]
}
```

#### 6.2.10 `illustrative_scheme` Collection

```javascript
{
  "$id": "illustrative_scheme",
  "name": "Illustrative Scheme",
  "attributes": [
    {
      "key": "solution_id",
      "type": "string",
      "size": 36,
      "required": true,
      "description": "Reference to solutions collection"
    },
    {
      "key": "bullet",
      "type": "integer",
      "required": true,
      "min": 1,
      "max": 20,
      "description": "Bullet point number"
    },
    {
      "key": "answer",
      "type": "string",
      "size": 1000,
      "required": true,
      "description": "Expected answer (plain text)"
    },
    {
      "key": "answer_latex",
      "type": "string",
      "size": 1000,
      "required": false,
      "description": "Answer in LaTeX format"
    },
    {
      "key": "condition",
      "type": "string",
      "size": 300,
      "required": false,
      "description": "Conditions for mark award"
    },
    {
      "key": "alternative",
      "type": "string",
      "size": 500,
      "required": false,
      "description": "Alternative acceptable answer"
    },
    {
      "key": "alternative_latex",
      "type": "string",
      "size": 500,
      "required": false,
      "description": "Alternative in LaTeX"
    },
    {
      "key": "sort_order",
      "type": "integer",
      "required": true,
      "description": "Display order"
    }
  ],
  "indexes": [
    {
      "key": "solution_id_idx",
      "type": "key",
      "attributes": ["solution_id"]
    }
  ]
}
```

#### 6.2.11 `commonly_observed_responses` Collection (Parked - Schema Ready)

```javascript
{
  "$id": "commonly_observed_responses",
  "name": "Commonly Observed Responses",
  "attributes": [
    {
      "key": "solution_id",
      "type": "string",
      "size": 36,
      "required": true,
      "description": "Reference to solutions collection"
    },
    {
      "key": "candidate_id",
      "type": "string",
      "size": 5,
      "required": true,
      "description": "Candidate identifier (A, B, C)"
    },
    {
      "key": "scenario",
      "type": "string",
      "size": 300,
      "required": true,
      "description": "Description of the response pattern"
    },
    {
      "key": "working",
      "type": "string",
      "size": 16777216,
      "required": true,
      "description": "The candidate's working (plain text)"
    },
    {
      "key": "working_latex",
      "type": "string",
      "size": 16777216,
      "required": false,
      "description": "Working in LaTeX format"
    },
    {
      "key": "marks_awarded",
      "type": "string",
      "size": 20,
      "required": true,
      "array": true,
      "description": "Array of awarded bullets (e.g., ['•1', '•2'])"
    },
    {
      "key": "sort_order",
      "type": "integer",
      "required": true,
      "description": "Display order"
    }
  ],
  "indexes": [
    {
      "key": "solution_id_idx",
      "type": "key",
      "attributes": ["solution_id"]
    }
  ]
}
```

#### 6.2.12 `topics` Collection (Reference Data)

```javascript
{
  "$id": "topics",
  "name": "Topics",
  "attributes": [
    {
      "key": "slug",
      "type": "string",
      "size": 50,
      "required": true,
      "description": "URL-safe identifier (e.g., quadratics)"
    },
    {
      "key": "name",
      "type": "string",
      "size": 100,
      "required": true,
      "description": "Display name (e.g., Quadratic Functions)"
    },
    {
      "key": "parent_slug",
      "type": "string",
      "size": 50,
      "required": false,
      "description": "Parent topic for hierarchy"
    },
    {
      "key": "curriculum_ref",
      "type": "string",
      "size": 50,
      "required": false,
      "description": "SQA curriculum reference code"
    },
    {
      "key": "description",
      "type": "string",
      "size": 500,
      "required": false,
      "description": "Topic description"
    }
  ],
  "indexes": [
    {
      "key": "slug_unique",
      "type": "unique",
      "attributes": ["slug"]
    },
    {
      "key": "parent_idx",
      "type": "key",
      "attributes": ["parent_slug"]
    }
  ]
}
```

-----

## 7. Storage Strategy

### 7.1 Storage Buckets

Create the following Appwrite Storage buckets for large content:

|Bucket ID         |Purpose                            |File Types   |Max Size|
|------------------|-----------------------------------|-------------|--------|
|`source-pdfs`     |Original SQA PDF documents         |PDF          |50MB    |
|`diagrams`        |Extracted diagrams and graphs      |SVG, PNG, JPG|5MB     |
|`render-configs`  |JSXGraph/Desmos configuration files|JSON         |1MB     |
|`working-examples`|Extended worked solution documents |MD, HTML     |10MB    |

### 7.2 When to Use Storage vs Database

|Content Type      |Size Threshold|Storage Location                        |
|------------------|--------------|----------------------------------------|
|Question text     |≤ 10KB        |Database (`text` field)                 |
|Question text     |> 10KB        |Database (LONGTEXT handles it)          |
|SVG diagram       |Any           |Storage bucket + `file_id` in DB        |
|Raster image      |Any           |Storage bucket + `file_id` in DB        |
|Render config JSON|≤ 2KB         |Database `render_config` field          |
|Render config JSON|> 2KB         |Storage bucket + `render_config_file_id`|
|Source PDF        |Any           |Storage bucket + `source_file_id`       |

### 7.3 File Naming Conventions

```
source-pdfs/
├── n5-maths-2023-paper1.pdf
├── n5-maths-2023-paper2.pdf
├── n5-maths-2023-paper1-mi.pdf    # Marking instructions
└── n5-maths-2023-paper2-mi.pdf

diagrams/
├── n5-2023-p1-q4-parabola.svg
├── n5-2023-p1-q7-triangle.svg
└── n5-2023-p2-q12-scattergraph.png

render-configs/
├── n5-2023-p1-q4-jsxgraph.json
└── n5-2023-p2-q8-desmos.json
```

-----

## 8. Cross-Document Linking

### 8.1 Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   papers    │───────│  questions  │───────│question_parts│
│             │  1:N  │             │  1:N  │             │
│ $id ────────┼───────┼─ paper_id   │       │ question_id │
│             │       │ $id ────────┼───────┼─────────────┘
└─────────────┘       └─────────────┘
      │                     │
      │ 1:N                 │ 1:N
      ▼                     ▼
┌─────────────┐       ┌─────────────┐
│  formulae   │       │  diagrams   │
│             │       │             │
│ paper_id    │       │ question_id │
└─────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   papers    │───────│marking_     │───────│  solutions  │
│             │  1:1  │schemes      │  1:N  │             │
│ $id ────────┼───────┼─ paper_id   │       │ marking_    │
│             │       │ $id ────────┼───────┼─scheme_id   │
└─────────────┘       └─────────────┘       │ question_id │
                            │               │ part_id     │
                            │ 1:N           │ $id ────────┤
                            ▼               └─────────────┘
                      ┌─────────────┐             │
                      │general_     │             │
                      │marking_     │             ├─────────────┐
                      │principles   │             │             │
                      │             │             ▼             ▼
                      │ marking_    │       ┌─────────────┐ ┌─────────────┐
                      │ scheme_id   │       │generic_     │ │illustrative_│
                      └─────────────┘       │scheme       │ │scheme       │
                                            │             │ │             │
                                            │ solution_id │ │ solution_id │
                                            └─────────────┘ └─────────────┘
```

### 8.2 Linking Keys

|From Collection           |To Collection  |Key Field        |Relationship          |
|--------------------------|---------------|-----------------|----------------------|
|questions                 |papers         |paper_id         |Many-to-One           |
|question_parts            |questions      |question_id      |Many-to-One           |
|diagrams                  |questions      |question_id      |Many-to-One           |
|formulae                  |papers         |paper_id         |Many-to-One           |
|marking_schemes           |papers         |paper_id         |One-to-One            |
|general_marking_principles|marking_schemes|marking_scheme_id|Many-to-One           |
|solutions                 |marking_schemes|marking_scheme_id|Many-to-One           |
|solutions                 |questions      |question_id      |Many-to-One           |
|solutions                 |question_parts |part_id          |Many-to-One (optional)|
|generic_scheme            |solutions      |solution_id      |Many-to-One           |
|illustrative_scheme       |solutions      |solution_id      |Many-to-One           |

### 8.3 Query Patterns

#### Get complete question with solution

```javascript
// 1. Get question
const question = await databases.getDocument(DB_ID, 'questions', questionId);

// 2. Get parts (if applicable)
const parts = question.has_parts
  ? await databases.listDocuments(DB_ID, 'question_parts', [
      Query.equal('question_id', questionId),
      Query.orderAsc('sort_order')
    ])
  : { documents: [] };

// 3. Get diagrams
const diagrams = await databases.listDocuments(DB_ID, 'diagrams', [
  Query.equal('question_id', questionId)
]);

// 4. Get solution(s)
const solutions = await databases.listDocuments(DB_ID, 'solutions', [
  Query.equal('question_id', questionId)
]);

// 5. For each solution, get marking details
for (const solution of solutions.documents) {
  solution.generic = await databases.listDocuments(DB_ID, 'generic_scheme', [
    Query.equal('solution_id', solution.$id),
    Query.orderAsc('sort_order')
  ]);

  solution.illustrative = await databases.listDocuments(DB_ID, 'illustrative_scheme', [
    Query.equal('solution_id', solution.$id),
    Query.orderAsc('sort_order')
  ]);
}
```

-----

## 9. LLM Extraction Guidelines

### 9.1 Extraction Prompt Template

```markdown
You are an expert at extracting structured data from SQA (Scottish Qualifications Authority) exam documents.

## Task
Extract the following structured data from the provided document:

### For Question Papers:
1. Paper metadata (code, year, level, etc.)
2. Formulae list (if present)
3. All questions with parts/subparts
4. Topic classifications
5. Diagram references

### For Marking Instructions:
1. General marking principles
2. Per-question solutions with:
   - Generic scheme (process descriptions)
   - Illustrative scheme (specific answers)
   - Notes and alternative answers

## Output Format
Return valid JSON matching the schema provided.

## Important Rules:
1. Preserve ALL mathematical notation - convert to LaTeX
2. Keep original wording in descriptions
3. Use snake_case for topic tags
4. Set marks to null if question has parts
5. Include ALL bullet points from marking schemes
```

### 9.2 Topic Classification Guidelines

When assigning `topic_tags`, use the following taxonomy:

**Algebra**

- `expanding_brackets` - Expanding single and double brackets
- `factorising` - Common factor, difference of squares, trinomials
- `quadratics` - Quadratic expressions and equations
- `completing_square` - Completing the square form
- `quadratic_formula` - Using the formula to solve
- `simultaneous_equations` - Linear and non-linear systems
- `algebraic_fractions` - Simplifying and operating with fractions
- `indices` - Laws of indices, negative and fractional
- `surds` - Simplifying and rationalising

**Geometry**

- `pythagoras` - Pythagoras' theorem applications
- `trigonometry_right` - SOH CAH TOA in right triangles
- `trigonometry_non_right` - Sine and cosine rules
- `similarity` - Similar shapes and scale factors
- `circle_properties` - Angles, tangents, chords
- `vectors` - Vector addition, magnitude, components
- `transformations` - Reflection, rotation, translation, enlargement

**Statistics**

- `mean_median_mode` - Averages and measures of centre
- `quartiles_iqr` - Quartiles and interquartile range
- `standard_deviation` - Calculating and interpreting
- `scattergraphs` - Correlation and line of best fit
- `probability` - Single and combined events

**Graphs and Functions**

- `straight_line` - y = mx + c, gradients, equations
- `parabolas` - Quadratic graphs and turning points
- `graph_transformations` - Translations and reflections
- `function_notation` - f(x) notation and evaluation

### 9.3 LaTeX Conversion Rules

|Mathematical Element|Plain Text|LaTeX              |
|--------------------|----------|-------------------|
|Fractions           |`3/4`     |`\frac{3}{4}`      |
|Powers              |`x^2`     |`x^2` or `x^{2}`   |
|Roots               |`√x`      |`\sqrt{x}`         |
|Greek letters       |`pi`      |`\pi`              |
|Subscripts          |`x_1`     |`x_1` or `x_{1}`   |
|Inequalities        |`<=`      |`\leq`             |
|Multiplication      |`×`       |`\times`           |
|Division            |`÷`       |`\div`             |
|Plus/minus          |`±`       |`\pm`              |
|Degrees             |`30°`     |`30°` or `30^\circ`|

### 9.4 Quality Checklist

Before finalising extraction:

- [ ] All question numbers are sequential
- [ ] Mark totals match paper total
- [ ] Each bullet in generic scheme has matching illustrative bullet
- [ ] All LaTeX compiles without errors
- [ ] Topic tags are from approved taxonomy
- [ ] Part sort_order values are sequential
- [ ] Diagram references match actual extracted images
- [ ] No placeholder or template text remains

-----

## 10. Appendices

### Appendix A: Complete Topic Taxonomy

```json
[
  {"slug": "algebra", "name": "Algebra", "parent_slug": null},
  {"slug": "expanding_brackets", "name": "Expanding Brackets", "parent_slug": "algebra"},
  {"slug": "factorising", "name": "Factorising", "parent_slug": "algebra"},
  {"slug": "quadratics", "name": "Quadratic Functions", "parent_slug": "algebra"},
  {"slug": "completing_square", "name": "Completing the Square", "parent_slug": "algebra"},
  {"slug": "quadratic_formula", "name": "Quadratic Formula", "parent_slug": "algebra"},
  {"slug": "simultaneous_equations", "name": "Simultaneous Equations", "parent_slug": "algebra"},
  {"slug": "algebraic_fractions", "name": "Algebraic Fractions", "parent_slug": "algebra"},
  {"slug": "indices", "name": "Indices", "parent_slug": "algebra"},
  {"slug": "surds", "name": "Surds", "parent_slug": "algebra"},

  {"slug": "geometry", "name": "Geometry", "parent_slug": null},
  {"slug": "pythagoras", "name": "Pythagoras' Theorem", "parent_slug": "geometry"},
  {"slug": "trigonometry_right", "name": "Right-Angled Trigonometry", "parent_slug": "geometry"},
  {"slug": "trigonometry_non_right", "name": "Non-Right Trigonometry", "parent_slug": "geometry"},
  {"slug": "similarity", "name": "Similarity", "parent_slug": "geometry"},
  {"slug": "circle_properties", "name": "Circle Properties", "parent_slug": "geometry"},
  {"slug": "vectors", "name": "Vectors", "parent_slug": "geometry"},
  {"slug": "transformations", "name": "Transformations", "parent_slug": "geometry"},
  {"slug": "arc_sector", "name": "Arc Length and Sector Area", "parent_slug": "geometry"},
  {"slug": "volume", "name": "Volume", "parent_slug": "geometry"},

  {"slug": "statistics", "name": "Statistics", "parent_slug": null},
  {"slug": "mean_median_mode", "name": "Averages", "parent_slug": "statistics"},
  {"slug": "quartiles_iqr", "name": "Quartiles and IQR", "parent_slug": "statistics"},
  {"slug": "standard_deviation", "name": "Standard Deviation", "parent_slug": "statistics"},
  {"slug": "scattergraphs", "name": "Scattergraphs", "parent_slug": "statistics"},
  {"slug": "probability", "name": "Probability", "parent_slug": "statistics"},

  {"slug": "graphs", "name": "Graphs and Functions", "parent_slug": null},
  {"slug": "straight_line", "name": "Straight Line", "parent_slug": "graphs"},
  {"slug": "parabolas", "name": "Parabolas", "parent_slug": "graphs"},
  {"slug": "graph_transformations", "name": "Graph Transformations", "parent_slug": "graphs"},
  {"slug": "function_notation", "name": "Function Notation", "parent_slug": "graphs"},
  {"slug": "gradient", "name": "Gradient", "parent_slug": "graphs"},

  {"slug": "numeracy", "name": "Numeracy", "parent_slug": null},
  {"slug": "fractions", "name": "Fractions", "parent_slug": "numeracy"},
  {"slug": "percentages", "name": "Percentages", "parent_slug": "numeracy"},
  {"slug": "ratio", "name": "Ratio and Proportion", "parent_slug": "numeracy"},
  {"slug": "scientific_notation", "name": "Scientific Notation", "parent_slug": "numeracy"}
]
```

### Appendix B: Example Complete Extraction

See separate file: `example-extraction-2023-paper1.json`

### Appendix C: Appwrite Setup Script

```javascript
// setup-appwrite-sqa.js
const { Client, Databases, Storage, ID } = require('node-appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

const DATABASE_ID = 'sqa_n5_maths';

async function setup() {
  // Create database
  await databases.create(DATABASE_ID, 'SQA N5 Mathematics');

  // Create storage buckets
  await storage.createBucket('source-pdfs', 'Source PDFs', [
    'role:all'  // Adjust permissions as needed
  ], true, 52428800);  // 50MB max

  await storage.createBucket('diagrams', 'Diagrams', [
    'role:all'
  ], true, 5242880);  // 5MB max

  await storage.createBucket('render-configs', 'Render Configs', [
    'role:all'
  ], true, 1048576);  // 1MB max

  // Create collections (see collection definitions above)
  // ... implementation continues

  console.log('Setup complete');
}

setup().catch(console.error);
```

-----

## Document History

|Version|Date    |Author             |Changes                     |
|-------|--------|-------------------|----------------------------|
|1.0    |Dec 2025|Scottish AI Lessons|Initial design specification|

-----

*End of Document*
