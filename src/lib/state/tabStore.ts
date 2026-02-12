/**
 * Tab store - manages multiple canvas tabs
 */
import { writable, get } from 'svelte/store';
import { canvasStore, clearCanvas, type CanvasState } from './canvasStore';
import { historyManager } from './history';
import { setFilePath } from './fileStore';

export interface Tab {
  id: string;
  title: string;
  filePath: string | null;
  isDirty: boolean;
  canvasState: CanvasState | null; // null means state is currently live in canvasStore
}

export interface TabStoreState {
  tabs: Tab[];
  activeTabId: string;
}

let tabIdCounter = 0;
function generateTabId(): string {
  return `tab_${Date.now()}_${tabIdCounter++}`;
}

const initialTabId = generateTabId();

const initialState: TabStoreState = {
  tabs: [{
    id: initialTabId,
    title: 'Untitled',
    filePath: null,
    isDirty: false,
    canvasState: null, // Active tab's state lives in canvasStore
  }],
  activeTabId: initialTabId,
};

export const tabStore = writable<TabStoreState>(initialState);

/**
 * Snapshot the current canvasStore state into the active tab
 */
export function snapshotActiveTab(): void {
  const currentCanvasState = get(canvasStore);
  tabStore.update(state => ({
    ...state,
    tabs: state.tabs.map(tab =>
      tab.id === state.activeTabId
        ? { ...tab, canvasState: { ...currentCanvasState } }
        : tab
    ),
  }));
}

/**
 * Create a new tab
 */
export function createTab(title: string = 'Untitled'): string {
  const newId = generateTabId();

  // Snapshot current tab first
  snapshotActiveTab();

  // Create default canvas state for the new tab
  const defaultCanvasState: CanvasState = {
    shapes: new Map(),
    shapesArray: [],
    selectedIds: new Set(),
    groups: new Map(),
    viewport: { x: 0, y: 0, zoom: 1 },
    activeTool: 'select',
    stylePreset: {
      strokeColor: '#000000',
      fillColor: 'transparent',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
      roughness: 1,
    },
    showGrid: true,
  };

  tabStore.update(state => ({
    ...state,
    tabs: [...state.tabs, {
      id: newId,
      title,
      filePath: null,
      isDirty: false,
      canvasState: null, // Will be the active tab
    }],
    activeTabId: newId,
  }));

  // Load new empty state into canvasStore
  canvasStore.set(defaultCanvasState);
  historyManager.clear();
  setFilePath(null);

  return newId;
}

/**
 * Switch to a different tab
 */
export function switchTab(tabId: string): void {
  const state = get(tabStore);
  if (tabId === state.activeTabId) return;

  const targetTab = state.tabs.find(t => t.id === tabId);
  if (!targetTab) return;

  // Snapshot current tab's state
  snapshotActiveTab();

  // Update which tab is active
  tabStore.update(s => ({
    ...s,
    tabs: s.tabs.map(tab => {
      if (tab.id === tabId) {
        return { ...tab, canvasState: null }; // Will be live in canvasStore
      }
      return tab;
    }),
    activeTabId: tabId,
  }));

  // Load target tab's state into canvasStore
  if (targetTab.canvasState) {
    canvasStore.set(targetTab.canvasState);
  }

  // Clear history on tab switch (MVP)
  historyManager.clear();

  // Update file path for the new active tab
  setFilePath(targetTab.filePath);
}

/**
 * Close a tab
 */
export function closeTab(tabId: string): void {
  const state = get(tabStore);
  if (state.tabs.length <= 1) {
    // Last tab - just clear it
    clearCanvas();
    setFilePath(null);
    tabStore.update(s => ({
      ...s,
      tabs: s.tabs.map(tab => ({
        ...tab,
        title: 'Untitled',
        filePath: null,
        isDirty: false,
        canvasState: null,
      })),
    }));
    return;
  }

  const tabIndex = state.tabs.findIndex(t => t.id === tabId);
  const isActive = tabId === state.activeTabId;

  if (isActive) {
    // Switch to adjacent tab before closing
    const nextIndex = tabIndex === state.tabs.length - 1 ? tabIndex - 1 : tabIndex + 1;
    const nextTab = state.tabs[nextIndex];
    switchTab(nextTab.id);
  }

  // Remove the tab
  tabStore.update(s => ({
    ...s,
    tabs: s.tabs.filter(t => t.id !== tabId),
  }));
}

/**
 * Rename a tab
 */
export function renameTab(tabId: string, title: string): void {
  tabStore.update(state => ({
    ...state,
    tabs: state.tabs.map(tab =>
      tab.id === tabId ? { ...tab, title } : tab
    ),
  }));
}

/**
 * Mark the active tab as dirty
 */
export function markTabDirty(): void {
  tabStore.update(state => ({
    ...state,
    tabs: state.tabs.map(tab =>
      tab.id === state.activeTabId ? { ...tab, isDirty: true } : tab
    ),
  }));
}

/**
 * Mark a tab as clean (after saving)
 */
export function markTabClean(tabId?: string): void {
  tabStore.update(state => ({
    ...state,
    tabs: state.tabs.map(tab =>
      tab.id === (tabId || state.activeTabId) ? { ...tab, isDirty: false } : tab
    ),
  }));
}

/**
 * Update active tab's file path and title
 */
export function setActiveTabFile(filePath: string | null, title?: string): void {
  tabStore.update(state => {
    const derivedTitle = title || (filePath
      ? filePath.replace(/\\/g, '/').split('/').pop()?.replace(/\.(napkin|json)$/i, '') || 'Untitled'
      : 'Untitled');
    return {
      ...state,
      tabs: state.tabs.map(tab =>
        tab.id === state.activeTabId
          ? { ...tab, filePath, title: derivedTitle }
          : tab
      ),
    };
  });
}

/**
 * Get the active tab
 */
export function getActiveTab(): Tab | undefined {
  const state = get(tabStore);
  return state.tabs.find(t => t.id === state.activeTabId);
}

/**
 * Get all tabs with their states for serialization
 */
export function getAllTabsWithState(): Tab[] {
  snapshotActiveTab();
  return get(tabStore).tabs;
}
