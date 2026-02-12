<script lang="ts">
  import {
    alignLeft,
    alignRight,
    alignTop,
    alignBottom,
    alignCenterHorizontal,
    alignCenterVertical,
  } from '$lib/utils/alignment';

  export let shapes: any[] = [];
  export let screenX: number = 0;
  export let screenY: number = 0;
  export let onAlign: (updates: any[]) => void = () => {};
  export let onGroup: () => void = () => {};
  export let onUngroup: () => void = () => {};
  export let onDelete: () => void = () => {};

  $: count = shapes.length;

  // Detect if all selected shapes share the same groupId (i.e. they are one group)
  $: isGrouped = shapes.length >= 2 && shapes.every(s => s.groupId && s.groupId === shapes[0].groupId);

  function handleAlign(alignFn: typeof alignLeft) {
    if (shapes.length < 2) return;
    const updates = alignFn(shapes);
    if (updates.length > 0) {
      onAlign(updates);
    }
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="multi-select-toolbar"
  style="left: {screenX}px; top: {screenY}px;"
  on:pointerdown|stopPropagation
  on:pointerup|stopPropagation
>
  <div class="toolbar-badge">{count} selected</div>

  <div class="toolbar-divider"></div>

  <button class="tb-btn" title="Align Left" on:click={() => handleAlign(alignLeft)}>
    <svg width="16" height="16" viewBox="0 0 20 20">
      <line x1="2" y1="2" x2="2" y2="18" stroke="currentColor" stroke-width="2"/>
      <rect x="5" y="4" width="8" height="3" fill="currentColor"/>
      <rect x="5" y="9" width="12" height="3" fill="currentColor"/>
      <rect x="5" y="14" width="6" height="3" fill="currentColor"/>
    </svg>
  </button>

  <button class="tb-btn" title="Center Horizontal" on:click={() => handleAlign(alignCenterHorizontal)}>
    <svg width="16" height="16" viewBox="0 0 20 20">
      <line x1="10" y1="2" x2="10" y2="18" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="4" width="8" height="3" fill="currentColor"/>
      <rect x="4" y="9" width="12" height="3" fill="currentColor"/>
      <rect x="7" y="14" width="6" height="3" fill="currentColor"/>
    </svg>
  </button>

  <button class="tb-btn" title="Align Right" on:click={() => handleAlign(alignRight)}>
    <svg width="16" height="16" viewBox="0 0 20 20">
      <line x1="18" y1="2" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
      <rect x="7" y="4" width="8" height="3" fill="currentColor"/>
      <rect x="3" y="9" width="12" height="3" fill="currentColor"/>
      <rect x="9" y="14" width="6" height="3" fill="currentColor"/>
    </svg>
  </button>

  <div class="toolbar-divider"></div>

  <button class="tb-btn" title="Align Top" on:click={() => handleAlign(alignTop)}>
    <svg width="16" height="16" viewBox="0 0 20 20">
      <line x1="2" y1="2" x2="18" y2="2" stroke="currentColor" stroke-width="2"/>
      <rect x="4" y="5" width="3" height="8" fill="currentColor"/>
      <rect x="9" y="5" width="3" height="12" fill="currentColor"/>
      <rect x="14" y="5" width="3" height="6" fill="currentColor"/>
    </svg>
  </button>

  <button class="tb-btn" title="Center Vertical" on:click={() => handleAlign(alignCenterVertical)}>
    <svg width="16" height="16" viewBox="0 0 20 20">
      <line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="2"/>
      <rect x="4" y="6" width="3" height="8" fill="currentColor"/>
      <rect x="9" y="4" width="3" height="12" fill="currentColor"/>
      <rect x="14" y="7" width="3" height="6" fill="currentColor"/>
    </svg>
  </button>

  <button class="tb-btn" title="Align Bottom" on:click={() => handleAlign(alignBottom)}>
    <svg width="16" height="16" viewBox="0 0 20 20">
      <line x1="2" y1="18" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
      <rect x="4" y="7" width="3" height="8" fill="currentColor"/>
      <rect x="9" y="3" width="3" height="12" fill="currentColor"/>
      <rect x="14" y="9" width="3" height="6" fill="currentColor"/>
    </svg>
  </button>

  <div class="toolbar-divider"></div>

  {#if isGrouped}
    <button class="tb-btn tb-btn--active" title="Ungroup" on:click={onUngroup}>
      <svg width="16" height="16" viewBox="0 0 20 20">
        <rect x="1" y="5" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="2 2"/>
        <rect x="9" y="1" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="2 2"/>
      </svg>
    </button>
  {:else}
    <button class="tb-btn" title="Group" on:click={onGroup}>
      <svg width="16" height="16" viewBox="0 0 20 20">
        <rect x="1" y="5" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <rect x="9" y="1" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="2 2"/>
      </svg>
    </button>
  {/if}

  <div class="toolbar-divider"></div>

  <button class="tb-btn tb-btn--danger" title="Delete selected" on:click={onDelete}>
    <svg width="16" height="16" viewBox="0 0 20 20">
      <path d="M6 2h8v2H6V2zM3 5h14v1H3V5zM5 7h10l-1 11H6L5 7z" fill="currentColor"/>
    </svg>
  </button>
</div>

<style>
  .multi-select-toolbar {
    position: fixed;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 6px;
    background: #fff;
    border: 1px solid #d0d0d0;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    z-index: 9998;
    pointer-events: auto;
    white-space: nowrap;
  }

  .toolbar-badge {
    font-size: 12px;
    font-weight: 600;
    color: #0066ff;
    padding: 2px 8px;
    background: #e8f0fe;
    border-radius: 4px;
    user-select: none;
  }

  .toolbar-divider {
    width: 1px;
    height: 20px;
    background: #e0e0e0;
    margin: 0 2px;
  }

  .tb-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #555;
    cursor: pointer;
    transition: all 0.12s ease;
    padding: 0;
  }

  .tb-btn:hover {
    background: #f0f0f0;
    color: #333;
  }

  .tb-btn:active {
    background: #e0e0e0;
  }

  .tb-btn--active {
    background: #e8f0fe;
    color: #1a73e8;
  }

  .tb-btn--active:hover {
    background: #d2e3fc;
    color: #1558b0;
  }

  .tb-btn--danger:hover {
    background: #fee;
    color: #c00;
  }
</style>
