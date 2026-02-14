/**
 * Select tool - Click to select shapes, drag to move them
 * Enhanced with resize handles, rotation handle, alt-drag duplication, and locked shape support
 */

import { Tool, type ToolContext } from './toolBase';
import type { PointerEventData, Shape, KeyboardEventData, ArrowShape, LineShape } from '../types';
import { findShapeAtPoint } from '../canvas/hitDetection';
import {
  getBoundArrows,
  updateArrowForBinding,
  findBindableShapesNearPoint,
  findNearestConnectionPoint,
  getShapeConnectionPoints,
  type ConnectionPointInfo,
  type Point
} from '../utils/binding';
import { createArrow } from '../shapes/arrow';
import { calculateAngleSnap, renderAngleSnapGuide, type AngleSnapResult } from '../utils/angleSnap';
import { getDefaultControlPoints } from '../utils/routing';
import { generateShapeId } from '../state/canvasStore';
import { historyManager, DeleteShapesCommand, BatchCommand, AddShapeCommand, GroupShapesCommand, UngroupShapesCommand, SnapshotModifyCommand } from '../state/history';

type HandleType =
  | 'nw' | 'n' | 'ne'
  | 'e' | 'se' | 's'
  | 'sw' | 'w'
  | 'rotate'
  | null;

interface HandleInfo {
  type: HandleType;
  x: number;
  y: number;
  cursor: string;
}

export class SelectTool extends Tool {
  private isDragging = false;
  private isBoxSelecting = false;
  private isResizing = false;
  private isRotating = false;
  private isDuplicating = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private boxSelectStartX = 0;
  private boxSelectStartY = 0;
  private boxSelectEndX = 0;
  private boxSelectEndY = 0;
  private selectedShapeStartPositions = new Map<
    string,
    { x: number; y: number; x2?: number; y2?: number; width?: number; height?: number; rotation?: number; points?: any[]; controlPoints?: { x: number; y: number }[] }
  >();
  private currentHandle: HandleType = null;
  private resizeStartBounds: { x: number; y: number; width: number; height: number } | null = null;
  private rotationStartAngle = 0;
  private rotationCenter = { x: 0, y: 0 };
  private duplicatedShapeIds = new Set<string>();
  private lastClickTime = 0;
  private lastClickedShapeId: string | null = null;
  private onTextEditStart: ((shapeId: string) => void) | null = null;

  // Control point dragging state
  private isDraggingControlPoint = false;
  private controlPointShapeId: string | null = null;
  private controlPointIndex: number = 0;
  private controlPointStartPos: Point = { x: 0, y: 0 };

  // Endpoint dragging state (for dragging released binding endpoints)
  private isDraggingEndpoint = false;
  private endpointDragShapeId: string | null = null;
  private endpointDragWhich: 'start' | 'end' | null = null;

  // Start snapshots for history coalescing (shape id → full shape snapshot before drag)
  private dragStartSnapshots = new Map<string, Shape>();

  // Connection point drawing state
  private hoverConnectionPoints: ConnectionPointInfo[] = [];
  private hoverShapeId: string | null = null;
  private currentCursorPos: Point = { x: 0, y: 0 };
  private isConnecting = false;
  private connectStartPoint: ConnectionPointInfo | null = null;
  private connectStartShapeId: string | null = null;
  private connectEndPoint: ConnectionPointInfo | null = null;
  private connectCurrentArrow: ArrowShape | null = null;
  private connectAngleSnap: AngleSnapResult = { x: 0, y: 0, snapped: false, snapAxis: null };
  private connectStylePreset = {
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
    this.connectStylePreset = { ...style, roughness: style.roughness ?? 1 };
  }

  onPointerDown(event: PointerEventData, context: ToolContext): void {
    if (!this.isActive) return;

    // If currently connecting (second click to complete arrow)
    if (this.isConnecting && this.connectCurrentArrow) {
      this.finishConnection(event, context);
      return;
    }

    // Check if Alt+clicking on an endpoint of a selected fully-bound line/arrow to release binding.
    // Requires Alt key to prevent accidental unbinding when adjusting lines.
    if (event.altKey && context.selectedIds.size === 1) {
      const selectedId = Array.from(context.selectedIds)[0];
      const selectedShape = context.shapes.find(s => s.id === selectedId);
      if (selectedShape && this.isFullyBound(selectedShape)) {
        const lineOrArrow = selectedShape as LineShape | ArrowShape;
        const endpoint = this.getEndpointAtPoint(event.canvasX, event.canvasY, lineOrArrow);
        if (endpoint) {
          // Release the binding on the clicked endpoint
          if (endpoint === 'start') {
            context.updateShape(selectedShape.id, { bindStart: undefined } as Partial<Shape>);
          } else {
            context.updateShape(selectedShape.id, { bindEnd: undefined } as Partial<Shape>);
          }

          // Immediately start an endpoint drag so the user can reposition it
          this.isDraggingEndpoint = true;
          this.endpointDragShapeId = selectedShape.id;
          this.endpointDragWhich = endpoint;
          this.dragStartX = event.canvasX;
          this.dragStartY = event.canvasY;
          // Capture start snapshot for history commit on pointer-up
          this.storeStartSnapshots(context, [selectedShape.id]);

          // Clear connection point hover so it doesn't interfere
          this.hoverConnectionPoints = [];
          this.hoverShapeId = null;

          context.requestRender();
          return;
        }
      }
    }

    // Check for endpoint drag on any selected line/arrow (bound or unbound)
    // so users can drag endpoints to reorient/reposition the line
    if (context.selectedIds.size === 1) {
      const selectedId = Array.from(context.selectedIds)[0];
      const selectedShape = context.shapes.find(s => s.id === selectedId);
      if (selectedShape && (selectedShape.type === 'line' || selectedShape.type === 'arrow')) {
        const lineOrArrow = selectedShape as LineShape | ArrowShape;
        const hasStart = !!lineOrArrow.bindStart;
        const hasEnd = !!lineOrArrow.bindEnd;
        const endpoint = this.getEndpointAtPoint(event.canvasX, event.canvasY, lineOrArrow);
        if (endpoint) {
          // For partially-bound lines, only allow dragging the unbound endpoint
          if ((hasStart || hasEnd) && !(hasStart && hasEnd)) {
            if ((endpoint === 'start' && !hasStart) || (endpoint === 'end' && !hasEnd)) {
              this.isDraggingEndpoint = true;
              this.endpointDragShapeId = selectedShape.id;
              this.endpointDragWhich = endpoint;
              this.dragStartX = event.canvasX;
              this.dragStartY = event.canvasY;
              this.storeStartSnapshots(context, [selectedShape.id]);
              this.hoverConnectionPoints = [];
              this.hoverShapeId = null;
              context.requestRender();
              return;
            }
          } else if (!hasStart && !hasEnd) {
            // Fully unbound - allow dragging either endpoint freely
            this.isDraggingEndpoint = true;
            this.endpointDragShapeId = selectedShape.id;
            this.endpointDragWhich = endpoint;
            this.dragStartX = event.canvasX;
            this.dragStartY = event.canvasY;
            this.storeStartSnapshots(context, [selectedShape.id]);
            this.hoverConnectionPoints = [];
            this.hoverShapeId = null;
            context.requestRender();
            return;
          }
        }
      }
    }

    // Check if clicking on a resize/rotate handle (before connection points,
    // so resize handles on selected shapes take priority over starting arrows)
    const handle = this.getHandleAtPoint(event.canvasX, event.canvasY, context);

    if (handle) {
      // Start resize or rotation
      if (handle === 'rotate') {
        this.startRotation(event, context);
      } else {
        this.startResize(event, context, handle);
      }
      return;
    }

    // Check if clicking on a connection point (to start drawing an arrow)
    if (this.hoverConnectionPoints.length > 0 && this.hoverShapeId) {
      const clickPoint = { x: event.canvasX, y: event.canvasY };
      const hoverShape = context.shapes.find(s => s.id === this.hoverShapeId);
      if (hoverShape) {
        const nearest = findNearestConnectionPoint(clickPoint, hoverShape, 20);
        if (nearest) {
          this.startConnection(nearest, this.hoverShapeId, context);
          return;
        }
      }
    }

    // Check if clicking on a control point of a selected line/arrow
    const cpHit = this.getControlPointAtPosition(event.canvasX, event.canvasY, context);
    if (cpHit) {
      this.isDraggingControlPoint = true;
      this.controlPointShapeId = cpHit.shapeId;
      this.controlPointIndex = cpHit.index;
      this.controlPointStartPos = { x: cpHit.x, y: cpHit.y };
      this.dragStartX = event.canvasX;
      this.dragStartY = event.canvasY;
      // Capture start snapshot for history commit on pointer-up
      this.storeStartSnapshots(context, [cpHit.shapeId]);
      return;
    }

    const clickedShape = findShapeAtPoint(
      context.shapes,
      event.canvasX,
      event.canvasY
    );

    // Allow selecting locked shapes (so user can right-click to unlock),
    // but skip drag/resize/edit operations
    if (clickedShape && clickedShape.locked) {
      if (!event.shiftKey) {
        context.setSelectedIds(new Set([clickedShape.id]));
      } else {
        const newSelected = new Set(context.selectedIds);
        if (newSelected.has(clickedShape.id)) {
          newSelected.delete(clickedShape.id);
        } else {
          newSelected.add(clickedShape.id);
        }
        context.setSelectedIds(newSelected);
      }
      context.requestRender();
      return;
    }

    // Check for double-click on shape
    const now = Date.now();
    if (clickedShape && clickedShape.id === this.lastClickedShapeId && now - this.lastClickTime < 300) {
      // Double-click detected! Start text editing
      if (this.onTextEditStart && clickedShape.type !== 'text' && clickedShape.type !== 'freedraw') {
        this.onTextEditStart(clickedShape.id);
      }
      this.lastClickTime = 0;
      this.lastClickedShapeId = null;
      return;
    }

    // Update click tracking
    this.lastClickTime = now;
    this.lastClickedShapeId = clickedShape?.id || null;

    if (clickedShape) {
      // Get all shapes that should be selected (including group members)
      const shapesToSelect = this.getShapesWithGroup(clickedShape, context);

      // Check if we should add to selection (shift key)
      if (event.shiftKey) {
        const newSelection = new Set(context.selectedIds);
        // Toggle selection for all shapes in the group
        const allSelected = shapesToSelect.every(id => newSelection.has(id));
        if (allSelected) {
          // Remove all from selection
          shapesToSelect.forEach(id => newSelection.delete(id));
        } else {
          // Add all to selection
          shapesToSelect.forEach(id => newSelection.add(id));
        }
        context.setSelectedIds(newSelection);
      } else {
        // Single selection (or start drag if already selected)
        if (!context.selectedIds.has(clickedShape.id)) {
          context.setSelectedIds(new Set(shapesToSelect));
        }
      }

      // Check for Alt key - duplication mode
      if (event.altKey) {
        this.startDuplication(event, context);
      } else {
        // Prepare for dragging
        this.isDragging = true;
        this.dragStartX = event.canvasX;
        this.dragStartY = event.canvasY;

        // Store initial positions of all selected shapes
        this.storeSelectedShapePositions(context);

        // Capture start snapshots for history coalescing (selected shapes + their bound arrows)
        const selectedIds = Array.from(context.selectedIds);
        this.storeStartSnapshots(context, selectedIds);
        for (const id of selectedIds) {
          const boundArrows = getBoundArrows(id, context.shapes);
          this.storeStartSnapshots(context, boundArrows.map(a => a.id));
        }
      }
    } else {
      // Clicked on empty space - start box selection
      this.isBoxSelecting = true;
      this.boxSelectStartX = event.canvasX;
      this.boxSelectStartY = event.canvasY;
      this.boxSelectEndX = event.canvasX;
      this.boxSelectEndY = event.canvasY;

      // Clear selection if shift is not held
      if (!event.shiftKey) {
        context.setSelectedIds(new Set());
      }
    }

    context.requestRender();
  }

