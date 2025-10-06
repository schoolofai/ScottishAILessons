# Plan: DiagramScreenshot Headless Rendering Service

## Overview
Create a standalone RESTful microservice that renders JSXGraph diagrams from JSON configurations and returns high-quality screenshot images. This service will be deployed as a Docker container and integrated with LangGraph AI agents for automated diagram generation in lesson authoring workflows.

**Service Name**: DiagramScreenshot
**Purpose**: Convert JSXGraph JSON → PNG/JPEG screenshot via headless browser
**Deployment**: Docker container (cloud-ready)
**Integration**: HTTP API for LangGraph agents

## Design Document
Full technical design: `/diagram-prototypes/DIAGRAM_SCREENSHOT_SERVICE_DESIGN.md`

---

## Phase 1: Core Service Implementation (2-3 days)

### 1.1 Project Setup
```bash
# Create new directory
mkdir diagramScreenshot
cd diagramScreenshot

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express playwright zod dotenv winston compression helmet cors
npm install -D typescript @types/node @types/express ts-node nodemon
npm install -D vitest @vitest/ui supertest @types/supertest

# Initialize TypeScript
npx tsc --init
```

**Project Structure:**
```
diagramScreenshot/
├── src/
│   ├── index.ts                    # Express app entry point
│   ├── routes/
│   │   ├── render.ts               # POST /api/v1/render
│   │   └── health.ts               # GET /health endpoints
│   ├── services/
│   │   ├── renderer.ts             # DiagramRenderer class
│   │   ├── validator.ts            # Zod validation
│   │   ├── queue.ts                # Request queue
│   │   └── metrics.ts              # Prometheus metrics
│   ├── middleware/
│   │   ├── auth.ts                 # API key authentication
│   │   ├── logging.ts              # Request logging
│   │   └── limits.ts               # Rate limiting
│   ├── utils/
│   │   ├── html-generator.ts       # Generate HTML pages
│   │   ├── error-handler.ts        # Error responses
│   │   └── logger.ts               # Winston logger
│   └── types/
│       └── diagram.ts              # TypeScript types
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

### 1.2 Implement Validation Layer
**File**: `src/services/validator.ts`

Use Zod schemas matching diagram-prototypes:
```typescript
import { z } from 'zod';

const BoardConfigSchema = z.object({
  boundingbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  axis: z.boolean().optional(),
  grid: z.boolean().optional(),
  // ... other board config
});

const DiagramElementSchema = z.object({
  type: z.string(),
  args: z.array(z.any()),
  attributes: z.record(z.any()).optional(),
  id: z.string().optional()
});

const DiagramSchema = z.object({
  board: BoardConfigSchema,
  elements: z.array(DiagramElementSchema),
  title: z.string().optional(),
  description: z.string().optional()
});

const RenderOptionsSchema = z.object({
  width: z.number().min(100).max(4000).optional(),
  height: z.number().min(100).max(4000).optional(),
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().min(1).max(100).optional(),
  scale: z.number().min(1).max(4).optional(),
  timeout: z.number().min(1000).max(60000).optional()
});

export const RenderRequestSchema = z.object({
  diagram: DiagramSchema,
  options: RenderOptionsSchema.optional()
});
```

**Tests**: `tests/unit/validator.test.ts`
- Valid diagram acceptance
- Invalid boundingbox rejection
- Optional options handling
- Error message clarity

### 1.3 Implement HTML Generator
**File**: `src/utils/html-generator.ts`

Generate standalone HTML with:
- JSXGraph library from CDN
- Injected diagram JSON
- Rendering logic from diagram-prototypes (closures, array flattening)
- Console error capturing
- Rendering completion signal

**Critical**: Copy exact patterns from `diagram-prototypes/components/tools/JSXGraphTool.tsx`:
```typescript
export function generateHTML(diagram: JSXGraphDiagram, options: RenderOptions): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/jsxgraph@1.11.1/distrib/jsxgraph.css" />
  <style>
    body { background-color: ${options.backgroundColor}; margin: 0; }
    #jxgbox { width: ${options.width}px; height: ${options.height}px; }
  </style>
