import { writable, derived, type Writable } from 'svelte/store';
import type { Shape, Viewport, StylePreset, ToolType } from '$lib/types';

// Re-export types for convenience
export type { Shape, Viewport, StylePreset, ToolType };

// Group data structure
export interface Group {
  id: string;
  shapeIds: string[];
  parentGroupId?: string; // For nested groups
}

// Main canvas state interface
export interface CanvasState {
  shapes: Map<string, Shape>;      // Fast O(1) lookup by id
  shapesArray: Shape[];             // Z-order for rendering (back to front)
  selectedIds: Set<string>;         // Currently selected shape ids
  groups: Map<string, Group>;       // Groups by id
  viewport: Viewport;               // Current pan/zoom state
  activeTool: ToolType;             // Active drawing/editing tool
  stylePreset: StylePreset;         // Default style for new shapes
  showGrid: boolean;                // Whether to show the grid background
  presentationMode: boolean;        // Whether presentation mode is active
  toolBeforePresentation?: ToolType; // Tool that was active before entering presentation mode
}

// Initial state
const initialState: CanvasState = {
  shapes: new Map(),
  shapesArray: [],
  selectedIds: new Set(),
  groups: new Map(),
  viewport: {
    x: 0,
    y: 0,
    zoom: 1
  },
  activeTool: 'select',
  stylePreset: {
    strokeColor: '#000000',
    fillColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 2,
    strokeStyle: 'solid',
    opacity: 1,
    roughness: 1 // Default to whiteboard feel
  },
  showGrid: true,
  presentationMode: false
};

// Create the main canvas store
export const canvasStore: Writable<CanvasState> = writable(initialState);

// Helper function to generate unique IDs
let idCounter = 0;
export function generateShapeId(): string {
  return `shape_${Date.now()}_${idCounter++}`;
}

// Helper functions for shape management

/**
 * Add a shape to the canvas
 */
export function addShape(shape: Shape): void {
  canvasStore.update(state => {
    const newShapes = new Map(state.shapes);
    newShapes.set(shape.id, shape);

    return {
      ...state,
      shapes: newShapes,
      shapesArray: [...state.shapesArray, shape]
    };
  });
}

/**
 * Remove a shape from the canvas
 */
export function removeShape(shapeId: string): void {
  canvasStore.update(state => {
    const newShapes = new Map(state.shapes);
    newShapes.delete(shapeId);

    const newSelectedIds = new Set(state.selectedIds);
    newSelectedIds.delete(shapeId);

    return {
      ...state,
      shapes: newShapes,
      shapesArray: state.shapesArray.filter(s => s.id !== shapeId),
      selectedIds: newSelectedIds
    };
  });
}

/**
 * Update an existing shape
 */
export function updateShape(shapeId: string, updates: Partial<Shape>): void {
  canvasStore.update(state => {
    const shape = state.shapes.get(shapeId);
    if (!shape) return state;

    const updatedShape = { ...shape, ...updates, id: shapeId } as Shape; // Ensure id doesn't change
    const newShapes = new Map(state.shapes);
    newShapes.set(shapeId, updatedShape);

    return {
      ...state,
      shapes: newShapes,
      shapesArray: state.shapesArray.map(s => s.id === shapeId ? updatedShape : s)
    };
  });
}

/**
 * Remove multiple shapes
 */
export function removeShapes(shapeIds: string[]): void {
  canvasStore.update(state => {
    const newShapes = new Map(state.shapes);
    const idsToRemove = new Set(shapeIds);

    shapeIds.forEach(id => newShapes.delete(id));

    const newSelectedIds = new Set(state.selectedIds);
    shapeIds.forEach(id => newSelectedIds.delete(id));

    return {
      ...state,
      shapes: newShapes,
      shapesArray: state.shapesArray.filter(s => !idsToRemove.has(s.id)),
      selectedIds: newSelectedIds
    };
  });
}

/**
 * Select a shape (clears previous selection unless additive)
 */
export function selectShape(shapeId: string, additive: boolean = false): void {
  canvasStore.update(state => {
    const newSelectedIds = additive ? new Set(state.selectedIds) : new Set<string>();
    newSelectedIds.add(shapeId);

    return {
      ...state,
      selectedIds: newSelectedIds
    };
  });
}

/**
 * Deselect a shape
 */
export function deselectShape(shapeId: string): void {
  canvasStore.update(state => {
    const newSelectedIds = new Set(state.selectedIds);
    newSelectedIds.delete(shapeId);

    return {
      ...state,
      selectedIds: newSelectedIds
    };
  });
}

/**
 * Clear all selections
 */
export function clearSelection(): void {
  canvasStore.update(state => ({
    ...state,
    selectedIds: new Set()
  }));
}

/**
 * Set the active tool
 */
