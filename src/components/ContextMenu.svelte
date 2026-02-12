<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { canvasStore, bringToFront, sendToBack, generateShapeId } from '$lib/state/canvasStore';
  import { historyManager, AddShapeCommand, DeleteShapesCommand, DeleteShapeCommand, BatchCommand } from '$lib/state/history';

  // Props
  export let x = 0;
  export let y = 0;
  export let visible = false;

  let menuElement: HTMLDivElement;

  // Reactive state
  $: selectedIds = $canvasStore.selectedIds;
  $: selectedCount = selectedIds.size;
  $: hasSelection = selectedCount > 0;
  $: canGroup = selectedCount >= 2;

  // Check if any selected shape is a group (for ungroup option)
  $: canUngroup = hasSelection && Array.from(selectedIds).some(id => {
    const shape = $canvasStore.shapes.get(id);
    return shape && (shape as any).isGroup;
  });

  /**
   * Close the menu
   */
  export function close() {
    visible = false;
  }

  /**
   * Handle copy action
   */
  function handleCopy() {
    if (selectedCount === 0) return;

    const selectedShapes = Array.from(selectedIds)
      .map(id => $canvasStore.shapes.get(id))
      .filter((shape): shape is any => shape !== undefined);

    try {
      sessionStorage.setItem('napkin-clipboard', JSON.stringify(selectedShapes));
      console.log(`Copied ${selectedShapes.length} shape(s)`);
    } catch (error) {
      console.error('Failed to copy shapes:', error);
    }

    close();
  }

  /**
   * Handle paste action
   */
  function handlePaste() {
    try {
      const clipboardData = sessionStorage.getItem('napkin-clipboard');
      if (!clipboardData) return;

      const shapes = JSON.parse(clipboardData);
      if (!Array.isArray(shapes) || shapes.length === 0) return;

      const commands = [];
      const newShapeIds = new Set<string>();

      // Create new shapes with offset and new IDs
      const offset = 20;
      for (const shape of shapes) {
        const newId = generateShapeId();
        const newShape = {
          ...shape,
          id: newId,
          x: shape.x + offset,
          y: shape.y + offset,
        };

        // Handle shapes with x2, y2 (lines and arrows)
        if ('x2' in shape && 'y2' in shape) {
          newShape.x2 = shape.x2 + offset;
          newShape.y2 = shape.y2 + offset;
        }

        commands.push(new AddShapeCommand(newShape));
        newShapeIds.add(newId);
      }

      // Execute as batch command
      if (commands.length > 0) {
        historyManager.execute(new BatchCommand(commands));

        // Select the pasted shapes
        canvasStore.update(s => ({
          ...s,
          selectedIds: newShapeIds,
        }));

        console.log(`Pasted ${commands.length} shape(s)`);
      }
    } catch (error) {
      console.error('Failed to paste shapes:', error);
    }

    close();
  }

  /**
   * Handle duplicate action
   */
  function handleDuplicate() {
    if (selectedCount === 0) return;

    const selectedShapes = Array.from(selectedIds)
      .map(id => $canvasStore.shapes.get(id))
      .filter((shape): shape is any => shape !== undefined);

    const commands = [];
    const newShapeIds = new Set<string>();

    // Create new shapes with offset and new IDs
    const offset = 20;
    for (const shape of selectedShapes) {
      const newId = generateShapeId();
      const newShape = {
        ...shape,
        id: newId,
        x: shape.x + offset,
        y: shape.y + offset,
      };

      // Handle shapes with x2, y2 (lines and arrows)
      if ('x2' in shape && 'y2' in shape) {
        newShape.x2 = shape.x2 + offset;
        newShape.y2 = shape.y2 + offset;
      }

      commands.push(new AddShapeCommand(newShape));
      newShapeIds.add(newId);
    }

    // Execute as batch command
    if (commands.length > 0) {
      historyManager.execute(new BatchCommand(commands));

      // Select the duplicated shapes
      canvasStore.update(s => ({
        ...s,
        selectedIds: newShapeIds,
      }));

      console.log(`Duplicated ${commands.length} shape(s)`);
    }

    close();
  }

  /**
   * Handle delete action
   */
  function handleDelete() {
    if (selectedCount === 0) return;

    const idsToDelete = Array.from(selectedIds);

    if (idsToDelete.length > 1) {
      historyManager.execute(new DeleteShapesCommand(idsToDelete));
    } else {
      historyManager.execute(new DeleteShapeCommand(idsToDelete[0]));
    }

    canvasStore.update(s => ({
      ...s,
      selectedIds: new Set(),
    }));

    close();
  }

  /**
   * Handle bring to front action
   */
  function handleBringToFront() {
    if (selectedCount === 0) return;

    // Bring all selected shapes to front (in their current relative order)
    for (const id of selectedIds) {
      bringToFront(id);
    }

    close();
  }

  /**
   * Handle send to back action
   */
  function handleSendToBack() {
    if (selectedCount === 0) return;

    // Send all selected shapes to back (in their current relative order)
    const idsArray = Array.from(selectedIds);
    for (let i = idsArray.length - 1; i >= 0; i--) {
      sendToBack(idsArray[i]);
    }

    close();
  }

  /**
   * Handle lock/unlock action
   */
  function handleToggleLock() {
    if (selectedCount === 0) return;

    // Toggle lock state for all selected shapes
    const updates = Array.from(selectedIds).map(id => {
      const shape = $canvasStore.shapes.get(id);
      const isLocked = shape && (shape as any).locked;
      return {
        id,
        changes: { locked: !isLocked }
      };
    });

    canvasStore.update(s => {
      const newShapes = new Map(s.shapes);
      const newShapesArray = s.shapesArray.map(shape => {
        const update = updates.find(u => u.id === shape.id);
        if (!update) return shape;

        const updated = { ...shape, ...update.changes };
        newShapes.set(shape.id, updated);
        return updated;
      });

      return {
        ...s,
        shapes: newShapes,
        shapesArray: newShapesArray
      };
    });

    close();
  }

  /**
   * Handle group action
   */
  function handleGroup() {
    if (selectedCount < 2) return;

    // Group functionality placeholder - would need to be implemented
    console.log('Group functionality not yet implemented');
    close();
  }

  /**
   * Handle ungroup action
   */
  function handleUngroup() {
    if (!canUngroup) return;

    // Ungroup functionality placeholder - would need to be implemented
    console.log('Ungroup functionality not yet implemented');
    close();
  }

  /**
   * Check if any selected shapes are locked
   */
  $: hasLockedShapes = hasSelection && Array.from(selectedIds).some(id => {
    const shape = $canvasStore.shapes.get(id);
    return shape && (shape as any).locked;
  });

  /**
   * Position menu within viewport bounds
   */
  function positionMenu() {
    if (!menuElement) return;

    const menuRect = menuElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    // Check if menu goes off right edge
    if (x + menuRect.width > viewportWidth) {
      adjustedX = viewportWidth - menuRect.width - 10;
    }

    // Check if menu goes off bottom edge
    if (y + menuRect.height > viewportHeight) {
      adjustedY = viewportHeight - menuRect.height - 10;
    }

    menuElement.style.left = `${adjustedX}px`;
    menuElement.style.top = `${adjustedY}px`;
  }

  /**
   * Handle click outside to close
   */
  function handleClickOutside(event: MouseEvent) {
    if (!visible) return;

    const target = event.target as HTMLElement;
    if (menuElement && !menuElement.contains(target)) {
      close();
    }
  }

  /**
   * Handle ESC key to close
   */
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && visible) {
      close();
    }
  }

  onMount(() => {
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('click', handleClickOutside);
    window.removeEventListener('keydown', handleKeyDown);
  });

  // Position menu when it becomes visible or position changes
  $: if (visible && menuElement) {
    setTimeout(positionMenu, 0);
  }
