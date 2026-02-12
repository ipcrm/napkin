/**
 * Arrow tool - Click and drag to create arrows
 */

import { Tool, type ToolContext } from './toolBase';
import type { PointerEventData, KeyboardEventData, ArrowShape } from '../types';
import { createArrow } from '../shapes/arrow';
import {
  findBindableShapesNearPoint,
  findNearestConnectionPoint,
  getShapeConnectionPoints,
  type ConnectionPointInfo
} from '../utils/binding';
import { calculateAngleSnap, renderAngleSnapGuide, type AngleSnapResult } from '../utils/angleSnap';

interface Point {
  x: number;
  y: number;
}

export class ArrowTool extends Tool {
  private startX = 0;
  private startY = 0;
  private isDrawing = false;
  private currentShape: ArrowShape | null = null;
  private stylePreset = {
    strokeColor: '#000000',
    strokeWidth: 2,
    fillColor: 'transparent',
    opacity: 1,
    roughness: 1,
  };
  private hoverConnectionPoints: ConnectionPointInfo[] = [];
  private nearestStartPoint: ConnectionPointInfo | null = null;
  private nearestEndPoint: ConnectionPointInfo | null = null;
  private currentCursorPos: Point = { x: 0, y: 0 };
  private angleSnap: AngleSnapResult = { x: 0, y: 0, snapped: false, snapAxis: null };

  setStylePreset(style: {
    strokeColor: string;
    strokeWidth: number;
    fillColor: string;
    opacity: number;
    roughness?: number;
  }): void {
    this.stylePreset = { ...style, roughness: style.roughness ?? 1 };
  }

  private getConnectionPointRadius(point: Point, cursorPos: Point): number {
    const distance = Math.sqrt(
      Math.pow(point.x - cursorPos.x, 2) +
      Math.pow(point.y - cursorPos.y, 2)
    );

    const maxDistance = 40; // Start highlighting at 40px away
    const minRadius = 6;
    const maxRadius = 12;

    if (distance > maxDistance) return minRadius;

    // Scale from minRadius to maxRadius as distance decreases
    const scale = 1 - (distance / maxDistance);
    return minRadius + (maxRadius - minRadius) * scale;
  }

  onPointerDown(event: PointerEventData, context: ToolContext): void {
    if (!this.isActive) return;

    this.isDrawing = true;
    this.startX = event.canvasX;
    this.startY = event.canvasY;

    // Create initial arrow (zero length)
    this.currentShape = createArrow(
      this.startX,
      this.startY,
      this.startX,
      this.startY,
      this.stylePreset
    );

    context.requestRender();
  }

  onPointerMove(event: PointerEventData, context: ToolContext): void {
    if (!this.isActive) return;

    // Update cursor position for proximity calculations
    this.currentCursorPos = { x: event.canvasX, y: event.canvasY };

    if (this.isDrawing && this.currentShape) {
      // Apply angle snapping
      const snap = calculateAngleSnap(
        this.currentShape.x, this.currentShape.y,
        event.canvasX, event.canvasY
      );
      this.angleSnap = snap;

      // Update end point (use snapped coordinates)
      this.currentShape.x2 = snap.x;
      this.currentShape.y2 = snap.y;

      // Check for nearby shapes at end point
      const nearbyShapes = findBindableShapesNearPoint(
        { x: snap.x, y: snap.y },
        context.shapes,
        [],
        40
      );

      if (nearbyShapes.length > 0) {
        this.nearestEndPoint = findNearestConnectionPoint(
          { x: snap.x, y: snap.y },
          nearbyShapes[0],
          40
        );
      } else {
        this.nearestEndPoint = null;
      }

      context.requestRender();
    } else {
      // Show connection points when hovering near shapes (not drawing)
      const nearbyShapes = findBindableShapesNearPoint(
        { x: event.canvasX, y: event.canvasY },
        context.shapes,
        [],
        40
      );

      this.hoverConnectionPoints = [];
      if (nearbyShapes.length > 0) {
        this.hoverConnectionPoints = getShapeConnectionPoints(nearbyShapes[0]);
        context.requestRender();
      } else if (this.hoverConnectionPoints.length > 0) {
        this.hoverConnectionPoints = [];
        context.requestRender();
      }
    }
  }

  onPointerUp(_event: PointerEventData, context: ToolContext): void {
    if (!this.isActive || !this.isDrawing || !this.currentShape) return;

    this.isDrawing = false;

    // Calculate arrow length
    const dx = this.currentShape.x2 - this.currentShape.x;
    const dy = this.currentShape.y2 - this.currentShape.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    // Only add arrow if it has some length
    if (length > 1) {
      // Check for bindings at start point
      const startNearbyShapes = findBindableShapesNearPoint(
        { x: this.currentShape.x, y: this.currentShape.y },
        context.shapes,
        [],
        40
      );

      if (startNearbyShapes.length > 0) {
        const startConnection = findNearestConnectionPoint(
          { x: this.currentShape.x, y: this.currentShape.y },
          startNearbyShapes[0],
          40
        );

        if (startConnection) {
          this.currentShape.bindStart = {
            shapeId: startNearbyShapes[0].id,
            point: startConnection.location
          };
          this.currentShape.x = startConnection.point.x;
          this.currentShape.y = startConnection.point.y;
        }
      }

      // Check for bindings at end point
      const endNearbyShapes = findBindableShapesNearPoint(
        { x: this.currentShape.x2, y: this.currentShape.y2 },
        context.shapes,
        [],
        40
      );

      if (endNearbyShapes.length > 0) {
        const endConnection = findNearestConnectionPoint(
          { x: this.currentShape.x2, y: this.currentShape.y2 },
          endNearbyShapes[0],
          40
        );

        if (endConnection) {
          this.currentShape.bindEnd = {
            shapeId: endNearbyShapes[0].id,
            point: endConnection.location
          };
          this.currentShape.x2 = endConnection.point.x;
          this.currentShape.y2 = endConnection.point.y;
        }
      }

      const shapeId = this.currentShape.id;
      context.addShape(this.currentShape);

      // Auto-select the newly created shape to show properties panel
      context.setSelectedIds(new Set([shapeId]));

      // Switch back to select tool
      context.setActiveTool('select');
    }

    this.currentShape = null;
    this.nearestStartPoint = null;
    this.nearestEndPoint = null;
    this.angleSnap = { x: 0, y: 0, snapped: false, snapAxis: null };
    this.hoverConnectionPoints = [];
    context.requestRender();
  }

