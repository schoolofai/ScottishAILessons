# JSXGraph Integration Design Document

## Executive Summary

This design document outlines the integration of JSXGraph diagram rendering capabilities into the LessonCardPresentationTool component. Based on successful prototyping in the `diagram-prototypes` directory, this integration will enable AI-generated mathematical diagrams to enhance lesson cards with interactive visualizations.

**Key Outcomes from Prototype:**
- ✅ JSON-driven diagram rendering working
- ✅ Performance validated (~180ms for 8-element diagrams)
- ✅ Interactive elements (draggable points, live calculations) functional
- ✅ All critical implementation patterns identified and documented

---

## 1. Component Architecture

### 1.1 Integration Point

The JSXGraph diagram renderer will integrate into `LessonCardPresentationTool.tsx` as an **optional visual enhancement** component.

```typescript
// assistant-ui-frontend/components/tools/LessonCardPresentationTool.tsx

interface LessonCard {
  // ... existing fields
  diagram?: DiagramContent;  // Optional diagram specification
}

export const LessonCardPresentationTool = ({ args }) => {
  const card = args;

  return (
    <div className="lesson-card">
      {/* Existing card rendering */}
      <div className="card-content">
        {card.content}
      </div>

      {/* NEW: Optional diagram rendering */}
      {card.diagram && (
        <DiagramRenderer diagram={card.diagram} />
      )}

      {/* Existing interaction elements */}
    </div>
  );
};
```

### 1.2 Component Hierarchy

```
LessonCardPresentationTool
├── Card Header (title, description)
├── Card Content (text, equations)
├── DiagramRenderer (NEW - conditional)
│   ├── JSXGraph Board Container
│   ├── Performance Metrics Display
│   └── Reset Controls
└── Interaction Controls (existing)
```

### 1.3 New Component: DiagramRenderer

**Location**: `assistant-ui-frontend/components/diagrams/DiagramRenderer.tsx`

**Responsibilities:**
- Initialize JSXGraph board with provided configuration
- Process and render diagram elements from JSON
- Handle element references and dynamic functions
- Manage board lifecycle (creation, updates, cleanup)
- Display errors gracefully without breaking lesson card

**Props Interface:**
```typescript
interface DiagramRendererProps {
  diagram: DiagramContent;
  height?: number;  // Default: 500px
  showMetrics?: boolean;  // Default: false (true in dev mode)
  className?: string;
}
```

---

## 2. Backend Tool Call Specification

### 2.1 Tool Call Structure

The backend will include diagram data as part of the existing `LessonCardPresentationTool` tool call:

```python
# Backend (LangGraph agent)
from langchain_core.messages import AIMessage, ToolCall

# Generate lesson card with optional diagram
card_with_diagram = {
    "title": "Pythagorean Theorem",
    "content": "The relationship between the sides of a right triangle...",
    "diagram": {
        "board": {
            "boundingbox": [-1, 6, 7, -1],
            "axis": True,
            "grid": True,
            "keepAspectRatio": True
        },
        "elements": [
            {
                "type": "point",
                "args": [0, 0],
                "attributes": {"name": "A", "fixed": True, "size": 5},
                "id": "pointA"
            },
            # ... more elements
        ],
        "title": "Interactive Right Triangle",
        "description": "Drag points B and C to explore the theorem"
    }
}

# Create tool call
tool_call = ToolCall(
    name="LessonCardPresentationTool",
    args=card_with_diagram,
    id="card_xyz"
)
```

### 2.2 No New Tool Required

**Important**: Diagrams are **embedded within existing lesson card tool calls**, not a separate tool. This maintains backward compatibility and keeps the tool interface simple.

**Rationale:**
- Diagrams are part of the card's visual content
- Not all cards need diagrams (optional field)
- Simplifies frontend handling (one tool, one component)
- Reduces interrupt/tool call complexity

### 2.3 Backend Responsibility

The backend's role is to:
1. Generate diagram JSON structure using AI (ChatGPT, Claude, etc.)
2. Validate diagram structure before sending
3. Include diagram in `card.diagram` field when appropriate
4. Omit `diagram` field when card doesn't need visualization

**Example AI Prompt for Backend:**
```
Generate a lesson card about {topic}. If the concept benefits from
visualization, include a "diagram" field with JSXGraph configuration.

Available diagram element types:
- point: [x, y] coordinates
- line: [point1, point2] references
- circle: [center, radius] or [center, pointOnCircle]
- polygon: [[point1, point2, point3]]
- functiongraph: [expression, xMin, xMax]
- text: [x, y, content or function]

Use named references (like "A", "B") for interactive elements.
For dynamic text, use function strings: "() => `...${board.select('A').X()}...`"
```

---

## 3. JSON Diagram Schema

### 3.1 TypeScript Definition

