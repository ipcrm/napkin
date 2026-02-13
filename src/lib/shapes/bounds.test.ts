import { getShapeBounds, getCombinedBounds, boundsIntersect, boundsContainsPoint } from './bounds';
import type { Shape, BoundingBox } from '../types';

// Minimal shape fixtures matching the type system
function makeRect(overrides: Partial<Shape> = {}): Shape {
  return {
    id: 'rect_1',
    type: 'rectangle',
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    strokeColor: '#000',
    strokeWidth: 2,
    fillColor: 'transparent',
    fillStyle: 'solid',
    strokeStyle: 'solid',
    opacity: 1,
    rotation: 0,
    roughness: 1,
    text: '',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: 16,
    fontFamily: 'sans-serif',
    ...overrides,
  } as Shape;
}

function makeLine(overrides: Partial<Shape> = {}): Shape {
  return {
    id: 'line_1',
    type: 'line',
    x: 0,
    y: 0,
    x2: 100,
    y2: 50,
    strokeColor: '#000',
    strokeWidth: 2,
    fillColor: 'transparent',
    fillStyle: 'solid',
    strokeStyle: 'solid',
    opacity: 1,
    rotation: 0,
    roughness: 1,
    text: '',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: 16,
    fontFamily: 'sans-serif',
    routingMode: 'direct',
    controlPoints: [],
    startEndpoint: { shape: 'none', size: 8 },
    endEndpoint: { shape: 'none', size: 8 },
    ...overrides,
  } as Shape;
}

function makeFreedraw(overrides: Partial<Shape> = {}): Shape {
  return {
    id: 'fd_1',
    type: 'freedraw',
    x: 0,
    y: 0,
    strokeColor: '#000',
    strokeWidth: 2,
    fillColor: 'transparent',
    fillStyle: 'solid',
    strokeStyle: 'solid',
    opacity: 1,
    rotation: 0,
    roughness: 1,
    text: '',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: 16,
    fontFamily: 'sans-serif',
    points: [
      { x: 5, y: 10 },
      { x: 50, y: 80 },
      { x: 100, y: 30 },
    ],
    ...overrides,
  } as Shape;
}

describe('getShapeBounds', () => {
  it('returns correct bounds for a rectangle', () => {
    const shape = makeRect();
    const bounds = getShapeBounds(shape);
    // halfStroke = 1, so x-1, y-1, width+2, height+2
    expect(bounds).toEqual({ x: 9, y: 19, width: 102, height: 52 });
  });

  it('returns correct bounds for a line', () => {
    const shape = makeLine({ x: 20, y: 80, x2: 120, y2: 30 } as any);
    const bounds = getShapeBounds(shape);
    expect(bounds.x).toBe(19);  // min(20,120) - 1
    expect(bounds.y).toBe(29);  // min(80,30) - 1
    expect(bounds.width).toBe(102); // 100 + 2
    expect(bounds.height).toBe(52); // 50 + 2
  });

  it('returns correct bounds for a freedraw shape', () => {
    const shape = makeFreedraw();
    const bounds = getShapeBounds(shape);
    // points min/max: x=[5,100], y=[10,80]; halfStroke=1
    expect(bounds.x).toBe(4);
    expect(bounds.y).toBe(9);
    expect(bounds.width).toBe(97);  // 95 + 2
    expect(bounds.height).toBe(72); // 70 + 2
  });

  it('handles freedraw with no points', () => {
    const shape = makeFreedraw({ points: [] } as any);
    const bounds = getShapeBounds(shape);
    expect(bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe('getCombinedBounds', () => {
  it('returns null for empty array', () => {
    expect(getCombinedBounds([])).toBeNull();
  });

  it('returns single shape bounds for one shape', () => {
    const shape = makeRect();
    const combined = getCombinedBounds([shape]);
    const single = getShapeBounds(shape);
    expect(combined).toEqual(single);
  });

  it('combines multiple shapes', () => {
    const r1 = makeRect({ x: 0, y: 0, width: 50, height: 50, strokeWidth: 0 } as any);
    const r2 = makeRect({ id: 'rect_2', x: 100, y: 100, width: 50, height: 50, strokeWidth: 0 } as any);
    const combined = getCombinedBounds([r1, r2]);
    expect(combined).toEqual({ x: 0, y: 0, width: 150, height: 150 });
  });
});

describe('boundsIntersect', () => {
  const a: BoundingBox = { x: 0, y: 0, width: 10, height: 10 };

  it('detects overlapping bounds', () => {
    expect(boundsIntersect(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });

  it('detects non-overlapping bounds', () => {
    expect(boundsIntersect(a, { x: 20, y: 20, width: 10, height: 10 })).toBe(false);
  });

  it('detects touching edges as intersecting', () => {
    expect(boundsIntersect(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(true);
  });
});

describe('boundsContainsPoint', () => {
  const b: BoundingBox = { x: 10, y: 10, width: 100, height: 50 };

  it('returns true for point inside', () => {
    expect(boundsContainsPoint(b, 50, 30)).toBe(true);
  });

  it('returns true for point on edge', () => {
    expect(boundsContainsPoint(b, 10, 10)).toBe(true);
    expect(boundsContainsPoint(b, 110, 60)).toBe(true);
  });

  it('returns false for point outside', () => {
    expect(boundsContainsPoint(b, 5, 30)).toBe(false);
    expect(boundsContainsPoint(b, 50, 70)).toBe(false);
  });
});
