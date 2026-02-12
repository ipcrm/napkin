/**
 * Shared endpoint shape renderer for line/arrow endpoints.
 * Used by Canvas.svelte (smooth), roughRenderer.ts, and exportWorker.ts.
 */

import type { EndpointShapeType } from '../types';

/**
 * Draw an endpoint shape on a canvas context.
 *
 * @param ctx - Canvas 2D rendering context
 * @param x - X position of the endpoint (tip of the shape)
 * @param y - Y position of the endpoint (tip of the shape)
 * @param angle - Angle of the line at this endpoint (radians, pointing toward the endpoint)
 * @param shapeType - The endpoint shape to draw
 * @param size - Size multiplier (default 1). Base size is derived from strokeWidth * 4.
 * @param strokeWidth - The stroke width of the parent line/arrow
 * @param strokeColor - Color for the shape outline
 * @param fillColor - Color for filled shapes (usually same as strokeColor)
 */
export function drawEndpointShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  shapeType: EndpointShapeType,
  size: number,
  strokeWidth: number,
  strokeColor: string,
  fillColor: string
): void {
  if (shapeType === 'none') return;

  const baseSize = strokeWidth * 4 * size;
  const arrowAngle = Math.PI / 6; // 30 degrees

  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (shapeType) {
    case 'arrow': {
      // Filled triangle arrowhead (classic)
      const p1x = x - baseSize * Math.cos(angle - arrowAngle);
      const p1y = y - baseSize * Math.sin(angle - arrowAngle);
      const p2x = x - baseSize * Math.cos(angle + arrowAngle);
      const p2y = y - baseSize * Math.sin(angle + arrowAngle);

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'open-arrow': {
      // Open/unfilled triangle arrowhead (just lines, no fill)
      const p1x = x - baseSize * Math.cos(angle - arrowAngle);
      const p1y = y - baseSize * Math.sin(angle - arrowAngle);
      const p2x = x - baseSize * Math.cos(angle + arrowAngle);
      const p2y = y - baseSize * Math.sin(angle + arrowAngle);

      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(x, y);
      ctx.lineTo(p2x, p2y);
      ctx.stroke();
      break;
    }

    case 'triangle': {
      // Filled equilateral-ish triangle
      const p1x = x - baseSize * Math.cos(angle - arrowAngle);
      const p1y = y - baseSize * Math.sin(angle - arrowAngle);
      const p2x = x - baseSize * Math.cos(angle + arrowAngle);
      const p2y = y - baseSize * Math.sin(angle + arrowAngle);

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'circle': {
      // Filled circle at endpoint
      const radius = baseSize * 0.4;
      // Offset center back along the line so the circle edge touches the endpoint
      const cx = x - radius * Math.cos(angle);
      const cy = y - radius * Math.sin(angle);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'diamond': {
      // Filled diamond at endpoint
      const halfW = baseSize * 0.5;
      const halfH = baseSize * 0.3;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      // Diamond centered behind the tip
      ctx.translate(-halfW, 0);

      ctx.beginPath();
      ctx.moveTo(0, 0); // tip (rightmost point, at endpoint)
      // Actually draw diamond with tip at origin
      ctx.moveTo(halfW, 0); // tip at the endpoint
      ctx.lineTo(0, -halfH); // top
      ctx.lineTo(-halfW, 0); // back
      ctx.lineTo(0, halfH); // bottom
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
      break;
    }

    case 'square': {
      // Filled square at endpoint
      const halfSide = baseSize * 0.35;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      // Square centered behind the tip
      ctx.translate(-halfSide, 0);

      ctx.beginPath();
      ctx.rect(-halfSide, -halfSide, halfSide * 2, halfSide * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
      break;
    }
  }

  ctx.restore();
}

/**
 * Get the effective endpoint shape for an arrow shape, considering
 * backward compatibility with the old arrowheadStart/arrowheadEnd booleans.
 */
export function getEffectiveEndpoint(
  endpoint: { shape: EndpointShapeType; size: number } | undefined,
  legacyArrowhead: boolean | undefined,
  _isEnd: boolean
): { shape: EndpointShapeType; size: number } {
  // If endpoint config is explicitly set, use it
  if (endpoint) {
    return endpoint;
  }

  // Fall back to legacy boolean for arrows
  if (legacyArrowhead) {
    return { shape: 'arrow', size: 1 };
  }

  return { shape: 'none', size: 1 };
}

/**
 * Generate SVG path data for an endpoint shape (for SVG export).
 * Returns an object with the SVG elements needed.
 */
export function getEndpointSVG(
  x: number,
  y: number,
  angle: number,
  shapeType: EndpointShapeType,
  size: number,
  strokeWidth: number,
  strokeColor: string,
  fillColor: string,
  opacity: string
): string {
  if (shapeType === 'none') return '';

  const baseSize = strokeWidth * 4 * size;
  const arrowAngle = Math.PI / 6;

  switch (shapeType) {
    case 'arrow': {
      const p1x = x - baseSize * Math.cos(angle - arrowAngle);
      const p1y = y - baseSize * Math.sin(angle - arrowAngle);
      const p2x = x - baseSize * Math.cos(angle + arrowAngle);
      const p2y = y - baseSize * Math.sin(angle + arrowAngle);
      return `<polygon points="${x},${y} ${p1x},${p1y} ${p2x},${p2y}" fill="${fillColor}" stroke="none"${opacity} />`;
    }

    case 'open-arrow': {
      const p1x = x - baseSize * Math.cos(angle - arrowAngle);
      const p1y = y - baseSize * Math.sin(angle - arrowAngle);
      const p2x = x - baseSize * Math.cos(angle + arrowAngle);
      const p2y = y - baseSize * Math.sin(angle + arrowAngle);
      return `<path d="M ${p1x} ${p1y} L ${x} ${y} L ${p2x} ${p2y}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"${opacity} />`;
    }

    case 'triangle': {
      const p1x = x - baseSize * Math.cos(angle - arrowAngle);
      const p1y = y - baseSize * Math.sin(angle - arrowAngle);
      const p2x = x - baseSize * Math.cos(angle + arrowAngle);
      const p2y = y - baseSize * Math.sin(angle + arrowAngle);
      return `<polygon points="${x},${y} ${p1x},${p1y} ${p2x},${p2y}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacity} />`;
    }

    case 'circle': {
      const radius = baseSize * 0.4;
      const cx = x - radius * Math.cos(angle);
      const cy = y - radius * Math.sin(angle);
      return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacity} />`;
    }

    case 'diamond': {
      const halfW = baseSize * 0.5;
      const halfH = baseSize * 0.3;
      // Calculate diamond points rotated by angle
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      // Tip at endpoint
      const tipX = x;
      const tipY = y;
      // Top point
      const topX = x - halfW * cosA - halfH * (-sinA);
      const topY = y - halfW * sinA - halfH * cosA;
      // Back point
      const backX = x - 2 * halfW * cosA;
      const backY = y - 2 * halfW * sinA;
      // Bottom point
      const bottomX = x - halfW * cosA + halfH * (-sinA);
      const bottomY = y - halfW * sinA + halfH * cosA;
      return `<polygon points="${tipX},${tipY} ${topX},${topY} ${backX},${backY} ${bottomX},${bottomY}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacity} />`;
    }

    case 'square': {
      const halfSide = baseSize * 0.35;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      // Four corners of the square, rotated
      // Center is offset behind the endpoint by halfSide
      const cx = x - halfSide * cosA;
      const cy = y - halfSide * sinA;
      const p1x = cx + halfSide * cosA - halfSide * (-sinA);
      const p1y = cy + halfSide * sinA - halfSide * cosA;
      const p2x = cx + halfSide * cosA + halfSide * (-sinA);
      const p2y = cy + halfSide * sinA + halfSide * cosA;
      const p3x = cx - halfSide * cosA + halfSide * (-sinA);
      const p3y = cy - halfSide * sinA + halfSide * cosA;
      const p4x = cx - halfSide * cosA - halfSide * (-sinA);
      const p4y = cy - halfSide * sinA - halfSide * cosA;
      return `<polygon points="${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacity} />`;
    }

    default:
      return '';
  }
}
