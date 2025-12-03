/**
 * PLOTLY RENDERING EXAMPLES
 *
 * This file contains example configurations for the Plotly charting library.
 * Use these patterns when generating Plotly visualization requests.
 *
 * WHEN TO USE PLOTLY:
 * - Bar charts, pie charts, line graphs with data
 * - Histograms and frequency diagrams
 * - Box plots (five-figure summary visualization)
 * - Scatter diagrams and correlation
 * - Cumulative frequency curves (ogives)
 * - Comparing datasets visually
 * - Any request with actual data values to display
 *
 * PLOTLY DATA STRUCTURE:
 * - data: Array of trace objects (each trace is one data series)
 * - layout: Object controlling appearance (title, axes, legends)
 * - Each trace has: x, y (arrays), type, name, marker (styling)
 *
 * NATIONAL 5 STATISTICS TOPICS:
 * - Displaying data (bar charts, pie charts, line graphs)
 * - Scatter diagrams and correlation
 * - Comparing distributions (box plots, histograms)
 */

import type { PlotlyRenderRequest } from '../../src/types/plotly.types';

/**
 * =============================================================================
 * BAR CHARTS
 * National 5 Topic: Statistics - Displaying Data
 * =============================================================================
 */

/**
 * Example: Basic Vertical Bar Chart
 * Use for: Categorical data comparison (e.g., survey results, counts by category)
 */
export const barChartBasic: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        x: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        y: [5, 8, 3, 9, 6],
        type: 'bar',
        marker: {
          color: '#2d70b3'
        }
      }
    ],
    layout: {
      title: 'Daily Sales',
      xaxis: { title: 'Day' },
      yaxis: { title: 'Number of Sales' }
    }
  }
};

/**
 * Example: Grouped Bar Chart (Comparing categories)
 * Use for: Comparing two or more data sets across same categories
 */
export const barChartGrouped: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        x: ['Maths', 'English', 'Science', 'History'],
        y: [75, 82, 68, 71],
        type: 'bar',
        name: 'Class A',
        marker: { color: '#c74440' }
      },
      {
        x: ['Maths', 'English', 'Science', 'History'],
        y: [68, 79, 85, 65],
        type: 'bar',
        name: 'Class B',
        marker: { color: '#2d70b3' }
      }
    ],
    layout: {
      title: 'Average Test Scores by Subject',
      barmode: 'group',
      xaxis: { title: 'Subject' },
      yaxis: { title: 'Average Score (%)' }
    }
  }
};

/**
 * Example: Horizontal Bar Chart
 * Use for: When category labels are long, or for ranking displays
 */
export const barChartHorizontal: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        y: ['Football', 'Swimming', 'Running', 'Cycling', 'Tennis'],
        x: [42, 28, 35, 21, 18],
        type: 'bar',
        orientation: 'h',
        marker: { color: '#388c46' }
      }
    ],
    layout: {
      title: 'Favourite Sports Survey',
      xaxis: { title: 'Number of Students' },
      yaxis: { title: 'Sport' }
    }
  }
};

/**
 * =============================================================================
 * PIE CHARTS
 * National 5 Topic: Statistics - Displaying Data
 * =============================================================================
 */

/**
 * Example: Basic Pie Chart
 * Use for: Showing parts of a whole (percentages, proportions)
 */
export const pieChartBasic: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        values: [35, 25, 20, 15, 5],
        labels: ['Walk', 'Bus', 'Car', 'Cycle', 'Train'],
        type: 'pie',
        marker: {
          colors: ['#c74440', '#2d70b3', '#388c46', '#fa7e19', '#6042a6']
        }
      }
    ],
    layout: {
      title: 'How Students Travel to School'
    }
  }
};

/**
 * Example: Pie Chart with Percentages
 * Use for: Showing proportions with explicit percentages
 */
export const pieChartWithPercentages: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        values: [40, 30, 20, 10],
        labels: ['A Grade', 'B Grade', 'C Grade', 'D Grade'],
        type: 'pie',
        textinfo: 'label+percent',
        marker: {
          colors: ['#388c46', '#2d70b3', '#fa7e19', '#c74440']
        }
      }
    ],
    layout: {
      title: 'Exam Results Distribution'
    }
  }
};

