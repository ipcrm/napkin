<script lang="ts">
  import { get } from 'svelte/store';
  import { canvasStore, clearCanvas, enterPresentationMode, type Shape } from '$lib/state/canvasStore';
  import { downloadJSON, uploadJSON, exportToJSON, exportCollectionToJSON, importFromJSONFlexible } from '$lib/storage/jsonExport';
  import { exportToPNG, exportToSVG } from '$lib/export';
  import { isTauri, saveDrawingFile, saveToFile, openDrawingFile } from '$lib/storage/tauriFile';
  import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
  import { fileStore, setFilePath } from '$lib/state/fileStore';
  import { tabStore, createTab, getActiveTab, getAllTabsWithState, markAllTabsClean, restoreTabsFromCollection } from '$lib/state/tabStore';
  import { historyManager } from '$lib/state/history';
  import { createEventDispatcher } from 'svelte';
  import ToolIcon from './ToolIcon.svelte';

  const dispatch = createEventDispatcher();

  let isMenuOpen = false;
  let isExporting = false;

  /**
   * Handle New document
   */
  async function handleNew() {
    closeMenu();

    const hasDirtyTabs = get(tabStore).tabs.some(t => t.isDirty) || $canvasStore.shapesArray.length > 0;
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
    historyManager.clear();

    // Prompt for save location so the new file gets a real path
    await handleSaveAs();
  }

  /**
   * Handle Open document
   */
  async function handleOpen() {
    try {
      if (isTauri()) {
        const result = await openDrawingFile();
        if (result) {
          const parsed = importFromJSONFlexible(result.json);
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
              }));
            } else {
              createTab(parsed.state.metadata?.title || 'Untitled');
              canvasStore.update(current => ({
                ...current,
                shapes: parsed.state.shapes as Map<string, Shape>,
                shapesArray: parsed.state.shapesArray as Shape[],
                viewport: parsed.state.viewport,
                selectedIds: new Set(),
              }));
            }
          }
          setFilePath(result.filePath);
        }
      } else {
        // Browser: Use file input
        const data = await uploadJSON();

        // Update canvas store with imported data
        canvasStore.update(state => ({
          ...state,
          shapes: data.shapes as Map<string, Shape>,
          shapesArray: data.shapesArray as Shape[],
          viewport: data.viewport,
          selectedIds: new Set(),
        }));
      }

      closeMenu();
    } catch (error) {
      if (error instanceof Error && error.message !== 'File selection cancelled') {
        alert(`Failed to open document: ${error.message}`);
      }
    }
  }

  /**
   * Handle Save document
   */
  async function handleSave() {
    try {
      if (isTauri()) {
        const filePath = $fileStore.currentFilePath;
        if (filePath) {
          // Snapshot all tabs and save collection
          const tabs = getAllTabsWithState();
          const tabState = get(tabStore);
          const activeIndex = tabState.tabs.findIndex(t => t.id === tabState.activeTabId);
          const json = exportCollectionToJSON(
            tabs.map(t => ({ title: t.title, canvasState: t.canvasState })),
            Math.max(0, activeIndex)
          );
          await saveToFile(json, filePath);
          markAllTabsClean();
        } else {
          await handleSaveAs();
          return; // handleSaveAs handles closeMenu
        }
      } else {
        // Browser: Download as file
        downloadJSON($canvasStore, 'drawing.napkin');
      }

      closeMenu();
    } catch (error) {
      alert(`Failed to save document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function handleSaveAs() {
    try {
      if (isTauri()) {
        const tabs = getAllTabsWithState();
        const tabState = get(tabStore);
        const activeIndex = tabState.tabs.findIndex(t => t.id === tabState.activeTabId);
        const json = exportCollectionToJSON(
          tabs.map(t => ({ title: t.title, canvasState: t.canvasState })),
          Math.max(0, activeIndex)
        );
        const filePath = await saveDrawingFile(json);
        if (filePath) {
          setFilePath(filePath);
          localStorage.setItem('napkin_last_file_path', filePath);
          markAllTabsClean();
        }
      } else {
        downloadJSON($canvasStore, 'drawing.napkin');
      }

      closeMenu();
    } catch (error) {
      alert(`Failed to save document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle Export Canvas - exports just the active tab as a single document
   */
  async function handleExportCanvas() {
    try {
      if (isTauri()) {
        const json = exportToJSON($canvasStore);
        await saveDrawingFile(json);
      } else {
        downloadJSON($canvasStore, 'canvas-export.napkin');
      }
      closeMenu();
    } catch (error) {
      alert(`Failed to export canvas: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle Export as PNG
   */
  async function handleExportPNG() {
    try {
      isExporting = true;
      const state = $canvasStore;

      await exportToPNG(state.shapesArray, state.viewport, {
        backgroundColor: '#ffffff',
        filename: 'napkin-export.png'
      });

      closeMenu();
    } catch (error) {
      alert(`Failed to export PNG: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      isExporting = false;
    }
  }

  /**
   * Handle Export as SVG
   */
  async function handleExportSVG() {
    try {
      isExporting = true;
      const state = $canvasStore;

      await exportToSVG(state.shapesArray, state.viewport, {
        backgroundColor: '#ffffff',
        filename: 'napkin-export.svg'
      });

      closeMenu();
    } catch (error) {
      alert(`Failed to export SVG: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      isExporting = false;
    }
  }

  /**
   * Toggle menu open/closed
   */
  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
  }

  /**
   * Close menu
   */
  function closeMenu() {
    isMenuOpen = false;
  }

  /**
   * Close menu when clicking outside
   */
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.menu-container')) {
      closeMenu();
    }
  }

  /**
   * Handle Presentation Mode
   */
  function handlePresentationMode() {
    enterPresentationMode();
    closeMenu();
  }

  /**
   * Handle Version History menu item
   */
  function handleVersionHistory() {
    dispatch('versionHistory');
    closeMenu();
  }

  /**
   * Handle Help menu item
   */
  function handleHelp() {
    dispatch('help');
    closeMenu();
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="menu-container">
  <button class="menu-button" on:click|stopPropagation={toggleMenu}>
    <ToolIcon tool="menu" size={18} />
    <span class="menu-label">File</span>
  </button>

  {#if isMenuOpen}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="menu-dropdown" on:click|stopPropagation>
      <button class="menu-item" on:click={handleNew}>
        <span class="menu-item-icon"><ToolIcon tool="new" size={16} /></span>
        <span class="menu-item-label">New</span>
        <span class="menu-item-shortcut">Ctrl+N</span>
      </button>

      <button class="menu-item" on:click={handleOpen}>
        <span class="menu-item-icon"><ToolIcon tool="open" size={16} /></span>
        <span class="menu-item-label">Open</span>
        <span class="menu-item-shortcut">Ctrl+O</span>
      </button>

      <button class="menu-item" on:click={handleSave}>
        <span class="menu-item-icon"><ToolIcon tool="save" size={16} /></span>
        <span class="menu-item-label">Save</span>
        <span class="menu-item-shortcut">{isTauri() ? '⌘S' : 'Ctrl+S'}</span>
      </button>

      <button class="menu-item" on:click={handleSaveAs}>
        <span class="menu-item-icon"><ToolIcon tool="save" size={16} /></span>
        <span class="menu-item-label">Save As...</span>
        <span class="menu-item-shortcut">{isTauri() ? '⌘⇧S' : 'Ctrl+⇧+S'}</span>
      </button>

      <button class="menu-item" on:click={handleVersionHistory}>
        <span class="menu-item-icon"><ToolIcon tool="undo" size={16} /></span>
        <span class="menu-item-label">Version History</span>
      </button>

      <div class="menu-divider"></div>

      <button class="menu-item" on:click={handleExportPNG} disabled={isExporting}>
        <span class="menu-item-icon"><ToolIcon tool="export-png" size={16} /></span>
        <span class="menu-item-label">Export as PNG</span>
        {#if isExporting}
          <span class="menu-item-status">...</span>
        {/if}
      </button>

      <button class="menu-item" on:click={handleExportSVG} disabled={isExporting}>
        <span class="menu-item-icon"><ToolIcon tool="export-svg" size={16} /></span>
        <span class="menu-item-label">Export as SVG</span>
        {#if isExporting}
          <span class="menu-item-status">...</span>
        {/if}
      </button>

      <div class="menu-divider"></div>

      <button class="menu-item" on:click={handlePresentationMode}>
        <span class="menu-item-icon"><ToolIcon tool="presentation" size={16} /></span>
        <span class="menu-item-label">Presentation Mode</span>
        <span class="menu-item-shortcut">{isTauri() ? '⌘⇧P' : 'Ctrl+⇧+P'}</span>
      </button>

      <div class="menu-divider"></div>

      <button class="menu-item" on:click={handleHelp}>
        <span class="menu-item-icon"><ToolIcon tool="help" size={16} /></span>
        <span class="menu-item-label">Help</span>
        <span class="menu-item-shortcut">?</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .menu-container {
    position: relative;
    display: inline-block;
  }

  .menu-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background-color: #fff;
    border: 1px solid #e2e2e2;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    color: #444;
    transition: all 0.15s ease;
  }

  .menu-button:hover {
    background-color: #f5f5f5;
    border-color: #ccc;
  }

  .menu-button:active {
    background-color: #ebebeb;
  }

  .menu-label {
    font-weight: 500;
  }

  .menu-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    min-width: 220px;
    background-color: #fff;
    border: 1px solid #e2e2e2;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
    z-index: 1000;
    padding: 4px;
    animation: menuSlideDown 0.12s ease-out;
  }

  @keyframes menuSlideDown {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    background-color: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: #444;
    text-align: left;
    transition: background-color 0.1s ease;
  }

  .menu-item:hover:not(:disabled) {
    background-color: #f0f0f0;
  }

  .menu-item:active:not(:disabled) {
    background-color: #e4e4e4;
  }

  .menu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .menu-item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    color: #666;
  }

  .menu-item:hover:not(:disabled) .menu-item-icon {
    color: #444;
  }

  .menu-item-label {
    flex: 1;
  }

  .menu-item-status {
    font-size: 12px;
    color: #666;
  }

  .menu-item-shortcut {
    font-size: 11px;
    color: #aaa;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  }

  .menu-divider {
    height: 1px;
    background-color: #eee;
    margin: 4px 8px;
  }
</style>
