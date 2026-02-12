/**
 * Binding utilities for arrow/line connections to shapes
 */

import type { Shape, ArrowShape, LineShape } from '../types';

export type ConnectionPoint = 'top' | 'right' | 'bottom' | 'left' | 'center';

export interface Binding {
  shapeId: string;
  point: ConnectionPoint;
}

export interface Point {
  x: number;
  y: number;
}

export interface ConnectionPointInfo {
  point: Point;
  location: ConnectionPoint;
}

/**
 * Get human-readable label for a connection point
 */
export function getConnectionPointLabel(location: ConnectionPoint): string {
  const labels: Record<ConnectionPoint, string> = {
    top: 'Top',
    right: 'Right',
    bottom: 'Bottom',
    left: 'Left',
    center: 'Center',
  };
  return labels[location];
}

/**
 * Get all connection points for a shape
 * Returns 5 connection points: top, right, bottom, left, center
 */
export function getShapeConnectionPoints(shape: Shape): ConnectionPointInfo[] {
  const bounds = getShapeBounds(shape);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  return [
    { point: { x: centerX, y: bounds.y }, location: 'top' },
    { point: { x: bounds.x + bounds.width, y: centerY }, location: 'right' },
    { point: { x: centerX, y: bounds.y + bounds.height }, location: 'bottom' },
    { point: { x: bounds.x, y: centerY }, location: 'left' },
    { point: { x: centerX, y: centerY }, location: 'center' },
  ];
}

/**
 * Find the nearest connection point on a shape to a given point
 */
export function findNearestConnectionPoint(
  point: Point,
  shape: Shape,
  threshold: number = 40
): ConnectionPointInfo | null {
  const connectionPoints = getShapeConnectionPoints(shape);
  let nearest: ConnectionPointInfo | null = null;
  let minDistance = threshold;

  for (const cp of connectionPoints) {
    const distance = getDistance(point, cp.point);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = cp;
    }
  }

  return nearest;
}

/**
 * Check if a point is near a shape (within threshold distance)
 */
export function isNearShape(point: Point, shape: Shape, threshold: number = 40): boolean {
  const bounds = getShapeBounds(shape);

  // Expand bounds by threshold
  const expandedBounds = {
    x: bounds.x - threshold,
    y: bounds.y - threshold,
    width: bounds.width + threshold * 2,
    height: bounds.height + threshold * 2,
  };

  return (
    point.x >= expandedBounds.x &&
    point.x <= expandedBounds.x + expandedBounds.width &&
    point.y >= expandedBounds.y &&
    point.y <= expandedBounds.y + expandedBounds.height
  );
}

/**
 * Get the actual point location for a binding.
 * When location is 'center' and fromPoint is provided, resolves to the
 * nearest edge point (where the ray from fromPoint through center hits the bounding box).
 */
export function getBindingPoint(shape: Shape, location: ConnectionPoint, fromPoint?: Point): Point {
  const bounds = getShapeBounds(shape);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  switch (location) {
    case 'top':
      return { x: centerX, y: bounds.y };
    case 'right':
      return { x: bounds.x + bounds.width, y: centerY };
    case 'bottom':
      return { x: centerX, y: bounds.y + bounds.height };
    case 'left':
      return { x: bounds.x, y: centerY };
    case 'center':
      if (fromPoint && bounds.width > 0 && bounds.height > 0) {
        return getEdgeIntersection(bounds, { x: centerX, y: centerY }, fromPoint);
      }
      return { x: centerX, y: centerY };
  }
}

/**
 * Update arrow/line endpoints based on bindings
 */
export function updateArrowForBinding(
  arrow: ArrowShape | LineShape,
  shapes: Shape[]
): Partial<ArrowShape | LineShape> {
  const updates: Partial<ArrowShape | LineShape> = {};

  // Check if arrow has bindings
  const bindStart = (arrow as any).bindStart as Binding | undefined;
  const bindEnd = (arrow as any).bindEnd as Binding | undefined;

  // Resolve the "other end" for center-binding edge resolution.
  // When updating the start point, use the end point as fromPoint (and vice versa).
  const currentEnd: Point = { x: arrow.x2, y: arrow.y2 };
  const currentStart: Point = { x: arrow.x, y: arrow.y };

  // Update start point if bound
  if (bindStart) {
    const boundShape = shapes.find(s => s.id === bindStart.shapeId);
    if (boundShape) {
      const point = getBindingPoint(boundShape, bindStart.point, currentEnd);
      updates.x = point.x;
      updates.y = point.y;
    } else {
      // Bound shape was deleted, remove binding
      (updates as any).bindStart = undefined;
    }
  }

  // Update end point if bound
  if (bindEnd) {
    const boundShape = shapes.find(s => s.id === bindEnd.shapeId);
    if (boundShape) {
      // Use the (possibly updated) start point as fromPoint
      const fromPoint: Point = { x: updates.x ?? currentStart.x, y: updates.y ?? currentStart.y };
      const point = getBindingPoint(boundShape, bindEnd.point, fromPoint);
      updates.x2 = point.x;
      updates.y2 = point.y;
    } else {
      // Bound shape was deleted, remove binding
      (updates as any).bindEnd = undefined;
    }
  }

  return updates;
}

