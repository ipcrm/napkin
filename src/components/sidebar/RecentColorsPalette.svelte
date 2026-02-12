<script lang="ts">
  import { colorsStore } from '$lib/state/colorsStore';

  export let onStrokeColor: (color: string) => void = () => {};
  export let onFillColor: (color: string) => void = () => {};

  $: recentColors = $colorsStore.recentColors;

  const defaultColors = [
    '#000000', '#343a40', '#495057', '#868e96',
    '#c92a2a', '#e67700', '#2b8a3e', '#1864ab',
    '#5f3dc4', '#d6336c', '#ffffff', '#fab005',
  ];
</script>

<div class="recent-colors-palette">
  <label class="label">Palette</label>
  <div class="color-grid">
    {#each defaultColors as color}
      <button
        class="color-swatch"
        style="background-color: {color};{color === '#ffffff' ? ' border-color: #ccc;' : ''}"
        title="{color}\nClick: stroke | Right-click: fill"
        on:click={() => onStrokeColor(color)}
        on:contextmenu|preventDefault={() => onFillColor(color)}
      >
      </button>
    {/each}
  </div>

  {#if recentColors.length > 0}
    <label class="label recent-label">Recent</label>
    <div class="color-grid">
      {#each recentColors as color}
        <button
          class="color-swatch"
          style="background-color: {color};"
          title="{color}\nClick: stroke | Right-click: fill"
          on:click={() => onStrokeColor(color)}
          on:contextmenu|preventDefault={() => onFillColor(color)}
        >
        </button>
      {/each}
    </div>
  {/if}

  <p class="hint">Click: stroke | Right-click: fill</p>
</div>

<style>
  .recent-colors-palette {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .label {
    font-size: 13px;
    font-weight: 500;
    color: #444;
  }

  .recent-label {
    margin-top: 8px;
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
    transition: all 0.2s ease;
    padding: 0;
  }

  .color-swatch:hover {
    border-color: #2196f3;
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .hint {
    font-size: 10px;
    color: #999;
    text-align: center;
    margin: 0;
  }
</style>
