/**
 * TypeScript types for Plotly.js chart rendering
 *
 * Based on Plotly.js type definitions, simplified for our use cases:
 * - Statistical charts (bar, scatter, box, histogram)
 * - Data visualization (pie, heatmap)
 */

import { RenderOptions } from './common.types';

/**
 * Plotly trace (data series) configuration
 */
export interface PlotlyTrace {
  /** Chart type */
  type: 'scatter' | 'bar' | 'pie' | 'histogram' | 'box' | 'heatmap' | 'line';

  /** X-axis values (categories or numbers) */
  x?: (number | string)[];

  /** Y-axis values */
  y?: number[];

  /** Values for pie charts */
  values?: number[];

  /** Labels for pie charts */
  labels?: string[];

  /** Legend label for this trace */
  name?: string;

  /** Display mode for scatter/line charts */
  mode?: 'lines' | 'markers' | 'lines+markers' | 'text' | 'none';

  /** Marker styling */
  marker?: PlotlyMarker;

  /** Line styling */
  line?: PlotlyLine;

  /** Text labels for data points */
  text?: string[];

  /** Position of text labels */
  textposition?: 'inside' | 'outside' | 'auto' | 'none';

  /** Box plot: show individual points */
  boxpoints?: 'all' | 'outliers' | 'suspectedoutliers' | false;

  /** Histogram: number of bins */
  nbinsx?: number;

  /** Histogram: normalization mode */
  histnorm?: '' | 'percent' | 'probability' | 'density';

  /** Fill area under line */
  fill?: 'none' | 'tozeroy' | 'tozerox' | 'tonexty' | 'tonextx' | 'toself';

  /** Fill color for area */
  fillcolor?: string;

  /** Opacity (0-1) */
  opacity?: number;

  /** Hover text */
  hovertext?: string | string[];

  /** Hover info display */
  hoverinfo?: string;
}

/**
 * Marker styling configuration
 */
export interface PlotlyMarker {
  /** Marker color (single or per-point) */
  color?: string | string[] | number[];

  /** Marker size (single or per-point) */
  size?: number | number[];

  /** Marker symbol */
  symbol?: string;

  /** Marker outline */
  line?: {
    color?: string;
    width?: number;
  };

  /** Opacity (0-1) */
  opacity?: number;

  /** Color scale for numeric colors */
  colorscale?: string | [number, string][];

  /** Show color bar */
  showscale?: boolean;
}

/**
 * Line styling configuration
 */
export interface PlotlyLine {
  /** Line color */
  color?: string;

  /** Line width */
  width?: number;

  /** Line dash pattern */
  dash?: 'solid' | 'dot' | 'dash' | 'dashdot' | 'longdash' | 'longdashdot';

  /** Line shape (for scatter) */
  shape?: 'linear' | 'spline' | 'hv' | 'vh' | 'hvh' | 'vhv';
}

/**
 * Axis configuration
 */
export interface PlotlyAxis {
  /** Axis title */
  title?: string | { text: string; font?: PlotlyFont };

  /** Axis range [min, max] */
  range?: [number, number];

  /** Show grid lines */
  showgrid?: boolean;

  /** Show zero line */
  zeroline?: boolean;

  /** Tick interval */
  dtick?: number;

  /** Tick format string */
  tickformat?: string;

  /** Axis type */
  type?: 'linear' | 'log' | 'date' | 'category';

  /** Show tick labels */
  showticklabels?: boolean;

  /** Tick angle */
  tickangle?: number;

  /** Axis line color */
  linecolor?: string;

  /** Grid color */
  gridcolor?: string;
}

/**
 * Font configuration
 */
export interface PlotlyFont {
  family?: string;
  size?: number;
  color?: string;
}

/**
 * Annotation configuration
 */
export interface PlotlyAnnotation {
  /** X position */
  x: number;

  /** Y position */
  y: number;

  /** Annotation text */
  text: string;

  /** Show arrow */
  showarrow?: boolean;

  /** Arrow head style */
  arrowhead?: number;

  /** Arrow color */
  arrowcolor?: string;

  /** Text font */
  font?: PlotlyFont;

  /** Background color */
  bgcolor?: string;

  /** Border color */
  bordercolor?: string;

  /** X anchor */
  xanchor?: 'auto' | 'left' | 'center' | 'right';

  /** Y anchor */
  yanchor?: 'auto' | 'top' | 'middle' | 'bottom';
}

/**
 * Layout configuration
 */
export interface PlotlyLayout {
  /** Chart title */
  title?: string | { text: string; font?: PlotlyFont };

  /** X-axis configuration */
  xaxis?: PlotlyAxis;

  /** Y-axis configuration */
  yaxis?: PlotlyAxis;

  /** Show legend */
  showlegend?: boolean;

  /** Legend configuration */
  legend?: {
    x?: number;
    y?: number;
    orientation?: 'v' | 'h';
    bgcolor?: string;
    bordercolor?: string;
    font?: PlotlyFont;
  };

  /** Bar gap (0-1) */
  bargap?: number;

  /** Bar group gap (0-1) */
  bargroupgap?: number;

  /** Bar mode */
  barmode?: 'group' | 'stack' | 'overlay' | 'relative';

  /** Paper background color */
  paper_bgcolor?: string;

  /** Plot area background color */
  plot_bgcolor?: string;

  /** Default font */
  font?: PlotlyFont;

  /** Margins */
  margin?: {
    l?: number;
    r?: number;
    t?: number;
    b?: number;
    pad?: number;
  };

  /** Annotations */
  annotations?: PlotlyAnnotation[];

  /** Hover mode */
  hovermode?: 'x' | 'y' | 'closest' | false;

  /** Box mode for multiple box plots */
  boxmode?: 'group' | 'overlay';
}

/**
 * Config options
 */
export interface PlotlyConfig {
  /** Static image (no interactivity) */
  staticPlot?: boolean;

  /** Show mode bar */
  displayModeBar?: boolean;

  /** Responsive sizing */
  responsive?: boolean;

  /** Show edit in chart studio link */
  showEditInChartStudio?: boolean;

  /** Plot glyph outline width */
  plotGlPixelRatio?: number;
}

/**
 * Complete Plotly render request
 */
export interface PlotlyRenderRequest {
  chart: {
    /** Data traces */
    data: PlotlyTrace[];

    /** Layout configuration */
    layout?: PlotlyLayout;

    /** Config options */
    config?: PlotlyConfig;
  };

  /** Render options (width, height, format, etc.) */
  options?: RenderOptions;
}
