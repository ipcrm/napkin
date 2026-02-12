<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Canvas from './components/Canvas.svelte';
  import Toolbar from './components/Toolbar.svelte';
  import Menu from './components/Menu.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import { canvasStore, clearCanvas } from './lib/state/canvasStore';
  import { init, loadAutosave, saveAutosave } from './lib/storage/indexedDB';
  import { deserializeCanvasState, serializeCanvasState } from './lib/storage/jsonExport';
  import { isTauri, saveDrawingFile, openDrawingFile } from './lib/storage/tauriFile';
  import { autoSave as tauriAutoSave, loadAutoSave as tauriLoadAutoSave } from './lib/storage/autoSave';
  import { debounce } from './lib/utils/debounce';

  // Lazy import Tauri event API
  let listen: any;
  let UnlistenFn: any;

  $: shapeCount = $canvasStore.shapesArray.length;

  let saving = false;
  let lastSaved: Date | null = null;
  let canvasComponent: Canvas;
  let menuListeners: any[] = [];

  // Debounced auto-save function (saves 2 seconds after last change)
  const debouncedAutoSave = debounce(async () => {
    try {
      saving = true;

      if (isTauri()) {
        // Use Tauri auto-save
        await tauriAutoSave($canvasStore);
      } else {
        // Use IndexedDB auto-save
        const doc = serializeCanvasState($canvasStore);
        await saveAutosave(doc);
      }

      lastSaved = new Date();
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      saving = false;
    }
  }, 2000);

  // Subscribe to canvas changes and trigger auto-save
  canvasStore.subscribe(() => {
    debouncedAutoSave();
  });

  onMount(async () => {
    // Initialize IndexedDB (still needed for browser mode)
    if (!isTauri()) {
      await init();
    }

    // Load auto-saved content if it exists
    try {
      let state = null;

      if (isTauri()) {
        // Use Tauri auto-save
        state = await tauriLoadAutoSave();
      } else {
        // Use IndexedDB auto-save
        const savedDoc = await loadAutosave();
        if (savedDoc) {
          state = deserializeCanvasState(savedDoc);
        }
      }

      if (state) {
        // Merge with current state to preserve selectedIds, activeTool, stylePreset
        canvasStore.update(currentState => ({
          ...currentState,
          shapes: state.shapes,
          shapesArray: state.shapesArray,
          viewport: state.viewport || currentState.viewport,
          selectedIds: new Set(), // Clear selection on load
        }));
        console.log('Loaded auto-saved drawing');
      }
    } catch (error) {
      console.error('Failed to load auto-save:', error);
    }

    // Setup Tauri menu listeners
    if (isTauri()) {
      try {
        const { listen: tauriListen } = await import('@tauri-apps/api/event');
        listen = tauriListen;

        menuListeners = await Promise.all([
          listen('menu-new', handleMenuNew),
          listen('menu-open', handleMenuOpen),
          listen('menu-save', handleMenuSave),
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
  function handleMenuNew() {
    if ($canvasStore.shapesArray.length > 0) {
      const confirmed = confirm('Clear the canvas and start a new document? This will delete all shapes.');
      if (!confirmed) return;
    }
    clearCanvas();
  }

  async function handleMenuOpen() {
    try {
      const state = await openDrawingFile();
      if (state) {
        canvasStore.update(current => ({
          ...current,
          shapes: state.shapes,
          shapesArray: state.shapesArray,
          viewport: state.viewport,
          selectedIds: new Set(),
        }));
      }
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  }

  async function handleMenuSave() {
    try {
      await saveDrawingFile($canvasStore);
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
    // TODO: Implement undo
    console.log('Undo requested from menu');
  }

  function handleMenuRedo() {
    // TODO: Implement redo
    console.log('Redo requested from menu');
  }

  function handleMenuCut() {
    // TODO: Implement cut
    console.log('Cut requested from menu');
  }

  function handleMenuCopy() {
    // TODO: Implement copy
    console.log('Copy requested from menu');
  }

  function handleMenuPaste() {
    // TODO: Implement paste
    console.log('Paste requested from menu');
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
   * Handle help event from Menu
   */
  function handleHelp() {
    if (canvasComponent) {
      canvasComponent.showHelpDialog();
    }
  }
</script>

<div class="app">
  <header class="header">
    <div class="header-left">
      <div class="app-brand">
        <img src="/favicon.svg" alt="Napkin logo" class="app-logo" />
        <h1 class="app-title">Napkin</h1>
      </div>
      <Menu on:help={handleHelp} />
    </div>
    <div class="header-right">
      <span class="shape-count">{shapeCount} shapes</span>
      {#if saving}
        <span class="save-status saving">Saving...</span>
      {:else if lastSaved}
        <span class="save-status">Saved</span>
      {/if}
    </div>
  </header>

  <div class="main-container">
    <Toolbar />
    <div class="canvas-container">
      <Canvas bind:this={canvasComponent} />
    </div>
    <Sidebar />
  </div>
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

  .main-container {
    display: flex;
    flex: 1;
    overflow: hidden;
    height: calc(100vh - 60px);
  }

  .canvas-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    background-color: #f5f5f5;
  }
</style>
