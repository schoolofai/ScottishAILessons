# Multi-Tool Mathematical Diagram Rendering Service

## Specification Document v1.1 - OCP Compliant

**CRITICAL: Open-Close Principle Compliance**

This specification follows the Open-Close Principle (OCP): the system is **OPEN for extension** (adding new renderers) but **CLOSED for modification** (existing code must NOT be changed).

---

## 1. Executive Summary

This specification extends the existing DiagramScreenshot service to support multiple mathematical visualization tools: JSXGraph (existing), Desmos, GeoGebra, Plotly, and Gemini Imagen for real-world context images.

**Key Constraint**: The existing `/api/v1/render` endpoint and all its supporting code MUST remain completely unchanged. New functionality is added via NEW files and NEW endpoints only.

---

## 2. OCP Compliance Rules

### 2.1 Files That MUST NOT Be Modified (FROZEN)

These files contain the existing working implementation. **DO NOT MODIFY THESE FILES**:

```
src/
├── index.ts                      # FROZEN - Application entry point
├── routes/
│   ├── render.ts                 # FROZEN - Existing POST /api/v1/render
│   └── health.ts                 # EXTEND ONLY (add new checks)
├── services/
│   ├── renderer.ts               # FROZEN - DiagramRenderer class
│   └── validator.ts              # FROZEN - Existing JSXGraph validation
├── utils/
│   ├── html-generator.ts         # FROZEN - JSXGraph HTML generation
│   └── error-handler.ts          # FROZEN - Error handling
├── types/
│   └── diagram.ts                # FROZEN - JSXGraph types
└── middleware/
    └── auth.ts                   # SHARED - Can be reused, not modified
```

### 2.2 Files That Can Be Extended (Minimal Changes)

```
src/
├── index.ts                      # Add new route imports and registrations ONLY
└── routes/
    └── health.ts                 # Add new health checks (append only)
```

### 2.3 New Files to Create

All new functionality goes in NEW files:

```
src/
├── routes/
│   ├── desmos.routes.ts          # NEW - POST /api/v1/render/desmos
│   ├── geogebra.routes.ts        # NEW - POST /api/v1/render/geogebra
│   ├── plotly.routes.ts          # NEW - POST /api/v1/render/plotly
│   └── imagen.routes.ts          # NEW - POST /api/v1/render/imagen
│
├── schemas/
│   ├── common.schema.ts          # NEW - Shared validation components
│   ├── desmos.schema.ts          # NEW - Desmos request validation
│   ├── geogebra.schema.ts        # NEW - GeoGebra request validation
│   ├── plotly.schema.ts          # NEW - Plotly request validation
│   └── imagen.schema.ts          # NEW - Imagen request validation
│
├── services/
│   ├── browser.service.ts        # NEW - Shared browser for NEW renderers
│   ├── renderer.interface.ts     # NEW - Abstract renderer interface
│   ├── renderer.factory.ts       # NEW - Factory for NEW renderers only
│   │
│   ├── renderers/
│   │   ├── desmos.renderer.ts    # NEW - Desmos implementation
│   │   ├── geogebra.renderer.ts  # NEW - GeoGebra implementation
│   │   └── plotly.renderer.ts    # NEW - Plotly implementation
│   │
│   └── clients/
│       └── imagen.client.ts      # NEW - Gemini Imagen API client
│
├── generators/
│   ├── base.generator.ts         # NEW - Shared HTML utilities
│   ├── desmos.generator.ts       # NEW - Desmos HTML generation
│   ├── geogebra.generator.ts     # NEW - GeoGebra HTML generation
│   └── plotly.generator.ts       # NEW - Plotly HTML generation
│
└── types/
    ├── common.types.ts           # NEW - Shared type definitions
    ├── desmos.types.ts           # NEW
    ├── geogebra.types.ts         # NEW
    ├── plotly.types.ts           # NEW
    └── imagen.types.ts           # NEW
```

---

## 3. Architecture Overview

### 3.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        Mathematical Diagram Rendering Service                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌──────────┐    ┌───────────┐    ┌──────────────────────────────────────────────┐ │
│   │  Client  │───▶│  Express  │───▶│                   Routes                     │ │
│   │  Request │    │  Server   │    │                                              │ │
│   └──────────┘    └───────────┘    │  /api/v1/render (FROZEN - JSXGraph)          │ │
│                                    │  /api/v1/render/desmos (NEW)                  │ │
│                                    │  /api/v1/render/geogebra (NEW)                │ │
│                                    │  /api/v1/render/plotly (NEW)                  │ │
│                                    │  /api/v1/render/imagen (NEW)                  │ │
│                                    └──────────────────────────────────────────────┘ │
│                                                        │                            │
│   ┌────────────────────────────────────────────────────┼────────────────────────┐   │
│   │                                                    │                        │   │
│   │  ┌────────────────────┐   ┌────────────────────────┴──────────────────────┐ │   │
│   │  │                    │   │                                               │ │   │
│   │  │  DiagramRenderer   │   │              NEW Renderers                    │ │   │
│   │  │  (FROZEN)          │   │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │ │   │
│   │  │                    │   │  │ Desmos │ │GeoGebra│ │ Plotly │ │ Imagen │  │ │   │
│   │  │  - Own Browser     │   │  └───┬────┘ └───┬────┘ └───┬────┘ └────┬───┘  │ │   │
│   │  │  - JSXGraph Only   │   │      │          │          │           │      │ │   │
│   │  │                    │   │      └──────────┴──────────┘           │      │ │   │
│   │  └────────────────────┘   │                 │                      │      │ │   │
│   │                           │                 ▼                      ▼      │ │   │
│   │                           │      ┌─────────────────────┐  ┌─────────────┐ │ │   │
│   │                           │      │   BrowserService    │  │ Gemini API  │ │ │   │
│   │                           │      │   (NEW - Singleton) │  │ (External)  │ │ │   │
│   │                           │      └─────────────────────┘  └─────────────┘ │ │   │
│   │                           └───────────────────────────────────────────────┘ │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Key Architecture Decision**:
- The existing `DiagramRenderer` class keeps its own browser instance and is NOT modified
- NEW renderers share a NEW `BrowserService` singleton
- This ensures complete isolation and no regression risk

