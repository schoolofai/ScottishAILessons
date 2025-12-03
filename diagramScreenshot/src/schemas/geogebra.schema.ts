/**
 * Zod validation schemas for GeoGebra render requests
 * Based on GeoGebra Apps API for geometric constructions
 */

import { z } from 'zod';
import type { GeoGebraRenderRequest } from '../types/geogebra.types';

// GeoGebra app type enum
const GeoGebraAppTypeSchema = z.enum([
  'classic', 'geometry', 'graphing', '3d', 'suite', 'evaluator', 'scientific', 'notes'
]);

// Command schema - can be string or object with command + comment
const GeoGebraCommandSchema = z.union([
  z.string().min(1, 'Command cannot be empty'),
  z.object({
    command: z.string().min(1, 'Command cannot be empty'),
    comment: z.string().optional()
  })
]);

// Object style schema
const GeoGebraObjectStyleSchema = z.object({
  name: z.string().min(1, 'Object name is required'),
  color: z.string().optional(),
  lineThickness: z.number().int().min(1).max(13).optional(),
  pointSize: z.number().int().min(1).max(9).optional(),
  fillOpacity: z.number().min(0).max(1).optional(),
  lineStyle: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  pointStyle: z.number().int().min(0).max(9).optional(),
  showLabel: z.boolean().optional(),
  labelStyle: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  caption: z.string().optional(),
  visible: z.boolean().optional(),
  fixed: z.boolean().optional()
});

// Coordinate system schema
const GeoGebraCoordSystemSchema = z.object({
  xmin: z.number().optional(),
  xmax: z.number().optional(),
  ymin: z.number().optional(),
  ymax: z.number().optional()
});

// Settings schema
const GeoGebraSettingsSchema = z.object({
  appType: GeoGebraAppTypeSchema.optional(),
  showAxes: z.boolean().optional(),
  showGrid: z.boolean().optional(),
  coordSystem: GeoGebraCoordSystemSchema.optional(),
  enableLabelDrags: z.boolean().optional(),
  showResetIcon: z.boolean().optional(),
  angleUnit: z.enum(['degree', 'radian']).optional(),
  labelingStyle: z.union([
    z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)
  ]).optional(),
  backgroundColor: z.string().optional(),
  axisLabels: z.union([
    z.tuple([z.string(), z.string()]),
    z.tuple([z.string(), z.string(), z.string()])
  ]).optional(),
  pointCapturing: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  rightAngleStyle: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional()
});

// Construction schema
const GeoGebraConstructionSchema = z.object({
  commands: z.array(GeoGebraCommandSchema).min(1, 'At least one command is required'),
  styles: z.array(GeoGebraObjectStyleSchema).optional(),
  settings: GeoGebraSettingsSchema.optional()
});

// Render options schema
const GeoGebraRenderOptionsSchema = z.object({
  width: z.number().int().min(100).max(4000).optional(),
  height: z.number().int().min(100).max(4000).optional(),
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().int().min(1).max(100).optional(),
  scale: z.number().min(1).max(4).optional(),
  timeout: z.number().int().min(1000).max(60000).optional(),
  returnFormat: z.enum(['base64', 'binary']).optional()
});

// Full GeoGebra render request schema
export const GeoGebraRenderRequestSchema = z.object({
  construction: GeoGebraConstructionSchema,
  options: GeoGebraRenderOptionsSchema.optional()
});

// Simple GeoGebra render request (just commands and optional settings)
export const SimpleGeoGebraRenderRequestSchema = z.object({
  commands: z.array(z.string()).min(1, 'At least one command is required'),
  coordSystem: GeoGebraCoordSystemSchema.optional(),
  showAxes: z.boolean().optional(),
  showGrid: z.boolean().optional(),
  options: GeoGebraRenderOptionsSchema.optional()
});

// Type for simple request
export interface SimpleGeoGebraRenderRequest {
  commands: string[];
  coordSystem?: {
    xmin?: number;
    xmax?: number;
    ymin?: number;
    ymax?: number;
  };
  showAxes?: boolean;
  showGrid?: boolean;
  options?: {
    width?: number;
    height?: number;
    format?: 'png' | 'jpeg';
    quality?: number;
    scale?: number;
    timeout?: number;
    returnFormat?: 'base64' | 'binary';
  };
}

/**
 * Validate a full GeoGebra render request
 */
export function validateGeoGebraRequest(data: unknown): GeoGebraRenderRequest {
  return GeoGebraRenderRequestSchema.parse(data);
}

/**
 * Validate a simple GeoGebra render request
 */
export function validateSimpleGeoGebraRequest(data: unknown): SimpleGeoGebraRenderRequest {
  return SimpleGeoGebraRenderRequestSchema.parse(data);
}

/**
 * Safe validation for full GeoGebra request
 */
export function safeValidateGeoGebraRequest(data: unknown) {
  return GeoGebraRenderRequestSchema.safeParse(data);
}

/**
 * Safe validation for simple GeoGebra request
 */
export function safeValidateSimpleGeoGebraRequest(data: unknown) {
  return SimpleGeoGebraRenderRequestSchema.safeParse(data);
}

/**
 * Convert simple request to full construction format
 */
export function convertSimpleToFullConstruction(
  simple: SimpleGeoGebraRenderRequest
): GeoGebraRenderRequest {
  return {
    construction: {
      commands: simple.commands,
      settings: {
        appType: 'geometry',
        showAxes: simple.showAxes ?? false,
        showGrid: simple.showGrid ?? false,
        coordSystem: simple.coordSystem
      }
    },
    options: simple.options
  };
}
