'use client';

import React from 'react';
import { MarkdownRenderer } from '@/components/revision-notes/MarkdownRenderer';

const testMarkdown = `# Markdown Renderer Test Page

This page systematically tests all markdown rendering capabilities.

---

## 1. Tables Test

### Simple Table
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Row 1 A  | Row 1 B  | Row 1 C  |
| Row 2 A  | Row 2 B  | Row 2 C  |
| Row 3 A  | Row 3 B  | Row 3 C  |

### Table with Alignment
| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Text         | Text           | Text          |
| More text    | More text      | More text     |

### Complex Table
| Feature | Description | Status |
|---------|-------------|--------|
| Tables | Should render properly | ⚠️ Testing |
| Lists | Nested and simple | ✅ Works |
| Math | LaTeX support | 🔬 Testing |

---

## 2. Lists Test

### Unordered Lists
- Item 1
- Item 2
  - Nested Item 2.1
  - Nested Item 2.2
    - Deep nested 2.2.1
- Item 3

### Ordered Lists
1. First item
2. Second item
   1. Nested numbered item
   2. Another nested item
3. Third item

### Mixed Lists
1. Ordered item
   - Unordered nested
   - Another unordered
2. Second ordered
   1. Nested ordered
   2. More nested

---

## 3. Text Formatting

**Bold text** should be bold.

*Italic text* should be italic.

***Bold and italic*** should be both.

~~Strikethrough text~~ should have a line through it.

\`Inline code\` should look like code.

---

## 4. Code Blocks

### Plain Code Block
\`\`\`
function example() {
  return "This is plain code";
}
\`\`\`

### JavaScript Code Block
\`\`\`javascript
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

console.log(factorial(5)); // 120
\`\`\`

### Python Code Block
\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))  # 55
\`\`\`

---

## 5. LaTeX Math Test

### Inline Math
The equation $E = mc^2$ is Einstein's famous formula.

The fraction $\\frac{2}{10} = \\frac{1}{5} = 0.2$ demonstrates equivalent fractions.

### Display Math
$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

$$
\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

### Complex Math
$$
\\begin{bmatrix}
a & b \\\\
c & d
\\end{bmatrix}
\\begin{bmatrix}
x \\\\
y
\\end{bmatrix}
=
\\begin{bmatrix}
ax + by \\\\
cx + dy
\\end{bmatrix}
$$

---

## 6. Mermaid Diagrams

### Flowchart
\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]
\`\`\`

### Sequence Diagram
\`\`\`mermaid
sequenceDiagram
    Student->>Frontend: Click Cheat Sheet
    Frontend->>Driver: Fetch Content
    Driver->>Appwrite: Get Document
    Appwrite-->>Driver: Metadata
    Driver->>Appwrite: Fetch File
    Appwrite-->>Driver: Markdown Content
    Driver-->>Frontend: Complete Content
    Frontend-->>Student: Display Modal
\`\`\`

### Class Diagram
\`\`\`mermaid
classDiagram
    class RevisionNotesDriver {
        +getCourseCheatSheet()
        +getLessonQuickNotes()
        -fetchMarkdownFile()
    }
    class MarkdownRenderer {
        +render()
        +config
    }
    RevisionNotesDriver --> MarkdownRenderer
\`\`\`

---

## 7. Headings Test

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

---

## 8. Links and Images

[This is a link to Google](https://www.google.com)

[This is a link with title](https://www.example.com "Example Website")

---

## 9. Blockquotes

> This is a blockquote.
>
> It can span multiple lines.
>
> > And can be nested.
> >
> > Like this.

---

## 10. Horizontal Rules

Three different ways to create horizontal rules:

---

***

___

---

## 11. Mixed Content Test

Here's a complex scenario combining multiple elements:

### The Pythagorean Theorem

The **Pythagorean theorem** states that for a right triangle:

$$
a^2 + b^2 = c^2
$$

Where:
- \`a\` and \`b\` are the lengths of the two shorter sides (legs)
- \`c\` is the length of the longest side (hypotenuse)

**Example:** If $a = 3$ and $b = 4$, then:

$$
c = \\sqrt{3^2 + 4^2} = \\sqrt{9 + 16} = \\sqrt{25} = 5
$$

| Side | Length |
|------|--------|
| a    | 3      |
| b    | 4      |
| c    | 5      |

> **Note:** This is known as a Pythagorean triple.

---

## Test Complete

If all sections above render correctly, the MarkdownRenderer is working properly!
`;

export default function MarkdownRendererTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Markdown Renderer Test Page
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Systematic testing of all markdown rendering capabilities
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Route: /test/markdown-renderer
            </p>
          </div>

          <MarkdownRenderer
            content={testMarkdown}
            config={{
              supportsLaTeX: true,
              supportsMermaid: true,
              supportsSyntaxHighlighting: true,
              mobileOptimized: true,
              maxWidth: '100%'
            }}
          />

          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Test Instructions
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>Scroll through entire page to view all test sections</li>
              <li>Take screenshots of any sections that don't render correctly</li>
              <li>Check browser console for any errors</li>
              <li>Test on both light and dark modes</li>
              <li>Test responsive behavior on different screen sizes</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
