/**
 * Arrow shape implementation
 */

import type { ArrowShape, BoundingBox, RoutingMode } from '../types';
import { applyStrokeStyle } from '../canvas/strokeStyles';
import { calculateLineTextGap } from './line';
import { elbowPathContainsPoint, curvedPathContainsPoint, getRoutedBounds } from '../utils/routing';
import { drawEndpointShape, getEffectiveEndpoint } from '../canvas/endpointRenderer';

/**
 * Render an arrow shape to canvas, with text gap support
 */
export function renderArrow(ctx: CanvasRenderingContext2D, shape: ArrowShape): void {
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

    // Calculate angle of the line
    const dx = shape.x2 - shape.x;
    const dy = shape.y2 - shape.y;
    const angle = Math.atan2(dy, dx);

    // Draw endpoint shapes
    const endEp = getEffectiveEndpoint(shape.endEndpoint, shape.arrowheadEnd, true);
    const startEp = getEffectiveEndpoint(shape.startEndpoint, shape.arrowheadStart, false);

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
 * Get bounding box for an arrow
 */
export function getArrowBounds(shape: ArrowShape): BoundingBox {
  const arrowheadSize = shape.strokeWidth * 4;
  const mode = shape.routingMode || 'direct';

  if (mode !== 'direct') {
    const routed = getRoutedBounds(shape.x, shape.y, shape.x2, shape.y2, mode, shape.controlPoints, shape.strokeWidth);
    const padding = arrowheadSize;
    return {
      x: routed.x - padding,
      y: routed.y - padding,
      width: routed.width + padding * 2,
      height: routed.height + padding * 2,
    };
  }

  const halfStroke = shape.strokeWidth / 2;
  const minX = Math.min(shape.x, shape.x2);
  const minY = Math.min(shape.y, shape.y2);
  const maxX = Math.max(shape.x, shape.x2);
  const maxY = Math.max(shape.y, shape.y2);

  // Add extra padding for arrowhead
  const padding = arrowheadSize + halfStroke;

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

/**
 * Check if a point is near an arrow (within threshold distance)
 */
export function arrowContainsPoint(
  shape: ArrowShape,
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
 * Create a new arrow shape
 */
export function createArrow(
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
): ArrowShape {
  return {
    id: crypto.randomUUID(),
    type: 'arrow',
    x,
    y,
    x2,
    y2,
    arrowheadStart: false,
    arrowheadEnd: true,
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeStyle: style.strokeStyle,
    fillColor: style.fillColor, // Not used for arrows, but required by interface
    opacity: style.opacity,
    roughness: style.roughness ?? 1,
    routingMode: style.routingMode ?? 'direct',
    startEndpoint: { shape: 'none', size: 1 },
    endEndpoint: { shape: 'arrow', size: 1 },
  };
}
