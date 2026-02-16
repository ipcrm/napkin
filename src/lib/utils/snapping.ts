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
  // For spacing indicators: start and end of the measured gap
  start?: number;
  end?: number;
  spacing?: boolean; // true if this is a spacing indicator
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

  const invZoom = 1 / viewport.zoom;

  for (const guide of guides) {
    if (guide.spacing && guide.start !== undefined && guide.end !== undefined) {
      // Draw spacing indicator
      ctx.strokeStyle = '#FF4081';
      ctx.fillStyle = '#FF4081';
      ctx.lineWidth = 1 * invZoom;
      ctx.setLineDash([]);

      const arrowSize = 4 * invZoom;

      if (guide.type === 'vertical') {
        // Horizontal spacing indicator (between shapes arranged horizontally)
        const midY = guide.position; // We'll use position as midY hint; draw at a sensible y
        const y = viewport.y + canvasHeight / viewport.zoom / 2; // default to center if no better info
        ctx.beginPath();
        ctx.moveTo(guide.start, guide.position);
        ctx.lineTo(guide.end, guide.position);
        ctx.stroke();

        // Arrow caps
        ctx.beginPath();
        ctx.moveTo(guide.start + arrowSize, guide.position - arrowSize);
        ctx.lineTo(guide.start, guide.position);
        ctx.lineTo(guide.start + arrowSize, guide.position + arrowSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(guide.end - arrowSize, guide.position - arrowSize);
        ctx.lineTo(guide.end, guide.position);
        ctx.lineTo(guide.end - arrowSize, guide.position + arrowSize);
        ctx.stroke();
      } else {
        // Vertical spacing indicator
        ctx.beginPath();
        ctx.moveTo(guide.position, guide.start);
        ctx.lineTo(guide.position, guide.end);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(guide.position - arrowSize, guide.start + arrowSize);
        ctx.lineTo(guide.position, guide.start);
        ctx.lineTo(guide.position + arrowSize, guide.start + arrowSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(guide.position - arrowSize, guide.end - arrowSize);
        ctx.lineTo(guide.position, guide.end);
        ctx.lineTo(guide.position + arrowSize, guide.end - arrowSize);
        ctx.stroke();
      }

      // Draw label
      if (guide.label) {
        ctx.font = `${10 * invZoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const labelX = guide.type === 'vertical'
          ? (guide.start + guide.end) / 2
          : guide.position;
        const labelY = guide.type === 'vertical'
          ? guide.position - 8 * invZoom
          : (guide.start + guide.end) / 2;
        ctx.fillText(guide.label, labelX, labelY);
      }
    } else {
      // Standard alignment guide line
      ctx.strokeStyle = '#FF4081';
      ctx.lineWidth = 1 * invZoom;
      ctx.setLineDash([5 * invZoom, 5 * invZoom]);

      ctx.beginPath();
      if (guide.type === 'vertical') {
        ctx.moveTo(guide.position, viewport.y);
        ctx.lineTo(guide.position, viewport.y + canvasHeight / viewport.zoom);
      } else {
        ctx.moveTo(viewport.x, guide.position);
        ctx.lineTo(viewport.x + canvasWidth / viewport.zoom, guide.position);
      }
      ctx.stroke();
    }
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
  otherShapes: Shape[],
  config: SnappingConfig = DEFAULT_SNAPPING_CONFIG
): SnapResult {
  if (!config.snapToSpacing || otherShapes.length < 2) {
    return calculateSnapPosition(movingShape, targetX, targetY, otherShapes, config);
  }

  // Start with alignment snapping
  const alignResult = calculateSnapPosition(movingShape, targetX, targetY, otherShapes, config);

  const movingBounds = getShapeBounds(movingShape);
  const movingW = movingBounds.width;
  const movingH = movingBounds.height;

  // Get bounds of all non-selected shapes, sorted by position
  const otherBounds = otherShapes
    .filter(s => s.id !== movingShape.id)
    .map(s => ({ id: s.id, bounds: getShapeBounds(s) }));

  let snapX = alignResult.x !== targetX ? alignResult.x : null;
  let snapY = alignResult.y !== targetY ? alignResult.y : null;
  const guides = [...alignResult.guides];

  // Use a wider threshold for spacing snap (2x alignment threshold) to make it easier to trigger
  const spacingThreshold = config.threshold * 2;
  const GAP_TOLERANCE = 2; // px tolerance when comparing gap distances

  // Helper: add spacing guides for ALL adjacent pairs that match a given gap distance
  function addAllMatchingHorizontalGaps(
    sortedX: Array<{ cx: number; left: number; right: number; top: number; bottom: number }>,
    matchGap: number,
    midY: number
  ) {
    for (let j = 0; j < sortedX.length - 1; j++) {
      const p = sortedX[j];
      const q = sortedX[j + 1];
      const pairGap = q.left - p.right;
      if (pairGap > 0 && Math.abs(pairGap - matchGap) < GAP_TOLERANCE) {
        guides.push({
          type: 'vertical', position: midY,
          start: p.right, end: q.left,
          spacing: true, label: `${Math.round(pairGap)}`,
        });
      }
    }
  }

  function addAllMatchingVerticalGaps(
    sortedY: Array<{ cy: number; top: number; bottom: number; left: number; right: number }>,
    matchGap: number,
    midX: number
  ) {
    for (let j = 0; j < sortedY.length - 1; j++) {
      const p = sortedY[j];
      const q = sortedY[j + 1];
      const pairGap = q.top - p.bottom;
      if (pairGap > 0 && Math.abs(pairGap - matchGap) < GAP_TOLERANCE) {
        guides.push({
          type: 'horizontal', position: midX,
          start: p.bottom, end: q.top,
          spacing: true, label: `${Math.round(pairGap)}`,
        });
      }
    }
  }

  // Check horizontal equal spacing (X axis)
  if (snapX === null) {
    const sortedX = otherBounds
      .map(o => ({ cx: o.bounds.x + o.bounds.width / 2, left: o.bounds.x, right: o.bounds.x + o.bounds.width, top: o.bounds.y, bottom: o.bounds.y + o.bounds.height }))
      .sort((a, b) => a.cx - b.cx);

    // For each pair of adjacent shapes, check if placing our shape between them creates equal spacing
    for (let i = 0; i < sortedX.length - 1; i++) {
      const a = sortedX[i];
      const b = sortedX[i + 1];
      const gapAB = b.left - a.right;

      if (gapAB <= 0) continue;

      // Check placing shape between a and b
      const idealLeft = a.right + (gapAB - movingW) / 2;
      const midY = targetY + movingH / 2;
      if (Math.abs(targetX - idealLeft) < spacingThreshold) {
        snapX = idealLeft;
        const matchGap = idealLeft - a.right;
        // Add guides for the gaps adjacent to the moving shape
        guides.push({
          type: 'vertical', position: midY,
          start: a.right, end: idealLeft,
          spacing: true, label: `${Math.round(matchGap)}`,
        });
        guides.push({
          type: 'vertical', position: midY,
          start: idealLeft + movingW, end: b.left,
          spacing: true, label: `${Math.round(b.left - idealLeft - movingW)}`,
        });
        // Also show ALL other matching gaps in the sorted list
        addAllMatchingHorizontalGaps(sortedX, matchGap, midY);
        break;
      }

      // Check if placing to the left of a creates equal gap to a that matches gapAB
      const idealLeftOfA = a.left - gapAB - movingW;
      if (Math.abs(targetX - idealLeftOfA) < spacingThreshold) {
        snapX = idealLeftOfA;
        guides.push({
          type: 'vertical', position: midY,
          start: idealLeftOfA + movingW, end: a.left,
          spacing: true, label: `${Math.round(gapAB)}`,
        });
        addAllMatchingHorizontalGaps(sortedX, gapAB, midY);
        break;
      }

      // Check if placing to the right of b creates equal gap
      const idealRightOfB = b.right + gapAB;
      if (Math.abs(targetX - idealRightOfB) < spacingThreshold) {
        snapX = idealRightOfB;
        guides.push({
          type: 'vertical', position: midY,
          start: b.right, end: idealRightOfB,
          spacing: true, label: `${Math.round(gapAB)}`,
        });
        addAllMatchingHorizontalGaps(sortedX, gapAB, midY);
        break;
      }
    }
  }

  // Check vertical equal spacing (Y axis)
  if (snapY === null) {
    const sortedY = otherBounds
      .map(o => ({ cy: o.bounds.y + o.bounds.height / 2, top: o.bounds.y, bottom: o.bounds.y + o.bounds.height, left: o.bounds.x, right: o.bounds.x + o.bounds.width }))
      .sort((a, b) => a.cy - b.cy);

    for (let i = 0; i < sortedY.length - 1; i++) {
      const a = sortedY[i];
      const b = sortedY[i + 1];
      const gapAB = b.top - a.bottom;

      if (gapAB <= 0) continue;

      const midX = targetX + movingW / 2;
      const idealTop = a.bottom + (gapAB - movingH) / 2;
      if (Math.abs(targetY - idealTop) < spacingThreshold) {
        snapY = idealTop;
        const matchGap = idealTop - a.bottom;
        guides.push({
          type: 'horizontal', position: midX,
          start: a.bottom, end: idealTop,
          spacing: true, label: `${Math.round(matchGap)}`,
        });
        guides.push({
          type: 'horizontal', position: midX,
          start: idealTop + movingH, end: b.top,
          spacing: true, label: `${Math.round(b.top - idealTop - movingH)}`,
        });
        addAllMatchingVerticalGaps(sortedY, matchGap, midX);
        break;
      }

      const idealAboveA = a.top - gapAB - movingH;
      if (Math.abs(targetY - idealAboveA) < spacingThreshold) {
        snapY = idealAboveA;
        guides.push({
          type: 'horizontal', position: midX,
          start: idealAboveA + movingH, end: a.top,
          spacing: true, label: `${Math.round(gapAB)}`,
        });
        addAllMatchingVerticalGaps(sortedY, gapAB, midX);
        break;
      }

      const idealBelowB = b.bottom + gapAB;
      if (Math.abs(targetY - idealBelowB) < spacingThreshold) {
        snapY = idealBelowB;
        guides.push({
          type: 'horizontal', position: midX,
          start: b.bottom, end: idealBelowB,
          spacing: true, label: `${Math.round(gapAB)}`,
        });
        addAllMatchingVerticalGaps(sortedY, gapAB, midX);
        break;
      }
    }
  }

  return {
    x: snapX !== null ? snapX : alignResult.x,
    y: snapY !== null ? snapY : alignResult.y,
    snapped: snapX !== null || snapY !== null || alignResult.snapped,
    guides,
  };
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
