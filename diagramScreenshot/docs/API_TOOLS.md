# Diagram Rendering Service - AI Agent Tool Definitions

This document provides API specifications for integrating the Diagram Rendering Service as tools for AI agents. Each tool can be used to generate mathematical diagrams and educational images for Scottish National 5 Mathematics curriculum.

## Base URL

```
http://localhost:3000
```

## Authentication

All render endpoints require an API key header:
```
X-API-Key: your-api-key
```

---

## Tool 1: Plotly Charts

**Endpoint:** `POST /api/v1/render/plotly`

**Description:** Renders statistical charts using Plotly. Best for bar charts, line graphs, scatter plots, histograms, pie charts, and box plots.

### Tool Schema (for AI Agent)

```json
{
  "name": "render_plotly_chart",
  "description": "Render statistical charts (bar, line, scatter, histogram, pie, box plots) for National 5 Mathematics. Returns base64-encoded PNG image.",
  "parameters": {
    "type": "object",
    "required": ["chart"],
    "properties": {
      "chart": {
        "type": "object",
        "required": ["data"],
        "properties": {
          "data": {
            "type": "array",
            "description": "Array of trace objects defining the chart data",
            "items": {
              "type": "object",
              "required": ["type"],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": ["scatter", "bar", "pie", "histogram", "box", "heatmap", "line"],
                  "description": "Chart type"
                },
                "x": {
                  "type": "array",
                  "description": "X-axis values (numbers or strings)"
                },
                "y": {
                  "type": "array",
                  "description": "Y-axis values (numbers)"
                },
                "values": {
                  "type": "array",
                  "description": "Values for pie charts"
                },
                "labels": {
                  "type": "array",
                  "description": "Labels for pie charts"
                },
                "name": {
                  "type": "string",
                  "description": "Trace name for legend"
                },
                "mode": {
                  "type": "string",
                  "enum": ["lines", "markers", "lines+markers", "text", "none"],
                  "description": "Display mode for scatter/line charts"
                },
                "marker": {
                  "type": "object",
                  "properties": {
                    "color": { "type": "string" },
                    "size": { "type": "number" }
                  }
                }
              }
            }
          },
          "layout": {
            "type": "object",
            "properties": {
              "title": { "type": "string", "description": "Chart title" },
              "xaxis": {
                "type": "object",
                "properties": {
                  "title": { "type": "string" },
                  "range": { "type": "array", "items": { "type": "number" } }
                }
              },
              "yaxis": {
                "type": "object",
                "properties": {
                  "title": { "type": "string" },
                  "range": { "type": "array", "items": { "type": "number" } }
                }
              },
              "showlegend": { "type": "boolean" },
              "barmode": { "type": "string", "enum": ["group", "stack"] }
            }
          }
        }
      },
      "options": {
        "type": "object",
        "properties": {
          "width": { "type": "integer", "default": 800, "minimum": 100, "maximum": 4000 },
          "height": { "type": "integer", "default": 600, "minimum": 100, "maximum": 4000 },
          "format": { "type": "string", "enum": ["png", "jpeg"], "default": "png" },
          "scale": { "type": "number", "default": 2, "minimum": 1, "maximum": 4 }
        }
      }
    }
  }
}
```

### Example Request

```json
{
  "chart": {
    "data": [{
      "type": "bar",
      "x": ["Mon", "Tue", "Wed", "Thu", "Fri"],
      "y": [20, 14, 25, 22, 18],
      "name": "Weekly Sales",
      "marker": { "color": "#3498db" }
    }],
    "layout": {
      "title": "Weekly Sales Data",
      "xaxis": { "title": "Day" },
      "yaxis": { "title": "Units Sold" }
    }
  },
  "options": {
    "width": 800,
    "height": 600
  }
}
```

### Response

```json
{
  "success": true,
  "image": "<base64-encoded-png>",
  "metadata": {
    "tool": "plotly",
    "width": 800,
    "height": 600,
    "format": "png",
    "traceCount": 1,
    "renderTimeMs": 1234
  }
}
```

---

## Tool 2: Desmos Graphs

**Endpoint:** `POST /api/v1/render/desmos/simple`

**Description:** Renders mathematical function graphs using Desmos calculator. Best for algebra, functions, and coordinate geometry.

### Tool Schema (for AI Agent)

