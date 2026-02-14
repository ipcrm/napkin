<script lang="ts">
  import { colorsStore, addRecentColor } from '$lib/state/colorsStore';

  export let value: string = '#000000';
  export let label: string = 'Color';
  export let disabled: boolean = false;
  export let allowTransparent: boolean = false;
  export let onColorChange: (color: string) => void = () => {};

  $: isTransparent = value === 'transparent';
  $: displayValue = isTransparent ? '#ffffff' : value;

  function handleColorInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const color = target.value;
    value = color;
    onColorChange(color);
    addRecentColor(color);
  }

  function handleColorClick() {
    // If currently transparent, auto-clear so the user can pick a color directly
    if (isTransparent && allowTransparent) {
      value = '#ffffff';
      onColorChange('#ffffff');
    }
  }

  function toggleTransparent() {
    if (!allowTransparent) return;
    const newColor = isTransparent ? '#ffffff' : 'transparent';
    value = newColor;
    onColorChange(newColor);
    if (newColor !== 'transparent') {
      addRecentColor(newColor);
    }
  }
</script>

<div class="color-picker">
  <span class="label">{label}</span>
  <div class="color-input-group">
    <input
      type="color"
      value={displayValue}
      on:input={handleColorInput}
      on:click={handleColorClick}
      {disabled}
      class="color-input"
    />
    <span class="color-value">{value}</span>
    {#if allowTransparent}
      <button
        class="transparent-button"
        class:active={isTransparent}
        on:click={toggleTransparent}
        title="Toggle transparent"
        {disabled}
      >
        {isTransparent ? '⊘' : '■'}
      </button>
    {/if}
  </div>
</div>

<style>
  .color-picker {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    font-size: 13px;
    font-weight: 500;
    color: #444;
  }

  .color-input-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-input {
    width: 48px;
    height: 32px;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    padding: 2px;
    transition: all 0.2s ease;
  }

  .color-input:hover:not(:disabled) {
    border-color: #999;
  }

  .color-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .color-value {
    font-size: 12px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    color: #666;
    flex: 1;
  }

  .transparent-button {
    width: 32px;
    height: 32px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background-color: #fff;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .transparent-button:hover:not(:disabled) {
    background-color: #f0f0f0;
    border-color: #999;
  }

  .transparent-button.active {
    background-color: #2196f3;
    color: white;
    border-color: #2196f3;
  }

  .transparent-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
