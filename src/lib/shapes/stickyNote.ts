/**
 * Sticky note shape implementation
 */

import type { StickyNoteShape, BoundingBox } from '../types';
import { STICKY_NOTE_COLORS } from '../types';

/**
 * Create a new sticky note shape
 */
export function createStickyNote(
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    stickyColor?: string;
    fontSize?: number;
    text?: string;
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    opacity?: number;
    roughness?: number;
  } = {}
): StickyNoteShape {
  return {
    id: crypto.randomUUID(),
    type: 'sticky',
    x,
    y,
    width,
    height,
    stickyColor: options.stickyColor || STICKY_NOTE_COLORS.yellow,
    fontSize: options.fontSize || 14,
    text: options.text || '',
    strokeColor: options.strokeColor || '#333333',
    strokeWidth: options.strokeWidth || 1,
    fillColor: options.stickyColor || STICKY_NOTE_COLORS.yellow,
    opacity: options.opacity || 1,
    roughness: options.roughness ?? 0, // Sticky notes look better with clean lines
  };
}

/**
 * Render a sticky note shape to canvas
 */
export function renderStickyNote(
  ctx: CanvasRenderingContext2D,
  shape: StickyNoteShape
): void {
  ctx.save();
  ctx.globalAlpha = shape.opacity;

  const { x, y, width, height, stickyColor } = shape;
  const cornerRadius = 4;
  const foldSize = 16;

  // Draw shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;

  // Draw main body (rounded rect minus fold corner)
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

  // Fill with sticky color
  ctx.fillStyle = stickyColor;
  ctx.fill();
  ctx.restore(); // Remove shadow for subsequent draws

  // Draw border
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

  ctx.strokeStyle = darkenColor(stickyColor, 0.15);
  ctx.lineWidth = shape.strokeWidth;
  ctx.stroke();

  // Draw fold triangle
  ctx.beginPath();
  ctx.moveTo(x + width - foldSize, y);
  ctx.lineTo(x + width - foldSize, y + foldSize);
  ctx.lineTo(x + width, y + foldSize);
  ctx.closePath();

  ctx.fillStyle = darkenColor(stickyColor, 0.08);
  ctx.fill();
  ctx.strokeStyle = darkenColor(stickyColor, 0.15);
  ctx.lineWidth = shape.strokeWidth;
  ctx.stroke();

  // Render text
  if (shape.text) {
    renderStickyNoteText(ctx, shape);
  }

  ctx.restore();
}

/**
 * Render text wrapped inside a sticky note
 */
function renderStickyNoteText(
  ctx: CanvasRenderingContext2D,
  shape: StickyNoteShape
): void {
  const { x, y, width, height, fontSize, text, strokeColor } = shape;
  const hAlign = (shape as any).textAlign || 'center';
  const vAlign = (shape as any).verticalAlign || 'middle';
  const padding = 10;
  const maxWidth = width - padding * 2;
  const lineHeight = fontSize * 1.3;

  ctx.fillStyle = strokeColor || '#333333';
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

  // Word wrap
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
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
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  // Vertical positioning
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

  // Draw lines (clip to shape bounds)
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + padding, y + padding, maxWidth, height - padding * 2);
  ctx.clip();

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], anchorX, startY + i * lineHeight);
  }
  ctx.restore();
}

/**
 * Darken a hex color by a given factor (0-1)
 */
function darkenColor(hex: string, factor: number): string {
  // Parse hex color
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Darken
  const dr = Math.round(r * (1 - factor));
  const dg = Math.round(g * (1 - factor));
  const db = Math.round(b * (1 - factor));

  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

/**
 * Get bounding box for a sticky note
 */
export function getStickyNoteBounds(shape: StickyNoteShape): BoundingBox {
  return {
    x: shape.x - 2,
    y: shape.y - 2,
    width: shape.width + 4,
    height: shape.height + 4,
  };
}

/**
 * Check if a point is inside a sticky note
 */
export function stickyNoteContainsPoint(
  shape: StickyNoteShape,
  px: number,
  py: number
): boolean {
  const bounds = getStickyNoteBounds(shape);
  return (
    px >= bounds.x &&
    px <= bounds.x + bounds.width &&
    py >= bounds.y &&
    py <= bounds.y + bounds.height
  );
}
