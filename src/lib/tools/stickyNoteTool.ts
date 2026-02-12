/**
 * Sticky Note tool - Click and drag to create sticky notes
 * Click to place a default-sized sticky note, or drag to set custom size
 */

import { Tool, type ToolContext } from './toolBase';
import type { PointerEventData, StickyNoteShape } from '../types';
import { STICKY_NOTE_COLORS } from '../types';
import { createStickyNote } from '../shapes/stickyNote';

const DEFAULT_WIDTH = 150;
const DEFAULT_HEIGHT = 150;

export class StickyNoteTool extends Tool {
  private startX = 0;
  private startY = 0;
  private isDrawing = false;
  private currentShape: StickyNoteShape | null = null;
  private hasDragged = false;
  private stylePreset = {
    strokeColor: '#333333',
    strokeWidth: 1,
    fillColor: STICKY_NOTE_COLORS.yellow,
    opacity: 1,
    roughness: 0,
  };

  setStylePreset(style: {
    strokeColor: string;
    strokeWidth: number;
    fillColor: string;
    opacity: number;
    roughness?: number;
  }): void {
    this.stylePreset = {
      ...this.stylePreset,
      strokeColor: style.strokeColor,
      opacity: style.opacity,
    };
  }

  onPointerDown(event: PointerEventData, context: ToolContext): void {
    if (!this.isActive) return;

    this.isDrawing = true;
    this.hasDragged = false;
    this.startX = event.canvasX;
    this.startY = event.canvasY;

    // Create initial sticky note (zero size, will grow on drag)
    this.currentShape = createStickyNote(
      this.startX,
      this.startY,
      0,
      0,
      {
        stickyColor: STICKY_NOTE_COLORS.yellow,
        strokeColor: this.stylePreset.strokeColor,
        strokeWidth: this.stylePreset.strokeWidth,
        opacity: this.stylePreset.opacity,
        roughness: this.stylePreset.roughness,
      }
    );

    context.requestRender();
  }

  onPointerMove(event: PointerEventData, context: ToolContext): void {
    if (!this.isActive || !this.isDrawing || !this.currentShape) return;

    // Calculate width and height
    const width = event.canvasX - this.startX;
    const height = event.canvasY - this.startY;

    // Mark as dragged if moved enough
    if (Math.abs(width) > 5 || Math.abs(height) > 5) {
      this.hasDragged = true;
    }

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

    // If user just clicked (no drag), create a default-sized sticky note
    if (!this.hasDragged) {
      this.currentShape.x = this.startX - DEFAULT_WIDTH / 2;
      this.currentShape.y = this.startY - DEFAULT_HEIGHT / 2;
      this.currentShape.width = DEFAULT_WIDTH;
      this.currentShape.height = DEFAULT_HEIGHT;
    }

    // Only add shape if it has some size
    if (this.currentShape.width > 1 && this.currentShape.height > 1) {
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
    if (!this.currentShape) return;

    // Only render preview if dragging with some size
    if (this.currentShape.width < 1 && this.currentShape.height < 1) return;

    const { x, y, width, height, stickyColor } = this.currentShape;
    const cornerRadius = 4;
    const foldSize = 16;

    ctx.save();
    ctx.globalAlpha = this.currentShape.opacity * 0.8;

    // Draw main body
    ctx.beginPath();
    ctx.moveTo(x + cornerRadius, y);
    ctx.lineTo(x + width - foldSize, y);
    ctx.lineTo(x + width, y + foldSize);
    ctx.lineTo(x + width, y + height - cornerRadius);
    ctx.arcTo(x + width, y + height, x + width - cornerRadius, y + height, cornerRadius);
    ctx.lineTo(x + cornerRadius, y + height);
    ctx.arcTo(x, y + height, x, y + height - cornerRadius, cornerRadius);
    ctx.lineTo(x, y + cornerRadius);
    ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
    ctx.closePath();

    ctx.fillStyle = stickyColor;
    ctx.fill();

    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw fold corner
    ctx.beginPath();
    ctx.moveTo(x + width - foldSize, y);
    ctx.lineTo(x + width - foldSize, y + foldSize);
    ctx.lineTo(x + width, y + foldSize);
    ctx.closePath();

    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  getCursor(): string {
    return 'crosshair';
  }
}
