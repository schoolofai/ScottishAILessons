/**
 * DESMOS RENDERING EXAMPLES
 *
 * This file contains example configurations for the Desmos graphing calculator API.
 * Use these patterns when generating Desmos visualization requests.
 *
 * WHEN TO USE DESMOS:
 * - Plotting functions: linear (y = mx + c), quadratic (y = ax² + bx + c), trigonometric
 * - Exploring function transformations (shifts, stretches, reflections of graphs)
 * - Finding roots, intercepts, or intersections of functions visually
 * - Graphing inequalities and shading regions
 * - Comparing multiple functions on the same axes
 * - Gradient and tangent line visualization
 * - Any request involving "graph", "plot the function", or "sketch the curve"
 *
 * DESMOS LATEX SYNTAX NOTES:
 * - Use \\sin, \\cos, \\tan for trig functions (double backslash in TypeScript strings)
 * - Use \\abs(x) for absolute value, NOT |x|
 * - Use \\sqrt{x} for square root
 * - Use \\frac{a}{b} for fractions
 * - Use \\pi for pi
 * - Use x^2 for exponents (no braces needed for single digit)
 * - Use x^{12} for multi-digit exponents
 * - Use \\left| and \\right| if you prefer bracket notation for absolute value
 * - Piecewise: \\{condition: value, condition: value\\}
 */

import type { DesmosRenderRequest } from '../../src/types/desmos.types';

/**
 * =============================================================================
 * LINEAR FUNCTIONS
 * National 5 Topic: Relationships (Linear)
 * =============================================================================
 */

/**
 * Example: Basic Linear Function (y = mx + c form)
 * Use for: Introducing gradient and y-intercept concepts
 */
export const linearBasic: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y=2x+1', color: '#c74440', lineWidth: 2 }
      ]
    },
    graph: {
      viewport: { xmin: -5, xmax: 5, ymin: -5, ymax: 10 },
      showGrid: true
    }
  }
};

/**
 * Example: Parallel Lines (same gradient, different intercepts)
 * Use for: Demonstrating parallel line properties
 */
export const linearParallel: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y=2x+3', color: '#c74440', lineWidth: 2 },
        { id: '2', latex: 'y=2x-1', color: '#2d70b3', lineWidth: 2 },
        { id: '3', latex: 'y=2x', color: '#388c46', lineWidth: 2 }
      ]
    },
    graph: {
      viewport: { xmin: -5, xmax: 5, ymin: -8, ymax: 10 },
      showGrid: true
    }
  }
};

/**
 * Example: Perpendicular Lines (gradients multiply to -1)
 * Use for: Demonstrating perpendicular line relationships
 */
export const linearPerpendicular: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y=2x+1', color: '#c74440', lineWidth: 2 },
        { id: '2', latex: 'y=-0.5x+3', color: '#2d70b3', lineWidth: 2 }
      ]
    },
    graph: {
      viewport: { xmin: -5, xmax: 7, ymin: -3, ymax: 8 },
      showGrid: true
    }
  }
};

/**
 * Example: Finding Intersection (Simultaneous Equations)
 * Use for: Solving simultaneous equations graphically
 */
export const linearIntersection: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y=2x+1', color: '#c74440', lineWidth: 2 },
        { id: '2', latex: 'y=-x+4', color: '#2d70b3', lineWidth: 2 },
        // Mark the intersection point
        { id: '3', latex: '(1, 3)', color: '#000000' }
      ]
    },
    graph: {
      viewport: { xmin: -5, xmax: 7, ymin: -3, ymax: 10 },
      showGrid: true
    }
  }
};

/**
 * =============================================================================
 * QUADRATIC FUNCTIONS
 * National 5 Topic: Relationships (Quadratic)
 * =============================================================================
 */

/**
 * Example: Basic Parabola (y = x²)
 * Use for: Introducing quadratic shape
 */
export const quadraticBasic: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y=x^2', color: '#c74440', lineWidth: 2 }
      ]
    },
    graph: {
      viewport: { xmin: -5, xmax: 5, ymin: -2, ymax: 10 },
      showGrid: true
    }
  }
};

/**
 * Example: Quadratic with Roots
 * Use for: Finding roots/zeros graphically
 */
export const quadraticWithRoots: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y=x^2-4x+3', color: '#c74440', lineWidth: 2 },
        // Mark the roots
        { id: '2', latex: '(1, 0)', color: '#000000' },
        { id: '3', latex: '(3, 0)', color: '#000000' }
      ]
    },
    graph: {
      viewport: { xmin: -2, xmax: 6, ymin: -2, ymax: 6 },
      showGrid: true
    }
  }
};

/**
 * Example: Vertex Form (y = a(x-h)² + k)
 * Use for: Understanding transformations and turning points
 */
export const quadraticVertexForm: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y=(x-2)^2+3', color: '#c74440', lineWidth: 2 },
        // Mark the vertex
        { id: '2', latex: '(2, 3)', color: '#000000' }
      ]
    },
    graph: {
      viewport: { xmin: -2, xmax: 6, ymin: -1, ymax: 12 },
      showGrid: true
    }
  }
};

