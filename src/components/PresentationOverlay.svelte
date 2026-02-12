<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { canvasStore, toggleGrid } from '$lib/state/canvasStore';

  let visible = true;
  let fadeTimeout: ReturnType<typeof setTimeout> | null = null;

  function resetFadeTimer() {
    visible = true;
    if (fadeTimeout) clearTimeout(fadeTimeout);
    fadeTimeout = setTimeout(() => {
      visible = false;
    }, 3000);
  }

  function handleMouseMove() {
    resetFadeTimer();
  }

  function handleToggleGrid() {
    toggleGrid();
  }

  function handleExit() {
    canvasStore.update(s => ({ ...s, presentationMode: false }));
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  onMount(() => {
    resetFadeTimer();
    window.addEventListener('mousemove', handleMouseMove);
  });

  onDestroy(() => {
    if (fadeTimeout) clearTimeout(fadeTimeout);
    window.removeEventListener('mousemove', handleMouseMove);
  });
</script>

{#if $canvasStore.presentationMode}
  <div class="presentation-overlay" class:hidden={!visible}>
    <div class="presentation-toolbar">
      <button class="overlay-btn" on:click={handleToggleGrid} title="Toggle grid (G)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
        </svg>
        <span>Grid {$canvasStore.showGrid ? 'On' : 'Off'}</span>
      </button>
      <div class="overlay-divider"></div>
      <button class="overlay-btn exit-btn" on:click={handleExit} title="Exit presentation (Esc)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        <span>Exit</span>
      </button>
    </div>
  </div>
{/if}

<style>
  .presentation-overlay {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10001;
    transition: opacity 0.3s ease;
  }

  .presentation-overlay.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .presentation-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background-color: rgba(30, 30, 30, 0.85);
    backdrop-filter: blur(8px);
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .overlay-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #ddd;
    font-size: 13px;
    cursor: pointer;
    transition: background-color 0.15s ease;
    white-space: nowrap;
  }

  .overlay-btn:hover {
    background-color: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .exit-btn:hover {
    background-color: rgba(255, 80, 80, 0.3);
    color: #ff6b6b;
  }

  .overlay-divider {
    width: 1px;
    height: 20px;
    background-color: rgba(255, 255, 255, 0.2);
    margin: 0 4px;
  }
</style>
