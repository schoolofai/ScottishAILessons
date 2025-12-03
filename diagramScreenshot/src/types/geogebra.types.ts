/**
 * GeoGebra type definitions
 * Based on GeoGebra Apps API
 * https://wiki.geogebra.org/en/Reference:GeoGebra_Apps_API
 *
 * For National 5 Mathematics:
 * - Circle theorems
 * - Geometric constructions
 * - Angle properties
 * - Similarity and congruence
 */

import type { RenderOptions } from './common.types';

/**
 * GeoGebra app types
 */
export type GeoGebraAppType = 'classic' | 'geometry' | 'graphing' | '3d' | 'suite' | 'evaluator' | 'scientific' | 'notes';

/**
 * GeoGebra command - single construction command
 * Uses GeoGebra command syntax
 * https://wiki.geogebra.org/en/Commands
 */
export interface GeoGebraCommand {
  /** GeoGebra command string (e.g., "A = Point(0, 0)") */
  command: string;
  /** Optional comment for documentation */
  comment?: string;
}

/**
 * GeoGebra object styling
 */
export interface GeoGebraObjectStyle {
  /** Object name to style */
  name: string;
  /** Color in hex format (e.g., "#FF0000") or GeoGebra color name */
  color?: string;
  /** Line thickness (1-13) */
  lineThickness?: number;
  /** Point size (1-9) */
  pointSize?: number;
  /** Fill opacity (0-1) */
  fillOpacity?: number;
  /** Line style: 0=full, 1=dashed-long, 2=dashed-short, 3=dotted, 4=dash-dot */
  lineStyle?: 0 | 1 | 2 | 3 | 4;
  /** Point style: 0=filled circle, 1=cross, 2=empty circle, etc. */
  pointStyle?: number;
  /** Whether to show label */
  showLabel?: boolean;
  /** Label style: 0=name, 1=name+value, 2=value, 3=caption */
  labelStyle?: 0 | 1 | 2 | 3;
  /** Caption text */
  caption?: string;
  /** Whether object is visible */
  visible?: boolean;
  /** Whether object is fixed */
  fixed?: boolean;
}

/**
 * GeoGebra coordinate system settings
 */
export interface GeoGebraCoordSystem {
  /** Minimum x value */
  xmin?: number;
  /** Maximum x value */
  xmax?: number;
  /** Minimum y value */
  ymin?: number;
  /** Maximum y value */
  ymax?: number;
}

/**
 * GeoGebra construction settings
 */
export interface GeoGebraSettings {
  /** App type (default: 'classic') */
  appType?: GeoGebraAppType;
  /** Show axes */
  showAxes?: boolean;
  /** Show grid */
  showGrid?: boolean;
  /** Coordinate system bounds */
  coordSystem?: GeoGebraCoordSystem;
  /** Enable label dragging */
  enableLabelDrags?: boolean;
  /** Show reset icon */
  showResetIcon?: boolean;
  /** Angle unit: 'degree' or 'radian' */
  angleUnit?: 'degree' | 'radian';
  /** Labeling style: 0=auto, 1=all new, 2=no new, 3=all, 4=off */
  labelingStyle?: 0 | 1 | 2 | 3 | 4;
  /** Background color */
  backgroundColor?: string;
  /** Axis labels */
  axisLabels?: [string, string] | [string, string, string];
  /** Point capturing: 0=off, 1=snap-to-grid, 2=snap-to-objects, 3=automatic */
  pointCapturing?: 0 | 1 | 2 | 3;
  /** Right angle style: 0=none, 1=square, 2=dot, 3=L */
  rightAngleStyle?: 0 | 1 | 2 | 3;
}

/**
 * GeoGebra construction - a complete diagram
 */
export interface GeoGebraConstruction {
  /** Array of construction commands in execution order */
  commands: (string | GeoGebraCommand)[];
  /** Object styles to apply after construction */
  styles?: GeoGebraObjectStyle[];
  /** Construction settings */
  settings?: GeoGebraSettings;
}

/**
 * GeoGebra render request
 */
export interface GeoGebraRenderRequest {
  /** The construction to render */
  construction: GeoGebraConstruction;
  /** Render options */
  options?: RenderOptions;
}

/**
 * Helper type for circle theorem constructions
 */
export interface CircleTheoremConstruction {
  /** Circle center coordinates */
  center: [number, number];
  /** Circle radius or point on circle */
  radius: number | [number, number];
  /** Points on the circle for the theorem */
  points?: Array<{
    name: string;
    /** Angle in degrees from center (0 = right, 90 = top) */
    angle: number;
  }>;
  /** Whether to show construction lines */
  showConstruction?: boolean;
  /** Whether to show angle measurements */
  showAngles?: boolean;
}

/**
 * Common GeoGebra colors
 */
export const GEOGEBRA_COLORS = {
  red: '#CC0000',
  blue: '#0000CC',
  green: '#00CC00',
  yellow: '#CCCC00',
  purple: '#9900CC',
  orange: '#FF9900',
  cyan: '#00CCCC',
  pink: '#FF66CC',
  brown: '#996600',
  black: '#000000',
  gray: '#808080',
  white: '#FFFFFF'
} as const;

/**
 * National 5 Mathematics - Circle Theorem Types
 */
export type CircleTheoremType =
  | 'angle-at-centre'           // Angle at centre = 2 × angle at circumference
  | 'angle-semicircle'          // Angle in semicircle = 90°
  | 'same-arc-angles'           // Angles in same segment are equal
  | 'cyclic-quadrilateral'      // Opposite angles sum to 180°
  | 'tangent-radius'            // Tangent perpendicular to radius
  | 'tangent-from-point'        // Tangents from external point are equal
  | 'alternate-segment'         // Alternate segment theorem
  | 'perpendicular-chord';      // Perpendicular from centre bisects chord
