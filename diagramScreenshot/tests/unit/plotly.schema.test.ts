/**
 * Unit tests for Plotly schema validation
 */

import { describe, it, expect } from 'vitest';
import { validatePlotlyRequest, safeValidatePlotlyRequest } from '../../src/schemas/plotly.schema';
import validBarChart from '../fixtures/plotly/valid-bar-chart.json';
import validScatterPlot from '../fixtures/plotly/valid-scatter-plot.json';
import validPieChart from '../fixtures/plotly/valid-pie-chart.json';
import invalidNoData from '../fixtures/plotly/invalid-no-data.json';
import invalidBadType from '../fixtures/plotly/invalid-bad-type.json';

describe('Plotly Schema Validation', () => {
  describe('validatePlotlyRequest', () => {
    it('should validate a valid bar chart request', () => {
      const result = validatePlotlyRequest(validBarChart);
      expect(result.chart.data).toHaveLength(1);
      expect(result.chart.data[0].type).toBe('bar');
    });

    it('should validate a valid scatter plot request', () => {
      const result = validatePlotlyRequest(validScatterPlot);
      expect(result.chart.data).toHaveLength(1);
      expect(result.chart.data[0].type).toBe('scatter');
      expect(result.chart.data[0].mode).toBe('lines+markers');
    });

    it('should validate a valid pie chart request', () => {
      const result = validatePlotlyRequest(validPieChart);
      expect(result.chart.data).toHaveLength(1);
      expect(result.chart.data[0].type).toBe('pie');
      expect(result.chart.data[0].values).toEqual([30, 25, 20, 15, 10]);
    });

    it('should throw on empty data array', () => {
      expect(() => validatePlotlyRequest(invalidNoData)).toThrow();
    });

    it('should throw on unsupported chart type', () => {
      expect(() => validatePlotlyRequest(invalidBadType)).toThrow();
    });

    it('should throw on missing chart object', () => {
      expect(() => validatePlotlyRequest({})).toThrow();
    });

    it('should throw on null input', () => {
      expect(() => validatePlotlyRequest(null)).toThrow();
    });
  });

  describe('safeValidatePlotlyRequest', () => {
    it('should return success true for valid request', () => {
      const result = safeValidatePlotlyRequest(validBarChart);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.chart.data[0].type).toBe('bar');
      }
    });

    it('should return success false for invalid request', () => {
      const result = safeValidatePlotlyRequest(invalidNoData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('options validation', () => {
    it('should accept valid width and height', () => {
      const request = {
        chart: {
          data: [{ type: 'bar', x: ['a'], y: [1] }]
        },
        options: {
          width: 1920,
          height: 1080
        }
      };
      const result = validatePlotlyRequest(request);
      expect(result.options?.width).toBe(1920);
      expect(result.options?.height).toBe(1080);
    });

    it('should reject width below minimum', () => {
      const request = {
        chart: {
          data: [{ type: 'bar', x: ['a'], y: [1] }]
        },
        options: {
          width: 50  // Below 100 minimum
        }
      };
      expect(() => validatePlotlyRequest(request)).toThrow();
    });

    it('should reject width above maximum', () => {
      const request = {
        chart: {
          data: [{ type: 'bar', x: ['a'], y: [1] }]
        },
        options: {
          width: 5000  // Above 4000 maximum
        }
      };
      expect(() => validatePlotlyRequest(request)).toThrow();
    });

    it('should accept valid format options', () => {
      const pngRequest = {
        chart: { data: [{ type: 'bar', x: ['a'], y: [1] }] },
        options: { format: 'png' }
      };
      const jpegRequest = {
        chart: { data: [{ type: 'bar', x: ['a'], y: [1] }] },
        options: { format: 'jpeg' }
      };

      expect(validatePlotlyRequest(pngRequest).options?.format).toBe('png');
      expect(validatePlotlyRequest(jpegRequest).options?.format).toBe('jpeg');
    });

    it('should reject invalid format', () => {
      const request = {
        chart: { data: [{ type: 'bar', x: ['a'], y: [1] }] },
        options: { format: 'gif' }
      };
      expect(() => validatePlotlyRequest(request)).toThrow();
    });

    it('should accept valid scale values', () => {
      const request = {
        chart: { data: [{ type: 'bar', x: ['a'], y: [1] }] },
        options: { scale: 2 }
      };
      expect(validatePlotlyRequest(request).options?.scale).toBe(2);
    });

    it('should reject scale above maximum', () => {
      const request = {
        chart: { data: [{ type: 'bar', x: ['a'], y: [1] }] },
        options: { scale: 5 }  // Above 4 maximum
      };
      expect(() => validatePlotlyRequest(request)).toThrow();
    });
  });

  describe('trace validation', () => {
    it('should validate all supported chart types', () => {
      const types = ['scatter', 'bar', 'pie', 'histogram', 'box', 'heatmap', 'line'];

      for (const type of types) {
        const request = {
          chart: {
            data: [{ type, x: ['a'], y: [1] }]
          }
        };
        const result = safeValidatePlotlyRequest(request);
        expect(result.success).toBe(true);
      }
    });

    it('should validate marker properties', () => {
      const request = {
        chart: {
          data: [{
            type: 'scatter',
            x: [1, 2, 3],
            y: [1, 2, 3],
            marker: {
              color: '#ff0000',
              size: 10,
              opacity: 0.8
            }
          }]
        }
      };
      const result = validatePlotlyRequest(request);
      expect(result.chart.data[0].marker?.color).toBe('#ff0000');
      expect(result.chart.data[0].marker?.size).toBe(10);
    });

    it('should validate line properties', () => {
      const request = {
        chart: {
          data: [{
            type: 'scatter',
            x: [1, 2, 3],
            y: [1, 2, 3],
            mode: 'lines',
            line: {
              color: '#0000ff',
              width: 3,
              dash: 'dot'
            }
          }]
        }
      };
      const result = validatePlotlyRequest(request);
      expect(result.chart.data[0].line?.dash).toBe('dot');
    });
  });

  describe('layout validation', () => {
    it('should validate layout title', () => {
      const stringTitle = {
        chart: {
          data: [{ type: 'bar', x: ['a'], y: [1] }],
          layout: { title: 'My Chart' }
        }
      };
      const objectTitle = {
        chart: {
          data: [{ type: 'bar', x: ['a'], y: [1] }],
          layout: { title: { text: 'My Chart' } }
        }
      };

      expect(validatePlotlyRequest(stringTitle).chart.layout?.title).toBe('My Chart');
      expect((validatePlotlyRequest(objectTitle).chart.layout?.title as any).text).toBe('My Chart');
    });

    it('should validate axis properties', () => {
      const request = {
        chart: {
          data: [{ type: 'bar', x: ['a'], y: [1] }],
          layout: {
            xaxis: {
              title: 'X Axis',
              showgrid: true,
              type: 'category'
            },
            yaxis: {
              title: 'Y Axis',
              range: [0, 100]
            }
          }
        }
      };
      const result = validatePlotlyRequest(request);
      expect(result.chart.layout?.xaxis?.type).toBe('category');
      expect(result.chart.layout?.yaxis?.range).toEqual([0, 100]);
    });

    it('should validate legend properties', () => {
      const request = {
        chart: {
          data: [{ type: 'bar', x: ['a'], y: [1] }],
          layout: {
            showlegend: true,
            legend: {
              x: 0.5,
              y: 1,
              orientation: 'h'
            }
          }
        }
      };
      const result = validatePlotlyRequest(request);
      expect(result.chart.layout?.legend?.orientation).toBe('h');
    });
  });
});
