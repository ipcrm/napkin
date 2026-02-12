<script lang="ts">
  import { STROKE_WIDTH_PRESETS } from '$lib/canvas/strokeStyles';

  export let value: number = 2;
  export let min: number = 1;
  export let max: number = 20;
  export let disabled: boolean = false;
  export let onValueChange: (value: number) => void = () => {};

  const presets = [
    { label: 'Thin', value: STROKE_WIDTH_PRESETS.thin },
    { label: 'Regular', value: STROKE_WIDTH_PRESETS.regular },
    { label: 'Medium', value: STROKE_WIDTH_PRESETS.medium },
    { label: 'Thick', value: STROKE_WIDTH_PRESETS.thick },
    { label: 'Very Thick', value: STROKE_WIDTH_PRESETS.veryThick },
  ];

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = parseInt(target.value, 10);
    value = newValue;
    onValueChange(newValue);
  }

  function setPreset(presetValue: number) {
    if (disabled) return;
    value = presetValue;
    onValueChange(presetValue);
  }
</script>

<div class="stroke-width-slider">
  <label for="stroke-width" class="label">
    Stroke Width: {value}px
  </label>

  <!-- Preset buttons -->
  <div class="preset-buttons">
    {#each presets as preset}
      <button
        class="preset-button"
        class:active={value === preset.value}
        on:click={() => setPreset(preset.value)}
        title="{preset.label} ({preset.value}px)"
        {disabled}
      >
        {preset.value}
      </button>
    {/each}
  </div>

  <input
    id="stroke-width"
    type="range"
    {min}
    {max}
    step="1"
    {value}
    {disabled}
    on:input={handleInput}
    class="slider"
  />
  <div class="slider-labels">
    <span class="slider-label">{min}px</span>
    <span class="slider-label">{max}px</span>
  </div>
</div>

<style>
  .stroke-width-slider {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    font-size: 13px;
    font-weight: 500;
    color: #444;
  }

  .slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: #e0e0e0;
    outline: none;
    -webkit-appearance: none;
    transition: background 0.2s ease;
  }

  .slider:hover:not(:disabled) {
    background: #d0d0d0;
  }

  .slider:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #2196f3;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.2s ease;
  }

  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }

  .slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #2196f3;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.2s ease;
  }

  .slider::-moz-range-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }

  .slider:disabled::-webkit-slider-thumb {
    background: #ccc;
    cursor: not-allowed;
  }

  .slider:disabled::-moz-range-thumb {
    background: #ccc;
    cursor: not-allowed;
  }

  .slider-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 2px;
  }

  .slider-label {
    font-size: 11px;
    color: #999;
  }

  .preset-buttons {
    display: flex;
    gap: 4px;
    margin-bottom: 4px;
  }

  .preset-button {
    flex: 1;
    padding: 6px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 11px;
    color: #333;
    font-weight: 500;
  }

  .preset-button:hover:not(:disabled) {
    background-color: #f0f0f0;
    border-color: #999;
  }

  .preset-button.active {
    background-color: #2196f3;
    color: white;
    border-color: #2196f3;
  }

  .preset-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
