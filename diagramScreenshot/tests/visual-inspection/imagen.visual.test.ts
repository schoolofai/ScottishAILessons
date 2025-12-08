/**
 * Visual inspection tests for Imagen (Gemini AI image generation)
 *
 * These tests save generated images to disk for manual visual inspection.
 * Run with: npm test -- --run tests/visual-inspection/imagen.visual.test.ts
 *
 * Output images are saved to: tests/visual-inspection/output/imagen-*.png
 *
 * NOTE: Requires GEMINI_API_KEY in .env file or environment.
 * Rate limit: 10 requests per minute - tests are designed to stay within limits.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();
import { ImagenClient, initImagenClient, isImagenConfigured } from '../../src/services/clients/imagen.client';
import type { ImagenRenderRequest } from '../../src/types/imagen.types';

// Import examples from the shared examples file
import * as imagenExamples from '../examples/imagen.examples';

const OUTPUT_DIR = path.join(__dirname, 'output');

// Helper to add delay between tests to avoid rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Imagen Visual Inspection Tests', () => {
  let client: ImagenClient;
  let skipTests: boolean = false;

  beforeAll(async () => {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.log('⚠️  GEMINI_API_KEY not set - Imagen tests will be skipped');
      skipTests = true;
      return;
    }

    // Initialize the client
    const initialized = initImagenClient();
    if (!initialized || !isImagenConfigured()) {
      console.log('⚠️  Imagen client initialization failed - tests will be skipped');
      skipTests = true;
      return;
    }

    client = new ImagenClient();
    console.log('Imagen client initialized for visual tests');
    console.log('⏱️  Note: Tests include delays to respect rate limits (10 req/min)');
  }, 30000);

  afterAll(() => {
    if (!skipTests) {
      console.log(`\n📁 Visual inspection images saved to: ${OUTPUT_DIR}`);
      console.log('   Open the PNG files to verify AI-generated image quality.');
    }
  });

  beforeEach(async () => {
    // Add delay between tests to avoid rate limiting
    await delay(7000); // ~8-9 requests per minute to stay safe
  });

  // Helper to save image from response
  const saveImage = (base64Data: string, filename: string): string => {
    const buffer = Buffer.from(base64Data, 'base64');
    const outputPath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(outputPath, buffer);
    return outputPath;
  };

  // ==========================================================================
  // REAL-WORLD MATHEMATICS APPLICATIONS
  // ==========================================================================

  it('should generate Pythagorean theorem in architecture', async () => {
    if (skipTests) {
      console.log('  ⏭️  Skipped: GEMINI_API_KEY not configured');
      return;
    }

    const result = await client.generate(imagenExamples.pythagorasArchitecture);

    expect(result.success).toBe(true);
    expect(result.images.length).toBeGreaterThan(0);

    const outputPath = saveImage(result.images[0].image, 'imagen-pythagoras-architecture.png');
    expect(fs.existsSync(outputPath)).toBe(true);

    console.log(`  ✓ Saved: imagen-pythagoras-architecture.png (${result.metadata.renderTimeMs}ms)`);
  }, 60000);

  it('should generate similar triangles in surveying', async () => {
    if (skipTests) {
      console.log('  ⏭️  Skipped: GEMINI_API_KEY not configured');
      return;
    }

    const result = await client.generate(imagenExamples.similarTrianglesSurveying);

    expect(result.success).toBe(true);
    expect(result.images.length).toBeGreaterThan(0);

    const outputPath = saveImage(result.images[0].image, 'imagen-similar-triangles.png');
    expect(fs.existsSync(outputPath)).toBe(true);

    console.log(`  ✓ Saved: imagen-similar-triangles.png (${result.metadata.renderTimeMs}ms)`);
  }, 60000);

  it('should generate gradient/slope road design', async () => {
    if (skipTests) {
      console.log('  ⏭️  Skipped: GEMINI_API_KEY not configured');
      return;
    }

    const result = await client.generate(imagenExamples.gradientRoadDesign);

    expect(result.success).toBe(true);
    expect(result.images.length).toBeGreaterThan(0);

    const outputPath = saveImage(result.images[0].image, 'imagen-gradient-road.png');
    expect(fs.existsSync(outputPath)).toBe(true);

    console.log(`  ✓ Saved: imagen-gradient-road.png (${result.metadata.renderTimeMs}ms)`);
  }, 60000);

  // ==========================================================================
  // STATISTICS AND DATA IN CONTEXT
  // ==========================================================================

  it('should generate statistics in sports context', async () => {
    if (skipTests) {
      console.log('  ⏭️  Skipped: GEMINI_API_KEY not configured');
      return;
    }

    const result = await client.generate(imagenExamples.statisticsSportsContext);

    expect(result.success).toBe(true);
    expect(result.images.length).toBeGreaterThan(0);

    const outputPath = saveImage(result.images[0].image, 'imagen-statistics-sports.png');
    expect(fs.existsSync(outputPath)).toBe(true);

    console.log(`  ✓ Saved: imagen-statistics-sports.png (${result.metadata.renderTimeMs}ms)`);
  }, 60000);

  it('should generate probability in weather forecasting', async () => {
    if (skipTests) {
      console.log('  ⏭️  Skipped: GEMINI_API_KEY not configured');
      return;
    }

    const result = await client.generate(imagenExamples.probabilityWeather);

    expect(result.success).toBe(true);
    expect(result.images.length).toBeGreaterThan(0);

    const outputPath = saveImage(result.images[0].image, 'imagen-probability-weather.png');
    expect(fs.existsSync(outputPath)).toBe(true);

    console.log(`  ✓ Saved: imagen-probability-weather.png (${result.metadata.renderTimeMs}ms)`);
  }, 60000);

  // ==========================================================================
  // GEOMETRIC SHAPES IN REAL WORLD
  // ==========================================================================

  it('should generate circles in engineering (gears)', async () => {
    if (skipTests) {
      console.log('  ⏭️  Skipped: GEMINI_API_KEY not configured');
      return;
    }

    const result = await client.generate(imagenExamples.circlesGears);

    expect(result.success).toBe(true);
    expect(result.images.length).toBeGreaterThan(0);

    const outputPath = saveImage(result.images[0].image, 'imagen-circles-gears.png');
    expect(fs.existsSync(outputPath)).toBe(true);

    console.log(`  ✓ Saved: imagen-circles-gears.png (${result.metadata.renderTimeMs}ms)`);
  }, 60000);

  it('should generate area and perimeter in garden design', async () => {
    if (skipTests) {
      console.log('  ⏭️  Skipped: GEMINI_API_KEY not configured');
      return;
    }

    const result = await client.generate(imagenExamples.areaPerimeterGarden);

    expect(result.success).toBe(true);
    expect(result.images.length).toBeGreaterThan(0);

    const outputPath = saveImage(result.images[0].image, 'imagen-area-perimeter-garden.png');
    expect(fs.existsSync(outputPath)).toBe(true);

    console.log(`  ✓ Saved: imagen-area-perimeter-garden.png (${result.metadata.renderTimeMs}ms)`);
  }, 60000);

  it('should generate volume in packaging', async () => {
    if (skipTests) {
      console.log('  ⏭️  Skipped: GEMINI_API_KEY not configured');
      return;
    }

    const result = await client.generate(imagenExamples.volumePackaging);

    expect(result.success).toBe(true);
    expect(result.images.length).toBeGreaterThan(0);

    const outputPath = saveImage(result.images[0].image, 'imagen-volume-packaging.png');
    expect(fs.existsSync(outputPath)).toBe(true);

    console.log(`  ✓ Saved: imagen-volume-packaging.png (${result.metadata.renderTimeMs}ms)`);
  }, 60000);

  // ==========================================================================
  // TRIGONOMETRY APPLICATIONS
  // ==========================================================================

  it('should generate angle of elevation (lighthouse)', async () => {
    if (skipTests) {
      console.log('  ⏭️  Skipped: GEMINI_API_KEY not configured');
      return;
    }

    const result = await client.generate(imagenExamples.angleElevationLighthouse);

    expect(result.success).toBe(true);
    expect(result.images.length).toBeGreaterThan(0);

    const outputPath = saveImage(result.images[0].image, 'imagen-angle-elevation.png');
    expect(fs.existsSync(outputPath)).toBe(true);

    console.log(`  ✓ Saved: imagen-angle-elevation.png (${result.metadata.renderTimeMs}ms)`);
  }, 60000);

  it('should generate bearings in navigation', async () => {
    if (skipTests) {
      console.log('  ⏭️  Skipped: GEMINI_API_KEY not configured');
      return;
    }

    const result = await client.generate(imagenExamples.bearingsNavigation);

    expect(result.success).toBe(true);
    expect(result.images.length).toBeGreaterThan(0);

    const outputPath = saveImage(result.images[0].image, 'imagen-bearings-navigation.png');
    expect(fs.existsSync(outputPath)).toBe(true);

    console.log(`  ✓ Saved: imagen-bearings-navigation.png (${result.metadata.renderTimeMs}ms)`);
  }, 60000);
});
