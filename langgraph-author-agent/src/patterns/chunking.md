# Chunking Pattern Library

**Version**: 2.0
**Last Updated**: 2025-10-15
**Purpose**: Cross-outcome consolidation strategy for grouping assessment standards

---

## Strategy Overview

**Goal**: Reduce lesson count by grouping 2-3 related assessment standards into unified, thematically coherent lessons

**Target**: 10-20 lessons total (NOT 80-100 separate lessons)

**Impact**: More realistic classroom sequences, richer lesson experiences, efficient coverage

---

## Chunking Approach

### 1. **Thematic Blocks**
Group related standards (even across outcomes) into natural learning progressions

**Example**:
```
Percentage Block:
- AS1.1: Understand percentage notation
- AS1.2: Calculate percentages
- AS2.1: Apply percentages in real-life contexts

Thematic coherence: All involve percentage understanding and application
Natural progression: Notation → Calculation → Application
```

---

### 2. **Target Size**
- **Typical**: 2-3 assessment standards per lesson
- **Maximum**: 5 standards (only if pedagogically justified)
- **Justification required**: Must explain thematic coherence

---

### 3. **Lesson Type Requirements**

#### **Mandatory Teach→Revision Pairing** (1:1 ratio)
Every teach lesson MUST be immediately followed by a revision lesson

```
✅ CORRECT:
Lesson 1 (teach: fractions intro) → Lesson 2 (revision: fractions practice)
Lesson 3 (teach: decimals) → Lesson 4 (revision: decimals practice)

❌ WRONG:
Lesson 1 (teach: fractions) → Lesson 2 (teach: decimals) → Lesson 3 (revision)
```

#### **Course-Level Requirements**
- **At least 1** independent_practice lesson (for mock exam preparation)
- **Exactly 1** mock_assessment lesson (simulating real SQA exam)

---

### 4. **Expected Outcome**
- 10-20 lessons (realistic for Scottish course delivery)
- Richer, multi-faceted lesson experiences
- More realistic classroom sequences
- Better standard integration

---

## Safeguards

### ❌ **Don't Chunk If**:
1. Standards are unrelated (e.g., fractions + trigonometry)
2. Prerequisites are violated (e.g., advanced before foundational)
3. Chunking forces artificial connections
4. More than 5 standards grouped together

### ✅ **Do Chunk If**:
1. Standards share common contexts (e.g., all use money scenarios)
2. Standards build progressively (e.g., notation → calculation → application)
3. Standards address related misconceptions
4. Standards use similar assessment methods

---

## Chunking Examples

### Example 1: Percentages in Context
**Standards Chunked**: AS1.1, AS1.2, AS2.1

**Thematic Coherence**:
- AS1.1: Percentage notation understanding
- AS1.2: Percentage calculations (fractions ↔ decimals ↔ percents)
- AS2.1: Percentage applications in real-life (discounts, interest, VAT)
- Shared context: Scottish supermarket shopping, sales, discounts

**Lesson Sequence** (6 lessons, ~6 weeks):
1. **Teach**: Introduce percentage notation + fraction/decimal conversions (50 min)
2. **Revision**: Practice conversions with Scottish contexts (35 min)
3. **Teach**: Percentage calculations in real-life scenarios (50 min)
4. **Revision**: Mixed percentage problems (35 min)
5. **Formative Assessment**: Percentage proficiency check (30 min)
6. **Independent Practice**: Exam-style percentage problems (50 min)

**Calculator Policy**: Non-calc for lessons 1-4, calc allowed for 5-6

**Engagement Tags**: shopping, discounts, finance, supermarket, sales

---

### Example 2: Fraction Foundations
**Standards Chunked**: AS1.1, AS1.3

**Thematic Coherence**:
- AS1.1: Fraction notation and equivalence
- AS1.3: Simplifying fractions
- Shared skill: Understanding fraction representations

**Lesson Sequence** (4 lessons, ~4 weeks):
1. **Teach**: Fraction notation, equivalence, visual models (45 min)
2. **Revision**: Fraction comparison and ordering (35 min)
3. **Teach**: Simplifying fractions to lowest terms (40 min)
4. **Revision**: Mixed fraction equivalence and simplification (35 min)