</head>
<body>
  <div id="jxgbox"></div>
  <script src="https://cdn.jsdelivr.net/npm/jsxgraph@1.11.1/distrib/jsxgraphcore.js"></script>
  <script>
    window.renderComplete = false;
    window.renderError = null;
    window.consoleErrors = [];

    // Console error capture
    const originalError = console.error;
    console.error = function(...args) {
      window.consoleErrors.push(args.join(' '));
      originalError.apply(console, args);
    };

    try {
      const diagramData = ${JSON.stringify(diagram)};

      // Initialize board
      const board = JXG.JSXGraph.initBoard('jxgbox', {
        boundingbox: diagramData.board.boundingbox,
        axis: diagramData.board.axis ?? true,
        showCopyright: false,
        showNavigation: false,
        keepAspectRatio: diagramData.board.keepAspectRatio ?? true,
        grid: diagramData.board.grid ?? false,
        pan: { enabled: false },
        zoom: { enabled: false }
      });

      const elementRefs = {};

      // Function closure helper (from diagram-prototypes)
      function createFunctionWithClosure(funcString, board) {
        const funcBody = funcString.substring(6).trim();
        if (funcBody.startsWith("{")) {
          return (function(boardRef) {
            const board = boardRef;
            return eval(\`(function() \${funcBody})\`);
          })(board);
        } else {
          return (function(boardRef) {
            const board = boardRef;
            return eval(\`(function() { return \${funcBody}; })\`);
          })(board);
        }
      }

      // Create elements
      for (const element of diagramData.elements) {
        const processedArgs = element.args.map(arg => {
          // Function strings (except functiongraph)
          if (typeof arg === "string" && arg.startsWith("() =>") && element.type !== "functiongraph") {
            return createFunctionWithClosure(arg, board);
          }

          // Element ID references
          if (typeof arg === "string" && elementRefs[arg]) {
            return elementRefs[arg];
          }

          // Named references
          if (Array.isArray(arg)) {
            return arg.map(item => {
              if (typeof item === "string") {
                const point = board.select(item);
                if (point) return point;
              }
              return item;
            });
          }

          return arg;
        });

        // Array flattening for polygons
        const finalArgs = processedArgs.length === 1 && Array.isArray(processedArgs[0])
          ? processedArgs[0]
          : processedArgs;

        const jsxElement = board.create(element.type, finalArgs, element.attributes || {});

        if (element.id) {
          elementRefs[element.id] = jsxElement;
        }
      }

      board.update();
      window.renderComplete = true;

    } catch (err) {
      console.error("Rendering error:", err);
      window.renderError = {
        message: err.message,
        stack: err.stack
      };
      window.renderComplete = true;
    }
  </script>
</body>
</html>
  `;
}
```

**Tests**: `tests/unit/html-generator.test.ts`
- Valid HTML generation
- Diagram JSON injection
- Options application
- Script tag safety

### 1.4 Implement Playwright Renderer
**File**: `src/services/renderer.ts`

```typescript
import { chromium, Browser, Page } from 'playwright';

export class DiagramRenderer {
  private browser: Browser | null = null;

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

  async render(diagram: JSXGraphDiagram, options: RenderOptions = {}): Promise<Buffer> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage({
      viewport: {
        width: options.width || 800,
        height: options.height || 600
      },
      deviceScaleFactor: options.scale || 2
    });

    try {
      // Generate HTML
      const html = generateHTML(diagram, options);
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

      // Navigate and wait for render
      await page.goto(dataUrl, { waitUntil: 'networkidle' });

      await page.waitForFunction(
        () => window.renderComplete === true,
        { timeout: options.timeout || 10000 }
      );

      // Check for errors
      const renderError = await page.evaluate(() => window.renderError);
      if (renderError) {
        throw new Error(`Rendering failed: ${renderError.message}`);
      }

      // Optional: Wait for stability
      if (options.waitForStable !== false) {
        await page.waitForTimeout(500);
      }

      // Screenshot
      const buffer = await page.screenshot({
        type: options.format || 'png',
        quality: options.format === 'jpeg' ? (options.quality || 90) : undefined,
        fullPage: options.fullPage || false,
        omitBackground: options.backgroundColor === 'transparent'
      });

      return buffer;

    } catch (error) {
      const consoleErrors = await page.evaluate(() => window.consoleErrors || []);

      throw new RenderError(
        'Rendering failed',
        error,
        { consoleErrors }
      );
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  isInitialized(): boolean {
    return this.browser !== null;
  }
}

export class RenderError extends Error {
  constructor(
    message: string,
    public originalError: any,
    public metadata: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'RenderError';
  }
}
```

**Tests**: `tests/integration/renderer.test.ts`
- Simple diagram rendering
- Complex diagram (Pythagorean)
- Error handling
- Timeout behavior

### 1.5 Implement Express API
**File**: `src/routes/render.ts`

```typescript
import { Router } from 'express';
import { renderer } from '../index';
import { validateRenderRequest } from '../services/validator';
import { handleError } from '../utils/error-handler';

export const renderRouter = Router();

renderRouter.post('/', async (req, res) => {
  const startTime = Date.now();

  try {
    const { diagram, options } = validateRenderRequest(req.body);

    const buffer = await renderer.render(diagram, options || {});
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      image: buffer.toString('base64'),
      metadata: {
        format: options?.format || 'png',
        width: options?.width || 800,
        height: options?.height || 600,
        sizeBytes: buffer.length,
        renderTimeMs: duration,
        elementCount: diagram.elements.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    handleError(error, res);
  }
});
```

**File**: `src/routes/health.ts`

```typescript
import { Router } from 'express';
import { renderer } from '../index';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  const isHealthy = renderer.isInitialized();

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    playwright: { initialized: isHealthy }
  });
});

healthRouter.get('/ready', (req, res) => {
  res.status(renderer.isInitialized() ? 200 : 503).send('OK');
});

healthRouter.get('/live', (req, res) => {
  res.status(200).send('OK');
});
```

**File**: `src/index.ts`

```typescript
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';

import { renderRouter } from './routes/render';
import { healthRouter } from './routes/health';
import { DiagramRenderer } from './services/renderer';

export const renderer = new DiagramRenderer();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '5mb' }));

