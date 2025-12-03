/**
 * Zod validation schema for Plotly render requests
 */

import { z } from 'zod';
import type { PlotlyRenderRequest } from '../types/plotly.types';

// Marker schema
const plotlyMarkerSchema = z.object({
  color: z.union([
    z.string(),
    z.array(z.string()),
    z.array(z.number())
  ]).optional(),
  size: z.union([z.number(), z.array(z.number())]).optional(),
  symbol: z.string().optional(),
  line: z.object({
    color: z.string().optional(),
    width: z.number().optional()
  }).optional(),
  opacity: z.number().min(0).max(1).optional(),
  colorscale: z.union([
    z.string(),
    z.array(z.tuple([z.number(), z.string()]))
  ]).optional(),
  showscale: z.boolean().optional()
}).optional();

// Line schema
const plotlyLineSchema = z.object({
  color: z.string().optional(),
  width: z.number().optional(),
  dash: z.enum(['solid', 'dot', 'dash', 'dashdot', 'longdash', 'longdashdot']).optional(),
  shape: z.enum(['linear', 'spline', 'hv', 'vh', 'hvh', 'vhv']).optional()
}).optional();

// Trace schema
const plotlyTraceSchema = z.object({
  type: z.enum(['scatter', 'bar', 'pie', 'histogram', 'box', 'heatmap', 'line']),
  x: z.array(z.union([z.number(), z.string()])).optional(),
  y: z.array(z.number()).optional(),
  values: z.array(z.number()).optional(),
  labels: z.array(z.string()).optional(),
  name: z.string().optional(),
  mode: z.enum(['lines', 'markers', 'lines+markers', 'text', 'none']).optional(),
  marker: plotlyMarkerSchema,
  line: plotlyLineSchema,
  text: z.array(z.string()).optional(),
  textposition: z.enum(['inside', 'outside', 'auto', 'none']).optional(),
  boxpoints: z.union([
    z.enum(['all', 'outliers', 'suspectedoutliers']),
    z.literal(false)
  ]).optional(),
  nbinsx: z.number().int().positive().optional(),
  histnorm: z.enum(['', 'percent', 'probability', 'density']).optional(),
  fill: z.enum(['none', 'tozeroy', 'tozerox', 'tonexty', 'tonextx', 'toself']).optional(),
  fillcolor: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
  hovertext: z.union([z.string(), z.array(z.string())]).optional(),
  hoverinfo: z.string().optional()
});

// Font schema
const plotlyFontSchema = z.object({
  family: z.string().optional(),
  size: z.number().positive().optional(),
  color: z.string().optional()
}).optional();

// Axis schema
const plotlyAxisSchema = z.object({
  title: z.union([
    z.string(),
    z.object({ text: z.string(), font: plotlyFontSchema })
  ]).optional(),
  range: z.tuple([z.number(), z.number()]).optional(),
  showgrid: z.boolean().optional(),
  zeroline: z.boolean().optional(),
  dtick: z.number().optional(),
  tickformat: z.string().optional(),
  type: z.enum(['linear', 'log', 'date', 'category']).optional(),
  showticklabels: z.boolean().optional(),
  tickangle: z.number().optional(),
  linecolor: z.string().optional(),
  gridcolor: z.string().optional()
}).optional();

// Annotation schema
const plotlyAnnotationSchema = z.object({
  x: z.number(),
  y: z.number(),
  text: z.string(),
  showarrow: z.boolean().optional(),
  arrowhead: z.number().int().min(0).max(8).optional(),
  arrowcolor: z.string().optional(),
  font: plotlyFontSchema,
  bgcolor: z.string().optional(),
  bordercolor: z.string().optional(),
  xanchor: z.enum(['auto', 'left', 'center', 'right']).optional(),
  yanchor: z.enum(['auto', 'top', 'middle', 'bottom']).optional()
});

// Layout schema
const plotlyLayoutSchema = z.object({
  title: z.union([
    z.string(),
    z.object({ text: z.string(), font: plotlyFontSchema })
  ]).optional(),
  xaxis: plotlyAxisSchema,
  yaxis: plotlyAxisSchema,
  showlegend: z.boolean().optional(),
  legend: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    orientation: z.enum(['v', 'h']).optional(),
    bgcolor: z.string().optional(),
    bordercolor: z.string().optional(),
    font: plotlyFontSchema
  }).optional(),
  bargap: z.number().min(0).max(1).optional(),
  bargroupgap: z.number().min(0).max(1).optional(),
  barmode: z.enum(['group', 'stack', 'overlay', 'relative']).optional(),
  paper_bgcolor: z.string().optional(),
  plot_bgcolor: z.string().optional(),
  font: plotlyFontSchema,
  margin: z.object({
    l: z.number().optional(),
    r: z.number().optional(),
    t: z.number().optional(),
    b: z.number().optional(),
    pad: z.number().optional()
  }).optional(),
  annotations: z.array(plotlyAnnotationSchema).optional(),
  hovermode: z.union([
    z.enum(['x', 'y', 'closest']),
    z.literal(false)
  ]).optional(),
  boxmode: z.enum(['group', 'overlay']).optional()
}).optional();

// Config schema
const plotlyConfigSchema = z.object({
  staticPlot: z.boolean().optional(),
  displayModeBar: z.boolean().optional(),
  responsive: z.boolean().optional(),
  showEditInChartStudio: z.boolean().optional(),
  plotGlPixelRatio: z.number().optional()
}).optional();

// Render options schema
const renderOptionsSchema = z.object({
  width: z.number().int().min(100).max(4000).optional(),
  height: z.number().int().min(100).max(4000).optional(),
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().int().min(1).max(100).optional(),
  scale: z.number().min(1).max(4).optional(),
  timeout: z.number().int().min(1000).max(60000).optional(),
  returnFormat: z.enum(['base64', 'binary']).optional()
}).optional();

// Complete request schema
export const plotlyRequestSchema = z.object({
  chart: z.object({
    data: z.array(plotlyTraceSchema).min(1, 'At least one trace is required'),
    layout: plotlyLayoutSchema,
    config: plotlyConfigSchema
  }),
  options: renderOptionsSchema
});

/**
 * Validate a Plotly render request
 * @throws ZodError if validation fails
 */
export function validatePlotlyRequest(data: unknown): PlotlyRenderRequest {
  return plotlyRequestSchema.parse(data);
}

/**
 * Safely validate a Plotly render request
 * @returns { success: true, data } or { success: false, error }
 */
export function safeValidatePlotlyRequest(data: unknown) {
  return plotlyRequestSchema.safeParse(data);
}