**Calculator Policy**: Non-calc throughout

**Engagement Tags**: cooking_measurements, pizza_slices, sharing_fairly

---

### Example 3: Decimal Operations
**Standards Chunked**: AS1.4, AS1.5, AS2.2

**Thematic Coherence**:
- AS1.4: Decimal addition and subtraction
- AS1.5: Decimal multiplication and division
- AS2.2: Decimals in context (money, measurements)
- Shared skill: Operating with decimal numbers

**Lesson Sequence** (7 lessons, ~7 weeks):
1. **Teach**: Decimal addition/subtraction with place value (50 min)
2. **Revision**: Decimal addition/subtraction practice (30 min)
3. **Teach**: Decimal multiplication/division (50 min)
4. **Revision**: All decimal operations practice (35 min)
5. **Formative Assessment**: Decimal operations check (30 min)
6. **Teach**: Decimals in money/measurement contexts (45 min)
7. **Independent Practice**: Real-life decimal problems (50 min)

**Calculator Policy**: Non-calc for 1-5, calc allowed for 6-7

**Engagement Tags**: money, shopping, measurements, bus_fares

---

## Validation Checklist

For each chunked lesson block, verify:

- [ ] **Thematic coherence**: Clear pedagogical justification for grouping
- [ ] **Size**: 2-3 standards (or up to 5 if justified)
- [ ] **Teach→revision pairing**: Every teach lesson has corresponding revision lesson (1:1 ratio)
- [ ] **Lesson sequence**: teach → revision → formative_assessment → independent_practice
- [ ] **Label clarity**: Lesson titles indicate all covered standards
- [ ] **Standard coverage**: Each standard meaningfully addressed (not just "touched")
- [ ] **Prerequisites respected**: Foundational standards come before advanced
- [ ] **Course-level requirements**: At least 1 independent_practice, exactly 1 mock_assessment across entire SOW

---

## Anti-Patterns (Common Mistakes)

### ❌ **Anti-Pattern 1: Over-Chunking**
```
Lesson: "Complete Number Unit"
Standards: AS1.1, AS1.2, AS1.3, AS1.4, AS1.5, AS1.6, AS2.1, AS2.2
Issue: 8 standards - too many, shallow coverage
```

### ❌ **Anti-Pattern 2: Unrelated Chunking**
```
Lesson: "Mixed Skills"
Standards: AS1.2 (fractions), AS3.4 (trigonometry), AS2.5 (statistics)
Issue: No thematic connection, artificial grouping
```

### ❌ **Anti-Pattern 3: Prerequisite Violation**
```
Lesson Block:
- Lesson 1: Advanced percentage applications (AS2.3)
- Lesson 2: Basic percentage notation (AS1.1)
Issue: Advanced before foundational - violates prerequisites
```

### ❌ **Anti-Pattern 4: Missing Teach→Revision Pairing**
```
Lesson Sequence:
- Lesson 1 (teach)
- Lesson 2 (teach)
- Lesson 3 (teach)
- Lesson 4 (revision) ← Only ONE revision for THREE teach lessons
Issue: Violates 1:1 pairing requirement
```

---

## Integration with SOW Authoring

When applying chunking strategy:

1. **Identify related standards** from Course_data.txt
2. **Justify thematic coherence** (shared contexts, progressive skills, common misconceptions)
3. **Plan lesson sequence** (teach → revision → formative → independent)
4. **Verify teach→revision 1:1 ratio**
5. **Set sequential order field** (1, 2, 3...) for prerequisites
6. **Apply coherence.block_index** (e.g., "2.1", "2.2", "2.3") for transparency
7. **Write clear labels** indicating all covered standards
8. **Ensure course-level requirements** (independent_practice ≥1, mock_assessment =1)

---

## Related Documentation

- **SOW Schema**: `../schemas/sow_schema.md` (lesson structure)
- **Lesson Card Schema**: `../schemas/lesson_card_schema.md` (card-level design)
- **Core Process**: `../prompts/layers/core.md` (SOW authoring workflow)
