/**
 * Performance testing utilities
 * Generate test data and benchmark performance
 */

import type { Shape } from '../types';

/**
 * Generate a random number between min and max
 */
function random(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Generate a random color
 */
function randomColor(): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B739', '#52B788', '#F06292', '#64B5F6'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Generate random shapes for performance testing
 */
export function generateTestShapes(count: number, canvasWidth: number = 5000, canvasHeight: number = 5000): Shape[] {
  const shapes: Shape[] = [];
  const types: ('rectangle' | 'ellipse' | 'line')[] = ['rectangle', 'ellipse', 'line'];

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const x = random(0, canvasWidth - 100);
    const y = random(0, canvasHeight - 100);

    let shape: Shape;

    if (type === 'rectangle') {
      shape = {
        id: `test_rect_${i}`,
        type: 'rectangle',
        x,
        y,
        width: random(50, 200),
        height: random(50, 150),
        strokeColor: randomColor(),
        fillColor: Math.random() > 0.5 ? randomColor() : 'transparent',
        strokeWidth: Math.random() > 0.5 ? 2 : 1,
        opacity: random(0.7, 1)
      };
    } else if (type === 'ellipse') {
      shape = {
        id: `test_ellipse_${i}`,
        type: 'ellipse',
        x,
        y,
        width: random(50, 200),
        height: random(50, 150),
        strokeColor: randomColor(),
        fillColor: Math.random() > 0.5 ? randomColor() : 'transparent',
        strokeWidth: Math.random() > 0.5 ? 2 : 1,
        opacity: random(0.7, 1)
      };
    } else {
      shape = {
        id: `test_line_${i}`,
        type: 'line',
        x,
        y,
        x2: x + random(50, 200),
        y2: y + random(50, 200),
        strokeColor: randomColor(),
        fillColor: 'transparent',
        strokeWidth: Math.random() > 0.5 ? 2 : 1,
        opacity: random(0.7, 1)
      };
    }

    shapes.push(shape);
  }

  return shapes;
}

/**
 * Performance test configuration
 */
export interface PerformanceTestConfig {
  shapeCount: number;
  duration: number; // Test duration in seconds
  canvasWidth: number;
  canvasHeight: number;
  viewportCulling: boolean;
  spatialIndexing: boolean;
}

/**
 * Performance test results
 */
export interface PerformanceTestResults {
  config: PerformanceTestConfig;
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  averageFrameTime: number;
  averageRenderTime: number;
  totalFrames: number;
  passedTest: boolean; // true if avg FPS >= 55
}

/**
 * Benchmark shape rendering performance
 */
