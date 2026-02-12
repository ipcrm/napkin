/**
 * Hit detection functions to determine which shape is clicked
 */

import type { Shape } from '../types';
import { rectangleContainsPoint } from '../shapes/rectangle';
import { ellipseContainsPoint } from '../shapes/ellipse';
import { triangleContainsPoint } from '../shapes/triangle';
import { diamondContainsPoint } from '../shapes/diamond';
import { hexagonContainsPoint } from '../shapes/hexagon';
import { starContainsPoint } from '../shapes/star';
import { cloudContainsPoint } from '../shapes/cloud';
import { cylinderContainsPoint } from '../shapes/cylinder';
import { lineContainsPoint } from '../shapes/line';
import { arrowContainsPoint } from '../shapes/arrow';
import { freedrawContainsPoint } from '../shapes/freedraw';
import { textContainsPoint } from '../shapes/text';
import { stickyNoteContainsPoint } from '../shapes/stickyNote';
import { imageContainsPoint } from '../shapes/image';

/**
 * Check if a point hits a shape
 */
export function shapeContainsPoint(shape: Shape, x: number, y: number): boolean {
  switch (shape.type) {
    case 'rectangle':
      return rectangleContainsPoint(shape, x, y);
    case 'ellipse':
      return ellipseContainsPoint(shape, x, y);
    case 'triangle':
      return triangleContainsPoint(shape, x, y);
    case 'diamond':
      return diamondContainsPoint(shape, x, y);
    case 'hexagon':
      return hexagonContainsPoint(shape, x, y);
    case 'star':
      return starContainsPoint(shape, x, y);
    case 'cloud':
      return cloudContainsPoint(shape, x, y);
    case 'cylinder':
      return cylinderContainsPoint(shape, x, y);
    case 'sticky':
      return stickyNoteContainsPoint(shape, x, y);
    case 'line':
      return lineContainsPoint(shape, x, y);
    case 'arrow':
      return arrowContainsPoint(shape, x, y);
    case 'freedraw':
      return freedrawContainsPoint(shape, x, y);
    case 'text':
      return textContainsPoint(shape, x, y);
    case 'image':
      return imageContainsPoint(shape as any, x, y);
    default:
      return false;
  }
}

/**
 * Check if a shape is a line-like shape (line or arrow)
 */
function isLineShape(shape: Shape): boolean {
  return shape.type === 'line' || shape.type === 'arrow';
}

/**
 * Find the topmost shape at a given point.
 * Lines and arrows are checked first with a generous hit area,
 * so they can be selected even when overlapping with filled shapes
 * they are connected to.
 */
export function findShapeAtPoint(
  shapes: Shape[],
  x: number,
  y: number
): Shape | null {
  // First pass: check lines/arrows with a more generous threshold.
  // This ensures lines/arrows can always be selected even when they
  // overlap with the filled shapes they are connected to.
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (isLineShape(shape)) {
      // Use a wider hit area (10px) for priority line/arrow detection
      const hit = shape.type === 'line'
        ? lineContainsPoint(shape, x, y, 10)
        : arrowContainsPoint(shape, x, y, 10);
      if (hit) {
        return shape;
      }
    }
  }

  // Second pass: check all other shapes with normal hit detection
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (!isLineShape(shape) && shapeContainsPoint(shape, x, y)) {
      return shape;
    }
  }

  return null;
}

/**
 * Find all shapes at a given point
 */
export function findShapesAtPoint(shapes: Shape[], x: number, y: number): Shape[] {
  return shapes.filter((shape) => shapeContainsPoint(shape, x, y));
}

/**
 * Find shapes within a rectangular selection box
 */
export function findShapesInBox(
  shapes: Shape[],
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number
): Shape[] {
  const result: Shape[] = [];

  for (const shape of shapes) {
    // Get shape bounds
    let bounds;
    switch (shape.type) {
      case 'rectangle':
        bounds = {
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
        };
        break;
      case 'ellipse':
      case 'triangle':
      case 'diamond':
      case 'hexagon':
      case 'star':
      case 'cloud':
      case 'cylinder':
      case 'sticky':
      case 'image':
        bounds = {
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
        };
        break;
      case 'line':
        bounds = {
          x: Math.min(shape.x, shape.x2),
          y: Math.min(shape.y, shape.y2),
          width: Math.abs(shape.x2 - shape.x),
          height: Math.abs(shape.y2 - shape.y),
        };
        break;
      case 'arrow':
        bounds = {
          x: Math.min(shape.x, shape.x2),
          y: Math.min(shape.y, shape.y2),
          width: Math.abs(shape.x2 - shape.x),
          height: Math.abs(shape.y2 - shape.y),
        };
        break;
      case 'freedraw':
        if (shape.points && shape.points.length > 0) {
          const xs = shape.points.map(p => p.x);
          const ys = shape.points.map(p => p.y);
          bounds = {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys),
          };
        } else {
          continue;
        }
        break;
      case 'text':
        bounds = {
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
        };
        break;
      default:
        continue;
    }

    // Check if bounds intersect with selection box
    if (
      bounds.x < boxX + boxWidth &&
      bounds.x + bounds.width > boxX &&
      bounds.y < boxY + boxHeight &&
      bounds.y + bounds.height > boxY
    ) {
      result.push(shape);
    }
  }

  return result;
}
