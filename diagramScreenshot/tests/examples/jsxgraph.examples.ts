/**
 * JSXGRAPH RENDERING EXAMPLES
 *
 * This file contains example configurations for JSXGraph geometric diagrams.
 * Use these patterns when generating JSXGraph visualization requests.
 *
 * WHEN TO USE JSXGRAPH:
 * - Coordinate geometry (plotting points, lines, midpoints)
 * - Geometric transformations (translations, rotations, reflections)
 * - Vector diagrams and operations
 * - Interactive geometric constructions
 * - Distance and midpoint visualizations
 * - Gradient calculations with rise/run
 *
 * JSXGRAPH DATA STRUCTURE:
 * - board: Configuration for the coordinate plane (boundingbox, axis, grid)
 * - elements: Array of geometric elements (point, line, polygon, etc.)
 * - Each element has: type, args (coordinates/references), attributes (styling)
 *
 * NATIONAL 5 TOPICS:
 * - Coordinate geometry (straight line equations)
 * - Transformations (reflection, rotation, translation)
 * - Vectors
 * - Distance and midpoint formulas
 */

import type { JSXGraphDiagram, RenderOptions } from '../../src/types/diagram';

/**
 * =============================================================================
 * COORDINATE GEOMETRY - POINTS
 * National 5 Topic: Relationships - Straight Line
 * =============================================================================
 */

/**
 * Example: Plotting Points on a Coordinate Grid
 * Use for: Basic coordinate plotting exercises
 */
