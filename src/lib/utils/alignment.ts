/**
 * Alignment and distribution utilities for shapes
 */

import type { Shape } from '../types';
import type { Shape as StoreShape } from '../state/canvasStore';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Get the bounding box for a shape
 */
export function getShapeBounds(shape: Shape | StoreShape): BoundingBox {
  if (shape.type === 'line') {
    const lineShape = shape as any;
    const x1 = lineShape.x;
    const y1 = lineShape.y;
    const x2 = lineShape.x2 || x1;
    const y2 = lineShape.y2 || y1;

    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  }

  return {
    x: shape.x,
    y: shape.y,
    width: (shape as any).width || 0,
    height: (shape as any).height || 0
  };
}

/**
 * Get the combined bounding box for multiple shapes
 */
export function getSelectionBounds(shapes: (Shape | StoreShape)[]): BoundingBox {
  if (shapes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const bounds = shapes.map(getShapeBounds);
  const minX = Math.min(...bounds.map(b => b.x));
  const minY = Math.min(...bounds.map(b => b.y));
  const maxX = Math.max(...bounds.map(b => b.x + b.width));
  const maxY = Math.max(...bounds.map(b => b.y + b.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Align shapes to the left
 */
export function alignLeft(shapes: (Shape | StoreShape)[]): Array<{ id: string; changes: Partial<Shape> }> {
  if (shapes.length < 2) return [];

  const bounds = getSelectionBounds(shapes);
  const leftEdge = bounds.x;

  return shapes.map(shape => ({
    id: shape.id,
    changes: { x: leftEdge }
  }));
}

/**
 * Align shapes to the right
 */
export function alignRight(shapes: (Shape | StoreShape)[]): Array<{ id: string; changes: Partial<Shape> }> {
  if (shapes.length < 2) return [];

  const bounds = getSelectionBounds(shapes);
  const rightEdge = bounds.x + bounds.width;

  return shapes.map(shape => {
    const shapeBounds = getShapeBounds(shape);
    return {
      id: shape.id,
      changes: { x: rightEdge - shapeBounds.width }
    };
  });
}

/**
 * Align shapes to the top
 */
export function alignTop(shapes: (Shape | StoreShape)[]): Array<{ id: string; changes: Partial<Shape> }> {
  if (shapes.length < 2) return [];

  const bounds = getSelectionBounds(shapes);
  const topEdge = bounds.y;

  return shapes.map(shape => ({
    id: shape.id,
    changes: { y: topEdge }
  }));
}

/**
 * Align shapes to the bottom
 */
export function alignBottom(shapes: (Shape | StoreShape)[]): Array<{ id: string; changes: Partial<Shape> }> {
  if (shapes.length < 2) return [];

  const bounds = getSelectionBounds(shapes);
  const bottomEdge = bounds.y + bounds.height;

  return shapes.map(shape => {
    const shapeBounds = getShapeBounds(shape);
    return {
      id: shape.id,
      changes: { y: bottomEdge - shapeBounds.height }
    };
  });
}

/**
 * Align shapes to the horizontal center
 */
export function alignCenterHorizontal(shapes: (Shape | StoreShape)[]): Array<{ id: string; changes: Partial<Shape> }> {
  if (shapes.length < 2) return [];

  const bounds = getSelectionBounds(shapes);
  const centerX = bounds.x + bounds.width / 2;

  return shapes.map(shape => {
    const shapeBounds = getShapeBounds(shape);
    return {
      id: shape.id,
      changes: { x: centerX - shapeBounds.width / 2 }
    };
  });
}

/**
 * Align shapes to the vertical center
 */
export function alignCenterVertical(shapes: (Shape | StoreShape)[]): Array<{ id: string; changes: Partial<Shape> }> {
  if (shapes.length < 2) return [];

  const bounds = getSelectionBounds(shapes);
  const centerY = bounds.y + bounds.height / 2;

  return shapes.map(shape => {
    const shapeBounds = getShapeBounds(shape);
    return {
      id: shape.id,
      changes: { y: centerY - shapeBounds.height / 2 }
    };
  });
}

/**
 * Distribute shapes horizontally with equal spacing
 */
export function distributeHorizontally(shapes: (Shape | StoreShape)[]): Array<{ id: string; changes: Partial<Shape> }> {
  if (shapes.length < 3) return [];

  // Sort shapes by x position
  const sorted = [...shapes].sort((a, b) => getShapeBounds(a).x - getShapeBounds(b).x);
  const bounds = sorted.map(getShapeBounds);

  const firstX = bounds[0].x;
  const lastX = bounds[bounds.length - 1].x + bounds[bounds.length - 1].width;
  const totalWidth = bounds.reduce((sum, b) => sum + b.width, 0);
  const spacing = (lastX - firstX - totalWidth) / (shapes.length - 1);

  let currentX = firstX;
  return sorted.map((shape, i) => {
    const changes = i === 0 || i === sorted.length - 1
      ? {}
      : { x: currentX };

    currentX += bounds[i].width + spacing;

    return {
      id: shape.id,
      changes
    };
  });
}

/**
 * Distribute shapes vertically with equal spacing
 */
export function distributeVertically(shapes: (Shape | StoreShape)[]): Array<{ id: string; changes: Partial<Shape> }> {
  if (shapes.length < 3) return [];

  // Sort shapes by y position
  const sorted = [...shapes].sort((a, b) => getShapeBounds(a).y - getShapeBounds(b).y);
  const bounds = sorted.map(getShapeBounds);

  const firstY = bounds[0].y;
  const lastY = bounds[bounds.length - 1].y + bounds[bounds.length - 1].height;
  const totalHeight = bounds.reduce((sum, b) => sum + b.height, 0);
  const spacing = (lastY - firstY - totalHeight) / (shapes.length - 1);

  let currentY = firstY;
  return sorted.map((shape, i) => {
    const changes = i === 0 || i === sorted.length - 1
      ? {}
      : { y: currentY };

    currentY += bounds[i].height + spacing;

    return {
      id: shape.id,
      changes
    };
  });
}
