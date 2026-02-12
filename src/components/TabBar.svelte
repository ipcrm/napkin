<script lang="ts">
  import { tabStore, createTab, switchTab, closeTab, renameTab } from '$lib/state/tabStore';

  let editingTabId: string | null = null;
  let editValue = '';

  function handleTabClick(tabId: string) {
    if (editingTabId) return;
    switchTab(tabId);
  }

  function handleTabDoubleClick(tabId: string, currentTitle: string) {
    editingTabId = tabId;
    editValue = currentTitle;
    // Focus the input after Svelte updates the DOM
    setTimeout(() => {
      const input = document.querySelector('.tab-rename-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  function finishRename() {
    if (editingTabId && editValue.trim()) {
      renameTab(editingTabId, editValue.trim());
    }
    editingTabId = null;
    editValue = '';
  }

  function handleRenameKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      finishRename();
    } else if (event.key === 'Escape') {
      editingTabId = null;
      editValue = '';
    }
  }

  function handleCloseTab(event: MouseEvent, tabId: string) {
    event.stopPropagation();
    closeTab(tabId);
  }

  function handleNewTab() {
    createTab();
  }
</script>

<div class="tab-bar">
  <div class="tabs-container">
    {#each $tabStore.tabs as tab (tab.id)}
      <button
        class="tab"
        class:active={tab.id === $tabStore.activeTabId}
        on:click={() => handleTabClick(tab.id)}
        on:dblclick={() => handleTabDoubleClick(tab.id, tab.title)}
      >
        {#if editingTabId === tab.id}
          <input
            class="tab-rename-input"
            bind:value={editValue}
            on:blur={finishRename}
            on:keydown={handleRenameKeyDown}
          />
        {:else}
          <span class="tab-title">
            {#if tab.isDirty}
              <span class="dirty-indicator">&#9679;</span>
            {/if}
            {tab.title}
          </span>
        {/if}
        {#if $tabStore.tabs.length > 1}
          <button
            class="tab-close"
            on:click={(e) => handleCloseTab(e, tab.id)}
            title="Close tab"
          >&times;</button>
        {/if}
      </button>
    {/each}
  </div>

  <button class="new-tab-button" on:click={handleNewTab} title="New tab">
    +
  </button>
</div>

<style>
  .tab-bar {
    display: flex;
    align-items: center;
    background-color: #f8f8f8;
    border-bottom: 1px solid #ddd;
    padding: 0 8px;
    height: 36px;
    gap: 4px;
    overflow-x: auto;
    flex-shrink: 0;
  }

  .tabs-container {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    overflow-x: auto;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background-color: transparent;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    cursor: pointer;
    font-size: 12px;
    color: #666;
    white-space: nowrap;
    max-width: 180px;
    transition: all 0.1s ease;
    height: 100%;
    box-sizing: border-box;
  }

  .tab:hover {
    background-color: #eee;
    color: #444;
  }

  .tab.active {
    background-color: #fff;
    border-color: #ddd;
    color: #1a73e8;
    font-weight: 500;
  }

  .tab-title {
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .dirty-indicator {
    color: #ff9800;
    font-size: 10px;
    line-height: 1;
  }

  .tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 14px;
    color: #999;
    line-height: 1;
    flex-shrink: 0;
  }

  .tab-close:hover {
    background-color: #ddd;
    color: #333;
  }

  .tab-rename-input {
    width: 100px;
    padding: 2px 4px;
    border: 1px solid #1a73e8;
    border-radius: 3px;
    font-size: 12px;
    outline: none;
    background: #fff;
  }

  .new-tab-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    color: #888;
    flex-shrink: 0;
    transition: all 0.1s ease;
  }

  .new-tab-button:hover {
    background-color: #eee;
    border-color: #ddd;
    color: #444;
  }
</style>
