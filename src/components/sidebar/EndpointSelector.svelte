<script lang="ts">
  import type { EndpointShapeType, EndpointConfig } from '$lib/types';

  export let startEndpoint: EndpointConfig = { shape: 'none', size: 1 };
  export let endEndpoint: EndpointConfig = { shape: 'none', size: 1 };
  export let disabled: boolean = false;
  export let onStartChange: (config: EndpointConfig) => void = () => {};
  export let onEndChange: (config: EndpointConfig) => void = () => {};

  const endpointShapes: Array<{ value: EndpointShapeType; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'arrow', label: 'Arrow' },
    { value: 'open-arrow', label: 'Open' },
    { value: 'triangle', label: 'Triangle' },
    { value: 'circle', label: 'Circle' },
    { value: 'diamond', label: 'Diamond' },
    { value: 'square', label: 'Square' },
  ];

  function handleStartShapeChange(shape: EndpointShapeType) {
    if (disabled) return;
    const newConfig = { ...startEndpoint, shape };
    startEndpoint = newConfig;
    onStartChange(newConfig);
  }

  function handleEndShapeChange(shape: EndpointShapeType) {
    if (disabled) return;
    const newConfig = { ...endEndpoint, shape };
    endEndpoint = newConfig;
    onEndChange(newConfig);
  }

  function handleStartSizeChange(event: Event) {
    if (disabled) return;
    const target = event.target as HTMLInputElement;
    const size = parseFloat(target.value);
    if (!isNaN(size)) {
      const newConfig = { ...startEndpoint, size };
      startEndpoint = newConfig;
      onStartChange(newConfig);
    }
  }

  function handleEndSizeChange(event: Event) {
    if (disabled) return;
    const target = event.target as HTMLInputElement;
    const size = parseFloat(target.value);
    if (!isNaN(size)) {
      const newConfig = { ...endEndpoint, size };
      endEndpoint = newConfig;
      onEndChange(newConfig);
    }
  }
</script>

<div class="endpoint-selector">
  <!-- Start Endpoint -->
  <div class="endpoint-group">
    <label class="label">Start Endpoint</label>
    <div class="shape-buttons">
      {#each endpointShapes as ep}
        <button
          class="shape-button"
          class:active={startEndpoint.shape === ep.value}
          on:click={() => handleStartShapeChange(ep.value)}
          title={ep.label}
          {disabled}
        >
          <svg width="24" height="16" viewBox="0 0 24 16">
            {#if ep.value === 'none'}
              <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            {:else if ep.value === 'arrow'}
              <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <polygon points="4,8 10,4 10,12" fill="currentColor" />
            {:else if ep.value === 'open-arrow'}
              <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <polyline points="10,4 4,8 10,12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            {:else if ep.value === 'triangle'}
              <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <polygon points="4,8 10,4 10,12" fill="currentColor" stroke="currentColor" stroke-width="1" />
            {:else if ep.value === 'circle'}
              <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <circle cx="7" cy="8" r="3" fill="currentColor" stroke="currentColor" stroke-width="1" />
            {:else if ep.value === 'diamond'}
              <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <polygon points="4,8 8,5 12,8 8,11" fill="currentColor" stroke="currentColor" stroke-width="1" />
            {:else if ep.value === 'square'}
              <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <rect x="4" y="5" width="6" height="6" fill="currentColor" stroke="currentColor" stroke-width="1" />
            {/if}
          </svg>
        </button>
      {/each}
    </div>
  </div>

  <!-- End Endpoint -->
  <div class="endpoint-group">
    <label class="label">End Endpoint</label>
    <div class="shape-buttons">
      {#each endpointShapes as ep}
        <button
          class="shape-button"
          class:active={endEndpoint.shape === ep.value}
          on:click={() => handleEndShapeChange(ep.value)}
          title={ep.label}
          {disabled}
        >
          <svg width="24" height="16" viewBox="0 0 24 16">
            {#if ep.value === 'none'}
              <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            {:else if ep.value === 'arrow'}
              <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <polygon points="20,8 14,4 14,12" fill="currentColor" />
            {:else if ep.value === 'open-arrow'}
              <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <polyline points="14,4 20,8 14,12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            {:else if ep.value === 'triangle'}
              <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <polygon points="20,8 14,4 14,12" fill="currentColor" stroke="currentColor" stroke-width="1" />
            {:else if ep.value === 'circle'}
              <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <circle cx="17" cy="8" r="3" fill="currentColor" stroke="currentColor" stroke-width="1" />
            {:else if ep.value === 'diamond'}
              <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <polygon points="20,8 16,5 12,8 16,11" fill="currentColor" stroke="currentColor" stroke-width="1" />
            {:else if ep.value === 'square'}
              <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <rect x="14" y="5" width="6" height="6" fill="currentColor" stroke="currentColor" stroke-width="1" />
            {/if}
          </svg>
        </button>
      {/each}
    </div>
  </div>

  <!-- Endpoint Size -->
  <div class="endpoint-group">
    <label class="label">Endpoint Size</label>
    <div class="size-controls">
      <div class="size-row">
        <span class="size-label">Start</span>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={startEndpoint.size}
          on:input={handleStartSizeChange}
          class="size-slider"
          {disabled}
        />
        <span class="size-value">{startEndpoint.size.toFixed(1)}</span>
      </div>
      <div class="size-row">
        <span class="size-label">End</span>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={endEndpoint.size}
          on:input={handleEndSizeChange}
          class="size-slider"
          {disabled}
        />
        <span class="size-value">{endEndpoint.size.toFixed(1)}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .endpoint-selector {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .endpoint-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    font-size: 12px;
    font-weight: 500;
    color: #666;
  }

  .shape-buttons {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
  }

  .shape-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 2px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #555;
    min-height: 28px;
  }

  .shape-button:hover:not(:disabled) {
    background-color: #f0f0f0;
    border-color: #999;
    color: #333;
  }

  .shape-button.active {
    background-color: #2196f3;
    color: white;
    border-color: #2196f3;
  }

  .shape-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .size-controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .size-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .size-label {
    font-size: 11px;
    font-weight: 500;
    color: #888;
    min-width: 30px;
  }

  .size-slider {
    flex: 1;
    height: 4px;
    appearance: none;
    -webkit-appearance: none;
    background: #ddd;
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .size-slider::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #2196f3;
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .size-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #2196f3;
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .size-slider:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .size-value {
    font-size: 11px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    color: #666;
    min-width: 24px;
    text-align: right;
  }
</style>
