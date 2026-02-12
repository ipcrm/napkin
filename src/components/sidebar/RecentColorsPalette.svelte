<script lang="ts">
  import { colorsStore, addRecentColor } from '$lib/state/colorsStore';

  export let onStrokeColor: (color: string) => void = () => {};
  export let onFillColor: (color: string) => void = () => {};
  export let currentStrokeColor: string = '#000000';
  export let currentFillColor: string = 'transparent';

  let mode: 'stroke' | 'fill' = 'stroke';

  $: recentColors = $colorsStore.recentColors;

  const defaultColors = [
    '#000000', '#343a40', '#495057', '#868e96',
    '#c92a2a', '#e67700', '#2b8a3e', '#1864ab',
    '#5f3dc4', '#d6336c', '#ffffff', '#fab005',
  ];

  function applyColor(color: string) {
    if (mode === 'stroke') {
      onStrokeColor(color);
    } else {
      onFillColor(color);
    }
    addRecentColor(color);
  }

  $: fillPreview = currentFillColor === 'transparent' ? 'none' : currentFillColor;
</script>

<div class="recent-colors-palette">
  <!-- Mode selector -->
  <div class="mode-selector">
    <button
      class="mode-btn"
      class:active={mode === 'stroke'}
      on:click={() => mode = 'stroke'}
      title="Apply colors to stroke & text"
    >
      <span
        class="color-preview"
        style="background-color: {currentStrokeColor};"
      ></span>
      <span class="mode-label">Stroke</span>
    </button>
    <button
      class="mode-btn"
      class:active={mode === 'fill'}
      on:click={() => mode = 'fill'}
      title="Apply colors to fill"
    >
      <span
        class="color-preview {currentFillColor === 'transparent' ? 'transparent-preview' : ''}"
        style="background-color: {fillPreview};"
      ></span>
      <span class="mode-label">Fill</span>
    </button>
  </div>

  <!-- Color swatches -->
  <div class="color-grid">
    {#each defaultColors as color}
      <button
        class="color-swatch"
        style="background-color: {color};{color === '#ffffff' ? ' border-color: #ccc;' : ''}"
        title={color}
        on:click={() => applyColor(color)}
      >
      </button>
    {/each}
  </div>

  {#if recentColors.length > 0}
    <span class="label">Recent</span>
    <div class="color-grid">
      {#each recentColors as color}
        <button
          class="color-swatch"
          style="background-color: {color};"
          title={color}
          on:click={() => applyColor(color)}
        >
        </button>
      {/each}
    </div>
  {/if}

  {#if mode === 'fill'}
    <button class="transparent-btn" on:click={() => applyColor('transparent')}>
      Set Transparent
    </button>
  {/if}
</div>

<style>
  .recent-colors-palette {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .mode-selector {
    display: flex;
    gap: 4px;
    background: #e8e8e8;
    border-radius: 8px;
    padding: 3px;
  }

  .mode-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #666;
    font-size: 12px;
    font-weight: 500;
  }

  .mode-btn:hover {
    background: rgba(255, 255, 255, 0.5);
    color: #333;
  }

  .mode-btn.active {
    background: #fff;
    color: #1a73e8;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .color-preview {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1.5px solid #ccc;
    flex-shrink: 0;
  }

  .color-preview.transparent-preview {
    background: repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 8px 8px !important;
  }

  .mode-label {
    line-height: 1;
  }

  .label {
    font-size: 12px;
    font-weight: 500;
    color: #666;
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
  }

  .color-swatch {
    width: 100%;
    aspect-ratio: 1;
    border: 2px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0;
  }

  .color-swatch:hover {
    border-color: #2196f3;
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .transparent-btn {
    width: 100%;
    padding: 6px;
    border: 1px dashed #ccc;
    border-radius: 6px;
    background: repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 10px 10px;
    cursor: pointer;
    font-size: 11px;
    color: #666;
    transition: all 0.15s ease;
  }

  .transparent-btn:hover {
    border-color: #999;
    color: #333;
  }
</style>
