/**
 * Visual inspection tests for Desmos renderer
 *
 * These tests save rendered images to disk for manual visual inspection.
 * Run with: npm test -- --run tests/visual-inspection/desmos.visual.test.ts
 *
 * Output images are saved to: tests/visual-inspection/output/desmos-*.png
 *
 * These tests use examples from tests/examples/desmos.examples.ts which
 * serve as reference patterns for AI-driven diagram generation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { DesmosRenderer } from '../../src/services/renderers/desmos.renderer';
import { BrowserService } from '../../src/services/browser.service';
import type { DesmosRenderRequest } from '../../src/types/desmos.types';

// Import examples from the shared examples file
import * as desmosExamples from '../examples/desmos.examples';

const OUTPUT_DIR = path.join(__dirname, 'output');

describe('Desmos Visual Inspection Tests', () => {
  let renderer: DesmosRenderer;

  beforeAll(async () => {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    renderer = new DesmosRenderer();
    await renderer.initialize();
    console.log('Desmos renderer initialized for visual tests');
  }, 30000);

  afterAll(async () => {
    await renderer.close();
    await BrowserService.getInstance().close();
    console.log(`\n📁 Visual inspection images saved to: ${OUTPUT_DIR}`);
    console.log('   Open the PNG files to verify rendering quality.');
  });

  // ==========================================================================
  // LINEAR FUNCTIONS (National 5: Relationships - Linear)
  // ==========================================================================

  it('should render basic linear function (y = mx + c)', async () => {
    const result = await renderer.render(desmosExamples.linearBasic, desmosExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-linear-basic.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-linear-basic.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render parallel lines (same gradient)', async () => {
    const result = await renderer.render(desmosExamples.linearParallel, desmosExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-linear-parallel.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-linear-parallel.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render linear intersection (simultaneous equations)', async () => {
    const result = await renderer.render(desmosExamples.linearIntersection, desmosExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-linear-intersection.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-linear-intersection.png (${result.buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // QUADRATIC FUNCTIONS (National 5: Relationships - Quadratic)
  // ==========================================================================

  it('should render basic parabola (y = x²)', async () => {
    const result = await renderer.render(desmosExamples.quadraticBasic, desmosExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-quadratic-basic.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-quadratic-basic.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render quadratic with roots', async () => {
    const result = await renderer.render(desmosExamples.quadraticWithRoots, desmosExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-quadratic-roots.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-quadratic-roots.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render quadratic in vertex form', async () => {
    const result = await renderer.render(desmosExamples.quadraticVertexForm, desmosExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-quadratic-vertex.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-quadratic-vertex.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render quadratic family (comparing coefficients)', async () => {
    const result = await renderer.render(desmosExamples.quadraticFamily, desmosExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-quadratic-family.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-quadratic-family.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render quadratic-linear intersection', async () => {
    const result = await renderer.render(desmosExamples.quadraticLinearIntersection, desmosExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-quadratic-linear.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-quadratic-linear.png (${result.buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // TRIGONOMETRIC FUNCTIONS (National 5: Trigonometry - Graphs)
  // ==========================================================================

  it('should render sine wave', async () => {
    const result = await renderer.render(desmosExamples.trigSine, desmosExamples.renderOptions.wide);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-trig-sine.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-trig-sine.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render sine and cosine comparison', async () => {
    const result = await renderer.render(desmosExamples.trigSineCosine, desmosExamples.renderOptions.wide);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-trig-sin-cos.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-trig-sin-cos.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render transformed sine function', async () => {
    const result = await renderer.render(desmosExamples.trigSineTransformed, desmosExamples.renderOptions.wide);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-trig-transformed.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-trig-transformed.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render tangent function', async () => {
    const result = await renderer.render(desmosExamples.trigTangent, desmosExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-trig-tan.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-trig-tan.png (${result.buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // SPECIAL FUNCTIONS
  // ==========================================================================

  it('should render exponential and logarithmic functions', async () => {
    const result = await renderer.render(desmosExamples.expLogInverse, desmosExamples.renderOptions.square);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-exp-log.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-exp-log.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render absolute value functions', async () => {
    const result = await renderer.render(desmosExamples.absoluteValue, desmosExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-absolute-value.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-absolute-value.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render cubic function', async () => {
    const result = await renderer.render(desmosExamples.cubic, desmosExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-cubic.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-cubic.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render piecewise function', async () => {
    const result = await renderer.render(desmosExamples.piecewise, desmosExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-piecewise.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-piecewise.png (${result.buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // INEQUALITIES (National 5: Relationships)
  // ==========================================================================

  it('should render linear inequality', async () => {
    const result = await renderer.render(desmosExamples.inequalityLinear, desmosExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-inequality-linear.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-inequality-linear.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render system of inequalities', async () => {
    const result = await renderer.render(desmosExamples.inequalitySystem, desmosExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-inequality-system.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-inequality-system.png (${result.buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // CIRCLE EQUATIONS (National 5: Geometry - Circle)
  // ==========================================================================

  it('should render circle centered at origin', async () => {
    const result = await renderer.render(desmosExamples.circleOrigin, desmosExamples.renderOptions.square);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-circle-origin.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-circle-origin.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render circle with general center', async () => {
    const result = await renderer.render(desmosExamples.circleGeneral, desmosExamples.renderOptions.square);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-circle-general.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-circle-general.png (${result.buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // PARAMETRIC CURVES
  // ==========================================================================

  it('should render parametric spiral', async () => {
    const result = await renderer.render(desmosExamples.parametricSpiral, desmosExamples.renderOptions.square);

    const outputPath = path.join(OUTPUT_DIR, 'desmos-parametric-spiral.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: desmos-parametric-spiral.png (${result.buffer.length} bytes)`);
  }, 30000);
});
