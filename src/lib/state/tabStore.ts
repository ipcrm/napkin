/**
 * Tab store - manages multiple canvas tabs
 */
import { writable, get } from 'svelte/store';
import { canvasStore, clearCanvas, type CanvasState } from './canvasStore';
import { historyManager } from './history';

export interface Tab {
  id: string;
  title: string;
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
    presentationMode: false,
  };

  tabStore.update(state => ({
    ...state,
    tabs: [...state.tabs, {
      id: newId,
      title,
      isDirty: false,
      canvasState: null, // Will be the active tab
    }],
    activeTabId: newId,
  }));

  // Load new empty state into canvasStore
  canvasStore.set(defaultCanvasState);
  historyManager.clear();

  return newId;
}

/**
 * Create a new tab without switching the UI to it.
 * The tab is stored with a default empty canvas state (non-null),
 * so it never becomes "live" in canvasStore.
 */
export function createTabSilent(title: string = 'Untitled'): string {
  const newId = generateTabId();

  // Snapshot current tab first (same as createTab)
  snapshotActiveTab();

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
    presentationMode: false,
  };

  tabStore.update(state => ({
    ...state,
    tabs: [...state.tabs, {
      id: newId,
      title,
      isDirty: false,
      canvasState: defaultCanvasState, // Stored, not live — UI unaffected
    }],
    // activeTabId unchanged — UI stays on current tab
  }));

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
}

/**
 * Close a tab
 */
export function closeTab(tabId: string): void {
  const state = get(tabStore);
  if (state.tabs.length <= 1) {
    // Last tab - just clear it
    clearCanvas();
    tabStore.update(s => ({
      ...s,
      tabs: s.tabs.map(tab => ({
        ...tab,
        title: 'Untitled',
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
 * Mark all tabs as clean (after saving the collection)
 */
export function markAllTabsClean(): void {
  tabStore.update(state => ({
    ...state,
    tabs: state.tabs.map(tab => ({ ...tab, isDirty: false })),
  }));
}

/**
 * Restore tabs from a collection of deserialized documents.
 * Clears existing tabs, creates new ones, and loads the active tab into canvasStore.
 */
export function restoreTabsFromCollection(
  documents: Array<{ shapes: Map<string, any>; shapesArray: any[]; viewport: any; metadata: any; stylePreset?: any; groups?: Map<string, any> }>,
  activeIndex: number
): void {
  if (documents.length === 0) return;

  // Clamp activeIndex
  const safeIndex = Math.max(0, Math.min(activeIndex, documents.length - 1));

  // Build new tabs
  const newTabs: Tab[] = documents.map((doc, i) => {
    const id = generateTabId();
    const title = doc.metadata?.title || 'Untitled';
    const isActive = i === safeIndex;

    const defaultStylePreset = {
      strokeColor: '#000000',
      fillColor: 'transparent',
      strokeWidth: 2,
      strokeStyle: 'solid' as const,
      opacity: 1,
      roughness: 1,
    };

    return {
      id,
      title,
      isDirty: false,
      canvasState: isActive ? null : {
        shapes: doc.shapes,
        shapesArray: doc.shapesArray,
        viewport: doc.viewport,
        selectedIds: new Set(),
        groups: doc.groups || new Map(),
        activeTool: 'select' as const,
        stylePreset: doc.stylePreset ? { ...defaultStylePreset, ...doc.stylePreset } : defaultStylePreset,
        showGrid: true,
        presentationMode: false,
      } as CanvasState,
    };
  });

  const activeTab = newTabs[safeIndex];
  const activeDoc = documents[safeIndex];

  // Set the tab store
  tabStore.set({
    tabs: newTabs,
    activeTabId: activeTab.id,
  });

  // Load active document into canvasStore
  const defaultStylePresetForActive = {
    strokeColor: '#000000',
    fillColor: 'transparent',
    strokeWidth: 2,
    strokeStyle: 'solid' as const,
    opacity: 1,
    roughness: 1,
  };

  canvasStore.update(currentState => ({
    ...currentState,
    shapes: activeDoc.shapes,
    shapesArray: activeDoc.shapesArray,
    viewport: activeDoc.viewport || currentState.viewport,
    selectedIds: new Set(),
    groups: activeDoc.groups || new Map(),
    stylePreset: activeDoc.stylePreset
      ? { ...defaultStylePresetForActive, ...activeDoc.stylePreset }
      : defaultStylePresetForActive,
  }));

  historyManager.clear();
}

/**
 * Get the active tab
 */
export function getActiveTab(): Tab | undefined {
  const state = get(tabStore);
  return state.tabs.find(t => t.id === state.activeTabId);
}

/**
 * Get a tab's canvas state without switching tabs.
 * For the active tab, snapshots current canvasStore state.
 * For inactive tabs, returns their stored state.
 */
export function getTabCanvasState(tabId: string): CanvasState | null {
  const state = get(tabStore);
  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab) return null;

  if (tabId === state.activeTabId) {
    // Active tab's state is live in canvasStore
    return get(canvasStore);
  }

  return tab.canvasState;
}

/**
 * Write canvas state directly to a non-active tab without switching the UI.
 * If the tab is active, updates canvasStore instead.
 */
export function updateTabCanvasState(tabId: string, canvasState: CanvasState): void {
  const state = get(tabStore);

  if (tabId === state.activeTabId) {
    // Active tab — update canvasStore directly
    canvasStore.set(canvasState);
    return;
  }

  // Inactive tab — update stored state
  tabStore.update(s => ({
    ...s,
    tabs: s.tabs.map(tab =>
      tab.id === tabId ? { ...tab, canvasState, isDirty: true } : tab
    ),
  }));
}

/**
 * Get all tabs with their states for serialization
 */
export function getAllTabsWithState(): Tab[] {
  snapshotActiveTab();
  return get(tabStore).tabs;
}
