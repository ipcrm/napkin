/**
 * Web Worker for exporting canvas to PNG and SVG
 * Runs in a separate thread to avoid blocking the UI
 */

import type { Shape, Viewport, RoutingMode, EndpointShapeType, EndpointConfig } from '../../types';

interface ExportMessage {
  type: 'png' | 'svg';
  shapes: Shape[];
  viewport: Viewport;
  width: number;
  height: number;
  backgroundColor?: string;
}

interface ExportResponse {
  type: 'success' | 'error';
  blob?: Blob;
  svgString?: string;
  error?: string;
}

// Listen for messages from main thread
self.addEventListener('message', async (event: MessageEvent<ExportMessage>) => {
  const { type, shapes, viewport, width, height, backgroundColor } = event.data;

  try {
    if (type === 'png') {
      const blob = await exportToPNG(shapes, viewport, width, height, backgroundColor);
      const response: ExportResponse = { type: 'success', blob };
      self.postMessage(response);
    } else if (type === 'svg') {
      const svgString = exportToSVG(shapes, viewport, width, height, backgroundColor);
      const response: ExportResponse = { type: 'success', svgString };
      self.postMessage(response);
    } else {
      throw new Error(`Unknown export type: ${type}`);
    }
  } catch (error) {
    const response: ExportResponse = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    self.postMessage(response);
  }
});

/**
 * Export shapes to PNG using OffscreenCanvas
 */
async function exportToPNG(
  shapes: Shape[],
  viewport: Viewport,
  width: number,
  height: number,
  backgroundColor: string = '#ffffff'
): Promise<Blob> {
  // Create an OffscreenCanvas for rendering
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // Calculate bounding box of all shapes
  const bounds = calculateBoundingBox(shapes);

  if (!bounds) {
    // No shapes, just return blank canvas
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return blob;
  }

  // Calculate scale to fit all shapes in the export dimensions
  const padding = 40; // Add some padding around shapes
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;

  const scaleX = availableWidth / bounds.width;
  const scaleY = availableHeight / bounds.height;
  const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down if needed

  // Center the drawing
  const offsetX = (width - bounds.width * scale) / 2 - bounds.x * scale;
  const offsetY = (height - bounds.height * scale) / 2 - bounds.y * scale;

  // Apply transformation
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Render all shapes
  for (const shape of shapes) {
    renderShapeToContext(ctx, shape);
  }

  ctx.restore();

  // Convert to blob
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return blob;
}

/**
 * Export shapes to SVG string
 */
function exportToSVG(
  shapes: Shape[],
  viewport: Viewport,
  width: number,
  height: number,
  backgroundColor: string = '#ffffff'
): string {
  // Calculate bounding box of all shapes
  const bounds = calculateBoundingBox(shapes);

  if (!bounds) {
    // No shapes, return empty SVG
    return createSVGDocument(width, height, backgroundColor, '');
  }

  // Calculate scale and offset (same logic as PNG)
  const padding = 40;
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;

  const scaleX = availableWidth / bounds.width;
  const scaleY = availableHeight / bounds.height;
  const scale = Math.min(scaleX, scaleY, 1);

  const offsetX = (width - bounds.width * scale) / 2 - bounds.x * scale;
  const offsetY = (height - bounds.height * scale) / 2 - bounds.y * scale;

  // Generate SVG elements for each shape
  const elements: string[] = [];
  for (const shape of shapes) {
    const element = shapeToSVG(shape, offsetX, offsetY, scale);
    if (element) {
      elements.push(element);
    }
  }

  return createSVGDocument(width, height, backgroundColor, elements.join('\n  '));
}

/**
 * Calculate bounding box that encompasses all shapes
 */
