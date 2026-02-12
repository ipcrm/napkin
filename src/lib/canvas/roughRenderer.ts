/**
 * Rough.js renderer wrapper for hand-drawn aesthetic
 */
import rough from 'roughjs';
import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { RoutingMode, EndpointConfig } from '../types';
import { getElbowPathPoints, getEndAngle, getStartAngle } from '../utils/routing';
import { drawEndpointShape, getEffectiveEndpoint } from './endpointRenderer';

// Singleton instance of RoughCanvas
let roughCanvas: RoughCanvas | null = null;

/**
 * Initialize or get the Rough.js canvas wrapper
 */
export function getRoughCanvas(canvas: HTMLCanvasElement): RoughCanvas {
  if (!roughCanvas) {
    roughCanvas = rough.canvas(canvas);
  }
  return roughCanvas;
}

/**
 * Reset the rough canvas instance (useful when canvas changes)
 */
export function resetRoughCanvas(): void {
  roughCanvas = null;
}

/**
 * Draw a rough rectangle
 */
export function drawRoughRectangle(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    fillColor: string;
    roughness: number;
  }
) {
  const rc = getRoughCanvas(canvas);

  // Convert stroke style to rough.js stroke pattern
  const strokeLineDash = getStrokeLineDash(options.strokeStyle);

  rc.rectangle(x, y, width, height, {
    stroke: options.strokeColor,
    strokeWidth: options.strokeWidth,
    fill: options.fillColor === 'transparent' ? undefined : options.fillColor,
    fillStyle: 'hachure',
    roughness: options.roughness,
    strokeLineDash,
    seed: 1, // Use consistent seed for stable rendering
  });
}

/**
 * Draw a rough ellipse
 */
export function drawRoughEllipse(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    fillColor: string;
    roughness: number;
  }
) {
  const rc = getRoughCanvas(canvas);

  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = Math.abs(width) / 2;
  const ry = Math.abs(height) / 2;

  const strokeLineDash = getStrokeLineDash(options.strokeStyle);

  rc.ellipse(cx, cy, rx * 2, ry * 2, {
    stroke: options.strokeColor,
    strokeWidth: options.strokeWidth,
    fill: options.fillColor === 'transparent' ? undefined : options.fillColor,
    fillStyle: 'hachure',
    roughness: options.roughness,
    strokeLineDash,
    seed: 1,
  });
}

/**
 * Text gap specification for splitting lines where text labels appear
 */
export interface TextGap {
  /** X coordinate where the gap starts (line should stop drawing) */
  gapStartX: number;
  /** Y coordinate where the gap starts */
  gapStartY: number;
  /** X coordinate where the gap ends (line should resume drawing) */
  gapEndX: number;
  /** Y coordinate where the gap ends */
  gapEndY: number;
}

/**
 * Draw a rough line, optionally split around a text gap.
 * Supports direct, elbow, and curved routing modes.
 */