  onKeyDown(event: KeyboardEventData, context: ToolContext): void {
    // Escape cancels in-progress arrow drawing
    if (event.key === 'Escape' && this.isDrawing) {
      this.isDrawing = false;
      this.currentShape = null;
      this.nearestStartPoint = null;
      this.nearestEndPoint = null;
      this.angleSnap = { x: 0, y: 0, snapped: false, snapAxis: null };
      this.hoverConnectionPoints = [];
      context.requestRender();
    }
  }

  renderOverlay(ctx: CanvasRenderingContext2D, _context: ToolContext): void {
    ctx.save();

    // Draw connection points when hovering near shapes (not drawing)
    if (!this.isDrawing && this.hoverConnectionPoints.length > 0) {
      for (const cp of this.hoverConnectionPoints) {
        const radius = this.getConnectionPointRadius(cp.point, this.currentCursorPos);

        // Add glow for nearby points
        if (radius > 6) {
          const gradient = ctx.createRadialGradient(
            cp.point.x, cp.point.y, 0,
            cp.point.x, cp.point.y, radius * 1.5
          );
          gradient.addColorStop(0, 'rgba(33, 150, 243, 0.6)');
          gradient.addColorStop(1, 'rgba(33, 150, 243, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(cp.point.x, cp.point.y, radius * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Main dot
        ctx.beginPath();
        ctx.arc(cp.point.x, cp.point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#2196f3'; // Blue for available points
        ctx.fill();
        ctx.strokeStyle = '#1565c0'; // Darker blue border
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    if (this.currentShape) {
      // Render preview of current arrow
      ctx.globalAlpha = this.currentShape.opacity;

      if (this.currentShape.strokeColor && this.currentShape.strokeWidth > 0) {
        ctx.strokeStyle = this.currentShape.strokeColor;
        ctx.lineWidth = this.currentShape.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw line
        ctx.beginPath();
        ctx.moveTo(this.currentShape.x, this.currentShape.y);
        ctx.lineTo(this.currentShape.x2, this.currentShape.y2);
        ctx.stroke();

        // Draw arrowhead preview
        const dx = this.currentShape.x2 - this.currentShape.x;
        const dy = this.currentShape.y2 - this.currentShape.y;
        const angle = Math.atan2(dy, dx);
        const arrowheadSize = this.currentShape.strokeWidth * 4;
        const arrowAngle = Math.PI / 6;

        const point1X = this.currentShape.x2 - arrowheadSize * Math.cos(angle - arrowAngle);
        const point1Y = this.currentShape.y2 - arrowheadSize * Math.sin(angle - arrowAngle);
        const point2X = this.currentShape.x2 - arrowheadSize * Math.cos(angle + arrowAngle);
        const point2Y = this.currentShape.y2 - arrowheadSize * Math.sin(angle + arrowAngle);

        ctx.fillStyle = this.currentShape.strokeColor;
        ctx.beginPath();
        ctx.moveTo(this.currentShape.x2, this.currentShape.y2);
        ctx.lineTo(point1X, point1Y);
        ctx.lineTo(point2X, point2Y);
        ctx.closePath();
        ctx.fill();
      }

      // Render angle snap guide line
      if (this.angleSnap.snapped) {
        renderAngleSnapGuide(ctx, this.currentShape.x, this.currentShape.y, this.angleSnap);
      }

      // Highlight nearest connection point at end
      if (this.nearestEndPoint) {
        // Draw guide line from cursor to connection point
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.currentShape.x2, this.currentShape.y2);
        ctx.lineTo(this.nearestEndPoint.point.x, this.nearestEndPoint.point.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Add glow for nearest point
        const gradient = ctx.createRadialGradient(
          this.nearestEndPoint.point.x, this.nearestEndPoint.point.y, 0,
          this.nearestEndPoint.point.x, this.nearestEndPoint.point.y, 12 * 1.5
        );
        gradient.addColorStop(0, 'rgba(76, 175, 80, 0.8)');
        gradient.addColorStop(1, 'rgba(76, 175, 80, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.nearestEndPoint.point.x, this.nearestEndPoint.point.y, 12 * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Draw larger green dot for nearest point
        ctx.beginPath();
        ctx.arc(this.nearestEndPoint.point.x, this.nearestEndPoint.point.y, 12, 0, 2 * Math.PI);
        ctx.fillStyle = '#4caf50'; // Green for nearest/snap point
        ctx.fill();
        ctx.strokeStyle = '#2e7d32'; // Dark green border
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  getCursor(): string {
    return 'crosshair';
  }
}
