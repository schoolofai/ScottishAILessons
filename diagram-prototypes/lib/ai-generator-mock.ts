import { JSXGraphDiagram } from './diagram-schemas';
import { PYTHAGOREAN_THEOREM, INTERACTIVE_CIRCLE, QUADRATIC_FUNCTION } from './example-diagrams';

export function generateDiagramFromPrompt(prompt: string): JSXGraphDiagram {
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes("pythagorean")) {
    return PYTHAGOREAN_THEOREM;
  } else if (lowerPrompt.includes("circle")) {
    return INTERACTIVE_CIRCLE;
  } else if (lowerPrompt.includes("quadratic") || lowerPrompt.includes("parabola")) {
    return QUADRATIC_FUNCTION;
  }

  return {
    title: "Coordinate Plane",
    description: "Basic coordinate system",
    board: {
      boundingbox: [-10, 10, 10, -10],
      axis: true,
      showCopyright: false
    },
    elements: []
  };
}

export function generatePythagoreanTheorem(a: number = 3, b: number = 4): JSXGraphDiagram {
  const c = Math.sqrt(a * a + b * b);
  const title = "Pythagorean Theorem: " + a + "² + " + b + "² = " + c.toFixed(2) + "²";

  return {
    title: title,
    description: "Drag points to explore different right triangles.",
    metadata: {
      subject: "geometry",
      difficulty: "medium",
      interactivity: "draggable",
      learningObjective: "Understand Pythagorean theorem through visual proof"
    },
    board: {
      boundingbox: [-1, Math.max(a, b) + 2, Math.max(a, b) + 2, -1],
      axis: true,
      showCopyright: false,
      keepAspectRatio: true,
      grid: true
    },
    elements: [
      {
        type: "point",
        args: [0, 0],
        attributes: { name: "A", fixed: true, size: 5, fillColor: "#333" },
        id: "pointA"
      },
      {
        type: "point",
        args: [a, 0],
        attributes: { name: "B", size: 5, fillColor: "#0066cc" },
        id: "pointB"
      },
      {
        type: "point",
        args: [0, b],
        attributes: { name: "C", size: 5, fillColor: "#0066cc" },
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
      }
    ]
  };
}

export function generateCircleDiagram(radius: number = 3): JSXGraphDiagram {
  return {
    title: "Interactive Circle",
    description: "Drag the radius point to change the circle size.",
    metadata: {
      subject: "geometry",
      difficulty: "easy",
      interactivity: "draggable"
    },
    board: {
      boundingbox: [-radius - 3, radius + 3, radius + 3, -radius - 3],
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
        args: [radius, 0],
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
      }
    ]
  };
}
