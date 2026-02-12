/**
 * Diamond/Rhombus shape implementation
 */

import type { DiamondShape, BoundingBox } from '../types';
import { applyStrokeStyle } from '../canvas/strokeStyles';

/**
 * Render a diamond shape to canvas
 */
export function renderDiamond(
  ctx: CanvasRenderingContext2D,
  shape: DiamondShape
): void {
  ctx.save();

  // Apply opacity
  ctx.globalAlpha = shape.opacity;

  // Calculate diamond points
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const x1 = cx; // Top
  const y1 = shape.y;
  const x2 = shape.x + shape.width; // Right
  const y2 = cy;
  const x3 = cx; // Bottom
  const y3 = shape.y + shape.height;
  const x4 = shape.x; // Left
  const y4 = cy;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
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
 * Get bounding box for a diamond
 */
export function getDiamondBounds(shape: DiamondShape): BoundingBox {
  const halfStroke = shape.strokeWidth / 2;
  return {
    x: shape.x - halfStroke,
    y: shape.y - halfStroke,
    width: shape.width + shape.strokeWidth,
    height: shape.height + shape.strokeWidth,
  };
}

/**
 * Check if a point is inside a diamond
 */
export function diamondContainsPoint(
  shape: DiamondShape,
  x: number,
  y: number
): boolean {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;

  // Diamond can be checked by seeing if the point is within the rotated square
  // Distance formula: |x-cx|/halfWidth + |y-cy|/halfHeight <= 1
  const dx = Math.abs(x - cx) / (shape.width / 2);
  const dy = Math.abs(y - cy) / (shape.height / 2);

  return dx + dy <= 1;
}

/**
 * Create a new diamond shape
 */
export function createDiamond(
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
): DiamondShape {
  return {
    id: crypto.randomUUID(),
    type: 'diamond',
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