</script>

{#if visible}
  <div
    bind:this={menuElement}
    class="context-menu"
    style="left: {x}px; top: {y}px;"
    on:click|stopPropagation
  >
    <button
      class="menu-item"
      disabled={!hasSelection}
      on:click={handleCopy}
    >
      <span class="menu-item-label">Copy</span>
      <span class="menu-item-shortcut">Ctrl+C</span>
    </button>

    <button
      class="menu-item"
      on:click={handlePaste}
    >
      <span class="menu-item-label">Paste</span>
      <span class="menu-item-shortcut">Ctrl+V</span>
    </button>

    <button
      class="menu-item"
      disabled={!hasSelection}
      on:click={handleDuplicate}
    >
      <span class="menu-item-label">Duplicate</span>
      <span class="menu-item-shortcut">Ctrl+D</span>
    </button>

    <button
      class="menu-item"
      disabled={!hasSelection}
      on:click={handleDelete}
    >
      <span class="menu-item-label">Delete</span>
      <span class="menu-item-shortcut">Del</span>
    </button>

    <div class="menu-divider"></div>

    <button
      class="menu-item"
      disabled={!hasSelection}
      on:click={handleBringToFront}
    >
      <span class="menu-item-label">Bring to Front</span>
      <span class="menu-item-shortcut">Ctrl+]</span>
    </button>

    <button
      class="menu-item"
      disabled={!hasSelection}
      on:click={handleSendToBack}
    >
      <span class="menu-item-label">Send to Back</span>
      <span class="menu-item-shortcut">Ctrl+[</span>
    </button>

    <div class="menu-divider"></div>

    <button
      class="menu-item"
      disabled={!hasSelection}
      on:click={handleToggleLock}
    >
      <span class="menu-item-label">
        {hasLockedShapes ? 'Unlock' : 'Lock'}
      </span>
    </button>

    <button
      class="menu-item"
      disabled={!canGroup}
      on:click={handleGroup}
    >
      <span class="menu-item-label">Group</span>
      <span class="menu-item-shortcut">Ctrl+G</span>
    </button>

    <button
      class="menu-item"
      disabled={!canUngroup}
      on:click={handleUngroup}
    >
      <span class="menu-item-label">Ungroup</span>
      <span class="menu-item-shortcut">Ctrl+Shift+G</span>
    </button>
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    min-width: 200px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    padding: 4px 0;
  }

  .menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 16px;
    background-color: transparent;
    border: none;
    cursor: pointer;
    font-size: 14px;
    color: #333;
    text-align: left;
    transition: background-color 0.2s ease;
  }

  .menu-item:hover:not(:disabled) {
    background-color: #f5f5f5;
  }

  .menu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .menu-item-label {
    flex: 1;
  }

  .menu-item-shortcut {
    font-size: 12px;
    color: #999;
    font-family: monospace;
    margin-left: 16px;
  }

  .menu-divider {
    height: 1px;
    background-color: #ddd;
    margin: 4px 0;
  }
</style>