---

## 4. API Endpoints

### 4.1 Endpoint Overview

| Endpoint                      | Method | Status    | Description                     |
|-------------------------------|--------|-----------|--------------------------------|
| `/api/v1/render`              | POST   | FROZEN    | JSXGraph (existing, unchanged) |
| `/health`                     | GET    | EXTEND    | Service health check           |
| `/api/v1/render/desmos`       | POST   | NEW       | Render Desmos graph            |
| `/api/v1/render/geogebra`     | POST   | NEW       | Render GeoGebra construction   |
| `/api/v1/render/plotly`       | POST   | NEW       | Render Plotly chart            |
| `/api/v1/render/imagen`       | POST   | NEW       | Generate context image (Gemini)|

All endpoints require `X-API-Key` header for authentication.

---

### 4.2 Existing JSXGraph Endpoint (FROZEN)

```
POST /api/v1/render
```

**DO NOT CHANGE THIS ENDPOINT OR ITS IMPLEMENTATION**

The existing endpoint remains exactly as implemented, handling JSXGraph diagrams with the current request/response format.

---

### 4.3 Desmos Endpoint (NEW)

```
POST /api/v1/render/desmos
```

#### Request Schema

```typescript
interface DesmosRenderRequest {
  graph: {
    expressions: DesmosExpression[];
    settings?: DesmosSettings;
  };
  options?: RenderOptions;
}

interface DesmosExpression {
  id?: string;                    // Optional reference ID
  type: 'expression' | 'table' | 'text' | 'folder';

  // For type: 'expression'
  latex?: string;                 // e.g., "y = x^2 - 4x + 3"
  color?: string;                 // Hex color, e.g., "#2d70b3"
  lineStyle?: 'SOLID' | 'DASHED' | 'DOTTED';
  lineWidth?: number;             // 0.5 - 10
  pointStyle?: 'POINT' | 'OPEN' | 'CROSS';
  pointSize?: number;             // 1 - 20
  fillOpacity?: number;           // 0 - 1
  hidden?: boolean;

  // For type: 'table'
  columns?: Array<{
    latex: string;                // Column variable, e.g., "x_1"
    values: number[];
  }>;

  // For type: 'text'
  text?: string;

  // Point/label positioning
  showLabel?: boolean;
  label?: string;
  labelSize?: 'small' | 'medium' | 'large';
  labelOrientation?: 'above' | 'below' | 'left' | 'right' | 'default';

  // Sliders (auto-detected from latex like "a = 2")
  sliderBounds?: {
    min: number;
    max: number;
    step?: number;
  };
}

interface DesmosSettings {
  // Viewport
  xAxisLabel?: string;
  yAxisLabel?: string;
  xAxisStep?: number;
  yAxisStep?: number;
  xAxisMinorSubdivisions?: number;
  yAxisMinorSubdivisions?: number;

  // Bounds (alternative to expressions with viewport)
  viewport?: {
    xmin: number;
    xmax: number;
    ymin: number;
    ymax: number;
  };

  // Display
  showGrid?: boolean;             // Default: true
  showXAxis?: boolean;            // Default: true
  showYAxis?: boolean;            // Default: true
  xAxisNumbers?: boolean;         // Default: true
  yAxisNumbers?: boolean;         // Default: true
  polarMode?: boolean;            // Default: false
  degreeMode?: boolean;           // Default: false (radians)

  // Appearance
  backgroundColor?: string;
  textColor?: string;
  gridColor?: string;
  axisColor?: string;
}

interface RenderOptions {
  width?: number;                 // Default: 800, Range: 100-4000
  height?: number;                // Default: 600, Range: 100-4000
  format?: 'png' | 'jpeg';        // Default: 'png'
  quality?: number;               // Default: 90, Range: 1-100 (JPEG only)
  scale?: number;                 // Default: 2, Range: 1-4
  timeout?: number;               // Default: 15000, Range: 1000-60000
  returnFormat?: 'base64' | 'binary';  // Default: 'base64'
}
```

#### Example Request

```json
{
  "graph": {
    "expressions": [
      {
        "id": "parabola",
        "type": "expression",
        "latex": "y = x^2 - 4x + 3",
        "color": "#2d70b3",
        "lineWidth": 2.5
      },
      {
        "type": "expression",
        "latex": "(2, -1)",
        "color": "#c74440",
        "pointSize": 9,
        "showLabel": true,
        "label": "Turning Point"
      },
      {
        "type": "expression",
        "latex": "y = 0",
        "color": "#388c46",
        "lineStyle": "DASHED"
      }
    ],
    "settings": {
      "viewport": {
        "xmin": -2,
        "xmax": 6,
        "ymin": -3,
        "ymax": 5
      },
      "showGrid": true
    }
  },
  "options": {
    "width": 1000,
    "height": 700,
    "scale": 2
  }
}
```

#### Response

```json
{
  "success": true,
  "image": "base64-encoded-image-data",
  "metadata": {
    "tool": "desmos",
    "format": "png",
    "width": 1000,
    "height": 700,
    "sizeBytes": 45678,
    "renderTimeMs": 1200,
    "expressionCount": 3,
    "timestamp": "2024-01-15T12:30:00.000Z"
  }
}
```

---

### 4.4 GeoGebra Endpoint (NEW)

```
POST /api/v1/render/geogebra
```

#### Request Schema

