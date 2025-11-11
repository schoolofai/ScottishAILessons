"use client";

import { useState } from "react";
import { MarkdownRenderer } from "@/components/revision-notes/MarkdownRenderer";
import { RevisionNotesLoadingSkeleton } from "@/components/revision-notes/RevisionNotesLoadingSkeleton";

// Comprehensive test markdown with LaTeX, Mermaid, code blocks, and edge cases
const TEST_MARKDOWN = `# Markdown Renderer Test Suite

## 1. LaTeX Math Expressions

### Inline Math
Here's an inline fraction: $\\frac{1}{2}$ and a quadratic formula: $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$.

The Pythagorean theorem states: $a^2 + b^2 = c^2$.

### Display Math (Block)
$$
E = mc^2
$$

$$
\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

$$
\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}
$$

### Complex Equations
$$
\\begin{aligned}
\\nabla \\times \\vec{\\mathbf{B}} -\\, \\frac1c\\, \\frac{\\partial\\vec{\\mathbf{E}}}{\\partial t} & = \\frac{4\\pi}{c}\\vec{\\mathbf{j}} \\\\
\\nabla \\cdot \\vec{\\mathbf{E}} & = 4 \\pi \\rho \\\\
\\nabla \\times \\vec{\\mathbf{E}}\\, +\\, \\frac1c\\, \\frac{\\partial\\vec{\\mathbf{B}}}{\\partial t} & = \\vec{\\mathbf{0}} \\\\
\\nabla \\cdot \\vec{\\mathbf{B}} & = 0
\\end{aligned}
$$

---

## 2. Mermaid Diagrams

### Flowchart
\`\`\`mermaid
graph TD
    A[Start Lesson] --> B{Understand Concept?}
    B -->|Yes| C[Practice Problems]
    B -->|No| D[Review Material]
    D --> B
    C --> E{All Correct?}
    E -->|Yes| F[Complete Lesson]
    E -->|No| G[Get Feedback]
    G --> C
\`\`\`

### Sequence Diagram
\`\`\`mermaid
sequenceDiagram
    participant S as Student
    participant T as Teacher AI
    participant L as Lesson System
    S->>L: Start Lesson
    L->>T: Load Lesson Content
    T->>S: Present Card
    S->>T: Submit Answer
    T->>L: Check Answer
    L-->>T: Feedback Data
    T->>S: Provide Feedback
\`\`\`

### Class Diagram
\`\`\`mermaid
classDiagram
    class RevisionNotes {
        +String courseId
        +String markdownContent
        +Date fetchedAt
        +getCourseCheatSheet()
        +getLessonQuickNotes()
    }
    class MarkdownRenderer {
        +Boolean supportsLaTeX
        +Boolean supportsMermaid
        +render()
        +handleError()
    }
    RevisionNotes --> MarkdownRenderer : uses
\`\`\`

---

## 3. Code Blocks with Syntax Highlighting

### TypeScript
\`\`\`typescript
interface RevisionNoteContent {
  markdownContent: string;
  fileId: string;
  fileSize: number;
  fetchedAt: Date;
}

async function getCourseCheatSheet(courseId: string): Promise<RevisionNoteContent> {
  const driver = new RevisionNotesDriver();
  const content = await driver.getCourseCheatSheet(courseId);
  return content;
}
\`\`\`

### Python
\`\`\`python
def calculate_grade(score: int, max_score: int) -> str:
    percentage = (score / max_score) * 100

    if percentage >= 90:
        return "A"
    elif percentage >= 80:
        return "B"
    elif percentage >= 70:
        return "C"
    else:
        return "F"
\`\`\`

### JavaScript
\`\`\`javascript
const fetchLessonNotes = async (courseId, lessonOrder) => {
  try {
    const response = await fetch(\`/api/notes/\${courseId}/\${lessonOrder}\`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch lesson notes:', error);
    throw new Error('FETCH_FAILED');
  }
};
\`\`\`

---

## 4. Tables

| Feature | Supported | Performance | Notes |
|---------|-----------|-------------|-------|
| LaTeX Math | ✅ Yes | Fast | Uses KaTeX |
| Mermaid Diagrams | ✅ Yes | Medium | Client-side rendering |
| Code Highlighting | ✅ Yes | Fast | Syntax highlighting |
| Mobile Responsive | ✅ Yes | Fast | Tailwind CSS |

---

## 5. Lists and Nested Content

### Ordered List
1. **Course Cheat Sheet** - Overview of entire course
   - Learning outcomes
   - Key concepts
   - Assessment standards
2. **Lesson Quick Notes** - Per-lesson summaries
   - Card-by-card breakdown
   - Worked examples
   - Practice problems
3. **In-Lesson Side Panel** - Contextual support
   - Always accessible
   - Session-scoped caching

### Unordered List
- **Fast-Fail Principles**
  - No silent fallbacks
  - Detailed error messages
  - Retry mechanisms
- **Performance Optimization**
  - >30 FPS resize
  - >30 FPS scroll
  - Skeleton UI for perceived speed

---

## 6. Edge Cases (Error Handling Tests)

### Malformed LaTeX (Should Display Error, Not Crash)
This should render with error indicator: $\\frac{incomplete

### Malformed Mermaid (Should Display Error Block)
\`\`\`mermaid
graph TD
    A[Incomplete syntax
    Missing closing bracket
\`\`\`

### Very Long Equation (Mobile Scroll Test)
$$
f(x) = a_0 + a_1x + a_2x^2 + a_3x^3 + a_4x^4 + a_5x^5 + a_6x^6 + a_7x^7 + a_8x^8 + a_9x^9 + a_{10}x^{10} + a_{11}x^{11} + a_{12}x^{12}
$$

---

## 7. Mixed Content (Real-World Example)

### Quadratic Formula Derivation

Starting with the general quadratic equation:
$$ax^2 + bx + c = 0$$

We can solve for $x$ using the quadratic formula:
$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

The **discriminant** $\\Delta = b^2 - 4ac$ determines the nature of the roots:

| Discriminant | Root Type | Example |
|--------------|-----------|---------|
| $\\Delta > 0$ | Two real roots | $x^2 - 5x + 6 = 0$ |
| $\\Delta = 0$ | One real root | $x^2 - 4x + 4 = 0$ |
| $\\Delta < 0$ | Complex roots | $x^2 + 2x + 5 = 0$ |

---

## 8. Long Content (Scroll Performance Test)

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

### Additional Section 1
Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

### Additional Section 2
Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

### Additional Section 3
Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.

---

## 9. Blockquotes and Emphasis

> **Important Note**: This test suite validates all markdown rendering features including LaTeX, Mermaid, code blocks, and error handling.

*Italic text* and **bold text** and ***bold italic text***.

---

## 10. Interactive Collapsible Sections (HTML Details/Summary)

<details>
<summary>Q1: What is $2 + 2$?</summary>

**Answer**: $2 + 2 = 4$

This is basic addition.
</details>

<details>
<summary>Q2: You buy 4 chocolate bars at £1.25 EACH. Which operation?</summary>

**Answer**: Multiplication

$$4 \\times £1.25 = £5.00$$

When you buy multiple items at the same price, you multiply the quantity by the price per item.
</details>

<details>
<summary>Q3: Show the Pythagorean theorem with a diagram</summary>

**Answer**: The Pythagorean theorem states: $a^2 + b^2 = c^2$

For a right triangle:
- $a$ and $b$ are the lengths of the two shorter sides (legs)
- $c$ is the length of the longest side (hypotenuse)

Example: If $a = 3$ and $b = 4$, then:
$$c = \\sqrt{3^2 + 4^2} = \\sqrt{9 + 16} = \\sqrt{25} = 5$$
</details>

---

## 11. Links and Images

[Link to ScottishAI Lessons](https://example.com)

[Internal link to dashboard](/dashboard)

---

**End of Test Suite** - All features should render correctly on desktop and mobile! 🚀
`;