  onPointerMove(event: PointerEventData, context: ToolContext): void {
    if (!this.isActive) return;

    this.currentCursorPos = { x: event.canvasX, y: event.canvasY };

    // If connecting, update arrow end point and check for end binding
    if (this.isConnecting && this.connectCurrentArrow) {
      // Apply angle snapping
      const snap = calculateAngleSnap(
        this.connectCurrentArrow.x, this.connectCurrentArrow.y,
        event.canvasX, event.canvasY
      );
      this.connectAngleSnap = snap;

      this.connectCurrentArrow.x2 = snap.x;
      this.connectCurrentArrow.y2 = snap.y;

      // Check for nearby shapes at end point (exclude start shape)
      const nearbyShapes = findBindableShapesNearPoint(
        { x: snap.x, y: snap.y },
        context.shapes,
        [this.connectStartShapeId || ''],
        40
      );

      if (nearbyShapes.length > 0) {
        this.connectEndPoint = findNearestConnectionPoint(
          { x: snap.x, y: snap.y },
          nearbyShapes[0],
          40
        );
        // Also show all connection points of the target shape
        this.hoverConnectionPoints = getShapeConnectionPoints(nearbyShapes[0]);
        this.hoverShapeId = nearbyShapes[0].id;
      } else {
        this.connectEndPoint = null;
        this.hoverConnectionPoints = [];
        this.hoverShapeId = null;
      }

      context.requestRender();
      return;
    }

    // If dragging a control point, update it
    if (this.isDraggingControlPoint && this.controlPointShapeId) {
      const deltaX = event.canvasX - this.dragStartX;
      const deltaY = event.canvasY - this.dragStartY;
      const newX = this.controlPointStartPos.x + deltaX;
      const newY = this.controlPointStartPos.y + deltaY;

      const shape = context.shapes.find(s => s.id === this.controlPointShapeId);
      if (shape && (shape.type === 'line' || shape.type === 'arrow')) {
        const currentCPs = (shape as LineShape | ArrowShape).controlPoints || [];
        const newCPs = [...currentCPs];
        newCPs[this.controlPointIndex] = { x: newX, y: newY };
        context.updateShapeDirect(shape.id, { controlPoints: newCPs } as Partial<Shape>);
      }

      context.requestRender();
      return;
    }

    // If dragging a released endpoint, update its position and check for nearby connection points
    if (this.isDraggingEndpoint && this.endpointDragShapeId && this.endpointDragWhich) {
      const shape = context.shapes.find(s => s.id === this.endpointDragShapeId);
      if (shape && (shape.type === 'line' || shape.type === 'arrow')) {
        const lineShape = shape as LineShape | ArrowShape;
        const updates: any = {};

        if (this.endpointDragWhich === 'start') {
          updates.x = event.canvasX;
          updates.y = event.canvasY;
        } else {
          updates.x2 = event.canvasX;
          updates.y2 = event.canvasY;
        }

        // Recalculate control points for non-direct routing modes so the
        // routed path (and hit detection) follows the new endpoint positions.
        const routingMode = lineShape.routingMode || 'direct';
        if (routingMode !== 'direct') {
          const newX = updates.x ?? lineShape.x;
          const newY = updates.y ?? lineShape.y;
          const newX2 = updates.x2 ?? lineShape.x2;
          const newY2 = updates.y2 ?? lineShape.y2;
          updates.controlPoints = getDefaultControlPoints(newX, newY, newX2, newY2, routingMode);
        }

        context.updateShapeDirect(shape.id, updates as Partial<Shape>);

        // Check for nearby bindable shapes to show connection points
        const nearbyShapes = findBindableShapesNearPoint(
          { x: event.canvasX, y: event.canvasY },
          context.shapes,
          [this.endpointDragShapeId],
          40
        );

        if (nearbyShapes.length > 0) {
          this.hoverConnectionPoints = getShapeConnectionPoints(nearbyShapes[0]);
          this.hoverShapeId = nearbyShapes[0].id;
        } else {
          this.hoverConnectionPoints = [];
          this.hoverShapeId = null;
        }
      }

      context.requestRender();
      return;
    }

    if (this.isBoxSelecting) {
      // Update box selection area
      this.boxSelectEndX = event.canvasX;
      this.boxSelectEndY = event.canvasY;
      context.requestRender();
      return;
    }

    if (this.isResizing) {
      this.performResize(event, context);
      context.requestRender();
      return;
    }

    if (this.isRotating) {
      this.performRotation(event, context);
      context.requestRender();
      return;
    }

    if (!this.isDragging) {
      // When not dragging, show connection points on hover near shapes
      const nearbyShapes = findBindableShapesNearPoint(
        { x: event.canvasX, y: event.canvasY },
        context.shapes,
        [],
        40
      );

      const prevHoverCount = this.hoverConnectionPoints.length;
      if (nearbyShapes.length > 0) {
        this.hoverConnectionPoints = getShapeConnectionPoints(nearbyShapes[0]);
        this.hoverShapeId = nearbyShapes[0].id;
        context.requestRender();
      } else if (prevHoverCount > 0) {
        this.hoverConnectionPoints = [];
        this.hoverShapeId = null;
        context.requestRender();
      }
      return;
    }

    // Calculate drag offset
    const deltaX = event.canvasX - this.dragStartX;
    const deltaY = event.canvasY - this.dragStartY;

    // Update positions of all selected shapes (or duplicates if duplicating)
    const shapesToUpdate = this.isDuplicating ? this.duplicatedShapeIds : context.selectedIds;

    // Keep track of shapes that were moved (to update bound arrows)
    const movedShapeIds = new Set<string>();

    for (const shape of context.shapes) {
      if (shapesToUpdate.has(shape.id)) {
        // Skip locked shapes
        if (shape.locked && !this.isDuplicating) continue;

        // Skip fully-bound lines/arrows - they cannot be freely dragged
        if (this.isFullyBound(shape) && !this.isDuplicating) continue;

        const startPos = this.selectedShapeStartPositions.get(shape.id);
        if (startPos) {
          if (shape.type === 'line' || shape.type === 'arrow') {
            // Update both endpoints and control points for lines/arrows
            const updates: any = {
              x: startPos.x + deltaX,
              y: startPos.y + deltaY,
              x2: (startPos.x2 ?? 0) + deltaX,
              y2: (startPos.y2 ?? 0) + deltaY,
            };
            if (startPos.controlPoints && startPos.controlPoints.length > 0) {
              updates.controlPoints = startPos.controlPoints.map(cp => ({
                x: cp.x + deltaX,
                y: cp.y + deltaY,
              }));
            }
            context.updateShapeDirect(shape.id, updates as Partial<Shape>);
          } else if (shape.type === 'freedraw') {
            // Update all points for freedraw
            const originalPoints = (startPos as any).points || [];
            const newPoints = originalPoints.map((p: { x: number; y: number }) => ({
              x: p.x + deltaX,
              y: p.y + deltaY,
            }));
            context.updateShapeDirect(shape.id, {
              x: startPos.x + deltaX,
              y: startPos.y + deltaY,
              points: newPoints,
            } as Partial<Shape>);
          } else {
            // Update position for other shapes
            context.updateShapeDirect(shape.id, {
              x: startPos.x + deltaX,
              y: startPos.y + deltaY,
            } as Partial<Shape>);
          }

          // Track that this shape was moved (for bound arrow updates)
          movedShapeIds.add(shape.id);
        }
      }
    }

    // Update arrows that are bound to moved shapes
    if (!this.isDuplicating) { // Don't update bindings during duplication
      for (const movedShapeId of movedShapeIds) {
        const boundArrows = getBoundArrows(movedShapeId, context.shapes);
        for (const arrow of boundArrows) {
          const updates = updateArrowForBinding(arrow, context.shapes);
          if (Object.keys(updates).length > 0) {
            context.updateShapeDirect(arrow.id, updates as Partial<Shape>);
          }
        }
      }
    }

    context.requestRender();
  }

