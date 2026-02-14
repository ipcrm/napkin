/**
 * Text shape implementation
 */

import type { TextShape, BoundingBox } from '../types';

/**
 * Render a text shape to canvas
 */
export function renderText(ctx: CanvasRenderingContext2D, shape: TextShape): void {
  if (!shape.text) return;

  ctx.save();

  // Apply opacity
  ctx.globalAlpha = shape.opacity;

  // Set font properties
  ctx.font = `${shape.fontSize}px ${shape.fontFamily}`;
  ctx.textBaseline = 'top';

  // Split text into lines
  const lines = shape.text.split('\n');

  // Draw text background if fill is set
  if (shape.fillColor && shape.fillColor !== 'transparent') {
    ctx.fillStyle = shape.fillColor;
    ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
  }

  // Draw text stroke (outline)
  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;

    for (let i = 0; i < lines.length; i++) {
      const y = shape.y + i * shape.fontSize * 1.2; // 1.2 is line height
      ctx.strokeText(lines[i], shape.x, y);
    }
  } else if (shape.strokeColor) {
    // Draw filled text if no stroke width
    ctx.fillStyle = shape.strokeColor;

    for (let i = 0; i < lines.length; i++) {
      const y = shape.y + i * shape.fontSize * 1.2; // 1.2 is line height
      ctx.fillText(lines[i], shape.x, y);
    }
  }

  ctx.restore();
}

/**
 * Get bounding box for a text shape
 */
export function getTextBounds(shape: TextShape): BoundingBox {
  return {
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
  };
}

/**
 * Check if a point is inside a text shape
 */
export function textContainsPoint(
  shape: TextShape,
  x: number,
  y: number
): boolean {
  return (
    x >= shape.x &&
    x <= shape.x + shape.width &&
    y >= shape.y &&
    y <= shape.y + shape.height
  );
}

/**
 * Measure text dimensions
 */
export function measureText(
  text: string,
  fontSize: number,
  fontFamily: string,
  ctx?: CanvasRenderingContext2D
): { width: number; height: number } {
  // Create temporary canvas if context not provided
  let tempCtx = ctx;
  let tempCanvas: HTMLCanvasElement | null = null;

  if (!tempCtx) {
    tempCanvas = document.createElement('canvas');
    tempCtx = tempCanvas.getContext('2d') ?? undefined;
  }

  if (!tempCtx) {
    // Fallback if canvas context not available
    const lines = text.split('\n');
    const maxLineLength = Math.max(...lines.map(line => line.length));
    return {
      width: maxLineLength * fontSize * 0.6,
      height: lines.length * fontSize * 1.2,
    };
  }

  tempCtx.font = `${fontSize}px ${fontFamily}`;

  const lines = text.split('\n');
  let maxWidth = 0;

  for (const line of lines) {
    const metrics = tempCtx.measureText(line);
    maxWidth = Math.max(maxWidth, metrics.width);
  }

  const height = lines.length * fontSize * 1.2;

  return { width: maxWidth, height };
}

/**
 * Create a new text shape
 */
export function createText(
  x: number,
  y: number,
  text: string,
  style: {
    strokeColor: string;
    strokeWidth: number;
    fillColor: string;
    opacity: number;
    fontSize?: number;
    fontFamily?: string;
  }
): TextShape {
  const fontSize = style.fontSize || 20;
  const fontFamily = style.fontFamily || 'Arial, sans-serif';

  // Measure text to get initial dimensions
  const { width, height } = measureText(text, fontSize, fontFamily);

  return {
    id: crypto.randomUUID(),
    type: 'text',
    x,
    y,
    text,
    fontSize,
    fontFamily,
    width: Math.max(width, 100), // Minimum width for empty text
    height: Math.max(height, fontSize * 1.2), // Minimum height for single line
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    fillColor: style.fillColor,
    opacity: style.opacity,
  };
}
