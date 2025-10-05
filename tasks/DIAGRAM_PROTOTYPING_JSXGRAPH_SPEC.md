# Plan: JSON-Driven JSXGraph Prototyping Environment

## Overview
Create a separate Next.js prototyping environment to validate JSON-driven interactive diagrams for eventual integration into LessonCardPresentationTool. Focus on JSXGraph with declarative JSON configuration that AI backends can easily generate.

## Phase 1: Prototyping Environment Setup

### 1.1 Create Standalone Next.js App
```bash
# From project root
npx create-next-app@latest diagram-prototypes --typescript --tailwind --app
cd diagram-prototypes
```

**Configuration:**
- **Location**: `ScottishAILessons/diagram-prototypes/`
- **Port**: 3005 (avoid conflicts with ports 3000/3001/3002)
- **TypeScript**: Yes (for type-safe JSON schemas)
- **Tailwind CSS**: Yes (consistent styling with main app)
- **App Router**: Yes

### 1.2 Install JSXGraph (No Wrapper Libraries)
```bash
npm install jsxgraph
```

**Note**: `@types/jsxgraph` doesn't exist in npm registry. We provide custom type declarations in `types/jsxgraph.d.ts`.

**Why Direct JSXGraph:**
- ✅ No wrapper library needed - direct API is simpler
- ✅ Full control over JSON-to-element conversion
- ✅ Lighter bundle size
- ✅ Custom TypeScript types for better IDE support

### 1.3 Create Startup Script
**File**: `diagram-prototypes/start-prototypes.sh`
```bash
#!/bin/bash

echo "🎨 Starting Diagram Prototyping Environment..."
echo "============================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Start dev server on port 3005
echo -e "${GREEN}🚀 Starting prototype server on port 3005...${NC}"
PORT=3005 npm run dev &

# Wait for server
sleep 3
echo -e "${GREEN}✅ Prototype environment ready!${NC}"
echo -e "${GREEN}📍 http://localhost:3005${NC}"

# Open browser (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3005
fi

wait
```

Make executable: `chmod +x diagram-prototypes/start-prototypes.sh`

## Phase 2: JSON-Driven JSXGraph Architecture

### 2.1 Directory Structure
```
diagram-prototypes/
├── app/
│   ├── page.tsx                          # Landing page
│   ├── layout.tsx                        # Root layout
│   ├── examples/
│   │   ├── pythagorean/page.tsx         # Pythagorean theorem
│   │   ├── circles/page.tsx             # Interactive circles
│   │   ├── functions/page.tsx           # Function graphs
│   │   └── geometry/page.tsx            # General geometry
│   └── api/
│       └── generate-diagram/route.ts     # Mock AI backend
├── components/
│   ├── tools/
│   │   └── JSXGraphTool.tsx             # Main tool component (from feasibility analysis)
│   ├── examples/
│   │   ├── PythagoreanExample.tsx       # Pythagorean diagram
│   │   ├── CircleExample.tsx            # Circle diagrams
│   │   └── FunctionExample.tsx          # Function plotting
│   └── ui/
│       ├── DiagramCard.tsx              # Wrapper card component
│       └── CodePreview.tsx              # Show JSON code
├── lib/
│   ├── diagram-schemas.ts                # TypeScript types for JSON
│   ├── example-diagrams.ts               # Predefined JSON examples
│   └── ai-generator-mock.ts              # Mock AI diagram generation
├── public/
│   └── examples/                         # Static example JSON files
└── README.md                             # Prototype documentation
```

### 2.2 TypeScript Schema Definitions
**File**: `lib/diagram-schemas.ts`
```typescript
// Core JSON schema types for JSXGraph diagrams

export type JSXGraphElement = {
  type: string;              // "point", "line", "circle", "polygon", "functiongraph", etc.
  args: any[];               // JSXGraph create() arguments
  attributes?: Record<string, any>;
  id?: string;               // Optional ID for element references
};

export type JSXGraphBoardConfig = {
  boundingbox: [number, number, number, number];
  axis?: boolean;
  showCopyright?: boolean;
  showNavigation?: boolean;
  keepAspectRatio?: boolean;
  grid?: boolean;
  pan?: { enabled?: boolean };
  zoom?: { enabled?: boolean };
};

export type JSXGraphDiagram = {
  board: JSXGraphBoardConfig;
  elements: JSXGraphElement[];
  title?: string;
  description?: string;
  metadata?: {
    subject?: string;           // "geometry", "algebra", "calculus"
    difficulty?: string;        // "easy", "medium", "hard"
    interactivity?: string;     // "static", "draggable", "animated"
    learningObjective?: string;
  };
};

// Validation helper
export function validateDiagram(diagram: any): diagram is JSXGraphDiagram {
  return (
    diagram &&
    diagram.board &&
    Array.isArray(diagram.board.boundingbox) &&
    Array.isArray(diagram.elements)
  );
}
```

