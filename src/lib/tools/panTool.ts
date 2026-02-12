/**
 * Pan tool - Click and drag to pan the viewport
 */

import { Tool, type ToolContext } from './toolBase';
import type { PointerEventData } from '../types';
import { canvasStore } from '$lib/state/canvasStore';

export class PanTool extends Tool {
  private isPanning = false;
  private startX = 0;
  private startY = 0;
  private startViewportX = 0;
  private startViewportY = 0;
  private currentZoom = 1;

  onPointerDown(event: PointerEventData, context: ToolContext): void {
    if (!this.isActive) return;

    this.isPanning = true;
    this.startX = event.x;
    this.startY = event.y;

    // Get current viewport state
    canvasStore.subscribe(state => {
      this.startViewportX = state.viewport.x;
      this.startViewportY = state.viewport.y;
      this.currentZoom = state.viewport.zoom;
    })();
  }

  onPointerMove(event: PointerEventData, context: ToolContext): void {
    if (!this.isActive || !this.isPanning) return;

    // Calculate delta in screen space
    const deltaX = event.x - this.startX;
    const deltaY = event.y - this.startY;

    // Convert to canvas space (accounting for zoom)
    const canvasDeltaX = deltaX / this.currentZoom;
    const canvasDeltaY = deltaY / this.currentZoom;

    // Update viewport position
    canvasStore.update(state => ({
      ...state,
      viewport: {
        ...state.viewport,
        x: this.startViewportX - canvasDeltaX,
        y: this.startViewportY - canvasDeltaY,
      }
    }));

    context.requestRender();
  }

  onPointerUp(_event: PointerEventData, _context: ToolContext): void {
    if (!this.isActive) return;
    this.isPanning = false;
  }

  getCursor(): string {
    return this.isPanning ? 'grabbing' : 'grab';
  }
}
