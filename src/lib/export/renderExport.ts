/**
 * Export rendering module.
 * Mirrors the rendering logic in Canvas.svelte using rough.js for sketchy shapes.
 * Uses a fresh RoughCanvas instance per export (no singleton dependency).
 */

import rough from 'roughjs';
import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { Shape } from '../types';
import type { TextGap } from '../canvas/roughRenderer';
import { applyStrokeStyle } from '../canvas/strokeStyles';
import { drawEndpointShape, getEffectiveEndpoint } from '../canvas/endpointRenderer';
import { getElbowPathPoints, getEndAngle, getStartAngle } from '../utils/routing';
import { loadImage } from '../shapes/image';
import { getCloudSvgPath, traceCloudPath } from '../shapes/cloud';

// --- Stroke style conversion (mirrors roughRenderer.ts) ---

function getStrokeLineDash(strokeStyle?: string): number[] | undefined {
  switch (strokeStyle) {
    case 'dashed': return [10, 5];
    case 'dotted': return [2, 3];
    case 'dashed-small': return [5, 3];
    case 'dashed-large': return [20, 10];
    case 'dash-dot': return [10, 5, 2, 5];
    case 'dash-dot-dot': return [10, 5, 2, 5, 2, 5];
    case 'solid':
    default: return undefined;
  }
}

// --- Color helpers ---

function darkenHexColor(hex: string, factor: number): string {
  if (!hex || hex.length < 7) return '#999999';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.round(r * (1 - factor));
  const dg = Math.round(g * (1 - factor));
  const db = Math.round(b * (1 - factor));
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

// --- Bounding box calculation ---

export function getContentBounds(shapes: Shape[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (shapes.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const shape of shapes) {
    const s = shape as any;

    if (s.type === 'line' || s.type === 'arrow') {
      const x1 = s.x;
      const y1 = s.y;
      const x2 = s.x2 ?? s.x;
      const y2 = s.y2 ?? s.y;
      minX = Math.min(minX, x1, x2);
      minY = Math.min(minY, y1, y2);
      maxX = Math.max(maxX, x1, x2);
      maxY = Math.max(maxY, y1, y2);
      if (s.controlPoints) {
        for (const cp of s.controlPoints) {
          minX = Math.min(minX, cp.x);
          minY = Math.min(minY, cp.y);
          maxX = Math.max(maxX, cp.x);
          maxY = Math.max(maxY, cp.y);
        }
      }
    } else if (s.type === 'freedraw' && s.points) {
      for (const pt of s.points) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      }
    } else if (s.type === 'text') {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + (s.width || 200));
      maxY = Math.max(maxY, s.y + (s.height || 30));
    } else {
      const w = s.width || 0;
      const h = s.height || 0;
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + w);
      maxY = Math.max(maxY, s.y + h);
    }
  }

  // Margin for stroke widths and endpoints
  const margin = 20;
  return {
    minX: minX - margin,
    minY: minY - margin,
    maxX: maxX + margin,
    maxY: maxY + margin,
  };
}

// --- Main export rendering entry point ---

export async function renderShapesToCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  shapes: Shape[]
): Promise<void> {
  // Pre-load any images that don't have their imageElement loaded
  for (const shape of shapes) {
    const s = shape as any;
    if (s.type === 'image' && s.src && !s.imageElement) {
      try {
        s.imageElement = await loadImage(s.src);
        s.loaded = true;
      } catch {
        // Skip failed images
      }
    }
  }

  // Create a fresh RoughCanvas instance for this export canvas
  const rc = rough.canvas(canvas);

  // Render each shape in z-order
  for (const shape of shapes) {
    renderShape(ctx, rc, shape as any);
  }
}

// --- Per-shape rendering (mirrors Canvas.svelte) ---

function renderShape(ctx: CanvasRenderingContext2D, rc: RoughCanvas, shape: any): void {
  ctx.save();
  ctx.globalAlpha = shape.opacity || 1;

  // Apply rotation
  if (shape.rotation && shape.rotation !== 0) {
    const centerX = shape.x + (shape.width || 0) / 2;
    const centerY = shape.y + (shape.height || 0) / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate(shape.rotation);
    ctx.translate(-centerX, -centerY);
  }

  switch (shape.type) {
    case 'rectangle': renderRectangle(ctx, rc, shape); break;
    case 'ellipse': renderEllipse(ctx, rc, shape); break;
    case 'triangle': renderTriangle(ctx, rc, shape); break;
    case 'diamond': renderDiamond(ctx, rc, shape); break;
    case 'hexagon': renderHexagon(ctx, rc, shape); break;
    case 'star': renderStar(ctx, rc, shape); break;
    case 'cloud': renderCloud(ctx, rc, shape); break;
    case 'cylinder': renderCylinder(ctx, rc, shape); break;
    case 'sticky': renderStickyNote(ctx, shape); break;
    case 'line': renderLine(ctx, rc, shape); break;
    case 'arrow': renderArrow(ctx, rc, shape); break;
    case 'freedraw': renderFreedraw(ctx, rc, shape); break;
    case 'text': renderText(ctx, shape); break;
    case 'image': renderImageShape(ctx, shape); break;
  }

  ctx.restore();
}

