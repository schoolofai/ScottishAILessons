/**
 * Zod validation schemas for Desmos render requests
 */

import { z } from 'zod';
import type { DesmosRenderRequest, SimpleDesmosRenderRequest } from '../types/desmos.types';

// Line style enum
const LineStyleSchema = z.enum(['SOLID', 'DASHED', 'DOTTED']);

// Point style enum
const PointStyleSchema = z.enum(['POINT', 'OPEN', 'CROSS']);

// Label orientation enum
const LabelOrientationSchema = z.enum([
  'default', 'center', 'center_auto', 'auto_center',
  'above', 'above_left', 'above_right',
  'below', 'below_left', 'below_right',
  'left', 'right'
]);

// Drag mode enum
const DragModeSchema = z.enum(['NONE', 'X', 'Y', 'XY', 'AUTO']);

// Loop mode enum
const LoopModeSchema = z.enum(['LOOP_FORWARD_REVERSE', 'LOOP_FORWARD', 'PLAY_ONCE', 'PLAY_INDEFINITELY']);

// Arrow mode enum
const ArrowModeSchema = z.enum(['NONE', 'POSITIVE', 'BOTH']);

// Domain schema
const DomainSchema = z.object({
  min: z.string(),
  max: z.string()
});

// Slider schema
const SliderSchema = z.object({
  hardMin: z.boolean().optional(),
  hardMax: z.boolean().optional(),
  min: z.string().optional(),
  max: z.string().optional(),
  step: z.string().optional(),
  animationPeriod: z.number().optional(),
  loopMode: LoopModeSchema.optional(),
  playDirection: z.number().optional(),
  isPlaying: z.boolean().optional()
});

// Base expression schema
const DesmosExpressionSchema = z.object({
  id: z.string().optional(),
  type: z.literal('expression').optional(),
  latex: z.string().optional(),
  color: z.string().optional(),
  hidden: z.boolean().optional(),
  secret: z.boolean().optional(),
  lineStyle: LineStyleSchema.optional(),
  lineWidth: z.number().min(0).max(20).optional(),
  lineOpacity: z.number().min(0).max(1).optional(),
  pointStyle: PointStyleSchema.optional(),
  pointSize: z.number().min(0).max(50).optional(),
  pointOpacity: z.number().min(0).max(1).optional(),
  fillOpacity: z.number().min(0).max(1).optional(),
  label: z.string().optional(),
  showLabel: z.boolean().optional(),
  labelSize: z.enum(['small', 'medium', 'large']).optional(),
  labelOrientation: LabelOrientationSchema.optional(),
  dragMode: DragModeSchema.optional(),
  domain: DomainSchema.optional(),
  cdf: z.object({
    show: z.boolean(),
    min: z.string().optional(),
    max: z.string().optional()
  }).optional(),
  parametricDomain: DomainSchema.optional(),
  polarDomain: DomainSchema.optional(),
  slider: SliderSchema.optional()
});

// Table column schema
const DesmosTableColumnSchema = z.object({
  latex: z.string(),
  values: z.array(z.string()).optional(),
  hidden: z.boolean().optional(),
  color: z.string().optional(),
  lineStyle: LineStyleSchema.optional(),
  lineWidth: z.number().optional(),
  lineOpacity: z.number().optional(),
  pointStyle: PointStyleSchema.optional(),
  pointSize: z.number().optional(),
  pointOpacity: z.number().optional(),
  dragMode: DragModeSchema.optional()
});

// Table schema
const DesmosTableSchema = z.object({
  id: z.string().optional(),
  type: z.literal('table'),
  columns: z.array(DesmosTableColumnSchema).min(1)
});

// Folder schema
const DesmosFolderSchema = z.object({
  id: z.string().optional(),
  type: z.literal('folder'),
  title: z.string().optional(),
  collapsed: z.boolean().optional(),
  hidden: z.boolean().optional(),
  secret: z.boolean().optional()
});

// Text schema
const DesmosTextSchema = z.object({
  id: z.string().optional(),
  type: z.literal('text'),
  text: z.string().optional(),
  hidden: z.boolean().optional(),
  secret: z.boolean().optional()
});