app.use('/api/v1/render', renderRouter);
app.use('/health', healthRouter);

async function start() {
  await renderer.initialize();
  app.listen(PORT, () => {
    console.log(`DiagramScreenshot service listening on port ${PORT}`);
  });
}

start();

export { app };
```

**Tests**: `tests/integration/api.test.ts`
- POST /api/v1/render success
- POST /api/v1/render validation error
- GET /health
- GET /health/ready

### 1.6 Error Handling Implementation
**File**: `src/utils/error-handler.ts`

```typescript
import { Response } from 'express';
import { ZodError } from 'zod';
import { RenderError } from '../services/renderer';

export function handleError(error: unknown, res: Response): void {
  // Validation errors
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid diagram configuration',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          issue: err.message
        }))
      }
    });
    return;
  }

  // Rendering errors
  if (error instanceof RenderError) {
    res.status(500).json({
      success: false,
      error: {
        code: 'RENDER_ERROR',
        message: error.message,
        details: error.metadata,
        consoleErrors: error.metadata.consoleErrors || []
      }
    });
    return;
  }

  // Timeout errors
  if (error instanceof Error && error.message.includes('timeout')) {
    res.status(408).json({
      success: false,
      error: {
        code: 'TIMEOUT_ERROR',
        message: 'Rendering exceeded timeout',
        suggestion: 'Reduce element count or increase timeout'
      }
    });
    return;
  }

  // Generic errors
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  });
}
```

---

## Phase 2: Docker & Deployment (1-2 days)

### 2.1 Create Dockerfile
**File**: `Dockerfile`

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# Stage 2: Runtime with Playwright
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Install Node.js in Playwright image
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Copy package files and install production deps
COPY package*.json ./
RUN npm ci --only=production

# Copy built app
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health/live', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/index.js"]
```

