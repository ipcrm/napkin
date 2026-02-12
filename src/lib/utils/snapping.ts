/**
 * Smart guides and snapping utilities
 */

import type { Shape, BoundingBox } from '../types';
import { getShapeBounds } from '../shapes/bounds';

/**
 * Snap guide - a line shown when snapping occurs
 */
export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  position: number; // x for vertical, y for horizontal
  label?: string;
}

/**
 * Snap result - contains snapped position and guides to show
 */
export interface SnapResult {
  x: number;
  y: number;
  snapped: boolean;
  guides: SnapGuide[];
}

/**
 * Snapping configuration
 */
export interface SnappingConfig {
  enabled: boolean;
  threshold: number; // Distance threshold for snapping (default 5px)
  snapToEdges: boolean; // Snap to shape edges
  snapToCenters: boolean; // Snap to shape centers
  snapToSpacing: boolean; // Snap to equal spacing
}

/**
 * Default snapping configuration
 */
export const DEFAULT_SNAPPING_CONFIG: SnappingConfig = {
  enabled: true,
  threshold: 5,
  snapToEdges: true,
  snapToCenters: true,
  snapToSpacing: false
};

/**
 * Calculate snap positions for a shape being moved
 */
export function calculateSnapPosition(
  movingShape: Shape,
  targetX: number,
  targetY: number,
  otherShapes: Shape[],
  config: SnappingConfig = DEFAULT_SNAPPING_CONFIG
): SnapResult {
  if (!config.enabled) {
    return {
      x: targetX,
      y: targetY,
      snapped: false,
      guides: []
    };
  }

  const movingBounds = getShapeBounds(movingShape);
  const movingWidth = movingBounds.width;
  const movingHeight = movingBounds.height;

  // Calculate the shape's key positions at target location
  const movingLeft = targetX;
  const movingRight = targetX + movingWidth;
  const movingCenterX = targetX + movingWidth / 2;
  const movingTop = targetY;
  const movingBottom = targetY + movingHeight;
  const movingCenterY = targetY + movingHeight / 2;

  let snapX: number | null = null;
  let snapY: number | null = null;
  const guides: SnapGuide[] = [];

  // Check snapping against each other shape
  for (const other of otherShapes) {
    if (other.id === movingShape.id) continue;

    const otherBounds = getShapeBounds(other);
    const otherLeft = otherBounds.x;
    const otherRight = otherBounds.x + otherBounds.width;
    const otherCenterX = otherBounds.x + otherBounds.width / 2;
    const otherTop = otherBounds.y;
    const otherBottom = otherBounds.y + otherBounds.height;
    const otherCenterY = otherBounds.y + otherBounds.height / 2;

    // Snap X position
    if (snapX === null) {
      // Snap left edge to left edge
      if (config.snapToEdges && Math.abs(movingLeft - otherLeft) < config.threshold) {
        snapX = otherLeft;
        guides.push({ type: 'vertical', position: otherLeft, label: 'left' });
      }
      // Snap left edge to right edge
      else if (config.snapToEdges && Math.abs(movingLeft - otherRight) < config.threshold) {
        snapX = otherRight;
        guides.push({ type: 'vertical', position: otherRight });
      }
      // Snap right edge to left edge
      else if (config.snapToEdges && Math.abs(movingRight - otherLeft) < config.threshold) {
        snapX = otherLeft - movingWidth;
        guides.push({ type: 'vertical', position: otherLeft });
      }
      // Snap right edge to right edge
      else if (config.snapToEdges && Math.abs(movingRight - otherRight) < config.threshold) {
        snapX = otherRight - movingWidth;
        guides.push({ type: 'vertical', position: otherRight, label: 'right' });
      }
      // Snap center to center
      else if (config.snapToCenters && Math.abs(movingCenterX - otherCenterX) < config.threshold) {
        snapX = otherCenterX - movingWidth / 2;
        guides.push({ type: 'vertical', position: otherCenterX, label: 'center' });
      }
    }

    // Snap Y position
    if (snapY === null) {
      // Snap top edge to top edge
      if (config.snapToEdges && Math.abs(movingTop - otherTop) < config.threshold) {
        snapY = otherTop;
        guides.push({ type: 'horizontal', position: otherTop, label: 'top' });
      }
      // Snap top edge to bottom edge
      else if (config.snapToEdges && Math.abs(movingTop - otherBottom) < config.threshold) {
        snapY = otherBottom;
        guides.push({ type: 'horizontal', position: otherBottom });
      }
      // Snap bottom edge to top edge
      else if (config.snapToEdges && Math.abs(movingBottom - otherTop) < config.threshold) {
        snapY = otherTop - movingHeight;
        guides.push({ type: 'horizontal', position: otherTop });
      }
      // Snap bottom edge to bottom edge
      else if (config.snapToEdges && Math.abs(movingBottom - otherBottom) < config.threshold) {
        snapY = otherBottom - movingHeight;
        guides.push({ type: 'horizontal', position: otherBottom, label: 'bottom' });
      }
      // Snap center to center
      else if (config.snapToCenters && Math.abs(movingCenterY - otherCenterY) < config.threshold) {
        snapY = otherCenterY - movingHeight / 2;
        guides.push({ type: 'horizontal', position: otherCenterY, label: 'center' });
      }
    }

    // Break early if both axes snapped
    if (snapX !== null && snapY !== null) break;
  }

  return {
    x: snapX !== null ? snapX : targetX,
    y: snapY !== null ? snapY : targetY,
    snapped: snapX !== null || snapY !== null,
    guides: guides
  };
}