export function drawRoughLine(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    roughness: number;
    routingMode?: RoutingMode;
    controlPoints?: { x: number; y: number }[];
    startEndpoint?: EndpointConfig;
    endEndpoint?: EndpointConfig;
  },
  textGap?: TextGap
) {
  const rc = getRoughCanvas(canvas);
  const strokeLineDash = getStrokeLineDash(options.strokeStyle);
  const mode = options.routingMode || 'direct';

  if (mode === 'elbow') {
    const pts = getElbowPathPoints(x1, y1, x2, y2, options.controlPoints);
    const points: [number, number][] = pts.map(p => [p.x, p.y]);
    rc.linearPath(points, {
      stroke: options.strokeColor,
      strokeWidth: options.strokeWidth,
      roughness: options.roughness,
      strokeLineDash,
      seed: 1,
    });
    return;
  }

  if (mode === 'curved') {
    const cp = options.controlPoints && options.controlPoints.length > 0
      ? options.controlPoints[0]
      : { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    // Use rough.js curve which takes an array of [x,y] points
    // We create a quadratic-like curve by providing start, control, end
    rc.curve(
      [[x1, y1], [cp.x, cp.y], [x2, y2]],
      {
        stroke: options.strokeColor,
        strokeWidth: options.strokeWidth,
        roughness: options.roughness,
        strokeLineDash,
        seed: 1,
      }
    );
    return;
  }

  // Direct mode
  if (textGap) {
    // Draw two segments: start-to-gapStart and gapEnd-to-end
    rc.line(x1, y1, textGap.gapStartX, textGap.gapStartY, {
      stroke: options.strokeColor,
      strokeWidth: options.strokeWidth,
      roughness: options.roughness,
      strokeLineDash,
      seed: 1,
    });
    rc.line(textGap.gapEndX, textGap.gapEndY, x2, y2, {
      stroke: options.strokeColor,
      strokeWidth: options.strokeWidth,
      roughness: options.roughness,
      strokeLineDash,
      seed: 2,
    });
  } else {
    rc.line(x1, y1, x2, y2, {
      stroke: options.strokeColor,
      strokeWidth: options.strokeWidth,
      roughness: options.roughness,
      strokeLineDash,
      seed: 1,
    });
  }

  // Draw endpoint shapes for lines
  const lineEndAngle = getEndAngle(x1, y1, x2, y2, mode, options.controlPoints);
  const lineStartAngle = getStartAngle(x1, y1, x2, y2, mode, options.controlPoints);

  const lineEndEp = getEffectiveEndpoint(options.endEndpoint, false, true);
  const lineStartEp = getEffectiveEndpoint(options.startEndpoint, false, false);

  if (lineEndEp.shape !== 'none') {
    drawEndpointShape(ctx, x2, y2, lineEndAngle, lineEndEp.shape, lineEndEp.size, options.strokeWidth, options.strokeColor, options.strokeColor);
  }

  if (lineStartEp.shape !== 'none') {
    drawEndpointShape(ctx, x1, y1, lineStartAngle + Math.PI, lineStartEp.shape, lineStartEp.size, options.strokeWidth, options.strokeColor, options.strokeColor);
  }
}

/**
 * Draw a rough arrow (line + arrowheads), optionally split around a text gap.
 * Supports direct, elbow, and curved routing modes.
 */
export function drawRoughArrow(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    roughness: number;
    arrowheadStart?: boolean;
    arrowheadEnd?: boolean;
    routingMode?: RoutingMode;
    controlPoints?: { x: number; y: number }[];
    startEndpoint?: EndpointConfig;
    endEndpoint?: EndpointConfig;
  },
  textGap?: TextGap
) {
  const mode = options.routingMode || 'direct';

  // Draw the line (with routing mode support)
  drawRoughLine(ctx, canvas, x1, y1, x2, y2, {
    strokeColor: options.strokeColor,
    strokeWidth: options.strokeWidth,
    strokeStyle: options.strokeStyle,
    roughness: options.roughness,
    routingMode: options.routingMode,
    controlPoints: options.controlPoints,
  }, mode === 'direct' ? textGap : undefined);

  // Draw endpoint shapes using routing-aware angles
  const endAngle = getEndAngle(x1, y1, x2, y2, mode, options.controlPoints);
  const startAngle = getStartAngle(x1, y1, x2, y2, mode, options.controlPoints);

  const endEp = getEffectiveEndpoint(options.endEndpoint, options.arrowheadEnd, true);
  const startEp = getEffectiveEndpoint(options.startEndpoint, options.arrowheadStart, false);

  if (endEp.shape !== 'none') {
    drawEndpointShape(ctx, x2, y2, endAngle, endEp.shape, endEp.size, options.strokeWidth, options.strokeColor, options.strokeColor);
  }

  if (startEp.shape !== 'none') {
    drawEndpointShape(ctx, x1, y1, startAngle + Math.PI, startEp.shape, startEp.size, options.strokeWidth, options.strokeColor, options.strokeColor);
  }
}

/**
 * Draw a rough freedraw path
 */
export function drawRoughPath(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  points: Array<{ x: number; y: number }>,
  options: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    roughness: number;
  }
) {
  if (points.length < 2) return;

  const rc = getRoughCanvas(canvas);

  // Convert points to SVG path string
  const pathData = pointsToSvgPath(points);

  const strokeLineDash = getStrokeLineDash(options.strokeStyle);

  rc.path(pathData, {
    stroke: options.strokeColor,
    strokeWidth: options.strokeWidth,
    roughness: options.roughness,
    strokeLineDash,
    seed: 1,
  });
}

/**
 * Draw a rough triangle
 */
export function drawRoughTriangle(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    fillColor: string;
    roughness: number;
  }
) {
  const rc = getRoughCanvas(canvas);

  const x1 = x + width / 2;
  const y1 = y;
  const x2 = x;
  const y2 = y + height;
  const x3 = x + width;
  const y3 = y + height;

  const strokeLineDash = getStrokeLineDash(options.strokeStyle);

  rc.polygon(
    [
      [x1, y1],
      [x2, y2],
      [x3, y3],
    ],
    {
      stroke: options.strokeColor,
      strokeWidth: options.strokeWidth,
      fill: options.fillColor === 'transparent' ? undefined : options.fillColor,
      fillStyle: 'hachure',
      roughness: options.roughness,
      strokeLineDash,
      seed: 1,
    }
  );
}

/**
 * Draw a rough diamond
 */
export function drawRoughDiamond(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    fillColor: string;
    roughness: number;
  }
) {
  const rc = getRoughCanvas(canvas);

  const cx = x + width / 2;
  const cy = y + height / 2;

  const strokeLineDash = getStrokeLineDash(options.strokeStyle);

  rc.polygon(
    [
      [cx, y],
      [x + width, cy],
      [cx, y + height],
      [x, cy],
    ],
    {
      stroke: options.strokeColor,
      strokeWidth: options.strokeWidth,
      fill: options.fillColor === 'transparent' ? undefined : options.fillColor,
      fillStyle: 'hachure',
      roughness: options.roughness,
      strokeLineDash,
      seed: 1,
    }
  );
}

