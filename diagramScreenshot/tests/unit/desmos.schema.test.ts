/**
 * Unit tests for Desmos schema validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateDesmosRequest,
  validateSimpleDesmosRequest,
  safeValidateDesmosRequest,
  safeValidateSimpleDesmosRequest,
  convertSimpleToFullState
} from '../../src/schemas/desmos.schema';

describe('Desmos Schema Validation', () => {
  describe('validateDesmosRequest (full state)', () => {
    it('should validate a simple expression', () => {
      const request = {
        state: {
          expressions: {
            list: [
              { id: '1', latex: 'y=x^2' }
            ]
          }
        }
      };

      const result = validateDesmosRequest(request);
      expect(result.state.expressions.list).toHaveLength(1);
      expect(result.state.expressions.list[0].latex).toBe('y=x^2');
    });

    it('should validate multiple expressions', () => {
      const request = {
        state: {
          expressions: {
            list: [
              { id: '1', latex: 'y=x^2', color: '#c74440' },
              { id: '2', latex: 'y=\\sin(x)', color: '#2d70b3' }
            ]
          }
        }
      };

      const result = validateDesmosRequest(request);
      expect(result.state.expressions.list).toHaveLength(2);
    });

    it('should validate with viewport settings', () => {
      const request = {
        state: {
          graph: {
            viewport: {
              xmin: -10,
              xmax: 10,
              ymin: -5,
              ymax: 5
            }
          },
          expressions: {
            list: [{ latex: 'y=x' }]
          }
        }
      };

      const result = validateDesmosRequest(request);
      expect(result.state.graph?.viewport?.xmin).toBe(-10);
    });

    it('should validate with expression styles', () => {
      const request = {
        state: {
          expressions: {
            list: [
              {
                latex: 'y=x',
                lineStyle: 'DASHED',
                lineWidth: 3,
                color: '#ff0000'
              }
            ]
          }
        }
      };

      const result = validateDesmosRequest(request);
      expect(result.state.expressions.list[0].lineStyle).toBe('DASHED');
      expect(result.state.expressions.list[0].lineWidth).toBe(3);
    });

    it('should validate table expressions', () => {
      const request = {
        state: {
          expressions: {
            list: [
              {
                type: 'table',
                columns: [
                  { latex: 'x_1', values: ['1', '2', '3'] },
                  { latex: 'y_1', values: ['2', '4', '6'] }
                ]
              }
            ]
          }
        }
      };

      const result = validateDesmosRequest(request);
      expect((result.state.expressions.list[0] as any).type).toBe('table');
    });

    it('should validate folder expressions', () => {
      const request = {
        state: {
          expressions: {
            list: [
              {
                type: 'folder',
                title: 'My Functions',
                collapsed: false
              }
            ]
          }
        }
      };

      const result = validateDesmosRequest(request);
      expect((result.state.expressions.list[0] as any).type).toBe('folder');
    });

    it('should throw on empty expressions list', () => {
      const request = {
        state: {
          expressions: {
            list: []
          }
        }
      };

      expect(() => validateDesmosRequest(request)).toThrow();
    });

    it('should throw on missing state', () => {
      expect(() => validateDesmosRequest({})).toThrow();
    });

    it('should validate render options', () => {
      const request = {
        state: {
          expressions: { list: [{ latex: 'y=x' }] }
        },
        options: {
          width: 1200,
          height: 800,
          format: 'png',
          scale: 2
        }
      };

      const result = validateDesmosRequest(request);
      expect(result.options?.width).toBe(1200);
      expect(result.options?.format).toBe('png');
    });

    it('should reject invalid width', () => {
      const request = {
        state: {
          expressions: { list: [{ latex: 'y=x' }] }
        },
        options: {
          width: 50  // Below 100 minimum
        }
      };

      expect(() => validateDesmosRequest(request)).toThrow();
    });
  });

  describe('validateSimpleDesmosRequest', () => {
    it('should validate simple expressions array', () => {
      const request = {
        expressions: [
          { latex: 'y=x^2' },
          { latex: 'y=2x+1' }
        ]
      };

      const result = validateSimpleDesmosRequest(request);
      expect(result.expressions).toHaveLength(2);
    });

    it('should validate with optional viewport', () => {
      const request = {
        expressions: [{ latex: 'y=x' }],
        viewport: {
          xmin: -10,
          xmax: 10
        }
      };

      const result = validateSimpleDesmosRequest(request);
      expect(result.viewport?.xmin).toBe(-10);
    });

    it('should validate with settings', () => {
      const request = {
        expressions: [{ latex: 'y=x' }],
        settings: {
          showGrid: true,
          degreeMode: true
        }
      };

      const result = validateSimpleDesmosRequest(request);
      expect(result.settings?.showGrid).toBe(true);
      expect(result.settings?.degreeMode).toBe(true);
    });

    it('should throw on empty expressions', () => {
      const request = {
        expressions: []
      };

      expect(() => validateSimpleDesmosRequest(request)).toThrow();
    });

    it('should throw on empty latex string', () => {
      const request = {
        expressions: [{ latex: '' }]
      };

      expect(() => validateSimpleDesmosRequest(request)).toThrow();
    });
  });

  describe('safeValidateDesmosRequest', () => {
    it('should return success true for valid request', () => {
      const request = {
        state: {
          expressions: { list: [{ latex: 'y=x' }] }
        }
      };

      const result = safeValidateDesmosRequest(request);
      expect(result.success).toBe(true);
    });

    it('should return success false for invalid request', () => {
      const result = safeValidateDesmosRequest({});
      expect(result.success).toBe(false);
    });
  });

  describe('safeValidateSimpleDesmosRequest', () => {
    it('should return success true for valid simple request', () => {
      const request = {
        expressions: [{ latex: 'y=x' }]
      };

      const result = safeValidateSimpleDesmosRequest(request);
      expect(result.success).toBe(true);
    });

    it('should return success false for invalid simple request', () => {
      const result = safeValidateSimpleDesmosRequest({ expressions: [] });
      expect(result.success).toBe(false);
    });
  });

  describe('convertSimpleToFullState', () => {
    it('should convert simple request to full state', () => {
      const simple = {
        expressions: [
          { latex: 'y=x^2', color: '#ff0000' },
          { latex: 'y=x+1' }
        ],
        viewport: { xmin: -10, xmax: 10 },
        settings: { showGrid: true }
      };

      const result = convertSimpleToFullState(simple);

      expect(result.state.expressions.list).toHaveLength(2);
      expect(result.state.expressions.list[0].latex).toBe('y=x^2');
      expect(result.state.expressions.list[0].color).toBe('#ff0000');
      expect(result.state.graph?.viewport?.xmin).toBe(-10);
      expect(result.state.graph?.showGrid).toBe(true);
    });

    it('should generate unique IDs for expressions', () => {
      const simple = {
        expressions: [
          { latex: 'y=1' },
          { latex: 'y=2' },
          { latex: 'y=3' }
        ]
      };

      const result = convertSimpleToFullState(simple);

      const ids = result.state.expressions.list.map(e => e.id);
      expect(new Set(ids).size).toBe(3); // All unique
    });
  });
});
