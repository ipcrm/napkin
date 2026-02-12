<script lang="ts">
  import { canvasStore, setActiveTool, type ToolType } from '$lib/state/canvasStore';
  import { historyManager } from '$lib/state/history';
  import { onMount, onDestroy } from 'svelte';
  import ToolFlyout from './ToolFlyout.svelte';
  import ToolIcon from './ToolIcon.svelte';

  $: activeTool = $canvasStore.activeTool;

  // History state
  let canUndo = false;
  let canRedo = false;
  let historyInterval: number;

  // Flyout state
  let shapesFlyoutVisible = false;
  let linesFlyoutVisible = false;
  let flyoutPosition = { top: 0, left: 0 };

  // Last used tools (default to rectangle and line)
  let lastShapeTool: ToolType = 'rectangle';
  let lastLineTool: ToolType = 'line';

  // Refs for positioning
  let shapesButtonRef: HTMLButtonElement;
  let linesButtonRef: HTMLButtonElement;

  onMount(() => {
    historyInterval = window.setInterval(() => {
      canUndo = historyManager.canUndo();
      canRedo = historyManager.canRedo();
    }, 100);

    // Load last used tools from localStorage
    const savedShape = localStorage.getItem('lastUsedShape') as ToolType;
    const savedLine = localStorage.getItem('lastUsedLine') as ToolType;
    if (savedShape && shapeTools.some(t => t.id === savedShape)) {
      lastShapeTool = savedShape;
    }
    if (savedLine && lineTools.some(t => t.id === savedLine)) {
      lastLineTool = savedLine;
    }

    // Close flyouts when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.flyout') && !target.closest('.tool-button')) {
        shapesFlyoutVisible = false;
        linesFlyoutVisible = false;
      }
    };
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  onDestroy(() => {
    if (historyInterval) {
      clearInterval(historyInterval);
    }
  });

  function selectTool(toolId: ToolType) {
    setActiveTool(toolId);

    // Update last used tool and close flyouts
    if (shapeTools.some(t => t.id === toolId)) {
      lastShapeTool = toolId;
      localStorage.setItem('lastUsedShape', toolId);
      shapesFlyoutVisible = false;
    } else if (lineTools.some(t => t.id === toolId)) {
      lastLineTool = toolId;
      localStorage.setItem('lastUsedLine', toolId);
      linesFlyoutVisible = false;
    }
  }

  function handleUndo() {
    if (historyManager.canUndo()) {
      historyManager.undo();
    }
  }

  function handleRedo() {
    if (historyManager.canRedo()) {
      historyManager.redo();
    }
  }

  function toggleShapesFlyout(event: MouseEvent) {
    event.stopPropagation();
    if (shapesButtonRef) {
      const rect = shapesButtonRef.getBoundingClientRect();
      flyoutPosition = {
        top: rect.top,
        left: rect.right + 8
      };
    }
    shapesFlyoutVisible = !shapesFlyoutVisible;
    linesFlyoutVisible = false;
  }

  function toggleLinesFlyout(event: MouseEvent) {
    event.stopPropagation();
    if (linesButtonRef) {
      const rect = linesButtonRef.getBoundingClientRect();
      flyoutPosition = {
        top: rect.top,
        left: rect.right + 8
      };
    }
    linesFlyoutVisible = !linesFlyoutVisible;
    shapesFlyoutVisible = false;
  }

  interface Tool {
    id: ToolType;
    label: string;
    shortcut?: string;
  }

  const selectTools: Tool[] = [
    { id: 'select', label: 'Select', shortcut: 'V' },
  ];

  const shapeTools: Tool[] = [
    { id: 'rectangle', label: 'Rectangle', shortcut: 'R' },
    { id: 'ellipse', label: 'Ellipse', shortcut: 'E' },
    { id: 'triangle', label: 'Triangle', shortcut: 'G' },
    { id: 'diamond', label: 'Diamond', shortcut: 'I' },
    { id: 'hexagon', label: 'Hexagon', shortcut: 'X' },
    { id: 'star', label: 'Star', shortcut: 'P' },
    { id: 'cloud', label: 'Cloud', shortcut: 'C' },
    { id: 'cylinder', label: 'Cylinder', shortcut: 'Y' },
  ];

  const lineTools: Tool[] = [
    { id: 'line', label: 'Line', shortcut: 'L' },
    { id: 'arrow', label: 'Arrow', shortcut: 'A' },
  ];

  const drawTools: Tool[] = [
    { id: 'freedraw', label: 'Freedraw', shortcut: 'D' },
    { id: 'text', label: 'Text', shortcut: 'T' },
    { id: 'sticky', label: 'Sticky Note', shortcut: 'S' },
  ];

  const viewTools: Tool[] = [
    { id: 'pan', label: 'Pan', shortcut: 'H' },
  ];

  // Get current tool for each group
  $: currentShapeTool = shapeTools.find(t => t.id === lastShapeTool) || shapeTools[0];
  $: currentLineTool = lineTools.find(t => t.id === lastLineTool) || lineTools[0];
</script>

