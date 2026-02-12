/**
 * Line shape implementation
 */

import type { LineShape, BoundingBox, RoutingMode } from '../types';
import { applyStrokeStyle } from '../canvas/strokeStyles';
import { elbowPathContainsPoint, curvedPathContainsPoint, getRoutedBounds } from '../utils/routing';
import { drawEndpointShape, getEffectiveEndpoint } from '../canvas/endpointRenderer';

/**
 * Calculate text gap parameters for a line with a text label.
 * Returns gap endpoints or null if the line is too short for a gap.
 */
export function calculateLineTextGap(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  text: string,
  fontSize: number = 14,
  fontFamily: string = 'sans-serif'
): { gapStartX: number; gapStartY: number; gapEndX: number; gapEndY: number; midX: number; midY: number; textWidth: number; textHeight: number } | null {
  if (!text) return null;

  ctx.save();
  ctx.font = `${fontSize}px ${fontFamily}`;
  const lines = text.split('\n');
  let maxLineWidth = 0;
  for (const line of lines) {
    const metrics = ctx.measureText(line);
    maxLineWidth = Math.max(maxLineWidth, metrics.width);
  }
  const textWidth = maxLineWidth;
  const lineHeight = fontSize * 1.2;
  const textHeight = lines.length * lineHeight;
  ctx.restore();

  const paddingX = 8;
  const paddingY = 4;
  const totalGapWidth = textWidth + paddingX * 2;
  const totalGapHeight = textHeight + paddingY * 2;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lineLength = Math.sqrt(dx * dx + dy * dy);

  if (lineLength < totalGapWidth + 20) return null;

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const ux = dx / lineLength;
  const uy = dy / lineLength;

  const angle = Math.atan2(dy, dx);
  const cosA = Math.abs(Math.cos(angle));
  const sinA = Math.abs(Math.sin(angle));
  const halfGapAlongLine = (totalGapWidth / 2) * cosA + (totalGapHeight / 2) * sinA;

  return {
    gapStartX: midX - ux * halfGapAlongLine,
    gapStartY: midY - uy * halfGapAlongLine,
    gapEndX: midX + ux * halfGapAlongLine,
    gapEndY: midY + uy * halfGapAlongLine,
    midX, midY, textWidth, textHeight
  };
}

/**
 * Render a line shape to canvas, with text gap support
 */