/**
 * Example: Comparing Parabolas (Effect of 'a' coefficient)
 * Use for: Exploring how coefficient affects shape
 */
export const quadraticFamily: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y=-2x^2', color: '#c74440', lineWidth: 2 },
        { id: '2', latex: 'y=x^2', color: '#2d70b3', lineWidth: 2 },
        { id: '3', latex: 'y=0.5x^2', color: '#388c46', lineWidth: 2 }
      ]
    },
    graph: {
      viewport: { xmin: -5, xmax: 5, ymin: -10, ymax: 10 },
      showGrid: true
    }
  }
};

/**
 * Example: Quadratic-Linear Intersection
 * Use for: Finding where a line meets a parabola
 */
export const quadraticLinearIntersection: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y=x^2', color: '#c74440', lineWidth: 2 },
        { id: '2', latex: 'y=x+2', color: '#2d70b3', lineWidth: 2 },
        // Mark intersection points
        { id: '3', latex: '(2, 4)', color: '#000000' },
        { id: '4', latex: '(-1, 1)', color: '#000000' }
      ]
    },
    graph: {
      viewport: { xmin: -4, xmax: 5, ymin: -2, ymax: 10 },
      showGrid: true
    }
  }
};

/**
 * =============================================================================
 * TRIGONOMETRIC FUNCTIONS
 * National 5 Topic: Trigonometry (Graphs)
 * =============================================================================
 */

/**
 * Example: Basic Sine Wave
 * Use for: Introducing y = sin(x)
 */
export const trigSine: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y=\\sin(x)', color: '#2d70b3', lineWidth: 2 }
      ]
    },
    graph: {
      viewport: { xmin: -6.28, xmax: 6.28, ymin: -1.5, ymax: 1.5 },
      showGrid: true
    }
  }
};

/**
 * Example: Sine and Cosine Comparison
 * Use for: Showing phase relationship between sin and cos
 */
export const trigSineCosine: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y=\\sin(x)', color: '#2d70b3', lineWidth: 2 },
        { id: '2', latex: 'y=\\cos(x)', color: '#388c46', lineWidth: 2 }
      ]
    },
    graph: {
      viewport: { xmin: -6.28, xmax: 6.28, ymin: -1.5, ymax: 1.5 },
      showGrid: true
    }
  }
};

/**
 * Example: Transformed Sine (y = a sin(bx) + c)
 * Use for: Exploring amplitude, period, and vertical shift
 */
export const trigSineTransformed: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        // Original for comparison (dashed)
        { id: '1', latex: 'y=\\sin(x)', color: '#888888', lineStyle: 'DASHED', lineWidth: 1 },
        // Transformed: amplitude 2, vertical shift +1
        { id: '2', latex: 'y=2\\sin(x)+1', color: '#c74440', lineWidth: 2 }
      ]
    },
    graph: {
      viewport: { xmin: -6.28, xmax: 6.28, ymin: -2, ymax: 4 },
      showGrid: true
    }
  }
};

/**
 * Example: Tangent Function
 * Use for: Introducing y = tan(x) and its asymptotes
 */
export const trigTangent: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y=\\tan(x)', color: '#6042a6', lineWidth: 2 }
      ]
    },
    graph: {
      viewport: { xmin: -4.71, xmax: 4.71, ymin: -5, ymax: 5 },
      showGrid: true
    }
  }
};

/**
 * =============================================================================
 * EXPONENTIAL AND LOGARITHMIC FUNCTIONS
 * National 5 Topic: (Extension/Higher Prep)
 * =============================================================================
 */

/**
 * Example: Exponential and Log as Inverses
 * Use for: Showing e^x and ln(x) as reflections in y=x
 */
export const expLogInverse: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y=e^x', color: '#c74440', lineWidth: 2 },
        { id: '2', latex: 'y=\\ln(x)', color: '#2d70b3', lineWidth: 2 },
        { id: '3', latex: 'y=x', color: '#888888', lineStyle: 'DASHED', lineWidth: 1 }
      ]
    },
    graph: {
      viewport: { xmin: -3, xmax: 5, ymin: -3, ymax: 5 },
      showGrid: true
    }
  }
};

/**
 * =============================================================================
 * ABSOLUTE VALUE FUNCTIONS
 * =============================================================================
 */

/**
 * Example: Absolute Value Functions
 * Use for: Understanding |x| and its transformations
 * NOTE: Use \\abs(x) NOT |x| for Desmos
 */
export const absoluteValue: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y=\\abs(x)', color: '#fa7e19', lineWidth: 3 },
        { id: '2', latex: 'y=\\abs(x-2)+1', color: '#6042a6', lineWidth: 3 }
      ]
    },
    graph: {
      viewport: { xmin: -6, xmax: 8, ymin: -2, ymax: 8 },
      showGrid: true
    }
  }
};

/**
 * =============================================================================
 * INEQUALITIES AND REGIONS
 * National 5 Topic: Relationships
 * =============================================================================
 */