/**
 * =============================================================================
 * LINE GRAPHS
 * National 5 Topic: Statistics - Time Series
 * =============================================================================
 */

/**
 * Example: Basic Line Graph
 * Use for: Showing trends over time
 */
export const lineGraphBasic: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        x: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        y: [10, 15, 13, 17, 22, 28],
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#c74440', width: 2 },
        marker: { size: 8 }
      }
    ],
    layout: {
      title: 'Monthly Temperature',
      xaxis: { title: 'Month' },
      yaxis: { title: 'Temperature (°C)' }
    }
  }
};

/**
 * Example: Multiple Line Graph (Comparing trends)
 * Use for: Comparing how two quantities change over same period
 */
export const lineGraphMultiple: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        x: [2018, 2019, 2020, 2021, 2022, 2023],
        y: [120, 135, 128, 142, 155, 168],
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Shop A',
        line: { color: '#c74440', width: 2 }
      },
      {
        x: [2018, 2019, 2020, 2021, 2022, 2023],
        y: [95, 110, 125, 130, 145, 160],
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Shop B',
        line: { color: '#2d70b3', width: 2 }
      }
    ],
    layout: {
      title: 'Annual Sales Comparison',
      xaxis: { title: 'Year' },
      yaxis: { title: 'Sales (thousands £)' },
      legend: { x: 0.1, y: 0.9 }
    }
  }
};

/**
 * =============================================================================
 * SCATTER DIAGRAMS
 * National 5 Topic: Statistics - Correlation
 * =============================================================================
 */

/**
 * Example: Scatter Diagram (Positive Correlation)
 * Use for: Investigating relationship between two variables
 */
export const scatterPositiveCorrelation: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        x: [150, 155, 160, 165, 170, 175, 180, 185, 190],
        y: [50, 55, 58, 62, 68, 72, 78, 82, 88],
        type: 'scatter',
        mode: 'markers',
        marker: {
          color: '#2d70b3',
          size: 10
        }
      }
    ],
    layout: {
      title: 'Height vs Weight',
      xaxis: { title: 'Height (cm)' },
      yaxis: { title: 'Weight (kg)' }
    }
  }
};

/**
 * Example: Scatter with Line of Best Fit
 * Use for: Showing correlation with trend line
 */
export const scatterWithTrendLine: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        x: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        y: [2.1, 4.3, 5.8, 8.2, 9.5, 12.1, 14.0, 15.8, 18.2, 20.1],
        type: 'scatter',
        mode: 'markers',
        name: 'Data',
        marker: { color: '#2d70b3', size: 10 }
      },
      {
        x: [0, 10],
        y: [0.5, 20.5],
        type: 'scatter',
        mode: 'lines',
        name: 'Best Fit Line',
        line: { color: '#c74440', width: 2, dash: 'dash' }
      }
    ],
    layout: {
      title: 'Study Hours vs Test Score',
      xaxis: { title: 'Hours Studied' },
      yaxis: { title: 'Test Score (%)' }
    }
  }
};

/**
 * Example: Scatter (No Correlation)
 * Use for: Showing when variables are not related
 */
export const scatterNoCorrelation: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        x: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        y: [5, 8, 3, 7, 2, 9, 4, 6, 8, 3],
        type: 'scatter',
        mode: 'markers',
        marker: { color: '#6042a6', size: 10 }
      }
    ],
    layout: {
      title: 'Shoe Size vs Test Score (No Correlation)',
      xaxis: { title: 'Shoe Size' },
      yaxis: { title: 'Test Score' }
    }
  }
};

/**
 * =============================================================================
 * HISTOGRAMS
 * National 5 Topic: Statistics - Frequency Diagrams
 * =============================================================================
 */

/**
 * Example: Basic Histogram
 * Use for: Showing distribution of continuous data
 */
export const histogramBasic: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        x: [45, 52, 48, 61, 55, 58, 63, 49, 57, 54,
            51, 59, 62, 47, 56, 53, 60, 50, 64, 46],
        type: 'histogram',
        marker: { color: '#2d70b3' },
        xbins: { size: 5 }
      }
    ],
    layout: {
      title: 'Test Score Distribution',
      xaxis: { title: 'Score' },
      yaxis: { title: 'Frequency' }
    }
  }
};