/**
 * Render snap guides on the canvas
 */
export function renderSnapGuides(
  ctx: CanvasRenderingContext2D,
  guides: SnapGuide[],
  viewport: { x: number; y: number; zoom: number },
  canvasWidth: number,
  canvasHeight: number
): void {
  ctx.save();

  ctx.strokeStyle = '#FF4081'; // Pink/magenta color for guides
  ctx.lineWidth = 1 / viewport.zoom; // Keep line width consistent regardless of zoom
  ctx.setLineDash([5 / viewport.zoom, 5 / viewport.zoom]);

  for (const guide of guides) {
    ctx.beginPath();
    if (guide.type === 'vertical') {
      const screenX = guide.position;
      ctx.moveTo(screenX, viewport.y);
      ctx.lineTo(screenX, viewport.y + canvasHeight / viewport.zoom);
    } else {
      const screenY = guide.position;
      ctx.moveTo(viewport.x, screenY);
      ctx.lineTo(viewport.x + canvasWidth / viewport.zoom, screenY);
    }
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Calculate distribution snapping (equal spacing between 3+ shapes)
 */
export function calculateDistributionSnap(
  movingShape: Shape,
  targetX: number,
  targetY: number,
  selectedShapes: Shape[],
  otherShapes: Shape[],
  config: SnappingConfig = DEFAULT_SNAPPING_CONFIG
): SnapResult {
  // Distribution snapping requires at least 2 other shapes to align with
  if (!config.snapToSpacing || selectedShapes.length < 2) {
    return calculateSnapPosition(movingShape, targetX, targetY, otherShapes, config);
  }

  // TODO: Implement equal spacing calculation
  // This is a complex feature that calculates equal spacing between shapes
  // For now, fall back to basic snapping
  return calculateSnapPosition(movingShape, targetX, targetY, otherShapes, config);
}

/**
 * Check if a value is within snapping threshold of target
 */
export function isWithinSnapThreshold(
  value: number,
  target: number,
  threshold: number = 5
): boolean {
  return Math.abs(value - target) < threshold;
}

/**
 * Snap a single coordinate value to the nearest grid point
 */
export function snapToGrid(
  value: number,
  gridSize: number,
  threshold: number = 5
): number {
  const snapped = Math.round(value / gridSize) * gridSize;
  if (Math.abs(value - snapped) < threshold) {
    return snapped;
  }
  return value;
}

/**
 * Snap a position to a grid
 */
export function snapPositionToGrid(
  x: number,
  y: number,
  gridSize: number,
  threshold: number = 5
): { x: number; y: number } {
  return {
    x: snapToGrid(x, gridSize, threshold),
    y: snapToGrid(y, gridSize, threshold)
  };
}
