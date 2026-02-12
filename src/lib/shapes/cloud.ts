/**
 * Cloud shape implementation (single closed bezier path)
 */

import type { CloudShape, BoundingBox } from '../types';
import { applyStrokeStyle } from '../canvas/strokeStyles';

/**
 * Build the cloud outline as an SVG path string.
 * Used by rough.js (rc.path) and export renderer.
 */
export function getCloudSvgPath(x: number, y: number, w: number, h: number): string {
  return [
    `M ${x + w * 0.20} ${y + h * 0.80}`,
    // bottom edge
    `C ${x + w * 0.40} ${y + h * 0.92}, ${x + w * 0.60} ${y + h * 0.92}, ${x + w * 0.80} ${y + h * 0.80}`,
    // right bump
    `C ${x + w * 1.00} ${y + h * 0.74}, ${x + w * 1.05} ${y + h * 0.48}, ${x + w * 0.85} ${y + h * 0.38}`,
    // top-right bump
    `C ${x + w * 0.92} ${y + h * 0.12}, ${x + w * 0.72} ${y + h * 0.05}, ${x + w * 0.60} ${y + h * 0.22}`,
    // top-center bump
    `C ${x + w * 0.55} ${y + h * 0.00}, ${x + w * 0.40} ${y + h * 0.00}, ${x + w * 0.35} ${y + h * 0.18}`,
    // top-left bump
    `C ${x + w * 0.22} ${y + h * 0.02}, ${x + w * 0.08} ${y + h * 0.15}, ${x + w * 0.12} ${y + h * 0.38}`,
    // left bump
    `C ${x + w * -0.05} ${y + h * 0.45}, ${x + w * 0.00} ${y + h * 0.74}, ${x + w * 0.20} ${y + h * 0.80}`,
    'Z',
  ].join(' ');
}

/**
 * Trace the cloud outline on a Canvas2D context (for fill/stroke).
 */
export function traceCloudPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x + w * 0.20, y + h * 0.80);
  // bottom edge
  ctx.bezierCurveTo(x + w * 0.40, y + h * 0.92, x + w * 0.60, y + h * 0.92, x + w * 0.80, y + h * 0.80);
  // right bump
  ctx.bezierCurveTo(x + w * 1.00, y + h * 0.74, x + w * 1.05, y + h * 0.48, x + w * 0.85, y + h * 0.38);
  // top-right bump
  ctx.bezierCurveTo(x + w * 0.92, y + h * 0.12, x + w * 0.72, y + h * 0.05, x + w * 0.60, y + h * 0.22);
  // top-center bump
  ctx.bezierCurveTo(x + w * 0.55, y + h * 0.00, x + w * 0.40, y + h * 0.00, x + w * 0.35, y + h * 0.18);
  // top-left bump
  ctx.bezierCurveTo(x + w * 0.22, y + h * 0.02, x + w * 0.08, y + h * 0.15, x + w * 0.12, y + h * 0.38);
  // left bump
  ctx.bezierCurveTo(x + w * -0.05, y + h * 0.45, x + w * 0.00, y + h * 0.74, x + w * 0.20, y + h * 0.80);
  ctx.closePath();
}

/**
 * Render a cloud shape to canvas
 */
export function renderCloud(
  ctx: CanvasRenderingContext2D,
  shape: CloudShape
): void {
  ctx.save();
  ctx.globalAlpha = shape.opacity;

  traceCloudPath(ctx, shape.x, shape.y, shape.width, shape.height);

  if (shape.fillColor && shape.fillColor !== 'transparent') {
    ctx.fillStyle = shape.fillColor;
    ctx.fill();
  }

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
 * Check if a point is inside the cloud path
 */
export function cloudContainsPoint(
  shape: CloudShape,
  px: number,
  py: number
): boolean {
  // Use an offscreen canvas to do path-based hit testing
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  traceCloudPath(ctx, shape.x, shape.y, shape.width, shape.height);
  return ctx.isPointInPath(px, py);
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
