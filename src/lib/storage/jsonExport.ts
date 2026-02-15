/**
 * JSON export/import functionality
 * Handles serialization and deserialization of canvas state
 */

import type {NapkinDocument, SerializedShape, Viewport, NapkinCollection} from './schema';
import {isValidDocument, isCollection} from './schema';

/**
 * Shape interface for runtime shapes
 * This is a minimal interface to avoid circular dependencies
 */
interface Shape {
  id: string;
  type: string;
  x: number;
  y: number;
  [key: string]: any;
}

/**
 * Canvas state structure
 */
interface CanvasState {
  shapes?: Map<string, Shape>;
  shapesArray?: Shape[];
  viewport?: Viewport;
  [key: string]: any;
}

/**
 * Serialize a single shape to the portable format
 *
 * @param shape - The shape to serialize
 * @returns Serialized shape data
 */
function serializeShape(shape: Shape): SerializedShape {
  // Create a shallow copy to avoid modifying the original
  const serialized: SerializedShape = {
    id: shape.id,
    type: shape.type,
    x: shape.x,
    y: shape.y,
  };

  // Copy common properties if they exist
  if ('width' in shape && shape.width !== undefined) {
    serialized.width = shape.width;
  }
  if ('height' in shape && shape.height !== undefined) {
    serialized.height = shape.height;
  }
  if ('points' in shape && shape.points !== undefined) {
    serialized.points = shape.points;
  }
  if ('text' in shape && shape.text !== undefined) {
    serialized.text = shape.text;
  }
  if ('strokeColor' in shape && shape.strokeColor !== undefined) {
    serialized.strokeColor = shape.strokeColor;
  }
  if ('fillColor' in shape && shape.fillColor !== undefined) {
    serialized.fillColor = shape.fillColor;
  }
  if ('strokeWidth' in shape && shape.strokeWidth !== undefined) {
    serialized.strokeWidth = shape.strokeWidth;
  }
  if ('opacity' in shape && shape.opacity !== undefined) {
    serialized.opacity = shape.opacity;
  }
  if ('rotation' in shape && shape.rotation !== undefined) {
    serialized.rotation = shape.rotation;
  }

  // Copy any additional properties (shape-specific data)
  for (const key in shape) {
    if (!(key in serialized) && key !== 'render' && key !== 'getBounds' && key !== 'containsPoint' && key !== 'imageElement') {
      serialized[key] = shape[key];
    }
  }

  return serialized;
}

/**
 * Deserialize a shape from the portable format
 *
 * @param serialized - The serialized shape data
 * @returns Deserialized shape object
 */
function deserializeShape(serialized: SerializedShape): Shape {
  const shape: Shape = {...serialized};
  // Reset transient image properties for lazy loading
  if (shape.type === 'image') {
    (shape as any).loaded = false;
    (shape as any).imageElement = undefined;
  }
  return shape;
}

/**
 * Serialize canvas state to NapkinDocument format
 *
 * @param state - The canvas state to serialize
 * @returns NapkinDocument ready for export/storage
 */
export function serializeCanvasState(state: CanvasState): NapkinDocument {
  const now = new Date().toISOString();

  // Get shapes array (prefer shapesArray, fallback to converting Map)
  let shapesArray: Shape[] = [];
  if (state.shapesArray && Array.isArray(state.shapesArray)) {
    shapesArray = state.shapesArray;
  } else if (state.shapes && state.shapes instanceof Map) {
    shapesArray = Array.from(state.shapes.values());
  }

  // Serialize all shapes
  const serializedShapes = shapesArray.map(serializeShape);

  // Convert runtime viewport to schema viewport
  const runtimeVp = state.viewport || {x: 0, y: 0, zoom: 1};
  const viewport: Viewport = {
    x: runtimeVp.x ?? 0,
    y: runtimeVp.y ?? 0,
    zoom: runtimeVp.zoom ?? 1.0,
  };

  return {
    version: "1.0.0",
    appName: "napkin",
    shapes: serializedShapes,
    viewport,
    stylePreset: state.stylePreset ? {
      strokeColor: state.stylePreset.strokeColor,
      fillColor: state.stylePreset.fillColor,
      fillStyle: state.stylePreset.fillStyle,
      strokeWidth: state.stylePreset.strokeWidth,
      strokeStyle: state.stylePreset.strokeStyle,
      opacity: state.stylePreset.opacity,
      roughness: state.stylePreset.roughness,
    } : undefined,
    metadata: {
      created: state.metadata?.created || now,
      modified: now,
      title: state.metadata?.title || "Untitled",
      description: state.metadata?.description,
    },
  };
}

/**
 * Deserialize NapkinDocument to canvas state format
 *
 * @param document - The document to deserialize
 * @returns Canvas state with shapes as both Map and array
 */
export function deserializeCanvasState(document: NapkinDocument): {
  shapes: Map<string, Shape>;
  shapesArray: Shape[];
  viewport: Viewport;
  metadata: any;
  stylePreset?: any;
  groups?: Map<string, {id: string; shapeIds: string[]}>;
} {
  // Deserialize all shapes
  const shapesArray = document.shapes.map(deserializeShape);

  // Create Map for fast lookup
  const shapes = new Map<string, Shape>();
  shapesArray.forEach(shape => {
    shapes.set(shape.id, shape);
  });

  // Rebuild groups Map from shapes' groupId properties
  const groups = new Map<string, {id: string; shapeIds: string[]}>();
  for (const shape of shapesArray) {
    if (shape.groupId) {
      const existing = groups.get(shape.groupId);
      if (existing) {
        existing.shapeIds.push(shape.id);
      } else {
        groups.set(shape.groupId, {id: shape.groupId, shapeIds: [shape.id]});
      }
    }
  }

  // Convert schema viewport to runtime viewport
  const vp = document.viewport || {x: 0, y: 0, zoom: 1};
  const runtimeViewport = {
    x: vp.x ?? 0,
    y: vp.y ?? 0,
    zoom: vp.zoom ?? 1,
  };

  return {
    shapes,
    shapesArray,
    viewport: runtimeViewport as any,
    metadata: document.metadata,
    stylePreset: (document as any).stylePreset || undefined,
    groups,
  };
}

