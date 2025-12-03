/**
 * GeoGebra Example Diagrams for AI-Driven Generation
 *
 * This file contains reference examples for National 5 Mathematics topics
 * that are best rendered using GeoGebra:
 *
 * 1. CIRCLE THEOREMS
 *    - Angle at centre theorem
 *    - Angle in semicircle
 *    - Angles in same segment
 *    - Cyclic quadrilateral
 *    - Tangent-radius theorem
 *    - Tangents from external point
 *    - Alternate segment theorem
 *    - Perpendicular from centre bisects chord
 *
 * 2. GEOMETRIC CONSTRUCTIONS
 *    - Perpendicular bisector
 *    - Angle bisector
 *    - Perpendicular from point to line
 *    - Circumscribed/inscribed circles
 *
 * 3. SIMILARITY AND CONGRUENCE
 *    - Similar triangles
 *    - Congruent triangles
 *
 * Each example includes:
 * - GeoGebra commands in execution order
 * - Styling for educational clarity
 * - Comments explaining the construction
 *
 * Usage in AI System:
 * - Use these patterns to generate variations
 * - Maintain clear visual hierarchy (construction lines lighter)
 * - Always label key points and angles
 */

import type {
  GeoGebraConstruction,
  GeoGebraSettings,
  GeoGebraObjectStyle,
  CircleTheoremType
} from '../../src/types/geogebra.types';
import type { RenderOptions } from '../../src/types/common.types';

// =============================================================================
// RENDER OPTIONS
// =============================================================================

export const renderOptions = {
  /** Standard educational diagram */
  standard: {
    width: 800,
    height: 600,
    format: 'png' as const,
    scale: 2,
    timeout: 30000  // GeoGebra needs more time to load
  },
  /** Square aspect ratio for circles */
  square: {
    width: 600,
    height: 600,
    format: 'png' as const,
    scale: 2,
    timeout: 30000
  },
  /** Larger diagram for complex constructions */
  large: {
    width: 1000,
    height: 800,
    format: 'png' as const,
    scale: 2,
    timeout: 30000
  }
} satisfies Record<string, RenderOptions>;

// =============================================================================
// DEFAULT SETTINGS
// =============================================================================

export const defaultSettings: GeoGebraSettings = {
  appType: 'geometry',
  showAxes: false,
  showGrid: false,
  enableLabelDrags: false,
  showResetIcon: false,
  angleUnit: 'degree',
  labelingStyle: 3,  // Show all labels
  rightAngleStyle: 1,  // Square symbol for right angles
  pointCapturing: 0  // No snapping
};

export const settingsWithAxes: GeoGebraSettings = {
  ...defaultSettings,
  showAxes: true,
  showGrid: true
};

// =============================================================================
// CIRCLE THEOREMS
// =============================================================================

/**
 * Circle Theorem 1: Angle at Centre
 * The angle at the centre is twice the angle at the circumference
 * when subtended by the same arc.
 *
 * Use for: Teaching angle at centre = 2 × angle at circumference
 */
export const circleAngleAtCentre: GeoGebraConstruction = {
  commands: [
    // Create circle with centre O
    'O = (0, 0)',
    'c = Circle(O, 3)',

    // Points on circumference
    'A = Point(c, 0.2)',    // First arc endpoint
    'B = Point(c, 0.7)',    // Second arc endpoint
    'P = Point(c, 0.45)',   // Point for circumference angle

    // Draw the angle at centre
    'segOA = Segment(O, A)',
    'segOB = Segment(O, B)',
    'angleAtCentre = Angle(A, O, B)',

    // Draw the angle at circumference
    'segPA = Segment(P, A)',
    'segPB = Segment(P, B)',
    'angleAtCirc = Angle(A, P, B)',

    // Show the arc
    'arc = Arc(c, A, B)'
  ],
  styles: [
    { name: 'O', color: '#000000', pointSize: 4, showLabel: true, caption: 'O (centre)' },
    { name: 'A', color: '#CC0000', pointSize: 4, showLabel: true },
    { name: 'B', color: '#CC0000', pointSize: 4, showLabel: true },
    { name: 'P', color: '#0000CC', pointSize: 4, showLabel: true },
    { name: 'c', color: '#808080', lineThickness: 2 },
    { name: 'segOA', color: '#CC0000', lineThickness: 2 },
    { name: 'segOB', color: '#CC0000', lineThickness: 2 },
    { name: 'segPA', color: '#0000CC', lineThickness: 2 },
    { name: 'segPB', color: '#0000CC', lineThickness: 2 },
    { name: 'angleAtCentre', color: '#CC0000', fillOpacity: 0.3, showLabel: true },
    { name: 'angleAtCirc', color: '#0000CC', fillOpacity: 0.3, showLabel: true },
    { name: 'arc', color: '#00CC00', lineThickness: 4 }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -5, xmax: 5, ymin: -4, ymax: 4 }
  }
};

/**
 * Circle Theorem 2: Angle in a Semicircle
 * The angle in a semicircle is always 90°
 *
 * Use for: Teaching angle in semicircle = 90°
 */
