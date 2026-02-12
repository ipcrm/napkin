<script lang="ts">
  import {
    alignLeft,
    alignRight,
    alignTop,
    alignBottom,
    alignCenterHorizontal,
    alignCenterVertical,
    distributeHorizontally,
    distributeVertically
  } from '$lib/utils/alignment';

  export let shapes: any[] = [];
  export let onAlign: (updates: any[]) => void = () => {};

  $: canAlign = shapes.length >= 2;
  $: canDistribute = shapes.length >= 3;

  function handleAlign(alignFn: typeof alignLeft) {
    if (!canAlign) return;
    const updates = alignFn(shapes);
    if (updates.length > 0) {
      onAlign(updates);
    }
  }

  function handleDistribute(distributeFn: typeof distributeHorizontally) {
    if (!canDistribute) return;
    const updates = distributeFn(shapes);
    if (updates.length > 0) {
      onAlign(updates);
    }
  }
</script>

<div class="alignment-buttons">
  <div class="button-section">
    <span class="section-label">Align</span>
    <div class="button-grid">
      <button
        class="align-button"
        on:click={() => handleAlign(alignLeft)}
        title="Align Left"
        disabled={!canAlign}
      >
        <svg width="20" height="20" viewBox="0 0 20 20">
          <line x1="2" y1="2" x2="2" y2="18" stroke="currentColor" stroke-width="2"/>
          <rect x="5" y="4" width="8" height="3" fill="currentColor"/>
          <rect x="5" y="9" width="12" height="3" fill="currentColor"/>
          <rect x="5" y="14" width="6" height="3" fill="currentColor"/>
        </svg>
      </button>

      <button
        class="align-button"
        on:click={() => handleAlign(alignCenterHorizontal)}
        title="Center Horizontal"
        disabled={!canAlign}
      >
        <svg width="20" height="20" viewBox="0 0 20 20">
          <line x1="10" y1="2" x2="10" y2="18" stroke="currentColor" stroke-width="2"/>
          <rect x="6" y="4" width="8" height="3" fill="currentColor"/>
          <rect x="4" y="9" width="12" height="3" fill="currentColor"/>
          <rect x="7" y="14" width="6" height="3" fill="currentColor"/>
        </svg>
      </button>

      <button
        class="align-button"
        on:click={() => handleAlign(alignRight)}
        title="Align Right"
        disabled={!canAlign}
      >
        <svg width="20" height="20" viewBox="0 0 20 20">
          <line x1="18" y1="2" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
          <rect x="7" y="4" width="8" height="3" fill="currentColor"/>
          <rect x="3" y="9" width="12" height="3" fill="currentColor"/>
          <rect x="9" y="14" width="6" height="3" fill="currentColor"/>
        </svg>
      </button>

      <button
        class="align-button"
        on:click={() => handleAlign(alignTop)}
        title="Align Top"
        disabled={!canAlign}
      >
        <svg width="20" height="20" viewBox="0 0 20 20">
          <line x1="2" y1="2" x2="18" y2="2" stroke="currentColor" stroke-width="2"/>
          <rect x="4" y="5" width="3" height="8" fill="currentColor"/>
          <rect x="9" y="5" width="3" height="12" fill="currentColor"/>
          <rect x="14" y="5" width="3" height="6" fill="currentColor"/>
        </svg>
      </button>

      <button
        class="align-button"
        on:click={() => handleAlign(alignCenterVertical)}
        title="Center Vertical"
        disabled={!canAlign}
      >
        <svg width="20" height="20" viewBox="0 0 20 20">
          <line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="2"/>
          <rect x="4" y="6" width="3" height="8" fill="currentColor"/>
          <rect x="9" y="4" width="3" height="12" fill="currentColor"/>
          <rect x="14" y="7" width="3" height="6" fill="currentColor"/>
        </svg>
      </button>

      <button
        class="align-button"
        on:click={() => handleAlign(alignBottom)}
        title="Align Bottom"
        disabled={!canAlign}
      >
        <svg width="20" height="20" viewBox="0 0 20 20">
          <line x1="2" y1="18" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
          <rect x="4" y="7" width="3" height="8" fill="currentColor"/>
          <rect x="9" y="3" width="3" height="12" fill="currentColor"/>
          <rect x="14" y="9" width="3" height="6" fill="currentColor"/>
        </svg>
      </button>
    </div>
  </div>

  {#if canDistribute}
    <div class="button-section">
      <span class="section-label">Distribute</span>
      <div class="button-grid distribute">
        <button
          class="align-button"
          on:click={() => handleDistribute(distributeHorizontally)}
          title="Distribute Horizontally"
          disabled={!canDistribute}
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <rect x="2" y="7" width="3" height="6" fill="currentColor"/>
            <rect x="8.5" y="7" width="3" height="6" fill="currentColor"/>
            <rect x="15" y="7" width="3" height="6" fill="currentColor"/>
            <line x1="5" y1="10" x2="8.5" y2="10" stroke="currentColor" stroke-width="1" stroke-dasharray="1,1"/>
            <line x1="11.5" y1="10" x2="15" y2="10" stroke="currentColor" stroke-width="1" stroke-dasharray="1,1"/>
          </svg>
        </button>

        <button
          class="align-button"
          on:click={() => handleDistribute(distributeVertically)}
          title="Distribute Vertically"
          disabled={!canDistribute}
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <rect x="7" y="2" width="6" height="3" fill="currentColor"/>
            <rect x="7" y="8.5" width="6" height="3" fill="currentColor"/>
            <rect x="7" y="15" width="6" height="3" fill="currentColor"/>
            <line x1="10" y1="5" x2="10" y2="8.5" stroke="currentColor" stroke-width="1" stroke-dasharray="1,1"/>
            <line x1="10" y1="11.5" x2="10" y2="15" stroke="currentColor" stroke-width="1" stroke-dasharray="1,1"/>
          </svg>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .alignment-buttons {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .button-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 12px;
    font-weight: 500;
    color: #666;
  }

  .button-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .button-grid.distribute {
    grid-template-columns: repeat(2, 1fr);
  }

  .align-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 40px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background-color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #333;
  }

  .align-button:hover:not(:disabled) {
    background-color: #f0f0f0;
    border-color: #999;
  }

  .align-button:active:not(:disabled) {
    background-color: #e0e0e0;
  }

  .align-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .align-button svg {
    display: block;
  }
</style>