### 2.3 Enhanced JSXGraphTool Component
**File**: `components/tools/JSXGraphTool.tsx`

(Use the production-ready component from feasibility analysis with these additions:)

```typescript
// Add these features:
// 1. JSON validation before rendering
// 2. Error boundaries for element creation
// 3. Interactive controls (reset, export state)
// 4. Performance monitoring
// 5. Accessibility labels

// Additional features to add:
const [renderTime, setRenderTime] = useState<number>(0);
const [elementCount, setElementCount] = useState<number>(0);

// Before creating elements:
const startTime = performance.now();
// ... create elements ...
const endTime = performance.now();
setRenderTime(endTime - startTime);
setElementCount(args.elements.length);

// Add performance stats display:
<div className="text-xs text-gray-500 mt-2">
  Rendered {elementCount} elements in {renderTime.toFixed(2)}ms
</div>
```

### 2.4 Example Diagram Library
**File**: `lib/example-diagrams.ts`
```typescript
import { JSXGraphDiagram } from './diagram-schemas';

export const PYTHAGOREAN_THEOREM: JSXGraphDiagram = {
  title: "Pythagorean Theorem: a² + b² = c²",
  description: "Interactive right triangle. Drag points B and C to explore the relationship.",
  metadata: {
    subject: "geometry",
    difficulty: "medium",
    interactivity: "draggable",
    learningObjective: "Understand Pythagorean theorem through visual proof"
  },
  board: {
    boundingbox: [-1, 6, 7, -1],
    axis: true,
    showCopyright: false,
    grid: true,
    keepAspectRatio: true
  },
  elements: [
    {
      type: "point",
      args: [0, 0],
      attributes: { name: "A", fixed: true, size: 5, fillColor: "#333", strokeColor: "#333" },
      id: "pointA"
    },
    {
      type: "point",
      args: [3, 0],
      attributes: { name: "B", size: 5, fillColor: "#0066cc", strokeColor: "#0066cc" },
      id: "pointB"
    },
    {
      type: "point",
      args: [0, 4],
      attributes: { name: "C", size: 5, fillColor: "#0066cc", strokeColor: "#0066cc" },
      id: "pointC"
    },
    {
      type: "polygon",
      args: [["A", "B", "C"]],
      attributes: {
        fillColor: "#ffeecc",
        fillOpacity: 0.4,
        borders: { strokeColor: "#cc6600", strokeWidth: 3 }
      }
    },
    {
      type: "angle",
      args: [["B", "A", "C"]],
      attributes: { type: "square", size: 20, fillColor: "#cccccc", fillOpacity: 0.5 }
    },
    {
      type: "text",
      args: [1.5, -0.4, "() => `a = ${board.select('B').X().toFixed(1)}`"],
      attributes: { fontSize: 14, color: "#cc6600", anchorX: "middle" }
    },
    {
      type: "text",
      args: [-0.5, 2, "() => `b = ${board.select('C').Y().toFixed(1)}`"],
      attributes: { fontSize: 14, color: "#cc6600", anchorY: "middle" }
    },
    {
      type: "text",
      args: [
        3.5,
        5,
        "() => { const B = board.select('B'); const C = board.select('C'); const a = B.X(); const b = C.Y(); const c = Math.sqrt(a*a + b*b); return `${a.toFixed(1)}² + ${b.toFixed(1)}² = ${c.toFixed(2)}²\\n${(a*a).toFixed(1)} + ${(b*b).toFixed(1)} = ${(c*c).toFixed(2)}`; }"
      ],
      attributes: {
        fontSize: 16,
        color: "#006600",
        cssStyle: "font-family: monospace; white-space: pre; font-weight: bold;"
      }
    }
  ]
};

export const INTERACTIVE_CIRCLE: JSXGraphDiagram = {
  title: "Interactive Circle",
  description: "Drag the radius point to change the circle size.",
  board: {
    boundingbox: [-6, 6, 6, -6],
    axis: true,
    showCopyright: false,
    keepAspectRatio: true
  },
  elements: [
    {
      type: "point",
      args: [0, 0],
      attributes: { name: "O", fixed: true, size: 4, fillColor: "#cc0000" },
      id: "center"
    },
    {
      type: "point",
      args: [3, 0],
      attributes: { name: "R", size: 4, fillColor: "#0066cc" },
      id: "radiusPoint"
    },
    {
      type: "circle",
      args: ["center", "radiusPoint"],
      attributes: {
        strokeColor: "#0066cc",
        strokeWidth: 2,
        fillColor: "#cce6ff",
        fillOpacity: 0.2
      }
    },
    {
      type: "segment",
      args: ["center", "radiusPoint"],
      attributes: { strokeColor: "#cc6600", strokeWidth: 2, dash: 2 }
    },
    {
      type: "text",
      args: [
        0,
        -5,
        "() => { const r = board.select('radiusPoint').Dist(board.select('center')); return `Radius: ${r.toFixed(2)}\\nArea: ${(Math.PI * r * r).toFixed(2)}\\nCircumference: ${(2 * Math.PI * r).toFixed(2)}`; }"
      ],
      attributes: {
        fontSize: 14,
        anchorX: "middle",
        cssStyle: "white-space: pre; text-align: center;"
      }
    }
  ]
};

export const QUADRATIC_FUNCTION: JSXGraphDiagram = {
  title: "Quadratic Function: f(x) = x²",
  description: "Interactive parabola with vertex and axis of symmetry.",
  board: {
    boundingbox: [-8, 12, 8, -2],
    axis: true,
    showCopyright: false
  },
  elements: [
    {
      type: "functiongraph",
      args: ["(x) => x * x", -6, 6],
      attributes: { strokeColor: "#cc00cc", strokeWidth: 3 }
    },
    {
      type: "point",
      args: [0, 0],
      attributes: { name: "Vertex", fixed: true, size: 5, fillColor: "#cc0000" }
    },
    {
      type: "line",
      args: [[0, -2], [0, 12]],
      attributes: { strokeColor: "#999999", strokeWidth: 1, dash: 2 }
    },
    {
      type: "text",
      args: [-6, 10, "f(x) = x²"],
      attributes: { fontSize: 20, color: "#cc00cc", cssStyle: "font-weight: bold;" }
    }
  ]
};

// Export all examples
export const ALL_EXAMPLES = {
  pythagorean: PYTHAGOREAN_THEOREM,
  circle: INTERACTIVE_CIRCLE,
  quadratic: QUADRATIC_FUNCTION
};
```