/**
 * Example: Linear Inequality Shading
 * Use for: Graphing y < mx + c or y > mx + c
 */
export const inequalityLinear: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y<2x+1', color: '#2d70b3', fillOpacity: 0.3 }
      ]
    },
    graph: {
      viewport: { xmin: -5, xmax: 5, ymin: -5, ymax: 10 },
      showGrid: true
    }
  }
};

/**
 * Example: System of Inequalities
 * Use for: Finding feasible region
 */
export const inequalitySystem: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y<x^2', color: '#2d70b3', fillOpacity: 0.3 },
        { id: '2', latex: 'y>-2', color: '#c74440', fillOpacity: 0.3 }
      ]
    },
    graph: {
      viewport: { xmin: -5, xmax: 5, ymin: -5, ymax: 10 },
      showGrid: true
    }
  }
};

/**
 * =============================================================================
 * CIRCLE EQUATIONS (Implicit)
 * National 5 Topic: Geometry (Circle)
 * =============================================================================
 */

/**
 * Example: Circle Centered at Origin
 * Use for: x² + y² = r²
 */
export const circleOrigin: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'x^2+y^2=16', color: '#c74440', lineWidth: 3 },
        { id: '2', latex: '(0, 0)', color: '#000000' }
      ]
    },
    graph: {
      viewport: { xmin: -6, xmax: 6, ymin: -6, ymax: 6 },
      showGrid: true,
      squareAxes: true
    }
  }
};

/**
 * Example: Circle with Center (h, k)
 * Use for: (x-h)² + (y-k)² = r²
 */
export const circleGeneral: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: '(x-2)^2+(y-3)^2=9', color: '#c74440', lineWidth: 3 },
        { id: '2', latex: '(2, 3)', color: '#000000' }
      ]
    },
    graph: {
      viewport: { xmin: -3, xmax: 8, ymin: -2, ymax: 8 },
      showGrid: true,
      squareAxes: true
    }
  }
};

/**
 * =============================================================================
 * PIECEWISE AND SPECIAL FUNCTIONS
 * =============================================================================
 */

/**
 * Example: Piecewise Function
 * Use for: Functions defined differently on different intervals
 */
export const piecewise: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        {
          id: '1',
          latex: 'y=\\{x<0: -x, x\\ge 0: x^2\\}',
          color: '#2d70b3',
          lineWidth: 3
        }
      ]
    },
    graph: {
      viewport: { xmin: -5, xmax: 5, ymin: -2, ymax: 10 },
      showGrid: true
    }
  }
};

/**
 * Example: Cubic Function
 * Use for: Higher-degree polynomial exploration
 */
export const cubic: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        { id: '1', latex: 'y=x^3-3x', color: '#6042a6', lineWidth: 3 }
      ]
    },
    graph: {
      viewport: { xmin: -4, xmax: 4, ymin: -10, ymax: 10 },
      showGrid: true
    }
  }
};

/**
 * =============================================================================
 * PARAMETRIC CURVES
 * =============================================================================
 */

/**
 * Example: Parametric Spiral
 * Use for: Parametric curve visualization
 */
export const parametricSpiral: DesmosRenderRequest = {
  state: {
    expressions: {
      list: [
        {
          id: '1',
          latex: '(t\\cos(t), t\\sin(t))',
          color: '#c74440',
          lineWidth: 2,
          parametricDomain: { min: '0', max: '6\\pi' }
        }
      ]
    },
    graph: {
      viewport: { xmin: -20, xmax: 20, ymin: -20, ymax: 20 },
      showGrid: true,
      squareAxes: true
    }
  }
};

/**
 * =============================================================================
 * RENDER OPTIONS REFERENCE
 * =============================================================================
 */

/**
 * Standard render options for different use cases
 */
export const renderOptions = {
  // Standard classroom display
  standard: {
    width: 800,
    height: 600,
    format: 'png' as const,
    scale: 2
  },
  // Square aspect for circles/geometry
  square: {
    width: 600,
    height: 600,
    format: 'png' as const,
    scale: 2
  },
  // Wide for trig functions
  wide: {
    width: 1000,
    height: 500,
    format: 'png' as const,
    scale: 2
  },
  // Tall for comparing multiple functions
  tall: {
    width: 700,
    height: 700,
    format: 'png' as const,
    scale: 2
  }
};

/**
 * =============================================================================
 * HELPER: Generate expressions with auto-incrementing IDs
 * =============================================================================
 */
export function createExpressionList(
  latexExpressions: Array<{ latex: string; color?: string; lineWidth?: number; lineStyle?: 'SOLID' | 'DASHED' | 'DOTTED' }>
) {
  return latexExpressions.map((expr, index) => ({
    id: String(index + 1),
    ...expr
  }));
}

/**
 * =============================================================================
 * COLOR PALETTE (Desmos default colors)
 * =============================================================================
 */
export const DESMOS_COLORS = {
  red: '#c74440',
  blue: '#2d70b3',
  green: '#388c46',
  purple: '#6042a6',
  orange: '#fa7e19',
  black: '#000000',
  gray: '#888888'
};
