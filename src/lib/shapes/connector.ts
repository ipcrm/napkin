/**
 * Connector shape - lines that attach to shape edges and auto-update
 */

import type { Shape, BoundingBox } from '../types';

/**
 * Connection point on a shape
 */
export type ConnectionPoint = 'top' | 'right' | 'bottom' | 'left' | 'center';

/**
 * Connection endpoint - either fixed position or attached to a shape
 */
export interface ConnectionEndpoint {
  type: 'fixed' | 'shape';
  x?: number; // For fixed type
  y?: number; // For fixed type
  shapeId?: string; // For shape type
  point?: ConnectionPoint; // For shape type
}

/**
 * Connector shape interface
 */
export interface ConnectorShape {
  id: string;
  type: 'connector';
  startPoint: ConnectionEndpoint;
  endPoint: ConnectionEndpoint;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  arrowStart: boolean;
  arrowEnd: boolean;
  style: 'straight' | 'curved' | 'orthogonal';
}

/**
 * Get the position of a connection point on a shape
 */
export function getConnectionPointPosition(
  shape: Shape,
  point: ConnectionPoint
): { x: number; y: number } {
  let bounds: BoundingBox;

  switch (shape.type) {
    case 'rectangle':
    case 'ellipse':
    case 'text':
    case 'sticky':
      bounds = {
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height
      };
      break;

    case 'line':
    case 'arrow':
      bounds = {
        x: Math.min(shape.x, shape.x2),
        y: Math.min(shape.y, shape.y2),
        width: Math.abs(shape.x2 - shape.x),
        height: Math.abs(shape.y2 - shape.y)
      };
      break;

    case 'freedraw': {
      if (shape.points.length === 0) {
        return { x: shape.x, y: shape.y };
      }
      let minX = shape.points[0].x;
      let minY = shape.points[0].y;
      let maxX = minX;
      let maxY = minY;
      for (const p of shape.points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      bounds = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
      break;
    }

    default:
      return { x: shape.x, y: shape.y };
  }

  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  switch (point) {
    case 'top':
      return { x: cx, y: bounds.y };
    case 'right':
      return { x: bounds.x + bounds.width, y: cy };
    case 'bottom':
      return { x: cx, y: bounds.y + bounds.height };
    case 'left':
      return { x: bounds.x, y: cy };
    case 'center':
      return { x: cx, y: cy };
    default:
      return { x: cx, y: cy };
  }
}

/**
 * Resolve the actual x,y coordinates for a connection endpoint
 */
export function resolveEndpoint(
  endpoint: ConnectionEndpoint,
  shapes: Map<string, Shape>
): { x: number; y: number } {
  if (endpoint.type === 'fixed' && endpoint.x !== undefined && endpoint.y !== undefined) {
    return { x: endpoint.x, y: endpoint.y };
  }

  if (endpoint.type === 'shape' && endpoint.shapeId && endpoint.point) {
    const shape = shapes.get(endpoint.shapeId);
    if (shape) {
      return getConnectionPointPosition(shape, endpoint.point);
    }
  }

  return { x: 0, y: 0 };
}

/**
 * Render a connector shape
 */
export function renderConnector(
  ctx: CanvasRenderingContext2D,
  connector: ConnectorShape,
  shapes: Map<string, Shape>
): void {
  ctx.save();
  ctx.globalAlpha = connector.opacity;

  const start = resolveEndpoint(connector.startPoint, shapes);
  const end = resolveEndpoint(connector.endPoint, shapes);

  ctx.strokeStyle = connector.strokeColor;
  ctx.lineWidth = connector.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();

  if (connector.style === 'straight') {
    // Straight line
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
  } else if (connector.style === 'curved') {
    // Bezier curve
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(midX, start.y, midX, midY);
    ctx.quadraticCurveTo(midX, end.y, end.x, end.y);
  } else if (connector.style === 'orthogonal') {
    // Right-angle line
    ctx.moveTo(start.x, start.y);
    const midX = (start.x + end.x) / 2;
    ctx.lineTo(midX, start.y);
    ctx.lineTo(midX, end.y);
    ctx.lineTo(end.x, end.y);
  }

  ctx.stroke();

  // Draw arrowheads
  if (connector.arrowStart) {
    drawArrowhead(ctx, end, start, connector.strokeWidth);
  }
  if (connector.arrowEnd) {
    drawArrowhead(ctx, start, end, connector.strokeWidth);
  }

  ctx.restore();
}

/**
 * Draw an arrowhead pointing from 'from' to 'to'
 */
function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  strokeWidth: number
): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const arrowSize = Math.max(10, strokeWidth * 3);

  ctx.save();
  ctx.translate(to.x, to.y);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-arrowSize, -arrowSize / 2);
  ctx.lineTo(-arrowSize, arrowSize / 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Get bounding box for a connector
 */
export function getConnectorBounds(
  connector: ConnectorShape,
  shapes: Map<string, Shape>
): BoundingBox {
  const start = resolveEndpoint(connector.startPoint, shapes);
  const end = resolveEndpoint(connector.endPoint, shapes);

  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxX = Math.max(start.x, end.x);
  const maxY = Math.max(start.y, end.y);

  const halfStroke = connector.strokeWidth / 2;

  return {
    x: minX - halfStroke,
    y: minY - halfStroke,
    width: maxX - minX + connector.strokeWidth,
    height: maxY - minY + connector.strokeWidth
  };
}

/**
 * Create a new connector
 */
export function createConnector(
  startPoint: ConnectionEndpoint,
  endPoint: ConnectionEndpoint,
  style: {
    strokeColor: string;
    strokeWidth: number;
    opacity: number;
  }
): ConnectorShape {
  return {
    id: crypto.randomUUID(),
    type: 'connector',
    startPoint,
    endPoint,
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    opacity: style.opacity,
    arrowStart: false,
    arrowEnd: true,
    style: 'straight'
  };
}

/**
 * Check if a connector needs to be updated (if connected shapes moved)
 */
export function shouldUpdateConnector(
  connector: ConnectorShape,
  updatedShapeIds: Set<string>
): boolean {
  if (connector.startPoint.type === 'shape' && connector.startPoint.shapeId) {
    if (updatedShapeIds.has(connector.startPoint.shapeId)) {
      return true;
    }
  }
  if (connector.endPoint.type === 'shape' && connector.endPoint.shapeId) {
    if (updatedShapeIds.has(connector.endPoint.shapeId)) {
      return true;
    }
  }
  return false;
}