  onPointerUp(event: PointerEventData, context: ToolContext): void {
    if (!this.isActive) return;

    if (this.isBoxSelecting) {
      // Finalize box selection
      const boxX = Math.min(this.boxSelectStartX, this.boxSelectEndX);
      const boxY = Math.min(this.boxSelectStartY, this.boxSelectEndY);
      const boxWidth = Math.abs(this.boxSelectEndX - this.boxSelectStartX);
      const boxHeight = Math.abs(this.boxSelectEndY - this.boxSelectStartY);

      // Find shapes that intersect with the selection box
      const selectedIds = event.shiftKey ? new Set(context.selectedIds) : new Set<string>();

      for (const shape of context.shapes) {
        // Skip locked shapes during box selection
        if (shape.locked) continue;

        const bounds = this.getShapeBounds(shape);
        if (this.boxIntersects(boxX, boxY, boxWidth, boxHeight, bounds)) {
          selectedIds.add(shape.id);
        }
      }

      context.setSelectedIds(selectedIds);
      this.isBoxSelecting = false;
      context.requestRender();
    }

    // Handle endpoint drag completion - check for binding at drop location
    if (this.isDraggingEndpoint && this.endpointDragShapeId && this.endpointDragWhich) {
      const shape = context.shapes.find(s => s.id === this.endpointDragShapeId);
      if (shape && (shape.type === 'line' || shape.type === 'arrow')) {
        // Check for nearby bindable shapes at the drop point
        const nearbyShapes = findBindableShapesNearPoint(
          { x: event.canvasX, y: event.canvasY },
          context.shapes,
          [this.endpointDragShapeId],
          40
        );

        if (nearbyShapes.length > 0) {
          const connectionPoint = findNearestConnectionPoint(
            { x: event.canvasX, y: event.canvasY },
            nearbyShapes[0],
            40
          );

          if (connectionPoint) {
            // Bind to the connection point and snap the endpoint position
            const bindingUpdate: any = {};
            if (this.endpointDragWhich === 'start') {
              bindingUpdate.bindStart = {
                shapeId: nearbyShapes[0].id,
                point: connectionPoint.location
              };
              bindingUpdate.x = connectionPoint.point.x;
              bindingUpdate.y = connectionPoint.point.y;
            } else {
              bindingUpdate.bindEnd = {
                shapeId: nearbyShapes[0].id,
                point: connectionPoint.location
              };
              bindingUpdate.x2 = connectionPoint.point.x;
              bindingUpdate.y2 = connectionPoint.point.y;
            }
            context.updateShapeDirect(shape.id, bindingUpdate as Partial<Shape>);
          }
        }
      }

      // Clear hover state
      this.hoverConnectionPoints = [];
      this.hoverShapeId = null;
    }

    if (this.isDuplicating) {
      // Select the duplicated shapes
      context.setSelectedIds(new Set(this.duplicatedShapeIds));
      this.duplicatedShapeIds.clear();
    }

    // Commit all continuous operation changes as a single undo entry
    const wasContinuous = this.isDragging || this.isResizing || this.isRotating
      || this.isDraggingControlPoint || this.isDraggingEndpoint;
    if (wasContinuous) {
      this.commitDragToHistory(context);
    }

    this.isDragging = false;
    this.isResizing = false;
    this.isRotating = false;
    this.isDuplicating = false;
    this.isDraggingControlPoint = false;
    this.controlPointShapeId = null;
    this.isDraggingEndpoint = false;
    this.endpointDragShapeId = null;
    this.endpointDragWhich = null;
    this.currentHandle = null;
    this.resizeStartBounds = null;
    this.selectedShapeStartPositions.clear();
  }

