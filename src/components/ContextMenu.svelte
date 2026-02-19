<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { canvasStore, bringToFront, sendToBack, generateShapeId, groupShapes, ungroupShapes, updateShapes } from '$lib/state/canvasStore';
  import { historyManager, AddShapeCommand, DeleteShapesCommand, DeleteShapeCommand, BatchCommand, GroupShapesCommand, UngroupShapesCommand, SnapshotModifyCommand } from '$lib/state/history';
  import { gridLayout, forceDirectedLayout } from '$lib/utils/layout';
  import { syncAllArrowBindings } from '$lib/utils/binding';
  import type { Shape } from '$lib/types';

  // Props
  export let x = 0;
  export let y = 0;
  export let visible = false;

  let menuElement: HTMLDivElement;

  // Detect macOS for OS-specific modifier key labels
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const mod = isMac ? '⌘' : 'Ctrl';

  // Reactive state
  $: selectedIds = $canvasStore.selectedIds;
  $: selectedCount = selectedIds.size;
  $: hasSelection = selectedCount > 0;
  $: canGroup = selectedCount >= 2;

  // Check if any selected shape belongs to a group (for ungroup option)
  $: canUngroup = hasSelection && Array.from(selectedIds).some(id => {
    const shape = $canvasStore.shapes.get(id);
    return shape && shape.groupId;
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

    const unlocked = Array.from(selectedIds).filter(id => {
      const shape = $canvasStore.shapes.get(id);
      return shape && !shape.locked;
    });

    if (unlocked.length < 2) return;

    try {
      historyManager.execute(new GroupShapesCommand(unlocked));
    } catch (error) {
      console.error('Failed to group shapes:', error);
    }
    close();
  }

  /**
   * Handle ungroup action
   */
  function handleUngroup() {
    if (!canUngroup) return;

    // Find all unique group IDs in selection
    const groupIds = new Set<string>();
    for (const id of selectedIds) {
      const shape = $canvasStore.shapes.get(id);
      if (shape && shape.groupId) {
        groupIds.add(shape.groupId);
      }
    }

    if (groupIds.size === 0) return;

    try {
      const commands = Array.from(groupIds).map(gid => new UngroupShapesCommand(gid));
      if (commands.length === 1) {
        historyManager.execute(commands[0]);
      } else {
        historyManager.execute(new BatchCommand(commands));
      }
    } catch (error) {
      console.error('Failed to ungroup shapes:', error);
    }
    close();
  }

  // Reorganize submenu state
  let showReorganizeSubmenu = false;

  /**
   * Handle grid layout reorganize
   */
  function handleGridLayout() {
    if (selectedCount === 0) return;

    const selectedShapes = Array.from(selectedIds)
      .map(id => $canvasStore.shapes.get(id))
      .filter((shape): shape is Shape => shape !== undefined);

    const changes = gridLayout(selectedShapes);
    if (changes.length === 0) { close(); return; }

    // Build undo commands
    const commands = changes.map(change => {
      const shape = $canvasStore.shapes.get(change.id);
      if (!shape) return null;
      const oldProps: Partial<Shape> = {};
      for (const key of Object.keys(change.changes) as (keyof Shape)[]) {
        (oldProps as any)[key] = (shape as any)[key];
      }
      return new SnapshotModifyCommand(change.id, oldProps, change.changes as Partial<Shape>);
    }).filter((cmd): cmd is SnapshotModifyCommand => cmd !== null);

    if (commands.length > 0) {
      historyManager.execute(commands.length === 1 ? commands[0] : new BatchCommand(commands));
    }

    // Sync bound arrows
    const allShapes = $canvasStore.shapesArray;
    const arrowUpdates = syncAllArrowBindings(allShapes);
    if (arrowUpdates.size > 0) {
      updateShapes(Array.from(arrowUpdates.entries()).map(([id, changes]) => ({ id, changes: changes as Partial<Shape> })));
    }

    close();
  }

  /**
   * Handle force-directed layout reorganize
   */
  function handleForceLayout() {
    if (selectedCount === 0) return;

    const selectedShapes = Array.from(selectedIds)
      .map(id => $canvasStore.shapes.get(id))
      .filter((shape): shape is Shape => shape !== undefined);

    // Find connections from bound arrows among selected shapes
    const connections: Array<{ fromId: string; toId: string }> = [];
    for (const shape of selectedShapes) {
      if (shape.type === 'arrow' || shape.type === 'line') {
        const arrow = shape as any;
        if (arrow.bindStart?.shapeId && arrow.bindEnd?.shapeId) {
          connections.push({ fromId: arrow.bindStart.shapeId, toId: arrow.bindEnd.shapeId });
        }
      }
    }

    const changes = forceDirectedLayout(selectedShapes, connections);
    if (changes.length === 0) { close(); return; }

    const commands = changes.map(change => {
      const shape = $canvasStore.shapes.get(change.id);
      if (!shape) return null;
      const oldProps: Partial<Shape> = {};
      for (const key of Object.keys(change.changes) as (keyof Shape)[]) {
        (oldProps as any)[key] = (shape as any)[key];
      }
      return new SnapshotModifyCommand(change.id, oldProps, change.changes as Partial<Shape>);
    }).filter((cmd): cmd is SnapshotModifyCommand => cmd !== null);

    if (commands.length > 0) {
      historyManager.execute(commands.length === 1 ? commands[0] : new BatchCommand(commands));
    }

    // Sync bound arrows
    const allShapes = $canvasStore.shapesArray;
    const arrowUpdates = syncAllArrowBindings(allShapes);
    if (arrowUpdates.size > 0) {
      updateShapes(Array.from(arrowUpdates.entries()).map(([id, changes]) => ({ id, changes: changes as Partial<Shape> })));
    }

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
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
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
      <span class="menu-item-shortcut">{mod}+C</span>
    </button>

    <button
      class="menu-item"
      on:click={handlePaste}
    >
      <span class="menu-item-label">Paste</span>
      <span class="menu-item-shortcut">{mod}+V</span>
    </button>

    <button
      class="menu-item"
      disabled={!hasSelection}
      on:click={handleDuplicate}
    >
      <span class="menu-item-label">Duplicate</span>
      <span class="menu-item-shortcut">{mod}+D</span>
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
      <span class="menu-item-shortcut">{mod}+]</span>
    </button>

    <button
      class="menu-item"
      disabled={!hasSelection}
      on:click={handleSendToBack}
    >
      <span class="menu-item-label">Send to Back</span>
      <span class="menu-item-shortcut">{mod}+[</span>
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
      <span class="menu-item-shortcut">{mod}+G</span>
    </button>

    <button
      class="menu-item"
      disabled={!canUngroup}
      on:click={handleUngroup}
    >
      <span class="menu-item-label">Ungroup</span>
      <span class="menu-item-shortcut">{mod}+Shift+G</span>
    </button>

    {#if hasSelection}
      <div class="menu-divider"></div>

      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        class="menu-item submenu-parent"
        on:mouseenter={() => showReorganizeSubmenu = true}
        on:mouseleave={() => showReorganizeSubmenu = false}
      >
        <span class="menu-item-label">Reorganize</span>
        <span class="menu-item-arrow">▸</span>

        {#if showReorganizeSubmenu}
          <div class="submenu">
            <button class="menu-item" on:click={handleGridLayout}>
              <span class="menu-item-label">Grid Layout</span>
            </button>
            <button class="menu-item" on:click={handleForceLayout}>
              <span class="menu-item-label">Force-directed Layout</span>
            </button>
          </div>
        {/if}
      </div>
    {/if}
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

  .submenu-parent {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .submenu-parent:hover {
    background-color: #f5f5f5;
  }

  .menu-item-arrow {
    font-size: 12px;
    color: #999;
    margin-left: 8px;
  }

  .submenu {
    position: absolute;
    left: 100%;
    top: -4px;
    min-width: 180px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 4px 0;
    z-index: 10001;
  }
</style>
