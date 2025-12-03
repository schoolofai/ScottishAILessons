/**
 * Visual inspection tests for GeoGebra renderer
 *
 * These tests save rendered images to disk for manual visual inspection.
 * Run with: npm test -- --run tests/visual-inspection/geogebra.visual.test.ts
 *
 * Output images are saved to: tests/visual-inspection/output/geogebra-*.png
 *
 * These tests use examples from tests/examples/geogebra.examples.ts which
 * serve as reference patterns for AI-driven diagram generation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { GeoGebraRenderer } from '../../src/services/renderers/geogebra.renderer';
import { BrowserService } from '../../src/services/browser.service';

// Import examples from the shared examples file
import * as geogebraExamples from '../examples/geogebra.examples';

const OUTPUT_DIR = path.join(__dirname, 'output');

describe('GeoGebra Visual Inspection Tests', () => {
  let renderer: GeoGebraRenderer;

  beforeAll(async () => {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    renderer = new GeoGebraRenderer();
    await renderer.initialize();
    console.log('GeoGebra renderer initialized for visual tests');
  }, 60000); // Longer timeout for GeoGebra initialization

  afterAll(async () => {
    await renderer.close();
    await BrowserService.getInstance().close();
    console.log(`\n📁 Visual inspection images saved to: ${OUTPUT_DIR}`);
    console.log('   Open the PNG files to verify rendering quality.');
  });

  // ==========================================================================
  // CIRCLE THEOREMS (National 5: Geometry - Circle)
  // ==========================================================================

  it('should render angle at centre theorem', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.circleAngleAtCentre },
      geogebraExamples.renderOptions.square
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-circle-angle-at-centre.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-circle-angle-at-centre.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render angle in semicircle theorem', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.circleAngleInSemicircle },
      geogebraExamples.renderOptions.square
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-circle-angle-semicircle.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-circle-angle-semicircle.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render angles in same segment theorem', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.circleAnglesInSameSegment },
      geogebraExamples.renderOptions.square
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-circle-same-segment.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-circle-same-segment.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render cyclic quadrilateral theorem', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.circleCyclicQuadrilateral },
      geogebraExamples.renderOptions.square
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-circle-cyclic-quad.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-circle-cyclic-quad.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render tangent-radius theorem', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.circleTangentRadius },
      geogebraExamples.renderOptions.square
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-circle-tangent-radius.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-circle-tangent-radius.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render tangents from external point', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.circleTangentsFromPoint },
      geogebraExamples.renderOptions.square
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-circle-tangents-external.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-circle-tangents-external.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render alternate segment theorem', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.circleAlternateSegment },
      geogebraExamples.renderOptions.square
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-circle-alternate-segment.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-circle-alternate-segment.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render perpendicular from centre bisects chord', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.circlePerpendicularBisectsChord },
      geogebraExamples.renderOptions.square
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-circle-perp-chord.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-circle-perp-chord.png (${result.buffer.length} bytes)`);
  }, 60000);

  // ==========================================================================
  // GEOMETRIC CONSTRUCTIONS (National 5: Geometry)
  // ==========================================================================

  it('should render perpendicular bisector construction', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.constructionPerpendicularBisector },
      geogebraExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-construction-perp-bisector.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-construction-perp-bisector.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render angle bisector construction', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.constructionAngleBisector },
      geogebraExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-construction-angle-bisector.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-construction-angle-bisector.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render perpendicular from point to line', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.constructionPerpendicularFromPoint },
      geogebraExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-construction-perp-from-point.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-construction-perp-from-point.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render circumscribed circle construction', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.constructionCircumscribedCircle },
      geogebraExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-construction-circumcircle.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-construction-circumcircle.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render inscribed circle construction', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.constructionInscribedCircle },
      geogebraExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-construction-incircle.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-construction-incircle.png (${result.buffer.length} bytes)`);
  }, 60000);

  // ==========================================================================
  // SIMILARITY AND CONGRUENCE (National 5: Geometry)
  // ==========================================================================

  it('should render similar triangles', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.similarTriangles },
      geogebraExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-similar-triangles.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-similar-triangles.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render congruent triangles (SAS)', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.congruentTrianglesSAS },
      geogebraExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-congruent-sas.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-congruent-sas.png (${result.buffer.length} bytes)`);
  }, 60000);

  // ==========================================================================
  // ANGLE PROPERTIES (National 5: Geometry)
  // ==========================================================================

  it('should render angles on a straight line', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.anglesOnStraightLine },
      geogebraExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-angles-straight-line.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-angles-straight-line.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render vertically opposite angles', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.verticallyOppositeAngles },
      geogebraExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-angles-vertically-opp.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-angles-vertically-opp.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render angles in parallel lines', async () => {
    const result = await renderer.render(
      { construction: geogebraExamples.anglesInParallelLines },
      geogebraExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-angles-parallel-lines.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-angles-parallel-lines.png (${result.buffer.length} bytes)`);
  }, 60000);

  // ==========================================================================
  // HELPER FUNCTION TESTS
  // ==========================================================================

  it('should render using createCircle helper', async () => {
    const construction = geogebraExamples.createCircle(0, 0, 3, {
      centerName: 'Center',
      circleName: 'myCircle'
    });

    const result = await renderer.render(
      { construction },
      geogebraExamples.renderOptions.square
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-helper-circle.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-helper-circle.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render using createTriangle helper', async () => {
    const construction = geogebraExamples.createTriangle(
      [-2, -1],
      [3, -1],
      [0, 3],
      { labels: ['P', 'Q', 'R'], color: '#0000CC' }
    );

    const result = await renderer.render(
      { construction },
      geogebraExamples.renderOptions.standard
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-helper-triangle.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-helper-triangle.png (${result.buffer.length} bytes)`);
  }, 60000);

  it('should render using getCircleTheoremConstruction helper', async () => {
    const construction = geogebraExamples.getCircleTheoremConstruction('angle-at-centre');

    const result = await renderer.render(
      { construction },
      geogebraExamples.renderOptions.square
    );

    const outputPath = path.join(OUTPUT_DIR, 'geogebra-helper-theorem.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: geogebra-helper-theorem.png (${result.buffer.length} bytes)`);
  }, 60000);
});
