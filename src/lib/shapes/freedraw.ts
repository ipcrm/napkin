/**
 * Freedraw shape implementation
 */

import type { FreedrawShape, BoundingBox } from '../types';
import { applyStrokeStyle } from '../canvas/strokeStyles';

/**
 * Render a freedraw shape to canvas
 */
export function renderFreedraw(ctx: CanvasRenderingContext2D, shape: FreedrawShape): void {
  if (!shape.points || shape.points.length < 2) return;

  ctx.save();

  // Apply opacity
  ctx.globalAlpha = shape.opacity;

  // Draw path
  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    applyStrokeStyle(ctx, shape.strokeStyle);

    ctx.beginPath();
    ctx.moveTo(shape.points[0].x, shape.points[0].y);

    for (let i = 1; i < shape.points.length; i++) {
      ctx.lineTo(shape.points[i].x, shape.points[i].y);
    }

    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Get bounding box for a freedraw shape
 */
export function getFreedrawBounds(shape: FreedrawShape): BoundingBox {
  if (!shape.points || shape.points.length === 0) {
    return { x: shape.x, y: shape.y, width: 0, height: 0 };
  }

  const halfStroke = shape.strokeWidth / 2;
  let minX = shape.points[0].x;
  let minY = shape.points[0].y;
  let maxX = shape.points[0].x;
  let maxY = shape.points[0].y;

  for (let i = 1; i < shape.points.length; i++) {
    minX = Math.min(minX, shape.points[i].x);
    minY = Math.min(minY, shape.points[i].y);
    maxX = Math.max(maxX, shape.points[i].x);
    maxY = Math.max(maxY, shape.points[i].y);
  }

  return {
    x: minX - halfStroke,
    y: minY - halfStroke,
    width: maxX - minX + shape.strokeWidth,
    height: maxY - minY + shape.strokeWidth,
  };
}

/**
 * Check if a point is near a freedraw path (within threshold distance)
 */
export function freedrawContainsPoint(
  shape: FreedrawShape,
  x: number,
  y: number,
  threshold: number = 5
): boolean {
  if (!shape.points || shape.points.length < 2) return false;

  // Check if point is near any line segment in the path
  for (let i = 0; i < shape.points.length - 1; i++) {
    const p1 = shape.points[i];
    const p2 = shape.points[i + 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) continue;

    let t = ((x - p1.x) * dx + (y - p1.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const closestX = p1.x + t * dx;
    const closestY = p1.y + t * dy;

    const dist = Math.sqrt(Math.pow(x - closestX, 2) + Math.pow(y - closestY, 2));

    if (dist <= threshold + shape.strokeWidth / 2) {
      return true;
    }
  }

  return false;
}

/**
 * Simplify a path using the Ramer-Douglas-Peucker algorithm
 * @param points - Array of points to simplify
 * @param epsilon - Distance threshold for simplification
 * @returns Simplified array of points
 */
export function simplifyPath(
  points: Array<{ x: number; y: number }>,
  epsilon: number = 2.0
): Array<{ x: number; y: number }> {
  if (points.length < 3) return points;

  /**
   * Calculate perpendicular distance from point to line segment
   */
  function perpendicularDistance(
    point: { x: number; y: number },
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number }
  ): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;

    const numerator = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
    const denominator = Math.sqrt(dx * dx + dy * dy);

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Recursive RDP algorithm
   */
  function rdp(
    points: Array<{ x: number; y: number }>,
    startIndex: number,
    endIndex: number,
    epsilon: number
  ): Array<{ x: number; y: number }> {
    if (endIndex - startIndex <= 1) {
      return [points[startIndex], points[endIndex]];
    }

    let maxDistance = 0;
    let maxIndex = startIndex;

    for (let i = startIndex + 1; i < endIndex; i++) {
      const distance = perpendicularDistance(points[i], points[startIndex], points[endIndex]);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    if (maxDistance > epsilon) {
      const left = rdp(points, startIndex, maxIndex, epsilon);
      const right = rdp(points, maxIndex, endIndex, epsilon);
      return [...left.slice(0, -1), ...right];
    } else {
      return [points[startIndex], points[endIndex]];
    }
  }

  return rdp(points, 0, points.length - 1, epsilon);
}

/**
 * Create a new freedraw shape
 */
export function createFreedraw(
  points: Array<{ x: number; y: number }>,
  style: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    fillColor: string;
    opacity: number;
    roughness?: number;
  }
): FreedrawShape {
  const bounds = points.length > 0
    ? {
        minX: Math.min(...points.map(p => p.x)),
        minY: Math.min(...points.map(p => p.y)),
      }
    : { minX: 0, minY: 0 };

  return {
    id: crypto.randomUUID(),
    type: 'freedraw',
    x: bounds.minX,
    y: bounds.minY,
    points,
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeStyle: style.strokeStyle,
    fillColor: style.fillColor, // Not used for freedraw, but required by interface
    opacity: style.opacity,
    roughness: style.roughness ?? 1,
  };
}
