/**
 * Star shape implementation (5-point star)
 */

import type { StarShape, BoundingBox } from '../types';
import { applyStrokeStyle } from '../canvas/strokeStyles';

/**
 * Render a star shape to canvas
 */
export function renderStar(
  ctx: CanvasRenderingContext2D,
  shape: StarShape
): void {
  ctx.save();

  // Apply opacity
  ctx.globalAlpha = shape.opacity;

  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const outerRadius = Math.min(shape.width, shape.height) / 2;
  const innerRadius = outerRadius * 0.4; // Inner radius is 40% of outer
  const points = 5;

  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + radius * Math.cos(angle) * (shape.width / shape.height);
    const y = cy + radius * Math.sin(angle);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
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
 * Get bounding box for a star
 */
export function getStarBounds(shape: StarShape): BoundingBox {
  const halfStroke = shape.strokeWidth / 2;
  return {
    x: shape.x - halfStroke,
    y: shape.y - halfStroke,
    width: shape.width + shape.strokeWidth,
    height: shape.height + shape.strokeWidth,
  };
}

/**
 * Check if a point is inside a star
 */
export function starContainsPoint(
  shape: StarShape,
  x: number,
  y: number
): boolean {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const outerRadius = Math.min(shape.width, shape.height) / 2;
  const innerRadius = outerRadius * 0.4;
  const points = 5;

  // Create star vertices
  const vertices: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    vertices.push({
      x: cx + radius * Math.cos(angle) * (shape.width / shape.height),
      y: cy + radius * Math.sin(angle),
    });
  }

  // Use ray casting algorithm
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x,
      yi = vertices[i].y;
    const xj = vertices[j].x,
      yj = vertices[j].y;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Create a new star shape
 */
export function createStar(
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
): StarShape {
  return {
    id: crypto.randomUUID(),
    type: 'star',
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