export const circleAngleInSemicircle: GeoGebraConstruction = {
  commands: [
    // Create circle with diameter
    'O = (0, 0)',
    'c = Circle(O, 3)',

    // Diameter endpoints
    'A = (-3, 0)',
    'B = (3, 0)',
    'diameter = Segment(A, B)',

    // Point on circumference (upper semicircle)
    'P = Point(c, 0.35)',

    // Draw triangle
    'segPA = Segment(P, A)',
    'segPB = Segment(P, B)',

    // Show the right angle at P
    'rightAngle = Angle(A, P, B)'
  ],
  styles: [
    { name: 'O', color: '#000000', pointSize: 4, showLabel: true, caption: 'O' },
    { name: 'A', color: '#CC0000', pointSize: 4, showLabel: true },
    { name: 'B', color: '#CC0000', pointSize: 4, showLabel: true },
    { name: 'P', color: '#0000CC', pointSize: 5, showLabel: true },
    { name: 'c', color: '#808080', lineThickness: 2 },
    { name: 'diameter', color: '#CC0000', lineThickness: 3 },
    { name: 'segPA', color: '#0000CC', lineThickness: 2 },
    { name: 'segPB', color: '#0000CC', lineThickness: 2 },
    { name: 'rightAngle', color: '#00CC00', fillOpacity: 0.4, showLabel: true }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -5, xmax: 5, ymin: -4, ymax: 4 },
    rightAngleStyle: 1
  }
};

/**
 * Circle Theorem 3: Angles in Same Segment
 * Angles subtended by the same arc at the circumference are equal
 *
 * Use for: Teaching angles in same segment are equal
 */
export const circleAnglesInSameSegment: GeoGebraConstruction = {
  commands: [
    // Create circle
    'O = (0, 0)',
    'c = Circle(O, 3)',

    // Arc endpoints (chord)
    'A = Point(c, 0.1)',
    'B = Point(c, 0.6)',
    'chord = Segment(A, B)',

    // Two points on the same side of chord (major arc)
    'P = Point(c, 0.3)',
    'Q = Point(c, 0.45)',

    // Angles at P and Q
    'segPA = Segment(P, A)',
    'segPB = Segment(P, B)',
    'segQA = Segment(Q, A)',
    'segQB = Segment(Q, B)',

    'angleP = Angle(A, P, B)',
    'angleQ = Angle(A, Q, B)'
  ],
  styles: [
    { name: 'O', color: '#000000', pointSize: 3, showLabel: true },
    { name: 'A', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'B', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'P', color: '#CC0000', pointSize: 5, showLabel: true },
    { name: 'Q', color: '#0000CC', pointSize: 5, showLabel: true },
    { name: 'c', color: '#808080', lineThickness: 2 },
    { name: 'chord', color: '#000000', lineThickness: 2, lineStyle: 1 },
    { name: 'segPA', color: '#CC0000', lineThickness: 2 },
    { name: 'segPB', color: '#CC0000', lineThickness: 2 },
    { name: 'segQA', color: '#0000CC', lineThickness: 2 },
    { name: 'segQB', color: '#0000CC', lineThickness: 2 },
    { name: 'angleP', color: '#CC0000', fillOpacity: 0.4, showLabel: true },
    { name: 'angleQ', color: '#0000CC', fillOpacity: 0.4, showLabel: true }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -5, xmax: 5, ymin: -4, ymax: 4 }
  }
};

/**
 * Circle Theorem 4: Cyclic Quadrilateral
 * Opposite angles of a cyclic quadrilateral sum to 180°
 *
 * Use for: Teaching cyclic quadrilateral properties
 */
export const circleCyclicQuadrilateral: GeoGebraConstruction = {
  commands: [
    // Create circle
    'O = (0, 0)',
    'c = Circle(O, 3)',

    // Four points on circle forming quadrilateral
    'A = Point(c, 0.1)',
    'B = Point(c, 0.35)',
    'C = Point(c, 0.6)',
    'D = Point(c, 0.85)',

    // Quadrilateral sides
    'sideAB = Segment(A, B)',
    'sideBC = Segment(B, C)',
    'sideCD = Segment(C, D)',
    'sideDA = Segment(D, A)',

    // Opposite angles
    'angleA = Angle(D, A, B)',
    'angleB = Angle(A, B, C)',
    'angleC = Angle(B, C, D)',
    'angleD = Angle(C, D, A)',

    // Interior polygon for fill
    'quad = Polygon(A, B, C, D)'
  ],
  styles: [
    { name: 'O', color: '#808080', pointSize: 2, showLabel: false },
    { name: 'A', color: '#CC0000', pointSize: 4, showLabel: true },
    { name: 'B', color: '#0000CC', pointSize: 4, showLabel: true },
    { name: 'C', color: '#CC0000', pointSize: 4, showLabel: true },
    { name: 'D', color: '#0000CC', pointSize: 4, showLabel: true },
    { name: 'c', color: '#808080', lineThickness: 2 },
    { name: 'sideAB', color: '#000000', lineThickness: 2 },
    { name: 'sideBC', color: '#000000', lineThickness: 2 },
    { name: 'sideCD', color: '#000000', lineThickness: 2 },
    { name: 'sideDA', color: '#000000', lineThickness: 2 },
    { name: 'angleA', color: '#CC0000', fillOpacity: 0.3, showLabel: true },
    { name: 'angleC', color: '#CC0000', fillOpacity: 0.3, showLabel: true },
    { name: 'angleB', color: '#0000CC', fillOpacity: 0.3, showLabel: true },
    { name: 'angleD', color: '#0000CC', fillOpacity: 0.3, showLabel: true },
    { name: 'quad', fillOpacity: 0.1, color: '#CCCCCC' }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -5, xmax: 5, ymin: -4, ymax: 4 }
  }
};

