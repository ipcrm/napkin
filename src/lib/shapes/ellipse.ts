/**
 * Ellipse shape implementation
 */

import type { EllipseShape, BoundingBox } from '../types';
import { applyStrokeStyle } from '../canvas/strokeStyles';

/**
 * Render an ellipse shape to canvas
 */
export function renderEllipse(
  ctx: CanvasRenderingContext2D,
  shape: EllipseShape
): void {
  ctx.save();

  // Apply opacity
  ctx.globalAlpha = shape.opacity;

  // Center point
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const rx = Math.abs(shape.width) / 2;
  const ry = Math.abs(shape.height) / 2;

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);

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
 * Get bounding box for an ellipse
 */
export function getEllipseBounds(shape: EllipseShape): BoundingBox {
  const halfStroke = shape.strokeWidth / 2;
  return {
    x: shape.x - halfStroke,
    y: shape.y - halfStroke,
    width: shape.width + shape.strokeWidth,
    height: shape.height + shape.strokeWidth,
  };
}

/**
 * Check if a point is inside an ellipse
 */
export function ellipseContainsPoint(
  shape: EllipseShape,
  x: number,
  y: number
): boolean {
  // Center point
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const rx = Math.abs(shape.width) / 2;
  const ry = Math.abs(shape.height) / 2;

  // Ellipse equation: (x-cx)^2/rx^2 + (y-cy)^2/ry^2 <= 1
  const normalized =
    Math.pow(x - cx, 2) / Math.pow(rx, 2) +
    Math.pow(y - cy, 2) / Math.pow(ry, 2);

  return normalized <= 1;
}

/**
 * Create a new ellipse shape
 */
export function createEllipse(
  x: number,
  y: number,
  width: number,
  height: number,
  style: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    fillColor: string;
    fillStyle?: string;
    opacity: number;
    roughness?: number;
  }
): EllipseShape {
  return {
    id: crypto.randomUUID(),
    type: 'ellipse',
    x,
    y,
    width,
    height,
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeStyle: style.strokeStyle,
    fillColor: style.fillColor,
    fillStyle: (style.fillStyle as any) || 'hachure',
    opacity: style.opacity,
    roughness: style.roughness ?? 1,
  };
}