**Why Playwright Base Image:**
- Includes Chromium browser binaries pre-installed
- Optimized for headless operation
- No runtime browser installation needed

### 2.2 Create docker-compose.yml
**File**: `docker-compose.yml`

```yaml
version: '3.8'

services:
  diagram-screenshot:
    build:
      context: .
      dockerfile: Dockerfile
    image: diagram-screenshot:latest
    container_name: diagram-screenshot-dev
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
      - API_KEY=dev-api-key-change-in-production
      - MAX_CONCURRENT_RENDERS=5
      - DEFAULT_TIMEOUT_MS=10000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

### 2.3 Environment Configuration
**File**: `.env.example`

```bash
# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Security
API_KEY=your-secure-api-key-here
ENABLE_CORS=true
CORS_ORIGINS=http://localhost:2024,https://your-app.com

# Rendering
MAX_CONCURRENT_RENDERS=5
DEFAULT_TIMEOUT_MS=10000
MAX_TIMEOUT_MS=60000
DEFAULT_WIDTH=800
DEFAULT_HEIGHT=600
DEFAULT_SCALE=2

# Browser
BROWSER_HEADLESS=true
BROWSER_ARGS=--no-sandbox,--disable-setuid-sandbox

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### 2.4 Production Hardening

**API Key Authentication** (`src/middleware/auth.ts`):
```typescript
export function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.API_KEY;

  if (!validKey && process.env.NODE_ENV === 'development') {
    return next();
  }

  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key' }
    });
  }

  next();
}
```

**Rate Limiting** (`src/middleware/limits.ts`):
```typescript
import rateLimit from 'express-rate-limit';

export const renderRateLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 30,  // 30 requests per IP
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests'
    }
  }
});
```

### 2.5 Build and Test
```bash
# Build Docker image
docker build -t diagram-screenshot:latest .

# Run container
docker run -d \
  --name diagram-screenshot \
  -p 3000:3000 \
  -e API_KEY=test-key \
  diagram-screenshot:latest

# Test health
curl http://localhost:3000/health

# Test render
curl -X POST http://localhost:3000/api/v1/render \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d @test-diagram.json

# View logs
docker logs -f diagram-screenshot

# Stop
docker stop diagram-screenshot
docker rm diagram-screenshot
```

---

## Phase 3: LangGraph Integration (1 day)

### 3.1 Create Python Tool Wrapper
**File**: `langgraph-agent/src/tools/diagram_screenshot.py`

```python
import httpx
import base64
import os
from typing import Dict, Any, Optional

class DiagramScreenshotTool:
    """Tool for generating JSXGraph diagram screenshots."""

    def __init__(
        self,
        service_url: str = "http://localhost:3000",
        api_key: Optional[str] = None,
        timeout: int = 30
    ):
        self.service_url = service_url.rstrip('/')
        self.api_key = api_key or os.getenv("DIAGRAM_SCREENSHOT_API_KEY")
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)

    async def render_diagram(
        self,
        diagram: Dict[str, Any],
        width: int = 1200,
        height: int = 800,
        format: str = "png",
        save_to_file: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Render JSXGraph diagram and return screenshot.

        Args:
            diagram: JSXGraph diagram config (same as diagram-prototypes)
            width: Image width (default: 1200)
            height: Image height (default: 800)
            format: "png" or "jpeg" (default: "png")
            save_to_file: Optional path to save image

        Returns:
            Dict with:
                - success: bool
                - image_base64: str (if successful)
                - file_path: str (if save_to_file provided)
                - metadata: dict
                - error: dict (if failed)
        """

        payload = {
            "diagram": diagram,
            "options": {
                "width": width,
                "height": height,
                "format": format,
                "scale": 2
            }
        }

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key

        try:
            response = await self.client.post(
                f"{self.service_url}/api/v1/render",
                json=payload,
                headers=headers
            )

            response.raise_for_status()
            result = response.json()

            if not result.get("success"):
                return {
                    "success": False,
                    "error": result.get("error", "Unknown error")
                }

            image_base64 = result.get("image")
            metadata = result.get("metadata", {})

            # Optionally save to file
            file_path = None
            if save_to_file and image_base64:
                image_bytes = base64.b64decode(image_base64)
                with open(save_to_file, "wb") as f:
                    f.write(image_bytes)
                file_path = save_to_file

            return {
                "success": True,
                "image_base64": image_base64,
                "file_path": file_path,
                "metadata": metadata
            }

        except httpx.HTTPStatusError as e:
            error_detail = e.response.json() if e.response.content else {"message": str(e)}
            return {
                "success": False,
                "error": {
                    "code": "HTTP_ERROR",
                    "status": e.response.status_code,
                    "details": error_detail
                }
            }

        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "REQUEST_ERROR",
                    "message": str(e)
                }
            }

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()
```