function calculateBoundingBox(shapes: Shape[]): { x: number; y: number; width: number; height: number } | null {
  if (shapes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const shape of shapes) {
    const bounds = getShapeBounds(shape);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Get bounding box for a shape
 */
function getShapeBounds(shape: Shape): { x: number; y: number; width: number; height: number } {
  const halfStroke = shape.strokeWidth / 2;

  switch (shape.type) {
    case 'rectangle':
    case 'ellipse':
    case 'triangle':
    case 'diamond':
    case 'hexagon':
    case 'star':
    case 'cloud':
    case 'cylinder':
    case 'image':
    case 'sticky':
      return {
        x: shape.x - halfStroke,
        y: shape.y - halfStroke,
        width: (shape as any).width + shape.strokeWidth,
        height: (shape as any).height + shape.strokeWidth
      };

    case 'line':
    case 'arrow': {
      let minX = Math.min(shape.x, shape.x2);
      let minY = Math.min(shape.y, shape.y2);
      let maxX = Math.max(shape.x, shape.x2);
      let maxY = Math.max(shape.y, shape.y2);

      // Include control points in bounding box
      if (shape.controlPoints) {
        for (const cp of shape.controlPoints) {
          minX = Math.min(minX, cp.x);
          minY = Math.min(minY, cp.y);
          maxX = Math.max(maxX, cp.x);
          maxY = Math.max(maxY, cp.y);
        }
      }

      // For elbow mode, include the path points
      if (shape.routingMode === 'elbow') {
        const elbowPts = getExportElbowPathPoints(shape.x, shape.y, shape.x2, shape.y2, shape.controlPoints);
        for (const pt of elbowPts) {
          minX = Math.min(minX, pt.x);
          minY = Math.min(minY, pt.y);
          maxX = Math.max(maxX, pt.x);
          maxY = Math.max(maxY, pt.y);
        }
      }

      return {
        x: minX - halfStroke,
        y: minY - halfStroke,
        width: maxX - minX + shape.strokeWidth,
        height: maxY - minY + shape.strokeWidth
      };
    }

    case 'freedraw': {
      if (shape.points.length === 0) {
        return { x: shape.x, y: shape.y, width: 0, height: 0 };
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const point of shape.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
      return {
        x: minX - halfStroke,
        y: minY - halfStroke,
        width: maxX - minX + shape.strokeWidth,
        height: maxY - minY + shape.strokeWidth
      };
    }

    case 'text':
      return {
        x: shape.x - halfStroke,
        y: shape.y - halfStroke,
        width: shape.width + shape.strokeWidth,
        height: shape.height + shape.strokeWidth
      };

    default:
      return { x: shape.x, y: shape.y, width: 0, height: 0 };
  }
}

// --- Inline routing helpers for export worker ---

interface ExportPoint { x: number; y: number; }

function getExportElbowPathPoints(
  x1: number, y1: number, x2: number, y2: number,
  controlPoints?: ExportPoint[]
): ExportPoint[] {
  if (controlPoints && controlPoints.length > 0) {
    const cp = controlPoints[0];
    return [
      { x: x1, y: y1 },
      { x: cp.x, y: y1 },
      { x: cp.x, y: y2 },
      { x: x2, y: y2 }
    ];
  }
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 }
  ];
}

function getExportEndAngle(
  x1: number, y1: number, x2: number, y2: number,
  mode: RoutingMode, controlPoints?: ExportPoint[]
): number {
  if (mode === 'elbow') {
    const pts = getExportElbowPathPoints(x1, y1, x2, y2, controlPoints);
    const lastSeg = pts.length >= 2 ? pts[pts.length - 2] : { x: x1, y: y1 };
    return Math.atan2(y2 - lastSeg.y, x2 - lastSeg.x);
  }
  if (mode === 'curved' && controlPoints && controlPoints.length > 0) {
    const cp = controlPoints[0];
    return Math.atan2(y2 - cp.y, x2 - cp.x);
  }
  return Math.atan2(y2 - y1, x2 - x1);
}

function getExportStartAngle(
  x1: number, y1: number, x2: number, y2: number,
  mode: RoutingMode, controlPoints?: ExportPoint[]
): number {
  if (mode === 'elbow') {
    const pts = getExportElbowPathPoints(x1, y1, x2, y2, controlPoints);
    const nextPt = pts.length >= 2 ? pts[1] : { x: x2, y: y2 };
    return Math.atan2(nextPt.y - y1, nextPt.x - x1);
  }
  if (mode === 'curved' && controlPoints && controlPoints.length > 0) {
    const cp = controlPoints[0];
    return Math.atan2(cp.y - y1, cp.x - x1);
  }
  return Math.atan2(y2 - y1, x2 - x1);
}

// --- End inline routing helpers ---

// --- Inline endpoint helpers for export worker ---

function getExportEffectiveEndpoint(
  endpoint: EndpointConfig | undefined,
  legacyArrowhead: boolean | undefined,
  _isEnd: boolean
): { shape: EndpointShapeType; size: number } {
  if (endpoint) return endpoint;
  if (legacyArrowhead) return { shape: 'arrow', size: 1 };
  return { shape: 'none', size: 1 };
}

function drawExportEndpointShape(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
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
  const arrowAngle = Math.PI / 6;

  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (shapeType) {
    case 'arrow': {
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
      const radius = baseSize * 0.4;
      const cx = x - radius * Math.cos(angle);
      const cy = y - radius * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'diamond': {
      const halfW = baseSize * 0.5;
      const halfH = baseSize * 0.3;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.translate(-halfW, 0);
      ctx.beginPath();
      ctx.moveTo(halfW, 0);
      ctx.lineTo(0, -halfH);
      ctx.lineTo(-halfW, 0);
      ctx.lineTo(0, halfH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'square': {
      const halfSide = baseSize * 0.35;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
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

function getExportEndpointSVG(
  x: number, y: number, angle: number,
  shapeType: EndpointShapeType, size: number,
  strokeWidth: number, strokeColor: string, fillColor: string,
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
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const tipX = x, tipY = y;
      const topX = x - halfW * cosA + halfH * sinA;
      const topY = y - halfW * sinA - halfH * cosA;
      const backX = x - 2 * halfW * cosA;
      const backY = y - 2 * halfW * sinA;
      const bottomX = x - halfW * cosA - halfH * sinA;
      const bottomY = y - halfW * sinA + halfH * cosA;
      return `<polygon points="${tipX},${tipY} ${topX},${topY} ${backX},${backY} ${bottomX},${bottomY}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacity} />`;
    }
    case 'square': {
      const halfSide = baseSize * 0.35;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const cx = x - halfSide * cosA;
      const cy = y - halfSide * sinA;
      const p1x = cx + halfSide * cosA + halfSide * sinA;
      const p1y = cy + halfSide * sinA - halfSide * cosA;
      const p2x = cx + halfSide * cosA - halfSide * sinA;
      const p2y = cy + halfSide * sinA + halfSide * cosA;
      const p3x = cx - halfSide * cosA - halfSide * sinA;
      const p3y = cy - halfSide * sinA + halfSide * cosA;
      const p4x = cx - halfSide * cosA + halfSide * sinA;
      const p4y = cy - halfSide * sinA - halfSide * cosA;
      return `<polygon points="${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacity} />`;
    }
    default:
      return '';
  }
}

// --- End inline endpoint helpers ---

/**
 * Render a shape to canvas context
 */
function renderShapeToContext(ctx: CanvasRenderingContext2D, shape: Shape): void {
  ctx.save();
  ctx.globalAlpha = shape.opacity;

  switch (shape.type) {
    case 'rectangle':
      renderRectangle(ctx, shape);
      break;
    case 'ellipse':
      renderEllipse(ctx, shape);
      break;
    case 'triangle':
      renderTriangle(ctx, shape as any);
      break;
    case 'diamond':
      renderDiamond(ctx, shape as any);
      break;
    case 'hexagon':
      renderHexagon(ctx, shape as any);
      break;
    case 'star':
      renderStar(ctx, shape as any);
      break;
    case 'cloud':
      renderCloud(ctx, shape as any);
      break;
    case 'cylinder':
      renderCylinder(ctx, shape as any);
      break;
    case 'image':
      // Images can't be rendered in a web worker (no DOM access for HTMLImageElement)
      renderImagePlaceholder(ctx, shape as any);
      break;
    case 'line':
      renderLine(ctx, shape);
      break;
    case 'arrow':
      renderArrow(ctx, shape);
      break;
    case 'freedraw':
      renderFreedraw(ctx, shape);
      break;
    case 'text':
      renderText(ctx, shape);
      break;
    case 'sticky':
      renderStickyNote(ctx, shape);
      break;
  }

  ctx.restore();
}

/**
 * Darken a hex color by a factor
 */
function darkenExportColor(hex: string, factor: number): string {
  if (!hex || hex.length < 7) return '#999999';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.round(r * (1 - factor));
  const dg = Math.round(g * (1 - factor));
  const db = Math.round(b * (1 - factor));
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

/**
 * Render sticky note to canvas (PNG export)
 */
function renderStickyNote(ctx: CanvasRenderingContext2D, shape: any): void {
  const { x, y } = shape;
  const width = shape.width || 150;
  const height = shape.height || 150;
  const bgColor = shape.stickyColor || '#fff9c4';
  const cornerRadius = 4;
  const foldSize = Math.min(16, width * 0.12, height * 0.12);

  // Draw shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;

  // Main body path
  ctx.beginPath();
  ctx.moveTo(x + cornerRadius, y);
  ctx.lineTo(x + width - foldSize, y);
  ctx.lineTo(x + width, y + foldSize);
  ctx.lineTo(x + width, y + height - cornerRadius);
  ctx.arcTo(x + width, y + height, x + width - cornerRadius, y + height, cornerRadius);
  ctx.lineTo(x + cornerRadius, y + height);
  ctx.arcTo(x, y + height, x, y + height - cornerRadius, cornerRadius);
  ctx.lineTo(x, y + cornerRadius);
  ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
  ctx.closePath();

  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.restore();

  // Border
  ctx.beginPath();
  ctx.moveTo(x + cornerRadius, y);
  ctx.lineTo(x + width - foldSize, y);
  ctx.lineTo(x + width, y + foldSize);
  ctx.lineTo(x + width, y + height - cornerRadius);
  ctx.arcTo(x + width, y + height, x + width - cornerRadius, y + height, cornerRadius);
  ctx.lineTo(x + cornerRadius, y + height);
  ctx.arcTo(x, y + height, x, y + height - cornerRadius, cornerRadius);
  ctx.lineTo(x, y + cornerRadius);
  ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
  ctx.closePath();

  ctx.strokeStyle = darkenExportColor(bgColor, 0.15);
  ctx.lineWidth = shape.strokeWidth || 1;
  ctx.stroke();

  // Fold corner
  ctx.beginPath();
  ctx.moveTo(x + width - foldSize, y);
  ctx.lineTo(x + width - foldSize, y + foldSize);
  ctx.lineTo(x + width, y + foldSize);
  ctx.closePath();
  ctx.fillStyle = darkenExportColor(bgColor, 0.08);
  ctx.fill();
  ctx.strokeStyle = darkenExportColor(bgColor, 0.15);
  ctx.stroke();

  // Text
  if (shape.text) {
    const padding = 10;
    const maxWidth = width - padding * 2;
    const fontSize = shape.fontSize || 14;
    const lineHeight = fontSize * 1.3;
    const hAlign = shape.textAlign || 'center';
    const vAlign = shape.verticalAlign || 'middle';

    ctx.fillStyle = shape.strokeColor || '#333333';
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textBaseline = 'top';

    // Set horizontal alignment
    let textAnchorAlign: CanvasTextAlign = 'left';
    if (hAlign === 'center') textAnchorAlign = 'center';
    else if (hAlign === 'right') textAnchorAlign = 'right';
    ctx.textAlign = textAnchorAlign;

    // Calculate x anchor
    let anchorX: number;
    if (hAlign === 'center') {
      anchorX = x + width / 2;
    } else if (hAlign === 'right') {
      anchorX = x + width - padding;
    } else {
      anchorX = x + padding;
    }

    const lines: string[] = [];
    const paragraphs = shape.text.split('\n');
    for (const paragraph of paragraphs) {
      if (paragraph === '') { lines.push(''); continue; }
      const words = paragraph.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
    }

    const totalTextHeight = lines.length * lineHeight;
    const availableHeight = height - padding * 2;
    let startY: number;
    if (vAlign === 'top') {
      startY = y + padding;
    } else if (vAlign === 'bottom') {
      startY = y + height - padding - totalTextHeight;
    } else {
      // middle
      if (totalTextHeight < availableHeight) {
        startY = y + (height - totalTextHeight) / 2;
      } else {
        startY = y + padding;
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + padding, y + padding, maxWidth, height - padding * 2);
    ctx.clip();
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], anchorX, startY + i * lineHeight);
    }
    ctx.restore();
  }
}

/**
 * Helper: fill and stroke a shape path
 */
function fillAndStrokePath(ctx: CanvasRenderingContext2D, shape: any): void {
  if (shape.fillColor && shape.fillColor !== 'transparent') {
    ctx.fillStyle = shape.fillColor;
    ctx.fill();
  }
  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    ctx.stroke();
  }
}

/**
 * Render triangle to canvas
 */
function renderTriangle(ctx: CanvasRenderingContext2D, shape: { x: number; y: number; width: number; height: number; fillColor: string; strokeColor: string; strokeWidth: number }): void {
  ctx.beginPath();
  ctx.moveTo(shape.x + shape.width / 2, shape.y);
  ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
  ctx.lineTo(shape.x, shape.y + shape.height);
  ctx.closePath();
  fillAndStrokePath(ctx, shape);
}

/**
 * Render diamond to canvas
 */
function renderDiamond(ctx: CanvasRenderingContext2D, shape: { x: number; y: number; width: number; height: number; fillColor: string; strokeColor: string; strokeWidth: number }): void {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  ctx.beginPath();
  ctx.moveTo(cx, shape.y);
  ctx.lineTo(shape.x + shape.width, cy);
  ctx.lineTo(cx, shape.y + shape.height);
  ctx.lineTo(shape.x, cy);
  ctx.closePath();
  fillAndStrokePath(ctx, shape);
}

/**
 * Render hexagon to canvas
 */
function renderHexagon(ctx: CanvasRenderingContext2D, shape: { x: number; y: number; width: number; height: number; fillColor: string; strokeColor: string; strokeWidth: number }): void {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const rx = shape.width / 2;
  const ry = shape.height / 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = cx + rx * Math.cos(angle);
    const py = cy + ry * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  fillAndStrokePath(ctx, shape);
}

/**
 * Render star to canvas
 */
function renderStar(ctx: CanvasRenderingContext2D, shape: { x: number; y: number; width: number; height: number; fillColor: string; strokeColor: string; strokeWidth: number }): void {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const outerRx = shape.width / 2;
  const outerRy = shape.height / 2;
  const innerRx = outerRx * 0.4;
  const innerRy = outerRy * 0.4;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const isOuter = i % 2 === 0;
    const rx = isOuter ? outerRx : innerRx;
    const ry = isOuter ? outerRy : innerRy;
    const px = cx + rx * Math.cos(angle);
    const py = cy + ry * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  fillAndStrokePath(ctx, shape);
}

/**
 * Render cloud to canvas
 */
function renderCloud(ctx: CanvasRenderingContext2D, shape: { x: number; y: number; width: number; height: number; fillColor: string; strokeColor: string; strokeWidth: number }): void {
  // Simplified cloud as overlapping ellipses
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const w = shape.width;
  const h = shape.height;

  ctx.beginPath();
  // Bottom arc
  ctx.ellipse(cx, cy + h * 0.15, w * 0.4, h * 0.25, 0, 0, Math.PI * 2);
  // Top-left arc
  ctx.moveTo(cx - w * 0.15 + w * 0.25, cy - h * 0.15);
  ctx.ellipse(cx - w * 0.15, cy - h * 0.15, w * 0.25, h * 0.3, 0, 0, Math.PI * 2);
  // Top-right arc
  ctx.moveTo(cx + w * 0.2 + w * 0.22, cy - h * 0.1);
  ctx.ellipse(cx + w * 0.2, cy - h * 0.1, w * 0.22, h * 0.25, 0, 0, Math.PI * 2);
  fillAndStrokePath(ctx, shape);
}

/**
 * Render cylinder to canvas
 */
function renderCylinder(ctx: CanvasRenderingContext2D, shape: { x: number; y: number; width: number; height: number; fillColor: string; strokeColor: string; strokeWidth: number }): void {
  const ellipseH = shape.height * 0.15;
  const bodyTop = shape.y + ellipseH;
  const bodyBottom = shape.y + shape.height - ellipseH;
  const cx = shape.x + shape.width / 2;
  const rx = shape.width / 2;

  // Body
  if (shape.fillColor && shape.fillColor !== 'transparent') {
    ctx.fillStyle = shape.fillColor;
    ctx.beginPath();
    ctx.ellipse(cx, bodyTop, rx, ellipseH, 0, 0, Math.PI);
    ctx.lineTo(shape.x, bodyBottom);
    ctx.ellipse(cx, bodyBottom, rx, ellipseH, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
  }

  // Bottom ellipse
  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    ctx.beginPath();
    ctx.ellipse(cx, bodyBottom, rx, ellipseH, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Sides
  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.beginPath();
    ctx.moveTo(shape.x, bodyTop);
    ctx.lineTo(shape.x, bodyBottom);
    ctx.moveTo(shape.x + shape.width, bodyTop);
    ctx.lineTo(shape.x + shape.width, bodyBottom);
    ctx.stroke();
  }

  // Top ellipse (on top)
  ctx.beginPath();
  ctx.ellipse(cx, bodyTop, rx, ellipseH, 0, 0, Math.PI * 2);
  if (shape.fillColor && shape.fillColor !== 'transparent') {
    ctx.fillStyle = shape.fillColor;
    ctx.fill();
  }
  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    ctx.stroke();
  }
}

/**
 * Render image placeholder (images can't load in web workers)
 */
function renderImagePlaceholder(ctx: CanvasRenderingContext2D, shape: { x: number; y: number; width: number; height: number; opacity: number }): void {
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 2;
  ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
  ctx.fillStyle = '#999';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('[Image]', shape.x + shape.width / 2, shape.y + shape.height / 2);
}

/**
 * Render rectangle to canvas
 */
function renderRectangle(ctx: CanvasRenderingContext2D, shape: Shape & { type: 'rectangle' }): void {
  if (shape.fillColor && shape.fillColor !== 'transparent') {
    ctx.fillStyle = shape.fillColor;
    ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
  }

  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
  }
}

/**
 * Render ellipse to canvas
 */
function renderEllipse(ctx: CanvasRenderingContext2D, shape: Shape & { type: 'ellipse' }): void {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const rx = Math.abs(shape.width) / 2;
  const ry = Math.abs(shape.height) / 2;

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);

  if (shape.fillColor && shape.fillColor !== 'transparent') {
    ctx.fillStyle = shape.fillColor;
    ctx.fill();
  }

  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    ctx.stroke();
  }
}