export const pointsBasic: JSXGraphDiagram = {
  board: {
    boundingbox: [-6, 6, 6, -6],
    axis: true,
    grid: true,
    showCopyright: false,
    showNavigation: false
  },
  elements: [
    {
      type: 'point',
      id: 'A',
      args: [[2, 3]],
      attributes: { name: 'A(2, 3)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'B',
      args: [[-3, 1]],
      attributes: { name: 'B(-3, 1)', color: '#2d70b3', size: 4 }
    },
    {
      type: 'point',
      id: 'C',
      args: [[1, -4]],
      attributes: { name: 'C(1, -4)', color: '#388c46', size: 4 }
    }
  ]
};

/**
 * Example: Points in All Four Quadrants
 * Use for: Understanding quadrant positions
 */
export const pointsQuadrants: JSXGraphDiagram = {
  board: {
    boundingbox: [-8, 8, 8, -8],
    axis: true,
    grid: true,
    showCopyright: false,
    showNavigation: false
  },
  elements: [
    {
      type: 'point',
      id: 'Q1',
      args: [[4, 5]],
      attributes: { name: 'Quadrant I (4, 5)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'Q2',
      args: [[-4, 5]],
      attributes: { name: 'Quadrant II (-4, 5)', color: '#2d70b3', size: 4 }
    },
    {
      type: 'point',
      id: 'Q3',
      args: [[-4, -5]],
      attributes: { name: 'Quadrant III (-4, -5)', color: '#388c46', size: 4 }
    },
    {
      type: 'point',
      id: 'Q4',
      args: [[4, -5]],
      attributes: { name: 'Quadrant IV (4, -5)', color: '#fa7e19', size: 4 }
    }
  ]
};

/**
 * =============================================================================
 * STRAIGHT LINES
 * National 5 Topic: Relationships - Straight Line
 * =============================================================================
 */

/**
 * Example: Line Through Two Points
 * Use for: Understanding how a line is defined by two points
 */
export const lineTwoPoints: JSXGraphDiagram = {
  board: {
    boundingbox: [-6, 6, 6, -6],
    axis: true,
    grid: true,
    showCopyright: false,
    showNavigation: false
  },
  elements: [
    {
      type: 'point',
      id: 'A',
      args: [[-2, -1]],
      attributes: { name: 'A(-2, -1)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'B',
      args: [[3, 4]],
      attributes: { name: 'B(3, 4)', color: '#c74440', size: 4 }
    },
    {
      type: 'line',
      args: ['A', 'B'],
      attributes: { strokeColor: '#c74440', strokeWidth: 2 }
    }
  ]
};

/**
 * Example: Gradient (Rise/Run) Visualization
 * Use for: Teaching gradient concept
 */
export const lineGradient: JSXGraphDiagram = {
  board: {
    boundingbox: [-2, 8, 10, -2],
    axis: true,
    grid: true,
    showCopyright: false,
    showNavigation: false
  },
  elements: [
    {
      type: 'point',
      id: 'A',
      args: [[1, 2]],
      attributes: { name: 'A(1, 2)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'B',
      args: [[7, 5]],
      attributes: { name: 'B(7, 5)', color: '#c74440', size: 4 }
    },
    {
      type: 'line',
      args: ['A', 'B'],
      attributes: { strokeColor: '#c74440', strokeWidth: 2 }
    },
    // Horizontal line (run)
    {
      type: 'segment',
      id: 'run',
      args: [['A', [7, 2]]],
      attributes: { strokeColor: '#2d70b3', strokeWidth: 2, dash: 2 }
    },
    // Vertical line (rise)
    {
      type: 'segment',
      id: 'rise',
      args: [[[7, 2], 'B']],
      attributes: { strokeColor: '#388c46', strokeWidth: 2, dash: 2 }
    },
    // Label points for rise/run
    {
      type: 'point',
      id: 'corner',
      args: [[7, 2]],
      attributes: { name: '', color: '#6042a6', size: 3 }
    },
    // Text annotations
    {
      type: 'text',
      args: [[4, 1.5, 'Run = 6']],
      attributes: { color: '#2d70b3', fontSize: 14 }
    },
    {
      type: 'text',
      args: [[7.5, 3.5, 'Rise = 3']],
      attributes: { color: '#388c46', fontSize: 14 }
    },
    {
      type: 'text',
      args: [[5, 5.5, 'm = 3/6 = 0.5']],
      attributes: { color: '#c74440', fontSize: 16 }
    }
  ]
};

/**
 * Example: Parallel Lines (Same Gradient)
 * Use for: Understanding parallel lines have equal gradients
 */
export const linesParallel: JSXGraphDiagram = {
  board: {
    boundingbox: [-6, 8, 8, -4],
    axis: true,
    grid: true,
    showCopyright: false,
    showNavigation: false
  },
  elements: [
    // Line 1: y = 2x + 1
    {
      type: 'point',
      id: 'A1',
      args: [[0, 1]],
      attributes: { name: '(0, 1)', color: '#c74440', size: 3 }
    },
    {
      type: 'point',
      id: 'B1',
      args: [[2, 5]],
      attributes: { name: '(2, 5)', color: '#c74440', size: 3 }
    },
    {
      type: 'line',
      args: ['A1', 'B1'],
      attributes: { strokeColor: '#c74440', strokeWidth: 2, name: 'y = 2x + 1' }
    },
    // Line 2: y = 2x - 2
    {
      type: 'point',
      id: 'A2',
      args: [[0, -2]],
      attributes: { name: '(0, -2)', color: '#2d70b3', size: 3 }
    },
    {
      type: 'point',
      id: 'B2',
      args: [[2, 2]],
      attributes: { name: '(2, 2)', color: '#2d70b3', size: 3 }
    },
    {
      type: 'line',
      args: ['A2', 'B2'],
      attributes: { strokeColor: '#2d70b3', strokeWidth: 2, name: 'y = 2x - 2' }
    },
    {
      type: 'text',
      args: [[-4, 6, 'Both lines have gradient m = 2']],
      attributes: { color: '#000000', fontSize: 14 }
    }
  ]
};

/**
 * Example: Perpendicular Lines (m₁ × m₂ = -1)
 * Use for: Understanding perpendicular line gradients
 */
export const linesPerpendicular: JSXGraphDiagram = {
  board: {
    boundingbox: [-6, 6, 6, -6],
    axis: true,
    grid: true,
    showCopyright: false,
    showNavigation: false
  },
  elements: [
    // Line 1: gradient = 2
    {
      type: 'point',
      id: 'A1',
      args: [[-3, -4]],
      attributes: { name: '', color: '#c74440', size: 3 }
    },
    {
      type: 'point',
      id: 'B1',
      args: [[3, 4]],
      attributes: { name: '', color: '#c74440', size: 3 }
    },
    {
      type: 'line',
      args: ['A1', 'B1'],
      attributes: { strokeColor: '#c74440', strokeWidth: 2 }
    },
    // Line 2: gradient = -1/2
    {
      type: 'point',
      id: 'A2',
      args: [[-4, 2]],
      attributes: { name: '', color: '#2d70b3', size: 3 }
    },
    {
      type: 'point',
      id: 'B2',
      args: [[4, -2]],
      attributes: { name: '', color: '#2d70b3', size: 3 }
    },
    {
      type: 'line',
      args: ['A2', 'B2'],
      attributes: { strokeColor: '#2d70b3', strokeWidth: 2 }
    },
    {
      type: 'text',
      args: [[2, 5, 'm₁ = 4/3']],
      attributes: { color: '#c74440', fontSize: 14 }
    },
    {
      type: 'text',
      args: [[2, -4, 'm₂ = -1/2']],
      attributes: { color: '#2d70b3', fontSize: 14 }
    }
  ]
};

/**
 * =============================================================================
 * MIDPOINT AND DISTANCE
 * National 5 Topic: Relationships - Coordinate Geometry
 * =============================================================================
 */

/**
 * Example: Midpoint of a Line Segment
 * Use for: Teaching midpoint formula
 */
export const midpoint: JSXGraphDiagram = {
  board: {
    boundingbox: [-2, 8, 10, -2],
    axis: true,
    grid: true,
    showCopyright: false,
    showNavigation: false
  },
  elements: [
    {
      type: 'point',
      id: 'A',
      args: [[1, 2]],
      attributes: { name: 'A(1, 2)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'B',
      args: [[7, 6]],
      attributes: { name: 'B(7, 6)', color: '#c74440', size: 4 }
    },
    {
      type: 'segment',
      args: ['A', 'B'],
      attributes: { strokeColor: '#c74440', strokeWidth: 2 }
    },
    {
      type: 'midpoint',
      id: 'M',
      args: ['A', 'B'],
      attributes: { name: 'M(4, 4)', color: '#388c46', size: 5 }
    },
    {
      type: 'text',
      args: [[5, 2, 'M = ((1+7)/2, (2+6)/2) = (4, 4)']],
      attributes: { color: '#388c46', fontSize: 14 }
    }
  ]
};

/**
 * Example: Distance Between Two Points
 * Use for: Teaching distance formula
 */
export const distance: JSXGraphDiagram = {
  board: {
    boundingbox: [-2, 8, 10, -2],
    axis: true,
    grid: true,
    showCopyright: false,
    showNavigation: false
  },
  elements: [
    {
      type: 'point',
      id: 'A',
      args: [[2, 1]],
      attributes: { name: 'A(2, 1)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'B',
      args: [[8, 5]],
      attributes: { name: 'B(8, 5)', color: '#c74440', size: 4 }
    },
    {
      type: 'segment',
      args: ['A', 'B'],
      attributes: { strokeColor: '#c74440', strokeWidth: 2 }
    },
    // Right triangle for visualization
    {
      type: 'segment',
      args: ['A', [8, 1]],
      attributes: { strokeColor: '#2d70b3', strokeWidth: 2, dash: 2 }
    },
    {
      type: 'segment',
      args: [[8, 1], 'B'],
      attributes: { strokeColor: '#388c46', strokeWidth: 2, dash: 2 }
    },
    {
      type: 'point',
      id: 'C',
      args: [[8, 1]],
      attributes: { name: '', color: '#6042a6', size: 3 }
    },
    {
      type: 'text',
      args: [[5, 0.5, '6']],
      attributes: { color: '#2d70b3', fontSize: 14 }
    },
    {
      type: 'text',
      args: [[8.5, 3, '4']],
      attributes: { color: '#388c46', fontSize: 14 }
    },
    {
      type: 'text',
      args: [[4, 4, 'd = √(6² + 4²) = √52']],
      attributes: { color: '#c74440', fontSize: 14 }
    }
  ]
};

/**
 * =============================================================================
 * TRIANGLES AND POLYGONS
 * National 5 Topic: Geometry
 * =============================================================================
 */

/**
 * Example: Triangle with Vertices
 * Use for: Basic polygon construction
 */
export const triangleBasic: JSXGraphDiagram = {
  board: {
    boundingbox: [-2, 8, 10, -2],
    axis: true,
    grid: true,
    showCopyright: false,
    showNavigation: false
  },
  elements: [
    {
      type: 'point',
      id: 'A',
      args: [[1, 1]],
      attributes: { name: 'A(1, 1)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'B',
      args: [[7, 1]],
      attributes: { name: 'B(7, 1)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'C',
      args: [[4, 6]],
      attributes: { name: 'C(4, 6)', color: '#c74440', size: 4 }
    },
    {
      type: 'polygon',
      args: ['A', 'B', 'C'],
      attributes: {
        fillColor: '#c74440',
        fillOpacity: 0.2,
        borders: { strokeColor: '#c74440', strokeWidth: 2 }
      }
    }
  ]
};

/**
 * =============================================================================
 * TRANSFORMATIONS - REFLECTION
 * National 5 Topic: Geometry - Transformations
 * =============================================================================
 */

/**
 * Example: Reflection in the X-Axis
 * Use for: Teaching reflection transformations
 */
export const reflectionXAxis: JSXGraphDiagram = {
  board: {
    boundingbox: [-6, 8, 8, -8],
    axis: true,
    grid: true,
    showCopyright: false,
    showNavigation: false
  },
  elements: [
    // Original triangle
    {
      type: 'point',
      id: 'A',
      args: [[1, 2]],
      attributes: { name: 'A(1, 2)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'B',
      args: [[4, 2]],
      attributes: { name: 'B(4, 2)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'C',
      args: [[2, 5]],
      attributes: { name: 'C(2, 5)', color: '#c74440', size: 4 }
    },
    {
      type: 'polygon',
      args: ['A', 'B', 'C'],
      attributes: {
        fillColor: '#c74440',
        fillOpacity: 0.3,
        borders: { strokeColor: '#c74440', strokeWidth: 2 }
      }
    },
    // Reflected triangle
    {
      type: 'point',
      id: 'A_prime',
      args: [[1, -2]],
      attributes: { name: "A'(1, -2)", color: '#2d70b3', size: 4 }
    },
    {
      type: 'point',
      id: 'B_prime',
      args: [[4, -2]],
      attributes: { name: "B'(4, -2)", color: '#2d70b3', size: 4 }
    },
    {
      type: 'point',
      id: 'C_prime',
      args: [[2, -5]],
      attributes: { name: "C'(2, -5)", color: '#2d70b3', size: 4 }
    },
    {
      type: 'polygon',
      args: ['A_prime', 'B_prime', 'C_prime'],
      attributes: {
        fillColor: '#2d70b3',
        fillOpacity: 0.3,
        borders: { strokeColor: '#2d70b3', strokeWidth: 2 }
      }
    },
    {
      type: 'text',
      args: [[-4, 6, 'Reflection in y = 0 (x-axis)']],
      attributes: { color: '#000000', fontSize: 14 }
    }
  ]
};

/**
 * Example: Reflection in the Y-Axis
 * Use for: Teaching reflection transformations
 */
export const reflectionYAxis: JSXGraphDiagram = {
  board: {
    boundingbox: [-8, 8, 8, -4],
    axis: true,
    grid: true,
    showCopyright: false,
    showNavigation: false
  },
  elements: [
    // Original shape
    {
      type: 'point',
      id: 'A',
      args: [[2, 1]],
      attributes: { name: 'A(2, 1)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'B',
      args: [[5, 1]],
      attributes: { name: 'B(5, 1)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'C',
      args: [[5, 4]],
      attributes: { name: 'C(5, 4)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'D',
      args: [[2, 4]],
      attributes: { name: 'D(2, 4)', color: '#c74440', size: 4 }
    },
    {
      type: 'polygon',
      args: ['A', 'B', 'C', 'D'],
      attributes: {
        fillColor: '#c74440',
        fillOpacity: 0.3,
        borders: { strokeColor: '#c74440', strokeWidth: 2 }
      }
    },
    // Reflected shape
    {
      type: 'point',
      id: 'A_prime',
      args: [[-2, 1]],
      attributes: { name: "A'(-2, 1)", color: '#2d70b3', size: 4 }
    },
    {
      type: 'point',
      id: 'B_prime',
      args: [[-5, 1]],
      attributes: { name: "B'(-5, 1)", color: '#2d70b3', size: 4 }
    },
    {
      type: 'point',
      id: 'C_prime',
      args: [[-5, 4]],
      attributes: { name: "C'(-5, 4)", color: '#2d70b3', size: 4 }
    },
    {
      type: 'point',
      id: 'D_prime',
      args: [[-2, 4]],
      attributes: { name: "D'(-2, 4)", color: '#2d70b3', size: 4 }
    },
    {
      type: 'polygon',
      args: ['A_prime', 'B_prime', 'C_prime', 'D_prime'],
      attributes: {
        fillColor: '#2d70b3',
        fillOpacity: 0.3,
        borders: { strokeColor: '#2d70b3', strokeWidth: 2 }
      }
    },
    {
      type: 'text',
      args: [[-6, 7, 'Reflection in x = 0 (y-axis)']],
      attributes: { color: '#000000', fontSize: 14 }
    }
  ]
};

/**
 * =============================================================================
 * TRANSFORMATIONS - TRANSLATION
 * National 5 Topic: Geometry - Transformations
 * =============================================================================
 */

/**
 * Example: Translation by a Vector
 * Use for: Teaching translation transformations
 */
export const translation: JSXGraphDiagram = {
  board: {
    boundingbox: [-2, 10, 12, -2],
    axis: true,
    grid: true,
    showCopyright: false,
    showNavigation: false
  },
  elements: [
    // Original triangle
    {
      type: 'point',
      id: 'A',
      args: [[1, 1]],
      attributes: { name: 'A(1, 1)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'B',
      args: [[4, 1]],
      attributes: { name: 'B(4, 1)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'C',
      args: [[2, 3]],
      attributes: { name: 'C(2, 3)', color: '#c74440', size: 4 }
    },
    {
      type: 'polygon',
      args: ['A', 'B', 'C'],
      attributes: {
        fillColor: '#c74440',
        fillOpacity: 0.3,
        borders: { strokeColor: '#c74440', strokeWidth: 2 }
      }
    },
    // Translated triangle (vector [5, 4])
    {
      type: 'point',
      id: 'A_prime',
      args: [[6, 5]],
      attributes: { name: "A'(6, 5)", color: '#2d70b3', size: 4 }
    },
    {
      type: 'point',
      id: 'B_prime',
      args: [[9, 5]],
      attributes: { name: "B'(9, 5)", color: '#2d70b3', size: 4 }
    },
    {
      type: 'point',
      id: 'C_prime',
      args: [[7, 7]],
      attributes: { name: "C'(7, 7)", color: '#2d70b3', size: 4 }
    },
    {
      type: 'polygon',
      args: ['A_prime', 'B_prime', 'C_prime'],
      attributes: {
        fillColor: '#2d70b3',
        fillOpacity: 0.3,
        borders: { strokeColor: '#2d70b3', strokeWidth: 2 }
      }
    },
    // Translation vector arrow
    {
      type: 'arrow',
      args: ['A', 'A_prime'],
      attributes: { strokeColor: '#388c46', strokeWidth: 2 }
    },
    {
      type: 'text',
      args: [[3, 4, 'Translation vector: (5, 4)']],
      attributes: { color: '#388c46', fontSize: 14 }
    }
  ]
};

/**
 * =============================================================================
 * VECTORS
 * National 5 Topic: Vectors
 * =============================================================================
 */

/**
 * Example: Vector Representation
 * Use for: Understanding vectors as directed line segments
 */
export const vectorBasic: JSXGraphDiagram = {
  board: {
    boundingbox: [-2, 8, 10, -2],
    axis: true,
    grid: true,
    showCopyright: false,
    showNavigation: false
  },
  elements: [
    {
      type: 'point',
      id: 'A',
      args: [[1, 2]],
      attributes: { name: 'A(1, 2)', color: '#c74440', size: 4 }
    },
    {
      type: 'point',
      id: 'B',
      args: [[6, 5]],
      attributes: { name: 'B(6, 5)', color: '#c74440', size: 4 }
    },
    {
      type: 'arrow',
      args: ['A', 'B'],
      attributes: { strokeColor: '#c74440', strokeWidth: 3 }
    },
    {
      type: 'text',
      args: [[3, 5, 'AB = (5, 3)']],
      attributes: { color: '#c74440', fontSize: 16 }
    },
    {
      type: 'text',
      args: [[3, 1, 'Component form: 5i + 3j']],
      attributes: { color: '#2d70b3', fontSize: 14 }
    }
  ]
};

/**
 * Example: Vector Addition (Triangle Rule)
 * Use for: Understanding vector addition
 */
export const vectorAddition: JSXGraphDiagram = {
  board: {
    boundingbox: [-2, 10, 12, -2],
    axis: true,
    grid: true,
    showCopyright: false,
    showNavigation: false
  },
  elements: [
    // Starting point
    {
      type: 'point',
      id: 'O',
      args: [[1, 1]],
      attributes: { name: 'O', color: '#000000', size: 4 }
    },
    // Vector a
    {
      type: 'point',
      id: 'A',
      args: [[5, 3]],
      attributes: { name: 'A', color: '#c74440', size: 4 }
    },
    {
      type: 'arrow',
      id: 'vec_a',
      args: ['O', 'A'],
      attributes: { strokeColor: '#c74440', strokeWidth: 3 }
    },
    // Vector b
    {
      type: 'point',
      id: 'B',
      args: [[8, 7]],
      attributes: { name: 'B', color: '#2d70b3', size: 4 }
    },
    {
      type: 'arrow',
      id: 'vec_b',
      args: ['A', 'B'],
      attributes: { strokeColor: '#2d70b3', strokeWidth: 3 }
    },
    // Resultant a + b
    {
      type: 'arrow',
      id: 'vec_sum',
      args: ['O', 'B'],
      attributes: { strokeColor: '#388c46', strokeWidth: 3, dash: 2 }
    },
    // Labels
    {
      type: 'text',
      args: [[2.5, 3, 'a = (4, 2)']],
      attributes: { color: '#c74440', fontSize: 14 }
    },
    {
      type: 'text',
      args: [[6.5, 6, 'b = (3, 4)']],
      attributes: { color: '#2d70b3', fontSize: 14 }
    },
    {
      type: 'text',
      args: [[3, 6, 'a + b = (7, 6)']],
      attributes: { color: '#388c46', fontSize: 14 }
    }
  ]
};

/**
 * =============================================================================
 * CIRCLES
 * National 5 Topic: Circle Geometry
 * =============================================================================
 */

/**
 * Example: Circle with Center and Radius
 * Use for: Basic circle construction
 */
export const circleBasic: JSXGraphDiagram = {
  board: {
    boundingbox: [-6, 6, 6, -6],
    axis: true,
    grid: true,
    showCopyright: false,
    showNavigation: false,
    keepAspectRatio: true
  },
  elements: [
    {
      type: 'point',
      id: 'center',
      args: [[0, 0]],
      attributes: { name: 'Center (0, 0)', color: '#c74440', size: 4 }
    },
    {
      type: 'circle',
      args: ['center', 3],
      attributes: { strokeColor: '#2d70b3', strokeWidth: 2, fillColor: 'none' }
    },
    {
      type: 'segment',
      args: ['center', [3, 0]],
      attributes: { strokeColor: '#388c46', strokeWidth: 2 }
    },
    {
      type: 'text',
      args: [[1.5, -0.5, 'r = 3']],
      attributes: { color: '#388c46', fontSize: 14 }
    }
  ]
};

/**
 * =============================================================================
 * RENDER OPTIONS REFERENCE
 * =============================================================================
 */

/**
 * Standard render options for different diagram types
 */
export const renderOptions: Record<string, RenderOptions> = {
  standard: {
    width: 800,
    height: 600,
    format: 'png',
    scale: 2
  },
  square: {
    width: 600,
    height: 600,
    format: 'png',
    scale: 2
  },
  wide: {
    width: 1000,
    height: 500,
    format: 'png',
    scale: 2
  }
};

/**
 * =============================================================================
 * COLOR PALETTE
 * =============================================================================
 */
export const JSXGRAPH_COLORS = {
  red: '#c74440',
  blue: '#2d70b3',
  green: '#388c46',
  orange: '#fa7e19',
  purple: '#6042a6',
  black: '#000000',
  gray: '#95a5a6'
};

/**
 * =============================================================================
 * HELPER FUNCTIONS
 * =============================================================================
 */

/**
 * Create a point configuration
 */
export function createPoint(
  x: number,
  y: number,
  options: { id?: string; name?: string; color?: string; size?: number } = {}
): { type: string; id?: string; args: any[]; attributes: Record<string, any> } {
  return {
    type: 'point',
    id: options.id,
    args: [[x, y]],
    attributes: {
      name: options.name || `(${x}, ${y})`,
      color: options.color || JSXGRAPH_COLORS.red,
      size: options.size || 4
    }
  };
}

/**
 * Create a line through two points
 */
export function createLine(
  point1Id: string,
  point2Id: string,
  options: { color?: string; width?: number; dash?: number } = {}
): { type: string; args: string[]; attributes: Record<string, any> } {
  return {
    type: 'line',
    args: [point1Id, point2Id],
    attributes: {
      strokeColor: options.color || JSXGRAPH_COLORS.red,
      strokeWidth: options.width || 2,
      dash: options.dash
    }
  };
}

/**
 * Create a standard coordinate board configuration
 */
export function createBoard(
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number,
  options: { axis?: boolean; grid?: boolean } = {}
): { boundingbox: [number, number, number, number]; axis: boolean; grid: boolean; showCopyright: boolean; showNavigation: boolean } {
  return {
    boundingbox: [xmin, ymax, xmax, ymin],
    axis: options.axis !== false,
    grid: options.grid !== false,
    showCopyright: false,
    showNavigation: false
  };
}
