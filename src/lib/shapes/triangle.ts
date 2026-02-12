/**
 * Triangle shape implementation
 */

import type { TriangleShape, BoundingBox } from '../types';
import { applyStrokeStyle } from '../canvas/strokeStyles';

/**
 * Render a triangle shape to canvas
 */
export function renderTriangle(
  ctx: CanvasRenderingContext2D,
  shape: TriangleShape
): void {
  ctx.save();

  // Apply opacity
  ctx.globalAlpha = shape.opacity;

  // Calculate triangle points (equilateral-ish triangle)
  const x1 = shape.x + shape.width / 2; // Top center
  const y1 = shape.y;
  const x2 = shape.x; // Bottom left
  const y2 = shape.y + shape.height;
  const x3 = shape.x + shape.width; // Bottom right
  const y3 = shape.y + shape.height;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();

  // Draw fill
  if (shape.fillColor && shape.fillColor !== 'transparent') {
    ctx.fillStyle = shape.fillColor;
    ctx.fill();
  }

  // Draw stroke
  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    applyStrokeStyle(ctx, shape.strokeStyle);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Get bounding box for a triangle
 */
export function getTriangleBounds(shape: TriangleShape): BoundingBox {
  const halfStroke = shape.strokeWidth / 2;
  return {
    x: shape.x - halfStroke,
    y: shape.y - halfStroke,
    width: shape.width + shape.strokeWidth,
    height: shape.height + shape.strokeWidth,
  };
}

/**
 * Check if a point is inside a triangle
 */
export function triangleContainsPoint(
  shape: TriangleShape,
  x: number,
  y: number
): boolean {
  // Calculate triangle points
  const x1 = shape.x + shape.width / 2;
  const y1 = shape.y;
  const x2 = shape.x;
  const y2 = shape.y + shape.height;
  const x3 = shape.x + shape.width;
  const y3 = shape.y + shape.height;

  // Use barycentric coordinates to check if point is inside triangle
  const denom = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
  const a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / denom;
  const b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / denom;
  const c = 1 - a - b;

  return a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1;
}

/**
 * Create a new triangle shape
 */
export function createTriangle(
  x: number,
  y: number,
  width: number,
  height: number,
  style: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted' | 'dashed-small' | 'dashed-large' | 'dash-dot' | 'dash-dot-dot';
    fillColor: string;
    opacity: number;
    roughness?: number;
  }
): TriangleShape {
  return {
    id: crypto.randomUUID(),
    type: 'triangle',
    x,
    y,
    width,
    height,
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeStyle: style.strokeStyle,
    fillColor: style.fillColor,
    opacity: style.opacity,
    roughness: style.roughness ?? 1,
  };
}