/**
 * Circle Theorem 5: Tangent-Radius
 * A tangent to a circle is perpendicular to the radius at the point of contact
 *
 * Use for: Teaching tangent-radius perpendicularity
 */
export const circleTangentRadius: GeoGebraConstruction = {
  commands: [
    // Create circle
    'O = (0, 0)',
    'c = Circle(O, 3)',

    // Point of tangency
    'P = (3, 0)',

    // Radius to point of tangency
    'radius = Segment(O, P)',

    // Tangent line at P (perpendicular to radius)
    'tangent = PerpendicularLine(P, radius)',

    // Show right angle
    'Q = Point(tangent, 1)',  // Point on tangent for angle
    'rightAngle = Angle(O, P, Q)'
  ],
  styles: [
    { name: 'O', color: '#000000', pointSize: 4, showLabel: true, caption: 'O' },
    { name: 'P', color: '#CC0000', pointSize: 5, showLabel: true, caption: 'P (tangent point)' },
    { name: 'Q', color: '#808080', pointSize: 2, showLabel: false, visible: false },
    { name: 'c', color: '#808080', lineThickness: 2 },
    { name: 'radius', color: '#0000CC', lineThickness: 3 },
    { name: 'tangent', color: '#CC0000', lineThickness: 2 },
    { name: 'rightAngle', color: '#00CC00', fillOpacity: 0.4, showLabel: true }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -5, xmax: 7, ymin: -4, ymax: 4 },
    rightAngleStyle: 1
  }
};

/**
 * Circle Theorem 6: Tangents from External Point
 * Tangents from an external point to a circle are equal in length
 *
 * Use for: Teaching equal tangents from external point
 */
export const circleTangentsFromPoint: GeoGebraConstruction = {
  commands: [
    // Create circle
    'O = (0, 0)',
    'c = Circle(O, 2)',

    // External point
    'P = (5, 0)',

    // Tangent points (calculated positions)
    'T1 = (0.8, 1.83)',   // Approximate tangent point
    'T2 = (0.8, -1.83)',  // Approximate tangent point

    // Tangent lines
    'tangent1 = Segment(P, T1)',
    'tangent2 = Segment(P, T2)',

    // Radii to tangent points
    'radius1 = Segment(O, T1)',
    'radius2 = Segment(O, T2)',

    // Show equal lengths
    'distPT1 = Distance(P, T1)',
    'distPT2 = Distance(P, T2)'
  ],
  styles: [
    { name: 'O', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'P', color: '#CC0000', pointSize: 5, showLabel: true, caption: 'P (external)' },
    { name: 'T1', color: '#0000CC', pointSize: 4, showLabel: true },
    { name: 'T2', color: '#0000CC', pointSize: 4, showLabel: true },
    { name: 'c', color: '#808080', lineThickness: 2 },
    { name: 'tangent1', color: '#CC0000', lineThickness: 2 },
    { name: 'tangent2', color: '#CC0000', lineThickness: 2 },
    { name: 'radius1', color: '#808080', lineThickness: 1, lineStyle: 1 },
    { name: 'radius2', color: '#808080', lineThickness: 1, lineStyle: 1 }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -3, xmax: 7, ymin: -4, ymax: 4 }
  }
};

/**
 * Circle Theorem 7: Alternate Segment
 * The angle between a tangent and a chord equals the angle
 * in the alternate segment
 *
 * Use for: Teaching alternate segment theorem
 */
export const circleAlternateSegment: GeoGebraConstruction = {
  commands: [
    // Create circle
    'O = (0, 0)',
    'c = Circle(O, 3)',

    // Tangent point
    'P = (3, 0)',

    // Tangent line (horizontal at P)
    'tangent = Line(P, (4, 0))',

    // Chord from tangent point
    'Q = Point(c, 0.35)',
    'chord = Segment(P, Q)',

    // Point in alternate segment
    'R = Point(c, 0.7)',

    // Chord to form the angle in alternate segment
    'segRP = Segment(R, P)',
    'segRQ = Segment(R, Q)',

    // The two equal angles
    'T = (5, 0)',  // Point on tangent for angle measurement
    'angleAtTangent = Angle(T, P, Q)',
    'angleInSegment = Angle(P, R, Q)'
  ],
  styles: [
    { name: 'O', color: '#808080', pointSize: 2, showLabel: false },
    { name: 'P', color: '#000000', pointSize: 5, showLabel: true },
    { name: 'Q', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'R', color: '#0000CC', pointSize: 5, showLabel: true },
    { name: 'T', color: '#808080', pointSize: 2, visible: false },
    { name: 'c', color: '#808080', lineThickness: 2 },
    { name: 'tangent', color: '#CC0000', lineThickness: 2 },
    { name: 'chord', color: '#000000', lineThickness: 2 },
    { name: 'segRP', color: '#0000CC', lineThickness: 2 },
    { name: 'segRQ', color: '#0000CC', lineThickness: 2 },
    { name: 'angleAtTangent', color: '#CC0000', fillOpacity: 0.4, showLabel: true },
    { name: 'angleInSegment', color: '#0000CC', fillOpacity: 0.4, showLabel: true }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -4, xmax: 6, ymin: -4, ymax: 4 }
  }
};