  onKeyDown(event: KeyboardEventData, context: ToolContext): void {
    // Escape - cancel connection
    if (event.key === 'Escape' && this.isConnecting) {
      this.cancelConnection(context);
      return;
    }

    // Ctrl+D or Cmd+D - Duplicate selected shapes
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

    // Ctrl+G or Cmd+G - Group selected shapes
    if (cmdOrCtrl && event.key === 'g' && !event.shiftKey && context.selectedIds.size >= 2) {
      this.groupSelectedShapes(context);
      return;
    }

    // Ctrl+Shift+G or Cmd+Shift+G - Ungroup selected shapes
    if (cmdOrCtrl && event.key === 'g' && event.shiftKey && context.selectedIds.size > 0) {
      this.ungroupSelectedShapes(context);
      return;
    }

    if (cmdOrCtrl && event.key === 'd' && context.selectedIds.size > 0) {
      this.duplicateSelectedShapes(context);
      return;
    }

    // Delete selected shapes (but not locked ones)
    if (
      (event.key === 'Delete' || event.key === 'Backspace') &&
      context.selectedIds.size > 0
    ) {
      const idsToDelete = Array.from(context.selectedIds).filter(id => {
        const shape = context.shapes.find(s => s.id === id);
        return shape && !shape.locked;
      });

      if (idsToDelete.length === 0) return;

      // Clean up bindings for arrows bound to shapes being deleted
      for (const id of idsToDelete) {
        const boundArrows = getBoundArrows(id, context.shapes);
        for (const arrow of boundArrows) {
          const updates: any = {};
          if (arrow.bindStart?.shapeId === id) {
            updates.bindStart = undefined;
          }
          if (arrow.bindEnd?.shapeId === id) {
            updates.bindEnd = undefined;
          }
          if (Object.keys(updates).length > 0) {
            context.updateShape(arrow.id, updates);
          }
        }
      }

      // Use DeleteShapesCommand for batch deletion if multiple shapes
      if (idsToDelete.length > 1) {
        try {
          historyManager.execute(new DeleteShapesCommand(idsToDelete));
          context.setSelectedIds(new Set());
          context.requestRender();
        } catch (error) {
          console.warn('Failed to delete shapes:', error);
        }
      } else {
        // Single deletion uses the context method (which uses DeleteShapeCommand)
        for (const id of idsToDelete) {
          context.deleteShape(id);
        }
        context.setSelectedIds(new Set());
        context.requestRender();
      }
    }
  }

  /**
   * Start duplication mode - create copies and prepare to drag them
   */
  private startDuplication(event: PointerEventData, context: ToolContext): void {
    this.isDuplicating = true;
    this.isDragging = true;
    this.dragStartX = event.canvasX;
    this.dragStartY = event.canvasY;
    this.duplicatedShapeIds.clear();

    // Create duplicates of all selected shapes
    const shapesToDuplicate = context.shapes.filter(s => context.selectedIds.has(s.id));

    for (const shape of shapesToDuplicate) {
      const newId = generateShapeId();
      const newShape: any = { ...shape, id: newId };

      // Remove bindings when duplicating arrows/lines
      if (newShape.type === 'arrow' || newShape.type === 'line') {
        delete newShape.bindStart;
        delete newShape.bindEnd;
      }

      // Add duplicate to canvas
      context.addShape(newShape);
      this.duplicatedShapeIds.add(newId);

      // Store initial position for the duplicate
      if (shape.type === 'line' || shape.type === 'arrow') {
        this.selectedShapeStartPositions.set(newId, {
          x: shape.x,
          y: shape.y,
          x2: shape.x2,
          y2: shape.y2,
          controlPoints: shape.controlPoints ? shape.controlPoints.map(cp => ({ ...cp })) : undefined,
        });
      } else if (shape.type === 'freedraw') {
        this.selectedShapeStartPositions.set(newId, {
          x: shape.x,
          y: shape.y,
          points: [...shape.points],
        });
      } else {
        this.selectedShapeStartPositions.set(newId, {
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
        });
      }
    }

    context.requestRender();
  }

  /**
   * Duplicate selected shapes with Ctrl+D
   */
  private duplicateSelectedShapes(context: ToolContext): void {
    const commands = [];
    const newShapeIds = new Set<string>();
    const offset = 20;

    const shapesToDuplicate = context.shapes.filter(s => context.selectedIds.has(s.id));

    for (const shape of shapesToDuplicate) {
      const newId = generateShapeId();
      const newShape: any = {
        ...shape,
        id: newId,
        x: shape.x + offset,
        y: shape.y + offset,
      };

      // Handle shapes with x2, y2 (lines and arrows)
      if ('x2' in shape && 'y2' in shape) {
        newShape.x2 = (shape as any).x2 + offset;
        newShape.y2 = (shape as any).y2 + offset;

        // Remove bindings when duplicating arrows/lines
        delete newShape.bindStart;
        delete newShape.bindEnd;
      }

      // Handle freedraw shapes with points
      if (shape.type === 'freedraw' && 'points' in shape) {
        newShape.points = (shape as any).points.map((p: { x: number; y: number }) => ({
          x: p.x + offset,
          y: p.y + offset,
        }));
      }

      commands.push(new AddShapeCommand(newShape));
      newShapeIds.add(newId);
    }

    if (commands.length > 0) {
      historyManager.execute(new BatchCommand(commands));
      context.setSelectedIds(newShapeIds);
      context.requestRender();
    }
  }

  /**
   * Check if a shape is a line/arrow with both endpoints bound
   */
  private isFullyBound(shape: Shape): boolean {
    if (shape.type !== 'line' && shape.type !== 'arrow') return false;
    const lineOrArrow = shape as LineShape | ArrowShape;
    return !!(lineOrArrow.bindStart && lineOrArrow.bindEnd);
  }

  /**
   * Check if a click is near a line/arrow endpoint. Returns 'start' or 'end' or null.
   */
  private getEndpointAtPoint(
    canvasX: number,
    canvasY: number,
    shape: LineShape | ArrowShape,
    threshold: number = 15
  ): 'start' | 'end' | null {
    const dxStart = canvasX - shape.x;
    const dyStart = canvasY - shape.y;
    const distStart = Math.sqrt(dxStart * dxStart + dyStart * dyStart);

    const dxEnd = canvasX - shape.x2;
    const dyEnd = canvasY - shape.y2;
    const distEnd = Math.sqrt(dxEnd * dxEnd + dyEnd * dyEnd);

    // If both are within threshold, pick the closer one
    if (distStart < threshold && distEnd < threshold) {
      return distStart <= distEnd ? 'start' : 'end';
    }
    if (distStart < threshold) return 'start';
    if (distEnd < threshold) return 'end';
    return null;
  }

  /**
   * Capture full shape snapshots before a continuous operation begins.
   * Used to build a single undo entry when the operation finishes.
   */
  private storeStartSnapshots(context: ToolContext, shapeIds: string[]): void {
    for (const id of shapeIds) {
      if (this.dragStartSnapshots.has(id)) continue; // don't overwrite existing snapshot
      const shape = context.shapes.find(s => s.id === id);
      if (shape) {
        this.dragStartSnapshots.set(id, { ...shape } as Shape);
      }
    }
  }

