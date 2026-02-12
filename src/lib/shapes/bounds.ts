/**
 * Functions to get bounding boxes for all shape types
 */

import type { Shape, BoundingBox } from '../types';

/**
 * Get bounding box for any shape
 */
export function getShapeBounds(shape: Shape): BoundingBox {
  const halfStroke = shape.strokeWidth / 2;

  switch (shape.type) {
    case 'rectangle':
    case 'ellipse':
    case 'triangle':
    case 'diamond':
    case 'hexagon':
    case 'star':
    case 'cloud':
    case 'cylinder':
    case 'sticky':
      return {
        x: shape.x - halfStroke,
        y: shape.y - halfStroke,
        width: shape.width + shape.strokeWidth,
        height: shape.height + shape.strokeWidth
      };

    case 'line':
    case 'arrow': {
      const minX = Math.min(shape.x, shape.x2);
      const minY = Math.min(shape.y, shape.y2);
      const maxX = Math.max(shape.x, shape.x2);
      const maxY = Math.max(shape.y, shape.y2);

      return {
        x: minX - halfStroke,
        y: minY - halfStroke,
        width: maxX - minX + shape.strokeWidth,
        height: maxY - minY + shape.strokeWidth
      };
    }

    case 'freedraw': {
      if (shape.points.length === 0) {
        return { x: shape.x, y: shape.y, width: 0, height: 0 };
      }

      let minX = shape.points[0].x;
      let minY = shape.points[0].y;
      let maxX = minX;
      let maxY = minY;

      for (const point of shape.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }

      return {
        x: minX - halfStroke,
        y: minY - halfStroke,
        width: maxX - minX + shape.strokeWidth,
        height: maxY - minY + shape.strokeWidth
      };
    }

    case 'text':
      return {
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height
      };

    default:
      return { x: shape.x, y: shape.y, width: 0, height: 0 };
  }
}

/**
 * Get combined bounding box for multiple shapes
 */
export function getCombinedBounds(shapes: Shape[]): BoundingBox | null {
  if (shapes.length === 0) return null;

  const firstBounds = getShapeBounds(shapes[0]);
  let minX = firstBounds.x;
  let minY = firstBounds.y;
  let maxX = firstBounds.x + firstBounds.width;
  let maxY = firstBounds.y + firstBounds.height;

  for (let i = 1; i < shapes.length; i++) {
    const bounds = getShapeBounds(shapes[i]);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Check if two bounding boxes intersect
 */
export function boundsIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * Check if a point is inside a bounding box
 */
export function boundsContainsPoint(bounds: BoundingBox, x: number, y: number): boolean {
  return (
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height
  );
}