```typescript
interface GeoGebraRenderRequest {
  construction: {
    commands: string[];           // GeoGebra commands in order
    settings?: GeoGebraSettings;
  };
  options?: RenderOptions;
}

interface GeoGebraSettings {
  // App type
  appType?: 'classic' | 'geometry' | 'graphing' | '3d';  // Default: 'classic'

  // Coordinate system
  showAxes?: boolean;             // Default: false for geometry
  showGrid?: boolean;             // Default: false

  // Viewport bounds (Classic/Graphing)
  xmin?: number;
  xmax?: number;
  ymin?: number;
  ymax?: number;

  // Display options
  enableLabelDrags?: boolean;     // Default: false
  showResetIcon?: boolean;        // Default: false

  // Styling
  bgColor?: string;               // Background color hex
  axesColor?: string;
  gridColor?: string;

  // Angle display
  angleUnit?: 'degree' | 'radian';  // Default: 'degree'

  // Labels
  labelingStyle?: 'automatic' | 'all' | 'allNew' | 'none';
}
```

#### GeoGebra Command Reference

The AI should generate standard GeoGebra commands:

```javascript
// Points
"A = (2, 3)"
"B = Point({4, 0})"

// Lines and Segments
"Segment(A, B)"
"Line(A, B)"
"Ray(A, B)"

// Circles
"Circle(A, 3)"              // Center A, radius 3
"Circle(A, B)"              // Center A, through B
"Semicircle(A, B)"

// Polygons
"Polygon(A, B, C)"          // Triangle
"Polygon(A, B, C, D)"       // Quadrilateral
"RegularPolygon(A, B, 6)"   // Hexagon

// Angles
"Angle(A, B, C)"            // Angle ABC
"Angle(A, B, C, D)"         // Angle between lines

// Perpendicular / Parallel
"PerpendicularLine(A, line)"
"PerpendicularBisector(A, B)"
"Parallel(A, line)"

// Midpoint / Intersection
"Midpoint(A, B)"
"Intersect(obj1, obj2)"

// Arcs and Sectors
"Arc(circle, A, B)"
"Sector(circle, A, B)"
"CircularArc(A, B, C)"      // Arc through 3 points

// Transformations
"Reflect(obj, line)"
"Rotate(obj, angle, center)"
"Translate(obj, vector)"
"Dilate(obj, factor, center)"

// Styling (applied after creation)
"SetColor(A, \"Red\")"
"SetPointSize(A, 5)"
"SetLineThickness(a, 3)"
"SetLineStyle(a, 2)"        // 0=solid, 1=dashed, 2=dotted
"SetFilling(poly, 0.3)"
"SetCaption(A, \"Point A\")"
"ShowLabel(A, true)"

// Circle theorems (common constructions)
"angleCentre = Angle(A, O, B)"
"angleCircum = Angle(A, C, B)"
```

#### Example Request

```json
{
  "construction": {
    "commands": [
      "O = (0, 0)",
      "c = Circle(O, 3)",
      "A = Point(c)",
      "B = Point(c)",
      "C = Point(c)",
      "segAO = Segment(A, O)",
      "segBO = Segment(B, O)",
      "segAC = Segment(A, C)",
      "segBC = Segment(B, C)",
      "angleCentre = Angle(A, O, B)",
      "angleCircum = Angle(A, C, B)",
      "SetColor(angleCentre, \"Blue\")",
      "SetColor(angleCircum, \"Red\")",
      "SetFilling(angleCentre, 0.3)",
      "SetFilling(angleCircum, 0.3)"
    ],
    "settings": {
      "appType": "geometry",
      "showAxes": false,
      "showGrid": false,
      "xmin": -5,
      "xmax": 5,
      "ymin": -5,
      "ymax": 5
    }
  },
  "options": {
    "width": 800,
    "height": 800,
    "scale": 2
  }
}
```

#### Response

```json
{
  "success": true,
  "image": "base64-encoded-image-data",
  "metadata": {
    "tool": "geogebra",
    "appType": "geometry",
    "format": "png",
    "width": 800,
    "height": 800,
    "sizeBytes": 34567,
    "renderTimeMs": 3500,
    "commandCount": 15,
    "timestamp": "2024-01-15T12:30:00.000Z"
  }
}
```

---

### 4.5 Plotly Endpoint (NEW)

```
POST /api/v1/render/plotly
```

#### Request Schema

```typescript
interface PlotlyRenderRequest {
  chart: {
    data: PlotlyTrace[];
    layout?: PlotlyLayout;
    config?: PlotlyConfig;
  };
  options?: RenderOptions;
}

// Standard Plotly.js trace format
interface PlotlyTrace {
  type: 'scatter' | 'bar' | 'pie' | 'histogram' | 'box' | 'heatmap' | 'line';

  // Data
  x?: (number | string)[];
  y?: number[];
  values?: number[];          // For pie charts
  labels?: string[];          // For pie charts

  // Appearance
  name?: string;              // Legend label
  mode?: 'lines' | 'markers' | 'lines+markers' | 'text' | 'none';

  marker?: {
    color?: string | string[];
    size?: number | number[];
    symbol?: string;
    line?: {
      color?: string;
      width?: number;
    };
  };

  line?: {
    color?: string;
    width?: number;
    dash?: 'solid' | 'dot' | 'dash' | 'dashdot';
  };

  // Text
  text?: string[];
  textposition?: 'inside' | 'outside' | 'auto' | 'none';

  // Box plot specific
  boxpoints?: 'all' | 'outliers' | 'suspectedoutliers' | false;

  // Histogram specific
  nbinsx?: number;
  histnorm?: '' | 'percent' | 'probability' | 'density';
}

interface PlotlyLayout {
  title?: string | { text: string; font?: object };

  xaxis?: {
    title?: string;
    range?: [number, number];
    showgrid?: boolean;
    zeroline?: boolean;
    dtick?: number;
    tickformat?: string;
    type?: 'linear' | 'log' | 'date' | 'category';
  };

  yaxis?: {
    title?: string;
    range?: [number, number];
    showgrid?: boolean;
    zeroline?: boolean;
    dtick?: number;
  };

  showlegend?: boolean;
  legend?: {
    x?: number;
    y?: number;
    orientation?: 'v' | 'h';
  };

  bargap?: number;            // 0-1 for bar charts
  bargroupgap?: number;

  paper_bgcolor?: string;
  plot_bgcolor?: string;

  font?: {
    family?: string;
    size?: number;
    color?: string;
  };

  margin?: {
    l?: number;
    r?: number;
    t?: number;
    b?: number;
  };

  annotations?: Array<{
    x: number;
    y: number;
    text: string;
    showarrow?: boolean;
    arrowhead?: number;
    font?: object;
  }>;
}

interface PlotlyConfig {
  staticPlot?: boolean;       // Default: true (for image export)
  displayModeBar?: boolean;   // Default: false
  responsive?: boolean;       // Default: false
}
```