/**
 * Draw a rough hexagon
 */
export function drawRoughHexagon(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    fillColor: string;
    roughness: number;
  }
) {
  const rc = getRoughCanvas(canvas);

  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width / 2;
  const ry = height / 2;

  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
  }

  const strokeLineDash = getStrokeLineDash(options.strokeStyle);

  rc.polygon(points, {
    stroke: options.strokeColor,
    strokeWidth: options.strokeWidth,
    fill: options.fillColor === 'transparent' ? undefined : options.fillColor,
    fillStyle: 'hachure',
    roughness: options.roughness,
    strokeLineDash,
    seed: 1,
  });
}

/**
 * Draw a rough star
 */
export function drawRoughStar(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    fillColor: string;
    roughness: number;
  }
) {
  const rc = getRoughCanvas(canvas);

  const cx = x + width / 2;
  const cy = y + height / 2;
  const outerRadius = Math.min(width, height) / 2;
  const innerRadius = outerRadius * 0.4;
  const points = 5;

  const starPoints: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    starPoints.push([
      cx + radius * Math.cos(angle) * (width / height),
      cy + radius * Math.sin(angle),
    ]);
  }

  const strokeLineDash = getStrokeLineDash(options.strokeStyle);

  rc.polygon(starPoints, {
    stroke: options.strokeColor,
    strokeWidth: options.strokeWidth,
    fill: options.fillColor === 'transparent' ? undefined : options.fillColor,
    fillStyle: 'hachure',
    roughness: options.roughness,
    strokeLineDash,
    seed: 1,
  });
}

/**
 * Convert stroke style to rough.js line dash pattern
 */
function getStrokeLineDash(strokeStyle?: string): number[] | undefined {
  switch (strokeStyle) {
    case 'dashed':
      return [10, 5];
    case 'dotted':
      return [2, 3];
    case 'dashed-small':
      return [5, 3];
    case 'dashed-large':
      return [20, 10];
    case 'dash-dot':
      return [10, 5, 2, 5];
    case 'dash-dot-dot':
      return [10, 5, 2, 5, 2, 5];
    case 'solid':
    default:
      return undefined;
  }
}

/**
 * Draw a rough cloud
 */
export function drawRoughCloud(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: string;
    fillColor: string;
    roughness: number;
  }
) {
  const rc = getRoughCanvas(canvas);
  const strokeLineDash = getStrokeLineDash(options.strokeStyle);

  // Draw cloud as a series of overlapping circles
  const circles = [
    { x: x + width * 0.25, y: y + height * 0.5, r: height * 0.35 },
    { x: x + width * 0.5, y: y + height * 0.35, r: height * 0.4 },
    { x: x + width * 0.75, y: y + height * 0.5, r: height * 0.35 },
    { x: x + width * 0.5, y: y + height * 0.65, r: height * 0.3 },
  ];

  circles.forEach((circle, i) => {
    rc.circle(circle.x, circle.y, circle.r * 2, {
      stroke: options.strokeColor,
      strokeWidth: options.strokeWidth,
      fill: i === 0 && options.fillColor !== 'transparent' ? options.fillColor : undefined,
      fillStyle: 'hachure',
      roughness: options.roughness,
      strokeLineDash,
      seed: 1,
    });
  });
}

/**
 * Draw a rough cylinder
 */
export function drawRoughCylinder(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle?: string;
    fillColor: string;
    roughness: number;
  }
) {
  const rc = getRoughCanvas(canvas);
  const strokeLineDash = getStrokeLineDash(options.strokeStyle);
  const ellipseHeight = height * 0.15;

  // Top ellipse
  rc.ellipse(x + width / 2, y + ellipseHeight / 2, width, ellipseHeight, {
    stroke: options.strokeColor,
    strokeWidth: options.strokeWidth,
    fill: options.fillColor === 'transparent' ? undefined : options.fillColor,
    fillStyle: 'hachure',
    roughness: options.roughness,
    strokeLineDash,
    seed: 1,
  });

  // Left side line
  rc.line(x, y + ellipseHeight / 2, x, y + height - ellipseHeight / 2, {
    stroke: options.strokeColor,
    strokeWidth: options.strokeWidth,
    roughness: options.roughness,
    strokeLineDash,
    seed: 1,
  });

  // Right side line
  rc.line(x + width, y + ellipseHeight / 2, x + width, y + height - ellipseHeight / 2, {
    stroke: options.strokeColor,
    strokeWidth: options.strokeWidth,
    roughness: options.roughness,
    strokeLineDash,
    seed: 1,
  });

  // Bottom ellipse
  rc.ellipse(x + width / 2, y + height - ellipseHeight / 2, width, ellipseHeight, {
    stroke: options.strokeColor,
    strokeWidth: options.strokeWidth,
    fill: options.fillColor === 'transparent' ? undefined : options.fillColor,
    fillStyle: 'hachure',
    roughness: options.roughness,
    strokeLineDash,
    seed: 1,
  });
}

/**
 * Convert points array to SVG path string
 */
function pointsToSvgPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  return path;
}