/**
 * Circle Theorem 8: Perpendicular from Centre Bisects Chord
 * A perpendicular from the centre to a chord bisects the chord
 *
 * Use for: Teaching perpendicular bisector of chord
 */
export const circlePerpendicularBisectsChord: GeoGebraConstruction = {
  commands: [
    // Create circle
    'O = (0, 0)',
    'c = Circle(O, 3)',

    // Chord (not diameter)
    'A = (-2, 2.24)',
    'B = (2, 2.24)',
    'chord = Segment(A, B)',

    // Midpoint of chord
    'M = Midpoint(A, B)',

    // Perpendicular from centre to chord
    'perpendicular = Segment(O, M)',

    // Show equal parts
    'segAM = Segment(A, M)',
    'segMB = Segment(M, B)',

    // Right angle at M
    'rightAngle = Angle(O, M, B)'
  ],
  styles: [
    { name: 'O', color: '#000000', pointSize: 4, showLabel: true, caption: 'O (centre)' },
    { name: 'A', color: '#CC0000', pointSize: 4, showLabel: true },
    { name: 'B', color: '#CC0000', pointSize: 4, showLabel: true },
    { name: 'M', color: '#0000CC', pointSize: 5, showLabel: true, caption: 'M (midpoint)' },
    { name: 'c', color: '#808080', lineThickness: 2 },
    { name: 'chord', color: '#CC0000', lineThickness: 2 },
    { name: 'perpendicular', color: '#0000CC', lineThickness: 2 },
    { name: 'segAM', color: '#00CC00', lineThickness: 2, lineStyle: 1 },
    { name: 'segMB', color: '#00CC00', lineThickness: 2, lineStyle: 1 },
    { name: 'rightAngle', color: '#00CC00', fillOpacity: 0.3, showLabel: true }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -5, xmax: 5, ymin: -4, ymax: 4 },
    rightAngleStyle: 1
  }
};

// =============================================================================
// GEOMETRIC CONSTRUCTIONS
// =============================================================================

/**
 * Construction: Perpendicular Bisector
 * Construct the perpendicular bisector of a line segment
 *
 * Use for: Teaching perpendicular bisector construction
 */
export const constructionPerpendicularBisector: GeoGebraConstruction = {
  commands: [
    // Given line segment
    'A = (-3, 0)',
    'B = (3, 0)',
    'segment = Segment(A, B)',

    // Construction arcs (same radius from both ends)
    'c1 = Circle(A, 4)',
    'c2 = Circle(B, 4)',

    // Intersection points of construction arcs
    'P = Intersect(c1, c2, 1)',
    'Q = Intersect(c1, c2, 2)',

    // Perpendicular bisector
    'bisector = Line(P, Q)',

    // Midpoint
    'M = Midpoint(A, B)'
  ],
  styles: [
    { name: 'A', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'B', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'P', color: '#0000CC', pointSize: 4, showLabel: true },
    { name: 'Q', color: '#0000CC', pointSize: 4, showLabel: true },
    { name: 'M', color: '#CC0000', pointSize: 5, showLabel: true, caption: 'M (midpoint)' },
    { name: 'segment', color: '#000000', lineThickness: 3 },
    { name: 'c1', color: '#808080', lineThickness: 1, lineStyle: 2 },
    { name: 'c2', color: '#808080', lineThickness: 1, lineStyle: 2 },
    { name: 'bisector', color: '#CC0000', lineThickness: 2 }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -6, xmax: 6, ymin: -5, ymax: 5 }
  }
};

/**
 * Construction: Angle Bisector
 * Construct the bisector of an angle
 *
 * Use for: Teaching angle bisector construction
 */