### 3.2 Example Agent Integration
**File**: `langgraph-agent/src/examples/diagram_lesson_author.py`

```python
from langchain_core.messages import AIMessage
from tools.diagram_screenshot import DiagramScreenshotTool
import os

async def generate_lesson_with_diagram(state: dict) -> dict:
    """
    Agent node that generates a lesson with diagram screenshot.
    Demonstrates DiagramScreenshot service integration.
    """

    # 1. AI generates diagram JSON (simplified example)
    diagram = {
        "board": {
            "boundingbox": [-1, 6, 7, -1],
            "axis": True,
            "grid": True,
            "keepAspectRatio": True
        },
        "elements": [
            {"type": "point", "args": [0, 0], "attributes": {"name": "A", "fixed": True}, "id": "pointA"},
            {"type": "point", "args": [3, 0], "attributes": {"name": "B"}, "id": "pointB"},
            {"type": "point", "args": [0, 4], "attributes": {"name": "C"}, "id": "pointC"},
            {"type": "polygon", "args": [["A", "B", "C"]], "attributes": {"fillColor": "#ffeecc"}}
        ],
        "title": "Pythagorean Theorem"
    }

    # 2. Generate screenshot
    screenshot_tool = DiagramScreenshotTool(
        service_url=os.getenv("DIAGRAM_SCREENSHOT_URL", "http://diagram-screenshot:3000"),
        api_key=os.getenv("DIAGRAM_SCREENSHOT_API_KEY")
    )

    result = await screenshot_tool.render_diagram(
        diagram=diagram,
        width=1200,
        height=800,
        save_to_file="./lesson_diagrams/pythagorean.png"
    )

    await screenshot_tool.close()

    # 3. Return result
    if result["success"]:
        return {
            "messages": [
                AIMessage(content=f"Created lesson with diagram: {result['file_path']}")
            ],
            "lesson_diagram_path": result["file_path"],
            "lesson_content": {
                "title": "Pythagorean Theorem",
                "diagram_image": result["file_path"],
                "diagram_config": diagram
            }
        }
    else:
        return {
            "messages": [
                AIMessage(content=f"Lesson created (diagram failed: {result['error']})")
            ],
            "lesson_content": {
                "title": "Pythagorean Theorem",
                "diagram_error": result["error"]
            }
        }
```

### 3.3 Docker Compose Integration
**Update**: `langgraph-agent/docker-compose.yml`

```yaml
services:
  # Existing services...

  diagram-screenshot:
    image: diagram-screenshot:latest
    container_name: diagram-screenshot
    environment:
      - NODE_ENV=production
      - API_KEY=${DIAGRAM_SCREENSHOT_API_KEY}
      - LOG_LEVEL=info
    networks:
      - backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s

  langgraph-agent:
    # ...existing config
    environment:
      - DIAGRAM_SCREENSHOT_URL=http://diagram-screenshot:3000
      - DIAGRAM_SCREENSHOT_API_KEY=${DIAGRAM_SCREENSHOT_API_KEY}
    depends_on:
      - diagram-screenshot
```

---

## Phase 4: Observability & Testing (2-3 days)

### 4.1 Structured Logging
**File**: `src/utils/logger.ts`

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.LOG_FORMAT === 'json'
      ? winston.format.json()
      : winston.format.simple()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

