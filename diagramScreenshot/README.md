# DiagramScreenshot Service

Headless JSXGraph diagram rendering service that converts JSON configurations to PNG/JPEG screenshots.

## Quick Start with Docker

```bash
# Build and run
docker-compose up --build

# Test health
curl http://localhost:3001/health

# Test render (see test-diagram.json)
curl -X POST http://localhost:3001/api/v1/render \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-change-in-production" \
  -d @test-diagram.json
```

## API

### POST /api/v1/render
Render JSXGraph diagram and return base64-encoded screenshot.

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: your-api-key`

**Body:**
```json
{
  "diagram": {
    "board": {
      "boundingbox": [-1, 6, 7, -1],
      "axis": true,
      "grid": true
    },
    "elements": [...]
  },
  "options": {
    "width": 1200,
    "height": 800,
    "format": "png"
  }
}
```

### GET /health
Health check endpoint.

## Environment Variables

See `.env.example` for configuration options.

## Development

```bash
npm install
npm run dev
```

## Documentation

See `/diagram-prototypes/DIAGRAM_SCREENSHOT_SERVICE_DESIGN.md` for full design documentation.
