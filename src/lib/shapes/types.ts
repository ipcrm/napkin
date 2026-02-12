/**
 * Core type definitions and interfaces for Napkin shapes
 */

// Basic geometric types
export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// Style properties for shapes
export interface StyleProperties {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity?: number;
  roughness?: number; // For future sketch-style rendering
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
}

// Shape types enumeration
export enum ShapeType {
  Rectangle = 'rectangle',
  Ellipse = 'ellipse',
  Line = 'line',
  Arrow = 'arrow',
  Freedraw = 'freedraw',
  Text = 'text'
}

// Base shape interface
export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  style: StyleProperties;

  /**
   * Render the shape on the given canvas context
   */
  render(ctx: CanvasRenderingContext2D, viewport: Viewport): void;

  /**
   * Get the bounding box for this shape
   */
  getBounds(): BoundingBox;

  /**
   * Check if a point is contained within this shape
   * @param point - Point in canvas coordinates
   * @param tolerance - Hit detection tolerance in pixels
   */
  containsPoint(point: Point, tolerance?: number): boolean;

  /**
   * Create a deep copy of this shape
   */
  clone(): Shape;

  /**
   * Serialize the shape to JSON
   */
  toJSON(): SerializedShape;
}

// Serialized shape format for storage/export
export interface SerializedShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  style: StyleProperties;
  data: Record<string, unknown>; // Shape-specific data
}

// Rectangle shape
export interface RectangleShape extends Shape {
  type: ShapeType.Rectangle;
  width: number;
  height: number;
}

export interface RectangleData {
  width: number;
  height: number;
}

// Ellipse shape
export interface EllipseShape extends Shape {
  type: ShapeType.Ellipse;
  radiusX: number;
  radiusY: number;
}

export interface EllipseData {
  radiusX: number;
  radiusY: number;
}

// Line shape
export interface LineShape extends Shape {
  type: ShapeType.Line;
  endX: number;
  endY: number;
}

export interface LineData {
  endX: number;
  endY: number;
}

// Arrow shape
export interface ArrowShape extends Shape {
  type: ShapeType.Arrow;
  endX: number;
  endY: number;
  arrowheadSize: number;
}

export interface ArrowData {
  endX: number;
  endY: number;
  arrowheadSize: number;
}

// Freedraw shape
export interface FreedrawShape extends Shape {
  type: ShapeType.Freedraw;
  points: Point[];
  simplified?: boolean;
}

export interface FreedrawData {
  points: Point[];
  simplified?: boolean;
}

// Text shape
export interface TextShape extends Shape {
  type: ShapeType.Text;
  text: string;
  fontSize: number;
  fontFamily: string;
  width?: number;
  height?: number;
}

export interface TextData {
  text: string;
  fontSize: number;
  fontFamily: string;
  width?: number;
  height?: number;
}

// Union type of all shape types
export type AnyShape =
  | RectangleShape
  | EllipseShape
  | LineShape
  | ArrowShape
  | FreedrawShape
  | TextShape;

// Default style properties
export const DEFAULT_STYLE: StyleProperties = {
  strokeColor: '#000000',
  fillColor: 'transparent',
  strokeWidth: 2,
  opacity: 1,
  strokeStyle: 'solid'
};

// Helper function to create a unique ID
export function createShapeId(): string {
  return `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to apply viewport transform to a point
export function transformPoint(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.x) * viewport.zoom,
    y: (point.y - viewport.y) * viewport.zoom
  };
}

// Helper function to apply inverse viewport transform (screen to canvas)
export function inverseTransformPoint(point: Point, viewport: Viewport): Point {
  return {
    x: point.x / viewport.zoom + viewport.x,
    y: point.y / viewport.zoom + viewport.y
  };
}

// Helper function to check if bounding boxes intersect
export function boundingBoxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

// Helper function to expand bounding box by margin
export function expandBoundingBox(box: BoundingBox, margin: number): BoundingBox {
  return {
    x: box.x - margin,
    y: box.y - margin,
    width: box.width + margin * 2,
    height: box.height + margin * 2
  };
}