export const constructionAngleBisector: GeoGebraConstruction = {
  commands: [
    // Given angle
    'A = (0, 0)',   // Vertex
    'B = (4, 0)',   // One arm
    'C = (2, 3)',   // Other arm

    // Arms of the angle
    'ray1 = Ray(A, B)',
    'ray2 = Ray(A, C)',

    // Construction: arc from vertex
    'arcFromVertex = Circle(A, 2)',
    'P = Intersect(arcFromVertex, ray1)',
    'Q = Intersect(arcFromVertex, ray2)',

    // Construction: arcs from P and Q
    'arcFromP = Circle(P, 2)',
    'arcFromQ = Circle(Q, 2)',
    'R = Intersect(arcFromP, arcFromQ, 1)',

    // Angle bisector
    'bisector = Ray(A, R)',

    // Original angle and half angles
    'originalAngle = Angle(B, A, C)',
    'halfAngle1 = Angle(B, A, R)',
    'halfAngle2 = Angle(R, A, C)'
  ],
  styles: [
    { name: 'A', color: '#000000', pointSize: 5, showLabel: true, caption: 'A (vertex)' },
    { name: 'B', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'C', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'P', color: '#808080', pointSize: 3, showLabel: true },
    { name: 'Q', color: '#808080', pointSize: 3, showLabel: true },
    { name: 'R', color: '#0000CC', pointSize: 4, showLabel: true },
    { name: 'ray1', color: '#000000', lineThickness: 2 },
    { name: 'ray2', color: '#000000', lineThickness: 2 },
    { name: 'arcFromVertex', color: '#808080', lineThickness: 1, lineStyle: 2 },
    { name: 'arcFromP', color: '#808080', lineThickness: 1, lineStyle: 2 },
    { name: 'arcFromQ', color: '#808080', lineThickness: 1, lineStyle: 2 },
    { name: 'bisector', color: '#CC0000', lineThickness: 2 },
    { name: 'halfAngle1', color: '#00CC00', fillOpacity: 0.3, showLabel: true },
    { name: 'halfAngle2', color: '#00CC00', fillOpacity: 0.3, showLabel: true }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -2, xmax: 6, ymin: -2, ymax: 5 }
  }
};

/**
 * Construction: Perpendicular from Point to Line
 * Drop a perpendicular from a point to a line
 *
 * Use for: Teaching perpendicular construction
 */
export const constructionPerpendicularFromPoint: GeoGebraConstruction = {
  commands: [
    // Given line and point
    'A = (-3, -1)',
    'B = (3, -1)',
    'line = Line(A, B)',
    'P = (1, 2)',   // Point not on line

    // Construction arcs
    'arcFromP = Circle(P, 4)',

    // Intersection with line
    'X = Intersect(arcFromP, line, 1)',
    'Y = Intersect(arcFromP, line, 2)',

    // Arcs from X and Y
    'arcFromX = Circle(X, 3)',
    'arcFromY = Circle(Y, 3)',

    // Intersection below line
    'Q = Intersect(arcFromX, arcFromY, 2)',

    // Perpendicular line
    'perpendicular = Line(P, Q)',

    // Foot of perpendicular
    'F = Intersect(perpendicular, line)',

    // Right angle
    'rightAngle = Angle(P, F, B)'
  ],
  styles: [
    { name: 'A', color: '#808080', pointSize: 3, showLabel: true },
    { name: 'B', color: '#808080', pointSize: 3, showLabel: true },
    { name: 'P', color: '#CC0000', pointSize: 5, showLabel: true },
    { name: 'X', color: '#808080', pointSize: 3, showLabel: true },
    { name: 'Y', color: '#808080', pointSize: 3, showLabel: true },
    { name: 'Q', color: '#808080', pointSize: 3, showLabel: false },
    { name: 'F', color: '#0000CC', pointSize: 5, showLabel: true, caption: 'F (foot)' },
    { name: 'line', color: '#000000', lineThickness: 2 },
    { name: 'arcFromP', color: '#808080', lineThickness: 1, lineStyle: 2 },
    { name: 'arcFromX', color: '#808080', lineThickness: 1, lineStyle: 2 },
    { name: 'arcFromY', color: '#808080', lineThickness: 1, lineStyle: 2 },
    { name: 'perpendicular', color: '#CC0000', lineThickness: 2 },
    { name: 'rightAngle', color: '#00CC00', fillOpacity: 0.3, showLabel: true }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -5, xmax: 5, ymin: -4, ymax: 4 },
    rightAngleStyle: 1
  }
};

/**
 * Construction: Circumscribed Circle of Triangle
 * Construct the circumcircle of a triangle
 *
 * Use for: Teaching circumcentre and circumcircle
 */
export const constructionCircumscribedCircle: GeoGebraConstruction = {
  commands: [
    // Triangle vertices
    'A = (-2, -1)',
    'B = (3, -1)',
    'C = (1, 2.5)',

    // Triangle
    'triangle = Polygon(A, B, C)',

    // Perpendicular bisectors
    'bisectorAB = PerpendicularBisector(A, B)',
    'bisectorBC = PerpendicularBisector(B, C)',
    'bisectorCA = PerpendicularBisector(C, A)',

    // Circumcentre (intersection of bisectors)
    'O = Intersect(bisectorAB, bisectorBC)',

    // Circumcircle
    'circumcircle = Circle(O, A)'
  ],
  styles: [
    { name: 'A', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'B', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'C', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'O', color: '#CC0000', pointSize: 5, showLabel: true, caption: 'O (circumcentre)' },
    { name: 'triangle', color: '#000000', lineThickness: 2, fillOpacity: 0.1 },
    { name: 'bisectorAB', color: '#808080', lineThickness: 1, lineStyle: 1 },
    { name: 'bisectorBC', color: '#808080', lineThickness: 1, lineStyle: 1 },
    { name: 'bisectorCA', color: '#808080', lineThickness: 1, lineStyle: 1 },
    { name: 'circumcircle', color: '#0000CC', lineThickness: 2 }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -4, xmax: 5, ymin: -3, ymax: 4 }
  }
};

