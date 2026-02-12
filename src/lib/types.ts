/**
 * Core type definitions for Napkin
 */

export type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'freedraw' | 'text' | 'triangle' | 'diamond' | 'hexagon' | 'star' | 'cloud' | 'cylinder' | 'sticky' | 'image';

/**
 * Preset colors for sticky notes
 */
export const STICKY_NOTE_COLORS = {
  yellow: '#fff9c4',
  pink: '#f8bbd0',
  green: '#c8e6c9',
  blue: '#bbdefb',
  purple: '#e1bee7',
  orange: '#ffe0b2',
} as const;

export type StickyNoteColor = keyof typeof STICKY_NOTE_COLORS;

export type ToolType = ShapeType | 'select' | 'pan';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted' | 'dashed-small' | 'dashed-large' | 'dash-dot' | 'dash-dot-dot';

export type FillStyle = 'hachure' | 'solid' | 'zigzag' | 'cross-hatch' | 'dots';

export type TextAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

export type RoutingMode = 'direct' | 'elbow' | 'curved';

export type LabelPosition = 'inside' | 'outside-top' | 'outside-bottom' | 'outside-left' | 'outside-right';

export type EndpointShapeType = 'none' | 'arrow' | 'triangle' | 'circle' | 'diamond' | 'square' | 'open-arrow';

export interface EndpointConfig {
  shape: EndpointShapeType;
  size: number; // Multiplier: 0.5 to 3, default 1
}

/**
 * Base properties for all shapes
 */
export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  strokeColor: string;
  strokeWidth: number;
  strokeStyle?: StrokeStyle;
  fillColor: string;
  fillStyle?: FillStyle;
  opacity: number;
  rotation?: number; // Rotation in degrees (0-360)
  locked?: boolean; // Prevents editing/moving/deleting
  groupId?: string; // ID of the group this shape belongs to
  aspectRatioLocked?: boolean; // When true, resize preserves aspect ratio
  roughness?: number; // 0 = perfect shapes, 1 = slight sketch, 2 = medium sketch, 3 = very sketchy
  text?: string; // Optional text label inside the shape
  textAlign?: TextAlign; // Horizontal text alignment within the shape (default: 'center')
  verticalAlign?: VerticalAlign; // Vertical text alignment within the shape (default: 'middle')
  labelPosition?: LabelPosition; // Where text renders relative to shape (default: 'inside')
}

/**
 * Rectangle shape
 */
export interface RectangleShape extends BaseShape {
  type: 'rectangle';
  width: number;
  height: number;
}

/**
 * Ellipse shape
 */
export interface EllipseShape extends BaseShape {
  type: 'ellipse';
  width: number;
  height: number;
}

/**
 * Triangle shape
 */
export interface TriangleShape extends BaseShape {
  type: 'triangle';
  width: number;
  height: number;
}

/**
 * Diamond shape
 */
export interface DiamondShape extends BaseShape {
  type: 'diamond';
  width: number;
  height: number;
}

/**
 * Hexagon shape
 */
export interface HexagonShape extends BaseShape {
  type: 'hexagon';
  width: number;
  height: number;
}

/**
 * Star shape (5-point)
 */
export interface StarShape extends BaseShape {
  type: 'star';
  width: number;
  height: number;
}

/**
 * Cloud shape
 */
export interface CloudShape extends BaseShape {
  type: 'cloud';
  width: number;
  height: number;
}

/**
 * Cylinder shape
 */
export interface CylinderShape extends BaseShape {
  type: 'cylinder';
  width: number;
  height: number;
}

/**
 * Sticky note shape
 */
export interface StickyNoteShape extends BaseShape {
  type: 'sticky';
  width: number;
  height: number;
  stickyColor: string; // The pastel background color
  fontSize: number;
  text: string;
}

/**
 * Connection point for arrow/line bindings
 */
export type ConnectionPoint = 'top' | 'right' | 'bottom' | 'left' | 'center';

/**
 * Binding information for arrow/line endpoints
 */
export interface Binding {
  shapeId: string;
  point: ConnectionPoint;
}

/**
 * Line shape
 */
export interface LineShape extends BaseShape {
  type: 'line';
  x2: number;
  y2: number;
  bindStart?: Binding;
  bindEnd?: Binding;
  routingMode?: RoutingMode;
  controlPoints?: { x: number; y: number }[];
  startEndpoint?: EndpointConfig;
  endEndpoint?: EndpointConfig;
}

/**
 * Arrow shape
 */
export interface ArrowShape extends BaseShape {
  type: 'arrow';
  x2: number;
  y2: number;
  arrowheadStart: boolean;
  arrowheadEnd: boolean;
  bindStart?: Binding;
  bindEnd?: Binding;
  routingMode?: RoutingMode;
  controlPoints?: { x: number; y: number }[];
  startEndpoint?: EndpointConfig;
  endEndpoint?: EndpointConfig;
}

/**
 * Freedraw shape (path)
 */
export interface FreedrawShape extends BaseShape {
  type: 'freedraw';
  points: Array<{ x: number; y: number }>;
}

/**
 * Text shape
 */
export interface TextShape extends BaseShape {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  width: number;
  height: number;
}

/**
 * Image shape
 */
export interface ImageShape extends BaseShape {
  type: 'image';
  width: number;
  height: number;
  src: string;
  loaded: boolean;
  imageElement?: HTMLImageElement;
}

/**
 * Union type of all shapes
 */
export type Shape =
  | RectangleShape
  | EllipseShape
  | TriangleShape
  | DiamondShape
  | HexagonShape
  | StarShape
  | CloudShape
  | CylinderShape
  | StickyNoteShape
  | LineShape
  | ArrowShape
  | FreedrawShape
  | TextShape
  | ImageShape;

/**
 * Bounding box for hit detection and culling
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Viewport state for pan/zoom
 */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Style preset for new shapes
 */
export interface StylePreset {
  strokeColor: string;
  strokeWidth: number;
  strokeStyle?: StrokeStyle;
  fillColor: string;
  fillStyle?: FillStyle;
  opacity: number;
  fontSize?: number;
  fontFamily?: string;
  roughness?: number; // 0 = perfect shapes, 1 = slight sketch, 2 = medium sketch, 3 = very sketchy
}

/**
 * Pointer event data
 */
export interface PointerEventData {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  button: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/**
 * Keyboard event data
 */
export interface KeyboardEventData {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}