```json
{
  "name": "render_desmos_graph",
  "description": "Render mathematical function graphs using Desmos. Supports LaTeX equations. Best for linear, quadratic, trigonometric, and other mathematical functions.",
  "parameters": {
    "type": "object",
    "required": ["expressions"],
    "properties": {
      "expressions": {
        "type": "array",
        "description": "Array of mathematical expressions in LaTeX format",
        "items": {
          "type": "object",
          "required": ["latex"],
          "properties": {
            "latex": {
              "type": "string",
              "description": "LaTeX expression (e.g., 'y=2x+3', 'y=x^2', 'y=\\sin(x)')"
            },
            "color": {
              "type": "string",
              "description": "Color in hex format (e.g., '#ff0000')"
            },
            "lineStyle": {
              "type": "string",
              "enum": ["SOLID", "DASHED", "DOTTED"]
            },
            "lineWidth": {
              "type": "number",
              "minimum": 0,
              "maximum": 20
            },
            "label": {
              "type": "string",
              "description": "Label to show on the graph"
            },
            "showLabel": {
              "type": "boolean"
            }
          }
        }
      },
      "viewport": {
        "type": "object",
        "description": "Visible area of the graph",
        "properties": {
          "xmin": { "type": "number", "default": -10 },
          "xmax": { "type": "number", "default": 10 },
          "ymin": { "type": "number", "default": -10 },
          "ymax": { "type": "number", "default": 10 }
        }
      },
      "settings": {
        "type": "object",
        "properties": {
          "showGrid": { "type": "boolean", "default": true },
          "showXAxis": { "type": "boolean", "default": true },
          "showYAxis": { "type": "boolean", "default": true },
          "degreeMode": { "type": "boolean", "default": false }
        }
      },
      "options": {
        "type": "object",
        "properties": {
          "width": { "type": "integer", "default": 800 },
          "height": { "type": "integer", "default": 600 },
          "format": { "type": "string", "enum": ["png", "jpeg"], "default": "png" }
        }
      }
    }
  }
}
```

### Example Request

```json
{
  "expressions": [
    { "latex": "y=2x+1", "color": "#2196F3", "label": "y = 2x + 1", "showLabel": true },
    { "latex": "y=-x+4", "color": "#E91E63", "label": "y = -x + 4", "showLabel": true }
  ],
  "viewport": {
    "xmin": -5,
    "xmax": 5,
    "ymin": -5,
    "ymax": 10
  },
  "settings": {
    "showGrid": true
  },
  "options": {
    "width": 800,
    "height": 600
  }
}
```

### Response

```json
{
  "success": true,
  "image": "<base64-encoded-png>",
  "metadata": {
    "tool": "desmos",
    "expressionCount": 2,
    "renderTimeMs": 1500
  }
}
```

---

## Tool 3: GeoGebra Geometry

**Endpoint:** `POST /api/v1/render/geogebra/simple`

**Description:** Renders geometric constructions using GeoGebra. Best for circle theorems, geometric proofs, angle properties, and constructions.

### Tool Schema (for AI Agent)

```json
{
  "name": "render_geogebra_geometry",
  "description": "Render geometric constructions using GeoGebra. Best for circle theorems, triangles, angles, perpendicular bisectors, and geometric proofs.",
  "parameters": {
    "type": "object",
    "required": ["commands"],
    "properties": {
      "commands": {
        "type": "array",
        "description": "Array of GeoGebra commands to execute in order",
        "items": {
          "type": "string",
          "description": "GeoGebra command (e.g., 'A = (0, 0)', 'c = Circle(A, 3)', 'Segment(A, B)')"
        }
      },
      "coordSystem": {
        "type": "object",
        "description": "Coordinate system bounds",
        "properties": {
          "xmin": { "type": "number", "default": -10 },
          "xmax": { "type": "number", "default": 10 },
          "ymin": { "type": "number", "default": -10 },
          "ymax": { "type": "number", "default": 10 }
        }
      },
      "showAxes": {
        "type": "boolean",
        "default": false,
        "description": "Whether to show coordinate axes"
      },
      "showGrid": {
        "type": "boolean",
        "default": false,
        "description": "Whether to show grid lines"
      },
      "options": {
        "type": "object",
        "properties": {
          "width": { "type": "integer", "default": 800 },
          "height": { "type": "integer", "default": 600 },
          "format": { "type": "string", "enum": ["png", "jpeg"], "default": "png" }
        }
      }
    }
  }
}
```