export function setActiveTool(tool: ToolType): void {
  // Remember last used shape
  const shapeTools: ToolType[] = ['rectangle', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star', 'cloud', 'cylinder', 'sticky'];
  if (shapeTools.includes(tool)) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lastUsedShape', tool);
    }
  }

  canvasStore.update(state => ({
    ...state,
    activeTool: tool
  }));
}

/**
 * Get the last used shape tool (or default to rectangle)
 */
export function getLastUsedShape(): ToolType {
  if (typeof localStorage !== 'undefined') {
    const lastShape = localStorage.getItem('lastUsedShape');
    const shapeTools: ToolType[] = ['rectangle', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star', 'cloud', 'cylinder', 'sticky'];
    if (lastShape && shapeTools.includes(lastShape as ToolType)) {
      return lastShape as ToolType;
    }
  }
  return 'rectangle';
}

/**
 * Update viewport (pan/zoom)
 */
export function updateViewport(updates: Partial<Viewport>): void {
  canvasStore.update(state => ({
    ...state,
    viewport: { ...state.viewport, ...updates }
  }));
}

/**
 * Update style preset
 */
export function updateStylePreset(updates: Partial<StylePreset>): void {
  canvasStore.update(state => ({
    ...state,
    stylePreset: { ...state.stylePreset, ...updates }
  }));
}

/**
 * Toggle grid visibility
 */
export function toggleGrid(): void {
  canvasStore.update(state => ({
    ...state,
    showGrid: !state.showGrid
  }));
}

/**
 * Enter presentation mode (fullscreen read-only view)
 */
export function enterPresentationMode(): void {
  canvasStore.update(state => ({
    ...state,
    presentationMode: true,
    selectedIds: new Set(),
    toolBeforePresentation: state.activeTool, // Save current tool to restore later
    activeTool: 'pan', // Automatically switch to pan mode for easy navigation
  }));

}

/**
 * Exit presentation mode
 */
export function exitPresentationMode(): void {
  canvasStore.update(state => ({
    ...state,
    presentationMode: false,
    activeTool: state.toolBeforePresentation || 'select', // Restore previous tool or default to select
    toolBeforePresentation: undefined, // Clear the saved tool
  }));
}

/**
 * Move shape to top (bring to front)
 */
export function bringToFront(shapeId: string): void {
  canvasStore.update(state => {
    const shape = state.shapes.get(shapeId);
    if (!shape) return state;

    return {
      ...state,
      shapesArray: [
        ...state.shapesArray.filter(s => s.id !== shapeId),
        shape
      ]
    };
  });
}

/**
 * Move shape to bottom (send to back)
 */
export function sendToBack(shapeId: string): void {
  canvasStore.update(state => {
    const shape = state.shapes.get(shapeId);
    if (!shape) return state;

    return {
      ...state,
      shapesArray: [
        shape,
        ...state.shapesArray.filter(s => s.id !== shapeId)
      ]
    };
  });
}

/**
 * Move shape forward one layer
 */
export function bringForward(shapeId: string): void {
  canvasStore.update(state => {
    const shape = state.shapes.get(shapeId);
    if (!shape) return state;

    const currentIndex = state.shapesArray.findIndex(s => s.id === shapeId);
    if (currentIndex === -1 || currentIndex === state.shapesArray.length - 1) {
      return state; // Already at top or not found
    }

    const newArray = [...state.shapesArray];
    // Swap with next shape
    [newArray[currentIndex], newArray[currentIndex + 1]] = [newArray[currentIndex + 1], newArray[currentIndex]];

    return {
      ...state,
      shapesArray: newArray
    };
  });
}

/**
 * Move shape backward one layer
 */
export function sendBackward(shapeId: string): void {
  canvasStore.update(state => {
    const shape = state.shapes.get(shapeId);
    if (!shape) return state;

    const currentIndex = state.shapesArray.findIndex(s => s.id === shapeId);
    if (currentIndex <= 0) {
      return state; // Already at bottom or not found
    }

    const newArray = [...state.shapesArray];
    // Swap with previous shape
    [newArray[currentIndex], newArray[currentIndex - 1]] = [newArray[currentIndex - 1], newArray[currentIndex]];

    return {
      ...state,
      shapesArray: newArray
    };
  });
}

/**
 * Update multiple shapes at once
 */
export function updateShapes(updates: Array<{ id: string; changes: Partial<Shape> }>): void {
  canvasStore.update(state => {
    const newShapes = new Map(state.shapes);
    const updatesMap = new Map(updates.map(u => [u.id, u.changes]));

    const newShapesArray = state.shapesArray.map(shape => {
      const changes = updatesMap.get(shape.id);
      if (!changes) return shape;

      const updated = { ...shape, ...changes, id: shape.id } as Shape;
      newShapes.set(shape.id, updated);
      return updated;
    });

    return {
      ...state,
      shapes: newShapes,
      shapesArray: newShapesArray
    };
  });
}

/**
 * Clear all shapes
 */
export function clearCanvas(): void {
  canvasStore.update(state => ({
    ...state,
    shapes: new Map(),
    shapesArray: [],
    selectedIds: new Set()
  }));
}

// Derived stores

/**
 * Get all currently selected shapes
 */
export const selectedShapes = derived(
  canvasStore,
  $canvasStore => {
    return Array.from($canvasStore.selectedIds)
      .map(id => $canvasStore.shapes.get(id))
      .filter((shape): shape is Shape => shape !== undefined);
  }
);

/**
 * Get the count of shapes
 */
export const shapeCount = derived(
  canvasStore,
  $canvasStore => $canvasStore.shapesArray.length
);

/**
 * Get the count of selected shapes
 */
export const selectedCount = derived(
  canvasStore,
  $canvasStore => $canvasStore.selectedIds.size
);

/**
 * Check if there is a selection
 */
export const hasSelection = derived(
  canvasStore,
  $canvasStore => $canvasStore.selectedIds.size > 0
);

// Group management functions

/**
 * Generate unique group ID
 */
export function generateGroupId(): string {
  return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a group from selected shapes
 * Returns the new group ID
 */
export function groupShapes(shapeIds: string[]): string {
  if (shapeIds.length < 2) {
    throw new Error('Cannot group less than 2 shapes');
  }

  const groupId = generateGroupId();

  canvasStore.update(state => {
    const newShapes = new Map(state.shapes);
    const newGroups = new Map(state.groups);

    // Update each shape with the group ID
    shapeIds.forEach(id => {
      const shape = newShapes.get(id);
      if (shape) {
        newShapes.set(id, { ...shape, groupId });
      }
    });

    // Create the group
    newGroups.set(groupId, {
      id: groupId,
      shapeIds: [...shapeIds]
    });

    // Update shapesArray with new shape references
    const newShapesArray = state.shapesArray.map(shape =>
      newShapes.get(shape.id) || shape
    );

    return {
      ...state,
      shapes: newShapes,
      shapesArray: newShapesArray,
      groups: newGroups
    };
  });

  return groupId;
}

/**
 * Ungroup shapes in a group
 */
export function ungroupShapes(groupId: string): void {
  canvasStore.update(state => {
    const group = state.groups.get(groupId);
    if (!group) return state;

    const newShapes = new Map(state.shapes);
    const newGroups = new Map(state.groups);

    // Remove group ID from all shapes in the group
    group.shapeIds.forEach(id => {
      const shape = newShapes.get(id);
      if (shape) {
        const { groupId: _, ...shapeWithoutGroup } = shape;
        newShapes.set(id, shapeWithoutGroup as Shape);
      }
    });

    // Remove the group
    newGroups.delete(groupId);

    // Update shapesArray with new shape references
    const newShapesArray = state.shapesArray.map(shape =>
      newShapes.get(shape.id) || shape
    );

    return {
      ...state,
      shapes: newShapes,
      shapesArray: newShapesArray,
      groups: newGroups
    };
  });
}

/**
 * Get all shapes in a group
 */
export function getGroupShapes(groupId: string): Shape[] {
  let result: Shape[] = [];

  canvasStore.subscribe(state => {
    const group = state.groups.get(groupId);
    if (!group) {
      result = [];
      return;
    }

    result = group.shapeIds
      .map(id => state.shapes.get(id))
      .filter((shape): shape is Shape => shape !== undefined);
  })();

  return result;
}

/**
 * Get all shape IDs in a group (including nested groups)
 */
export function getAllShapeIdsInGroup(groupId: string): string[] {
  let result: string[] = [];

  canvasStore.subscribe(state => {
    const group = state.groups.get(groupId);
    if (!group) {
      result = [];
      return;
    }

    result = [...group.shapeIds];
  })();

  return result;
}

/**
 * Select all shapes in a group when one shape is clicked
 */
export function selectShapeWithGroup(shapeId: string, additive: boolean = false): Set<string> {
  let selectedIds = new Set<string>();

  canvasStore.subscribe(state => {
    const shape = state.shapes.get(shapeId);
    if (!shape) {
      selectedIds = additive ? new Set(state.selectedIds) : new Set();
      return;
    }

    // If shape is in a group, select all shapes in the group
    if (shape.groupId) {
      const group = state.groups.get(shape.groupId);
      if (group) {
        selectedIds = additive ? new Set(state.selectedIds) : new Set();
        group.shapeIds.forEach(id => selectedIds.add(id));
      } else {
        selectedIds = additive ? new Set(state.selectedIds) : new Set();
        selectedIds.add(shapeId);
      }
    } else {
      selectedIds = additive ? new Set(state.selectedIds) : new Set();
      selectedIds.add(shapeId);
    }
  })();

  return selectedIds;
}
