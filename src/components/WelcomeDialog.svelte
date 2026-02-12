<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let visible = false;

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && visible) {
      handleContinue();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleContinue();
    }
  }

  function handleCreateFile() {
    dispatch('create');
  }

  function handleContinue() {
    dispatch('continue');
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="dialog-backdrop" on:click={handleBackdropClick}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="dialog" on:click|stopPropagation>
      <div class="dialog-header">
        <h2 class="dialog-title">Welcome to Napkin</h2>
      </div>

      <div class="dialog-content">
        <p class="welcome-text">
          Napkin is a local-first drawing tool with a hand-drawn feel. Your work stays on your machine — no cloud, no accounts.
        </p>

        <div class="info-card">
          <h3>How Canvases & Tabs Work</h3>
          <p>
            Each tab is a separate canvas. When you save, <strong>all tabs are saved together</strong> as a single <code>.napkin</code> file — like pages in a notebook.
          </p>
          <p>
            You can export individual canvases separately using <strong>File → Export Canvas</strong>.
          </p>
        </div>
      </div>

      <div class="dialog-footer">
        <button class="secondary-button" on:click={handleContinue}>
          Continue without saving
        </button>
        <button class="primary-button" on:click={handleCreateFile}>
          Create Your First Napkin
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .dialog {
    background-color: #fff;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    max-width: 520px;
    width: 90%;
    display: flex;
    flex-direction: column;
  }

  .dialog-header {
    padding: 24px 28px 0;
  }

  .dialog-title {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: #333;
  }

  .dialog-content {
    padding: 16px 28px 8px;
  }

  .welcome-text {
    font-size: 14px;
    color: #555;
    line-height: 1.6;
    margin: 0 0 16px;
  }

  .info-card {
    background-color: #f7f9fc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px 20px;
  }

  .info-card h3 {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 600;
    color: #333;
  }

  .info-card p {
    margin: 0 0 8px;
    font-size: 13px;
    color: #555;
    line-height: 1.5;
  }

  .info-card p:last-child {
    margin-bottom: 0;
  }

  .info-card code {
    background-color: #e8edf3;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 12px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  }

  .dialog-footer {
    padding: 16px 28px 24px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .primary-button {
    padding: 10px 20px;
    background-color: #0066ff;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .primary-button:hover {
    background-color: #0052cc;
  }

  .secondary-button {
    padding: 10px 20px;
    background-color: transparent;
    color: #666;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .secondary-button:hover {
    background-color: #f5f5f5;
    border-color: #ccc;
    color: #444;
  }
</style>