// --- Rectangle ---

function renderRectangle(ctx: CanvasRenderingContext2D, rc: RoughCanvas, shape: any): void {
  const roughness = shape.roughness ?? 1;
  const w = shape.width || 0;
  const h = shape.height || 0;

  if (roughness > 0) {
    rc.rectangle(shape.x, shape.y, w, h, {
      stroke: shape.strokeColor,
      strokeWidth: shape.strokeWidth,
      fill: shape.fillColor === 'transparent' ? undefined : shape.fillColor,
      fillStyle: shape.fillStyle || 'hachure',
      roughness,
      strokeLineDash: getStrokeLineDash(shape.strokeStyle),
      seed: 1,
    });
  } else {
    if (shape.fillColor && shape.fillColor !== 'transparent') {
      ctx.fillStyle = shape.fillColor;
      ctx.fillRect(shape.x, shape.y, w, h);
    }
    if (shape.strokeColor && shape.strokeWidth > 0) {
      ctx.strokeStyle = shape.strokeColor;
      ctx.lineWidth = shape.strokeWidth;
      applyStrokeStyle(ctx, shape.strokeStyle);
      ctx.strokeRect(shape.x, shape.y, w, h);
      ctx.setLineDash([]);
    }
  }

  if (shape.text) {
    renderShapeText(ctx, shape, w, h);
  }
}

// --- Ellipse ---