## Phase 3: Example Pages & Showcase

### 3.1 Landing Page with Tool Comparison
**File**: `app/page.tsx`
```typescript
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function HomePage() {
  const examples = [
    {
      title: "Pythagorean Theorem",
      description: "Interactive right triangle demonstrating a² + b² = c²",
      href: "/examples/pythagorean",
      status: "✅ Working",
      complexity: "Medium"
    },
    {
      title: "Interactive Circles",
      description: "Draggable circle with dynamic radius, area, and circumference",
      href: "/examples/circles",
      status: "✅ Working",
      complexity: "Easy"
    },
    {
      title: "Function Graphs",
      description: "Quadratic, trigonometric, and custom function plotting",
      href: "/examples/functions",
      status: "✅ Working",
      complexity: "Medium"
    },
    {
      title: "General Geometry",
      description: "Polygons, angles, transformations, and constructions",
      href: "/examples/geometry",
      status: "🔜 Planned",
      complexity: "Hard"
    }
  ];

  return (
    <main className="container mx-auto p-8 max-w-6xl">
      <header className="mb-12">
        <h1 className="text-4xl font-bold mb-4">
          🎨 Interactive Diagram Prototyping Lab
        </h1>
        <p className="text-lg text-gray-600">
          JSON-driven JSXGraph diagrams for AI-generated lesson content
        </p>
      </header>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Approach: Declarative JSON</h2>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded">
          <p className="mb-2">
            <strong>Key Innovation:</strong> AI backends generate structured JSON that maps
            directly to JSXGraph's API, no code generation required.
          </p>
          <code className="text-sm bg-white p-2 rounded block mt-3">
            {`{ "type": "point", "args": [0, 0], "attributes": { "name": "A" } }`}
          </code>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-6">Examples</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {examples.map((example) => (
            <Link key={example.href} href={example.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <CardTitle>{example.title}</CardTitle>
                    <span className="text-sm">{example.status}</span>
                  </div>
                  <CardDescription>{example.description}</CardDescription>
                  <div className="mt-3 text-xs text-gray-500">
                    Complexity: {example.complexity}
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12 p-6 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="font-semibold mb-2">🎯 Future Tools (Comparison Planned)</h3>
        <ul className="space-y-1 text-sm">
          <li>• <strong>GeoGebra</strong> - Comprehensive math software (heavier, feature-rich)</li>
          <li>• <strong>Asymptote</strong> - LaTeX-quality vector graphics (server-side)</li>
          <li>• <strong>Manim</strong> - Mathematical animations (Python-based)</li>
        </ul>
      </section>
    </main>
  );
}
```

