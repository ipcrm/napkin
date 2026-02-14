/**
 * Dual-mode auto-save system
 * Uses Tauri file system for desktop app, IndexedDB for web browser
 *
 * Desktop: saves ALL tabs as a collection (NapkinCollection format)
 * Browser: saves single document to IndexedDB (legacy)
 */

import { isTauri } from './tauriFile';
import { saveAutosave as saveIndexedDB, loadAutosave as loadIndexedDB } from './indexedDB';
import { exportCollectionToJSON, importFromJSONFlexible, serializeCanvasState, deserializeCanvasState } from './jsonExport';
import { getCurrentFilePath } from '../state/fileStore';
import { canvasStore } from '../state/canvasStore';
import { getAllTabsWithState, tabStore } from '../state/tabStore';
import { get } from 'svelte/store';
import { writeTextFile, readTextFile, exists } from '@tauri-apps/plugin-fs';
import { appDataDir } from '@tauri-apps/api/path';

/**
 * Auto-save to appropriate storage.
 * Desktop: builds collection JSON from all tabs and saves.
 * Browser: saves single document to IndexedDB.
 */
export async function autoSave(): Promise<void> {
  if (isTauri()) {
    // Build collection JSON from all tabs
    const tabs = getAllTabsWithState();
    const tabState = get(tabStore);
    const activeIndex = tabState.tabs.findIndex(t => t.id === tabState.activeTabId);
    const json = exportCollectionToJSON(
      tabs.map(t => ({ title: t.title, canvasState: t.canvasState })),
      Math.max(0, activeIndex)
    );

    // If we have a named file, save there
    const currentPath = getCurrentFilePath();
    if (currentPath) {
      await writeTextFile(currentPath, json);
      return;
    }

    // Otherwise save to recovery file
    const appDataPath = await appDataDir();
    const filePath = `${appDataPath}/autosave.napkin`;
    await writeTextFile(filePath, json);
  } else {
    // Browser: Save to IndexedDB (keep existing single-doc approach)
    const state = get(canvasStore);
    const doc = serializeCanvasState(state as any);
    await saveIndexedDB(doc);
  }
}

/**
 * Load from auto-save.
 * Returns either a collection or a single document, depending on what was saved.
 */
export async function loadAutoSave(): Promise<{
  type: 'collection';
  documents: Array<{ shapes: Map<string, any>; shapesArray: any[]; viewport: any; metadata: any }>;
  activeIndex: number;
} | {
  type: 'single';
  state: { shapes: Map<string, any>; shapesArray: any[]; viewport: any; metadata: any };
} | null> {
  if (isTauri()) {
    try {
      const appDataPath = await appDataDir();
      const filePath = `${appDataPath}/autosave.napkin`;

      const fileExists = await exists(filePath);
      if (!fileExists) return null;

      const json = await readTextFile(filePath);
      return importFromJSONFlexible(json);
    } catch (e) {
      console.error('Failed to load autosave from Tauri:', e);
      return null;
    }
  } else {
    // Browser: Load from IndexedDB
    try {
      const document = await loadIndexedDB();
      if (!document) {
        return null;
      }

      const state = deserializeCanvasState(document);
      return {
        type: 'single',
        state,
      };
    } catch (e) {
      console.error('Failed to load autosave from IndexedDB:', e);
      return null;
    }
  }
}
