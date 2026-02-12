/**
 * Text tool - Drag to create bounding box, then edit text
 */

import { Tool, type ToolContext } from './toolBase';
import type { PointerEventData, KeyboardEventData, TextShape } from '../types';
import { createText } from '../shapes/text';

export class TextTool extends Tool {
  private startX = 0;
  private startY = 0;
  private isDrawing = false;
  private drawingShape: TextShape | null = null;
  private editingShape: TextShape | null = null;
  private textArea: HTMLTextAreaElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private stylePreset = {
    strokeColor: '#000000',
    strokeWidth: 0,
    fillColor: 'transparent',
    opacity: 1,
    fontSize: 20,
    fontFamily: 'Arial, sans-serif',
  };

  setStylePreset(style: {
    strokeColor: string;
    strokeWidth: number;
    fillColor: string;
    opacity: number;
    fontSize?: number;
    fontFamily?: string;
  }): void {
    this.stylePreset = {
      ...this.stylePreset,
      ...style,
    };
  }

  /**
   * Set canvas element reference for positioning the textarea
   */
  setCanvasElement(canvas: HTMLCanvasElement): void {
    this.canvasElement = canvas;
  }

  onActivate(): void {
    super.onActivate();
    // Clean up any existing text editing
    this.finishEditing(null);
  }

  onDeactivate(): void {
    super.onDeactivate();
    // Clean up any existing text editing
    this.finishEditing(null);
  }

  onPointerDown(event: PointerEventData, context: ToolContext): void {
    if (!this.isActive) return;

    // If already editing, finish first
    if (this.editingShape && this.textArea) {
      this.finishEditing(context);
    }

    // Start drawing bounding box
    this.isDrawing = true;
    this.startX = event.canvasX;
    this.startY = event.canvasY;

    // Create text shape with zero dimensions
    this.drawingShape = createText(this.startX, this.startY, '', {
      ...this.stylePreset,
      fontSize: this.stylePreset.fontSize,
      fontFamily: this.stylePreset.fontFamily,
    });

    // Set initial dimensions to zero
    this.drawingShape.width = 0;
    this.drawingShape.height = 0;

    context.requestRender();
  }

  onPointerMove(event: PointerEventData, context: ToolContext): void {
    if (!this.isActive || !this.isDrawing || !this.drawingShape) return;

    // Calculate width and height
    const width = event.canvasX - this.startX;
    const height = event.canvasY - this.startY;

    // Handle negative dragging (drag up/left)
    if (width < 0) {
      this.drawingShape.x = this.startX + width;
      this.drawingShape.width = Math.abs(width);
    } else {
      this.drawingShape.x = this.startX;
      this.drawingShape.width = width;
    }

    if (height < 0) {
      this.drawingShape.y = this.startY + height;
      this.drawingShape.height = Math.abs(height);
    } else {
      this.drawingShape.y = this.startY;
      this.drawingShape.height = height;
    }

    context.requestRender();
  }

  onPointerUp(_event: PointerEventData, context: ToolContext): void {
    if (!this.isActive || !this.isDrawing || !this.drawingShape) return;

    this.isDrawing = false;

    // Enforce minimum size (50x20 pixels for text box)
    const minWidth = 50;
    const minHeight = 20;

    if (this.drawingShape.width < minWidth) {
      this.drawingShape.width = minWidth;
    }
    if (this.drawingShape.height < minHeight) {
      this.drawingShape.height = minHeight;
    }

    // NOW start text editing on this shape
    this.editingShape = this.drawingShape;
    this.drawingShape = null;

    this.startTextareaEditing(context);
  }

  onKeyDown(event: KeyboardEventData, context: ToolContext): void {
    if (!this.isActive || !this.editingShape) return;

    // Escape key cancels editing
    if (event.key === 'Escape') {
      this.cancelEditing(context);
    }
  }