  /**
   * Commit all accumulated drag changes as a single undo entry.
   * Called from onPointerUp after any continuous operation.
   */
  private commitDragToHistory(context: ToolContext): void {
    if (this.dragStartSnapshots.size === 0) return;

    const commands: SnapshotModifyCommand[] = [];

    for (const [id, oldShape] of this.dragStartSnapshots) {
      const currentShape = context.shapes.find(s => s.id === id);
      if (!currentShape) continue;

      // Diff: only include properties that actually changed
      const oldProps: Record<string, any> = {};
      const newProps: Record<string, any> = {};
      let hasChanges = false;

      for (const key of Object.keys(currentShape) as (keyof Shape)[]) {
        if (key === 'id') continue;
        const oldVal = (oldShape as any)[key];
        const newVal = (currentShape as any)[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          oldProps[key] = oldVal;
          newProps[key] = newVal;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        commands.push(new SnapshotModifyCommand(id, oldProps as Partial<Shape>, newProps as Partial<Shape>));
      }
    }

    if (commands.length > 0) {
      const cmd = commands.length === 1 ? commands[0] : new BatchCommand(commands);
      historyManager.push(cmd);
    }

    this.dragStartSnapshots.clear();
  }

  /**
   * Store initial positions of selected shapes
   */
  private storeSelectedShapePositions(context: ToolContext): void {
    this.selectedShapeStartPositions.clear();
    for (const shape of context.shapes) {
      if (context.selectedIds.has(shape.id)) {
        if (shape.type === 'line' || shape.type === 'arrow') {
          this.selectedShapeStartPositions.set(shape.id, {
            x: shape.x,
            y: shape.y,
            x2: shape.x2,
            y2: shape.y2,
            controlPoints: shape.controlPoints ? shape.controlPoints.map(cp => ({ ...cp })) : undefined,
          });
        } else if (shape.type === 'freedraw') {
          this.selectedShapeStartPositions.set(shape.id, {
            x: shape.x,
            y: shape.y,
            points: [...shape.points],
          });
        } else {
          this.selectedShapeStartPositions.set(shape.id, {
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            rotation: shape.rotation || 0,
          });
        }
      }
    }
  }

  /**
   * Start resizing operation
   */
  private startResize(event: PointerEventData, context: ToolContext, handle: HandleType): void {
    this.isResizing = true;
    this.currentHandle = handle;
    this.dragStartX = event.canvasX;
    this.dragStartY = event.canvasY;

    // Get combined bounds of selection
    const bounds = this.getCombinedBounds(context);
    if (bounds) {
      this.resizeStartBounds = { ...bounds };
      this.storeSelectedShapePositions(context);
      // Capture start snapshots for history coalescing
      this.storeStartSnapshots(context, Array.from(context.selectedIds));
    }
  }

  /**
   * Perform resize operation
   */
  private performResize(event: PointerEventData, context: ToolContext): void {
    if (!this.resizeStartBounds || !this.currentHandle) return;

    const deltaX = event.canvasX - this.dragStartX;
    const deltaY = event.canvasY - this.dragStartY;

    let newBounds = { ...this.resizeStartBounds };

    // Calculate new bounds based on handle
    switch (this.currentHandle) {
      case 'nw':
        newBounds.x += deltaX;
        newBounds.y += deltaY;
        newBounds.width -= deltaX;
        newBounds.height -= deltaY;
        break;
      case 'n':
        newBounds.y += deltaY;
        newBounds.height -= deltaY;
        break;
      case 'ne':
        newBounds.y += deltaY;
        newBounds.width += deltaX;
        newBounds.height -= deltaY;
        break;
      case 'e':
        newBounds.width += deltaX;
        break;
      case 'se':
        newBounds.width += deltaX;
        newBounds.height += deltaY;
        break;
      case 's':
        newBounds.height += deltaY;
        break;
      case 'sw':
        newBounds.x += deltaX;
        newBounds.width -= deltaX;
        newBounds.height += deltaY;
        break;
      case 'w':
        newBounds.x += deltaX;
        newBounds.width -= deltaX;
        break;
    }

    // Aspect ratio lock: if any selected shape has aspectRatioLocked, constrain proportions
    const hasLockedAspect = context.shapes.some(
      s => context.selectedIds.has(s.id) && !s.locked && s.aspectRatioLocked
    );
    if (hasLockedAspect && this.resizeStartBounds) {
      const origW = this.resizeStartBounds.width;
      const origH = this.resizeStartBounds.height;
      if (origW > 0 && origH > 0) {
        const aspectRatio = origW / origH;
        const handle = this.currentHandle!;
        const isCorner = handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw';
        if (isCorner) {
          // Use the dimension with the larger proportional change to drive both
          const scaleW = newBounds.width / origW;
          const scaleH = newBounds.height / origH;
          if (Math.abs(scaleW - 1) > Math.abs(scaleH - 1)) {
            // Width changed more — derive height from width
            newBounds.height = newBounds.width / aspectRatio;
          } else {
            // Height changed more — derive width from height
            newBounds.width = newBounds.height * aspectRatio;
          }
          // Adjust origin for handles that anchor at bottom/right
          if (handle === 'nw') {
            newBounds.x = this.resizeStartBounds.x + this.resizeStartBounds.width - newBounds.width;
            newBounds.y = this.resizeStartBounds.y + this.resizeStartBounds.height - newBounds.height;
          } else if (handle === 'ne') {
            newBounds.y = this.resizeStartBounds.y + this.resizeStartBounds.height - newBounds.height;
          } else if (handle === 'sw') {
            newBounds.x = this.resizeStartBounds.x + this.resizeStartBounds.width - newBounds.width;
          }
          // 'se' anchors at top-left, no adjustment needed
        } else {
          // Edge handles: adjust the perpendicular dimension and center it
          if (handle === 'n' || handle === 's') {
            const newW = newBounds.height * aspectRatio;
            const wDiff = newW - newBounds.width;
            newBounds.x -= wDiff / 2;
            newBounds.width = newW;
          } else {
            // 'e' or 'w'
            const newH = newBounds.width / aspectRatio;
            const hDiff = newH - newBounds.height;
            newBounds.y -= hDiff / 2;
            newBounds.height = newH;
          }
        }
      }
    }

    // Prevent negative dimensions
    if (newBounds.width < 10) newBounds.width = 10;
    if (newBounds.height < 10) newBounds.height = 10;

    // Apply transform to each selected shape
    this.applyBoundsTransform(context, this.resizeStartBounds, newBounds);
  }

  /**
   * Apply bounds transformation to selected shapes
   */
  private applyBoundsTransform(
    context: ToolContext,
    oldBounds: { x: number; y: number; width: number; height: number },
    newBounds: { x: number; y: number; width: number; height: number }
  ): void {
    const scaleX = newBounds.width / oldBounds.width;
    const scaleY = newBounds.height / oldBounds.height;

    for (const shape of context.shapes) {
      if (context.selectedIds.has(shape.id) && !shape.locked) {
        const startPos = this.selectedShapeStartPositions.get(shape.id);
        if (!startPos) continue;

        if (shape.type === 'line' || shape.type === 'arrow') {
          // Transform both endpoints
          const newX = newBounds.x + (startPos.x - oldBounds.x) * scaleX;
          const newY = newBounds.y + (startPos.y - oldBounds.y) * scaleY;
          const newX2 = newBounds.x + ((startPos.x2 ?? 0) - oldBounds.x) * scaleX;
          const newY2 = newBounds.y + ((startPos.y2 ?? 0) - oldBounds.y) * scaleY;

          context.updateShapeDirect(shape.id, {
            x: newX,
            y: newY,
            x2: newX2,
            y2: newY2,
          } as Partial<Shape>);
        } else if (shape.type === 'freedraw') {
          // Transform all points
          const newPoints = (startPos.points || []).map((p: { x: number; y: number }) => ({
            x: newBounds.x + (p.x - oldBounds.x) * scaleX,
            y: newBounds.y + (p.y - oldBounds.y) * scaleY,
          }));
          const newX = newBounds.x + (startPos.x - oldBounds.x) * scaleX;
          const newY = newBounds.y + (startPos.y - oldBounds.y) * scaleY;

          context.updateShapeDirect(shape.id, {
            x: newX,
            y: newY,
            points: newPoints,
          } as Partial<Shape>);
        } else {
          // Transform position and size
          const newX = newBounds.x + (startPos.x - oldBounds.x) * scaleX;
          const newY = newBounds.y + (startPos.y - oldBounds.y) * scaleY;
          const newWidth = (startPos.width ?? 0) * scaleX;
          const newHeight = (startPos.height ?? 0) * scaleY;

          context.updateShapeDirect(shape.id, {
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
          } as Partial<Shape>);
        }
      }
    }
  }

  /**
   * Start rotation operation
   */
  private startRotation(event: PointerEventData, context: ToolContext): void {
    this.isRotating = true;
    this.dragStartX = event.canvasX;
    this.dragStartY = event.canvasY;

    // Calculate rotation center (center of selection bounds)
    const bounds = this.getCombinedBounds(context);
    if (bounds) {
      this.rotationCenter = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };

      // Calculate initial angle
      this.rotationStartAngle = Math.atan2(
        event.canvasY - this.rotationCenter.y,
        event.canvasX - this.rotationCenter.x
      );

      this.storeSelectedShapePositions(context);
      // Capture start snapshots for history coalescing
      this.storeStartSnapshots(context, Array.from(context.selectedIds));
    }
  }

