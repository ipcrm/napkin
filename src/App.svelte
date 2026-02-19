<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import Canvas from './components/Canvas.svelte';
  import Toolbar from './components/Toolbar.svelte';
  import Menu from './components/Menu.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import TabBar from './components/TabBar.svelte';
  import PresentationOverlay from './components/PresentationOverlay.svelte';
  import WelcomeDialog from './components/WelcomeDialog.svelte';
  import SettingsDialog from './components/SettingsDialog.svelte';
  import AboutDialog from './components/AboutDialog.svelte';
  import ToolIcon from './components/ToolIcon.svelte';
  import { canvasStore, clearCanvas, enterPresentationMode, type Shape } from './lib/state/canvasStore';
  import { tabStore, snapshotActiveTab, markTabDirty, createTab, getActiveTab, getAllTabsWithState, markAllTabsClean, restoreTabsFromCollection } from './lib/state/tabStore';
  import { historyManager } from './lib/state/history';
  import { init, loadAutosave, saveAutosave } from './lib/storage/indexedDB';
  import { serializeCanvasState, deserializeCanvasState, exportCollectionToJSON, importFromJSONFlexible } from './lib/storage/jsonExport';
  import { isTauri, saveDrawingFile, saveToFile, openDrawingFile } from './lib/storage/tauriFile';
  import { createEmptyHistory, createSnapshot, reconstructState } from './lib/storage/versionHistory';
  import type { VersionHistory } from './lib/storage/schema';
  import VersionHistoryDialog from './components/VersionHistoryDialog.svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen as tauriListen } from '@tauri-apps/api/event';
  import { readTextFile, exists as fsExists } from '@tauri-apps/plugin-fs';
  import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
  import { fileStore, setFilePath } from './lib/state/fileStore';
  import { autoSave as tauriAutoSave } from './lib/storage/autoSave';
  import { debounce } from './lib/utils/debounce';
  import { initApiHandler } from './lib/api/handler';

  // Lazy import Tauri event API
  let listen: any;

  $: shapeCount = $canvasStore.shapesArray.length;

  $: fileName = (() => {
    const path = $fileStore.currentFilePath;
    if (path) {
      const parts = path.replace(/\\/g, '/').split('/');
      return parts[parts.length - 1];
    }
    return null;
  })();

  $: autoSaveTarget = fileName || 'Recovery';

  let saving = false;
  let lastSaved: Date | null = null;
  let canvasComponent: Canvas;
  let menuListeners: any[] = [];
  let showWelcome = false;
  let showSettings = false;
  let showAbout = false;
  let showVersionHistory = false;
  let versionHistory: VersionHistory = createEmptyHistory();
  let initialLoadComplete = false; // Guard: prevent auto-save before startup load finishes

  // Debounced auto-save function (saves 2 seconds after last change)
  const debouncedAutoSave = debounce(async () => {
    if (!initialLoadComplete) return; // Don't auto-save during startup
    try {
      saving = true;
      snapshotActiveTab();
      markTabDirty();

      if (isTauri()) {
        await tauriAutoSave();
      } else {
        const doc = serializeCanvasState($canvasStore);
        await saveAutosave(doc);
      }

      // Create version snapshot after autosave
      try {
        const tabs = getAllTabsWithState();
        const tabState = get(tabStore);
        const activeIdx = tabState.tabs.findIndex(t => t.id === tabState.activeTabId);
        const docs = tabs.map((t, i) => {
          const doc = serializeCanvasState(t.canvasState || $canvasStore);
          doc.metadata.title = tabState.tabs[i]?.title || t.title || 'Untitled';
          return doc;
        });
        versionHistory = createSnapshot(docs, Math.max(0, activeIdx), versionHistory);
      } catch (snapErr) {
        console.error('Snapshot failed:', snapErr);
      }

      lastSaved = new Date();
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      saving = false;
    }
  }, 2000);

  // Subscribe to canvas changes and trigger auto-save
  // Skip viewport-only changes (pan/zoom) to avoid marking canvas as dirty on pan
  let prevShapesArray: any[] | null = null;
  let prevSelectedIds: Set<string> | null = null;
  canvasStore.subscribe((state) => {
    // On first call, just capture the state
    if (prevShapesArray === null) {
      prevShapesArray = state.shapesArray;
      prevSelectedIds = state.selectedIds;
      return;
    }

    // Skip if only viewport, selectedIds, or activeTool changed
    const shapesChanged = state.shapesArray !== prevShapesArray;
    prevShapesArray = state.shapesArray;
    prevSelectedIds = state.selectedIds;

    if (shapesChanged) {
      debouncedAutoSave();
    }
  });

  onMount(async () => {

    // Initialize IndexedDB (still needed for browser mode)
    if (!isTauri()) {
      await init();
    }

    // Load content at startup
    try {
      if (isTauri()) {
        const lastPath = localStorage.getItem('napkin_last_file_path');
        console.log('[startup] Last file path from localStorage:', lastPath);
        if (lastPath) {
          try {
            // Try to load last file
            let fileExists = false;
            try {
              fileExists = await fsExists(lastPath);
            } catch (existsError) {
              console.warn('[startup] exists() failed, trying readTextFile directly:', existsError);
              // Some Tauri 2 versions may not support exists() for all paths;
              // fall through and try reading directly
              fileExists = true; // Optimistically try reading
            }
            console.log('[startup] File exists:', fileExists);
            if (fileExists) {
              const json = await readTextFile(lastPath);
              const parsed = importFromJSONFlexible(json);
              versionHistory = parsed.history || createEmptyHistory();
              if (parsed.type === 'collection') {
                restoreTabsFromCollection(parsed.documents, parsed.activeIndex);
              } else {
                canvasStore.update(currentState => ({
                  ...currentState,
                  shapes: parsed.state.shapes as Map<string, Shape>,
                  shapesArray: parsed.state.shapesArray as Shape[],
                  viewport: parsed.state.viewport || currentState.viewport,
                  selectedIds: new Set(),
                  groups: (parsed.state as any).groups || new Map(),
                  ...(parsed.state.stylePreset ? { stylePreset: { ...currentState.stylePreset, ...parsed.state.stylePreset } } : {}),
                }));
              }
              setFilePath(lastPath);
              console.log('[startup] Reopened last file:', lastPath);
            } else {
              // File doesn't exist anymore
              console.log('[startup] File no longer exists, showing welcome');
              localStorage.removeItem('napkin_last_file_path');
              showWelcome = true;
            }
          } catch (error) {
            console.error('[startup] Failed to reopen last file:', error);
            localStorage.removeItem('napkin_last_file_path');
            showWelcome = true;
          }
        } else {
          // No last file path - first launch or cleared
          console.log('[startup] No last file path, showing welcome');
          showWelcome = true;
        }
      } else {
        const savedDoc = await loadAutosave();
        if (savedDoc) {
          const state = deserializeCanvasState(savedDoc);
          canvasStore.update(currentState => ({
            ...currentState,
            shapes: state.shapes as Map<string, Shape>,
            shapesArray: state.shapesArray as Shape[],
            viewport: state.viewport || currentState.viewport,
            selectedIds: new Set(),
            groups: state.groups || new Map(),
            ...(state.stylePreset ? { stylePreset: { ...currentState.stylePreset, ...state.stylePreset } } : {}),
          }));
          console.log('Loaded auto-saved drawing');
        }
      }
    } catch (error) {
      console.error('Failed to load startup data:', error);
    } finally {
      initialLoadComplete = true; // Allow auto-save to start working
    }

    // Setup API handler for MCP/REST bridge (safe even if server isn't running)
    if (isTauri()) {
      initApiHandler().catch(err => console.error('Failed to init API handler:', err));

      // Auto-start API server if previously enabled
      if (localStorage.getItem('napkin_api_enabled') === 'true') {
        invoke('start_api_server').then(() => {
          console.log('[api] Auto-started API server');
        }).catch(err => {
          console.warn('[api] Failed to auto-start API server:', err);
        });
      }
    }

    // Setup Tauri menu listeners
    if (isTauri()) {
      try {
        listen = tauriListen;

        menuListeners = await Promise.all([
          listen('menu-new', handleMenuNew),
          listen('menu-open', handleMenuOpen),
          listen('menu-save', handleMenuSave),
          listen('menu-save-as', handleMenuSaveAs),
          listen('menu-export-png', handleMenuExportPNG),
          listen('menu-export-svg', handleMenuExportSVG),
          listen('menu-undo', handleMenuUndo),
          listen('menu-redo', handleMenuRedo),
          listen('menu-cut', handleMenuCut),
          listen('menu-copy', handleMenuCopy),
          listen('menu-paste', handleMenuPaste),
          listen('menu-delete', handleMenuDelete),
          listen('menu-zoom-in', handleMenuZoomIn),
          listen('menu-zoom-out', handleMenuZoomOut),
          listen('menu-zoom-reset', handleMenuZoomReset),
          listen('menu-presentation-mode', () => {
            enterPresentationMode();
          }),
          listen('menu-acknowledgments', () => {
            showAbout = true;
          }),
        ]);
      } catch (error) {
        console.error('Failed to setup menu listeners:', error);
      }
    }
  });

  onDestroy(() => {
    // Cleanup menu listeners
    if (menuListeners.length > 0) {
      menuListeners.forEach(unlisten => unlisten());
    }
  });

  /**
   * Menu event handlers
   */
  async function handleMenuNew() {
    const hasDirtyTabs = $tabStore.tabs.some(t => t.isDirty) || $canvasStore.shapesArray.length > 0;
    if (hasDirtyTabs) {
      let confirmed = false;
      if (isTauri()) {
        // Use Tauri's native dialog which properly blocks rendering
        confirmed = await tauriConfirm('Create a new file? Unsaved changes will be lost.', { title: 'Napkin', kind: 'warning' });
      } else {
        confirmed = confirm('Create a new file? Unsaved changes will be lost.');
      }
      if (!confirmed) return;
    }

    // Reset to single empty tab (only happens after confirmation)
    const newId = `tab_${Date.now()}_new`;
    tabStore.set({
      tabs: [{ id: newId, title: 'Untitled', isDirty: false, canvasState: null }],
      activeTabId: newId,
    });
    clearCanvas();
    setFilePath(null);
    localStorage.removeItem('napkin_last_file_path');
    historyManager.clear();
    versionHistory = createEmptyHistory();

    // Prompt for save location so the new file gets a real path
    await handleMenuSaveAs();
  }

  async function handleMenuOpen() {
    try {
      const result = await openDrawingFile();
      if (result) {
        const parsed = importFromJSONFlexible(result.json);
        versionHistory = parsed.history || createEmptyHistory();
        if (parsed.type === 'collection') {
          restoreTabsFromCollection(parsed.documents, parsed.activeIndex);
        } else {
          // Single doc - load into current empty tab or new tab
          const activeTab = getActiveTab();
          if (activeTab && $canvasStore.shapesArray.length === 0) {
            canvasStore.update(current => ({
              ...current,
              shapes: parsed.state.shapes as Map<string, Shape>,
              shapesArray: parsed.state.shapesArray as Shape[],
              viewport: parsed.state.viewport,
              selectedIds: new Set(),
              groups: (parsed.state as any).groups || new Map(),
              ...(parsed.state.stylePreset ? { stylePreset: { ...current.stylePreset, ...parsed.state.stylePreset } } : {}),
            }));
          } else {
            createTab(parsed.state.metadata?.title || 'Untitled');
            canvasStore.update(current => ({
              ...current,
              shapes: parsed.state.shapes as Map<string, Shape>,
              shapesArray: parsed.state.shapesArray as Shape[],
              viewport: parsed.state.viewport,
              selectedIds: new Set(),
              groups: (parsed.state as any).groups || new Map(),
              ...(parsed.state.stylePreset ? { stylePreset: { ...current.stylePreset, ...parsed.state.stylePreset } } : {}),
            }));
          }
        }
        setFilePath(result.filePath);
        localStorage.setItem('napkin_last_file_path', result.filePath);
      }
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  }

  async function handleMenuSave() {
    try {
      const filePath = $fileStore.currentFilePath;
      if (filePath) {
        // Snapshot all tabs and save collection
        const tabs = getAllTabsWithState();
        const tabState = get(tabStore);
        const activeIndex = tabState.tabs.findIndex(t => t.id === tabState.activeTabId);
        const json = exportCollectionToJSON(
          tabs.map(t => ({ title: t.title, canvasState: t.canvasState })),
          Math.max(0, activeIndex),
          versionHistory
        );
        await saveToFile(json, filePath);
        markAllTabsClean();
        localStorage.setItem('napkin_last_file_path', filePath);
      } else {
        await handleMenuSaveAs();
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      alert(`Failed to save file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function handleMenuSaveAs() {
    try {
      const tabs = getAllTabsWithState();
      const tabState = get(tabStore);
      const activeIndex = tabState.tabs.findIndex(t => t.id === tabState.activeTabId);
      const json = exportCollectionToJSON(
        tabs.map(t => ({ title: t.title, canvasState: t.canvasState })),
        Math.max(0, activeIndex),
        versionHistory
      );
      const filePath = await saveDrawingFile(json);
      if (filePath) {
        setFilePath(filePath);
        markAllTabsClean();
        localStorage.setItem('napkin_last_file_path', filePath);
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      alert(`Failed to save file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function handleMenuExportPNG() {
    if (canvasComponent) {
      // Trigger export from canvas component
      // This will need to be implemented in Canvas.svelte
      console.log('Export PNG requested from menu');
    }
  }

  async function handleMenuExportSVG() {
    if (canvasComponent) {
      // Trigger export from canvas component
      console.log('Export SVG requested from menu');
    }
  }

  function handleMenuUndo() {
    window.dispatchEvent(new Event('napkin-undo'));
  }

  function handleMenuRedo() {
    window.dispatchEvent(new Event('napkin-redo'));
  }

  function handleMenuCut() {
    window.dispatchEvent(new Event('napkin-cut'));
  }

  function handleMenuCopy() {
    window.dispatchEvent(new Event('napkin-copy'));
  }

  function handleMenuPaste() {
    window.dispatchEvent(new Event('napkin-paste-shapes'));
  }

  function handleMenuDelete() {
    // Delete selected shapes
    const selectedIds = Array.from($canvasStore.selectedIds);
    if (selectedIds.length > 0) {
      canvasStore.update(state => {
        const newShapes = new Map(state.shapes);
        const newShapesArray = state.shapesArray.filter(shape => !selectedIds.includes(shape.id));

        selectedIds.forEach(id => newShapes.delete(id));

        return {
          ...state,
          shapes: newShapes,
          shapesArray: newShapesArray,
          selectedIds: new Set(),
        };
      });
    }
  }

  function handleMenuZoomIn() {
    canvasStore.update(state => ({
      ...state,
      viewport: {
        ...state.viewport,
        zoom: Math.min(state.viewport.zoom * 1.2, 10)
      }
    }));
  }

  function handleMenuZoomOut() {
    canvasStore.update(state => ({
      ...state,
      viewport: {
        ...state.viewport,
        zoom: Math.max(state.viewport.zoom / 1.2, 0.1)
      }
    }));
  }

  function handleMenuZoomReset() {
    canvasStore.update(state => ({
      ...state,
      viewport: {
        ...state.viewport,
        zoom: 1
      }
    }));
  }

  /**
   * Handle welcome dialog "Create Your First Napkin" button
   */
  async function handleWelcomeCreate() {
    showWelcome = false;
    try {
      const tabs = getAllTabsWithState();
      const tabState = get(tabStore);
      const activeIndex = tabState.tabs.findIndex(t => t.id === tabState.activeTabId);
      const json = exportCollectionToJSON(
        tabs.map(t => ({ title: t.title, canvasState: t.canvasState })),
        Math.max(0, activeIndex),
        versionHistory
      );
      const filePath = await saveDrawingFile(json);
      if (filePath) {
        setFilePath(filePath);
        markAllTabsClean();
        localStorage.setItem('napkin_last_file_path', filePath);
      }
    } catch (error) {
      console.error('Failed to create initial file:', error);
    }
  }

  /**
   * Handle welcome dialog "Continue without saving" button
   */
  function handleWelcomeContinue() {
    showWelcome = false;
  }

  /**
   * Handle settings event from Menu
   */
  function handleSettings() {
    showSettings = true;
  }

  /**
   * Handle help event from Menu
   */
  function handleHelp() {
    if (canvasComponent) {
      canvasComponent.showHelpDialog();
    }
  }

  /**
   * Handle version history dialog open
   */
  function handleVersionHistory() {
    showVersionHistory = true;
  }

  /**
   * Restore a snapshot from version history
   */
  function handleRestoreSnapshot(event: CustomEvent<{ index: number }>) {
    const { index } = event.detail;
    try {
      // Auto-snapshot current state first so user can "undo" the restore
      const tabs = getAllTabsWithState();
      const tabState = get(tabStore);
      const activeIdx = tabState.tabs.findIndex(t => t.id === tabState.activeTabId);
      const currentDocs = tabs.map((t, i) => {
        const doc = serializeCanvasState(t.canvasState || $canvasStore);
        doc.metadata.title = tabState.tabs[i]?.title || t.title || 'Untitled';
        return doc;
      });
      versionHistory = createSnapshot(currentDocs, Math.max(0, activeIdx), versionHistory);

      // Reconstruct and restore the selected snapshot
      const restoredDocs = reconstructState(versionHistory, index);
      const snapshot = versionHistory.snapshots[index];

      // Use deserializeCanvasState for proper shape handling (image lazy-load reset, groups)
      const deserializedDocs = restoredDocs.map((doc, i) => {
        // Apply tab titles from snapshot (they aren't tracked in deltas)
        if (snapshot.tabTitles && snapshot.tabTitles[i]) {
          doc.metadata = { ...doc.metadata, title: snapshot.tabTitles[i] };
        }
        return deserializeCanvasState(doc);
      });

      restoreTabsFromCollection(deserializedDocs, snapshot.activeDocumentIndex);
      showVersionHistory = false;
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
      alert(`Failed to restore version: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
</script>

<div class="app" class:presentation={$canvasStore.presentationMode}>
  <header class="header">
    <div class="header-left">
      <div class="app-brand">
        <img src="/favicon.svg" alt="Napkin logo" class="app-logo" />
        <h1 class="app-title">Napkin</h1>
      </div>
      <Menu on:help={handleHelp} on:versionHistory={handleVersionHistory} />
    </div>
    <div class="header-right">
      <span class="shape-count">{shapeCount} shapes</span>
      {#if saving}
        <span class="save-status saving">Saving to {autoSaveTarget}...</span>
      {:else if lastSaved}
        <span class="save-status">Saved to {autoSaveTarget}</span>
      {/if}
      <button class="settings-btn" on:click={handleSettings} title="Settings">
        <ToolIcon tool="settings" size={18} />
      </button>
    </div>
  </header>

  <TabBar />
  <div class="main-container">
    <Toolbar />
    <div class="canvas-container">
      <Canvas bind:this={canvasComponent} />
    </div>
    <Sidebar />
  </div>
  <PresentationOverlay />
  <WelcomeDialog bind:visible={showWelcome} on:create={handleWelcomeCreate} on:continue={handleWelcomeContinue} />
  <SettingsDialog bind:visible={showSettings} />
  <AboutDialog bind:visible={showAbout} />
  <VersionHistoryDialog bind:visible={showVersionHistory} history={versionHistory} on:restore={handleRestoreSnapshot} />
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    overflow: hidden;
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background-color: #fff;
    border-bottom: 1px solid #ddd;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    z-index: 10;
    height: 60px;
    box-sizing: border-box;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .app-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .app-logo {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .app-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #333;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .shape-count {
    font-size: 13px;
    color: #666;
    font-weight: 500;
  }

  .save-status {
    font-size: 12px;
    color: #4caf50;
    font-weight: 500;
  }

  .save-status.saving {
    color: #ff9800;
  }

  .settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: none;
    border: 1px solid transparent;
    border-radius: 6px;
    color: #888;
    cursor: pointer;
    transition: all 0.15s;
    padding: 0;
  }

  .settings-btn:hover {
    color: #444;
    background: #f0f0f0;
    border-color: #e0e0e0;
  }

  .main-container {
    display: flex;
    flex: 1;
    overflow: hidden;
    height: calc(100vh - 60px - 36px);
    position: relative; /* Anchor for absolutely-positioned sidebar */
  }

  .canvas-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    background-color: #f5f5f5;
  }

  /* Presentation mode: hide all chrome */
  .app.presentation > .header {
    display: none !important;
  }

  .app.presentation :global(.tab-bar) {
    display: none !important;
  }

  .app.presentation .main-container {
    height: 100vh !important;
  }

  .app.presentation .main-container :global(.toolbar) {
    display: none !important;
  }

  .app.presentation .main-container :global(.sidebar-container) {
    display: none !important;
  }
</style>