/**
 * Calculate text gap for a line/arrow in the export worker.
 * Returns gap endpoints or null if line is too short.
 */
function calculateExportTextGap(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  text: string, fontSize: number = 14, fontFamily: string = 'sans-serif'
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
  const halfGap = (totalGapWidth / 2) * cosA + (totalGapHeight / 2) * sinA;

  return {
    gapStartX: midX - ux * halfGap, gapStartY: midY - uy * halfGap,
    gapEndX: midX + ux * halfGap, gapEndY: midY + uy * halfGap,
    midX, midY, textWidth, textHeight
  };
}

/**
 * Render text label at the midpoint of a line/arrow in the export worker.
 */
function renderExportLineText(
  ctx: CanvasRenderingContext2D,
  text: string, strokeColor: string,
  midX: number, midY: number, textWidth: number, textHeight: number,
  fontSize: number = 14, fontFamily: string = 'sans-serif'
): void {
  const paddingX = 8;
  const paddingY = 4;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(
    midX - textWidth / 2 - paddingX, midY - textHeight / 2 - paddingY,
    textWidth + paddingX * 2, textHeight + paddingY * 2
  );

  ctx.fillStyle = strokeColor || '#000';
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = text.split('\n');
  const lineHeight = fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  let startY = midY - totalHeight / 2 + lineHeight / 2;

  for (const line of lines) {
    ctx.fillText(line, midX, startY);
    startY += lineHeight;
  }
}

