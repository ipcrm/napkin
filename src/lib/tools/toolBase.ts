/**
 * Base Tool class/interface for the plugin architecture
 * All tools implement these event handlers
 */

import type { PointerEventData, KeyboardEventData, Shape } from '../types';

export interface ToolContext {
  shapes: Shape[];
  selectedIds: Set<string>;
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  setSelectedIds: (ids: Set<string>) => void;
  setActiveTool: (tool: string) => void;
  requestRender: () => void;
  getViewport: () => { x: number; y: number; zoom: number };
}

export abstract class Tool {
  protected isActive = false;

  /**
   * Called when tool is activated
   */
  onActivate(): void {
    this.isActive = true;
  }

  /**
   * Called when tool is deactivated
   */
  onDeactivate(): void {
    this.isActive = false;
  }

  /**
   * Handle pointer down event
   */
  abstract onPointerDown(event: PointerEventData, context: ToolContext): void;

  /**
   * Handle pointer move event
   */
  abstract onPointerMove(event: PointerEventData, context: ToolContext): void;

  /**
   * Handle pointer up event
   */
  abstract onPointerUp(event: PointerEventData, context: ToolContext): void;

  /**
   * Handle key down event
   */
  onKeyDown(_event: KeyboardEventData, _context: ToolContext): void {
    // Default implementation - tools can override
  }

  /**
   * Handle key up event
   */
  onKeyUp(_event: KeyboardEventData, _context: ToolContext): void {
    // Default implementation - tools can override
  }

  /**
   * Render overlay (e.g., selection box, preview shapes)
   * Called after main rendering
   */
  renderOverlay(_ctx: CanvasRenderingContext2D, _context: ToolContext): void {
    // Default implementation - tools can override
  }

  /**
   * Get cursor style for this tool
   */
  getCursor(): string {
    return 'default';
  }
}