/**
 * Example: Histogram from Grouped Data
 * Use for: When you have frequency table data
 * Note: Use bar chart with calculated midpoints for pre-grouped data
 */
export const histogramGrouped: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        x: ['0-10', '10-20', '20-30', '30-40', '40-50'],
        y: [3, 8, 15, 12, 7],
        type: 'bar',
        marker: { color: '#388c46' }
      }
    ],
    layout: {
      title: 'Age Distribution',
      xaxis: { title: 'Age Range' },
      yaxis: { title: 'Frequency' },
      bargap: 0  // No gap for histogram appearance
    }
  }
};

/**
 * =============================================================================
 * BOX PLOTS
 * National 5 Topic: Statistics - Five Figure Summary
 * =============================================================================
 */

/**
 * Example: Basic Box Plot
 * Use for: Showing five-figure summary (min, Q1, median, Q3, max)
 */
export const boxPlotBasic: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        y: [12, 15, 18, 22, 25, 28, 35, 38, 42, 45, 48, 52],
        type: 'box',
        name: 'Test Scores',
        marker: { color: '#2d70b3' }
      }
    ],
    layout: {
      title: 'Test Score Distribution',
      yaxis: { title: 'Score' }
    }
  }
};

/**
 * Example: Comparing Box Plots
 * Use for: Comparing distributions of two datasets
 */
export const boxPlotComparison: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        y: [65, 70, 72, 75, 78, 80, 82, 85, 88, 92],
        type: 'box',
        name: 'Class A',
        marker: { color: '#c74440' }
      },
      {
        y: [55, 60, 68, 72, 75, 77, 80, 83, 90, 95],
        type: 'box',
        name: 'Class B',
        marker: { color: '#2d70b3' }
      }
    ],
    layout: {
      title: 'Comparing Test Scores Between Classes',
      yaxis: { title: 'Score (%)' }
    }
  }
};

/**
 * =============================================================================
 * CUMULATIVE FREQUENCY (OGIVE)
 * National 5 Topic: Statistics - Cumulative Frequency
 * =============================================================================
 */

/**
 * Example: Cumulative Frequency Curve
 * Use for: Finding median, quartiles from grouped data
 */
export const cumulativeFrequency: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        x: [10, 20, 30, 40, 50, 60, 70, 80],  // Upper class boundaries
        y: [2, 8, 20, 38, 56, 72, 85, 92],     // Cumulative frequencies
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#2d70b3', width: 2, shape: 'spline' },
        marker: { size: 8 }
      }
    ],
    layout: {
      title: 'Cumulative Frequency Diagram',
      xaxis: { title: 'Score (upper boundary)' },
      yaxis: { title: 'Cumulative Frequency' }
    }
  }
};

/**
 * =============================================================================
 * FREQUENCY POLYGONS
 * National 5 Topic: Statistics
 * =============================================================================
 */

/**
 * Example: Frequency Polygon
 * Use for: Alternative to histogram using midpoints
 */
export const frequencyPolygon: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        x: [5, 15, 25, 35, 45, 55],  // Class midpoints
        y: [3, 8, 15, 12, 7, 2],      // Frequencies
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#388c46', width: 2 },
        marker: { size: 8 }
      }
    ],
    layout: {
      title: 'Frequency Polygon - Test Scores',
      xaxis: { title: 'Score (midpoint)' },
      yaxis: { title: 'Frequency' }
    }
  }
};

/**
 * =============================================================================
 * HEATMAPS
 * For correlation matrices or 2D data
 * =============================================================================
 */

/**
 * Example: Basic Heatmap
 * Use for: Showing intensity/correlation across two dimensions
 */
export const heatmapBasic: PlotlyRenderRequest = {
  chart: {
    data: [
      {
        z: [
          [1, 20, 30],
          [20, 1, 60],
          [30, 60, 1]
        ],
        x: ['Maths', 'Science', 'English'],
        y: ['Maths', 'Science', 'English'],
        type: 'heatmap',
        colorscale: 'Blues'
      }
    ],
    layout: {
      title: 'Subject Correlation'
    }
  }
};

