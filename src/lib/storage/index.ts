/**
 * Storage module entry point
 * Exports all storage-related functionality
 */

// IndexedDB functions
export {
  init,
  saveAutosave,
  loadAutosave,
  clearAutosave,
  saveDocument,
  loadDocument,
  listDocuments,
  deleteDocument,
} from './indexedDB';

// JSON export/import functions
export {
  serializeCanvasState,
  deserializeCanvasState,
  exportToJSON,
  importFromJSON,
  downloadJSON,
  uploadJSON,
  copyToClipboard,
  pasteFromClipboard,
} from './jsonExport';

// Tauri file system functions
export {
  isTauri,
  saveDrawingFile,
  openDrawingFile,
  exportPNGFile,
  exportSVGFile,
} from './tauriFile';

// Dual-mode auto-save functions
export {
  autoSave,
  loadAutoSave,
} from './autoSave';

// Schema types and utilities
export type {
  Viewport,
  SerializedShape,
  DocumentMetadata,
  NapkinDocument as ExcaliDocument,
} from './schema';

export {
  createEmptyDocument,
  isValidDocument,
} from './schema';
