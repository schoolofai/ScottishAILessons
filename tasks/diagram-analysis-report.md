# US Papers Diagram Analysis Report
Generated: 2026-01-11 15:22:28

## Executive Summary

During Playwright testing, we discovered that diagram images in the `us_diagrams` bucket
are showing **MARKING SCHEME content** instead of the actual question paper diagrams.

### Key Findings

| Metric | Value |
|--------|-------|
| Papers analyzed | 10 |
| Files in us_diagrams bucket | 30 |
| Papers with diagrams | 8 |
| Total diagram references | 36 |

### Root Cause

The diagram extraction pipeline processed the **Marking Instructions PDF** instead of
the **Question Paper PDF**. SQA publishes separate documents:

- `X847-75-01-qp.pdf` - Question Paper (contains actual diagrams)
- `X847-75-01-mi.pdf` - Marking Instructions (contains marking scheme tables)

### Affected Papers (Confirmed)

Based on visual verification during testing:

| Paper | Question | Expected | Actual |
|-------|----------|----------|--------|
| X847-75-01 (N5 2023 P1) | Q10 | Paving slab diagrams | Marking scheme table |
| X847-75-01 (N5 2023 P1) | Q4a(i) | Parabola graph | Marking scheme table |

### Potentially Affected Papers (Need Verification)

All papers in the same extraction batch may have the same issue:

- X847/75/01
- X847/75/02
- X847/76/11
- X847/76/12
- X847/77/11
- X847/77/12

---

## Detailed Diagram Mapping

### X847/77/12 (Mathematics Advanced Higher 2023)

**Document ID:** `mathematics-nah-2023-X847-77-12`

| Question | Diagram ID | File | Page | Size | Description |
|----------|------------|------|------|------|-------------|
| Q11 | diag-nah-2023-p2-q11 | X847-77-12_page_006_graphic_00.png | 006 | 119,141 | Cross section of a cone with diameter 180 cm and h... |

### X847/76/11 (Mathematics Higher 2022)

**Document ID:** `mathematics-nh-2022-X847-76-11`

| Question | Diagram ID | File | Page | Size | Description |
|----------|------------|------|------|------|-------------|
| Q5 | diag-nh-2022-p1-q5 | X847-76-11_page_004_graphic_00.png | 004 | 52,183 | A line passing through (-2,0) and making an angle ... |
| Q7 | diag-nh-2022-p1-q7 | X847-76-11_page_005_graphic_00.png | 005 | 148,676 | Two right-angled triangles ABC and ADE sharing ver... |
| Q7 | diag-nh-2022-p1-q7 | X847-76-11_page_005_graphic_00.png | 005 | 148,676 | Two right-angled triangles ABC and ADE sharing ver... |
| Q10 | diag-nh-2022-p1-q10 | X847-76-11_page_006_graphic_00.png | 006 | 96,488 | Graph of a cubic function y=f(x) with stationary p... |
| Q13 | diag-nh-2022-p1-q13 | X847-76-11_page_007_graphic_00.png | 007 | 200,284 | Graph of a cubic function y=f(x) showing its roots... |

### X847/76/12 (Mathematics Higher 2022)

**Document ID:** `mathematics-nh-2022-X847-76-12`

