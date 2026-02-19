/**
 * Document schema for Napkin
 * Defines the structure for serialization and storage
 */

/**
 * Viewport state for pan/zoom
 */
export interface Viewport {
  /** X offset (pan) */
  x: number;
  /** Y offset (pan) */
  y: number;
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
  points?: Array<{x: number; y: number}>;
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
export interface NapkinDocument {
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
  /** Optional style preset for new shapes */
  stylePreset?: {
    strokeColor?: string;
    fillColor?: string;
    fillStyle?: string;
    strokeWidth?: number;
    strokeStyle?: string;
    opacity?: number;
    roughness?: number;
  };
}

/**
 * Creates a default empty document
 */
export function createEmptyDocument(): NapkinDocument {
  const now = new Date().toISOString();
  return {
    version: "1.0.0",
    appName: "napkin",
    shapes: [],
    viewport: {
      x: 0,
      y: 0,
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
 * Delta for a single document (tab) between snapshots
 */
export interface DocumentDelta {
  /** Index of the document in the collection */
  index: number;
  /** Shapes added since last snapshot */
  added: SerializedShape[];
  /** IDs of shapes removed since last snapshot */
  removed: string[];
  /** Shapes modified since last snapshot (only changed keys) */
  modified: Array<{ id: string; changes: Record<string, any> }>;
  /** Viewport state (included if changed) */
  viewport?: Viewport;
}

/**
 * Delta between two consecutive snapshots
 */
export interface SnapshotDelta {
  documents: DocumentDelta[];
}

/**
 * A single version snapshot
 */
export interface VersionSnapshot {
  /** Unique ID: snapshot_{timestamp} */
  id: string;
  /** ISO timestamp */
  timestamp: string;
  /** Human-readable summary of changes */
  summary: string;
  /** Full state (present on baseline snapshots, every Nth) */
  fullState?: NapkinDocument[];
  /** Delta from previous snapshot (present on incremental snapshots) */
  delta?: SnapshotDelta;
  /** Which tab was active */
  activeDocumentIndex: number;
  /** Tab titles at time of snapshot (always stored, survives deltas) */
  tabTitles?: string[];
}

/**
 * Version history stored alongside the collection
 */
export interface VersionHistory {
  /** Maximum number of snapshots to keep */
  maxSnapshots: number;
  /** Store a full baseline every N snapshots */
  baselineInterval: number;
  /** Snapshots, oldest first */
  snapshots: VersionSnapshot[];
}

/**
 * Napkin Collection - multiple documents in one file
 */
export interface NapkinCollection {
  /** Schema version */
  version: string;
  /** Application identifier */
  appName: string;
  /** Document type identifier */
  type: 'collection';
  /** Array of documents (one per tab) */
  documents: NapkinDocument[];
  /** Index of the active document/tab */
  activeDocumentIndex: number;
  /** Collection metadata */
  metadata: DocumentMetadata;
  /** Optional version history (backwards compatible) */
  history?: VersionHistory;
}

/**
 * Check if an object is a NapkinCollection
 */
export function isCollection(obj: any): obj is NapkinCollection {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.type === 'collection' &&
    Array.isArray(obj.documents)
  );
}

/**
 * Validates that an object conforms to the NapkinDocument schema
 */
export function isValidDocument(obj: any): obj is NapkinDocument {
  if (
    !obj ||
    typeof obj !== "object" ||
    typeof obj.version !== "string" ||
    typeof obj.appName !== "string" ||
    !Array.isArray(obj.shapes) ||
    !obj.viewport ||
    typeof obj.viewport.zoom !== "number" ||
    !obj.metadata ||
    typeof obj.metadata.created !== "string" ||
    typeof obj.metadata.modified !== "string"
  ) {
    return false;
  }

  // Accept both {offsetX, offsetY} and {x, y} viewport formats
  const vp = obj.viewport;
  const hasOffset = typeof vp.offsetX === "number" && typeof vp.offsetY === "number";
  const hasXY = typeof vp.x === "number" && typeof vp.y === "number";
  return hasOffset || hasXY;
}
