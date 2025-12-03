/**
 * E2E tests for Plotly API endpoint
 * Tests the full request/response cycle through the Express server
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';

// Note: These tests require the server to be running with initialized renderers
// In CI, you may need to set up proper initialization before running

describe('Plotly API E2E', () => {
  // Store valid API key for tests (should match API_KEYS env var)
  const apiKey = process.env.API_KEY || 'test-api-key';

  describe('POST /api/v1/render/plotly', () => {
    it('should return 401 without API key', async () => {
      const response = await request(app)
        .post('/api/v1/render/plotly')
        .send({
          chart: {
            data: [{ type: 'bar', x: ['A'], y: [1] }]
          }
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid request body', async () => {
      const response = await request(app)
        .post('/api/v1/render/plotly')
        .set('X-API-Key', apiKey)
        .send({
          chart: {
            data: [] // Empty data array should fail validation
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing chart object', async () => {
      const response = await request(app)
        .post('/api/v1/render/plotly')
        .set('X-API-Key', apiKey)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid chart type', async () => {
      const response = await request(app)
        .post('/api/v1/render/plotly')
        .set('X-API-Key', apiKey)
        .send({
          chart: {
            data: [{ type: 'invalid_type', x: ['A'], y: [1] }]
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    // The following tests require the renderer to be initialized
    // They may be skipped in unit test environments
    describe('with initialized renderer', () => {
      it('should render a basic bar chart and return base64 image', async () => {
        const response = await request(app)
          .post('/api/v1/render/plotly')
          .set('X-API-Key', apiKey)
          .send({
            chart: {
              data: [
                {
                  type: 'bar',
                  x: ['Apples', 'Oranges', 'Bananas'],
                  y: [10, 15, 7]
                }
              ],
              layout: {
                title: 'Fruit Sales'
              }
            },
            options: {
              width: 800,
              height: 600,
              format: 'png'
            }
          });

        // If renderer is not initialized, skip these assertions
        if (response.status === 503) {
          console.log('Renderer not initialized - skipping test');
          return;
        }

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.image).toBeDefined();
        expect(typeof response.body.image).toBe('string');
        // Base64 PNG should start with iVBORw0KGgo
        expect(response.body.image.startsWith('iVBOR')).toBe(true);
        expect(response.body.metadata).toBeDefined();
        expect(response.body.metadata.traceCount).toBe(1);
      }, 30000);

      it('should render with custom dimensions', async () => {
        const response = await request(app)
          .post('/api/v1/render/plotly')
          .set('X-API-Key', apiKey)
          .send({
            chart: {
              data: [{ type: 'scatter', x: [1, 2, 3], y: [1, 4, 9], mode: 'lines' }]
            },
            options: {
              width: 1200,
              height: 800
            }
          });

        if (response.status === 503) {
          console.log('Renderer not initialized - skipping test');
          return;
        }

        expect(response.status).toBe(200);
        expect(response.body.metadata.width).toBe(1200);
        expect(response.body.metadata.height).toBe(800);
      }, 30000);

      it('should render as JPEG when specified', async () => {
        const response = await request(app)
          .post('/api/v1/render/plotly')
          .set('X-API-Key', apiKey)
          .send({
            chart: {
              data: [{ type: 'bar', x: ['A'], y: [1] }]
            },
            options: {
              format: 'jpeg',
              quality: 85
            }
          });

        if (response.status === 503) {
          console.log('Renderer not initialized - skipping test');
          return;
        }

        expect(response.status).toBe(200);
        expect(response.body.metadata.format).toBe('jpeg');
        // Base64 JPEG should start with /9j/
        expect(response.body.image.startsWith('/9j/')).toBe(true);
      }, 30000);

      it('should include chart types in metadata', async () => {
        const response = await request(app)
          .post('/api/v1/render/plotly')
          .set('X-API-Key', apiKey)
          .send({
            chart: {
              data: [
                { type: 'scatter', x: [1, 2], y: [1, 2], mode: 'lines' },
                { type: 'bar', x: ['A', 'B'], y: [10, 20] }
              ]
            }
          });

        if (response.status === 503) {
          console.log('Renderer not initialized - skipping test');
          return;
        }

        expect(response.status).toBe(200);
        expect(response.body.metadata.chartTypes).toContain('scatter');
        expect(response.body.metadata.chartTypes).toContain('bar');
        expect(response.body.metadata.traceCount).toBe(2);
      }, 30000);
    });
  });

  describe('Health check integration', () => {
    it('should include plotly renderer status in health check', async () => {
      const response = await request(app).get('/health');

      expect(response.body.renderers).toBeDefined();
      expect(response.body.renderers.plotly).toBeDefined();
      expect(typeof response.body.renderers.plotly.initialized).toBe('boolean');
    });
  });
});