| Question | Diagram ID | File | Page | Size | Description |
|----------|------------|------|------|------|-------------|
| Q1 | diag-X847-76-12-2022-q1 | X847-76-12_page_003_graphic_00.png | 003 | 11,045 | A triangle ABC with vertices A(-1,-1), B(2,-4), C(... |
| Q4 | diag-X847-76-12-2022-q4 | X847-76-12_page_004_graphic_00.png | 004 | 53,119 | A cubic graph y = x^3 - 5x^2 + 2x + 8 with shaded ... |
| Q7 | diag-X847-76-12-2022-q7 | X847-76-12_page_005_graphic_00.png | 005 | 280,568 | A straight line graph of log base 5 y against log ... |
| Q8 | diag-X847-76-12-2022-q8 | X847-76-12_page_006_graphic_00.png | 006 | 229,526 | A rectangular plot with dimensions x and y, contai... |
| Q9 | diag-X847-76-12-2022-q9-1 | X847-76-12_page_007_graphic_00.png | 007 | 238,845 | A line intersecting a circle at points P and Q. |
| Q9 | diag-X847-76-12-2022-q9-2 | X847-76-12_page_007_graphic_01.png | 007 | 28,690 | A line tangent to a smaller circle, which is conce... |

### X847/76/11 (Mathematics Higher 2023)

**Document ID:** `mathematics-nh-2023-X847-76-11`

| Question | Diagram ID | File | Page | Size | Description |
|----------|------------|------|------|------|-------------|
| Q4 | diag-nh-2023-p1-q4 | X847-76-11_page_003_graphic_00.png | 003 | 12,398 | Two right-angled triangles sharing a common side, ... |
| Q9 | diag-nh-2023-p1-q9 | X847-76-11_page_005_graphic_00.png | 005 | 148,676 | Graph of y = log3 x showing points (1,0) and (3,1)... |

### X847/76/12 (Mathematics Higher 2023)

**Document ID:** `mathematics-nh-2023-X847-76-12`

| Question | Diagram ID | File | Page | Size | Description |
|----------|------------|------|------|------|-------------|
| Q1 | diag-X847-76-12-2023-q1 | X847-76-12_page_003_graphic_00.png | 003 | 11,045 | Triangle PQR with vertices P, Q, R and an altitude... |
| Q4 | diag-X847-76-12-2023-q4 | X847-76-12_page_004_graphic_00.png | 004 | 53,119 | Cubic graph of y = f(x) with stationary points at ... |
| Q8 | diag-X847-76-12-2023-q8 | X847-76-12_page_005_graphic_00.png | 005 | 280,568 | Graph showing a cubic curve and a straight line, w... |
| Q14 | diag-X847-76-12-2023-q14 | X847-76-12_page_008_graphic_00.png | 008 | 119,119 | Net of an open cuboid box with dimensions h, 3x, a... |
| Q15 | diag-X847-76-12-2023-q15 | X847-76-12_page_008_graphic_01.png | 008 | 25,354 | Circle with a tangent line x+3y=17 at point (2,5) |

### X847/75/01 (Mathematics National 5 2023)

**Document ID:** `mathematics-n5-2023-X847-75-01`

| Question | Diagram ID | File | Page | Size | Description |
|----------|------------|------|------|------|-------------|
| Q4 | diag-n5-2023-p1-q4 | X847-75-01_page_005_graphic_00.png | 005 | 230,138 | A parabola with its vertex at (3, 2) and passing t... |
| Q6 | diag-n5-2023-p1-q6 | X847-75-01_page_007_graphic_00.png | 007 | 116,362 | A triangle ABC with side AC = 5m and BC = 6m. |
| Q7 | diag-n5-2023-p1-q7 | X847-75-01_page_008_graphic_00.png | 008 | 170,038 | A scattergraph showing salary (P) versus time work... |
| Q10 | diag-n5-2023-p1-q10-path | X847-75-01_page_011_graphic_00.png | 011 | 180,650 | A path made of several identical paving slabs, eac... |
| Q10 | diag-n5-2023-p1-q10-slab | X847-75-01_page_011_graphic_01.png | 011 | 25,311 | A single paving slab, which is a segment of a circ... |
| Q13 | diag-n5-2023-p1-q13 | X847-75-01_page_013_graphic_00.png | 013 | 117,125 | A cosine graph shifted horizontally and vertically... |

### X847/75/02 (Mathematics National 5 2023)

**Document ID:** `mathematics-n5-2023-X847-75-02`

| Question | Diagram ID | File | Page | Size | Description |
|----------|------------|------|------|------|-------------|
| Q3 | diag-n5-2023-p2-q3-football-pitch | X847-75-02_page_004_graphic_01.png | 004 | 10,508 | Diagram showing part of a football pitch with a pe... |
| Q3 | diag-n5-2023-p2-q3-arc | X847-75-02_page_004_graphic_00.png | 004 | 47,747 | Diagram showing an arc AB with center C, radius 9.... |
| Q4 | diag-n5-2023-p2-q4-triangle | X847-75-02_page_005_graphic_00.png | 005 | 245,767 | Diagram of triangle JKL with angle J = 25 degrees,... |
| Q5 | diag-n5-2023-p2-q5-logo | X847-75-02_page_006_graphic_00.png | 006 | 198,894 | Diagram of a logo consisting of an H shape and a r... |
| Q8 | diag-n5-2023-p2-q8-wooden-beam | X847-75-02_page_008_graphic_00.png | 008 | 254,599 | Diagram showing a wooden beam supporting a wall. T... |
| Q9 | diag-n5-2023-p2-q9-concrete-block | X847-75-02_page_009_graphic_00.png | 009 | 217,809 | Diagram of a concrete block in the shape of a frus... |
| Q11 | diag-n5-2023-p2-q11-grandfather-clock | X847-75-02_page_011_graphic_00.png | 011 | 183,740 | Diagram of a grandfather clock. |
| Q11 | diag-n5-2023-p2-q11-clock-face | X847-75-02_page_011_graphic_01.png | 011 | 25,800 | Close-up diagram of a clock face showing the hour ... |
| Q14 | diag-n5-2023-p2-q14-cuboid | X847-75-02_page_013_graphic_00.png | 013 | 252,944 | Diagram of a cuboid with dimensions: length (x+7)m... |
| Q15 | diag-n5-2023-p2-q15-triangle | X847-75-02_page_014_graphic_00.png | 014 | 282,933 | Diagram showing two similar triangles, ABC and ADE... |

### X847/77/12 (Mathematics Advanced Higher 2025)

**Document ID:** `mathematics-nah-2025-X847-77-12`

| Question | Diagram ID | File | Page | Size | Description |
|----------|------------|------|------|------|-------------|
| Q11 | diag-nah-2025-p2-q11 | X847-77-12_page_006_graphic_00.png | 006 | 119,141 | Graph of the function y = 4*sqrt(x) / e^(x^2) from... |

---

## Files in us_diagrams Bucket

| File ID | Size (bytes) |
|---------|--------------|
| X847-75-01_page_005_graphic_00.png | 230,138 |
| X847-75-01_page_007_graphic_00.png | 116,362 |
| X847-75-01_page_008_graphic_00.png | 170,038 |
| X847-75-01_page_011_graphic_00.png | 180,650 |
| X847-75-01_page_011_graphic_01.png | 25,311 |
| X847-75-01_page_013_graphic_00.png | 117,125 |
| X847-75-02_page_004_graphic_00.png | 47,747 |
| X847-75-02_page_004_graphic_01.png | 10,508 |
| X847-75-02_page_005_graphic_00.png | 245,767 |
| X847-75-02_page_006_graphic_00.png | 198,894 |
| X847-75-02_page_008_graphic_00.png | 254,599 |
| X847-75-02_page_009_graphic_00.png | 217,809 |
| X847-75-02_page_011_graphic_00.png | 183,740 |
| X847-75-02_page_011_graphic_01.png | 25,800 |
| X847-75-02_page_013_graphic_00.png | 252,944 |
| X847-75-02_page_014_graphic_00.png | 282,933 |
| X847-76-11_page_003_graphic_00.png | 12,398 |
| X847-76-11_page_004_graphic_00.png | 52,183 |
| X847-76-11_page_005_graphic_00.png | 148,676 |
| X847-76-11_page_006_graphic_00.png | 96,488 |
| X847-76-11_page_007_graphic_00.png | 200,284 |
| X847-76-12_page_003_graphic_00.png | 11,045 |
| X847-76-12_page_004_graphic_00.png | 53,119 |
| X847-76-12_page_005_graphic_00.png | 280,568 |
| X847-76-12_page_006_graphic_00.png | 229,526 |
| X847-76-12_page_007_graphic_00.png | 238,845 |
| X847-76-12_page_007_graphic_01.png | 28,690 |
| X847-76-12_page_008_graphic_00.png | 119,119 |
| X847-76-12_page_008_graphic_01.png | 25,354 |
| X847-77-12_page_006_graphic_00.png | 119,141 |

---

## Recommended Actions

1. **Re-extract diagrams** from the correct source PDFs (question papers, not marking instructions)
2. **Delete incorrect files** from the `us_diagrams` bucket
3. **Upload correct images** with the same file IDs to avoid updating paper references
4. **Verify each paper** by visual inspection after re-upload

### Extraction Pipeline Fix

In the paper extractor script, ensure the correct PDF suffix is used:

```python
# CORRECT: Use question paper
pdf_path = f"{paper_code}-qp.pdf"

# INCORRECT: Don't use marking instructions
# pdf_path = f"{paper_code}-mi.pdf"
```