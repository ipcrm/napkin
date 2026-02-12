/**
 * Freedraw tool - Draw freehand paths by dragging
 */

import { Tool, type ToolContext } from './toolBase';
import type { PointerEventData, FreedrawShape } from '../types';
import { createFreedraw, simplifyPath } from '../shapes/freedraw';

export class FreedrawTool extends Tool {
  private isDrawing = false;
  private currentPoints: Array<{ x: number; y: number }> = [];
  private currentShape: FreedrawShape | null = null;
  private stylePreset = {
    strokeColor: '#000000',
    strokeWidth: 2,
    fillColor: 'transparent',
    opacity: 1,
    roughness: 1,
  };

  setStylePreset(style: {
    strokeColor: string;
    strokeWidth: number;
    fillColor: string;
    opacity: number;
    roughness?: number;
  }): void {
    this.stylePreset = { ...style, roughness: style.roughness ?? 1 };
  }

  onPointerDown(event: PointerEventData, context: ToolContext): void {
    if (!this.isActive) return;

    this.isDrawing = true;
    this.currentPoints = [{ x: event.canvasX, y: event.canvasY }];

    // Create initial shape with single point
    this.currentShape = createFreedraw(this.currentPoints, this.stylePreset);

    context.requestRender();
  }

  onPointerMove(event: PointerEventData, context: ToolContext): void {
    if (!this.isActive || !this.isDrawing || !this.currentShape) return;

    // Add point to path
    const lastPoint = this.currentPoints[this.currentPoints.length - 1];
    const dx = event.canvasX - lastPoint.x;
    const dy = event.canvasY - lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Only add point if it's far enough from the last point (avoid too many points)
    if (distance > 2) {
      this.currentPoints.push({ x: event.canvasX, y: event.canvasY });
      this.currentShape.points = this.currentPoints;
    }

    context.requestRender();
  }

  onPointerUp(_event: PointerEventData, context: ToolContext): void {
    if (!this.isActive || !this.isDrawing || !this.currentShape) return;

    this.isDrawing = false;

    // Only add shape if it has enough points
    if (this.currentPoints.length >= 2) {
      // Simplify the path using RDP algorithm
      const simplifiedPoints = simplifyPath(this.currentPoints, 2.0);

      // Create final shape with simplified points
      const finalShape = createFreedraw(simplifiedPoints, this.stylePreset);
      const shapeId = finalShape.id;
      context.addShape(finalShape);

      // Auto-select the newly created shape to show properties panel
      context.setSelectedIds(new Set([shapeId]));

      // Switch back to select tool
      context.setActiveTool('select');
    }

    this.currentPoints = [];
    this.currentShape = null;
    context.requestRender();
  }

  renderOverlay(ctx: CanvasRenderingContext2D, _context: ToolContext): void {
    if (this.currentShape && this.currentPoints.length >= 2) {
      // Render preview of current path
      ctx.save();
      ctx.globalAlpha = this.currentShape.opacity;

      if (this.currentShape.strokeColor && this.currentShape.strokeWidth > 0) {
        ctx.strokeStyle = this.currentShape.strokeColor;
        ctx.lineWidth = this.currentShape.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(this.currentPoints[0].x, this.currentPoints[0].y);

        for (let i = 1; i < this.currentPoints.length; i++) {
          ctx.lineTo(this.currentPoints[i].x, this.currentPoints[i].y);
        }

        ctx.stroke();
      }

      ctx.restore();
    }
  }

  getCursor(): string {
    return 'crosshair';
  }
}