/**
 * Construction: Inscribed Circle of Triangle
 * Construct the incircle of a triangle
 *
 * Use for: Teaching incentre and incircle
 */
export const constructionInscribedCircle: GeoGebraConstruction = {
  commands: [
    // Triangle vertices
    'A = (-3, -1)',
    'B = (3, -1)',
    'C = (0, 3)',

    // Triangle
    'triangle = Polygon(A, B, C)',

    // Angle bisectors
    'bisectorA = AngleBisector(C, A, B)',
    'bisectorB = AngleBisector(A, B, C)',
    'bisectorC = AngleBisector(B, C, A)',

    // Incentre (intersection of angle bisectors)
    'I = Intersect(bisectorA, bisectorB)',

    // Foot of perpendicular from I to AB
    'sideAB = Line(A, B)',
    'perpFromI = PerpendicularLine(I, sideAB)',
    'F = Intersect(perpFromI, sideAB)',

    // Incircle
    'incircle = Circle(I, F)'
  ],
  styles: [
    { name: 'A', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'B', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'C', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'I', color: '#CC0000', pointSize: 5, showLabel: true, caption: 'I (incentre)' },
    { name: 'F', color: '#808080', pointSize: 3, showLabel: false },
    { name: 'triangle', color: '#000000', lineThickness: 2, fillOpacity: 0.1 },
    { name: 'bisectorA', color: '#808080', lineThickness: 1, lineStyle: 1 },
    { name: 'bisectorB', color: '#808080', lineThickness: 1, lineStyle: 1 },
    { name: 'bisectorC', color: '#808080', lineThickness: 1, lineStyle: 1 },
    { name: 'sideAB', visible: false },
    { name: 'perpFromI', visible: false },
    { name: 'incircle', color: '#0000CC', lineThickness: 2 }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -5, xmax: 5, ymin: -3, ymax: 5 }
  }
};

// =============================================================================
// SIMILARITY AND CONGRUENCE
// =============================================================================

/**
 * Similar Triangles
 * Two triangles with equal corresponding angles
 *
 * Use for: Teaching similar triangles (AA similarity)
 */
export const similarTriangles: GeoGebraConstruction = {
  commands: [
    // First triangle (smaller)
    'A1 = (-4, -1)',
    'B1 = (-1, -1)',
    'C1 = (-2.5, 1)',
    'triangle1 = Polygon(A1, B1, C1)',

    // Second triangle (larger, scaled by factor 1.5)
    'A2 = (1, -1.5)',
    'B2 = (5.5, -1.5)',
    'C2 = (3.25, 1.5)',
    'triangle2 = Polygon(A2, B2, C2)',

    // Angles of first triangle
    'angle1A = Angle(C1, A1, B1)',
    'angle1B = Angle(A1, B1, C1)',
    'angle1C = Angle(B1, C1, A1)',

    // Angles of second triangle
    'angle2A = Angle(C2, A2, B2)',
    'angle2B = Angle(A2, B2, C2)',
    'angle2C = Angle(B2, C2, A2)'
  ],
  styles: [
    { name: 'A1', color: '#CC0000', pointSize: 4, showLabel: true },
    { name: 'B1', color: '#CC0000', pointSize: 4, showLabel: true },
    { name: 'C1', color: '#CC0000', pointSize: 4, showLabel: true },
    { name: 'A2', color: '#0000CC', pointSize: 4, showLabel: true },
    { name: 'B2', color: '#0000CC', pointSize: 4, showLabel: true },
    { name: 'C2', color: '#0000CC', pointSize: 4, showLabel: true },
    { name: 'triangle1', color: '#CC0000', lineThickness: 2, fillOpacity: 0.2 },
    { name: 'triangle2', color: '#0000CC', lineThickness: 2, fillOpacity: 0.2 },
    { name: 'angle1A', color: '#CC0000', fillOpacity: 0.4, showLabel: true },
    { name: 'angle1B', color: '#CC0000', fillOpacity: 0.4, showLabel: true },
    { name: 'angle1C', color: '#CC0000', fillOpacity: 0.4, showLabel: true },
    { name: 'angle2A', color: '#0000CC', fillOpacity: 0.4, showLabel: true },
    { name: 'angle2B', color: '#0000CC', fillOpacity: 0.4, showLabel: true },
    { name: 'angle2C', color: '#0000CC', fillOpacity: 0.4, showLabel: true }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -6, xmax: 7, ymin: -3, ymax: 4 }
  }
};

/**
 * Congruent Triangles (SAS)
 * Two congruent triangles with marked equal sides and angle
 *
 * Use for: Teaching congruent triangles (SAS criterion)
 */
