/**
 * Stroke style utilities for rendering different line patterns
 */

import type { StrokeStyle } from '../types';

/**
 * Apply stroke style to canvas context
 */
export function applyStrokeStyle(
  ctx: CanvasRenderingContext2D,
  style: StrokeStyle = 'solid'
): void {
  switch (style) {
    case 'solid':
      ctx.setLineDash([]);
      break;
    case 'dashed':
      ctx.setLineDash([10, 5]);
      break;
    case 'dotted':
      ctx.setLineDash([2, 3]);
      break;
    case 'dashed-small':
      ctx.setLineDash([5, 3]);
      break;
    case 'dashed-large':
      ctx.setLineDash([20, 10]);
      break;
    case 'dash-dot':
      ctx.setLineDash([10, 5, 2, 5]);
      break;
    case 'dash-dot-dot':
      ctx.setLineDash([10, 5, 2, 5, 2, 5]);
      break;
    default:
      ctx.setLineDash([]);
  }
}

/**
 * Stroke width presets
 */
export const STROKE_WIDTH_PRESETS = {
  thin: 1,
  regular: 2,
  medium: 4,
  thick: 8,
  veryThick: 16,
} as const;

export type StrokeWidthPreset = keyof typeof STROKE_WIDTH_PRESETS;