### 3.2 Pythagorean Example Page
**File**: `app/examples/pythagorean/page.tsx`
```typescript
"use client";

import { JSXGraphTool } from '@/components/tools/JSXGraphTool';
import { PYTHAGOREAN_THEOREM } from '@/lib/example-diagrams';
import { CodePreview } from '@/components/ui/CodePreview';

export default function PythagoreanPage() {
  return (
    <div className="container mx-auto p-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6">Pythagorean Theorem Prototype</h1>

      {/* Render the diagram */}
      <JSXGraphTool
        args={PYTHAGOREAN_THEOREM}
        status={{ type: "complete" }}
      />

      {/* Show JSON code */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">JSON Configuration</h2>
        <CodePreview
          code={JSON.stringify(PYTHAGOREAN_THEOREM, null, 2)}
          language="json"
        />
      </div>

      {/* Educational context */}
      <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded">
        <h3 className="font-semibold mb-2">Learning Objectives</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li>Understand the Pythagorean theorem: a² + b² = c²</li>
          <li>Visualize how the theorem holds for any right triangle</li>
          <li>Explore the relationship by dragging points interactively</li>
        </ul>
      </div>
    </div>
  );
}
```

## Phase 4: Mock AI Backend Integration

### 4.1 Mock Diagram Generator
**File**: `lib/ai-generator-mock.ts`
```typescript
import { JSXGraphDiagram } from './diagram-schemas';

/**
 * Simulates how an AI backend would generate diagram JSON
 * based on lesson content and learning objectives.
 */
export function generateDiagramFromPrompt(prompt: string): JSXGraphDiagram {
  // Simple keyword matching (real AI would use LLM)
  if (prompt.toLowerCase().includes("pythagorean")) {
    return generatePythagoreanTheorem();
  } else if (prompt.toLowerCase().includes("circle")) {
    return generateCircleDiagram();
  } else if (prompt.toLowerCase().includes("quadratic") || prompt.toLowerCase().includes("parabola")) {
    return generateQuadraticFunction();
  }

  // Default: simple coordinate plane
  return {
    title: "Coordinate Plane",
    board: { boundingbox: [-10, 10, 10, -10], axis: true },
    elements: []
  };
}

function generatePythagoreanTheorem(a: number = 3, b: number = 4): JSXGraphDiagram {
  const c = Math.sqrt(a * a + b * b);

  return {
    title: `Pythagorean Theorem: ${a}² + ${b}² = ${c.toFixed(2)}²`,
    description: "Drag points to explore different right triangles.",
    metadata: {
      subject: "geometry",
      difficulty: "medium",
      interactivity: "draggable"
    },
    board: {
      boundingbox: [-1, Math.max(a, b) + 2, Math.max(a, b) + 2, -1],
      axis: true,
      showCopyright: false,
      keepAspectRatio: true
    },
    elements: [
      // ... (use PYTHAGOREAN_THEOREM elements)
    ]
  };
}

// Similar for other diagram types...
```

