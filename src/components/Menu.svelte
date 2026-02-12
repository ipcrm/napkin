<script lang="ts">
  import { canvasStore, clearCanvas } from '$lib/state/canvasStore';
  import { downloadJSON, uploadJSON } from '$lib/storage/jsonExport';
  import { exportToPNG, exportToSVG } from '$lib/export';
  import { isTauri, saveDrawingFile, saveToFile, openDrawingFile } from '$lib/storage/tauriFile';
  import { fileStore, setFilePath } from '$lib/state/fileStore';
  import { createTab, getActiveTab, setActiveTabFile } from '$lib/state/tabStore';
  import { createEventDispatcher } from 'svelte';
  import ToolIcon from './ToolIcon.svelte';

  const dispatch = createEventDispatcher();

  let isMenuOpen = false;
  let isExporting = false;

  /**
   * Handle New document
   */
  async function handleNew() {
    createTab();
    closeMenu();
  }

  /**
   * Handle Open document
   */
  async function handleOpen() {
    try {
      if (isTauri()) {
        const result = await openDrawingFile();
        if (result) {
          const activeTab = getActiveTab();
          if (activeTab && $canvasStore.shapesArray.length === 0 && !activeTab.filePath) {
            canvasStore.update(current => ({
              ...current,
              shapes: result.state.shapes,
              shapesArray: result.state.shapesArray,
              viewport: result.state.viewport,
              selectedIds: new Set(),
            }));
          } else {
            createTab();
            canvasStore.update(current => ({
              ...current,
              shapes: result.state.shapes,
              shapesArray: result.state.shapesArray,
              viewport: result.state.viewport,
              selectedIds: new Set(),
            }));
          }
          setFilePath(result.filePath);
          setActiveTabFile(result.filePath);
        }
      } else {
        // Browser: Use file input
        const data = await uploadJSON();

        // Update canvas store with imported data
        canvasStore.update(state => ({
          ...state,
          shapes: data.shapes,
          shapesArray: data.shapesArray,
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
      const state = $canvasStore;

      if (isTauri()) {
        const activeTab = getActiveTab();
        const filePath = activeTab?.filePath || $fileStore.currentFilePath;
        if (filePath) {
          await saveToFile(state, filePath);
        } else {
          await handleSaveAs();
          return; // handleSaveAs handles closeMenu
        }
      } else {
        // Browser: Download as file
        downloadJSON(state, 'drawing.napkin');
      }

      closeMenu();
    } catch (error) {
      alert(`Failed to save document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function handleSaveAs() {
    try {
      const state = $canvasStore;

      if (isTauri()) {
        const filePath = await saveDrawingFile(state);
        if (filePath) {
          setFilePath(filePath);
          setActiveTabFile(filePath);
        }
      } else {
        downloadJSON(state, 'drawing.napkin');
      }

      closeMenu();
    } catch (error) {
      alert(`Failed to save document: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        width: 1920,
        height: 1080,
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
        width: 1920,
        height: 1080,
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
