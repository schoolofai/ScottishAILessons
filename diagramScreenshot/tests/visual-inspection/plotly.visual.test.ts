/**
 * Visual inspection tests for Plotly renderer
 *
 * These tests save rendered images to disk for manual visual inspection.
 * Run with: npm test -- --run tests/visual-inspection/plotly.visual.test.ts
 *
 * Output images are saved to: tests/visual-inspection/output/plotly-*.png
 *
 * These tests use examples from tests/examples/plotly.examples.ts which
 * serve as reference patterns for AI-driven diagram generation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PlotlyRenderer } from '../../src/services/renderers/plotly.renderer';
import { BrowserService } from '../../src/services/browser.service';

// Import examples from the shared examples file
import * as plotlyExamples from '../examples/plotly.examples';

const OUTPUT_DIR = path.join(__dirname, 'output');

describe('Plotly Visual Inspection Tests', () => {
  let renderer: PlotlyRenderer;

  beforeAll(async () => {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    renderer = new PlotlyRenderer();
    await renderer.initialize();
    console.log('Plotly renderer initialized for visual tests');
  }, 30000);

  afterAll(async () => {
    await renderer.close();
    await BrowserService.getInstance().close();
    console.log(`\n📁 Visual inspection images saved to: ${OUTPUT_DIR}`);
    console.log('   Open the PNG files to verify rendering quality.');
  });

  // ==========================================================================
  // BAR CHARTS (National 5: Statistics - Displaying Data)
  // ==========================================================================

  it('should render basic bar chart', async () => {
    const result = await renderer.render(plotlyExamples.barChartBasic, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-bar-basic.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-bar-basic.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render grouped bar chart', async () => {
    const result = await renderer.render(plotlyExamples.barChartGrouped, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-bar-grouped.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-bar-grouped.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render horizontal bar chart', async () => {
    const result = await renderer.render(plotlyExamples.barChartHorizontal, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-bar-horizontal.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-bar-horizontal.png (${result.buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // PIE CHARTS (National 5: Statistics - Displaying Data)
  // ==========================================================================

  it('should render basic pie chart', async () => {
    const result = await renderer.render(plotlyExamples.pieChartBasic, plotlyExamples.renderOptions.square);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-pie-basic.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-pie-basic.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render pie chart with percentages', async () => {
    const result = await renderer.render(plotlyExamples.pieChartWithPercentages, plotlyExamples.renderOptions.square);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-pie-percentages.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-pie-percentages.png (${result.buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // LINE GRAPHS (National 5: Statistics - Time Series)
  // ==========================================================================

  it('should render basic line graph', async () => {
    const result = await renderer.render(plotlyExamples.lineGraphBasic, plotlyExamples.renderOptions.wide);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-line-basic.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-line-basic.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render multiple line graph', async () => {
    const result = await renderer.render(plotlyExamples.lineGraphMultiple, plotlyExamples.renderOptions.wide);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-line-multiple.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-line-multiple.png (${result.buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // SCATTER DIAGRAMS (National 5: Statistics - Correlation)
  // ==========================================================================

  it('should render scatter diagram (positive correlation)', async () => {
    const result = await renderer.render(plotlyExamples.scatterPositiveCorrelation, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-scatter-positive.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-scatter-positive.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render scatter diagram with trend line', async () => {
    const result = await renderer.render(plotlyExamples.scatterWithTrendLine, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-scatter-trendline.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-scatter-trendline.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render scatter diagram (no correlation)', async () => {
    const result = await renderer.render(plotlyExamples.scatterNoCorrelation, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-scatter-none.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-scatter-none.png (${result.buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // HISTOGRAMS (National 5: Statistics - Frequency Diagrams)
  // ==========================================================================

  it('should render basic histogram', async () => {
    const result = await renderer.render(plotlyExamples.histogramBasic, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-histogram-basic.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-histogram-basic.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render grouped histogram (from frequency table)', async () => {
    const result = await renderer.render(plotlyExamples.histogramGrouped, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-histogram-grouped.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-histogram-grouped.png (${result.buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // BOX PLOTS (National 5: Statistics - Five Figure Summary)
  // ==========================================================================

  it('should render basic box plot', async () => {
    const result = await renderer.render(plotlyExamples.boxPlotBasic, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-box-basic.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-box-basic.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render box plot comparison', async () => {
    const result = await renderer.render(plotlyExamples.boxPlotComparison, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-box-comparison.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-box-comparison.png (${result.buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // CUMULATIVE FREQUENCY & FREQUENCY POLYGONS
  // ==========================================================================

  it('should render cumulative frequency curve', async () => {
    const result = await renderer.render(plotlyExamples.cumulativeFrequency, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-cumulative-frequency.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-cumulative-frequency.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render frequency polygon', async () => {
    const result = await renderer.render(plotlyExamples.frequencyPolygon, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-frequency-polygon.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-frequency-polygon.png (${result.buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // HEATMAPS
  // ==========================================================================

  it('should render heatmap', async () => {
    const result = await renderer.render(plotlyExamples.heatmapBasic, plotlyExamples.renderOptions.square);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-heatmap.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-heatmap.png (${result.buffer.length} bytes)`);
  }, 30000);

  // ==========================================================================
  // HELPER FUNCTION TESTS
  // ==========================================================================

  it('should render chart from createBarChart helper', async () => {
    const chart = plotlyExamples.createBarChart(
      ['Apple', 'Banana', 'Cherry', 'Date'],
      [25, 40, 15, 30],
      { title: 'Fruit Sales', xLabel: 'Fruit', yLabel: 'Sales', color: '#e74c3c' }
    );

    const result = await renderer.render(chart, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-helper-bar.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-helper-bar.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render chart from createPieChart helper', async () => {
    const chart = plotlyExamples.createPieChart(
      ['Red', 'Blue', 'Green', 'Yellow'],
      [30, 25, 25, 20],
      { title: 'Favourite Colours' }
    );

    const result = await renderer.render(chart, plotlyExamples.renderOptions.square);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-helper-pie.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-helper-pie.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render chart from createScatterPlot helper', async () => {
    const chart = plotlyExamples.createScatterPlot(
      [1, 2, 3, 4, 5, 6, 7, 8],
      [2.5, 5.1, 7.2, 10.1, 12.5, 14.8, 17.2, 20.0],
      { title: 'Linear Relationship', xLabel: 'X', yLabel: 'Y', color: '#9b59b6' }
    );

    const result = await renderer.render(chart, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-helper-scatter.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-helper-scatter.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render chart from createHistogram helper', async () => {
    const data = [45, 52, 48, 61, 55, 58, 63, 49, 57, 54, 51, 59, 62, 47, 56, 53, 60, 50, 64, 46];
    const chart = plotlyExamples.createHistogram(
      data,
      { title: 'Score Distribution', xLabel: 'Score', binSize: 5, color: '#2ecc71' }
    );

    const result = await renderer.render(chart, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-helper-histogram.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-helper-histogram.png (${result.buffer.length} bytes)`);
  }, 30000);

  it('should render chart from createBoxPlot helper', async () => {
    const chart = plotlyExamples.createBoxPlot(
      [
        { name: 'Group A', values: [65, 70, 72, 75, 78, 80, 82, 85, 88, 92] },
        { name: 'Group B', values: [55, 60, 68, 72, 75, 77, 80, 83, 90, 95] },
        { name: 'Group C', values: [70, 75, 78, 80, 82, 85, 87, 90, 93, 98] }
      ],
      { title: 'Test Scores by Group', yLabel: 'Score (%)' }
    );

    const result = await renderer.render(chart, plotlyExamples.renderOptions.standard);

    const outputPath = path.join(OUTPUT_DIR, 'plotly-helper-boxplot.png');
    fs.writeFileSync(outputPath, result.buffer);

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`  ✓ Saved: plotly-helper-boxplot.png (${result.buffer.length} bytes)`);
  }, 30000);
});
