/**
 * Unit tests for Desmos HTML generator
 */

import { describe, it, expect } from 'vitest';
import { generateDesmosHTML, generateSimpleDesmosHTML } from '../../src/generators/desmos.generator';
import type { DesmosRenderRequest } from '../../src/types/desmos.types';

describe('Desmos HTML Generator', () => {
  const basicRequest: DesmosRenderRequest = {
    state: {
      expressions: {
        list: [
          { id: '1', latex: 'y=x^2' }
        ]
      }
    }
  };

  describe('generateDesmosHTML', () => {
    it('should generate valid HTML document', () => {
      const html = generateDesmosHTML(basicRequest, 800, 600);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
    });

    it('should include Desmos API script', () => {
      const html = generateDesmosHTML(basicRequest, 800, 600);

      expect(html).toContain('www.desmos.com/api/v');
      expect(html).toContain('calculator.js');
    });

    it('should set correct viewport dimensions', () => {
      const html = generateDesmosHTML(basicRequest, 1200, 900);

      expect(html).toContain('width: 1200px');
      expect(html).toContain('height: 900px');
    });

    it('should embed expressions as JSON', () => {
      const request: DesmosRenderRequest = {
        state: {
          expressions: {
            list: [
              { id: 'test', latex: 'y=\\sin(x)' }
            ]
          }
        }
      };

      const html = generateDesmosHTML(request, 800, 600);

      expect(html).toContain('const expressions =');
      expect(html).toContain('y=\\\\sin(x)'); // JSON escaped
    });

    it('should include render completion signaling', () => {
      const html = generateDesmosHTML(basicRequest, 800, 600);

      expect(html).toContain('window.renderComplete = false');
      expect(html).toContain('window.renderComplete = true');
    });

    it('should include error capture mechanism', () => {
      const html = generateDesmosHTML(basicRequest, 800, 600);

      expect(html).toContain('window.renderError = null');
      expect(html).toContain('window.consoleErrors = []');
      expect(html).toContain('window.onerror');
    });

    it('should use Desmos.GraphingCalculator', () => {
      const html = generateDesmosHTML(basicRequest, 800, 600);

      expect(html).toContain('Desmos.GraphingCalculator');
    });

    it('should call calculator.setExpression for each expression', () => {
      const html = generateDesmosHTML(basicRequest, 800, 600);

      expect(html).toContain('calculator.setExpression(exprWithId)');
    });

    it('should disable UI elements for static rendering', () => {
      const html = generateDesmosHTML(basicRequest, 800, 600);

      // Default settings should disable interactive elements
      expect(html).toContain('"keypad":false');
      expect(html).toContain('"expressions":false');
      expect(html).toContain('"settingsMenu":false');
    });

    it('should escape < characters for XSS prevention', () => {
      const request: DesmosRenderRequest = {
        state: {
          expressions: {
            list: [
              { id: '1', latex: 'y=x', label: '<script>alert("xss")</script>' }
            ]
          }
        }
      };

      const html = generateDesmosHTML(request, 800, 600);

      expect(html).not.toContain('<script>alert');
      expect(html).toContain('\\u003c');
    });

    it('should include calculator container div', () => {
      const html = generateDesmosHTML(basicRequest, 800, 600);

      expect(html).toContain('<div id="calculator"></div>');
    });

    it('should use observeEvent for change detection', () => {
      const html = generateDesmosHTML(basicRequest, 800, 600);

      expect(html).toContain("calculator.observeEvent('change'");
    });

    it('should merge custom settings with defaults', () => {
      const request: DesmosRenderRequest = {
        state: {
          expressions: { list: [{ latex: 'y=x' }] }
        },
        settings: {
          border: true,
          fontSize: 16
        }
      };

      const html = generateDesmosHTML(request, 800, 600);

      // Should include custom setting
      expect(html).toContain('"border":true');
      expect(html).toContain('"fontSize":16');
      // Should still have default settings
      expect(html).toContain('"keypad":false');
    });

    it('should reset CSS box model', () => {
      const html = generateDesmosHTML(basicRequest, 800, 600);

      expect(html).toContain('box-sizing: border-box');
      expect(html).toContain('margin: 0');
      expect(html).toContain('padding: 0');
    });

    it('should set white background', () => {
      const html = generateDesmosHTML(basicRequest, 800, 600);

      expect(html).toContain('background-color: white');
    });

    it('should prevent overflow', () => {
      const html = generateDesmosHTML(basicRequest, 800, 600);

      expect(html).toContain('overflow: hidden');
    });
  });

  describe('generateSimpleDesmosHTML', () => {
    it('should generate HTML from simple expressions', () => {
      const expressions = [
        { latex: 'y=x^2', color: '#ff0000' }
      ];

      const html = generateSimpleDesmosHTML(expressions, undefined, 800, 600);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('y=x^2');
    });

    it('should include viewport when provided', () => {
      const expressions = [{ latex: 'y=x' }];
      const viewport = { xmin: -10, xmax: 10, ymin: -5, ymax: 5 };

      const html = generateSimpleDesmosHTML(expressions, viewport, 800, 600);

      expect(html).toContain('-10');
      expect(html).toContain('"lockViewport":true');
    });

    it('should handle multiple expressions', () => {
      const expressions = [
        { latex: 'y=x', color: '#ff0000' },
        { latex: 'y=2x', color: '#00ff00' },
        { latex: 'y=3x', color: '#0000ff' }
      ];

      const html = generateSimpleDesmosHTML(expressions, undefined, 800, 600);

      expect(html).toContain('y=x');
      expect(html).toContain('y=2x');
      expect(html).toContain('y=3x');
    });
  });
});