```typescript
// assistant-ui-frontend/types/diagram.ts

export interface DiagramContent {
  board: BoardConfig;
  elements: DiagramElement[];
  title?: string;
  description?: string;
  metadata?: DiagramMetadata;
}

export interface BoardConfig {
  boundingbox: [number, number, number, number];  // [left, top, right, bottom]
  axis?: boolean;
  grid?: boolean;
  showCopyright?: boolean;
  showNavigation?: boolean;
  keepAspectRatio?: boolean;
  pan?: {
    enabled?: boolean;
    needTwoFingers?: boolean;
  };
  zoom?: {
    enabled?: boolean;
    wheel?: boolean;
  };
}

export interface DiagramElement {
  type: DiagramElementType;
  args: any[];  // Type depends on element type
  attributes?: Record<string, any>;
  id?: string;  // Optional ID for referencing
}

export type DiagramElementType =
  | "point"
  | "line"
  | "segment"
  | "circle"
  | "polygon"
  | "angle"
  | "functiongraph"
  | "text"
  | "slider";

export interface DiagramMetadata {
  subject?: string;
  difficulty?: "easy" | "medium" | "hard";
  interactivity?: "static" | "draggable" | "parametric";
  learningObjective?: string;
}
```

### 3.2 Validation Schema (Zod)

```typescript
// assistant-ui-frontend/lib/diagram-validation.ts

import { z } from "zod";

export const BoardConfigSchema = z.object({
  boundingbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  axis: z.boolean().optional(),
  grid: z.boolean().optional(),
  showCopyright: z.boolean().optional(),
  showNavigation: z.boolean().optional(),
  keepAspectRatio: z.boolean().optional(),
  pan: z.object({
    enabled: z.boolean().optional(),
    needTwoFingers: z.boolean().optional(),
  }).optional(),
  zoom: z.object({
    enabled: z.boolean().optional(),
    wheel: z.boolean().optional(),
  }).optional(),
});

export const DiagramElementSchema = z.object({
  type: z.enum([
    "point",
    "line",
    "segment",
    "circle",
    "polygon",
    "angle",
    "functiongraph",
    "text",
    "slider",
  ]),
  args: z.array(z.any()),
  attributes: z.record(z.any()).optional(),
  id: z.string().optional(),
});

export const DiagramContentSchema = z.object({
  board: BoardConfigSchema,
  elements: z.array(DiagramElementSchema),
  title: z.string().optional(),
  description: z.string().optional(),
  metadata: z.object({
    subject: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    interactivity: z.enum(["static", "draggable", "parametric"]).optional(),
    learningObjective: z.string().optional(),
  }).optional(),
});

export function validateDiagram(diagram: unknown): diagram is DiagramContent {
  try {
    DiagramContentSchema.parse(diagram);
    return true;
  } catch {
    return false;
  }
}
```

### 3.3 Example Diagram JSON

```json
{
  "board": {
    "boundingbox": [-1, 6, 7, -1],
    "axis": true,
    "grid": true,
    "keepAspectRatio": true
  },
  "elements": [
    {
      "type": "point",
      "args": [0, 0],
      "attributes": {
        "name": "A",
        "fixed": true,
        "size": 5,
        "fillColor": "#333"
      },
      "id": "pointA"
    },
    {
      "type": "point",
      "args": [3, 0],
      "attributes": {
        "name": "B",
        "size": 5,
        "fillColor": "#0066cc"
      },
      "id": "pointB"
    },
    {
      "type": "point",
      "args": [0, 4],
      "attributes": {
        "name": "C",
        "size": 5,
        "fillColor": "#0066cc"
      },
      "id": "pointC"
    },
    {
      "type": "polygon",
      "args": [["A", "B", "C"]],
      "attributes": {
        "fillColor": "#ffeecc",
        "fillOpacity": 0.4
      }
    },
    {
      "type": "text",
      "args": [
        3.5,
        5,
        "() => { const B = board.select('B'); const C = board.select('C'); const a = B.X(); const b = C.Y(); const c = Math.sqrt(a*a + b*b); return `${a.toFixed(1)}² + ${b.toFixed(1)}² = ${c.toFixed(2)}²`; }"
      ],
      "attributes": {
        "fontSize": 16,
        "color": "#006600"
      }
    }
  ],
  "title": "Pythagorean Theorem: a² + b² = c²",
  "description": "Drag points B and C to explore the relationship."
}
```

---

## 4. Critical Implementation Patterns

### 4.1 JSXGraph Initialization

**Pattern**: Use correct module import and pass DOM element directly (not string ID)

