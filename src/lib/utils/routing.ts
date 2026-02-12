/**
 * Routing utilities for line/arrow shapes.
 * Provides path computation for direct, elbow, and curved routing modes.
 */

import type { RoutingMode } from '../types';

export interface Point {
  x: number;
  y: number;
}

/**
 * Compute the default control points for a given routing mode.
 * - direct: no control points needed
 * - elbow: one corner point forming a right-angle path
 * - curved: one control point at the midpoint (offset perpendicular to the line)
 */
export function getDefaultControlPoints(
  x1: number, y1: number,
  x2: number, y2: number,
  mode: RoutingMode
): Point[] {
  if (mode === 'direct') {
    return [];
  }

  if (mode === 'elbow') {
    // Default elbow: go horizontal from start, then vertical to end
    // The corner point is at (x2, y1) — horizontal first, then vertical
    return [{ x: x2, y: y1 }];
  }

  if (mode === 'curved') {
    // Default curved: control point at the midpoint
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    return [{ x: midX, y: midY }];
  }

  return [];
}

/**
 * Get the elbow path points (including start and end).
 * Returns an array of points forming a right-angle path.
 */
export function getElbowPathPoints(
  x1: number, y1: number,
  x2: number, y2: number,
  controlPoints?: Point[]
): Point[] {
  if (controlPoints && controlPoints.length > 0) {
    // Use the user-defined corner point
    const cp = controlPoints[0];
    return [
      { x: x1, y: y1 },
      { x: cp.x, y: y1 },  // horizontal to corner x
      { x: cp.x, y: y2 },  // vertical to end y
      { x: x2, y: y2 }
    ];
  }

  // Default: horizontal then vertical
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 }
  ];
}

/**
 * Get the angle of arrival at the endpoint for a routed path.
 * This is used to correctly orient arrowheads.
 */
export function getEndAngle(
  x1: number, y1: number,
  x2: number, y2: number,
  mode: RoutingMode,
  controlPoints?: Point[]
): number {
  if (mode === 'elbow') {
    const pts = getElbowPathPoints(x1, y1, x2, y2, controlPoints);
    const lastSeg = pts.length >= 2 ? pts[pts.length - 2] : { x: x1, y: y1 };
    return Math.atan2(y2 - lastSeg.y, x2 - lastSeg.x);
  }

  if (mode === 'curved' && controlPoints && controlPoints.length > 0) {
    // For a quadratic bezier, the tangent at t=1 is from the control point to the end
    const cp = controlPoints[0];
    return Math.atan2(y2 - cp.y, x2 - cp.x);
  }

  // Direct mode
  return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * Get the angle of departure at the start point for a routed path.
 * This is used to correctly orient arrowheads at the start.
 */
export function getStartAngle(
  x1: number, y1: number,
  x2: number, y2: number,
  mode: RoutingMode,
  controlPoints?: Point[]
): number {
  if (mode === 'elbow') {
    const pts = getElbowPathPoints(x1, y1, x2, y2, controlPoints);
    const nextPt = pts.length >= 2 ? pts[1] : { x: x2, y: y2 };
    return Math.atan2(nextPt.y - y1, nextPt.x - x1);
  }

  if (mode === 'curved' && controlPoints && controlPoints.length > 0) {
    // For a quadratic bezier, the tangent at t=0 is from start to control point
    const cp = controlPoints[0];
    return Math.atan2(cp.y - y1, cp.x - x1);
  }

  // Direct mode
  return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * Check if a point is near an elbow path (within threshold).
 */
export function elbowPathContainsPoint(
  x1: number, y1: number,
  x2: number, y2: number,
  px: number, py: number,
  threshold: number,
  controlPoints?: Point[]
): boolean {
  const pts = getElbowPathPoints(x1, y1, x2, y2, controlPoints);

  for (let i = 0; i < pts.length - 1; i++) {
    if (lineSegmentDistance(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, px, py) <= threshold) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a point is near a quadratic bezier curve (within threshold).
 * Uses recursive subdivision for accuracy.
 */
export function curvedPathContainsPoint(
  x1: number, y1: number,
  x2: number, y2: number,
  px: number, py: number,
  threshold: number,
  controlPoints?: Point[]
): boolean {
  if (!controlPoints || controlPoints.length === 0) {
    // Fall back to straight line check
    return lineSegmentDistance(x1, y1, x2, y2, px, py) <= threshold;
  }

  const cp = controlPoints[0];
  // Sample the bezier curve and check distance to each segment
  const steps = 20;
  let prevX = x1;
  let prevY = y1;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const curX = quadBezierAt(x1, cp.x, x2, t);
    const curY = quadBezierAt(y1, cp.y, y2, t);

    if (lineSegmentDistance(prevX, prevY, curX, curY, px, py) <= threshold) {
      return true;
    }

    prevX = curX;
    prevY = curY;
  }

  return false;
}

/**
 * Evaluate a quadratic bezier at parameter t.
 */
function quadBezierAt(p0: number, p1: number, p2: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

/**
 * Distance from a point to a line segment.
 */
function lineSegmentDistance(
  x1: number, y1: number,
  x2: number, y2: number,
  px: number, py: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
}

/**
 * Get bounding box for a routed path (elbow or curved).
 */
export function getRoutedBounds(
  x1: number, y1: number,
  x2: number, y2: number,
  mode: RoutingMode,
  controlPoints?: Point[],
  strokeWidth: number = 2
): { x: number; y: number; width: number; height: number } {
  const halfStroke = strokeWidth / 2;

  if (mode === 'elbow') {
    const pts = getElbowPathPoints(x1, y1, x2, y2, controlPoints);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return {
      x: minX - halfStroke,
      y: minY - halfStroke,
      width: maxX - minX + strokeWidth,
      height: maxY - minY + strokeWidth
    };
  }

  if (mode === 'curved' && controlPoints && controlPoints.length > 0) {
    const cp = controlPoints[0];
    // For a quadratic bezier, the bounding box includes the control point
    const minX = Math.min(x1, x2, cp.x);
    const minY = Math.min(y1, y2, cp.y);
    const maxX = Math.max(x1, x2, cp.x);
    const maxY = Math.max(y1, y2, cp.y);
    return {
      x: minX - halfStroke,
      y: minY - halfStroke,
      width: maxX - minX + strokeWidth,
      height: maxY - minY + strokeWidth
    };
  }

  // Direct
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const maxX = Math.max(x1, x2);
  const maxY = Math.max(y1, y2);
  return {
    x: minX - halfStroke,
    y: minY - halfStroke,
    width: maxX - minX + strokeWidth,
    height: maxY - minY + strokeWidth
  };
}
