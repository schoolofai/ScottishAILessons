/**
 * Visual inspection tests for JSXGraph renderer
 *
 * These tests save rendered images to disk for manual visual inspection.
 * Run with: npm test -- --run tests/visual-inspection/jsxgraph.visual.test.ts
 *
 * Output images are saved to: tests/visual-inspection/output/jsxgraph-*.png
 *
 * These tests use examples from tests/examples/jsxgraph.examples.ts which
 * serve as reference patterns for AI-driven diagram generation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { DiagramRenderer } from '../../src/services/renderer';
import type { JSXGraphDiagram } from '../../src/types/diagram';

// Import examples from the shared examples file
import * as jsxgraphExamples from '../examples/jsxgraph.examples';

const OUTPUT_DIR = path.join(__dirname, 'output');

describe('JSXGraph Visual Inspection Tests', () => {
  let renderer: DiagramRenderer;

  beforeAll(async () => {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    renderer = new DiagramRenderer();
    await renderer.initialize();
    console.log('JSXGraph renderer initialized for visual tests');
  }, 30000);

  afterAll(async () => {
    await renderer.close();
    console.log(`\n📁 Visual inspection images saved to: ${OUTPUT_DIR}`);
    console.log('   Open the PNG files to verify rendering quality.');
  });

  // ==========================================================================
  // COORDINATE GEOMETRY - POINTS
  // ==========================================================================

  it('should render basic points on coordinate grid', async () => {
    const buffer = await renderer.render(
      jsxgraphExamples.pointsBasic,
      jsxgraphExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-points-basic.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-points-basic.png (${buffer.length} bytes)`);
  }, 30000);

  it('should render points in all four quadrants', async () => {
    const buffer = await renderer.render(
      jsxgraphExamples.pointsQuadrants,
      jsxgraphExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-points-quadrants.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-points-quadrants.png (${buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // STRAIGHT LINES
  // ==========================================================================

  it('should render line through two points', async () => {
    const buffer = await renderer.render(
      jsxgraphExamples.lineTwoPoints,
      jsxgraphExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-line-two-points.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-line-two-points.png (${buffer.length} bytes)`);
  }, 30000);

  it('should render gradient visualization (rise/run)', async () => {
    const buffer = await renderer.render(
      jsxgraphExamples.lineGradient,
      jsxgraphExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-line-gradient.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-line-gradient.png (${buffer.length} bytes)`);
  }, 30000);

  it('should render parallel lines', async () => {
    const buffer = await renderer.render(
      jsxgraphExamples.linesParallel,
      jsxgraphExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-lines-parallel.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-lines-parallel.png (${buffer.length} bytes)`);
  }, 30000);

  it('should render perpendicular lines', async () => {
    const buffer = await renderer.render(
      jsxgraphExamples.linesPerpendicular,
      jsxgraphExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-lines-perpendicular.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-lines-perpendicular.png (${buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // MIDPOINT AND DISTANCE
  // ==========================================================================

  it('should render midpoint visualization', async () => {
    const buffer = await renderer.render(
      jsxgraphExamples.midpoint,
      jsxgraphExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-midpoint.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-midpoint.png (${buffer.length} bytes)`);
  }, 30000);

  it('should render distance formula visualization', async () => {
    const buffer = await renderer.render(
      jsxgraphExamples.distance,
      jsxgraphExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-distance.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-distance.png (${buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // TRIANGLES AND POLYGONS
  // ==========================================================================

  it('should render basic triangle', async () => {
    const buffer = await renderer.render(
      jsxgraphExamples.triangleBasic,
      jsxgraphExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-triangle-basic.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-triangle-basic.png (${buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // TRANSFORMATIONS - REFLECTION
  // ==========================================================================

  it('should render reflection in x-axis', async () => {
    const buffer = await renderer.render(
      jsxgraphExamples.reflectionXAxis,
      jsxgraphExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-reflection-x-axis.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-reflection-x-axis.png (${buffer.length} bytes)`);
  }, 30000);

  it('should render reflection in y-axis', async () => {
    const buffer = await renderer.render(
      jsxgraphExamples.reflectionYAxis,
      jsxgraphExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-reflection-y-axis.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-reflection-y-axis.png (${buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // TRANSFORMATIONS - TRANSLATION
  // ==========================================================================

  it('should render translation by vector', async () => {
    const buffer = await renderer.render(
      jsxgraphExamples.translation,
      jsxgraphExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-translation.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-translation.png (${buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // VECTORS
  // ==========================================================================

  it('should render basic vector', async () => {
    const buffer = await renderer.render(
      jsxgraphExamples.vectorBasic,
      jsxgraphExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-vector-basic.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-vector-basic.png (${buffer.length} bytes)`);
  }, 30000);

  it('should render vector addition', async () => {
    const buffer = await renderer.render(
      jsxgraphExamples.vectorAddition,
      jsxgraphExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-vector-addition.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-vector-addition.png (${buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // CIRCLES
  // ==========================================================================

  it('should render basic circle', async () => {
    const buffer = await renderer.render(
      jsxgraphExamples.circleBasic,
      jsxgraphExamples.renderOptions.square
    );

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-circle-basic.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-circle-basic.png (${buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // HELPER FUNCTION TESTS
  // ==========================================================================

  it('should render using createPoint helper', async () => {
    const diagram: JSXGraphDiagram = {
      board: jsxgraphExamples.createBoard(-5, 5, -5, 5),
      elements: [
        jsxgraphExamples.createPoint(2, 3, { id: 'P1', name: 'P(2, 3)', color: '#c74440' }),
        jsxgraphExamples.createPoint(-1, 2, { id: 'P2', name: 'Q(-1, 2)', color: '#2d70b3' })
      ]
    };

    const buffer = await renderer.render(diagram, jsxgraphExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-helper-points.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-helper-points.png (${buffer.length} bytes)`);
  }, 30000);

  it('should render using createLine helper', async () => {
    const diagram: JSXGraphDiagram = {
      board: jsxgraphExamples.createBoard(-5, 5, -5, 5),
      elements: [
        jsxgraphExamples.createPoint(-3, -2, { id: 'A', name: 'A', color: '#c74440' }),
        jsxgraphExamples.createPoint(3, 2, { id: 'B', name: 'B', color: '#c74440' }),
        jsxgraphExamples.createLine('A', 'B', { color: '#c74440', width: 2 })
      ]
    };

    const buffer = await renderer.render(diagram, jsxgraphExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'jsxgraph-helper-line.png');
    fs.writeFileSync(outputPath, buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: jsxgraph-helper-line.png (${buffer.length} bytes)`);
  }, 30000);
});
