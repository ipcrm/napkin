/**
 * Viewport culling functions to filter visible shapes
 * Only renders shapes whose bounding boxes intersect with the viewport
 */

import type { BoundingBox, Viewport } from '../shapes/types';
import { boundingBoxesIntersect } from '../shapes/types';

/**
 * Interface for objects that have bounds (shapes)
 */
export interface BoundedObject {
  id: string;
  getBounds(): BoundingBox;
}

/**
 * Calculate the visible bounding box in canvas coordinates
 * @param viewport Current viewport state (pan/zoom)
 * @param canvasWidth Width of the canvas in screen pixels
 * @param canvasHeight Height of the canvas in screen pixels
 * @returns BoundingBox in canvas coordinates
 */
export function getVisibleBounds(
  viewport: Viewport,
  canvasWidth: number,
  canvasHeight: number
): BoundingBox {
  const { x, y, zoom } = viewport;

  return {
    x: x,
    y: y,
    width: canvasWidth / zoom,
    height: canvasHeight / zoom
  };
}

/**
 * Check if a shape is visible in the current viewport
 * @param shapeBounds Bounding box of the shape
 * @param visibleBounds Visible area in canvas coordinates
 * @returns True if the shape is at least partially visible
 */
export function isShapeVisible(
  shapeBounds: BoundingBox,
  visibleBounds: BoundingBox
): boolean {
  return boundingBoxesIntersect(shapeBounds, visibleBounds);
}

/**
 * Filter shapes to only those visible in the viewport
 * @param shapes Array of shapes with getBounds() method
 * @param viewport Current viewport state
 * @param canvasWidth Canvas width in screen pixels
 * @param canvasHeight Canvas height in screen pixels
 * @returns Filtered array of visible shapes
 */
export function filterVisibleShapes<T extends BoundedObject>(
  shapes: T[],
  viewport: Viewport,
  canvasWidth: number,
  canvasHeight: number
): T[] {
  // Calculate visible bounds once
  const visibleBounds = getVisibleBounds(viewport, canvasWidth, canvasHeight);

  // Filter shapes by visibility
  return shapes.filter(shape => {
    const shapeBounds = shape.getBounds();
    return isShapeVisible(shapeBounds, visibleBounds);
  });
}

/**
 * Count visible shapes (useful for performance monitoring)
 */
export function countVisibleShapes<T extends BoundedObject>(
  shapes: T[],
  viewport: Viewport,
  canvasWidth: number,
  canvasHeight: number
): number {
  const visibleBounds = getVisibleBounds(viewport, canvasWidth, canvasHeight);

  let count = 0;
  for (const shape of shapes) {
    const shapeBounds = shape.getBounds();
    if (isShapeVisible(shapeBounds, visibleBounds)) {
      count++;
    }
  }

  return count;
}

/**
 * Add margin to visible bounds to include shapes slightly outside viewport
 * This prevents popping when shapes are partially visible
 * @param visibleBounds Current visible bounds
 * @param marginPercent Margin as percentage of bounds size (default 10%)
 * @returns Expanded bounding box
 */
export function addMarginToVisibleBounds(
  visibleBounds: BoundingBox,
  marginPercent: number = 10
): BoundingBox {
  const marginX = visibleBounds.width * (marginPercent / 100);
  const marginY = visibleBounds.height * (marginPercent / 100);

  return {
    x: visibleBounds.x - marginX,
    y: visibleBounds.y - marginY,
    width: visibleBounds.width + marginX * 2,
    height: visibleBounds.height + marginY * 2
  };
}
