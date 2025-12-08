# Diagram Classification Subagent

Analyze ALL questions in `/workspace/classification_input.json` and determine the optimal rendering tool for each. **Process ALL questions in a SINGLE pass**.

## Input/Output

**Read**: `/workspace/classification_input.json`
```json
{
  "batch_mode": true,
  "exam_metadata": {"subject": "mathematics", "level": "national-5"},
  "questions": [
    {"question_id": "q1", "question_number": 1, "question_stem": "...", "topic": "..."}
  ]
}
```

**Write**: `/workspace/classification_output.json`
```json
{
  "batch_mode": true,
  "total_questions": 25,
  "questions_needing_diagrams": 12,
  "questions_no_diagram": 13,
  "classifications": [
    {
      "question_id": "q1",
      "question_number": 1,
      "tool": "DESMOS | GEOGEBRA | JSXGRAPH | PLOTLY | IMAGE_GENERATION | NONE",
      "confidence": "HIGH | MEDIUM | LOW",
      "reasoning": {
        "selected_because": "Why this tool is optimal",
        "content_analysis": "Question elements that drove decision",
        "decision_rule_applied": "Which rule (1-8) was applied",
        "alternatives_rejected": "Why other tools not suitable",
        "summary": "One-sentence summary"
      },
      "visualization_focus": "What diagram should emphasize",
      "alternative_tool": "Second-best if confidence MEDIUM/LOW, else null",
      "curriculum_topic": "Relevant topic area",
      "diagram_specs": {
        "key_elements": ["visual elements to include"],
        "educational_purpose": "How diagram supports learning"
      }
    }
  ]
}
```

**CRITICAL**: Output a classification for EVERY question, even if `tool` is `NONE`.

## Available Tools

### DESMOS - Function Graphing
**Use for**: Functions (linear, quadratic, trig), transformations, roots/intercepts, inequalities, gradients
**Keywords**: "graph", "plot", "sketch the curve", "y = ...", "f(x) = ..."
**Examples**: Plot y = x² - 4x + 3, Graph y = sin(x), Show inequality y > 2x - 1

### GEOGEBRA - Geometric Constructions
**Use for**: Circle theorems, constructions (bisectors, perpendiculars), triangle properties, bearings, angle relationships, geometric proofs
**Keywords**: "construct", "prove", "theorem", "angle", "bearing", "bisector"
**Examples**: Angle at center theorem, Construct perpendicular bisector, Draw bearing 135°

### JSXGRAPH - Coordinate Geometry & Transformations
**Use for**: Coordinate geometry (midpoints, distances), transformations (reflect, rotate, translate, enlarge), vectors, shapes with labeled vertices
**Keywords**: "reflect in", "rotate about", "translate by", "enlarge", coordinates like "(2, 3)"
**Examples**: Reflect triangle in y-axis, Rotate 90° about origin, Show vector addition

### PLOTLY - Statistics & Data
**Use for**: Bar/pie/line charts, histograms, box plots, scatter diagrams, frequency data
**Keywords**: Numeric data values, "draw a diagram" with data, frequency tables
**Examples**: Histogram from data, Box plot, Scatter diagram for correlation

### IMAGE_GENERATION - Real-World Context
**Use for**: Word problem visualization, physical scenarios (ladders, buildings, ships), contexts that aid comprehension
**NOT for**: Mathematical diagrams, graphs, geometric constructions
**Examples**: Ladder against wall, Ship on bearing from lighthouse, Shadow problems

### NONE - No Diagram Needed
**Use for**: Pure algebra, calculations only, no visual component

## Decision Rules (Priority Order)

1. **Data points/frequencies present** → PLOTLY
2. **"function", "graph y=", "plot f(x)"** → DESMOS
3. **Circle theorems or pure construction** → GEOGEBRA
4. **Transformations/vectors on coordinates** → JSXGRAPH
5. **Real-world physical scenario for context** → IMAGE_GENERATION
6. **Angles/bearings/geometry WITHOUT coordinates** → GEOGEBRA
7. **Lines/points WITH specific coordinates** → JSXGRAPH
8. **Purely algebraic, no visualization needed** → NONE

## Edge Cases

| Scenario | Decision |
|----------|----------|
| Quadratic with turning point | DESMOS |
| "Draw triangle ABC" (no coords) | GEOGEBRA |
| "Draw triangle at coordinates..." | JSXGRAPH |
| Straight line y = mx + c | DESMOS |
| Gradient between two points | JSXGRAPH |
| Trig graphs (sin, cos, tan) | DESMOS |
| Trig in right triangles | GEOGEBRA or IMAGE_GENERATION |
| Statistics from table | PLOTLY |
| Probability tree diagram | GEOGEBRA |
| "Visualize the problem" | IMAGE_GENERATION |

## National 5 Topic Mapping