// Image schema
const DesmosImageSchema = z.object({
  id: z.string().optional(),
  type: z.literal('image'),
  image_url: z.string().url(),
  name: z.string().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
  center: z.string().optional(),
  angle: z.string().optional(),
  opacity: z.string().optional(),
  foreground: z.boolean().optional(),
  draggable: z.boolean().optional(),
  hidden: z.boolean().optional(),
  secret: z.boolean().optional()
});

// Expression item union
const DesmosExpressionItemSchema = z.union([
  DesmosExpressionSchema,
  DesmosTableSchema,
  DesmosFolderSchema,
  DesmosTextSchema,
  DesmosImageSchema
]);

// Viewport schema
const ViewportSchema = z.object({
  xmin: z.number().optional(),
  xmax: z.number().optional(),
  ymin: z.number().optional(),
  ymax: z.number().optional()
});

// Graph settings schema
const GraphSettingsSchema = z.object({
  viewport: ViewportSchema.optional(),
  xAxisMinorSubdivisions: z.number().optional(),
  yAxisMinorSubdivisions: z.number().optional(),
  xAxisArrowMode: ArrowModeSchema.optional(),
  yAxisArrowMode: ArrowModeSchema.optional(),
  xAxisLabel: z.string().optional(),
  yAxisLabel: z.string().optional(),
  xAxisStep: z.number().optional(),
  yAxisStep: z.number().optional(),
  xAxisNumbers: z.boolean().optional(),
  yAxisNumbers: z.boolean().optional(),
  polarMode: z.boolean().optional(),
  polarNumbers: z.boolean().optional(),
  degreeMode: z.boolean().optional(),
  showGrid: z.boolean().optional(),
  showXAxis: z.boolean().optional(),
  showYAxis: z.boolean().optional(),
  squareAxes: z.boolean().optional(),
  restrictGridToFirstQuadrant: z.boolean().optional(),
  polarGrid: z.boolean().optional(),
  userLockedViewport: z.boolean().optional()
});

// Ticker schema
const TickerSchema = z.object({
  handlerLatex: z.string().optional(),
  minStepLatex: z.string().optional(),
  playing: z.boolean().optional(),
  open: z.boolean().optional()
});

// Expressions container schema
const ExpressionsSchema = z.object({
  list: z.array(DesmosExpressionItemSchema).min(1, 'At least one expression is required'),
  ticker: TickerSchema.optional()
});

// Graph state schema
const DesmosGraphStateSchema = z.object({
  version: z.number().optional(),
  randomSeed: z.string().optional(),
  graph: GraphSettingsSchema.optional(),
  expressions: ExpressionsSchema
});

// Calculator settings schema
const DesmosCalculatorSettingsSchema = z.object({
  keypad: z.boolean().optional(),
  graphpaper: z.boolean().optional(),
  expressions: z.boolean().optional(),
  settingsMenu: z.boolean().optional(),
  zoomButtons: z.boolean().optional(),
  expressionsTopbar: z.boolean().optional(),
  pointsOfInterest: z.boolean().optional(),
  trace: z.boolean().optional(),
  border: z.boolean().optional(),
  lockViewport: z.boolean().optional(),
  expressionsCollapsed: z.boolean().optional(),
  administerSecretFolders: z.boolean().optional(),
  images: z.boolean().optional(),
  folders: z.boolean().optional(),
  notes: z.boolean().optional(),
  sliders: z.boolean().optional(),
  links: z.boolean().optional(),
  qwertyKeyboard: z.boolean().optional(),
  restrictedFunctions: z.boolean().optional(),
  forceEnableGeometryFunctions: z.boolean().optional(),
  pasteGraphLink: z.boolean().optional(),
  pasteTableData: z.boolean().optional(),
  clearIntoDegreeMode: z.boolean().optional(),
  autosize: z.boolean().optional(),
  plotSingleVariableImplicitEquations: z.boolean().optional(),
  plotImplicits: z.boolean().optional(),
  plotInequalities: z.boolean().optional(),
  colors: z.record(z.string()).optional(),
  invertedColors: z.boolean().optional(),
  fontSize: z.number().min(8).max(24).optional(),
  language: z.string().optional(),
  projectorMode: z.boolean().optional(),
  brailleMode: z.enum(['none', 'nemeth', 'ueb']).optional(),
  sixKeyInput: z.boolean().optional(),
  brailleControls: z.boolean().optional(),
  zoomFit: z.boolean().optional(),
  forceLogModeRegressions: z.boolean().optional(),
  actions: z.boolean().optional(),
  decimalToFraction: z.boolean().optional(),
  backgroundColor: z.string().optional()
});