export default logger;
```

### 4.2 Prometheus Metrics
**File**: `src/services/metrics.ts`

```typescript
import { Counter, Histogram, Gauge, register } from 'prom-client';

export class MetricsService {
  private renderCounter: Counter;
  private renderDuration: Histogram;
  private renderErrors: Counter;

  constructor() {
    this.renderCounter = new Counter({
      name: 'diagram_renders_total',
      help: 'Total diagram renders',
      labelNames: ['status', 'format']
    });

    this.renderDuration = new Histogram({
      name: 'diagram_render_duration_seconds',
      help: 'Render duration',
      buckets: [0.1, 0.5, 1, 2, 5, 10]
    });

    this.renderErrors = new Counter({
      name: 'diagram_render_errors_total',
      help: 'Total render errors',
      labelNames: ['error_type']
    });
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}
```

**Endpoint**: `GET /metrics` (Prometheus format)

### 4.3 Testing Suite

**Unit Tests** (`tests/unit/`):
- `validator.test.ts` - Schema validation
- `html-generator.test.ts` - HTML generation
- `error-handler.test.ts` - Error formatting

**Integration Tests** (`tests/integration/`):
- `api.test.ts` - API endpoints
- `renderer.test.ts` - Playwright rendering

**E2E Tests** (`tests/e2e/`):
- `full-workflow.test.ts` - Complete render workflow
- Test all diagram-prototypes examples

**Load Tests**:
```bash
# Artillery config
artillery quick --count 100 --num 10 \
  http://localhost:3000/api/v1/render
```

---

## Implementation Timeline

### Week 1: Core Service
- **Day 1**: Project setup, validation, HTML generator
- **Day 2**: Playwright renderer implementation
- **Day 3**: Express API, error handling, unit tests

### Week 2: Deployment & Integration
- **Day 4**: Docker, docker-compose, production hardening
- **Day 5**: Python tool wrapper, agent examples
- **Day 6**: Integration testing, deployment guides

### Week 3: Observability & Polish
- **Day 7**: Logging, metrics, monitoring
- **Day 8**: E2E tests, load testing
- **Day 9**: Documentation, troubleshooting guide

**Total Time**: 6-9 days

---

## Success Criteria

### Technical Requirements
✅ Renders all diagram-prototypes examples correctly
✅ Response time <2s for typical diagrams (20 elements)
✅ Handles 10 concurrent requests without degradation
✅ <200MB memory per render
✅ Graceful error handling with diagnostics
✅ Docker container runs in any cloud environment

### Integration Requirements
✅ RESTful API compatible with Python httpx/requests
✅ Base64 response format for LangGraph agents
✅ Error responses with actionable debugging info
✅ Health checks work with K8s/ECS orchestrators

### Operational Requirements
✅ Automated health checks
✅ Structured logging for debugging
✅ Prometheus metrics for monitoring
✅ Documented deployment procedures
✅ API authentication for production

---

## Related Documentation

- **Full Design**: `/diagram-prototypes/DIAGRAM_SCREENSHOT_SERVICE_DESIGN.md`
- **Diagram Prototypes**: `/diagram-prototypes/README.md`
- **JSXGraph Patterns**: `/diagram-prototypes/JSXGRAPH_INTEGRATION_DESIGN.md`
- **LangGraph Integration**: `/langgraph-agent/CLAUDE.md`

---

## Cloud Deployment Quick Start

### Google Cloud Run
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/diagram-screenshot
gcloud run deploy diagram-screenshot \
  --image gcr.io/PROJECT_ID/diagram-screenshot \
  --memory 2Gi \
  --cpu 2 \
  --timeout 60s
```

### AWS ECS/Fargate
```bash
# Push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.REGION.amazonaws.com
docker push ACCOUNT.dkr.ecr.REGION.amazonaws.com/diagram-screenshot:latest

# Create task definition and service
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: diagram-screenshot
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: diagram-screenshot
        image: diagram-screenshot:latest
        resources:
          limits:
            memory: "2Gi"
            cpu: "2000m"
```

---

**Last Updated**: January 2025
**Status**: Ready for Implementation
**Version**: 1.0
