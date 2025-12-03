/**
 * Plotly HTML Generator
 *
 * Generates self-contained HTML that loads Plotly.js and renders a chart.
 * The HTML includes:
 * - Plotly.js from CDN
 * - Chart data and layout embedded as JSON
 * - Render completion signaling via window.renderComplete
 * - Error capture via window.renderError and window.consoleErrors
 */

import type { PlotlyRenderRequest } from '../types/plotly.types';

/**
 * Generate self-contained HTML for Plotly chart rendering
 *
 * @param request - The Plotly render request with chart data
 * @param width - Viewport width in pixels
 * @param height - Viewport height in pixels
 * @returns HTML string ready to load in browser
 */
export function generatePlotlyHTML(
  request: PlotlyRenderRequest,
  width: number,
  height: number
): string {
  const { chart } = request;

  // Merge layout with dimensions and default margins
  const layout = {
    ...chart.layout,
    width,
    height,
    margin: chart.layout?.margin || { l: 60, r: 40, t: 60, b: 60 }
  };

  // Force static rendering for screenshot
  const config = {
    staticPlot: true,
    displayModeBar: false,
    responsive: false,
    ...chart.config
  };

  // Escape JSON for safe embedding in HTML
  // Replace < to prevent script injection
  const dataJSON = JSON.stringify(chart.data).replace(/</g, '\\u003c');
  const layoutJSON = JSON.stringify(layout).replace(/</g, '\\u003c');
  const configJSON = JSON.stringify(config).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plotly Chart Render</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background-color: white;
    }
    #chart {
      width: 100%;
      height: 100%;
    }
  </style>
  <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
</head>
<body>
  <div id="chart"></div>
  <script>
    // Render completion signaling
    window.renderComplete = false;
    window.renderError = null;
    window.consoleErrors = [];

    // Capture console errors for debugging
    const originalConsoleError = console.error;
    console.error = function(...args) {
      window.consoleErrors.push(args.map(a => String(a)).join(' '));
      originalConsoleError.apply(console, args);
    };

    // Capture unhandled errors
    window.onerror = function(message, source, lineno, colno, error) {
      window.consoleErrors.push('Unhandled error: ' + message);
      if (!window.renderError) {
        window.renderError = String(message);
      }
    };

    try {
      // Parse embedded data
      const data = ${dataJSON};
      const layout = ${layoutJSON};
      const config = ${configJSON};

      // Render the chart
      Plotly.newPlot('chart', data, layout, config)
        .then(function() {
          // Chart rendered successfully
          window.renderComplete = true;
        })
        .catch(function(error) {
          // Plotly rendering error
          window.renderError = error.message || 'Plotly render failed';
          window.renderComplete = true;
        });

    } catch (error) {
      // Script execution error
      window.renderError = error.message || 'Script execution failed';
      window.renderComplete = true;
    }
  </script>
</body>
</html>`;
}
