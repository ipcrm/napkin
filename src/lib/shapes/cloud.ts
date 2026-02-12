/**
 * Cloud shape implementation (rounded cloud shape)
 */

import type { CloudShape, BoundingBox } from '../types';
import { applyStrokeStyle } from '../canvas/strokeStyles';

/**
 * Render a cloud shape to canvas
 */
export function renderCloud(
  ctx: CanvasRenderingContext2D,
  shape: CloudShape
): void {
  ctx.save();

  // Apply opacity
  ctx.globalAlpha = shape.opacity;

  const x = shape.x;
  const y = shape.y;
  const w = shape.width;
  const h = shape.height;

  // Cloud is made of overlapping circles
  ctx.beginPath();

  // Bottom arc
  ctx.arc(x + w * 0.25, y + h * 0.6, h * 0.35, 0, Math.PI * 2);
  ctx.arc(x + w * 0.5, y + h * 0.6, h * 0.35, 0, Math.PI * 2);
  ctx.arc(x + w * 0.75, y + h * 0.6, h * 0.35, 0, Math.PI * 2);

  // Top arcs
  ctx.arc(x + w * 0.35, y + h * 0.35, h * 0.3, 0, Math.PI * 2);
  ctx.arc(x + w * 0.65, y + h * 0.35, h * 0.3, 0, Math.PI * 2);

  // Center large arc
  ctx.arc(x + w * 0.5, y + h * 0.45, h * 0.4, 0, Math.PI * 2);

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
 * Get bounding box for a cloud
 */
export function getCloudBounds(shape: CloudShape): BoundingBox {
  const halfStroke = shape.strokeWidth / 2;
  return {
    x: shape.x - halfStroke,
    y: shape.y - halfStroke,
    width: shape.width + shape.strokeWidth,
    height: shape.height + shape.strokeWidth,
  };
}

/**
 * Check if a point is inside a cloud (approximate)
 */
export function cloudContainsPoint(
  shape: CloudShape,
  x: number,
  y: number
): boolean {
  // Simplified hit detection - check if inside bounding box
  // and within any of the circles that make up the cloud
  const w = shape.width;
  const h = shape.height;

  const circles = [
    { cx: shape.x + w * 0.25, cy: shape.y + h * 0.6, r: h * 0.35 },
    { cx: shape.x + w * 0.5, cy: shape.y + h * 0.6, r: h * 0.35 },
    { cx: shape.x + w * 0.75, cy: shape.y + h * 0.6, r: h * 0.35 },
    { cx: shape.x + w * 0.35, cy: shape.y + h * 0.35, r: h * 0.3 },
    { cx: shape.x + w * 0.65, cy: shape.y + h * 0.35, r: h * 0.3 },
    { cx: shape.x + w * 0.5, cy: shape.y + h * 0.45, r: h * 0.4 },
  ];

  // Check if point is inside any circle
  for (const circle of circles) {
    const dx = x - circle.cx;
    const dy = y - circle.cy;
    if (dx * dx + dy * dy <= circle.r * circle.r) {
      return true;
    }
  }

  return false;
}

/**
 * Create a new cloud shape
 */
export function createCloud(
  x: number,
  y: number,
  width: number,
  height: number,
  style: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted' | 'dashed-small' | 'dashed-large' | 'dash-dot' | 'dash-dot-dot';
    fillColor: string;
    fillStyle?: string;
    opacity: number;
    roughness?: number;
  }
): CloudShape {
  return {
    id: crypto.randomUUID(),
    type: 'cloud',
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
