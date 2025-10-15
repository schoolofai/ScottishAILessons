# Layer 4: Quality Guidelines (On-Demand)

**Priority**: Load for quality-focused runs or after critic failures
**Token Estimate**: ~100 tokens
**Purpose**: Quality tips, examples, edge cases

---

## Quality Principles

### 1. Scottish Authenticity

**Currency**: Always £ (not $ or €)

**Authentic Contexts**:
- Supermarkets: Tesco, Asda, Sainsbury's, Morrisons
- Transport: Scottish bus fares, Ridacard discounts
- Public services: NHS prescription costs, council tax
- Local attractions: Edinburgh Zoo, Glasgow Science Centre
- High street: Primark, Sports Direct, local chip shops

**Example**:
```
❌ BAD: "A store offers 20% off a $45 item"
✅ GOOD: "Tesco offers 20% off a £45 jacket"
```

---

### 2. CFU Quality

**Specific vs Generic**:

```
❌ GENERIC:
- "Ask questions to check understanding"
- "Formative assessment"
- "Check if students get it"

✅ SPECIFIC:
- "MCQ: Which fraction equals 25%? A) 1/2  B) 1/4  C) 1/3  D) 1/5"
- "Structured question: Calculate 3/4 of £20 showing all working"
- "Self-rating: On a scale of 1-5, how confident are you with percentage conversions?"
```

**CFU Format Template**: `[CFU Type]: [Specific prompt or question]`

---

### 3. One-to-One Design Pitfalls

**AVOID**:
- "Work in pairs to solve..."
- "Group discussion about..."
- "Swap papers with partner for peer marking..."
- "Think-pair-share with classmate..."

**USE**:
- "Complete problem with AI tutor guidance..."
- "AI tutor provides immediate feedback on..."
- "Explain your reasoning to the AI tutor..."
- "Self-check your answer using AI tutor hints..."

---

### 4. Enriched Format Quality

**Always use objects, not bare codes**:

```
❌ BARE CODES:
"assessmentStandardRefs": ["AS1.2", "AS2.1"]

✅ ENRICHED OBJECTS:
"assessmentStandardRefs": [
  {
    "code": "AS1.2",
    "description": "Perform calculations involving fractions, decimal fractions and percentages",
    "outcome": "O1"
  }
]
```

**Apply at BOTH levels**:
- Entry-level: `assessmentStandardRefs`
- Card-level: `standards_addressed`

---

### 5. Chunking Quality

**Thematic Coherence Required**:

```
❌ POOR CHUNKING:
Standards grouped: AS1.1 (fractions), AS3.5 (trigonometry), AS2.2 (percentages)
Issue: No thematic connection

✅ GOOD CHUNKING:
Standards grouped: AS1.1 (fraction notation), AS1.2 (fraction calculations), AS2.1 (fractions in context)
Coherence: All involve fraction understanding and application
```

**Justify consolidation**: State why standards belong together (shared contexts, progressive skills, common misconceptions)

---

### 6. Lesson Plan Depth

**Card Count**: 6-12 cards per lesson (not 3, not 20)

**Card Timing**: Must sum to estMinutes
```
Example: 50-minute lesson
Cards: 5min starter + 8min explainer + 10min modelling + 12min guided + 10min independent + 5min exit = 50min ✅
```

**Standard Coverage**: ALL assessmentStandardRefs must appear in 2-3+ cards
```
Example: Lesson has AS1.2, AS2.1
- Card 2 (explainer): AS1.2
- Card 3 (modelling): AS1.2, AS2.1
- Card 4 (guided): AS1.2, AS2.1
- Card 7 (independent): AS1.2, AS2.1
All standards appear 3-4 times ✅
```

---

### 7. Field Naming

**lesson_instruction (NOT "notes")**:
```
❌ WRONG: "notes": "This lesson introduces percentages"
✅ CORRECT: "lesson_instruction": "This lesson introduces percentages through Scottish supermarket contexts. Students will learn notation, calculation, and real-life application."
```

---

### 8. Teach→Revision Pairing

**Every teach must have revision**:
```
❌ VIOLATION:
Lesson 1 (teach) → Lesson 2 (teach) → Lesson 3 (revision)
Issue: Two teach lessons without corresponding revisions

✅ CORRECT:
Lesson 1 (teach) → Lesson 2 (revision) → Lesson 3 (teach) → Lesson 4 (revision)
Every teach has 1:1 revision pairing ✅
```

---

### 9. Course-Level Requirements

**Checklist**:
- [ ] At least 1 independent_practice lesson exists
- [ ] Exactly 1 mock_assessment lesson exists
- [ ] Teach:revision ratio is 1:1
- [ ] 10-20 total lessons (not 80-100)

---

### 10. Common Pitfalls

1. **Bare codes at card level**: Even if entry-level uses enriched objects, cards might still use bare codes - CHECK BOTH
2. **Generic CFU strategies**: "Ask questions" is too vague - always include specific prompt
3. **Timing mismatches**: Cards sum to 30min but estMinutes is 50min - validate arithmetic
4. **Missing card fields**: Forgetting conditional fields (key_concepts for explainers, practice_problems for guided_practice)
5. **Non-Scottish contexts**: Using $ or non-Scottish shops - maintain Scottish authenticity throughout

---

**Token Count**: ~98 tokens (measured)
