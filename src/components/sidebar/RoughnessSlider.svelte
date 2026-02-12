<script lang="ts">
  export let value: number = 1;
  export let min: number = 0;
  export let max: number = 3;
  export let step: number = 0.5;
  export let disabled: boolean = false;
  export let onValueChange: (value: number) => void = () => {};

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = parseFloat(target.value);
    value = newValue;
    onValueChange(newValue);
  }
</script>

<div class="roughness-slider">
  <label for="roughness" class="label">
    Roughness: {value}
  </label>
  <input
    id="roughness"
    type="range"
    {min}
    {max}
    {step}
    {value}
    {disabled}
    on:input={handleInput}
    class="slider"
  />
  <div class="slider-labels">
    <span class="slider-label">— Smooth</span>
    <span class="slider-label">~ Rough</span>
  </div>
</div>

<style>
  .roughness-slider {
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
</style>
