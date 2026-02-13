/**
 * Simple grid-based spatial index for fast hit detection
 * Divides canvas into grid cells and stores shapes in relevant cells
 */

import type { BoundingBox } from '$lib/types';
import { boundingBoxesIntersect, type Point } from '$lib/utils/geometry';

/**
 * Configuration for the spatial index grid
 */
export interface SpatialIndexConfig {
  cellSize: number; // Size of each grid cell (default 100)
}

/**
 * Interface for objects that can be indexed
 */
export interface IndexableObject {
  id: string;
  getBounds(): BoundingBox;
}

/**
 * Grid-based spatial index for fast spatial queries
 */
export class SpatialIndex<T extends IndexableObject> {
  private cellSize: number;
  private grid: Map<string, Set<T>>;
  private objectCells: Map<string, Set<string>>; // Track which cells contain each object

  constructor(config: SpatialIndexConfig = { cellSize: 100 }) {
    this.cellSize = config.cellSize;
    this.grid = new Map();
    this.objectCells = new Map();
  }

  /**
   * Get cell key for a point
   */
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Get all cell keys that a bounding box overlaps
   */
  private getCellKeysForBounds(bounds: BoundingBox): Set<string> {
    const keys = new Set<string>();

    const minCellX = Math.floor(bounds.x / this.cellSize);
    const minCellY = Math.floor(bounds.y / this.cellSize);
    const maxCellX = Math.floor((bounds.x + bounds.width) / this.cellSize);
    const maxCellY = Math.floor((bounds.y + bounds.height) / this.cellSize);

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        keys.add(`${cellX},${cellY}`);
      }
    }

    return keys;
  }

  /**
   * Insert an object into the index
   */
  insert(object: T): void {
    // Remove from old cells if it was already indexed
    this.remove(object.id);

    const bounds = object.getBounds();
    const cellKeys = this.getCellKeysForBounds(bounds);

    // Track which cells contain this object
    this.objectCells.set(object.id, cellKeys);

    // Add to each cell
    for (const key of cellKeys) {
      if (!this.grid.has(key)) {
        this.grid.set(key, new Set());
      }
      this.grid.get(key)!.add(object);
    }
  }

  /**
   * Remove an object from the index by ID
   */
  remove(objectId: string): void {
    const cellKeys = this.objectCells.get(objectId);
    if (!cellKeys) return;

    // Remove from all cells
    for (const key of cellKeys) {
      const cell = this.grid.get(key);
      if (cell) {
        // Remove objects with matching ID
        for (const obj of cell) {
          if (obj.id === objectId) {
            cell.delete(obj);
            break;
          }
        }

        // Clean up empty cells
        if (cell.size === 0) {
          this.grid.delete(key);
        }
      }
    }

    this.objectCells.delete(objectId);
  }

  /**
   * Update an object's position in the index
   */
  update(object: T): void {
    this.insert(object); // insert() already handles removal of old cells
  }

  /**
   * Query objects at a specific point
   * Returns candidates that may contain the point (must do precise check after)
   */
  queryPoint(point: Point): T[] {
    const key = this.getCellKey(point.x, point.y);
    const cell = this.grid.get(key);

    if (!cell) return [];

    return Array.from(cell);
  }

  /**
   * Query objects within a bounding box
   * Returns candidates that may intersect (must do precise check after)
   */
  queryBounds(bounds: BoundingBox): T[] {
    const cellKeys = this.getCellKeysForBounds(bounds);
    const results = new Set<T>();

    for (const key of cellKeys) {
      const cell = this.grid.get(key);
      if (cell) {
        for (const obj of cell) {
          results.add(obj);
        }
      }
    }

    return Array.from(results);
  }

  /**
   * Query objects within a radius of a point
   * Returns candidates (must do precise distance check after)
   */
  queryRadius(center: Point, radius: number): T[] {
    const bounds: BoundingBox = {
      x: center.x - radius,
      y: center.y - radius,
      width: radius * 2,
      height: radius * 2
    };

    return this.queryBounds(bounds);
  }

  /**
   * Clear all objects from the index
   */
  clear(): void {
    this.grid.clear();
    this.objectCells.clear();
  }

  /**
   * Rebuild the entire index with new objects
   */
  rebuild(objects: T[]): void {
    this.clear();
    for (const obj of objects) {
      this.insert(obj);
    }
  }

  /**
   * Get statistics about the index
   */
  getStats(): {
    cellCount: number;
    objectCount: number;
    averageObjectsPerCell: number;
  } {
    let totalObjects = 0;
    for (const cell of this.grid.values()) {
      totalObjects += cell.size;
    }

    return {
      cellCount: this.grid.size,
      objectCount: this.objectCells.size,
      averageObjectsPerCell: this.grid.size > 0 ? totalObjects / this.grid.size : 0
    };
  }

  /**
   * Get the cell size
   */
  getCellSize(): number {
    return this.cellSize;
  }
}

/**
 * Create a spatial index with default configuration
 */
export function createSpatialIndex<T extends IndexableObject>(
  cellSize: number = 100
): SpatialIndex<T> {
  return new SpatialIndex<T>({ cellSize });
}