### Common GeoGebra Commands

| Command | Description | Example |
|---------|-------------|---------|
| Point | Create a point | `A = (0, 0)` or `A = Point(0, 0)` |
| Circle | Circle with center and radius | `c = Circle(A, 3)` |
| Circle through 3 points | `c = Circle(A, B, C)` |
| Segment | Line segment | `Segment(A, B)` |
| Line | Infinite line | `Line(A, B)` |
| Perpendicular | Perpendicular line | `Perpendicular(A, line)` |
| Midpoint | Midpoint of segment | `M = Midpoint(A, B)` |
| Angle | Create angle | `Angle(A, B, C)` |
| Polygon | Create polygon | `Polygon(A, B, C)` |
| Intersect | Find intersections | `Intersect(c1, c2)` |
| PerpendicularBisector | Perpendicular bisector | `PerpendicularBisector(A, B)` |
| AngleBisector | Angle bisector | `AngleBisector(A, B, C)` |
| Tangent | Tangent to circle | `Tangent(P, c)` |
| Arc | Circular arc | `Arc(c, A, B)` |

### Example Request: Circle Theorem (Angle at Centre)

```json
{
  "commands": [
    "O = (0, 0)",
    "c = Circle(O, 4)",
    "A = Point(c)",
    "B = Point(c)",
    "P = Point(c)",
    "Segment(O, A)",
    "Segment(O, B)",
    "Segment(P, A)",
    "Segment(P, B)",
    "angleAtCentre = Angle(A, O, B)",
    "angleAtCircumference = Angle(A, P, B)"
  ],
  "coordSystem": {
    "xmin": -6,
    "xmax": 6,
    "ymin": -6,
    "ymax": 6
  },
  "showAxes": false,
  "showGrid": false,
  "options": {
    "width": 600,
    "height": 600
  }
}
```

### Response

```json
{
  "success": true,
  "image": "<base64-encoded-png>",
  "metadata": {
    "tool": "geogebra",
    "commandCount": 11,
    "appType": "geometry",
    "renderTimeMs": 2500
  }
}
```

---

## Tool 4: Imagen (AI Image Generation)

**Endpoint:** `POST /api/v1/render/imagen`

**Description:** Generates educational images using Google's Gemini AI model. Best for real-world mathematical applications and context illustrations.

### Tool Schema (for AI Agent)

```json
{
  "name": "generate_educational_image",
  "description": "Generate AI educational images for real-world math applications. Use for contextual illustrations showing math in everyday scenarios (architecture, sports, nature, etc.).",
  "parameters": {
    "type": "object",
    "required": ["prompt"],
    "properties": {
      "prompt": {
        "type": "object",
        "required": ["text"],
        "properties": {
          "text": {
            "type": "string",
            "description": "Detailed description of the image to generate (10-2000 chars)",
            "minLength": 10,
            "maxLength": 2000
          },
          "context": {
            "type": "string",
            "description": "Additional context about how the image will be used"
          },
          "style": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "enum": ["realistic", "diagram", "illustration", "simple"],
                "description": "Visual style of the image"
              },
              "colorScheme": {
                "type": "string",
                "enum": ["full-color", "muted", "monochrome"]
              },
              "perspective": {
                "type": "string",
                "enum": ["front", "side", "top", "isometric", "aerial"]
              }
            }
          },
          "educational": {
            "type": "object",
            "properties": {
              "subject": { "type": "string", "description": "e.g., 'Mathematics'" },
              "level": { "type": "string", "description": "e.g., 'National 5'" },
              "topic": { "type": "string", "description": "e.g., 'Pythagoras Theorem'" }
            }
          },
          "negativePrompt": {
            "type": "string",
            "description": "Things to avoid in the image"
          }
        }
      },
      "options": {
        "type": "object",
        "properties": {
          "width": { "type": "integer", "default": 1024, "minimum": 256, "maximum": 2048 },
          "height": { "type": "integer", "default": 1024, "minimum": 256, "maximum": 2048 },
          "numberOfImages": { "type": "integer", "default": 1, "minimum": 1, "maximum": 4 }
        }
      }
    }
  }
}
```

### Example Request

