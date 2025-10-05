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
        "() => { const R = board.select('R'); const O = board.select('O'); const r = Math.sqrt(Math.pow(R.X() - O.X(), 2) + Math.pow(R.Y() - O.Y(), 2)); return `Radius: ${r.toFixed(2)}\\nArea: ${(Math.PI * r * r).toFixed(2)}\\nCircumference: ${(2 * Math.PI * r).toFixed(2)}`; }"
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
      args: ["x * x", -6, 6],
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
