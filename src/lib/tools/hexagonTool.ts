/**
 * Hexagon tool - Click and drag to create hexagons
 */

import { Tool, type ToolContext } from './toolBase';
import type { PointerEventData, HexagonShape } from '../types';
import { createHexagon, renderHexagon } from '../shapes/hexagon';

export class HexagonTool extends Tool {
  private startX = 0;
  private startY = 0;
  private isDrawing = false;
  private currentShape: HexagonShape | null = null;
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
    this.startX = event.canvasX;
    this.startY = event.canvasY;

    // Create initial hexagon (zero size)
    this.currentShape = createHexagon(
      this.startX,
      this.startY,
      0,
      0,
      this.stylePreset
    );

    context.requestRender();
  }

  onPointerMove(event: PointerEventData, context: ToolContext): void {
    if (!this.isActive || !this.isDrawing || !this.currentShape) return;

    // Calculate width and height
    const width = event.canvasX - this.startX;
    const height = event.canvasY - this.startY;

    // Update current shape
    // Handle negative dimensions (dragging up/left)
    if (width < 0) {
      this.currentShape.x = this.startX + width;
      this.currentShape.width = Math.abs(width);
    } else {
      this.currentShape.x = this.startX;
      this.currentShape.width = width;
    }

    if (height < 0) {
      this.currentShape.y = this.startY + height;
      this.currentShape.height = Math.abs(height);
    } else {
      this.currentShape.y = this.startY;
      this.currentShape.height = height;
    }

    context.requestRender();
  }

  onPointerUp(_event: PointerEventData, context: ToolContext): void {
    if (!this.isActive || !this.isDrawing || !this.currentShape) return;

    this.isDrawing = false;

    // Only add shape if it has some size
    if (this.currentShape.width > 1 || this.currentShape.height > 1) {
      const shapeId = this.currentShape.id;
      context.addShape(this.currentShape);

      // Auto-select the newly created shape to show properties panel
      context.setSelectedIds(new Set([shapeId]));

      // Switch back to select tool
      context.setActiveTool('select');
    }

    this.currentShape = null;
    context.requestRender();
  }

  renderOverlay(ctx: CanvasRenderingContext2D, _context: ToolContext): void {
    if (this.currentShape) {
      // Render preview of current shape
      renderHexagon(ctx, this.currentShape);
    }
  }

  getCursor(): string {
    return 'crosshair';
  }
}