```typescript
// DiagramRenderer.tsx
import { useEffect, useRef } from "react";

const DiagramRenderer = ({ diagram }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<any>(null);

  useEffect(() => {
    const loadJSXGraph = async () => {
      // CRITICAL: Import pattern
      const JXG = (await import("jsxgraph")).default;

      if (!containerRef.current) return;

      // CRITICAL: Pass DOM element, not string ID
      const board = JXG.JSXGraph.initBoard(containerRef.current, {
        boundingbox: diagram.board.boundingbox,
        axis: diagram.board.axis ?? true,
        showCopyright: false,
        grid: diagram.board.grid ?? false,
        keepAspectRatio: diagram.board.keepAspectRatio ?? true,
        // ... other config
      });

      boardRef.current = board;

      // Create elements...
    };

    loadJSXGraph();

    // Cleanup
    return () => {
      if (boardRef.current) {
        import("jsxgraph").then((module) => {
          const JXG = module.default;
          if (boardRef.current) {
            JXG.JSXGraph.freeBoard(boardRef.current);
            boardRef.current = null;
          }
        });
      }
    };
  }, [diagram]);

  return (
    <div
      ref={containerRef}
      className="jsxgraph-board"
      style={{ width: "100%", height: "500px" }}
    />
  );
};
```

**Why This Pattern:**
- ✅ Avoids React SSR hydration mismatch (no random IDs)
- ✅ Correct JSXGraph API usage (JXG.JSXGraph.initBoard)
- ✅ Proper cleanup prevents memory leaks

### 4.2 Element Creation with References

**Pattern**: Resolve named references and handle array flattening

```typescript
const elementRefs: Record<string, any> = {};

for (const element of diagram.elements) {
  // Process arguments
  const processedArgs = element.args.map((arg: any) => {
    // Handle function strings (for dynamic text)
    if (
      typeof arg === "string" &&
      arg.startsWith("() =>") &&
      element.type !== "functiongraph"
    ) {
      return createFunctionWithClosure(arg, board);
    }

    // Handle element ID references
    if (typeof arg === "string" && elementRefs[arg]) {
      return elementRefs[arg];
    }

    // Handle arrays of named references (for polygon, angle)
    if (Array.isArray(arg)) {
      return arg.map((item: any) => {
        if (typeof item === "string") {
          const point = board.select(item);
          if (point) return point;
        }
        return item;
      });
    }

    return arg;
  });

  // CRITICAL: Flatten single nested arrays for polygon elements
  const finalArgs =
    processedArgs.length === 1 && Array.isArray(processedArgs[0])
      ? processedArgs[0]
      : processedArgs;

  // Create element
  const jsxElement = board.create(
    element.type,
    finalArgs,
    element.attributes || {}
  );

  // Store reference if element has ID
  if (element.id) {
    elementRefs[element.id] = jsxElement;
  }
}
```

**Why This Pattern:**
- ✅ Enables named references (e.g., "A", "B", "C")
- ✅ Handles polygon array structure correctly
- ✅ Supports both ID and name-based references

### 4.3 Dynamic Function Strings with Closures

**Pattern**: Use eval with closure to capture board reference

```typescript
function createFunctionWithClosure(funcString: string, board: any): Function {
  const funcBody = funcString.substring(6).trim(); // Remove "() => "

  if (funcBody.startsWith("{")) {
    // Block statement: () => { ... }
    return (function (boardRef) {
      const board = boardRef; // Make 'board' available by name
      return eval(`(function() ${funcBody})`);
    })(board);
  } else {
    // Expression: () => expression
    return (function (boardRef) {
      const board = boardRef;
      return eval(`(function() { return ${funcBody}; })`);
    })(board);
  }
}
```

