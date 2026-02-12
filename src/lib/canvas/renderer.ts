/**
 * Canvas renderer with dirty flag optimization and requestAnimationFrame loop
 */

import type { Shape, Viewport, BoundingBox } from '../shapes/types';
import { boundingBoxesIntersect } from '../shapes/types';
import { PerformanceMonitor } from '../utils/performanceMonitor';
import { getVisibleBounds, isShapeVisible } from './culling';

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  backgroundColor?: string;
  enableViewportCulling?: boolean;
  enablePerformanceMonitoring?: boolean;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDirty: boolean = true;
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private backgroundColor: string;
  private enableViewportCulling: boolean;
  private performanceMonitor: PerformanceMonitor | null = null;

  // Shapes to render (managed externally, referenced here)
  private shapes: Shape[] = [];
  private viewport: Viewport = { x: 0, y: 0, zoom: 1 };

  // Performance tracking
  private lastFrameTime: number = 0;
  private fps: number = 60;

  constructor(options: RendererOptions) {
    this.canvas = options.canvas;
    this.backgroundColor = options.backgroundColor || '#ffffff';
    this.enableViewportCulling = options.enableViewportCulling || false;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = ctx;

    // Initialize performance monitoring if enabled
    if (options.enablePerformanceMonitoring) {
      this.performanceMonitor = new PerformanceMonitor();
    }

    // Set up high DPI rendering
    this.setupHighDPI();
  }

  /**
   * Set up high DPI (Retina) rendering
   */
  private setupHighDPI(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    // Set canvas size accounting for device pixel ratio
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    // Scale context to account for DPI
    this.ctx.scale(dpr, dpr);

    // Set display size
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  /**
   * Resize the canvas (call when window resizes)
   */
  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    this.ctx.scale(dpr, dpr);

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.markDirty();
  }

  /**
   * Mark the canvas as dirty, triggering a redraw on next frame
   */
  markDirty(): void {
    this.isDirty = true;
  }

  /**
   * Set the shapes to render
   */
  setShapes(shapes: Shape[]): void {
    this.shapes = shapes;
    this.markDirty();
  }

  /**
   * Set the viewport (pan/zoom state)
   */
  setViewport(viewport: Viewport): void {
    this.viewport = viewport;
    this.markDirty();
  }

  /**
   * Get the current viewport
   */
  getViewport(): Viewport {
    return { ...this.viewport };
  }

  /**
   * Start the rendering loop
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.renderLoop();
  }

  /**
   * Stop the rendering loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Main rendering loop using requestAnimationFrame
   */
  private renderLoop = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;

    // Performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.startFrame();
    }

    // Calculate FPS
    if (deltaTime > 0) {
      this.fps = 1000 / deltaTime;
    }

    // Only render if dirty flag is set (optimization)
    if (this.isDirty) {
      this.render();
      this.isDirty = false;
    }

    this.lastFrameTime = now;
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  };

  /**
   * Render all shapes to the canvas
   */
  private render(): void {
    // Start performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.startRender();
    }

    // Clear the canvas
    this.clear();

    // Apply viewport transformation
    this.ctx.save();
    this.applyViewportTransform();

    // Get visible bounds for culling (if enabled)
    const visibleBounds = this.enableViewportCulling
      ? this.getVisibleBounds()
      : null;

    // Render all shapes
    const visibleCount = this.renderShapes(visibleBounds);

    this.ctx.restore();

    // End performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.endRender();
      this.performanceMonitor.updateShapeCounts(this.shapes.length, visibleCount);
    }
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    const { width, height } = this.canvas.getBoundingClientRect();

    // Clear with background color
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, width, height);
  }

  /**
   * Apply viewport transformation (pan and zoom)
   */
  private applyViewportTransform(): void {
    const { x, y, zoom } = this.viewport;

    // Translate for pan
    this.ctx.translate(-x * zoom, -y * zoom);

    // Scale for zoom
    this.ctx.scale(zoom, zoom);
  }

  /**
   * Get the bounding box of the visible area in canvas coordinates
   */
  private getVisibleBounds(): BoundingBox {
    const { width, height } = this.canvas.getBoundingClientRect();
    const { x, y, zoom } = this.viewport;

    return {
      x: x,
      y: y,
      width: width / zoom,
      height: height / zoom
    };
  }

  /**
   * Render all shapes, optionally culling those outside visible bounds
   * Returns the count of visible shapes rendered
   */
  private renderShapes(visibleBounds: BoundingBox | null): number {
    let visibleCount = 0;

    for (const shape of this.shapes) {
      // Viewport culling optimization (skip if outside visible area)
      if (visibleBounds && this.enableViewportCulling) {
        // Note: shapes in canvasStore don't have getBounds() method yet
        // We'll need to add that or use a utility function
        // For now, skip culling if shape doesn't have getBounds
        if ('getBounds' in shape && typeof shape.getBounds === 'function') {
          const shapeBounds = (shape as any).getBounds();
          if (!boundingBoxesIntersect(shapeBounds, visibleBounds)) {
            continue; // Skip rendering this shape
          }
        }
      }

      visibleCount++;

      // Delegate rendering to the shape itself
      try {
        if ('render' in shape && typeof shape.render === 'function') {
          (shape as any).render(this.ctx, this.viewport);
        }
      } catch (error) {
        console.error(`Error rendering shape ${shape.id}:`, error);
      }
    }

    return visibleCount;
  }

  /**
   * Force an immediate render (bypass dirty flag)
   */
  forceRender(): void {
    this.render();
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    return Math.round(this.fps);
  }

  /**
   * Get performance monitor (if enabled)
   */
  getPerformanceMonitor(): PerformanceMonitor | null {
    return this.performanceMonitor;
  }

  /**
   * Enable or disable viewport culling
   */
  setViewportCulling(enabled: boolean): void {
    this.enableViewportCulling = enabled;
    this.markDirty();
  }

  /**
   * Set background color
   */
  setBackgroundColor(color: string): void {
    this.backgroundColor = color;
    this.markDirty();
  }

  /**
   * Get canvas dimensions
   */
  getCanvasDimensions(): { width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height
    };
  }

  /**
   * Convert screen coordinates to canvas coordinates
   */
  screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const { x, y, zoom } = this.viewport;

    const canvasX = (screenX - rect.left) / zoom + x;
    const canvasY = (screenY - rect.top) / zoom + y;

    return { x: canvasX, y: canvasY };
  }

  /**
   * Convert canvas coordinates to screen coordinates
   */
  canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const { x, y, zoom } = this.viewport;

    const screenX = (canvasX - x) * zoom + rect.left;
    const screenY = (canvasY - y) * zoom + rect.top;

    return { x: screenX, y: screenY };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop();
    this.shapes = [];
  }
}

/**
 * Helper function to create a renderer instance
 */
export function createRenderer(
  canvas: HTMLCanvasElement,
  options?: Partial<RendererOptions>
): Renderer {
  return new Renderer({
    canvas,
    ...options
  });
}
