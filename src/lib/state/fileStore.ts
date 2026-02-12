/**
 * File path store - tracks the current file being edited
 */
import { writable } from 'svelte/store';

export interface FileState {
  currentFilePath: string | null;
  title: string;
}

const initialState: FileState = {
  currentFilePath: null,
  title: 'Untitled',
};

export const fileStore = writable<FileState>(initialState);

/**
 * Set the current file path and derive title from filename
 */
export function setFilePath(path: string | null): void {
  if (path) {
    // Extract filename without extension
    const parts = path.replace(/\\/g, '/').split('/');
    const filename = parts[parts.length - 1];
    const title = filename.replace(/\.(napkin|json)$/i, '');
    fileStore.set({ currentFilePath: path, title });
  } else {
    fileStore.set({ currentFilePath: null, title: 'Untitled' });
  }
}

/**
 * Get the current file path synchronously
 */
export function getCurrentFilePath(): string | null {
  let path: string | null = null;
  fileStore.subscribe(state => {
    path = state.currentFilePath;
  })();
  return path;
}