function renderEllipse(ctx: CanvasRenderingContext2D, rc: RoughCanvas, shape: any): void {
  const roughness = shape.roughness ?? 1;
  const w = shape.width || 0;
  const h = shape.height || 0;

  if (roughness > 0) {
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;
    rc.ellipse(cx, cy, Math.abs(w), Math.abs(h), {
      stroke: shape.strokeColor,
      strokeWidth: shape.strokeWidth,
      fill: shape.fillColor === 'transparent' ? undefined : shape.fillColor,
      fillStyle: shape.fillStyle || 'hachure',
      roughness,
      strokeLineDash: getStrokeLineDash(shape.strokeStyle),
      seed: 1,
    });
  } else {
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;
    const rx = Math.abs(w) / 2;
    const ry = Math.abs(h) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    if (shape.fillColor && shape.fillColor !== 'transparent') {
      ctx.fillStyle = shape.fillColor;
      ctx.fill();
    }
    if (shape.strokeColor && shape.strokeWidth > 0) {
      ctx.strokeStyle = shape.strokeColor;
      ctx.lineWidth = shape.strokeWidth;
      applyStrokeStyle(ctx, shape.strokeStyle);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (shape.text) {
    renderShapeText(ctx, shape, w, h);
  }
}

// --- Triangle ---

function renderTriangle(ctx: CanvasRenderingContext2D, rc: RoughCanvas, shape: any): void {
  const roughness = shape.roughness ?? 1;
  const w = shape.width || 0;
  const h = shape.height || 0;

  if (roughness > 0) {
    const x1 = shape.x + w / 2;
    const y1 = shape.y;
    const x2 = shape.x;
    const y2 = shape.y + h;
    const x3 = shape.x + w;
    const y3 = shape.y + h;
    rc.polygon([[x1, y1], [x2, y2], [x3, y3]], {
      stroke: shape.strokeColor,
      strokeWidth: shape.strokeWidth,
      fill: shape.fillColor === 'transparent' ? undefined : shape.fillColor,
      fillStyle: shape.fillStyle || 'hachure',
      roughness,
      strokeLineDash: getStrokeLineDash(shape.strokeStyle),
      seed: 1,
    });
  } else {
    ctx.beginPath();
    ctx.moveTo(shape.x + w / 2, shape.y);
    ctx.lineTo(shape.x, shape.y + h);
    ctx.lineTo(shape.x + w, shape.y + h);
    ctx.closePath();
    if (shape.fillColor && shape.fillColor !== 'transparent') {
      ctx.fillStyle = shape.fillColor;
      ctx.fill();
    }
    if (shape.strokeColor && shape.strokeWidth > 0) {
      ctx.strokeStyle = shape.strokeColor;
      ctx.lineWidth = shape.strokeWidth;
      applyStrokeStyle(ctx, shape.strokeStyle);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (shape.text) {
    renderShapeText(ctx, shape, w, h);
  }
}

// --- Diamond ---

function renderDiamond(ctx: CanvasRenderingContext2D, rc: RoughCanvas, shape: any): void {
  const roughness = shape.roughness ?? 1;
  const w = shape.width || 0;
  const h = shape.height || 0;
  const cx = shape.x + w / 2;
  const cy = shape.y + h / 2;

  if (roughness > 0) {
    rc.polygon([[cx, shape.y], [shape.x + w, cy], [cx, shape.y + h], [shape.x, cy]], {
      stroke: shape.strokeColor,
      strokeWidth: shape.strokeWidth,
      fill: shape.fillColor === 'transparent' ? undefined : shape.fillColor,
      fillStyle: shape.fillStyle || 'hachure',
      roughness,
      strokeLineDash: getStrokeLineDash(shape.strokeStyle),
      seed: 1,
    });
  } else {
    ctx.beginPath();
    ctx.moveTo(cx, shape.y);
    ctx.lineTo(shape.x + w, cy);
    ctx.lineTo(cx, shape.y + h);
    ctx.lineTo(shape.x, cy);
    ctx.closePath();
    if (shape.fillColor && shape.fillColor !== 'transparent') {
      ctx.fillStyle = shape.fillColor;
      ctx.fill();
    }
    if (shape.strokeColor && shape.strokeWidth > 0) {
      ctx.strokeStyle = shape.strokeColor;
      ctx.lineWidth = shape.strokeWidth;
      applyStrokeStyle(ctx, shape.strokeStyle);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (shape.text) {
    renderShapeText(ctx, shape, w, h);
  }
}

// --- Hexagon ---

function renderHexagon(ctx: CanvasRenderingContext2D, rc: RoughCanvas, shape: any): void {
  const roughness = shape.roughness ?? 1;
  const w = shape.width || 0;
  const h = shape.height || 0;
  const cx = shape.x + w / 2;
  const cy = shape.y + h / 2;
  const rx = w / 2;
  const ry = h / 2;

  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
  }

  if (roughness > 0) {
    rc.polygon(points, {
      stroke: shape.strokeColor,
      strokeWidth: shape.strokeWidth,
      fill: shape.fillColor === 'transparent' ? undefined : shape.fillColor,
      fillStyle: shape.fillStyle || 'hachure',
      roughness,
      strokeLineDash: getStrokeLineDash(shape.strokeStyle),
      seed: 1,
    });
  } else {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    if (shape.fillColor && shape.fillColor !== 'transparent') {
      ctx.fillStyle = shape.fillColor;
      ctx.fill();
    }
    if (shape.strokeColor && shape.strokeWidth > 0) {
      ctx.strokeStyle = shape.strokeColor;
      ctx.lineWidth = shape.strokeWidth;
      applyStrokeStyle(ctx, shape.strokeStyle);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (shape.text) {
    renderShapeText(ctx, shape, w, h);
  }
}

// --- Star ---

function renderStar(ctx: CanvasRenderingContext2D, rc: RoughCanvas, shape: any): void {
  const roughness = shape.roughness ?? 1;
  const w = shape.width || 0;
  const h = shape.height || 0;
  const cx = shape.x + w / 2;
  const cy = shape.y + h / 2;
  const outerRadius = Math.min(w, h) / 2;
  const innerRadius = outerRadius * 0.4;
  const numPoints = 5;

  const starPoints: [number, number][] = [];
  for (let i = 0; i < numPoints * 2; i++) {
    const angle = (Math.PI / numPoints) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    starPoints.push([
      cx + radius * Math.cos(angle) * (w / h),
      cy + radius * Math.sin(angle),
    ]);
  }

  if (roughness > 0) {
    rc.polygon(starPoints, {
      stroke: shape.strokeColor,
      strokeWidth: shape.strokeWidth,
      fill: shape.fillColor === 'transparent' ? undefined : shape.fillColor,
      fillStyle: shape.fillStyle || 'hachure',
      roughness,
      strokeLineDash: getStrokeLineDash(shape.strokeStyle),
      seed: 1,
    });
  } else {
    ctx.beginPath();
    ctx.moveTo(starPoints[0][0], starPoints[0][1]);
    for (let i = 1; i < starPoints.length; i++) {
      ctx.lineTo(starPoints[i][0], starPoints[i][1]);
    }
    ctx.closePath();
    if (shape.fillColor && shape.fillColor !== 'transparent') {
      ctx.fillStyle = shape.fillColor;
      ctx.fill();
    }
    if (shape.strokeColor && shape.strokeWidth > 0) {
      ctx.strokeStyle = shape.strokeColor;
      ctx.lineWidth = shape.strokeWidth;
      applyStrokeStyle(ctx, shape.strokeStyle);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (shape.text) {
    renderShapeText(ctx, shape, w, h);
  }
}

// --- Cloud ---

function renderCloud(ctx: CanvasRenderingContext2D, rc: RoughCanvas, shape: any): void {
  const roughness = shape.roughness ?? 1;
  const w = shape.width || 0;
  const h = shape.height || 0;

  if (roughness > 0) {
    const strokeLineDash = getStrokeLineDash(shape.strokeStyle);
    const svgPath = getCloudSvgPath(shape.x, shape.y, w, h);
    rc.path(svgPath, {
      stroke: shape.strokeColor,
      strokeWidth: shape.strokeWidth,
      fill: shape.fillColor !== 'transparent' ? shape.fillColor : undefined,
      fillStyle: shape.fillStyle || 'hachure',
      roughness,
      strokeLineDash,
      seed: 1,
    });
  } else {
    traceCloudPath(ctx, shape.x, shape.y, w, h);
    if (shape.fillColor && shape.fillColor !== 'transparent') {
      ctx.fillStyle = shape.fillColor;
      ctx.fill();
    }
    if (shape.strokeColor && shape.strokeWidth > 0) {
      ctx.strokeStyle = shape.strokeColor;
      ctx.lineWidth = shape.strokeWidth;
      applyStrokeStyle(ctx, shape.strokeStyle);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (shape.text) {
    renderShapeText(ctx, shape, w, h);
  }
}

// --- Cylinder ---

function renderCylinder(ctx: CanvasRenderingContext2D, rc: RoughCanvas, shape: any): void {
  const roughness = shape.roughness ?? 1;
  const w = shape.width || 0;
  const h = shape.height || 0;
  const ellipseHeight = h * 0.15;

  if (roughness > 0) {
    const strokeLineDash = getStrokeLineDash(shape.strokeStyle);
    // Top ellipse
    rc.ellipse(shape.x + w / 2, shape.y + ellipseHeight / 2, w, ellipseHeight, {
      stroke: shape.strokeColor,
      strokeWidth: shape.strokeWidth,
      fill: shape.fillColor === 'transparent' ? undefined : shape.fillColor,
      fillStyle: shape.fillStyle || 'hachure',
      roughness,
      strokeLineDash,
      seed: 1,
    });
    // Left side
    rc.line(shape.x, shape.y + ellipseHeight / 2, shape.x, shape.y + h - ellipseHeight / 2, {
      stroke: shape.strokeColor,
      strokeWidth: shape.strokeWidth,
      roughness,
      strokeLineDash,
      seed: 1,
    });
    // Right side
    rc.line(shape.x + w, shape.y + ellipseHeight / 2, shape.x + w, shape.y + h - ellipseHeight / 2, {
      stroke: shape.strokeColor,
      strokeWidth: shape.strokeWidth,
      roughness,
      strokeLineDash,
      seed: 1,
    });
    // Bottom ellipse
    rc.ellipse(shape.x + w / 2, shape.y + h - ellipseHeight / 2, w, ellipseHeight, {
      stroke: shape.strokeColor,
      strokeWidth: shape.strokeWidth,
      fill: shape.fillColor === 'transparent' ? undefined : shape.fillColor,
      fillStyle: shape.fillStyle || 'hachure',
      roughness,
      strokeLineDash,
      seed: 1,
    });
  } else {
    // Top ellipse
    ctx.beginPath();
    ctx.ellipse(shape.x + w / 2, shape.y + ellipseHeight / 2, w / 2, ellipseHeight / 2, 0, 0, Math.PI * 2);
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
    // Sides
    ctx.beginPath();
    ctx.moveTo(shape.x, shape.y + ellipseHeight / 2);
    ctx.lineTo(shape.x, shape.y + h - ellipseHeight / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(shape.x + w, shape.y + ellipseHeight / 2);
    ctx.lineTo(shape.x + w, shape.y + h - ellipseHeight / 2);
    ctx.stroke();
    // Bottom ellipse
    ctx.beginPath();
    ctx.ellipse(shape.x + w / 2, shape.y + h - ellipseHeight / 2, w / 2, ellipseHeight / 2, 0, 0, Math.PI * 2);
    if (shape.fillColor && shape.fillColor !== 'transparent') {
      ctx.fillStyle = shape.fillColor;
      ctx.fill();
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (shape.text) {
    renderShapeText(ctx, shape, w, h);
  }
}

// --- Sticky Note (Canvas2D only, no rough.js) ---

function renderStickyNote(ctx: CanvasRenderingContext2D, shape: any): void {
  const { x, y, stickyColor, strokeWidth } = shape;
  const width = shape.width || 150;
  const height = shape.height || 150;
  const cornerRadius = 4;
  const foldSize = Math.min(16, width * 0.12, height * 0.12);
  const bgColor = stickyColor || '#fff9c4';

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
  ctx.restore(); // Remove shadow

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

  ctx.strokeStyle = darkenHexColor(bgColor, 0.15);
  ctx.lineWidth = strokeWidth || 1;
  ctx.stroke();

  // Fold corner
  ctx.beginPath();
  ctx.moveTo(x + width - foldSize, y);
  ctx.lineTo(x + width - foldSize, y + foldSize);
  ctx.lineTo(x + width, y + foldSize);
  ctx.closePath();

  ctx.fillStyle = darkenHexColor(bgColor, 0.08);
  ctx.fill();
  ctx.strokeStyle = darkenHexColor(bgColor, 0.15);
  ctx.lineWidth = strokeWidth || 1;
  ctx.stroke();

  // Text
  if (shape.text) {
    renderStickyNoteText(ctx, shape, width, height);
  }
}

function renderStickyNoteText(ctx: CanvasRenderingContext2D, shape: any, width: number, height: number): void {
  const padding = 10;
  const maxWidth = width - padding * 2;
  const fSize = shape.fontSize || 14;
  const lineHeight = fSize * 1.3;
  const hAlign = shape.textAlign || 'center';
  const vAlign = shape.verticalAlign || 'middle';

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = shape.strokeColor || '#333333';
  ctx.font = `${fSize}px sans-serif`;
  ctx.textBaseline = 'top';

  let textAnchorAlign: CanvasTextAlign = 'left';
  if (hAlign === 'center') textAnchorAlign = 'center';
  else if (hAlign === 'right') textAnchorAlign = 'right';
  ctx.textAlign = textAnchorAlign;

  let anchorX: number;
  if (hAlign === 'center') {
    anchorX = shape.x + width / 2;
  } else if (hAlign === 'right') {
    anchorX = shape.x + width - padding;
  } else {
    anchorX = shape.x + padding;
  }

  // Word wrap
  const lines: string[] = [];
  const paragraphs = (shape.text || '').split('\n');
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

  // Vertical positioning
  const totalTextHeight = lines.length * lineHeight;
  const availableHeight = height - padding * 2;
  let startY: number;
  if (vAlign === 'top') {
    startY = shape.y + padding;
  } else if (vAlign === 'bottom') {
    startY = shape.y + height - padding - totalTextHeight;
  } else {
    if (totalTextHeight < availableHeight) {
      startY = shape.y + (height - totalTextHeight) / 2;
    } else {
      startY = shape.y + padding;
    }
  }

  // Clip to shape bounds
  ctx.beginPath();
  ctx.rect(shape.x + padding, shape.y + padding, maxWidth, height - padding * 2);
  ctx.clip();

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], anchorX, startY + i * lineHeight);
  }
  ctx.restore();
}

// --- Line ---

function renderLine(ctx: CanvasRenderingContext2D, rc: RoughCanvas, shape: any): void {
  const x1 = shape.x;
  const y1 = shape.y;
  const x2 = shape.x2 || shape.x;
  const y2 = shape.y2 || shape.y;
  const routingMode = shape.routingMode || 'direct';
  const controlPoints = shape.controlPoints;

  // Calculate text gap for direct mode
  let gapInfo: { gap: TextGap; textWidth: number; textHeight: number; midX: number; midY: number } | null = null;
  if (shape.text && routingMode === 'direct') {
    gapInfo = calculateTextGap(ctx, x1, y1, x2, y2, shape.text, shape.fontSize || 14, shape.fontFamily || 'sans-serif');
  }

  if (shape.strokeColor && shape.strokeWidth > 0) {
    const roughness = shape.roughness ?? 1;

    if (roughness > 0) {
      const strokeLineDash = getStrokeLineDash(shape.strokeStyle);

      if (routingMode === 'elbow') {
        const pts = getElbowPathPoints(x1, y1, x2, y2, controlPoints);
        const linearPts: [number, number][] = pts.map(p => [p.x, p.y]);
        rc.linearPath(linearPts, {
          stroke: shape.strokeColor,
          strokeWidth: shape.strokeWidth,
          roughness,
          strokeLineDash,
          seed: 1,
        });
      } else if (routingMode === 'curved') {
        const cp = controlPoints && controlPoints.length > 0
          ? controlPoints[0]
          : { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
        rc.curve([[x1, y1], [cp.x, cp.y], [x2, y2]], {
          stroke: shape.strokeColor,
          strokeWidth: shape.strokeWidth,
          roughness,
          strokeLineDash,
          seed: 1,
        });
      } else if (gapInfo) {
        // Direct with text gap - two segments
        rc.line(x1, y1, gapInfo.gap.gapStartX, gapInfo.gap.gapStartY, {
          stroke: shape.strokeColor,
          strokeWidth: shape.strokeWidth,
          roughness,
          strokeLineDash,
          seed: 1,
        });
        rc.line(gapInfo.gap.gapEndX, gapInfo.gap.gapEndY, x2, y2, {
          stroke: shape.strokeColor,
          strokeWidth: shape.strokeWidth,
          roughness,
          strokeLineDash,
          seed: 2,
        });
      } else {
        rc.line(x1, y1, x2, y2, {
          stroke: shape.strokeColor,
          strokeWidth: shape.strokeWidth,
          roughness,
          strokeLineDash,
          seed: 1,
        });
      }
    } else {
      // Smooth rendering (roughness = 0)
      ctx.strokeStyle = shape.strokeColor;
      ctx.lineWidth = shape.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      applyStrokeStyle(ctx, shape.strokeStyle);

      if (routingMode === 'elbow') {
        const pts = getElbowPathPoints(x1, y1, x2, y2, controlPoints);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      } else if (routingMode === 'curved') {
        const cp = controlPoints && controlPoints.length > 0
          ? controlPoints[0]
          : { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cp.x, cp.y, x2, y2);
        ctx.stroke();
      } else if (gapInfo) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(gapInfo.gap.gapStartX, gapInfo.gap.gapStartY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(gapInfo.gap.gapEndX, gapInfo.gap.gapEndY);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Endpoint shapes
    const lineEndAngle = getEndAngle(x1, y1, x2, y2, routingMode, controlPoints);
    const lineStartAngle = getStartAngle(x1, y1, x2, y2, routingMode, controlPoints);
    const lineEndEp = getEffectiveEndpoint(shape.endEndpoint, false, true);
    const lineStartEp = getEffectiveEndpoint(shape.startEndpoint, false, false);

    if (lineEndEp.shape !== 'none') {
      drawEndpointShape(ctx, x2, y2, lineEndAngle, lineEndEp.shape, lineEndEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
    }
    if (lineStartEp.shape !== 'none') {
      drawEndpointShape(ctx, x1, y1, lineStartAngle + Math.PI, lineStartEp.shape, lineStartEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
    }
  }

  // Text label
  if (shape.text) {
    if (gapInfo) {
      renderLineText(ctx, shape, gapInfo.midX, gapInfo.midY, gapInfo.textWidth, gapInfo.textHeight);
    } else {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      ctx.save();
      const fontSize = shape.fontSize || 14;
      ctx.font = `${fontSize}px ${shape.fontFamily || 'sans-serif'}`;
      const metrics = ctx.measureText(shape.text);
      ctx.restore();
      renderLineText(ctx, shape, midX, midY, metrics.width, fontSize * 1.2);
    }
  }
}

// --- Arrow ---

function renderArrow(ctx: CanvasRenderingContext2D, rc: RoughCanvas, shape: any): void {
  const x1 = shape.x;
  const y1 = shape.y;
  const x2 = shape.x2 || shape.x;
  const y2 = shape.y2 || shape.y;
  const routingMode = shape.routingMode || 'direct';
  const controlPoints = shape.controlPoints;

  let gapInfo: { gap: TextGap; textWidth: number; textHeight: number; midX: number; midY: number } | null = null;
  if (shape.text && routingMode === 'direct') {
    gapInfo = calculateTextGap(ctx, x1, y1, x2, y2, shape.text, shape.fontSize || 14, shape.fontFamily || 'sans-serif');
  }

  if (shape.strokeColor && shape.strokeWidth > 0) {
    const roughness = shape.roughness ?? 1;

    if (roughness > 0) {
      const strokeLineDash = getStrokeLineDash(shape.strokeStyle);

      // Draw line portion (same as renderLine but without line endpoints)
      if (routingMode === 'elbow') {
        const pts = getElbowPathPoints(x1, y1, x2, y2, controlPoints);
        const linearPts: [number, number][] = pts.map(p => [p.x, p.y]);
        rc.linearPath(linearPts, {
          stroke: shape.strokeColor,
          strokeWidth: shape.strokeWidth,
          roughness,
          strokeLineDash,
          seed: 1,
        });
      } else if (routingMode === 'curved') {
        const cp = controlPoints && controlPoints.length > 0
          ? controlPoints[0]
          : { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
        rc.curve([[x1, y1], [cp.x, cp.y], [x2, y2]], {
          stroke: shape.strokeColor,
          strokeWidth: shape.strokeWidth,
          roughness,
          strokeLineDash,
          seed: 1,
        });
      } else if (gapInfo) {
        rc.line(x1, y1, gapInfo.gap.gapStartX, gapInfo.gap.gapStartY, {
          stroke: shape.strokeColor,
          strokeWidth: shape.strokeWidth,
          roughness,
          strokeLineDash,
          seed: 1,
        });
        rc.line(gapInfo.gap.gapEndX, gapInfo.gap.gapEndY, x2, y2, {
          stroke: shape.strokeColor,
          strokeWidth: shape.strokeWidth,
          roughness,
          strokeLineDash,
          seed: 2,
        });
      } else {
        rc.line(x1, y1, x2, y2, {
          stroke: shape.strokeColor,
          strokeWidth: shape.strokeWidth,
          roughness,
          strokeLineDash,
          seed: 1,
        });
      }

      // Arrow endpoint shapes
      const endAngle = getEndAngle(x1, y1, x2, y2, routingMode, controlPoints);
      const startAngle = getStartAngle(x1, y1, x2, y2, routingMode, controlPoints);
      const endEp = getEffectiveEndpoint(shape.endEndpoint, shape.arrowheadEnd, true);
      const startEp = getEffectiveEndpoint(shape.startEndpoint, shape.arrowheadStart, false);

      if (endEp.shape !== 'none') {
        drawEndpointShape(ctx, x2, y2, endAngle, endEp.shape, endEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
      }
      if (startEp.shape !== 'none') {
        drawEndpointShape(ctx, x1, y1, startAngle + Math.PI, startEp.shape, startEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
      }
    } else {
      // Smooth rendering (roughness = 0)
      ctx.strokeStyle = shape.strokeColor;
      ctx.lineWidth = shape.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      applyStrokeStyle(ctx, shape.strokeStyle);

      if (routingMode === 'elbow') {
        const pts = getElbowPathPoints(x1, y1, x2, y2, controlPoints);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      } else if (routingMode === 'curved') {
        const cp = controlPoints && controlPoints.length > 0
          ? controlPoints[0]
          : { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cp.x, cp.y, x2, y2);
        ctx.stroke();
      } else if (gapInfo) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(gapInfo.gap.gapStartX, gapInfo.gap.gapStartY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(gapInfo.gap.gapEndX, gapInfo.gap.gapEndY);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Arrow endpoint shapes
      const endAngle = getEndAngle(x1, y1, x2, y2, routingMode, controlPoints);
      const startAngle = getStartAngle(x1, y1, x2, y2, routingMode, controlPoints);
      const endEp = getEffectiveEndpoint(shape.endEndpoint, shape.arrowheadEnd, true);
      const startEp = getEffectiveEndpoint(shape.startEndpoint, shape.arrowheadStart, false);

      if (endEp.shape !== 'none') {
        drawEndpointShape(ctx, x2, y2, endAngle, endEp.shape, endEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
      }
      if (startEp.shape !== 'none') {
        drawEndpointShape(ctx, x1, y1, startAngle + Math.PI, startEp.shape, startEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
      }
    }
  }

  // Text label
  if (shape.text) {
    if (gapInfo) {
      renderLineText(ctx, shape, gapInfo.midX, gapInfo.midY, gapInfo.textWidth, gapInfo.textHeight);
    } else {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      ctx.save();
      const fontSize = shape.fontSize || 14;
      ctx.font = `${fontSize}px ${shape.fontFamily || 'sans-serif'}`;
      const metrics = ctx.measureText(shape.text);
      ctx.restore();
      renderLineText(ctx, shape, midX, midY, metrics.width, fontSize * 1.2);
    }
  }
}

// --- Freedraw ---

function renderFreedraw(ctx: CanvasRenderingContext2D, rc: RoughCanvas, shape: any): void {
  if (!shape.points || shape.points.length < 2) return;
  if (!shape.strokeColor || shape.strokeWidth <= 0) return;

  const roughness = shape.roughness ?? 1;

  if (roughness > 0) {
    // Convert points to SVG path
    let pathData = `M ${shape.points[0].x} ${shape.points[0].y}`;
    for (let i = 1; i < shape.points.length; i++) {
      pathData += ` L ${shape.points[i].x} ${shape.points[i].y}`;
    }
    rc.path(pathData, {
      stroke: shape.strokeColor,
      strokeWidth: shape.strokeWidth,
      roughness,
      strokeLineDash: getStrokeLineDash(shape.strokeStyle),
      seed: 1,
    });
  } else {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    applyStrokeStyle(ctx, shape.strokeStyle);

    ctx.beginPath();
    ctx.moveTo(shape.points[0].x, shape.points[0].y);
    for (let i = 1; i < shape.points.length; i++) {
      ctx.lineTo(shape.points[i].x, shape.points[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// --- Text ---

function renderText(ctx: CanvasRenderingContext2D, shape: any): void {
  if (!shape.text) return;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.font = `${shape.fontSize}px ${shape.fontFamily}`;
  ctx.textBaseline = 'top';

  const lines = shape.text.split('\n');

  if (shape.fillColor && shape.fillColor !== 'transparent') {
    ctx.fillStyle = shape.fillColor;
    ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
  }

  if (shape.strokeColor) {
    ctx.fillStyle = shape.strokeColor;
    for (let i = 0; i < lines.length; i++) {
      const y = shape.y + i * shape.fontSize * 1.2;
      ctx.fillText(lines[i], shape.x, y);
    }
  }

  ctx.restore();
}

// --- Image ---

function renderImageShape(ctx: CanvasRenderingContext2D, shape: any): void {
  if (!shape.loaded || !shape.imageElement) {
    // Placeholder
    ctx.save();
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    ctx.fillStyle = '#999';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Image', shape.x + shape.width / 2, shape.y + shape.height / 2);
    ctx.restore();
    return;
  }

  ctx.save();
  try {
    ctx.drawImage(shape.imageElement, shape.x, shape.y, shape.width, shape.height);
  } catch {
    ctx.fillStyle = '#ffebee';
    ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
    ctx.strokeStyle = '#f44336';
    ctx.lineWidth = 2;
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
  }
  ctx.restore();
}

// --- Text helpers (mirrors Canvas.svelte) ---

function renderShapeText(ctx: CanvasRenderingContext2D, shape: any, width: number, height: number): void {
  if (!shape.text) return;

  ctx.save();
  ctx.globalAlpha = 1;

  const fontSize = shape.fontSize || 14;
  const fontFamily = shape.fontFamily || 'sans-serif';
  const hAlign = shape.textAlign || 'center';
  const vAlign = shape.verticalAlign || 'middle';
  const padding = 10;
  const labelPosition = shape.labelPosition || 'inside';
  const gap = 4;

  ctx.fillStyle = shape.strokeColor || '#000';
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'middle';

  // Word wrap
  const maxWidth = labelPosition === 'inside' ? width - padding * 2 : width;
  const paragraphs = (shape.text || '').split('\n');
  const lines: string[] = [];

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

  const lineHeight = fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;

  let anchorX: number;
  let startY: number;

  if (labelPosition === 'outside-top') {
    ctx.textAlign = 'center';
    anchorX = shape.x + width / 2;
    startY = shape.y - gap - totalHeight + lineHeight / 2;
  } else if (labelPosition === 'outside-bottom') {
    ctx.textAlign = 'center';
    anchorX = shape.x + width / 2;
    startY = shape.y + height + gap + lineHeight / 2;
  } else if (labelPosition === 'outside-left') {
    ctx.textAlign = 'right';
    anchorX = shape.x - gap;
    startY = shape.y + height / 2 - totalHeight / 2 + lineHeight / 2;
  } else if (labelPosition === 'outside-right') {
    ctx.textAlign = 'left';
    anchorX = shape.x + width + gap;
    startY = shape.y + height / 2 - totalHeight / 2 + lineHeight / 2;
  } else {
    // 'inside'
    let textAnchorAlign: CanvasTextAlign = 'center';
    if (hAlign === 'left') textAnchorAlign = 'left';
    else if (hAlign === 'right') textAnchorAlign = 'right';
    ctx.textAlign = textAnchorAlign;

    if (hAlign === 'left') {
      anchorX = shape.x + padding;
    } else if (hAlign === 'right') {
      anchorX = shape.x + width - padding;
    } else {
      anchorX = shape.x + width / 2;
    }

    if (vAlign === 'top') {
      startY = shape.y + padding + lineHeight / 2;
    } else if (vAlign === 'bottom') {
      startY = shape.y + height - padding - totalHeight + lineHeight / 2;
    } else {
      startY = shape.y + height / 2 - totalHeight / 2 + lineHeight / 2;
    }
  }

  for (const line of lines) {
    ctx.fillText(line, anchorX, startY);
    startY += lineHeight;
  }

  ctx.restore();
}

function calculateTextGap(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  text: string,
  fontSize: number = 14,
  fontFamily: string = 'sans-serif'
): { gap: TextGap; textWidth: number; textHeight: number; midX: number; midY: number } | null {
  if (!text) return null;

  ctx.save();
  ctx.font = `${fontSize}px ${fontFamily}`;

  const textLines = text.split('\n');
  let maxLineWidth = 0;
  for (const line of textLines) {
    const metrics = ctx.measureText(line);
    maxLineWidth = Math.max(maxLineWidth, metrics.width);
  }
  const textWidth = maxLineWidth;
  const lineHeight = fontSize * 1.2;
  const textHeight = textLines.length * lineHeight;

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

  const gapStartX = midX - ux * halfGapAlongLine;
  const gapStartY = midY - uy * halfGapAlongLine;
  const gapEndX = midX + ux * halfGapAlongLine;
  const gapEndY = midY + uy * halfGapAlongLine;

  return {
    gap: { gapStartX, gapStartY, gapEndX, gapEndY },
    textWidth,
    textHeight,
    midX,
    midY
  };
}

function renderLineText(
  ctx: CanvasRenderingContext2D,
  shape: any,
  midX: number,
  midY: number,
  textWidth: number,
  textHeight: number
): void {
  if (!shape.text) return;

  ctx.save();
  ctx.globalAlpha = 1;

  const fontSize = shape.fontSize || 14;
  const fontFamily = shape.fontFamily || 'sans-serif';
  const paddingX = 8;
  const paddingY = 4;

  // Background for legibility
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(
    midX - textWidth / 2 - paddingX,
    midY - textHeight / 2 - paddingY,
    textWidth + paddingX * 2,
    textHeight + paddingY * 2
  );

  // Text
  ctx.fillStyle = shape.strokeColor || '#000';
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = shape.text.split('\n');
  const lineHeight = fontSize * 1.2;
  const totalH = lines.length * lineHeight;
  let startY = midY - totalH / 2 + lineHeight / 2;

  for (const line of lines) {
    ctx.fillText(line, midX, startY);
    startY += lineHeight;
  }

  ctx.restore();
}
