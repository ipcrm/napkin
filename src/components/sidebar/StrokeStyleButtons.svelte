<script lang="ts">
  import type { StrokeStyle } from '$lib/types';

  export let value: StrokeStyle = 'solid';
  export let disabled: boolean = false;
  export let onStyleChange: (style: StrokeStyle) => void = () => {};

  interface StyleOption {
    value: StrokeStyle;
    label: string;
    dasharray: string;
  }

  const styles: StyleOption[] = [
    { value: 'solid', label: 'Solid', dasharray: '' },
    { value: 'dashed', label: 'Dashed', dasharray: '6,4' },
    { value: 'dotted', label: 'Dotted', dasharray: '2,3' },
    { value: 'dashed-small', label: 'Dashed Small', dasharray: '4,3' },
    { value: 'dashed-large', label: 'Dashed Large', dasharray: '10,5' },
    { value: 'dash-dot', label: 'Dash Dot', dasharray: '8,3,2,3' },
    { value: 'dash-dot-dot', label: 'Dash Dot Dot', dasharray: '8,3,2,3,2,3' },
  ];

  function handleClick(style: StrokeStyle) {
    if (disabled) return;
    value = style;
    onStyleChange(style);
  }
</script>

<div class="stroke-style-buttons">
  <label class="label">Stroke Style</label>
  <div class="button-group">
    {#each styles as style}
      <button
        class="style-button"
        class:active={value === style.value}
        on:click={() => handleClick(style.value)}
        title={style.label}
        {disabled}
      >
        <svg width="100%" height="12" viewBox="0 0 60 12" preserveAspectRatio="none">
          <line
            x1="4"
            y1="6"
            x2="56"
            y2="6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-dasharray={style.dasharray}
          />
        </svg>
      </button>
    {/each}
  </div>
</div>

<style>
  .stroke-style-buttons {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    font-size: 12px;
    font-weight: 500;
    color: #666;
  }

  .button-group {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }

  .style-button {
    flex: 1;
    padding: 8px 6px;
    background-color: #fff;
    border: 1px solid #e2e2e2;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .style-button:hover:not(:disabled) {
    background-color: #f5f5f5;
    border-color: #ccc;
    color: #333;
  }

  .style-button:active:not(:disabled) {
    background-color: #ebebeb;
  }

  .style-button.active {
    background-color: #e8f0fe;
    color: #1a73e8;
    border-color: #1a73e8;
  }

  .style-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .style-button svg {
    display: block;
  }
</style>
