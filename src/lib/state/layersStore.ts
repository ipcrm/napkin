/**
 * Layers store for managing shape layers
 */

import { writable, derived, type Writable } from 'svelte/store';
import type { Shape } from '../types';

/**
 * Layer interface
 */
export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  shapeIds: string[]; // Array of shape IDs in this layer
  order: number; // Z-order of the layer (higher = on top)
}

/**
 * Layers state interface
 */
export interface LayersState {
  layers: Map<string, Layer>;
  layersArray: Layer[]; // Sorted by order
  activeLayerId: string | null;
}

/**
 * Storage key for layers
 */
const LAYERS_STORAGE_KEY = 'napkin_layers';

/**
 * Create default layer
 */
function createDefaultLayer(): Layer {
  return {
    id: 'default',
    name: 'Layer 1',
    visible: true,
    locked: false,
    shapeIds: [],
    order: 0
  };
}

/**
 * Initial layers state
 */
const initialState: LayersState = {
  layers: new Map([['default', createDefaultLayer()]]),
  layersArray: [createDefaultLayer()],
  activeLayerId: 'default'
};

/**
 * Create the layers store
 */
function createLayersStore(): Writable<LayersState> {
  const { subscribe, set, update } = writable<LayersState>(initialState);

  // Try to load from localStorage
  try {
    const stored = localStorage.getItem(LAYERS_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      const layers = new Map<string, Layer>();
      for (const layer of data.layers) {
        layers.set(layer.id, layer);
      }
      const layersArray = Array.from(layers.values()).sort((a, b) => a.order - b.order);
      set({
        layers,
        layersArray,
        activeLayerId: data.activeLayerId || 'default'
      });
    }
  } catch (error) {
    console.error('Failed to load layers from storage:', error);
  }

  return {
    subscribe,
    set,
    update
  };
}

/**
 * Export the layers store
 */
export const layersStore = createLayersStore();

/**
 * Save layers to localStorage
 */
