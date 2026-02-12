/**
 * Document schema for Napkin
 * Defines the structure for serialization and storage
 */

/**
 * Viewport state for pan/zoom
 */
export interface Viewport {
  /** X offset (pan) */
  offsetX: number;
  /** Y offset (pan) */
  offsetY: number;
  /** Zoom level (1.0 = 100%) */
  zoom: number;
}

/**
 * Serialized shape data
 * Generic structure that can represent any shape type
 */
export interface SerializedShape {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Array<{ x: number; y: number }>;
  text?: string;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  opacity?: number;
  rotation?: number;
  [key: string]: any; // Allow additional properties for specific shape types
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  /** ISO timestamp when document was created */
  created: string;
  /** ISO timestamp when document was last modified */
  modified: string;
  /** Optional document title */
  title?: string;
  /** Optional description */
  description?: string;
}

/**
 * Complete Napkin document structure
 * This is the format used for JSON export/import and IndexedDB storage
 */
export interface ExcaliDocument {
  /** Schema version for future migrations */
  version: string;
  /** Application identifier */
  appName: string;
  /** Array of shapes in the document */
  shapes: SerializedShape[];
  /** Viewport state (pan/zoom) */
  viewport: Viewport;
  /** Document metadata */
  metadata: DocumentMetadata;
}

/**
 * Creates a default empty document
 */
export function createEmptyDocument(): ExcaliDocument {
  const now = new Date().toISOString();
  return {
    version: "1.0.0",
    appName: "napkin",
    shapes: [],
    viewport: {
      offsetX: 0,
      offsetY: 0,
      zoom: 1.0,
    },
    metadata: {
      created: now,
      modified: now,
      title: "Untitled",
    },
  };
}

/**
 * Validates that an object conforms to the ExcaliDocument schema
 */
export function isValidDocument(obj: any): obj is ExcaliDocument {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.version === "string" &&
    typeof obj.appName === "string" &&
    Array.isArray(obj.shapes) &&
    obj.viewport &&
    typeof obj.viewport.offsetX === "number" &&
    typeof obj.viewport.offsetY === "number" &&
    typeof obj.viewport.zoom === "number" &&
    obj.metadata &&
    typeof obj.metadata.created === "string" &&
    typeof obj.metadata.modified === "string"
  );
}