  /**
   * Perform rotation operation
   */
  private performRotation(event: PointerEventData, context: ToolContext): void {
    // Calculate current angle
    const currentAngle = Math.atan2(
      event.canvasY - this.rotationCenter.y,
      event.canvasX - this.rotationCenter.x
    );

    const deltaAngle = currentAngle - this.rotationStartAngle;
    // Apply sensitivity factor to make rotation slower (0.4 = 40% speed)
    const deltaDegrees = (deltaAngle * 180) / Math.PI * 0.4;

    // Apply rotation to each selected shape
    for (const shape of context.shapes) {
      if (context.selectedIds.has(shape.id) && !shape.locked) {
        const startPos = this.selectedShapeStartPositions.get(shape.id);
        if (!startPos) continue;

        // Update rotation property
        const currentRotation = startPos.rotation || 0;
        let newRotation = currentRotation + deltaDegrees;

        // Normalize to 0-360
        while (newRotation < 0) newRotation += 360;
        while (newRotation >= 360) newRotation -= 360;

        context.updateShapeDirect(shape.id, {
          rotation: newRotation,
        } as Partial<Shape>);
      }
    }
  }

  /**
   * Get handle at point (for resize/rotate)
   */
  private getHandleAtPoint(x: number, y: number, context: ToolContext): HandleType {
    if (context.selectedIds.size === 0) return null;

    const handles = this.getHandles(context);
    const tolerance = 8;

    for (const handle of handles) {
      const dx = x - handle.x;
      const dy = y - handle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < tolerance) {
        return handle.type;
      }
    }

