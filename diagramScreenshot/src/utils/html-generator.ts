import type { JSXGraphDiagram, RenderOptions } from '../types/diagram';

export function generateHTML(diagram: JSXGraphDiagram, options: RenderOptions): string {
  const width = options.width || 800;
  const height = options.height || 600;
  const backgroundColor = options.backgroundColor || 'white';

  // Escape diagram JSON for safe embedding
  const diagramJSON = JSON.stringify(diagram).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JSXGraph Diagram Render</title>

  <!-- JSXGraph CSS from CDN -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/jsxgraph@1.11.1/distrib/jsxgraph.css" />

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background-color: ${backgroundColor};
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    #jxgbox {
      width: ${width}px;
      height: ${height}px;
    }
  </style>
</head>
<body>
  <div id="jxgbox"></div>

  <!-- JSXGraph library from CDN -->
  <script src="https://cdn.jsdelivr.net/npm/jsxgraph@1.11.1/distrib/jsxgraphcore.js"></script>

  <script>
    // Injected diagram JSON
    const diagramData = ${diagramJSON};

    // Rendering completion flag
    window.renderComplete = false;
    window.renderError = null;
    window.consoleErrors = [];

    // Console error capture
    const originalConsoleError = console.error;
    console.error = function(...args) {
      window.consoleErrors.push(args.join(' '));
      originalConsoleError.apply(console, args);
    };

    try {
      // Initialize board
      const board = JXG.JSXGraph.initBoard('jxgbox', {
        boundingbox: diagramData.board.boundingbox,
        axis: diagramData.board.axis ?? true,
        showCopyright: diagramData.board.showCopyright ?? false,
        showNavigation: false,  // Always false for screenshots
        keepAspectRatio: diagramData.board.keepAspectRatio ?? true,
        grid: diagramData.board.grid ?? false,
        pan: { enabled: false },   // Disable interactions for screenshots
        zoom: { enabled: false }
      });

      const elementRefs = {};

      // Helper function for function string closures (from diagram-prototypes)
      function createFunctionWithClosure(funcString, board) {
        const funcBody = funcString.substring(6).trim(); // Remove "() => "

        if (funcBody.startsWith("{")) {
          // Block statement
          return (function(boardRef) {
            const board = boardRef;
            return eval(\`(function() \${funcBody})\`);
          })(board);
        } else {
          // Expression
          return (function(boardRef) {
            const board = boardRef;
            return eval(\`(function() { return \${funcBody}; })\`);
          })(board);
        }
      }

      // Create elements
      for (const element of diagramData.elements) {
        try {
          // Process arguments
          const processedArgs = element.args.map(arg => {
            // Function strings (except functiongraph)
            if (typeof arg === "string" && arg.startsWith("() =>") && element.type !== "functiongraph") {
              return createFunctionWithClosure(arg, board);
            }

            // Element ID references
            if (typeof arg === "string" && elementRefs[arg]) {
              return elementRefs[arg];
            }

            // Arrays of named references (for polygon, angle, etc.)
            if (Array.isArray(arg)) {
              return arg.map(item => {
                if (typeof item === "string") {
                  const point = board.select(item);
                  if (point) return point;
                }
                return item;
              });
            }

            return arg;
          });

          // Flatten single nested arrays (polygon, angle) - critical pattern from diagram-prototypes
          const finalArgs = processedArgs.length === 1 && Array.isArray(processedArgs[0])
            ? processedArgs[0]
            : processedArgs;

          // Create JSXGraph element
          const jsxElement = board.create(element.type, finalArgs, element.attributes || {});

          // Store reference
          if (element.id) {
            elementRefs[element.id] = jsxElement;
          }
        } catch (elemErr) {
          console.error(\`Error creating element \${element.type}:\`, elemErr);
          throw elemErr;  // Propagate to outer catch for error reporting
        }
      }

      // Force board update
      board.update();

      // Signal completion
      window.renderComplete = true;

    } catch (err) {
      console.error("Rendering error:", err);
      window.renderError = {
        message: err.message,
        stack: err.stack
      };
      window.renderComplete = true;  // Still signal completion to avoid timeout
    }
  </script>
</body>
</html>`;
}