// Render options schema
const DesmosRenderOptionsSchema = z.object({
  width: z.number().min(100).max(4000).optional(),
  height: z.number().min(100).max(4000).optional(),
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().min(1).max(100).optional(),
  scale: z.number().min(1).max(4).optional(),
  timeout: z.number().min(1000).max(60000).optional(),
  returnFormat: z.enum(['base64', 'binary']).optional()
});

// Full Desmos render request schema
export const DesmosRenderRequestSchema = z.object({
  state: DesmosGraphStateSchema,
  settings: DesmosCalculatorSettingsSchema.optional(),
  options: DesmosRenderOptionsSchema.optional()
});

// Simple expression schema
const SimpleExpressionSchema = z.object({
  latex: z.string().min(1, 'LaTeX expression is required'),
  color: z.string().optional(),
  hidden: z.boolean().optional(),
  lineStyle: LineStyleSchema.optional(),
  lineWidth: z.number().min(0).max(20).optional(),
  label: z.string().optional(),
  showLabel: z.boolean().optional()
});

// Simple settings schema
const SimpleSettingsSchema = z.object({
  showGrid: z.boolean().optional(),
  showXAxis: z.boolean().optional(),
  showYAxis: z.boolean().optional(),
  degreeMode: z.boolean().optional(),
  polarMode: z.boolean().optional()
});

// Simple render options schema
const SimpleRenderOptionsSchema = z.object({
  width: z.number().min(100).max(4000).optional(),
  height: z.number().min(100).max(4000).optional(),
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().min(1).max(100).optional(),
  scale: z.number().min(1).max(4).optional(),
  timeout: z.number().min(1000).max(60000).optional()
});

// Simple Desmos render request schema
export const SimpleDesmosRenderRequestSchema = z.object({
  expressions: z.array(SimpleExpressionSchema).min(1, 'At least one expression is required'),
  viewport: ViewportSchema.optional(),
  settings: SimpleSettingsSchema.optional(),
  options: SimpleRenderOptionsSchema.optional()
});

/**
 * Validate a full Desmos render request
 */
export function validateDesmosRequest(data: unknown): DesmosRenderRequest {
  return DesmosRenderRequestSchema.parse(data);
}

/**
 * Validate a simple Desmos render request
 */
export function validateSimpleDesmosRequest(data: unknown): SimpleDesmosRenderRequest {
  return SimpleDesmosRenderRequestSchema.parse(data);
}

/**
 * Safe validation for full Desmos request (returns result object)
 */
export function safeValidateDesmosRequest(data: unknown) {
  return DesmosRenderRequestSchema.safeParse(data);
}

/**
 * Safe validation for simple Desmos request (returns result object)
 */
export function safeValidateSimpleDesmosRequest(data: unknown) {
  return SimpleDesmosRenderRequestSchema.safeParse(data);
}

/**
 * Convert simple request to full state format
 */
export function convertSimpleToFullState(simple: SimpleDesmosRenderRequest): DesmosRenderRequest {
  const expressions = simple.expressions.map((expr, index) => ({
    id: `expr_${index}`,
    latex: expr.latex,
    color: expr.color,
    hidden: expr.hidden,
    lineStyle: expr.lineStyle,
    lineWidth: expr.lineWidth,
    label: expr.label,
    showLabel: expr.showLabel
  }));

  return {
    state: {
      graph: {
        viewport: simple.viewport,
        showGrid: simple.settings?.showGrid,
        showXAxis: simple.settings?.showXAxis,
        showYAxis: simple.settings?.showYAxis,
        degreeMode: simple.settings?.degreeMode,
        polarMode: simple.settings?.polarMode
      },
      expressions: {
        list: expressions
      }
    },
    options: simple.options
  };
}