<div class="toolbar">
  <!-- HISTORY -->
  <div class="toolbar-section">
    <div class="history-buttons">
      <button
        class="icon-button"
        class:disabled={!canUndo}
        on:click={handleUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        <ToolIcon tool="undo" size={16} />
      </button>
      <button
        class="icon-button"
        class:disabled={!canRedo}
        on:click={handleRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
      >
        <ToolIcon tool="redo" size={16} />
      </button>
    </div>
  </div>

  <div class="toolbar-separator"></div>

  <!-- SELECT -->
  <div class="toolbar-section">
    {#each selectTools as tool}
      <button
        class="tool-button"
        class:active={activeTool === tool.id}
        on:click={() => selectTool(tool.id)}
        title="{tool.label}{tool.shortcut ? ` (${tool.shortcut})` : ''}"
      >
        <ToolIcon tool={tool.id} size={22} />
      </button>
    {/each}
  </div>

  <div class="toolbar-separator"></div>

  <!-- SHAPES -->
  <div class="toolbar-section">
    <div class="toolbar-label">Shapes</div>
    <button
      bind:this={shapesButtonRef}
      class="tool-button"
      class:active={shapeTools.some(t => t.id === activeTool)}
      on:click={toggleShapesFlyout}
      title="Click to choose shape"
    >
      <ToolIcon tool={currentShapeTool.id} size={22} />
      <span class="tool-expand">
        <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor">
          <polygon points="0,0 6,0 3,5"/>
        </svg>
      </span>
    </button>
  </div>

  <div class="toolbar-separator"></div>

  <!-- LINES -->
  <div class="toolbar-section">
    <div class="toolbar-label">Lines</div>
    <button
      bind:this={linesButtonRef}
      class="tool-button"
      class:active={lineTools.some(t => t.id === activeTool)}
      on:click={toggleLinesFlyout}
      title="Click to choose line type"
    >
      <ToolIcon tool={currentLineTool.id} size={22} />
      <span class="tool-expand">
        <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor">
          <polygon points="0,0 6,0 3,5"/>
        </svg>
      </span>
    </button>
  </div>

  <div class="toolbar-separator"></div>

  <!-- DRAW -->
  <div class="toolbar-section">
    <div class="toolbar-label">Draw</div>
    {#each drawTools as tool}
      <button
        class="tool-button"
        class:active={activeTool === tool.id}
        on:click={() => selectTool(tool.id)}
        title="{tool.label}{tool.shortcut ? ` (${tool.shortcut})` : ''}"
      >
        <ToolIcon tool={tool.id} size={22} />
      </button>
    {/each}
  </div>

  <div class="toolbar-separator"></div>

  <!-- VIEW -->
  <div class="toolbar-section">
    <div class="toolbar-label">View</div>
    {#each viewTools as tool}
      <button
        class="tool-button"
        class:active={activeTool === tool.id}
        on:click={() => selectTool(tool.id)}
        title="{tool.label}{tool.shortcut ? ` (${tool.shortcut})` : ''}"
      >
        <ToolIcon tool={tool.id} size={22} />
      </button>
    {/each}
  </div>
</div>

<!-- Flyout menus -->
<ToolFlyout
  visible={shapesFlyoutVisible}
  tools={shapeTools}
  {activeTool}
  onSelectTool={selectTool}
  position={flyoutPosition}
/>

<ToolFlyout
  visible={linesFlyoutVisible}
  tools={lineTools}
  {activeTool}
  onSelectTool={selectTool}
  position={flyoutPosition}
/>

<style>
  .toolbar {
    width: 56px;
    background: #fff;
    border-right: 1px solid #e2e2e2;
    padding: 10px 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
    box-shadow: 1px 0 4px rgba(0, 0, 0, 0.04);
    flex-shrink: 0;
  }

  .toolbar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .toolbar-label {
    font-size: 9px;
    color: #aaa;
    text-transform: uppercase;
    padding: 6px 0 2px;
    letter-spacing: 0.5px;
    font-weight: 600;
    text-align: center;
    user-select: none;
  }

  .toolbar-separator {
    height: 1px;
    background: linear-gradient(90deg, transparent, #e2e2e2, transparent);
    margin: 4px 6px;
  }

  .history-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    width: 100%;
    padding: 0 2px;
  }

  .icon-button {
    width: 100%;
    height: 32px;
    border-radius: 6px;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #555;
  }

  .icon-button:hover:not(:disabled) {
    background: #f0f0f0;
    color: #333;
  }

  .icon-button:active:not(:disabled) {
    background: #e4e4e4;
    transform: scale(0.95);
  }

  .icon-button:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .tool-button {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #555;
  }

  .tool-button:hover {
    background: #f0f0f0;
    color: #333;
  }

  .tool-button:active {
    transform: scale(0.95);
  }

  .tool-button.active {
    background: #e8f0fe;
    color: #1a73e8;
    box-shadow: inset 0 0 0 1.5px #1a73e8;
  }

  .tool-button.active:hover {
    background: #d4e4fd;
  }

  .tool-expand {
    position: absolute;
    bottom: 3px;
    right: 3px;
    color: inherit;
    opacity: 0.45;
    line-height: 0;
  }

  .tool-button.active .tool-expand {
    opacity: 0.7;
  }

  /* Custom scrollbar */
  .toolbar::-webkit-scrollbar {
    width: 4px;
  }

  .toolbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .toolbar::-webkit-scrollbar-thumb {
    background: #ddd;
    border-radius: 2px;
  }

  .toolbar::-webkit-scrollbar-thumb:hover {
    background: #ccc;
  }
</style>
