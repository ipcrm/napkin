/**
 * Dual-mode auto-save system
 * Uses Tauri file system for desktop app, IndexedDB for web browser
 */

import { isTauri } from './tauriFile';
import { saveAutosave as saveIndexedDB, loadAutosave as loadIndexedDB } from './indexedDB';
import { serializeCanvasState, deserializeCanvasState, exportToJSON } from './jsonExport';
import { getCurrentFilePath } from '../state/fileStore';
import type { CanvasState } from '../state/canvasStore';
import type { ExcaliDocument } from './schema';

// Lazy import Tauri APIs (only when needed)
let writeTextFile: any;
let readTextFile: any;
let appDataDir: any;
let exists: any;

async function loadTauriAPIs() {
  if (!writeTextFile) {
    const fs = await import('@tauri-apps/plugin-fs');
    const path = await import('@tauri-apps/api/path');
    writeTextFile = fs.writeTextFile;
    readTextFile = fs.readTextFile;
    exists = fs.exists;
    appDataDir = path.appDataDir;
  }
}

/**
 * Auto-save to appropriate storage
 */
export async function autoSave(state: CanvasState): Promise<void> {
  if (isTauri()) {
    // Desktop: Save to app data folder
    await loadTauriAPIs();

    // If we have a named file, auto-save there
    const currentPath = getCurrentFilePath();
    if (currentPath) {
      const json = exportToJSON(state);
      await writeTextFile(currentPath, json);
      return;
    }

    const appDataPath = await appDataDir();
    const filePath = `${appDataPath}/autosave.excali`;

    // Serialize state to document format
    const document: ExcaliDocument = {
      version: 1,
      shapes: serializeCanvasState(state),
      viewport: state.viewport,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const json = JSON.stringify(document, null, 2);
    await writeTextFile(filePath, json);
  } else {
    // Browser: Save to IndexedDB
    const document: ExcaliDocument = {
      version: 1,
      shapes: serializeCanvasState(state),
      viewport: state.viewport,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveIndexedDB(document);
  }
}

/**
 * Load from auto-save
 */
export async function loadAutoSave(): Promise<CanvasState | null> {
  if (isTauri()) {
    // Desktop: Load from app data folder
    try {
      await loadTauriAPIs();

      const appDataPath = await appDataDir();
      const filePath = `${appDataPath}/autosave.excali`;

      // Check if file exists
      const fileExists = await exists(filePath);
      if (!fileExists) {
        return null;
      }

      // Read file
      const json = await readTextFile(filePath);
      const document: ExcaliDocument = JSON.parse(json);

      // Deserialize to canvas state
      const state = deserializeCanvasState(document.shapes, document.viewport);
      return state;
    } catch (e) {
      console.error('Failed to load autosave from Tauri:', e);
      return null; // No auto-save file or error
    }
  } else {
    // Browser: Load from IndexedDB
    try {
      const document = await loadIndexedDB();
      if (!document) {
        return null;
      }

      const state = deserializeCanvasState(document.shapes, document.viewport);
      return state;
    } catch (e) {
      console.error('Failed to load autosave from IndexedDB:', e);
      return null;
    }
  }
}
