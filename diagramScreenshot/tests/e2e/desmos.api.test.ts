/**
 * E2E tests for Desmos API endpoint
 * Tests the full request/response cycle through the Express server
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';

describe('Desmos API E2E', () => {
  const apiKey = process.env.API_KEY || 'test-api-key';

  describe('POST /api/v1/render/desmos (full state)', () => {
    it('should return 401 without API key', async () => {
      const response = await request(app)
        .post('/api/v1/render/desmos')
        .send({
          state: {
            expressions: { list: [{ latex: 'y=x' }] }
          }
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for empty expressions', async () => {
      const response = await request(app)
        .post('/api/v1/render/desmos')
        .set('X-API-Key', apiKey)
        .send({
          state: {
            expressions: { list: [] }
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing state', async () => {
      const response = await request(app)
        .post('/api/v1/render/desmos')
        .set('X-API-Key', apiKey)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    describe('with initialized renderer', () => {
      it('should render a basic parabola', async () => {
        const response = await request(app)
          .post('/api/v1/render/desmos')
          .set('X-API-Key', apiKey)
          .send({
            state: {
              expressions: {
                list: [
                  { id: '1', latex: 'y=x^2', color: '#c74440' }
                ]
              },
              graph: {
                viewport: { xmin: -10, xmax: 10, ymin: -5, ymax: 20 }
              }
            },
            options: {
              width: 800,
              height: 600,
              format: 'png'
            }
          });

        // Skip if renderer not initialized
        if (response.status === 503) {
          console.log('Desmos renderer not initialized - skipping test');
          return;
        }

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.image).toBeDefined();
        expect(typeof response.body.image).toBe('string');
        expect(response.body.image.startsWith('iVBOR')).toBe(true); // PNG base64
        expect(response.body.metadata).toBeDefined();
      }, 30000);

      it('should render multiple expressions', async () => {
        const response = await request(app)
          .post('/api/v1/render/desmos')
          .set('X-API-Key', apiKey)
          .send({
            state: {
              expressions: {
                list: [
                  { id: '1', latex: 'y=\\sin(x)', color: '#2d70b3' },
                  { id: '2', latex: 'y=\\cos(x)', color: '#388c46' }
                ]
              }
            },
            options: {
              width: 800,
              height: 400
            }
          });

        if (response.status === 503) {
          console.log('Desmos renderer not initialized - skipping test');
          return;
        }

        expect(response.status).toBe(200);
        expect(response.body.metadata.expressionCount).toBe(2);
      }, 30000);

      it('should include expression count in metadata', async () => {
        const response = await request(app)
          .post('/api/v1/render/desmos')
          .set('X-API-Key', apiKey)
          .send({
            state: {
              expressions: {
                list: [
                  { latex: 'y=x' },
                  { latex: 'y=2x' },
                  { latex: 'y=3x' }
                ]
              }
            }
          });

        if (response.status === 503) {
          console.log('Desmos renderer not initialized - skipping test');
          return;
        }

        expect(response.status).toBe(200);
        expect(response.body.metadata.expressionCount).toBe(3);
        expect(response.body.metadata.totalItems).toBe(3);
      }, 30000);

      it('should render as JPEG when specified', async () => {
        const response = await request(app)
          .post('/api/v1/render/desmos')
          .set('X-API-Key', apiKey)
          .send({
            state: {
              expressions: { list: [{ latex: 'y=x^2' }] }
            },
            options: {
              format: 'jpeg',
              quality: 85
            }
          });

        if (response.status === 503) {
          console.log('Desmos renderer not initialized - skipping test');
          return;
        }

        expect(response.status).toBe(200);
        expect(response.body.metadata.format).toBe('jpeg');
        expect(response.body.image.startsWith('/9j/')).toBe(true); // JPEG base64
      }, 30000);
    });
  });

  describe('POST /api/v1/render/desmos/simple', () => {
    it('should return 400 for empty expressions', async () => {
      const response = await request(app)
        .post('/api/v1/render/desmos/simple')
        .set('X-API-Key', apiKey)
        .send({
          expressions: []
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for empty latex', async () => {
      const response = await request(app)
        .post('/api/v1/render/desmos/simple')
        .set('X-API-Key', apiKey)
        .send({
          expressions: [{ latex: '' }]
        });

      expect(response.status).toBe(400);
    });

    describe('with initialized renderer', () => {
      it('should render simple expressions', async () => {
        const response = await request(app)
          .post('/api/v1/render/desmos/simple')
          .set('X-API-Key', apiKey)
          .send({
            expressions: [
              { latex: 'y=2x+1', color: '#c74440' },
              { latex: 'y=-x+3', color: '#2d70b3' }
            ],
            viewport: {
              xmin: -5,
              xmax: 5,
              ymin: -5,
              ymax: 10
            },
            options: {
              width: 600,
              height: 600
            }
          });

        if (response.status === 503) {
          console.log('Desmos renderer not initialized - skipping test');
          return;
        }

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.image).toBeDefined();
      }, 30000);

      it('should work without viewport', async () => {
        const response = await request(app)
          .post('/api/v1/render/desmos/simple')
          .set('X-API-Key', apiKey)
          .send({
            expressions: [
              { latex: 'y=x^3-x' }
            ]
          });

        if (response.status === 503) {
          console.log('Desmos renderer not initialized - skipping test');
          return;
        }

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }, 30000);
    });
  });

  describe('Health check integration', () => {
    it('should include desmos renderer status in health check', async () => {
      const response = await request(app).get('/health');

      expect(response.body.renderers).toBeDefined();
      expect(response.body.renderers.desmos).toBeDefined();
      expect(typeof response.body.renderers.desmos.initialized).toBe('boolean');
    });
  });
});