/**
 * Render line to canvas
 */
function renderLine(ctx: CanvasRenderingContext2D, shape: Shape & { type: 'line' }): void {
  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const routingMode = shape.routingMode || 'direct';
    const controlPoints = shape.controlPoints;

    if (routingMode === 'elbow') {
      const pts = getExportElbowPathPoints(shape.x, shape.y, shape.x2, shape.y2, controlPoints);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    } else if (routingMode === 'curved') {
      const cp = controlPoints && controlPoints.length > 0
        ? controlPoints[0]
        : { x: (shape.x + shape.x2) / 2, y: (shape.y + shape.y2) / 2 };
      ctx.beginPath();
      ctx.moveTo(shape.x, shape.y);
      ctx.quadraticCurveTo(cp.x, cp.y, shape.x2, shape.y2);
      ctx.stroke();
    } else {
      // Direct mode
      const gapInfo = shape.text ? calculateExportTextGap(ctx, shape.x, shape.y, shape.x2, shape.y2, shape.text) : null;

      if (gapInfo) {
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

      // Render text label
      if (shape.text) {
        const midX = gapInfo ? gapInfo.midX : (shape.x + shape.x2) / 2;
        const midY = gapInfo ? gapInfo.midY : (shape.y + shape.y2) / 2;
        const textWidth = gapInfo ? gapInfo.textWidth : ctx.measureText(shape.text).width;
        const textHeight = gapInfo ? gapInfo.textHeight : 14 * 1.2;
        renderExportLineText(ctx, shape.text, shape.strokeColor, midX, midY, textWidth, textHeight);
      }
    }

    // Draw endpoint shapes for lines
    const lineEndAngle = getExportEndAngle(shape.x, shape.y, shape.x2, shape.y2, routingMode, controlPoints);
    const lineStartAngle = getExportStartAngle(shape.x, shape.y, shape.x2, shape.y2, routingMode, controlPoints);

    const lineEndEp = getExportEffectiveEndpoint(shape.endEndpoint, false, true);
    const lineStartEp = getExportEffectiveEndpoint(shape.startEndpoint, false, false);

    if (lineEndEp.shape !== 'none') {
      drawExportEndpointShape(ctx, shape.x2, shape.y2, lineEndAngle, lineEndEp.shape, lineEndEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
    }

    if (lineStartEp.shape !== 'none') {
      drawExportEndpointShape(ctx, shape.x, shape.y, lineStartAngle + Math.PI, lineStartEp.shape, lineStartEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
    }
  }
}

/**
 * Render arrow to canvas
 */
function renderArrow(ctx: CanvasRenderingContext2D, shape: Shape & { type: 'arrow' }): void {
  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const routingMode = shape.routingMode || 'direct';
    const controlPoints = shape.controlPoints;

    if (routingMode === 'elbow') {
      const pts = getExportElbowPathPoints(shape.x, shape.y, shape.x2, shape.y2, controlPoints);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    } else if (routingMode === 'curved') {
      const cp = controlPoints && controlPoints.length > 0
        ? controlPoints[0]
        : { x: (shape.x + shape.x2) / 2, y: (shape.y + shape.y2) / 2 };
      ctx.beginPath();
      ctx.moveTo(shape.x, shape.y);
      ctx.quadraticCurveTo(cp.x, cp.y, shape.x2, shape.y2);
      ctx.stroke();
    } else {
      // Direct mode
      const gapInfo = shape.text ? calculateExportTextGap(ctx, shape.x, shape.y, shape.x2, shape.y2, shape.text) : null;

      if (gapInfo) {
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

      // Render text label (only for direct mode)
      if (shape.text) {
        const midX = gapInfo ? gapInfo.midX : (shape.x + shape.x2) / 2;
        const midY = gapInfo ? gapInfo.midY : (shape.y + shape.y2) / 2;
        const textWidth = gapInfo ? gapInfo.textWidth : ctx.measureText(shape.text).width;
        const textHeight = gapInfo ? gapInfo.textHeight : 14 * 1.2;
        renderExportLineText(ctx, shape.text, shape.strokeColor, midX, midY, textWidth, textHeight);
      }
    }

    // Draw endpoint shapes using routing-aware angles
    const endAngle = getExportEndAngle(shape.x, shape.y, shape.x2, shape.y2, routingMode, controlPoints);
    const startAngle = getExportStartAngle(shape.x, shape.y, shape.x2, shape.y2, routingMode, controlPoints);

    const endEp = getExportEffectiveEndpoint(shape.endEndpoint, shape.arrowheadEnd, true);
    const startEp = getExportEffectiveEndpoint(shape.startEndpoint, shape.arrowheadStart, false);

    if (endEp.shape !== 'none') {
      drawExportEndpointShape(ctx, shape.x2, shape.y2, endAngle, endEp.shape, endEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
    }

    if (startEp.shape !== 'none') {
      drawExportEndpointShape(ctx, shape.x, shape.y, startAngle + Math.PI, startEp.shape, startEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
    }
  }
}

/**
 * Render freedraw to canvas
 */
function renderFreedraw(ctx: CanvasRenderingContext2D, shape: Shape & { type: 'freedraw' }): void {
  if (shape.points.length < 2) return;

  ctx.strokeStyle = shape.strokeColor;
  ctx.lineWidth = shape.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(shape.points[0].x, shape.points[0].y);
  for (let i = 1; i < shape.points.length; i++) {
    ctx.lineTo(shape.points[i].x, shape.points[i].y);
  }
  ctx.stroke();
}

/**
 * Render text to canvas
 */
function renderText(ctx: CanvasRenderingContext2D, shape: Shape & { type: 'text' }): void {
  ctx.font = `${shape.fontSize}px ${shape.fontFamily}`;
  ctx.fillStyle = shape.strokeColor; // Use stroke color for text
  ctx.textBaseline = 'top';
  ctx.fillText(shape.text, shape.x, shape.y);
}

/**
 * Calculate text gap for SVG export (uses estimated text dimensions since no canvas context available).
 * Coordinates are in original shape space (not yet scaled/offset).
 */
function calculateSVGTextGap(
  x1: number, y1: number, x2: number, y2: number,
  text: string, _scale: number, fontSize: number = 14
): { gapStartX: number; gapStartY: number; gapEndX: number; gapEndY: number; midX: number; midY: number; textWidth: number; textHeight: number } | null {
  if (!text) return null;

  // Estimate text width (approximate: 0.6 * fontSize per character)
  const lines = text.split('\n');
  const maxLineLength = Math.max(...lines.map(l => l.length));
  const textWidth = maxLineLength * fontSize * 0.6;
  const lineHeight = fontSize * 1.2;
  const textHeight = lines.length * lineHeight;

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
  const halfGap = (totalGapWidth / 2) * cosA + (totalGapHeight / 2) * sinA;

  return {
    gapStartX: midX - ux * halfGap, gapStartY: midY - uy * halfGap,
    gapEndX: midX + ux * halfGap, gapEndY: midY + uy * halfGap,
    midX, midY, textWidth, textHeight
  };
}

/**
 * Convert shape to SVG element
 */
function shapeToSVG(shape: Shape, offsetX: number, offsetY: number, scale: number): string {
  const opacity = shape.opacity !== 1 ? ` opacity="${shape.opacity}"` : '';
  const fill = shape.fillColor && shape.fillColor !== 'transparent' ? shape.fillColor : 'none';
  const stroke = shape.strokeColor;
  const strokeWidth = shape.strokeWidth * scale;

  switch (shape.type) {
    case 'rectangle': {
      const x = shape.x * scale + offsetX;
      const y = shape.y * scale + offsetY;
      const width = shape.width * scale;
      const height = shape.height * scale;
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${opacity} />`;
    }

    case 'ellipse': {
      const cx = (shape.x + shape.width / 2) * scale + offsetX;
      const cy = (shape.y + shape.height / 2) * scale + offsetY;
      const rx = (Math.abs(shape.width) / 2) * scale;
      const ry = (Math.abs(shape.height) / 2) * scale;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${opacity} />`;
    }

    case 'triangle': {
      const triShape = shape as any;
      const x0 = (triShape.x + triShape.width / 2) * scale + offsetX;
      const y0 = triShape.y * scale + offsetY;
      const x1t = (triShape.x + triShape.width) * scale + offsetX;
      const y1t = (triShape.y + triShape.height) * scale + offsetY;
      const x2t = triShape.x * scale + offsetX;
      const y2t = y1t;
      return `<polygon points="${x0},${y0} ${x1t},${y1t} ${x2t},${y2t}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${opacity} />`;
    }

    case 'diamond': {
      const dShape = shape as any;
      const dcx = (dShape.x + dShape.width / 2) * scale + offsetX;
      const dcy = (dShape.y + dShape.height / 2) * scale + offsetY;
      const dtop = dShape.y * scale + offsetY;
      const dright = (dShape.x + dShape.width) * scale + offsetX;
      const dbottom = (dShape.y + dShape.height) * scale + offsetY;
      const dleft = dShape.x * scale + offsetX;
      return `<polygon points="${dcx},${dtop} ${dright},${dcy} ${dcx},${dbottom} ${dleft},${dcy}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${opacity} />`;
    }

    case 'hexagon': {
      const hShape = shape as any;
      const hcx = (hShape.x + hShape.width / 2) * scale + offsetX;
      const hcy = (hShape.y + hShape.height / 2) * scale + offsetY;
      const hrx = (hShape.width / 2) * scale;
      const hry = (hShape.height / 2) * scale;
      const hexPts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        hexPts.push(`${hcx + hrx * Math.cos(angle)},${hcy + hry * Math.sin(angle)}`);
      }
      return `<polygon points="${hexPts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${opacity} />`;
    }

    case 'star': {
      const sShape = shape as any;
      const scx = (sShape.x + sShape.width / 2) * scale + offsetX;
      const scy = (sShape.y + sShape.height / 2) * scale + offsetY;
      const sorx = (sShape.width / 2) * scale;
      const sory = (sShape.height / 2) * scale;
      const sirx = sorx * 0.4;
      const siry = sory * 0.4;
      const starPts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const isOuter = i % 2 === 0;
        const rx = isOuter ? sorx : sirx;
        const ry = isOuter ? sory : siry;
        starPts.push(`${scx + rx * Math.cos(angle)},${scy + ry * Math.sin(angle)}`);
      }
      return `<polygon points="${starPts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${opacity} />`;
    }

    case 'cloud': {
      const cShape = shape as any;
      const ccx = (cShape.x + cShape.width / 2) * scale + offsetX;
      const ccy = (cShape.y + cShape.height / 2) * scale + offsetY;
      const cw = cShape.width * scale;
      const ch = cShape.height * scale;
      return `<g${opacity}><ellipse cx="${ccx}" cy="${ccy + ch * 0.15}" rx="${cw * 0.4}" ry="${ch * 0.25}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/><ellipse cx="${ccx - cw * 0.15}" cy="${ccy - ch * 0.15}" rx="${cw * 0.25}" ry="${ch * 0.3}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/><ellipse cx="${ccx + cw * 0.2}" cy="${ccy - ch * 0.1}" rx="${cw * 0.22}" ry="${ch * 0.25}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/></g>`;
    }

    case 'cylinder': {
      const cyShape = shape as any;
      const cyx = cyShape.x * scale + offsetX;
      const cyy = cyShape.y * scale + offsetY;
      const cyw = cyShape.width * scale;
      const cyh = cyShape.height * scale;
      const cyEllH = cyh * 0.15;
      const cycx = cyx + cyw / 2;
      const cyrx = cyw / 2;
      const cyTop = cyy + cyEllH;
      const cyBot = cyy + cyh - cyEllH;
      return `<g${opacity}><rect x="${cyx}" y="${cyTop}" width="${cyw}" height="${cyBot - cyTop}" fill="${fill}" stroke="none"/><ellipse cx="${cycx}" cy="${cyBot}" rx="${cyrx}" ry="${cyEllH}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/><line x1="${cyx}" y1="${cyTop}" x2="${cyx}" y2="${cyBot}" stroke="${stroke}" stroke-width="${strokeWidth}"/><line x1="${cyx + cyw}" y1="${cyTop}" x2="${cyx + cyw}" y2="${cyBot}" stroke="${stroke}" stroke-width="${strokeWidth}"/><ellipse cx="${cycx}" cy="${cyTop}" rx="${cyrx}" ry="${cyEllH}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/></g>`;
    }

    case 'image': {
      const iShape = shape as any;
      const ix = iShape.x * scale + offsetX;
      const iy = iShape.y * scale + offsetY;
      const iw = iShape.width * scale;
      const ih = iShape.height * scale;
      return `<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="#f0f0f0" stroke="#ccc" stroke-width="2"${opacity} /><text x="${ix + iw / 2}" y="${iy + ih / 2}" font-family="sans-serif" font-size="14" fill="#999" text-anchor="middle" dominant-baseline="central"${opacity}>[Image]</text>`;
    }

    case 'line': {
      const x1 = shape.x * scale + offsetX;
      const y1 = shape.y * scale + offsetY;
      const x2 = shape.x2 * scale + offsetX;
      const y2 = shape.y2 * scale + offsetY;
      const lineMode = shape.routingMode || 'direct';
      let lineElements: string;

      if (lineMode === 'elbow') {
        const pts = getExportElbowPathPoints(shape.x, shape.y, shape.x2, shape.y2, shape.controlPoints);
        let pathData = `M ${pts[0].x * scale + offsetX} ${pts[0].y * scale + offsetY}`;
        for (let i = 1; i < pts.length; i++) {
          pathData += ` L ${pts[i].x * scale + offsetX} ${pts[i].y * scale + offsetY}`;
        }
        lineElements = `<path d="${pathData}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"${opacity} />`;
      } else if (lineMode === 'curved') {
        const cp = shape.controlPoints && shape.controlPoints.length > 0
          ? shape.controlPoints[0]
          : { x: (shape.x + shape.x2) / 2, y: (shape.y + shape.y2) / 2 };
        const cpx = cp.x * scale + offsetX;
        const cpy = cp.y * scale + offsetY;
        lineElements = `<path d="M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round"${opacity} />`;
      } else if (shape.text) {
        const svgGap = calculateSVGTextGap(shape.x, shape.y, shape.x2, shape.y2, shape.text, scale);
        if (svgGap) {
          lineElements = `<line x1="${x1}" y1="${y1}" x2="${svgGap.gapStartX * scale + offsetX}" y2="${svgGap.gapStartY * scale + offsetY}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"${opacity} />`;
          lineElements += `\n  <line x1="${svgGap.gapEndX * scale + offsetX}" y1="${svgGap.gapEndY * scale + offsetY}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"${opacity} />`;
          const midSX = svgGap.midX * scale + offsetX;
          const midSY = svgGap.midY * scale + offsetY;
          const fontSize = 14 * scale;
          lineElements += `\n  <rect x="${midSX - svgGap.textWidth * scale / 2 - 8 * scale}" y="${midSY - svgGap.textHeight * scale / 2 - 4 * scale}" width="${(svgGap.textWidth + 16) * scale}" height="${(svgGap.textHeight + 8) * scale}" fill="rgba(255,255,255,0.85)" rx="2"${opacity} />`;
          lineElements += `\n  <text x="${midSX}" y="${midSY}" font-family="sans-serif" font-size="${fontSize}" fill="${stroke}" text-anchor="middle" dominant-baseline="central"${opacity}>${escapeXml(shape.text)}</text>`;
        } else {
          lineElements = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"${opacity} />`;
        }
      } else {
        lineElements = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"${opacity} />`;
      }

      // Add endpoint shapes for lines
      const lineEndAngle = getExportEndAngle(shape.x, shape.y, shape.x2, shape.y2, lineMode, shape.controlPoints);
      const lineStartAngle = getExportStartAngle(shape.x, shape.y, shape.x2, shape.y2, lineMode, shape.controlPoints);

      const svgLineEndEp = getExportEffectiveEndpoint(shape.endEndpoint, false, true);
      const svgLineStartEp = getExportEffectiveEndpoint(shape.startEndpoint, false, false);

      if (svgLineEndEp.shape !== 'none') {
        const epSvg = getExportEndpointSVG(x2, y2, lineEndAngle, svgLineEndEp.shape, svgLineEndEp.size, strokeWidth, stroke, stroke, opacity);
        if (epSvg) lineElements += `\n  ${epSvg}`;
      }

      if (svgLineStartEp.shape !== 'none') {
        const epSvg = getExportEndpointSVG(x1, y1, lineStartAngle + Math.PI, svgLineStartEp.shape, svgLineStartEp.size, strokeWidth, stroke, stroke, opacity);
        if (epSvg) lineElements += `\n  ${epSvg}`;
      }

      return lineElements;
    }

    case 'arrow': {
      const x1 = shape.x * scale + offsetX;
      const y1 = shape.y * scale + offsetY;
      const x2 = shape.x2 * scale + offsetX;
      const y2 = shape.y2 * scale + offsetY;
      const arrowMode = shape.routingMode || 'direct';

      let elements: string;

      if (arrowMode === 'elbow') {
        const pts = getExportElbowPathPoints(shape.x, shape.y, shape.x2, shape.y2, shape.controlPoints);
        let pathData = `M ${pts[0].x * scale + offsetX} ${pts[0].y * scale + offsetY}`;
        for (let i = 1; i < pts.length; i++) {
          pathData += ` L ${pts[i].x * scale + offsetX} ${pts[i].y * scale + offsetY}`;
        }
        elements = `<path d="${pathData}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"${opacity} />`;
      } else if (arrowMode === 'curved') {
        const cp = shape.controlPoints && shape.controlPoints.length > 0
          ? shape.controlPoints[0]
          : { x: (shape.x + shape.x2) / 2, y: (shape.y + shape.y2) / 2 };
        const cpx = cp.x * scale + offsetX;
        const cpy = cp.y * scale + offsetY;
        elements = `<path d="M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round"${opacity} />`;
      } else {
        // Direct mode
        if (shape.text) {
          const svgGap = calculateSVGTextGap(shape.x, shape.y, shape.x2, shape.y2, shape.text, scale);
          if (svgGap) {
            elements = `<line x1="${x1}" y1="${y1}" x2="${svgGap.gapStartX * scale + offsetX}" y2="${svgGap.gapStartY * scale + offsetY}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"${opacity} />`;
            elements += `\n  <line x1="${svgGap.gapEndX * scale + offsetX}" y1="${svgGap.gapEndY * scale + offsetY}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"${opacity} />`;
            const midSX = svgGap.midX * scale + offsetX;
            const midSY = svgGap.midY * scale + offsetY;
            const fontSize = 14 * scale;
            elements += `\n  <rect x="${midSX - svgGap.textWidth * scale / 2 - 8 * scale}" y="${midSY - svgGap.textHeight * scale / 2 - 4 * scale}" width="${(svgGap.textWidth + 16) * scale}" height="${(svgGap.textHeight + 8) * scale}" fill="rgba(255,255,255,0.85)" rx="2"${opacity} />`;
            elements += `\n  <text x="${midSX}" y="${midSY}" font-family="sans-serif" font-size="${fontSize}" fill="${stroke}" text-anchor="middle" dominant-baseline="central"${opacity}>${escapeXml(shape.text)}</text>`;
          } else {
            elements = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"${opacity} />`;
          }
        } else {
          elements = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"${opacity} />`;
        }
      }

      // Add endpoint shapes using routing-aware angles
      const endAngle = getExportEndAngle(shape.x, shape.y, shape.x2, shape.y2, arrowMode, shape.controlPoints);
      const startAngle = getExportStartAngle(shape.x, shape.y, shape.x2, shape.y2, arrowMode, shape.controlPoints);

      const svgEndEp = getExportEffectiveEndpoint(shape.endEndpoint, shape.arrowheadEnd, true);
      const svgStartEp = getExportEffectiveEndpoint(shape.startEndpoint, shape.arrowheadStart, false);

      if (svgEndEp.shape !== 'none') {
        const epSvg = getExportEndpointSVG(x2, y2, endAngle, svgEndEp.shape, svgEndEp.size, strokeWidth, stroke, stroke, opacity);
        if (epSvg) elements += `\n  ${epSvg}`;
      }

      if (svgStartEp.shape !== 'none') {
        const epSvg = getExportEndpointSVG(x1, y1, startAngle + Math.PI, svgStartEp.shape, svgStartEp.size, strokeWidth, stroke, stroke, opacity);
        if (epSvg) elements += `\n  ${epSvg}`;
      }

      return elements;
    }

    case 'freedraw': {
      if (shape.points.length < 2) return '';

      let pathData = `M ${shape.points[0].x * scale + offsetX} ${shape.points[0].y * scale + offsetY}`;
      for (let i = 1; i < shape.points.length; i++) {
        pathData += ` L ${shape.points[i].x * scale + offsetX} ${shape.points[i].y * scale + offsetY}`;
      }

      return `<path d="${pathData}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"${opacity} />`;
    }

    case 'text': {
      const x = shape.x * scale + offsetX;
      const y = shape.y * scale + offsetY;
      const fontSize = shape.fontSize * scale;
      return `<text x="${x}" y="${y}" font-family="${shape.fontFamily}" font-size="${fontSize}" fill="${stroke}"${opacity}>${escapeXml(shape.text)}</text>`;
    }

    case 'sticky': {
      const stickyShape = shape as any;
      const sx = stickyShape.x * scale + offsetX;
      const sy = stickyShape.y * scale + offsetY;
      const sw = stickyShape.width * scale;
      const sh = stickyShape.height * scale;
      const bgColor = stickyShape.stickyColor || '#fff9c4';
      const cr = 4 * scale;
      const fs = Math.min(16 * scale, sw * 0.12, sh * 0.12);
      const borderColor = darkenExportColor(bgColor, 0.15);
      const foldColor = darkenExportColor(bgColor, 0.08);

      // Build SVG path for main body
      let elements = `<g${opacity}>`;
      // Shadow filter
      elements += `\n    <defs><filter id="shadow-${stickyShape.id}" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="2" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.15)"/></filter></defs>`;
      // Main body path
      const bodyPath = `M ${sx + cr} ${sy} L ${sx + sw - fs} ${sy} L ${sx + sw} ${sy + fs} L ${sx + sw} ${sy + sh - cr} Q ${sx + sw} ${sy + sh} ${sx + sw - cr} ${sy + sh} L ${sx + cr} ${sy + sh} Q ${sx} ${sy + sh} ${sx} ${sy + sh - cr} L ${sx} ${sy + cr} Q ${sx} ${sy} ${sx + cr} ${sy} Z`;
      elements += `\n    <path d="${bodyPath}" fill="${bgColor}" stroke="${borderColor}" stroke-width="${strokeWidth}" filter="url(#shadow-${stickyShape.id})"/>`;
      // Fold corner
      const foldPath = `M ${sx + sw - fs} ${sy} L ${sx + sw - fs} ${sy + fs} L ${sx + sw} ${sy + fs} Z`;
      elements += `\n    <path d="${foldPath}" fill="${foldColor}" stroke="${borderColor}" stroke-width="${strokeWidth}"/>`;
      // Text
      if (stickyShape.text) {
        const padding = 10 * scale;
        const stickyFontSize = (stickyShape.fontSize || 14) * scale;
        const stickyHAlign = stickyShape.textAlign || 'center';
        const stickyVAlign = stickyShape.verticalAlign || 'middle';

        // Calculate x position and text-anchor based on horizontal alignment
        let textX: number;
        let textAnchor: string;
        if (stickyHAlign === 'left') {
          textX = sx + padding;
          textAnchor = 'start';
        } else if (stickyHAlign === 'right') {
          textX = sx + sw - padding;
          textAnchor = 'end';
        } else {
          textX = sx + sw / 2;
          textAnchor = 'middle';
        }

        // Calculate y position based on vertical alignment
        let textY: number;
        let domBaseline: string;
        if (stickyVAlign === 'top') {
          textY = sy + padding;
          domBaseline = 'hanging';
        } else if (stickyVAlign === 'bottom') {
          textY = sy + sh - padding;
          domBaseline = 'auto';
        } else {
          textY = sy + sh / 2;
          domBaseline = 'central';
        }

        elements += `\n    <text x="${textX}" y="${textY}" font-family="sans-serif" font-size="${stickyFontSize}" fill="${stroke}" text-anchor="${textAnchor}" dominant-baseline="${domBaseline}">${escapeXml(stickyShape.text)}</text>`;
      }
      elements += `\n  </g>`;
      return elements;
    }

    default:
      return '';
  }
}

/**
 * Create complete SVG document
 */
function createSVGDocument(width: number, height: number, backgroundColor: string, content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${backgroundColor}" />
  ${content}
</svg>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