/**
 * Find shapes that could be bound near a point
 */
export function findBindableShapesNearPoint(
  point: Point,
  shapes: Shape[],
  excludeIds: string[] = [],
  threshold: number = 40
): Shape[] {
  return shapes.filter(shape => {
    // Exclude arrows and lines from being bound to
    if (shape.type === 'arrow' || shape.type === 'line') return false;

    // Exclude shapes in the exclude list
    if (excludeIds.includes(shape.id)) return false;

    // Check if point is near this shape
    return isNearShape(point, shape, threshold);
  });
}

/**
 * Get arrows that are bound to a shape
 */
export function getBoundArrows(shapeId: string, shapes: Shape[]): (ArrowShape | LineShape)[] {
  const boundArrows: (ArrowShape | LineShape)[] = [];

  for (const shape of shapes) {
    if (shape.type === 'arrow' || shape.type === 'line') {
      const arrow = shape as ArrowShape | LineShape;
      const bindStart = (arrow as any).bindStart as Binding | undefined;
      const bindEnd = (arrow as any).bindEnd as Binding | undefined;

      if (bindStart?.shapeId === shapeId || bindEnd?.shapeId === shapeId) {
        boundArrows.push(arrow);
      }
    }
  }

  return boundArrows;
}

/**
 * Synchronize all arrow bindings in the shapes array
 * Returns a map of arrow IDs to their updated properties
 * This can be used to batch update arrows after loading or undo/redo
 */
export function syncAllArrowBindings(shapes: Shape[]): Map<string, Partial<ArrowShape | LineShape>> {
  const updates = new Map<string, Partial<ArrowShape | LineShape>>();

  for (const shape of shapes) {
    if (shape.type === 'arrow' || shape.type === 'line') {
      const arrow = shape as ArrowShape | LineShape;
      const bindStart = (arrow as any).bindStart as Binding | undefined;
      const bindEnd = (arrow as any).bindEnd as Binding | undefined;

      if (bindStart || bindEnd) {
        const arrowUpdates = updateArrowForBinding(arrow, shapes);
        if (Object.keys(arrowUpdates).length > 0) {
          updates.set(arrow.id, arrowUpdates);
        }
      }
    }
  }

  return updates;
}

// Helper functions

/**
 * Find where the ray from `from` through `center` intersects the bounding rectangle.
 * Returns the intersection point on the edge closest to `from`.
 */
function getEdgeIntersection(
  bounds: { x: number; y: number; width: number; height: number },
  center: Point,
  from: Point
): Point {
  const dx = from.x - center.x;
  const dy = from.y - center.y;

  // If from is exactly at center, fall back to top edge
  if (dx === 0 && dy === 0) {
    return { x: center.x, y: bounds.y };
  }

  const halfW = bounds.width / 2;
  const halfH = bounds.height / 2;

  // Check intersection with each edge and pick the one in the direction of `from`
  let tMin = Infinity;
  let result: Point = { x: center.x, y: bounds.y };

  // Right edge (x = bounds.x + bounds.width)
  if (dx !== 0) {
    const t = halfW / Math.abs(dx);
    const yAtEdge = center.y + t * dy;
    if (t > 0 && t < tMin && yAtEdge >= bounds.y && yAtEdge <= bounds.y + bounds.height) {
      tMin = t;
      result = { x: dx > 0 ? bounds.x + bounds.width : bounds.x, y: yAtEdge };
    }
  }

  // Left edge (x = bounds.x)
  // Already handled above via Math.abs

  // Top edge (y = bounds.y)
  if (dy !== 0) {
    const t = halfH / Math.abs(dy);
    const xAtEdge = center.x + t * dx;
    if (t > 0 && t < tMin && xAtEdge >= bounds.x && xAtEdge <= bounds.x + bounds.width) {
      tMin = t;
      result = { x: xAtEdge, y: dy > 0 ? bounds.y + bounds.height : bounds.y };
    }
  }

  // Bottom edge (y = bounds.y + bounds.height)
  // Already handled above via Math.abs

  return result;
}

function getDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getShapeBounds(shape: Shape): { x: number; y: number; width: number; height: number } {
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
      return {
        x: shape.x,
        y: shape.y,
        width: shape.width || 0,
        height: shape.height || 0,
      };
    case 'line':
    case 'arrow':
      const lineShape = shape as ArrowShape | LineShape;
      return {
        x: Math.min(lineShape.x, lineShape.x2),
        y: Math.min(lineShape.y, lineShape.y2),
        width: Math.abs(lineShape.x2 - lineShape.x),
        height: Math.abs(lineShape.y2 - lineShape.y),
      };
    case 'freedraw':
      const freedrawShape = shape as any;
      if (!freedrawShape.points || freedrawShape.points.length === 0) {
        return { x: shape.x, y: shape.y, width: 0, height: 0 };
      }
      const xs = freedrawShape.points.map((p: Point) => p.x);
      const ys = freedrawShape.points.map((p: Point) => p.y);
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
      return { x: (shape as any).x ?? 0, y: (shape as any).y ?? 0, width: 0, height: 0 };
  }
}
