<script lang="ts">
  export let value: number = 1;
  export let disabled: boolean = false;
  export let onValueChange: (value: number) => void = () => {};

  $: percentage = Math.round(value * 100);

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = parseFloat(target.value);
    value = newValue;
    onValueChange(newValue);
  }
</script>

<div class="opacity-slider">
  <label for="opacity" class="label">
    Opacity: {percentage}%
  </label>
  <input
    id="opacity"
    type="range"
    min="0"
    max="1"
    step="0.01"
    {value}
    {disabled}
    on:input={handleInput}
    class="slider"
  />
  <div class="slider-labels">
    <span class="slider-label">0%</span>
    <span class="slider-label">100%</span>
  </div>
</div>

<style>
  .opacity-slider {
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
    background: linear-gradient(to right,
      rgba(33, 150, 243, 0.2),
      rgba(33, 150, 243, 1));
    outline: none;
    -webkit-appearance: none;
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
