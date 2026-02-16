/**
 * Layout algorithms for reorganizing shapes on the canvas
 */

import type { Shape } from '../types';
import { getShapeBounds } from '../shapes/bounds';

interface LayoutChange {
  id: string;
  changes: Partial<Shape>;
}

/**
 * Arrange shapes in a grid layout.
 * Preserves relative position ordering (top-left to bottom-right).
 */
export function gridLayout(
  shapes: Shape[],
  options: { padding?: number; gridSize?: number; startX?: number; startY?: number } = {}
): LayoutChange[] {
  const { padding = 40, gridSize = 20, startX = 100, startY = 100 } = options;

  // Filter out lines/arrows — only position node shapes
  const nodeShapes = shapes.filter(s => s.type !== 'line' && s.type !== 'arrow');
  if (nodeShapes.length === 0) return [];

  // Sort by current position (top-to-bottom, left-to-right) to preserve relative order
  const sorted = [...nodeShapes].sort((a, b) => {
    const boundsA = getShapeBounds(a);
    const boundsB = getShapeBounds(b);
    const rowA = Math.round(boundsA.y / 100);
    const rowB = Math.round(boundsB.y / 100);
    if (rowA !== rowB) return rowA - rowB;
    return boundsA.x - boundsB.x;
  });

  // Find max dimensions for cell size
  let maxW = 0;
  let maxH = 0;
  for (const shape of sorted) {
    const bounds = getShapeBounds(shape);
    maxW = Math.max(maxW, bounds.width);
    maxH = Math.max(maxH, bounds.height);
  }

  // Snap cell size to grid
  const cellW = Math.ceil((maxW + padding) / gridSize) * gridSize;
  const cellH = Math.ceil((maxH + padding) / gridSize) * gridSize;

  // Calculate grid columns (roughly square)
  const cols = Math.max(1, Math.ceil(Math.sqrt(sorted.length)));

  const changes: LayoutChange[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const bounds = getShapeBounds(sorted[i]);

    // Center shape within cell
    const targetX = startX + col * cellW + (cellW - padding - bounds.width) / 2;
    const targetY = startY + row * cellH + (cellH - padding - bounds.height) / 2;

    // Snap to grid
    const snappedX = Math.round(targetX / gridSize) * gridSize;
    const snappedY = Math.round(targetY / gridSize) * gridSize;

    if (sorted[i].type === 'freedraw') {
      // For freedraw, offset all points by the delta
      const dx = snappedX - bounds.x;
      const dy = snappedY - bounds.y;
      const shape = sorted[i] as any;
      const newPoints = (shape.points || []).map((p: { x: number; y: number }) => ({
        x: p.x + dx,
        y: p.y + dy,
      }));
      changes.push({
        id: sorted[i].id,
        changes: { x: snappedX, y: snappedY, points: newPoints } as Partial<Shape>,
      });
    } else {
      changes.push({
        id: sorted[i].id,
        changes: { x: snappedX, y: snappedY },
      });
    }
  }

  return changes;
}

/**
 * Simple force-directed layout.
 * Repulsion between all nodes, attraction along connections.
 */
export function forceDirectedLayout(
  shapes: Shape[],
  connections: Array<{ fromId: string; toId: string }>,
  options: { iterations?: number; startX?: number; startY?: number } = {}
): LayoutChange[] {
  const { iterations = 100, startX = 200, startY = 200 } = options;

  // Filter out lines/arrows
  const nodeShapes = shapes.filter(s => s.type !== 'line' && s.type !== 'arrow');
  if (nodeShapes.length === 0) return [];

  // Initialize positions from current shape centers
  const positions = new Map<string, { x: number; y: number }>();
  for (const shape of nodeShapes) {
    const bounds = getShapeBounds(shape);
    positions.set(shape.id, {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    });
  }

  const repulsionStrength = 5000;
  const attractionStrength = 0.01;
  const damping = 0.9;
  let temperature = 50;

  // Velocity
  const velocities = new Map<string, { x: number; y: number }>();
  for (const shape of nodeShapes) {
    velocities.set(shape.id, { x: 0, y: 0 });
  }

  const nodeIds = nodeShapes.map(s => s.id);

  for (let iter = 0; iter < iterations; iter++) {
    // Reset forces
    const forces = new Map<string, { x: number; y: number }>();
    for (const id of nodeIds) {
      forces.set(id, { x: 0, y: 0 });
    }

    // Repulsion between all pairs
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const posA = positions.get(nodeIds[i])!;
        const posB = positions.get(nodeIds[j])!;
        let dx = posA.x - posB.x;
        let dy = posA.y - posB.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) { dist = 1; dx = 1; dy = 0; }

        const force = repulsionStrength / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        forces.get(nodeIds[i])!.x += fx;
        forces.get(nodeIds[i])!.y += fy;
        forces.get(nodeIds[j])!.x -= fx;
        forces.get(nodeIds[j])!.y -= fy;
      }
    }

    // Attraction along connections
    for (const conn of connections) {
      const posA = positions.get(conn.fromId);
      const posB = positions.get(conn.toId);
      if (!posA || !posB) continue;

      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      const force = dist * attractionStrength;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      const fA = forces.get(conn.fromId);
      const fB = forces.get(conn.toId);
      if (fA) { fA.x += fx; fA.y += fy; }
      if (fB) { fB.x -= fx; fB.y -= fy; }
    }

    // Apply forces with velocity and damping
    for (const id of nodeIds) {
      const vel = velocities.get(id)!;
      const force = forces.get(id)!;
      vel.x = (vel.x + force.x) * damping;
      vel.y = (vel.y + force.y) * damping;

      // Clamp velocity to temperature
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (speed > temperature) {
        vel.x = (vel.x / speed) * temperature;
        vel.y = (vel.y / speed) * temperature;
      }

      const pos = positions.get(id)!;
      pos.x += vel.x;
      pos.y += vel.y;
    }

    // Cool down
    temperature *= 0.95;
  }

  // Convert positions back to shape changes (snap to grid)
  const gridSize = 20;
  const changes: LayoutChange[] = [];

  // Find min position to ensure shapes stay in positive space
  let minX = Infinity;
  let minY = Infinity;
  for (const [id, pos] of positions) {
    const shape = nodeShapes.find(s => s.id === id);
    if (!shape) continue;
    const bounds = getShapeBounds(shape);
    minX = Math.min(minX, pos.x - bounds.width / 2);
    minY = Math.min(minY, pos.y - bounds.height / 2);
  }

  const offsetX = minX < startX ? startX - minX : 0;
  const offsetY = minY < startY ? startY - minY : 0;

  for (const shape of nodeShapes) {
    const pos = positions.get(shape.id);
    if (!pos) continue;
    const bounds = getShapeBounds(shape);

    const rawX = pos.x - bounds.width / 2 + offsetX;
    const rawY = pos.y - bounds.height / 2 + offsetY;
    const snappedX = Math.round(rawX / gridSize) * gridSize;
    const snappedY = Math.round(rawY / gridSize) * gridSize;

    if (shape.type === 'freedraw') {
      const dx = snappedX - bounds.x;
      const dy = snappedY - bounds.y;
      const s = shape as any;
      const newPoints = (s.points || []).map((p: { x: number; y: number }) => ({
        x: p.x + dx,
        y: p.y + dy,
      }));
      changes.push({
        id: shape.id,
        changes: { x: snappedX, y: snappedY, points: newPoints } as Partial<Shape>,
      });
    } else {
      changes.push({
        id: shape.id,
        changes: { x: snappedX, y: snappedY },
      });
    }
  }

  return changes;
}