### 4.2 API Route for Backend Simulation
**File**: `app/api/generate-diagram/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateDiagramFromPrompt } from '@/lib/ai-generator-mock';

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();

  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 500));

  const diagram = generateDiagramFromPrompt(prompt);

  return NextResponse.json({
    success: true,
    diagram,
    metadata: {
      generatedAt: new Date().toISOString(),
      processingTime: "500ms"
    }
  });
}
```

## Phase 5: Testing & Validation

### 5.1 Performance Benchmarks
Create test page: `app/examples/performance/page.tsx`
- Render 10+ diagrams simultaneously
- Measure render time per diagram
- Test with 50+ elements per diagram
- Memory usage monitoring

### 5.2 Browser Compatibility
Test matrix:
- ✅ Chrome/Edge (latest)
- ✅ Safari (latest)
- ✅ Firefox (latest)
- ✅ Mobile Safari (iOS)
- ✅ Chrome Mobile (Android)

### 5.3 Accessibility Testing
- Keyboard navigation
- Screen reader compatibility
- Color contrast ratios
- Focus indicators

## Phase 6: Documentation

### 6.1 Update Project README.md
**File**: `README.md` (in project root)

Add after "Project Structure" section:

```markdown
## 🎨 Interactive Diagram Prototyping Environment

A separate Next.js application for prototyping **JSON-driven interactive diagrams** before integrating into the main lesson delivery system.

### Purpose
- ✅ Validate **declarative JSON approach** for AI-generated diagrams
- ✅ Test JSXGraph performance and UX patterns
- ✅ Build component library for LessonCardPresentationTool integration
- ✅ Compare diagram tools (JSXGraph, GeoGebra, Asymptote, Manim)
- ✅ Isolated environment - no production code pollution

### Key Innovation: AI-Friendly JSON Format

Instead of generating JavaScript code, the AI backend generates structured JSON:

```json
{
  "board": { "boundingbox": [-5, 5, 5, -5], "axis": true },
  "elements": [
    { "type": "point", "args": [0, 0], "attributes": { "name": "A" } },
    { "type": "circle", "args": ["A", 3], "attributes": { "fillColor": "#ccf" } }
  ]
}
```

This maps directly to JSXGraph's `board.create(type, args, attributes)` API.

### Quick Start

```bash
cd diagram-prototypes
./start-prototypes.sh
# Opens http://localhost:3005
```

### Current Examples

✅ **Pythagorean Theorem** - Interactive right triangle with dynamic calculations
✅ **Interactive Circles** - Draggable radius with live area/circumference
✅ **Function Graphs** - Quadratic, trigonometric, and custom functions
🔜 **General Geometry** - Polygons, transformations, constructions

### Architecture

```
diagram-prototypes/
├── components/tools/JSXGraphTool.tsx    # Main rendering component
├── lib/diagram-schemas.ts               # TypeScript JSON schemas
├── lib/example-diagrams.ts              # Predefined examples
└── app/examples/                        # Live demonstrations
```

### Integration Roadmap

1. **Phase 1** (Current): Prototype JSON-driven diagrams in isolation
2. **Phase 2**: Extract stable JSXGraphTool component
3. **Phase 3**: Add tool call support to backend (LangGraph)
4. **Phase 4**: Integrate into LessonCardPresentationTool
5. **Phase 5**: Evaluate alternative tools (GeoGebra, etc.)

### Backend Tool Call Example

```python
# LangGraph backend generates JSON tool call
tool_call = ToolCall(
    name="jsxgraph_plot",
    args={
        "title": "Pythagorean Theorem",
        "board": {"boundingbox": [-1, 6, 7, -1], "axis": True},
        "elements": [
            {"type": "point", "args": [0, 0], "attributes": {"name": "A"}},
            {"type": "point", "args": [3, 0], "attributes": {"name": "B"}},
            {"type": "polygon", "args": [["A", "B", "C"]]}
        ]
    }
)
```

### Performance Targets

- ✅ Render time: <100ms for 10-element diagrams
- ✅ Interactive latency: <16ms (60fps)
- ✅ Bundle size: <150KB (JSXGraph + component)
- ✅ Mobile support: Full touch interaction
```

### 6.2 Create Prototypes README
**File**: `diagram-prototypes/README.md`