export function renderLine(ctx: CanvasRenderingContext2D, shape: LineShape): void {
  ctx.save();

  // Apply opacity
  ctx.globalAlpha = shape.opacity;

  // Calculate text gap if text is present
  let gapInfo: ReturnType<typeof calculateLineTextGap> = null;
  if (shape.text) {
    gapInfo = calculateLineTextGap(ctx, shape.x, shape.y, shape.x2, shape.y2, shape.text);
  }

  // Draw line
  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    applyStrokeStyle(ctx, shape.strokeStyle);

    if (gapInfo) {
      // Draw two segments with a gap for text
      ctx.beginPath();
      ctx.moveTo(shape.x, shape.y);
      ctx.lineTo(gapInfo.gapStartX, gapInfo.gapStartY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(gapInfo.gapEndX, gapInfo.gapEndY);
      ctx.lineTo(shape.x2, shape.y2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(shape.x, shape.y);
      ctx.lineTo(shape.x2, shape.y2);
      ctx.stroke();
    }

    // Draw endpoint shapes for lines
    const dx = shape.x2 - shape.x;
    const dy = shape.y2 - shape.y;
    const angle = Math.atan2(dy, dx);

    const endEp = getEffectiveEndpoint(shape.endEndpoint, false, true);
    const startEp = getEffectiveEndpoint(shape.startEndpoint, false, false);

    if (endEp.shape !== 'none') {
      drawEndpointShape(ctx, shape.x2, shape.y2, angle, endEp.shape, endEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
    }

    if (startEp.shape !== 'none') {
      drawEndpointShape(ctx, shape.x, shape.y, angle + Math.PI, startEp.shape, startEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
    }
  }

  // Render text label at midpoint if present
  if (shape.text) {
    const midX = gapInfo ? gapInfo.midX : (shape.x + shape.x2) / 2;
    const midY = gapInfo ? gapInfo.midY : (shape.y + shape.y2) / 2;
    const fontSize = 14;
    const fontFamily = 'sans-serif';

    ctx.font = `${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(shape.text);
    const textWidth = gapInfo ? gapInfo.textWidth : metrics.width;
    const textHeight = gapInfo ? gapInfo.textHeight : fontSize * 1.2;
    const paddingX = 8;
    const paddingY = 4;

    // Draw background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(
      midX - textWidth / 2 - paddingX,
      midY - textHeight / 2 - paddingY,
      textWidth + paddingX * 2,
      textHeight + paddingY * 2
    );

    // Draw text
    ctx.fillStyle = shape.strokeColor || '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shape.text, midX, midY);
  }

  ctx.restore();
}

/**
 * Get bounding box for a line
 */
export function getLineBounds(shape: LineShape): BoundingBox {
  const mode = shape.routingMode || 'direct';
  if (mode !== 'direct') {
    return getRoutedBounds(shape.x, shape.y, shape.x2, shape.y2, mode, shape.controlPoints, shape.strokeWidth);
  }

  const halfStroke = shape.strokeWidth / 2;
  const minX = Math.min(shape.x, shape.x2);
  const minY = Math.min(shape.y, shape.y2);
  const maxX = Math.max(shape.x, shape.x2);
  const maxY = Math.max(shape.y, shape.y2);

  return {
    x: minX - halfStroke,
    y: minY - halfStroke,
    width: maxX - minX + shape.strokeWidth,
    height: maxY - minY + shape.strokeWidth,
  };
}

/**
 * Check if a point is near a line (within threshold distance)
 */
export function lineContainsPoint(
  shape: LineShape,
  x: number,
  y: number,
  threshold: number = 8
): boolean {
  const effectiveThreshold = threshold + shape.strokeWidth / 2;
  const mode = shape.routingMode || 'direct';

  if (mode === 'elbow') {
    return elbowPathContainsPoint(shape.x, shape.y, shape.x2, shape.y2, x, y, effectiveThreshold, shape.controlPoints);
  }

  if (mode === 'curved') {
    return curvedPathContainsPoint(shape.x, shape.y, shape.x2, shape.y2, x, y, effectiveThreshold, shape.controlPoints);
  }

  // Direct mode - Calculate distance from point to line segment
  const { x: x1, y: y1, x2, y2 } = shape;

  // Vector from p1 to p2
  const dx = x2 - x1;
  const dy = y2 - y1;

  // Length squared of line segment
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Line is actually a point
    const dist = Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1, 2));
    return dist <= threshold;
  }

  // Parameter t represents position along line (0 = start, 1 = end)
  let t = ((x - x1) * dx + (y - y1) * dy) / lengthSquared;

  // Clamp to line segment
  t = Math.max(0, Math.min(1, t));

  // Closest point on line segment
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  // Distance from point to closest point
  const dist = Math.sqrt(Math.pow(x - closestX, 2) + Math.pow(y - closestY, 2));

  return dist <= effectiveThreshold;
}

/**
 * Create a new line shape
 */
export function createLine(
  x: number,
  y: number,
  x2: number,
  y2: number,
  style: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    fillColor: string;
    opacity: number;
    roughness?: number;
    routingMode?: RoutingMode;
  }
): LineShape {
  return {
    id: crypto.randomUUID(),
    type: 'line',
    x,
    y,
    x2,
    y2,
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeStyle: style.strokeStyle,
    fillColor: style.fillColor, // Not used for lines, but required by interface
    opacity: style.opacity,
    roughness: style.roughness ?? 1,
    routingMode: style.routingMode ?? 'direct',
    startEndpoint: { shape: 'none', size: 1 },
    endEndpoint: { shape: 'none', size: 1 },
  };
}