  /**
   * Start textarea editing after bounding box is drawn
   */
  private startTextareaEditing(context: ToolContext): void {
    console.log('[TextTool] startTextareaEditing called');
    if (!this.canvasElement || !this.editingShape) return;

    const viewport = context.getViewport();

    // Create textarea overlay
    this.textArea = document.createElement('textarea');
    this.textArea.style.position = 'absolute';
    this.textArea.style.fontFamily = this.stylePreset.fontFamily;
    this.textArea.style.fontSize = `${this.stylePreset.fontSize * viewport.zoom}px`;
    this.textArea.style.color = this.stylePreset.strokeColor || '#000000';
    this.textArea.style.border = '2px solid #0066ff';
    this.textArea.style.outline = 'none';
    this.textArea.style.padding = '4px';
    this.textArea.style.background = 'white';
    this.textArea.style.resize = 'none';
    this.textArea.style.overflow = 'auto'; // Allow scrolling if text exceeds box
    this.textArea.style.lineHeight = '1.2';
    this.textArea.style.zIndex = '1000';

    // Position textarea to match the drawn box
    const rect = this.canvasElement.getBoundingClientRect();

    this.textArea.style.left = `${rect.left + (this.editingShape.x - viewport.x) * viewport.zoom}px`;
    this.textArea.style.top = `${rect.top + (this.editingShape.y - viewport.y) * viewport.zoom}px`;
    this.textArea.style.width = `${this.editingShape.width * viewport.zoom}px`;
    this.textArea.style.height = `${this.editingShape.height * viewport.zoom}px`;

    // Add textarea to document
    document.body.appendChild(this.textArea);

    // Focus textarea
    this.textArea.focus();

    // Handle blur to finish editing (with slight delay to allow other events to process)
    const blurHandler = () => {
      // Use requestAnimationFrame instead of setTimeout for better timing
      requestAnimationFrame(() => {
        this.finishEditing(context);
      });
    };
    this.textArea.addEventListener('blur', blurHandler);

    // Also add a global click handler to finish editing when clicking outside
    const clickOutsideHandler = (e: MouseEvent) => {
      console.log('[TextTool] clickOutsideHandler fired', { target: e.target, hasTextArea: !!this.textArea });
      if (this.textArea && e.target !== this.textArea && !this.textArea.contains(e.target as Node)) {
        console.log('[TextTool] Click outside detected, calling finishEditing');
        this.finishEditing(context);
        document.removeEventListener('mousedown', clickOutsideHandler);
      }
    };
    // Add listener with a small delay to avoid immediate trigger
    setTimeout(() => {
      document.addEventListener('mousedown', clickOutsideHandler);
    }, 100);

    context.requestRender();
  }

  /**
   * Finish editing and commit text
   */
  private finishEditing(context: ToolContext | null): void {
    console.log('[TextTool] finishEditing called', { hasTextArea: !!this.textArea, hasEditingShape: !!this.editingShape, hasContext: !!context });
    if (!this.textArea || !this.editingShape) return;

    const text = this.textArea.value;
    console.log('[TextTool] Finishing with text:', text);

    // Update shape with text content
    this.editingShape.text = text;

    // Only add shape if context provided and text not empty
    if (text && context) {
      const shapeId = this.editingShape.id;
      context.addShape(this.editingShape);

      // Auto-select to show properties panel
      context.setSelectedIds(new Set([shapeId]));
    }

    // Always switch back to select tool after finishing (even if no text entered)
    if (context) {
      console.log('[TextTool] Switching to select tool');
      context.setActiveTool('select');
    } else {
      console.log('[TextTool] No context, cannot switch tool');
    }

    // Clean up textarea
    if (this.textArea.parentNode) {
      this.textArea.parentNode.removeChild(this.textArea);
    }

    this.textArea = null;
    this.editingShape = null;

    if (context) {
      context.requestRender();
    }
  }

  /**
   * Cancel editing without committing
   */
  private cancelEditing(_context: ToolContext): void {
    // Clean up textarea
    if (this.textArea && this.textArea.parentNode) {
      this.textArea.parentNode.removeChild(this.textArea);
    }

    this.textArea = null;
    this.editingShape = null;
  }

  renderOverlay(ctx: CanvasRenderingContext2D, _context: ToolContext): void {
    if (this.drawingShape) {
      // Draw preview box while dragging
      ctx.save();
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        this.drawingShape.x,
        this.drawingShape.y,
        this.drawingShape.width,
        this.drawingShape.height
      );
      ctx.restore();
    }
  }

  getCursor(): string {
    return 'text';
  }
}
