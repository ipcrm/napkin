<script lang="ts">
  import { layersStore, activeLayer, addLayer, removeLayer, renameLayer, toggleLayerVisibility, toggleLayerLock, setActiveLayer, reorderLayers } from '$lib/state/layersStore';
  import type { Layer } from '$lib/state/layersStore';

  let editingLayerId: string | null = null;
  let editingName: string = '';
  let draggedLayerId: string | null = null;

  function handleAddLayer() {
    addLayer();
  }

  function handleRemoveLayer(layerId: string) {
    if (confirm('Are you sure you want to delete this layer?')) {
      removeLayer(layerId);
    }
  }

  function startEditingName(layer: Layer) {
    editingLayerId = layer.id;
    editingName = layer.name;
  }

  function finishEditingName() {
    if (editingLayerId && editingName.trim()) {
      renameLayer(editingLayerId, editingName.trim());
    }
    editingLayerId = null;
    editingName = '';
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      finishEditingName();
    } else if (event.key === 'Escape') {
      editingLayerId = null;
      editingName = '';
    }
  }

  function handleDragStart(event: DragEvent, layerId: string) {
    draggedLayerId = layerId;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDrop(event: DragEvent, targetLayerId: string) {
    event.preventDefault();
    if (draggedLayerId && draggedLayerId !== targetLayerId) {
      const targetLayer = $layersStore.layers.get(targetLayerId);
      if (targetLayer) {
        reorderLayers(draggedLayerId, targetLayer.order);
      }
    }
    draggedLayerId = null;
  }
</script>

<div class="layers-panel">
  <div class="panel-header">
    <h3 class="panel-title">Layers</h3>
    <button class="add-button" on:click={handleAddLayer} title="Add Layer">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2V14M2 8H14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  </div>

  <div class="layers-list">
    {#each $layersStore.layersArray.slice().reverse() as layer (layer.id)}
      <div
        class="layer-item"
        class:active={$activeLayer?.id === layer.id}
        class:dragging={draggedLayerId === layer.id}
        draggable="true"
        on:dragstart={(e) => handleDragStart(e, layer.id)}
        on:dragover={handleDragOver}
        on:drop={(e) => handleDrop(e, layer.id)}
        on:click={() => setActiveLayer(layer.id)}
      >
        <div class="layer-controls">
          <button
            class="icon-button"
            class:active={layer.visible}
            on:click|stopPropagation={() => toggleLayerVisibility(layer.id)}
            title={layer.visible ? 'Hide Layer' : 'Show Layer'}
          >
            {#if layer.visible}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z" stroke="currentColor" stroke-width="1.5"/>
                <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
              </svg>
            {:else}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M1 1L15 15M4.5 4.5C3 5.5 1 8 1 8C1 8 3.5 13 8 13C9.5 13 10.8 12.3 11.5 11.5M7 3.5C7.3 3.4 7.6 3 8 3C12.5 3 15 8 15 8C15 8 14.5 9 13.5 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            {/if}
          </button>

          <button
            class="icon-button"
            class:active={layer.locked}
            on:click|stopPropagation={() => toggleLayerLock(layer.id)}
            title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
          >
            {#if layer.locked}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="4" y="7" width="8" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
                <path d="M5 7V5C5 3.3 6.3 2 8 2C9.7 2 11 3.3 11 5V7" stroke="currentColor" stroke-width="1.5"/>
              </svg>
            {:else}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="4" y="7" width="8" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
                <path d="M5 7V5C5 3.3 6.3 2 8 2C9.7 2 11 3.3 11 5V6" stroke="currentColor" stroke-width="1.5"/>
              </svg>
            {/if}
          </button>
        </div>

        <div class="layer-name">
          {#if editingLayerId === layer.id}
            <input
              type="text"
              class="name-input"
              bind:value={editingName}
              on:blur={finishEditingName}
              on:keydown={handleKeyDown}
              autofocus
            />
          {:else}
            <span on:dblclick={() => startEditingName(layer)}>
              {layer.name}
            </span>
          {/if}
          <span class="shape-count">({layer.shapeIds.length})</span>
        </div>

        {#if $layersStore.layers.size > 1}
          <button
            class="icon-button delete-button"
            on:click|stopPropagation={() => handleRemoveLayer(layer.id)}
            title="Delete Layer"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4H14M6 4V2H10V4M3 4L4 14H12L13 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .layers-panel {
    width: 240px;
    background-color: var(--color-surface, #ffffff);
    border-left: 1px solid var(--color-border, #ddd);
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid var(--color-border, #ddd);
  }

  .panel-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text, #333);
  }

  .add-button {
    background: var(--color-primary, #2196F3);
    color: white;
    border: none;
    border-radius: 4px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .add-button:hover {
    background: var(--color-primary-hover, #1976D2);
  }

  .layers-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .layer-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    margin-bottom: 4px;
    background: var(--color-background, #fff);
    border: 1px solid var(--color-border, #ddd);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .layer-item:hover {
    background: var(--color-surface-hover, #f5f5f5);
  }

  .layer-item.active {
    background: var(--color-primary, #2196F3);
    color: white;
    border-color: var(--color-primary, #2196F3);
  }

  .layer-item.dragging {
    opacity: 0.5;
  }

  .layer-controls {
    display: flex;
    gap: 4px;
  }

  .icon-button {
    background: transparent;
    border: none;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--color-text-secondary, #666);
    border-radius: 3px;
    transition: all 0.2s;
  }

  .icon-button:hover {
    background: var(--color-surface-hover, #f0f0f0);
  }

  .layer-item.active .icon-button {
    color: white;
  }

  .layer-item.active .icon-button:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .icon-button.active {
    color: var(--color-primary, #2196F3);
  }

  .layer-item.active .icon-button.active {
    color: white;
  }

  .layer-name {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    min-width: 0;
  }

  .layer-name span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .shape-count {
    font-size: 11px;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .name-input {
    flex: 1;
    background: var(--color-background, #fff);
    border: 1px solid var(--color-border, #ddd);
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 13px;
    color: var(--color-text, #333);
    outline: none;
  }

  .layer-item.active .name-input {
    background: white;
    color: #333;
  }

  .delete-button {
    color: #f44336;
  }

  .delete-button:hover {
    background: rgba(244, 67, 54, 0.1);
  }

  /* Scrollbar styling */
  .layers-list::-webkit-scrollbar {
    width: 8px;
  }

  .layers-list::-webkit-scrollbar-track {
    background: var(--color-background, #f0f0f0);
  }

  .layers-list::-webkit-scrollbar-thumb {
    background: var(--color-border, #ccc);
    border-radius: 4px;
  }

  .layers-list::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-secondary, #999);
  }
</style>
