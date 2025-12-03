/**
 * Desmos HTML generator for screenshot rendering
 * Generates self-contained HTML that loads Desmos calculator and renders expressions
 *
 * IMPORTANT: Uses setExpression() for each expression instead of setState() because
 * setState expects an opaque state object from getState(), not manually constructed state.
 */

import type { DesmosRenderRequest, DesmosCalculatorSettings, DesmosExpressionItem } from '../types/desmos.types';

// Desmos API version - use environment variable or default
const DESMOS_API_VERSION = process.env.DESMOS_API_VERSION || '1.11';

/**
 * Generate HTML for Desmos rendering
 */
export function generateDesmosHTML(
  request: DesmosRenderRequest,
  width: number,
  height: number
): string {
  const { state, settings } = request;

  // Merge default settings for static rendering
  const calculatorSettings: DesmosCalculatorSettings = {
    keypad: false,
    expressions: false,
    settingsMenu: false,
    zoomButtons: false,
    expressionsTopbar: false,
    pointsOfInterest: false,
    trace: false,
    border: false,
    lockViewport: true,
    ...settings
  };

  // Extract expressions and graph settings separately
  const expressions = state.expressions?.list || [];
  const graphSettings = state.graph || {};
  const viewport = graphSettings.viewport;

  // Escape JSON for embedding in HTML
  const expressionsJson = JSON.stringify(expressions).replace(/</g, '\\u003c');
  const settingsJson = JSON.stringify(calculatorSettings).replace(/</g, '\\u003c');
  const graphSettingsJson = JSON.stringify(graphSettings).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Desmos Render</title>
  <script src="https://www.desmos.com/api/v${DESMOS_API_VERSION}/calculator.js?apiKey=${process.env.DESMOS_API_KEY || 'dcb31709b452b1cf9dc26972add0fda6'}"></script>
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
    #calculator {
      width: ${width}px;
      height: ${height}px;
    }
  </style>
</head>
<body>
  <div id="calculator"></div>
  <script>
    // Render state tracking
    window.renderComplete = false;
    window.renderError = null;
    window.consoleErrors = [];

    // Capture console errors
    const originalError = console.error;
    console.error = function(...args) {
      window.consoleErrors.push(args.map(a => String(a)).join(' '));
      originalError.apply(console, args);
    };

    // Global error handler
    window.onerror = function(msg, url, line, col, error) {
      window.renderError = { message: msg, url: url, line: line, col: col };
      return false;
    };

    try {
      // Parse expressions and settings
      const expressions = ${expressionsJson};
      const settings = ${settingsJson};
      const graphSettings = ${graphSettingsJson};

      // Create calculator element
      const elt = document.getElementById('calculator');

      // Initialize calculator with settings
      const calculator = Desmos.GraphingCalculator(elt, settings);

      // Apply graph settings
      if (graphSettings.degreeMode !== undefined) {
        calculator.updateSettings({ degreeMode: graphSettings.degreeMode });
      }

      // Set viewport using setMathBounds (the correct API method)
      const viewport = graphSettings.viewport;
      if (viewport && (viewport.xmin !== undefined || viewport.xmax !== undefined ||
          viewport.ymin !== undefined || viewport.ymax !== undefined)) {
        calculator.setMathBounds({
          left: viewport.xmin !== undefined ? viewport.xmin : -10,
          right: viewport.xmax !== undefined ? viewport.xmax : 10,
          bottom: viewport.ymin !== undefined ? viewport.ymin : -10,
          top: viewport.ymax !== undefined ? viewport.ymax : 10
        });
      }

      // Add each expression using setExpression (the correct API method for manual construction)
      expressions.forEach(function(expr, index) {
        // Ensure expression has an id
        const exprWithId = Object.assign({}, expr);
        if (!exprWithId.id) {
          exprWithId.id = 'expr_' + index;
        }
        calculator.setExpression(exprWithId);
      });

      // Wait for graph to stabilize
      // Desmos doesn't have a direct "render complete" callback,
      // so we use a combination of observeEvent and timeout
      let renderStartTime = Date.now();
      let lastChangeTime = Date.now();
      let checkCount = 0;
      const maxChecks = 50; // 5 seconds max wait
      const stabilityThreshold = 200; // ms without changes

      // Observe graph changes
      calculator.observeEvent('change', function() {
        lastChangeTime = Date.now();
      });

      // Check for render completion
      function checkRenderComplete() {
        checkCount++;
        const timeSinceLastChange = Date.now() - lastChangeTime;
        const totalTime = Date.now() - renderStartTime;

        // Consider render complete if:
        // 1. No changes for stabilityThreshold ms, OR
        // 2. Total time exceeds 3 seconds (fallback)
        if (timeSinceLastChange >= stabilityThreshold || totalTime >= 3000 || checkCount >= maxChecks) {
          window.renderComplete = true;
        } else {
          setTimeout(checkRenderComplete, 100);
        }
      }

      // Start checking after initial render
      setTimeout(checkRenderComplete, 100);

    } catch (error) {
      window.renderError = {
        message: error.message || String(error),
        stack: error.stack
      };
      window.renderComplete = true; // Mark complete even on error so we don't hang
    }
  </script>
</body>
</html>`;
}

/**
 * Generate simple HTML for basic expression rendering
 * This is a lighter version for simple use cases
 */
export function generateSimpleDesmosHTML(
  expressions: Array<{ latex: string; color?: string }>,
  viewport: { xmin?: number; xmax?: number; ymin?: number; ymax?: number } | undefined,
  width: number,
  height: number
): string {
  // Build expression list
  const expressionList = expressions.map((expr, index) => ({
    id: `expr_${index}`,
    latex: expr.latex,
    color: expr.color
  }));

  // Build state
  const state: any = {
    expressions: {
      list: expressionList
    }
  };

  // Add viewport if specified
  if (viewport) {
    state.graph = { viewport };
  }

  const request: DesmosRenderRequest = {
    state,
    settings: {
      keypad: false,
      expressions: false,
      settingsMenu: false,
      zoomButtons: false,
      border: false,
      lockViewport: !!viewport
    }
  };

  return generateDesmosHTML(request, width, height);
}
