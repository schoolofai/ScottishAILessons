/**
 * GeoGebra HTML generator for screenshot rendering
 * Generates self-contained HTML that loads GeoGebra applet and renders constructions
 *
 * Uses GeoGebra Apps API: https://wiki.geogebra.org/en/Reference:GeoGebra_Apps_API
 */

import type {
  GeoGebraRenderRequest,
  GeoGebraSettings,
  GeoGebraCommand
} from '../types/geogebra.types';

/**
 * Generate HTML for GeoGebra rendering
 */
export function generateGeoGebraHTML(
  request: GeoGebraRenderRequest,
  width: number,
  height: number
): string {
  const { construction } = request;
  const settings = construction.settings || {};
  const commands = construction.commands || [];
  const styles = construction.styles || [];

  // Convert commands to string array
  const commandStrings = commands.map(cmd =>
    typeof cmd === 'string' ? cmd : cmd.command
  );

  // Serialize for embedding
  const commandsJson = JSON.stringify(commandStrings).replace(/</g, '\\u003c');
  const stylesJson = JSON.stringify(styles).replace(/</g, '\\u003c');
  const settingsJson = JSON.stringify(settings).replace(/</g, '\\u003c');

  // Determine app type
  const appType = settings.appType || 'geometry';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GeoGebra Render</title>
  <script src="https://www.geogebra.org/apps/deployggb.js"></script>
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
    #ggb-container {
      width: ${width}px;
      height: ${height}px;
    }
  </style>