export async function benchmarkPerformance(
  config: PerformanceTestConfig
): Promise<PerformanceTestResults> {
  console.log(`Starting performance test with ${config.shapeCount} shapes...`);

  const shapes = generateTestShapes(config.shapeCount, config.canvasWidth, config.canvasHeight);

  // Create a temporary canvas for testing
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  const viewport = {
    x: 0,
    y: 0,
    zoom: 1
  };

  const frameTimes: number[] = [];
  const fpsValues: number[] = [];
  let frameCount = 0;
  let lastTime = performance.now();
  const startTime = lastTime;
  const endTime = startTime + config.duration * 1000;

  // Render loop
  while (performance.now() < endTime) {
    const now = performance.now();
    const deltaTime = now - lastTime;
    const fps = 1000 / deltaTime;

    // Render all shapes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-viewport.x * viewport.zoom, -viewport.y * viewport.zoom);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Simple rendering (actual implementation would use culling/indexing based on config)
    for (const shape of shapes) {
      ctx.globalAlpha = shape.opacity;

      if (shape.type === 'rectangle') {
        if (shape.fillColor && shape.fillColor !== 'transparent') {
          ctx.fillStyle = shape.fillColor;
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        }
        if (shape.strokeColor && shape.strokeWidth > 0) {
          ctx.strokeStyle = shape.strokeColor;
          ctx.lineWidth = shape.strokeWidth;
          ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        }
      } else if (shape.type === 'ellipse') {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const rx = Math.abs(shape.width) / 2;
        const ry = Math.abs(shape.height) / 2;

        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);

        if (shape.fillColor && shape.fillColor !== 'transparent') {
          ctx.fillStyle = shape.fillColor;
          ctx.fill();
        }
        if (shape.strokeColor && shape.strokeWidth > 0) {
          ctx.strokeStyle = shape.strokeColor;
          ctx.lineWidth = shape.strokeWidth;
          ctx.stroke();
        }
      } else if (shape.type === 'line') {
        if (shape.strokeColor && shape.strokeWidth > 0) {
          ctx.strokeStyle = shape.strokeColor;
          ctx.lineWidth = shape.strokeWidth;
          ctx.beginPath();
          ctx.moveTo(shape.x, shape.y);
          ctx.lineTo(shape.x2, shape.y2);
          ctx.stroke();
        }
      }
    }

    ctx.restore();

    frameTimes.push(deltaTime);
    fpsValues.push(fps);
    frameCount++;
    lastTime = now;

    // Allow UI to update
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // Calculate results
  const averageFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  const averageFPS = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
  const minFPS = Math.min(...fpsValues);
  const maxFPS = Math.max(...fpsValues);

  const results: PerformanceTestResults = {
    config,
    averageFPS: Math.round(averageFPS),
    minFPS: Math.round(minFPS),
    maxFPS: Math.round(maxFPS),
    averageFrameTime: Math.round(averageFrameTime * 100) / 100,
    averageRenderTime: Math.round(averageFrameTime * 100) / 100,
    totalFrames: frameCount,
    passedTest: averageFPS >= 55
  };

  console.log('Performance test complete:', results);

  return results;
}

/**
 * Run a suite of performance tests with different shape counts
 */
export async function runPerformanceTestSuite(): Promise<PerformanceTestResults[]> {
  const configs: PerformanceTestConfig[] = [
    { shapeCount: 100, duration: 3, canvasWidth: 5000, canvasHeight: 5000, viewportCulling: false, spatialIndexing: false },
    { shapeCount: 500, duration: 3, canvasWidth: 5000, canvasHeight: 5000, viewportCulling: false, spatialIndexing: false },
    { shapeCount: 1000, duration: 3, canvasWidth: 5000, canvasHeight: 5000, viewportCulling: false, spatialIndexing: false },
    { shapeCount: 1000, duration: 3, canvasWidth: 5000, canvasHeight: 5000, viewportCulling: true, spatialIndexing: false },
    { shapeCount: 2000, duration: 3, canvasWidth: 5000, canvasHeight: 5000, viewportCulling: true, spatialIndexing: true }
  ];

  const results: PerformanceTestResults[] = [];

  for (const config of configs) {
    const result = await benchmarkPerformance(config);
    results.push(result);
  }

  return results;
}

/**
 * Format test results as a table
 */
export function formatTestResults(results: PerformanceTestResults[]): string {
  let output = '\nPerformance Test Results\n';
  output += '========================\n\n';
  output += 'Shapes | Culling | Index | Avg FPS | Min FPS | Max FPS | Pass\n';
  output += '-------|---------|-------|---------|---------|---------|------\n';

  for (const result of results) {
    const culling = result.config.viewportCulling ? 'Yes' : 'No';
    const indexing = result.config.spatialIndexing ? 'Yes' : 'No';
    const pass = result.passedTest ? '✓' : '✗';

    output += `${result.config.shapeCount.toString().padEnd(6)} | `;
    output += `${culling.padEnd(7)} | `;
    output += `${indexing.padEnd(5)} | `;
    output += `${result.averageFPS.toString().padEnd(7)} | `;
    output += `${result.minFPS.toString().padEnd(7)} | `;
    output += `${result.maxFPS.toString().padEnd(7)} | `;
    output += `${pass}\n`;
  }

  return output;
}