```json
{
  "prompt": {
    "text": "A construction worker using a measuring tape to measure the diagonal of a rectangular floor tile, demonstrating the practical application of Pythagoras theorem in tiling work",
    "context": "For teaching Pythagoras theorem applications",
    "style": {
      "type": "realistic",
      "colorScheme": "full-color",
      "perspective": "isometric"
    },
    "educational": {
      "subject": "Mathematics",
      "level": "National 5",
      "topic": "Pythagoras Theorem"
    },
    "negativePrompt": "text, labels, formulas, equations"
  },
  "options": {
    "width": 1024,
    "height": 1024,
    "numberOfImages": 1
  }
}
```

### Response

```json
{
  "success": true,
  "images": [
    {
      "image": "<base64-encoded-image>",
      "mimeType": "image/png"
    }
  ],
  "metadata": {
    "tool": "imagen",
    "model": "gemini-3-pro-image-preview",
    "prompt": "A construction worker...",
    "imageCount": 1,
    "renderTimeMs": 5000
  }
}
```

### Rate Limits

- 10 requests per minute per IP address
- Returns `429 Too Many Requests` if exceeded

---

## Tool 5: JSXGraph (Advanced Geometry)

**Endpoint:** `POST /api/v1/render`

**Description:** Original JSXGraph renderer for interactive geometry. More verbose but offers fine-grained control.

### Tool Schema (for AI Agent)

```json
{
  "name": "render_jsxgraph",
  "description": "Render advanced geometric diagrams using JSXGraph. Offers fine-grained control over every element.",
  "parameters": {
    "type": "object",
    "required": ["diagram"],
    "properties": {
      "diagram": {
        "type": "object",
        "required": ["board", "elements"],
        "properties": {
          "board": {
            "type": "object",
            "properties": {
              "boundingbox": {
                "type": "array",
                "items": { "type": "number" },
                "description": "[left, top, right, bottom]"
              },
              "axis": { "type": "boolean" },
              "grid": { "type": "boolean" }
            }
          },
          "elements": {
            "type": "array",
            "description": "Array of JSXGraph elements",
            "items": {
              "type": "object",
              "required": ["type"],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": ["point", "line", "segment", "circle", "polygon", "angle", "text", "arrow", "arc"]
                },
                "name": { "type": "string" },
                "coords": { "type": "array" },
                "attributes": { "type": "object" }
              }
            }
          }
        }
      },
      "options": {
        "type": "object",
        "properties": {
          "width": { "type": "integer", "default": 800 },
          "height": { "type": "integer", "default": 600 },
          "format": { "type": "string", "enum": ["png", "jpeg"] }
        }
      }
    }
  }
}
```

---

## Tool Selection Guide for AI Agents

| Math Topic | Recommended Tool | Reason |
|------------|------------------|--------|
| Bar charts, pie charts | `render_plotly_chart` | Best for statistical data visualization |
| Line graphs, scatter plots | `render_plotly_chart` | Handles correlation and trends well |
| Histograms, box plots | `render_plotly_chart` | Statistical distribution charts |
| Linear equations (y=mx+c) | `render_desmos_graph` | Clean function graphing |
| Quadratic functions | `render_desmos_graph` | Shows parabolas clearly |
| Simultaneous equations | `render_desmos_graph` | Shows intersection points |
| Trigonometric functions | `render_desmos_graph` | Handles sin, cos, tan |
| Circle theorems | `render_geogebra_geometry` | Geometric constructions |
| Angle properties | `render_geogebra_geometry` | Angle measurement and display |
| Triangle constructions | `render_geogebra_geometry` | Precise geometric shapes |
| Perpendicular bisectors | `render_geogebra_geometry` | Construction tools |
| Real-world applications | `generate_educational_image` | Contextual illustrations |
| Word problem scenarios | `generate_educational_image` | Visual context for problems |

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional details (optional)"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request format |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `RENDERER_NOT_INITIALIZED` | 503 | Service not ready |
| `RENDER_ERROR` | 500 | Rendering failed |
| `IMAGEN_SAFETY_BLOCK` | 400 | Content blocked by safety filters |
| `IMAGEN_NOT_CONFIGURED` | 503 | Imagen API key not set |

---

## Health Check

**Endpoint:** `GET /health`

Returns service status and renderer availability:

```json
{
  "status": "healthy",
  "renderers": {
    "jsxgraph": { "initialized": true },
    "plotly": { "initialized": true },
    "desmos": { "initialized": true },
    "geogebra": { "initialized": true },
    "imagen": { "configured": true, "note": "ready" }
  }
}
```