// Real course cheat sheet from Appwrite for testing
const REAL_CHEAT_SHEET = `# National 4 Applications of Mathematics: Course Cheat Sheet

**Course Code**: HV7V 74 & HV7W 74 & H225 74
**Level**: National 4
**Units**: Managing Finance & Statistics, Geometry & Measures, Numeracy

---

## QUICK REFERENCE: Key Formulas

### Geometry & Measurement
- **Perimeter (rectangle)**: $P = 2(l + w)$ or $P = 2l + 2w$
- **Area (rectangle)**: $A = l \\times w$ (measured in m²)
- **Volume (cuboid)**: $V = l \\times w \\times h$ (measured in m³)
- **Pythagoras' Theorem**: $a^2 + b^2 = c^2$ (c = hypotenuse)
- **Map Scale**: Real distance = map distance × scale factor
- **Speed**: $\\text{Speed} = \\frac{\\text{distance}}{\\text{time}}$

### Finance & Statistics
- **Percentage**: $\\text{Percentage} = \\frac{\\text{part}}{\\text{total}} \\times 100$
- **Percentage Discount**: New price = Original price × $(100 - \\text{discount}\\%)$
`;

export default function TestMarkdownPage() {
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showRenderer, setShowRenderer] = useState(true);
  const [activeTest, setActiveTest] = useState<'comprehensive' | 'real'>('comprehensive');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Controls */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Markdown Renderer Test Suite
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Comprehensive testing for LaTeX, Mermaid, code blocks, and edge cases
              </p>
            </div>

            {/* Test Controls */}
            <div className="flex items-center gap-3">
              <select
                value={activeTest}
                onChange={(e) => setActiveTest(e.target.value as 'comprehensive' | 'real')}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium"
              >
                <option value="comprehensive">Comprehensive Test</option>
                <option value="real">Real Cheat Sheet</option>
              </select>
              <button
                onClick={() => setShowSkeleton(!showSkeleton)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                {showSkeleton ? "Hide Skeleton" : "Show Skeleton"}
              </button>
              <button
                onClick={() => setShowRenderer(!showRenderer)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {showRenderer ? "Hide Renderer" : "Show Renderer"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Skeleton Preview */}
        {showSkeleton && (
          <div className="mb-8 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Loading Skeleton Preview
            </h2>
            <RevisionNotesLoadingSkeleton
              headingCount={6}
              paragraphBlocksPerSection={3}
              hasCodeBlocks={true}
              hasDiagrams={true}
            />
          </div>
        )}

        {/* Markdown Renderer */}
        {showRenderer && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Rendered Output
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>📱 Resize window to test mobile responsiveness</span>
                <span>📜 Scroll to test performance</span>
              </div>
            </div>

            <MarkdownRenderer
              content={activeTest === 'real' ? REAL_CHEAT_SHEET : TEST_MARKDOWN}
              className="prose prose-sm md:prose-base lg:prose-lg max-w-none"
            />
          </div>
        )}

        {/* Test Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            🧪 Testing Instructions
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✅ <strong>LaTeX Rendering:</strong> Verify fractions, equations, and complex math display correctly</li>
            <li>✅ <strong>Mermaid Diagrams:</strong> Check flowcharts, sequence diagrams, and class diagrams render</li>
            <li>✅ <strong>Collapsible Sections:</strong> Click details/summary elements to expand/collapse practice questions</li>
            <li>✅ <strong>Error Handling:</strong> Malformed LaTeX/Mermaid should show error indicators (not crash)</li>
            <li>✅ <strong>Mobile Responsive:</strong> Resize window to &lt;768px and verify content adapts</li>
            <li>✅ <strong>Scroll Performance:</strong> Scroll through long content - should be smooth (&gt;30 FPS)</li>
            <li>✅ <strong>Code Blocks:</strong> Syntax highlighting should work for TypeScript, Python, JavaScript</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