</head>
<body>
  <div id="ggb-container"></div>
  <script>
    // Render state tracking
    window.renderComplete = false;
    window.renderError = null;
    window.consoleErrors = [];
    window.ggbApplet = null;

    // Capture console errors
    const originalError = console.error;
    console.error = function(...args) {
      window.consoleErrors.push(args.map(a => String(a)).join(' '));
      originalError.apply(console, args);
    };

    // Global error handler
    window.onerror = function(msg, url, line, col, error) {
      window.consoleErrors.push('Global error: ' + msg);
      window.renderError = { message: String(msg), url: url, line: line, col: col };
      return false;
    };

    // Parse data
    var commands = ${commandsJson};
    var styles = ${stylesJson};
    var settings = ${settingsJson};

    // Parse hex color to RGB
    function parseColor(colorStr) {
      if (!colorStr) return null;

      // Handle hex colors
      if (colorStr.startsWith('#')) {
        var hex = colorStr.slice(1);
        if (hex.length === 3) {
          return {
            r: parseInt(hex[0] + hex[0], 16),
            g: parseInt(hex[1] + hex[1], 16),
            b: parseInt(hex[2] + hex[2], 16)
          };
        } else if (hex.length === 6) {
          return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16)
          };
        }
      }

      // Named colors (basic support)
      var namedColors = {
        'red': { r: 204, g: 0, b: 0 },
        'blue': { r: 0, g: 0, b: 204 },
        'green': { r: 0, g: 204, b: 0 },
        'black': { r: 0, g: 0, b: 0 },
        'gray': { r: 128, g: 128, b: 128 },
        'white': { r: 255, g: 255, b: 255 }
      };

      return namedColors[colorStr.toLowerCase()] || null;
    }

    // Apply styles to objects
    function applyStyles(api, styles) {
      for (var i = 0; i < styles.length; i++) {
        var style = styles[i];
        var name = style.name;

        if (!api.exists(name)) {
          console.error('Object does not exist for styling:', name);
          continue;
        }

        // Color
        if (style.color) {
          var color = parseColor(style.color);
          if (color) {
            api.setColor(name, color.r, color.g, color.b);
          }
        }

        // Line thickness
        if (style.lineThickness !== undefined) {
          api.setLineThickness(name, style.lineThickness);
        }

        // Point size
        if (style.pointSize !== undefined) {
          api.setPointSize(name, style.pointSize);
        }

        // Fill opacity
        if (style.fillOpacity !== undefined) {
          api.setFilling(name, style.fillOpacity);
        }

        // Line style
        if (style.lineStyle !== undefined) {
          api.setLineStyle(name, style.lineStyle);
        }

        // Point style
        if (style.pointStyle !== undefined) {
          api.setPointStyle(name, style.pointStyle);
        }

        // Visibility
        if (style.visible !== undefined) {
          api.setVisible(name, style.visible);
        }

        // Label visibility
        if (style.showLabel !== undefined) {
          api.setLabelVisible(name, style.showLabel);
        }

        // Label style
        if (style.labelStyle !== undefined) {
          api.setLabelStyle(name, style.labelStyle);
        }

        // Caption
        if (style.caption !== undefined) {
          api.setCaption(name, style.caption);
          api.setLabelStyle(name, 3); // Use caption
        }

        // Fixed
        if (style.fixed !== undefined) {
          api.setFixed(name, style.fixed);
        }
      }
    }

    // Callback when applet is loaded
    // Note: This may be called by GeoGebra's internal mechanism or by our polling
    var ggbInitDone = false;

    function ggbOnInit(api) {
      // Prevent double initialization
      if (ggbInitDone) {
        console.log('ggbOnInit already called, skipping');
        return;
      }

      // Validate that api is an object with expected methods
      if (!api || typeof api !== 'object' || typeof api.evalCommand !== 'function') {
        console.log('ggbOnInit called with invalid api:', typeof api);
        return;
      }

      ggbInitDone = true;
      console.log('GeoGebra applet loaded, api:', typeof api);
      window.ggbApplet = api;

      try {
        // Execute commands first
        console.log('Executing ' + commands.length + ' commands');
        for (var i = 0; i < commands.length; i++) {
          var cmd = commands[i];
          try {
            var result = api.evalCommand(cmd);
            console.log('Command ' + i + ': ' + cmd + ' -> ' + result);
          } catch (cmdError) {
            console.error('GeoGebra command error:', cmd, cmdError);
          }
        }

        // Apply coordinate system settings (only if method exists)
        if (settings.coordSystem && typeof api.setCoordSystem === 'function') {
          var cs = settings.coordSystem;
          if (cs.xmin !== undefined && cs.xmax !== undefined &&
              cs.ymin !== undefined && cs.ymax !== undefined) {
            api.setCoordSystem(cs.xmin, cs.xmax, cs.ymin, cs.ymax);
          }
        }

        // Apply axis/grid visibility (only if methods exist)
        if (settings.showAxes !== undefined && typeof api.setAxesVisible === 'function') {
          api.setAxesVisible(settings.showAxes, settings.showAxes);
        }

        if (settings.showGrid !== undefined && typeof api.setGridVisible === 'function') {
          api.setGridVisible(settings.showGrid);
        }

        // Set right angle style
        if (settings.rightAngleStyle !== undefined && typeof api.setRightAngleStyle === 'function') {
          api.setRightAngleStyle(settings.rightAngleStyle);
        }

        // Apply styles
        console.log('Applying ' + styles.length + ' styles');
        applyStyles(api, styles);

        // Hide the preview overlay which blocks the actual content
        var preview = document.querySelector('.ggb_preview');
        if (preview) {
          console.log('Hiding preview overlay');
          preview.style.display = 'none';
        }

        // Hide the sidebar/tools panel via SetPerspective command
        // "G" means only Graphics View, "-Tools" closes the sidebar
        if (typeof api.setPerspective === 'function') {
          console.log('Setting perspective to G (Graphics only)');
          api.setPerspective('G');
        }

        // Force a repaint
        if (typeof api.setRepaintingActive === 'function') {
          api.setRepaintingActive(true);
        }

        // Wait for rendering to stabilize - GeoGebra needs more time
        setTimeout(function() {
          console.log('Render complete');
          window.renderComplete = true;
        }, 2000);

      } catch (error) {
        console.error('Error in ggbOnInit:', error);
        window.renderError = {
          message: error.message || String(error),
          stack: error.stack
        };
        window.renderComplete = true;
      }
    }

    // GeoGebra parameters - using ggbApplet1 as the default applet name
    // perspective: "G" shows only Graphics View (no algebra panel/sidebar)
    var params = {
      "appName": "${appType}",
      "width": ${width},
      "height": ${height},
      "perspective": "G",
      "showToolBar": false,
      "showAlgebraInput": false,
      "showMenuBar": false,
      "showResetIcon": false,
      "enableLabelDrags": false,
      "enableShiftDragZoom": false,
      "enableRightClick": false,
      "showZoomButtons": false,
      "showFullscreenButton": false,
      "preventFocus": true,
      "useBrowserForJS": true,
      "allowStyleBar": false,
      "borderColor": null,
      "id": "ggbApplet1"
    };

    // Create and inject applet
    console.log('Creating GGBApplet with params:', JSON.stringify(params));

    var applet = new GGBApplet(params, true);

    console.log('Injecting applet into ggb-container');
    applet.inject('ggb-container');

    // Poll for applet API availability since appletOnLoad doesn't work with data: URLs
    var pollCount = 0;
    var maxPolls = 100; // 10 seconds max

    function pollForApplet() {
      pollCount++;
      console.log('Polling for applet API, attempt ' + pollCount);

      // Try to get the applet API - GeoGebra creates a global ggbApplet1 object
      var api = window.ggbApplet1;

      if (api && typeof api.evalCommand === 'function') {
        console.log('GeoGebra API ready!');
        ggbOnInit(api);
      } else if (pollCount < maxPolls) {
        setTimeout(pollForApplet, 100);
      } else {
        console.error('GeoGebra applet load timeout - API never became available');
        window.renderError = { message: 'GeoGebra applet load timeout' };
        window.renderComplete = true;
      }
    }

    // Start polling after a brief initial delay
    setTimeout(pollForApplet, 500);
  </script>
</body>
</html>`;
}

/**
 * Generate simple GeoGebra HTML for basic constructions
 */
export function generateSimpleGeoGebraHTML(
  commands: string[],
  coordSystem: { xmin: number; xmax: number; ymin: number; ymax: number } | undefined,
  width: number,
  height: number
): string {
  const request: GeoGebraRenderRequest = {
    construction: {
      commands,
      settings: {
        appType: 'geometry',
        showAxes: false,
        showGrid: false,
        coordSystem
      }
    }
  };

  return generateGeoGebraHTML(request, width, height);
}