**Why This Pattern:**
- ✅ Captures `board` in proper scope (new Function doesn't work)
- ✅ Enables dynamic text with live updates
- ✅ Supports both block statements and expressions

**Critical Gotcha**: Do NOT use `new Function()` - it creates functions in global scope where `board` is undefined or wrong type.

### 4.4 FunctionGraph Special Handling

**Pattern**: Pass JessieCode expressions directly (no arrow functions)

```typescript
// For functiongraph elements, do NOT process function strings
if (element.type === "functiongraph") {
  // JessieCode expects: "x * x", NOT "(x) => x * x"
  const jsxElement = board.create("functiongraph", element.args, element.attributes);
} else {
  // Normal element processing...
}
```

**Example JSON:**
```json
{
  "type": "functiongraph",
  "args": ["x * x", -6, 6],  // JessieCode syntax
  "attributes": { "strokeColor": "#cc00cc", "strokeWidth": 3 }
}
```

**Why This Pattern:**
- ✅ JSXGraph's JessieCode parser doesn't support ES6 arrows
- ✅ Prevents parse errors on mathematical expressions
- ✅ Maintains compatibility with JSXGraph API

### 4.5 Manual Distance Calculations

**Pattern**: Use coordinate methods instead of `.Dist()`

```typescript
// AVOID: board.select('R').Dist(board.select('O'))
// This can return strings in eval context

// USE: Manual calculation with .X() and .Y()
const R = board.select('R');
const O = board.select('O');
const distance = Math.sqrt(
  Math.pow(R.X() - O.X(), 2) +
  Math.pow(R.Y() - O.Y(), 2)
);
```

**Why This Pattern:**
- ✅ Reliable across all contexts (eval, new Function, direct)
- ✅ Avoids type coercion issues
- ✅ More explicit and debuggable

---

## 5. Error Handling Strategy

### 5.1 Validation Layer

```typescript
// DiagramRenderer.tsx
export const DiagramRenderer = ({ diagram }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Validate before rendering
    if (!validateDiagram(diagram)) {
      setError("Invalid diagram configuration");
      return;
    }

    try {
      // Render diagram...
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to render diagram";
      setError(errMsg);
      console.error("DiagramRenderer error:", err);
    }
  }, [diagram]);

  if (error) {
    return (
      <div className="diagram-error">
        <AlertCircle className="error-icon" />
        <p>Unable to display diagram: {error}</p>
      </div>
    );
  }

  return <div ref={containerRef} />;
};
```

### 5.2 Graceful Degradation

**Principle**: Diagram errors should NOT break the lesson card.

```typescript
// LessonCardPresentationTool.tsx
{card.diagram && (
  <ErrorBoundary
    fallback={
      <div className="diagram-unavailable">
        <Info className="info-icon" />
        <p>Diagram unavailable</p>
      </div>
    }
  >
    <DiagramRenderer diagram={card.diagram} />
  </ErrorBoundary>
)}
```

### 5.3 Element-Level Error Handling

```typescript
for (const element of diagram.elements) {
  try {
    // Process and create element...
  } catch (elemErr) {
    console.error(`Error creating element ${element.type}:`, elemErr);
    // Continue to next element instead of failing entire diagram
    continue;
  }
}
```

**Rationale**: One malformed element shouldn't prevent other elements from rendering.

---

## 6. Performance Considerations

### 6.1 Metrics from Prototype

| Diagram | Elements | Render Time | Interactive |
|---------|----------|-------------|-------------|
| Pythagorean | 8 | ~180ms | ✅ Draggable points |
| Circle | 5 | ~174ms | ✅ Radius control |
| Function | 4 | ~178ms | ❌ Static graph |

**Performance Target**: <200ms for diagrams with ≤10 elements

### 6.2 Optimization Strategies

**1. Lazy Loading JSXGraph**
```typescript
const JXG = (await import("jsxgraph")).default;
```
- ✅ Reduces initial bundle size
- ✅ Only loads when diagram present

**2. Memoization**
```typescript
const DiagramRenderer = memo(({ diagram }) => {
  // ...
}, (prevProps, nextProps) => {
  return JSON.stringify(prevProps.diagram) === JSON.stringify(nextProps.diagram);
});
```

**3. Debounced Updates**
```typescript
// For dynamic text that updates on every drag
const debouncedUpdate = useMemo(
  () => debounce(() => board.update(), 16), // ~60fps
  [board]
);
```

**4. Element Count Limits**
```typescript
const MAX_ELEMENTS = 20;

if (diagram.elements.length > MAX_ELEMENTS) {
  console.warn(`Diagram has ${diagram.elements.length} elements, limiting to ${MAX_ELEMENTS}`);
  diagram.elements = diagram.elements.slice(0, MAX_ELEMENTS);
}
```

### 6.3 Performance Monitoring

```typescript
const [renderTime, setRenderTime] = useState<number>(0);

useEffect(() => {
  const startTime = performance.now();

  // Render diagram...

  const endTime = performance.now();
  setRenderTime(endTime - startTime);

  // Log performance in development
  if (process.env.NODE_ENV === "development") {
    console.log(`Diagram rendered in ${(endTime - startTime).toFixed(2)}ms`);
  }
}, [diagram]);
```

---

## 7. CSS and Styling Integration

### 7.1 Global CSS Import

**Location**: `assistant-ui-frontend/app/layout.tsx`

```tsx
<head>
  {/* Other head elements */}
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/jsxgraph@1.11.1/distrib/jsxgraph.css"
  />
</head>
```

**Rationale**: JSXGraph package doesn't export CSS file in package.json, CDN is most reliable approach.

### 7.2 Component Styling

```css
/* assistant-ui-frontend/styles/diagram.css */

.diagram-container {
  width: 100%;
  margin: 1.5rem 0;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  overflow: hidden;
}

.diagram-header {
  padding: 1rem;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.diagram-header h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.diagram-header p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.jsxgraph-board {
  width: 100%;
  height: 500px;
  background-color: white;
}

.diagram-controls {
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
}

.diagram-metrics {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.diagram-error {
  padding: 2rem;
  text-align: center;
  background-color: var(--error-bg);
  border: 1px solid var(--error-border);
  border-radius: 0.5rem;
}

.diagram-error .error-icon {
  width: 2rem;
  height: 2rem;
  margin: 0 auto 0.5rem;
  color: var(--error-color);
}

.diagram-unavailable {
  padding: 1.5rem;
  text-align: center;
  background-color: var(--info-bg);
  border: 1px solid var(--info-border);
  border-radius: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
}
```

---

## 8. Dependencies and Installation

### 8.1 Package Dependencies

```json
// assistant-ui-frontend/package.json
{
  "dependencies": {
    "jsxgraph": "^1.11.1",
    "zod": "^3.22.0",  // For validation
    // ... existing dependencies
  },
  "devDependencies": {
    // ... existing dev dependencies
  }
}
```

### 8.2 Type Definitions

**Create**: `assistant-ui-frontend/types/jsxgraph.d.ts`

```typescript
declare module "jsxgraph" {
  export interface JXG {
    JSXGraph: {
      initBoard(
        element: string | HTMLElement,
        attributes?: any
      ): Board;
      freeBoard(board: Board): void;
    };
  }

  export interface Board {
    create(
      elementType: string,
      parents: any[],
      attributes?: any
    ): any;
    select(name: string): any;
    setBoundingBox(bbox: [number, number, number, number]): void;
    update(): void;
  }

  const JXG: JXG;
  export default JXG;
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// __tests__/DiagramRenderer.test.tsx
import { render, waitFor } from "@testing-library/react";
import { DiagramRenderer } from "@/components/diagrams/DiagramRenderer";

describe("DiagramRenderer", () => {
  it("renders simple point diagram", async () => {
    const diagram = {
      board: { boundingbox: [-5, 5, 5, -5], axis: true },
      elements: [
        {
          type: "point",
          args: [0, 0],
          attributes: { name: "Origin" }
        }
      ]
    };

    const { container } = render(<DiagramRenderer diagram={diagram} />);

    await waitFor(() => {
      expect(container.querySelector(".jsxgraph-board")).toBeInTheDocument();
    });
  });

  it("handles invalid diagram gracefully", () => {
    const invalidDiagram = {
      board: { boundingbox: "invalid" }  // Should be array
    };

    const { getByText } = render(<DiagramRenderer diagram={invalidDiagram} />);

    expect(getByText(/Unable to display diagram/)).toBeInTheDocument();
  });

  it("cleans up on unmount", async () => {
    const diagram = {
      board: { boundingbox: [-5, 5, 5, -5] },
      elements: []
    };

    const { unmount } = render(<DiagramRenderer diagram={diagram} />);

    // Mock JSXGraph.freeBoard
    const freeBoardSpy = jest.fn();

    unmount();

    await waitFor(() => {
      // Verify cleanup was called
      expect(freeBoardSpy).toHaveBeenCalled();
    });
  });
});
```

### 9.2 Integration Tests

```typescript
// __tests__/LessonCardWithDiagram.test.tsx
describe("LessonCardPresentationTool with diagram", () => {
  it("renders card with optional diagram", () => {
    const cardWithDiagram = {
      title: "Pythagorean Theorem",
      content: "a² + b² = c²",
      diagram: {
        board: { boundingbox: [-1, 6, 7, -1] },
        elements: [/* ... */]
      }
    };

    const { getByText, container } = render(
      <LessonCardPresentationTool args={cardWithDiagram} />
    );

    expect(getByText("Pythagorean Theorem")).toBeInTheDocument();
    expect(container.querySelector(".jsxgraph-board")).toBeInTheDocument();
  });

  it("renders card without diagram", () => {
    const cardWithoutDiagram = {
      title: "Simple Concept",
      content: "No visualization needed"
    };

    const { getByText, container } = render(
      <LessonCardPresentationTool args={cardWithoutDiagram} />
    );

    expect(getByText("Simple Concept")).toBeInTheDocument();
    expect(container.querySelector(".jsxgraph-board")).not.toBeInTheDocument();
  });
});
```

### 9.3 Manual Testing Checklist

- [ ] Diagram renders on first card presentation
- [ ] Interactive elements respond to drag events
- [ ] Dynamic text updates in real-time
- [ ] Reset button restores initial view
- [ ] Error messages display for invalid diagrams
- [ ] Card without diagram renders normally
- [ ] Performance <200ms for typical diagrams
- [ ] Mobile touch interactions work
- [ ] Browser zoom doesn't break diagram
- [ ] SSR hydration completes without errors

---

## 10. Implementation Checklist

### Phase 1: Foundation (1-2 days)
- [ ] Add `jsxgraph` dependency to package.json
- [ ] Create TypeScript type definitions
- [ ] Add JSXGraph CSS to layout.tsx
- [ ] Create `DiagramContent` schema with Zod validation
- [ ] Set up diagram validation utilities

### Phase 2: Core Component (2-3 days)
- [ ] Create `DiagramRenderer` component
- [ ] Implement JSXGraph initialization pattern
- [ ] Implement element creation with reference resolution
- [ ] Implement function string evaluation with closures
- [ ] Add array flattening logic for polygons
- [ ] Add special handling for functiongraph elements
- [ ] Implement error boundaries and graceful degradation

### Phase 3: Integration (1-2 days)
- [ ] Integrate `DiagramRenderer` into `LessonCardPresentationTool`
- [ ] Add conditional rendering logic
- [ ] Style diagram container to match lesson card design
- [ ] Add performance monitoring (dev mode only)
- [ ] Implement reset controls

### Phase 4: Backend Support (2-3 days)
- [ ] Document diagram JSON schema for backend team
- [ ] Create example diagrams for common concepts
- [ ] Add backend validation before sending to frontend
- [ ] Update backend prompt templates to include diagram generation
- [ ] Test end-to-end diagram flow

### Phase 5: Testing & Polish (2-3 days)
- [ ] Write unit tests for DiagramRenderer
- [ ] Write integration tests for LessonCardPresentationTool
- [ ] Manual testing on desktop browsers
- [ ] Manual testing on mobile devices
- [ ] Performance optimization if needed
- [ ] Documentation updates

**Total Estimated Time**: 8-13 days

---

## 11. Known Limitations and Future Enhancements

### 11.1 Current Limitations

1. **JessieCode Function Syntax**: FunctionGraph elements require JessieCode syntax, not ES6 arrows
   - Impact: Backend needs to generate "x * x" not "(x) => x * x"
   - Workaround: Document in backend guidelines

2. **Eval Security**: Function strings use eval for board access
   - Impact: Potential XSS if user input in diagram JSON
   - Mitigation: Backend-generated only, frontend validation

3. **CSS Loading**: Depends on CDN for JSXGraph CSS
   - Impact: Offline usage not supported
   - Alternative: Bundle CSS locally if needed

4. **Browser Support**: JSXGraph requires modern browsers with SVG support
   - Impact: IE11 and older browsers not supported
   - Acceptable: Target audience uses modern browsers

### 11.2 Future Enhancements

1. **Diagram Templates**: Pre-built templates for common diagrams
   ```typescript
   const TEMPLATES = {
     rightTriangle: (a, b) => ({ /* diagram config */ }),
     circleWithRadius: (r) => ({ /* diagram config */ }),
     parabola: (a, b, c) => ({ /* diagram config */ })
   };
   ```

2. **Animation Support**: Time-based animations for dynamic concepts
   ```typescript
   diagram.animations = [{
     element: "pointB",
     property: "X",
     from: 0,
     to: 5,
     duration: 3000
   }];
   ```

3. **Student Interaction Recording**: Track student interactions with diagrams
   ```typescript
   const interactions = useInteractionTracking(board);
   // Save interactions to learning analytics
   ```

4. **Accessibility Enhancements**: Keyboard navigation, screen reader descriptions
   ```typescript
   <div
     role="img"
     aria-label={diagram.description}
     tabIndex={0}
   >
   ```

5. **Export Capabilities**: Export diagram as image or SVG
   ```typescript
   const exportPNG = () => {
     const svg = board.renderer.dumpToCanvas();
     // Convert to PNG and download
   };
   ```

---

## 12. Success Criteria

### Technical Success
- ✅ Diagrams render in <200ms for typical complexity
- ✅ No console errors during normal operation
- ✅ Memory leaks prevented (proper cleanup)
- ✅ SSR hydration completes without warnings
- ✅ Interactive elements respond within 16ms (60fps)

### User Experience Success
- ✅ Students can drag points and see live calculations
- ✅ Diagrams enhance understanding of abstract concepts
- ✅ Error states don't break lesson flow
- ✅ Mobile touch interactions feel natural
- ✅ Diagrams integrate seamlessly with lesson card design

### Integration Success
- ✅ Backend can generate diagrams without frontend changes
- ✅ Existing lesson cards continue working (backward compatible)
- ✅ No new tool calls required (embedded in existing tool)
- ✅ Optional diagrams handled gracefully

---

## 13. References and Resources

### JSXGraph Documentation
- Official Docs: https://jsxgraph.uni-bayreuth.de/docs/
- Element Reference: https://jsxgraph.uni-bayreuth.de/docs/symbols/JXG.Board.html
- Examples Gallery: https://jsxgraph.uni-bayreuth.de/wp/about/index.html

### Prototype Code
- Working Implementation: `/diagram-prototypes/components/tools/JSXGraphTool.tsx`
- Example Diagrams: `/diagram-prototypes/lib/example-diagrams.ts`
- Live Examples: http://localhost:3005 (when running)

### Related Documents
- Main Project README: `../README.md`
- Prototype README: `./README.md`
- Original Spec: `../tasks/DIAGRAM_PROTOTYPING_JSXGRAPH_SPEC.md`

---

## Appendix A: Complete DiagramRenderer Implementation

```typescript
// assistant-ui-frontend/components/diagrams/DiagramRenderer.tsx
"use client";

import React, { useEffect, useRef, useState, memo } from "react";
import type { DiagramContent } from "@/types/diagram";
import { validateDiagram } from "@/lib/diagram-validation";
import { AlertCircle } from "lucide-react";

interface DiagramRendererProps {
  diagram: DiagramContent;
  height?: number;
  showMetrics?: boolean;
  className?: string;
}

export const DiagramRenderer: React.FC<DiagramRendererProps> = memo(({
  diagram,
  height = 500,
  showMetrics = process.env.NODE_ENV === "development",
  className = ""
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderTime, setRenderTime] = useState<number>(0);
  const [elementCount, setElementCount] = useState<number>(0);

  useEffect(() => {
    // Validate diagram before attempting render
    if (!validateDiagram(diagram)) {
      setError("Invalid diagram configuration");
      return;
    }

    const loadJSXGraph = async () => {
      try {
        const startTime = performance.now();

        // Import JSXGraph dynamically
        const JXG = (await import("jsxgraph")).default;

        if (!containerRef.current) {
          throw new Error("Container ref not available");
        }

        // Free previous board if exists
        if (boardRef.current) {
          JXG.JSXGraph.freeBoard(boardRef.current);
          boardRef.current = null;
        }

        // Initialize board with DOM element (not string ID)
        const board = JXG.JSXGraph.initBoard(containerRef.current, {
          boundingbox: diagram.board.boundingbox,
          axis: diagram.board.axis ?? true,
          showCopyright: diagram.board.showCopyright ?? false,
          showNavigation: diagram.board.showNavigation ?? false,
          keepAspectRatio: diagram.board.keepAspectRatio ?? true,
          grid: diagram.board.grid ?? false,
          pan: diagram.board.pan,
          zoom: diagram.board.zoom,
        });

        boardRef.current = board;
        const elementRefs: Record<string, any> = {};

        // Create elements
        for (const element of diagram.elements) {
          try {
            // Process arguments
            const processedArgs = element.args.map((arg: any) => {
              // Function strings for dynamic text (except functiongraph)
              if (
                typeof arg === "string" &&
                arg.startsWith("() =>") &&
                element.type !== "functiongraph"
              ) {
                return createFunctionWithClosure(arg, board);
              }

              // Element ID references
              if (typeof arg === "string" && elementRefs[arg]) {
                return elementRefs[arg];
              }

              // Arrays of named references
              if (Array.isArray(arg)) {
                return arg.map((item: any) => {
                  if (typeof item === "string") {
                    const point = board.select(item);
                    if (point) return point;
                  }
                  return item;
                });
              }

              return arg;
            });

            // Flatten single nested arrays (polygon, angle)
            const finalArgs =
              processedArgs.length === 1 && Array.isArray(processedArgs[0])
                ? processedArgs[0]
                : processedArgs;

            // Create JSXGraph element
            const jsxElement = board.create(
              element.type,
              finalArgs,
              element.attributes || {}
            );

            // Store reference
            if (element.id) {
              elementRefs[element.id] = jsxElement;
            }
          } catch (elemErr) {
            console.error(`Error creating element ${element.type}:`, elemErr);
            // Continue to next element instead of failing entire diagram
          }
        }

        const endTime = performance.now();
        setRenderTime(endTime - startTime);
        setElementCount(diagram.elements.length);
        setError(null);

      } catch (loadErr) {
        console.error("JSXGraph initialization error:", loadErr);
        const errMsg = loadErr instanceof Error
          ? loadErr.message
          : "Failed to load diagram";
        setError(errMsg);
      }
    };

    loadJSXGraph();

    // Cleanup on unmount
    return () => {
      if (boardRef.current) {
        try {
          import("jsxgraph").then((module) => {
            const JXG = module.default;
            if (boardRef.current) {
              JXG.JSXGraph.freeBoard(boardRef.current);
              boardRef.current = null;
            }
          });
        } catch (cleanupErr) {
          console.error("Cleanup error:", cleanupErr);
        }
      }
    };
  }, [diagram]);

  const handleReset = () => {
    if (boardRef.current) {
      boardRef.current.setBoundingBox(diagram.board.boundingbox);
    }
  };

  if (error) {
    return (
      <div className="diagram-error">
        <AlertCircle className="error-icon" />
        <p>Unable to display diagram: {error}</p>
      </div>
    );
  }

  return (
    <div className={`diagram-container ${className}`}>
      {diagram.title && (
        <div className="diagram-header">
          <h4>{diagram.title}</h4>
          {diagram.description && <p>{diagram.description}</p>}
        </div>
      )}

      <div
        ref={containerRef}
        className="jsxgraph-board"
        style={{ width: "100%", height: `${height}px` }}
        aria-label={diagram.description || diagram.title || "Interactive diagram"}
      />

      <div className="diagram-controls">
        {showMetrics && (
          <div className="diagram-metrics">
            Rendered {elementCount} elements in {renderTime.toFixed(2)}ms
          </div>
        )}
        <button
          onClick={handleReset}
          className="reset-button"
          aria-label="Reset diagram view"
        >
          Reset View
        </button>
      </div>
    </div>
  );
});

DiagramRenderer.displayName = "DiagramRenderer";

// Helper: Create function with board closure
function createFunctionWithClosure(funcString: string, board: any): Function {
  const funcBody = funcString.substring(6).trim(); // Remove "() => "

  if (funcBody.startsWith("{")) {
    // Block statement
    return (function (boardRef) {
      const board = boardRef;
      return eval(`(function() ${funcBody})`);
    })(board);
  } else {
    // Expression
    return (function (boardRef) {
      const board = boardRef;
      return eval(`(function() { return ${funcBody}; })`);
    })(board);
  }
}
```

---

## Appendix B: Backend Integration Example

```python
# langgraph-agent/src/agent/diagram_generator.py

from typing import Optional, Dict, Any
from langchain_core.messages import AIMessage, ToolCall

class DiagramGenerator:
    """Generate JSXGraph diagram configurations for lesson cards."""

    @staticmethod
    def generate_pythagorean_diagram(a: float = 3, b: float = 4) -> Dict[str, Any]:
        """Generate a Pythagorean theorem diagram with given leg lengths."""
        return {
            "board": {
                "boundingbox": [-1, b + 2, a + 2, -1],
                "axis": True,
                "grid": True,
                "keepAspectRatio": True
            },
            "elements": [
                {
                    "type": "point",
                    "args": [0, 0],
                    "attributes": {"name": "A", "fixed": True, "size": 5, "fillColor": "#333"},
                    "id": "pointA"
                },
                {
                    "type": "point",
                    "args": [a, 0],
                    "attributes": {"name": "B", "size": 5, "fillColor": "#0066cc"},
                    "id": "pointB"
                },
                {
                    "type": "point",
                    "args": [0, b],
                    "attributes": {"name": "C", "size": 5, "fillColor": "#0066cc"},
                    "id": "pointC"
                },
                {
                    "type": "polygon",
                    "args": [["A", "B", "C"]],
                    "attributes": {
                        "fillColor": "#ffeecc",
                        "fillOpacity": 0.4,
                        "borders": {"strokeColor": "#cc6600", "strokeWidth": 3}
                    }
                },
                {
                    "type": "angle",
                    "args": [["B", "A", "C"]],
                    "attributes": {"type": "square", "size": 20, "fillColor": "#cccccc"}
                },
                {
                    "type": "text",
                    "args": [
                        a / 2, -0.4,
                        f"() => `a = ${{board.select('B').X().toFixed(1)}}`"
                    ],
                    "attributes": {"fontSize": 14, "color": "#cc6600", "anchorX": "middle"}
                },
                {
                    "type": "text",
                    "args": [
                        -0.5, b / 2,
                        f"() => `b = ${{board.select('C').Y().toFixed(1)}}`"
                    ],
                    "attributes": {"fontSize": 14, "color": "#cc6600", "anchorY": "middle"}
                },
                {
                    "type": "text",
                    "args": [
                        a + 0.5, b + 1,
                        "() => { const B = board.select('B'); const C = board.select('C'); const a = B.X(); const b = C.Y(); const c = Math.sqrt(a*a + b*b); return `${a.toFixed(1)}² + ${b.toFixed(1)}² = ${c.toFixed(2)}²`; }"
                    ],
                    "attributes": {"fontSize": 16, "color": "#006600", "cssStyle": "font-weight: bold;"}
                }
            ],
            "title": "Pythagorean Theorem: a² + b² = c²",
            "description": "Drag points B and C to explore the relationship."
        }

    @staticmethod
    def create_lesson_card_with_diagram(
        title: str,
        content: str,
        diagram: Optional[Dict[str, Any]] = None
    ) -> ToolCall:
        """Create a lesson card tool call with optional diagram."""
        card_args = {
            "title": title,
            "content": content
        }

        # Add diagram if provided
        if diagram:
            card_args["diagram"] = diagram

        return ToolCall(
            name="LessonCardPresentationTool",
            args=card_args,
            id=f"card_{hash(title)}"
        )

# Usage in teaching agent
def present_pythagorean_lesson(state):
    """Present Pythagorean theorem lesson with interactive diagram."""

    # Generate diagram
    diagram = DiagramGenerator.generate_pythagorean_diagram(a=3, b=4)

    # Create lesson card
    tool_call = DiagramGenerator.create_lesson_card_with_diagram(
        title="Understanding the Pythagorean Theorem",
        content="""
The Pythagorean theorem states that in a right triangle,
the square of the hypotenuse (c) equals the sum of squares
of the other two sides: **a² + b² = c²**

Use the interactive diagram below to explore this relationship
by dragging points B and C.
        """,
        diagram=diagram
    )

    return {
        "messages": [AIMessage(content="", tool_calls=[tool_call])]
    }
```

---

## Document Version

- **Version**: 1.0
- **Date**: 2025-01-10
- **Author**: Based on diagram-prototypes experiment
- **Status**: Ready for Implementation

---

**★ Insight ─────────────────────────────────────**
This design document captures ALL critical patterns discovered during prototyping:
- JSXGraph initialization anti-patterns (string IDs → hydration errors)
- Function evaluation gotchas (new Function → eval with closure)
- Array flattening necessity (polygon structure requirements)
- JessieCode vs ES6 syntax (functiongraph limitation)

The document is immediately actionable for implementation teams!
**─────────────────────────────────────────────────**