export const congruentTrianglesSAS: GeoGebraConstruction = {
  commands: [
    // First triangle
    'A1 = (-4, -1)',
    'B1 = (-1, -1)',
    'C1 = (-3, 2)',
    'triangle1 = Polygon(A1, B1, C1)',

    // Second triangle (congruent, different position)
    'A2 = (1, 0)',
    'B2 = (4, 0)',
    'C2 = (2, 3)',
    'triangle2 = Polygon(A2, B2, C2)',

    // Equal sides (marked)
    'side1AB = Segment(A1, B1)',
    'side1AC = Segment(A1, C1)',
    'side2AB = Segment(A2, B2)',
    'side2AC = Segment(A2, C2)',

    // Included angle
    'includedAngle1 = Angle(B1, A1, C1)',
    'includedAngle2 = Angle(B2, A2, C2)'
  ],
  styles: [
    { name: 'A1', color: '#CC0000', pointSize: 4, showLabel: true },
    { name: 'B1', color: '#CC0000', pointSize: 4, showLabel: true },
    { name: 'C1', color: '#CC0000', pointSize: 4, showLabel: true },
    { name: 'A2', color: '#0000CC', pointSize: 4, showLabel: true },
    { name: 'B2', color: '#0000CC', pointSize: 4, showLabel: true },
    { name: 'C2', color: '#0000CC', pointSize: 4, showLabel: true },
    { name: 'triangle1', color: '#CC0000', lineThickness: 2, fillOpacity: 0.15 },
    { name: 'triangle2', color: '#0000CC', lineThickness: 2, fillOpacity: 0.15 },
    { name: 'side1AB', color: '#00CC00', lineThickness: 3 },
    { name: 'side1AC', color: '#FF9900', lineThickness: 3 },
    { name: 'side2AB', color: '#00CC00', lineThickness: 3 },
    { name: 'side2AC', color: '#FF9900', lineThickness: 3 },
    { name: 'includedAngle1', color: '#9900CC', fillOpacity: 0.4, showLabel: true },
    { name: 'includedAngle2', color: '#9900CC', fillOpacity: 0.4, showLabel: true }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -6, xmax: 6, ymin: -3, ymax: 5 }
  }
};

// =============================================================================
// ANGLE PROPERTIES
// =============================================================================

/**
 * Angles on a Straight Line
 * Angles on a straight line sum to 180°
 *
 * Use for: Teaching angles on straight line
 */
export const anglesOnStraightLine: GeoGebraConstruction = {
  commands: [
    // Straight line
    'A = (-4, 0)',
    'B = (4, 0)',
    'line = Segment(A, B)',

    // Point on line
    'P = (0, 0)',

    // Two rays from P
    'C = (2, 3)',
    'ray1 = Segment(P, C)',

    // The two angles
    'angle1 = Angle(A, P, C)',
    'angle2 = Angle(C, P, B)'
  ],
  styles: [
    { name: 'A', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'B', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'C', color: '#0000CC', pointSize: 4, showLabel: true },
    { name: 'P', color: '#CC0000', pointSize: 5, showLabel: true },
    { name: 'line', color: '#000000', lineThickness: 2 },
    { name: 'ray1', color: '#0000CC', lineThickness: 2 },
    { name: 'angle1', color: '#CC0000', fillOpacity: 0.4, showLabel: true },
    { name: 'angle2', color: '#00CC00', fillOpacity: 0.4, showLabel: true }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -6, xmax: 6, ymin: -2, ymax: 5 }
  }
};

/**
 * Vertically Opposite Angles
 * Vertically opposite angles are equal
 *
 * Use for: Teaching vertically opposite angles
 */
export const verticallyOppositeAngles: GeoGebraConstruction = {
  commands: [
    // Two intersecting lines
    'A = (-3, -2)',
    'B = (3, 2)',
    'C = (-3, 2)',
    'D = (3, -2)',

    'line1 = Line(A, B)',
    'line2 = Line(C, D)',

    // Intersection point
    'O = Intersect(line1, line2)',

    // Four angles
    'angle1 = Angle(A, O, C)',
    'angle2 = Angle(C, O, B)',
    'angle3 = Angle(B, O, D)',
    'angle4 = Angle(D, O, A)'
  ],
  styles: [
    { name: 'A', color: '#808080', pointSize: 3, showLabel: true },
    { name: 'B', color: '#808080', pointSize: 3, showLabel: true },
    { name: 'C', color: '#808080', pointSize: 3, showLabel: true },
    { name: 'D', color: '#808080', pointSize: 3, showLabel: true },
    { name: 'O', color: '#000000', pointSize: 5, showLabel: true },
    { name: 'line1', color: '#000000', lineThickness: 2 },
    { name: 'line2', color: '#000000', lineThickness: 2 },
    { name: 'angle1', color: '#CC0000', fillOpacity: 0.4, showLabel: true },
    { name: 'angle2', color: '#0000CC', fillOpacity: 0.4, showLabel: true },
    { name: 'angle3', color: '#CC0000', fillOpacity: 0.4, showLabel: true },
    { name: 'angle4', color: '#0000CC', fillOpacity: 0.4, showLabel: true }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -5, xmax: 5, ymin: -4, ymax: 4 }
  }
};

/**
 * Angles in Parallel Lines
 * Corresponding, alternate, and co-interior angles
 *
 * Use for: Teaching angles in parallel lines
 */
