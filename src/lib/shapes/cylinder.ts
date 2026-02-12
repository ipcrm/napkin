/**
 * Cylinder shape implementation (3D cylinder)
 */

import type { CylinderShape, BoundingBox } from '../types';
import { applyStrokeStyle } from '../canvas/strokeStyles';

/**
 * Render a cylinder shape to canvas
 */
export function renderCylinder(
  ctx: CanvasRenderingContext2D,
  shape: CylinderShape
): void {
  ctx.save();

  // Apply opacity
  ctx.globalAlpha = shape.opacity;

  const x = shape.x;
  const y = shape.y;
  const w = shape.width;
  const h = shape.height;
  const ellipseHeight = h * 0.15; // Height of top/bottom ellipse

  // Top ellipse
  ctx.beginPath();
  ctx.ellipse(
    x + w / 2,
    y + ellipseHeight / 2,
    w / 2,
    ellipseHeight / 2,
    0,
    0,
    Math.PI * 2
  );

  // Draw fill for top
  if (shape.fillColor && shape.fillColor !== 'transparent') {
    ctx.fillStyle = shape.fillColor;
    ctx.fill();
  }

  // Draw stroke for top
  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    applyStrokeStyle(ctx, shape.strokeStyle);
    ctx.stroke();
  }

  // Sides
  ctx.beginPath();
  ctx.moveTo(x, y + ellipseHeight / 2);
  ctx.lineTo(x, y + h - ellipseHeight / 2);
  ctx.moveTo(x + w, y + ellipseHeight / 2);
  ctx.lineTo(x + w, y + h - ellipseHeight / 2);

  // Draw stroke for sides
  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    applyStrokeStyle(ctx, shape.strokeStyle);
    ctx.stroke();
  }

  // Bottom ellipse
  ctx.beginPath();
  ctx.ellipse(
    x + w / 2,
    y + h - ellipseHeight / 2,
    w / 2,
    ellipseHeight / 2,
    0,
    0,
    Math.PI * 2
  );

  // Draw fill for bottom
  if (shape.fillColor && shape.fillColor !== 'transparent') {
    ctx.fillStyle = shape.fillColor;
    ctx.fill();
  }

  // Draw stroke for bottom
  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    applyStrokeStyle(ctx, shape.strokeStyle);
    ctx.stroke();
  }

  // Fill the middle section
  if (shape.fillColor && shape.fillColor !== 'transparent') {
    ctx.fillStyle = shape.fillColor;
    ctx.fillRect(x, y + ellipseHeight / 2, w, h - ellipseHeight);
  }

  ctx.restore();
}

/**
 * Get bounding box for a cylinder
 */
export function getCylinderBounds(shape: CylinderShape): BoundingBox {
  const halfStroke = shape.strokeWidth / 2;
  return {
    x: shape.x - halfStroke,
    y: shape.y - halfStroke,
    width: shape.width + shape.strokeWidth,
    height: shape.height + shape.strokeWidth,
  };
}

/**
 * Check if a point is inside a cylinder
 */
export function cylinderContainsPoint(
  shape: CylinderShape,
  x: number,
  y: number
): boolean {
  const w = shape.width;
  const h = shape.height;
  const ellipseHeight = h * 0.15;

  // Check if inside bounding box
  if (
    x < shape.x ||
    x > shape.x + w ||
    y < shape.y ||
    y > shape.y + h
  ) {
    return false;
  }

  // Check if in middle section
  if (
    y >= shape.y + ellipseHeight / 2 &&
    y <= shape.y + h - ellipseHeight / 2
  ) {
    return true;
  }

  // Check if in top ellipse
  if (y < shape.y + ellipseHeight / 2) {
    const cx = shape.x + w / 2;
    const cy = shape.y + ellipseHeight / 2;
    const rx = w / 2;
    const ry = ellipseHeight / 2;
    const normalized =
      Math.pow(x - cx, 2) / Math.pow(rx, 2) +
      Math.pow(y - cy, 2) / Math.pow(ry, 2);
    return normalized <= 1;
  }

  // Check if in bottom ellipse
  if (y > shape.y + h - ellipseHeight / 2) {
    const cx = shape.x + w / 2;
    const cy = shape.y + h - ellipseHeight / 2;
    const rx = w / 2;
    const ry = ellipseHeight / 2;
    const normalized =
      Math.pow(x - cx, 2) / Math.pow(rx, 2) +
      Math.pow(y - cy, 2) / Math.pow(ry, 2);
    return normalized <= 1;
  }

  return false;
}

/**
 * Create a new cylinder shape
 */
export function createCylinder(
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
): CylinderShape {
  return {
    id: crypto.randomUUID(),
    type: 'cylinder',
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