#### Example Request: Bar Chart

```json
{
  "chart": {
    "data": [
      {
        "type": "bar",
        "x": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "y": [5, 8, 3, 9, 6],
        "marker": {
          "color": ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"]
        },
        "text": ["5", "8", "3", "9", "6"],
        "textposition": "outside"
      }
    ],
    "layout": {
      "title": "Daily Sales",
      "xaxis": { "title": "Day" },
      "yaxis": { "title": "Units Sold", "range": [0, 12] },
      "showlegend": false
    }
  },
  "options": {
    "width": 800,
    "height": 500
  }
}
```

#### Example Request: Box Plot

```json
{
  "chart": {
    "data": [
      {
        "type": "box",
        "y": [12, 15, 18, 22, 25, 28, 35, 14, 19, 24, 27, 31],
        "name": "Class A",
        "marker": { "color": "#3366cc" },
        "boxpoints": "all"
      },
      {
        "type": "box",
        "y": [10, 13, 16, 20, 23, 26, 29, 32, 17, 21],
        "name": "Class B",
        "marker": { "color": "#dc3912" },
        "boxpoints": "all"
      }
    ],
    "layout": {
      "title": "Test Score Distribution",
      "yaxis": { "title": "Score (%)" }
    }
  },
  "options": {
    "width": 700,
    "height": 500
  }
}
```

#### Example Request: Scatter with Best Fit

```json
{
  "chart": {
    "data": [
      {
        "type": "scatter",
        "mode": "markers",
        "x": [1, 2, 3, 4, 5, 6, 7, 8],
        "y": [2.1, 3.9, 6.2, 7.8, 10.1, 12.3, 13.9, 16.2],
        "name": "Data Points",
        "marker": { "size": 10, "color": "#1f77b4" }
      },
      {
        "type": "scatter",
        "mode": "lines",
        "x": [0, 9],
        "y": [0.5, 17.5],
        "name": "Best Fit: y = 2x + 0.5",
        "line": { "color": "#ff7f0e", "dash": "dash" }
      }
    ],
    "layout": {
      "title": "Height vs Age",
      "xaxis": { "title": "Age (years)" },
      "yaxis": { "title": "Height (cm above 100)" }
    }
  }
}
```

#### Response

```json
{
  "success": true,
  "image": "base64-encoded-image-data",
  "metadata": {
    "tool": "plotly",
    "chartType": "bar",
    "format": "png",
    "width": 800,
    "height": 500,
    "sizeBytes": 23456,
    "renderTimeMs": 800,
    "traceCount": 1,
    "timestamp": "2024-01-15T12:30:00.000Z"
  }
}
```

---

### 4.6 Imagen Endpoint (NEW)

```
POST /api/v1/render/imagen
```

#### Request Schema

```typescript
interface ImagenRenderRequest {
  prompt: {
    text: string;                 // Image generation prompt
    context?: string;             // Mathematical context (helps refine prompt)
    style?: ImageStyle;
  };
  safety?: SafetySettings;
  options?: ImagenOptions;
}

interface ImageStyle {
  type: 'realistic' | 'diagram' | 'illustration' | 'simple';
  colorScheme?: 'full-color' | 'muted' | 'monochrome';
  perspective?: 'front' | 'side' | 'isometric' | 'birds-eye';
}

interface SafetySettings {
  blockThreshold?: 'BLOCK_NONE' | 'BLOCK_LOW' | 'BLOCK_MEDIUM' | 'BLOCK_HIGH';
}

interface ImagenOptions {
  width?: number;                 // Must match Imagen aspect ratios
  height?: number;
  numberOfImages?: number;        // Default: 1, Max: 4
  seed?: number;                  // For reproducibility
}
```

#### Aspect Ratio Constraints

Gemini Imagen supports specific aspect ratios:
- 1:1 (1024x1024)
- 16:9 (1344x768)
- 9:16 (768x1344)
- 4:3 (1152x896)
- 3:4 (896x1152)

The service will snap to the nearest supported size.

#### Example Request

```json
{
  "prompt": {
    "text": "A 6-meter ladder leaning against a red brick wall, viewed from the side. The ladder makes an angle with the ground, and you can clearly see the ground, wall, and ladder forming a right triangle. Daylight, realistic style, educational context.",
    "context": "Trigonometry problem: ladder against wall",
    "style": {
      "type": "realistic",
      "perspective": "side"
    }
  },
  "options": {
    "width": 1024,
    "height": 1024
  }
}
```

#### Response