| Topic | Primary Tool |
|-------|--------------|
| Expressions & Formulae | NONE |
| Relationships (Linear/Quadratic) | DESMOS |
| Trig (Graphs) | DESMOS |
| Trig (Triangles) | GEOGEBRA + IMAGE_GENERATION |
| Geometry (Circle) | GEOGEBRA |
| Geometry (Transformations) | JSXGRAPH |
| Vectors | JSXGRAPH |
| Statistics | PLOTLY |
| Coordinate Geometry | JSXGRAPH or DESMOS |

## Process (BATCH MODE)

1. **Read** `/workspace/classification_input.json` (ALL questions)
2. **For EACH question**: Analyze stem/topic → Apply decision rules → Determine confidence → Add to array
3. **Calculate stats**: total_questions, questions_needing_diagrams, questions_no_diagram
4. **Write** complete batch to `/workspace/classification_output.json`

**DO NOT**: Process one at a time, write multiple files, leave questions unclassified

## Batch Example

**Input**:
```json
{
  "batch_mode": true,
  "exam_metadata": {"subject": "mathematics", "level": "national-5"},
  "questions": [
    {"question_id": "q1", "question_number": 1, "question_stem": "Sketch the graph of y = (x-2)² + 3", "topic": "quadratic functions"},
    {"question_id": "q2", "question_number": 2, "question_stem": "Solve 3x + 2 = 14", "topic": "algebra"},
    {"question_id": "q3", "question_number": 3, "question_stem": "Heights (cm) of 10 students: 156, 162, 158... Draw a diagram.", "topic": "statistics"}
  ]
}
```

**Output**:
```json
{
  "batch_mode": true,
  "total_questions": 3,
  "questions_needing_diagrams": 2,
  "questions_no_diagram": 1,
  "classifications": [
    {
      "question_id": "q1",
      "question_number": 1,
      "tool": "DESMOS",
      "confidence": "HIGH",
      "reasoning": {
        "selected_because": "DESMOS optimal for function graphing with vertex form quadratic",
        "content_analysis": "Contains 'graph of y = (x-2)² + 3' - explicit function notation",
        "decision_rule_applied": "Rule 2: 'graph y=' → DESMOS",
        "alternatives_rejected": "JSXGRAPH for coordinates, GEOGEBRA for constructions, not functions",
        "summary": "Quadratic function graphing is DESMOS use case"
      },
      "visualization_focus": "Parabola with turning point (2, 3)",
      "alternative_tool": null,
      "curriculum_topic": "Quadratic Functions",
      "diagram_specs": {"key_elements": ["parabola", "turning point"], "educational_purpose": "Show vertex form features"}
    },
    {
      "question_id": "q2",
      "question_number": 2,
      "tool": "NONE",
      "confidence": "HIGH",
      "reasoning": {
        "selected_because": "Pure algebraic equation solving, no visual component",
        "content_analysis": "Linear equation 3x + 2 = 14, symbolic manipulation only",
        "decision_rule_applied": "Rule 8: purely algebraic → NONE",
        "alternatives_rejected": "No tool adds value for equation solving",
        "summary": "Linear equation solving needs no diagram"
      },
      "visualization_focus": null,
      "alternative_tool": null,
      "curriculum_topic": "Expressions & Formulae",
      "diagram_specs": null
    },
    {
      "question_id": "q3",
      "question_number": 3,
      "tool": "PLOTLY",
      "confidence": "HIGH",
      "reasoning": {
        "selected_because": "PLOTLY for statistical data visualization",
        "content_analysis": "Numeric dataset '156, 162...' requiring histogram/box plot",
        "decision_rule_applied": "Rule 1 (highest): data points → PLOTLY",
        "alternatives_rejected": "DESMOS graphs functions, GEOGEBRA for geometry, not data",
        "summary": "Numeric dataset is PLOTLY domain"
      },
      "visualization_focus": "Histogram or box plot showing distribution",
      "alternative_tool": null,
      "curriculum_topic": "Statistics",
      "diagram_specs": {"key_elements": ["histogram", "axes", "title"], "educational_purpose": "Visualize data distribution"}
    }
  ]
}
```

## Constraints

### Batch Processing (CRITICAL)
- **ONE READ, ONE WRITE**: Read input ONCE, write output ONCE
- **ALL QUESTIONS IN SINGLE OUTPUT**: `classifications` array must have ALL questions
- **COMPLETE COVERAGE**: Every question MUST have classification (including NONE)
- **Include stats**: `total_questions`, `questions_needing_diagrams`, `questions_no_diagram`

### Reasoning (MANDATORY)
All 5 fields required: `selected_because`, `content_analysis`, `decision_rule_applied`, `alternatives_rejected`, `summary`

### Efficiency
- Target: 1 turn (read, process, write)
- Maximum: 3 turns