    return null;
  }

  /**
   * Get all resize/rotate handles for current selection
   */
  private getHandles(context: ToolContext): HandleInfo[] {
    const bounds = this.getCombinedBounds(context);
    if (!bounds) return [];

    // Skip resize/rotate handles for single selected line/arrow —
    // lines use endpoints and control points, not bounding box resize.
    if (context.selectedIds.size === 1) {
      const selectedId = Array.from(context.selectedIds)[0];
      const selectedShape = context.shapes.find(s => s.id === selectedId);
      if (selectedShape && (selectedShape.type === 'line' || selectedShape.type === 'arrow')) {
        return [];
      }
    }

    const handles: HandleInfo[] = [];
    const handleSize = 6;

    // Corner handles
    handles.push({ type: 'nw', x: bounds.x, y: bounds.y, cursor: 'nwse-resize' });
    handles.push({ type: 'ne', x: bounds.x + bounds.width, y: bounds.y, cursor: 'nesw-resize' });
    handles.push({ type: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'nwse-resize' });
    handles.push({ type: 'sw', x: bounds.x, y: bounds.y + bounds.height, cursor: 'nesw-resize' });

    // Edge handles
    handles.push({ type: 'n', x: bounds.x + bounds.width / 2, y: bounds.y, cursor: 'ns-resize' });
    handles.push({ type: 'e', x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, cursor: 'ew-resize' });
    handles.push({ type: 's', x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, cursor: 'ns-resize' });
    handles.push({ type: 'w', x: bounds.x, y: bounds.y + bounds.height / 2, cursor: 'ew-resize' });

    // Rotation handle (above the selection)
    handles.push({
      type: 'rotate',
      x: bounds.x + bounds.width / 2,
      y: bounds.y - 30,
      cursor: 'grab'
    });

    return handles;
  }

  /**
   * Get combined bounding box of all selected shapes
   */
  private getCombinedBounds(context: ToolContext): { x: number; y: number; width: number; height: number } | null {
    if (context.selectedIds.size === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const shape of context.shapes) {
      if (context.selectedIds.has(shape.id)) {
        const bounds = this.getShapeBounds(shape);
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
      }
    }

    if (minX === Infinity) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Get bounding box for a shape
   */
  private getShapeBounds(shape: Shape): { x: number; y: number; width: number; height: number } {
    switch (shape.type) {
      case 'rectangle':
      case 'ellipse':
      case 'triangle':
      case 'diamond':
      case 'hexagon':
      case 'star':
      case 'cloud':
      case 'cylinder':
      case 'text':
      case 'sticky':
      case 'image':
        return {
          x: shape.x,
          y: shape.y,
          width: shape.width || 0,
          height: shape.height || 0,
        };
      case 'line':
      case 'arrow':
        return {
          x: Math.min(shape.x, shape.x2),
          y: Math.min(shape.y, shape.y2),
          width: Math.abs(shape.x2 - shape.x),
          height: Math.abs(shape.y2 - shape.y),
        };
      case 'freedraw':
        // For freedraw, calculate bounds from points
        if (!shape.points || shape.points.length === 0) {
          return { x: shape.x, y: shape.y, width: 0, height: 0 };
        }
        const xs = shape.points.map(p => p.x);
        const ys = shape.points.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        };
      default:
        return { x: shape.x, y: shape.y, width: shape.width || 0, height: shape.height || 0 };
    }
  }

  /**
   * Check if two bounding boxes intersect
   */
  private boxIntersects(
    x1: number,
    y1: number,
    w1: number,
    h1: number,
    bounds: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      x1 < bounds.x + bounds.width &&
      x1 + w1 > bounds.x &&
      y1 < bounds.y + bounds.height &&
      y1 + h1 > bounds.y
    );
  }

  renderOverlay(ctx: CanvasRenderingContext2D, context: ToolContext): void {
    ctx.save();

    // Draw hover connection points
    if (this.hoverConnectionPoints.length > 0 && (!this.isDragging || this.isDraggingEndpoint) && !this.isResizing && !this.isRotating) {
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
        ctx.fillStyle = '#2196f3';
        ctx.fill();
        ctx.strokeStyle = '#1565c0';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw arrow preview during connection
    if (this.isConnecting && this.connectCurrentArrow) {
      const arrow = this.connectCurrentArrow;
      ctx.globalAlpha = arrow.opacity;

      if (arrow.strokeColor && arrow.strokeWidth > 0) {
        ctx.strokeStyle = arrow.strokeColor;
        ctx.lineWidth = arrow.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw line
        ctx.beginPath();
        ctx.moveTo(arrow.x, arrow.y);
        ctx.lineTo(arrow.x2, arrow.y2);
        ctx.stroke();

        // Draw arrowhead preview
        const dx = arrow.x2 - arrow.x;
        const dy = arrow.y2 - arrow.y;
        const angle = Math.atan2(dy, dx);
        const arrowheadSize = arrow.strokeWidth * 4;
        const arrowAngle = Math.PI / 6;

        const point1X = arrow.x2 - arrowheadSize * Math.cos(angle - arrowAngle);
        const point1Y = arrow.y2 - arrowheadSize * Math.sin(angle - arrowAngle);
        const point2X = arrow.x2 - arrowheadSize * Math.cos(angle + arrowAngle);
        const point2Y = arrow.y2 - arrowheadSize * Math.sin(angle + arrowAngle);

        ctx.fillStyle = arrow.strokeColor;
        ctx.beginPath();
        ctx.moveTo(arrow.x2, arrow.y2);
        ctx.lineTo(point1X, point1Y);
        ctx.lineTo(point2X, point2Y);
        ctx.closePath();
        ctx.fill();
      }

      // Render angle snap guide line
      if (this.connectAngleSnap.snapped) {
        renderAngleSnapGuide(ctx, arrow.x, arrow.y, this.connectAngleSnap);
      }

      // Highlight start connection point (green)
      if (this.connectStartPoint) {
        ctx.beginPath();
        ctx.arc(this.connectStartPoint.point.x, this.connectStartPoint.point.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#4caf50';
        ctx.fill();
        ctx.strokeStyle = '#2e7d32';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Highlight nearest end connection point (green)
      if (this.connectEndPoint) {
        // Guide line
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(arrow.x2, arrow.y2);
        ctx.lineTo(this.connectEndPoint.point.x, this.connectEndPoint.point.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Glow
        const gradient = ctx.createRadialGradient(
          this.connectEndPoint.point.x, this.connectEndPoint.point.y, 0,
          this.connectEndPoint.point.x, this.connectEndPoint.point.y, 18
        );
        gradient.addColorStop(0, 'rgba(76, 175, 80, 0.8)');
        gradient.addColorStop(1, 'rgba(76, 175, 80, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.connectEndPoint.point.x, this.connectEndPoint.point.y, 18, 0, Math.PI * 2);
        ctx.fill();

        // Green dot
        ctx.beginPath();
        ctx.arc(this.connectEndPoint.point.x, this.connectEndPoint.point.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#4caf50';
        ctx.fill();
        ctx.strokeStyle = '#2e7d32';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    }

    // Draw box selection rectangle if active
    if (this.isBoxSelecting) {
      const x = Math.min(this.boxSelectStartX, this.boxSelectEndX);
      const y = Math.min(this.boxSelectStartY, this.boxSelectEndY);
      const width = Math.abs(this.boxSelectEndX - this.boxSelectStartX);
      const height = Math.abs(this.boxSelectEndY - this.boxSelectStartY);

      // Draw selection box background
      ctx.fillStyle = 'rgba(0, 102, 255, 0.1)';
      ctx.fillRect(x, y, width, height);

      // Draw selection box border
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, width, height);
    }

    // Draw selection indicators around selected shapes
    if (context.selectedIds.size > 0) {
      const bounds = this.getCombinedBounds(context);

      if (bounds) {
        // Draw selection box
        ctx.strokeStyle = '#0066ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        const padding = 5;
        ctx.strokeRect(
          bounds.x - padding,
          bounds.y - padding,
          bounds.width + padding * 2,
          bounds.height + padding * 2
        );

        // Draw resize handles
        const handles = this.getHandles(context);
        const handleSize = 8;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0066ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);

        for (const handle of handles) {
          if (handle.type === 'rotate') {
            // Draw rotation handle as a circle
            ctx.beginPath();
            ctx.arc(handle.x, handle.y, handleSize / 2, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();

            // Draw line connecting to selection
            ctx.beginPath();
            ctx.strokeStyle = '#0066ff';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.moveTo(handle.x, handle.y + handleSize / 2);
            ctx.lineTo(handle.x, bounds.y - padding);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            // Draw resize handle as a square
            ctx.fillRect(
              handle.x - handleSize / 2,
              handle.y - handleSize / 2,
              handleSize,
              handleSize
            );
            ctx.strokeRect(
              handle.x - handleSize / 2,
              handle.y - handleSize / 2,
              handleSize,
              handleSize
            );
          }
        }

        // Draw lock icon on locked shapes
        for (const shape of context.shapes) {
          if (shape.locked) {
            const shapeBounds = this.getShapeBounds(shape);
            this.drawLockIcon(ctx, shapeBounds.x + shapeBounds.width - 20, shapeBounds.y + 5);
          }
        }

        // Draw binding indicators for arrows/lines bound to selected shapes
        this.drawBindingIndicators(ctx, context);

        // Draw endpoint handles for selected lines/arrows showing bound vs unbound state
        this.drawEndpointHandles(ctx, context);

        // Draw control point handles for selected lines/arrows with non-direct routing
        this.drawControlPointHandles(ctx, context);
      }
    }

    ctx.restore();
  }

  /**
   * Draw endpoint handles for selected lines/arrows.
   * Bound endpoints are shown as filled circles; unbound endpoints as hollow circles.
   * Fully-bound lines also show a lock icon near the midpoint.
   */
  private drawEndpointHandles(ctx: CanvasRenderingContext2D, context: ToolContext): void {
    for (const shape of context.shapes) {
      if (!context.selectedIds.has(shape.id)) continue;
      if (shape.type !== 'line' && shape.type !== 'arrow') continue;

      const lineOrArrow = shape as LineShape | ArrowShape;
      const hasBothBindings = !!(lineOrArrow.bindStart && lineOrArrow.bindEnd);
      const hasStartBinding = !!lineOrArrow.bindStart;
      const hasEndBinding = !!lineOrArrow.bindEnd;

      // Only show endpoint handles if at least one binding exists
      if (!hasStartBinding && !hasEndBinding) continue;

      const endpointRadius = 7;

      // Draw start endpoint handle
      ctx.beginPath();
      ctx.arc(lineOrArrow.x, lineOrArrow.y, endpointRadius, 0, 2 * Math.PI);
      if (hasStartBinding) {
        // Bound: filled circle with orange color
        ctx.fillStyle = '#ff6600';
        ctx.fill();
        ctx.strokeStyle = '#cc5200';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Unbound: hollow circle with blue outline
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#0066ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
      }

      // Draw end endpoint handle
      ctx.beginPath();
      ctx.arc(lineOrArrow.x2, lineOrArrow.y2, endpointRadius, 0, 2 * Math.PI);
      if (hasEndBinding) {
        // Bound: filled circle with orange color
        ctx.fillStyle = '#ff6600';
        ctx.fill();
        ctx.strokeStyle = '#cc5200';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Unbound: hollow circle with blue outline
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#0066ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
      }

      // If fully bound, draw a small lock indicator at midpoint
      if (hasBothBindings) {
        const midX = (lineOrArrow.x + lineOrArrow.x2) / 2;
        const midY = (lineOrArrow.y + lineOrArrow.y2) / 2;

        // Draw a small padlock icon
        ctx.save();
        ctx.fillStyle = 'rgba(255, 102, 0, 0.85)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;

        // Lock body
        const lockW = 10;
        const lockH = 8;
        ctx.fillRect(midX - lockW / 2, midY - lockH / 2 + 2, lockW, lockH);
        ctx.strokeRect(midX - lockW / 2, midY - lockH / 2 + 2, lockW, lockH);

        // Lock shackle
        ctx.strokeStyle = 'rgba(255, 102, 0, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(midX, midY - lockH / 2 + 2, 4, Math.PI, 0, false);
        ctx.stroke();

        ctx.restore();
      }
    }
  }

  /**
   * Draw indicators showing arrow bindings to selected shapes
   */
  private drawBindingIndicators(ctx: CanvasRenderingContext2D, context: ToolContext): void {
    // For each selected shape, show its connection points if any arrows are bound
    for (const shape of context.shapes) {
      if (context.selectedIds.has(shape.id)) {
        const boundArrows = getBoundArrows(shape.id, context.shapes);
        if (boundArrows.length > 0) {
          // Draw connection points with bindings
          const connectionPoints = getShapeConnectionPoints(shape);

          ctx.fillStyle = '#ff6600';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;

          for (const cp of connectionPoints) {
            // Check if this connection point has an arrow bound to it
            const hasBinding = boundArrows.some(arrow => {
              return (arrow.bindStart?.shapeId === shape.id && arrow.bindStart?.point === cp.location) ||
                     (arrow.bindEnd?.shapeId === shape.id && arrow.bindEnd?.point === cp.location);
            });

            if (hasBinding) {
              ctx.beginPath();
              ctx.arc(cp.point.x, cp.point.y, 5, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();
            }
          }
        }
      }
    }
  }

  /**
   * Draw a lock icon
   */
  private drawLockIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;

    // Draw lock body
    ctx.fillRect(x, y + 6, 12, 10);
    ctx.strokeRect(x, y + 6, 12, 10);

    // Draw lock shackle
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 6, y + 6, 4, Math.PI, 0, true);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Get all shapes that should be selected including group members
   */
  private getShapesWithGroup(clickedShape: Shape, context: ToolContext): string[] {
    // Check if shape has a groupId
    if (clickedShape.groupId) {
      // Find all shapes with the same groupId
      return context.shapes
        .filter(s => s.groupId === clickedShape.groupId)
        .map(s => s.id);
    }
    return [clickedShape.id];
  }

  /**
   * Group selected shapes
   */
  private groupSelectedShapes(context: ToolContext): void {
    const selectedIds = Array.from(context.selectedIds);
    if (selectedIds.length < 2) return;

    // Filter out locked shapes
    const unlocked = selectedIds.filter(id => {
      const shape = context.shapes.find(s => s.id === id);
      return shape && !shape.locked;
    });

    if (unlocked.length < 2) {
      console.warn('Cannot group: need at least 2 unlocked shapes');
      return;
    }

    try {
      historyManager.execute(new GroupShapesCommand(unlocked));
      console.log(`Grouped ${unlocked.length} shapes`);
      context.requestRender();
    } catch (error) {
      console.error('Failed to group shapes:', error);
    }
  }

  /**
   * Ungroup selected shapes
   */
  private ungroupSelectedShapes(context: ToolContext): void {
    // Find all unique group IDs in selection
    const groupIds = new Set<string>();
    for (const id of context.selectedIds) {
      const shape = context.shapes.find(s => s.id === id);
      if (shape && shape.groupId) {
        groupIds.add(shape.groupId);
      }
    }

    if (groupIds.size === 0) {
      console.warn('No grouped shapes selected');
      return;
    }

    try {
      const commands = Array.from(groupIds).map(groupId => new UngroupShapesCommand(groupId));
      if (commands.length === 1) {
        historyManager.execute(commands[0]);
      } else {
        historyManager.execute(new BatchCommand(commands));
      }
      console.log(`Ungrouped ${commands.length} group(s)`);
      context.requestRender();
    } catch (error) {
      console.error('Failed to ungroup shapes:', error);
    }
  }

  /**
   * Start drawing a connected arrow from a connection point
   */
  private startConnection(point: ConnectionPointInfo, shapeId: string, context: ToolContext): void {
    this.isConnecting = true;
    this.connectStartPoint = point;
    this.connectStartShapeId = shapeId;
    this.connectEndPoint = null;

    // Clear selection
    context.setSelectedIds(new Set());

    // Create the arrow starting from the connection point
    this.connectCurrentArrow = createArrow(
      point.point.x,
      point.point.y,
      point.point.x,
      point.point.y,
      this.connectStylePreset
    );

    // Set binding for start
    this.connectCurrentArrow.bindStart = {
      shapeId: shapeId,
      point: point.location
    };

    this.hoverConnectionPoints = [];
    this.hoverShapeId = null;
    context.requestRender();
  }

  /**
   * Finish the connection (second click)
   */
  private finishConnection(event: PointerEventData, context: ToolContext): void {
    if (!this.connectCurrentArrow) return;

    // Update end point to click position
    this.connectCurrentArrow.x2 = event.canvasX;
    this.connectCurrentArrow.y2 = event.canvasY;

    // Check for binding at end point
    const endNearbyShapes = findBindableShapesNearPoint(
      { x: event.canvasX, y: event.canvasY },
      context.shapes,
      [this.connectStartShapeId || ''],
      40
    );

    if (endNearbyShapes.length > 0) {
      const endConnection = findNearestConnectionPoint(
        { x: event.canvasX, y: event.canvasY },
        endNearbyShapes[0],
        40
      );

      if (endConnection) {
        this.connectCurrentArrow.bindEnd = {
          shapeId: endNearbyShapes[0].id,
          point: endConnection.location
        };
        this.connectCurrentArrow.x2 = endConnection.point.x;
        this.connectCurrentArrow.y2 = endConnection.point.y;
      }
    }

    // Calculate arrow length
    const dx = this.connectCurrentArrow.x2 - this.connectCurrentArrow.x;
    const dy = this.connectCurrentArrow.y2 - this.connectCurrentArrow.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length > 1) {
      const shapeId = this.connectCurrentArrow.id;
      context.addShape(this.connectCurrentArrow);
      context.setSelectedIds(new Set([shapeId]));
    }

    // Reset connection state
    this.isConnecting = false;
    this.connectCurrentArrow = null;
    this.connectStartPoint = null;
    this.connectStartShapeId = null;
    this.connectEndPoint = null;
    this.connectAngleSnap = { x: 0, y: 0, snapped: false, snapAxis: null };
    this.hoverConnectionPoints = [];
    this.hoverShapeId = null;
    context.requestRender();
  }

  /**
   * Cancel an in-progress connection (e.g., on Escape)
   */
  private cancelConnection(context: ToolContext): void {
    this.isConnecting = false;
    this.connectCurrentArrow = null;
    this.connectStartPoint = null;
    this.connectStartShapeId = null;
    this.connectEndPoint = null;
    this.connectAngleSnap = { x: 0, y: 0, snapped: false, snapAxis: null };
    this.hoverConnectionPoints = [];
    this.hoverShapeId = null;
    context.requestRender();
  }

  private getConnectionPointRadius(point: Point, cursorPos: Point): number {
    const distance = Math.sqrt(
      Math.pow(point.x - cursorPos.x, 2) +
      Math.pow(point.y - cursorPos.y, 2)
    );

    const maxDistance = 40;
    const minRadius = 6;
    const maxRadius = 12;

    if (distance > maxDistance) return minRadius;

    const scale = 1 - (distance / maxDistance);
    return minRadius + (maxRadius - minRadius) * scale;
  }

  /**
   * Get control points for all selected lines/arrows that have non-direct routing.
   * Returns an array of { shapeId, index, x, y } for each control point.
   */
  private getVisibleControlPoints(context: ToolContext): Array<{ shapeId: string; index: number; x: number; y: number }> {
    const result: Array<{ shapeId: string; index: number; x: number; y: number }> = [];

    for (const shape of context.shapes) {
      if (!context.selectedIds.has(shape.id)) continue;
      if (shape.type !== 'line' && shape.type !== 'arrow') continue;

      const lineOrArrow = shape as LineShape | ArrowShape;
      const mode = lineOrArrow.routingMode || 'direct';
      if (mode === 'direct') continue;

      // Get or compute control points
      let cps = lineOrArrow.controlPoints;
      if (!cps || cps.length === 0) {
        cps = getDefaultControlPoints(lineOrArrow.x, lineOrArrow.y, lineOrArrow.x2, lineOrArrow.y2, mode);
      }

      for (let i = 0; i < cps.length; i++) {
        result.push({
          shapeId: shape.id,
          index: i,
          x: cps[i].x,
          y: cps[i].y,
        });
      }
    }

    return result;
  }

  /**
   * Check if the given position hits a control point handle.
   */
  private getControlPointAtPosition(
    px: number, py: number, context: ToolContext
  ): { shapeId: string; index: number; x: number; y: number } | null {
    const cps = this.getVisibleControlPoints(context);
    const tolerance = 10;

    for (const cp of cps) {
      const dx = px - cp.x;
      const dy = py - cp.y;
      if (Math.sqrt(dx * dx + dy * dy) <= tolerance) {
        return cp;
      }
    }

    return null;
  }

  /**
   * Draw control point handles for selected lines/arrows with non-direct routing.
   */
  private drawControlPointHandles(ctx: CanvasRenderingContext2D, context: ToolContext): void {
    const cps = this.getVisibleControlPoints(context);
    if (cps.length === 0) return;

    const size = 8;

    for (const cp of cps) {
      // Draw a diamond shape for control points
      ctx.save();
      ctx.translate(cp.x, cp.y);
      ctx.rotate(Math.PI / 4);

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.strokeRect(-size / 2, -size / 2, size, size);

      ctx.restore();
    }
  }

  getCursor(): string {
    if (this.isDraggingEndpoint) return 'move';
    if (this.isDraggingControlPoint) return 'move';
    if (this.isConnecting) return 'crosshair';
    // Only show crosshair when cursor is actually close to a specific connection point dot
    if (this.hoverConnectionPoints.length > 0 && this.isNearConnectionPoint(this.currentCursorPos, 10)) return 'crosshair';
    if (this.isRotating) return 'grab';
    if (this.isDragging) return 'grabbing';
    if (this.isResizing) {
      // Return appropriate cursor for current handle
      const cursorMap: Record<string, string> = {
        'nw': 'nwse-resize',
        'n': 'ns-resize',
        'ne': 'nesw-resize',
        'e': 'ew-resize',
        'se': 'nwse-resize',
        's': 'ns-resize',
        'sw': 'nesw-resize',
        'w': 'ew-resize',
      };
      return this.currentHandle ? cursorMap[this.currentHandle] || 'default' : 'default';
    }
    return 'default';
  }

  /**
   * Check if a point is within a given distance of any visible connection point dot
   */
  private isNearConnectionPoint(point: Point, threshold: number): boolean {
    for (const cp of this.hoverConnectionPoints) {
      const dx = point.x - cp.point.x;
      const dy = point.y - cp.point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= threshold) {
        return true;
      }
    }
    return false;
  }

  /**
   * Set callback for text editing start
   */
  setTextEditCallback(callback: (shapeId: string) => void) {
    this.onTextEditStart = callback;
  }
}
