/**
 * Performance monitoring utilities for tracking FPS and render times
 */

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  fps: number;
  frameTime: number; // in ms
  renderTime: number; // in ms
  shapeCount: number;
  visibleShapeCount: number;
}

/**
 * Performance monitor class
 */
export class PerformanceMonitor {
  private frameCount: number = 0;
  private lastTime: number = 0;
  private lastFpsUpdate: number = 0;
  private fps: number = 60;
  private frameTime: number = 0;
  private renderTime: number = 0;
  private renderStartTime: number = 0;
  private fpsUpdateInterval: number = 500; // Update FPS every 500ms
  private shapeCount: number = 0;
  private visibleShapeCount: number = 0;

  // History for averaging
  private frameTimes: number[] = [];
  private maxHistorySize: number = 30;

  constructor() {
    this.lastTime = performance.now();
    this.lastFpsUpdate = this.lastTime;
  }

  /**
   * Call this at the start of each frame
   */
  startFrame(): void {
    const now = performance.now();
    this.frameTime = now - this.lastTime;
    this.lastTime = now;

    // Add to history
    this.frameTimes.push(this.frameTime);
    if (this.frameTimes.length > this.maxHistorySize) {
      this.frameTimes.shift();
    }

    this.frameCount++;

    // Update FPS periodically
    if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
      const elapsed = now - this.lastFpsUpdate;
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  /**
   * Call this at the start of rendering
   */
  startRender(): void {
    this.renderStartTime = performance.now();
  }

  /**
   * Call this at the end of rendering
   */
  endRender(): void {
    this.renderTime = performance.now() - this.renderStartTime;
  }

  /**
   * Update shape counts
   */
  updateShapeCounts(total: number, visible: number): void {
    this.shapeCount = total;
    this.visibleShapeCount = visible;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return {
      fps: this.fps,
      frameTime: this.frameTime,
      renderTime: this.renderTime,
      shapeCount: this.shapeCount,
      visibleShapeCount: this.visibleShapeCount
    };
  }

  /**
   * Get average frame time
   */
  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    return sum / this.frameTimes.length;
  }

  /**
   * Check if performance is good (>= 55 FPS)
   */
  isPerformanceGood(): boolean {
    return this.fps >= 55;
  }

  /**
   * Check if performance is acceptable (>= 30 FPS)
   */
  isPerformanceAcceptable(): boolean {
    return this.fps >= 30;
  }

  /**
   * Get performance grade (A/B/C/D/F)
   */
  getPerformanceGrade(): string {
    if (this.fps >= 55) return 'A';
    if (this.fps >= 45) return 'B';
    if (this.fps >= 30) return 'C';
    if (this.fps >= 20) return 'D';
    return 'F';
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.lastFpsUpdate = this.lastTime;
    this.fps = 60;
    this.frameTime = 0;
    this.renderTime = 0;
    this.frameTimes = [];
  }

  /**
   * Get a formatted string of current metrics
   */
  toString(): string {
    const metrics = this.getMetrics();
    return [
      `FPS: ${metrics.fps}`,
      `Frame: ${metrics.frameTime.toFixed(2)}ms`,
      `Render: ${metrics.renderTime.toFixed(2)}ms`,
      `Shapes: ${metrics.visibleShapeCount}/${metrics.shapeCount}`
    ].join(' | ');
  }
}

/**
 * Simple FPS counter that can be displayed on screen
 */
export class FPSCounter {
  private monitor: PerformanceMonitor;
  private element: HTMLDivElement | null = null;
  private updateInterval: number = 250; // Update display every 250ms
  private lastUpdate: number = 0;

  constructor() {
    this.monitor = new PerformanceMonitor();
  }

  /**
   * Create and add FPS counter element to the page
   */
  show(): void {
    if (this.element) return;

    this.element = document.createElement('div');
    this.element.style.position = 'fixed';
    this.element.style.top = '10px';
    this.element.style.right = '10px';
    this.element.style.padding = '8px 12px';
    this.element.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    this.element.style.color = '#fff';
    this.element.style.fontFamily = 'monospace';
    this.element.style.fontSize = '12px';
    this.element.style.zIndex = '10000';
    this.element.style.borderRadius = '4px';
    this.element.style.pointerEvents = 'none';

    document.body.appendChild(this.element);
  }

  /**
   * Remove FPS counter from the page
   */
  hide(): void {
    if (this.element) {
      document.body.removeChild(this.element);
      this.element = null;
    }
  }

  /**
   * Update FPS counter (call every frame)
   */
  update(shapeCount?: number, visibleShapeCount?: number): void {
    this.monitor.startFrame();

    if (shapeCount !== undefined && visibleShapeCount !== undefined) {
      this.monitor.updateShapeCounts(shapeCount, visibleShapeCount);
    }

    // Update display periodically
    const now = performance.now();
    if (this.element && now - this.lastUpdate >= this.updateInterval) {
      this.updateDisplay();
      this.lastUpdate = now;
    }
  }

  /**
   * Update the display element
   */
  private updateDisplay(): void {
    if (!this.element) return;

    const metrics = this.monitor.getMetrics();
    const grade = this.monitor.getPerformanceGrade();

    // Color based on performance
    let color = '#4caf50'; // Green
    if (metrics.fps < 30) color = '#f44336'; // Red
    else if (metrics.fps < 45) color = '#ff9800'; // Orange
    else if (metrics.fps < 55) color = '#ffeb3b'; // Yellow

    this.element.style.backgroundColor = `${color}22`;
    this.element.style.borderLeft = `3px solid ${color}`;

    this.element.innerHTML = `
      <div style="line-height: 1.4;">
        <div><strong>FPS:</strong> ${metrics.fps} (${grade})</div>
        <div><strong>Frame:</strong> ${metrics.frameTime.toFixed(1)}ms</div>
        <div><strong>Shapes:</strong> ${metrics.visibleShapeCount}/${metrics.shapeCount}</div>
      </div>
    `;
  }

  /**
   * Get the performance monitor
   */
  getMonitor(): PerformanceMonitor {
    return this.monitor;
  }
}

/**
 * Create a performance monitor instance
 */
export function createPerformanceMonitor(): PerformanceMonitor {
  return new PerformanceMonitor();
}

/**
 * Create an FPS counter instance
 */
export function createFPSCounter(): FPSCounter {
  return new FPSCounter();
}