```json
{
  "success": true,
  "images": [
    {
      "image": "base64-encoded-image-data",
      "mimeType": "image/png"
    }
  ],
  "metadata": {
    "tool": "imagen",
    "model": "gemini-2.0-flash-preview-image-generation",
    "prompt": "A 6-meter ladder...",
    "width": 1024,
    "height": 1024,
    "imageCount": 1,
    "timestamp": "2024-01-15T12:30:00.000Z"
  }
}
```

---

## 5. Core Components (NEW Files Only)

### 5.1 Renderer Interface (NEW)

```typescript
// src/services/renderer.interface.ts

export interface RenderResult {
  buffer: Buffer;
  metadata: {
    format: 'png' | 'jpeg';
    width: number;
    height: number;
    sizeBytes: number;
    renderTimeMs: number;
    [key: string]: any;
  };
}

export interface BaseRenderer {
  readonly name: string;
  readonly timeout: number;

  initialize(): Promise<void>;
  render(input: unknown, options: RenderOptions): Promise<RenderResult>;
  close(): Promise<void>;

  isHealthy(): Promise<boolean>;
}

export interface PlaywrightRenderer extends BaseRenderer {
  generateHTML(input: unknown, options: RenderOptions): string;
}
```

### 5.2 Browser Service (NEW - For New Renderers Only)

**IMPORTANT**: This is a NEW service that only serves the NEW renderers (Desmos, GeoGebra, Plotly). The existing `DiagramRenderer` class continues to manage its own browser instance.

```typescript
// src/services/browser.service.ts

import { Browser, chromium } from 'playwright';

/**
 * Singleton browser service for NEW renderers only.
 * The existing DiagramRenderer keeps its own browser instance.
 */
export class BrowserService {
  private static instance: BrowserService;
  private browser: Browser | null = null;

  private constructor() {}

  static getInstance(): BrowserService {
    if (!BrowserService.instance) {
      BrowserService.instance = new BrowserService();
    }
    return BrowserService.instance;
  }

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
    }
  }

  async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      await this.initialize();
    }
    return this.browser!;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const browser = await this.getBrowser();
      return browser.isConnected();
    } catch {
      return false;
    }
  }
}
```

### 5.3 Renderer Factory (NEW - For New Renderers Only)

```typescript
// src/services/renderer.factory.ts

import { BaseRenderer } from './renderer.interface';
import { DesmosRenderer } from './renderers/desmos.renderer';
import { GeoGebraRenderer } from './renderers/geogebra.renderer';
import { PlotlyRenderer } from './renderers/plotly.renderer';
import { BrowserService } from './browser.service';

// Note: 'jsxgraph' is NOT here - it uses the existing DiagramRenderer
export type NewRendererType = 'desmos' | 'geogebra' | 'plotly';

export class RendererFactory {
  private static renderers: Map<NewRendererType, BaseRenderer> = new Map();

  static async getRenderer(type: NewRendererType): Promise<BaseRenderer> {
    if (!this.renderers.has(type)) {
      const browser = BrowserService.getInstance();
      await browser.initialize();

      let renderer: BaseRenderer;

      switch (type) {
        case 'desmos':
          renderer = new DesmosRenderer(browser);
          break;
        case 'geogebra':
          renderer = new GeoGebraRenderer(browser);
          break;
        case 'plotly':
          renderer = new PlotlyRenderer(browser);
          break;
        default:
          throw new Error(`Unknown renderer type: ${type}`);
      }

      await renderer.initialize();
      this.renderers.set(type, renderer);
    }

    return this.renderers.get(type)!;
  }

  static async closeAll(): Promise<void> {
    for (const renderer of this.renderers.values()) {
      await renderer.close();
    }
    this.renderers.clear();
    await BrowserService.getInstance().close();
  }
}
```

---

## 6. HTML Generators (NEW Files)

### 6.1 Desmos HTML Generator

```typescript
// src/generators/desmos.generator.ts

import { DesmosRenderRequest } from '../types/desmos.types';

export function generateDesmosHTML(
  request: DesmosRenderRequest,
  width: number,
  height: number
): string {
  const { graph } = request;
  const settings = graph.settings || {};

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
    #calculator { width: 100%; height: 100%; }
  </style>
  <script src="https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"></script>
</head>
<body>
  <div id="calculator"></div>
  <script>
    window.renderComplete = false;
    window.renderError = null;
    window.consoleErrors = [];

    const origError = console.error;
    console.error = (...args) => {
      window.consoleErrors.push(args.map(a => String(a)).join(' '));
      origError.apply(console, args);
    };

    try {
      const elt = document.getElementById('calculator');
      const calculator = Desmos.GraphingCalculator(elt, {
        expressions: true,
        settingsMenu: false,
        zoomButtons: false,
        lockViewport: true,
        border: false,
        showGrid: ${settings.showGrid !== false},
        showXAxis: ${settings.showXAxis !== false},
        showYAxis: ${settings.showYAxis !== false},
        xAxisNumbers: ${settings.xAxisNumbers !== false},
        yAxisNumbers: ${settings.yAxisNumbers !== false},
        polarMode: ${settings.polarMode === true},
        degreeMode: ${settings.degreeMode === true}
      });

      // Set viewport if specified
      ${settings.viewport ? `
      calculator.setMathBounds({
        left: ${settings.viewport.xmin},
        right: ${settings.viewport.xmax},
        bottom: ${settings.viewport.ymin},
        top: ${settings.viewport.ymax}
      });
      ` : ''}

      // Add expressions
      const expressions = ${JSON.stringify(graph.expressions)};

      expressions.forEach((expr, index) => {
        const id = expr.id || 'expr_' + index;

        if (expr.type === 'expression' && expr.latex) {
          calculator.setExpression({
            id: id,
            latex: expr.latex,
            color: expr.color,
            lineStyle: expr.lineStyle ? Desmos.Styles[expr.lineStyle] : undefined,
            lineWidth: expr.lineWidth,
            pointStyle: expr.pointStyle ? Desmos.Styles[expr.pointStyle] : undefined,
            pointSize: expr.pointSize,
            fillOpacity: expr.fillOpacity,
            hidden: expr.hidden,
            showLabel: expr.showLabel,
            label: expr.label,
            labelSize: expr.labelSize ? Desmos.LabelSizes[expr.labelSize.toUpperCase()] : undefined,
            labelOrientation: expr.labelOrientation ? Desmos.LabelOrientations[expr.labelOrientation.toUpperCase()] : undefined,
            sliderBounds: expr.sliderBounds
          });
        } else if (expr.type === 'table' && expr.columns) {
          calculator.setExpression({
            id: id,
            type: 'table',
            columns: expr.columns
          });
        }
      });

      // Wait for render
      setTimeout(() => {
        window.renderComplete = true;
      }, 500);

    } catch (error) {
      window.renderError = error.message;
    }
  </script>
</body>
</html>
  `.trim();
}
```

### 6.2 GeoGebra HTML Generator

```typescript
// src/generators/geogebra.generator.ts