function saveToStorage(state: LayersState): void {
  try {
    const data = {
      layers: Array.from(state.layers.values()),
      activeLayerId: state.activeLayerId
    };
    localStorage.setItem(LAYERS_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save layers to storage:', error);
  }
}

/**
 * Generate unique layer ID
 */
let layerIdCounter = 1;
function generateLayerId(): string {
  return `layer_${Date.now()}_${layerIdCounter++}`;
}

/**
 * Add a new layer
 */
export function addLayer(name?: string): string {
  let newLayerId: string = '';

  layersStore.update(state => {
    newLayerId = generateLayerId();
    const maxOrder = Math.max(...state.layersArray.map(l => l.order), -1);

    const newLayer: Layer = {
      id: newLayerId,
      name: name || `Layer ${state.layersArray.length + 1}`,
      visible: true,
      locked: false,
      shapeIds: [],
      order: maxOrder + 1
    };

    const newLayers = new Map(state.layers);
    newLayers.set(newLayerId, newLayer);

    const newState = {
      layers: newLayers,
      layersArray: [...state.layersArray, newLayer].sort((a, b) => a.order - b.order),
      activeLayerId: newLayerId
    };

    saveToStorage(newState);
    return newState;
  });

  return newLayerId;
}

/**
 * Remove a layer
 */
export function removeLayer(layerId: string): void {
  layersStore.update(state => {
    // Can't remove the last layer
    if (state.layers.size <= 1) {
      return state;
    }

    const newLayers = new Map(state.layers);
    newLayers.delete(layerId);

    const newLayersArray = Array.from(newLayers.values()).sort((a, b) => a.order - b.order);

    // If removing active layer, select another one
    let newActiveLayerId = state.activeLayerId;
    if (state.activeLayerId === layerId) {
      newActiveLayerId = newLayersArray[newLayersArray.length - 1]?.id || null;
    }

    const newState = {
      layers: newLayers,
      layersArray: newLayersArray,
      activeLayerId: newActiveLayerId
    };

    saveToStorage(newState);
    return newState;
  });
}

/**
 * Rename a layer
 */
export function renameLayer(layerId: string, newName: string): void {
  layersStore.update(state => {
    const layer = state.layers.get(layerId);
    if (!layer) return state;

    const updatedLayer = { ...layer, name: newName };
    const newLayers = new Map(state.layers);
    newLayers.set(layerId, updatedLayer);

    const newState = {
      ...state,
      layers: newLayers,
      layersArray: state.layersArray.map(l => l.id === layerId ? updatedLayer : l)
    };

    saveToStorage(newState);
    return newState;
  });
}

/**
 * Toggle layer visibility
 */
export function toggleLayerVisibility(layerId: string): void {
  layersStore.update(state => {
    const layer = state.layers.get(layerId);
    if (!layer) return state;

    const updatedLayer = { ...layer, visible: !layer.visible };
    const newLayers = new Map(state.layers);
    newLayers.set(layerId, updatedLayer);

    const newState = {
      ...state,
      layers: newLayers,
      layersArray: state.layersArray.map(l => l.id === layerId ? updatedLayer : l)
    };

    saveToStorage(newState);
    return newState;
  });
}

/**
 * Toggle layer lock
 */
export function toggleLayerLock(layerId: string): void {
  layersStore.update(state => {
    const layer = state.layers.get(layerId);
    if (!layer) return state;

    const updatedLayer = { ...layer, locked: !layer.locked };
    const newLayers = new Map(state.layers);
    newLayers.set(layerId, updatedLayer);

    const newState = {
      ...state,
      layers: newLayers,
      layersArray: state.layersArray.map(l => l.id === layerId ? updatedLayer : l)
    };

    saveToStorage(newState);
    return newState;
  });
}

/**
 * Set active layer
 */
export function setActiveLayer(layerId: string): void {
  layersStore.update(state => {
    if (!state.layers.has(layerId)) return state;

    const newState = {
      ...state,
      activeLayerId: layerId
    };

    saveToStorage(newState);
    return newState;
  });
}

/**
 * Reorder layers
 */
export function reorderLayers(layerId: string, newOrder: number): void {
  layersStore.update(state => {
    const layer = state.layers.get(layerId);
    if (!layer) return state;

    // Update orders
    const updatedLayers = state.layersArray.map(l => {
      if (l.id === layerId) {
        return { ...l, order: newOrder };
      } else if (l.order >= newOrder && l.order < layer.order) {
        return { ...l, order: l.order + 1 };
      } else if (l.order <= newOrder && l.order > layer.order) {
        return { ...l, order: l.order - 1 };
      }
      return l;
    });

    const newLayers = new Map<string, Layer>();
    for (const l of updatedLayers) {
      newLayers.set(l.id, l);
    }

    const newState = {
      ...state,
      layers: newLayers,
      layersArray: updatedLayers.sort((a, b) => a.order - b.order)
    };

    saveToStorage(newState);
    return newState;
  });
}

/**
 * Add shape to a layer
 */
export function addShapeToLayer(layerId: string, shapeId: string): void {
  layersStore.update(state => {
    const layer = state.layers.get(layerId);
    if (!layer) return state;

    // Remove from other layers first
    const newLayers = new Map<string, Layer>();
    for (const [id, l] of state.layers) {
      newLayers.set(id, {
        ...l,
        shapeIds: l.shapeIds.filter(sid => sid !== shapeId)
      });
    }

    // Add to target layer
    const updatedLayer = newLayers.get(layerId)!;
    updatedLayer.shapeIds = [...updatedLayer.shapeIds, shapeId];

    const newState = {
      ...state,
      layers: newLayers,
      layersArray: Array.from(newLayers.values()).sort((a, b) => a.order - b.order)
    };

    saveToStorage(newState);
    return newState;
  });
}

/**
 * Remove shape from all layers
 */
export function removeShapeFromLayers(shapeId: string): void {
  layersStore.update(state => {
    const newLayers = new Map<string, Layer>();
    for (const [id, layer] of state.layers) {
      newLayers.set(id, {
        ...layer,
        shapeIds: layer.shapeIds.filter(sid => sid !== shapeId)
      });
    }

    const newState = {
      ...state,
      layers: newLayers,
      layersArray: Array.from(newLayers.values()).sort((a, b) => a.order - b.order)
    };

    saveToStorage(newState);
    return newState;
  });
}

/**
 * Get layer containing a shape
 */
export function getShapeLayer(shapeId: string, state: LayersState): Layer | null {
  for (const layer of state.layers.values()) {
    if (layer.shapeIds.includes(shapeId)) {
      return layer;
    }
  }
  return null;
}

/**
 * Check if a shape is in a visible layer
 */
export function isShapeVisible(shapeId: string, state: LayersState): boolean {
  const layer = getShapeLayer(shapeId, state);
  return layer ? layer.visible : true;
}

/**
 * Check if a shape is in a locked layer
 */
export function isShapeLocked(shapeId: string, state: LayersState): boolean {
  const layer = getShapeLayer(shapeId, state);
  return layer ? layer.locked : false;
}

/**
 * Derived store: visible layers
 */
export const visibleLayers = derived(
  layersStore,
  $layersStore => $layersStore.layersArray.filter(l => l.visible)
);

/**
 * Derived store: active layer
 */
export const activeLayer = derived(
  layersStore,
  $layersStore => {
    if (!$layersStore.activeLayerId) return null;
    return $layersStore.layers.get($layersStore.activeLayerId) || null;
  }
);
