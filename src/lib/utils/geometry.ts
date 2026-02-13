/**
 * Geometric utility functions
 */

import type { BoundingBox, Viewport } from '$lib/types';

export interface Point {
  x: number;
  y: number;
}

// Helper function to check if bounding boxes intersect
export function boundingBoxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

// Helper function to expand bounding box by margin
export function expandBoundingBox(box: BoundingBox, margin: number): BoundingBox {
  return {
    x: box.x - margin,
    y: box.y - margin,
    width: box.width + margin * 2,
    height: box.height + margin * 2
  };
}

// Helper function to apply inverse viewport transform (screen to canvas)
export function inverseTransformPoint(point: Point, viewport: Viewport): Point {
  return {
    x: point.x / viewport.zoom + viewport.x,
    y: point.y / viewport.zoom + viewport.y
  };
}

// Helper function to apply viewport transform (canvas to screen)
export function transformPoint(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.x) * viewport.zoom,
    y: (point.y - viewport.y) * viewport.zoom
  };
}