import { GeoGebraRenderRequest } from '../types/geogebra.types';

export function generateGeoGebraHTML(
  request: GeoGebraRenderRequest,
  width: number,
  height: number
): string {
  const { construction } = request;
  const settings = construction.settings || {};
  const appType = settings.appType || 'classic';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
    #ggb-container { width: 100%; height: 100%; }
  </style>
  <script src="https://www.geogebra.org/apps/deployggb.js"></script>
</head>
<body>
  <div id="ggb-container"></div>
  <script>
    window.renderComplete = false;
    window.renderError = null;
    window.consoleErrors = [];
    window.ggbApplet = null;

    const origError = console.error;
    console.error = (...args) => {
      window.consoleErrors.push(args.map(a => String(a)).join(' '));
      origError.apply(console, args);
    };

    const commands = ${JSON.stringify(construction.commands)};

    const params = {
      "appName": "${appType}",
      "width": ${width},
      "height": ${height},
      "showToolBar": false,
      "showAlgebraInput": false,
      "showMenuBar": false,
      "showResetIcon": ${settings.showResetIcon === true},
      "enableLabelDrags": ${settings.enableLabelDrags === true},
      "enableShiftDragZoom": false,
      "enableRightClick": false,
      "showZoomButtons": false,
      "capturingThreshold": null,
      "showFullscreenButton": false,
      "scale": 1,
      "disableAutoScale": false,
      "allowStyleBar": false,
      "preventFocus": true,
      "showLogging": false,
      "useBrowserForJS": true,
      "appletOnLoad": function(api) {
        window.ggbApplet = api;

        try {
          // Apply settings
          ${settings.showAxes !== undefined ? `api.setAxesVisible(${settings.showAxes}, ${settings.showAxes});` : ''}
          ${settings.showGrid !== undefined ? `api.setGridVisible(${settings.showGrid});` : ''}

          // Set coordinate system bounds
          ${settings.xmin !== undefined ? `api.setCoordSystem(${settings.xmin}, ${settings.xmax}, ${settings.ymin}, ${settings.ymax});` : ''}

          // Execute each command
          for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i];
            const result = api.evalCommand(cmd);
            if (!result && cmd.indexOf('Set') !== 0) {
              console.error('Command failed: ' + cmd);
            }
          }

          // Wait for rendering to stabilize
          setTimeout(() => {
            window.renderComplete = true;
          }, 800);

        } catch (error) {
          window.renderError = error.message;
        }
      }
    };

    const applet = new GGBApplet(params, true);
    applet.inject('ggb-container');
  </script>
</body>
</html>
  `.trim();
}
```

### 6.3 Plotly HTML Generator

```typescript
// src/generators/plotly.generator.ts

import { PlotlyRenderRequest } from '../types/plotly.types';

export function generatePlotlyHTML(
  request: PlotlyRenderRequest,
  width: number,
  height: number
): string {
  const { chart } = request;
  const layout = {
    ...chart.layout,
    width,
    height,
    margin: chart.layout?.margin || { l: 60, r: 40, t: 60, b: 60 }
  };

  const config = {
    staticPlot: true,
    displayModeBar: false,
    responsive: false,
    ...chart.config
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
    #chart { width: 100%; height: 100%; }
  </style>
  <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
</head>
<body>
  <div id="chart"></div>
  <script>
    window.renderComplete = false;
    window.renderError = null;
    window.consoleErrors = [];

    const origError = console.error;
    console.error = (...args) => {
      window.consoleErrors.push(args.map(a => String(a)).join(' '));
      origError.apply(console, args);
    };

    try {
      const data = ${JSON.stringify(chart.data)};
      const layout = ${JSON.stringify(layout)};
      const config = ${JSON.stringify(config)};

      Plotly.newPlot('chart', data, layout, config).then(() => {
        window.renderComplete = true;
      }).catch((error) => {
        window.renderError = error.message;
      });

    } catch (error) {
      window.renderError = error.message;
    }
  </script>
</body>
</html>
  `.trim();
}
```

---

## 7. Imagen Client (NEW)

```typescript
// src/services/clients/imagen.client.ts

import { GoogleGenAI, Modality } from '@google/genai';
import { ImagenRenderRequest, ImagenResult } from '../../types/imagen.types';

