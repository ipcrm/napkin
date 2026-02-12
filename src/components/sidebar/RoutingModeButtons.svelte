<script lang="ts">
  import type { RoutingMode } from '$lib/types';

  export let value: RoutingMode = 'direct';
  export let disabled: boolean = false;
  export let onModeChange: (mode: RoutingMode) => void = () => {};

  const modes: Array<{ value: RoutingMode; label: string; icon: string }> = [
    { value: 'direct', label: 'Direct', icon: '' },
    { value: 'elbow', label: 'Elbow', icon: '' },
    { value: 'curved', label: 'Curved', icon: '' },
  ];

  function handleClick(mode: RoutingMode) {
    if (disabled) return;
    value = mode;
    onModeChange(mode);
  }
</script>

<div class="routing-mode-buttons">
  <label class="label">Line Routing</label>
  <div class="button-group">
    {#each modes as mode}
      <button
        class="mode-button"
        class:active={value === mode.value}
        on:click={() => handleClick(mode.value)}
        title={mode.label}
        {disabled}
      >
        <svg width="32" height="20" viewBox="0 0 32 20">
          {#if mode.value === 'direct'}
            <line x1="4" y1="16" x2="28" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          {:else if mode.value === 'elbow'}
            <polyline points="4,16 28,16 28,4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          {:else if mode.value === 'curved'}
            <path d="M 4 16 Q 16 -4 28 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          {/if}
        </svg>
        <span class="mode-label">{mode.label}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .routing-mode-buttons {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    font-size: 13px;
    font-weight: 500;
    color: #444;
  }

  .button-group {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .mode-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 4px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 11px;
    color: #333;
  }

  .mode-button:hover:not(:disabled) {
    background-color: #f0f0f0;
    border-color: #999;
  }

  .mode-button.active {
    background-color: #2196f3;
    color: white;
    border-color: #2196f3;
  }

  .mode-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .mode-label {
    font-weight: 500;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
</style>
