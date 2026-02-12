<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { bringToFront, sendToBack, bringForward, sendBackward } from '$lib/state/canvasStore';

  export let shapes: any[] = [];

  $: hasSelection = shapes.length > 0;

  function handleBringToFront() {
    if (!hasSelection) return;
    shapes.forEach(shape => bringToFront(shape.id));
  }

  function handleBringForward() {
    if (!hasSelection) return;
    [...shapes].reverse().forEach(shape => bringForward(shape.id));
  }

  function handleSendBackward() {
    if (!hasSelection) return;
    shapes.forEach(shape => sendBackward(shape.id));
  }

  function handleSendToBack() {
    if (!hasSelection) return;
    [...shapes].reverse().forEach(shape => sendToBack(shape.id));
  }

  // Keyboard shortcuts
  function handleKeyDown(event: KeyboardEvent) {
    if (!hasSelection) return;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? event.metaKey : event.ctrlKey;

    if (modKey && event.key === ']') {
      event.preventDefault();
      handleBringForward();
    } else if (modKey && event.key === '[') {
      event.preventDefault();
      handleSendBackward();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
</script>

<div class="zorder-buttons">
  <label class="label">Layer Order</label>
  <div class="button-group">
    <button
      class="zorder-button"
      on:click={handleBringToFront}
      title="Bring to Front"
      disabled={!hasSelection}
    >
      <svg width="20" height="20" viewBox="0 0 20 20">
        <rect x="3" y="6" width="10" height="10" fill="none" stroke="#999" stroke-width="1"/>
        <rect x="7" y="3" width="10" height="10" fill="white" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      <span>Front</span>
    </button>

    <button
      class="zorder-button"
      on:click={handleBringForward}
      title="Bring Forward (Ctrl/Cmd + ])"
      disabled={!hasSelection}
    >
      <svg width="20" height="20" viewBox="0 0 20 20">
        <rect x="4" y="7" width="9" height="9" fill="none" stroke="#999" stroke-width="1"/>
        <rect x="7" y="4" width="9" height="9" fill="white" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      <span>Forward</span>
    </button>

    <button
      class="zorder-button"
      on:click={handleSendBackward}
      title="Send Backward (Ctrl/Cmd + [)"
      disabled={!hasSelection}
    >
      <svg width="20" height="20" viewBox="0 0 20 20">
        <rect x="7" y="4" width="9" height="9" fill="white" stroke="#999" stroke-width="1"/>
        <rect x="4" y="7" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      <span>Backward</span>
    </button>

    <button
      class="zorder-button"
      on:click={handleSendToBack}
      title="Send to Back"
      disabled={!hasSelection}
    >
      <svg width="20" height="20" viewBox="0 0 20 20">
        <rect x="7" y="3" width="10" height="10" fill="white" stroke="#999" stroke-width="1"/>
        <rect x="3" y="6" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      <span>Back</span>
    </button>
  </div>
</div>

<style>
  .zorder-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .label {
    font-size: 13px;
    font-weight: 500;
    color: #444;
  }

  .button-group {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .zorder-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background-color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #333;
    font-size: 12px;
  }

  .zorder-button:hover:not(:disabled) {
    background-color: #f0f0f0;
    border-color: #999;
  }

  .zorder-button:active:not(:disabled) {
    background-color: #e0e0e0;
  }

  .zorder-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .zorder-button svg {
    display: block;
  }

  .zorder-button span {
    font-weight: 500;
  }
</style>