/**
 * =============================================================================
 * RENDER OPTIONS REFERENCE
 * =============================================================================
 */

/**
 * Standard render options for different chart types
 */
export const renderOptions = {
  // Standard chart
  standard: {
    width: 800,
    height: 600,
    format: 'png' as const,
    scale: 2
  },
  // Square for pie charts
  square: {
    width: 600,
    height: 600,
    format: 'png' as const,
    scale: 2
  },
  // Wide for time series
  wide: {
    width: 1000,
    height: 500,
    format: 'png' as const,
    scale: 2
  },
  // Tall for comparing multiple box plots
  tall: {
    width: 600,
    height: 700,
    format: 'png' as const,
    scale: 2
  }
};

/**
 * =============================================================================
 * COLOR PALETTES
 * =============================================================================
 */
export const CHART_COLORS = {
  // Primary colors matching Desmos
  red: '#c74440',
  blue: '#2d70b3',
  green: '#388c46',
  purple: '#6042a6',
  orange: '#fa7e19',

  // Categorical palette (for multiple series)
  categorical: ['#c74440', '#2d70b3', '#388c46', '#fa7e19', '#6042a6', '#17becf'],

  // Sequential palette (for heatmaps)
  sequential: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c']
};

/**
 * =============================================================================
 * HELPER FUNCTIONS
 * =============================================================================
 */

/**
 * Create a simple bar chart configuration
 */
export function createBarChart(
  categories: string[],
  values: number[],
  options: { title?: string; xLabel?: string; yLabel?: string; color?: string } = {}
): PlotlyRenderRequest {
  return {
    chart: {
      data: [{
        x: categories,
        y: values,
        type: 'bar',
        marker: { color: options.color || CHART_COLORS.blue }
      }],
      layout: {
        title: options.title || '',
        xaxis: { title: options.xLabel || '' },
        yaxis: { title: options.yLabel || '' }
      }
    }
  };
}

/**
 * Create a simple pie chart configuration
 */
export function createPieChart(
  labels: string[],
  values: number[],
  options: { title?: string; colors?: string[] } = {}
): PlotlyRenderRequest {
  return {
    chart: {
      data: [{
        labels,
        values,
        type: 'pie',
        marker: { colors: options.colors || CHART_COLORS.categorical }
      }],
      layout: {
        title: options.title || ''
      }
    }
  };
}

/**
 * Create a scatter diagram configuration
 */
export function createScatterPlot(
  xValues: number[],
  yValues: number[],
  options: { title?: string; xLabel?: string; yLabel?: string; color?: string } = {}
): PlotlyRenderRequest {
  return {
    chart: {
      data: [{
        x: xValues,
        y: yValues,
        type: 'scatter',
        mode: 'markers',
        marker: { color: options.color || CHART_COLORS.blue, size: 10 }
      }],
      layout: {
        title: options.title || '',
        xaxis: { title: options.xLabel || '' },
        yaxis: { title: options.yLabel || '' }
      }
    }
  };
}

/**
 * Create a histogram configuration
 */
export function createHistogram(
  values: number[],
  options: { title?: string; xLabel?: string; binSize?: number; color?: string } = {}
): PlotlyRenderRequest {
  return {
    chart: {
      data: [{
        x: values,
        type: 'histogram',
        marker: { color: options.color || CHART_COLORS.blue },
        xbins: options.binSize ? { size: options.binSize } : undefined
      }],
      layout: {
        title: options.title || '',
        xaxis: { title: options.xLabel || '' },
        yaxis: { title: 'Frequency' }
      }
    }
  };
}

/**
 * Create a box plot configuration
 */
export function createBoxPlot(
  dataSets: { name: string; values: number[]; color?: string }[],
  options: { title?: string; yLabel?: string } = {}
): PlotlyRenderRequest {
  return {
    chart: {
      data: dataSets.map((ds, i) => ({
        y: ds.values,
        type: 'box' as const,
        name: ds.name,
        marker: { color: ds.color || CHART_COLORS.categorical[i] }
      })),
      layout: {
        title: options.title || '',
        yaxis: { title: options.yLabel || '' }
      }
    }
  };
}