/**
 * Export canvas state to JSON string
 *
 * @param state - The canvas state to export
 * @param pretty - If true, format JSON with indentation for readability
 * @returns JSON string
 */
export function exportToJSON(state: CanvasState, pretty = true): string {
  const document = serializeCanvasState(state);
  return JSON.stringify(document, null, pretty ? 2 : 0);
}

/**
 * Import canvas state from JSON string
 *
 * @param json - The JSON string to import
 * @returns Deserialized canvas state
 * @throws Error if JSON is invalid or doesn't match schema
 */
export function importFromJSON(json: string): {
  shapes: Map<string, Shape>;
  shapesArray: Shape[];
  viewport: Viewport;
  metadata: any;
  stylePreset?: any;
} {
  let parsed: any;

  // Parse JSON
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Validate schema
  if (!isValidDocument(parsed)) {
    throw new Error('Invalid document format: does not match NapkinDocument schema');
  }

  return deserializeCanvasState(parsed);
}

/**
 * Download document as JSON file
 *
 * @param state - The canvas state to export
 * @param filename - The filename for the download (default: "napkin-document.json")
 */
export function downloadJSON(state: CanvasState, filename = "napkin-document.json"): void {
  const json = exportToJSON(state, true);
  const blob = new Blob([json], {type: 'application/json'});
  const url = URL.createObjectURL(blob);

  // Create temporary link and trigger download
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL
  URL.revokeObjectURL(url);
}

/**
 * Upload and import a JSON file
 *
 * @returns Promise that resolves to the imported canvas state
 */
export function uploadJSON(): Promise<{
  shapes: Map<string, Shape>;
  shapesArray: Shape[];
  viewport: Viewport;
  metadata: any;
  stylePreset?: any;
}> {
  return new Promise((resolve, reject) => {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      try {
        const text = await file.text();
        const state = importFromJSON(text);
        resolve(state);
      } catch (error) {
        reject(error);
      }
    };

    input.oncancel = () => {
      reject(new Error('File selection cancelled'));
    };

    // Trigger file picker
    input.click();
  });
}

/**
 * Copy document to clipboard as JSON
 *
 * @param state - The canvas state to copy
 * @returns Promise that resolves when copy is complete
 */
export async function copyToClipboard(state: CanvasState): Promise<void> {
  const json = exportToJSON(state, false);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(json);
  } else {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = json;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/**
 * Paste document from clipboard
 *
 * @returns Promise that resolves to the imported canvas state, or null if clipboard is empty
 */
export async function pasteFromClipboard(): Promise<{
  shapes: Map<string, Shape>;
  shapesArray: Shape[];
  viewport: Viewport;
  metadata: any;
  stylePreset?: any;
} | null> {
  let text: string;

  if (navigator.clipboard && navigator.clipboard.readText) {
    text = await navigator.clipboard.readText();
  } else {
    throw new Error('Clipboard API not supported in this browser');
  }

  if (!text) {
    return null;
  }

  try {
    return importFromJSON(text);
  } catch (error) {
    throw new Error(`Failed to import from clipboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export all tabs as a collection JSON string
 */
export function exportCollectionToJSON(
  tabs: Array<{title: string; canvasState: any}>,
  activeIndex: number
): string {
  const now = new Date().toISOString();
  const documents = tabs.map(tab => {
    const doc = serializeCanvasState(tab.canvasState);
    doc.metadata.title = tab.title;
    return doc;
  });

  const collection: NapkinCollection = {
    version: "1.0.0",
    appName: "napkin",
    type: 'collection',
    documents,
    activeDocumentIndex: activeIndex,
    metadata: {
      created: now,
      modified: now,
      title: "Collection",
    },
  };

  return JSON.stringify(collection, null, 2);
}

/**
 * Import from JSON, detecting single doc vs collection
 */
export function importFromJSONFlexible(json: string): {
  type: 'single';
  state: {shapes: Map<string, Shape>; shapesArray: Shape[]; viewport: Viewport; metadata: any; stylePreset?: any};
} | {
  type: 'collection';
  documents: Array<{shapes: Map<string, Shape>; shapesArray: Shape[]; viewport: Viewport; metadata: any; stylePreset?: any}>;
  activeIndex: number;
} {
  const parsed = JSON.parse(json);

  if (isCollection(parsed)) {
    const documents = parsed.documents.map((doc: any) => {
      if (!isValidDocument(doc)) {
        throw new Error('Invalid document in collection');
      }
      return deserializeCanvasState(doc);
    });
    return {
      type: 'collection',
      documents,
      activeIndex: parsed.activeDocumentIndex || 0,
    };
  }

  // Single document
  if (!isValidDocument(parsed)) {
    throw new Error('Invalid document format');
  }

  return {
    type: 'single',
    state: deserializeCanvasState(parsed),
  };
}
