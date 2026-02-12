/**
 * Shape rendering utility
 * Delegates to specific shape renderers based on type
 */

import type { Shape } from '../types';
import { renderRectangle } from '../shapes/rectangle';
import { renderEllipse } from '../shapes/ellipse';
import { renderTriangle } from '../shapes/triangle';
import { renderDiamond } from '../shapes/diamond';
import { renderHexagon } from '../shapes/hexagon';
import { renderStar } from '../shapes/star';
import { renderCloud } from '../shapes/cloud';
import { renderCylinder } from '../shapes/cylinder';
import { renderLine } from '../shapes/line';
import { renderArrow } from '../shapes/arrow';
import { renderFreedraw } from '../shapes/freedraw';
import { renderText } from '../shapes/text';
import { renderStickyNote } from '../shapes/stickyNote';

/**
 * Render a shape to the canvas
 */
export function renderShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
  switch (shape.type) {
    case 'rectangle':
      renderRectangle(ctx, shape);
      break;
    case 'ellipse':
      renderEllipse(ctx, shape);
      break;
    case 'triangle':
      renderTriangle(ctx, shape);
      break;
    case 'diamond':
      renderDiamond(ctx, shape);
      break;
    case 'hexagon':
      renderHexagon(ctx, shape);
      break;
    case 'star':
      renderStar(ctx, shape);
      break;
    case 'cloud':
      renderCloud(ctx, shape);
      break;
    case 'cylinder':
      renderCylinder(ctx, shape);
      break;
    case 'sticky':
      renderStickyNote(ctx, shape);
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
  }
}

/**
 * Render multiple shapes to the canvas
 */
export function renderShapes(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[]
): void {
  for (const shape of shapes) {
    renderShape(ctx, shape);
  }
}