export const anglesInParallelLines: GeoGebraConstruction = {
  commands: [
    // Two parallel lines
    'A1 = (-4, 2)',
    'B1 = (4, 2)',
    'A2 = (-4, -2)',
    'B2 = (4, -2)',

    'line1 = Line(A1, B1)',
    'line2 = Line(A2, B2)',

    // Transversal
    'T1 = (-2, 4)',
    'T2 = (2, -4)',
    'transversal = Line(T1, T2)',

    // Intersection points
    'P = Intersect(transversal, line1)',
    'Q = Intersect(transversal, line2)',

    // Corresponding angles (both acute, same position)
    'corresponding1 = Angle(T2, P, B1)',
    'corresponding2 = Angle(T2, Q, B2)',

    // Alternate angles
    'alternate1 = Angle(A1, P, T2)',
    'alternate2 = Angle(T1, Q, B2)'
  ],
  styles: [
    { name: 'A1', color: '#808080', pointSize: 2, visible: false },
    { name: 'B1', color: '#808080', pointSize: 2, visible: false },
    { name: 'A2', color: '#808080', pointSize: 2, visible: false },
    { name: 'B2', color: '#808080', pointSize: 2, visible: false },
    { name: 'T1', color: '#808080', pointSize: 2, visible: false },
    { name: 'T2', color: '#808080', pointSize: 2, visible: false },
    { name: 'P', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'Q', color: '#000000', pointSize: 4, showLabel: true },
    { name: 'line1', color: '#0000CC', lineThickness: 2 },
    { name: 'line2', color: '#0000CC', lineThickness: 2 },
    { name: 'transversal', color: '#CC0000', lineThickness: 2 },
    { name: 'corresponding1', color: '#00CC00', fillOpacity: 0.4, showLabel: true },
    { name: 'corresponding2', color: '#00CC00', fillOpacity: 0.4, showLabel: true },
    { name: 'alternate1', color: '#FF9900', fillOpacity: 0.4, showLabel: true },
    { name: 'alternate2', color: '#FF9900', fillOpacity: 0.4, showLabel: true }
  ],
  settings: {
    ...defaultSettings,
    coordSystem: { xmin: -5, xmax: 5, ymin: -5, ymax: 5 }
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a basic circle construction
 */
export function createCircle(
  centerX: number,
  centerY: number,
  radius: number,
  options: { centerName?: string; circleName?: string } = {}
): GeoGebraConstruction {
  const { centerName = 'O', circleName = 'c' } = options;

  return {
    commands: [
      `${centerName} = (${centerX}, ${centerY})`,
      `${circleName} = Circle(${centerName}, ${radius})`
    ],
    styles: [
      { name: centerName, color: '#000000', pointSize: 4, showLabel: true },
      { name: circleName, color: '#808080', lineThickness: 2 }
    ],
    settings: {
      ...defaultSettings,
      coordSystem: {
        xmin: centerX - radius - 2,
        xmax: centerX + radius + 2,
        ymin: centerY - radius - 2,
        ymax: centerY + radius + 2
      }
    }
  };
}

/**
 * Create a triangle from three points
 */
export function createTriangle(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  options: { labels?: [string, string, string]; color?: string } = {}
): GeoGebraConstruction {
  const { labels = ['A', 'B', 'C'], color = '#000000' } = options;

  return {
    commands: [
      `${labels[0]} = (${a[0]}, ${a[1]})`,
      `${labels[1]} = (${b[0]}, ${b[1]})`,
      `${labels[2]} = (${c[0]}, ${c[1]})`,
      `triangle = Polygon(${labels[0]}, ${labels[1]}, ${labels[2]})`
    ],
    styles: [
      { name: labels[0], color, pointSize: 4, showLabel: true },
      { name: labels[1], color, pointSize: 4, showLabel: true },
      { name: labels[2], color, pointSize: 4, showLabel: true },
      { name: 'triangle', color, lineThickness: 2, fillOpacity: 0.1 }
    ],
    settings: {
      ...defaultSettings,
      coordSystem: {
        xmin: Math.min(a[0], b[0], c[0]) - 2,
        xmax: Math.max(a[0], b[0], c[0]) + 2,
        ymin: Math.min(a[1], b[1], c[1]) - 2,
        ymax: Math.max(a[1], b[1], c[1]) + 2
      }
    }
  };
}

/**
 * Get circle theorem construction by type
 */
export function getCircleTheoremConstruction(
  theoremType: CircleTheoremType
): GeoGebraConstruction {
  const theoremMap: Record<CircleTheoremType, GeoGebraConstruction> = {
    'angle-at-centre': circleAngleAtCentre,
    'angle-semicircle': circleAngleInSemicircle,
    'same-arc-angles': circleAnglesInSameSegment,
    'cyclic-quadrilateral': circleCyclicQuadrilateral,
    'tangent-radius': circleTangentRadius,
    'tangent-from-point': circleTangentsFromPoint,
    'alternate-segment': circleAlternateSegment,
    'perpendicular-chord': circlePerpendicularBisectsChord
  };

  return theoremMap[theoremType];
}