export class ImagenClient {
  private client: GoogleGenAI;
  private model: string = 'gemini-2.0-flash-preview-image-generation';

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(request: ImagenRenderRequest): Promise<ImagenResult> {
    const startTime = Date.now();

    // Build prompt with style guidance
    let fullPrompt = request.prompt.text;

    if (request.prompt.style) {
      const styleGuide = this.buildStyleGuide(request.prompt.style);
      fullPrompt = `${fullPrompt}\n\nStyle: ${styleGuide}`;
    }

    // Add educational context hint
    fullPrompt = `Educational illustration for mathematics: ${fullPrompt}. Clear, unambiguous visual suitable for students.`;

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: fullPrompt,
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      const images: Array<{ image: string; mimeType: string }> = [];

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          images.push({
            image: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png'
          });
        }
      }

      if (images.length === 0) {
        throw new Error('No images generated');
      }

      return {
        success: true,
        images,
        metadata: {
          tool: 'imagen',
          model: this.model,
          prompt: request.prompt.text,
          width: request.options?.width || 1024,
          height: request.options?.height || 1024,
          imageCount: images.length,
          renderTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      throw new Error(`IMAGEN_ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildStyleGuide(style: ImagenRenderRequest['prompt']['style']): string {
    const parts: string[] = [];

    if (style?.type === 'realistic') {
      parts.push('photorealistic, detailed');
    } else if (style?.type === 'diagram') {
      parts.push('clean diagram, technical illustration');
    } else if (style?.type === 'illustration') {
      parts.push('educational illustration, clear and simple');
    } else if (style?.type === 'simple') {
      parts.push('simple, minimalist, clean lines');
    }

    if (style?.perspective) {
      parts.push(`${style.perspective} view`);
    }

    if (style?.colorScheme === 'muted') {
      parts.push('muted colors, soft tones');
    } else if (style?.colorScheme === 'monochrome') {
      parts.push('black and white, grayscale');
    }

    return parts.join(', ');
  }
}
```

---

## 8. Route Implementations (NEW Files)

### 8.1 Desmos Route

```typescript
// src/routes/desmos.routes.ts

import { Router, Request, Response } from 'express';
import { RendererFactory } from '../services/renderer.factory';
import { desmosSchema } from '../schemas/desmos.schema';

export const desmosRouter = Router();

let rendererReady = false;

export async function initDesmosRenderer(): Promise<void> {
  await RendererFactory.getRenderer('desmos');
  rendererReady = true;
}

desmosRouter.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  // Validate request
  const parseResult = desmosSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: parseResult.error.errors
      }
    });
  }

  try {
    const renderer = await RendererFactory.getRenderer('desmos');
    const result = await renderer.render(parseResult.data, parseResult.data.options || {});

    return res.json({
      success: true,
      image: result.buffer.toString('base64'),
      metadata: {
        ...result.metadata,
        tool: 'desmos',
        expressionCount: parseResult.data.graph.expressions.length
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'RENDER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});
```

### 8.2 Index.ts Extension (Minimal Changes)

The only changes to `src/index.ts` are to ADD new route imports and registrations:

```typescript
// ADD these imports (do not modify existing imports)
import { desmosRouter, initDesmosRenderer } from './routes/desmos.routes';
import { geogebraRouter, initGeoGebraRenderer } from './routes/geogebra.routes';
import { plotlyRouter, initPlotlyRenderer } from './routes/plotly.routes';
import { imagenRouter } from './routes/imagen.routes';
import { BrowserService } from './services/browser.service';

// ADD these route registrations after existing routes
app.use('/api/v1/render/desmos', apiKeyAuth, desmosRouter);
app.use('/api/v1/render/geogebra', apiKeyAuth, geogebraRouter);
app.use('/api/v1/render/plotly', apiKeyAuth, plotlyRouter);
app.use('/api/v1/render/imagen', apiKeyAuth, imagenRouter);

// ADD initialization for new renderers in startup
async function initializeNewRenderers(): Promise<void> {
  await initDesmosRenderer();
  await initGeoGebraRenderer();
  await initPlotlyRenderer();
}

// ADD cleanup for new browser service in shutdown
async function shutdownNewRenderers(): Promise<void> {
  await RendererFactory.closeAll();
  await BrowserService.getInstance().close();
}
```

---

## 9. Zod Validation Schemas (NEW Files)

### 9.1 Common Schema

```typescript
// src/schemas/common.schema.ts

import { z } from 'zod';

export const renderOptionsSchema = z.object({
  width: z.number().min(100).max(4000).default(800),
  height: z.number().min(100).max(4000).default(600),
  format: z.enum(['png', 'jpeg']).default('png'),
  quality: z.number().min(1).max(100).default(90),
  scale: z.number().min(1).max(4).default(2),
  timeout: z.number().min(1000).max(60000).default(15000),
  returnFormat: z.enum(['base64', 'binary']).default('base64')
}).optional();
```

### 9.2 Desmos Schema

```typescript
// src/schemas/desmos.schema.ts

import { z } from 'zod';
import { renderOptionsSchema } from './common.schema';

const desmosExpressionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['expression', 'table', 'text', 'folder']),
  latex: z.string().optional(),
  color: z.string().optional(),
  lineStyle: z.enum(['SOLID', 'DASHED', 'DOTTED']).optional(),
  lineWidth: z.number().min(0.5).max(10).optional(),
  pointStyle: z.enum(['POINT', 'OPEN', 'CROSS']).optional(),
  pointSize: z.number().min(1).max(20).optional(),
  fillOpacity: z.number().min(0).max(1).optional(),
  hidden: z.boolean().optional(),
  columns: z.array(z.object({
    latex: z.string(),
    values: z.array(z.number())
  })).optional(),
  text: z.string().optional(),
  showLabel: z.boolean().optional(),
  label: z.string().optional(),
  labelSize: z.enum(['small', 'medium', 'large']).optional(),
  labelOrientation: z.enum(['above', 'below', 'left', 'right', 'default']).optional(),
  sliderBounds: z.object({
    min: z.number(),
    max: z.number(),
    step: z.number().optional()
  }).optional()
});

const desmosSettingsSchema = z.object({
  xAxisLabel: z.string().optional(),
  yAxisLabel: z.string().optional(),
  xAxisStep: z.number().optional(),
  yAxisStep: z.number().optional(),
  viewport: z.object({
    xmin: z.number(),
    xmax: z.number(),
    ymin: z.number(),
    ymax: z.number()
  }).optional(),
  showGrid: z.boolean().optional(),
  showXAxis: z.boolean().optional(),
  showYAxis: z.boolean().optional(),
  xAxisNumbers: z.boolean().optional(),
  yAxisNumbers: z.boolean().optional(),
  polarMode: z.boolean().optional(),
  degreeMode: z.boolean().optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  gridColor: z.string().optional(),
  axisColor: z.string().optional()
}).optional();

export const desmosSchema = z.object({
  graph: z.object({
    expressions: z.array(desmosExpressionSchema).min(1),
    settings: desmosSettingsSchema
  }),
  options: renderOptionsSchema
});
```

---

## 10. Health Check Extension (Append Only)

```typescript
// ADD to src/routes/health.ts (do not modify existing code)

import { BrowserService } from '../services/browser.service';

// ADD this check to the existing health endpoint handler
const newBrowserHealthy = await BrowserService.getInstance().isHealthy();
checks.newBrowserService = newBrowserHealthy ? 'ok' : 'not_initialized';

// ADD Imagen check
if (process.env.GOOGLE_AI_API_KEY) {
  checks.imagen = 'configured';
} else {
  checks.imagen = 'not_configured';
}
```

---

## 11. Environment Configuration

```bash
# ADD to .env.example (do not modify existing variables)

# New Renderer Timeouts
DESMOS_TIMEOUT=15000
GEOGEBRA_TIMEOUT=30000
PLOTLY_TIMEOUT=10000

# Imagen (Gemini)
GOOGLE_AI_API_KEY=your-google-ai-api-key
```

---

## 12. Timeouts & Performance Expectations

| Tool      | Typical Render Time | Default Timeout | Notes                           |
|-----------|---------------------|-----------------|----------------------------------|
| JSXGraph  | 500-1500ms          | 10s             | Fastest, simple geometry (EXISTING) |
| Plotly    | 600-1200ms          | 10s             | Fast, declarative rendering      |
| Desmos    | 800-2000ms          | 15s             | Medium, API initialization       |
| GeoGebra  | 2000-5000ms         | 30s             | Slowest, full applet init        |
| Imagen    | 3000-15000ms        | 30s             | External API, network dependent  |

---

## 13. Implementation Checklist

### Phase 1: Core Infrastructure (NEW Files Only)
- [ ] Create `src/types/common.types.ts`
- [ ] Create `src/types/desmos.types.ts`
- [ ] Create `src/types/geogebra.types.ts`
- [ ] Create `src/types/plotly.types.ts`
- [ ] Create `src/types/imagen.types.ts`
- [ ] Create `src/schemas/common.schema.ts`
- [ ] Create `src/services/renderer.interface.ts`
- [ ] Create `src/services/browser.service.ts`
- [ ] Create `src/services/renderer.factory.ts`

### Phase 2: Generators (NEW Files Only)
- [ ] Create `src/generators/base.generator.ts`
- [ ] Create `src/generators/desmos.generator.ts`
- [ ] Create `src/generators/geogebra.generator.ts`
- [ ] Create `src/generators/plotly.generator.ts`

### Phase 3: Renderers (NEW Files Only)
- [ ] Create `src/services/renderers/desmos.renderer.ts`
- [ ] Create `src/services/renderers/geogebra.renderer.ts`
- [ ] Create `src/services/renderers/plotly.renderer.ts`
- [ ] Create `src/services/clients/imagen.client.ts`

### Phase 4: Schemas (NEW Files Only)
- [ ] Create `src/schemas/desmos.schema.ts`
- [ ] Create `src/schemas/geogebra.schema.ts`
- [ ] Create `src/schemas/plotly.schema.ts`
- [ ] Create `src/schemas/imagen.schema.ts`

### Phase 5: Routes (NEW Files Only)
- [ ] Create `src/routes/desmos.routes.ts`
- [ ] Create `src/routes/geogebra.routes.ts`
- [ ] Create `src/routes/plotly.routes.ts`
- [ ] Create `src/routes/imagen.routes.ts`

### Phase 6: Integration (Minimal Changes)
- [ ] EXTEND `src/index.ts` - Add new route imports and registrations
- [ ] EXTEND `src/routes/health.ts` - Add new health checks
- [ ] EXTEND `.env.example` - Add new environment variables

### Phase 7: Testing
- [ ] Test existing `/api/v1/render` endpoint still works (NO REGRESSION)
- [ ] Test new `/api/v1/render/desmos` endpoint
- [ ] Test new `/api/v1/render/geogebra` endpoint
- [ ] Test new `/api/v1/render/plotly` endpoint
- [ ] Test new `/api/v1/render/imagen` endpoint

---

## 14. Summary: Endpoint Quick Reference

| Endpoint                       | Method | Status | Input Format                  | Use Case                          |
|--------------------------------|--------|--------|-------------------------------|-----------------------------------|
| `POST /api/v1/render`          | POST   | FROZEN | Elements array + board config | JSXGraph (existing, unchanged)    |
| `POST /api/v1/render/desmos`   | POST   | NEW    | Expressions array + settings  | Function graphing, equations      |
| `POST /api/v1/render/geogebra` | POST   | NEW    | Commands array + settings     | Circle theorems, constructions    |
| `POST /api/v1/render/plotly`   | POST   | NEW    | Traces array + layout         | Statistics, charts, data viz      |
| `POST /api/v1/render/imagen`   | POST   | NEW    | Text prompt + style           | Real-world context images         |

---

**Document Version**: 1.1 - OCP Compliant
**Last Updated**: Based on existing implementation analysis
**Key Constraint**: Open-Close Principle - existing code MUST NOT be modified