```markdown
# Interactive Diagram Prototyping Lab

JSON-driven JSXGraph diagrams for AI-generated educational content.

## Setup

```bash
npm install
./start-prototypes.sh
```

## Project Structure

- `components/tools/JSXGraphTool.tsx` - Main rendering component
- `lib/diagram-schemas.ts` - TypeScript schemas for JSON validation
- `lib/example-diagrams.ts` - Predefined diagram library
- `app/examples/` - Live example pages

## Creating New Diagrams

1. Define JSON in `lib/example-diagrams.ts`:
```typescript
export const MY_DIAGRAM: JSXGraphDiagram = {
  title: "My Diagram",
  board: { boundingbox: [-5, 5, 5, -5], axis: true },
  elements: [
    { type: "point", args: [0, 0], attributes: { name: "Origin" } }
  ]
};
```

2. Create example page in `app/examples/my-diagram/page.tsx`
3. Import and render with `<JSXGraphTool args={MY_DIAGRAM} />`

## Supported Element Types

| Type | Args | Example |
|------|------|---------|
| `point` | `[x, y]` | Coordinates, vertices |
| `line` | `[point1, point2]` | Connections |
| `circle` | `[center, radius]` | Shapes |
| `polygon` | `[[p1, p2, p3]]` | Triangles |
| `functiongraph` | `["(x) => x*x", -5, 5]` | Math functions |
| `text` | `[x, y, "label"]` | Annotations |

[Full element reference](https://jsxgraph.uni-bayreuth.de/docs/symbols/JXG.Board.html)

## Integration Checklist

Before integrating into main app:
- [ ] Performance validated (<100ms render)
- [ ] Accessibility tested (keyboard, screen readers)
- [ ] Mobile support confirmed
- [ ] Error handling robust
- [ ] TypeScript schemas complete
- [ ] Documentation clear
```

## Success Criteria

### Immediate (Weeks 1-2)
- ✅ Standalone Next.js app running on port 3005
- ✅ JSXGraphTool component working with JSON input
- ✅ 3+ example diagrams functional (Pythagorean, circle, function)
- ✅ JSON schemas and TypeScript types defined
- ✅ Performance acceptable (<100ms render time)

### Short-term (Weeks 3-4)
- ✅ Mock AI backend generating diagrams from prompts
- ✅ Error handling and validation robust
- ✅ Documentation complete and clear
- ✅ Browser compatibility verified
- ✅ Mobile/tablet support working

### Long-term (Month 2+)
- ✅ Integration path to main frontend defined
- ✅ Backend tool call specification finalized
- ✅ 10+ example diagrams in library
- ✅ Alternative tools evaluated (GeoGebra comparison)

## File Changes Summary

**CREATE** (New files):
- `diagram-prototypes/` - Entire new Next.js app
- `diagram-prototypes/components/tools/JSXGraphTool.tsx`
- `diagram-prototypes/lib/diagram-schemas.ts`
- `diagram-prototypes/lib/example-diagrams.ts`
- `diagram-prototypes/lib/ai-generator-mock.ts`
- `diagram-prototypes/app/page.tsx`
- `diagram-prototypes/app/examples/pythagorean/page.tsx`
- `diagram-prototypes/app/examples/circles/page.tsx`
- `diagram-prototypes/app/examples/functions/page.tsx`
- `diagram-prototypes/app/api/generate-diagram/route.ts`
- `diagram-prototypes/start-prototypes.sh`
- `diagram-prototypes/README.md`

**UPDATE** (Existing files):
- `README.md` - Add "Interactive Diagram Prototyping Environment" section

## Dependencies

```json
{
  "dependencies": {
    "jsxgraph": "^1.11.1",
    "next": "^14.2.18",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.5"
  },
  "devDependencies": {
    "@types/node": "^20.17.6",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "eslint": "^8",
    "eslint-config-next": "14.2.18",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.6.3"
  }
}
```

**Note**: Custom TypeScript declarations for JSXGraph are provided in `types/jsxgraph.d.ts` since `@types/jsxgraph` doesn't exist in the npm registry.

## Next Steps After Approval

1. Create Next.js app with TypeScript + Tailwind
2. Install JSXGraph (direct, no wrappers)
3. Implement JSXGraphTool component with JSON parser
4. Create TypeScript schemas for validation
5. Build example diagram library (Pythagorean, circles, functions)
6. Create example showcase pages
7. Add mock AI backend for diagram generation
8. Write comprehensive documentation
9. Test performance and browser compatibility
10. Plan integration into LessonCardPresentationTool
